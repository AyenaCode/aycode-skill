// planche / image: look at the rendered video. A contact sheet of frames with their time, or one
// full-size frame for the cover.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpeg, loadConfig, num, projectRoot, readJson } from './util.mjs';

export const booleans = ['help', 'apercu'];
const HELP = `video-verticale planche [--every 1] [--from 0] [--to <fin>] [--apercu]
    Planche d'images de l'export (ou de l'aperçu avec --apercu, ou s'il n'y a pas encore d'export),
    une image toutes les --every secondes, avec son temps → work/planche-<de>-<à>.png. À ouvrir pour juger.
video-verticale image <secondes> [--apercu]
    Une image pleine taille à cet instant → exports/<nom>_couverture.png (la couverture à téléverser).`;

function rendered(root, preferPreview) {
	const order = preferPreview ? ['apercu', 'final'] : ['final', 'apercu'];
	for (const k of order) {
		const f = join(root, 'work', `${k}.json`);
		if (existsSync(f) && existsSync(readJson(f).file)) return readJson(f);
	}
	throw new Error('aucun rendu : lance « video-verticale apercu » ou « video-verticale build ».');
}

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const r = rendered(root, !!a.apercu);
	if (cmd === 'image') {
		if (a._[0] === undefined) throw new Error('donne la seconde : video-verticale image 1.5');
		const t = num(a._[0]);
		const out = join(root, 'exports', `${cfg.nom}_couverture.png`);
		await ffmpeg(['-ss', String(t), '-i', r.file, '-frames:v', '1', '-update', '1', out]);
		return console.log(`${out}${r.file.endsWith('_apercu.mp4') ? ' (tirée de l’aperçu : refais-la après « build »)' : ''}`);
	}
	const every = num(a.every, 1);
	const from = num(a.from, 0);
	const to = Math.min(num(a.to, r.duration), r.duration);
	// Frames at from, from + every, … strictly before `to`.
	const n = Math.max(1, Math.floor((to - from) / every - 1e-6) + 1);
	const cols = Math.min(6, n);
	const rows = Math.ceil(n / cols);
	const font = readdirSync(join(root, 'fonts')).find((f) => /\.(ttf|otf)$/i.test(f));
	const label = font ? `,drawtext=fontfile=fonts/${font}:text='%{pts\\:hms\\:${from}}':x=10:y=10:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6` : '';
	const out = join(root, 'work', `planche-${from}-${to.toFixed(1)}.png`);
	await ffmpeg(['-ss', String(from), '-t', String(to - from), '-i', r.file, '-vf', `fps=1/${every}:start_time=0:round=up,scale=270:480${label},tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', '-update', '1', out], { cwd: root });
	console.log(`${out} : ${n} images de ${from} à ${to.toFixed(1)} s, toutes les ${every} s, de gauche à droite puis de haut en bas.`);
}
