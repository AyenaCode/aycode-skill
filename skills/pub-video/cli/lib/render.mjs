// Frames → video. Several browsers render frame ranges in parallel; each frame can be the average
// of several sub-frames (motion blur). Also: stills and contact sheets for visual review.
import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { launch, openVideo } from './browser.mjs';
import { serve } from './server.mjs';
import { fail, ffmpeg } from './util.mjs';

// RGB frames → BT.709 limited-range 4:2:0, tagged, so brand colours survive on every player.
const TO_709 = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p';
const TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// Errors of the page stop a render; a still or a sheet is still drawn, so the problem can be looked at.
export function reportProblems(v, name, fatal = true) {
	const errs = [...new Set([...v.meta.errors, ...v.problems])];
	if (!errs.length) return;
	const msg = `videos/${name}.html a des erreurs :\n  - ${errs.join('\n  - ')}`;
	if (fatal) fail(msg);
	console.log(`  ${msg}`);
}

// opts: out, workers, samples (sub-frames per frame, 1 = no blur), shutter (0..1 of a frame),
// scale, from, to (seconds), crf, preset.
export async function renderVideo(root, name, opts = {}) {
	const server = await serve(root);
	const probe = await openVideo(root, name, { server });
	reportProblems(probe, name);
	const { meta } = probe;
	await probe.close();

	const fps = meta.fps;
	const samples = Math.max(1, opts.samples ?? 8);
	const shutter = opts.shutter ?? 0.5;
	const scale = opts.scale ?? 1;
	const f0 = Math.round((opts.from ?? 0) * fps);
	const f1 = Math.round((opts.to ?? meta.duration) * fps);
	const total = f1 - f0;
	const workers = Math.max(1, Math.min(opts.workers ?? Math.min(6, Math.floor(availableParallelism() / 2)), Math.ceil(total / 24)));
	const out = opts.out ?? join(root, 'render', `${name}_video.mp4`);
	// One parts folder per run: two renders of the same video at once never write into each other's files.
	// Folders left by a render that was killed are removed.
	const tmp = `${out}.parts-${process.pid}`;
	await mkdir(dirname(out), { recursive: true });
	for (const d of await readdir(dirname(out))) {
		const pid = Number(/\.parts-(\d+)$/.exec(d)?.[1]);
		if (!pid || !d.startsWith(basename(out)) || pid === process.pid) continue;
		try {
			process.kill(pid, 0);
		} catch {
			await rm(join(dirname(out), d), { recursive: true, force: true });
		}
	}
	await mkdir(tmp, { recursive: true });

	const blur = samples > 1 ? `tmix=frames=${samples},select='not(mod(n+1\\,${samples}))',setpts=N/(${fps}*TB),` : '';
	const per = Math.ceil(total / workers);
	const t0 = Date.now();
	let done = 0;
	let reused = 0;
	const tick = () => {
		if (process.stdout.isTTY) process.stdout.write(`\r  ${done}/${total} images`);
		else if (done % Math.ceil(total / 5) === 0) console.log(`  ${done}/${total} images`);
	};
	const parts = [];
	await Promise.all(
		Array.from({ length: workers }, async (_, w) => {
			const a = f0 + w * per;
			const z = Math.min(f1, a + per);
			if (a >= z) return;
			const part = join(tmp, `part${String(w).padStart(2, '0')}.mp4`);
			parts[w] = part;
			const ff = spawn(
				'ffmpeg',
				['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps * samples), '-c:v', 'png', '-i', '-',
					'-vf', `${blur}${TO_709}`, '-c:v', 'libx264', '-profile:v', 'high', '-preset', opts.preset ?? 'slow', '-crf', String(opts.crf ?? 16),
					'-g', String(fps * 2), '-bf', '2', '-r', String(fps), ...TAGS, part],
				{ stdio: ['pipe', 'inherit', 'inherit'] }
			);
			const send = async (buf) => {
				if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
			};
			const browser = await launch();
			const v = await openVideo(root, name, { server, browser, scale });
			for (let fr = a; fr < z; fr++) {
				const at = (s) => (fr + (s / samples) * shutter) / fps;
				const first = await v.shot(at(0));
				if (samples === 1) await send(first);
				else {
					// Nothing moves between the first and last sub-frame: the frame is still, no need to draw the rest.
					const last = await v.shot(at(samples - 1));
					if (first.equals(last)) {
						reused++;
						for (let s = 0; s < samples; s++) await send(first);
					} else {
						await send(first);
						for (let s = 1; s < samples - 1; s++) await send(await v.shot(at(s)));
						await send(last);
					}
				}
				done++;
				tick();
			}
			ff.stdin.end();
			const code = await new Promise((r) => ff.on('close', r));
			await v.close();
			await browser.close();
			if (code) throw new Error('ffmpeg a échoué pendant le rendu.');
		})
	);
	const list = join(tmp, 'list.txt');
	await writeFile(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n') + '\n');
	// Written beside, then renamed: the finished file appears whole, even if another render ends at the same time.
	const joined = join(tmp, 'video.mp4');
	await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined]);
	await rename(joined, out);
	await rm(tmp, { recursive: true, force: true });
	server.close();
	const secs = (Date.now() - t0) / 1000;
	if (process.stdout.isTTY) process.stdout.write('\r');
	console.log(`  ${total} images (${samples} sous-images, ${workers} navigateurs, ${reused} images fixes) en ${secs.toFixed(0)} s → ${out}`);
	return { out, frames: total, meta };
}

// Label drawn over a still, so a contact sheet says which moment each tile shows.
const LABEL = `(text) => {
	let el = document.getElementById('__pv_label');
	if (!el) {
		el = document.createElement('div');
		el.id = '__pv_label';
		el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:rgba(0,0,0,.82);color:#fff;font:600 34px/1.2 system-ui,sans-serif;padding:10px 18px;border-bottom-right-radius:14px;letter-spacing:0';
		document.body.appendChild(el);
	}
	el.textContent = text;
	el.style.display = text ? 'block' : 'none';
}`;
const sceneAt = (meta, t) => meta.scenes.filter((s) => t >= s.start - 1e-6 && t < s.end - 1e-6).map((s) => s.name).join('+') || '—';

// Times for a review: a few per scene (settling, middle, just before the exit) or around each cut.
export function reviewTimes(meta, mode) {
	const ts = [];
	const end = meta.duration - 1 / meta.fps;
	if (mode === 'transitions') {
		for (const s of meta.scenes.slice(1)) for (const d of [-0.2, -0.1, -0.033, 0.033, 0.1, 0.2, 0.35]) ts.push(s.start + d);
	} else {
		for (const s of meta.scenes) {
			const d = s.end - s.start;
			ts.push(s.start + Math.min(0.4, d * 0.2), s.start + d * 0.5, s.end - Math.min(0.25, d * 0.15));
		}
	}
	return [...new Set(ts.map((t) => Math.round(Math.min(end, Math.max(0, t)) * 1000) / 1000))].sort((a, z) => a - z);
}

// PNG stills at the given times. Returns their paths.
export async function stills(root, name, times, { scale = 0.5, dir, label = false, guides = false } = {}) {
	const v = await openVideo(root, name, { scale, query: guides ? '?guides=1' : '' });
	reportProblems(v, name, false);
	dir ??= join(root, 'render', 'stills');
	await mkdir(dir, { recursive: true });
	const paths = [];
	for (const t of times) {
		await v.render(t);
		if (label) await v.page.evaluate(`(${LABEL})(${JSON.stringify(`${t.toFixed(2)} s · ${sceneAt(v.meta, t)}`)})`);
		const p = join(dir, `${name}_${t.toFixed(2)}.png`);
		await writeFile(p, await v.shot());
		paths.push(p);
	}
	await v.close();
	return { paths, meta: v.meta };
}

// Sheets of labelled stills (14 per sheet: 7 × 2), to look at many moments at once. Returns the paths.
export async function sheet(root, name, times, { out, cols = 7, rows = 2, tile = 270, guides = false } = {}) {
	const dir = join(root, 'render', `sheet.tmp-${process.pid}`);
	await rm(dir, { recursive: true, force: true });
	if (!times) {
		const v = await openVideo(root, name, { scale: 0.5 });
		times = reviewTimes(v.meta, 'scenes');
		await v.close();
	}
	const { paths, meta } = await stills(root, name, times, { scale: 0.5, dir, label: true, guides });
	// Wide frames: fewer, larger tiles so details stay readable.
	if (meta.w > meta.h) [cols, rows, tile] = [4, 3, Math.max(tile, 470)];
	const th = Math.round((tile * meta.h) / meta.w);
	const per = cols * rows;
	const base = (out ?? join(root, 'render', `${name}_planche.png`)).replace(/\.png$/, '');
	// Sheets of an earlier, longer series would stay beside the new ones and pass for current.
	for (const d of await readdir(dirname(base))) if (new RegExp(`^${basename(base).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-\\d+)?\\.png$`).test(d)) await rm(join(dirname(base), d), { force: true });
	const outs = [];
	for (let k = 0; k * per < paths.length; k++) {
		const group = paths.slice(k * per, (k + 1) * per);
		const file = paths.length > per ? `${base}-${k + 1}.png` : `${base}.png`;
		const inputs = group.flatMap((p) => ['-i', p]);
		const scaled = group.map((_, i) => `[${i}:v]scale=${tile}:${th}[s${i}]`).join(';');
		const layout = group.map((_, i) => `${(i % cols) * (tile + 8)}_${Math.floor(i / cols) * (th + 8)}`).join('|');
		const stack = group.length === 1 ? '[s0]copy[o]' : `${group.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${group.length}:layout=${layout}:fill=0x1b1b1f[o]`;
		await ffmpeg([...inputs, '-filter_complex', `${scaled};${stack}`, '-map', '[o]', '-frames:v', '1', file]);
		outs.push(file);
		console.log(`  planche (${group.length} images, de ${times[k * per].toFixed(2)} à ${times[Math.min(paths.length, (k + 1) * per) - 1].toFixed(2)} s) → ${file}`);
	}
	await rm(dir, { recursive: true, force: true });
	return outs;
}
