// script.md: the new video, one line per voice line, each with what is on screen while it is said.
//
//   # Titre du chapitre                       starts a chapter (YouTube chapters, a title card, a whoosh)
//   [1:12-1:20] Texte de la réplique.         a passage of the old video under the line
//   [1:12-1:15 2:03-2:08 zoom] Texte…         several passages in a row, slow push-in
//   [=] Texte…                                the old video goes on where the previous line left it
//   [3:40-4:10 entier] Texte…                 the whole passage, sped up or slowed down to fit the line
//   [motion intro] Texte…                     an animated insert, motion/intro.mp4 (made with pub-video)
//   [image images/schema.png] Texte…          a still image, slow push-in
//   [carton "3 erreurs"] Texte…               a plain background with a big text
//   [carton "Fin" 2s]                         a line without voice needs a duration (except a passage or a motion)
//   > note                                    ignored, like empty lines
//
// Options inside the brackets: entier · zoom · zoom=1.3 · zoom=1.3@0.7,0.2 (factor, then the point to zoom on,
// as fractions of the width and height) · 2.5s (duration) · pause=0.8 (silence after the line) ·
// son=ding or son=ding+0.4 (sound effect, seconds after the line starts) · fond=#112233 (carton background).
// In the text, *mot fort* puts the words on screen at the moment they are said.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTc } from './util.mjs';

const NUM = '(\\d+(?:[.,]\\d+)?)';
const RANGE = /^(\d[\d:.,]*)\s*[-–]\s*(\d[\d:.,]*)$/;
const ZOOM = /^zoom(?:=(\d+(?:\.\d+)?))?(?:@(0|1|0?\.\d+),(0|1|0?\.\d+))?$/;
const DUR = new RegExp(`^${NUM}s$`);
const PAUSE = new RegExp(`^pause=${NUM}$`);
const SON = new RegExp(`^son=([a-z_]+)(?:\\+${NUM})?$`);
const FOND = /^fond=#?([0-9a-f]{6})$/i;
const n = (s) => Number(String(s).replace(',', '.'));

// Tokens of the brackets: words, or texts in "…", “…” or « … ».
function tokens(s) {
	const out = [];
	for (const m of s.matchAll(/"([^"]*)"|“([^”]*)”|«\s*([^»]*?)\s*»|(\S+)/g)) {
		if (m[4] !== undefined) out.push({ word: m[4] });
		else out.push({ quoted: (m[1] ?? m[2] ?? m[3]).trim() });
	}
	return out;
}

function visual(spec, err) {
	const v = { kind: 'source', ranges: [], cont: false, whole: false, zoom: null, file: null, label: null, dur: null, pause: null, sons: [], fond: null };
	const toks = tokens(spec);
	if (!toks.length) return err('les crochets sont vides : mets un passage (1:12-1:20), « = », motion, image ou carton.');
	const first = toks[0].word;
	let rest = toks;
	if (first === 'motion' || first === 'image') {
		v.kind = first;
		const name = toks[1]?.word ?? toks[1]?.quoted;
		if (!name) return err(first === 'motion' ? 'donne le nom de la séquence : [motion intro] pour motion/intro.mp4.' : 'donne le fichier : [image images/schema.png].');
		v.file = first === 'motion' && !/[/.]/.test(name) ? join('motion', `${name}.mp4`) : name;
		rest = toks.slice(2);
	} else if (first === 'carton') {
		v.kind = 'carton';
		rest = toks.slice(1);
	}
	for (const t of rest) {
		if (t.quoted !== undefined) {
			if (v.kind !== 'carton') return err('un texte entre guillemets ne sert qu’à un carton : [carton "Le texte"].');
			v.label = t.quoted;
			continue;
		}
		const w = t.word;
		let m;
		if (w === '=') v.cont = true;
		else if ((m = RANGE.exec(w))) {
			const [a, b] = [parseTc(m[1]), parseTc(m[2])];
			if (!Number.isFinite(a) || !Number.isFinite(b)) return err(`passage « ${w} » illisible : écris 1:12-1:20 ou 72-80.`);
			if (b <= a) return err(`passage « ${w} » : la fin vient avant le début.`);
			v.ranges.push([a, b]);
		} else if (w === 'entier') v.whole = true;
		else if ((m = ZOOM.exec(w))) v.zoom = { k: m[1] ? Number(m[1]) : 1.15, x: m[2] ? Number(m[2]) : 0.5, y: m[3] ? Number(m[3]) : 0.5 };
		else if ((m = DUR.exec(w))) v.dur = n(m[1]);
		else if ((m = PAUSE.exec(w))) v.pause = n(m[1]);
		else if ((m = SON.exec(w))) v.sons.push({ type: m[1], dt: m[2] ? n(m[2]) : 0 });
		else if ((m = FOND.exec(w))) v.fond = `#${m[1]}`;
		else return err(`« ${w} » inconnu dans les crochets. Voir « refonte-youtube help script ».`);
	}
	if (v.kind === 'source') {
		if (!v.ranges.length && !v.cont) return err('aucun passage : mets 1:12-1:20, ou « = » pour continuer l’ancienne vidéo.');
		if (v.ranges.length && v.cont) return err('« = » et un passage ensemble : garde l’un ou l’autre.');
	} else if (v.ranges.length || v.cont || v.whole) return err(`un passage, « = » ou « entier » ne vont pas avec ${v.kind}.`);
	if (v.zoom && v.zoom.k < 1) return err('le zoom va de 1 (rien) à 3.');
	if (v.zoom && v.zoom.k > 3) return err('le zoom va de 1 (rien) à 3.');
	return v;
}

// Parse the script text. Returns { lines, errors }; each line: { n, at (line in the file), chapter, visual,
// text (as said), keywords: [{ text, start (index of its first word in the line) }] }.
export function parseScript(text) {
	const lines = [];
	const errors = [];
	let chapter = null;
	for (const [i, raw] of text.split('\n').entries()) {
		const l = raw.trim();
		const err = (msg) => {
			errors.push(`script.md ligne ${i + 1} : ${msg}`);
			return null;
		};
		if (!l || l.startsWith('>') || /^<!--.*-->$/.test(l)) continue;
		if (l.startsWith('#')) {
			if (chapter) err(`deux titres de chapitre de suite (« ${chapter} » puis celui-ci) : un chapitre commence sur une réplique.`);
			chapter = l.replace(/^#+\s*/, '').trim();
			if (!chapter) err('titre de chapitre vide.');
			continue;
		}
		if (!l.startsWith('[')) {
			err('il manque le visuel entre crochets au début de la ligne : [1:12-1:20], [=], [motion nom], [image fichier] ou [carton "texte"].');
			continue;
		}
		const close = l.indexOf(']');
		if (close < 0) {
			err('crochet fermant « ] » manquant.');
			continue;
		}
		const v = visual(l.slice(1, close), err);
		const said = l.slice(close + 1).trim();
		if ((said.match(/\*/g) ?? []).length % 2) err('un astérisque de mot fort n’est pas refermé : *mot fort*.');
		const clean = said.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
		const keywords = [];
		for (const m of said.matchAll(/\*([^*]+)\*/g)) {
			const before = said.slice(0, m.index).replace(/\*/g, '');
			keywords.push({ text: m[1].trim(), start: before.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length });
		}
		if (!v) continue;
		if (!clean && v.dur === null && ((v.kind === 'source' && v.cont) || v.kind === 'image' || v.kind === 'carton')) err('une ligne sans voix a besoin d’une durée : ajoute par exemple 2s dans les crochets.');
		if (v.kind === 'carton' && !v.label && !keywords.length && !clean) err('un carton sans texte : mets "Le texte" dans les crochets.');
		lines.push({ n: lines.length + 1, at: i + 1, chapter, visual: v, text: clean, keywords });
		chapter = null;
	}
	if (chapter) errors.push(`script.md : le chapitre « ${chapter} » est à la fin, sans réplique.`);
	if (!lines.length && !errors.length) errors.push('script.md ne contient aucune réplique.');
	return { lines, errors };
}

export function loadScript(root) {
	const f = join(root, 'script.md');
	if (!existsSync(f)) throw new Error('script.md manque dans le projet.');
	return parseScript(readFileSync(f, 'utf8'));
}
