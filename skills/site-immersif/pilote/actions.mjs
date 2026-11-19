// Les commandes de pilote. Une instance garde le navigateur, la page et la dernière liste d'éléments.

import { createRequire } from 'node:module';
import { join, basename } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanner, pointDeCible, debutMesure, finMesure, infosGraphiques, focus, ecranDeChargement, textesVisibles, ciblesTactiles } from './page.mjs';
import { instrumenter, echantillon, dessinsParImage, recette, shadersPerso, lcp } from './analyse.mjs';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Attend jusqu'à l'instant t0 + ms : un geste garde sa durée même si chaque étape coûte du temps.
const jusqua = (t0, ms) => pause(Math.max(0, t0 + ms - Date.now()));
const BOOLEENS = new Set(['mobile', 'bureau', 'visible', 'reduit', 'tout', 'plein', 'souris', 'doigt', 'instrumente', 'chrome']);
const ACTIONS = new Set(['clique', 'survole', 'tape', 'touche', 'glisse', 'defile', 'va', 'incline', 'attends']);

function playwright() {
	try {
		return createRequire(join(process.cwd(), 'package.json'))('playwright');
	} catch {
		throw new Error('Playwright introuvable dans ce projet. Lance : npm i -D playwright && npx playwright install chromium');
	}
}

// Sépare les options (--nom valeur, --drapeau) des arguments. S'arrête au premier mot d'action si `jusquAction`.
function lire(argv, jusquAction = false) {
	const opts = {};
	const pos = [];
	let i = 0;
	for (; i < argv.length; i++) {
		const a = argv[i];
		if (jusquAction && pos.length === 0 && ACTIONS.has(a)) break;
		if (a.startsWith('--')) {
			const nom = a.slice(2);
			if (BOOLEENS.has(nom)) opts[nom] = true;
			else opts[nom] = argv[++i];
		} else pos.push(a);
	}
	return { opts, pos, reste: argv.slice(i) };
}

const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function ligne(it) {
	const taille = ['canvas', 'video'].includes(it.role) ? ` ${it.w}×${it.h}` : '';
	const nom = it.nom ? ` "${it.nom}"` : '';
	return `@${it.ref} [${it.role}]${nom}${taille}${it.visible ? '' : ' (hors écran)'}`;
}

function stats(m) {
	if (!m || !m.images.length) return 'aucune image mesurée';
	const total = m.images.reduce((a, b) => a + b, 0);
	const ips = Math.round((m.images.length / total) * 1000);
	const saccades = Math.round((m.images.filter((d) => d > 33.4).length / m.images.length) * 1000) / 10;
	const pire = Math.round(Math.max(...m.images));
	let t = `${ips} img/s · ${saccades} % d'images > 33 ms · pire image ${pire} ms · réaction max ${m.reaction ? `${Math.round(m.reaction)} ms` : '< 16 ms'} · décalage ${m.cls.toFixed(3)}`;
	if (m.longues.length) {
		const pires = [...m.longues].sort((a, b) => b.d - a.d).slice(0, 3);
		t += `\n${m.longues.length} image(s) longue(s) > 50 ms, les pires : ` + pires.map((l) => `${l.d} ms${l.script ? ` ← ${l.script}` : ''}`).join(' ; ');
	}
	return t;
}

export class Pilote {
	constructor(dossier) {
		this.dossier = dossier;
		this.n = 0;
		this.problemes = [];
		this.precedent = null;
		this.fini = false;
	}

	async executer(argv) {
		const [cmd, ...args] = argv;
		if (cmd === 'ouvre') return this.ouvre(args);
		if (cmd === 'analyse' && args.some((a) => !a.startsWith('--'))) return this.analyse(args);
		if (cmd === 'ferme') {
			this.fini = true;
			return 'session fermée';
		}
		if (!this.page) throw new Error('aucune page ouverte : « pilote ouvre <url> »');
		const f = {
			regarde: this.regarde,
			capture: this.capture,
			etat: this.etat,
			tour: this.tour,
			compare: this.compare,
			filme: this.filme,
			mesure: this.mesure,
			analyse: this.analyse,
			accessibilite: this.accessibilite,
		}[cmd];
		if (f) return f.call(this, args);
		if (ACTIONS.has(cmd)) return this.agir([cmd, ...args]);
		throw new Error(`commande inconnue : ${cmd} (pilote aide)`);
	}

	fichier(prefixe, ext = 'png') {
		return join(this.dossier, `${String(++this.n).padStart(3, '0')}-${prefixe}.${ext}`);
	}

	// --- session ---

	async ouvre(args) {
		const { opts, pos } = lire(args);
		const url = pos[0];
		if (!url) throw new Error('il manque l’adresse : pilote ouvre <url>');
		const { chromium, devices } = playwright();
		await mkdir(this.dossier, { recursive: true });
		const visible = Boolean(opts.visible);
		const chrome = Boolean(opts.chrome);
		if (this.browser && (this.visible !== visible || this.chrome !== chrome)) await this.fermer();
		if (!this.browser) {
			try {
				// --chrome : Google Chrome installé, qui lit les vidéos MP4 (H.264) que le Chromium de test ne lit pas.
				this.browser = await chromium.launch({ headless: !visible, ...(chrome ? { channel: 'chrome' } : {}), args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
			} catch (e) {
				throw new Error(chrome ? 'Google Chrome introuvable sur cette machine : installe-le (ou « sudo npx playwright install chrome ») ou retire --chrome' : e.message);
			}
			this.visible = visible;
			this.chrome = chrome;
		}
		await this.context?.close();
		const mobile = Boolean(opts.mobile);
		const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
		const base = mobile ? pixel : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
		this.context = await this.browser.newContext({ ...base, reducedMotion: opts.reduit ? 'reduce' : 'no-preference' });
		this.instrumente = Boolean(opts.instrumente);
		if (this.instrumente) await this.context.addInitScript(instrumenter);
		this.page = await this.context.newPage();
		this.mobile = mobile;
		this.cpu = Number(opts.cpu ?? (mobile ? 4 : 1));
		this.cdp = await this.context.newCDPSession(this.page);
		if (this.cpu > 1) await this.cdp.send('Emulation.setCPUThrottlingRate', { rate: this.cpu });
		this.problemes = [];
		this.page.on('pageerror', (e) => this.problemes.push(`erreur de script : ${e.message.split('\n')[0]}`));
		this.page.on('console', (m) => m.type() === 'error' && this.problemes.push(`console : ${m.text().slice(0, 200)}`));
		this.videoEchec = false;
		this.page.on('requestfailed', (r) => {
			this.problemes.push(`requête échouée : ${r.url()}`);
			if (/\.(mp4|m4v|mov)(\?|$)/i.test(r.url())) this.videoEchec = true;
		});
		this.page.on('response', (r) => r.status() >= 400 && this.problemes.push(`réponse ${r.status()} : ${r.url()}`));
		this.page.on('framenavigated', (f) => f === this.page.mainFrame() && (this.precedent = null));
		const t0 = Date.now();
		await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		// Un site lourd peut charger en continu : on attend la fin du chargement 20 s au plus.
		const complet = await this.page.waitForLoadState('load', { timeout: 20000 }).then(() => true, () => false);
		const chargement = Date.now() - t0;
		await pause(1200);
		const js = await this.page.evaluate(() => {
			const s = performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script' || /\.m?js(\?|$)/.test(e.name));
			return { ko: Math.round(s.reduce((a, e) => a + (e.transferSize || 0), 0) / 1000), n: s.length, inconnus: s.filter((e) => !e.transferSize).length };
		});
		const chargeur = await this.attendreChargeur(Number(opts.attente ?? 20000));
		const profil = `${mobile ? 'mobile (Pixel 7)' : 'bureau 1440×900'}, processeur ralenti ${this.cpu}x${opts.reduit ? ', mouvement réduit' : ''}${visible ? ', fenêtre visible' : ''}${chrome ? ', Google Chrome' : ''}`;
		return `ouvert : ${url} · ${profil} · ${complet ? `chargé en ${chargement} ms` : `chargement encore en cours après ${chargement} ms (le site charge en continu)`} · JavaScript chargé : ${js.ko} Ko compressés en ${js.n} fichier(s)${js.inconnus ? ` (${js.inconnus} de poids inconnu, autre domaine ou cache)` : ''}\n` + (chargeur ? chargeur + '\n' : '') + (await this.regarde([]));
	}

	// Attend que l'écran de chargement du site disparaisse. Rend une ligne à afficher, ou '' s'il n'y en avait pas.
	async attendreChargeur(attente) {
		this.bloque = '';
		this.infoChargeur = '';
		const t0 = Date.now();
		let vu = await this.page.evaluate(ecranDeChargement);
		if (!vu) return '';
		let encore = vu;
		while (encore && Date.now() - t0 < attente) {
			await pause(500);
			encore = await this.page.evaluate(ecranDeChargement);
		}
		const s = Math.round((Date.now() - t0) / 100) / 10;
		if (!encore) {
			await pause(800);
			this.infoChargeur = `écran de chargement (${vu}) parti après ${s} s`;
			return this.infoChargeur;
		}
		const pourquoi = this.videoEchec && !this.chrome
			? "une vidéo MP4 n'a pas pu être lue : le Chromium de test n'a pas le codec H.264. Relance avec --chrome (Google Chrome installé)"
			: 'relance avec --attente 60000, ou --visible (vraie carte graphique)';
		this.bloque = `BLOQUÉ sur l'écran de chargement (${encore}) après ${s} s : ce qui suit ne montre pas le site. ${pourquoi}`;
		return this.bloque;
	}

	async fermer() {
		await this.browser?.close();
		this.browser = this.context = this.page = this.cdp = null;
	}

	// --- voir ---

	// Capture d'écran. Sur une page très lourde, la capture normale peut ne jamais aboutir :
	// on la demande alors directement au navigateur, sans attendre une image stable.
	async photo({ path, type = 'png', quality, fullPage = false } = {}) {
		let buf;
		try {
			buf = await this.page.screenshot({ type, quality, fullPage, timeout: 10000 });
		} catch {
			const { data } = await this.cdp.send('Page.captureScreenshot', { format: type === 'jpeg' ? 'jpeg' : 'png', ...(type === 'jpeg' ? { quality: quality ?? 75 } : {}), captureBeyondViewport: fullPage });
			buf = Buffer.from(data, 'base64');
			this.problemes.push('capture lente : la page met plus de 10 s à fournir une image stable');
		}
		if (path) await writeFile(path, buf);
		return buf;
	}

	async scan() {
		return this.page.evaluate(scanner);
	}

	entete(s) {
		const pct = s.hauteur ? Math.round((s.y / s.hauteur) * 100) : 0;
		return `scroll ${s.y}/${s.hauteur} px (${pct} %)${s.section ? ` · section « ${s.section} »` : ''}`;
	}

	nouveauxProblemes() {
		const p = [...new Set(this.problemes)];
		this.problemes = [];
		return p.length ? `\n${p.length} problème(s) :\n` + p.slice(0, 10).map((x) => `! ${x}`).join('\n') : '';
	}

	async regarde(args) {
		const { opts } = lire(args);
		const s = await this.scan();
		this.precedent = s;
		const chemin = this.fichier('regarde');
		await this.photo({ path: chemin });
		const items = opts.tout ? s.items : s.items.filter((i) => i.visible);
		const caches = s.items.length - items.length;
		return [
			this.entete(s),
			`capture : ${chemin}`,
			...items.map(ligne),
			caches ? `(${caches} autre(s) élément(s) hors écran : regarde --tout)` : '',
		]
			.filter(Boolean)
			.join('\n') + this.nouveauxProblemes();
	}

	async capture(args) {
		const { opts } = lire(args);
		const chemin = this.fichier('capture');
		await this.photo({ path: chemin, fullPage: Boolean(opts.plein) });
		return `capture : ${chemin}`;
	}

	async etat() {
		const s = await this.scan();
		const g = await this.page.evaluate(infosGraphiques);
		const logiciel = /swiftshader|llvmpipe|software/i.test(g.gpu);
		return [
			`${this.page.url()} · ${this.entete(s)}`,
			`carte graphique : ${g.gpu}${logiciel ? ' (rendu logiciel : la fluidité 3D est sous-estimée, rouvre avec --visible)' : ''} · WebGPU ${g.webgpu ? 'disponible' : 'absent'}`,
			g.scene ? `scène 3D : ${JSON.stringify(g.scene)}` : 'scène 3D : non exposée (window.__pilote3d absent)',
		].join('\n') + (this.nouveauxProblemes() || '\naucun problème');
	}

	// Planche d'images composée dans le navigateur lui-même : aucune dépendance d'image.
	async planche(images, { colonnes, largeur, titre, prefixe }) {
		const html = `<!doctype html><body style="margin:0;background:#111;color:#ddd;font:13px system-ui,sans-serif">
${titre ? `<div style="padding:8px 8px 0">${echapper(titre)}</div>` : ''}
<div style="display:grid;grid-template-columns:repeat(${colonnes},${largeur}px);gap:6px;padding:8px">
${images.map((i) => `<figure style="margin:0"><img src="${i.src}" style="width:${largeur}px;display:block;outline:1px solid #333"><figcaption style="padding:3px 0">${echapper(i.legende)}</figcaption></figure>`).join('\n')}
</div>`;
		const p = await this.browser.newPage({ viewport: { width: colonnes * (largeur + 6) + 10, height: 300 } });
		await p.setContent(html, { waitUntil: 'load' });
		const chemin = this.fichier(prefixe);
		await p.screenshot({ path: chemin, fullPage: true });
		await p.context().close();
		return chemin;
	}

	// Parcourt la page du haut en bas en `etapes` arrêts, avec une capture à chaque arrêt.
	// Sur une page au scroll simulé (le document ne défile pas, le site écoute la molette), avance par de vrais gestes.
	async parcours(etapes, aChaqueArret) {
		const s0 = await this.scan();
		const vh = this.page.viewportSize().height;
		const virtuel = s0.hauteur < 50;
		const contenu = virtuel ? Math.max(0, (await this.page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('body *')].slice(0, 4000).map((e) => e.scrollHeight)))) - vh) : s0.hauteur;
		const enHaut = async () => {
			if (virtuel) await this.defilement(-(contenu + vh), 6000);
			else await this.allerA(0);
			await pause(virtuel ? 1500 : 800);
		};
		if (virtuel) await enHaut();
		const images = [];
		for (let i = 0; i <= etapes; i++) {
			if (virtuel) {
				if (i > 0) await this.defilement(Math.round(contenu / etapes), 2000);
			} else await this.allerA(Math.round((s0.hauteur * i) / etapes));
			await pause(virtuel ? 1200 : 700);
			if (aChaqueArret) await aChaqueArret();
			const buf = await this.photo({ type: 'jpeg', quality: 75 });
			const s = await this.scan();
			images.push({ src: `data:image/jpeg;base64,${buf.toString('base64')}`, legende: `${Math.round((i / etapes) * 100)} %${s.section ? ` · ${s.section}` : ''}` });
		}
		await enHaut();
		// Fluidité d'un défilement réel, plafonné à 6 écrans sur un scroll simulé et 15 sinon.
		const distance = Math.min(contenu, vh * (virtuel ? 6 : 15));
		const m = await this.mesurer(() => this.defilement(distance, 1200), 800);
		await enHaut();
		const note = virtuel ? `scroll simulé par le site (le document ne défile pas) : parcours fait à la ${this.mobile ? 'main' : 'molette'} sur ${contenu} px de contenu\n` : '';
		return { images, note, fluidite: `défilement de ${distance} px : ${stats(m)}` };
	}

	async tour(args) {
		const { opts } = lire(args);
		const p = await this.parcours(Number(opts.etapes ?? 6));
		const chemin = await this.planche(p.images, { colonnes: Math.min(4, p.images.length), largeur: this.mobile ? 240 : 420, titre: `tour de ${this.page.url()}`, prefixe: 'tour' });
		this.precedent = await this.scan();
		return `${this.bloque ? this.bloque + '\n' : ''}${p.note}planche : ${chemin}\n${p.fluidite}` + this.nouveauxProblemes();
	}

	async compare(args) {
		const { pos } = lire(args);
		if (pos.length < 2) throw new Error('pilote compare <image avant> <image après>');
		const images = await Promise.all(
			pos.slice(0, 2).map(async (f, i) => ({
				src: `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${(await readFile(f)).toString('base64')}`,
				legende: `${i ? 'après' : 'avant'} · ${basename(f)}`,
			})),
		);
		const chemin = await this.planche(images, { colonnes: 2, largeur: this.mobile ? 360 : 620, prefixe: 'compare' });
		return `planche : ${chemin}`;
	}

	// --- agir ---

	async cible(spec) {
		const m = /^@(e\d+)(?::([\d.]+),([\d.]+))?$/.exec(spec ?? '');
		if (m) {
			const p = await this.page.evaluate(pointDeCible, { ref: m[1], fx: m[2] ? Number(m[2]) : 0.5, fy: m[3] ? Number(m[3]) : 0.5 });
			if (p.erreur) throw new Error(p.erreur);
			return p;
		}
		const xy = /^(-?\d+),(-?\d+)$/.exec(spec ?? '');
		if (xy) return { x: Number(xy[1]), y: Number(xy[2]) };
		throw new Error(`cible illisible : « ${spec} » (attendu @e4, @e4:0.2,0.8 ou 200,400)`);
	}

	async allerA(y) {
		await this.page.evaluate((y) => (window.lenis?.scrollTo ? window.lenis.scrollTo(y, { immediate: true }) : window.scrollTo({ top: y, behavior: 'instant' })), y);
	}

	// Défilement par un vrai geste : molette sur bureau ; sur mobile, des glissés de doigt successifs
	// (le geste synthétique « touch » de Chromium ne fait pas défiler une page émulée).
	async defilement(px, vitesse) {
		const v = this.page.viewportSize();
		const x = Math.round(v.width / 2);
		if (!this.mobile) {
			await this.cdp.send('Input.synthesizeScrollGesture', { x, y: Math.round(v.height / 2), yDistance: -px, speed: vitesse, gestureSourceType: 'mouse' });
			return;
		}
		const sens = Math.sign(px);
		let reste = Math.abs(px);
		while (reste > 0) {
			const course = Math.min(reste, Math.round(v.height * 0.6));
			const depart = sens > 0 ? Math.round(v.height * 0.8) : Math.round(v.height * 0.2);
			const duree = (course / vitesse) * 1000;
			const n = Math.max(4, Math.round(duree / 16));
			const t0 = Date.now();
			await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: depart }] });
			for (let i = 1; i <= n; i++) {
				await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(depart - (sens * course * i) / n) }] });
				await jusqua(t0, (duree * i) / n);
			}
			await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			reste -= course;
			await pause(60);
		}
	}

	// Exécute une action sans attendre ni comparer : utilisé tel quel par filme et mesure.
	async geste(argv) {
		const [cmd, ...args] = argv;
		const { opts, pos } = lire(args);
		const doigt = opts.doigt || (this.mobile && !opts.souris);
		switch (cmd) {
			case 'clique': {
				const p = await this.cible(pos[0]);
				if (doigt) await this.page.touchscreen.tap(p.x, p.y);
				else await this.page.mouse.click(p.x, p.y);
				return `${doigt ? 'tapé' : 'cliqué'} en ${p.x},${p.y}`;
			}
			case 'survole': {
				const p = await this.cible(pos[0]);
				await this.page.mouse.move(p.x, p.y, { steps: 12 });
				return `survol en ${p.x},${p.y}`;
			}
			case 'tape': {
				const p = await this.cible(pos[0]);
				await this.page.mouse.click(p.x, p.y);
				await this.page.keyboard.type(pos.slice(1).join(' '), { delay: 30 });
				return 'texte tapé';
			}
			case 'touche': {
				await this.page.keyboard.press(pos[0] ?? 'Tab');
				const f = await this.page.evaluate(focus);
				return f ? `focus sur ${f.ref ? `@${f.ref} ` : ''}"${f.nom}" · ${f.marque ? 'focus visible' : 'FOCUS INVISIBLE (ni contour ni ombre)'}` : `touche ${pos[0]} pressée`;
			}
			case 'glisse': {
				const a = await this.cible(pos[0]);
				const b = await this.cible(pos[1]);
				const duree = Number(opts.duree ?? 600);
				const n = Math.max(2, Math.round(duree / 16));
				const point = (i) => ({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) });
				const t0 = Date.now();
				if (doigt) {
					await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
					for (let i = 1; i <= n; i++) {
						await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(i)] });
						await jusqua(t0, (duree * i) / n);
					}
					await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
				} else {
					await this.page.mouse.move(a.x, a.y);
					await this.page.mouse.down();
					for (let i = 1; i <= n; i++) {
						const p = point(i);
						await this.page.mouse.move(p.x, p.y);
						await jusqua(t0, (duree * i) / n);
					}
					await this.page.mouse.up();
				}
				const reel = Date.now() - t0;
				const lent = reel > duree * 1.5 ? ' (geste ralenti par la page)' : '';
				return `glissé ${doigt ? 'au doigt' : 'à la souris'} de ${a.x},${a.y} à ${b.x},${b.y} en ${reel} ms pour ${duree} demandées${lent}`;
			}
			case 'defile': {
				const px = Number(pos[0] ?? 800);
				const y0 = await this.page.evaluate(() => scrollY);
				await this.defilement(px, Number(opts.vitesse ?? 1200));
				await pause(300);
				const y1 = await this.page.evaluate(() => scrollY);
				const bouge = Math.round(y1 - y0);
				const s = await this.scan();
				const auBout = (px > 0 && y1 >= s.hauteur - 2) || (px < 0 && y1 <= 0);
				const bloque = Math.abs(bouge) < Math.abs(px) * 0.8 && !auBout ? ' · défilement freiné : un élément retient peut-être le geste (touch-action: none, écouteur qui annule le scroll)' : '';
				return `défilé ${this.mobile ? 'au doigt' : 'à la molette'} : ${px} px demandés, la page a bougé de ${bouge} px${bloque}`;
			}
			case 'va': {
				const c = pos[0] ?? '0';
				let y;
				if (c.startsWith('@')) {
					await this.cible(c);
					y = await this.page.evaluate(() => scrollY);
				} else if (c.endsWith('%')) {
					const s = await this.scan();
					y = Math.round((s.hauteur * parseFloat(c)) / 100);
					await this.allerA(y);
				} else {
					y = Number(c);
					await this.allerA(y);
				}
				return `position ${y} px`;
			}
			case 'incline': {
				const [beta, gamma] = [Number(pos[0] ?? 0), Number(pos[1] ?? 0)];
				const duree = Number(opts.duree ?? 800);
				const n = Math.max(2, Math.round(duree / 16));
				for (let i = 1; i <= n; i++) {
					await this.page.evaluate(
						([b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: g, absolute: false })),
						[(beta * i) / n, (gamma * i) / n],
					);
					await pause(16);
				}
				return `incliné à beta ${beta}°, gamma ${gamma}°`;
			}
			case 'attends': {
				await pause(Number(pos[0] ?? 500));
				return `attendu ${pos[0] ?? 500} ms`;
			}
		}
		throw new Error(`action inconnue : ${cmd}`);
	}

	// Enchaîne plusieurs actions séparées par « puis » : clique @e1 puis attends 120 puis clique @e1.
	async enchainer(argv) {
		const etapes = [[]];
		for (const a of argv) (a === 'puis' ? etapes.push([]) : etapes.at(-1).push(a));
		const textes = [];
		for (const e of etapes.filter((x) => x.length)) textes.push(await this.geste(e));
		return textes.join(' · puis ');
	}

	// Action + attente que la page se pose + différentiel des éléments + capture.
	async agir(argv, attente = 500) {
		const texte = await this.geste(argv);
		await pause(attente);
		return texte + '\n' + (await this.apres());
	}

	async apres() {
		const s = await this.scan();
		const avant = new Map((this.precedent?.items ?? []).filter((i) => i.visible).map((i) => [i.ref, i]));
		const maintenant = s.items.filter((i) => i.visible);
		const plus = maintenant.filter((i) => !avant.has(i.ref));
		const ici = new Set(maintenant.map((i) => i.ref));
		const moins = [...avant.values()].filter((i) => !ici.has(i.ref));
		this.precedent = s;
		const chemin = this.fichier('apres');
		await this.photo({ path: chemin });
		const diff = [...plus.slice(0, 25).map((i) => `+ ${ligne(i)}`), ...moins.slice(0, 25).map((i) => `- ${ligne(i)}`)];
		const inchanges = maintenant.length - plus.length;
		return [this.entete(s), `capture : ${chemin}`, ...diff, `= ${inchanges} élément(s) inchangé(s) à l'écran`].join('\n') + this.nouveauxProblemes();
	}

	// --- observer une action ---

	async mesurer(action, apres) {
		await this.page.evaluate(debutMesure);
		await action();
		await pause(apres);
		return this.page.evaluate(finMesure);
	}

	async mesure(args) {
		const { opts, reste } = lire(args, true);
		if (!reste.length) throw new Error('pilote mesure [--apres 500] <action...>');
		let texte;
		const m = await this.mesurer(async () => (texte = await this.enchainer(reste)), Number(opts.apres ?? 500));
		return `${texte}\n${stats(m)}\n` + (await this.apres());
	}

	async filme(args) {
		const { opts, reste } = lire(args, true);
		if (!reste.length) throw new Error('pilote filme [--images 12] [--apres 600] <action...>');
		const nb = Number(opts.images ?? 12);
		const v = this.page.viewportSize();
		const images = [];
		const recevoir = (f) => {
			images.push({ t: Date.now(), data: f.data });
			this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
		};
		this.cdp.on('Page.screencastFrame', recevoir);
		await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: this.mobile ? 360 : 640, maxHeight: Math.round(((this.mobile ? 360 : 640) * v.height) / v.width), everyNthFrame: 1 });
		await pause(250);
		const t0 = Date.now();
		const texte = await this.enchainer(reste);
		await pause(Number(opts.apres ?? 600));
		const t1 = Date.now();
		await this.cdp.send('Page.stopScreencast');
		this.cdp.off('Page.screencastFrame', recevoir);
		if (!images.length) throw new Error('aucune image reçue pendant l’action');
		// Pour chaque instant choisi, l'écran tel qu'il était : la dernière image reçue avant cet instant.
		const choix = [];
		for (let i = 0; i < nb; i++) {
			const t = t0 + ((t1 - t0) * i) / (nb - 1);
			const img = [...images].reverse().find((x) => x.t <= t) ?? images[0];
			choix.push({ src: `data:image/jpeg;base64,${img.data}`, legende: `+${Math.round(t - t0)} ms` });
		}
		const chemin = await this.planche(choix, { colonnes: this.mobile ? 6 : 4, largeur: this.mobile ? 200 : 360, titre: `${reste.join(' ')} · ${images.length} images reçues en ${t1 - t0} ms`, prefixe: 'filme' });
		return `${texte}\nplanche : ${chemin}\n` + (await this.apres());
	}

	// --- analyser un site de référence ---

	async ecouteurs() {
		const INTERET = new Set(['pointermove', 'mousemove', 'pointerdown', 'mousedown', 'click', 'wheel', 'touchstart', 'touchmove', 'deviceorientation', 'devicemotion', 'scroll', 'keydown', 'resize']);
		const n = await this.page.evaluate(() => document.querySelectorAll('canvas').length);
		const cibles = [
			['window', 'window'],
			['document', 'document'],
			...Array.from({ length: Math.min(n, 4) }, (_, i) => [`canvas ${i + 1}`, `document.querySelectorAll('canvas')[${i}]`]),
		];
		const lignes = [];
		for (const [nom, expression] of cibles) {
			try {
				const { result } = await this.cdp.send('Runtime.evaluate', { expression });
				if (!result.objectId) continue;
				const { listeners } = await this.cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
				const types = [...new Set(listeners.map((l) => l.type).filter((t) => INTERET.has(t)))];
				if (types.length) lignes.push(`${nom} : ${types.join(', ')}`);
				await this.cdp.send('Runtime.releaseObject', { objectId: result.objectId });
			} catch {}
		}
		return lignes;
	}

	async analyse(args) {
		const { opts, pos } = lire(args);
		if (pos[0]) {
			const drapeaux = ['mobile', 'visible', 'reduit', 'chrome'].filter((d) => opts[d]).map((d) => `--${d}`);
			await this.ouvre([pos[0], ...drapeaux, '--instrumente', ...(opts.cpu ? ['--cpu', opts.cpu] : []), ...(opts.attente ? ['--attente', opts.attente] : [])]);
		}
		if (!this.instrumente) throw new Error('pilote analyse <url> : la page doit être chargée par analyse pour être observée dès le départ');
		const etapes = Number(opts.etapes ?? 8);
		await pause(1500);
		const lcpChargement = await this.page.evaluate(lcp);
		let dessins = { dessins: 0, passes: 0 };
		const p = await this.parcours(etapes, async () => {
			await this.page.evaluate(echantillon);
			const d = await this.page.evaluate(dessinsParImage, 400);
			if (d && d.dessins >= dessins.dessins) dessins = d;
		});
		const planche = await this.planche(p.images, { colonnes: Math.min(5, p.images.length), largeur: this.mobile ? 220 : 380, titre: `référence ${this.page.url()}`, prefixe: 'reference' });
		await this.page.evaluate(echantillon);
		const R = await this.page.evaluate(recette);
		R.dessinsParImage = dessins;
		R.carteGraphique = (await this.page.evaluate(infosGraphiques)).gpu;
		R.lcp = lcpChargement;
		R.ecouteurs = await this.ecouteurs();
		R.fluidite = p.fluidite;
		const json = this.fichier('analyse', 'json');
		await writeFile(json, JSON.stringify(R, null, 2));
		const shaders = await this.page.evaluate(shadersPerso);
		let fichierShaders = '';
		if (shaders.length) {
			fichierShaders = this.fichier('shaders', 'glsl');
			await writeFile(fichierShaders, `// Shaders du site de référence, pour comprendre ses procédés. Ce code n'est pas à reprendre : on réécrit le procédé.\n\n` + shaders.map((x, i) => `// ----- shader ${i + 1} -----\n${x}`).join('\n\n'));
		}
		this.precedent = await this.scan();

		const G = R.globales;
		const en3d = R.canvas.some((c) => /webgl|webgpu/.test(c)) || R.webgpu;
		const grouper = (l) => [...l.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].map(([x, n]) => (n > 1 ? `${x} (×${n})` : x));
		const liste = (t, l) => (l && l.length ? `  ${t} : ${l.join(' · ')}` : '');
		const lignes = [
			`analyse de ${this.page.url()}`,
			...(this.bloque ? [this.bloque] : this.infoChargeur ? [this.infoChargeur] : []),
			...(p.note ? [p.note.trim()] : []),
			`planche du parcours : ${planche}`,
			`relevé complet : ${json}${fichierShaders ? ` · shaders du site : ${fichierShaders} (${shaders.length})` : ''}`,
			'',
			'Bibliothèques',
			liste('chargées', [G.gsap && `GSAP ${G.gsap}${G.pluginsGsap.length ? ` (${G.pluginsGsap.join(', ')})` : ''}`, G.three && `Three.js r${G.three}`, G.lenis && `Lenis ${JSON.stringify(G.lenis)}`, G.barba && 'Barba.js', G.swup && 'Swup', G.pixi && `PixiJS ${G.pixi}`, G.lottie && 'Lottie'].filter(Boolean)),
			liste(`dans le code (${R.scriptsLus} scripts lus)`, R.code),
			liste('cadre et marques', R.dom),
			'',
			'Scroll',
			R.scrollTriggerAccessible
				? `  ${R.scrollTriggers.length} ScrollTrigger :\n` + grouper(R.scrollTriggers.map((t) => `  - ${t.declencheur} · ${t.debut}→${t.fin} px (${t.longueur})${t.epingle ? ' · épinglé' : ''}${t.scrub !== false ? ` · scrub ${t.scrub}` : ''}${t.actions ? ` · ${t.actions}` : ''}${t.snap ? ' · snap' : ''}${t.horizontal ? ' · dans un défilement horizontal' : ''}${t.animation ? ` · animation ${t.animation}` : ''}`)).slice(0, 15).join('\n')
				: R.code.includes('ScrollTrigger')
					? '  ScrollTrigger est dans le code mais pas accessible (bibliothèque non exposée) : déduis ses réglages de la planche et de « filme defile »'
					: '  aucun ScrollTrigger lisible',
			`  ${R.collants} élément(s) collant(s) · ${R.fixes} fixe(s)${R.css.snap ? ` · scroll-snap (${R.css.snap})` : ''}${R.css.scrollTimeline ? ` · animations CSS liées au scroll (${R.css.scrollTimeline})` : ''}`,
			'',
			'Mouvement (relevé pendant le parcours)',
			...(R.animations.length ? R.animations.slice(0, 15).map((a) => `  - ${a.type} · ${Math.round(a.duree)} ms · ${a.courbe}${a.proprietes ? ` · ${a.proprietes}` : ''} · ${a.cible}${a.timeline} (relevée ${a.nb} fois)`) : ['  aucune animation saisie aux positions relevées : filme les gestes pour voir le mouvement']),
			liste('courbes CSS', R.css.courbes),
			liste('durées CSS', R.css.durees),
			`  @keyframes ${R.css.keyframes} · transitions de vue ${R.css.viewTransition || R.transitionsDeVue ? 'oui' : 'non'}${R.css.illisibles ? ` · ${R.css.illisibles} feuille(s) de style illisible(s) (autre domaine)` : ''}`,
			'',
			'Direction artistique',
			`  fond de page ${R.palette.fondPage ?? '?'} · fonds ${R.palette.fonds.join(' ')} · textes ${R.palette.textes.join(' ')}`,
			liste('polices chargées', R.polices),
			...Object.entries(R.typo).map(([k, v]) => `  ${k} : ${v}`),
			`  ${R.curseur || 'curseur standard'}${R.css.blend ? ` · mix-blend-mode (${R.css.blend})` : ''}${R.css.backdrop ? ` · backdrop-filter (${R.css.backdrop})` : ''}${R.css.clipPath ? ` · clip-path (${R.css.clipPath})` : ''}`,
			'',
			`Structure : ${R.hauteurEcrans} écrans de haut, ${R.sections.length} section(s)`,
			...R.sections.slice(0, 15).map((x) => `  - ${x}`),
			'',
			'3D et dessin',
			...(R.canvas.length ? R.canvas.map((c) => `  - ${c}`) : ['  aucun canvas']),
			en3d && /swiftshader|llvmpipe|software/i.test(R.carteGraphique) ? '  rendu logiciel (sans carte graphique) : la fluidité de la 3D est sous-estimée, relance avec --visible' : '',
			en3d ? `  ${R.dessinsParImage.dessins} appel(s) de dessin et ${R.dessinsParImage.passes} passe(s) par image au plus · ${R.textures.nombre} texture(s), la plus grande ${R.textures.plusGrande} px · WebGPU ${R.webgpu ? 'utilisé' : 'non utilisé'}` : '',
			liste('matériaux Three.js', R.materiaux),
			R.shadersPerso ? `  ${R.shadersPerso} shader(s) écrit(s) pour le site${R.procedes.length ? ` · procédés : ${R.procedes.join(', ')}` : ''}` : '',
			'',
			liste('Interactions écoutées', R.ecouteurs).trim(),
			`Son : ${R.son.contextesAudio} contexte(s) audio, ${R.son.balises} balise(s) audio${R.videos.length ? ` · vidéos : ${grouper(R.videos).join(' ; ')}` : ''}`,
			'',
			'Chargement',
			`  LCP ${R.lcp}`,
			liste('poids', R.poids) + (R.poidsInconnus ? ` (${R.poidsInconnus} fichier(s) de poids inconnu, autre domaine)` : ''),
			liste('plus gros fichiers', R.plusGros),
			`  ${R.fluidite}`,
			'',
			"Rappel : on reprend les procédés (rythme, mécanique, type d'effet), jamais le code, les images, les modèles, les textes ni l'identité du site.",
		];
		return lignes.filter((l, i) => l !== '' || lignes[i - 1] !== '').filter((l) => l !== undefined && l !== false).join('\n') + this.nouveauxProblemes();
	}

	// --- accessibilité ---

	// Contraste mesuré sur l'image réelle : on masque le texte, on photographie ce qu'il y a derrière
	// (dégradé, image, vidéo, scène 3D), puis on compare la couleur du texte aux pixels de son fond.
	async contrastes() {
		const textes = await this.page.evaluate(textesVisibles);
		if (!textes.length) return [];
		const style = await this.page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}' });
		await pause(150);
		const fond = await this.photo({ type: 'png' });
		await style.evaluate((n) => n.remove());
		const dpr = await this.page.evaluate(() => devicePixelRatio);
		const p = await this.browser.newPage();
		const resultats = await p.evaluate(
			async ({ src, textes, dpr }) => {
				const img = new Image();
				img.src = src;
				await img.decode();
				const c = new OffscreenCanvas(img.width, img.height);
				const ctx = c.getContext('2d');
				ctx.drawImage(img, 0, 0);
				const lum = ([r, g, b]) => {
					const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
					return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
				};
				return textes.map((t) => {
					const x = Math.round(t.x * dpr);
					const y = Math.round(t.y * dpr);
					const w = Math.max(1, Math.round(t.w * dpr));
					const h = Math.max(1, Math.round(t.h * dpr));
					const d = ctx.getImageData(x, y, Math.min(w, img.width - x), Math.min(h, img.height - y)).data;
					const lt = lum(t.couleur);
					const ratios = [];
					const pas = Math.max(1, Math.floor(Math.sqrt((w * h) / 400)));
					for (let yy = 0; yy < h; yy += pas)
						for (let xx = 0; xx < w; xx += pas) {
							const i = (yy * w + xx) * 4;
							if (i + 2 >= d.length) continue;
							const lf = lum([d[i], d[i + 1], d[i + 2]]);
							ratios.push((Math.max(lt, lf) + 0.05) / (Math.min(lt, lf) + 0.05));
						}
					ratios.sort((a, b) => a - b);
					// Le pire dixième du fond : un texte doit rester lisible sur ses zones les moins favorables.
					const ratio = ratios.length ? ratios[Math.floor(ratios.length * 0.1)] : 21;
					return { ...t, ratio: Math.round(ratio * 10) / 10 };
				});
			},
			{ src: `data:image/png;base64,${fond.toString('base64')}`, textes, dpr },
		);
		await p.context().close();
		return resultats.filter((t) => t.ratio < t.seuil);
	}

	async accessibilite() {
		const lignes = [`accessibilité de ${this.page.url()} · ${this.entete(await this.scan())}`];
		// 1. axe-core, l'audit de référence, sur toute la page.
		let source;
		try {
			const req = createRequire(join(process.cwd(), 'package.json'));
			source = await readFile(req.resolve('axe-core/axe.min.js'), 'utf8');
		} catch {
			lignes.push("axe-core introuvable dans ce projet : audit des rôles, noms et structure non fait. Lance : npm i -D axe-core");
		}
		if (source) {
			await this.page.addScriptTag({ content: source }).catch(() => this.page.evaluate(source));
			const r = await this.page.evaluate(async () => {
				const res = await window.axe.run(document, { resultTypes: ['violations'] });
				return { version: window.axe.version, violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, aide: v.help, n: v.nodes.length, cibles: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })) };
			});
			const ordre = { critical: 0, serious: 1, moderate: 2, minor: 3 };
			const nomImpact = { critical: 'critique', serious: 'grave', moderate: 'moyen', minor: 'mineur' };
			r.violations.sort((a, b) => ordre[a.impact] - ordre[b.impact]);
			lignes.push(`axe-core ${r.version} (toute la page) : ${r.violations.length ? `${r.violations.length} règle(s) non respectée(s)` : 'aucun problème'}`);
			for (const v of r.violations) lignes.push(`  [${nomImpact[v.impact] ?? v.impact}] ${v.id} · ${v.aide} · ${v.n} élément(s) : ${v.cibles.join(' ; ')}`);
		}
		// 2. Contraste sur le fond réellement affiché, à l'écran courant.
		const faibles = await this.contrastes();
		lignes.push(`contraste mesuré sur l'image réelle (écran courant) : ${faibles.length ? `${faibles.length} texte(s) sous le seuil` : 'tous les textes au-dessus du seuil'}`);
		for (const t of faibles.slice(0, 15)) lignes.push(`  « ${t.texte} » ${t.nom} · ${t.ratio}:1 (minimum ${t.seuil}:1)`);
		// 3. Cibles tactiles.
		const cibles = await this.page.evaluate(ciblesTactiles);
		const graves = cibles.filter((c) => c.grave);
		lignes.push(`cibles tactiles à l'écran : ${graves.length} sous 24 px (non conforme WCAG 2.5.8), ${cibles.length - graves.length} entre 24 et 44 px (en dessous du confort au doigt)`);
		for (const c of [...graves, ...cibles.filter((x) => !x.grave)].slice(0, 12)) lignes.push(`  ${c.ref ? `@${c.ref} ` : ''}"${c.nom}" ${c.w}×${c.h}${c.grave ? ' · trop petit' : ''}`);
		lignes.push("à compléter : « pilote touche Tab » (ordre et focus visible) et « pilote ouvre <url> --reduit » puis « pilote tour » (mouvement réduit). Le contraste et les cibles se vérifient écran par écran : « pilote va 50% » puis relance.");
		return lignes.join('\n') + this.nouveauxProblemes();
	}
}
