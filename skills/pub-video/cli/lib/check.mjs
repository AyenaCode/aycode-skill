// check: everything a machine can verify before a human looks. Reads the source for forbidden APIs,
// then plays the page at 10 samples a second and measures every text the viewer must read.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot, videoFile, fmt } from './util.mjs';
import { openVideo, launch } from './browser.mjs';
import { serve } from './server.mjs';
import { decodePng } from './png.mjs';

export const booleans = ['help', 'json'];
const HELP = `pub-video check <vidéo> [--json]
    Erreurs (à corriger) et avertissements (à juger) :
      source     API non déterministes, transitions CSS, ressources distantes, animations hors timeline
      structure  trous entre scènes, scènes hors du temps musical, fin vide, repères son
      polices    texte rendu avec une police du système au lieu d'un fichier du projet
      lecture    texte affiché trop peu de temps pour être lu, texte trop petit
      zones      texte à lire hors de la zone sûre de la plateforme
      collisions deux textes l'un sur l'autre
      visibilité texte caché derrière un élément, ou sans contraste avec son fond
      rendu      la même seconde donne une image différente selon le chemin (non déterministe)
    Un élément décoratif (texte de fond, filigrane) s'exclut avec l'attribut data-deco.
    Code de sortie 1 s'il reste des erreurs.`;

// ---- Source lint -------------------------------------------------------------------------------
const BANNED = [
	[/\bMath\.random\s*\(/, 'Math.random() change à chaque chargement : utilise rnd(graine).'],
	[/\bDate\.now\s*\(|\bnew Date\s*\(|\bperformance\.now\s*\(/, 'horloge réelle (Date, performance.now) : le temps vient uniquement de la timeline.'],
	[/\bsetTimeout\s*\(|\bsetInterval\s*\(|\brequestAnimationFrame\s*\(/, 'minuterie (setTimeout, setInterval, requestAnimationFrame) : anime avec la timeline ou frame().'],
	[/\brepeat\s*:\s*-1\b/, 'repeat: -1 : donne un nombre fini de répétitions.'],
	[/(^|[;{\s])transition\s*:|(^|[;{\s])animation\s*:|@keyframes\b/, 'transition ou animation CSS : elles ne sont pas pilotées par la timeline, donc pas rendues.'],
	[/<video\b|<audio\b/, 'balise <video> ou <audio> : non gérée par le rendu.'],
	[/\b(src|href)\s*=\s*["']https?:\/\/|url\(\s*["']?https?:\/\//, 'ressource distante : copie le fichier dans le projet (le rendu doit marcher hors ligne).']
];
const BARE = /(^|[^.\w])gsap\.(to|from|fromTo)\s*\(/;
async function lint(root, name) {
	const out = [];
	for (const rel of [`videos/${name}.html`, 'theme.css']) {
		const file = join(root, rel);
		if (!existsSync(file)) continue;
		const lines = (await readFile(file, 'utf8')).split('\n');
		lines.forEach((line, i) => {
			const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
			for (const [re, msg] of BANNED) if (re.test(code)) out.push({ level: 'error', kind: 'source', msg: `${rel}:${i + 1} ${msg}` });
			if (BARE.test(code)) out.push({ level: 'error', kind: 'source', msg: `${rel}:${i + 1} gsap.${BARE.exec(code)[2]}() nu : il suit l'horloge réelle. Écris s.${BARE.exec(code)[2]}(…) ou tl.${BARE.exec(code)[2]}(…).` });
		});
	}
	return out;
}

// ---- In-page probe -----------------------------------------------------------------------------
// Runs inside the page. Finds the text blocks once, then reports their state at the current frame.
const PROBE = `(() => {
	const stage = document.getElementById('stage');
	document.head.appendChild(document.createElement('style')).textContent = '[data-pv-off], [data-pv-off] * { visibility: hidden !important; }';
	const skip = (el) => el.closest('[data-deco], .guides, #__pv_label, script, style, svg');
	const blocks = [];
	for (const el of stage.querySelectorAll('*')) {
		if (skip(el) || el.parentElement.closest('[data-pv]')) continue;
		let own = el.dataset.read !== undefined;
		if (!own) for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { own = true; break; }
		if (!own) continue;
		el.dataset.pv = blocks.length;
		const text = (el.dataset.read ?? el.textContent).trim().replace(/\\s+/g, ' ');
		const fam = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, '');
		blocks.push({ el, text, fam, device: !!el.closest('.phone, .browser'), scene: el.closest('.scene')?.dataset.scene ?? '' });
	}
	const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
	const alpha = (el) => { let o = 1; for (let n = el; n && n !== stage.parentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
	const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
	window.__pv = {
		blocks: () => blocks.map((b, id) => ({ id, text: b.text, device: b.device, scene: b.scene, fam: b.fam, system: !loaded.has(b.fam) })),
		// One row per block: [x, y, w, h, opacity, share of words shown, font size on screen, line boxes].
		// The box is the one of the visible glyphs (words, or text runs), not of a full-width container: a
		// hidden child (a stamp waiting for its entrance) does not count. The line boxes keep a wrapped run
		// from being taken for one big rectangle.
		state() {
			const seen = (n) => { const c = getComputedStyle(n); return c.visibility !== 'hidden' && alpha(n) >= 0.05; };
			return blocks.map(({ el }) => {
				const box = el.getBoundingClientRect();
				if (!box.width || !box.height) return null;
				const cs = getComputedStyle(el);
				const o = cs.visibility === 'hidden' ? 0 : alpha(el);
				const words = [...el.querySelectorAll('.pv-wd')];
				let shown = 1;
				let rs = [];
				let ls = [];
				if (words.length) {
					const on = words.filter((w) => { const c = getComputedStyle(w); return c.visibility !== 'hidden' && Number(c.opacity) >= 0.6; });
					shown = on.length / words.length;
					rs = (on.length ? on : words).map((w) => w.getBoundingClientRect());
				} else {
					const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
					const range = document.createRange();
					const k = el.offsetWidth ? box.width / el.offsetWidth : 1;
					for (let n = walk.nextNode(); n; n = walk.nextNode()) {
						if (!n.textContent.trim() || (n.parentElement !== el && !seen(n.parentElement))) continue;
						range.selectNodeContents(n);
						// A text rect is as tall as the font's ascent and descent, often taller than the line:
						// cut to the line height, so two lines of one paragraph do not overlap.
						const lh = parseFloat(getComputedStyle(n.parentElement).lineHeight) * k;
						for (const q of range.getClientRects()) {
							if (!q.width || !q.height) continue;
							rs.push(q);
							const hh = lh > 0 && lh < q.height ? lh : q.height;
							ls.push({ left: q.left, top: q.top + (q.height - hh) / 2, width: q.width, height: hh });
						}
					}
					if (!rs.length) rs = [box];
				}
				if (!ls.length) ls = rs;
				const [x0, y0] = [Math.min(...rs.map((q) => q.left)), Math.min(...rs.map((q) => q.top))];
				const r = { left: x0, top: y0, width: Math.max(...rs.map((q) => q.right)) - x0, height: Math.max(...rs.map((q) => q.bottom)) - y0 };
				const scale = el.offsetWidth ? box.width / el.offsetWidth : 1;
				const round = (v) => Math.round(v * 100) / 100;
				return [...[r.left, r.top, r.width, r.height, o, shown, parseFloat(cs.fontSize) * scale].map(round), ls.slice(0, 40).map((q) => [q.left, q.top, q.width, q.height].map(round))];
			});
		},
		// Fingerprint of everything drawn at this frame: two renders of the same second must agree.
		// The second, wider one (text, backgrounds, shadows) only tells whether anything changed since the last
		// frame: a highlighter sweep or a glow that pulses moves no box.
		signature() {
			let s = '';
			let m = '';
			for (const el of stage.querySelectorAll('*')) {
				if (el.closest('.guides, #__pv_label')) continue;
				const r = el.getBoundingClientRect();
				if (!r.width && !r.height) continue;
				const c = getComputedStyle(el);
				s += [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(',') + c.opacity + c.visibility + c.backgroundColor + c.color + c.clipPath + c.filter + '|';
				m += c.transform + c.backgroundSize + c.backgroundPosition + c.boxShadow + c.textShadow + (el.childElementCount ? '' : el.textContent) + '|';
			}
			return [hash(s), hash(s + m)];
		},
		// Share of the block's box whose topmost element belongs to something else (a first, cheap sign of cover).
		covered(id) {
			const el = blocks[id].el;
			const r = el.getBoundingClientRect();
			let n = 0;
			let hit = 0;
			for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) {
				const top = document.elementFromPoint(r.left + r.width * (0.06 + 0.147 * i), r.top + r.height * (0.2 + 0.3 * j));
				if (!top) continue;
				n++;
				if (!el.contains(top) && !top.contains(el)) hit++;
			}
			return n ? hit / n : 0;
		},
		// Hide everything that is neither the block, nor inside it, nor around it (and back).
		alone(id, on) {
			for (let n = blocks[id].el; n && n !== stage; n = n.parentElement) for (const sib of n.parentElement.children) if (sib !== n) on ? sib.setAttribute('data-pv-off', '') : sib.removeAttribute('data-pv-off');
		},
		// Make the glyphs of one block transparent (and back), to see what the block adds to the image.
		ink(id, on) {
			const el = blocks[id].el;
			for (const n of [el, ...el.querySelectorAll('*')]) {
				if (on) { n.style.removeProperty('-webkit-text-fill-color'); n.style.removeProperty('text-shadow'); }
				else { n.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); n.style.setProperty('text-shadow', 'none', 'important'); }
			}
		}
	};
})()`;

const lum = (r, g, b) => {
	const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
// Compare a region with and without a block's glyphs: how much of it is ink, and how well it stands out.
function inkStats(withText, without) {
	const a = decodePng(withText);
	const z = decodePng(without);
	const ratios = [];
	const n = a.w * a.h;
	for (let i = 0; i < n; i++) {
		const p = i * a.ch;
		const d = Math.max(Math.abs(a.data[p] - z.data[p]), Math.abs(a.data[p + 1] - z.data[p + 1]), Math.abs(a.data[p + 2] - z.data[p + 2]));
		if (d < 12) continue;
		const l1 = lum(a.data[p], a.data[p + 1], a.data[p + 2]);
		const l2 = lum(z.data[p], z.data[p + 1], z.data[p + 2]);
		ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
	}
	ratios.sort((p, q) => p - q);
	return { ink: ratios.length / n, pixels: ratios.length, contrast: ratios.length ? ratios[Math.floor(ratios.length * 0.85)] : 1 };
}

const words = (t) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const LEAK = /<\/?[a-z][^>]*>|\b(class|style)=|&(lt|gt|amp|nbsp);|\{\{|\bundefined\b|\bNaN\b|\[object /i;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const { name } = videoFile(root, a._[0]);
	const found = await lint(root, name);
	const add = (level, kind, msg) => found.push({ level, kind, msg });

	const server = await serve(root);
	const browser = await launch();
	const v = await openVideo(root, name, { server, browser });
	const { meta } = v;
	for (const e of new Set([...meta.errors, ...v.problems])) add('error', 'source', e);
	for (const w of meta.warnings) add('warn', 'structure', w);
	await v.page.evaluate(PROBE);
	const blocks = await v.page.evaluate(() => window.__pv.blocks());
	const { w: W, h: H, fps, duration } = meta;
	const safe = { x0: meta.margins.left, y0: meta.margins.top, x1: W - meta.margins.right, y1: H - meta.margins.bottom };

	// ---- Structure
	const beat = 60 / meta.bpm;
	const sc = [...meta.scenes].sort((p, q) => p.start - q.start);
	if (!sc.length) add('error', 'structure', 'aucune scène déclarée.');
	sc.forEach((s, i) => {
		const off = Math.abs(s.start / beat - Math.round(s.start / beat)) * beat;
		if (meta.music && off > 1.5 / fps) add('warn', 'structure', `la scène « ${s.name} » commence à ${fmt(s.start)} s, hors d'un temps de la musique (un temps = ${fmt(beat, 3)} s).`);
		const next = sc[i + 1];
		if (next && next.start - next.pre > s.end + s.post + 1.5 / fps) add('warn', 'structure', `rien à l'écran entre ${fmt(s.end)} s (fin de « ${s.name} ») et ${fmt(next.start)} s (« ${next.name} »).`);
	});
	if (sc.length && sc.at(-1).end < duration - 1.5 / fps) add('warn', 'structure', `la dernière scène finit à ${fmt(sc.at(-1).end)} s, avant la fin de la vidéo (${fmt(duration)} s).`);
	if (sc.length && sc[0].start > 1.5 / fps) add('warn', 'structure', `la première scène commence à ${fmt(sc[0].start)} s : l'image est vide avant.`);
	if (!meta.music?.src) add('warn', 'structure', 'pas de musique déclarée dans setup({ music }).');
	if (!meta.cues.length) add('warn', 'structure', 'aucun repère son : la vidéo n’aura aucun bruitage.');
	const cueTimes = [0, ...meta.cues.map((c) => c.t), duration];
	for (let i = 1; i < cueTimes.length; i++) if (cueTimes[i] - cueTimes[i - 1] > 3) add('info', 'structure', `aucun bruitage entre ${fmt(cueTimes[i - 1], 1)} et ${fmt(cueTimes[i], 1)} s : y a-t-il une action à l'écran sans son ?`);
	// More than 7 sounds within one second blur into noise (the rule is 5 or 6). Sounds less than 30 ms
	// apart are heard as one.
	const ct = [];
	for (const t of meta.cues.map((c) => c.t).sort((p, q) => p - q)) if (!ct.length || t - ct.at(-1) >= 0.03) ct.push(t);
	for (let i = 0, j = 0, until = -1; i < ct.length; i++) {
		while (ct[i] - ct[j] >= 1) j++;
		if (i - j + 1 > 7 && ct[j] > until) {
			let k = i;
			while (k + 1 < ct.length && ct[k + 1] - ct[j] < 1) k++;
			add('warn', 'structure', `${k - j + 1} bruitages entre ${fmt(ct[j], 1)} et ${fmt(ct[j] + 1, 1)} s : au-delà de 6 par seconde, ils se brouillent. Garde un son sur deux (sfx: false sur les autres) ou baisse leur volume.`);
			until = ct[j] + 1;
		}
	}

	// ---- Fonts and leaked markup
	const sys = new Map();
	for (const b of blocks) {
		if (b.system) sys.set(b.fam, (sys.get(b.fam) ?? 0) + 1);
		if (LEAK.test(b.text)) add('error', 'visibilité', `du balisage ou une valeur vide s'affiche à l'écran : « ${b.text.slice(0, 60)} » (scène ${b.scene}).`);
	}
	for (const [fam, n] of sys) add('error', 'polices', `${n} texte(s) en « ${fam} », qui n'est pas un fichier du projet : le rendu dépend des polices de cette machine. Ajoute la police (pub-video font "…") ou corrige --font-display / --font-text / --font-mono.`);

	// ---- Play the timeline at 10 samples per second
	const step = 0.1;
	const times = [];
	for (let t = 0; t < duration - 1e-6; t += step) times.push(Math.round(t * 1000) / 1000);
	const rows = [];
	const sigs = [];
	const moves = [];
	for (const t of times) {
		await v.render(t);
		const [state, [sig, move]] = await v.page.evaluate(() => [window.__pv.state(), window.__pv.signature()]);
		rows.push(state);
		sigs.push(sig);
		moves.push(move);
	}
	// A block reads when it is opaque, most of its words are in, and it sits (almost) fully in the frame.
	const reads = (s) => {
		if (!s || s[4] < 0.6 || s[5] < 0.75) return false;
		const ix = Math.min(W, s[0] + s[2]) - Math.max(0, s[0]);
		const iy = Math.min(H, s[1] + s[3]) - Math.max(0, s[1]);
		return ix > 0 && iy > 0 && (ix * iy) / (s[2] * s[3]) > 0.85;
	};
	// Only inside the block's own scene: before and after, a transition is moving or covering the scene.
	const window_ = new Map(meta.scenes.map((x) => [x.name, x]));
	const live = (b, i) => {
		const w = window_.get(b.scene);
		return (!w || (times[i] >= w.start - 1e-6 && times[i] < w.end - 1e-6)) && reads(rows[i][b.id]);
	};
	const spans = blocks.map((b) => {
		const list = [];
		let cur = null;
		times.forEach((t, i) => {
			if (live(b, i)) cur ? (cur.z = t + step) : list.push((cur = { a: t, z: t + step, i }));
			else cur = null;
		});
		return list;
	});

	for (const b of blocks) {
		const sp = spans[b.id];
		const where = `« ${b.text.slice(0, 48)}${b.text.length > 48 ? '…' : ''} » (${b.scene})`;
		if (!sp.length) {
			if (!b.device) add('warn', 'visibilité', `${where} n'est jamais lisible : jamais affiché, ou toujours transparent.`);
			continue;
		}
		if (b.device) continue; // text inside a device mock-up is part of the picture, not copy to read
		const total = sp.reduce((s, x) => s + x.z - x.a, 0);
		const n = words(b.text);
		if (n) {
			if (total < 0.3 + 0.15 * n) add('error', 'lecture', `${where} reste ${fmt(total, 1)} s à l'écran pour ${n} mot(s) : illisible. Il faut au moins ${fmt(0.5 + 0.25 * n, 1)} s.`);
			else if (total < 0.5 + 0.25 * n) add('warn', 'lecture', `${where} reste ${fmt(total, 1)} s pour ${n} mot(s) : juste. Vise ${fmt(0.5 + 0.25 * n, 1)} s.`);
		}
		// Position and size over the time the block reads. A move through the edge during a transition is
		// fine: only an overflow held for 0.4 s counts.
		const over = [];
		let small = Infinity;
		times.forEach((t, i) => {
			if (!live(b, i)) return;
			const s = rows[i][b.id];
			const sides = [['à gauche', safe.x0 - s[0]], ['à droite', s[0] + s[2] - safe.x1], ['en haut', safe.y0 - s[1]], ['en bas', s[1] + s[3] - safe.y1]].sort((p, q) => q[1] - p[1])[0];
			if (sides[1] > 6) over.push({ t, px: sides[1], side: sides[0] });
			small = Math.min(small, s[6]);
		});
		if (over.length * step >= 0.4) {
			const held = [...over].sort((p, q) => q.px - p.px)[3];
			add(held.px > 40 ? 'error' : 'warn', 'zones', `${where} dépasse la zone sûre de ${Math.round(held.px)} px ${held.side} pendant ${fmt(over.length * step, 1)} s, dès ${fmt(over[0].t, 1)} s (zone « ${meta.safe} » : x ${safe.x0}–${safe.x1}, y ${safe.y0}–${safe.y1}).`);
		}
		const unit = Math.min(W, H) / 1080;
		const minPx = unit * 30;
		if (n && small < minPx) add(small < unit * 22 ? 'error' : 'warn', 'lecture', `${where} fait ${Math.round(small)} px de haut de caractère : trop petit sur un téléphone (minimum ${Math.round(minPx)} px).`);
	}

	// ---- Collisions between two texts
	const hit = new Map();
	times.forEach((t, i) => {
		const on = blocks.filter((b) => !b.device && live(b, i));
		for (let p = 0; p < on.length; p++) {
			for (let q = p + 1; q < on.length; q++) {
				if (on[p].scene !== on[q].scene) continue;
				// Overlap of the line boxes, not of the outer boxes: two runs of one wrapped line touch only at the seam.
				const [s, u] = [rows[i][on[p].id], rows[i][on[q].id]];
				const inter = (m, n) => Math.max(0, Math.min(m[0] + m[2], n[0] + n[2]) - Math.max(m[0], n[0])) * Math.max(0, Math.min(m[1] + m[3], n[1] + n[3]) - Math.max(m[1], n[1]));
				const area = (lines) => lines.reduce((t, m) => t + m[2] * m[3], 0);
				let shared = 0;
				for (const m of s[7]) for (const n of u[7]) shared += inter(m, n);
				if (!shared || shared / Math.min(area(s[7]), area(u[7])) < 0.12) continue;
				const key = `${on[p].id}-${on[q].id}`;
				const e = hit.get(key) ?? { p: on[p], q: on[q], n: 0, at: t };
				e.n++;
				hit.set(key, e);
			}
		}
	});
	for (const e of hit.values()) if (e.n * step >= 0.3) add('error', 'collisions', `« ${e.p.text.slice(0, 32)} » et « ${e.q.text.slice(0, 32)} » se chevauchent pendant ${fmt(e.n * step, 1)} s (dès ${fmt(e.at, 1)} s, scène ${e.p.scene}).`);

	// ---- Visibility and contrast, by removing each block's glyphs at the middle of its longest stay
	for (const b of blocks) {
		if (b.device || !spans[b.id].length) continue;
		const sp = spans[b.id].reduce((p, q) => (q.z - q.a > p.z - p.a ? q : p));
		const t = Math.round((sp.a + 0.5 * (sp.z - sp.a)) * fps) / fps;
		await v.render(t);
		const s = await v.page.evaluate((id) => window.__pv.state()[id], b.id);
		if (!s) continue;
		const region = { x: Math.max(0, Math.floor(s[0])), y: Math.max(0, Math.floor(s[1])) };
		region.width = Math.min(W, Math.ceil(s[0] + s[2])) - region.x;
		region.height = Math.min(H, Math.ceil(s[1] + s[3])) - region.y;
		if (region.width < 4 || region.height < 4) continue;
		const pair = async () => {
			const withText = await v.shot(undefined, region);
			await v.page.evaluate((id) => window.__pv.ink(id, false), b.id);
			const without = await v.shot(undefined, region);
			await v.page.evaluate((id) => window.__pv.ink(id, true), b.id);
			return inkStats(withText, without);
		};
		const st = await pair();
		const where = `« ${b.text.slice(0, 48)} » (${b.scene}, à ${fmt(t, 1)} s)`;
		// Something sits over the block: draw the block alone and count how much of its ink is lost.
		if ((await v.page.evaluate((id) => window.__pv.covered(id), b.id)) > 0) {
			await v.page.evaluate((id) => window.__pv.alone(id, true), b.id);
			const full = await pair();
			await v.page.evaluate((id) => window.__pv.alone(id, false), b.id);
			const lost = full.pixels ? 1 - st.pixels / full.pixels : 0;
			if (lost > 0.15 && st.ink >= 0.004) {
				add(lost > 0.4 ? 'error' : 'warn', 'visibilité', `${where} est caché à ${Math.round(lost * 100)} % par un autre élément.`);
				continue;
			}
		}
		if (st.ink < 0.004) add('error', 'visibilité', `${where} est invisible : caché derrière un autre élément, coupé, ou de la couleur de son fond.`);
		else if (st.contrast < 2) add('error', 'visibilité', `${where} se détache mal de son fond (contraste ${fmt(st.contrast, 1)}:1). Vise 4,5:1, au moins 3:1 pour un gros titre.`);
		else if (st.contrast < 3) add('warn', 'visibilité', `${where} a un contraste faible (${fmt(st.contrast, 1)}:1).`);
	}

	// ---- Still image for too long
	let run = 0;
	for (let i = 1; i <= moves.length; i++) {
		if (i < moves.length && moves[i] === moves[i - 1]) run++;
		else {
			if (run * step >= 1.5) add('info', 'structure', `image entièrement fixe pendant ${fmt(run * step, 1)} s (de ${fmt(times[i - 1 - run], 1)} à ${fmt(times[i - 1], 1)} s).`);
			run = 0;
		}
	}

	// ---- Determinism: jump straight to a few moments in a fresh page and compare with the played pass
	const cold = await openVideo(root, name, { server, browser });
	await cold.page.evaluate(PROBE);
	const picks = [0.13, 0.31, 0.47, 0.62, 0.78, 0.93].map((k) => Math.floor(times.length * k));
	const drift = [];
	for (const i of [...picks].reverse()) {
		await cold.render(times[i]);
		if ((await cold.page.evaluate(() => window.__pv.signature()[0])) !== sigs[i]) drift.push(times[i]);
	}
	await cold.close();
	if (drift.length) add('error', 'rendu', `l'image à ${drift.sort((p, q) => p - q).map((t) => fmt(t, 1)).join(', ')} s dépend du chemin parcouru. Causes habituelles : from() après un to() sur la même propriété (utilise fromTo), état modifié dans un frame() sans être recalculé depuis t.`);

	await v.close();
	await browser.close();
	server.close();

	// ---- Report
	if (a.json) return console.log(JSON.stringify({ video: name, texts: blocks.length, found }));
	const groups = [['error', 'ERREURS (à corriger)'], ['warn', 'AVERTISSEMENTS (à juger)'], ['info', 'À REGARDER']];
	for (const [level, title] of groups) {
		const list = found.filter((f) => f.level === level);
		if (!list.length) continue;
		console.log(`\n${title}`);
		for (const f of list) console.log(`  [${f.kind}] ${f.msg}`);
	}
	const ne = found.filter((f) => f.level === 'error').length;
	const nw = found.filter((f) => f.level === 'warn').length;
	console.log(`\n${blocks.length} textes contrôlés sur ${fmt(duration, 1)} s : ${ne} erreur(s), ${nw} avertissement(s).${ne + nw ? '' : ' Rien à signaler.'}`);
	if (ne) process.exit(1);
}
