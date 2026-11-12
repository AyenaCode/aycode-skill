// new: create a project folder for one product's ads.
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SKILL, num } from './util.mjs';

export const booleans = ['help'];
const HELP = `pub-video new <dossier> [--video nom] [--format 9:16|1:1|4:5|16:9] [--bars 15] [--lang fr]
    Crée le projet : theme.css, brief.md, videos/<nom>.html, et les dossiers assets/, captures/, audio/, render/, exports/.
    Relancé dans un projet existant avec --video, ajoute seulement une nouvelle vidéo.`;

export default async function (_cmd, a) {
	if (a.help || !a._[0]) return console.log(HELP);
	const root = resolve(a._[0]);
	const video = String(a.video ?? 'pub');
	for (const d of ['videos', 'assets/fonts', 'assets/img', 'captures', 'audio/music', 'audio/sfx', 'audio/voix', 'render', 'exports']) await mkdir(join(root, d), { recursive: true });
	for (const f of ['theme.css', 'brief.md']) if (!existsSync(join(root, f))) await cp(join(SKILL, 'template', f), join(root, f));
	if (!existsSync(join(root, '.gitignore'))) await writeFile(join(root, '.gitignore'), 'render/\n');
	const file = join(root, 'videos', `${video}.html`);
	if (existsSync(file)) console.log(`  videos/${video}.html existe déjà : laissée telle quelle.`);
	else {
		const tpl = await readFile(join(SKILL, 'template', 'videos', 'video.html'), 'utf8');
		await writeFile(file, tpl.replace('__LANG__', String(a.lang ?? 'fr')).replace('__TITLE__', `${video} · pub`).replace('__FORMAT__', String(a.format ?? '9:16')).replace('__BARS__', String(num(a.bars, 15))));
	}
	console.log(`  projet prêt : ${root}\n  vidéo : videos/${video}.html\n  Lance les commandes pub-video depuis ce dossier.`);
}
