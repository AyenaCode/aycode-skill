// Shared helpers: paths, argument parsing, child processes, logging.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'pub-video');

// Dependencies live in the shared runtime folder, not in the skill or in the project.
export function runtime(name) {
	const pkg = join(DATA, 'package.json');
	if (!existsSync(join(DATA, 'node_modules', name))) fail(`Le runtime du skill n'est pas installé. Lance : bash ${join(SKILL, 'install.sh')}`);
	return createRequire(pkg)(name);
}

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
export const num = (v, d) => (v === undefined || v === true ? d : Number(v));

export function fail(msg) {
	console.error(`pub-video : ${msg}`);
	process.exit(1);
}

// Run a command; resolves with { code, out, err }. `input` is written to stdin when given.
export function run(cmd, args, { input, inherit = false, cwd } = {}) {
	return new Promise((res) => {
		const p = spawn(cmd, args, { cwd, stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'] });
		let out = '';
		let err = '';
		p.stdout?.on('data', (d) => (out += d));
		p.stderr?.on('data', (d) => (err += d));
		p.on('error', (e) => res({ code: 127, out, err: String(e.message) }));
		p.on('close', (code) => res({ code, out, err }));
		if (!inherit) {
			if (input) p.stdin.write(input);
			p.stdin.end();
		}
	});
}
// Same, but binary stdout (for decoded audio).
export function runBuffer(cmd, args) {
	return new Promise((res, rej) => {
		const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		const chunks = [];
		let err = '';
		p.stdout.on('data', (d) => chunks.push(d));
		p.stderr.on('data', (d) => (err += d));
		p.on('error', rej);
		p.on('close', (code) => (code ? rej(new Error(err.trim().split('\n').slice(-3).join('\n'))) : res(Buffer.concat(chunks))));
	});
}
export async function ffmpeg(args, { quiet = true } = {}) {
	const r = await run('ffmpeg', ['-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args]);
	if (r.code) throw new Error(`ffmpeg a échoué :\n${r.err.trim().split('\n').slice(-6).join('\n')}`);
	return r;
}

// A project is the folder that holds videos/. Walk up from the current folder to find it.
function findProject(start = process.cwd()) {
	let d = resolve(start);
	for (;;) {
		if (existsSync(join(d, 'videos')) && existsSync(join(d, 'theme.css'))) return d;
		const up = dirname(d);
		if (up === d) return null;
		d = up;
	}
}
export function projectRoot(start = process.cwd()) {
	return findProject(start) ?? fail('aucun projet ici. Crée-en un avec « pub-video new <dossier> », puis lance la commande depuis ce dossier.');
}
// Where downloaded music and sound effects go: the project, or the current folder outside a project
// (another skill, such as video-verticale, mixes them with pub-video's mixer).
export function assetRoot(start = process.cwd()) {
	return findProject(start) ?? resolve(start);
}
// "vendeur" → { name, file } for videos/vendeur.html.
export function videoFile(root, name) {
	if (!name) fail('donne le nom de la vidéo (le fichier videos/<nom>.html).');
	const n = name.replace(/^videos\//, '').replace(/\.html$/, '');
	const file = join(root, 'videos', `${n}.html`);
	if (!existsSync(file)) fail(`videos/${n}.html n'existe pas dans ${root}.`);
	return { name: n, file };
}
export const fmt = (x, d = 2) => Number(x).toFixed(d);
export const pad = (s, n) => String(s).padEnd(n);

// Optional tools installed on the system. Returns null when absent.
export async function which(cmd) {
	const r = await run('bash', ['-lc', `command -v ${cmd}`]);
	return r.code ? null : r.out.trim().split('\n').pop();
}
export async function findWhisper() {
	const home = homedir();
	const bins = [process.env.WHISPER_CLI, await which('whisper-cli'), join(home, 'whisper.cpp/build/bin/whisper-cli')].filter(Boolean);
	const bin = bins.find((p) => existsSync(p));
	const models = [process.env.WHISPER_MODEL, ...['large-v3-turbo', 'medium', 'small', 'base'].map((m) => join(home, `whisper.cpp/models/ggml-${m}.bin`))].filter(Boolean);
	const model = models.find((p) => existsSync(p));
	return bin && model ? { bin, model } : null;
}
