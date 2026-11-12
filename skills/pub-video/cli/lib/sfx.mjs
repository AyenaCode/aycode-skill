// Sound effects synthesised from scratch: no file to download, no licence to clear.
// Each function returns a mono Float64Array. GAIN sets how loud each one sits in the mix.
import { SR, len, noise, env, mul, add, mixInto, norm, lowpass, bandpass, sweep, flat, osc, rand } from './dsp.mjs';

const tone = (f, d, a, dec) => mul(osc(flat(f, d)), env(len(d), a, dec, 1));
// Bell: a few inharmonic partials, the higher ones dying faster.
function bell(f, d, decay = 0.35, partials = [[1, 1], [2.0, 0.5], [3.01, 0.25], [4.2, 0.15]]) {
	const x = new Float64Array(len(d));
	for (const [m, a] of partials) mixInto(x, tone(f * m, d, 0.001, decay / Math.sqrt(m)), 0, a);
	return x;
}
// Band of noise sweeping from f0 to f1, swelling then fading: the base of every whoosh.
function air(d, f0, f1, q = 1.4, peakAt = 0.6) {
	const x = bandpass(noise(d), sweep(f0, f1, d), q);
	const n = x.length;
	for (let i = 0; i < n; i++) {
		const k = i / (n - 1);
		x[i] *= k < peakAt ? (k / peakAt) ** 2 : ((1 - k) / (1 - peakAt)) ** 1.5;
	}
	return norm(x, 0.8);
}

export const FX = {
	// Short low punch: a word landing, a card hitting the table.
	hit() {
		const d = 0.22;
		const x = mul(osc(sweep(180, 48, d)), env(len(d), 0.001, 0.09, 1));
		mixInto(x, mul(lowpass(noise(0.012), 6000), env(len(0.012), 0.0005, 0.004, 1)), 0, 0.6);
		return norm(x, 0.9);
	},
	// Heavy impact with a sub tail: the offer, a big number.
	impact() {
		const d = 1.1;
		const n = len(d);
		const sub = mul(osc(sweep(90, 28, d)), env(n, 0.001, 0.35, 1));
		const crunch = mul(lowpass(noise(d), sweep(5000, 300, d)), env(n, 0.001, 0.18, 1));
		return norm(add(sub, mul(crunch, 0.5)), 1);
	},
	// Impact plus a bright crash: lands with the music drop, on the brand reveal.
	drop_hit() {
		const d = 1.8;
		const crash = mul(bandpass(noise(d), 7000, 0.7), env(len(d), 0.001, 0.7, 1));
		return norm(add(mixInto(new Float64Array(len(d)), FX.impact()), mul(crash, 0.45)), 1);
	},
	// Deep sub drop, felt more than heard: underlines a statement.
	sub() {
		const d = 0.7;
		return norm(mul(osc(sweep(75, 34, d)), env(len(d), 0.004, 0.3, 1)), 0.9);
	},
	// Bubble pop: an element appearing. pitch raises it (use rising pitches on a series).
	pop({ pitch = 1 } = {}) {
		const d = 0.12;
		const f = new Float64Array(len(d)).fill(1150 * pitch);
		f.set(sweep(380 * pitch, 1150 * pitch, 0.035));
		return norm(mul(osc(f), env(f.length, 0.001, 0.045, 1)), 0.8);
	},
	pop_big({ pitch = 1 } = {}) {
		const thump = mul(osc(sweep(140, 60, 0.15)), env(len(0.15), 0.001, 0.05, 1));
		return norm(add(FX.pop({ pitch: pitch * 0.6 }), mul(thump, 0.8)), 0.9);
	},
	// Light, short air: a highlight sweep, a line being drawn, text gliding in.
	swish: () => mul(air(0.2, 1800, 5200, 0.9, 0.6), 0.8),
	// Quick rising air: a small element flying in.
	swoosh: () => air(0.28, 900, 4500, 1.2, 0.7),
	// Falling air: a scene change, something large moving away.
	whoosh: () => air(0.5, 2800, 380, 1.0, 0.45),
	// Rising air: something large arriving, a camera fly-through.
	whoosh_up: () => air(0.6, 300, 3200, 1.1, 0.75),
	// Tension building into a hit. d = its length; place it so it ends on the hit.
	riser({ d = 0.4 } = {}) {
		const n = len(d);
		const x = bandpass(noise(d), sweep(400, 9000, d), 1.5);
		const saw = osc(sweep(200, 1200, d), 'saw');
		for (let i = 0; i < n; i++) {
			const k = i / (n - 1);
			x[i] = x[i] * k * k + saw[i] * k ** 3 * 0.15;
		}
		return norm(lowpass(x, 9000), 0.7);
	},
	// One keyboard key.
	key({ pitch = 1 } = {}) {
		const d = 0.03;
		const n = len(d);
		const x = mul(bandpass(noise(d), 3200 * pitch, 3), env(n, 0.0005, 0.006, 1));
		return norm(add(x, mul(tone(2200 * pitch, d, 0.0005, 0.004), 0.3)), 0.5);
	},
	// Two-note confirmation: a step done.
	check() {
		const x = new Float64Array(len(0.7));
		mixInto(x, bell(1318.5, 0.5, 0.12), 0, 0.7);
		mixInto(x, bell(1975.5, 0.6, 0.18), len(0.07));
		return norm(x, 0.6);
	},
	// Single clear bell: a result, a number reached.
	ding: () => norm(bell(1567.98, 1.4, 0.5), 0.6),
	// Two-note notification: a message, an order coming in.
	notif() {
		const x = new Float64Array(len(1.1));
		mixInto(x, bell(880, 0.6, 0.15));
		mixInto(x, bell(1318.5, 0.9, 0.3), len(0.12));
		return norm(x, 0.65);
	},
	// Rising sparkle: success, something made better.
	sparkle() {
		const x = new Float64Array(len(1.1));
		[2093, 2637, 3136, 4186].forEach((f, i) => mixInto(x, bell(f, 0.7, 0.22), len(i * 0.045), 0.6));
		return norm(x, 0.6);
	},
	// Interface click: a tap, a button.
	click() {
		const d = 0.04;
		const x = mul(lowpass(noise(d), 9000), env(len(d), 0.0002, 0.005, 1));
		return norm(add(x, mul(tone(1800, d, 0.0002, 0.01), 0.5)), 0.7);
	},
	// Soft low landing: an object set down.
	thud() {
		const d = 0.25;
		const x = mul(osc(sweep(130, 55, d)), env(len(d), 0.001, 0.06, 1));
		mixInto(x, lowpass(noise(0.01), 3000), 0, 0.4);
		return norm(x, 0.85);
	},
	// Rubber stamp: thud, paper, a bit of sub.
	stamp() {
		const x = FX.thud();
		mixInto(x, mul(bandpass(noise(0.15), 2500, 0.8), env(len(0.15), 0.001, 0.04, 1)), 0, 0.5);
		return norm(add(x, mul(FX.impact(), 0.5)), 0.95);
	},
	// Cash register: money earned, a sale.
	kaching() {
		const d = 1.3;
		const x = new Float64Array(len(d));
		for (const [f, a, dec] of [[2093, 1, 0.5], [3136, 0.7, 0.4], [4186, 0.5, 0.35], [5274, 0.35, 0.3]]) mixInto(x, tone(f, d, 0.001, dec), 0, a);
		for (let k = 0; k < 6; k++) {
			const coin = mul(bandpass(noise(0.05), 5000 + rand() * 3000, 6), env(len(0.05), 0.0005, 0.015, 1));
			mixInto(x, coin, len(0.03 + k * 0.045 + rand() * 0.02), 0.6);
		}
		mixInto(x, FX.click().subarray(0, len(0.02)), 0, 0.8);
		return norm(x, 0.7);
	},
	// Tiny tick: one step of a counter. Rising pitch over a series.
	tick({ pitch = 1 } = {}) {
		const d = 0.035;
		return norm(mul(bandpass(noise(d), 1800 * pitch, 5), env(len(d), 0.0005, 0.008, 1)), 0.5);
	},
	// Falling tone: a loss, something going down.
	drop() {
		const d = 0.5;
		return norm(lowpass(mul(osc(sweep(700, 160, d), 'tri'), env(len(d), 0.005, 0.25, 1)), 3000), 0.55);
	},
	// Run of soft ticks: a list scrolling. d = its length.
	scroll({ d = 1 } = {}) {
		const x = new Float64Array(len(d));
		for (let k = 0; k < d - 0.03; k += 0.075) mixInto(x, FX.tick({ pitch: 1.6 }), len(k), 0.35);
		for (let i = 0; i < x.length; i++) x[i] *= Math.sqrt(Math.sin((Math.PI * i) / (x.length - 1)));
		return x;
	},
	// Closing hit with a rising chord: the last beat of the ad.
	final() {
		const x = FX.drop_hit();
		[1046.5, 1318.5, 1568, 2093].forEach((f, i) => mixInto(x, bell(f, 1.2, 0.6), len(i * 0.06), 0.35));
		return norm(x, 1);
	}
};

export const GAIN = {
	hit: 0.55, impact: 0.8, drop_hit: 0.9, sub: 0.7, pop: 0.4, pop_big: 0.55, swish: 0.4, swoosh: 0.6, whoosh: 0.8, whoosh_up: 0.75, riser: 0.6,
	key: 0.5, check: 0.4, ding: 0.4, notif: 0.5, sparkle: 0.4, click: 0.45, thud: 0.55, stamp: 0.7, kaching: 0.6, tick: 0.45, drop: 0.4, scroll: 0.3, final: 0.85
};
// One line per sound, for `pub-video sfx list`.
export const ABOUT = {
	hit: 'coup court et grave : un mot qui s’écrase, une carte qui tombe',
	impact: 'gros impact avec basse : l’offre, un grand chiffre',
	drop_hit: 'impact + cymbale : sur le drop de la musique, la révélation de la marque',
	sub: 'basse profonde : souligne une phrase',
	pop: 'bulle : un élément apparaît (pitch croissant sur une série)',
	pop_big: 'bulle grave : un gros élément, des confettis',
	swish: 'souffle léger : surlignage, trait dessiné, texte qui glisse',
	swoosh: 'souffle montant rapide : un petit élément qui arrive',
	whoosh: 'souffle descendant : changement de scène, gros élément qui part',
	whoosh_up: 'souffle montant : gros élément qui arrive, traversée de caméra',
	riser: 'montée de tension avant un impact (d = durée, finit sur l’impact)',
	key: 'touche de clavier',
	check: 'deux notes : étape validée',
	ding: 'clochette : résultat, chiffre atteint',
	notif: 'notification : message, commande',
	sparkle: 'scintillement montant : réussite, amélioration',
	click: 'clic d’interface : appui, bouton',
	thud: 'pose sourde : un objet déposé',
	stamp: 'tampon',
	kaching: 'caisse enregistreuse : une vente, de l’argent gagné',
	tick: 'tic : un pas de compteur',
	drop: 'ton descendant : une perte',
	scroll: 'série de tics doux : une liste qui défile (d = durée)',
	final: 'impact final avec accord montant : dernier temps de la pub'
};
export { SR };
