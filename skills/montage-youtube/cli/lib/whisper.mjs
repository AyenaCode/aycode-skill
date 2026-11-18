// Transcription with whisper.cpp: one entry per word, with its start time and confidence.
import { existsSync } from 'node:fs';
import { findWhisper, readJson, readWav, run, THREADS } from './util.mjs';

// DTW timestamps follow the voice closely; without a DTW preset for the model, the token offsets
// are used instead and can be off by a second.
// recale: take off the delay whisper puts on the words, measured on this wav (see lateness); `lag` says how
// much. analyse does not use it: it measures the same delay on its own voice stretches.
export async function transcribe(wav, outBase, { lang = 'auto', dtw = true, recale = false } = {}) {
	const wh = await findWhisper();
	if (!wh) throw new Error('whisper.cpp introuvable. Lance « montage-youtube doctor » pour savoir comment l’installer.');
	const useDtw = dtw && !!wh.dtw;
	const args = ['-m', wh.model, '-f', wav, '-l', lang, '-ojf', '-of', outBase, '-np', '-t', String(THREADS)];
	if (useDtw) args.push('-dtw', wh.dtw, '-nfa');
	const r = await run(wh.bin, args);
	if (r.code || !existsSync(`${outBase}.json`)) throw new Error(`whisper.cpp a échoué :\n${r.err.trim().split('\n').slice(-4).join('\n')}`);
	const j = readJson(`${outBase}.json`);
	let words = parseWords(j, useDtw);
	const lag = recale ? lateness(readWav(wav), words) : 0;
	if (lag) words = words.map((w) => ({ ...w, a: Math.max(0, Math.round((w.a - lag) * 1000) / 1000) }));
	return { words, lang: j.result?.language ?? lang, model: wh.model, dtw: useDtw, lag };
}

// How late whisper dates words, in seconds. A DTW time is the moment the alignment reaches the token, which
// falls after the sound starts: 0.13 to 0.24 s late on six measured voice-overs. Measured as the median gap
// between each restart of the voice after 0.15 s of silence (sound back within 35 dB of the loudest frame)
// and the first word dated near it. 0 when there are fewer than 5 restarts (a voice under music has no
// silence), or when the gap is too small or too large to be this delay. x: mono samples at `rate`.
export function lateness(x, words, { rate = 16000 } = {}) {
	const F = Math.round(rate / 100); // 10 ms frames
	const n = Math.floor(x.length / F);
	const db = new Float32Array(n);
	let peak = -Infinity;
	for (let i = 0; i < n; i++) {
		let e = 0;
		for (let j = i * F; j < (i + 1) * F; j++) e += x[j] * x[j];
		db[i] = 10 * Math.log10(e / F + 1e-12);
		if (db[i] > peak) peak = db[i];
	}
	const floor = peak - 35;
	const gaps = [];
	let quiet = 0;
	for (let i = 0; i < n; i++) {
		if (db[i] <= floor) {
			quiet++;
			continue;
		}
		if (quiet >= 15) {
			const t = i / 100;
			const w = words.find((w) => w.a >= t - 0.15);
			if (w && w.a <= t + 0.6) gaps.push(w.a - t);
		}
		quiet = 0;
	}
	if (gaps.length < 5) return 0;
	gaps.sort((p, q) => p - q);
	const median = gaps[gaps.length >> 1];
	return median >= 0.04 && median <= 0.4 ? Math.round(median * 1000) / 1000 : 0;
}

// Tokens → words. A token that starts with a space starts a word; punctuation sticks to the word before.
export function parseWords(j, useDtw) {
	const words = [];
	let opening = '';
	for (const seg of j.transcription ?? []) {
		let fresh = true;
		for (const tok of seg.tokens ?? []) {
			const text = tok.text ?? '';
			if (!text || text.startsWith('[_')) continue;
			const off = (tok.offsets?.from ?? seg.offsets?.from ?? 0) / 1000;
			const a = useDtw && tok.t_dtw >= 0 ? tok.t_dtw / 100 : off;
			const solid = /[\p{L}\p{N}]/u.test(text);
			const prev = words.at(-1);
			// An opening quote or bracket after a space belongs to the next word.
			if (!solid && /^\s/.test(text) && /^[\s"«“‘'([]+$/.test(text)) {
				opening += text.trim();
				fresh = true;
				continue;
			}
			if (prev && (!solid || (!fresh && !/^\s/.test(text)))) {
				prev.t += text.trim();
				prev.p = Math.min(prev.p, tok.p ?? 1);
			} else if (solid) {
				words.push({ t: opening + text.trim(), a, p: tok.p ?? 1 });
				opening = '';
			}
			fresh = false;
		}
	}
	return words.filter((w) => w.t).sort((x, y) => x.a - y.a);
}
