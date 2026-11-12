// ref: measure the rhythm of a reference video (shot changes, speech rate, pauses between phrases,
// sound under the voice, level) and lay its shots out on sheets, so its style can be described from evidence.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { dur, ffmpeg, findProject, fmt, loudness, num, probe, readWav, run, tc, which, writeJson, loadProject } from './util.mjs';
import { energy, islands, levels } from './signal.mjs';
import { transcribe } from './whisper.mjs';

export const booleans = ['help', 'appliquer'];
const HELP = `montage-youtube ref <url | fichier> [--de 0] [--duree 300] [--lang auto] [--appliquer]
    Mesure le rythme d'une vidéo de référence sur un extrait (par défaut ses 5 premières minutes).
    Une URL est téléchargée avec yt-dlp (extrait seulement, 720p au plus). Écrit dans references/ :
      <id>_planche-N.png  une image par plan, avec sa seconde
      <id>.txt            le texte parlé de l'extrait
      <id>.json           les mesures
    et affiche la fiche de rythme avec les réglages conseillés.
    --appliquer : dans un projet, écrit ces réglages (pause, pauseMax) dans projet.json.
    On reprend d'une référence son rythme et ses procédés, jamais ses images, sa musique ni ses textes.`;

export default async function (_cmd, a) {
	if (a.help || !a._[0]) return console.log(HELP);
	const root = findProject();
	const dir = join(root ?? process.cwd(), 'references');
	await mkdir(dir, { recursive: true });
	const from = num(a.de, 0);
	const span = num(a.duree, 300);
	let file = a._[0];
	let start = from;
	if (/^https?:/.test(file)) {
		if (!(await which('yt-dlp'))) throw new Error('yt-dlp manque pour télécharger une URL. Installe-le (https://github.com/yt-dlp/yt-dlp) ou donne un fichier vidéo.');
		console.log(`Téléchargement de l'extrait ${tc(from)} → ${tc(from + span)}…`);
		const r = await run('yt-dlp', ['-f', 'bv*[height<=720]+ba/b[height<=720]/b', '--merge-output-format', 'mp4', '--no-playlist', '--download-sections', `*${from}-${from + span}`, '-o', join(dir, '%(id)s.%(ext)s'), '--print', 'after_move:filepath', '--no-simulate', file]);
		if (r.code) throw new Error(`yt-dlp a échoué : ${r.err.trim().split('\n').pop()}`);
		file = r.out.trim().split('\n').pop();
		start = 0;
	}
	if (!existsSync(file)) throw new Error(`fichier introuvable : ${file}`);
	const id = basename(file).replace(/\.[^.]+$/, '');
	const base = join(dir, id);
	const m = await probe(file);
	const length = Math.max(0, Math.min(span, m.duration - start));
	if (length < 5) throw new Error(`l'extrait est trop court (${fmt(length)} s).`);
	const cut = ['-ss', String(start), '-t', String(length)];

	// Picture: shot changes (one pass), and the first frame of each shot on sheets of 30.
	console.log('Plans…');
	const portrait = m.height > m.width;
	const graph = `select='eq(n\\,0)+gt(scene\\,0.3)',showinfo,scale=${portrait ? 160 : 320}:-2,drawtext=text='%{pts\\:hms\\:${start}}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=6x5:padding=6:margin=6:color=0x1b1b1f`;
	const sc = await run('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...cut, '-i', file, '-vf', graph, '-an', '-fps_mode', 'vfr', `${base}_planche-%d.png`]);
	if (sc.code) throw new Error(`ffmpeg (plans) a échoué :\n${sc.err.trim().split('\n').slice(-3).join('\n')}`);
	const shots = [...sc.err.matchAll(/pts_time:([\d.]+)/g)].map((x) => Number(x[1]));
	const changes = Math.max(0, shots.length - 1);
	const sheets = [];
	for (let k = 1; existsSync(`${base}_planche-${k}.png`); k++) sheets.push(`${base}_planche-${k}.png`);

	// Voice: pauses between phrases, share of time spoken, sound under the voice, words per minute.
	console.log('Voix et texte…');
	const wav = `${base}.16k.wav`;
	await ffmpeg([...cut, '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
	const db = energy(readWav(wav));
	const lv = levels(db);
	const isl = islands(db, lv.thr);
	const pauses = isl.slice(1).map((s, i) => s.a - isl[i].b).filter((g) => g >= 0.2).sort((x, y) => x - y);
	const q = (p) => (pauses.length ? pauses[Math.min(pauses.length - 1, Math.floor(p * pauses.length))] : null);
	const spoken = isl.reduce((s, x) => s + x.b - x.a, 0);
	const level = await loudness(wav);
	let words = null;
	try {
		const tr = await transcribe(wav, base, { lang: String(a.lang ?? 'auto'), dtw: false });
		words = tr.words.length;
		await writeFile(`${base}.txt`, tr.words.map((w) => w.t).join(' ').replace(/([.?!…]) /g, '$1\n') + '\n');
	} catch (e) {
		console.log(`  texte non transcrit : ${e.message.split('\n')[0]}`);
	}
	await run('rm', ['-f', wav, `${base}.json`]);

	const pause = q(0.5) == null ? null : Math.min(0.8, Math.max(0.15, Math.round(q(0.5) * 20) / 20));
	const pauseMax = pause == null ? null : Math.min(1.2, Math.max(pause + 0.1, Math.round((q(0.75) + 0.1) * 20) / 20));
	const info = {
		file,
		from: start,
		length,
		width: m.width,
		height: m.height,
		fps: Math.round(m.fps * 100) / 100,
		shotChanges: changes,
		changesPerMinute: (changes / length) * 60,
		wordsPerMinute: words == null ? null : Math.round((words / length) * 60),
		speechShare: spoken / length,
		pauseMedian: q(0.5),
		pauseQ3: q(0.75),
		background: lv.floor,
		lufs: level.lufs,
		advice: { pause, pauseMax },
		sheets
	};
	writeJson(`${base}.json`, info);

	console.log(`\n${id} : extrait de ${dur(length)} (${tc(start)} → ${tc(start + length)}), ${m.width}×${m.height}, ${info.fps} i/s`);
	console.log(`  plans        ${changes} changements d'image, soit ${fmt(info.changesPerMinute, 0)} par minute${changes ? ` (un toutes les ${fmt(length / changes)} s)` : ''}`);
	if (words != null) console.log(`  parole       ${info.wordsPerMinute} mots par minute ; la voix occupe ${Math.round(info.speechShare * 100)} % du temps`);
	if (pause != null) console.log(`  pauses       entre deux phrases : ${fmt(q(0.5), 2)} s en médiane, ${fmt(q(0.75), 2)} s pour les trois quarts`);
	console.log(`  fond sonore  ${fmt(lv.floor, 0)} dB sous la voix${lv.floor > -45 ? ' : musique ou ambiance probable' : ' : silence entre les phrases'}`);
	console.log(`  niveau       ${fmt(level.lufs)} LUFS`);
	console.log(`  planches     ${sheets.join('\n               ')}`);
	console.log(`  mesures      ${base}.json${words != null ? ` · texte ${base}.txt` : ''}`);
	if (pause != null) {
		console.log(`\nRéglages conseillés : pause ${fmt(pause, 2)} s, pauseMax ${fmt(pauseMax, 2)} s.`);
		if (a.appliquer) {
			if (!root) throw new Error('--appliquer se lance depuis un projet.');
			const proj = loadProject(root);
			Object.assign(proj.reglages, { pause, pauseMax });
			writeJson(join(root, 'projet.json'), proj);
			console.log('  → écrits dans projet.json.');
		}
	}
}
