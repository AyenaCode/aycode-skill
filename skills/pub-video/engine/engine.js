// Deterministic motion engine. One paused GSAP master timeline holds every animation;
// a frame is render(t): seek the timeline to t seconds, then run the per-frame hooks.
// No wall clock anywhere, so any frame can be rendered alone, in any order, in parallel.
import { gsap } from '/vendor/gsap/index.js';
import { SplitText } from '/vendor/gsap/SplitText.js';
import { CustomEase } from '/vendor/gsap/CustomEase.js';
import { DrawSVGPlugin } from '/vendor/gsap/DrawSVGPlugin.js';
import { MotionPathPlugin } from '/vendor/gsap/MotionPathPlugin.js';
import { MorphSVGPlugin } from '/vendor/gsap/MorphSVGPlugin.js';

gsap.registerPlugin(SplitText, CustomEase, DrawSVGPlugin, MotionPathPlugin, MorphSVGPlugin);
// force3D off: 2D transforms are repainted at their exact scale on every frame (sharp, and the same
// pixels whatever the seek order). lazy off: the DOM is fully written when seek() returns.
gsap.config({ force3D: false });
gsap.defaults({ lazy: false, ease: 'power3.out', duration: 0.5 });
gsap.ticker.lagSmoothing(0);

export { gsap, SplitText, CustomEase };

// ---- Eases by role ---------------------------------------------------------------------------
// Damped spring normalised to settle at 1: damping 0.7 overshoots ~5 % (premium), 0.5 ~16 %, 0.4 ~25 %.
export function spring(damping = 0.7) {
	const w = Math.log(500) / damping;
	const wd = w * Math.sqrt(1 - damping * damping);
	const k = damping / Math.sqrt(1 - damping * damping);
	return (p) => (p >= 1 ? 1 : 1 - Math.exp(-damping * w * p) * (Math.cos(wd * p) + k * Math.sin(wd * p)));
}
CustomEase.create('swift', '0.22,1,0.36,1'); // arrival with a long tail
CustomEase.create('glide', '0.65,0,0.35,1'); // camera moves, anything that starts and stops on screen
CustomEase.create('exit', '0.5,0,0.9,0.4'); // leaving: accelerates away
CustomEase.create('drawer', '0.32,0.72,0,1'); // sheet sliding up
gsap.registerEase('spring', spring(0.7));
gsap.registerEase('springy', spring(0.5));
gsap.registerEase('bouncy', spring(0.4));

// ---- Configuration ---------------------------------------------------------------------------
const SIZES = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] };
// Margins [top, right, bottom, left] in px that app interfaces cover on a vertical 1080 × 1920 frame.
// universal: organic posts on TikTok, Reels, Shorts. ads: Meta's official zone for paid Reels (bottom 35 %).
const SAFE_VERTICAL = { universal: [270, 140, 480, 65], ads: [270, 140, 672, 65], none: [96, 54, 96, 54] };
export const C = { w: 1080, h: 1920, fps: 30, bpm: 120, duration: 30, safe: 'universal', music: null };
const notes = { errors: [], warnings: [] };
const scenes = [];
const hooks = [];
const cues = [];
let master;
let stage;

// Beats → seconds, snapped to the frame grid. Each beat is computed from its index, so nothing drifts.
export const b = (n) => Math.round(((n * 60) / C.bpm) * C.fps) / C.fps;
export const bar = (n) => b(n * 4);
export const f = (n) => n / C.fps;

// Deterministic pseudo-random numbers (Math.random would change on every page load).
export function rnd(seed = 1) {
	let s = seed >>> 0 || 1;
	const r = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	r.range = (a, z) => a + (z - a) * r();
	r.pick = (list) => list[Math.floor(r() * list.length)];
	return r;
}

// Create an element inside a parent: h(parent, 'card', '<b>hi</b>', { left: '90px' }).
export function h(parent, cls = '', html = '', style = {}) {
	const el = document.createElement('div');
	if (cls) el.className = cls;
	if (html) el.innerHTML = html;
	Object.assign(el.style, style);
	parent.appendChild(el);
	return el;
}

// Sound cue at an absolute time. opts: v (volume, 1 = normal), pitch, pan (-1 left … 1 right), d (length).
export function cue(t, type, opts = {}) {
	cues.push({ t: Math.round(t * 1000) / 1000, type, ...opts });
}
// Stereo position of an element from where it sits on the stage.
export function panOf(el) {
	const r = el.getBoundingClientRect();
	const s = stage.getBoundingClientRect();
	const x = (r.left + r.width / 2 - s.left) / (s.width || 1);
	return Math.round(Math.max(-1, Math.min(1, (x - 0.5) * 1.4)) * 100) / 100;
}

// Run fn(t) on every frame, after the timeline: counters, typed text, anything procedural.
export const frame = (fn) => hooks.push(fn);

// ---- Setup -----------------------------------------------------------------------------------
// setup({ format: '9:16', fps: 30, bpm: 120, bars: 15 | duration: 30, safe: 'universal', music: {...} })
export async function setup(o = {}) {
	const q = new URLSearchParams(location.search);
	const size = SIZES[o.format ?? '9:16'] ?? String(o.format).split('x').map(Number);
	C.w = o.w ?? size[0];
	C.h = o.h ?? size[1];
	C.fps = o.fps ?? 30;
	C.bpm = Number(q.get('bpm') ?? o.bpm ?? 120);
	C.duration = o.duration ?? (o.bars ? bar(o.bars) : 30);
	C.safe = o.safe ?? 'universal';
	C.music = o.music ?? null;

	stage = document.getElementById('stage') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'stage' }));
	stage.classList.add('stage');
	const root = document.documentElement;
	root.style.setProperty('--w', `${C.w}px`);
	root.style.setProperty('--h', `${C.h}px`);
	// Vertical story formats get the platform margins; feed and landscape formats a plain 5 %.
	const m = C.h / C.w > 1.6 ? (SAFE_VERTICAL[C.safe] ?? SAFE_VERTICAL.universal).map((v) => Math.round((v * C.w) / 1080)) : [C.h, C.w, C.h, C.w].map((v) => Math.round(v * 0.05));
	C.margins = { top: m[0], right: m[1], bottom: m[2], left: m[3] };
	for (const [k, v] of Object.entries({ t: m[0], r: m[1], b: m[2], l: m[3] })) root.style.setProperty(`--safe-${k}`, `${v}px`);
	if (q.has('guides')) stage.appendChild(Object.assign(document.createElement('div'), { className: 'guides' })).dataset.deco = '1';

	// Load every declared font face before any text is measured or split.
	await Promise.all([...document.fonts].map((face) => face.load().catch(() => notes.errors.push(`police introuvable : ${face.family} ${face.weight}`))));
	await document.fonts.ready;

	master = gsap.timeline({ paused: true, id: 'master' });
	master.cue = cue;
	return { gsap, tl: master, stage, b, bar, f, scene, cue, frame, rnd, h, done, W: C.w, H: C.h, FPS: C.fps, BPM: C.bpm, DURATION: C.duration };
}

// ---- Scenes ----------------------------------------------------------------------------------
// scene('hook', b(0), b(6), (el, s) => { ... }) : el is the scene's layer, s its own timeline whose
// time 0 is the scene start. s.cue(t, type) and s.frame(fn) are the scene-local cue() and frame().
export function scene(name, start, end, build, o = {}) {
	const el = h(stage, 'scene');
	el.dataset.scene = name;
	if (o.z !== undefined) el.style.zIndex = o.z;
	const s = gsap.timeline({ id: name });
	const sc = { name, start, end, el, tl: s, pre: o.pre ?? 0, post: o.post ?? 0, hooks: [], on: true };
	s.el = el;
	s.start = start;
	s.end = end;
	s.dur = end - start;
	s.cue = (t, type, opts) => cue(start + t, type, opts);
	s.frame = (fn) => sc.hooks.push(fn);
	build(el, s, sc);
	master.add(s, start);
	scenes.push(sc);
	return sc;
}
// Keep a scene on screen before its start or after its end (overlapping transitions).
export function extend(sc, { pre = 0, post = 0 } = {}) {
	sc.pre = Math.max(sc.pre, pre);
	sc.post = Math.max(sc.post, post);
}

function render(t) {
	for (const sc of scenes) {
		const on = t >= sc.start - sc.pre - 1e-6 && (t < sc.end + sc.post - 1e-6 || sc.end >= C.duration - 1e-6);
		if (on !== sc.on) {
			sc.el.style.display = on ? 'block' : 'none';
			sc.on = on;
		}
	}
	master.seek(Math.max(0, t), true);
	for (const fn of hooks) fn(t);
	for (const sc of scenes) if (sc.on) for (const fn of sc.hooks) fn(t - sc.start, t);
}

// ---- Finish ----------------------------------------------------------------------------------
async function loadImages() {
	const urls = new Set();
	for (const el of stage.querySelectorAll('*')) {
		const bg = getComputedStyle(el).backgroundImage;
		for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) urls.add(m[1]);
	}
	const imgs = [...stage.querySelectorAll('img')];
	const bad = (src) => notes.errors.push(`image introuvable : ${src.replace(location.origin, '')}`);
	await Promise.all([
		...imgs.map((i) => i.decode().catch(() => bad(i.src))),
		...[...urls].map((u) => {
			const i = new Image();
			i.src = u;
			return i.decode().catch(() => bad(u));
		})
	]);
}

// Call once, after every scene is declared. Exposes render(t) and the metadata the tools read.
export async function done() {
	await loadImages();
	// Initialise every tween once, in timeline order, while every scene is laid out: start values
	// are then fixed for good, and a later seek to any time gives the same frame.
	for (const sc of scenes) sc.el.style.display = 'block';
	master.seek(master.duration(), true);
	master.seek(0, true);

	const stray = gsap.globalTimeline.getChildren(false, true, true).filter((c) => c !== master && c.duration() > 0);
	if (stray.length) notes.errors.push(`${stray.length} animation(s) hors de la timeline maître (gsap.to() nu) : elles suivent l'horloge réelle. Ajoute-les à tl ou à la timeline de la scène.`);
	for (const c of master.getChildren(true, true, true)) if (c.repeat() === -1) notes.errors.push('repeat: -1 trouvé : donne un nombre fini de répétitions.');
	if (master.duration() > C.duration + 1 / C.fps) notes.warnings.push(`des animations finissent à ${master.duration().toFixed(2)} s, après la fin de la vidéo (${C.duration} s).`);
	for (const c of cues) if (c.t >= C.duration || c.t < 0) notes.warnings.push(`repère son « ${c.type} » à ${c.t} s, hors de la vidéo.`);

	window.render = render;
	window.META = {
		engine: 2, w: C.w, h: C.h, fps: C.fps, bpm: C.bpm, duration: C.duration, safe: C.safe, margins: C.margins, music: C.music,
		scenes: scenes.map((s) => ({ name: s.name, start: s.start, end: s.end, pre: s.pre, post: s.post })),
		cues: cues.slice().sort((a, z) => a.t - z.t),
		errors: notes.errors, warnings: notes.warnings
	};
	for (const sc of scenes) sc.on = true;
	render(0);
	window.ready = true;
}
