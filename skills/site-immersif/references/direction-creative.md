# Direction créative

Ce qui sépare un site primé d'un site « propre ». À lire aux étapes 1 à 3. Le code correct vient des skills spécialisés ; ce fichier dit quoi viser.

## Le concept : une idée, tenue partout

Le concept tient en une phrase qui contient un verbe et une image : « on plonge dans le soleil qui alimente un village », pas « un site moderne et dynamique ». Chaque effet du site illustre cette phrase. Un effet qui n'y sert pas sort, même s'il est beau.

Pour le trouver :
1. Liste ce que le produit **fait** dans le monde réel (une matière, un geste, un trajet, une transformation).
2. Choisis la métaphore physique la plus forte : la lumière qui se répand, un objet qu'on assemble, un voyage d'un point A à un point B, une matière qui réagit.
3. Fais-en le fil du scroll : le visiteur **traverse** la métaphore du haut en bas du site. Le scroll est un récit avec un début, une montée, une révélation et une fin.

Propose trois concepts différents à l'utilisateur (un sobre, un audacieux, un inattendu), chacun avec sa phrase, son interaction signature et une référence réelle. Il en choisit un.

## Références

Trois références réelles, avec leur adresse, et pour chacune **ce qu'on lui prend** (un rythme, une transition, une matière, une typographie) : jamais tout un site. Viviers : Awwwards (Site of the Day), The FWA, Codrops (démos et tutoriels), Shadertoy (effets GPU), godly.website, les studios (Active Theory, Lusion, Resn, Immersive Garden, Locomotive).

On s'inspire d'un procédé, on ne recopie ni un site, ni ses images, ni ses textes. Pour comprendre précisément comment une référence est faite, suis [`reference.md`](reference.md).

## Direction artistique

Fixée par écrit dans `immersif.md` avant la première ligne de code :

- **Palette** : un fond, un texte, un accent, et au plus deux couleurs de soutien. L'accent est rare : il marque l'action ou la révélation.
- **Typographie** : une police de titre avec du caractère (variable si possible, pour animer son poids ou sa largeur) et une police de texte lisible. Les titres sont grands : la typographie est un élément visuel, pas une étiquette. Charge-les en `woff2`, avec `font-display: swap` et un sous-ensemble de caractères.
- **Matière** : ce qui donne de la texture à l'écran (grain, verre, lumière volumétrique, papier, métal, fluide). Une seule matière dominante.
- **Mouvement** : le caractère des courbes (lourd et lent, vif et élastique, mécanique et précis) et une durée de référence. Toutes les animations du site en dérivent.
- **Son** (si le concept le porte) : une ambiance et trois à cinq sons d'interaction, coupés par défaut, avec un bouton visible pour les activer.

## Le rythme : alterner tension et repos

Dessine la carte des sections avant de coder, avec pour chacune son intensité (1 à 5) :

- La première section accroche en moins de 3 secondes : le concept est visible immédiatement, sans attendre la 3D.
- Après une section intense (4-5) vient une section calme (1-2) : du texte, du vide, une image fixe. Le calme rend le spectaculaire spectaculaire.
- La révélation (le moment le plus fort) est aux deux tiers du parcours, pas au début.
- La fin rend la main : un appel à l'action clair, et une raison de revenir (voir [`retention.md`](retention.md)).

## L'interaction signature

Un seul geste mémorable, que le visiteur refait pour le plaisir et montre à quelqu'un. Il est **manipulable** (le visiteur agit, le site réagit), **lié au concept** et **disponible tôt** (dans les deux premiers écrans).

Familles qui marchent :

| Famille | Exemples | Techno type |
|---|---|---|
| Matière qui réagit au curseur | fluide, fumée, distorsion d'image, particules qui fuient | shader, WebGL/WebGPU |
| Objet 3D à manipuler | tourner, attraper, lancer, démonter un produit | R3F + physique |
| Voyage au scroll | caméra qui avance dans une scène, plans qui se superposent | GSAP ScrollTrigger + 3D |
| Typographie vivante | lettres qui s'écartent, se déforment, changent de graisse | SplitText, police variable |
| Transformation | un objet qui se transforme en un autre d'une section à l'autre | morph SVG, morph 3D, View Transitions |
| Création | le visiteur dessine, compose, choisit, et garde le résultat | canvas, Rive |

Sur mobile, l'interaction signature a une version tactile (glisser, incliner le téléphone, toucher), jamais un simple « désactivé ».

## Les détails qui font « pro »

- Un curseur personnalisé seulement s'il sert le concept, et jamais sur écran tactile.
- Des transitions entre pages (View Transitions ou équivalent) : le site paraît un seul objet continu.
- Un chargement qui fait partie de l'expérience (il montre déjà le concept) et dure moins de 2 secondes.
- Des micro-réactions sur chaque élément cliquable : survol, appui, état actif.
- Les états vides, d'erreur et de chargement dessinés avec le même soin que le reste.
