// Shared helpers: paths, arguments, child processes, project files, time formats, media probing.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const THREADS = Math.max(1, Math.min(8, cpus().length - 1));
// Sample rate of every sound the skill writes.
export const SR = 48000;

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
	console.error(`refonte-youtube : ${msg}`);
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
// ffmpeg with the given log level; a failure throws with the last lines of its log.
export async function ffmpeg(args, { cwd, level = 'error' } = {}) {
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', level, '-y', ...args], { cwd });
	if (r.code) throw new Error(`ffmpeg a échoué :\n${r.err.trim().split('\n').slice(-6).join('\n')}`);
	return r;
}
export async function which(cmd) {
	const r = await run('bash', ['-lc', `command -v ${cmd}`]);
	return r.code ? null : r.out.trim().split('\n').pop();
}
// Run `jobs` (async functions) with at most `n` at a time, in order of start.
export async function pool(jobs, n = 2) {
	const out = new Array(jobs.length);
	let next = 0;
	const worker = async () => {
		while (next < jobs.length) {
			const i = next++;
			out[i] = await jobs[i]();
		}
	};
	await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, worker));
	return out;
}
export const hash = (v) => createHash('sha1').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 12);

// ---- Project ----
// A project is the folder that holds refonte.json. Walk up from the current folder to find it.
export function findProject(start = process.cwd()) {
	let d = resolve(start);
	for (;;) {
		if (existsSync(join(d, 'refonte.json'))) return d;
		const up = dirname(d);
		if (up === d) return null;
		d = up;
	}
}
export function projectRoot(start = process.cwd()) {
	return findProject(start) ?? fail('aucun projet ici. Crée-en un avec « refonte-youtube new <dossier> <vidéo|lien> », puis lance la commande depuis ce dossier.');
}
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
export const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 1) + '\n');
export const loadConfig = (root) => readJson(join(root, 'refonte.json'));
export const saveConfig = (root, cfg) => writeJson(join(root, 'refonte.json'), cfg);

// ---- Time formats ----
const p2 = (n) => String(n).padStart(2, '0');
// 83.4 → "01:23.4" ; 3723.4 → "1:02:03.4"
export function tc(t, decimals = 1) {
	const k = 10 ** decimals;
	const u = Math.round(Math.max(0, t) * k);
	const s = Math.floor(u / k);
	const frac = decimals ? `.${String(u % k).padStart(decimals, '0')}` : '';
	const h = Math.floor(s / 3600);
	return `${h ? `${h}:${p2(Math.floor(s / 60) % 60)}` : p2(Math.floor(s / 60))}:${p2(s % 60)}${frac}`;
}
// "1:23.4" → 83.4 ; "83,4" → 83.4 ; "1:02:03" → 3723
export function parseTc(s) {
	const parts = String(s).replace(',', '.').split(':');
	if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return NaN;
	return parts.map(Number).reduce((acc, v) => acc * 60 + v, 0);
}
// 83.4 → "00:01:23,400"
export function srtTime(t) {
	const ms = Math.round(Math.max(0, t) * 1000);
	return `${p2(Math.floor(ms / 3600000))}:${p2(Math.floor((ms % 3600000) / 60000))}:${p2(Math.floor((ms % 60000) / 1000))},${String(ms % 1000).padStart(3, '0')}`;
}
// YouTube chapter stamp: 0:00, 4:05, 1:02:03.
export function chapterTime(t) {
	const s = Math.floor(Math.max(0, t));
	const h = Math.floor(s / 3600);
	return h ? `${h}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}` : `${Math.floor(s / 60)}:${p2(s % 60)}`;
}
export const fmt = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
export const pad = (s, n) => String(s).padEnd(n);
export function dur(t) {
	const s = Math.round(t);
	return s >= 60 ? `${Math.floor(s / 60)} min ${p2(s % 60)} s` : `${fmt(t)} s`;
}

// ---- Media ----
// Duration, picture size after rotation, frame rate and audio codec of a file.
export async function probe(file) {
	const r = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate:stream_side_data=rotation:format=duration', '-of', 'json', file]);
	if (r.code) throw new Error(`ffprobe ne lit pas ${file} : ${r.err.trim().split('\n').pop()}`);
	const j = JSON.parse(r.out);
	const v = j.streams.find((s) => s.codec_type === 'video');
	const au = j.streams.find((s) => s.codec_type === 'audio');
	const rate = (s) => {
		const [a, b] = String(s || '0/1').split('/').map(Number);
		return b ? a / b : 0;
	};
	const rot = Math.abs(Number(v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0)) % 180 === 90;
	return {
		duration: Number(j.format.duration),
		width: v ? (rot ? v.height : v.width) : 0,
		height: v ? (rot ? v.width : v.height) : 0,
		fps: v ? rate(v.avg_frame_rate) || rate(v.r_frame_rate) : 0,
		audio: au?.codec_name ?? null
	};
}
// Integrated loudness and true peak of a file's audio (EBU R128).
export async function loudness(file) {
	const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
	const sum = r.err.slice(r.err.lastIndexOf('Summary:'));
	return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) };
}
// 16-bit mono WAV at any sample rate (the ducking curve is written at 1 kHz).
export function writeMonoWav(path, x, rate) {
	const n = x.length;
	const b = Buffer.alloc(44 + n * 2);
	b.write('RIFF', 0);
	b.writeUInt32LE(36 + n * 2, 4);
	b.write('WAVEfmt ', 8);
	b.writeUInt32LE(16, 16);
	b.writeUInt16LE(1, 20);
	b.writeUInt16LE(1, 22);
	b.writeUInt32LE(rate, 24);
	b.writeUInt32LE(rate * 2, 28);
	b.writeUInt16LE(2, 32);
	b.writeUInt16LE(16, 34);
	b.write('data', 36);
	b.writeUInt32LE(n * 2, 40);
	for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
	writeFileSync(path, b);
}

// ---- Text ----
// Word as compared between the script and a transcription: lower case, no accents, no punctuation.
export const bare = (s) =>
	String(s)
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');
export const wordsOf = (text) => String(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
