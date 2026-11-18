// capture: look at a live site without touching it. Screenshots at phone (and desktop) resolution,
// plus what the brand is made of: colours, fonts, corner radius, logo, page texts.
// Read-only by construction: it only opens URLs and scrolls. It never clicks, types or submits.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch } from './browser.mjs';
import { num } from './util.mjs';

export const booleans = ['help', 'images', 'dark', 'no-full'];
const HELP = `pub-video capture <url…> [--device mobile|desktop|both] [--crawl 0] [--out captures] [--images] [--lang fr-FR] [--wait 1500] [--dark] [--state session.json]
    Pour chaque page : captures/<nom>.png (écran) et captures/<nom>_full.png (page entière), captures/<nom>.txt (texte visible).
    Pour le site : captures/site.json et un résumé (couleurs dominantes, polices, arrondis, logo, titres, boutons).
    Les polices web chargées par le site sont enregistrées dans captures/fonts/.
    --crawl 8  : suit jusqu'à 8 liens internes depuis la première page (jamais connexion, panier, paiement, admin).
    --images   : télécharge les grandes images du site dans captures/img/ (photos produit).
    --state    : session Playwright (storageState) pour des écrans derrière connexion, avec un compte de test fourni par l'utilisateur.
    Lecture seule : la commande ouvre et fait défiler les pages, elle ne clique sur rien et n'envoie aucun formulaire.`;

const DEVICES = {
	mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
};
const AVOID = /log(in|out)|sign(in|up|out)|connexion|inscription|register|cart|panier|checkout|paiement|payment|admin|account|compte|delete|supprimer|\.(pdf|zip|png|jpe?g|svg|webp|mp4|xml|json)(\?|$)/i;

// Runs in the page: brand tokens and texts.
const READ = `(() => {
	const vis = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 2 && r.height > 2 && c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0.1; };
	const hex = (c) => { const m = /rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/.exec(c); if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null; return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join(''); };
	const tally = (map, k, w) => k && map.set(k, (map.get(k) ?? 0) + w);
	const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
	const bg = new Map(), fg = new Map(), action = new Map(), radius = new Map(), fonts = new Map();
	const all = [...document.querySelectorAll('body *')].slice(0, 4000);
	for (const el of all) {
		if (!vis(el)) continue;
		const c = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const area = Math.min(r.width * r.height, 400000);
		tally(bg, hex(c.backgroundColor), area);
		const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
		if (own) { tally(fg, hex(c.color), own.length * parseFloat(c.fontSize)); tally(fonts, c.fontFamily.split(',')[0].trim().replace(/["']/g, '') + ' ' + c.fontWeight, own.length * parseFloat(c.fontSize)); }
		if (el.matches('button, a, [role=button], input[type=submit]') && hex(c.backgroundColor) && r.width < 700) { tally(action, hex(c.backgroundColor), area); tally(radius, c.borderTopLeftRadius, 1); }
	}
	const rootVars = {};
	for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) if (rule.selectorText && /(^|,)\\s*(:root|html)\\s*(,|$)/.test(rule.selectorText)) for (const p of rule.style) if (p.startsWith('--')) rootVars[p] = rule.style.getPropertyValue(p).trim(); } catch {} }
	const meta = (n) => document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]')?.content ?? null;
	const texts = (sel, n) => [...new Set([...document.querySelectorAll(sel)].filter(vis).map((e) => e.innerText.trim().replace(/\\s+/g, ' ')).filter((t) => t && t.length < 160))].slice(0, n);
	const style = (sel) => { const e = [...document.querySelectorAll(sel)].find(vis); if (!e) return null; const c = getComputedStyle(e); return { family: c.fontFamily, weight: c.fontWeight, size: c.fontSize, tracking: c.letterSpacing, color: hex(c.color) }; };
	const icons = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]')].map((l) => l.href);
	const logos = [...document.querySelectorAll('header img, nav img, img[alt*="logo" i], img[src*="logo" i]')].filter(vis).map((i) => i.currentSrc || i.src).slice(0, 4);
	return {
		url: location.href, title: document.title, lang: document.documentElement.lang || null,
		description: meta('description'), ogTitle: meta('og:title'), ogDescription: meta('og:description'), ogImage: meta('og:image'), themeColor: meta('theme-color'),
		h1: texts('h1', 5), h2: texts('h2', 12), h3: texts('h3', 12), buttons: texts('button, a[class*="btn" i], a[class*="button" i], [role=button], input[type=submit]', 20),
		backgrounds: top(bg, 6), textColors: top(fg, 5), actionColors: top(action, 4), radius: top(radius, 3), fontsUsed: top(fonts, 6),
		heading: style('h1, h2'), body: style('p, li'), button: style('button, a[class*="btn" i], [role=button]'),
		rootVars, icons, logos,
		fontCss: [...document.querySelectorAll('style')].map((s) => s.textContent).filter((t) => t.includes('@font-face')).join('\\n'),
		images: [...document.images].filter((i) => i.naturalWidth >= 300 && vis(i)).map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt })).slice(0, 60),
		links: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href.split('#')[0]).filter((h) => h.startsWith(location.origin)))],
		text: document.body.innerText.replace(/\\n{3,}/g, '\\n\\n').slice(0, 20000)
	};
})()`;

// @font-face rules of a stylesheet → one entry per font file: { file, family, weight, style, range }.
function fontFaces(css, base) {
	const out = [];
	for (const [, b] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
		const prop = (p) => new RegExp(`${p}\\s*:\\s*([^;]+)`).exec(b)?.[1].trim();
		const family = prop('font-family')?.replace(/^["']|["']$/g, '');
		if (!family) continue;
		for (const [, u] of b.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
			try {
				out.push({ file: decodeURIComponent(new URL(u, base).pathname.split('/').pop()), family, weight: prop('font-weight') ?? '400', style: prop('font-style') ?? 'normal', range: prop('unicode-range') });
			} catch {}
		}
	}
	return out;
}
// File type from its first bytes: a server may send an SVG logo from an address ending in .png.
function sniff(buf) {
	const head = buf.subarray(0, 512).toString('latin1');
	if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg/i.test(head) || /<svg[\s>]/i.test(head)) return 'svg';
	if (head.startsWith('\x89PNG')) return 'png';
	if (head.startsWith('\xff\xd8')) return 'jpg';
	if (head.startsWith('GIF8')) return 'gif';
	if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'webp';
	if (head.slice(4, 12) === 'ftypavif') return 'avif';
	if (head.startsWith('\x00\x00\x01\x00')) return 'ico';
	return null;
}

const slug = (url) => {
	const u = new URL(url);
	const p = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).join('-').replace(/[^a-z0-9-]+/gi, '-').slice(0, 60);
	return p || 'accueil';
};

export default async function (_cmd, a) {
	if (a.help || !a._.length) return console.log(HELP);
	const out = resolve(String(a.out ?? 'captures'));
	await mkdir(join(out, 'fonts'), { recursive: true });
	const devices = a.device === 'both' ? ['mobile', 'desktop'] : [String(a.device ?? 'mobile')];
	const lang = String(a.lang ?? Intl.DateTimeFormat().resolvedOptions().locale);
	const browser = await launch();
	const site = { captured: new Date().toISOString().slice(0, 10), pages: [], fonts: [] };
	const faces = [];
	const queue = a._.map((u) => (/^https?:/.test(u) ? u : `https://${u}`));
	const origin = new URL(queue[0]).origin;
	const budget = queue.length + num(a.crawl, 0);
	const seen = new Set();

	for (const dev of devices) {
		const context = await browser.newContext({ ...DEVICES[dev], locale: lang, reducedMotion: 'reduce', colorScheme: a.dark ? 'dark' : 'light', serviceWorkers: 'block', ...(a.state ? { storageState: String(a.state) } : {}) });
		const page = await context.newPage();
		page.on('dialog', (d) => d.dismiss());
		// Keep the web fonts the site loads: they are the brand's real typefaces. Stylesheets are kept to
		// read their @font-face rules, which tell which family and weight each file is.
		page.on('response', async (r) => {
			try {
				if (r.request().resourceType() === 'stylesheet' && r.ok()) {
					const text = await r.text();
					if (text.includes('@font-face')) faces.push(...fontFaces(text, r.url()));
					return;
				}
				if (r.request().resourceType() !== 'font' || !r.ok()) return;
				const name = decodeURIComponent(new URL(r.url()).pathname.split('/').pop());
				if (!/\.(woff2?|ttf|otf)$/i.test(name) || site.fonts.includes(name)) return;
				site.fonts.push(name);
				await writeFile(join(out, 'fonts', name), await r.body());
			} catch {}
		});
		const todo = dev === devices[0] ? [...queue] : site.pages.map((p) => p.url);
		for (let n = 0; todo.length && n < budget; ) {
			const url = todo.shift();
			const key = url.replace(/\/+$/, '');
			if (seen.has(`${dev} ${key}`)) continue;
			seen.add(`${dev} ${key}`);
			n++;
			try {
				await page.goto(url, { waitUntil: 'load', timeout: 45000 });
			} catch (e) {
				console.log(`  ${url} : ${String(e.message).split('\n')[0]}`);
				continue;
			}
			await page.evaluate(() => document.fonts.ready);
			await page.waitForTimeout(num(a.wait, 1500));
			const name = slug(url) + (dev === 'desktop' ? '_desktop' : '');
			await page.screenshot({ path: join(out, `${name}.png`) });
			if (!a['no-full']) {
				// Scroll through once so lazy images load, then take the whole page from the top.
				const h = await page.evaluate(() => document.documentElement.scrollHeight);
				for (let y = 0; y < Math.min(h, 30000); y += 700) {
					await page.evaluate((y) => window.scrollTo(0, y), y);
					await page.waitForTimeout(250);
				}
				await page.evaluate(() => window.scrollTo(0, 0));
				await page.waitForTimeout(700);
				await page.screenshot({ path: join(out, `${name}_full.png`), fullPage: true });
			}
			if (dev !== devices[0]) continue;
			const info = await page.evaluate(READ);
			await writeFile(join(out, `${name}.txt`), `${info.title}\n${info.url}\n\n${info.text}\n`);
			if (info.fontCss) faces.push(...fontFaces(info.fontCss, info.url));
			site.pages.push({ name, ...info, text: undefined, links: undefined, fontCss: undefined });
			console.log(`  ${name.padEnd(24)} ${info.title?.slice(0, 60) ?? ''}`);
			if (num(a.crawl, 0)) for (const l of info.links) if (l.startsWith(origin) && !AVOID.test(l) && !l.includes('?') && !todo.includes(l)) todo.push(l);
		}
		await context.close();
	}
	await browser.close();
	if (!site.pages.length) throw new Error('aucune page n’a pu être ouverte.');

	// Logo and large images, fetched directly (plain GET).
	const home = site.pages[0];
	// Saved as <base>.<real type>: the extension comes from the bytes, then from the address. Returns the file name.
	const grab = async (url, base) => {
		try {
			if (!/^(https?|data):/.test(url)) return null;
			const r = await fetch(url);
			if (!r.ok) return null;
			const buf = Buffer.from(await r.arrayBuffer());
			const ext = sniff(buf) ?? (/\.(png|jpe?g|svg|webp|ico|gif|avif)(\?|$)/i.exec(url)?.[1] ?? 'png').toLowerCase();
			await writeFile(`${base}.${ext}`, buf);
			return `${base.split('/').pop()}.${ext}`;
		} catch {
			return null;
		}
	};
	site.logoFiles = [];
	for (const [i, u] of [...new Set([...home.icons, ...home.logos])].slice(0, 6).entries()) {
		const f = await grab(u, join(out, `logo-${i}`));
		if (f) site.logoFiles.push(f);
	}
	if (a.images) {
		await mkdir(join(out, 'img'), { recursive: true });
		const imgs = [...new Map(site.pages.flatMap((p) => p.images).map((i) => [i.src, i])).values()].sort((p, q) => q.w * q.h - p.w * p.h).slice(0, 40);
		let n = 0;
		for (const [i, im] of imgs.entries()) if (im.src.startsWith('http') && (await grab(im.src, join(out, 'img', String(i).padStart(2, '0'))))) n++;
		console.log(`  ${n} image(s) dans ${join(out, 'img')}`);
	}
	// Which family and weight each saved font file is, and a stylesheet that declares them all.
	// One file declared for several weights is a variable font: it is declared once, over the whole range.
	const groups = new Map();
	for (const f of faces.filter((x) => site.fonts.includes(x.file))) {
		const k = [f.file, f.family, f.style, f.range].join('|');
		const g = groups.get(k) ?? { ...f, weights: new Set() };
		for (const w of String(f.weight).split(/\s+/)) g.weights.add(Number(w) || 400);
		groups.set(k, g);
	}
	site.fontFaces = [...groups.values()].map(({ weights, ...f }) => {
		const ws = [...weights].sort((p, q) => p - q);
		return { ...f, weight: ws.length > 1 ? `${ws[0]} ${ws.at(-1)}` : String(ws[0]) };
	});
	if (site.fontFaces.length) {
		const rule = (f) => `@font-face { font-family: '${f.family}'; src: url('${f.file}'); font-weight: ${f.weight}; font-style: ${f.style}; font-display: block;${f.range ? ` unicode-range: ${f.range};` : ''} }`;
		await writeFile(join(out, 'fonts', 'polices.css'), `/* Polices du site (${home.url}, relevées le ${site.captured}). */\n${site.fontFaces.map(rule).join('\n')}\n`);
	}
	await writeFile(join(out, 'site.json'), JSON.stringify(site, null, 1));

	const f = (o) => (o ? `${o.family.split(',')[0].replace(/["']/g, '')} ${o.weight}, ${o.size}${o.tracking !== 'normal' ? `, espacement ${o.tracking}` : ''}` : '—');
	console.log(`\nMarque relevée sur ${home.url} (${site.captured})`);
	console.log(`  fonds             ${home.backgrounds.join('  ')}`);
	console.log(`  textes            ${home.textColors.join('  ')}`);
	console.log(`  boutons et liens  ${home.actionColors.join('  ') || '—'}${home.themeColor ? `   (theme-color ${home.themeColor})` : ''}`);
	console.log(`  arrondi boutons   ${home.radius.join('  ') || '—'}`);
	console.log(`  titre             ${f(home.heading)}`);
	console.log(`  texte             ${f(home.body)}`);
	console.log(`  polices utilisées ${home.fontsUsed.join(' · ')}`);
	console.log(`  fichiers de police ${site.fonts.length ? `${site.fonts.length} fichier(s) dans ${join(out, 'fonts')}` : 'aucun fichier web chargé (polices du système ou hébergées ailleurs)'}`);
	const byFamily = new Map();
	for (const f of site.fontFaces) byFamily.set(f.family, [...(byFamily.get(f.family) ?? []), `${f.weight.replace(' ', ' à ')}${f.style === 'italic' ? ' italique' : ''}`]);
	for (const [fam, ws] of byFamily) console.log(`    ${fam} : graisses ${[...new Set(ws)].join(', ')}`);
	const unknown = site.fonts.filter((f) => !site.fontFaces.some((x) => x.file === f));
	if (unknown.length) console.log(`    famille inconnue : ${unknown.join(', ')}`);
	if (site.fontFaces.length) console.log(`    déclarations prêtes : ${join(out, 'fonts', 'polices.css')} (cp captures/fonts/* assets/fonts/, puis @import url('assets/fonts/polices.css') en tête de theme.css)`);
	console.log(`  logo              ${site.logoFiles.join(', ') || '—'}`);
	const vars = Object.entries(home.rootVars).filter(([, v]) => /^#|rgb|hsl|oklch/.test(v)).slice(0, 14);
	if (vars.length) console.log(`  variables CSS     ${vars.map(([k, v]) => `${k}: ${v}`).join('; ')}`);
	console.log(`  titre de page     ${home.title}`);
	if (home.h1.length) console.log(`  h1                ${home.h1.join(' | ')}`);
	if (home.buttons.length) console.log(`  boutons           ${home.buttons.slice(0, 8).join(' | ')}`);
	console.log(`\n  ${site.pages.length} page(s) → ${out} (captures .png, textes .txt, site.json)`);
	if (!existsSync(join(process.cwd(), 'theme.css'))) console.log('  (pas de projet ici : crée-le avec « pub-video new <dossier> » pour y ranger ces captures)');
}
