// Shared helpers: paths, arguments, child processes, project files, time formats, media probing.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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
	console.error(`video-verticale : ${msg}`);
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

// ---- Project ----
// A project is the folder that holds verticale.json. Walk up from the current folder to find it.
export function findProject(start = process.cwd()) {
	let d = resolve(start);
	for (;;) {
		if (existsSync(join(d, 'verticale.json'))) return d;
		const up = dirname(d);
		if (up === d) return null;
		d = up;
	}
}
export function projectRoot(start = process.cwd()) {
	return findProject(start) ?? fail('aucun projet ici. Crée-en un avec « video-verticale new <dossier> <source> », puis lance la commande depuis ce dossier.');
}
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
export const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 1) + '\n');
export const loadConfig = (root) => readJson(join(root, 'verticale.json'));
export const saveConfig = (root, cfg) => writeJson(join(root, 'verticale.json'), cfg);
export function loadWords(root) {
	const f = join(root, 'work', 'mots.json');
	if (!existsSync(f)) fail('les mots de la vidéo manquent. Lance « video-verticale mots ».');
	return readJson(f);
}

// ---- Time formats ----
const p2 = (n) => String(n).padStart(2, '0');
// 83.4 → "01:23.40"
export function tc(t) {
	const cs = Math.round(Math.max(0, t) * 100);
	return `${p2(Math.floor(cs / 6000))}:${p2(Math.floor((cs % 6000) / 100))}.${p2(cs % 100)}`;
}
export const fmt = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
export function dur(t) {
	const s = Math.round(t);
	return s >= 60 ? `${Math.floor(s / 60)} min ${p2(s % 60)} s` : `${fmt(t)} s`;
}

// ---- Media ----
// Duration, picture size after rotation, frame rate, audio codec of a file.
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
// Output frame rate: the source rate brought to 60 or below, snapped to a standard rate.
const RATES = [[24000, 1001], [24, 1], [25, 1], [30000, 1001], [30, 1], [48, 1], [50, 1], [60000, 1001], [60, 1]];
export function outputRate(fps) {
	let f = fps || 30;
	while (f > 61) f /= 2;
	const [n, d] = RATES.reduce((best, r) => (Math.abs(r[0] / r[1] - f) < Math.abs(best[0] / best[1] - f) ? r : best));
	return `${n}/${d}`;
}
export function rateOf(expr) {
	const [n, d] = String(expr).split('/').map(Number);
	return n / (d || 1);
}
// Integrated loudness and true peak of a file's audio (EBU R128).
export async function loudness(file) {
	const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
	const sum = r.err.slice(r.err.lastIndexOf('Summary:'));
	return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) };
}

// ---- Safe zones (1080 × 1920), the same figures as pub-video's engine ----
// universal: organic TikTok, Reels and Shorts. ads: paid Reels, Meta keeps the bottom 35 % free.
export const ZONES = {
	universal: { top: 270, right: 140, bottom: 480, left: 65 },
	ads: { top: 270, right: 140, bottom: 672, left: 65 }
};
export function zoneOf(cfg) {
	const z = ZONES[cfg.zone] ?? ZONES.universal;
	const k = cfg.sortie.width / 1080;
	return { top: z.top * k, right: z.right * k, bottom: z.bottom * k, left: z.left * k };
}
