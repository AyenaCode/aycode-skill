// Captions and hook title as an ASS script, burned in by libass. Line breaks are decided here (\N, no
// automatic wrap): the pop-in scales a line frame by frame, and an automatic wrap could re-break it mid-way.
import { zoneOf } from './util.mjs';

// Caption styles. size: font size relative to sous_titres.taille. words: most words on screen at once.
export const STYLES = {
	pop: { size: 1, words: 3, lines: 1, about: '2 ou 3 mots à la fois, le mot dit passe en couleur, chaque groupe entre en rebondissant' },
	mot: { size: 1.45, words: 1, lines: 1, about: 'un seul mot à la fois, très gros, chacun entre en rebondissant' },
	ligne: { size: 0.72, words: 10, lines: 2, about: 'une ou deux lignes posées, remplies en couleur au rythme de la voix' }
};

// '#RRGGBB' → '&HAABBGGRR' (style) or '&HBBGGRR&' (override tag). Alpha 00 is opaque.
const hex = (c) => {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(c));
	if (!m) throw new Error(`couleur « ${c} » illisible : écris-la #RRGGBB.`);
	return [m[1].slice(4, 6), m[1].slice(2, 4), m[1].slice(0, 2)].join('').toUpperCase();
};
const styleColor = (c, alpha = '00') => `&H${alpha}${hex(c)}`;
const tagColor = (c) => `&H${hex(c)}&`;
// h:mm:ss.cc, the ASS time format.
function at(t) {
	const cs = Math.max(0, Math.round(t * 100));
	const p2 = (n) => String(n).padStart(2, '0');
	return `${Math.floor(cs / 360000)}:${p2(Math.floor((cs % 360000) / 6000))}:${p2(Math.floor((cs % 6000) / 100))}.${p2(cs % 100)}`;
}
// Braces and backslashes would be read as tags.
const esc = (s) => String(s).replace(/[{}]/g, '').replace(/\\/g, '/');
// Word as compared with the corrections and emphases: lower case, no punctuation around it.
export const bare = (s) => String(s).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

// Geometry: the caption block is centred on the safe zone horizontally, at `hauteur` of the frame.
export function layout(cfg) {
	const W = cfg.sortie.width;
	const H = cfg.sortie.height;
	const z = zoneOf(cfg);
	const st = cfg.sous_titres;
	const style = STYLES[st.style] ?? STYLES.pop;
	const size = Math.round(st.taille * style.size);
	const avail = W - z.left - z.right - 60;
	// Average advance of a glyph, as a share of the ASS font size (which sets the line height, not the em):
	// measured near 0.45 for the capitals of Montserrat Black, kept a little wider for other faces.
	const adv = st.majuscules ? 0.5 : 0.44;
	return {
		W, H, zone: z, size, style,
		x: Math.round((z.left + W - z.right) / 2),
		y: Math.round(H * (st.hauteur ?? 0.68)),
		chars: Math.max(6, Math.floor(avail / (size * adv * OVERSHOOT))),
		title: { size: Math.round(st.taille * 0.82), y: Math.round(z.top + 40), chars: Math.max(8, Math.floor(avail / (st.taille * 0.82 * 0.5 * OVERSHOOT))) }
	};
}

function header(cfg, L) {
	const st = cfg.sous_titres;
	const font = st.police ?? 'Sans';
	const row = (name, size, primary, secondary, outline, back, border, out, shadow) =>
		`Style: ${name},${font},${size},${primary},${secondary},${outline},${back},0,0,0,0,100,100,0,0,${border},${out},${shadow},5,0,0,0,1`;
	const ligne = st.style === 'ligne';
	return [
		'[Script Info]',
		'; Écrit par video-verticale',
		'ScriptType: v4.00+',
		`PlayResX: ${L.W}`,
		`PlayResY: ${L.H}`,
		'WrapStyle: 2',
		'ScaledBorderAndShadow: yes',
		'YCbCr Matrix: TV.709',
		'',
		'[V4+ Styles]',
		'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
		// With \kf the text goes from SecondaryColour (not yet said) to PrimaryColour (said).
		row('Cap', L.size, styleColor(ligne ? st.accent : st.couleur), styleColor(st.couleur), styleColor('#000000'), styleColor('#000000', '60'), 1, st.contour, st.ombre),
		// Opaque box (BorderStyle 3) in the accent colour behind dark text.
		row('Titre', L.title.size, styleColor('#111111'), styleColor('#111111'), styleColor(st.accent), styleColor('#000000', '80'), 3, 18, 0),
		'',
		'[Events]',
		'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
	];
}

// Text shown for a word: spelling fixed, trailing commas and full stops dropped, capitals if asked.
function shown(w, cfg) {
	const st = cfg.sous_titres;
	const fix = st.corrections?.[bare(w.t)];
	let s = fix ?? w.t;
	s = s.replace(/[.,;:…]+$/u, '');
	return st.majuscules ? s.toLocaleUpperCase(cfg.lang && cfg.lang !== 'auto' ? cfg.lang : undefined) : s;
}
// Indices of the words that belong to an emphasis (one word or several in a row).
function emphasised(words, list = []) {
	const marks = new Set();
	const ws = words.map((w) => bare(w.t));
	for (const e of list) {
		const toks = String(e).split(/\s+/).map(bare).filter(Boolean);
		if (!toks.length) continue;
		for (let i = 0; i + toks.length <= ws.length; i++) if (toks.every((t, k) => ws[i + k] === t)) for (let k = 0; k < toks.length; k++) marks.add(i + k);
	}
	return marks;
}

// Small linking words a group should not end on (French and English).
const WEAK = /^(a|à|au|aux|de|des|du|d|en|et|la|le|les|l|un|une|ce|ça|je|tu|il|on|ma|mon|ta|ton|sa|son|pour|par|avec|sur|dans|que|qui|the|to|of|and|for|with|in|on|at|is|my|your|you|i|it|an|or|but)$/i;
// Words → groups shown together. The speech is first cut into phrases (at a pause, a sentence end, a
// comma), then each phrase into the cheapest groups that fit on screen.
export function groups(words, cfg, L) {
	const max = cfg.sous_titres.style === 'pop' ? cfg.sous_titres.mots_max ?? L.style.words : L.style.words;
	const room = L.chars * L.style.lines;
	const span = L.style.lines > 1 ? 4 : 2.2;
	const phrases = [];
	let cur = [];
	for (const w of words) {
		const last = cur.at(-1);
		if (last && (w.a - last.b >= 0.35 || /[.?!…,;:]$/.test(last.t))) {
			phrases.push(cur);
			cur = [];
		}
		cur.push(w);
	}
	if (cur.length) phrases.push(cur);
	const fits = (g) => g.length === 1 || (g.map((w) => w.s).join(' ').length <= room && g.at(-1).b - g[0].a <= span);
	// Cheapest split of each phrase: few groups, none ending on a small linking word, few lone words.
	const out = [];
	for (const p of phrases) {
		const best = [{ cost: 0, from: -1 }];
		for (let i = 1; i <= p.length; i++) {
			best[i] = { cost: Infinity, from: i - 1 };
			for (let j = Math.max(0, i - max); j < i; j++) {
				const g = p.slice(j, i);
				if (!fits(g)) continue;
				const cost = best[j].cost + 10 + (i < p.length && WEAK.test(bare(p[i - 1].t)) ? 12 : 0) + (g.length === 1 && p.length > 1 ? 4 : 0);
				if (cost < best[i].cost) best[i] = { cost, from: j };
			}
		}
		const parts = [];
		for (let i = p.length; i > 0; i = best[i].from) parts.unshift(p.slice(best[i].from, i));
		out.push(...parts);
	}
	return out;
}
// Lines of a group: greedy fill up to the line width.
function lines(g, chars) {
	const out = [[]];
	for (const w of g) {
		const line = out.at(-1);
		if (line.length && [...line, w].map((x) => x.s).join(' ').length > chars) out.push([w]);
		else line.push(w);
	}
	return out;
}

// Pop-in: from 70 % to a 106 % overshoot, then 100 %. Line widths keep room for the overshoot.
const OVERSHOOT = 1.06;
const POP = '\\fscx70\\fscy70\\t(0,80,\\fscx106\\fscy106)\\t(80,150,\\fscx100\\fscy100)';

function captionEvents(words, cfg, L) {
	const st = cfg.sous_titres;
	const marks = emphasised(words, st.emphase);
	const ws = words.map((w, i) => ({ ...w, s: esc(shown(w, cfg)), emph: marks.has(i) })).filter((w) => w.s);
	const gs = groups(ws, cfg, L);
	const ev = [];
	const big = Math.round(L.size * 1.15);
	const pos = `\\an5\\pos(${L.x},${L.y})`;
	gs.forEach((g, gi) => {
		const next = gs[gi + 1]?.[0].a ?? Infinity;
		let end = Math.min(g.at(-1).b + 0.25, next);
		if (next - end < 0.3) end = Math.min(next, g.at(-1).b + 1.2);
		if (end <= g[0].a) end = g[0].a + 0.2;
		// A word wider than the line is drawn smaller rather than overflowing the safe zone.
		const longest = Math.max(...g.map((w) => w.s.length));
		const fs = longest > L.chars ? Math.floor((L.size * L.chars) / longest) : L.size;
		const word = (w, active) => {
			const tags = [];
			if (w.emph) tags.push(`\\1c${tagColor(st.accent)}\\fs${Math.round((big * fs) / L.size)}`);
			else if (active) tags.push(`\\1c${tagColor(st.accent)}`);
			if (fs !== L.size && !w.emph) tags.push(`\\fs${fs}`);
			return tags.length ? `{${tags.join('')}}${w.s}{\\1c${tagColor(st.couleur)}\\fs${fs}}` : w.s;
		};
		const text = (active) => lines(g, L.chars).map((ln) => ln.map((w) => word(w, w === active)).join(' ')).join('\\N');
		if (st.style === 'ligne') {
			// One line event; \kf fills each word over the time until the next one starts.
			const body = lines(g, L.chars)
				.map((ln) => ln.map((w) => {
					const i = g.indexOf(w);
					const until = i < g.length - 1 ? g[i + 1].a : Math.min(w.b, end);
					const k = Math.max(1, Math.round((until - w.a) * 100));
					return `{\\kf${k}}${w.emph ? `{\\fs${big}}${w.s}{\\fs${L.size}}` : w.s}`;
				}).join(' '))
				.join('\\N');
			ev.push([g[0].a, end, `{${pos}\\fad(80,80)}${body}`]);
			return;
		}
		g.forEach((w, k) => {
			const a = k === 0 ? g[0].a : w.a;
			const z = k < g.length - 1 ? g[k + 1].a : end;
			if (z - a < 0.01) return;
			ev.push([a, z, `{${pos}${k === 0 ? POP : ''}}${text(st.style === 'mot' ? null : w)}`]);
		});
	});
	return ev.map(([a, z, t]) => `Dialogue: 1,${at(a)},${at(z)},Cap,,0,0,0,,${t}`);
}

function titleEvents(cfg, L) {
	const h = cfg.accroche;
	if (!h?.texte) return [];
	const text = esc(cfg.sous_titres.majuscules ? h.texte.toLocaleUpperCase() : h.texte);
	const rows = text.includes('\n') ? text.split('\n') : lines(text.split(/\s+/).map((s) => ({ s })), L.title.chars).map((ln) => ln.map((w) => w.s).join(' '));
	const body = rows.join('\\N');
	return [`Dialogue: 2,${at(h.debut ?? 0)},${at(h.fin ?? 2.5)},Titre,,0,0,0,,{\\an8\\pos(${L.x},${L.title.y})\\fad(0,200)${POP}}${body}`];
}

// The whole script. only: 'cap' or 'titre' to draw one layer (for the safe-zone measure).
export function buildAss(cfg, words, { only } = {}) {
	const st = cfg.sous_titres.style;
	if (st !== 'aucun' && !STYLES[st]) throw new Error(`style de sous-titres « ${st} » inconnu : ${[...Object.keys(STYLES), 'aucun'].join(', ')}.`);
	const L = layout(cfg);
	const on = st !== 'aucun';
	const ev = [...(only !== 'titre' && on ? captionEvents(words, cfg, L) : []), ...(only !== 'cap' ? titleEvents(cfg, L) : [])];
	return { text: [...header(cfg, L), ...ev, ''].join('\n'), events: ev.length, layout: L };
}

// One frame of every style with accented capitals: shows which face libass really uses.
export function sampleAss(cfg) {
	const L = layout(cfg);
	return [...header(cfg, L), 'Dialogue: 1,0:00:00.00,0:00:01.00,Cap,,0,0,0,,ÉTÉ À ÇA Ô', 'Dialogue: 2,0:00:00.00,0:00:01.00,Titre,,0,0,0,,ÉTÉ À ÇA Ô', ''].join('\n');
}
