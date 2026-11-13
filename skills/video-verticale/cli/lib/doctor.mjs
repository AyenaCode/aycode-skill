// doctor: check every tool the skill relies on and say how to install what is missing.
import { join } from 'node:path';
import { montage, skillDir } from './freres.mjs';
import { run, SKILL, which } from './util.mjs';

export const booleans = ['help'];
const HELP = `video-verticale doctor
    Vérifie Node, FFmpeg (libass, zoompan…), whisper.cpp, et les skills montage-youtube et pub-video
    dont ce skill reprend le montage, la transcription, la musique, les bruitages et le mixage.`;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const rows = [];
	let missing = 0;
	const add = (ok, name, detail, fix) => {
		rows.push([ok ? 'ok ' : 'KO ', name, ok ? detail : `${detail ? detail + '. ' : ''}${fix}`]);
		if (!ok) missing++;
	};
	const major = Number(process.versions.node.split('.')[0]);
	add(major >= 20, 'Node.js', `v${process.versions.node}`, 'Installe Node 20 ou plus (https://nodejs.org).');
	const ff = await run('ffmpeg', ['-hide_banner', '-version']);
	add(!ff.code, 'FFmpeg', /ffmpeg version (\S+)/.exec(ff.out)?.[1], 'Installe-le : « sudo apt install -y ffmpeg » (Linux) ou « brew install ffmpeg » (macOS).');
	if (!ff.code) {
		const enc = (await run('ffmpeg', ['-hide_banner', '-encoders'])).out;
		const fil = (await run('ffmpeg', ['-hide_banner', '-filters'])).out;
		const need = [['libx264', enc], ['aac', enc], ['ass', fil], ['zoompan', fil], ['bbox', fil], ['drawtext', fil], ['tile', fil], ['ebur128', fil], ['alimiter', fil]];
		const lacking = need.filter(([n, src]) => !new RegExp(`\\s${n}\\s`).test(src)).map(([n]) => n);
		add(!lacking.length, 'FFmpeg : codecs et filtres', 'libx264, aac, ass (libass), zoompan, bbox, drawtext', `Il manque ${lacking.join(', ')} : installe un FFmpeg complet (avec libass et libfreetype).`);
	}
	add(!(await run('ffprobe', ['-version'])).code, 'ffprobe', '', 'Il est fourni avec FFmpeg.');

	const my = await montage.util().catch(() => null);
	const wh = my ? await my.findWhisper() : null;
	add(!!wh, 'whisper.cpp (transcription)', wh ? `${wh.bin} · ${wh.model.split('/').pop()}` : '', 'Lance « montage-youtube doctor » : il dit comment l’installer.');
	const dirs = {};
	for (const s of ['montage-youtube', 'pub-video']) {
		dirs[s] = await skillDir(s);
		add(!!dirs[s], `skill ${s}`, dirs[s], `Copie le skill ${s} dans ~/.claude/skills/ puis lance son install.sh.`);
	}
	add(!!(await which('video-verticale')), 'commande video-verticale', 'dans le PATH', `Lance : bash ${join(SKILL, 'install.sh')}`);

	const w = Math.max(...rows.map((r) => r[1].length));
	for (const [s, n, d] of rows) console.log(`${s} ${n.padEnd(w)}  ${d ?? ''}`);
	console.log(`\nDossier du skill      : ${SKILL}`);
	if (dirs['montage-youtube']) console.log(`Skill montage-youtube : ${dirs['montage-youtube']}`);
	if (dirs['pub-video']) console.log(`Skill pub-video       : ${dirs['pub-video']} (branche sujet : lance aussi « pub-video doctor »)`);
	console.log(missing ? `\n${missing} élément(s) à installer.` : '\nTout le nécessaire est installé.');
	if (missing) process.exitCode = 1;
}
