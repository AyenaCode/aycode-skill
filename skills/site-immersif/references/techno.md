# Choisir la techno

À lire aux étapes 0 et 3, et chaque fois qu'un effet demande une techno. Versions relevées le 19/11/2026 dans la documentation officielle : revérifie-les avant d'installer (règle « Documentation du jour »).

## Le principe : la techno la plus légère qui rend l'effet

Monte d'un cran seulement quand le cran du dessous ne suffit pas. Chaque cran coûte du poids et du temps processeur.

| Cran | Techno | Pour | Coût |
|---|---|---|---|
| 1 | CSS : transitions, `@keyframes`, scroll-driven animations (`animation-timeline: scroll()` / `view()`) | apparitions au scroll, barres de progression, parallaxe simple | nul, hors du fil principal |
| 2 | View Transitions API | transitions entre états et entre pages, morph d'un élément vers un autre | nul |
| 3 | Motion (`motion`) | animations d'interface React : gestes, mise en page, ressorts, apparitions et sorties | léger |
| 4 | GSAP + ScrollTrigger (+ Lenis) | scroll cinématique : sections épinglées, timelines longues pilotées par le scroll, SplitText, morph SVG | moyen |
| 5 | Rive | illustrations vectorielles interactives (state machines), personnages, icônes vivantes | moyen |
| 6 | Three.js / React Three Fiber | scène 3D, objets manipulables, caméra qui voyage | lourd |
| 7 | Shaders sur mesure (GLSL, TSL), WebGPU | fluides, particules en masse, distorsions, matières | lourd, à optimiser |

Un site combine souvent les crans 1 à 4 pour l'interface et un seul cran 6-7 pour l'interaction signature. Une seule scène 3D par page, réutilisée de section en section, plutôt que plusieurs canvas.

## Faits de version (19/11/2026)

**CSS scroll-driven animations.** Baseline depuis octobre 2026 : Chrome 115, Safari 26, Firefox 159. Garde une version sans animation pour les navigateurs plus anciens (`@supports (animation-timeline: view())`). [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline)

**View Transitions.** Dans un même document (`document.startViewTransition`) : Chrome 111, Safari 18, Firefox 144. Entre pages (`@view-transition { navigation: auto; }`) : Chrome 126, Safari 18.2, Firefox en préversion seulement ; le site doit rester correct sans.

**Motion.** Paquet `motion` (v14), import React depuis `motion/react`. Licence MIT.

**GSAP.** Paquet `gsap` (v3.15). Gratuit, y compris pour un usage commercial, avec tous ses plugins (SplitText, MorphSVG, ScrollSmoother...). Licence propre à GSAP, pas MIT : interdite seulement pour un outil d'animation visuel concurrent de Webflow. En React : `@gsap/react` et le hook `useGSAP(fn, { scope })`, qui nettoie au démontage ; les animations lancées dans un gestionnaire d'évènement passent par `contextSafe()`. Mouvement réduit : `gsap.matchMedia()` avec la condition `(prefers-reduced-motion: reduce)`.

**Lenis** (scroll fluide). Paquet `lenis` (v1.3, l'ancien `@studio-freight/lenis` est abandonné). Avec GSAP, c'est le ticker de GSAP qui fait tourner Lenis :
```js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```
Sans GSAP, l'option `autoRaf: true` laisse Lenis faire sa propre boucle. Le scroll fluide ne sert que si le concept a besoin de mouvements liés au scroll ; il ne remplace jamais le scroll natif sur une page de lecture.

**Three.js.** r187 (`three@0.187`). `WebGPURenderer` s'importe depuis `three/webgpu` et bascule tout seul en WebGL 2 si WebGPU manque ; les shaders s'écrivent en TSL (`three/tsl`), qui se compile pour les deux. Boucle : `renderer.setAnimationLoop(render)`. Compression des modèles : `@gltf-transform/cli` (`gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`, options exactes dans `optimize -h`).

**React Three Fiber.** `@react-three/fiber` v9 (React 19 requis) et `@react-three/drei` v10. Sur React 18, il faut la paire R3F 8 / drei 9.

**Rive.** `@rive-app/webgl2` (moteur Rive, recommandé) ou `@rive-app/canvas-lite`, plus léger. L'interactivité passe par les state machines (`stateMachines: '<nom>'`).

## Les skills spécialisés

Ils donnent le code juste de chaque techno. Celui qui correspond à la techno choisie est chargé avant d'écrire son code. S'il manque, propose son installation à l'utilisateur (c'est lui qui la valide) ; lis le contenu d'un skill communautaire avant de t'en servir.

| Techno | Skill | Installation | Licence |
|---|---|---|---|
| GSAP, ScrollTrigger, React | `gsap-skills` (officiel GreenSock : core, timeline, scrolltrigger, plugins, utils, react, performance, frameworks) | `npx skills add https://github.com/greensock/gsap-skills` | MIT |
| Motion | AI Kit officiel Motion (skills + MCP) | `npx motion-ai` | — |
| Three.js, R3F | `threejs-skills` (CloudAI-X, r186, R3F 9.8) | `npx skills add cloudai-x/threejs-skills` | MIT |
| Bonnes pratiques R3F et Three | `three-agent-skills` (emalorenzo) | `npx add-skill emalorenzo/three-agent-skills` | MIT annoncé |
| WebGPU, TSL | `webgpu-threejs-tsl` (dgreenheck) | copier `skills/webgpu-threejs-tsl` de [github.com/dgreenheck/webgpu-claude-skill](https://github.com/dgreenheck/webgpu-claude-skill) dans `~/.claude/skills/` | MIT annoncé |
| Shaders, particules, rendu GPU | `webgl-animation-skills` (iart-ai) | `npx skills add iart-ai/webgl-animation-skills` | MIT |
| Shaders procéduraux | `shader-skills` (gokayfem) | `npx skills add gokayfem/shader-skills` | MIT |

Skills du même univers souvent installés à côté, à utiliser s'ils sont là : `animate` (une animation), `choreograph` (plusieurs éléments ensemble), `animation-performance` et `fixing-motion-performance` (saccades), `emil-design-eng` et `apple-design` (finition), `frontend-design` (direction visuelle).
