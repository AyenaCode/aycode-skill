// Sound of one ad: every cue becomes a sound effect, the music is cut and shaped on the timeline,
// an optional voice ducks the rest. Then a master at a fixed gain, so the drop keeps its punch.
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SR, len, reseed, mixInto, norm, lowpass, reverb, resample, decode, writeWav, rmsDb } from './dsp.mjs';
import { FX, GAIN } from './sfx.mjs';
import { ffmpeg, run } from './util.mjs';

const db = (x) => 10 ** (x / 20);

// Real recordings placed in audio/sfx/<type>.wav (or .mp3) replace the synthesised sound of that type.
async function samples(root) {
	const dir = join(root, 'audio', 'sfx');
	const out = {};
	if (!existsSync(dir)) return out;
	for (const f of readdirSync(dir)) {
		const m = /^([a-z_]+)\.(wav|mp3|ogg|m4a)$/i.exec(f);
		if (m) out[m[1]] = norm((await decode(join(dir, f), { mono: true })).L, 0.9);
	}
	return out;
}

// One-pole smoothing of a 0..1 control curve with separate attack and release times.
function smooth(x, attack, release) {
	const a = Math.exp(-1 / (attack * SR));
	const r = Math.exp(-1 / (release * SR));
	let s = 0;
	for (let i = 0; i < x.length; i++) {
		const k = x[i] > s ? a : r;
		s = k * s + (1 - k) * x[i];
		x[i] = s;
	}
	return x;
}

// meta = window.META of the page. voice = [{ file, at, gain? }] clips to lay over the mix (optional).
// Writes render/<name>_music.wav, _sfx.wav, _mix.wav (+ _voice.wav). Returns levels for the report.
export async function buildAudio(root, name, meta, { voice = [], musicGain = 0.8, sfxGain = 1.1, duck = 8 } = {}) {
	reseed(7);
	const N = len(meta.duration);
	const out = join(root, 'render');
	await mkdir(out, { recursive: true });
	const info = { cues: meta.cues.length, unknown: [], replaced: [] };

	// --- Sound effects bus
	const tail = 2 * SR;
	let sL = new Float64Array(N + tail);
	let sR = new Float64Array(N + tail);
	const real = await samples(root);
	info.replaced = Object.keys(real);
	const cache = new Map();
	meta.cues.forEach((c, i) => {
		if (!FX[c.type] && !real[c.type]) return info.unknown.push(c.type);
		const key = `${c.type}|${c.pitch ?? 1}|${c.d ?? ''}`;
		if (!cache.has(key)) cache.set(key, real[c.type] ? resample(real[c.type], c.pitch ?? 1) : FX[c.type](c));
		const g = (GAIN[c.type] ?? 0.45) * (c.v ?? 1);
		// Narrow stereo: an effect follows its element a little, never leaves the centre of a phone speaker.
		const pan = 0.5 + 0.3 * Math.max(-1, Math.min(1, c.pan ?? 0.6 * Math.sin(i * 2.3)));
		mixInto(sL, cache.get(key), len(c.t), g * Math.sqrt(1 - pan));
		mixInto(sR, cache.get(key), len(c.t), g * Math.sqrt(pan));
	});
	sL = reverb(sL).subarray(0, N);
	sR = reverb(sR).subarray(0, N);
	let peak = 0;
	for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(sL[i]), Math.abs(sR[i]));
	info.sfxPeak = peak;
	const k = peak > 0.95 ? 0.95 / peak : 1;
	const end = len(0.25);
	for (let i = 0; i < N; i++) {
		const fade = i >= N - end ? (N - 1 - i) / end : 1;
		sL[i] *= k * fade;
		sR[i] *= k * fade;
	}

	// --- Music bed
	const mL = new Float64Array(N);
	const mR = new Float64Array(N);
	const m = meta.music;
	if (m?.src) {
		const file = resolve(root, 'videos', m.src);
		if (!existsSync(file)) throw new Error(`musique introuvable : ${m.src} (chemin relatif au dossier videos/).`);
		const src = await decode(file, { start: m.start ?? 0, duration: meta.duration + 0.5 });
		mL.set(src.L.subarray(0, N));
		mR.set(src.R.subarray(0, N));
		if (src.L.length < N - SR * 0.1) info.musicShort = src.L.length / SR;
		// Intro held back: muffled and (if asked) lifted, opening up exactly at `until` (the drop).
		if (m.intro?.until > 0) {
			const n = Math.min(N, len(m.intro.until));
			const [f0, f1] = m.intro.lowpass ?? [1500, 12000];
			const fc = new Float64Array(n);
			for (let i = 0; i < n; i++) fc[i] = f0 * (f1 / f0) ** ((i / n) ** 2);
			const lift = db(m.intro.lift ?? 0);
			for (const ch of [mL, mR]) {
				const y = lowpass(ch.subarray(0, n), fc);
				for (let i = 0; i < n; i++) ch[i] = y[i] * lift;
			}
		}
		// A cue with hole: 0.25 gets a breath of silence in the music just before it lands.
		for (const c of meta.cues) {
			if (!c.hole) continue;
			const a = Math.max(0, len(c.t - c.hole));
			const z = Math.min(N, len(c.t));
			for (let i = a; i < z; i++) {
				const g = 1 - 0.95 * ((i - a) / (z - a));
				mL[i] *= g;
				mR[i] *= g;
			}
		}
		const fi = len(m.fadeIn ?? 0.08);
		const fo = len(m.fadeOut ?? 1.2);
		for (let i = 0; i < N; i++) {
			const g = Math.min(1, i / fi) * (i > N - fo ? ((N - i) / fo) ** 1.5 : 1);
			mL[i] *= g;
			mR[i] *= g;
		}
		let mp = 0;
		for (let i = 0; i < N; i++) mp = Math.max(mp, Math.abs(mL[i]), Math.abs(mR[i]));
		const g = ((mp ? 0.6 / mp : 1) * (m.gain ?? 1));
		for (let i = 0; i < N; i++) {
			mL[i] *= g;
			mR[i] *= g;
		}
	}

	// --- Voice-over and ducking
	const vL = new Float64Array(N);
	if (voice.length) {
		for (const clip of voice) mixInto(vL, (await decode(clip.file, { mono: true })).L, len(clip.at), clip.gain ?? 1);
		// Where the voice speaks, the music drops by `duck` dB and the effects by a third of that.
		const gate = new Float64Array(N);
		const w = len(0.03);
		let acc = 0;
		for (let i = 0; i < N; i++) {
			acc += vL[i] * vL[i] - (i >= w ? vL[i - w] * vL[i - w] : 0);
			gate[i] = Math.sqrt(Math.max(0, acc) / w) > db(-42) ? 1 : 0;
		}
		smooth(gate, 0.06, 0.35);
		for (let i = 0; i < N; i++) {
			const gm = db(-duck * gate[i]);
			const gs = db((-duck / 3) * gate[i]);
			mL[i] *= gm;
			mR[i] *= gm;
			sL[i] *= gs;
			sR[i] *= gs;
		}
	}

	const mixL = new Float64Array(N);
	const mixR = new Float64Array(N);
	for (let i = 0; i < N; i++) {
		mixL[i] = mL[i] * musicGain + sL[i] * sfxGain + vL[i];
		mixR[i] = mR[i] * musicGain + sR[i] * sfxGain + vL[i];
	}
	const base = join(out, name);
	await writeWav(`${base}_music.wav`, mL, mR);
	await writeWav(`${base}_sfx.wav`, sL, sR);
	if (voice.length) await writeWav(`${base}_voice.wav`, vL, vL);
	await writeWav(`${base}_mix.wav`, mixL, mixR);
	info.musicDb = m?.src ? rmsDb(mL) + 20 * Math.log10(musicGain) : null;
	info.sfxDb = rmsDb(sL) + 20 * Math.log10(sfxGain);
	info.mix = `${base}_mix.wav`;
	return info;
}

// Integrated loudness (LUFS) and true peak (dBFS) of a file.
export async function loudness(file) {
	const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
	const sum = r.err.slice(r.err.lastIndexOf('Summary:'));
	return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]), lra: Number(/LRA:\s+([\d.]+) LU/.exec(sum)?.[1]) };
}

// One fixed gain to the target loudness, then a peak limiter, then AAC. A fixed gain keeps the intro as
// quiet and the drop as loud as they were mixed; a loudness normaliser would flatten that contrast.
// The limiter runs at 192 kHz so peaks between samples are caught, and the level is measured on the
// encoded file: the gain is corrected until the .m4a itself sits on the target.
export async function master(mix, out, { target = -14, ceiling = -2 } = {}) {
	const before = await loudness(mix);
	if (!Number.isFinite(before.lufs)) throw new Error('le mixage est silencieux : aucun repère son et aucune musique.');
	let gain = Math.min(14, target + 0.6 - before.lufs);
	let after;
	for (let pass = 0; pass < 3; pass++) {
		await ffmpeg(['-i', mix, '-af', `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${db(ceiling).toFixed(3)}:level=disabled:attack=3:release=60,aresample=${SR}`, '-c:a', 'aac', '-b:a', '256k', '-ar', String(SR), '-ac', '2', out]);
		after = await loudness(out);
		const miss = target - after.lufs;
		if (Math.abs(miss) <= 0.3 || gain >= 14) break;
		gain = Math.min(14, gain + miss);
	}
	return { before, gain, after };
}
