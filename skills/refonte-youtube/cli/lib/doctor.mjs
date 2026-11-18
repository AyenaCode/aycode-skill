// doctor: check every tool the skill relies on and say how to install what is missing.
import { join } from 'node:path';
import { installHint, montage, pub, SIBLINGS, skillDir } from './freres.mjs';
import { run, SKILL, which } from './util.mjs';

export const booleans = ['help'];
const HELP = `refonte-youtube doctor
    Vérifie Node, FFmpeg (libx264, libass, zoompan, amultiply…), whisper.cpp, les skills montage-youtube,
    pub-video et video-verticale dont ce skill reprend des briques, puis yt-dlp et voicebox (selon la demande).`;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const rows = [];
	let missing = 0;
	const add = (ok, name, detail, fix, optional = false) => {
		rows.push([ok ? 'ok ' : optional ? '-- ' : 'KO ', name, ok ? detail : `${detail ? detail + '. ' : ''}${fix}`]);
		if (!ok && !optional) missing++;
	};
	const major = Number(process.versions.node.split('.')[0]);
	add(major >= 20, 'Node.js', `v${process.versions.node}`, 'Installe Node 20 ou plus (https://nodejs.org).');
	const ff = await run('ffmpeg', ['-hide_banner', '-version']);
	add(!ff.code, 'FFmpeg', /ffmpeg version (\S+)/.exec(ff.out)?.[1], 'Installe-le : « sudo apt install -y ffmpeg » (Linux) ou « brew install ffmpeg » (macOS).');
	if (!ff.code) {
		const enc = (await run('ffmpeg', ['-hide_banner', '-encoders'])).out;
		const fil = (await run('ffmpeg', ['-hide_banner', '-filters'])).out;
		const need = [['libx264', enc], ['aac', enc], ['ass', fil], ['zoompan', fil], ['tpad', fil], ['drawtext', fil], ['tile', fil], ['amultiply', fil], ['acrossfade', fil], ['ebur128', fil], ['alimiter', fil]];
		const lacking = need.filter(([n, src]) => !new RegExp(`\\s${n}\\s`).test(src)).map(([n]) => n);
		add(!lacking.length, 'FFmpeg : codecs et filtres', 'libx264, aac, ass (libass), zoompan, amultiply…', `Il manque ${lacking.join(', ')} : installe un FFmpeg complet (avec libass et libfreetype).`);
	}
	add(!(await run('ffprobe', ['-version'])).code, 'ffprobe', '', 'Il est fourni avec FFmpeg.');

	const dirs = {};
	for (const s of SIBLINGS) {
		dirs[s] = await skillDir(s);
		add(!!dirs[s], `skill ${s}`, dirs[s], `${installHint(s)}.`);
	}
	const mu = dirs['montage-youtube'] ? await montage.util().catch(() => null) : null;
	const wh = mu ? await mu.findWhisper() : null;
	add(!!wh, 'whisper.cpp (transcription)', wh ? `${wh.bin} · ${wh.model.split('/').pop()}` : '', 'Lance « montage-youtube doctor » : il dit comment l’installer.');
	add(!!(await which('refonte-youtube')), 'commande refonte-youtube', 'dans le PATH', `Lance : bash ${join(SKILL, 'install.sh')}`);

	// Needed only for some requests: a link to download, a cloned voice.
	add(!!(await which('yt-dlp')), 'yt-dlp (vidéo donnée par un lien)', 'installé', 'Pour un lien : https://github.com/yt-dlp/yt-dlp (sinon, donne le fichier vidéo).', true);
	const vb = dirs['pub-video'] ? await pub.voicebox().catch(() => null) : null;
	const server = vb ? await vb.connect() : { url: null };
	add(!!server.url, 'voicebox (voix clonée)', server.url, 'Lance l’application voicebox ou son conteneur, puis « pub-video voice profils ».', true);

	const w = Math.max(...rows.map((r) => r[1].length));
	for (const [s, n, d] of rows) console.log(`${s} ${n.padEnd(w)}  ${d ?? ''}`);
	console.log(`\nDossier du skill : ${SKILL}`);
	for (const s of SIBLINGS) if (dirs[s]) console.log(`Skill ${s.padEnd(16)}: ${dirs[s]}`);
	console.log(missing ? `\n${missing} élément(s) à installer.` : '\nTout le nécessaire est installé.');
	if (missing) process.exitCode = 1;
}
