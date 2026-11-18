// Text burned into the picture, as an ASS script for libass: the keywords when they are said (a box in the
// accent colour that pops in), the carton texts, and a card at the start of each chapter. Script coordinates
// are those of the final size; libass scales them for the preview.

// '#RRGGBB' → '&HAABBGGRR' (style colour). Alpha 00 is opaque.
function color(c, alpha = '00') {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(c));
	if (!m) throw new Error(`couleur « ${c} » illisible dans refonte.json : écris-la #RRGGBB.`);
	return `&H${alpha}${m[1].slice(4, 6)}${m[1].slice(2, 4)}${m[1].slice(0, 2)}`.toUpperCase();
}
// h:mm:ss.cc
function at(t) {
	const cs = Math.max(0, Math.round(t * 100));
	const p2 = (n) => String(n).padStart(2, '0');
	return `${Math.floor(cs / 360000)}:${p2(Math.floor((cs % 360000) / 6000))}:${p2(Math.floor((cs % 6000) / 100))}.${p2(cs % 100)}`;
}
// Braces and backslashes would be read as tags.
const esc = (s) => String(s).replace(/[{}]/g, '').replace(/\\/g, '/');
// Words into lines of `max` characters at most, joined by \N (no automatic wrap: the pop-in scales the line).
function wrap(text, max) {
	const out = [];
	let cur = '';
	for (const w of String(text).split(/\s+/).filter(Boolean)) {
		if (cur && (cur + ' ' + w).length > max) {
			out.push(cur);
			cur = w;
		} else cur = cur ? `${cur} ${w}` : w;
	}
	if (cur) out.push(cur);
	return out.join('\\N');
}

export function sizes(W, H) {
	return {
		mot: Math.round(H * 0.068),
		box: Math.round(H * 0.016),
		carton: Math.round(H * 0.11),
		titre: Math.round(H * 0.075),
		label: Math.round(H * 0.032),
		marge: Math.round(H * 0.09)
	};
}

export function header(cfg, W, H) {
	const st = cfg.style;
	const font = st.police ?? 'Sans';
	const S = sizes(W, H);
	const row = (name, size, primary, outline, back, border, out, align) =>
		`Style: ${name},${font},${size},${primary},${primary},${outline},${back},0,0,0,0,100,100,0,0,${border},${out},0,${align},0,0,0,1`;
	return [
		'[Script Info]',
		'; Écrit par refonte-youtube',
		'ScriptType: v4.00+',
		`PlayResX: ${W}`,
		`PlayResY: ${H}`,
		'WrapStyle: 2',
		'ScaledBorderAndShadow: yes',
		'YCbCr Matrix: TV.709',
		'',
		'[V4+ Styles]',
		'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
		// BorderStyle 3: an opaque box in OutlineColour, Outline being its padding.
		row('Mot', S.mot, color(st.texte_sur_accent), color(st.accent), color(st.accent), 3, S.box, 2),
		row('Carton', S.carton, color(st.accent), color('#000000'), color('#000000'), 1, 0, 5),
		row('Titre', S.titre, color(st.texte), color('#000000', '50'), color('#000000', '50'), 3, Math.round(S.box * 1.4), 8),
		row('Label', S.label, color(st.accent), color('#000000'), color('#000000'), 1, 0, 2),
		'',
		'[Events]',
		'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
	];
}

const upper = (s, cfg) => (cfg.style.majuscules ? String(s).toLocaleUpperCase(cfg.langue && cfg.langue !== 'auto' ? cfg.langue : undefined) : String(s));

// The whole script for a timeline. Returns { text, events }.
export function buildAss(cfg, tl) {
	const { W, H } = tl;
	const S = sizes(W, H);
	const ev = (a, z, style, text, layer = 0) => `Dialogue: ${layer},${at(a)},${at(z)},${style},,0,0,0,,${text}`;
	const events = [];
	const pos = cfg.style.position_mots ?? 'bas';
	const [an, y] = pos === 'haut' ? [8, S.marge] : pos === 'centre' ? [5, Math.round(H / 2)] : [2, H - S.marge];
	// Pop-in: from 60 % to 106 % then 100 %, fade in quickly, out a little slower.
	const pop = `\\fscx60\\fscy60\\t(0,140,\\fscx106\\fscy106)\\t(140,240,\\fscx100\\fscy100)\\fad(40,160)`;
	for (const it of tl.items) {
		for (const k of it.keywords) events.push(ev(k.at, k.end, 'Mot', `{\\an${an}\\pos(${Math.round(W / 2)},${y})${pop}}${wrap(esc(upper(k.text, cfg)), 30)}`, 2));
		if (it.carton) events.push(ev(it.start, it.end, 'Carton', `{\\an5\\pos(${Math.round(W / 2)},${Math.round(H / 2)})\\fscx80\\fscy80\\t(0,220,\\fscx100\\fscy100)\\fad(120,200)}${wrap(esc(upper(it.carton, cfg)), 18)}`, 1));
	}
	// A chapter card, except on the opening one: it would cover the hook.
	tl.chapters.forEach((c, j) => {
		if (c.at <= 0) return;
		const it = tl.items.find((x) => x.n === c.n);
		const z = Math.min(c.at + 2.4, it.end);
		const label = `${cfg.style.etiquette_chapitre ?? 'Chapitre'} ${j + (tl.chapters[0].at <= 0 ? 0 : 1)}`;
		const card = `\\fscx92\\fscy92\\t(0,260,\\fscx100\\fscy100)\\fad(180,260)`;
		events.push(ev(c.at, z, 'Label', `{\\an2\\pos(${Math.round(W / 2)},${Math.round(H * 0.4)})${card}}${esc(upper(label, cfg))}`, 3));
		events.push(ev(c.at, z, 'Titre', `{\\an8\\pos(${Math.round(W / 2)},${Math.round(H * 0.42)})${card}}${wrap(esc(c.title), 28)}`, 3));
	});
	return { text: [...header(cfg, W, H), ...events].join('\n') + '\n', events: events.length };
}

// One event of each style, to check which face libass picks.
export function sampleAss(cfg, W, H) {
	const line = (style) => `Dialogue: 0,0:00:00.00,0:00:01.00,${style},,0,0,0,,Échantillon 0123`;
	return [...header(cfg, W, H), ...['Mot', 'Carton', 'Titre', 'Label'].map(line)].join('\n') + '\n';
}
