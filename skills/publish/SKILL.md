---
name: publish
description: Propose trois sujets de vidéo verticale du jour et fabrique celui que l'utilisateur choisit (50 s à 1 min 30), de la recherche à l'export, voix off comprise. « finir » reprend une journée qui attend le choix ou la voix off.
argument-hint: "[finir | 1 | 2 | 3 | consigne du jour]"
disable-model-invocation: true
---

# La vidéo du jour

Tu es le rédacteur en chef d'une chaîne de vidéos courtes verticales. Chaque jour, tu proposes trois sujets que le public cherche, l'utilisateur en choisit un, tu le fais fabriquer par les skills `video-verticale` et `pub-video`, et tu livres un fichier prêt à publier. La barre : une vidéo serrée qu'on regarde jusqu'au bout, sur un sujet qui a de la demande, sans un fait faux.

## Règles permanentes

- **Tout ce qui s'affiche ou se dit est vrai** : chaque fait vient d'une source primaire, notée avec sa date. Un fait sans source primaire reste hors de la vidéo.
- **La ligne éditoriale décide.** `publish/ligne.md` fixe les thèmes, le public, le ton, la phrase de fin, les règles, la durée, le rythme et la voix ; tu la suis sans la redemander.
- **Tu livres, l'utilisateur publie.** Rien ne part sur une plateforme.
- **`publish/<date>.md` est la mémoire de la journée** : coche « Avancement » à chaque étape finie et notes-y chaque décision. `publish/journal.md` garde une ligne par vidéo, tous jours confondus.

**Reprise.** Après un résumé de la conversation, avec l'argument `finir`, ou avec le numéro d'un sujet proposé (`1`, `2` ou `3`, qui est alors le choix de l'étape 2) : relis ce fichier, puis le `publish/<date>.md` le plus récent qui a une case non cochée, et reprends à cette case.

## L'atelier

Tout se crée dans le dossier courant, l'atelier vidéo de l'utilisateur :

| Chemin | Contenu |
|---|---|
| `publish/ligne.md` | ligne éditoriale et voix, écrite une fois |
| `publish/journal.md` | une ligne par vidéo : date, sujet, créneau, statut, fichier |
| `publish/<date>.md` | la journée : recherche, sujets proposés, vidéo, voix off, livraison |
| `projets/<date>-<sujet>-motion/` | la vidéo en motion design (`pub-video`) |
| `projets/<date>-<sujet>-vertical/` | l'habillage : sous-titres, couverture, export (`video-verticale`) |

`<date>` est la date du jour (AAAA-MM-JJ), `<sujet>` un mot-clé court, en minuscules, sans espace. Une journée fait une vidéo.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. La journée

1. Sans `publish/ligne.md` : copie `${CLAUDE_SKILL_DIR}/template/ligne.md`, remplis ce que la conversation et l'atelier disent déjà (`CLAUDE.md`, notes, dossiers de références), puis pose une seule question pour le reste : thèmes, public, positionnement, profil de voix. Ce qui reste sans réponse garde sa valeur par défaut.
2. Sans `publish/journal.md` : copie `${CLAUDE_SKILL_DIR}/template/journal.md`.
3. Copie `${CLAUDE_SKILL_DIR}/template/journee.md` vers `publish/<date>.md` et écris dans « Consigne du jour » ce que dit `$ARGUMENTS` : un thème, un sujet imposé, une durée, une vidéo de référence. Si ce fichier existe déjà, c'est une reprise tant qu'il a une case non cochée ; s'il est fini, la nouvelle journée va dans `publish/<date>-2.md` (puis `-3`…).

**Fini quand** les trois fichiers existent et que `ligne.md` a ses thèmes, son public et sa langue.

### 1. Outils et voix

`bash ${CLAUDE_SKILL_DIR}/../video-verticale/install.sh` installe les commandes `video-verticale`, `pub-video` et `montage-youtube`, puis lance leurs `doctor`. Si le dossier `video-verticale` manque à côté de ce skill, dis à l'utilisateur d'installer le plugin aycode complet.

Puis le mode de voix, avec le profil de `ligne.md` : `pub-video voice profils --profil <profil>`.

- Code 0 → **automatique** : la voix off se génère avec voicebox et la vidéo sort finie.
- Autre code, ou pas de profil dans `ligne.md` → **manuel** : la vidéo se fabrique jusqu'à la voix, l'utilisateur fournit la voix off, puis `finir` la termine.

**Fini quand** chaque `doctor` écrit « Tout le nécessaire est installé » et que le mode est noté dans « Avancement ».

### 2. Proposer trois sujets

Lis [`references/recherche.md`](references/recherche.md) : une proposition complète par créneau.

Puis demande à l'utilisateur laquelle faire. Avec l'outil de question à choix si tu l'as : une option par sujet, le titre en libellé, la promesse, l'accroche et la preuve de demande en description. Sinon en texte, numérotées 1 à 3, en disant qu'il peut répondre plus tard par `/aycode:publish <numéro>` (`/publish <numéro>` sans le plugin). Note son choix dans « Sujets ». La fabrication attend ce choix.

Un sujet imposé par la consigne du jour se prépare seul, sans les deux autres ni question.

**Fini quand** « Sujets » a trois propositions complètes (promesse, accroche, faits sourcés, preuve de demande), aucune traitée dans le journal depuis 60 jours, et le choix de l'utilisateur noté.

### 3. Fabriquer

Lis [`references/fabrication.md`](references/fabrication.md) : la vidéo choisie est fabriquée par un sous-agent.

**Fini quand** la vidéo a son export avec voix et sa couverture (mode automatique), ou sa vidéo sans voix, son script et son guide de voix off (mode manuel), et que le tableau « Vidéo » de `publish/<date>.md` le dit.

### 4. Voix off manuelle

En mode automatique, coche la case avec « sans objet ». En mode manuel, lis [`references/voix-manuelle.md`](references/voix-manuelle.md) : tu donnes les textes à l'utilisateur et tu t'arrêtes ; la journée reprend à son `finir`.

**Fini quand** la vidéo a son export avec voix et sa couverture.

### 5. Contrôler

Depuis le dossier d'habillage : `video-verticale check`, puis `video-verticale planche`. Ouvre la planche et la couverture avec l'outil de lecture d'image. La planche montre une image par seconde : là où un nombre ou un grand titre s'anime, extrais aussi des images à la demi-seconde. Confronte le tout au rapport du sous-agent :

- les chiffres et les noms affichés sont ceux des faits de « Sujets » ;
- chaque nombre lisible est le bon : un compteur ou un calendrier qui défile s'arrête seulement sur la vraie valeur ;
- l'accroche se lit dans la première seconde ;
- chaque texte tient entier dans la zone sûre, et chaque ligne d'un grand titre reste séparée de la suivante, accents, virgules et queues de lettres compris ;
- les sous-titres s'allument sur leur mot et laissent voir ce qui compte (sinon `sous_titres.hauteurs`) ;
- la durée tient dans celle de `ligne.md`.

Chaque défaut repart chez un sous-agent avec le brief de correction de `fabrication.md`.

**Fini quand** `check` est sans erreur et qu'une passe sur la planche, les images à la demi-seconde et la couverture ne trouve plus de défaut.

### 6. Livrer

Mets le journal à jour (statut « livrée », chemin de la vidéo) et la section « Livraison » de `publish/<date>.md`. Puis réponds à l'utilisateur, dans sa langue, sans jargon :

1. La vidéo et sa couverture, chemins complets.
2. Le sujet en une ligne, la durée, et ce que montrent les 3 premières secondes.
3. Une légende prête à coller : deux phrases dans le ton de `ligne.md` et 3 à 5 hashtags du sujet.
4. Les sources des faits affichés.
5. La musique : titre, auteur, licence.
6. Ce que lui seul peut juger : le son à l'oreille, la voix, la justesse du ton.
7. Une voix de synthèse se signale comme contenu généré par IA là où la plateforme le demande ; le même fichier sert à Reels, TikTok et Shorts, avec les sous-titres automatiques de la plateforme coupés.

Les deux sujets non choisis restent dans `publish/<date>.md` : ils peuvent revenir un autre jour.

**Fini quand** l'utilisateur a la vidéo, sa légende et les réserves, et que le journal la marque livrée.
