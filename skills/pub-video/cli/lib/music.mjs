// music: find a track that is cleared for ads, read its tempo, beat grid and structure, and place it
// under the video so that its drop lands on the reveal.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { decode, fft } from './dsp.mjs';
import { assetRoot, projectRoot, fmt, pad, num } from './util.mjs';

export const booleans = ['help', 'bars', 'json', 'sfx'];
const HELP = `pub-video music find [--mood <a,b>] [--genre <a,b>] [--tag <a,b>] [--instrument <a,b>] [--pages 1] [--max 8] [--skip 0] [--min 60] [--bpm 100-130]
    Liste les morceaux Mixkit, télécharge les --max premiers dans audio/music/, les analyse et les classe.
    Plusieurs critères se cumulent : --genre house --tag technology garde les morceaux house du tag technology.
    Dans un même critère, les valeurs s'additionnent : --mood happy,uplifting.
    Moods : energetic, happy, positive, motivating, confident, uplifting, playful, fun, calm, relaxed, driving.
    Genres : pop, hip-hop, house, funk, electronica, corporate, ambient, jazz, rock.  Tags : technology, lifestyle, travel.
    --bpm écarte les tempos hors de la plage ; sans lui, 90 à 135 BPM sont seulement mieux notés. --min : durée minimale (s).
    Chaque fichier est vérifié : sa durée doit être celle annoncée par Mixkit, sinon il est écarté.
    Écrit audio/music/candidats.json (source, licence, date). --skip 8 passe aux suivants si aucun ne convient.
pub-video music scan <fichier…> [--bars]
    Tempo, premier temps, mesures, changements d'énergie (dont le drop). --bars : énergie mesure par mesure.
pub-video music fit <fichier> --at <secondes> [--drop <secondes dans le morceau>] [--duration 30]
    Calcule le réglage qui fait tomber le drop à --at secondes de la vidéo, et affiche le bloc music: { … } à coller dans setup().
    Si le coup du drop arrive après sa barre de mesure, dit sur quel temps poser la révélation.
pub-video music licence [--sfx]
    Lit la licence Mixkit du jour (musique, ou bruitages avec --sfx), l'affiche et l'enregistre dans audio/music/licence-mixkit-<date>.txt.
    find et licence marchent aussi hors d'un projet pub-video : les fichiers vont dans audio/ du dossier courant.`;

const SR = 22050;
const NFFT = 1024;
const HOP = 256;
const FR = SR / HOP;
const dB = (x) => 10 * Math.log10(x + 1e-12);

// Linear interpolation of a curve at a fractional index.
function at(x, p) {
	if (p < 0 || p >= x.length - 1) return 0;
	const k = Math.floor(p);
	return x[k] + (x[k + 1] - x[k]) * (p - k);
}
function movingAvg(x, w) {
	const y = new Float64Array(x.length);
	let s = 0;
	for (let i = 0; i < x.length; i++) {
		s += x[i] - (i >= w ? x[i - w] : 0);
		y[i] = s / Math.min(i + 1, w);
	}
	return y;
}

// Tempo, beat grid, bars and section changes of a track.
export async function analyse(file) {
	const { L: x } = await decode(file, { sr: SR, mono: true });
	const frames = Math.floor((x.length - NFFT) / HOP) + 1;
	if (frames < FR * 8) throw new Error(`${basename(file)} : trop court pour être analysé.`);
	const win = Float64Array.from({ length: NFFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (NFFT - 1)));
	const lowBins = Math.round((150 * NFFT) / SR);
	const flux = new Float64Array(frames);
	const lowFlux = new Float64Array(frames);
	const energy = new Float64Array(frames);
	const low = new Float64Array(frames);
	let prev = new Float64Array(NFFT / 2);
	const re = new Float64Array(NFFT);
	const im = new Float64Array(NFFT);
	for (let f = 0; f < frames; f++) {
		for (let i = 0; i < NFFT; i++) {
			re[i] = x[f * HOP + i] * win[i];
			im[i] = 0;
		}
		fft(re, im);
		const cur = new Float64Array(NFFT / 2);
		for (let k = 1; k < NFFT / 2; k++) {
			const p = re[k] * re[k] + im[k] * im[k];
			energy[f] += p;
			if (k <= lowBins) low[f] += p;
			cur[k] = Math.log1p(10 * Math.sqrt(p));
			const d = cur[k] - prev[k];
			if (d > 0) {
				flux[f] += d;
				if (k <= lowBins) lowFlux[f] += d;
			}
		}
		prev = cur;
	}
	// Onset strength: what rises above the local average, kicks weighted up.
	const on = new Float64Array(frames);
	const avg = movingAvg(flux, Math.round(FR * 0.4));
	const avgLow = movingAvg(lowFlux, Math.round(FR * 0.4));
	for (let f = 0; f < frames; f++) on[f] = Math.max(0, flux[f] - avg[f]) + 3 * Math.max(0, lowFlux[f] - avgLow[f]);

	// Tempo: autocorrelation of the onset curve, summed over 1, 2 and 4 beats, with a mild preference near 120.
	const maxLag = Math.ceil((FR * 60 * 4) / 60) + 2;
	const ac = new Float64Array(maxLag);
	for (let l = 1; l < maxLag; l++) {
		let s = 0;
		for (let i = 0; i + l < frames; i++) s += on[i] * on[i + l];
		ac[l] = s / (frames - l);
	}
	let best = { bpm: 120, score: -1 };
	for (let bpm = 70; bpm <= 180; bpm += 0.25) {
		const lag = (FR * 60) / bpm;
		const prior = Math.exp(-0.5 * (Math.log2(bpm / 118) / 0.7) ** 2);
		const score = (at(ac, lag) + at(ac, 2 * lag) + at(ac, 4 * lag)) * prior;
		if (score > best.score) best = { bpm, score };
	}
	// Refine tempo and phase together: the grid that collects the most onset strength over the whole track.
	const comb = (bpm, phase) => {
		const period = (FR * 60) / bpm;
		let s = 0;
		let n = 0;
		for (let p = phase; p < frames - 1; p += period, n++) s += at(on, p);
		return s / n;
	};
	let fit = { bpm: best.bpm, phase: 0, score: -1 };
	for (const [span, step, phaseStep] of [[1.5, 0.05, 1], [0.08, 0.005, 0.25]]) {
		const c = fit.bpm;
		for (let bpm = c - span; bpm <= c + span + 1e-9; bpm += step) {
			const period = (FR * 60) / bpm;
			for (let phase = 0; phase < period; phase += phaseStep) {
				const s = comb(bpm, phase);
				if (s > fit.score) fit = { bpm, phase, score: s };
			}
		}
	}
	// A tempo within 0.06 of a whole number is that whole number: produced music is made on a grid.
	const bpm = Math.abs(fit.bpm - Math.round(fit.bpm)) < 0.06 ? Math.round(fit.bpm) : Math.round(fit.bpm * 100) / 100;
	const period = 60 / bpm;
	if (bpm !== fit.bpm) {
		let bestPhase = { phase: fit.phase, score: -1 };
		for (let phase = 0; phase < period * FR; phase += 0.25) {
			const s = comb(bpm, phase);
			if (s > bestPhase.score) bestPhase = { phase, score: s };
		}
		fit.phase = bestPhase.phase;
	}
	// Beat times: the spectral frame that shows an onset starts about half a window before it.
	let first = (fit.phase * HOP + NFFT / 2) / SR;
	// Fine phase from the waveform itself: where the low band rises fastest around each predicted beat.
	const lp = new Float64Array(x.length);
	let s1 = 0;
	let s2 = 0;
	const a1 = Math.exp((-2 * Math.PI * 160) / SR);
	const a2 = Math.exp((-2 * Math.PI * 40) / SR);
	for (let i = 0; i < x.length; i++) {
		s1 = (1 - a1) * x[i] + a1 * s1;
		s2 = (1 - a2) * Math.abs(s1) + a2 * s2;
		lp[i] = s2;
	}
	const offs = [];
	for (let t = first; t < x.length / SR - 0.1; t += period) {
		const c = Math.round(t * SR);
		let bi = -1;
		let bd = 0;
		for (let i = Math.max(1, c - Math.round(0.06 * SR)); i < Math.min(x.length - 1, c + Math.round(0.06 * SR)); i++) {
			const d = lp[i + 1] - lp[i - 1];
			if (d > bd) {
				bd = d;
				bi = i;
			}
		}
		if (bi > 0 && bd > 1e-5) offs.push((bi - c) / SR);
	}
	if (offs.length > 8) {
		offs.sort((p, q) => p - q);
		first += offs[offs.length >> 1] - 0.004; // the steepest rise comes a few ms after the attack starts
	}
	first = ((first % period) + period) % period;
	const duration = x.length / SR;
	const beats = Math.floor((duration - first) / period);

	// Energy per beat (whole band and low band), in dB.
	const eBeat = new Float64Array(beats);
	const lBeat = new Float64Array(beats);
	for (let k = 0; k < beats; k++) {
		const a = Math.max(0, Math.round(((first + k * period) * SR - NFFT / 2) / HOP));
		const z = Math.min(frames, Math.round(((first + (k + 1) * period) * SR - NFFT / 2) / HOP));
		let e = 0;
		let l = 0;
		for (let f = a; f < z; f++) {
			e += energy[f];
			l += low[f];
		}
		eBeat[k] = dB(e / Math.max(1, z - a));
		lBeat[k] = dB(l / Math.max(1, z - a));
	}
	const ref = Math.max(...eBeat);
	// Silence (a fade-out, a gap) would dwarf every musical change: floor both curves 45 dB under their peak.
	const refLow = Math.max(...lBeat);
	for (let k = 0; k < beats; k++) {
		eBeat[k] = Math.max(eBeat[k], ref - 45);
		lBeat[k] = Math.max(lBeat[k], refLow - 45);
	}
	// Section changes: the 8 beats after against the 8 beats before.
	const mean = (arr, a, z) => {
		let s = 0;
		for (let i = Math.max(0, a); i < Math.min(arr.length, z); i++) s += arr[i];
		return s / Math.max(1, Math.min(arr.length, z) - Math.max(0, a));
	};
	// Where bars start: the beat on which the bass (or the whole mix) most often steps up. A fill or a riser
	// lifts the highs one beat early, the bass comes in on the one.
	const votes = [0, 0, 0, 0];
	for (let k = 1; k < beats; k++) {
		const dl = lBeat[k] - lBeat[k - 1];
		const de = eBeat[k] - eBeat[k - 1];
		if (dl > 4) votes[k % 4] += dl * dl;
		if (de > 4) votes[k % 4] += 0.5 * de * de;
	}
	const barPhase = votes.indexOf(Math.max(...votes));
	// Section changes, bar line by bar line: the two bars after against the two bars before.
	const change = (k) => 0.5 * (mean(eBeat, k, k + 8) - mean(eBeat, k - 8, k)) + 0.5 * Math.max(-18, Math.min(18, mean(lBeat, k, k + 8) - mean(lBeat, k - 8, k)));
	const lines = [];
	for (let k = barPhase + 4; k < beats - 3; k += 4) lines.push({ k, jump: change(k) });
	const sections = lines
		.filter((l, i) => Math.abs(l.jump) > 2 && Math.abs(l.jump) >= Math.abs(lines[i - 1]?.jump ?? 0) && Math.abs(l.jump) > Math.abs(lines[i + 1]?.jump ?? 0))
		.map(({ k, jump }) => ({ t: first + k * period, bar: (k - barPhase) / 4, before: mean(eBeat, k - 8, k) - ref, after: mean(eBeat, k, k + 8) - ref, low: mean(lBeat, k, k + 8) - mean(lBeat, k - 8, k), jump }));
	const rises = sections.filter((s) => s.jump > 2 && s.t < duration * 0.75);
	const drop = rises.sort((p, q) => q.jump - p.jump)[0] ?? null;
	// The section starts on a bar line, but its hit can come off the beat (a gap, then a late kick).
	// The hit is the first moment, from half a beat before the line to one beat after, where the level
	// (30 ms average) jumps from near the level before the drop to near the level after it.
	if (drop) {
		const level = (t, d = 0.03) => {
			const a = Math.max(0, Math.round(t * SR));
			const z = Math.min(x.length, Math.round((t + d) * SR));
			let e = 0;
			for (let i = a; i < z; i++) e += x[i] * x[i];
			return dB(e / Math.max(1, z - a));
		};
		const pre = level(drop.t - period * 1.5, period);
		const post = level(drop.t + period, period * 2);
		drop.hit = drop.t;
		if (post - pre >= 8) {
			for (let t = drop.t - period / 2; t <= drop.t + period; t += 0.005) {
				if (level(t) >= pre + 0.7 * (post - pre) && level(t - 0.03) <= pre + 0.3 * (post - pre)) {
					drop.hit = Math.round(t * 1000) / 1000;
					break;
				}
			}
		}
	}
	const bars = [];
	for (let k = barPhase; k + 4 <= beats; k += 4) bars.push({ t: first + k * period, e: mean(eBeat, k, k + 4) - ref, low: mean(lBeat, k, k + 4) - refLow });
	return { file, duration, bpm, period, first, barStart: first + barPhase * period, bar: period * 4, confidence: fit.score / (mean(on, 0, frames) + 1e-9), sections: sections.sort((p, q) => p.t - q.t), drop, bars };
}

// How far the drop's hit sits from its bar line, in beats (0 when it is on the line, within 2 frames).
const offBeat = (a) => (a.drop?.hit !== undefined && Math.abs(a.drop.hit - a.drop.t) > 0.06 ? (a.drop.hit - a.drop.t) / a.period : 0);

function report(a, withBars) {
	console.log(`\n${basename(a.file)} : ${fmt(a.duration, 1)} s, ${a.bpm} BPM (un temps = ${fmt(a.period, 4)} s, une mesure = ${fmt(a.bar, 3)} s), netteté du rythme ${fmt(a.confidence, 1)}`);
	console.log(`  premier temps à ${fmt(a.first, 3)} s, première mesure à ${fmt(a.barStart, 3)} s`);
	if (!a.sections.length) console.log('  aucun changement d’énergie marqué : morceau constant, sans drop.');
	for (const s of a.sections) console.log(`  ${s === a.drop ? 'DROP ' : s.jump > 0 ? 'monte' : 'baisse'} à ${fmt(s.t, 2).padStart(7)} s (mesure ${String(s.bar).padStart(2)}) : ${fmt(s.before, 1)} → ${fmt(s.after, 1)} dB, basses ${s.low >= 0 ? '+' : ''}${fmt(s.low, 1)} dB`);
	const off = offBeat(a);
	if (off) console.log(`  le coup du drop tombe à ${fmt(a.drop.hit, 2)} s, ${fmt(off, 2)} temps ${off > 0 ? 'après' : 'avant'} la barre de ${fmt(a.drop.t, 2)} s.`);
	if (withBars) for (const [i, br] of a.bars.entries()) console.log(`  mesure ${String(i).padStart(3)} ${fmt(br.t, 2).padStart(7)} s ${fmt(br.e, 1).padStart(6)} dB ${'#'.repeat(Math.max(0, Math.round(30 + br.e)))}`);
}

// Settings that put the track's drop (or another moment) at `at` seconds of the video.
export function fitTrack(a, at, { drop, duration = 30 } = {}) {
	const mark = drop ?? a.drop?.t;
	if (mark === undefined) throw new Error('ce morceau n’a pas de drop détecté : donne le moment à caler avec --drop <secondes>.');
	let start = mark - at;
	const notes = [];
	if (start < 0) {
		notes.push(`il n'y a que ${fmt(mark, 2)} s de musique avant ce moment : la musique démarre à 0 et il tombera à ${fmt(mark, 2)} s de la vidéo. Place la révélation là, ou choisis --at ≤ ${fmt(mark, 2)}.`);
		start = 0;
	}
	if (start + duration > a.duration) notes.push(`le morceau finit à ${fmt(a.duration - start, 1)} s de la vidéo : prends un moment plus tôt ou un morceau plus long.`);
	const sec = a.sections.find((s) => Math.abs(s.t - mark) < a.period);
	const quiet = sec ? sec.after - sec.before : 0;
	const intro = at > 0.5 ? { until: Math.round(at * 1000) / 1000, lowpass: [1500, 12000], lift: quiet > 12 ? 8 : quiet > 7 ? 4 : 0 } : null;
	if (intro && quiet > 7) notes.push(`avant ce moment la musique est ${fmt(quiet, 0)} dB plus faible : intro relevée de ${intro.lift} dB pour rester audible sur un téléphone.`);
	const beatAt0 = (((start - a.first) / a.period) % 1 + 1) % 1;
	if (beatAt0 > 0.02 && beatAt0 < 0.98) notes.push(`la vidéo démarre ${fmt(beatAt0, 2)} temps après un temps de la musique : c'est normal si --at n'est pas un nombre entier de temps (${fmt(a.period, 3)} s).`);
	return { bpm: a.bpm, start: Math.round(start * 1000) / 1000, intro, notes, beatsBefore: at / a.period };
}

// ---- Mixkit search ---------------------------------------------------------------------------
const LICENCE = { name: 'Mixkit Stock Music Free License', url: 'https://mixkit.co/license/#musicFree' };
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// Path of a category on Mixkit: genres sit at the root, the rest under their kind (mood/happy, tag/travel).
const catPath = (kind, value) => (kind === 'genre' ? value : `${kind}/${value}`);
const unescape = (t) => t.replace(/&#39;|&#x27;/g, '’').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
// One listing page → its tracks. Each card is read on its own: the player attributes of a card come
// before its id, so reading "from one id to the next" would give every title the next card's file.
async function listing(kind, value, page) {
	const path = catPath(kind, value);
	const url = `https://mixkit.co/free-stock-music/${path}/${page > 1 ? `?page=${page}` : ''}`;
	const r = await fetch(url, { headers: { 'user-agent': UA } });
	if (!r.ok) throw new Error(`Mixkit a répondu ${r.status} pour ${url}. Vérifie le nom (${kind} « ${value} »).`);
	const html = await r.text();
	const items = [];
	for (const card of html.split('class="item-grid__item"').slice(1)) {
		const id = /data-audio-player-item-id-value="(\d+)"/.exec(card)?.[1];
		const src = /data-audio-player-preview-url-value="([^"]+\.mp3)"/.exec(card)?.[1];
		const title = /item-grid-card__title[^>]*>\s*([^<]+?)\s*</.exec(card)?.[1];
		const author = /item-grid-music-preview__author[^>]*>\s*(?:by\s+)?([^<]+?)\s*</.exec(card)?.[1];
		const dur = /data-test-id="duration"[^>]*>\s*(\d+):(\d+)/.exec(card);
		// The categories a card links to; the page's own category is implied.
		const cats = new Set([path, ...[...card.matchAll(/class="meta-links__link"[^>]*?href="\/free-stock-music\/([^"?#]+?)\/?"/g)].map((m) => m[1])]);
		if (!id || !title || items.some((i) => i.id === id)) continue;
		// A file that does not carry the card's own id belongs to another track: the page layout changed.
		if (!src || !src.includes(`/${id}/`)) {
			console.log(`  ignoré : « ${unescape(title)} » (${id}), son fichier ${src ?? 'absent'} ne correspond pas à ce morceau.`);
			continue;
		}
		items.push({ id, title: unescape(title), author: author && unescape(author), seconds: dur ? Number(dur[1]) * 60 + Number(dur[2]) : null, src, page: url, cats: [...cats] });
	}
	if (!items.length && html.includes('item-grid')) throw new Error(`la page ${url} a changé de forme : aucun morceau lisible. Préviens l'auteur du skill.`);
	return items;
}

export default async function (_cmd, a) {
	const sub = a._[0];
	if (a.help || !sub) return console.log(HELP);
	if (sub === 'scan') {
		if (!a._[1]) throw new Error('donne un ou plusieurs fichiers : pub-video music scan audio/music/x.mp3');
		for (const f of a._.slice(1)) {
			const r = await analyse(f);
			if (a.json) console.log(JSON.stringify({ ...r, bars: undefined }));
			else report(r, !!a.bars);
		}
		return;
	}
	if (sub === 'licence' || sub === 'license') {
		// The licence text is drawn by the page's script: read it in the headless browser, keep a dated copy.
		const name = a.sfx ? 'Sound Effects Free License' : LICENCE.name.replace('Mixkit ', '');
		const url = a.sfx ? 'https://mixkit.co/license/#sfxFree' : LICENCE.url;
		const { launch } = await import('./browser.mjs');
		const browser = await launch();
		let text;
		try {
			const page = await browser.newPage();
			await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
			await page.waitForTimeout(1500);
			text = await page.evaluate(() => document.body.innerText);
		} finally {
			await browser.close();
		}
		const start = text.indexOf(`${name}\n`);
		if (start < 0) throw new Error(`le texte « ${name} » est introuvable sur ${url} : la page a changé. Ouvre-la dans un navigateur et relis-la.`);
		const claim = text.indexOf('* If you receive', start);
		const end = claim > 0 ? text.indexOf('\n', claim) : text.indexOf('User Terms', start) + 12;
		const body = text.slice(start, end > start ? end : start + 2000).trim();
		const stamp = new Date().toISOString().slice(0, 10);
		const dir = join(assetRoot(), 'audio', a.sfx ? 'sfx' : 'music');
		await mkdir(dir, { recursive: true });
		const file = join(dir, `licence-mixkit-${stamp}.txt`);
		await writeFile(file, `${url}\nLu le ${stamp}\n\n${body}\n`);
		console.log(`${body}\n\n  → ${relative(process.cwd(), file)}`);
		return;
	}
	if (sub === 'fit') {
		if (!a._[1] || a.at === undefined) throw new Error('usage : pub-video music fit <fichier> --at <secondes de la vidéo où tombe le drop>');
		const root = projectRoot();
		const r = await analyse(a._[1]);
		report(r, false);
		const f = fitTrack(r, num(a.at), { drop: a.drop === undefined ? undefined : num(a.drop), duration: num(a.duration, 30) });
		const src = relative(join(root, 'videos'), resolve(a._[1])).replace(/\\/g, '/');
		console.log(`\nDans setup() de la vidéo :\n  bpm: ${f.bpm},\n  music: { src: '${src}', start: ${f.start}, drop: ${num(a.at)}${f.intro ? `, intro: { until: ${f.intro.until}, lowpass: [${f.intro.lowpass}], lift: ${f.intro.lift} }` : ''} },`);
		const n = Math.round(f.beatsBefore);
		const off = a.drop === undefined ? offBeat(r) : 0;
		if (off) {
			const q = Math.round(off * 4) / 4;
			console.log(`\nLa barre du drop tombe à ${fmt(num(a.at), 2)} s, soit b(${n}) : la scène de la révélation commence là.`);
			console.log(`Le coup du drop arrive ${fmt(off, 2)} temps plus ${off > 0 ? 'tard' : 'tôt'}, vers ${fmt(num(a.at) + off * r.period, 2)} s : pose la révélation (logo, drop_hit) sur b(${n + q}).`);
		} else console.log(`\nLe drop tombe à ${fmt(num(a.at), 2)} s, soit ${fmt(f.beatsBefore, 2)} temps après le début : place la révélation sur b(${n}).`);
		for (const n of f.notes) console.log(`  note : ${n}`);
		return;
	}
	if (sub === 'find') {
		const asked = ['mood', 'genre', 'tag', 'instrument'].filter((k) => a[k] !== undefined).map((kind) => ({ kind, values: String(a[kind]).split(',').map((v) => v.trim()).filter(Boolean) }));
		if (!asked.length) throw new Error('donne --mood, --genre, --tag ou --instrument. Exemple : pub-video music find --mood energetic,confident');
		const root = assetRoot();
		const dir = join(root, 'audio', 'music');
		await mkdir(dir, { recursive: true });
		if (!existsSync(join(root, 'theme.css'))) console.log(`  hors d’un projet pub-video : les morceaux vont dans ${dir}`);
		// The first criterion gives the pages to read; each other one filters their cards.
		const [first, ...rest] = asked;
		let items = [];
		for (const value of first.values) for (let p = 1; p <= num(a.pages, 1); p++) for (const it of await listing(first.kind, value, p)) if (!items.some((i) => i.id === it.id)) items.push(it);
		const read = items.length;
		items = items.filter((it) => rest.every(({ kind, values }) => values.some((v) => it.cats.includes(catPath(kind, v)))));
		if (rest.length) console.log(`  ${items.length} morceau(x) sur ${read} lus (${first.kind} ${first.values.join(', ')}) sont aussi ${rest.map((c) => `${c.kind} ${c.values.join(' ou ')}`).join(' et ')}.`);
		items = items.filter((i) => !i.seconds || i.seconds >= num(a.min, 60)).slice(num(a.skip, 0), num(a.skip, 0) + num(a.max, 8));
		if (!items.length) throw new Error(rest.length ? 'aucun morceau ne réunit tous ces critères : ajoute --pages 3, ou garde moins de critères.' : 'aucun morceau trouvé sur cette page Mixkit.');
		// An explicit --bpm range is a filter; without it, tempos from 90 to 135 only score higher.
		const [lo, hi] = String(a.bpm ?? '90-135').split('-').map(Number);
		const strict = a.bpm !== undefined;
		const download = async (it, file) => {
			const r = await fetch(it.src, { headers: { 'user-agent': UA } });
			if (r.ok) await writeFile(file, Buffer.from(await r.arrayBuffer()));
			return r.ok;
		};
		const out = [];
		const off = [];
		for (const it of items) {
			const file = join(dir, `mixkit-${it.id}.mp3`);
			const had = existsSync(file);
			if (!had && !(await download(it, file))) {
				console.log(`  ${it.title} : téléchargement refusé (${it.src}).`);
				continue;
			}
			try {
				let r = await analyse(file);
				// The file must be the track the card announces: same length to within 2 s. A file kept from an
				// earlier search may hold another track, so it is fetched again once.
				if (it.seconds && Math.abs(r.duration - it.seconds) > 2 && had && (await download(it, file))) r = await analyse(file);
				if (it.seconds && Math.abs(r.duration - it.seconds) > 2) {
					console.log(`  ignoré : « ${it.title} » annonce ${it.seconds} s, son fichier dure ${fmt(r.duration, 0)} s.`);
					continue;
				}
				if (strict && (r.bpm < lo || r.bpm > hi)) {
					off.push(`${it.title} (${r.bpm} BPM)`);
					continue;
				}
				// A good ad bed: steady beat, tempo in range, and a clear lift early enough to sit on the reveal.
				const score = (r.drop ? Math.min(10, r.drop.jump) + (r.drop.t < 45 ? 3 : 0) : 0) + (r.bpm >= lo && r.bpm <= hi ? 4 : 0) + Math.min(4, r.confidence);
				out.push({ ...it, file: relative(root, file), bpm: r.bpm, drop: r.drop ? Math.round(r.drop.t * 100) / 100 : null, jump: r.drop ? Math.round(r.drop.jump * 10) / 10 : null, confidence: Math.round(r.confidence * 10) / 10, score: Math.round(score * 10) / 10 });
			} catch (e) {
				console.log(`  ${it.title} : ${e.message}`);
			}
		}
		out.sort((p, q) => q.score - p.score);
		console.log(`\n${pad('note', 6)}${pad('BPM', 8)}${pad('drop', 9)}${pad('saut', 7)}${pad('netteté', 9)}${pad('durée', 7)}${pad('fichier', 30)}titre`);
		for (const o of out) console.log(`${pad(o.score, 6)}${pad(o.bpm, 8)}${pad(o.drop === null ? '—' : `${o.drop} s`, 9)}${pad(o.jump === null ? '—' : `+${o.jump}`, 7)}${pad(o.confidence, 9)}${pad(o.seconds ? `${o.seconds} s` : '?', 7)}${pad(o.file, 30)}${o.title}${o.author ? ` · ${o.author}` : ''}`);
		if (off.length) console.log(`\n  Hors de --bpm ${lo}-${hi} : ${off.join(', ')}.`);
		const log = join(dir, 'candidats.json');
		const old = existsSync(log) ? JSON.parse(await readFile(log, 'utf8')) : [];
		const stamp = new Date().toISOString().slice(0, 10);
		// Rows without `cats` come from an older version that could pair a title with another track's file: dropped.
		const merged = [...old.filter((o) => o.cats && !out.some((n) => n.id === o.id)), ...out.map((o) => ({ ...o, source: 'Mixkit', licence: LICENCE.name, licenceUrl: LICENCE.url, downloaded: stamp }))];
		await writeFile(log, JSON.stringify(merged, null, 1));
		console.log(`\n  Licence : ${LICENCE.name} (${LICENCE.url}). Relis-la avant de livrer : elle autorise les pubs en ligne, pas la télé ni la radio.`);
		console.log('  Regarde la structure du meilleur avec : pub-video music scan <fichier> --bars');
		return;
	}
	throw new Error(`sous-commande inconnue « ${sub} » (find, scan, fit, licence).`);
}
