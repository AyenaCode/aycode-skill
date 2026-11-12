// Small audio toolbox: noise, envelopes, filters, oscillators, FFT, reverb, WAV and ffmpeg I/O.
// Everything works on Float64Array mono signals at 48 kHz.
import { writeFile } from 'node:fs/promises';
import { runBuffer } from './util.mjs';

export const SR = 48000;
export const len = (seconds) => Math.max(0, Math.round(seconds * SR));

// Seeded random numbers, so two builds of the same ad give the same sound.
let seed = 7;
export function reseed(s) {
	seed = s >>> 0;
}
export function rand() {
	seed = (seed + 0x6d2b79f5) >>> 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// White gaussian noise of `seconds`.
export function noise(seconds) {
	const x = new Float64Array(len(seconds));
	for (let i = 0; i < x.length; i += 2) {
		const u = Math.sqrt(-2 * Math.log(rand() || 1e-12));
		const v = 2 * Math.PI * rand();
		x[i] = u * Math.cos(v);
		if (i + 1 < x.length) x[i + 1] = u * Math.sin(v);
	}
	return x;
}
// Fast attack then exponential decay: env(n, attack s, decay s, curve).
export function env(n, a = 0.002, d = 0.2, curve = 4) {
	const e = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		e[i] = Math.min(1, t / Math.max(a, 1e-4)) * Math.exp((-curve * t) / Math.max(d, 1e-4));
	}
	return e;
}
export const mul = (x, y) => x.map((v, i) => v * (typeof y === 'number' ? y : y[i]));
export function add(...xs) {
	const out = new Float64Array(Math.max(...xs.map((x) => x.length)));
	for (const x of xs) for (let i = 0; i < x.length; i++) out[i] += x[i];
	return out;
}
// Mix `src` into `dst` starting at sample `at`.
export function mixInto(dst, src, at = 0, gain = 1) {
	const n = Math.min(src.length, dst.length - at);
	for (let i = Math.max(0, -at); i < n; i++) dst[at + i] += src[i] * gain;
	return dst;
}
export function norm(x, peak = 1) {
	let m = 0;
	for (const v of x) m = Math.max(m, Math.abs(v));
	return m ? x.map((v) => (v / m) * peak) : x;
}
const at = (f, i) => (typeof f === 'number' ? f : f[Math.min(i, f.length - 1)]);
// One-pole low-pass; fc may be an array (moving cutoff).
export function lowpass(x, fc) {
	const y = new Float64Array(x.length);
	let s = 0;
	for (let i = 0; i < x.length; i++) {
		const a = Math.exp((-2 * Math.PI * at(fc, i)) / SR);
		s = (1 - a) * x[i] + a * s;
		y[i] = s;
	}
	return y;
}
// State-variable band-pass; fc may be an array (moving centre).
export function bandpass(x, fc, q = 2) {
	const y = new Float64Array(x.length);
	const damp = 1 / q;
	let lo = 0;
	let bp = 0;
	for (let i = 0; i < x.length; i++) {
		const f = 2 * Math.sin((Math.PI * Math.min(SR / 6, Math.max(20, at(fc, i)))) / SR);
		const hi = x[i] - lo - damp * bp;
		bp += f * hi;
		lo += f * bp;
		y[i] = bp;
	}
	return y;
}
// Frequency curve from f0 to f1 over `seconds` (exponential by default).
export function sweep(f0, f1, seconds, shape = 'exp') {
	const n = len(seconds);
	const f = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const k = n > 1 ? i / (n - 1) : 0;
		f[i] = shape === 'exp' ? f0 * (f1 / f0) ** k : f0 + (f1 - f0) * k;
	}
	return f;
}
export const flat = (f, seconds) => new Float64Array(len(seconds)).fill(f);
// Oscillator following a frequency curve: 'sine' | 'tri' | 'saw'.
export function osc(freq, kind = 'sine') {
	const y = new Float64Array(freq.length);
	let ph = 0;
	for (let i = 0; i < freq.length; i++) {
		ph += (2 * Math.PI * freq[i]) / SR;
		y[i] = kind === 'sine' ? Math.sin(ph) : kind === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : 2 * ((ph / (2 * Math.PI)) % 1) - 1;
	}
	return y;
}

// In-place radix-2 FFT on (re, im). inverse = true gives the inverse transform, scaled.
export function fft(re, im, inverse = false) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			[re[i], re[j]] = [re[j], re[i]];
			[im[i], im[j]] = [im[j], im[i]];
		}
	}
	for (let size = 2; size <= n; size <<= 1) {
		const ang = ((inverse ? 2 : -2) * Math.PI) / size;
		const wr = Math.cos(ang);
		const wi = Math.sin(ang);
		for (let i = 0; i < n; i += size) {
			let cr = 1;
			let ci = 0;
			for (let k = 0; k < size / 2; k++) {
				const a = i + k;
				const z = a + size / 2;
				const tr = re[z] * cr - im[z] * ci;
				const ti = re[z] * ci + im[z] * cr;
				re[z] = re[a] - tr;
				im[z] = im[a] - ti;
				re[a] += tr;
				im[a] += ti;
				[cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
			}
		}
	}
	if (inverse) for (let i = 0; i < n; i++) (re[i] /= n), (im[i] /= n);
}
// Convolve x with an impulse response (same length as x on output).
export function convolve(x, ir) {
	let n = 1;
	while (n < x.length + ir.length) n <<= 1;
	const [ar, ai, br, bi] = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
	ar.set(x);
	br.set(ir);
	fft(ar, ai);
	fft(br, bi);
	for (let i = 0; i < n; i++) {
		const r = ar[i] * br[i] - ai[i] * bi[i];
		ai[i] = ar[i] * bi[i] + ai[i] * br[i];
		ar[i] = r;
	}
	fft(ar, ai, true);
	return ar.slice(0, x.length);
}
// Small room: decaying filtered noise as impulse response, mixed under the dry signal.
export function reverb(x, size = 1.2, mix = 0.18) {
	const n = len(size);
	let ir = noise(size);
	for (let i = 0; i < n; i++) ir[i] *= Math.exp((-6 * i) / n);
	ir = lowpass(ir, 5000);
	let e = 0;
	for (const v of ir) e += v * v;
	e = Math.sqrt(e) || 1;
	const wet = convolve(x, ir.map((v) => v / e));
	return x.map((v, i) => v + wet[i] * mix);
}

// Linear resampling by a speed ratio (pitch change of a sample).
export function resample(x, ratio) {
	if (Math.abs(ratio - 1) < 1e-6) return x;
	const n = Math.floor(x.length / ratio);
	const y = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const p = i * ratio;
		const k = Math.floor(p);
		y[i] = x[k] + (x[Math.min(k + 1, x.length - 1)] - x[k]) * (p - k);
	}
	return y;
}

// Decode any audio file with ffmpeg → { L, R } at 48 kHz. start/duration in seconds are optional.
export async function decode(file, { start, duration, sr = SR, mono = false } = {}) {
	const args = ['-v', 'error', ...(start ? ['-ss', String(start)] : []), ...(duration ? ['-t', String(duration)] : []), '-i', file, '-f', 'f32le', '-ac', mono ? '1' : '2', '-ar', String(sr), '-'];
	const buf = await runBuffer('ffmpeg', args);
	const f = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
	if (mono) return { L: Float64Array.from(f), R: null };
	const n = f.length >> 1;
	const L = new Float64Array(n);
	const R = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		L[i] = f[2 * i];
		R[i] = f[2 * i + 1];
	}
	return { L, R };
}
// 16-bit stereo WAV.
export async function writeWav(path, L, R) {
	const n = L.length;
	const buf = Buffer.alloc(44 + n * 4);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + n * 4, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(2, 22);
	buf.writeUInt32LE(SR, 24);
	buf.writeUInt32LE(SR * 4, 28);
	buf.writeUInt16LE(4, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(n * 4, 40);
	const q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767);
	for (let i = 0; i < n; i++) {
		buf.writeInt16LE(q(L[i]), 44 + i * 4);
		buf.writeInt16LE(q(R[i]), 46 + i * 4);
	}
	await writeFile(path, buf);
}
// RMS level in dBFS of a slice.
export function rmsDb(x, a = 0, z = x.length) {
	let s = 0;
	for (let i = a; i < z; i++) s += x[i] * x[i];
	return 10 * Math.log10(s / Math.max(1, z - a) + 1e-12);
}
