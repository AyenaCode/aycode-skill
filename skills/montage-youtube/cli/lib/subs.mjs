// subs: subtitles of the edit as .srt (timed from the words kept), then a check of the proofread file.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fmt, loadProject, projectRoot, readJson, srtTime, tc, writeJson } from './util.mjs';

export const booleans = ['help', 'force'];
const HELP = `montage-youtube subs [--force]
    Écrit exports/<nom>.srt à partir des mots gardés, calé sur l'export final (sinon sur l'aperçu) :
    au plus 2 lignes de 42 signes, de 1 à 6 s, coupées aux fins de phrase et aux pauses, et
    prolongées un peu dans le silence qui suit pour laisser le temps de lire.
    Un .srt déjà relu (modifié depuis sa création) n'est pas écrasé, sauf avec --force.
montage-youtube subs check
    Contrôle le .srt relu : numérotation, temps, chevauchements, longueur des lignes, vitesse de lecture.`;

const LINE = 42;
const sha = (s) => createHash('sha256').update(s).digest('hex');

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const proj = loadProject(root);
	const srt = join(root, 'exports', `${proj.nom}.srt`);
	if (a._[0] === 'check') return check(srt, root);

	const final = join(root, 'work', 'render', 'final.plan.json');
	const pf = existsSync(final) ? final : join(root, 'work', 'render', 'apercu.plan.json');
	if (!existsSync(pf)) throw new Error('aucun rendu : lance « montage-youtube build » (ou preview) d’abord.');
	if (statSync(join(root, 'montage.md')).mtimeMs > statSync(pf).mtimeMs) console.log('Attention : montage.md a changé depuis le dernier rendu ; refais le rendu pour que les sous-titres tombent juste.');
	const plan = readJson(pf);
	const mark = join(root, 'work', 'subs.json');
	if (existsSync(srt) && !a.force) {
		const was = existsSync(mark) ? readJson(mark).sha : null;
		if (was !== sha(readFileSync(srt, 'utf8'))) throw new Error(`${srt} a été relu ou modifié : il n’est pas écrasé (--force pour le refaire).`);
	}
	const cues = build(plan.words);
	const text = cues.map((c, i) => `${i + 1}\n${srtTime(c.a)} --> ${srtTime(c.b)}\n${c.lines.join('\n')}\n`).join('\n');
	await writeFile(srt, text);
	writeJson(mark, { sha: sha(text), from: pf });
	console.log(`${cues.length} sous-titres → ${srt} (calés sur ${pf.endsWith('final.plan.json') ? 'l’export final' : 'l’aperçu'})`);
}

// Words → cues: a new cue after a sentence end, a pause, or when the text or the duration gets too long.
function build(words) {
	const cues = [];
	let cur = [];
	const flush = () => {
		if (cur.length) cues.push({ a: cur[0].a, b: cur.at(-1).b, text: cur.map((w) => w.t).join(' ') });
		cur = [];
	};
	for (const w of words) {
		const last = cur.at(-1);
		if (last) {
			const text = cur.map((x) => x.t).join(' ');
			const next = `${text} ${w.t}`;
			if (w.a - last.b >= 0.6 || next.length > 2 * LINE || w.b - cur[0].a > 6 || (/[.?!…]$/.test(last.t) && text.length >= 16) || (/[,;:]$/.test(last.t) && text.length >= LINE)) flush();
		}
		cur.push(w);
	}
	flush();
	for (const [i, c] of cues.entries()) {
		const next = cues[i + 1]?.a ?? Infinity;
		c.b = Math.min(Math.max(c.b + 0.6, c.a + 1), next - 0.05);
		c.lines = lines(c.text);
	}
	return cues;
}
// One line, or two lines of balanced length split at a space (after punctuation when possible).
function lines(text) {
	if (text.length <= LINE) return [text];
	let best = -1;
	let score = Infinity;
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== ' ') continue;
		const s = Math.abs(text.length / 2 - i) - (/[,;:.]/.test(text[i - 1]) ? 6 : 0);
		if (s < score) [best, score] = [i, s];
	}
	return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

function check(srt, root) {
	if (!existsSync(srt)) throw new Error(`${srt} n’existe pas : lance « montage-youtube subs ».`);
	const raw = readFileSync(srt);
	const text = raw.toString('utf8');
	const errors = [];
	const warns = [];
	if (Buffer.from(text, 'utf8').compare(raw) !== 0) errors.push('le fichier n’est pas en UTF-8.');
	const blocks = text.replace(/\r/g, '').trim().split(/\n\s*\n/);
	let prevEnd = 0;
	const final = join(root, 'work', 'render', 'final.plan.json');
	const end = existsSync(final) ? readJson(final).duration : Infinity;
	blocks.forEach((b, i) => {
		const ls = b.split('\n');
		const where = `sous-titre ${i + 1}`;
		if (ls[0].trim() !== String(i + 1)) errors.push(`${where} : numéro « ${ls[0]} » au lieu de ${i + 1}.`);
		const m = /^(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})$/.exec(ls[1]?.trim() ?? '');
		if (!m) return errors.push(`${where} : ligne de temps illisible « ${ls[1]} ».`);
		const t = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
		const a = t(m[1], m[2], m[3], m[4]);
		const z = t(m[5], m[6], m[7], m[8]);
		const body = ls.slice(2).filter((l) => l.trim());
		if (z <= a) errors.push(`${where} : finit avant de commencer.`);
		if (a < prevEnd - 0.001) errors.push(`${where} : commence avant la fin du précédent (${tc(a)}).`);
		if (z > end + 0.5) errors.push(`${where} : finit après la fin de la vidéo.`);
		if (!body.length) errors.push(`${where} : vide.`);
		if (body.length > 2) errors.push(`${where} : ${body.length} lignes (2 au plus).`);
		for (const l of body) if (l.length > LINE) warns.push(`${where} (${tc(a)}) : ligne de ${l.length} signes (${LINE} conseillés).`);
		const chars = body.join(' ').length;
		if (z - a > 0 && chars / (z - a) > 25) warns.push(`${where} (${tc(a)}) : ${fmt(chars / (z - a), 0)} signes par seconde, difficile à lire (25 au plus).`);
		if (z - a > 7) warns.push(`${where} (${tc(a)}) : reste ${fmt(z - a)} s à l’écran.`);
		prevEnd = z;
	});
	console.log(`${blocks.length} sous-titres, ${errors.length} erreur(s), ${warns.length} avertissement(s).`);
	for (const e of errors) console.log(`  ERREUR ${e}`);
	for (const w of warns) console.log(`  attention ${w}`);
	if (errors.length) process.exitCode = 1;
}
