// apercu / build: render every piece of the timeline as its own clip (cached: a changed line re-renders only
// its clips), join them without re-encoding, burn the texts, lay the mixed sound, export and check. The final
// export comes with its subtitles (.srt) and its YouTube chapters.
import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { buildAss } from './ass.mjs';
import { mixAll } from './audio.mjs';
import { pub } from './freres.mjs';
import { checkFont } from './police.mjs';
import { loadScript } from './script.mjs';
import { buildTimeline } from './timeline.mjs';
import { chapterTime, dur, ffmpeg, fmt, hash, loadConfig, loudness, pool, projectRoot, run, srtTime, wordsOf, writeJson } from './util.mjs';

export const booleans = ['help', 'estime'];
const HELP = `refonte-youtube apercu [--estime]   aperçu rapide (moitié de la taille finale) → exports/<nom>_apercu.mp4
refonte-youtube build              export final → exports/<nom>.mp4, <nom>.srt, <nom>_chapitres.txt
    Rend chaque plan de la timeline (gardé en cache : seule une réplique modifiée est rendue de nouveau), les met
    bout à bout, incruste mots forts, cartons et titres de chapitre, mixe voix, musique et bruitages à -14 LUFS.
    --estime (aperçu seulement) : sans prises de voix, durées estimées sur le texte, image seule et sans son,
    pour juger le visuel avant de générer la voix.
    Contrôle à la fin : nombre d'images, synchronisation image/son, niveau.`;

// Bump when the way a clip is rendered changes, so cached clips are not reused.
const CLIP_VERSION = 1;
const ffColor = (c) => `0x${String(c).replace(/^#/, '')}`;

// One piece → one clip of exactly `frames` images at the output size and rate, without sound.
async function renderPiece(p, o, out) {
	const { w, h, F, final } = o;
	const fit = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${ffColor(o.fond)},setsar=1`;
	// Slow push-in from 1 to k over the clip, eased, on a picture upscaled twice so the move does not shake.
	const zoom = p.zoom && p.zoom.k > 1.001
		? [`scale=${w * 2}:${h * 2}`, `zoompan=z='1+${(p.zoom.k - 1).toFixed(4)}*(1-cos(PI*min(on/${p.frames},1)))/2':x='(iw-iw/zoom)*${p.zoom.x}':y='(ih-ih/zoom)*${p.zoom.y}':d=1:s=${w}x${h}:fps=${F}`]
		: [];
	let input;
	let chain;
	if (p.kind === 'source' || p.kind === 'motion') {
		input = ['-ss', p.ss.toFixed(3), '-t', (p.len + 0.5).toFixed(3), '-i', p.file];
		// Hold the last image as long as needed: the frame count cuts the clip exactly.
		chain = [`setpts=(PTS-STARTPTS)/${p.k.toFixed(5)}`, `fps=${F}`, fit, `tpad=stop_mode=clone:stop_duration=${(p.frames / F + 1).toFixed(2)}`, ...zoom];
	} else if (p.kind === 'image') {
		input = ['-loop', '1', '-framerate', String(F), '-i', p.file];
		chain = [fit, ...zoom];
	} else {
		input = ['-f', 'lavfi', '-i', `color=c=${ffColor(p.fond)}:s=${w}x${h}:r=${F}`];
		chain = [];
	}
	chain.push('format=yuv420p');
	const enc = final ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16'] : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28'];
	// Same encoder settings and time scale for every clip: the concat demuxer can then join them as they are.
	await ffmpeg([...input, '-vf', chain.join(','), '-frames:v', String(p.frames), '-an', ...enc, '-pix_fmt', 'yuv420p', '-r', String(F), '-video_track_timescale', String(F * 512), out]);
}

// Subtitles: each line in cues of two lines of 42 characters at most, timed on the voice.
function subtitles(tl, syllables) {
	const out = [];
	for (const it of tl.items) {
		if (!it.voice) continue;
		const ws = wordsOf(it.line.text);
		const chunks = [];
		let cur = [];
		for (const w of ws) {
			if (cur.length && [...cur, w].join(' ').length > 84) {
				chunks.push(cur);
				cur = [];
			}
			cur.push(w);
			// Break after a sentence or a clause once the cue is long enough.
			if (/[.!?…;:]$/.test(w) || (/,$/.test(w) && cur.join(' ').length > 40)) {
				chunks.push(cur);
				cur = [];
			}
		}
		if (cur.length) chunks.push(cur);
		const total = syllables(it.line.text) || 1;
		let done = 0;
		for (const c of chunks) {
			const text = c.join(' ');
			const a = it.voice.at + (it.voice.dur * done) / total;
			done += syllables(text);
			const z = it.voice.at + (it.voice.dur * done) / total;
			// Two lines, broken at the space nearest the middle.
			let shown = text;
			if (text.length > 42) {
				const mid = text.length / 2;
				const cut = [...text.matchAll(/ /g)].map((m) => m.index).reduce((b, i) => (Math.abs(i - mid) < Math.abs(b - mid) ? i : b), text.indexOf(' '));
				shown = `${text.slice(0, cut)}\n${text.slice(cut + 1)}`;
			}
			out.push({ a, z, text: shown });
		}
	}
	return out.map((c, i) => `${i + 1}\n${srtTime(c.a)} --> ${srtTime(Math.min(c.z, out[i + 1]?.a ?? c.z))}\n${c.text}\n`).join('\n');
}

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	const final = cmd === 'build';
	const kind = final ? 'final' : 'apercu';
	const estimate = !final && !!a.estime;
	const root = projectRoot();
	const cfg = loadConfig(root);
	const { lines, errors } = loadScript(root);
	if (errors.length) throw new Error(`script.md à corriger :\n  ${errors.join('\n  ')}`);
	const tl = await buildTimeline(root, cfg, lines, { estimate });
	if (tl.errors.length) throw new Error(`la timeline a des erreurs (détail : « refonte-youtube plan ») :\n  ${tl.errors.join('\n  ')}`);
	const t0 = Date.now();
	const F = tl.F;
	const even = (x) => Math.round(x / 2) * 2;
	const o = { w: final ? tl.W : even(tl.W / 2), h: final ? tl.H : even(tl.H / 2), F, final, fond: cfg.style.fond };
	const work = join(root, 'work', kind);
	const clips = join(root, 'work', 'plans', kind);
	await mkdir(clips, { recursive: true });
	await mkdir(join(root, 'exports'), { recursive: true });

	// 1. Picture: one clip per piece, rendered only if not already in the cache.
	const pieces = tl.items.flatMap((it) => it.pieces);
	const files = pieces.map((p) => {
		const mtime = p.file && existsSync(p.file) ? statSync(p.file).mtimeMs : null;
		const key = hash({ v: CLIP_VERSION, kind: p.kind, file: p.file ?? null, mtime, ss: p.ss ?? null, len: p.len ?? null, k: p.k ?? null, frames: p.frames, zoom: p.zoom ?? null, fond: p.fond ?? o.fond, w: o.w, h: o.h, F, final });
		return join(clips, `${key}.mp4`);
	});
	const todo = pieces.map((p, i) => ({ p, f: files[i] })).filter(({ f }) => !existsSync(f));
	console.log(`Rendu ${final ? 'final' : 'de l’aperçu'} : ${pieces.length} plans (${todo.length} à rendre, ${pieces.length - todo.length} en cache), ${dur(tl.duration)}…`);
	let done = 0;
	await pool(
		todo.map(({ p, f }) => async () => {
			const tmp = `${f}.part.mp4`;
			await renderPiece(p, o, tmp);
			await run('mv', [tmp, f]);
			if (++done % 10 === 0 || done === todo.length) console.log(`  plans rendus : ${done}/${todo.length}`);
		}),
		final ? 2 : 3
	);
	await mkdir(work, { recursive: true });
	const list = join(work, 'liste.txt');
	await writeFile(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');

	// 2. Texts burned in.
	const ass = buildAss(cfg, tl);
	const assFile = join(work, 'titres.ass');
	if (ass.events) {
		const c = await checkFont(root, cfg);
		if (!c.ok) throw new Error(c.why);
		await writeFile(assFile, ass.text);
	}

	// 3. Sound (not in an estimated preview: there is no voice yet).
	const sound = estimate ? null : await mixAll(root, tl, cfg, work);

	// 4. Export.
	const out = join(root, 'exports', `${cfg.nom}${final ? '' : '_apercu'}.mp4`);
	const vf = ass.events ? `ass=filename=${relative(root, assFile)}:fontsdir=fonts,format=yuv420p` : 'format=yuv420p';
	const enc = final
		? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-bf', '2', '-g', String(Math.max(1, Math.round(F / 2))), '-pix_fmt', 'yuv420p']
		: ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p'];
	console.log(`  assemblage : ${ass.events} texte(s) incrusté(s)${sound ? `, son mixé` : ', sans son'}…`);
	await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, ...(sound ? ['-i', sound.file] : []), '-map', '0:v:0', ...(sound ? ['-map', '1:a:0', '-c:a', 'copy'] : ['-an']), '-vf', vf, ...enc, '-r', String(F), '-t', tl.duration.toFixed(3), '-movflags', '+faststart', out], { cwd: root });

	// 5. Check what was written.
	const pr = JSON.parse((await run('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,nb_read_packets,duration,width,height', '-of', 'json', out])).out);
	const v = pr.streams.find((s) => s.codec_type === 'video');
	const au = pr.streams.find((s) => s.codec_type === 'audio');
	const frames = Number(v.nb_read_packets);
	const gap = au ? Math.abs(Number(v.duration) - Number(au.duration)) : 0;
	const lv = au ? await loudness(out) : null;
	const ok = Math.abs(frames - tl.frames) <= 1 && gap <= 1 / F + 0.05;
	writeJson(join(work, 'rapport.json'), { file: out, duration: Number(v.duration), frames, expected: tl.frames, gap, width: v.width, height: v.height, lufs: lv?.lufs ?? null, peak: lv?.peak ?? null, sound, at: new Date().toISOString() });

	// 6. Subtitles and chapters, next to the final export.
	if (final) {
		const { syllables } = await pub.voice();
		await writeFile(join(root, 'exports', `${cfg.nom}.srt`), subtitles(tl, syllables));
		const ch = tl.chapters.map((c) => `${chapterTime(c.at)} ${c.title}`);
		if (ch.length && tl.chapters[0].at > 0) ch.unshift('0:00 Intro');
		if (ch.length) await writeFile(join(root, 'exports', `${cfg.nom}_chapitres.txt`), ch.join('\n') + '\n');
	}

	console.log(`\n${ok ? 'OK' : 'PROBLÈME'} ${out}`);
	console.log(`  ${dur(Number(v.duration))}, ${frames} images (attendu ${tl.frames}), écart image/son ${fmt(gap * 1000, 0)} ms, ${v.width}×${v.height}`);
	const db = (x) => (Number.isFinite(x) ? fmt(x) : '-∞');
	if (lv) console.log(`  son : ${db(lv.lufs)} LUFS, crête ${db(lv.peak)} dB${sound.under !== null ? `, musique ${sound.under} LU sous la voix et ${sound.baisse} dB de plus quand elle parle` : ', sans musique'}, ${sound.sfx} bruitage(s)`);
	else console.log('  sans son.');
	if (sound?.musicStops) console.log(`  attention : la musique s’arrête à ${dur(sound.musicStops)}, avant la fin : ajoute un morceau dans refonte.json (musique).`);
	const kwExact = tl.items.flatMap((it) => it.keywords);
	if (kwExact.length && kwExact.some((k) => !k.exact) && !estimate) console.log(`  ${kwExact.filter((k) => !k.exact).length}/${kwExact.length} mot(s) fort(s) placés par estimation : « refonte-youtube mots » les cale sur la voix.`);
	if (final) console.log(`  sous-titres → exports/${cfg.nom}.srt${tl.chapters.length ? ` · chapitres → exports/${cfg.nom}_chapitres.txt` : ''}`);
	console.log(`  rendu en ${dur((Date.now() - t0) / 1000)}`);
	if (!ok) throw new Error('le fichier exporté ne correspond pas à la timeline (nombre d’images ou synchronisation).');
}
