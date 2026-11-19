// Fonctions exécutées dans la page du site (passées à page.evaluate) : elles ne voient que le navigateur.

// Liste les éléments manipulables et leur donne une référence stable (@eN) tant qu'ils restent dans la page.
export function scanner() {
	const P = (window.__pilote ??= { n: 0, ids: new WeakMap(), els: new Map() });
	const SEL =
		'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=slider],[role=checkbox],[role=switch],[role=menuitem],[tabindex]:not([tabindex="-1"]),canvas,video,[contenteditable=true]';
	const ROLES = { A: 'link', BUTTON: 'button', SELECT: 'select', TEXTAREA: 'textbox', SUMMARY: 'button', CANVAS: 'canvas', VIDEO: 'video' };
	const items = [];
	for (const el of document.querySelectorAll(SEL)) {
		const r = el.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) continue;
		const st = getComputedStyle(el);
		if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
		let ref = P.ids.get(el);
		if (!ref) {
			ref = `e${++P.n}`;
			P.ids.set(el, ref);
			P.els.set(ref, new WeakRef(el));
		}
		let role = el.getAttribute('role') || ROLES[el.tagName];
		if (!role && el.tagName === 'INPUT') role = { checkbox: 'checkbox', radio: 'radio', range: 'slider', submit: 'button', button: 'button' }[el.type] || 'textbox';
		role ||= el.tagName.toLowerCase();
		const nom = (el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText || el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('placeholder') || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60);
		const visible = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
		items.push({ ref, role, nom, w: Math.round(r.width), h: Math.round(r.height), visible });
	}
	// Section courante : le dernier titre passé au-dessus de 60 % de la hauteur de l'écran.
	let section = '';
	for (const h of document.querySelectorAll('h1,h2,h3')) {
		if (h.getBoundingClientRect().top < innerHeight * 0.6) section = h.innerText.replace(/\s+/g, ' ').trim().slice(0, 60);
	}
	return { items, y: Math.round(scrollY), hauteur: Math.max(0, document.documentElement.scrollHeight - innerHeight), section };
}

// Résout une cible (@e4, @e4:0.2,0.8) en point à l'écran. Fait défiler jusqu'à l'élément s'il est hors écran,
// et refuse si un autre élément le couvre à cet endroit.
export function pointDeCible({ ref, fx, fy }) {
	const el = window.__pilote?.els.get(ref)?.deref();
	if (!el || !el.isConnected) return { erreur: `@${ref} n'existe plus : relance « pilote regarde »` };
	let r = el.getBoundingClientRect();
	if (r.bottom < 0 || r.top > innerHeight) {
		el.scrollIntoView({ block: 'center', behavior: 'instant' });
		r = el.getBoundingClientRect();
	}
	const x = r.left + r.width * fx;
	const y = r.top + r.height * fy;
	const dessus = document.elementFromPoint(x, y);
	if (dessus && dessus !== el && !el.contains(dessus) && !dessus.contains(el)) {
		const nom = dessus.tagName.toLowerCase() + (dessus.id ? `#${dessus.id}` : '') + (dessus.classList[0] ? `.${dessus.classList[0]}` : '');
		return { erreur: `@${ref} est couvert par ${nom} à ce point` };
	}
	return { x: Math.round(x), y: Math.round(y) };
}

// Démarre l'enregistrement : durée de chaque image, images longues (avec le script responsable), décalages, réaction aux actions.
export function debutMesure() {
	const m = (window.__piloteMesure = { images: [], longues: [], cls: 0, reaction: 0, stop: false, obs: [] });
	let prec = performance.now();
	const boucle = (t) => {
		m.images.push(t - prec);
		prec = t;
		if (!m.stop) requestAnimationFrame(boucle);
	};
	requestAnimationFrame(boucle);
	const observe = (type, f, extra = {}) => {
		try {
			const o = new PerformanceObserver((l) => l.getEntries().forEach(f));
			o.observe({ type, ...extra });
			m.obs.push(o);
		} catch {}
	};
	observe('long-animation-frame', (e) => {
		const s = [...(e.scripts || [])].sort((a, b) => b.duration - a.duration)[0];
		m.longues.push({ d: Math.round(e.duration), script: s ? `${s.sourceURL || s.invoker || '?'} (${Math.round(s.duration)} ms)` : '' });
	});
	observe('layout-shift', (e) => {
		if (!e.hadRecentInput) m.cls += e.value;
	});
	observe('event', (e) => (m.reaction = Math.max(m.reaction, e.duration)), { durationThreshold: 16 });
}

export function finMesure() {
	const m = window.__piloteMesure;
	if (!m) return null;
	m.stop = true;
	m.obs.forEach((o) => o.disconnect());
	return { images: m.images.slice(2), longues: m.longues, cls: m.cls, reaction: m.reaction };
}

// Carte graphique vue par la page, WebGPU, et la scène 3D si le site expose window.__pilote3d().
export function infosGraphiques() {
	let gpu = 'aucun WebGL';
	try {
		const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
		const d = gl.getExtension('WEBGL_debug_renderer_info');
		gpu = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
	} catch {}
	let scene = null;
	try {
		if (typeof window.__pilote3d === 'function') scene = window.__pilote3d();
	} catch (e) {
		scene = { erreur: String(e) };
	}
	return { gpu, webgpu: 'gpu' in navigator, scene };
}

// Élément qui a le focus clavier, et s'il est visiblement marqué.
export function focus() {
	const el = document.activeElement;
	if (!el || el === document.body) return null;
	const ref = window.__pilote?.ids.get(el);
	const st = getComputedStyle(el);
	const marque = (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) || st.boxShadow !== 'none';
	const nom = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
	return { ref, nom, marque };
}

// Écran de chargement encore affiché : un calque qui couvre l'écran au centre, nommé « loader » ou montrant un compteur.
export function ecranDeChargement() {
	for (const el of document.elementsFromPoint(innerWidth / 2, innerHeight / 2)) {
		const st = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		if (!['fixed', 'absolute'].includes(st.position) || r.width < innerWidth * 0.8 || r.height < innerHeight * 0.8) continue;
		if (Number(st.opacity) === 0 || st.visibility === 'hidden') continue;
		const nom = `${el.id} ${typeof el.className === 'string' ? el.className : ''}`;
		const texte = (el.innerText || '').replace(/\s+/g, '');
		if (/load|splash|progress|intro/i.test(nom) || /^\d{1,3}\s*%?$/.test(texte)) {
			return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList[0] ? `.${el.classList[0]}` : '') + (texte && texte.length < 12 ? ` « ${texte} »` : '');
		}
	}
	return null;
}

// Textes visibles à l'écran : position, couleur et taille, pour vérifier leur contraste sur l'image réelle.
export function textesVisibles() {
	const items = [];
	for (const el of document.body.querySelectorAll('*')) {
		if (items.length >= 80) break;
		const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
		if (!texte) continue;
		const r = el.getBoundingClientRect();
		if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
		const st = getComputedStyle(el);
		if (st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
		const m = st.color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
		if ((m[3] ?? 1) < 0.1) continue;
		const taille = parseFloat(st.fontSize);
		const gras = Number(st.fontWeight) >= 700;
		items.push({
			texte: texte.slice(0, 40),
			nom: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList[0] ? `.${el.classList[0]}` : ''),
			x: Math.max(0, r.left),
			y: Math.max(0, r.top),
			w: Math.min(r.width, innerWidth - Math.max(0, r.left)),
			h: Math.min(r.height, innerHeight - Math.max(0, r.top)),
			couleur: m.slice(0, 3),
			seuil: taille >= 24 || (taille >= 18.66 && gras) ? 3 : 4.5,
		});
	}
	return items;
}

// Cibles tactiles visibles trop petites. Les liens dans une phrase sont exemptés (règle WCAG 2.5.8).
export function ciblesTactiles() {
	const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=checkbox],[role=switch],[role=slider]';
	const out = [];
	for (const el of document.querySelectorAll(SEL)) {
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
		const st = getComputedStyle(el);
		if (st.visibility === 'hidden' || st.display === 'none') continue;
		const parent = el.parentElement;
		if (el.tagName === 'A' && st.display === 'inline' && parent && parent.innerText.trim().length > el.innerText.trim().length + 10) continue;
		const min = Math.min(r.width, r.height);
		if (min >= 44) continue;
		const ref = window.__pilote?.ids.get(el);
		const nom = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
		out.push({ ref, nom, w: Math.round(r.width), h: Math.round(r.height), grave: min < 24 });
	}
	return out;
}
