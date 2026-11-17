---
name: video-verticale
description: Fabrique une vidéo verticale 9:16 pour Reels, TikTok et YouTube Shorts, à partir d'un sujet (motion design) ou d'un enregistrement vertical (face caméra). Dérushe, pose des sous-titres animés incrustés mot à mot, un titre d'accroche, des zooms sur les coupes, une musique libre baissée sous la voix et des bruitages, puis exporte le .mp4 et sa couverture. À utiliser pour un Reel, un TikTok, un Short ou une vidéo verticale sur un sujet ou à partir d'un rush, et pour habiller (sous-titres, musique) une vidéo verticale déjà montée.
argument-hint: "[sujet | rush vertical | vidéo montée] [plateforme, durée, style de sous-titres]"
---

# Vidéo verticale

Tu es le monteur et le motion designer d'une vidéo courte verticale. La barre : une vidéo qui arrête le pouce dès la première seconde, se comprend sans le son grâce aux sous-titres et n'a aucun temps mort.

Deux **branches** :

- **rush** : l'utilisateur fournit un enregistrement vertical. `montage-youtube` le dérushe, puis `video-verticale` l'habille.
- **sujet** : l'utilisateur donne un sujet. `pub-video` fabrique la vidéo en motion design, puis `video-verticale` incruste les sous-titres de la voix enregistrée.

Une vidéo déjà montée qu'il faut seulement habiller suit la branche rush à partir de l'étape 4, avec le fichier comme source. La pub d'un produit relève du skill `pub-video` seul.

L'habillage passe par la commande `video-verticale`. Chaque sous-commande a son `--help`.

## Règles permanentes

- **Les fichiers de l'utilisateur restent intacts.** Tout ce que tu écris va dans les dossiers de projet.
- **Tout ce qui s'affiche ou se dit est vrai.** Un titre d'accroche reprend ce que dit le rush. Dans la branche sujet, chaque fait vient de la table « Faits vérifiés », avec sa source.
- **Tu ne vois pas la vidéo et tu n'entends pas le son.** Tu regardes les planches (`video-verticale planche`) après chaque rendu, et tu mesures le son (`build`, `check`). La livraison dit ce qui reste à écouter.
- **La musique a une licence écrite** : dans `musique.licence` de `verticale.json` et dans `brief.md`.
- **`brief.md` du projet d'habillage est la mémoire.** Tu coches « Avancement » à chaque étape finie et tu y notes chaque décision qui n'est pas évidente. Avant sa création (étape 4), la mémoire est le `brief.md` du projet `montage-youtube` ou `pub-video`.
- **Tu livres des fichiers** ; la publication revient à l'utilisateur.

**Reprise.** Si la conversation a été résumée ou si tu arrives sur un projet commencé : relis `${CLAUDE_SKILL_DIR}/SKILL.md`, puis le `brief.md` le plus avancé, et reprends à la première case non cochée.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. Outils

`bash ${CLAUDE_SKILL_DIR}/install.sh` (sans sudo, rapide une fois tout installé). Il installe aussi `montage-youtube` et `pub-video` quand ils sont à côté, pointe les trois commandes sur cette version, même après une mise à jour, puis lance les trois `doctor`. `video-verticale doctor` affiche le dossier des skills `montage-youtube` et `pub-video` : les étapes suivantes lisent leurs fichiers.

**Fini quand** chaque `doctor` lancé écrit « Tout le nécessaire est installé ».

### 1. Cadrer

Lis la demande : `$ARGUMENTS` et la conversation. Ce qui n'est pas dit se décide ainsi :

| Choix | Par défaut |
|---|---|
| Branche | rush si un fichier vidéo est donné, sujet sinon |
| Plateformes | Reels, TikTok et Shorts avec un seul fichier 1080 × 1920 et la zone sûre `universal` ; pub payante → `ads` |
| Durée | 30 à 60 s, jamais plus de 3 min (au-delà, YouTube n'en fait plus un Short) |
| Langue | celle du rush, sinon celle de l'utilisateur |
| Sous-titres | style `pop`, Montserrat Black, blanc avec le mot dit en jaune, en majuscules |
| Musique | un morceau libre, 12 à 20 LU sous la voix |
| Bruitages | rares : l'entrée du titre, les mots forts |

Pose une question seulement si le rush est introuvable, si le sujet tient en plusieurs vidéos, ou si deux consignes se contredisent. Sinon, annonce tes choix en une phrase et avance.

Les dossiers : `projets/<sujet>-montage` (rush) ou `projets/<sujet>-motion` (sujet), puis `projets/<sujet>-vertical` pour l'habillage. Sans dossier `projets/`, ils vont dans le dossier courant.

**Fini quand** tes choix sont annoncés. Ils s'écrivent, avec la demande, dans la section « Demande » du `brief.md` dès que l'étape 2 ou 3 crée le projet.

### 2. Branche rush : dérusher

`montage-youtube new projets/<sujet>-montage <rush> --lang <langue>`, puis, dans son `projet.json`, règle `reglages.pause` à `0.15` et `reglages.pauseMax` à `0.3` : une vidéo verticale ne laisse presque aucun blanc. Suis ensuite les étapes 3, 4, 5 et 7 du `SKILL.md` de `montage-youtube` (analyser, décider, aperçu et contrôle, export) avec leurs références. Ses étapes 6, 8 et 9 sont remplacées ici : la validation se fait sur l'aperçu habillé et les sous-titres sont incrustés.

En décidant `montage.md`, coupe plus fort que pour YouTube :

- Les introductions partent (« Salut à tous », « Aujourd'hui je vais vous parler de »). La première phrase gardée est l'accroche.
- Ce qui ne sert pas la promesse de l'accroche part aussi, jusqu'à tenir la durée visée.
- Le montage garde l'ordre du rush. Si la meilleure accroche est dite plus tard, dis-le à l'utilisateur : il la réenregistre, ou le titre d'accroche la porte à l'écran.

**Fini quand** `montage-youtube build` affiche OK et que la durée exportée tient dans la durée visée. Dans la branche sujet, coche la case 2 avec « sans objet ».

### 3. Branche sujet : fabriquer en motion design

Lis [`references/sujet.md`](references/sujet.md).

**Fini quand** `pub-video build` affiche OK. La suite dépend de la voix :

- **Sans voix** : le texte à l'écran porte le message et il n'y a rien à sous-titrer. Livre la vidéo comme le dit l'étape 9 du `SKILL.md` de `pub-video` ; le travail s'arrête là.
- **Avec voix** : livre l'aperçu, le texte et le guide de voix off (étape 9 de `pub-video`), puis attends la prise de l'utilisateur. Quand elle arrive, fais l'étape 10 de `pub-video` (`voice mix`), puis l'étape 4 ci-dessous.
- **Avec une voix de synthèse** (la demande le prévoit) : génère-la au lieu d'attendre, avec l'étape 10 de `pub-video` (`voice synth`, puis `voice mix`), puis l'étape 4 ci-dessous.

Dans la branche rush, coche la case 3 avec « sans objet ».

### 4. Créer l'habillage

`video-verticale new projets/<sujet>-vertical <source>`. La source est le dossier du montage (branche rush), l'export avec voix (branche sujet) ou la vidéo déjà montée. Dans la branche sujet, ajoute `--voix projets/<sujet>-motion/render/<vidéo>_voice.wav` : la transcription lit la voix seule, sans la musique. Recopie la section « Demande » dans le nouveau `brief.md` et coche les étapes déjà faites. Les mots que `new` signale « à relire » vont dans « Noms et termes », à confirmer.

**Fini quand** `new` a lu les mots, que la police est vérifiée (pas de « PROBLÈME » à côté de son nom) et que la section « Demande » de `brief.md` est remplie.

### 5. Décider l'habillage

Lis [`references/habillage.md`](references/habillage.md), puis décide chaque champ de `verticale.json` : sous-titres, corrections, mots forts, titre d'accroche, zooms, musique, bruitages.

**Fini quand** chaque champ est décidé, chaque décision non évidente est notée dans la section « Habillage » de `brief.md`, et `video-verticale apercu` affiche OK.

### 6. Regarder et corriger

`video-verticale planche --apercu`, puis `video-verticale planche --apercu --to 3 --every 0.25` pour l'accroche, et `video-verticale check`. Ouvre chaque planche avec l'outil de lecture d'image et fais les deux passes de la section « Revue des planches » de [`references/habillage.md`](references/habillage.md). Corrige `verticale.json`, refais l'aperçu, regarde de nouveau.

**Fini quand** `check` ne signale aucune erreur, que chaque avertissement est corrigé ou justifié dans `brief.md`, et qu'une passe complète sur les planches ne trouve plus rien.

### 7. Validation par l'utilisateur

Envoie-lui le chemin de l'aperçu (`exports/<nom>_apercu.mp4`), la durée, ce qui s'affiche dans les 3 premières secondes, la musique et son niveau sous la voix, les mots dont l'orthographe est à confirmer. Demande-lui de regarder l'aperçu avec le son.

**Fini quand** l'utilisateur valide l'aperçu, ou que ses corrections sont faites et contrôlées (retour à l'étape 6).

### 8. Export final

```
video-verticale build
video-verticale check
video-verticale planche
video-verticale image <secondes>   # couverture : l'image qui dit le plus, souvent celle du titre d'accroche
```

**Fini quand** `build` affiche OK, que `check` ne signale aucune erreur, et que tu as regardé la planche de l'export et la couverture.

### 9. Livrer

Écris `README.md` dans le projet d'habillage : source, réglages, musique et licence, police et licence, commandes pour refaire la vidéo. Puis réponds à l'utilisateur, dans sa langue, sans jargon :

1. Les fichiers livrés, chemins complets : la vidéo et sa couverture.
2. Ce que montrent les 3 premières secondes, puis le reste en une ligne.
3. La musique : titre, auteur, licence, et ce qu'elle n'autorise pas.
4. Ce que lui seul peut juger : le son à l'oreille, l'orthographe des noms, la force de l'accroche.
5. La publication : le même fichier sert aux trois plateformes. Les sous-titres automatiques de la plateforme restent coupés, sinon ils se superposent aux sous-titres incrustés. La couverture se téléverse là où la plateforme le permet ; ailleurs, on choisit l'image à la même seconde.

Si un dossier `exports/` existe au-dessus du projet (atelier vidéo de l'utilisateur), copie-y les fichiers livrés.

**Fini quand** l'utilisateur a les chemins, le bilan et les réserves.

## Ce qui fait une vidéo verticale qui tient

À vérifier sur les planches et le `check` avant de livrer :

- **La première seconde dit pourquoi rester** : une promesse, une question ou un résultat, à l'écran et dans la voix.
- **Aucun temps mort** : pas d'introduction, pas de blanc qu'on remarque.
- **Les sous-titres se lisent sans le son** : peu de mots à la fois, gros, contrastés, dans la zone sûre, les noms bien écrits.
- **Chaque zoom a une raison** : il cache un saut d'image ou souligne un mot fort.
- **La musique porte sans couvrir** : entre 12 et 20 LU sous la voix.
- **Chaque bruitage a son geste à l'image**, et il y en a peu.
- **Le visage et l'action restent visibles** : rien d'important sous les sous-titres ni derrière les boutons de la plateforme.
