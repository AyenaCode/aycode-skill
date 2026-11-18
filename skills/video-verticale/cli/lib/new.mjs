// new: create a dressing project around an edited video. mots: read its words again.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { montage } from './freres.mjs';
import { checkFont, download } from './police.mjs';
import { dur, ffmpeg, fmt, loadConfig, outputRate, probe, projectRoot, readJson, saveConfig, SKILL, tc, writeJson } from './util.mjs';

export const booleans = ['help', 'refaire'];
const HELP = `video-verticale new <dossier> <source> [--voix <piste>] [--lang fr|en|auto] [--style pop|mot|ligne] [--zone universal|ads]
    Crée le projet d'habillage : verticale.json (réglages), brief.md, work/mots.json, fonts/, exports/.
    <source> : un projet montage-youtube déjà exporté (son dossier), ou un fichier vidéo déjà monté
    (par exemple l'export avec voix d'une vidéo pub-video), qui est alors transcrit mot à mot.
    --voix : la voix seule, calée sur la vidéo (render/<vidéo>_voice.wav d'un projet pub-video) : la
    transcription la lit à la place du mixage, sans musique ni bruitage pour la gêner.
    Propose des zooms sur les coupes visibles d'un montage face caméra, et télécharge la police Montserrat Black.
video-verticale mots
    Relit les mots de la source (après un nouvel export du montage, ou pour retranscrire un fichier).`;

const round = (x) => Math.round(x * 1000) / 1000;

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	if (cmd === 'mots') return mots();
	if (a._.length < 2) return console.log(HELP);
	const dir = resolve(a._[0]);
	const src = resolve(a._[1]);
	if (existsSync(join(dir, 'verticale.json'))) throw new Error(`${dir} contient déjà un projet.`);
	if (!existsSync(src)) throw new Error(`source introuvable : ${a._[1]}`);

	let source;
	let lang = a.lang;
	if (existsSync(join(src, 'projet.json'))) {
		const proj = readJson(join(src, 'projet.json'));
		const video = join(src, 'exports', `${proj.nom}.mp4`);
		if (!existsSync(video) || !existsSync(join(src, 'work', 'render', 'final.plan.json'))) throw new Error(`le montage ${src} n’est pas exporté : lance « montage-youtube build » dans ce dossier.`);
		source = { type: 'montage', video, montage: src };
		lang ??= proj.lang;
	} else if (statSync(src).isFile()) {
		source = { type: 'fichier', video: src, montage: null, voix: a.voix ? resolve(String(a.voix)) : null };
		if (source.voix && !existsSync(source.voix)) throw new Error(`piste de voix introuvable : ${a.voix}`);
	}
	else throw new Error(`${src} n’est ni un projet montage-youtube ni un fichier vidéo.`);

	const m = await probe(source.video);
	if (!m.width) throw new Error(`${source.video} n’a pas d’image.`);
	const cfg = {
		nom: basename(dir),
		lang: String(lang ?? 'auto'),
		source,
		sortie: { width: 1080, height: 1920, rate: outputRate(m.fps), cadrage: 0.5 },
		zone: String(a.zone ?? 'universal'),
		sous_titres: {
			style: String(a.style ?? 'pop'),
			police: null,
			fichier_police: null,
			licence_police: null,
			taille: 120,
			couleur: '#FFFFFF',
			accent: '#FFD400',
			contour: 8,
			ombre: 4,
			// Ads keep the bottom 35 % free: the default line must sit above it.
			hauteur: a.zone === 'ads' ? 0.6 : 0.68,
			hauteurs: [],
			majuscules: true,
			mots_max: 3,
			emphase: [],
			corrections: {}
		},
		accroche: { texte: '', debut: 0, fin: 2.5 },
		zooms: [],
		musique: null,
		bruitages: [],
		mixage: { baisse: 8, lufs: -14 }
	};
	for (const d of ['work', 'exports', 'fonts']) mkdirSync(join(dir, d), { recursive: true });
	saveConfig(dir, cfg);
	copyFileSync(join(SKILL, 'template', 'brief.md'), join(dir, 'brief.md'));
	console.log(`Projet créé : ${dir}`);
	console.log(`  source : ${source.video} (${dur(m.duration)}, ${m.width}×${m.height}, ${fmt(m.fps, 2)} i/s)`);
	if (Math.abs(m.height / m.width - 16 / 9) > 0.02) console.log(`  attention : la source n’est pas en 9:16 ; elle sera recadrée pour remplir 1080×1920 (centre du cadre réglable : sortie.cadrage, de 0 à 1).`);

	const w = await readSource(dir, cfg);
	if (w.mode !== 'ecran') cfg.zooms = proposeZooms(w.cuts);
	try {
		const f = await download(dir, 'Montserrat', 900);
		Object.assign(cfg.sous_titres, { police: f.name, fichier_police: f.file, licence_police: f.licence });
	} catch (e) {
		console.log(`  police non téléchargée (${e.message}). Lance « video-verticale police "<famille>" » avant le rendu.`);
	}
	saveConfig(dir, cfg);
	if (cfg.sous_titres.police) {
		const c = await checkFont(dir, cfg);
		console.log(`  police : ${cfg.sous_titres.police}${c.ok ? '' : ` (PROBLÈME : ${c.why})`}`);
	}
	if (cfg.zooms.length) console.log(`  zooms proposés sur ${cfg.zooms.length} coupe(s) : ${cfg.zooms.map((z) => `${tc(z.t)} ×${z.z}`).join(', ')}`);
	console.log('Suite : cd dans le dossier, décide l’habillage dans verticale.json, puis « video-verticale apercu ».');
}

async function mots() {
	const root = projectRoot();
	const cfg = loadConfig(root);
	await readSource(root, cfg);
}

// Words on the timeline of the source video, plus its cuts when it comes from montage-youtube.
// Writes work/mots.json.
export async function readSource(root, cfg) {
	const video = cfg.source.video;
	if (!existsSync(video)) throw new Error(`la source a disparu : ${video}`);
	let out;
	if (cfg.source.type === 'montage') {
		const plan = readJson(join(cfg.source.montage, 'work', 'render', 'final.plan.json'));
		const cuts = plan.segments.slice(1).map((s, i) => {
			const p = plan.segments[i];
			return { t: round(s.o), saut: s.src === p.src ? round(s.a - p.b) : null };
		});
		out = { words: plan.words, cuts, duration: plan.duration, mode: plan.mode };
	} else {
		const m = await probe(video);
		let words = [];
		let lag = 0;
		const voice = cfg.source.voix ?? video;
		if (cfg.source.voix || m.audio) {
			const wav = join(root, 'work', 'voix.wav');
			await ffmpeg(['-i', voice, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
			const { transcribe } = await montage.whisper();
			const r = await transcribe(wav, join(root, 'work', 'voix'), { lang: cfg.lang });
			if (cfg.lang === 'auto' && r.lang) cfg.lang = r.lang;
			words = r.words.map((w, i, ws) => ({ t: w.t, a: round(w.a), b: round(Math.min(ws[i + 1]?.a ?? m.duration, w.a + 0.9)), p: Math.round((w.p ?? 1) * 100) / 100 }));
			// whisper writes words over silence ("you", "Thank you."): a word with no sound under it goes.
			const { readWav } = await montage.util();
			const x = readWav(wav);
			// The window starts before the word: the time of a word before a silence is often late.
			const heard = (w) => {
				const a = Math.max(0, Math.floor((w.a - 0.25) * 16000));
				const z = Math.min(x.length, Math.max(a + 8000, Math.ceil(w.b * 16000)));
				let e = 0;
				for (let i = a; i < z; i++) e += x[i] * x[i];
				return 10 * Math.log10(e / Math.max(1, z - a) + 1e-12) > -50;
			};
			const before = words.length;
			words = words.filter(heard);
			if (words.length < before) console.log(`  ${before - words.length} mot(s) écrit(s) sur du silence par la transcription : retiré(s).`);
			// whisper dates a word when its alignment reaches it, which falls after the sound starts:
			// 0.13 to 0.24 s late on six measured voice-overs. The delay is measured on this voice and taken off.
			lag = lateness(x, words);
			if (lag) {
				words = words.map((w) => ({ ...w, a: round(Math.max(0, w.a - lag)), b: round(Math.max(0, w.b - lag)) }));
				console.log(`  mots avancés de ${fmt(lag, 2)} s : la transcription les datait en retard sur la voix.`);
			}
		}
		out = { words, cuts: [], duration: m.duration, mode: 'fichier', ...(lag ? { avance: lag } : {}) };
	}
	writeJson(join(root, 'work', 'mots.json'), { source: video, mtime: statSync(video).mtimeMs, ...out });
	saveConfig(root, cfg);
	console.log(`  ${out.words.length} mots, ${out.cuts.length} coupe(s), ${dur(out.duration)} → work/mots.json`);
	if (!out.words.length) console.log('  aucune parole : pas de sous-titres (le titre d’accroche reste possible).');
	const doubt = out.words.filter((w) => w.p !== undefined && w.p < 0.5);
	if (doubt.length) console.log(`  à relire (transcription incertaine) : ${doubt.slice(0, 12).map((w) => `${w.t} (${tc(w.a)})`).join(', ')}`);
	return out;
}

// How late the transcription dates words, in seconds: the median gap between each restart of the voice
// after a silence (sound back above the floor) and the first word dated near it. 0 when the voice has
// too few silences to tell, or when the gap is too small or too large to be this delay.
export function lateness(x, words, { rate = 16000 } = {}) {
	const F = Math.round(rate / 100); // 10 ms frames
	const n = Math.floor(x.length / F);
	const db = new Float32Array(n);
	let peak = -Infinity;
	for (let i = 0; i < n; i++) {
		let e = 0;
		for (let j = i * F; j < (i + 1) * F; j++) e += x[j] * x[j];
		db[i] = 10 * Math.log10(e / F + 1e-12);
		if (db[i] > peak) peak = db[i];
	}
	const floor = peak - 35;
	const gaps = [];
	let quiet = 0;
	for (let i = 0; i < n; i++) {
		if (db[i] <= floor) {
			quiet++;
			continue;
		}
		if (quiet >= 15) {
			const t = i / 100;
			const w = words.find((w) => w.a >= t - 0.15);
			if (w && w.a <= t + 0.6) gaps.push(w.a - t);
		}
		quiet = 0;
	}
	if (gaps.length < 5) return 0;
	gaps.sort((p, q) => p - q);
	const median = gaps[gaps.length >> 1];
	return median >= 0.04 && median <= 0.4 ? round(median) : 0;
}

// Punch-in on the cuts that show a jump (more than 0.5 s removed, or another rush), alternating
// between full frame and 110 %, at most one change every 2 s.
function proposeZooms(cuts) {
	const out = [];
	let z = 1;
	let last = -Infinity;
	for (const c of cuts) {
		if ((c.saut !== null && c.saut < 0.5) || c.t - last < 2) continue;
		z = z === 1 ? 1.1 : 1;
		out.push({ t: c.t, z });
		last = c.t;
	}
	return out;
}
