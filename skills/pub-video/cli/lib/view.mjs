// stills and sheet: look at chosen moments of a video without rendering it.
import { copyFile } from 'node:fs/promises';
import { projectRoot, videoFile, num } from './util.mjs';
import { openVideo } from './browser.mjs';
import { stills, sheet, reviewTimes } from './render.mjs';

export const booleans = ['scenes', 'transitions', 'label', 'guides', 'help'];
const HELP = `pub-video stills <vidéo> <t1,t2,…> [--scale 0.5] [--label] [--guides] [--out fichier.png]
    Images PNG dans render/stills/. --scale 1 pour la taille réelle. --out copie une image unique (couverture).
pub-video sheet <vidéo> [--scenes | --transitions | --every 0.5 [--from a --to b] | --times t1,t2,…] [--guides] [--cols 7] [--tile 270]
    Planches d'images étiquetées (seconde + scène), 14 par planche, dans render/<vidéo>_planche[-n].png.
    --guides dessine la zone sûre en pointillés.
    --scenes (défaut) : 3 moments par scène. --transitions : 7 images autour de chaque changement de scène.`;

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const { name } = videoFile(root, a._[0]);
	if (cmd === 'stills') {
		const times = String(a._[1] ?? '').split(',').filter(Boolean).map(Number);
		if (!times.length) throw new Error('donne les secondes : pub-video stills <vidéo> 0.5,3,7.25');
		const { paths } = await stills(root, name, times, { scale: num(a.scale, 0.5), label: !!a.label, guides: !!a.guides });
		if (a.out && paths.length === 1) {
			await copyFile(paths[0], String(a.out));
			return console.log(`  ${a.out}`);
		}
		for (const p of paths) console.log(`  ${p}`);
		return;
	}
	let times;
	if (a.times) times = String(a.times).split(',').map(Number);
	else if (a.every || a.transitions) {
		const v = await openVideo(root, name, { scale: 0.5 });
		const meta = v.meta;
		await v.close();
		if (a.transitions) times = reviewTimes(meta, 'transitions');
		else {
			times = [];
			const step = num(a.every, 0.5);
			for (let t = num(a.from, 0); t < num(a.to, meta.duration) - 1e-6; t += step) times.push(Math.round(t * 1000) / 1000);
		}
	}
	await sheet(root, name, times, { cols: num(a.cols, 7), tile: num(a.tile, 270), out: a.out === undefined ? undefined : String(a.out), guides: !!a.guides });
}
