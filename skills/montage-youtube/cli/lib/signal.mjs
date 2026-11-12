// Speech energy on a 10 ms grid: where the voice is, where the pauses are, where a cut is quietest.
import { readFileSync, writeFileSync } from 'node:fs';

export const HOP = 0.01;

// dB level of each 10 ms frame of a mono signal.
export function energy(x, sr = 16000) {
	const f = Math.round(sr * HOP);
	const n = Math.floor(x.length / f);
	const db = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		for (let k = i * f; k < (i + 1) * f; k++) s += x[k] * x[k];
		db[i] = 10 * Math.log10(s / f + 1e-10);
	}
	return db;
}

// Room noise, voice level, and the threshold between them. Digital silence (a muted stretch, a gap
// between clips) is left out, or the room noise would read as voice.
export function levels(db) {
	let s = Float32Array.from(db.filter((v) => v > -90)).sort();
	if (s.length < 10) s = Float32Array.from(db).sort();
	const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
	const floor = at(0.05);
	const speech = at(0.95);
	return { floor, speech, thr: floor + Math.max(8, 0.3 * (speech - floor)) };
}

// Stretches of voice: frames above the threshold, joined across gaps shorter than minGap, clicks dropped.
export function islands(db, thr, { minGap = 0.2, minLen = 0.08 } = {}) {
	const runs = [];
	let start = -1;
	for (let i = 0; i <= db.length; i++) {
		const on = i < db.length && db[i] > thr;
		if (on && start < 0) start = i;
		if (!on && start >= 0) {
			runs.push([start, i]);
			start = -1;
		}
	}
	const merged = [];
	for (const r of runs) {
		const last = merged.at(-1);
		if (last && (r[0] - last[1]) * HOP < minGap) last[1] = r[1];
		else merged.push([...r]);
	}
	return merged.filter(([a, b]) => (b - a) * HOP >= minLen).map(([a, b]) => ({ a: a * HOP, b: b * HOP }));
}

// Where to cut between a and b: in the quietest dip (energy smoothed over 30 ms). The dip is every frame
// within 3 dB of its lowest point; side 'start' (a kept word follows) cuts at its beginning, side 'end'
// (a kept word ends) at its end, so a soft consonant at the edge of the kept word is not shaved off.
export function quietest(db, a, b, side = 'start') {
	const i0 = Math.max(1, Math.floor(a / HOP));
	const i1 = Math.min(db.length - 2, Math.ceil(b / HOP));
	if (i1 < i0) return (a + b) / 2;
	const sm = (i) => (db[i - 1] + db[i] + db[i + 1]) / 3;
	let best = i0;
	for (let i = i0; i <= i1; i++) if (sm(i) < sm(best)) best = i;
	const low = sm(best) + 3;
	let i = best;
	if (side === 'start') while (i - 1 >= i0 && sm(i - 1) <= low) i--;
	else while (i + 1 <= i1 && sm(i + 1) <= low) i++;
	return (side === 'start' ? i : i + 1) * HOP;
}

export function saveDb(file, db) {
	writeFileSync(file, Buffer.from(db.buffer, db.byteOffset, db.byteLength));
}
export function loadDb(file) {
	const b = readFileSync(file);
	return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

// Seconds of screen movement between a and b, given the frozen stretches.
export function activeTime(frozen, a, b) {
	if (b <= a) return 0;
	let still = 0;
	for (const [p, q] of frozen) still += Math.max(0, Math.min(b, q) - Math.max(a, p));
	return b - a - still;
}

// Moments between a and b when the screen moves, padded so an action is seen from start to end.
export function moving(frozen, a, b, pad = 0.2) {
	const out = [];
	let t = a;
	for (const [p, q] of [...frozen.filter(([, q]) => q > a && q > 0), [b, b]].sort((x, y) => x[0] - y[0])) {
		if (p > t && Math.min(p, b) - t > 0.05) out.push([Math.max(a, t - pad), Math.min(b, p + pad)]);
		t = Math.max(t, q);
		if (t >= b) break;
	}
	const merged = [];
	for (const r of out) {
		const last = merged.at(-1);
		if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
		else merged.push(r);
	}
	return merged;
}
