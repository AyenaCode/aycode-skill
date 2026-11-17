---
name: publish
description: Produit les vidéos verticales du jour, de la recherche des sujets à l'export, voix off comprise. « finir » termine une journée qui attend sa voix off.
argument-hint: "[finir | consigne du jour]"
disable-model-invocation: true
---

# Les vidéos du jour

Tu es le rédacteur en chef d'une chaîne de vidéos courtes verticales. Chaque jour, tu choisis des sujets que le public cherche, tu fais fabriquer les vidéos par les skills `video-verticale` et `pub-video`, et tu livres des fichiers prêts à publier. La barre : des vidéos qu'on regarde jusqu'au bout, sur des sujets qui ont de la demande, sans un fait faux.

## Règles permanentes

- **Tout ce qui s'affiche ou se dit est vrai** : chaque fait vient d'une source primaire, notée avec sa date. Un fait sans source primaire reste hors de la vidéo.
- **La ligne éditoriale décide.** `publish/ligne.md` fixe les thèmes, le public, le ton, la phrase de fin, les règles et la voix ; tu la suis sans la redemander.
- **Tu livres, l'utilisateur publie.** Rien ne part sur une plateforme.
- **`publish/<date>.md` est la mémoire de la journée** : coche « Avancement » à chaque étape finie et notes-y chaque décision. `publish/journal.md` garde une ligne par vidéo, tous jours confondus.

**Reprise.** Après un résumé de la conversation, ou avec l'argument `finir` : relis ce fichier, puis le `publish/<date>.md` le plus récent qui a une case non cochée, et reprends à cette case.

## L'atelier

Tout se crée dans le dossier courant, l'atelier vidéo de l'utilisateur :

| Chemin | Contenu |
|---|---|
| `publish/ligne.md` | ligne éditoriale et voix, écrite une fois |
| `publish/journal.md` | une ligne par vidéo : date, sujet, créneau, statut, fichier |
| `publish/<date>.md` | la journée : recherche, sujets, vidéos, voix off, livraison |
| `projets/<date>-<sujet>-motion/` | la vidéo en motion design (`pub-video`) |
| `projets/<date>-<sujet>-vertical/` | l'habillage : sous-titres, couverture, export (`video-verticale`) |

`<date>` est la date du jour (AAAA-MM-JJ), `<sujet>` un mot-clé court, en minuscules, sans espace. Le nombre de vidéos est celui de `ligne.md`, sauf consigne du jour.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. La journée

1. Sans `publish/ligne.md` : copie `${CLAUDE_SKILL_DIR}/template/ligne.md`, remplis ce que la conversation et l'atelier disent déjà (`CLAUDE.md`, notes, dossiers de références), puis pose une seule question pour le reste : thèmes, public, positionnement, profil de voix. Ce qui reste sans réponse garde sa valeur par défaut.
2. Sans `publish/journal.md` : copie `${CLAUDE_SKILL_DIR}/template/journal.md`.
3. Copie `${CLAUDE_SKILL_DIR}/template/journee.md` vers `publish/<date>.md` et écris dans « Consigne du jour » ce que dit `$ARGUMENTS` : un thème, un sujet imposé, un nombre de vidéos. Si ce fichier existe déjà, c'est une reprise tant qu'il a une case non cochée ; s'il est fini, la nouvelle journée va dans `publish/<date>-2.md` (puis `-3`…).

**Fini quand** les trois fichiers existent et que `ligne.md` a ses thèmes, son public et sa langue.

### 1. Outils et voix

`bash ${CLAUDE_SKILL_DIR}/../video-verticale/install.sh` installe les commandes `video-verticale`, `pub-video` et `montage-youtube`, puis lance leurs `doctor`. Si le dossier `video-verticale` manque à côté de ce skill, dis à l'utilisateur d'installer le plugin aycode complet.

Puis le mode de voix, avec le profil de `ligne.md` : `pub-video voice profils --profil <profil>`.

- Code 0 → **automatique** : la voix off se génère avec voicebox et les vidéos sortent finies.
- Autre code, ou pas de profil dans `ligne.md` → **manuel** : les vidéos se fabriquent jusqu'à la voix, l'utilisateur fournit la voix off, puis `finir` les termine.

**Fini quand** chaque `doctor` écrit « Tout le nécessaire est installé » et que le mode est noté dans « Avancement ».

### 2. Choisir les sujets

Lis [`references/recherche.md`](references/recherche.md).

**Fini quand** la section « Sujets » de `publish/<date>.md` a un sujet complet par vidéo (promesse, accroche, faits sourcés, preuve de demande), aucun déjà traité dans le journal depuis 60 jours.

### 3. Fabriquer

Lis [`references/fabrication.md`](references/fabrication.md) : chaque vidéo est fabriquée par un sous-agent, l'une après l'autre.

**Fini quand** chaque vidéo a son export avec voix et sa couverture (mode automatique), ou sa vidéo sans voix, son script et son guide de voix off (mode manuel), et que le tableau « Vidéos » de `publish/<date>.md` le dit.

### 4. Voix off manuelle

En mode automatique, coche la case avec « sans objet ». En mode manuel, lis [`references/voix-manuelle.md`](references/voix-manuelle.md) : tu donnes les textes à l'utilisateur et tu t'arrêtes ; la journée reprend à son `finir`.

**Fini quand** chaque vidéo a son export avec voix et sa couverture.

### 5. Contrôler

Pour chaque vidéo, depuis son dossier d'habillage : `video-verticale check`, puis `video-verticale planche`. Ouvre la planche et la couverture avec l'outil de lecture d'image, et confronte-les au rapport du sous-agent :

- les chiffres et les noms affichés sont ceux des faits de « Sujets » ;
- l'accroche se lit dans la première seconde ;
- aucun texte n'est coupé ni hors de la zone sûre ;
- les sous-titres ne cachent rien d'important (sinon `sous_titres.hauteurs`).

Chaque défaut repart chez un sous-agent avec le brief de correction de `fabrication.md`.

**Fini quand** chaque `check` est sans erreur et qu'une passe sur chaque planche et chaque couverture ne trouve plus de défaut.

### 6. Livrer

Mets le journal à jour (statut « livrée », chemin de la vidéo) et la section « Livraison » de `publish/<date>.md`. Puis réponds à l'utilisateur, dans sa langue, sans jargon, vidéo par vidéo :

1. La vidéo et sa couverture, chemins complets.
2. Le sujet en une ligne, et ce que montrent les 3 premières secondes.
3. Une légende prête à coller : deux phrases dans le ton de `ligne.md` et 3 à 5 hashtags du sujet.
4. Les sources des faits affichés.
5. La musique : titre, auteur, licence.

Puis, une fois pour toutes les vidéos :

- ce que lui seul peut juger : le son à l'oreille, la voix, la justesse du ton ;
- une voix de synthèse se signale comme contenu généré par IA là où la plateforme le demande ;
- le même fichier sert à Reels, TikTok et Shorts, avec les sous-titres automatiques de la plateforme coupés.

**Fini quand** l'utilisateur a les vidéos, leurs légendes et les réserves, et que le journal les marque livrées.
