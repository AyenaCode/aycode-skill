# Contrôle visuel et performance

À faire à l'étape 6, après chaque section construite et avant la livraison. Le site tourne en local (serveur de développement ou build servi).

## L'outil : pilote

`pilote` manipule le site comme un visiteur et rend un retour compact. Le navigateur reste ouvert entre deux commandes. Il a besoin de Playwright dans le projet (`npm i -D playwright && npx playwright install chromium`), et d'axe-core pour l'audit d'accessibilité (`npm i -D axe-core`), avec l'accord de l'utilisateur. Les fichiers vont dans `.local/pilote/`, à ajouter au `.gitignore` du projet.

Ci-dessous, `pilote` se lance avec `node ${CLAUDE_SKILL_DIR}/pilote/pilote.mjs`, depuis la racine du projet.

```bash
pilote aide                                    # toutes les commandes
pilote ouvre http://localhost:5173 --mobile    # Pixel 7, processeur ralenti 4x
pilote regarde                                 # capture + éléments à l'écran : @e1 [button] "Commencer"
pilote clique @e1                              # rend le différentiel : + apparu, - disparu, et une capture
pilote filme glisse @e4:0.2,0.5 @e4:0.8,0.5    # planche de 12 images prises pendant le geste
pilote mesure defile 1500                      # fluidité, réaction, décalages, images longues et leur script
pilote filme clique @e3 puis attends 120 puis clique @e3   # interrompre une animation en plein mouvement
pilote accessibilite                           # axe-core, contraste mesuré sur l'image réelle, cibles tactiles
```

Une **cible** est `@e4` (centre de l'élément), `@e4:0.2,0.8` (point relatif dans l'élément, pour viser dans une scène 3D) ou `200,400` (pixels). Les références viennent du dernier `regarde` ou du dernier différentiel. Un élément couvert par un autre (bannière, calque invisible) est refusé avec le nom de ce qui le couvre : c'est un défaut à corriger, pas à contourner.

Ouvre chaque capture et chaque planche avec l'outil de lecture d'images avant de juger.

### Exposer la scène 3D

Pour que `pilote etat` montre ce que fait la scène, le site expose en développement seulement une fonction qui rend ses chiffres :

```js
if (import.meta.env.DEV) window.__pilote3d = () => ({ appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr: renderer.getPixelRatio(), qualite });
```

### Les limites à dire

- Sans `--visible`, Chromium dessine la 3D sans carte graphique (`etat` le signale) : la fluidité 3D est sous-estimée. `--visible` ouvre une vraie fenêtre sur la carte graphique de la machine et donne des chiffres réalistes.
- Le profil mobile est une simulation (taille, toucher, processeur ralenti) : la preuve finale reste un vrai téléphone, que l'utilisateur essaie.

## Le parcours de contrôle

Pour chaque profil, `--mobile` puis `--bureau` :

1. `pilote ouvre <url> --mobile`, puis `pilote tour` : la planche du haut en bas et la fluidité d'un défilement complet.
2. **L'interaction signature** : `pilote filme` sur son geste (glisser, toucher, incliner), puis `pilote mesure` sur le même geste. La planche montre si la réaction est belle ; la mesure, si elle est fluide.
3. **La sensation** ([`sensation.md`](sensation.md)) : pour chaque élément qui s'anime au geste ou au clic, interromps-le en plein mouvement (`pilote filme clique @eN puis attends 120 puis clique @eN`), lance-le d'un geste court et vif (`pilote filme --images 16 glisse <de> <à> --duree 150`), et pousse-le au-delà de ses limites.
4. **Chaque section construite** : `pilote va @eN` ou `pilote defile`, puis `pilote filme defile 600` sur son entrée.
5. **L'accessibilité** : `pilote accessibilite` en haut de page, puis à chaque section (`pilote va 50%`, etc.) : le contraste et les cibles se mesurent à l'écran courant. Puis `pilote touche Tab`, plusieurs fois : chaque élément atteint a un focus visible.
6. **Le mouvement réduit** : `pilote ouvre <url> --mobile --reduit`, puis `pilote tour`.
7. `pilote etat` : aucune erreur, et la scène 3D dans le budget. La ligne « JavaScript chargé » de `pilote ouvre` tient le budget.

## Mesurer le chargement

Sur le build de production, pas sur le serveur de développement :

```bash
npx lighthouse http://localhost:4173 --only-categories=performance --output=json --output-path=.local/pilote/lighthouse.json --chrome-flags="--headless=new" --quiet
```

Lighthouse simule un mobile par défaut. Relève le score, LCP, CLS et TBT (TBT remplace INP dans un test sans visiteur), et les plus gros fichiers transférés.

## La grille

Chaque point est vert, ou noté dans `immersif.md` avec sa raison.

**Performance** (seuils dans [`performance.md`](performance.md))
- [ ] Lighthouse mobile : score ≥ 95, LCP ≤ 2 s, CLS ≤ 0,05, TBT ≤ 150 ms.
- [ ] JavaScript au premier affichage ≤ 150 Ko compressés ; poids avant interaction ≤ 400 Ko ; la 3D se charge à l'approche de sa section.
- [ ] Fluidité (`tour`, `mesure`) : images > 33 ms ≤ 5 % sur le bureau, ≤ 10 % sur le mobile simulé, pire image < 100 ms.
- [ ] Réaction aux actions et aux gestes (`mesure`) ≤ 100 ms ; aucune image longue causée par le code du site pendant l'interaction signature.
- [ ] Aucune erreur dans `etat` ni dans les retours d'action.

**Image** (sur chaque capture et planche)
- [ ] Un point focal clair par écran ; le concept est lisible sur la première capture.
- [ ] Texte lisible et contrasté sur son fond, même animé ; rien ne déborde ni ne se coupe sur mobile.
- [ ] La direction artistique de `immersif.md` est respectée (palette, typographie, matière).
- [ ] La planche du `tour` alterne tension et repos comme prévu dans la carte.
- [ ] Rien n'a l'air d'un modèle par défaut : pas de dégradé violet générique, pas de cartes toutes identiques, pas d'icônes clipart.

**Mouvement**
- [ ] Les planches de `filme` montrent une réaction immédiate et continue au geste, sans image figée ni saut.
- [ ] Le défilement suit le doigt : `defile` ne signale aucun défilement freiné hors de la zone de l'interaction signature.
- [ ] L'interaction signature fonctionne au doigt (profil mobile).
- [ ] En mouvement réduit, tout le contenu est là, sans animation en boucle.
- [ ] Les animations hors écran sont en pause (la fluidité ne baisse pas en bas de page).

**Sensation** ([`sensation.md`](sensation.md))
- [ ] Interrompue en plein mouvement, chaque animation repart de sa position affichée : demi-tour fluide sur la planche, sans saut ni retour à zéro.
- [ ] Un geste court et vif garde son élan après le relâchement, puis ralentit et se pose sans arrêt brusque.
- [ ] Au-delà d'une limite, l'élément résiste puis revient, il ne se bloque pas.
- [ ] Un élément saisi reste sous le doigt à l'endroit où il a été pris ; un menu naît de son bouton et repart par où il est venu.

**Accès** (WCAG 2.2 AA)
- [ ] `pilote accessibilite` : aucun problème axe-core critique ou grave, et les moyens notés avec leur raison.
- [ ] Contraste mesuré sur l'image réelle, à chaque section : aucun texte sous 4,5:1 (3:1 pour les grands textes).
- [ ] Aucune cible tactile sous 24 px ; celles sous 44 px sont justifiées.
- [ ] `touche Tab` atteint chaque lien et bouton dans l'ordre, chacun avec un focus visible.
- [ ] Chaque canvas a une alternative textuelle (`aria-label` ou texte voisin) ; le son est coupé par défaut.

## Comparer à la référence

Si `immersif.md` a une fiche de procédés, filme le même geste sur la référence (`pilote analyse <url>` puis `pilote filme ...`) et sur notre site, puis `pilote compare <planche référence> <planche nôtre>`. La qualité d'exécution (fluidité, rythme, finesse) doit être au moins égale ; l'identité reste la nôtre.

## Corriger

Cherche la cause d'une saccade avant de la corriger. `mesure` nomme le script des images longues ; les causes habituelles sont une propriété animée qui force un recalcul de la mise en page, trop d'appels de rendu 3D, une résolution trop haute, ou une mise à jour d'état React dans la boucle d'animation. Les skills `animation-performance` et `fixing-motion-performance`, s'ils sont installés, guident ce diagnostic. Après la correction, refais la même commande, compare avec `pilote compare <avant> <après>` et note les nouveaux chiffres dans `immersif.md`.
