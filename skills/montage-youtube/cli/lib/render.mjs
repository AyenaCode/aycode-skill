// preview / build: cut the rushes at the frame, clean and level the voice, export the .mp4.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dur, ffmpeg, fmt, loadAnalysis, loadProject, loudness, projectRoot, run, SYNC, writeJson } from './util.mjs';
import { makePlan, report } from './plan.mjs';

export const booleans = ['help'];
const HELP = `montage-youtube preview   aperçu rapide (petite taille) → exports/<nom>_apercu.mp4
montage-youtube build     export final pour YouTube   → exports/<nom>.mp4
    Coupe les rushs selon montage.md, à l'image près, puis nettoie la voix (grave parasite, souffle,
    sifflantes, écarts de volume) et la règle à ${'-14'} LUFS. La vidéo n'est encodée qu'une fois ; le son
    est traité d'un seul tenant, donc l'image et la voix restent synchrones jusqu'au bout.`;

const CLEAN = { non: null, leger: 6, normal: 12, fort: 20 };

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	const final = cmd === 'build';
	const root = projectRoot();
	const proj = loadProject(root);
	const an = loadAnalysis(root);
	const plan = makePlan(root);
	report(plan);
	const [num, den] = plan.rate.split('/').map(Number);
	const F = num / den;
	const kind = final ? 'final' : 'apercu';
	const dir = join(root, 'work', 'render');
	await mkdir(dir, { recursive: true });

	// Picture size: the output format, or its small version for the preview.
	let { width: W, height: H } = proj.sortie;
	if (!final) {
		const k = 540 / Math.min(W, H);
		if (k < 1) [W, H] = [2 * Math.round((W * k) / 2), 2 * Math.round((H * k) / 2)];
	}
	const video = final
		? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-bf', '2', '-g', String(Math.max(1, Math.round(F / 2))), '-pix_fmt', 'yuv420p']
		: ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p'];

	// 1. One part per rush: picture cut by `select`, voice cut by `atrim` with 5 ms fades, kept as PCM.
	// Picture and sound keep the file's own time origin, so an offset between them in the rush is kept.
	const parts = [];
	const t0 = Date.now();
	for (const [k, src] of proj.sources.entries()) {
		const segs = plan.segments.filter((s) => s.src === k);
		if (!segs.length) continue;
		const t = (f) => ((f * den) / num).toFixed(6);
		const mutes = plan.mutes.filter((m) => m.src === k);
		const mute = mutes.length ? `volume=volume=0:enable='${mutes.map((m) => `between(t,${m.a},${m.b})`).join('+')}',` : '';
		const sel = segs.map((s) => `gte(t,${(((s.f0 - 0.5) * den) / num).toFixed(6)})*lt(t,${(((s.f1 - 0.5) * den) / num).toFixed(6)})`).join('+');
		const graph = [
			`[0:v]fps=${plan.rate}:start_time=0,select='${sel}',setpts=N/FRAME_RATE/TB,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v]`,
			`[0:a:${src.audio ?? 0}]${SYNC(48000)},aformat=sample_fmts=fltp:channel_layouts=mono,${mute}asplit=${segs.length}${segs.map((_, i) => `[i${i}]`).join('')}`,
			...segs.map((s, i) => {
				const len = ((s.f1 - s.f0) * den) / num;
				return `[i${i}]atrim=start=${t(s.f0)}:end=${t(s.f1)},asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=${(len - 0.005).toFixed(6)}:d=0.005[o${i}]`;
			}),
			`${segs.map((_, i) => `[o${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[a]`
		].join(';\n');
		const script = join(dir, `${kind}-${k + 1}.filtre.txt`);
		await writeFile(script, graph);
		const out = join(dir, `${kind}-${k + 1}.mkv`);
		console.log(`Rush ${k + 1} : ${segs.length} morceaux…`);
		await ffmpeg(['-i', src.file, '-filter_complex_script', script, '-map', '[v]', '-map', '[a]', ...video, '-c:a', 'pcm_s16le', out]);
		parts.push(out);
	}
	let joined = parts[0];
	if (parts.length > 1) {
		const list = join(dir, `${kind}.liste.txt`);
		await writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
		joined = join(dir, `${kind}.mkv`);
		await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
	}

	// 2. The voice, cleaned and levelled in one piece.
	const nr = CLEAN[proj.reglages.nettoyage] ?? CLEAN.normal;
	const floor = Math.max(-80, Math.min(-20, Math.round(Math.min(...an.sources.map((s) => s.floor)))));
	const chain = ['highpass=f=80', ...(nr ? [`afftdn=nr=${nr}:nf=${floor}:tn=1`, 'deesser=i=0.3', 'acompressor=threshold=-24dB:ratio=2.5:attack=10:release=150'] : [])].join(',');
	const clean = join(dir, `${kind}-voix.wav`);
	await ffmpeg(['-i', joined, '-map', '0:a', '-af', chain, '-c:a', 'pcm_s24le', clean]);
	const voice = join(dir, `${kind}-voix.m4a`);
	const lv = await master(clean, voice, { target: proj.reglages.loudness ?? -14, ceiling: -1.5, bitrate: final ? '384k' : '160k' });

	// 3. Picture and voice together, playable before the download ends.
	const out = join(root, 'exports', `${proj.nom}${final ? '' : '_apercu'}.mp4`);
	await ffmpeg(['-i', joined, '-i', voice, '-map', '0:v', '-map', '1:a', '-c', 'copy', '-movflags', '+faststart', out]);

	// 4. Check what was written: frame count, durations, sync, level.
	const pr = JSON.parse((await run('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,nb_read_packets,duration', '-of', 'json', out])).out);
	const v = pr.streams.find((s) => s.codec_type === 'video');
	const au = pr.streams.find((s) => s.codec_type === 'audio');
	const frames = Number(v.nb_read_packets);
	const gap = Math.abs(Number(v.duration) - Number(au.duration));
	const ok = frames === plan.frames && gap <= 1 / F + 0.05;
	writeJson(join(dir, `${kind}.plan.json`), { file: out, ...plan });
	console.log(`\n${ok ? 'OK' : 'PROBLÈME'} ${out}`);
	console.log(`  ${dur(Number(v.duration))}, ${frames} images (attendu ${plan.frames}), écart image/son ${fmt(gap * 1000, 0)} ms, ${W}×${H}`);
	console.log(`  voix : ${fmt(lv.lufs)} LUFS, crête ${fmt(lv.peak)} dB${nr ? `, nettoyage ${proj.reglages.nettoyage}` : ', sans nettoyage'} · rendu en ${dur((Date.now() - t0) / 1000)}`);
	if (!ok) throw new Error('le fichier exporté ne correspond pas au plan (nombre d’images ou synchronisation).');
}

// One fixed gain to the target loudness, then a true-peak limiter (run at 192 kHz), then AAC. The level is
// measured on the encoded file and the gain corrected until it sits on the target.
async function master(input, out, { target, ceiling, bitrate }) {
	const before = await loudness(input);
	if (!Number.isFinite(before.lufs)) throw new Error('la voix montée est silencieuse.');
	let gain = Math.min(24, target - before.lufs);
	let after;
	for (let pass = 0; pass < 3; pass++) {
		const lim = 10 ** (ceiling / 20);
		await ffmpeg(['-i', input, '-af', `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${lim.toFixed(3)}:level=disabled:attack=3:release=60,aresample=48000`, '-c:a', 'aac', '-b:a', bitrate, '-ar', '48000', '-ac', '2', out]);
		after = await loudness(out);
		const miss = target - after.lufs;
		if (Math.abs(miss) <= 0.3 || gain >= 24) break;
		gain = Math.min(24, gain + miss);
	}
	return after;
}
