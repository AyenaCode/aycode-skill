// new: create a remake project from an old video (file or link). Downloads it if needed, transcribes it with
// its timecodes, finds its shot changes and draws its contact sheets, so the new script can be written
// against what the old video says and shows.
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { montage } from './freres.mjs';
import { setFont } from './police.mjs';
import { dur, ffmpeg, num, parseTc, probe, run, saveConfig, SKILL, tc, which, writeJson } from './util.mjs';

export const booleans = ['help'];
const HELP = `refonte-youtube new <dossier> <vidéo | lien> [--lang fr] [--duree 10:00] [--pas 5] [--cookies cookies.txt]
refonte-youtube new <dossier> --sujet "<titre>" [--lang fr] [--duree 10:00]
    Crée le projet. Avec --sujet : une vidéo nouvelle, sans ancienne vidéo ; ses images viennent de captures,
    de clips et de séquences animées (voir references/images.md). Sinon, l'ancienne vidéo : un lien est téléchargé
    avec yt-dlp (1080p au plus) dans source/ ; un fichier est lu sur place, jamais modifié. Puis :
    - transcrit l'ancienne vidéo (whisper.cpp) → source.md, phrase par phrase avec ses temps ;
    - repère les changements de plan → marqués dans source.md ;
    - dessine les planches (une image toutes les --pas secondes) → work/planches/planche-01.png… ;
    - écrit refonte.json, brief.md, script.md, et télécharge la police par défaut (Montserrat).
    --duree : durée visée de la nouvelle vidéo (sinon celle de l'ancienne).`;

// Words → sentences: a new one after a final punctuation, a pause of 0.9 s, or 30 words.
function sentences(words, end) {
	const out = [];
	let cur = [];
	words.forEach((w, i) => {
		cur.push(w);
		const next = words[i + 1];
		if (!next || /[.!?…]$/.test(w.t) || next.a - w.a > 0.9 + 0.08 * w.t.length || cur.length >= 30) {
			out.push({ a: cur[0].a, z: next ? next.a : Math.min(end, w.a + 0.6), text: cur.map((x) => x.t).join(' ') });
			cur = [];
		}
	});
	return out;
}

export default async function (_cmd, a) {
	const sujet = a.sujet && a.sujet !== true ? String(a.sujet) : null;
	if (a.help || !a._[0] || (!a._[1] && !sujet)) return console.log(HELP);
	const root = resolve(a._[0]);
	const given = a._[1];
	if (existsSync(join(root, 'refonte.json'))) throw new Error(`${root} contient déjà un projet : lance les commandes suivantes depuis ce dossier.`);
	for (const d of ['source', 'work/planches', 'voix', 'motion', 'images', 'clips', 'fonts', 'audio/music', 'audio/sfx', 'exports']) await mkdir(join(root, d), { recursive: true });
	if (!given) return fresh(root, sujet, a);

	// 1. The old video.
	let video;
	if (/^https?:\/\//i.test(given)) {
		if (!(await which('yt-dlp'))) throw new Error('yt-dlp manque pour télécharger le lien. Installe-le (https://github.com/yt-dlp/yt-dlp) ou donne le fichier vidéo.');
		console.log('Téléchargement de l’ancienne vidéo (yt-dlp)…');
		const cookies = a.cookies && a.cookies !== true ? ['--cookies', resolve(String(a.cookies))] : [];
		const r = await run('yt-dlp', ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--merge-output-format', 'mp4', '--no-playlist', ...cookies, '-o', join(root, 'source', '%(id)s.%(ext)s'), '--print', 'after_move:filepath', '--no-simulate', given]);
		if (r.code) throw new Error(`yt-dlp a échoué : ${r.err.trim().split('\n').pop()}${cookies.length ? '' : ' (vidéo privée ou réservée ? donne --cookies <fichier>)'}`);
		video = r.out.trim().split('\n').pop();
	} else {
		video = resolve(given);
		if (!existsSync(video)) throw new Error(`vidéo introuvable : ${given}`);
	}
	const src = await probe(video);
	if (!src.width) throw new Error(`${video} ne contient pas d'image.`);
	console.log(`Ancienne vidéo : ${dur(src.duration)}, ${src.width}×${src.height}, ${src.fps.toFixed(2)} i/s${src.audio ? '' : ', SANS SON'}`);

	const lang = String(a.lang && a.lang !== true ? a.lang : 'auto');
	const nom = root.split('/').pop().replace(/-refonte$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'video';
	const cfg = defaults(nom, lang, a.duree ? parseTc(a.duree) : Math.round(src.duration), { video, url: video === resolve(given) ? null : given, duree: src.duration, largeur: src.width, hauteur: src.height, fps: src.fps });
	if (!Number.isFinite(cfg.duree_visee)) throw new Error('--duree illisible : écris 10:00 ou 600.');
	saveConfig(root, cfg);

	// 2. Transcription with timecodes.
	let words = [];
	if (src.audio) {
		console.log('Transcription (whisper.cpp)… plusieurs minutes pour une vidéo longue.');
		await ffmpeg(['-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', join(root, 'work', 'source-16k.wav')]);
		const { transcribe } = await montage.whisper();
		const t = await transcribe(join(root, 'work', 'source-16k.wav'), join(root, 'work', 'source'), { lang });
		words = t.words;
		if (lang === 'auto' && t.lang) cfg.langue = t.lang;
		saveConfig(root, cfg);
		writeJson(join(root, 'work', 'source-mots.json'), { words, lang: t.lang, model: t.model });
	}

	// 3. Shot changes and contact sheets, in one pass over a small copy of the picture.
	const pas = Math.max(1, num(a.pas, src.duration > 300 ? 5 : 2));
	console.log('Planches et changements de plan…');
	const graph = [
		'[0:v]fps=4,scale=320:-2,split=2[x][y]',
		"[x]select='gt(scene,0.3)',showinfo,nullsink",
		`[y]fps=1/${pas}:round=up,drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=6x5:padding=6:margin=6:color=0x1b1b1f[pl]`
	].join(';');
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', video, '-filter_complex', graph, '-map', '[pl]', '-fps_mode', 'passthrough', join(root, 'work', 'planches', 'planche-%02d.png')]);
	if (r.code) throw new Error(`ffmpeg (planches) a échoué :\n${r.err.trim().split('\n').slice(-4).join('\n')}`);
	const cuts = [...r.err.matchAll(/Parsed_showinfo.*?pts_time:\s*([\d.]+)/g)].map((m) => Number(m[1]));
	const sheets = readdirSync(join(root, 'work', 'planches')).filter((f) => /^planche-\d+\.png$/.test(f)).sort();

	// 4. source.md: what the old video says, sentence by sentence, with its shot changes.
	const per = 30 * pas;
	const body = [];
	const marks = [...cuts];
	for (const s of sentences(words, src.duration)) {
		while (marks.length && marks[0] <= s.a) body.push(`      ✂ plan ${tc(marks.shift())}`);
		body.push(`[${tc(s.a)} → ${tc(s.z)}] ${s.text}`);
	}
	for (const m of marks) body.push(`      ✂ plan ${tc(m)}`);
	const md = [
		'# L’ancienne vidéo',
		'',
		`- Fichier : ${video}${cfg.source.url ? ` (téléchargé depuis ${cfg.source.url})` : ''}`,
		`- Durée : ${dur(src.duration)} · ${src.width}×${src.height} · ${src.fps.toFixed(2)} i/s · langue ${cfg.langue}`,
		`- Changements de plan repérés : ${cuts.length}`,
		`- Planches (une image toutes les ${pas} s) :`,
		...sheets.map((f, i) => `  - work/planches/${f} : ${tc(i * per, 0)} → ${tc(Math.min(src.duration, (i + 1) * per), 0)}`),
		'',
		'Pour voir un passage de près : `refonte-youtube planche --de 1:12 --a 1:40 --pas 1`.',
		'',
		'## Transcription',
		'',
		'Écrite par la machine : les noms propres et les termes techniques sont à vérifier.',
		'',
		...(words.length ? body : ['(pas de son dans la vidéo, ou rien de dit)']),
		''
	].join('\n');
	await writeFile(join(root, 'source.md'), md);

	// 5. Memory, script, font.
	const fill = (s) => s.replaceAll('__NOM__', nom).replaceAll('__SOURCE__', cfg.source.url ?? video).replaceAll('__DUREE__', dur(src.duration)).replaceAll('__VISEE__', dur(cfg.duree_visee));
	await writeFile(join(root, 'brief.md'), fill(await readFile(join(SKILL, 'template', 'brief.md'), 'utf8')));
	await writeFile(join(root, 'script.md'), fill(await readFile(join(SKILL, 'template', 'script.md'), 'utf8')));
	try {
		const f = await setFont(root, cfg, 'Montserrat', 800);
		console.log(`Police : ${f.name} → ${f.file}`);
	} catch (e) {
		console.log(`Police non téléchargée (${e.message}). Plus tard : « refonte-youtube police "Montserrat" ».`);
	}

	console.log(`\nProjet créé : ${root}`);
	console.log(`  source.md : ${words.length ? `${sentences(words, src.duration).length} phrases transcrites` : 'sans transcription'}, ${cuts.length} changements de plan`);
	console.log(`  planches : ${sheets.map((f) => relative(root, join(root, 'work', 'planches', f))).join(', ')}`);
	console.log(`  durée visée : ${dur(cfg.duree_visee)} · langue : ${cfg.langue}`);
	console.log('Suite : lis source.md et chaque planche, puis écris script.md. Les commandes se lancent depuis ce dossier.');
}

// A new video on a subject: no old video to read. Its pictures come from captures, clips and inserts.
async function fresh(root, sujet, a) {
	const nom = root.split('/').pop().replace(/-(refonte|youtube)$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'video';
	const cfg = defaults(nom, String(a.lang && a.lang !== true ? a.lang : 'fr'), a.duree ? parseTc(a.duree) : 600, null);
	cfg.sujet = sujet;
	if (!Number.isFinite(cfg.duree_visee)) throw new Error('--duree illisible : écris 10:00 ou 600.');
	saveConfig(root, cfg);
	const fill = (s) => s.replaceAll('__NOM__', nom).replaceAll('__SOURCE__', `aucune : vidéo nouvelle sur « ${sujet} »`).replaceAll('__DUREE__', '—').replaceAll('__VISEE__', dur(cfg.duree_visee));
	await writeFile(join(root, 'brief.md'), fill(await readFile(join(SKILL, 'template', 'brief.md'), 'utf8')));
	await writeFile(join(root, 'script.md'), fill(await readFile(join(SKILL, 'template', 'script.md'), 'utf8')));
	try {
		const f = await setFont(root, cfg, 'Montserrat', 800);
		console.log(`Police : ${f.name} → ${f.file}`);
	} catch (e) {
		console.log(`Police non téléchargée (${e.message}). Plus tard : « refonte-youtube police "Montserrat" ».`);
	}
	console.log(`Projet créé : ${root}\n  vidéo nouvelle sur « ${sujet} » · durée visée ${dur(cfg.duree_visee)} · langue ${cfg.langue}`);
	console.log('Suite : rassemble les images (captures dans images/, clips dans clips/), puis écris script.md. Les commandes se lancent depuis ce dossier.');
}

// refonte.json of a new project. source: the old video, or null for a new video.
function defaults(nom, langue, duree, source) {
	return {
		nom,
		langue,
		duree_visee: duree,
		source,
		sortie: { largeur: 1920, hauteur: 1080, fps: 30 },
		voix: { profil: null, moteur: null, tempo: 1, avance: 0.08, pause: 0.35, pause_chapitre: 0.9 },
		musique: [],
		mixage: { lufs: -14, musique_sous_voix: 12, baisse: 10, fondu_musique: 3 },
		style: { police: null, fichier_police: null, licence_police: null, accent: '#FFD400', texte: '#FFFFFF', texte_sur_accent: '#111111', fond: '#0E0E10', majuscules: true, position_mots: 'bas', etiquette_chapitre: 'Chapitre' },
		bruitages: { mots_forts: 'pop', chapitres: 'whoosh', cartons: 'hit', sequences: 0.45, volume: 1 }
	};
}
