// The timeline: each line of script.md gets a slot (voice + pause, or the length of its picture), laid on
// the frame grid so picture and sound never drift. Under each slot, the pieces of picture that fill it:
// passages of the old video (trimmed, slowed down or sped up, the last image held), an insert, a still or
// a carton. Keywords, chapters and sound effects get their instants. Without a take, a line can be timed
// from its text (estimate), which is what `plan` does before the voice exists.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pub } from './freres.mjs';
import { loadVoices, RATE, takeFor } from './voix.mjs';
import { bare, probe, wordsOf } from './util.mjs';

// Speed limits under a line: below ×0.8 a slowed passage looks broken; above ×4 nothing can be followed.
const KMIN = 0.8;
const KMAX = 4;
// A held image longer than this gets a slow push-in so the picture keeps living.
const HOLD_ZOOM = 0.6;

export function loadMots(root) {
	const f = join(root, 'work', 'mots.json');
	return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { takes: {} };
}

// Passages under a slot of T seconds: trimmed to fit, or slowed down (×0.8 at most) and the last image held.
// `whole`: the passages play entirely, sped up or slowed down to fill the slot.
export function fitSource(ranges, T, whole) {
	const S = ranges.reduce((s, [a, b]) => s + b - a, 0);
	const k = whole ? Math.min(KMAX, Math.max(KMIN, S / T)) : S >= T ? 1 : Math.max(KMIN, S / T);
	const pieces = [];
	let out = 0;
	for (const [a, b] of ranges) {
		if (out >= T - 1e-6) break;
		const len = Math.min(b - a, (T - out) * k);
		pieces.push({ ss: a, len, k, outDur: len / k });
		out += len / k;
	}
	return { pieces, k, S, hold: Math.max(0, T - out) };
}

// Frame counts of consecutive pieces, from their cumulated lengths, so the total is exactly N.
function frames(pieces, N, F) {
	let cum = 0;
	let prev = 0;
	pieces.forEach((p, i) => {
		cum += p.outDur;
		const end = i === pieces.length - 1 ? N : Math.min(N, Math.round(cum * F));
		p.frames = Math.max(0, end - prev);
		prev = end;
	});
	return pieces.filter((p) => p.frames > 0);
}

// Where a keyword is said, in seconds from the start of its take: from the take's transcription when there
// is one, else from the share of syllables before it.
function keywordAt(line, kw, words, D, syllables) {
	const said = wordsOf(line.text);
	if (words?.length) {
		const want = said.slice(kw.start, kw.start + 3).map(bare);
		// The transcribed word that starts the same run of words, nearest to where it should be.
		let best = null;
		for (let i = 0; i < words.length; i++) {
			const run = want.filter((w, k) => bare(words[i + k]?.t ?? '') === w).length;
			if (run && (!best || run > best.run || (run === best.run && Math.abs(i - kw.start) < Math.abs(best.i - kw.start)))) best = { i, run };
		}
		if (best && best.run >= Math.min(2, want.length)) return { at: words[best.i].a, exact: true };
	}
	const all = syllables(line.text);
	const before = syllables(said.slice(0, kw.start).join(' ') || '');
	return { at: all ? (D * before) / all : 0, exact: false };
}

// cfg, the parsed script lines. Returns { F, W, H, frames, duration, items, chapters, sfx, errors, warnings }.
export async function buildTimeline(root, cfg, lines, { estimate = false } = {}) {
	const F = cfg.sortie.fps;
	const voices = loadVoices(root);
	const mots = loadMots(root);
	const { syllables } = await pub.voice();
	const old = cfg.source?.video ?? null;
	// Length of each video the passages come from: the old one, or another video of the user.
	const lengths = new Map(old ? [[old, cfg.source.duree]] : []);
	const lengthOf = async (f) => {
		if (!lengths.has(f)) lengths.set(f, existsSync(f) ? (await probe(f)).duration : null);
		return lengths.get(f);
	};
	const lead = cfg.voix.avance ?? 0.08;
	const tempo = cfg.voix.tempo ?? 1;
	const items = [];
	const errors = [];
	const warnings = [];
	const used = [];
	let frame = 0;
	// Where the last passage stopped, for « = ».
	let last = { file: old, t: 0 };

	for (const [i, l] of lines.entries()) {
		const v = l.visual;
		const next = lines[i + 1];
		const it = { n: l.n, at: l.at, line: l, chapter: l.chapter, notes: [], pieces: [], keywords: [], sons: [] };
		const err = (m) => errors.push(`réplique ${l.n} (script.md ligne ${l.at}) : ${m}`);
		const warn = (m) => {
			warnings.push(`réplique ${l.n} : ${m}`);
			it.notes.push(m);
		};

		// Voice: the chosen take, else an estimate from the text.
		let D = 0;
		let take = null;
		if (l.text) {
			take = takeFor(voices, cfg, l.text);
			if (take) D = take.duration;
			else if (estimate) D = syllables(l.text) / RATE / tempo;
			else err('pas de prise de voix : lance « refonte-youtube voix ».');
		}
		const pause = v.pause ?? (next?.chapter ? cfg.voix.pause_chapitre : cfg.voix.pause);
		let T = l.text ? lead + D + pause : 0;
		if (v.dur) T = Math.max(T, v.dur);

		// The picture's own length, for an insert or a line without voice.
		let media = null;
		if (v.kind === 'motion' || v.kind === 'image') {
			const file = resolve(root, v.file);
			if (!existsSync(file)) (estimate ? warn : err)(`${v.kind === 'motion' ? 'séquence' : 'image'} introuvable : ${v.file}`);
			else media = { file, ...(await probe(file)) };
		}
		// The video a passage comes from.
		let src = null;
		let srcDur = null;
		if (v.kind === 'source') {
			src = v.file ? resolve(root, v.file) : v.cont ? last.file : old;
			if (!src) err('ce projet n’a pas d’ancienne vidéo : donne le fichier, [video clips/demo.mp4 0:10-0:25].');
			else if ((srcDur = await lengthOf(src)) === null) err(`vidéo introuvable : ${v.file}`);
		}
		if (!l.text && !v.dur) {
			if (v.kind === 'source') T = v.ranges.reduce((s, [a, b]) => s + b - a, 0);
			if (v.kind === 'motion') T = media?.duration ?? 3;
		}
		if (v.kind === 'motion' && media) T = Math.max(T, media.duration);
		const N = Math.max(1, Math.round(T * F));
		it.start = frame / F;
		it.frames = N;
		it.end = (frame + N) / F;
		frame += N;
		const slot = N / F;
		if (l.text) it.voice = { id: take?.id ?? null, file: take ? resolve(root, take.file) : null, at: it.start + lead, dur: D, estimated: !take };

		// Picture.
		if (v.kind === 'source' && srcDur !== null) {
			const name = src === old ? 'l’ancienne vidéo' : v.file ?? src;
			let ranges = v.ranges;
			if (v.cont) {
				const from = last.file === src ? last.t : 0;
				ranges = [[from, Math.min(srcDur, from + slot)]];
			}
			for (const [a, b] of ranges) if (b > srcDur + 0.05) err(`le passage ${a}-${b} dépasse la fin de ${name} (${srcDur.toFixed(1)} s).`);
			ranges = ranges.map(([a, b]) => [a, Math.min(b, srcDur)]).filter(([a, b]) => b - a > 0.04);
			if (!ranges.length) {
				err(v.cont ? `${name} est finie : « = » n’a plus rien à montrer.` : 'aucun passage utilisable.');
				continue;
			}
			const fit = fitSource(ranges, slot, v.whole);
			it.pieces = frames(fit.pieces.map((p) => ({ kind: 'source', file: src, ss: p.ss, len: p.len, k: p.k, outDur: p.outDur, zoom: v.zoom })), N, F);
			const end = fit.pieces.at(-1);
			last = { file: src, t: end.ss + end.len };
			it.fit = { k: fit.k, S: fit.S, hold: fit.hold };
			if (fit.hold > HOLD_ZOOM && !v.zoom) it.pieces.at(-1).zoom = { k: 1.06, x: 0.5, y: 0.5, auto: true };
			if (fit.hold > 1.5) warn(`image figée ${fit.hold.toFixed(1)} s en fin de plan : ajoute un passage ou allonge-le.`);
			if (fit.k > 2.5) warn(`passage accéléré ×${fit.k.toFixed(1)} : vérifie qu'on suit encore l'action.`);
			for (const p of it.pieces) {
				const twice = used.find((u) => u.n !== l.n && u.file === src && Math.min(u.b, p.ss + p.len) - Math.max(u.a, p.ss) > 0.5);
				if (twice) warn(`image déjà montrée à la réplique ${twice.n} (${p.ss.toFixed(1)} s).`);
				used.push({ n: l.n, file: src, a: p.ss, b: p.ss + p.len });
			}
		} else if (v.kind === 'motion') {
			if (media) {
				it.pieces = [{ kind: 'motion', file: media.file, ss: 0, len: media.duration, k: 1, outDur: media.duration, frames: N, zoom: null }];
				// Its sound was mastered alone at -14 LUFS by pub-video: brought down under the voice.
				if (media.audio) it.sons.push({ file: media.file, t: it.start, gain: cfg.bruitages?.sequences ?? 0.45 });
				if (slot - media.duration > 1) warn(`la séquence (${media.duration.toFixed(1)} s) est plus courte que la réplique : sa dernière image reste ${(slot - media.duration).toFixed(1)} s.`);
			}
		} else if (v.kind === 'image') {
			// A capture scrolls only if, at the output width, it is clearly taller than the frame.
			const tall = media && media.height * (cfg.sortie.largeur / media.width) > cfg.sortie.hauteur * 1.2;
			if (media && v.scroll && !tall) warn(`l'image ${v.file} n'est pas assez haute pour défiler : elle reçoit un zoom lent.`);
			if (media) it.pieces = [{ kind: 'image', file: media.file, frames: N, outDur: slot, scroll: v.scroll && tall, zoom: v.scroll && tall ? null : v.zoom ?? { k: 1.08, x: 0.5, y: 0.5, auto: true } }];
		} else {
			it.pieces = [{ kind: 'carton', fond: v.fond ?? cfg.style.fond, frames: N, outDur: slot, zoom: null }];
			it.carton = v.label ?? (l.keywords.length ? l.keywords.map((k) => k.text).join(' ') : l.text);
		}

		// Keywords on screen (a carton already shows its text).
		if (l.text && v.kind !== 'carton') {
			const words = take ? mots.takes[take.id]?.words : null;
			for (const kw of l.keywords) {
				const k = keywordAt(l, kw, words, D, syllables);
				it.keywords.push({ text: kw.text, at: it.voice.at + k.at, exact: k.exact });
			}
		}
		// Sound effects: chapter, carton, keywords, and those asked in the brackets.
		const bx = cfg.bruitages ?? {};
		if (l.chapter && it.start > 0 && bx.chapitres) it.sons.push({ type: bx.chapitres, t: it.start });
		if (v.kind === 'carton' && bx.cartons) it.sons.push({ type: bx.cartons, t: it.start });
		if (bx.mots_forts) for (const k of it.keywords) it.sons.push({ type: bx.mots_forts, t: Math.max(0, k.at - 0.03) });
		for (const s of v.sons) it.sons.push({ type: s.type, t: it.start + s.dt });
		items.push(it);
	}

	// Keyword end: held 2.2 s, cut short by the next keyword or soon after its line.
	const kws = items.flatMap((it) => it.keywords.map((k) => ({ k, end: it.end })));
	kws.forEach(({ k, end }, j) => {
		const nextAt = kws[j + 1]?.k.at ?? Infinity;
		k.end = Math.max(k.at + 0.7, Math.min(k.at + 2.2, nextAt - 0.05, end + 0.3));
	});

	const chapters = items.filter((it) => it.chapter).map((it) => ({ title: it.chapter, at: it.start, n: it.n }));
	const duration = frame / F;
	if (items.length && !items[0].chapter) warnings.push('script.md ne commence pas par un titre de chapitre : YouTube veut un premier chapitre à 0:00 (« # Intro » suffit).');
	if (chapters.length && chapters.length < 3) warnings.push(`${chapters.length} chapitre(s) : YouTube en demande au moins 3 pour les afficher.`);
	chapters.forEach((c, j) => {
		const len = (chapters[j + 1]?.at ?? duration) - c.at;
		if (len < 10) warnings.push(`le chapitre « ${c.title} » dure ${len.toFixed(1)} s : YouTube demande 10 s au moins.`);
	});
	const sfx = items.flatMap((it) => it.sons);
	return { F, W: cfg.sortie.largeur, H: cfg.sortie.hauteur, frames: frame, duration, items, chapters, sfx, errors, warnings };
}
