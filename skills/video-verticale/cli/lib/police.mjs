// police: the caption font. libass reads TTF/OTF (not the WOFF2 of pub-video) and finds a face by the
// family name written inside the file, so the font is fetched as TTF and its name read from the file.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { sampleAss } from './ass.mjs';
import { loadConfig, num, projectRoot, run, saveConfig } from './util.mjs';

export const booleans = ['help'];
const HELP = `video-verticale police "<famille>" [--graisse 900]
    Télécharge la police depuis Google Fonts (licences libres) en TTF dans fonts/, lit son nom interne,
    l'inscrit dans verticale.json (sous_titres.police) et vérifie que le rendu l'utilise vraiment.
    Une graisse épaisse (800 ou 900) se lit le mieux sur un téléphone.`;

// A plain client gets TTF files from the Google Fonts CSS API (a browser gets WOFF2).
const UA = 'video-verticale';

// The asked weight, or the heaviest one below it that the family has (Anton exists only in 400).
export async function download(root, family, asked) {
	let css = null;
	let weight = asked;
	for (const w of [asked, ...[800, 700, 600, 500, 400].filter((x) => x < asked)]) {
		const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${w}`;
		const r = await fetch(url, { headers: { 'user-agent': UA } });
		if (r.ok) {
			[css, weight] = [await r.text(), w];
			break;
		}
	}
	if (!css) throw new Error(`Google Fonts ne propose pas « ${family} » (graisse ${asked} ou moins). Vérifie le nom exact sur fonts.google.com.`);
	const src = /src:\s*url\((https:[^)]+\.(?:ttf|otf))\)/.exec(css)?.[1];
	if (!src) throw new Error(`pas de fichier TTF pour « ${family} » ${weight}.`);
	const bin = await fetch(src, { headers: { 'user-agent': UA } });
	if (!bin.ok) throw new Error(`téléchargement impossible : ${src}`);
	const dir = join(root, 'fonts');
	await mkdir(dir, { recursive: true });
	const file = join(dir, `${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${weight}${src.endsWith('.otf') ? '.otf' : '.ttf'}`);
	await writeFile(file, Buffer.from(await bin.arrayBuffer()));
	const names = fontNames(readFileSync(file));
	// Name ID 1 is the family a non-regular weight is known by ("Montserrat Black"); libass matches it.
	const name = names[1] ?? names[4] ?? family;
	return { name, weight, file: relative(root, file), licence: `https://fonts.google.com/specimen/${family.replace(/ /g, '+')}/license` };
}

// Names of an OpenType font file: { nameID: string }, English Windows names first.
export function fontNames(b) {
	const tables = b.readUInt16BE(4);
	let off = -1;
	for (let i = 0; i < tables; i++) if (b.toString('latin1', 12 + i * 16, 16 + i * 16) === 'name') off = b.readUInt32BE(12 + i * 16 + 8);
	if (off < 0) return {};
	const count = b.readUInt16BE(off + 2);
	const strings = off + b.readUInt16BE(off + 4);
	const out = {};
	const rank = {};
	for (let i = 0; i < count; i++) {
		const r = off + 6 + i * 12;
		const [pid, , lid, nid, len, at] = [0, 2, 4, 6, 8, 10].map((k) => b.readUInt16BE(r + k));
		const raw = b.subarray(strings + at, strings + at + len);
		let s;
		if (pid === 0 || pid === 3) s = Buffer.from(raw).swap16().toString('utf16le');
		else if (pid === 1) s = raw.toString('latin1');
		else continue;
		const score = pid === 3 && lid === 0x409 ? 3 : pid === 3 ? 2 : 1;
		if ((rank[nid] ?? 0) < score) [out[nid], rank[nid]] = [s, score];
	}
	return out;
}

// Render one frame of every caption style and read which face libass picked. A face from outside
// fonts/ means the font was not found and libass fell back on a system font: an error, not a detail.
export async function checkFont(root, cfg) {
	const st = cfg.sous_titres;
	if (!st.police || !st.fichier_police || !existsSync(join(root, st.fichier_police))) return { ok: false, why: 'aucune police dans fonts/ : lance « video-verticale police "Montserrat" --graisse 900 ».' };
	const ass = join(root, 'work', 'police-test.ass');
	await mkdir(join(root, 'work'), { recursive: true });
	await writeFile(ass, sampleAss(cfg));
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-f', 'lavfi', '-i', `color=black:s=${cfg.sortie.width}x${cfg.sortie.height}:d=0.1`, '-vf', 'ass=filename=work/police-test.ass:fontsdir=fonts', '-frames:v', '1', '-f', 'null', '-'], { cwd: root });
	const picked = [...r.err.matchAll(/fontselect: \(([^,]+), \d+, \d+\) -> ([^,]+),/g)].map((m) => ({ asked: m[1], file: m[2] }));
	// A face loaded from fonts/ is logged by its PostScript name; a system face by its absolute path.
	const wrong = picked.filter((p) => p.file.startsWith('/'));
	if (r.code) return { ok: false, why: `le rendu d'essai a échoué : ${r.err.trim().split('\n').pop()}` };
	if (!picked.length) return { ok: false, why: 'libass n’a choisi aucune police (journal vide).' };
	if (wrong.length) return { ok: false, why: `libass a remplacé « ${wrong[0].asked} » par ${wrong[0].file} : le nom ne correspond pas au fichier ${st.fichier_police}.` };
	return { ok: true, picked };
}

export default async function (_cmd, a) {
	if (a.help || !a._[0]) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const f = await download(root, a._[0], num(a.graisse, 900));
	cfg.sous_titres.police = f.name;
	cfg.sous_titres.fichier_police = f.file;
	cfg.sous_titres.licence_police = f.licence;
	saveConfig(root, cfg);
	const c = await checkFont(root, cfg);
	console.log(`${c.ok ? 'OK' : 'PROBLÈME'} police « ${f.name} » (graisse ${f.weight}${f.weight < num(a.graisse, 900) ? ', la plus épaisse de cette famille' : ''}) → ${f.file}`);
	console.log(`  licence : ${f.licence}`);
	if (!c.ok) throw new Error(c.why);
}
