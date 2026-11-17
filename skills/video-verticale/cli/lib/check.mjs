// check: automatic checks on the export. Errors must be fixed; warnings are judged and noted in brief.md.
import { existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bare, buildAss } from './ass.mjs';
import { checkFont } from './police.mjs';
import { fmt, loadConfig, loadWords, projectRoot, readJson, run, tc, zoneOf } from './util.mjs';

export const booleans = ['help'];
const HELP = `video-verticale check
    Contrôle l'export final (sinon l'aperçu) et l'habillage :
      format     1080×1920, nombre d'images, synchronisation image/son
      durée      3 min au plus pour un Short ou un Reel ; au-delà de 90 s, à justifier
      son        niveau à -14 LUFS (à 1 près), crête sous -1 dB, musique sous la voix, licence notée
      zone sûre  sous-titres et titre mesurés sur l'image, dans la zone que l'interface laisse libre
      police     la police des sous-titres est bien celle du projet
      accroche   quelque chose à lire dans la première seconde
      mots       mots incertains de la transcription sans correction
    Code de sortie 1 s'il reste des erreurs.`;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const words = loadWords(root);
	const errors = [];
	const warns = [];
	const fin = join(root, 'work', 'final.json');
	const pre = join(root, 'work', 'apercu.json');
	const r = existsSync(fin) ? readJson(fin) : existsSync(pre) ? readJson(pre) : null;
	if (!r) throw new Error('aucun rendu : lance « video-verticale apercu » ou « video-verticale build ».');
	const final = r.file.endsWith(`${cfg.nom}.mp4`);
	if (!final) warns.push('contrôle fait sur l’aperçu : refais-le après « build ».');

	// Format and sync.
	if (final && (r.width !== cfg.sortie.width || r.height !== cfg.sortie.height)) errors.push(`format ${r.width}×${r.height} au lieu de ${cfg.sortie.width}×${cfg.sortie.height}.`);
	if (Math.abs(r.frames - r.expected) > 1) errors.push(`${r.frames} images au lieu de ${r.expected}.`);
	if (r.gap > 0.1) errors.push(`écart image/son de ${fmt(r.gap * 1000, 0)} ms.`);
	if (statSync(cfg.source.video).mtimeMs !== words.mtime) errors.push('la source a changé depuis la lecture des mots : lance « video-verticale mots » puis refais le rendu.');
	for (const f of [join(root, 'verticale.json'), join(root, 'work', 'mots.json')]) if (statSync(f).mtimeMs > statSync(r.file).mtimeMs) warns.push(`${f.split('/').pop()} a changé depuis ce rendu : refais-le.`);

	// Duration: YouTube counts a vertical video up to 3 min as a Short; Reels are recommended up to 3 min.
	if (r.duration > 180) errors.push(`${fmt(r.duration)} s : au-delà de 3 min, ce n’est plus un Short ni un Reel.`);
	else if (r.duration > 90) warns.push(`${fmt(r.duration)} s : long pour une vidéo verticale ; chaque seconde doit tenir le spectateur.`);

	// Sound.
	const target = cfg.mixage.lufs ?? -14;
	if (r.lufs === null) warns.push('la vidéo n’a pas de son.');
	else {
		if (Math.abs(r.lufs - target) > 1) warns.push(`niveau ${fmt(r.lufs)} LUFS au lieu de ${target}.`);
		if (r.peak > -1) warns.push(`crête à ${fmt(r.peak)} dB : risque de saturation après l’encodage de la plateforme.`);
	}
	if (r.music !== null && r.music !== undefined && (r.music < 10 || r.music > 26)) warns.push(`musique ${fmt(r.music)} LU sous la voix (12 à 20 conseillés) : règle musique.gain ou mixage.baisse.`);
	if (cfg.musique && !cfg.musique.licence) errors.push('musique sans licence notée : remplis musique.licence (nom et adresse) et la section Musique de brief.md.');

	// Font and safe zone, measured on the captions drawn alone over black.
	const ass = buildAss(cfg, words.words);
	if (ass.events) {
		const c = await checkFont(root, cfg);
		if (!c.ok) errors.push(c.why);
		const z = zoneOf(cfg);
		const box = { x1: z.left, x2: cfg.sortie.width - z.right, y1: z.top, y2: cfg.sortie.height - z.bottom };
		for (const [layer, name] of [['cap', 'sous-titres'], ['titre', 'titre d’accroche']]) {
			const m = await measure(root, cfg, words, layer, r.duration);
			if (!m) continue;
			if (m.none) {
				errors.push(`${name} : rien n’a été dessiné pendant la mesure (journal de libass à lire dans work/zone-${layer}.ass).`);
				continue;
			}
			const pad = layer === 'cap' ? cfg.sous_titres.contour ?? 0 : 18;
			const out = [];
			if (m.x1 - pad < box.x1) out.push(`gauche ${m.x1 - pad} < ${box.x1}`);
			if (m.x2 + pad > box.x2) out.push(`droite ${m.x2 + pad} > ${box.x2}`);
			if (m.y1 - pad < box.y1) out.push(`haut ${m.y1 - pad} < ${box.y1}`);
			if (m.y2 + pad > box.y2) out.push(`bas ${m.y2 + pad} > ${box.y2}`);
			const where = `x ${m.x1}–${m.x2}, y ${m.y1}–${m.y2}`;
			if (out.length) errors.push(`${name} hors de la zone sûre ${cfg.zone} (${out.join(', ')}) au pire moment (${tc(m.t)}) : ${where}.`);
			else console.log(`  ${name} : dans la zone sûre (${where} au plus large)`);
		}
	}

	// Hook: something to read in the first second.
	const first = Math.min(cfg.accroche?.texte ? cfg.accroche.debut ?? 0 : Infinity, cfg.sous_titres.style !== 'aucun' && words.words.length ? words.words[0].a : Infinity);
	if (!(first <= 1)) warns.push(`rien à lire avant ${Number.isFinite(first) ? `${fmt(first)} s` : 'la fin'} : l’accroche doit tenir dans la première seconde (titre d’accroche ou première phrase).`);
	if (cfg.accroche?.texte) {
		const d = (cfg.accroche.fin ?? 2.5) - (cfg.accroche.debut ?? 0);
		if (cfg.accroche.texte.length / d > 15) warns.push(`titre d’accroche de ${cfg.accroche.texte.length} signes pour ${fmt(d)} s : trop court pour le lire.`);
	}
	// Zooms.
	for (const z of cfg.zooms) if (z.z > 1.3 || z.z < 1 || z.t < 0 || z.t >= r.duration) warns.push(`zoom ×${z.z} à ${tc(z.t)} : hors de 1 à 1,3, ou hors de la vidéo.`);
	// Caption height changes (their place in the safe zone is measured below with the captions).
	for (const s of cfg.sous_titres.hauteurs ?? []) if (s.t < 0 || s.t >= r.duration) warns.push(`changement de hauteur des sous-titres à ${tc(s.t)} : hors de la vidéo.`);
	// Uncertain words the user should confirm.
	const fixed = new Set(Object.keys(cfg.sous_titres.corrections ?? {}));
	const doubt = words.words.filter((w) => w.p !== undefined && w.p < 0.5 && !fixed.has(bare(w.t)));
	if (doubt.length) warns.push(`${doubt.length} mot(s) incertain(s) sans correction : ${doubt.slice(0, 8).map((w) => `${w.t} (${tc(w.a)})`).join(', ')}.`);

	console.log(`${errors.length} erreur(s), ${warns.length} avertissement(s) · ${r.file}`);
	for (const e of errors) console.log(`  ERREUR ${e}`);
	for (const w of warns) console.log(`  attention ${w}`);
	if (errors.length) process.exitCode = 1;
}

// Widest extent of one layer over the whole video: the layer is drawn alone, in white, over black, at
// the output frame rate (so the overshoot of every pop-in is caught), and the bbox filter gives the box
// of the lit pixels on each frame.
async function measure(root, cfg, words, layer, duration) {
	const white = { ...cfg, sous_titres: { ...cfg.sous_titres, couleur: '#FFFFFF', accent: '#FFFFFF' } };
	const one = buildAss(white, words.words, { only: layer });
	if (!one.events) return null;
	const file = `work/zone-${layer}.ass`;
	await writeFile(join(root, file), one.text);
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-f', 'lavfi', '-i', `color=black:s=${cfg.sortie.width}x${cfg.sortie.height}:r=${cfg.sortie.rate}:d=${duration.toFixed(3)}`, '-vf', `ass=filename=${file}:fontsdir=fonts,bbox=min_val=40`, '-f', 'null', '-'], { cwd: root });
	let m = null;
	for (const x of r.err.matchAll(/pts_time:([\d.]+) x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+)/g)) {
		const [t, x1, x2, y1, y2] = x.slice(1).map(Number);
		if (!m) m = { x1, x2, y1, y2, t };
		const worse = x1 < m.x1 || x2 > m.x2 || y1 < m.y1 || y2 > m.y2;
		m = { x1: Math.min(m.x1, x1), x2: Math.max(m.x2, x2), y1: Math.min(m.y1, y1), y2: Math.max(m.y2, y2), t: worse ? t : m.t };
	}
	return m ?? { none: true };
}
