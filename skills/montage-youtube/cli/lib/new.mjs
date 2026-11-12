// new: create an editing project around one or more recorded files (rushes).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { dur, outputRate, probe, SKILL, writeJson } from './util.mjs';

export const booleans = ['help'];
const HELP = `montage-youtube new <dossier> <rush> [rush2 …] [--lang fr|en|auto] [--mode auto|visage|ecran] [--piste 0]
    Crée le projet : projet.json (rushs, format de sortie, réglages), brief.md, work/, exports/.
    Les rushs restent où ils sont ; plusieurs rushs se montent bout à bout, dans l'ordre donné.
    --piste : numéro de la piste son qui porte la voix (0 = la première).`;

export default async function (_cmd, a) {
	if (a.help || a._.length < 2) return console.log(HELP);
	const dir = resolve(a._[0]);
	if (existsSync(join(dir, 'projet.json'))) throw new Error(`${dir} contient déjà un projet.`);
	const sources = [];
	for (const f of a._.slice(1)) {
		const file = resolve(f);
		if (!existsSync(file)) throw new Error(`rush introuvable : ${f}`);
		const m = await probe(file);
		if (!m.width) throw new Error(`${f} n'a pas d'image.`);
		const piste = Number(a.piste ?? 0);
		if (m.audio <= piste) throw new Error(`${f} n'a pas de piste son n° ${piste} (${m.audio} piste(s)).`);
		sources.push({ file, duration: m.duration, video: m.video, width: m.width, height: m.height, fps: Math.round(m.fps * 1000) / 1000, audio: piste });
	}
	const first = sources[0];
	const rate = outputRate(first.fps);
	const proj = {
		nom: basename(dir),
		lang: String(a.lang ?? 'auto'),
		sources,
		sortie: { width: first.width, height: first.height, rate: rate.expr },
		reglages: { mode: String(a.mode ?? 'auto'), pause: 0.4, pauseMax: 0.7, nettoyage: 'normal', loudness: -14 }
	};
	mkdirSync(join(dir, 'work'), { recursive: true });
	mkdirSync(join(dir, 'exports'), { recursive: true });
	writeJson(join(dir, 'projet.json'), proj);
	copyFileSync(join(SKILL, 'template', 'brief.md'), join(dir, 'brief.md'));
	console.log(`Projet créé : ${dir}`);
	for (const s of sources) console.log(`  ${basename(s.file)} : ${dur(s.duration)}, ${s.width}×${s.height}, ${s.fps} i/s`);
	console.log(`  sortie : ${first.width}×${first.height}, ${rate.fps.toFixed(3).replace(/\.?0+$/, '')} i/s`);
	console.log('Suite : cd dans le dossier, puis « montage-youtube analyse ».');
}
