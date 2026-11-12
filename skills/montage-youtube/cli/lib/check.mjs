// check: transcribe the export again and compare it with the words montage.md keeps. A word missing
// next to a cut means the cut is too tight; a word in excess means a removed phrase left a piece behind.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpeg, loadAnalysis, projectRoot, readJson, tc, writeJson } from './util.mjs';
import { HOP, loadDb } from './signal.mjs';
import { transcribe } from './whisper.mjs';

export const booleans = ['help', 'final'];
const HELP = `montage-youtube check [--final]
    Retranscrit le dernier aperçu (--final : l'export final) et le compare au texte gardé.
    Signale les mots attendus qui manquent (coupe trop serrée) et les mots en trop (reste d'un passage
    coupé), en priorité près des coupes. Écrit work/controle-<aperçu|final>.json.`;

const NEAR = 0.6;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const an = loadAnalysis(root);
	const kind = a.final ? 'final' : 'apercu';
	const pf = join(root, 'work', 'render', `${kind}.plan.json`);
	if (!existsSync(pf)) throw new Error(`aucun rendu ${kind === 'final' ? 'final' : 'd’aperçu'} : lance « montage-youtube ${a.final ? 'build' : 'preview'} » d’abord.`);
	const plan = readJson(pf);
	const wav = join(root, 'work', 'render', `controle-${kind}.16k.wav`);
	await ffmpeg(['-i', plan.file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
	console.log(`Retranscription de ${plan.file}…`);
	const tr = await transcribe(wav, join(root, 'work', 'render', `controle-${kind}`), { lang: an.lang });

	const E = tokens(plan.words);
	const G = tokens(tr.words);
	const used = new Uint8Array(G.length);
	const hit = new Uint8Array(E.length);
	// Align window by window (60 s of expected words against the words heard around them).
	for (let w0 = 0; w0 < plan.duration + 60; w0 += 60) {
		const ei = E.map((e, i) => i).filter((i) => E[i].a >= w0 && E[i].a < w0 + 60);
		const gi = G.map((g, i) => i).filter((i) => !used[i] && G[i].a >= w0 - 3 && G[i].a < w0 + 63);
		for (const [x, y] of lcs(ei.map((i) => E[i].n), gi.map((i) => G[i].n))) {
			hit[ei[x]] = 1;
			used[gi[y]] = 1;
		}
	}
	const missing = runs(E, hit);
	const extra = runs(G, used);
	// A missing run and an extra run at the same place with similar letters: the two transcriptions differ.
	for (const m of missing) {
		const e = extra.find((x) => !x.variant && Math.abs(x.a - m.a) < 1.2 && dice(x.text, m.text) >= 0.5);
		if (e) m.variant = e.variant = true;
	}
	// Each cut, measured on the rush: between two silences (clean), in the dip between two words, or in
	// the middle of a syllable. Only a cut that falls in the voice can clip a word.
	const cuts = plan.segments.slice(1).map((s, i) => ({ t: s.o, how: cutKind(root, an, plan.mutes ?? [], plan.segments[i], s) }));
	const nearest = (r) => cuts.find((c) => c.t >= r.a - NEAR && c.t <= r.b + NEAR);
	// Far from the cuts the sound is untouched: a difference there comes from the transcription itself.
	// A word missing and another in excess at a clean cut: the transcription heard the restart differently.
	for (const m of missing) {
		const c = nearest(m);
		const e = c && extra.find((x) => nearest(x) === c);
		if (c?.how === 'silence' && e) m.variant = e.variant = true;
	}
	// Words heard inside a kept "(paroles?)" are expected: that voice was never transcribed.
	const inVoice = (r) => (plan.voices ?? []).some((v) => r.a < v.b + 0.3 && r.b > v.a - 0.3);
	for (const e of extra) if (inVoice(e)) e.variant = true;
	const issues = [
		...missing.filter((r) => nearest(r) && !r.variant).map((r) => ({ kind: 'manque', ...r, cut: nearest(r).how })),
		...extra.filter((r) => nearest(r) && !r.variant).map((r) => ({ kind: 'en trop', ...r, cut: nearest(r).how })),
		...cuts.filter((c) => c.how === 'syllabe').map((c) => ({ kind: 'coupe en pleine syllabe', a: c.t, b: c.t, text: '', cut: c.how }))
	].sort((x, y) => x.a - y.a);
	const far = missing.filter((r) => !nearest(r)).length + extra.filter((r) => !nearest(r)).length;
	const ignored = missing.filter((r) => r.variant && nearest(r)).length;
	const count = (h) => cuts.filter((c) => c.how === h).length;
	const rate = E.length ? hit.reduce((s, v) => s + v, 0) / E.length : 1;
	writeJson(join(root, 'work', `controle-${kind}.json`), { file: plan.file, rate, cuts, issues });

	console.log(`\n${Math.round(rate * 1000) / 10} % des mots gardés retrouvés dans l'export (${E.length} mots, ${plan.cuts.length} coupes).`);
	console.log(`Coupes : ${count('silence')} entre deux silences, ${count('creux')} dans le creux entre deux mots, ${count('syllabe')} en pleine syllabe.`);
	console.log(`Ignorés : ${far} écart(s) loin des coupes et ${ignored} à des coupes entre deux silences (le son n'y est pas rogné : c'est la transcription qui varie).`);
	if (!issues.length) {
		console.log('Près des coupes : aucun mot manquant, aucun reste, aucune coupe dans une syllabe.');
		return;
	}
	console.log(`Près des coupes, ${issues.length} point(s) à regarder :`);
	for (const r of issues) console.log(`  ${tc(r.a)}  ${r.kind.padEnd(24)} ${r.text ? `« ${r.text} »` : ''}${r.cut && r.kind !== 'coupe en pleine syllabe' ? `  (coupe : ${r.cut})` : ''}`);
	console.log('\nmanque : un mot gardé n’est pas entendu. Si la coupe est dans la voix, élargis-la : garde le mot voisin, ou allonge la pause (→ 0,6 s).');
	console.log('en trop : un morceau du passage coupé est resté. Coupe-le avec ~~mot~~ dans la phrase voisine.');
	console.log('coupe en pleine syllabe : déplace la coupe d’un mot (coupe ou garde le mot voisin).');
}

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
function tokens(words) {
	return words.map((w) => ({ n: norm(w.t), t: w.t, a: w.a, b: w.b ?? w.a + 0.3 })).filter((w) => w.n);
}
// Longest common subsequence of two word lists: pairs of matching indices.
function lcs(x, y) {
	const n = x.length;
	const m = y.length;
	const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
	const out = [];
	for (let i = 0, j = 0; i < n && j < m; ) {
		if (x[i] === y[j]) {
			out.push([i, j]);
			i++;
			j++;
		} else if (L[i + 1][j] >= L[i][j + 1]) i++;
		else j++;
	}
	return out;
}
// Consecutive unmatched words, grouped.
function runs(list, flag) {
	const out = [];
	let cur = null;
	list.forEach((w, i) => {
		if (flag[i]) {
			cur = null;
			return;
		}
		if (!cur) out.push((cur = { a: w.a, b: w.b, n: 0, words: [] }));
		cur.b = w.b;
		cur.n++;
		cur.words.push(w.t);
	});
	return out.map((r) => ({ a: r.a, b: r.b, n: r.n, text: r.words.join(' ') }));
}
// Letter-pair similarity of two strings (0 to 1).
function dice(p, q) {
	const pairs = (s) => {
		const t = norm(s);
		const m = new Map();
		for (let i = 0; i + 1 < t.length; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
		return m;
	};
	const A = pairs(p);
	const B = pairs(q);
	let common = 0;
	let total = 0;
	for (const [k, v] of A) {
		common += Math.min(v, B.get(k) ?? 0);
		total += v;
	}
	for (const v of B.values()) total += v;
	return total ? (2 * common) / total : 0;
}

// Where a cut falls in the rush: the 30 ms on each side of it, against the voice threshold of that rush.
const dbs = new Map();
function cutKind(root, an, mutes, before, after) {
	const level = (src, a, b) => {
		if (!dbs.has(src)) dbs.set(src, loadDb(join(root, 'work', `rush-${src + 1}.energie.f32`)));
		const db = dbs.get(src);
		let m = -Infinity;
		for (let i = Math.max(0, Math.floor(a / HOP)); i < Math.min(db.length, Math.ceil(b / HOP)); i++) m = Math.max(m, db[i]);
		return m;
	};
	const muted = (src, t) => mutes.some((m) => m.src === src && t >= m.a - 0.01 && t <= m.b + 0.01);
	const sides = [
		[before.src, before.b - 0.03, before.b, before.b - 0.12, before.b + 0.12, before.b - 0.015],
		[after.src, after.a, after.a + 0.03, after.a - 0.12, after.a + 0.12, after.a + 0.015]
	].map(([src, a, b, w0, w1, t]) => ({ at: muted(src, t) ? -Infinity : level(src, a, b), peak: level(src, w0, w1), voice: an.sources[src].thr + 6 }));
	if (sides.every((s) => s.at < s.voice)) return 'silence';
	return sides.every((s) => s.at < s.voice || s.at <= s.peak - 6) ? 'creux' : 'syllabe';
}
