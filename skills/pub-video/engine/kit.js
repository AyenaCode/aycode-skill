// Building blocks for ads: kinetic text, entrances and exits, devices, scene transitions, camera,
// texture, particles. Every helper takes a timeline first (a scene's `s`, or the master `tl`) and a
// start time on that timeline, and most add the matching sound cue. Pass sfx: false to keep one silent.
import { gsap, SplitText, C, b, h, cue, panOf, rnd, frame, extend } from './engine.js';

const list = (x) => (x == null ? [] : Array.isArray(x) || x instanceof NodeList ? [...x] : [x]);
const cueOn = (s, t, type, o) => (s.cue ? s.cue(t, type, o) : cue(t, type, o));
// sfx option → cue. `def` is the helper's default sound; false mutes, a string or object replaces it.
function sound(s, t, sfx, def, el, extra = {}) {
	if (sfx === false || (sfx === undefined && !def)) return;
	const o = typeof sfx === 'object' ? sfx : { type: typeof sfx === 'string' ? sfx : def };
	const { type = def, ...rest } = o;
	cueOn(s, Math.max(0, t), type, { ...(el ? { pan: panOf(el) } : {}), ...extra, ...rest });
}

// ---- Icons (24 px grid, stroke follows the text colour) --------------------------------------
const I = (d, fill) => `<svg class="i" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const icon = {
	check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
	x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
	plus: I('<path d="M12 5v14M5 12h14"/>'),
	arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
	up: I('<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>'),
	down: I('<path d="M4 7l6 6 4-4 6 7"/><path d="M15 16h5v-5"/>'),
	search: I('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
	chat: I('<path d="M4 19.5l1.4-4A8 8 0 1 1 8.6 18.6z"/>'),
	bell: I('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>'),
	heart: I('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
	star: I('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>', true),
	bolt: I('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>', true),
	lock: I('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
	shield: I('<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>'),
	clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
	user: I('<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
	cart: I('<path d="M3 4h2.5l2.2 11h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>'),
	box: I('<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>'),
	chart: I('<path d="M4 20h16M7 16v-4M12 16V7M17 16v-7"/>'),
	send: I('<path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.2L4 11l9 1-9 1-2 6.2a1 1 0 0 0 1.4 1.2z"/>', true),
	play: I('<path d="M7 4.5v15l12.5-7.5z"/>', true),
	sparkle: I('<path d="M12 2.5l1.9 6.1 6.1 1.9-6.1 1.9L12 18.5l-1.9-6.1L4 10.5l6.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>', true),
	pin: I('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>'),
	truck: I('<path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>'),
	cursor: I('<path d="M5 3l14 8.5-6 1.5-2.5 6z"/>', true)
};

// ---- Text ------------------------------------------------------------------------------------
// A text block the viewer must read. cls: t-hero | t-title | t-sub | t-body | t-label (see base.css).
export function text(parent, html, cls = 't-title', style = {}) {
	const el = h(parent, `abs t ${cls}`, html, style);
	el.dataset.read = el.textContent.trim().replace(/\s+/g, ' ');
	return el;
}
// Split once per element into lines, words and chars (classes pv-ln, pv-wd, pv-ch: prefixed so the page's
// own classes never style them). Masked lines (for the 'mask' reveal) clip what leaves the line box;
// base.css widens that clip so accents and descenders stay whole.
export function split(el, { mask = false } = {}) {
	if (el._split) {
		if (el._split.masked !== mask) throw new Error(`« ${el.textContent.slice(0, 30)} » est déjà découpé ${el._split.masked ? 'avec' : 'sans'} masque : crée un second élément.`);
		return el._split;
	}
	const sp = SplitText.create(el, { type: 'lines,words,chars', linesClass: 'pv-ln', wordsClass: 'pv-wd', charsClass: 'pv-ch', ...(mask ? { mask: 'lines' } : {}) });
	sp.masked = mask;
	el._split = sp;
	return sp;
}
const TEXT_IN = {
	rise: { from: { y: '0.55em', autoAlpha: 0 }, to: { y: 0, autoAlpha: 1, duration: 0.6, ease: 'swift' } },
	// Starts far enough below the line that no accent shows through the widened clip before the entrance.
	mask: { from: { yPercent: 160 }, to: { yPercent: 0, duration: 0.7, ease: 'expo.out' }, mask: true },
	slam: { from: { scale: 1.5, y: '-0.12em', autoAlpha: 0, filter: 'blur(14px)' }, to: { scale: 1, y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.34, ease: 'expo.out' }, sfx: 'hit', each: 0.12 },
	pop: { from: { scale: 0, autoAlpha: 0 }, to: { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'springy', transformOrigin: '50% 80%' }, sfx: 'pop' },
	drop: { from: { y: '-0.9em', autoAlpha: 0, rotation: -6 }, to: { y: 0, autoAlpha: 1, rotation: 0, duration: 0.55, ease: 'spring' } },
	blur: { from: { autoAlpha: 0, filter: 'blur(18px)' }, to: { autoAlpha: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' } },
	fade: { from: { autoAlpha: 0 }, to: { autoAlpha: 1, duration: 0.45, ease: 'power1.out' } }
};
const EACH = { chars: 0.022, words: 0.075, lines: 0.11 };
// Kinetic entrance. o: style (rise|mask|slam|pop|drop|blur|fade), by (words|chars|lines), each (stagger s),
// from (start|center|end|edges|random), dur, ease, sfx.
export function textIn(s, el, at = 0, o = {}) {
	const p = TEXT_IN[o.style ?? 'rise'];
	if (!p) throw new Error(`textIn : style inconnu « ${o.style} » (${Object.keys(TEXT_IN).join(', ')}).`);
	const by = o.by ?? (o.style === 'mask' ? 'lines' : 'words');
	const units = split(el, { mask: !!p.mask })[by];
	const each = o.each ?? p.each ?? EACH[by];
	gsap.set(el, { autoAlpha: 1 });
	const to = { ...p.to, stagger: { each, from: o.from ?? 'start' } };
	if (o.dur) to.duration = o.dur;
	if (o.ease) to.ease = o.ease;
	s.fromTo(units, p.from, to, at);
	const def = p.sfx;
	if (o.sfx !== false && (o.sfx || def)) {
		const n = by === 'chars' ? 1 : Math.min(units.length, def === 'pop' ? 5 : 3);
		for (let i = 0; i < n; i++) sound(s, at + i * each, o.sfx, def, units[i], def === 'pop' ? { pitch: 1 + i * 0.07 } : { v: i ? 0.8 : 1 });
	}
	return units;
}
const OUT = {
	up: { y: '-0.5em', autoAlpha: 0 }, down: { y: '0.5em', autoAlpha: 0 }, left: { x: -80, autoAlpha: 0 }, right: { x: 80, autoAlpha: 0 },
	fade: { autoAlpha: 0 }, blur: { autoAlpha: 0, filter: 'blur(16px)' }, shrink: { scale: 0.6, autoAlpha: 0 }, zoom: { scale: 1.5, autoAlpha: 0, filter: 'blur(10px)' }
};
// Exit of a text block. Exits are short and accelerate: the eye is already leaving.
export function textOut(s, el, at, o = {}) {
	const units = el._split ? el._split[o.by ?? 'words'] : [el];
	s.to(units, { ...(OUT[o.style ?? 'up'] ?? OUT.up), duration: o.dur ?? 0.28, ease: o.ease ?? 'exit', stagger: { each: o.each ?? 0.025, from: o.from ?? 'start' } }, at);
	sound(s, at, o.sfx, null, el);
}
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Type a string into an element, with a caret and key sounds. Returns the end time.
export function type(s, el, str, at, dur, o = {}) {
	const st = { n: 0 };
	const hold = o.hold ?? 0.6;
	const live = { on: 0 };
	s.fromTo(st, { n: 0 }, { n: str.length, duration: dur, ease: 'none' }, at);
	s.fromTo(live, { on: 0 }, { on: 1, duration: 0.001 }, at).to(live, { on: 0, duration: 0.001 }, at + dur + hold);
	const caret = o.caret === false ? '' : '<span class="caret"></span>';
	frame((t) => {
		const done = st.n >= str.length;
		const blink = done ? Math.floor(t * 2.5) % 2 === 0 : true;
		el.innerHTML = esc(str.slice(0, Math.floor(st.n + 1e-6))) + (live.on > 0.5 && blink ? caret : '');
	});
	// At most 6 key sounds a second: beyond that they blur into a buzz.
	if (o.sfx !== false) {
		const step = Math.max(1, Math.ceil(str.length / (dur * 6)));
		for (let i = 0; i < str.length; i += step) if (str[i] !== ' ') sound(s, at + (dur * i) / str.length, o.sfx, 'key', el, { v: 0.5, pitch: 0.92 + (i % 4) * 0.05 });
	}
	el.textContent = el.dataset.read = str;
	return at + dur;
}
// Number that rolls from a to z. o.format(value) → string; default groups thousands for the page language.
// The number rises in when it starts rolling, unless o.enter is false or the element is already animated
// (an entrance written before count()).
export function count(s, el, a, z, at, dur, o = {}) {
	const st = { v: a };
	const nf = new Intl.NumberFormat(o.locale ?? (document.documentElement.lang || 'fr'), { maximumFractionDigits: o.decimals ?? 0 });
	const fmt = o.format ?? ((v) => `${o.prefix ?? ''}${nf.format(v)}${o.suffix ?? ''}`);
	const step = o.step ?? 1;
	if (o.enter !== false && !gsap.getTweensOf(el).length) s.fromTo(el, { autoAlpha: 0, y: '0.3em' }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'swift' }, at);
	s.fromTo(st, { v: a }, { v: z, duration: dur, ease: o.ease ?? 'power2.out' }, at);
	frame(() => (el.textContent = fmt(Math.round(st.v / step) * step)));
	// The final value sits in the DOM from the start, so anything measured at build time fits it.
	el.textContent = el.dataset.read = fmt(z);
	if (o.sfx !== false) {
		const n = Math.max(2, Math.min(10, Math.round(dur * 6)));
		for (let i = 0; i < n; i++) sound(s, at + (dur * i) / n, o.sfx, 'tick', el, { pitch: 1 + i * 0.05, v: 0.7 });
		if (o.ding !== false) sound(s, at + dur, undefined, 'ding', el, { v: 0.8 });
	}
}
// Highlighter sweep behind an inline <span class="mark"> inside a text block.
export function mark(s, el, at, o = {}) {
	s.fromTo(el, { backgroundSize: '0% var(--mark-h, 40%)' }, { backgroundSize: '100% var(--mark-h, 40%)', duration: o.dur ?? 0.45, ease: o.ease ?? 'power3.inOut' }, at);
	sound(s, at, o.sfx, 'swish', el, { v: 0.6 });
}

// ---- Entrances, exits, accents ---------------------------------------------------------------
const side = (dir, d) => ({ left: { x: -d }, right: { x: d }, up: { y: -d }, down: { y: d } })[dir] ?? { y: d };
const ENTER = {
	rise: (o) => [{ y: o.dist ?? 90, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'swift' }],
	pop: () => [{ scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'springy' }, 'pop'],
	// Hidden before its start, then fully opaque while it travels (enter() adds the switch).
	slide: (o) => [{ ...side(o.dir ?? 'right', o.dist ?? C.w) }, { x: 0, y: 0, duration: 0.7, ease: 'expo.out' }, 'swoosh', 0, true],
	drop: (o) => [{ y: -(o.dist ?? 500), rotation: o.rot ?? -10, autoAlpha: 0 }, { y: 0, rotation: 0, autoAlpha: 1, duration: 0.55, ease: 'spring' }, 'thud', 0.16],
	zoom: () => [{ scale: 1.8, autoAlpha: 0, filter: 'blur(16px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.38, ease: 'expo.out' }, 'hit'],
	grow: () => [{ scale: 0.82, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'swift' }],
	fade: () => [{ autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power1.out' }],
	blur: () => [{ autoAlpha: 0, filter: 'blur(20px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' }],
	flip: () => [{ rotationX: -80, transformPerspective: 1600, transformOrigin: '50% 100%', autoAlpha: 0 }, { rotationX: 0, autoAlpha: 1, duration: 0.7, ease: 'spring' }, 'swoosh'],
	wipe: (o) => [{ clipPath: { right: 'inset(0% 100% 0% 0%)', left: 'inset(0% 0% 0% 100%)', down: 'inset(0% 0% 100% 0%)', up: 'inset(100% 0% 0% 0%)' }[o.dir ?? 'right'], autoAlpha: 1 }, { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1, duration: 0.6, ease: 'power3.inOut' }]
};
// Bring one element or a list on screen. o: style (rise|pop|slide|drop|zoom|grow|fade|blur|flip|wipe),
// each (stagger), dir, dist, dur, ease, sfx. Lists get one sound per element (up to 6), rising in pitch.
export function enter(s, els, at = 0, o = {}) {
	const make = ENTER[o.style ?? 'rise'];
	if (!make) throw new Error(`enter : style inconnu « ${o.style} » (${Object.keys(ENTER).join(', ')}).`);
	const [from, to, def, lag = 0, snap = false] = make(o);
	els = list(els);
	const each = o.each ?? 0.09;
	if (o.dur) to.duration = o.dur;
	if (o.ease) to.ease = o.ease;
	s.fromTo(els, from, { ...to, stagger: each }, at);
	// Shown at once when it starts moving, invisible before: a short slide never sits displaced on screen.
	if (snap) s.fromTo(els, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.001, ease: 'none', stagger: each }, at);
	els.slice(0, 6).forEach((el, i) => sound(s, at + i * each + lag, o.sfx, def, el, els.length > 1 ? { pitch: 1 + i * 0.08 } : {}));
}
const LEAVE = {
	up: (o) => ({ y: -(o.dist ?? 160), autoAlpha: 0 }), down: (o) => ({ y: o.dist ?? 160, autoAlpha: 0 }),
	left: (o) => ({ x: -(o.dist ?? C.w) }), right: (o) => ({ x: o.dist ?? C.w }),
	fade: () => ({ autoAlpha: 0 }), shrink: () => ({ scale: 0.7, autoAlpha: 0 }), blur: () => ({ autoAlpha: 0, filter: 'blur(18px)' }),
	zoom: () => ({ scale: 1.6, autoAlpha: 0, filter: 'blur(12px)' })
};
// Take elements off screen. Shorter than the entrance, accelerating. Silent unless sfx is given.
export function leave(s, els, at, o = {}) {
	els = list(els);
	const style = o.style ?? 'up';
	const dur = o.dur ?? 0.3;
	const each = o.each ?? 0.04;
	s.to(els, { ...(LEAVE[style] ?? LEAVE.up)(o), duration: dur, ease: o.ease ?? 'exit', stagger: each }, at);
	// A sideways exit stays opaque while it moves, then is hidden: a short one never stays on screen.
	if (style === 'left' || style === 'right') s.to(els, { autoAlpha: 0, duration: 0.001, ease: 'none', stagger: each }, at + dur);
	sound(s, at, o.sfx, null, els[0]);
}
// Button press: a quick dip then a springy release, with a click.
export function press(s, el, at, o = {}) {
	s.to(el, { scale: o.depth ?? 0.93, duration: 0.08, ease: 'power2.in' }, at - 0.08).to(el, { scale: 1, duration: 0.45, ease: 'springy' }, at);
	sound(s, at, o.sfx, 'click', el);
}
// Shake that dies out (an impact, an error). Deterministic: the offsets come from a seeded generator.
export function shake(s, el, at, o = {}) {
	const r = rnd(o.seed ?? 11);
	const n = o.n ?? 7;
	const amp = o.amp ?? 18;
	const frames = Array.from({ length: n }, (_, i) => {
		const k = (1 - i / n) ** 2 * amp;
		return { x: (i % 2 ? -1 : 1) * k * r.range(0.6, 1), y: r.range(-0.5, 0.5) * k };
	});
	s.to(el, { keyframes: [...frames, { x: 0, y: 0 }], duration: o.dur ?? 0.4, ease: 'none' }, at);
}
// A finite number of soft pulses that call attention to a button or a price.
export function pulse(s, el, at, o = {}) {
	const n = o.n ?? 2;
	const d = o.dur ?? 0.5;
	for (let i = 0; i < n; i++) s.to(el, { scale: o.scale ?? 1.06, duration: d * 0.4, ease: 'sine.out' }, at + i * d).to(el, { scale: 1, duration: d * 0.6, ease: 'sine.inOut' }, at + i * d + d * 0.4);
}
// Rubber-stamp landing: slams in rotated, shakes its parent a little.
export function stamp(s, el, at, o = {}) {
	s.fromTo(el, { scale: 2.6, rotation: o.from ?? -28, autoAlpha: 0 }, { scale: 1, rotation: o.rot ?? 6, autoAlpha: 1, duration: 0.26, ease: 'power4.in' }, at - 0.26);
	if (o.shake !== false) shake(s, o.shake ?? el.parentElement, at, { amp: 12, dur: 0.3 });
	sound(s, at, o.sfx, 'stamp', el);
}
// Draw the strokes of an SVG (path, line, circle…) from nothing to full length.
export function draw(s, shapes, at, o = {}) {
	s.fromTo(shapes, { drawSVG: '0%' }, { drawSVG: '100%', duration: o.dur ?? 0.6, ease: o.ease ?? 'power2.inOut', stagger: o.each ?? 0.1 }, at);
	sound(s, at, o.sfx, 'swish', list(shapes)[0]?.closest?.('svg')?.parentElement, { v: 0.6 });
}
// Box of the text actually drawn inside el (not its full-width block), in its offset parent's pixels.
// Measured on a copy with every transform removed, so pending entrance animations do not skew it.
function inkBox(el) {
	const copy = el.cloneNode(true);
	copy.style.visibility = 'hidden';
	for (const n of [copy, ...copy.querySelectorAll('*')]) for (const k of ['transform', 'translate', 'rotate', 'scale', 'filter']) n.style[k] = 'none';
	el.parentElement.appendChild(copy);
	const range = document.createRange();
	range.selectNodeContents(copy);
	const r = range.getBoundingClientRect();
	const o = copy.getBoundingClientRect();
	const box = r.width ? [copy.offsetLeft + r.left - o.left, copy.offsetTop + r.top - o.top, r.width, r.height] : [copy.offsetLeft, copy.offsetTop, copy.offsetWidth, copy.offsetHeight];
	copy.remove();
	return box;
}
// Hand-drawn accent around or under an element: kind 'underline' | 'circle' | 'arrow'. Returns the SVG wrapper.
export function scribble(s, target, at, o = {}) {
	const p = target.offsetParent ?? target.parentElement;
	const [x, y, w, hh] = inkBox(target);
	const kind = o.kind ?? 'underline';
	const pad = o.pad ?? 18;
	let box;
	let d;
	if (kind === 'circle') {
		box = [x - pad * 1.6, y - pad, w + pad * 3.2, hh + pad * 2];
		const [W, H] = [box[2], box[3]];
		d = `M${W * 0.52},${H * 0.06} C${W * 0.16},${H * 0.0} ${W * 0.01},${H * 0.3} ${W * 0.03},${H * 0.56} C${W * 0.05},${H * 0.9} ${W * 0.34},${H * 0.99} ${W * 0.6},${H * 0.95} C${W * 0.9},${H * 0.9} ${W * 1.0},${H * 0.62} ${W * 0.96},${H * 0.4} C${W * 0.92},${H * 0.14} ${W * 0.66},${H * 0.02} ${W * 0.4},${H * 0.1}`;
	} else if (kind === 'arrow') {
		box = [x - (o.len ?? 220) - pad, y + hh / 2 - 70, o.len ?? 220, 140];
		const [W, H] = [box[2], box[3]];
		d = `M${W * 0.04},${H * 0.2} C${W * 0.3},${H * 0.95} ${W * 0.62},${H * 0.92} ${W * 0.94},${H * 0.5} M${W * 0.94},${H * 0.5} L${W * 0.72},${H * 0.42} M${W * 0.94},${H * 0.5} L${W * 0.82},${H * 0.82}`;
	} else {
		box = [x - 6, y + hh - 6, w + 12, 44];
		const W = box[2];
		d = `M4,22 C${W * 0.2},6 ${W * 0.36},32 ${W * 0.55},18 S${W * 0.86},8 ${W - 4},20`;
	}
	const el = h(p, 'abs scribble', `<svg viewBox="0 0 ${box[2]} ${box[3]}" width="${box[2]}" height="${box[3]}" fill="none" stroke="${o.color ?? 'var(--accent)'}" stroke-width="${o.width ?? 9}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`, { left: `${box[0]}px`, top: `${box[1]}px`, pointerEvents: 'none' });
	draw(s, el.querySelectorAll('path'), at, { dur: o.dur ?? 0.5, sfx: o.sfx });
	return el;
}

// ---- Devices ---------------------------------------------------------------------------------
// What a device shows: a screenshot (o.shot) or a rebuilt screen (o.html). Returns the scrolling element.
function fill(screen, o) {
	if (o.shot) {
		const img = document.createElement('img');
		img.src = o.shot;
		screen.appendChild(img);
		return img;
	}
	return o.html === undefined ? null : h(screen, 'content', o.html);
}
// Phone showing a screenshot (o.shot) or rebuilt HTML (o.html). o: w (outer width), x, y, tone ('dark' | 'light').
// Returns { el, screen, img, w, sw, sh }: img is what scrolls, sw × sh the visible screen in stage pixels.
export function phone(parent, o = {}) {
	const w = o.w ?? 620;
	const el = h(parent, `abs phone ${o.tone ?? 'dark'}`, '<div class="screen"></div><div class="island"></div>', { left: `${o.x ?? (C.w - w) / 2}px`, top: `${o.y ?? 300}px` });
	el.style.setProperty('--pw', `${w}px`);
	const screen = el.querySelector('.screen');
	const sw = w * 0.94;
	return { el, screen, img: fill(screen, o), w, sw, sh: sw * 2.164 };
}
// Browser window showing a screenshot (o.shot) or rebuilt HTML (o.html). o: url, w, h (viewport height), x, y.
export function browser(parent, o = {}) {
	const w = o.w ?? 940;
	const el = h(parent, 'abs browser', `<div class="bar"><i></i><i></i><i></i><span class="url">${o.url ?? ''}</span></div><div class="screen"></div>`, { left: `${o.x ?? (C.w - w) / 2}px`, top: `${o.y ?? 400}px`, width: `${w}px` });
	const screen = el.querySelector('.screen');
	screen.style.height = `${o.h ?? w * 0.62}px`;
	return { el, screen, img: fill(screen, o), w, sw: w, sh: o.h ?? w * 0.62 };
}
// Terminal window for a command-line product. o: w, x, y, h (body height), title, prompt ('$'), tone ('dark' | 'light').
// Returns { el, body, line(html, cls), cmd(s, text, at, dur) }: line() adds an output line (show it with enter),
// cmd() types a command after the prompt and returns its end time. Classes for spans: ps, dim, ok, err.
export function terminal(parent, o = {}) {
	const w = o.w ?? 940;
	const el = h(parent, `abs term ${o.tone ?? 'dark'}`, `<div class="bar"><i></i><i></i><i></i><span class="title">${o.title ?? ''}</span></div><div class="body"></div>`, { left: `${o.x ?? (C.w - w) / 2}px`, top: `${o.y ?? 420}px`, width: `${w}px` });
	const body = el.querySelector('.body');
	if (o.h) body.style.height = `${o.h}px`;
	el.querySelector('.bar').dataset.deco = '1'; // window chrome, not copy to read
	return {
		el,
		body,
		line: (html = '', cls = '') => h(body, `term-ln ${cls}`.trim(), html),
		cmd(s, text, at, dur, opt = {}) {
			const ln = h(body, 'term-ln', `<span class="ps">${o.prompt ?? '$'}</span> <span class="in"></span>`);
			return type(s, ln.querySelector('.in'), text, at, dur ?? Math.max(0.4, text.length * 0.05), opt);
		}
	};
}
// Scroll the screenshot inside a device to y pixels (in the image as drawn), like a thumb would.
export function scroll(s, dev, y, at, dur, o = {}) {
	s.to(dev.img, { y: -y, duration: dur, ease: o.ease ?? 'power2.inOut' }, at);
	sound(s, at, o.sfx, 'scroll', dev.el, { d: dur, v: 0.8 });
}
// A fingertip touches a point of `parent` (x, y in parent pixels) at time `at`: dot, press, ripple, click.
export function tap(s, parent, x, y, at, o = {}) {
	const size = o.size ?? 110;
	const dot = h(parent, 'abs tapdot', '', { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
	const ring = h(parent, 'abs tapring', '', { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
	const lead = o.lead ?? 0.35;
	s.fromTo(dot, { autoAlpha: 0, scale: 1.5, x: o.fromX ?? 70, y: o.fromY ?? 110 }, { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: lead, ease: 'power3.out' }, at - lead)
		.to(dot, { scale: 0.72, duration: 0.07, ease: 'power2.in' }, at - 0.07)
		.to(dot, { scale: 1, duration: 0.3, ease: 'spring' }, at)
		.to(dot, { autoAlpha: 0, duration: 0.25, ease: 'power1.in' }, at + (o.stay ?? 0.3));
	s.fromTo(ring, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 0.9, scale: 0.9, duration: 0.01 }, at).to(ring, { autoAlpha: 0, scale: 2.6, duration: 0.55, ease: 'power2.out' }, at + 0.01);
	sound(s, at, o.sfx, 'click', dot);
	return dot;
}
// Mouse pointer travelling through points [[x, y], …] of `parent`, clicking at the last one.
export function pointer(s, parent, points, at, o = {}) {
	const el = h(parent, 'abs pointer', icon.cursor, { left: '0px', top: '0px' });
	const hop = o.hop ?? 0.55;
	s.fromTo(el, { autoAlpha: 0, x: points[0][0], y: points[0][1] }, { autoAlpha: 1, duration: 0.2 }, at);
	points.slice(1).forEach(([x, y], i) => s.to(el, { x, y, duration: hop, ease: 'glide' }, at + 0.1 + i * (hop + (o.rest ?? 0.15))));
	const end = at + 0.1 + (points.length - 1) * (hop + (o.rest ?? 0.15));
	if (o.click !== false) {
		s.to(el, { scale: 0.82, duration: 0.07, transformOrigin: '20% 15%' }, end - 0.05).to(el, { scale: 1, duration: 0.25, ease: 'spring' }, end + 0.03);
		sound(s, end, o.sfx, 'click', el);
	}
	return { el, end };
}

// ---- Scene transitions -----------------------------------------------------------------------
// transition(tl, type, a, z, o) joins scene a to scene z around the seam (z.start). It animates the
// two scene layers, never their contents, and keeps both on screen while they overlap.
// type: wipe | iris | push | zoom | whip | flash | fade.   o: dur, dir, color(s), x, y, sfx.
export function transition(tl, type, a, z, o = {}) {
	const at = z.start;
	const stage = a.el.parentElement;
	const dur = o.dur ?? { wipe: 0.7, iris: 0.6, push: 0.6, zoom: 0.5, whip: 0.4, flash: 0.3, fade: 0.5 }[type];
	const dir = o.dir ?? 'left';
	const vec = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
	const [dx, dy] = [vec[0] * C.w, vec[1] * C.h];
	gsap.set(z.el, { zIndex: 2 });
	if (type === 'wipe') {
		// Coloured panels sweep across and hide the cut: the first covers, the last uncovers.
		const colors = list(o.colors ?? o.color ?? 'var(--brand)');
		const half = dur / 2;
		colors.forEach((c, i) => {
			const p = h(stage, 'wipe', '', { background: c, zIndex: 5 + i });
			const lag = i * 0.07;
			const out = at + lag + (colors.length - 1) * 0.07;
			tl.set(p, { autoAlpha: 1 }, at - half + lag)
				.fromTo(p, { xPercent: -vec[0] * 101, yPercent: -vec[1] * 101 }, { xPercent: 0, yPercent: 0, duration: half, ease: 'power3.in' }, at - half + lag)
				.to(p, { xPercent: vec[0] * 101, yPercent: vec[1] * 101, duration: half, ease: 'power3.out' }, out)
				.set(p, { autoAlpha: 0 }, out + half);
		});
		extend(a, { post: (colors.length - 1) * 0.07 + 0.05 });
		gsap.set(z.el, { zIndex: 'auto' });
		sound(tl, at - half * 0.9, o.sfx, 'whoosh');
	} else if (type === 'iris') {
		const [x, y] = [o.x ?? C.w / 2, o.y ?? C.h / 2];
		tl.fromTo(z.el, { clipPath: `circle(0% at ${x}px ${y}px)` }, { clipPath: `circle(150% at ${x}px ${y}px)`, duration: dur, ease: o.ease ?? 'power3.inOut' }, at - dur * 0.45);
		extend(z, { pre: dur * 0.45 });
		extend(a, { post: dur * 0.55 });
		sound(tl, at - dur * 0.45, o.sfx, 'swoosh');
	} else if (type === 'push') {
		tl.to(a.el, { x: dx, y: dy, duration: dur, ease: o.ease ?? 'expo.inOut' }, at - dur / 2);
		tl.fromTo(z.el, { x: -dx, y: -dy }, { x: 0, y: 0, duration: dur, ease: o.ease ?? 'expo.inOut' }, at - dur / 2);
		extend(z, { pre: dur / 2 });
		extend(a, { post: dur / 2 });
		sound(tl, at - dur * 0.42, o.sfx, 'whoosh');
	} else if (type === 'zoom') {
		// The camera flies through the outgoing scene into the next one.
		// The outgoing scene stays underneath until the incoming one fills the frame, so no edge shows.
		tl.to(a.el, { scale: o.scale ?? 2.4, filter: 'blur(16px)', duration: dur * 0.8, ease: 'power3.in', transformOrigin: `${o.x ?? C.w / 2}px ${o.y ?? C.h / 2}px` }, at - dur * 0.55);
		tl.fromTo(z.el, { scale: 0.7, autoAlpha: 0 }, { scale: 1, duration: dur * 0.6, ease: 'expo.out' }, at - 0.04).fromTo(z.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: 'none' }, at - 0.04);
		extend(z, { pre: 0.04 });
		extend(a, { post: dur * 0.3 });
		sound(tl, at - dur * 0.5, o.sfx, 'whoosh_up');
	} else if (type === 'whip') {
		// Whip pan: both scenes streak sideways; the motion blur of the final render does the rest.
		tl.to(a.el, { x: dx * 0.9, y: dy * 0.9, filter: 'blur(22px)', duration: dur * 0.5, ease: 'power3.in' }, at - dur * 0.5);
		tl.fromTo(z.el, { x: -dx * 0.9, y: -dy * 0.9, filter: 'blur(22px)' }, { x: 0, y: 0, filter: 'blur(0px)', duration: dur * 0.6, ease: 'expo.out' }, at);
		sound(tl, at - dur * 0.45, o.sfx, 'whoosh');
	} else if (type === 'flash') {
		const p = h(stage, 'wipe', '', { background: o.color ?? '#fff', zIndex: 6 });
		tl.fromTo(p, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 / C.fps, ease: 'none' }, at - 2 / C.fps).to(p, { autoAlpha: 0, duration: dur, ease: 'power2.out' }, at);
		sound(tl, at, o.sfx, 'hit');
	} else if (type === 'fade') {
		tl.fromTo(z.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur, ease: 'power1.inOut' }, at - dur / 2);
		extend(z, { pre: dur / 2 });
		extend(a, { post: dur / 2 });
		sound(tl, at - dur / 2, o.sfx, null);
	} else throw new Error(`transition : type inconnu « ${type} ».`);
}

// ---- Camera ----------------------------------------------------------------------------------
// A world larger than the frame, and a camera that looks at a point of it: camera(el).look(x, y, zoom)
// places it, cam.to(s, at, { x, y, zoom, rot }, dur) moves it. Put the scene's content in cam.world.
export function camera(parent, o = {}) {
	const world = h(parent, 'layer world', '', { transformOrigin: '0 0', width: `${o.w ?? C.w}px`, height: `${o.h ?? C.h}px` });
	const pose = ({ x = C.w / 2, y = C.h / 2, zoom = 1, rot = 0 }) => ({ x: C.w / 2 - x * zoom, y: C.h / 2 - y * zoom, scale: zoom, rotation: rot });
	return {
		world,
		look(x, y, zoom = 1, rot = 0) {
			gsap.set(world, pose({ x, y, zoom, rot }));
			return this;
		},
		to(s, at, target, dur = 1, ease = 'glide') {
			s.to(world, { ...pose(target), duration: dur, ease }, at);
			return this;
		}
	};
}

// ---- Backdrops, texture, particles -----------------------------------------------------------
// Soft colour fields behind a scene. spots: [[x%, y%, colour, size px], …]. Returns the layer.
export function glow(parent, spots, o = {}) {
	const el = h(parent, 'layer glow', '', { filter: `blur(${o.blur ?? 120}px)`, opacity: String(o.opacity ?? 1) });
	for (const [x, y, c, size = 700] of spots) h(el, 'abs', '', { left: `${(x / 100) * C.w - size / 2}px`, top: `${(y / 100) * C.h - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: c });
	return el;
}
// Film grain over a scene or the whole stage: breaks flat digital colour. Seeded, so it never flickers.
export function grain(parent, o = {}) {
	const n = 160;
	const cv = Object.assign(document.createElement('canvas'), { width: n, height: n });
	const ctx = cv.getContext('2d');
	const img = ctx.createImageData(n, n);
	const r = rnd(o.seed ?? 5);
	for (let i = 0; i < n * n; i++) {
		const v = Math.floor(r() * 255);
		img.data.set([v, v, v, 255], i * 4);
	}
	ctx.putImageData(img, 0, 0);
	return h(parent, 'layer grain', '', { backgroundImage: `url(${cv.toDataURL()})`, backgroundSize: `${o.size ?? 240}px`, opacity: String(o.opacity ?? 0.07), mixBlendMode: o.blend ?? 'overlay', zIndex: 9, pointerEvents: 'none' });
}
// Burst of confetti from a point of `parent`. o: n, colors, power, gravity, dur, seed, sfx.
export function burst(s, parent, x, y, at, o = {}) {
	const r = rnd(o.seed ?? 3);
	const n = o.n ?? 26;
	const dur = o.dur ?? 1.4;
	const colors = o.colors ?? ['var(--brand)', 'var(--accent)', 'var(--ink)'];
	const g = o.gravity ?? 2600;
	const st = { p: 0 };
	const bits = Array.from({ length: n }, () => {
		const size = r.range(14, 30);
		const el = h(parent, 'abs bit', '', { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size * r.pick([1, 0.45, 0.45])}px`, background: r.pick(colors), borderRadius: r.pick(['50%', '4px', '4px']), opacity: '0' });
		const ang = r.range(-Math.PI * 0.95, -Math.PI * 0.05);
		const v = r.range(0.45, 1) * (o.power ?? 1500);
		return { el, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, spin: r.range(-720, 720) };
	});
	s.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'none' }, at);
	frame(() => {
		const t = st.p * dur;
		for (const p of bits) {
			const drag = 1 - Math.exp(-2.2 * t);
			p.el.style.opacity = st.p <= 0 || st.p >= 1 ? '0' : String(Math.min(1, (1 - st.p) * 3));
			p.el.style.transform = `translate(${(p.vx * drag) / 2.2}px, ${(p.vy * drag) / 2.2 + 0.5 * g * t * t * 0.35}px) rotate(${p.spin * t}deg)`;
		}
	});
	sound(s, at, o.sfx, 'pop_big', null, { pan: Math.max(-1, Math.min(1, (x / C.w - 0.5) * 1.4)) });
}
// Bars of a small chart growing from the baseline. values 0..1. Returns the bar elements.
export function bars(s, parent, values, at, o = {}) {
	const hgt = o.h ?? 220;
	const wrap = h(parent, 'bars', '', { height: `${hgt}px`, gap: `${o.gap ?? 14}px` });
	const els = values.map((v) => h(wrap, 'bar', '', { height: `${Math.max(0.04, v) * hgt}px`, width: `${o.w ?? 34}px`, background: o.color ?? 'var(--brand)' }));
	s.fromTo(els, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.6, ease: 'swift', stagger: 0.07 }, at);
	// One tick every other bar (3 at most): the bars grow 0.07 s apart, a tick for each would buzz.
	els.forEach((el, i) => i % 2 === 0 && i < 6 && sound(s, at + i * 0.07, o.sfx, 'tick', el, { pitch: 1 + i * 0.08, v: 0.6 }));
	return els;
}
export { b };
