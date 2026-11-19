# Analyser un site de référence

À faire à l'étape 1, pour chaque site que l'utilisateur donne en exemple. Le but : comprendre **comment** chaque effet est fait, assez précisément pour le refaire avec le concept et les ressources de l'utilisateur.

## La règle

On reprend des **procédés** : un rythme, une mécanique de scroll, un type de transition, une manière de réagir au geste, des durées et des courbes. On ne reprend jamais le code, les images, les modèles 3D, les textes, le logo, les couleurs de marque ni l'identité du site. Le relevé des shaders et des réglages sert à comprendre ; le code du site s'écrit ensuite de zéro.

## 1. Relever la recette

```bash
pilote analyse <url>              # bureau
pilote analyse <url> --mobile     # puis le profil mobile : beaucoup de sites changent d'effets sur téléphone
```

`pilote` se lance avec `node ${CLAUDE_SKILL_DIR}/pilote/pilote.mjs`. `analyse` charge le site en l'observant dès le départ, le parcourt du haut en bas, puis rend :
- **une planche du parcours** : à ouvrir en premier ;
- **les bibliothèques** chargées et leur version (GSAP et ses plugins, Three.js, Lenis...), celles trouvées dans le code et le cadre (Next.js, Webflow, Framer...) ;
- **le scroll** : chaque ScrollTrigger avec son déclencheur, sa longueur en écrans, s'il est épinglé, son scrub, et s'il vit dans un défilement horizontal ;
- **le mouvement** : les animations saisies pendant le parcours, avec leur durée, leur courbe, leurs propriétés et leurs cibles ; les courbes et durées du CSS ;
- **la direction artistique** : palette pondérée par la surface, polices chargées, typographie des titres et du texte, plus grand texte de la page, curseur, effets CSS (blend, flou, découpe) ;
- **la structure** : hauteur en écrans, sections et leur hauteur ;
- **la 3D** : canvas, résolution, appels de dessin et passes par image, textures, matériaux Three.js, shaders écrits pour le site et leurs procédés (bruit, particules, distorsion, fluide...) ;
- **les interactions écoutées** : souris, molette, toucher, inclinaison ;
- **le chargement** : LCP, poids par famille, plus gros fichiers, fluidité d'un défilement complet.

Le relevé complet est dans le JSON indiqué, et les shaders du site dans un fichier `.glsl` pour en comprendre les procédés.

Quand une bibliothèque n'est pas exposée (code compacté), ses réglages ne se lisent pas : déduis-les des planches.

`analyse` attend que l'écran de chargement du site disparaisse (20 s au plus, `--attente` pour plus) et parcourt aussi les sites au scroll simulé (le document ne défile pas, le site écoute la molette) par de vrais gestes. S'il écrit **BLOQUÉ sur l'écran de chargement**, la planche ne montre pas le site, seulement le relevé du code :
- « une vidéo MP4 n'a pas pu être lue » : le Chromium de test n'a pas le codec H.264. Relance avec `--chrome` sur une machine où Google Chrome est installé ;
- sinon : `--attente 60000`, ou `--visible` pour la vraie carte graphique. Certains sites bloquent aussi les navigateurs automatisés : dis-le à l'utilisateur plutôt que de contourner.

## 2. Voir chaque effet en mouvement

La session reste sur le site après `analyse`. Pour chaque effet repéré sur la planche ou dans le relevé :

```bash
pilote va 35%                                  # se placer avant l'effet
pilote filme --images 12 defile 900            # l'effet au scroll, image par image
pilote filme glisse @e2:0.2,0.5 @e2:0.8,0.5    # l'effet au geste, dans le canvas
pilote filme survole @e7                       # l'effet au survol
pilote mesure defile 900                       # son coût : fluidité, images longues
```

Ouvre chaque planche. Un effet est compris quand tu peux dire ce qui bouge, dans quel ordre, combien de temps, avec quelle courbe, et ce qui le déclenche.

## 3. Écrire la fiche de procédés

Dans `immersif.md`, une ligne par effet retenu :

| Où | Procédé | Mécanique relevée | Techno | Comment on le transpose |
|---|---|---|---|---|
| Accueil | titre qui se découpe en lettres | SplitText, apparition décalée de 0,03 s, 600 ms, power2.out | GSAP | sur notre titre, avec notre police |
| Section 2 | scène épinglée pendant le scroll | épinglé 333 % d'écran, scrub 1 | ScrollTrigger | notre objet 3D qui se construit |

Ajoute sous la fiche ce que la référence fait **mal** (saccades mesurées, poids, LCP, focus clavier) : on fait mieux sur ces points.

**Fini quand** chaque effet retenu a sa ligne, filmée et comprise, et que l'utilisateur a validé ceux à transposer.

## 4. Comparer à la fin

À l'étape 6, filme le même geste sur notre site et sur la référence, puis `pilote compare <planche référence> <planche nôtre>` : on vise la même qualité d'exécution, avec notre identité.
