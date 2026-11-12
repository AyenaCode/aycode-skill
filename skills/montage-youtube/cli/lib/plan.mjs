// plan: turn montage.md into frame-exact segments of the rushes, and say what the cut removes.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dur, fmt, loadAnalysis, loadProject, projectRoot, writeJson } from './util.mjs';
import { HOP, loadDb, moving, quietest } from './signal.mjs';
import { parseMontage } from './montage.mjs';

export const booleans = ['help'];
const HELP = `montage-youtube plan
    Lit montage.md, vérifie chaque ligne, calcule les coupes à l'image près et affiche le bilan :
    durée avant et après, nombre de coupes, temps retiré par sorte de coupe. Écrit work/plan.json.`;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const plan = makePlan(root);
	report(plan);
}

export function makePlan(root) {
	const proj = loadProject(root);
	const an = loadAnalysis(root);
	const file = join(root, 'montage.md');
	if (!existsSync(file)) throw new Error('montage.md manque : lance « montage-youtube analyse ».');
	const dec = parseMontage(readFileSync(file, 'utf8'), an);
	if (dec.errors.length) throw new Error(`montage.md à corriger :\n  ${dec.errors.join('\n  ')}`);

	const R = proj.reglages;
	const mode = R.mode === 'auto' ? an.mode : R.mode;
	const [num, den] = proj.sortie.rate.split('/').map(Number);
	const F = num / den;
	const T0 = R.pause;
	const segments = [];
	const words = [];
	const mutes = [];
	const used = new Set();
	const stats = { phrases: [0, 0], words: [0, 0], pauses: [0, 0], sounds: [0, 0] };

	for (const [k, src] of an.sources.entries()) {
		const db = loadDb(join(root, 'work', `rush-${k + 1}.energie.f32`));
		const flat = [];
		for (const p of an.phrases.filter((q) => q.src === k)) {
			const keep = dec.keep.get(p.id);
			const struck = dec.strike.get(p.id);
			const spoken = p.items.some((it) => it.k === 'mot');
			if (!keep && spoken) {
				stats.phrases[0]++;
				stats.phrases[1] += p.b - p.a;
			}
			p.items.forEach((it, i) => {
				const kept = keep && !struck.has(i);
				if (keep && !kept && it.k === 'mot') {
					stats.words[0]++;
					stats.words[1] += it.b - it.a;
				}
				flat.push({ it, p, kept });
			});
		}
		// Runs of consecutive kept items, one phrase at most: the pauses between phrases are decided below.
		const runs = [];
		flat.forEach((f, i) => {
			if (!f.kept) return;
			const r = runs.at(-1);
			if (r && r.last === i - 1 && flat[r.last].p === f.p) r.last = i;
			else runs.push({ first: i, last: i });
		});
		if (!runs.length) continue;
		for (const r of runs) {
			r.a = flat[r.first].it.a;
			r.b = flat[r.last].it.b;
			r.head = r.a;
			r.tail = r.b;
		}
		// What stays between two runs: a pause shortened to its target, or a little air around removed speech.
		// A gap that holds only sounds without words ("(euh?)", "(son)") is a pause too: its sounds are muted
		// wherever the picture is kept. In screen mode, a long pause also keeps the moments the screen moves.
		const ps = an.phrases.filter((q) => q.src === k);
		for (let i = 0; i + 1 < runs.length; i++) {
			const r1 = runs[i];
			const r2 = runs[i + 1];
			const removed = flat.slice(r1.last + 1, r2.first);
			// Every ⏸ line inside the gap counts: « → garder » wins, else the longest « → x s ».
			const ids = ps.slice(ps.indexOf(flat[r1.last].p), ps.indexOf(flat[r2.first].p)).map((q) => q.id);
			ids.forEach((id) => used.add(id));
			const overs = ids.map((id) => dec.pause.get(id)).filter((v) => v !== undefined);
			const over = overs.includes('garder') ? 'garder' : overs.length ? Math.max(...overs) : undefined;
			if (removed.every((f) => f.it.k === 'son')) {
				const g = r2.a - r1.b;
				let T = g;
				let motion = [];
				if (typeof over === 'number') T = over;
				else if (over !== 'garder' && g > R.pauseMax) {
					T = T0;
					if (mode === 'ecran') motion = moving(src.frozen, r1.b + T * 0.55, r2.a - T * 0.45);
				}
				const keptTime = T + motion.reduce((sum, [x, y]) => sum + y - x, 0);
				if (keptTime >= g - 0.05) r1.join = true;
				else {
					r1.tail = r1.b + T * 0.55;
					r2.head = r2.a - T * 0.45;
					r1.extra = motion;
					stats.pauses[0]++;
					stats.pauses[1] += g - keptTime;
				}
			} else {
				// Removed speech goes; the silence kept around it follows the pause setting (or the ⏸ line).
				const air = over === 'garder' ? Infinity : typeof over === 'number' ? over : T0;
				const ra = removed[0].it.a;
				const rb = removed.at(-1).it.b;
				const room1 = ra - r1.b;
				const room2 = r2.a - rb;
				r1.tail = room1 < 0.1 ? dip(db, r1.b, 'end') : r1.b + Math.min(air * 0.55, room1 - 0.03);
				r2.head = room2 < 0.1 ? dip(db, r2.a, 'start') : r2.a - Math.min(air * 0.45, room2 - 0.03);
				if (r2.head <= r1.tail + 1 / F) r1.join = true;
			}
		}
		// Ranges in frames, then segments.
		const ranges = [];
		let start = Math.max(0, runs[0].a - 0.15);
		for (const [i, r] of runs.entries()) {
			if (i === runs.length - 1) ranges.push([start, Math.min(src.video ?? src.duration, r.b + 0.3)]);
			else if (!r.join) {
				ranges.push([start, r.tail], ...(r.extra ?? []));
				start = runs[i + 1].head;
			}
		}
		// Rounded to the frame grid outwards: a kept range never loses the edge of a word to rounding.
		for (const [x, y] of ranges) {
			const f0 = Math.floor((x * num) / den + 1e-6);
			const f1 = Math.min(Math.ceil((y * num) / den - 1e-6), Math.floor(((src.video ?? src.duration) * num) / den));
			const prev = segments.at(-1);
			if (prev && prev.src === k && f0 <= prev.f1) prev.f1 = Math.max(prev.f1, f1);
			else if (f1 - f0 >= 2) segments.push({ src: k, f0, f1 });
		}
		// Removed sounds that still fall inside what is kept are muted; the others are cut.
		for (const f of flat) {
			if (f.kept || f.it.k !== 'son') continue;
			let inside = false;
			for (const [x, y] of ranges) {
				const a = Math.max(x, f.it.a - 0.03);
				const b = Math.min(y, f.it.b + 0.03);
				if (b - a > 0.02) {
					mutes.push({ src: k, a: Math.round(a * 1000) / 1000, b: Math.round(b * 1000) / 1000 });
					inside = true;
				}
			}
			if (!inside) {
				stats.sounds[0]++;
				stats.sounds[1] += f.it.b - f.it.a;
			}
		}
		// Kept words on the output timeline (for subtitles and the check).
		for (const f of flat) if (f.kept && f.it.k !== 'son') words.push({ src: k, t: f.it.t, a: f.it.a, b: f.it.b, voix: f.it.k === 'voix' });
	}
	if (!segments.length) throw new Error('montage.md ne garde aucune phrase.');

	let o = 0;
	for (const s of segments) {
		s.a = (s.f0 * den) / num;
		s.b = (s.f1 * den) / num;
		s.o = (o * den) / num;
		o += s.f1 - s.f0;
	}
	const frames = o;
	const mapped = [];
	for (const w of words) {
		const s = segments.find((g) => g.src === w.src && w.a >= g.a - 0.1 && w.a < g.b);
		if (!s) continue;
		const a2 = s.o + Math.max(0, w.a - s.a);
		mapped.push({ t: w.t, a: Math.round(a2 * 1000) / 1000, b: Math.round((s.o + Math.min(w.b, s.b) - s.a) * 1000) / 1000, voix: w.voix });
	}
	const voices = mapped.filter((w) => w.voix).map(({ a, b }) => ({ a, b }));
	const warnings = [...dec.pause.keys()].filter((id) => !used.has(id)).map((id) => `« → » de la pause après ${id} sans effet : aucune phrase gardée de part et d’autre de cette pause.`);
	const plan = {
		rate: proj.sortie.rate,
		frames,
		duration: (frames * den) / num,
		source: an.sources.reduce((s, x) => s + x.duration, 0),
		mode,
		segments,
		cuts: segments.slice(1).map((s) => s.o),
		words: mapped.filter((w) => !w.voix).map(({ t, a, b }) => ({ t, a, b })),
		voices,
		mutes,
		warnings,
		stats
	};
	writeJson(join(root, 'work', 'plan.json'), plan);
	return plan;
}

// Cut point near t inside continuous speech: the dip around the word boundary, looked for a little wider
// when the near window holds no real dip (6 dB under the voice around it).
function dip(db, t, side) {
	const depth = (a, b, x) => {
		let peak = -Infinity;
		for (let i = Math.floor(a / HOP); i <= Math.ceil(b / HOP) && i < db.length; i++) peak = Math.max(peak, db[i] ?? -Infinity);
		return peak - (db[Math.round(x / HOP)] ?? peak);
	};
	const near = quietest(db, t - 0.12, t + 0.1, side);
	if (depth(t - 0.12, t + 0.1, near) >= 6) return near;
	return quietest(db, t - 0.3, t + 0.2, side);
}

export function report(plan) {
	const s = plan.stats;
	const removed = plan.source - plan.duration;
	console.log(`Montage : ${dur(plan.source)} → ${dur(plan.duration)} (−${Math.round((100 * removed) / plan.source)} %), ${plan.cuts.length} coupes, mode ${plan.mode === 'ecran' ? 'écran' : 'visage'}`);
	console.log(`  phrases coupées      ${String(s.phrases[0]).padStart(4)}   ${dur(s.phrases[1])}`);
	console.log(`  mots coupés          ${String(s.words[0]).padStart(4)}   ${dur(s.words[1])}`);
	console.log(`  hésitations coupées  ${String(s.sounds[0]).padStart(4)}   ${dur(s.sounds[1])}`);
	console.log(`  pauses raccourcies   ${String(s.pauses[0]).padStart(4)}   ${dur(s.pauses[1])}`);
	const other = removed - s.phrases[1] - s.words[1] - s.sounds[1] - s.pauses[1];
	if (other > 0.5) console.log(`  silences de début, de fin et autour des coupes : ${dur(other)}`);
	if (plan.mutes.length) console.log(`  ${plan.mutes.length} hésitations rendues muettes là où l’image est gardée`);
	console.log(`  ${plan.words.length} mots gardés · ${fmt((plan.words.length / plan.duration) * 60, 0)} mots par minute en moyenne`);
	for (const w of plan.warnings ?? []) console.log(`  attention : ${w}`);
}
