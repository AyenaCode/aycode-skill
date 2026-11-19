# Budget de performance

Non négociable (règle permanente). À lire aux étapes 3 à 6. Chaque seuil se mesure avec [`controle.md`](controle.md).

## Les seuils

Plus stricts que le niveau « bon » de Google (LCP 2,5 s, INP 200 ms, CLS 0,1, [web.dev/articles/vitals](https://web.dev/articles/vitals)) : on vise un site qui paraît instantané.

| Mesure | Seuil | Où la lire |
|---|---|---|
| LCP (affichage du contenu principal) | ≤ 2 s sur mobile simulé | Lighthouse |
| CLS (stabilité de la mise en page) | ≤ 0,05 | Lighthouse, « décalage » dans `pilote mesure` |
| TBT (blocage pendant le chargement) | ≤ 150 ms | Lighthouse |
| Réaction à une action ou un geste | ≤ 100 ms | « réaction » dans `pilote mesure` |
| Lighthouse performance, mobile | ≥ 95 | Lighthouse |
| Saccades au scroll (images > 33 ms) | ≤ 5 % bureau, ≤ 10 % mobile simulé | `pilote tour`, `pilote mesure` |
| JavaScript au premier affichage | ≤ 150 Ko compressés | ligne « JavaScript chargé » de `pilote ouvre`, Lighthouse |
| Poids avant interaction (HTML, CSS, JS, polices, image principale) | ≤ 400 Ko compressés | Lighthouse |
| Scène 3D (modèles, textures, code 3D) | ≤ 3 Mo, chargée à l'approche de sa section | `pilote analyse` sur notre site |

## Ce qui garde l'animation fluide

- **Animer seulement `transform`, `opacity` et `filter` léger.** `width`, `height`, `top`, `left`, `margin` forcent un recalcul de la mise en page à chaque image. Un flou (`blur`, `backdrop-filter`) se limite à de petites surfaces.
- **Une seule boucle d'animation.** GSAP, Lenis et la 3D partagent le même ticker (voir [`techno.md`](techno.md)) au lieu de lancer chacun leur `requestAnimationFrame`.
- **Rien d'animé hors écran.** Un `IntersectionObserver` met en pause les animations, les vidéos et le rendu 3D des sections invisibles.
- **Lire puis écrire.** Dans une même image, lis toutes les mesures du DOM, puis écris tous les styles ; jamais l'un après l'autre en boucle.
- **En React, la boucle ne touche pas l'état.** Dans `useFrame` ou un callback de scroll, modifie des `ref` ou des valeurs Motion, jamais `setState`, et multiplie les déplacements par `delta`.
- **`will-change` au cas par cas**, posé juste avant une animation lourde et retiré après, jamais en masse dans la feuille de style.

## Règles 3D

- **Chargement à l'approche.** Le canvas et la bibliothèque 3D se chargent par import dynamique quand leur section arrive à un écran de distance (`IntersectionObserver` avec `rootMargin: '100% 0px'`), avec une image fixe du même rendu en attendant. Si la 3D est dans le premier écran, l'image fixe s'affiche d'abord et la scène la remplace une fois prête, sans décalage. Cette image sert aussi de version mouvement réduit et de secours sans WebGL.
- **Modèles compressés.** Chaque `.glb` passe par `gltf-transform optimize` (géométrie Draco ou Meshopt, textures en WebP ou KTX2). Textures en puissances de 2, 2048 px au plus, 1024 sur mobile.
- **Résolution plafonnée.** `dpr` à 1,5 au plus sur mobile et 2 sur bureau (prop `dpr={[1, 1.5]}` en R3F, `setPixelRatio(Math.min(devicePixelRatio, 1.5))` en Three).
- **Peu d'appels de rendu.** Moins de 100 par image : objets répétés en `InstancedMesh`, géométries fusionnées, matériaux partagés. Les ombres temps réel et le post-traitement (bloom, profondeur de champ) sont les premiers sacrifiés.
- **Rendu à la demande.** Une scène qui ne bouge pas seule ne se redessine pas : `frameloop="demand"` et `invalidate()` en R3F.
- **Qualité adaptative.** Trois niveaux (haut, moyen, bas) choisis au chargement selon l'appareil, puis ajustés en direct : `PerformanceMonitor` de drei en R3F, ou une moyenne glissante des temps d'image en Three. Le niveau bas garde le concept (moins de particules, pas de post-traitement), il ne le supprime pas.
- **WebGPU d'abord, WebGL 2 ensuite.** `WebGPURenderer` bascule tout seul ; teste les deux chemins (`forceWebGL: true` pour le second).
- **Libérer la mémoire.** Géométries, matériaux et textures sont libérés (`dispose()`) quand une scène quitte la page.

## Chargement

- Le contenu du premier écran est dans le HTML de la première réponse (page statique ou rendue côté serveur), pas construit par le JavaScript.
- Le CSS du premier écran est en ligne dans le HTML ; le reste se charge sans bloquer l'affichage. Aucun script ne bloque le rendu (`type="module"` ou `defer`).
- Fichiers compressés (Brotli), noms à empreinte et cache long (`Cache-Control: immutable`) ; `preconnect` vers les seules origines tierces indispensables.
- Images en `srcset` / `sizes` : un téléphone télécharge une image à sa taille.
- Polices en `woff2`, sous-ensemble de caractères, `font-display: swap`, la police du titre préchargée.
- Image principale préchargée (`fetchpriority="high"`), en AVIF ou WebP avec ses dimensions écrites (pas de décalage de mise en page).
- Le code des effets est découpé par section et chargé à l'approche ; le premier écran n'embarque que ce qu'il montre.
- Les vidéos décoratives sont muettes, en boucle, compressées, avec une affiche (`poster`), et en pause hors écran.
