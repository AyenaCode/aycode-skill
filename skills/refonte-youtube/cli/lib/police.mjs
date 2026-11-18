// police: the font of the burned texts. libass reads TTF/OTF and finds a face by the family name written in
// the file: video-verticale fetches it from Google Fonts and reads that name; here it is recorded in
// refonte.json and checked on a rendered frame.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sampleAss } from './ass.mjs';
import { vv } from './freres.mjs';
import { loadConfig, num, projectRoot, run, saveConfig } from './util.mjs';

export const booleans = ['help'];
const HELP = `refonte-youtube police "<famille>" [--graisse 800]
    Télécharge la police depuis Google Fonts (licences libres) en TTF dans fonts/, l'inscrit dans refonte.json
    (style.police) et vérifie que le rendu l'utilise vraiment. Une graisse épaisse (700 à 900) se lit le mieux.`;

export async function setFont(root, cfg, family, weight) {
	const { download } = await vv.police();
	const f = await download(root, family, weight);
	cfg.style.police = f.name;
	cfg.style.fichier_police = f.file;
	cfg.style.licence_police = f.licence;
	saveConfig(root, cfg);
	return f;
}

// Render one frame of every style and read which face libass picked. A face from outside fonts/ means the
// font was not found and libass fell back on a system font.
export async function checkFont(root, cfg) {
	const st = cfg.style;
	if (!st.police || !st.fichier_police || !existsSync(join(root, st.fichier_police))) return { ok: false, why: 'aucune police dans fonts/ : lance « refonte-youtube police "Montserrat" --graisse 800 ».' };
	const { largeur: W, hauteur: H } = cfg.sortie;
	await mkdir(join(root, 'work'), { recursive: true });
	await writeFile(join(root, 'work', 'police-test.ass'), sampleAss(cfg, W, H));
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-f', 'lavfi', '-i', `color=black:s=${W}x${H}:d=0.1`, '-vf', 'ass=filename=work/police-test.ass:fontsdir=fonts', '-frames:v', '1', '-f', 'null', '-'], { cwd: root });
	const picked = [...r.err.matchAll(/fontselect: \(([^,]+), \d+, \d+\) -> ([^,]+),/g)].map((m) => ({ asked: m[1], file: m[2] }));
	// A face loaded from fonts/ is logged by its PostScript name; a system face by its absolute path.
	const wrong = picked.filter((p) => p.file.startsWith('/'));
	if (r.code) return { ok: false, why: `ffmpeg ne rend pas le texte : ${r.err.trim().split('\n').pop()}` };
	if (wrong.length) return { ok: false, why: `libass n'a pas trouvé « ${st.police} » dans fonts/ et prend ${wrong[0].file}. Relance « refonte-youtube police "<famille>" ».` };
	return { ok: true, picked };
}

export default async function (_cmd, a) {
	if (a.help || !a._[0]) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const f = await setFont(root, cfg, String(a._[0]), num(a.graisse, 800));
	console.log(`Police « ${f.name} » (graisse ${f.weight}) → ${f.file}\n  licence : ${f.licence}`);
	const c = await checkFont(root, cfg);
	console.log(c.ok ? '  OK : le rendu utilise bien cette police.' : `  PROBLÈME : ${c.why}`);
	if (!c.ok) process.exitCode = 1;
}
