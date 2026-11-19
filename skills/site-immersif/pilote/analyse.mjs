// Analyse d'un site de référence : fonctions exécutées dans sa page.
// `instrumenter` s'installe avant le chargement (addInitScript) ; les autres lisent la recette une fois la page chargée.

// Observe sans rien changer au rendu : contextes de dessin, appels de dessin, passes, textures, shaders, WebGPU, son, transitions de vue.
export function instrumenter() {
	const A = (window.__piloteAnalyse = { contextes: [], dessins: 0, passes: 0, textures: 0, textureMax: 0, shaders: [], webgpu: false, audio: 0, transitions: 0, vus: {} });
	const getContext = HTMLCanvasElement.prototype.getContext;
	const connus = new WeakSet();
	HTMLCanvasElement.prototype.getContext = function (type, ...reste) {
		const ctx = getContext.call(this, type, ...reste);
		if (ctx && !connus.has(ctx)) {
			connus.add(ctx);
			A.contextes.push({ type, canvas: this });
			if (/webgl/.test(type)) espionner(ctx);
		}
		return ctx;
	};
	function envelopper(gl, nom, f) {
		if (typeof gl[nom] !== 'function') return;
		const o = gl[nom].bind(gl);
		gl[nom] = (...a) => {
			f(a);
			return o(...a);
		};
	}
	function espionner(gl) {
		for (const nom of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) envelopper(gl, nom, () => A.dessins++);
		envelopper(gl, 'bindFramebuffer', (a) => a[1] && A.passes++);
		const taille = (w, h) => {
			A.textures++;
			A.textureMax = Math.max(A.textureMax, Number(w) || 0, Number(h) || 0);
		};
		envelopper(gl, 'texImage2D', (a) => (a.length >= 8 ? taille(a[3], a[4]) : taille(a[5]?.naturalWidth || a[5]?.videoWidth || a[5]?.width, a[5]?.naturalHeight || a[5]?.videoHeight || a[5]?.height)));
		envelopper(gl, 'texStorage2D', (a) => taille(a[3], a[4]));
		envelopper(gl, 'compressedTexImage2D', (a) => taille(a[3], a[4]));
		envelopper(gl, 'shaderSource', (a) => A.shaders.length < 80 && A.shaders.push(String(a[1])));
	}
	if (navigator.gpu) {
		const req = navigator.gpu.requestAdapter.bind(navigator.gpu);
		navigator.gpu.requestAdapter = (...a) => ((A.webgpu = true), req(...a));
	}
	for (const nom of ['AudioContext', 'webkitAudioContext']) {
		const AC = window[nom];
		if (AC)
			window[nom] = class extends AC {
				constructor(...a) {
					super(...a);
					A.audio++;
				}
			};
	}
	if (document.startViewTransition) {
		const svt = document.startViewTransition.bind(document);
		document.startViewTransition = (...a) => (A.transitions++, svt(...a));
	}
}

// Relevé à une position du scroll : les animations en cours (CSS, WAAPI, GSAP), cumulées sur tout le parcours.
export function echantillon() {
	const A = window.__piloteAnalyse;
	if (!A) return;
	const decrire = (el) => (el && el.tagName ? el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList?.length ? `.${[...el.classList].slice(0, 2).join('.')}` : '') : '');
	const noter = (cle, v) => {
		if (!A.vus[cle]) A.vus[cle] = { ...v, nb: 0 };
		A.vus[cle].nb++;
	};
	for (const an of document.getAnimations()) {
		const t = an.effect?.getTiming?.() ?? {};
		const props = [...new Set((an.effect?.getKeyframes?.() ?? []).flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))];
		const type = an.constructor.name === 'CSSTransition' ? 'transition CSS' : an.constructor.name === 'CSSAnimation' ? 'animation CSS' : 'WAAPI';
		const timeline = an.timeline && an.timeline !== document.timeline ? ` · liée au scroll (${an.timeline.constructor.name})` : '';
		noter(`${type}|${an.animationName || an.transitionProperty || ''}|${t.duration}|${t.easing}|${props}`, {
			type,
			nom: an.animationName || an.transitionProperty || '',
			duree: t.duration,
			courbe: t.easing,
			proprietes: props.join(','),
			cible: decrire(an.effect?.target),
			timeline,
		});
	}
	const gsap = window.gsap;
	if (gsap?.globalTimeline?.getChildren) {
		const CONTROLE = new Set(['ease', 'duration', 'delay', 'stagger', 'onComplete', 'onUpdate', 'onStart', 'scrollTrigger', 'repeat', 'yoyo', 'overwrite', 'immediateRender', 'paused', 'id', 'data', 'lazy', 'callbackScope', 'runBackwards', 'startAt', 'parent', 'inherit', 'reversed', 'onReverseComplete', 'onRepeat', 'repeatDelay', 'keyframes', 'force3D', 'onCompleteParams', 'onReverseCompleteParams', 'onUpdateParams', 'onStartParams', 'onRepeatParams', 'onInterrupt', 'yoyoEase', 'smoothOrigin']);
		for (const tw of gsap.globalTimeline.getChildren(true, true, false)) {
			const v = tw.vars || {};
			const courbe = typeof v.ease === 'string' ? v.ease : v.ease ? 'fonction' : 'défaut (power1.out)';
			const props = Object.keys(v).filter((k) => !CONTROLE.has(k));
			if (tw.duration() === 0 || !props.length) continue; // gsap.set, appels différés : pas du mouvement
			const cibles = tw.targets?.() ?? [];
			const stagger = v.stagger ? ` · décalage ${typeof v.stagger === 'object' ? JSON.stringify(v.stagger) : v.stagger}` : '';
			noter(`gsap|${tw.duration()}|${courbe}|${props}|${stagger}`, {
				type: 'GSAP',
				nom: '',
				duree: Math.round(tw.duration() * 1000),
				courbe: courbe + stagger,
				proprietes: props.join(','),
				cible: `${cibles.length} cible(s) ${decrire(cibles[0])}`,
				timeline: v.scrollTrigger ? ' · scrollTrigger' : '',
			});
		}
	}
}

// Appels de dessin par image, mesurés pendant `ms`.
export async function dessinsParImage(ms) {
	const A = window.__piloteAnalyse;
	if (!A) return null;
	const d0 = A.dessins;
	const p0 = A.passes;
	let images = 0;
	let fin = false;
	const boucle = () => {
		images++;
		if (!fin) requestAnimationFrame(boucle);
	};
	requestAnimationFrame(boucle);
	await new Promise((r) => setTimeout(r, ms));
	fin = true;
	return { dessins: Math.round((A.dessins - d0) / Math.max(1, images)), passes: Math.round((A.passes - p0) / Math.max(1, images)) };
}

// La recette lisible une fois la page chargée et parcourue.
export async function recette() {
	const A = window.__piloteAnalyse ?? { contextes: [], shaders: [], vus: {} };
	const decrire = (el) => (el && el.tagName ? el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList?.length ? `.${[...el.classList].slice(0, 2).join('.')}` : '') : '');
	const vh = innerHeight;
	const R = {};

	// Bibliothèques : globales, marques dans le DOM, puis signatures dans le code des scripts.
	const g = window.gsap;
	const globalesGsap = g?.core?.globals?.() ?? {};
	R.globales = {
		gsap: g?.version,
		pluginsGsap: Object.keys(globalesGsap).filter((k) => /^[A-Z]/.test(k) && !/^(Tween|Timeline)(Max|Lite)$|^(Linear|Power\d|Quad|Cubic|Quart|Quint|Strong|Elastic|Bounce|Expo|Circ|Sine|Back|SteppedEase)$|^(Attr|EndArray|RoundProps|Modifiers|Snap|CSS)Plugin$/.test(k)),
		three: window.__THREE__,
		lenis: window.lenis ? { lerp: window.lenis.options?.lerp, duration: window.lenis.options?.duration, smoothWheel: window.lenis.options?.smoothWheel, syncTouch: window.lenis.options?.syncTouch } : undefined,
		barba: !!window.barba,
		swup: !!window.swup,
		pixi: window.PIXI?.VERSION,
		lottie: !!(window.lottie || window.bodymovin),
	};
	const html = document.documentElement;
	R.dom = [
		html.classList.contains('lenis') && 'Lenis (classe lenis)',
		html.classList.contains('has-scroll-smooth') && 'Locomotive Scroll',
		document.querySelector('[data-scroll-container]') && 'Locomotive Scroll (data-scroll)',
		document.querySelector('[data-barba]') && 'Barba.js',
		document.querySelector('spline-viewer') && 'Spline (spline-viewer)',
		document.querySelector('lottie-player,dotlottie-player,dotlottie-wc') && 'Lottie',
		html.dataset.wfSite && 'Webflow',
		document.querySelector('[data-framer-name],[data-framer-component-type]') && 'Framer',
		document.getElementById('__NEXT_DATA__') || document.querySelector('script[src*="/_next/"]') ? 'Next.js' : null,
		window.__NUXT__ && 'Nuxt',
		document.querySelector('astro-island') && 'Astro',
		document.querySelector('[data-sveltekit-preload-data],[data-sveltekit-reload]') && 'SvelteKit',
	].filter(Boolean);
	const SIGNATURES = {
		GSAP: /GreenSock|gsap\.registerPlugin|_gsScope/,
		ScrollTrigger: /ScrollTrigger/,
		SplitText: /SplitText/,
		'Three.js': /__THREE__|WebGLRenderer/,
		'React Three Fiber': /react-three|@react-three/,
		'postprocessing / EffectComposer': /EffectComposer|BloomEffect|UnrealBloomPass/,
		Lenis: /lenis/i,
		'Locomotive Scroll': /locomotive/i,
		'Barba.js': /barba/i,
		Swup: /swup/i,
		'Motion / Framer Motion': /framer-motion|framerAppearId|motion-dom/,
		Rive: /rive-app|rive\.wasm/,
		Spline: /splinetool|splinecode/,
		Lottie: /bodymovin|lottie/i,
		PixiJS: /PIXI|pixi\.js/,
		OGL: /\bogl\b.{0,40}Renderer|from"ogl"/,
		'Theatre.js': /@theatre/,
		'Physique (Rapier, Cannon, Matter)': /rapier|cannon-es|Matter\.Engine/,
		'Son (Howler, Tone)': /howler|Tone\.Transport/i,
		Swiper: /swiper/i,
	};
	R.code = [];
	const scripts = performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script' || /\.m?js(\?|$)/.test(e.name));
	let lus = 0;
	const trouves = new Set();
	for (const s of scripts.slice(0, 25)) {
		try {
			const txt = await (await fetch(s.name)).text();
			lus++;
			for (const [nom, re] of Object.entries(SIGNATURES)) if (re.test(txt)) trouves.add(nom);
		} catch {}
	}
	for (const s of document.querySelectorAll('script:not([src])')) for (const [nom, re] of Object.entries(SIGNATURES)) if (re.test(s.textContent)) trouves.add(nom);
	R.code = [...trouves];
	R.scriptsLus = `${lus}/${scripts.length}`;

	// Scroll : réglages ScrollTrigger lisibles, éléments collants.
	const ST = window.ScrollTrigger || globalesGsap.ScrollTrigger;
	R.scrollTriggers = ST?.getAll
		? ST.getAll()
				.slice(0, 40)
				.map((st) => ({
					declencheur: decrire(st.trigger),
					debut: Math.round(st.start),
					fin: Math.round(st.end),
					longueur: `${Math.round(((st.end - st.start) / vh) * 100)} % d'écran`,
					epingle: !!st.pin,
					scrub: st.vars?.scrub ?? false,
					actions: st.vars?.toggleActions,
					snap: !!st.vars?.snap,
					horizontal: !!st.vars?.containerAnimation,
					animation: st.animation ? `${Math.round(st.animation.duration() * 1000)} ms` : '',
				}))
		: null;
	R.scrollTriggerAccessible = !!ST?.getAll;
	let collants = 0;
	let fixes = 0;
	let curseur = '';
	const tous = [...document.body.querySelectorAll('*')].slice(0, 4000);
	for (const el of tous) {
		const st = getComputedStyle(el);
		if (st.position === 'sticky') collants++;
		if (st.position === 'fixed') {
			fixes++;
			const r = el.getBoundingClientRect();
			if (st.pointerEvents === 'none' && r.width > 4 && r.width < 120 && Math.abs(r.width - r.height) < 4) curseur = `curseur personnalisé probable : ${decrire(el)} ${Math.round(r.width)} px`;
		}
	}
	if (!curseur && getComputedStyle(document.body).cursor === 'none') curseur = 'curseur système masqué (cursor: none)';
	R.collants = collants;
	R.fixes = fixes;
	R.curseur = curseur;

	// CSS : courbes, durées, scroll-driven, transitions de vue, effets coûteux.
	const css = { courbes: {}, durees: {}, keyframes: 0, scrollTimeline: 0, viewTransition: false, blend: 0, backdrop: 0, clipPath: 0, snap: 0, illisibles: 0 };
	const parcourir = (regles) => {
		for (const r of regles) {
			if (r.cssRules && !(r instanceof CSSKeyframesRule)) parcourir(r.cssRules);
			if (r instanceof CSSKeyframesRule) css.keyframes++;
			if (/^@view-transition/.test(r.cssText)) css.viewTransition = true;
			const s = r.style;
			if (!s) continue;
			for (const c of [s.transitionTimingFunction, s.animationTimingFunction]) if (c) for (const x of c.split(/,(?![^(]*\))/)) css.courbes[x.trim()] = (css.courbes[x.trim()] || 0) + 1;
			for (const d of [s.transitionDuration, s.animationDuration]) if (d) for (const x of d.split(',')) css.durees[x.trim()] = (css.durees[x.trim()] || 0) + 1;
			if (s.animationTimeline || s.getPropertyValue('view-timeline-name') || s.getPropertyValue('scroll-timeline-name')) css.scrollTimeline++;
			if (s.mixBlendMode && s.mixBlendMode !== 'normal') css.blend++;
			if (s.backdropFilter && s.backdropFilter !== 'none') css.backdrop++;
			if (s.clipPath && s.clipPath !== 'none') css.clipPath++;
			if (s.scrollSnapType && s.scrollSnapType !== 'none') css.snap++;
		}
	};
	for (const f of document.styleSheets) {
		try {
			parcourir(f.cssRules);
		} catch {
			css.illisibles++;
		}
	}
	const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`);
	R.css = { ...css, courbes: top(css.courbes, 8), durees: top(css.durees, 8) };
	R.animations = Object.values(A.vus).sort((a, b) => b.nb - a.nb).slice(0, 30);

	// Direction artistique : palette pondérée par la surface, polices, typographie des titres.
	const hex = (c) => {
		const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
		if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
		return '#' + [m[1], m[2], m[3]].map((x) => Math.round(Number(x)).toString(16).padStart(2, '0')).join('');
	};
	const fonds = {};
	const textes = {};
	for (const el of tous) {
		const r = el.getBoundingClientRect();
		if (!r.width || !r.height) continue;
		const st = getComputedStyle(el);
		const f = hex(st.backgroundColor);
		if (f) fonds[f] = (fonds[f] || 0) + Math.min(r.width * r.height, innerWidth * vh);
		const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
		const t = texte && hex(st.color);
		if (t) textes[t] = (textes[t] || 0) + texte.length;
	}
	const fondPage = hex(getComputedStyle(document.body).backgroundColor) || hex(getComputedStyle(html).backgroundColor);
	R.palette = { fondPage, fonds: top(fonds, 6).map((x) => x.split(' ')[0]), textes: top(textes, 4).map((x) => x.split(' ')[0]) };
	R.polices = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')} ${f.weight}${f.style !== 'normal' ? ' ' + f.style : ''}`))].slice(0, 12);
	R.typo = {};
	for (const sel of ['h1', 'h2', 'p', 'a', 'button']) {
		const visibles = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0);
		// Titres : le plus grand ; texte courant : le premier.
		const el = /^h/.test(sel) ? visibles.sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0] : visibles[0];
		if (!el) continue;
		const st = getComputedStyle(el);
		R.typo[sel] = `${st.fontFamily.split(',')[0].replace(/"/g, '')} ${st.fontWeight} · ${st.fontSize} / ${st.lineHeight} · espacement ${st.letterSpacing}${st.textTransform !== 'none' ? ' · ' + st.textTransform : ''}`;
	}

	let geant = null;
	for (const el of tous) {
		if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
		const t = parseFloat(getComputedStyle(el).fontSize);
		if (el.getBoundingClientRect().height > 0 && (!geant || t > geant.t)) geant = { t, el };
	}
	if (geant) {
		const st = getComputedStyle(geant.el);
		R.typo['plus grand texte'] = `${decrire(geant.el)} « ${geant.el.innerText.replace(/\s+/g, ' ').trim().slice(0, 30)} » · ${st.fontFamily.split(',')[0].replace(/"/g, '')} ${st.fontWeight} · ${Math.round(geant.t)}px (${Math.round((geant.t / innerWidth) * 1000) / 10} vw)`;
	}

	// Structure : sections de premier niveau, hauteur en écrans, titre.
	const candidats = [...document.querySelectorAll('section, [data-section], main > *, body > div > *')].filter((el) => el.getBoundingClientRect().height > vh * 0.4);
	const sections = candidats.filter((el) => !candidats.some((o) => o !== el && o.contains(el))).slice(0, 30);
	R.hauteurEcrans = Math.round((document.documentElement.scrollHeight / vh) * 10) / 10;
	R.sections = sections.map((el) => {
		const h = el.querySelector('h1,h2,h3');
		return `${decrire(el)} · ${Math.round((el.getBoundingClientRect().height / vh) * 100)} % d'écran${h ? ` · « ${h.innerText.replace(/\s+/g, ' ').trim().slice(0, 50)} »` : ''}`;
	});

	// 3D et dessin.
	R.canvas = [...document.querySelectorAll('canvas')].map((c) => {
		const r = c.getBoundingClientRect();
		const ctx = A.contextes.find((x) => x.canvas === c);
		return `${decrire(c)} · ${ctx?.type ?? 'contexte inconnu'} · ${Math.round(r.width)}×${Math.round(r.height)} affiché, ${c.width}×${c.height} dessiné (résolution ×${r.width ? (c.width / r.width).toFixed(2) : '?'})${getComputedStyle(c).position === 'fixed' ? ' · fixe en fond' : ''}`;
	});
	R.webgpu = A.webgpu;
	R.textures = { nombre: A.textures, plusGrande: A.textureMax };
	const materiaux = {};
	const perso = [];
	for (const s of A.shaders) {
		const type = s.match(/#define SHADER_TYPE (\w+)/)?.[1];
		if (type && !/^(Raw)?ShaderMaterial$/.test(type)) materiaux[type] = (materiaux[type] || 0) + 1;
		else perso.push(s);
	}
	R.materiaux = Object.keys(materiaux);
	const PROCEDES = {
		'bruit procédural (noise, fbm)': /snoise|simplex|perlin|cnoise|fbm|noise\s*\(/i,
		raymarching: /raymarch|sdf|march\s*\(/i,
		particules: /gl_PointSize/,
		'réaction à la souris': /mouse|pointer|cursor/i,
		'animé dans le temps': /\b(u_?)?time\b|iTime|uTime/i,
		'lié au scroll': /scroll|progress/i,
		"distorsion d'image": /distort|displace|uTexture|tDiffuse|texture2D\s*\(\s*\w+\s*,\s*uv\s*[+\-*]/i,
		'aberration chromatique': /chromatic|aberration|rgbshift|rgbShift/i,
		'grain / bruit de film': /grain|film/i,
		'flou / bloom': /bloom|blur|gaussian/i,
		'fluide (simulation)': /advect|divergence|vorticity|pressure|curl/i,
		fresnel: /fresnel/i,
		dissolution: /dissolve|threshold/i,
	};
	R.shadersPerso = perso.length;
	R.procedes = Object.entries(PROCEDES)
		.map(([nom, re]) => [nom, perso.filter((s) => re.test(s)).length])
		.filter(([, n]) => n)
		.map(([nom, n]) => `${nom} (${n})`);
	R.son = { contextesAudio: A.audio ?? 0, balises: document.querySelectorAll('audio').length };
	R.transitionsDeVue = A.transitions ?? 0;
	R.videos = [...document.querySelectorAll('video')].map((v) => `${decrire(v)} ${v.autoplay ? 'auto' : ''}${v.loop ? ' boucle' : ''}${v.muted ? ' muette' : ''}`.trim()).slice(0, 8);

	// Chargement : poids par famille, plus gros fichiers, LCP et décalages enregistrés.
	const familles = {};
	const gros = [];
	let inconnus = 0;
	for (const e of performance.getEntriesByType('resource')) {
		const n = e.name.split('?')[0].toLowerCase();
		const fam = /\.(glb|gltf|drc|ktx2|basis|hdr|exr|bin|fbx|obj|usdz)$/.test(n) ? '3D' : /\.(riv|splinecode|lottie)$/.test(n) ? 'animation' : /\.(woff2?|ttf|otf)$/.test(n) ? 'polices' : /\.(mp4|webm|mov|m3u8)$/.test(n) ? 'vidéo' : /\.(mp3|ogg|wav|m4a)$/.test(n) ? 'son' : /\.(png|jpe?g|webp|avif|gif|svg)$/.test(n) || e.initiatorType === 'img' ? 'images' : /\.m?js$/.test(n) || e.initiatorType === 'script' ? 'scripts' : /\.css$/.test(n) || e.initiatorType === 'link' ? 'css' : 'autre';
		const o = e.transferSize || e.encodedBodySize;
		if (!o) inconnus++;
		familles[fam] = (familles[fam] || 0) + o;
		const nom = `${fam} ${e.name.split('/').pop().split('?')[0].slice(0, 50)}`;
		if (!gros.some((x) => x[1] === nom && x[0] >= o)) gros.push([o, nom]);
	}
	const ko = (o) => (o > 1e6 ? `${(o / 1e6).toFixed(1)} Mo` : `${Math.round(o / 1e3)} Ko`);
	R.poids = Object.entries(familles).sort((a, b) => b[1] - a[1]).map(([f, o]) => `${f} ${ko(o)}`);
	R.plusGros = gros.sort((a, b) => b[0] - a[0]).slice(0, 6).map(([o, n]) => `${n} (${ko(o)})`);
	R.poidsInconnus = inconnus;
	return R;
}

// Les shaders écrits pour le site (hors matériaux standard de Three.js), pour comprendre leurs procédés.
export function shadersPerso() {
	const A = window.__piloteAnalyse;
	return (A?.shaders ?? []).filter((s) => {
		const type = s.match(/#define SHADER_TYPE (\w+)/)?.[1];
		return !type || /^(Raw)?ShaderMaterial$/.test(type);
	});
}

// Le plus grand affichage du chargement (LCP), lu avant tout défilement : le parcours le fausserait.
export async function lcp() {
	const decrire = (el) => (el && el.tagName ? el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList?.length ? `.${[...el.classList].slice(0, 2).join('.')}` : '') : '');
	const der = await new Promise((res) => {
		let d = null;
		try {
			new PerformanceObserver((l) => (d = l.getEntries().at(-1))).observe({ type: 'largest-contentful-paint', buffered: true });
		} catch {}
		setTimeout(() => res(d), 100);
	});
	return der ? `${Math.round(der.startTime)} ms · ${decrire(der.element)}` : 'non mesuré';
}
