// analyse: transcribe each rush, locate the voice and the pauses, watch the screen, propose the cut list.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { dur, ffmpeg, fmt, loadProject, projectRoot, readJson, readWav, run, SYNC, SYNC_VERSION, writeJson } from './util.mjs';
import { activeTime, energy, HOP, islands, levels, saveDb } from './signal.mjs';
import { transcribe } from './whisper.mjs';
import { montageText } from './montage.mjs';

export const booleans = ['help', 'force', 'retranscrire'];
const HELP = `montage-youtube analyse [--force] [--retranscrire]
    Pour chaque rush : transcription mot à mot (whisper.cpp), repérage de la voix et des pauses,
    activité de l'écran, planche d'images (work/rush-N_planche.png).
    Écrit work/analyse.json et la liste de coupes proposée dans montage.md.
    Si montage.md existe déjà, la proposition va dans montage.proposition.md (--force : écrase montage.md).
    Une transcription déjà faite est reprise telle quelle (--retranscrire : la refaire).`;

const SPLIT = 0.5; // pause that separates two phrases
const RETAKE_WORDS = /\b(je recommence|on recommence|je reprends|on reprend|je la refais|on la refait|je refais|on refait|coupez?)\b/i;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const proj = loadProject(root);
	const work = join(root, 'work');
	await mkdir(work, { recursive: true });
	const an = { version: 1, lang: proj.lang, model: null, dtw: false, mode: 'visage', sources: [], phrases: [], pauses: {}, ignored: [] };
	let n = 0;
	let frozenTime = 0;
	let total = 0;
	for (const [k, src] of proj.sources.entries()) {
		const tag = `rush-${k + 1}`;
		console.log(`Rush ${k + 1}/${proj.sources.length} : ${basename(src.file)} (${dur(src.duration)})`);
		const wav = join(work, `${tag}.16k.wav`);
		await ffmpeg(['-i', src.file, '-map', `0:a:${src.audio ?? 0}`, '-af', SYNC(16000), '-ac', '1', '-c:a', 'pcm_s16le', wav]);
		const db = energy(readWav(wav));
		saveDb(join(work, `${tag}.energie.f32`), db);
		const lv = levels(db);
		const isl = islands(db, lv.thr);

		const cache = join(work, `${tag}.transcription.json`);
		let tr;
		if (existsSync(cache) && !a.retranscrire && readJson(cache).sync === SYNC_VERSION) {
			tr = readJson(cache);
			console.log(`  transcription reprise (${basename(tr.model)}) ; --retranscrire pour la refaire`);
		} else {
			console.log('  transcription mot à mot…');
			tr = { ...(await transcribe(wav, join(work, `${tag}.whisper`), { lang: an.lang })), sync: SYNC_VERSION };
			writeJson(cache, tr);
		}
		Object.assign(an, { lang: tr.lang, model: basename(tr.model), dtw: tr.dtw });

		console.log('  planche d’images et activité de l’écran…');
		const scr = await screen(src, join(work, `${tag}_planche.png`));
		frozenTime += scr.frozen.reduce((s, [p, q]) => s + q - p, 0);
		total += src.duration;

		const st = {};
		const items = assemble(tr.words, isl, an.ignored, k, st, db, lv.thr);
		const phrases = group(items, k, () => `P${String(++n).padStart(3, '0')}`);
		for (let i = 0; i + 1 < phrases.length; i++) {
			const pa = phrases[i].b;
			const pb = phrases[i + 1].a;
			an.pauses[phrases[i].id] = { a: pa, b: pb, move: Math.round(activeTime(scr.frozen, pa, pb) * 10) / 10 };
		}
		an.phrases.push(...phrases);
		an.sources.push({ file: src.file, duration: src.duration, video: src.video ?? src.duration, floor: lv.floor, thr: lv.thr, voice: lv.speech, lag: st.lag, frozen: scr.frozen, planche: scr.planche });
		console.log(`  ${phrases.length} phrases, ${tr.words.length} mots, bruit de fond ${fmt(lv.floor, 0)} dB, voix ${fmt(lv.speech, 0)} dB`);
	}
	retakes(an.phrases);
	an.mode = total && frozenTime / total >= 0.35 ? 'ecran' : 'visage';
	writeJson(join(work, 'analyse.json'), an);

	const target = existsSync(join(root, 'montage.md')) && !a.force ? 'montage.proposition.md' : 'montage.md';
	await writeFile(join(root, target), montageText(an, proj));
	const dropped = an.phrases.filter((p) => !p.keep).length;
	const struck = an.phrases.reduce((s, p) => s + p.strike.length, 0);
	const used = proj.reglages.mode === 'auto' ? an.mode : proj.reglages.mode;
	console.log(`\nMode : ${used === 'ecran' ? 'écran' : 'visage'}${proj.reglages.mode === 'auto' ? ' (détecté' : ' (choisi ; détecté : ' + (an.mode === 'ecran' ? 'écran' : 'visage')}, image figée ${Math.round((100 * frozenTime) / (total || 1))} % du temps).`);
	console.log(`Proposition : ${an.phrases.length} phrases, dont ${dropped} coupées (reprises, consignes, hésitations), ${struck} hésitations coupées dans les phrases.`);
	if (an.ignored.length) console.log(`${an.ignored.length} mots transcrits sans voix dessous, ignorés (liste en fin de ${target}).`);
	if (!an.dtw) console.log('Attention : pas d’horodatage DTW pour ce modèle, les coupes dans les phrases seront moins précises.');
	console.log(`→ ${target}${target !== 'montage.md' ? ' (montage.md existant gardé ; --force pour l’écraser)' : ''}`);
}

// One pass over the picture: contact sheet (one frame every few seconds) and frozen stretches.
async function screen(src, planche) {
	const portrait = src.height > src.width;
	const tile = portrait ? 160 : 320;
	const step = Math.max(2, Math.ceil(src.duration / 30));
	const count = Math.max(1, Math.ceil(src.duration / step));
	const cols = 6;
	const rows = Math.ceil(Math.min(30, count) / cols);
	const graph = [
		'[0:v]split=2[x][y]',
		'[x]fps=5,scale=320:-2,freezedetect=n=-60dB:d=0.4,nullsink',
		`[y]fps=1/${step},scale=${tile}:-2,drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=${cols}x${rows}:padding=6:margin=6:color=0x1b1b1f[pl]`
	].join(';');
	const r = await run('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', src.file, '-filter_complex', graph, '-map', '[pl]', '-frames:v', '1', '-update', '1', planche]);
	if (r.code) throw new Error(`ffmpeg (planche) a échoué :\n${r.err.trim().split('\n').slice(-4).join('\n')}`);
	const frozen = [];
	let start = null;
	for (const m of r.err.matchAll(/freeze_(start|end): ([\d.]+)/g)) {
		if (m[1] === 'start') start = Number(m[2]);
		else if (start !== null) {
			frozen.push([start, Number(m[2])]);
			start = null;
		}
	}
	if (start !== null) frozen.push([start, src.duration]);
	return { frozen, planche };
}

// Words placed on the stretches of voice. A word with no voice under it is set aside; a stretch of
// voice with no word becomes "(euh?)" when short, "(son)" when long.
function assemble(words, isl, ignored, k, stats, db, thr) {
	const near = (t) => {
		let lo = 0;
		let hi = isl.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (isl[mid].a <= t) lo = mid;
			else hi = mid - 1;
		}
		let best = -1;
		let d = Infinity;
		for (const i of [lo, lo + 1]) {
			const s = isl[i];
			if (!s) continue;
			const di = t < s.a ? s.a - t : t > s.b ? t - s.b : 0;
			if (di < d) [best, d] = [i, di];
		}
		return { i: best, d };
	};
	// Whisper's word times run a little late: measure the lag on the first word of each stretch of
	// voice (median), and move every word back by it.
	const leads = [];
	for (const s of isl) {
		const w = words.find((x) => x.a >= s.a - 0.1 && x.a <= s.b);
		if (w && w.a - s.a >= 0 && w.a - s.a <= 0.5) leads.push(w.a - s.a);
	}
	leads.sort((x, y) => x - y);
	const lag = leads.length >= 5 ? leads[leads.length >> 1] : 0;
	const by = isl.map(() => []);
	for (const w of words) {
		w.a = Math.max(0, w.a - lag);
		const { i, d } = near(w.a);
		if (i < 0 || d > 0.35) ignored.push({ src: k, a: w.a, t: w.t });
		else by[i].push(w);
	}
	stats.lag = lag;
	const items = [];
	for (const [i, s] of isl.entries()) {
		const ws = by[i].sort((x, y) => x.a - y.a);
		if (!ws.length) {
			items.push({ k: 'son', t: s.b - s.a <= 0.9 ? '(euh?)' : '(son)', a: s.a, b: s.b });
			continue;
		}
		// Voice that no word explains: at the start of the stretch, between two words far apart, or after the
		// last word. Whisper leaves out a phrase said twice; "(paroles?)" keeps that voice visible.
		const unheard = (a, b) => items.push({ k: 'voix', t: '(paroles?)', a: r3(a), b: r3(b) });
		if (ws[0].a - s.a >= 0.8 && voiced(db, thr, s.a, ws[0].a) >= 0.7) unheard(s.a, ws[0].a - 0.02);
		else ws[0].a = s.a;
		for (let j = 1; j < ws.length; j++) ws[j].a = Math.min(Math.max(ws[j].a, ws[j - 1].a + 0.04), s.b - 0.02);
		for (let j = 0; j < ws.length; j++) {
			const next = j + 1 < ws.length ? ws[j + 1].a : s.b;
			const long = next - ws[j].a >= 2 && voiced(db, thr, ws[j].a + 0.6, next) >= 0.7;
			items.push({ k: 'mot', t: ws[j].t, a: r3(ws[j].a), b: r3(long ? ws[j].a + 0.6 : next), p: Math.round(ws[j].p * 100) / 100 });
			if (long) unheard(ws[j].a + 0.6, next);
		}
	}
	return items;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
// Share of the 10 ms frames between a and b where the voice is above the threshold.
function voiced(db, thr, a, b) {
	const i0 = Math.floor(a / HOP);
	const i1 = Math.ceil(b / HOP);
	let on = 0;
	for (let i = i0; i < i1; i++) if (db[i] > thr) on++;
	return i1 > i0 ? on / (i1 - i0) : 0;
}

// Items → phrases, split at the end of each sentence and on every pause of SPLIT seconds or more.
function group(items, k, nextId) {
	const phrases = [];
	let cur = null;
	for (const it of items) {
		const last = cur?.items.at(-1);
		const gap = last ? it.a - last.b : Infinity;
		if (!cur || gap >= SPLIT || /[.?!…]$/.test(last.t)) {
			cur = { id: nextId(), src: k, items: [] };
			phrases.push(cur);
		}
		cur.items.push(it);
	}
	for (const p of phrases) {
		p.a = p.items[0].a;
		p.b = p.items.at(-1).b;
		p.keep = true;
		p.strike = p.items.flatMap((it, i) => (it.t === '(euh?)' ? [i] : []));
		if (p.strike.length === p.items.length) {
			p.keep = false;
			p.strike = [];
			p.note = 'hésitation';
		} else if (p.items.every((it) => it.k === 'son')) p.note = 'son sans parole';
	}
	return phrases;
}

const norm = (p) =>
	p.items
		.filter((it) => it.k === 'mot')
		.map((it) => it.t.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, ''))
		.filter(Boolean);

// A phrase said again soon after is a retake, and the earlier one is cut: the next phrase restarts with the
// same words, in the same order (allowing a word changed, added or dropped). A phrase that gives a filming
// instruction is cut too.
function retakes(phrases) {
	for (const [i, p] of phrases.entries()) {
		const text = p.items.map((it) => it.t).join(' ');
		if (RETAKE_WORDS.test(text)) {
			p.keep = false;
			p.note = 'consigne de tournage';
			continue;
		}
		// The next phrase starts with voice the transcription left out, after this unfinished phrase.
		const q0 = phrases[i + 1];
		if (q0 && q0.src === p.src && q0.items.find((it) => it.k !== 'son')?.t === '(paroles?)' && q0.a - p.b < 30 && !/[.?!…]$/.test(p.items.at(-1).t) && p.items.some((it) => it.k === 'mot')) {
			p.keep = false;
			p.note = `reprise probable : ${q0.id} recommence par une voix non transcrite`;
			continue;
		}
		const wi = norm(p);
		if (wi.length < 3) continue;
		for (const q of phrases.slice(i + 1, i + 4)) {
			if (q.src !== p.src || q.a - p.b > 90) break;
			const wj = norm(q);
			let prefix = 0;
			while (prefix < wi.length && wi[prefix] === wj[prefix]) prefix++;
			const head = wj.slice(0, wi.length + 3);
			const same = common(wi, head);
			if ((prefix >= 3 && prefix >= wi.length / 2) || (wi.length >= 4 && same >= 0.8 * wi.length && wi[0] === wj[0])) {
				p.keep = false;
				p.note = `reprise probable : redite en ${q.id}`;
				break;
			}
		}
	}
}
// Length of the longest common subsequence of two word lists.
function common(x, y) {
	let prev = new Array(y.length + 1).fill(0);
	for (const w of x) {
		const cur = [0];
		for (let j = 0; j < y.length; j++) cur.push(w === y[j] ? prev[j] + 1 : Math.max(prev[j + 1], cur[j]));
		prev = cur;
	}
	return prev[y.length];
}
