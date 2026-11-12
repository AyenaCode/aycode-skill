// Shared helpers: paths, arguments, child processes, project files, time formats, tool discovery.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, homedir } from 'node:os';

export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const THREADS = Math.max(1, Math.min(8, cpus().length - 1));

// Arguments: positionals plus --key value / --flag. Returns { _: [...], key: value }.
export function parseArgs(argv, booleans = []) {
	const out = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const k = a.slice(2);
			const eq = k.indexOf('=');
			if (eq > 0) out[k.slice(0, eq)] = k.slice(eq + 1);
			else if (booleans.includes(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) out[k] = true;
			else out[k] = argv[++i];
		} else out._.push(a);
	}
	return out;
}
export const num = (v, d) => (v === undefined || v === true ? d : Number(String(v).replace(',', '.')));

export function fail(msg) {
	console.error(`montage-youtube : ${msg}`);
	process.exit(1);
}

// Run a command; resolves with { code, out, err }.
export function run(cmd, args, { cwd } = {}) {
	return new Promise((res) => {
		const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		let out = '';
		let err = '';
		p.stdout.on('data', (d) => (out += d));
		p.stderr.on('data', (d) => (err += d));
		p.on('error', (e) => res({ code: 127, out, err: String(e.message) }));
		p.on('close', (code) => res({ code, out, err }));
	});
}
export async function ffmpeg(args) {
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', ...args]);
	if (r.code) throw new Error(`ffmpeg a échoué :\n${r.err.trim().split('\n').slice(-6).join('\n')}`);
	return r;
}
export async function which(cmd) {
	const r = await run('bash', ['-lc', `command -v ${cmd}`]);
	return r.code ? null : r.out.trim().split('\n').pop();
}

// ---- Project ----
// A project is the folder that holds projet.json. Walk up from the current folder to find it.
export function findProject(start = process.cwd()) {
	let d = resolve(start);
	for (;;) {
		if (existsSync(join(d, 'projet.json'))) return d;
		const up = dirname(d);
		if (up === d) return null;
		d = up;
	}
}
export function projectRoot(start = process.cwd()) {
	return findProject(start) ?? fail('aucun projet ici. Crée-en un avec « montage-youtube new <dossier> <rush…> », puis lance la commande depuis ce dossier.');
}
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
export const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 1) + '\n');
export function loadProject(root) {
	return readJson(join(root, 'projet.json'));
}
export function loadAnalysis(root) {
	const f = join(root, 'work', 'analyse.json');
	if (!existsSync(f)) fail('le projet n’est pas encore analysé. Lance « montage-youtube analyse ».');
	return readJson(f);
}

// ---- Time formats ----
const p2 = (n) => String(n).padStart(2, '0');
// 83.4 → "01:23.40" ; 3723.4 → "1:02:03.40"
export function tc(t) {
	const cs = Math.round(Math.max(0, t) * 100);
	const h = Math.floor(cs / 360000);
	const m = Math.floor((cs % 360000) / 6000);
	const s = Math.floor((cs % 6000) / 100);
	const c = cs % 100;
	return `${h ? `${h}:${p2(m)}` : p2(m)}:${p2(s)}.${p2(c)}`;
}
export function parseTc(s) {
	const parts = String(s).replace(',', '.').split(':').map(Number);
	return parts.reduce((acc, v) => acc * 60 + v, 0);
}
// 83.4 → "00:01:23,400"
export function srtTime(t) {
	const ms = Math.round(Math.max(0, t) * 1000);
	return `${p2(Math.floor(ms / 3600000))}:${p2(Math.floor((ms % 3600000) / 60000))}:${p2(Math.floor((ms % 60000) / 1000))},${String(ms % 1000).padStart(3, '0')}`;
}
export const fmt = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
export const pad = (s, n) => String(s).padEnd(n);
export function dur(t) {
	const s = Math.round(t);
	return s >= 60 ? `${Math.floor(s / 60)} min ${p2(s % 60)} s` : `${fmt(t)} s`;
}

// ---- Media ----
// Sound laid on its timestamps from t = 0: a hole is filled with silence and an overlap (two clips joined
// without re-encoding, a dropped buffer) is trimmed, so the sound never drifts from the picture.
export const SYNC = (rate) => `aresample=${rate}:async=1:min_hard_comp=0.01:first_pts=0`;
export const SYNC_VERSION = 1;
// Duration, picture size after rotation, frame rate and audio streams of a file.
export async function probe(file) {
	const r = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=index,codec_type,width,height,avg_frame_rate,r_frame_rate,duration:stream_side_data=rotation:format=duration', '-of', 'json', file]);
	if (r.code) throw new Error(`ffprobe ne lit pas ${file} : ${r.err.trim().split('\n').pop()}`);
	const j = JSON.parse(r.out);
	const v = j.streams.find((s) => s.codec_type === 'video');
	const audio = j.streams.filter((s) => s.codec_type === 'audio').length;
	const rate = (s) => {
		const [a, b] = String(s || '0/1').split('/').map(Number);
		return b ? a / b : 0;
	};
	const rot = Math.abs(Number(v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0)) % 180 === 90;
	const vd = Number(v?.duration);
	return {
		duration: Number(j.format.duration),
		video: Number.isFinite(vd) && vd > 0 ? Math.min(vd, Number(j.format.duration)) : Number(j.format.duration),
		width: v ? (rot ? v.height : v.width) : 0,
		height: v ? (rot ? v.width : v.height) : 0,
		fps: v ? rate(v.avg_frame_rate) || rate(v.r_frame_rate) : 0,
		audio
	};
}
// Output frame rate: the source rate brought to 60 or below, snapped to a standard rate.
const RATES = [[24000, 1001], [24, 1], [25, 1], [30000, 1001], [30, 1], [48, 1], [50, 1], [60000, 1001], [60, 1]];
export function outputRate(fps) {
	let f = fps || 30;
	while (f > 61) f /= 2;
	const [n, d] = RATES.reduce((best, r) => (Math.abs(r[0] / r[1] - f) < Math.abs(best[0] / best[1] - f) ? r : best));
	return { num: n, den: d, fps: n / d, expr: `${n}/${d}` };
}
// Read a 16-bit mono WAV written by ffmpeg into a Float32Array.
export function readWav(file) {
	const b = readFileSync(file);
	let o = 12;
	while (o + 8 <= b.length) {
		const id = b.toString('ascii', o, o + 4);
		const size = b.readUInt32LE(o + 4);
		if (id === 'data') {
			const n = Math.floor(Math.min(size, b.length - o - 8) / 2);
			const x = new Float32Array(n);
			for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
			return x;
		}
		o += 8 + size + (size & 1);
	}
	throw new Error(`WAV illisible : ${file}`);
}
// Integrated loudness and true peak of a file's audio (EBU R128).
export async function loudness(file) {
	const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
	const sum = r.err.slice(r.err.lastIndexOf('Summary:'));
	return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]), lra: Number(/LRA:\s+([\d.]+) LU/.exec(sum)?.[1]) };
}

// ---- whisper.cpp ----
export async function findWhisper() {
	const home = homedir();
	const bins = [process.env.WHISPER_CLI, await which('whisper-cli'), join(home, 'whisper.cpp/build/bin/whisper-cli')].filter(Boolean);
	const bin = bins.find((p) => existsSync(p));
	const names = ['large-v3-turbo', 'large-v3-turbo-q8_0', 'large-v3-turbo-q5_0', 'large-v3', 'medium', 'small', 'base'];
	const dirs = [join(home, 'whisper.cpp/models'), bin ? resolve(dirname(bin), '../../models') : null].filter(Boolean);
	const models = [process.env.WHISPER_MODEL, ...names.flatMap((m) => dirs.map((d) => join(d, `ggml-${m}.bin`)))].filter(Boolean);
	const model = models.find((p) => existsSync(p));
	return bin && model ? { bin, model, dtw: dtwPreset(model) } : null;
}
// Model file → DTW preset name of whisper.cpp ("ggml-large-v3-turbo-q5_0.bin" → "large.v3.turbo").
export function dtwPreset(model) {
	const m = basename(model).replace(/^ggml-/, '').replace(/\.bin$/, '').replace(/-q\d+_\d+$/, '');
	const known = { tiny: 'tiny', 'tiny.en': 'tiny.en', base: 'base', 'base.en': 'base.en', small: 'small', 'small.en': 'small.en', medium: 'medium', 'medium.en': 'medium.en', 'large-v1': 'large.v1', large: 'large.v1', 'large-v2': 'large.v2', 'large-v3': 'large.v3', 'large-v3-turbo': 'large.v3.turbo' };
	return known[m] ?? null;
}
