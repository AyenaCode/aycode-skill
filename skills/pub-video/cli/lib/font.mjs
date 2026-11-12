// font: download a Google Fonts family (open licences) as local woff2 files, with its @font-face rules.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot } from './util.mjs';

export const booleans = ['italic', 'help'];
const HELP = `pub-video font "<famille>" [--weights 200..800 | 400,700,800] [--italic] [--subsets latin,latin-ext] [--dir assets/fonts]
    Télécharge la police depuis Google Fonts (licences libres : OFL, Apache ou UFL) dans assets/fonts/,
    écrit assets/fonts/<famille>.css et l'importe en tête de theme.css.
    Une police variable se demande par plage (200..800) ; sinon donne les graisses séparées par des virgules.`;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function css(family, weights, italic) {
	const axis = italic ? `ital,wght@${weights.split(/[;,]/).map((w) => `1,${w}`).join(';')}` : `wght@${weights.replace(/,/g, ';')}`;
	const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axis}&display=block`;
	const r = await fetch(url, { headers: { 'user-agent': UA } });
	return r.ok ? r.text() : null;
}

export default async function (_cmd, a) {
	if (a.help || !a._[0]) return console.log(HELP);
	const family = a._[0];
	const root = a.dir ? process.cwd() : projectRoot();
	const dir = join(root, String(a.dir ?? 'assets/fonts'));
	const subsets = String(a.subsets ?? 'latin,latin-ext').split(',');
	let weights = a.weights ? String(a.weights) : '200..800';
	let text = await css(family, weights, a.italic);
	if (!text && !a.weights) {
		// Not a variable font (or a narrower range): fall back to the usual static weights.
		for (const w of ['300..800', '400..800', '400..700', '400,500,600,700,800', '400,700', '400']) {
			text = await css(family, w, a.italic);
			if (text) {
				weights = w;
				break;
			}
		}
	}
	if (!text) throw new Error(`Google Fonts ne propose pas « ${family} » avec les graisses ${weights}. Vérifie le nom exact sur fonts.google.com.`);

	await mkdir(dir, { recursive: true });
	const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const blocks = [...text.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*{[^}]+})/g)].filter(([, sub]) => subsets.includes(sub));
	if (!blocks.length) throw new Error(`aucun sous-ensemble ${subsets.join(', ')} pour « ${family} ».`);
	const out = [];
	const seen = new Map();
	for (const [, sub, block] of blocks) {
		const src = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
		if (!src) continue;
		const weight = /font-weight:\s*([^;]+);/.exec(block)[1].trim().replace(/\s+/g, '-');
		const style = /font-style:\s*(\w+)/.exec(block)[1];
		const file = `${slug}-${sub}-${weight}${style === 'italic' ? '-italic' : ''}.woff2`;
		if (!seen.has(src)) {
			const bin = await fetch(src, { headers: { 'user-agent': UA } });
			if (!bin.ok) throw new Error(`téléchargement impossible : ${src}`);
			await writeFile(join(dir, file), Buffer.from(await bin.arrayBuffer()));
			seen.set(src, file);
		}
		out.push(block.replace(/url\(https:[^)]+\)/, `url('${seen.get(src)}')`).replace(/font-display:[^;]+;/, 'font-display: block;'));
	}
	const cssFile = join(dir, `${slug}.css`);
	await writeFile(cssFile, `/* ${family} (${weights}) from Google Fonts. Licence: https://fonts.google.com/specimen/${family.replace(/ /g, '+')}/license */\n${out.join('\n')}\n`);
	console.log(`  ${seen.size} fichier(s) woff2 → ${dir}`);

	const theme = join(root, 'theme.css');
	const rel = `${String(a.dir ?? 'assets/fonts')}/${slug}.css`;
	if (existsSync(theme)) {
		const t = await readFile(theme, 'utf8');
		if (!t.includes(rel)) await writeFile(theme, `@import url('${rel}');\n${t}`);
		console.log(`  importée dans theme.css. Utilise-la avec : --font-display: '${family}';  ou  --font-text: '${family}';`);
	} else console.log(`  feuille de style : ${cssFile}`);
}
