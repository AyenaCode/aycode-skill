// ref: measure what can be measured in a reference video (cut rhythm, tempo, speech rate) and lay its
// shots out on sheets, so its style can be described from evidence.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { run, ffmpeg, which, findWhisper, fmt, num } from './util.mjs';
import { analyse } from './music.mjs';
import { loudness } from './audio.mjs';

export const booleans = ['help', 'no-speech'];
const HELP = `pub-video ref <url | fichier> [--out references] [--lang auto] [--no-speech]
    Télécharge la vidéo (yt-dlp) si c'est une URL, puis écrit dans references/ :
      <id>_plans-n.png   une image par plan, dans l'ordre (14 par planche)
      <id>.srt           le texte parlé, horodaté (si whisper.cpp est installé)
      <id>.json          les mesures : durée, format, plans, coupes, tempo, débit de parole, niveau sonore
    et affiche la fiche de rythme. Le style visuel se décrit ensuite en regardant les planches.
    On reprend d'une référence son rythme, sa structure et ses procédés, jamais ses images, sa musique ni ses textes.`;

export default async function (_cmd, a) {
	if (a.help || !a._[0]) return console.log(HELP);
	// resolve, not join: an absolute --out stays as given instead of being glued after the current folder.
	const dir = resolve(String(a.out ?? 'references'));
	await mkdir(dir, { recursive: true });
	let file = a._[0];
	if (/^https?:/.test(file)) {
		if (!(await which('yt-dlp'))) throw new Error('yt-dlp manque pour télécharger une URL. Installe-le (https://github.com/yt-dlp/yt-dlp) ou donne un fichier vidéo.');
		const r = await run('yt-dlp', ['-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b', '--merge-output-format', 'mp4', '--no-playlist', '-o', join(dir, '%(id)s.%(ext)s'), '--print', 'after_move:filepath', '--no-simulate', file]);
		if (r.code) throw new Error(`yt-dlp a échoué : ${r.err.trim().split('\n').pop()}`);
		file = r.out.trim().split('\n').pop();
		console.log(`  téléchargée : ${file}`);
	}
	if (!existsSync(file)) throw new Error(`fichier introuvable : ${file}`);
	const id = basename(file).replace(/\.[^.]+$/, '');
	const base = join(dir, id);

	const pr = JSON.parse((await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', file])).out);
	const vs = pr.streams.find((s) => s.codec_type === 'video');
	const duration = Number(pr.format.duration);
	const [fa, fb] = vs.r_frame_rate.split('/').map(Number);
	const info = { file, duration, width: vs.width, height: vs.height, fps: Math.round((fa / fb) * 100) / 100, hasAudio: pr.streams.some((s) => s.codec_type === 'audio') };

	// Cuts: frames whose picture differs sharply from the one before.
	const sc = await run('ffmpeg', ['-hide_banner', '-i', file, '-vf', `select='gt(scene,${num(a.threshold, 0.3)})',showinfo`, '-an', '-f', 'null', '-']);
	const cuts = [...sc.err.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((t, i, l) => i === 0 || t - l[i - 1] > 0.12);
	const bounds = [0, ...cuts, duration];
	const shots = bounds.slice(1).map((t, i) => t - bounds[i]).filter((d) => d > 0.05);
	const sorted = [...shots].sort((p, q) => p - q);
	info.shots = shots.length;
	info.cuts = cuts.map((t) => Math.round(t * 100) / 100);
	info.shotMean = duration / shots.length;
	info.shotMedian = sorted[sorted.length >> 1];
	info.shotMin = sorted[0];
	info.shotMax = sorted.at(-1);

	// One frame per shot, a little after the cut, on sheets of 14.
	const tile = 270;
	const th = Math.round((tile * vs.height) / vs.width);
	const cols = vs.width > vs.height ? 5 : 7;
	const rows = vs.width > vs.height ? 4 : 2;
	const per = cols * rows;
	const times = bounds.slice(0, -1).map((t, i) => Math.min(duration - 0.05, t + Math.min(0.3, (bounds[i + 1] - t) / 2))).slice(0, per * 6);
	const tmp = join(dir, '.tmp');
	await mkdir(tmp, { recursive: true });
	for (const [i, t] of times.entries()) await ffmpeg(['-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=${tile}:${th},drawtext=text='${fmt(t, 1)} s':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5`, join(tmp, `${String(i).padStart(3, '0')}.png`)]);
	info.sheets = [];
	for (let k = 0; k * per < times.length; k++) {
		const n = Math.min(per, times.length - k * per);
		const inputs = Array.from({ length: n }, (_, i) => ['-i', join(tmp, `${String(k * per + i).padStart(3, '0')}.png`)]).flat();
		const layout = Array.from({ length: n }, (_, i) => `${(i % cols) * (tile + 8)}_${Math.floor(i / cols) * (th + 8)}`).join('|');
		const out = `${base}_plans-${k + 1}.png`;
		await ffmpeg([...inputs, '-filter_complex', n === 1 ? '[0:v]copy[o]' : `${Array.from({ length: n }, (_, i) => `[${i}:v]`).join('')}xstack=inputs=${n}:layout=${layout}:fill=0x1b1b1f[o]`, '-map', '[o]', '-frames:v', '1', out]);
		info.sheets.push(out);
	}
	await run('rm', ['-rf', tmp]);

	// Sound: tempo and loudness; do cuts fall on the beat?
	if (info.hasAudio) {
		try {
			const m = await analyse(file);
			info.bpm = m.bpm;
			info.rhythm = Math.round(m.confidence * 10) / 10;
			const onBeat = cuts.filter((t) => {
				const k = (t - m.first) / m.period;
				return Math.abs(k - Math.round(k)) * m.period < 0.09;
			}).length;
			info.cutsOnBeat = cuts.length >= 4 && m.confidence >= 4 ? onBeat / cuts.length : null;
		} catch {}
		info.loudness = await loudness(file);
		const wh = a['no-speech'] ? null : await findWhisper();
		if (wh) {
			const wav = `${base}.16k.wav`;
			await ffmpeg(['-i', file, '-ac', '1', '-ar', '16000', wav]);
			const r = await run(wh.bin, ['-m', wh.model, '-f', wav, '-l', String(a.lang ?? 'auto'), '-osrt', '-of', base, '-np']);
			await run('rm', ['-f', wav]);
			if (!r.code && existsSync(`${base}.srt`)) {
				const srt = await readFile(`${base}.srt`, 'utf8');
				const text = srt.split('\n').filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !l.includes('-->')).join(' ');
				const spoken = [...srt.matchAll(/(\d+):(\d+):(\d+)[,.](\d+) --> (\d+):(\d+):(\d+)[,.](\d+)/g)].reduce((s, m) => s + (m[5] * 3600 + m[6] * 60 + +m[7] + m[8] / 1000) - (m[1] * 3600 + m[2] * 60 + +m[3] + m[4] / 1000), 0);
				info.words = text.split(/\s+/).filter(Boolean).length;
				info.wordsPerMinute = spoken > 1 ? Math.round((info.words / spoken) * 60) : null;
				info.speechShare = spoken / duration;
				info.transcript = `${base}.srt`;
			}
		}
	}
	await writeFile(`${base}.json`, JSON.stringify(info, null, 1));

	console.log(`\n${id} : ${fmt(duration, 1)} s, ${info.width}×${info.height} (${info.width > info.height ? 'horizontal' : info.width === info.height ? 'carré' : 'vertical'}), ${info.fps} i/s`);
	console.log(`  plans         ${info.shots}, soit un changement toutes les ${fmt(info.shotMean, 2)} s en moyenne (médiane ${fmt(info.shotMedian, 2)} s, de ${fmt(info.shotMin, 2)} à ${fmt(info.shotMax, 1)} s)`);
	if (info.bpm) console.log(`  musique       ${info.bpm} BPM (netteté ${info.rhythm} ; en dessous de 4, il n'y a sans doute pas de musique rythmée)${info.cutsOnBeat == null ? '' : `, ${Math.round(info.cutsOnBeat * 100)} % des coupes tombent sur un temps`}`);
	if (info.loudness) console.log(`  niveau        ${info.loudness.lufs} LUFS, crête ${info.loudness.peak} dB`);
	if (info.wordsPerMinute) console.log(`  parole        ${info.words} mots, ${info.wordsPerMinute} mots par minute, la voix occupe ${Math.round(info.speechShare * 100)} % de la durée → ${info.transcript}`);
	else if (info.hasAudio && !a['no-speech']) console.log('  parole        non transcrite (whisper.cpp absent ou pas de voix)');
	console.log(`  planches      ${info.sheets.join('\n                ')}`);
	console.log(`  mesures       ${base}.json`);
}
