// mots: listen to the generated voice through whisper. The whole voice track is transcribed once; each take
// gets its words with their time (the keywords land on them) and a score against its script text, so a
// garbled or skipped word is found without hearing it.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { voiceTrack } from './audio.mjs';
import { montage } from './freres.mjs';
import { loadScript } from './script.mjs';
import { buildTimeline, loadMots } from './timeline.mjs';
import { bare, loadConfig, pad, projectRoot, wordsOf, writeJson } from './util.mjs';

export const booleans = ['help'];
const HELP = `refonte-youtube mots [--seuil 0.8]
    Transcrit la piste de voix (whisper.cpp, via montage-youtube) et compare chaque réplique à son texte.
    Écrit work/mots.json : les mots de chaque prise avec leur instant, qui calent les mots forts sur la voix.
    Liste les répliques dont moins de --seuil des mots se retrouvent : prise ratée, mot avalé, ou simple nom
    propre mal transcrit. Code de sortie 1 s'il y en a.`;

// Share of the script words found in order in what was heard (longest common subsequence).
function score(script, heard) {
	const s = script.map(bare).filter(Boolean);
	const h = heard.map(bare).filter(Boolean);
	if (!s.length) return 1;
	let prev = new Array(h.length + 1).fill(0);
	for (const w of s) {
		const cur = [0];
		for (let j = 1; j <= h.length; j++) cur[j] = w === h[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
		prev = cur;
	}
	return prev[h.length] / s.length;
}

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const { lines, errors } = loadScript(root);
	if (errors.length) throw new Error(`script.md à corriger :\n  ${errors.join('\n  ')}`);
	const tl = await buildTimeline(root, cfg, lines);
	const missing = tl.errors.filter((e) => /prise de voix/.test(e));
	if (missing.length) throw new Error(`${missing.length} réplique(s) sans prise : lance d'abord « refonte-youtube voix ».`);
	const work = join(root, 'work', 'mots');
	await mkdir(work, { recursive: true });
	console.log(`Transcription de la piste de voix (${Math.round(tl.duration / 60)} min)…`);
	const wav = await voiceTrack(tl, join(work, 'voix-16k.wav'), 16000);
	const { transcribe } = await montage.whisper();
	// recale: whisper dates words late (0.13 to 0.24 s on six voice-overs); without it the keywords land after
	// their word.
	const { words, lag } = await transcribe(wav, join(work, 'voix'), { lang: cfg.langue || 'auto', recale: true });
	if (lag) console.log(`  mots avancés de ${String(lag).replace('.', ',')} s : la transcription les datait en retard sur la voix.`);

	const mots = loadMots(root);
	const seuil = Number(a.seuil ?? 0.8);
	const bad = [];
	for (const it of tl.items) {
		if (!it.voice?.id) continue;
		const { at, dur } = it.voice;
		const mine = words.filter((w) => w.a >= at - 0.15 && w.a < at + dur + 0.15);
		const ratio = score(wordsOf(it.line.text), mine.map((w) => w.t));
		mots.takes[it.voice.id] = { words: mine.map((w) => ({ t: w.t, a: Math.round((w.a - at) * 1000) / 1000 })), heard: mine.map((w) => w.t).join(' '), ratio: Math.round(ratio * 100) / 100 };
		if (ratio < seuil) bad.push({ it, ratio, heard: mots.takes[it.voice.id].heard });
	}
	writeJson(join(root, 'work', 'mots.json'), mots);
	console.log(`  ${words.length} mots entendus · work/mots.json écrit (les mots forts se calent dessus au prochain rendu).`);
	if (!bad.length) return console.log(`\nOK : chaque réplique se retrouve à ${Math.round(seuil * 100)} % au moins dans ce qui est dit.`);
	console.log(`\n${bad.length} réplique(s) à vérifier :`);
	for (const b of bad) {
		console.log(`  ${pad(b.it.n, 5)}${pad(`${Math.round(b.ratio * 100)} %`, 7)}écrit   : ${b.it.line.text}`);
		console.log(`  ${' '.repeat(12)}entendu : ${b.heard || '(rien)'}`);
	}
	console.log('\n  Un nom propre mal transcrit n’est pas une faute de la voix. Sinon : « refonte-youtube voix --ligne <n> ».');
	process.exitCode = 1;
}
