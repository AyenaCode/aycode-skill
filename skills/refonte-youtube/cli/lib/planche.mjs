// planche: look at a stretch of video as a contact sheet of frames with their time — the old video (to choose
// passages), the preview or the final export (to review the result).
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { loadConfig, num, parseTc, probe, projectRoot, run } from './util.mjs';

export const booleans = ['help', 'apercu', 'final'];
const HELP = `refonte-youtube planche [--de 0] [--a <fin>] [--pas 1] [--apercu | --final | --fichier clips/demo.mp4]
    Une image toutes les --pas secondes entre --de et --a (secondes ou 1:12.5), avec son temps, 60 images au plus
    → work/planches/<vidéo>-<de>-<a>.png. Sans option : l'ancienne vidéo ; --apercu : exports/<nom>_apercu.mp4 ;
    --final : exports/<nom>.mp4 ; --fichier : une autre vidéo (un clip). Ouvre ensuite l'image avec l'outil de lecture d'image.`;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const [file, label] = a.final ? [join(root, 'exports', `${cfg.nom}.mp4`), 'final'] : a.apercu ? [join(root, 'exports', `${cfg.nom}_apercu.mp4`), 'apercu'] : a.fichier && a.fichier !== true ? [resolve(root, String(a.fichier)), basename(String(a.fichier)).replace(/\.[^.]+$/, '')] : [cfg.source?.video, 'source'];
	if (!file) throw new Error('ce projet n’a pas d’ancienne vidéo : donne --fichier <vidéo>, --apercu ou --final.');
	if (!existsSync(file)) throw new Error(`${file} n'existe pas encore${a.final ? ' : lance « refonte-youtube build »' : a.apercu ? ' : lance « refonte-youtube apercu »' : ''}.`);
	const length = (await probe(file)).duration;
	const from = a.de !== undefined ? parseTc(a.de) : 0;
	const to = Math.min(length, a.a !== undefined ? parseTc(a.a) : length);
	const step = num(a.pas, 1);
	if (!(from >= 0 && to > from && step > 0)) throw new Error('--de, --a ou --pas illisible.');
	const count = Math.ceil((to - from) / step);
	if (count > 60) throw new Error(`${count} images : 60 au plus. Prends --pas ${Math.ceil(((to - from) / 60) * 10) / 10} ou un passage plus court.`);
	const rows = Math.ceil(count / 6);
	await mkdir(join(root, 'work', 'planches'), { recursive: true });
	const out = join(root, 'work', 'planches', `${label}-${from.toFixed(1)}-${to.toFixed(1)}.png`);
	const vf = `fps=1/${step}:round=up,scale=320:-2,drawtext=text='%{pts\\:hms\\:${from.toFixed(3)}}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=6x${rows}:padding=6:margin=6:color=0x1b1b1f`;
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-ss', from.toFixed(3), '-t', (to - from).toFixed(3), '-i', file, '-vf', vf, '-frames:v', '1', '-update', '1', out]);
	if (r.code) throw new Error(`ffmpeg (planche) a échoué :\n${r.err.trim().split('\n').slice(-4).join('\n')}`);
	console.log(`Planche → ${out}\n  ${count} images de ${from.toFixed(1)} à ${to.toFixed(1)} s, une toutes les ${step} s.`);
}
