# Écrire une vidéo : le moteur et le kit

Une vidéo est une page `videos/<nom>.html`. Elle déclare des scènes sur une timeline GSAP ; l'outil de rendu demande ensuite chaque image à une seconde précise. Rien ne dépend de l'horloge réelle : la même seconde donne toujours la même image.

Un exemple complet qui utilise chaque brique : `pub-video doctor` affiche le dossier du skill, et sa démo est dans `demo/videos/demo.html`. C'est une démonstration technique d'un produit inventé. Lis-la pour la syntaxe, pas pour le style.

## Sommaire

1. Squelette d'une page
2. Le temps : temps, mesures, images
3. Scènes
4. Animer : les règles GSAP du moteur
5. Le kit : texte, entrées et sorties, appareils, transitions, caméra, texture
6. Classes CSS prêtes
7. Recettes
8. Pièges
9. Regarder ce qu'on fait

## 1. Squelette d'une page

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="/engine/base.css" />
<link rel="stylesheet" href="../theme.css" />
<style>/* styles propres à cette vidéo */</style>
</head>
<body>
<script type="module">
import { setup } from '/engine/engine.js';
import * as K from '/engine/kit.js';

const { gsap, tl, stage, b, bar, scene, cue, frame, rnd, h, done, W, H } = await setup({
	format: '9:16',      // '9:16' 1080×1920 | '4:5' 1080×1350 | '1:1' 1080×1080 | '16:9' 1920×1080
	fps: 30,
	bpm: 120,            // tempo du morceau (pub-video music scan)
	bars: 15,            // durée en mesures de 4 temps : 15 mesures à 120 BPM = 30 s
	safe: 'universal',   // 'universal' (organique) | 'ads' (pub payante Reels/TikTok) | 'none'
	music: { src: '../audio/music/mixkit-836.mp3', start: 11.04, drop: 5, intro: { until: 5, lowpass: [1500, 12000], lift: 8 } }
});

const accroche = scene('accroche', b(0), b(6), (el, s) => {
	el.style.background = 'var(--ink)';
	const titre = K.text(el, 'Tu vends<br>en ligne ?', 't-hero', { left: '90px', top: '560px', color: '#fff' });
	K.textIn(s, titre, 0, { style: 'slam' });
});
const marque = scene('marque', b(6), b(10), (el, s) => { /* … */ });

K.transition(tl, 'iris', accroche, marque);
await done();
</script>
</body>
</html>
```

`setup()` rend aussi `f`, `FPS`, `BPM`, `DURATION`. `done()` se place à la toute fin : il charge les images, fige les animations et déclare la page prête.

## 2. Le temps : temps, mesures, images

| Fonction | Rend | Usage |
|---|---|---|
| `b(n)` | n temps de la musique, en secondes, calés sur une image | tous les débuts, fins et accents |
| `bar(n)` | n mesures (4 temps) | bornes des scènes |
| `f(n)` | n images | petits décalages (2 images d'avance) |

Toute durée s'écrit en temps : `b(0.5)` est une croche, `b(2)` deux temps. Changer de morceau change `bpm`, et toute la vidéo suit. Une durée d'animation (pas un instant) peut rester en secondes : `duration: 0.6`.

## 3. Scènes

```js
const sc = scene(nom, début, fin, (el, s) => { … }, { pre, post, z });
```

- `el` est le calque de la scène : plein cadre, masqué hors de `[début, fin]`.
- `s` est la timeline de la scène. **Son temps 0 est le début de la scène** : `s.to(x, {…}, b(2))` joue deux temps après le début de la scène.
- `s.cue(t, type, options)` pose un bruitage à `t` (temps de la scène). `cue(t, …)` fait de même en temps absolu.
- `s.frame((lt, t) => { … })` s'exécute à chaque image de la scène : `lt` secondes depuis son début. Pour tout ce qui se calcule (texte tapé à la main, valeur dérivée). Le calcul repart de `lt` à chaque appel, sans rien mémoriser d'une image à l'autre.
- Les scènes se suivent sans trou : la fin de l'une est le début de la suivante. La dernière finit à la durée de la vidéo.
- `tl` est la timeline maîtresse, en temps absolu : elle sert aux transitions et à ce qui traverse plusieurs scènes.

Tout élément se crée avec `h(parent, classes, html, styles)` et se place en pixels dans un cadre de 1080 de large : `h(el, 'abs card', '<b>…</b>', { left: '90px', top: '520px', width: '900px' })`. La classe `abs` le positionne en absolu. Les animations déplacent ensuite l'élément par transformation, autour de cette place.

**Zone sûre.** `const zone = h(el, 'safe')` crée un calque limité à la zone qu'aucune interface ne recouvre. Ce qui doit être lu se place dedans ; les décors et les appareils peuvent déborder. `pub-video sheet <vidéo> --guides` dessine cette zone.

## 4. Animer : les règles GSAP du moteur

Le moteur est GSAP 3 complet (SplitText, CustomEase, DrawSVG, MotionPath, MorphSVG). Six règles le rendent fiable image par image :

1. **Toute animation vit sur une timeline** : `s.to(…)`, `s.fromTo(…)`, `tl.to(…)`. Un `gsap.to()` nu suit l'horloge réelle et n'est pas rendu. `gsap.set()` pour un état initial est permis.
2. **`fromTo` pour toute propriété animée plus d'une fois.** Un `from()` placé après un `to()` sur la même propriété part d'une mauvaise valeur. En cas de doute : `fromTo`, avec les deux valeurs écrites.
3. **Répétitions finies** : `repeat: 3`, jamais `-1`.
4. **Le hasard a une graine** : `const r = rnd(7); r(); r.range(a, z); r.pick(liste)`. Les valeurs se tirent à la construction et se passent aux animations.
5. **Le CSS ne bouge rien** : ni `transition`, ni `animation`, ni `@keyframes`.
6. **Tout fichier est local** : images, polices, musique dans le projet.

Courbes disponibles, par rôle :

| Rôle | Courbe |
|---|---|
| Arrivée (la plupart des cas) | `'swift'`, `'expo.out'`, `'power4.out'` |
| Arrivée d'un objet qui a du poids | `'spring'` (5 % de dépassement), `'springy'` (16 %), `'bouncy'` (25 %), `'back.out(1.4)'` |
| Déplacement qui part et s'arrête à l'écran, caméra | `'glide'`, `'power3.inOut'`, `'expo.inOut'` |
| Sortie | `'exit'`, `'power3.in'` |
| Panneau qui monte | `'drawer'` |
| Valeur qui défile (compteur, frappe) | `'none'`, `'power2.out'` |

Par défaut une animation dure 0,5 s en `power3.out`. `autoAlpha` remplace `opacity` : il masque vraiment l'élément à 0.

## 5. Le kit

Chaque fonction prend d'abord la timeline (`s` d'une scène, ou `tl`), puis l'instant sur cette timeline. La plupart posent leur bruitage : `sfx: false` le coupe, `sfx: 'type'` le remplace, `sfx: { type, v, pitch }` le règle.

### Texte

| Fonction | Effet | Son par défaut |
|---|---|---|
| `K.text(parent, html, classes, styles)` | crée un bloc de texte à lire. Classes : `t-hero` 168 px, `t-title` 112, `t-sub` 72, `t-body` 46, `t-label` 34 ; ajoute `cx` pour centrer sur la largeur | |
| `K.textIn(s, el, at, { style, by, each, from, dur, ease })` | entrée cinétique. `style` : `rise` (monte), `mask` (sort d'un cache, ligne par ligne), `slam` (s'écrase net), `pop` (jaillit), `drop` (tombe), `blur` (se met au point), `fade`. `by` : `words`, `chars`, `lines`. `each` : décalage en secondes. `from` : `start`, `center`, `end`, `edges`, `random` | `slam` → `hit`, `pop` → `pop` |
| `K.textOut(s, el, at, { style, dur })` | sortie : `up`, `down`, `left`, `right`, `fade`, `blur`, `shrink`, `zoom` | |
| `K.type(s, el, 'texte', at, durée, { hold, caret })` | frappe au clavier avec curseur ; rend l'instant de fin | `key` par caractère |
| `K.count(s, el, de, à, at, durée, { prefix, suffix, decimals, step, format, locale, enter })` | nombre qui défile, formaté dans la langue de la page ; il entre de lui-même à son départ, sauf si une entrée est écrite avant `K.count` ou avec `enter: false` | `tick`, puis `ding` |
| `K.mark(s, span, at)` | trait de surligneur derrière un `<span class="mark">` du texte | `swish` |
| `K.scribble(s, cible, at, { kind, color })` | trait à la main autour d'un élément : `underline`, `circle`, `arrow` | `swish` |

Un bloc de texte entre une seule fois avec `textIn`. `mask` et les autres styles ne se mélangent pas sur le même bloc.

### Entrées, sorties, accents

| Fonction | Effet | Son par défaut |
|---|---|---|
| `K.enter(s, éléments, at, { style, each, dir, dist, dur, ease })` | fait entrer un élément ou une liste. `style` : `rise`, `pop`, `slide` (`dir` : left, right, up, down ; invisible avant son départ), `drop`, `zoom`, `grow`, `fade`, `blur`, `flip`, `wipe` | `pop` → `pop`, `slide` et `flip` → `swoosh`, `drop` → `thud`, `zoom` → `hit` |
| `K.leave(s, éléments, at, { style, dur })` | fait sortir : `up`, `down`, `left`, `right`, `fade`, `shrink`, `blur`, `zoom` | muet |
| `K.press(s, el, at)` | appui sur un bouton | `click` |
| `K.stamp(s, el, at, { rot })` | coup de tampon | `stamp` |
| `K.shake(s, el, at, { amp, dur })` | secousse qui s'éteint (impact, erreur) | |
| `K.pulse(s, el, at, { n, scale })` | n battements pour attirer l'œil sur un bouton | |
| `K.draw(s, tracés, at, { dur })` | trace un SVG de 0 à 100 % | `swish` |
| `K.burst(s, parent, x, y, at, { n, colors })` | gerbe de confettis | `pop_big` |
| `K.bars(s, parent, [0.3, 0.6, 1], at, { h, w, color })` | barres de graphique qui poussent | `tick` |

Une liste passée à `enter` reçoit un son par élément (6 au plus), de plus en plus aigu.

### Appareils

```js
const tel = K.phone(el, { shot: '../captures/accueil_full.png', w: 620, y: 420 });   // ou html: '<div>…</div>' pour un écran reconstruit
K.scroll(s, tel, 900, b(2), b(3));                 // fait défiler la capture de 900 px (pixels de l'écran affiché)
K.tap(s, tel.screen, 300, 760, b(6));              // doigt qui appuie à ce point de l'écran
const nav = K.browser(el, { shot: '…', url: 'produit.com', w: 940, h: 600, y: 480 });
const p = K.pointer(s, nav.screen, [[700, 400], [220, 310]], b(3));   // souris qui va cliquer ; p.end = instant du clic
```

**Terminal** (produit en ligne de commande) :

```js
const term = K.terminal(el, { title: 'zsh', y: 420, w: 940 });        // tone: 'light' pour un terminal clair
const fin = term.cmd(s, 'npx outil check', b(1), b(2));               // tapée après l'invite ; rend l'instant de fin
const l1 = term.line('<span class="ok">✓</span> 12 tests passent');   // classes de couleur : ps, dim, ok, err
K.enter(s, l1, fin + b(0.5), { style: 'fade', sfx: 'tick' });
```

Le texte est en `--font-mono` (44 px) ; grossis-le avec `term.el.style.fontSize`. Une fenêtre qui occupe au moins la moitié de la hauteur se lit sur un téléphone.

`K.phone` rend `{ el, screen, img, w, sw, sh }` : `el` est le téléphone entier (à animer), `screen` son écran (repère des coordonnées de `tap`), `sw × sh` la taille de l'écran affiché. Une capture pleine page mesure `img.naturalHeight * tel.sw / img.naturalWidth` pixels de haut une fois affichée : c'est la borne du défilement. Inclinaison en 3D : `s.fromTo(tel.el, { y: 1500, rotationY: -26, rotationX: 16, transformPerspective: 2400 }, { y: 0, rotationY: 5, rotationX: 3, duration: b(2), ease: 'expo.out' }, 0)`.

### Transitions entre scènes

```js
K.transition(tl, type, scèneSortante, scèneEntrante, { dur, dir, colors, x, y });
```

| Type | Ce qu'on voit | Sa cause naturelle | Son |
|---|---|---|---|
| `wipe` | un ou plusieurs aplats de couleur balaient l'écran et cachent la coupe | changement de sujet, couleur de marque | `whoosh` |
| `iris` | la nouvelle scène s'ouvre en cercle depuis un point (`x`, `y`) | un bouton, un logo, un point qu'on vient de toucher | `swoosh` |
| `push` | la nouvelle scène pousse l'ancienne (`dir`) | une suite, une étape après l'autre | `whoosh` |
| `zoom` | la caméra traverse l'ancienne scène | entrer dans un détail, dans un écran | `whoosh_up` |
| `whip` | panoramique filé | énumération rapide, changement de lieu | `whoosh` |
| `flash` | éclair blanc | impact, photo, révélation sur un temps fort | `hit` |
| `fade` | fondu | pause, respiration (rare) | |

La transition se déclare après les deux scènes. Elle anime les calques des scènes, pas leur contenu. Une coupe franche n'a besoin de rien.

### Caméra

```js
const cam = K.camera(el).look(540, 960, 1);      // un monde dans la scène ; la caméra regarde (x, y) au zoom 1
const tel = K.phone(cam.world, { … });           // le contenu se place dans cam.world
cam.to(s, b(4), { x: 540, y: 1200, zoom: 1.6 }, b(2));   // elle avance vers ce point en 2 temps
```

### Fond et texture

- `K.glow(el, [[x%, y%, couleur, taille], …])` : halos de couleur flous derrière une scène.
- `K.grain(stage, { opacity: 0.06 })` : grain de film sur toute la vidéo, une fois, juste après `setup()`.
- `K.icon.<nom>` : pictogrammes au trait (check, x, plus, arrow, up, down, search, chat, bell, heart, star, bolt, lock, shield, clock, user, cart, box, chart, send, play, sparkle, pin, truck). Dans du texte : `<span class="ico">${K.icon.check}</span>`.

## 6. Classes CSS prêtes

Elles prennent leurs couleurs dans `theme.css` (`--bg`, `--surface`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--brand`, `--brand-ink`, `--accent`, `--ok`, `--warn`, `--r`, `--font-display`, `--font-text`, `--font-mono`).

| Classe | Rendu |
|---|---|
| `card` | panneau blanc arrondi, ombré |
| `pill`, `chip` | étiquette en pilule (pleine, ou au contour) |
| `btn` | gros bouton d'action |
| `badge` | pastille (numéro, mot court) |
| `bubble in`, `bubble out` | bulle de message reçue, envoyée |
| `field` | champ de formulaire |
| `toast` | notification : `<div class="ic">icône</div><div><b>titre</b><span>détail</span></div>` |
| `row`, `col` | alignement flex en ligne, en colonne (espacement 24 px, centré) |
| `mark` | mot surligné (sur un `span`) |
| `term` | fenêtre de terminal (créée par `K.terminal`) |

**Noms réservés.** Ces classes, celles du texte (`t`, `t-hero`…) et celles du moteur (`abs`, `cx`, `safe`, `layer`, `scene`, `stage`, `caret`, `ico`, `bar`, `bars`, `bit`, `phone`, `browser`, `pointer`, `scribble`, `tapdot`, `tapring`, `wipe`, `guides`, `term-ln`, `pv-ln`, `pv-wd`, `pv-ch`) ont déjà un style. Les classes propres à ta vidéo prennent des noms à elles : `.ligne-cmd`, `.carte-prix`.

## 7. Recettes

**Titre qui s'écrase sur les temps, puis mot surligné**

```js
const t = K.text(el, 'Vends plus.<br><span class="mark">Sans effort.</span>', 't-title', { left: '90px', top: '600px' });
K.textIn(s, t, 0, { style: 'slam', each: b(0.5) });      // un mot par croche
K.mark(s, t.querySelector('.mark'), b(2));
```

**Démonstration sur téléphone : il arrive, défile, on appuie, une notification tombe**

```js
const tel = K.phone(el, { shot: '../captures/boutique_full.png', w: 600, y: 460 });
s.fromTo(tel.el, { y: 1500, rotationY: -24, rotationX: 14, transformPerspective: 2400 }, { y: 0, rotationY: 4, rotationX: 2, duration: b(2), ease: 'expo.out' }, 0);
s.cue(0.05, 'whoosh_up');
K.scroll(s, tel, 700, b(2), b(3));
K.tap(s, tel.screen, 290, 880, b(5.5));
const n = h(el, 'abs toast', `<div class="ic">${K.icon.check}</div><div><b>Commande reçue</b><span>à l’instant</span></div>`, { left: '100px', top: '300px' });
K.enter(s, n, b(6), { style: 'drop', dist: 400, rot: 0, sfx: 'notif' });
```

**Recherche tapée**

```js
const champ = h(el, 'abs field', '', { left: '90px', top: '700px', width: '900px' });
K.type(s, champ, 'montre homme', b(1), b(2));
```

**L'offre : un impact, un chiffre, une montée avant**

```js
// à la fin de la scène précédente : la montée finit pile sur le changement de scène
s.cue(s.dur - b(0.75), 'riser', { d: b(0.75) });

// dans la scène de l'offre
s.cue(0, 'impact', { hole: 0.25 });                      // la musique respire un quart de seconde avant l'impact
const prix = K.text(el, '0', 't-hero cx', { top: '620px', color: 'var(--accent)' });
K.count(s, prix, 0, 2000, b(0.5), b(1.5), { suffix: ' F', step: 10 });
```

**Appel à l'action**

```js
const bouton = h(el, 'abs btn', `Créer ma boutique <span class="ico">${K.icon.arrow}</span>`, { left: '200px', top: '980px', background: 'var(--brand)', color: 'var(--brand-ink)' });
K.enter(s, bouton, b(1), { style: 'pop' });
K.tap(s, el, 760, 1040, b(3));
K.press(s, bouton, b(3), { sfx: false });
K.burst(s, el, 540, 1000, b(3));
s.cue(b(3), 'final');
```

## 8. Pièges

- **Un texte centré** s'écrit avec la classe `cx` (bloc sur toute la largeur, texte centré), pas avec un `left` calculé.
- **Une largeur fixe fait les lignes.** Donne `width` à un bloc de plusieurs lignes ; les retours voulus s'écrivent `<br>`.
- **`K.count` et `K.type` écrivent le texte final dans l'élément dès la construction** : la mise en page se fait sur la valeur finale.
- **Une ligne faite de plusieurs morceaux** (« agent » puis une commande) : mets-les dans un bloc `display: flex; align-items: baseline` pour qu'un morceau long passe à la ligne sous lui-même, pas sous le premier.
- **Un élément animé deux fois** (il entre, se déplace, sort) : `enter`, puis `s.to(…)`, puis `leave`. Deux `enter` sur le même élément se contredisent.
- **Le premier plan d'une scène est l'élément créé en dernier.** Un texte créé avant un téléphone passe derrière lui.
- **Une capture pleine page pèse lourd** : une image de plus de 8 000 px de haut ralentit le rendu. Recadre-la à la partie montrée : `ffmpeg -i captures/accueil_full.png -vf crop=iw:5200:0:0 assets/img/accueil.png` garde les 5 200 premiers pixels. La capture d'écran simple (`accueil.png`) ne fait qu'un écran de haut : pour défiler, pars de la pleine page.
- **Les polices** : `theme.css` déclare chaque police par un fichier du projet. `pub-video check` refuse un texte rendu avec une police du système.
- **L'erreur « ne s'est pas déclarée prête »** : une exception dans le script, ou `done()` oublié. Le message cite l'erreur du navigateur.

## 9. Regarder ce qu'on fait

```
pub-video stills <vidéo> 3,7.25,12 --scale 1        # images exactes, taille réelle
pub-video sheet <vidéo> --every 0.25 --from 4 --to 8  # une image tous les quarts de seconde d'une scène
pub-video sheet <vidéo>                              # 3 moments par scène
pub-video sheet <vidéo> --transitions --guides       # autour de chaque changement de scène, avec la zone sûre
pub-video preview <vidéo>                            # vidéo demi-taille avec le son, en 20 s environ
```

Ouvre chaque planche avec l'outil de lecture d'image. Une scène se juge sur ses images, jamais sur son code.
