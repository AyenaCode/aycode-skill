// voix: the script said by the user's cloned voice (voicebox, through pub-video), one take per line. Each take
// is cleaned like pub-video's mix (rumble, silences around the voice, even level) and kept under voix/. The
// chosen take of a text is remembered, so a changed line is the only one said again.
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pub } from './freres.mjs';
import { loadScript } from './script.mjs';
import { ffmpeg, fmt, hash, loadConfig, loudness, num, pad, probe, projectRoot, readJson, saveConfig, writeJson } from './util.mjs';

export const booleans = ['help', 'tout'];
const HELP = `refonte-youtube voix [--profil <nom>] [--ligne 3,7] [--seed 12] [--tout] [--tempo 1.05] [--moteur qwen] [--url …]
    Dit chaque réplique de script.md avec la voix clonée du profil voicebox → voix/<id>.wav, nettoyée et au même niveau.
    Sans option : seules les répliques sans prise sont dites (une réplique modifiée est une nouvelle réplique).
    --ligne : redit ces répliques (numéros de « plan »), avec une autre graine si --seed n'est pas donné.
    --tout : redit tout. --profil, --tempo et --moteur sont gardés dans refonte.json pour les fois suivantes.
    Chaque prise est mesurée : SILENCE, TROP LONGUE ? ou TROP COURTE ? pour son texte → à redire avec --ligne.`;

// Same speaking rate as pub-video: 5.2 syllables per second is calm and clear.
export const RATE = 5.2;

// Which take says a text: the choice depends on the profile and the tempo too.
export const voiceKey = (cfg, text) => `${cfg.voix.profil ?? ''}|${cfg.voix.tempo ?? 1}|${text}`;
export function loadVoices(root) {
	const f = join(root, 'voix', 'voix.json');
	return existsSync(f) ? readJson(f) : { takes: {}, choix: {} };
}
export function takeFor(voices, cfg, text) {
	const id = voices.choix[voiceKey(cfg, text)];
	const t = id && voices.takes[id];
	return t ? { id, ...t } : null;
}

// One line through voicebox, then the cleaning chain of pub-video's mix. Returns the take, or a flag.
async function sayLine(root, ctx, text, seed) {
	const { speak } = ctx.vb;
	const id = hash({ text, profil: ctx.profile.id, moteur: ctx.engine ?? '', seed: seed ?? null, tempo: ctx.tempo });
	const out = join(root, 'voix', `${id}.wav`);
	const base = join(root, 'voix', id);
	if (!existsSync(out)) {
		await speak(ctx.server, { text, profile: ctx.profile.id, language: ctx.language, engine: ctx.engineAsked, seed }, `${base}.voicebox`);
		await ffmpeg(['-i', `${base}.voicebox`, '-af', `${ctx.tempo !== 1 ? `atempo=${ctx.tempo},` : ''}highpass=f=85`, '-ac', '1', '-ar', '48000', `${base}.cut.wav`]);
		const span = await ctx.voiced(`${base}.cut.wav`);
		if (!span) {
			await rm(`${base}.voicebox`, { force: true });
			await rm(`${base}.cut.wav`, { force: true });
			return { id, flag: 'SILENCE' };
		}
		await ffmpeg(['-i', `${base}.cut.wav`, '-af', `atrim=start=${span[0].toFixed(4)}:end=${span[1].toFixed(4)},asetpts=PTS-STARTPTS,acompressor=threshold=-22dB:ratio=3:attack=8:release=140`, `${base}.raw.wav`]);
		const lv = await loudness(`${base}.raw.wav`);
		const gain = Number.isFinite(lv.lufs) ? Math.max(-12, Math.min(18, -17 - lv.lufs)) : 0;
		await ffmpeg(['-i', `${base}.raw.wav`, '-af', `volume=${gain.toFixed(1)}dB,alimiter=limit=0.8:level=disabled,afade=t=in:d=0.01,areverse,afade=t=in:d=0.03,areverse`, out]);
		for (const ext of ['voicebox', 'cut.wav', 'raw.wav']) await rm(`${base}.${ext}`, { force: true });
	}
	const duration = (await probe(out)).duration;
	// A failed generation shows in its length: far longer or shorter than its text.
	const want = ctx.syllables(text) / RATE / ctx.tempo;
	const flag = duration > want * 1.7 ? 'TROP LONGUE ?' : duration < want * 0.55 ? 'TROP COURTE ?' : '';
	return { id, take: { text, file: `voix/${id}.wav`, duration, want, profil: ctx.profile.name, moteur: ctx.engine ?? null, seed: seed ?? null, tempo: ctx.tempo, flag, at: new Date().toISOString() } };
}

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	if (a.profil && a.profil !== true) cfg.voix.profil = String(a.profil);
	if (a.tempo !== undefined) cfg.voix.tempo = num(a.tempo, 1);
	if (a.moteur && a.moteur !== true) cfg.voix.moteur = String(a.moteur);
	if (!cfg.voix.profil) throw new Error('donne le profil de voix : --profil <nom> (la liste : « pub-video voice profils »).');
	const tempo = cfg.voix.tempo ?? 1;
	if (!(tempo >= 0.8 && tempo <= 1.3)) throw new Error('--tempo va de 0,8 à 1,3.');
	saveConfig(root, cfg);

	const { lines, errors } = loadScript(root);
	if (errors.length) throw new Error(`script.md à corriger d'abord :\n  ${errors.join('\n  ')}`);
	const vb = await pub.voicebox();
	const server = await vb.connect(a.url === true ? undefined : a.url);
	if (!server.url) throw new Error(`voicebox ne répond pas (essayé : ${server.tried.join(', ')}). Lance l'application voicebox ou son conteneur Docker, ou donne son adresse avec --url.`);
	const list = await vb.profiles(server);
	const profile = vb.pick(list, cfg.voix.profil);
	if (!profile) throw new Error(`profil « ${cfg.voix.profil} » introuvable dans voicebox. Profils : ${list.map((x) => x.name).join(', ') || 'aucun'}.`);
	const language = String(cfg.langue && cfg.langue !== 'auto' ? cfg.langue : 'fr').toLowerCase();
	const engine = cfg.voix.moteur || profile.default_engine || undefined;
	const why = engine && vb.engineProblem(engine, language);
	if (why) throw new Error(`${why}. Choisis un autre moteur avec --moteur (qwen ou chatterbox parlent français).`);
	const { voiced, syllables } = await pub.voice();
	const ctx = { vb, server, profile, language, engine, engineAsked: cfg.voix.moteur || undefined, tempo, voiced, syllables };

	await mkdir(join(root, 'voix'), { recursive: true });
	const voices = loadVoices(root);
	const asked = a.ligne ? String(a.ligne).split(',').map(Number) : null;
	if (asked?.some((k) => !Number.isInteger(k) || k < 1 || k > lines.length)) throw new Error(`--ligne va de 1 à ${lines.length}.`);
	const todo = lines.filter((l) => l.text && (asked ? asked.includes(l.n) : a.tout || !takeFor(voices, cfg, l.text)));
	if (!todo.length) return console.log('Chaque réplique a déjà sa prise. Pour en redire une : --ligne <n>.');

	console.log(`Voix « ${profile.name} » · ${engine ?? 'moteur par défaut'} · ${language}${tempo !== 1 ? ` · tempo ×${tempo}` : ''} · ${todo.length} réplique(s)`);
	console.log(`  ${pad('n°', 6)}${pad('dite en', 9)}${pad('attendu', 9)}${pad('calcul', 8)}texte`);
	const odd = [];
	for (const l of todo) {
		const t0 = Date.now();
		// Saying a line again without a seed asks for another take, not the same one from the cache.
		const seed = a.seed !== undefined ? num(a.seed, 0) : asked || a.tout ? Math.floor(Math.random() * 1e6) : undefined;
		const r = await sayLine(root, ctx, l.text, seed);
		const flag = r.flag ?? r.take.flag;
		if (r.take) {
			voices.takes[r.id] = r.take;
			voices.choix[voiceKey(cfg, l.text)] = r.id;
			writeJson(join(root, 'voix', 'voix.json'), voices);
		}
		if (flag) odd.push(l.n);
		console.log(`  ${pad(l.n, 6)}${pad(r.take ? `${fmt(r.take.duration)} s` : '—', 9)}${pad(r.take ? `${fmt(r.take.want)} s` : '—', 9)}${pad(`${fmt((Date.now() - t0) / 1000, 0)} s`, 8)}${flag ? `${flag}  ` : ''}${l.text.slice(0, 70)}`);
	}
	console.log(odd.length ? `\n  Réplique(s) ${odd.join(', ')} : à redire avec « refonte-youtube voix --ligne ${odd.join(',')} ».` : '\n  Toutes les prises ont une durée normale. Suite : « refonte-youtube mots » pour vérifier ce qui est dit.');
	if (odd.length) process.exitCode = 1;
}
