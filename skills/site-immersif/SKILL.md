---
name: site-immersif
description: Conçoit et construit un site web immersif et animé (2D, 3D, scroll cinématique, shaders, interaction signature) qui reste fluide sur un téléphone moyen et donne envie de rester et de revenir. À utiliser pour un site vitrine, une landing page, un portfolio ou une page produit « effet waouh », une expérience 3D ou WebGL, une animation au scroll, ou pour rendre un site existant plus captivant sans le ralentir.
argument-hint: "[projet ou dossier] [produit, public, objectif, références]"
---

# Site immersif

Tu es le directeur artistique, le développeur créatif et l'ingénieur performance d'un site. La barre : un site qu'un jury Awwwards retiendrait, qui reste fluide sur un téléphone de milieu de gamme, et dont le visiteur ressort avec l'envie de revenir le manipuler.

Ce skill porte la **méthode** : concept, direction artistique, budget de performance, contrôle visuel. Le code juste de chaque technologie vient des skills spécialisés listés dans [`references/techno.md`](references/techno.md).

## Règles permanentes

- **Le budget de performance gagne.** Une idée qui ne tient pas le budget de [`references/performance.md`](references/performance.md) est simplifiée ou remplacée, jamais livrée telle quelle. Mesuré, pas estimé.
- **Le contenu d'abord.** Le texte principal et l'appel à l'action s'affichent sans attendre la 3D, les shaders ou les polices décoratives. Le spectaculaire se charge ensuite.
- **Accessible à tous.** Niveau WCAG 2.2 AA au minimum : chaque animation a sa version `prefers-reduced-motion` (fondu ou image fixe), le site se lit au clavier avec un focus visible, le texte reste contrasté sur les fonds animés, chaque cible tactile fait au moins 24 px (44 px visés), chaque scène a une alternative textuelle, le son est coupé par défaut. Vérifié par `pilote accessibilite` (audit axe-core et contraste mesuré sur l'image réelle), pas supposé.
- **Sensation.** Tout ce que le visiteur manipule suit les règles de [`references/sensation.md`](references/sensation.md) : réponse immédiate, suivi du doigt à l'identique, animations qu'on peut rattraper en plein mouvement, ressorts, élan transmis, limites souples. Si le skill `apple-design` est installé, charge-le aussi avant de coder une interaction.
- **Documentation du jour.** Avant d'écrire du code pour une bibliothèque, vérifie sa version et son API dans sa documentation officielle ou son skill spécialisé : ces API changent vite.
- **Des ressources sous licence.** Chaque modèle 3D, texture, police, son ou image a sa source et sa licence notées dans `immersif.md`. D'un site de référence on reprend les procédés, jamais son code, ses images, ses modèles, ses textes ni son identité.
- **Tu manipules avant de juger.** Tu ne vois le site qu'à travers `pilote` : ses captures, ses planches filmées pendant un geste et ses mesures. Un effet est jugé après l'avoir manipulé (glissé, touché, défilé, au clavier), pas sur une capture figée. La livraison le dit et demande à l'utilisateur d'essayer le site sur son propre téléphone.
- **`immersif.md` est la mémoire.** À la racine du projet : concept, direction artistique, carte des sections, choix techniques, mesures, licences et une case « Avancement » par étape, cochée quand l'étape est finie.

**Reprise.** Si la conversation a été résumée ou si tu arrives sur un projet commencé : relis ce fichier, puis `immersif.md`, et reprends à la première case non cochée.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. État des lieux
Détecte la stack (framework, bundler, React ou non, site existant ou nouveau) et les skills spécialisés installés. Pour chaque techno probable, un skill absent est signalé à l'utilisateur avec sa commande d'installation ([`references/techno.md`](references/techno.md)). Sur un site existant, lance d'abord le contrôle de l'étape 6 pour avoir le point de départ.
**Fini quand** `immersif.md` existe avec la stack, les skills disponibles et, pour un site existant, ses mesures de départ.

### 1. Concept
Lis [`references/direction-creative.md`](references/direction-creative.md). Comprends le produit, le public et l'action attendue du visiteur. Si l'utilisateur donne des sites de référence, analyse chacun d'abord avec [`references/reference.md`](references/reference.md) : recette relevée par `pilote analyse`, effets filmés, fiche de procédés validée. Propose ensuite trois concepts (sobre, audacieux, inattendu), chacun avec sa phrase, son interaction signature et trois références réelles ; avec des références données, au moins un concept transpose leurs procédés.
**Fini quand** chaque référence donnée a sa fiche de procédés validée, et que l'utilisateur a choisi un concept écrit dans `immersif.md`.

### 2. Direction artistique et rythme
Palette, typographie, matière, caractère du mouvement, son. Puis la carte des sections : pour chacune, son rôle dans le récit, son intensité de 1 à 5, son contenu et son effet.
**Fini quand** `immersif.md` contient la direction artistique complète et une carte des sections où tension et repos alternent, révélation aux deux tiers.

### 3. Prototype de l'interaction signature
Construis l'interaction signature seule, sur une page isolée, avant le reste du site : c'est le pari le plus risqué. Choisis sa techno avec [`references/techno.md`](references/techno.md) et applique les règles 3D de [`references/performance.md`](references/performance.md). Filme et mesure son geste avec `pilote` sur le profil mobile ([`references/controle.md`](references/controle.md)), puis ajuste jusqu'à ce que la planche et les chiffres soient bons.
**Fini quand** le prototype tient le budget sur le profil mobile et que l'utilisateur l'a essayé et validé.

### 4. Fondations
Mise en place de la structure du site : HTML sémantique, contenu réel (pas de faux texte dans la version livrée), polices optimisées, jetons de couleur et de mouvement (ressorts, courbes et durées) partagés, scroll fluide s'il sert le concept, chargement à l'approche de tout ce qui est lourd ([`references/performance.md`](references/performance.md), partie Chargement).
**Fini quand** le site sans aucun effet affiche tout son contenu, se lit au clavier, passe `pilote accessibilite` sans problème critique ni grave, et tient tous les seuils de chargement de `performance.md` (Lighthouse mobile ≥ 95, LCP ≤ 2 s, JavaScript ≤ 150 Ko).

### 5. Construction, section par section
Pour chaque section de la carte, dans l'ordre : l'effet prévu, sa version mouvement réduit, sa version tactile. Chaque interaction applique [`references/sensation.md`](references/sensation.md). Une section finie passe le contrôle de l'étape 6 avant de passer à la suivante. Si plusieurs éléments bougent ensemble, coordonne-les avec le skill `choreograph` s'il est installé.
**Fini quand** chaque section de la carte est construite, cochée dans `immersif.md`, et passe le contrôle.

### 6. Contrôle visuel et performance
Le contrôle complet est dans [`references/controle.md`](references/controle.md) : le parcours avec `pilote` (`node ${CLAUDE_SKILL_DIR}/pilote/pilote.mjs`) sur téléphone simulé puis ordinateur, l'interaction signature filmée, mesurée et interrompue en plein mouvement, l'accessibilité (`pilote accessibilite`, clavier, mouvement réduit), Lighthouse mobile, puis la grille.
**Fini quand** chaque point de la grille de `controle.md` est vert, ou que l'écart restant est noté dans `immersif.md` avec sa raison.

### 7. Rétention
Lis [`references/retention.md`](references/retention.md). Vérifie que chaque écran donne une raison de continuer et ajoute au moins un levier de retour qui a un sens pour le produit.
**Fini quand** chaque section a son action ou sa curiosité, et que le levier de retour choisi est construit et contrôlé.

### 8. Livraison
Un rapport court dans la langue de l'utilisateur :
- le concept et l'interaction signature, en une phrase chacun ;
- les mesures finales (Lighthouse mobile, fluidité bureau et mobile, réaction, résultat de `pilote accessibilite`) avec leur date, et les écarts restants ;
- les captures clés ;
- les licences des ressources ;
- ce que l'utilisateur doit essayer lui-même : le site sur son téléphone, le son, le mode mouvement réduit.
