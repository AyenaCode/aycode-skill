// Sound of the new video, built with FFmpeg filters so a 10-minute mix stays light in memory:
// - the voice track: each take at its place in its slot, silence elsewhere, to the sample;
// - the sound effects: pub-video's synthesised sounds (or a real file in audio/sfx/) and the inserts' own sound;
// - the music: one or more tracks joined by crossfades, set a fixed number of LU under the voice, and lowered
//   further while the voice speaks by a gain curve computed from the slots (exact, no compressor guesswork);
// - the mix, then pub-video's master to the target loudness.
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pub } from './freres.mjs';
import { ffmpeg, loudness, probe, SR, writeMonoWav } from './util.mjs';

// Sample index of a time, on the same grid for every bus.
const S = (t, rate = SR) => Math.round(t * rate);

// Voice takes laid on the slots → mono WAV at `rate` (48 kHz for the mix, 16 kHz for whisper).
export async function voiceTrack(tl, out, rate = SR) {
	const inputs = [];
	const parts = [];
	const labels = [];
	tl.items.forEach((it, k) => {
		const n = S(it.end, rate) - S(it.start, rate);
		if (it.voice?.file) {
			const i = inputs.push(it.voice.file) - 1;
			const lead = S(it.voice.at, rate) - S(it.start, rate);
			parts.push(`[${i}:a]aformat=sample_rates=${rate}:channel_layouts=mono,adelay=${lead}S:all=1,apad=whole_len=${n},atrim=end_sample=${n},asetpts=PTS-STARTPTS[a${k}]`);
		} else parts.push(`anullsrc=r=${rate}:cl=mono:d=${(n / rate + 0.1).toFixed(3)},atrim=end_sample=${n},asetpts=PTS-STARTPTS[a${k}]`);
		labels.push(`[a${k}]`);
	});
	const graph = `${parts.join(';')};${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`;
	await ffmpeg([...inputs.flatMap((f) => ['-i', f]), '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_s16le', out]);
	return out;
}

// Sound effects bus → stereo WAV, or null when there is none.
export async function sfxBus(root, tl, cfg, work) {
	const cues = tl.sfx;
	if (!cues.length) return null;
	const { FX, GAIN } = await pub.sfx();
	const dir = join(root, 'audio', 'sfx');
	const real = {};
	if (existsSync(dir)) for (const f of readdirSync(dir)) {
		const m = /^([a-z_]+)\.(wav|mp3|ogg|m4a)$/i.exec(f);
		if (m) real[m[1]] = join(dir, f);
	}
	const unknown = [...new Set(cues.filter((c) => c.type && !FX[c.type] && !real[c.type]).map((c) => c.type))];
	if (unknown.length) throw new Error(`bruitage inconnu : ${unknown.join(', ')}. La liste : « pub-video sfx list ».`);
	// One file per sound: a real recording, or pub-video's synthesis written once.
	await mkdir(join(work, 'sfx'), { recursive: true });
	const files = new Map();
	for (const c of cues) {
		const key = c.file ?? c.type;
		if (files.has(key)) continue;
		if (c.file) files.set(key, c.file);
		else if (real[c.type]) files.set(key, real[c.type]);
		else {
			const f = join(work, 'sfx', `${c.type}.wav`);
			writeMonoWav(f, FX[c.type]({ type: c.type, t: 0 }), SR);
			files.set(key, f);
		}
	}
	const keys = [...files.keys()];
	const vol = cfg.bruitages?.volume ?? 1;
	const N = S(tl.duration);
	const parts = [];
	const outs = [];
	keys.forEach((key, i) => {
		const mine = cues.filter((c) => (c.file ?? c.type) === key);
		const split = mine.map((_, j) => `[s${i}_${j}]`);
		parts.push(`[${i}:a]aformat=sample_rates=${SR}:channel_layouts=stereo${mine.length > 1 ? `,asplit=${mine.length}${split.join('')}` : split[0]}`);
		mine.forEach((c, j) => {
			const g = (c.file ? c.gain ?? 1 : (GAIN[c.type] ?? 0.45) * (c.gain ?? 1)) * vol;
			parts.push(`${split[j]}volume=${g.toFixed(3)},adelay=${S(c.t)}S:all=1[x${outs.length}]`);
			outs.push(`[x${outs.length}]`);
		});
	});
	const tail = `apad=whole_len=${N},atrim=end_sample=${N}[out]`;
	parts.push(outs.length > 1 ? `${outs.join('')}amix=inputs=${outs.length}:normalize=0:duration=longest:dropout_transition=0,${tail}` : `${outs[0]}${tail}`);
	const out = join(work, 'bruitages.wav');
	await ffmpeg([...keys.flatMap((k) => ['-i', files.get(k)]), '-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', out]);
	return { file: out, count: cues.length };
}

// Music bed, untouched in level → stereo WAV, or null. Returns where it stops if it is shorter than the video.
export async function musicBus(root, tl, cfg, work) {
	const tracks = cfg.musique ?? [];
	if (!tracks.length) return null;
	const xf = cfg.mixage.fondu_musique ?? 3;
	const N = S(tl.duration);
	const parts = [];
	let length = 0;
	for (const [i, t] of tracks.entries()) {
		const f = resolve(root, t.fichier);
		if (!existsSync(f)) throw new Error(`musique introuvable : ${t.fichier}`);
		const d = (await probe(f)).duration;
		const a = t.debut ?? 0;
		const z = Math.min(d, t.fin ?? d);
		if (z - a <= xf * 2) throw new Error(`le morceau ${t.fichier} est trop court entre ${a} et ${z} s pour un fondu de ${xf} s.`);
		length += z - a - (i ? xf : 0);
		parts.push(`[${i}:a]atrim=start=${a}:end=${z},asetpts=PTS-STARTPTS,aformat=sample_rates=${SR}:channel_layouts=stereo[m${i}]`);
	}
	let last = '[m0]';
	for (let i = 1; i < tracks.length; i++) {
		parts.push(`${last}[m${i}]acrossfade=d=${xf}:c1=tri:c2=tri[c${i}]`);
		last = `[c${i}]`;
	}
	const end = Math.min(length, tl.duration);
	parts.push(`${last}afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, end - 3).toFixed(3)}:d=3,apad=whole_len=${N},atrim=end_sample=${N}[out]`);
	const out = join(work, 'musique.wav');
	await ffmpeg([...tracks.flatMap((t) => ['-i', resolve(root, t.fichier)]), '-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', out]);
	return { file: out, stops: length < tl.duration - 0.5 ? length : null };
}

// Gain curve of the music at 1 kHz: 1 in the pauses, `baisse` dB lower while the voice speaks, with a soft
// attack before each line and a slow release after it (pub-video's 0.06 s / 0.35 s).
export function duckCurve(tl, cfg, out) {
	const R = 1000;
	const n = Math.ceil(tl.duration * R) + 1;
	const gate = new Float64Array(n);
	for (const it of tl.items) {
		if (!it.voice) continue;
		for (let i = Math.max(0, S(it.voice.at, R)); i < Math.min(n, S(it.voice.at + it.voice.dur, R)); i++) gate[i] = 1;
	}
	const a = Math.exp(-1 / (0.06 * R));
	const r = Math.exp(-1 / (0.35 * R));
	const pre = Math.exp(-1 / (0.1 * R));
	// Smooth backwards first (0.1 s) so the music is already low when the first syllable lands, then forwards.
	let s = 0;
	for (let i = n - 1; i >= 0; i--) {
		const k = gate[i] > s ? a : pre;
		s = k * s + (1 - k) * gate[i];
		gate[i] = Math.max(gate[i], s);
	}
	s = 0;
	for (let i = 0; i < n; i++) {
		const k = gate[i] > s ? a : r;
		s = k * s + (1 - k) * gate[i];
		gate[i] = s;
	}
	const baisse = cfg.mixage.baisse ?? 10;
	const g = gate.map((x) => 10 ** ((-baisse * x) / 20));
	writeMonoWav(out, g, R);
	return out;
}

// Voice, music and effects → the master (.m4a at the target loudness). Returns the levels for the report.
export async function mixAll(root, tl, cfg, work) {
	await mkdir(work, { recursive: true });
	const voice = await voiceTrack(tl, join(work, 'voix.wav'));
	const music = await musicBus(root, tl, cfg, work);
	const sfx = await sfxBus(root, tl, cfg, work);
	const vLv = await loudness(voice);
	if (!Number.isFinite(vLv.lufs)) throw new Error('la piste de voix est silencieuse : vérifie les prises (refonte-youtube voix).');
	const inputs = ['-i', voice];
	const parts = ['[0:a]pan=stereo|c0=c0|c1=c0[v]'];
	const bus = ['[v]'];
	let under = null;
	if (music) {
		const mLv = await loudness(music.file);
		under = cfg.mixage.musique_sous_voix ?? 12;
		const gain = Number.isFinite(mLv.lufs) ? vLv.lufs - under - mLv.lufs : 0;
		const curve = duckCurve(tl, cfg, join(work, 'baisse.wav'));
		inputs.push('-i', music.file, '-i', curve);
		parts.push(`[1:a]volume=${gain.toFixed(2)}dB[m0]`, `[2:a]aresample=${SR},pan=stereo|c0=c0|c1=c0[e]`, '[m0][e]amultiply[m]');
		bus.push('[m]');
	}
	if (sfx) {
		inputs.push('-i', sfx.file);
		parts.push(`[${inputs.length / 2 - 1}:a]anull[s]`);
		bus.push('[s]');
	}
	parts.push(bus.length > 1 ? `${bus.join('')}amix=inputs=${bus.length}:normalize=0:duration=first:dropout_transition=0[out]` : '[v]anull[out]');
	const mix = join(work, 'mix.wav');
	await ffmpeg([...inputs, '-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', mix]);
	const { master } = await pub.audio();
	const out = join(work, 'son.m4a');
	const m = await master(mix, out, { target: cfg.mixage.lufs ?? -14, ceiling: -1.5 });
	return { file: out, voice: vLv.lufs, under, baisse: music ? cfg.mixage.baisse ?? 10 : null, musicStops: music?.stops ?? null, sfx: sfx?.count ?? 0, master: m.after };
}
