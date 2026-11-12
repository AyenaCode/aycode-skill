// doctor: check every tool the skill relies on and say how to install what is missing.
import { basename, join } from 'node:path';
import { findWhisper, run, SKILL, which } from './util.mjs';

export const booleans = ['help'];
const HELP = `montage-youtube doctor
    Vérifie Node, FFmpeg (codecs et filtres utilisés), ffprobe, whisper.cpp et son modèle, et yt-dlp (optionnel).`;

const FILTERS = ['afftdn', 'deesser', 'acompressor', 'alimiter', 'ebur128', 'freezedetect', 'tile', 'drawtext', 'select', 'atrim', 'concat', 'highpass'];

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const rows = [];
	let missing = 0;
	const add = (ok, name, detail, fix, optional = false) => {
		rows.push([ok ? 'ok ' : optional ? ' – ' : 'KO ', name, ok ? detail : `${detail ? `${detail}. ` : ''}${fix}`]);
		if (!ok && !optional) missing++;
	};

	const major = Number(process.versions.node.split('.')[0]);
	add(major >= 20, 'Node.js', `v${process.versions.node}`, 'Installe Node 20 ou plus (https://nodejs.org).');

	const ff = await run('ffmpeg', ['-hide_banner', '-version']);
	add(!ff.code, 'FFmpeg', /ffmpeg version (\S+)/.exec(ff.out)?.[1], 'Installe-le : « sudo apt install -y ffmpeg » (Linux) ou « brew install ffmpeg » (macOS).');
	if (!ff.code) {
		const enc = (await run('ffmpeg', ['-hide_banner', '-encoders'])).out;
		const fil = (await run('ffmpeg', ['-hide_banner', '-filters'])).out;
		const lacking = [...['libx264', 'aac'].filter((n) => !new RegExp(`\\s${n}\\s`).test(enc)), ...FILTERS.filter((n) => !new RegExp(`\\s${n}\\s`).test(fil))];
		add(!lacking.length, 'FFmpeg : codecs et filtres', 'libx264, aac, afftdn, deesser, freezedetect…', `Il manque ${lacking.join(', ')} : installe un FFmpeg complet.`);
	}
	add(!(await run('ffprobe', ['-version'])).code, 'ffprobe', '', 'Il est fourni avec FFmpeg.');

	const wh = await findWhisper();
	const build = 'git clone https://github.com/ggml-org/whisper.cpp ~/whisper.cpp && cd ~/whisper.cpp && cmake -B build && cmake --build build -j --config Release && ./models/download-ggml-model.sh large-v3-turbo';
	add(!!wh, 'whisper.cpp (transcription)', wh ? `${wh.bin}` : '', `Installe-le : ${build}  (ou indique WHISPER_CLI et WHISPER_MODEL).`);
	if (wh) {
		const m = basename(wh.model);
		add(!!wh.dtw, 'modèle whisper', `${m}${wh.dtw ? `, horodatage DTW « ${wh.dtw} »` : ''}`, `${m} n'a pas de réglage DTW connu : les coupes dans les phrases seront moins précises. Prends un modèle officiel (large-v3-turbo, medium, small).`);
		const weak = /ggml-(small|base|tiny)/.test(m);
		add(!weak, 'précision de la transcription', m, `Le modèle ${m} se trompe souvent sur les noms et les mots mal articulés. Pour mieux : cd ${join(wh.bin, '../../..')} && ./models/download-ggml-model.sh large-v3-turbo`, true);
	}
	const yt = await which('yt-dlp');
	add(!!yt, 'yt-dlp (vidéos de référence en ligne)', yt, 'Optionnel : sert à télécharger une vidéo de référence (https://github.com/yt-dlp/yt-dlp).', true);
	add(!!(await which('montage-youtube')), 'commande montage-youtube', 'dans le PATH', `Lance : bash ${join(SKILL, 'install.sh')}`);

	for (const [s, n, d] of rows) console.log(`${s} ${n.padEnd(36)} ${d ?? ''}`);
	if (missing) {
		console.log(`\n${missing} outil(s) requis manquant(s).`);
		process.exit(1);
	}
	console.log('\nTout le nécessaire est installé.');
}
