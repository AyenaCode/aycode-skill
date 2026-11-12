// Transcription with whisper.cpp: one entry per word, with its start time and confidence.
import { existsSync } from 'node:fs';
import { findWhisper, readJson, run, THREADS } from './util.mjs';

// DTW timestamps follow the voice closely; without a DTW preset for the model, the token offsets
// are used instead and can be off by a second.
export async function transcribe(wav, outBase, { lang = 'auto', dtw = true } = {}) {
	const wh = await findWhisper();
	if (!wh) throw new Error('whisper.cpp introuvable. Lance « montage-youtube doctor » pour savoir comment l’installer.');
	const useDtw = dtw && !!wh.dtw;
	const args = ['-m', wh.model, '-f', wav, '-l', lang, '-ojf', '-of', outBase, '-np', '-t', String(THREADS)];
	if (useDtw) args.push('-dtw', wh.dtw, '-nfa');
	const r = await run(wh.bin, args);
	if (r.code || !existsSync(`${outBase}.json`)) throw new Error(`whisper.cpp a échoué :\n${r.err.trim().split('\n').slice(-4).join('\n')}`);
	const j = readJson(`${outBase}.json`);
	return { words: parseWords(j, useDtw), lang: j.result?.language ?? lang, model: wh.model, dtw: useDtw };
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
