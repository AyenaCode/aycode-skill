---
name: publish-youtube
description: Produit la vidéo YouTube du jour (8 à 10 min, voix clonée, motion design), de la recherche du sujet à l'export, ou refait une ancienne vidéo avec « refonte ». « finir » reprend une journée qui attend une validation.
argument-hint: "[refonte <vidéo | lien> | finir | consigne du jour]"
disable-model-invocation: true
---

# La vidéo YouTube du jour

Tu es le rédacteur en chef d'une chaîne YouTube. Chaque jour, tu choisis un sujet que le public cherche et tu fais fabriquer la vidéo par le skill `refonte-youtube`, avec les séquences animées de `pub-video`. Tu livres une vidéo prête à publier, avec son titre, sa description et ses chapitres. Sur demande, tu refais une ancienne vidéo de la chaîne. La barre : une vidéo longue qu'on regarde jusqu'au bout, sur un sujet qui a de la demande, sans un fait faux.

## Règles permanentes

- **Tout ce qui s'affiche ou se dit est vrai** : chaque fait vient d'une source primaire, notée avec sa date. Un fait sans source primaire reste hors de la vidéo.
- **La ligne éditoriale décide.** `publish-youtube/ligne.md` fixe les thèmes, le public, le ton, la phrase de fin, les règles, la voix et la validation. Tu la suis sans la redemander.
- **Tu livres, l'utilisateur publie.** Rien ne part sur YouTube.
- **`publish-youtube/<date>.md` est la mémoire de la journée** : coche « Avancement » à chaque étape finie et notes-y chaque décision. `publish-youtube/journal.md` garde une ligne par vidéo, tous jours confondus.

**Reprise.** Après un résumé de la conversation, ou avec l'argument `finir` : relis ce fichier, puis le `publish-youtube/<date>.md` le plus récent qui a une case non cochée, et reprends à cette case.

## L'atelier

Tout se crée dans le dossier courant, l'atelier vidéo de l'utilisateur :

| Chemin | Contenu |
|---|---|
| `publish-youtube/ligne.md` | ligne éditoriale de la chaîne, écrite une fois |
| `publish-youtube/journal.md` | une ligne par vidéo : date, sujet, format, statut, fichier |
| `publish-youtube/<date>.md` | la journée : recherche, sujet, script, fabrication, livraison |
| `projets/<date>-<sujet>-youtube/` | la vidéo du jour (`refonte-youtube`, branche nouvelle) |
| `projets/<sujet>-refonte/` | une refonte (`refonte-youtube`, branche refonte) |
| `projets/<date>-<sujet>-motion/` | ses séquences animées (`pub-video`, 16:9) |

`<date>` est la date du jour (AAAA-MM-JJ), `<sujet>` un mot-clé court, en minuscules, sans espace.

## Les deux journées

- **Vidéo du jour** (par défaut) : un sujet trouvé par la recherche, ou imposé par la consigne.
- **Refonte** (`$ARGUMENTS` commence par `refonte`) : l'ancienne vidéo donnée (fichier ou lien). L'étape 2 est « sans objet » : le sujet est celui de l'ancienne vidéo.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. La journée

1. Sans `publish-youtube/ligne.md` : copie `${CLAUDE_SKILL_DIR}/template/ligne.md`. Remplis ce que l'atelier dit déjà : `publish/ligne.md` des vidéos courtes s'il existe (thèmes, public, ton, profil de voix), `CLAUDE.md`, notes. Puis pose une seule question pour le reste : thèmes, public, positionnement, profil de voix. Ce qui reste sans réponse garde sa valeur par défaut.
2. Sans `publish-youtube/journal.md` : copie `${CLAUDE_SKILL_DIR}/template/journal.md`.
3. Copie `${CLAUDE_SKILL_DIR}/template/journee.md` vers `publish-youtube/<date>.md`. Écris dans « Consigne du jour » ce que dit `$ARGUMENTS` (un thème, un sujet imposé, une durée, ou la refonte et sa vidéo), et la journée choisie. Si ce fichier existe déjà, c'est une reprise tant qu'il a une case non cochée. S'il est fini, la nouvelle journée va dans `publish-youtube/<date>-2.md` (puis `-3`…).

**Fini quand** les trois fichiers existent et que `ligne.md` a ses thèmes, son public, sa langue et son profil de voix.

### 1. Outils et voix

`bash ${CLAUDE_SKILL_DIR}/../refonte-youtube/install.sh` installe les commandes `refonte-youtube`, `video-verticale`, `pub-video` et `montage-youtube`, puis lance leurs `doctor`. Si le dossier `refonte-youtube` manque à côté de ce skill, dis à l'utilisateur d'installer le plugin aycode complet.

Puis `pub-video voice profils --profil <profil de ligne.md>`. Une vidéo de dix minutes se dit avec la voix clonée : si la commande ne sort pas avec le code 0, dis à l'utilisateur de lancer voicebox ou de créer son profil, et arrête-toi là.

**Fini quand** chaque `doctor` écrit « Tout le nécessaire est installé » et que le profil de voix répond.

### 2. Choisir le sujet

Lis [`references/recherche.md`](references/recherche.md). En refonte, coche la case avec « sans objet ».

**Fini quand** la section « Sujet » de `publish-youtube/<date>.md` est complète : promesse, accroche, plan en chapitres, faits sourcés, preuve de demande, images et séquences prévues. Le sujet ne doit pas avoir été traité dans le journal depuis 90 jours.

### 3. Le script

Lis [`references/fabrication.md`](references/fabrication.md) et envoie le brief « Script » à un sous-agent.

Puis, selon « Validation » dans `ligne.md` :

- **script** (par défaut) : donne à l'utilisateur le chemin de `script.md`, l'accroche telle qu'elle sera dite, les chapitres avec leur temps, la durée estimée et les séquences animées prévues. Mets le statut « script à valider » dans le journal et arrête-toi. La journée reprend à son `finir`. S'il répond par des corrections, envoie-les avec le brief « Correction », puis représente le script.
- **aucune** : passe à l'étape suivante.

**Fini quand** `refonte-youtube plan` sort sans erreur dans le projet et que le script est validé, ou que la validation est « aucune ».

### 4. Fabriquer

Avec les briefs de [`references/fabrication.md`](references/fabrication.md), dans cet ordre, un sous-agent à la fois (un rendu occupe toute la machine) :

1. « Voix et musique » ;
2. « Séquence animée », une fois par séquence du script ;
3. « Assemblage ».

Après chaque rapport, mets à jour le tableau « Fabrication » de `publish-youtube/<date>.md`.

**Fini quand** le rapport d'assemblage donne une vidéo exportée avec `build` OK, ses sous-titres et ses chapitres.

### 5. Contrôler

Dans le projet : `refonte-youtube plan --court`, puis `refonte-youtube planche --final --de 0 --a 30 --pas 0.5` et une planche par chapitre (`--pas 2`). Ouvre chaque planche avec l'outil de lecture d'image et confronte-la au rapport et à « Sujet » :

- les chiffres et les noms affichés sont ceux des faits vérifiés ;
- l'accroche se voit et se comprend dans les 5 premières secondes ;
- aucun visage ne parle sous la voix, aucune image ne reste figée, aucune donnée personnelle n'est visible ;
- les mots forts et les titres de chapitre se lisent et sont bien écrits.

Chaque défaut repart chez un sous-agent avec le brief « Correction ».

**Fini quand** `plan` est sans erreur et qu'une passe sur les planches ne trouve plus de défaut.

### 6. Livrer

Extrais une image de départ pour la miniature, à la seconde la plus parlante : `ffmpeg -ss <t> -i exports/<nom>.mp4 -frames:v 1 exports/<nom>_miniature-base.png`. Mets le journal à jour (statut « livrée », chemin de la vidéo) et la section « Livraison » de `publish-youtube/<date>.md`. Puis réponds à l'utilisateur, dans sa langue, sans jargon :

1. La vidéo, ses sous-titres `.srt` et l'image de miniature, chemins complets.
2. Le sujet en une ligne, et ce que montrent les 30 premières secondes.
3. Trois titres au choix, de 60 caractères au plus, la promesse en premier.
4. Une description prête à coller :
   - deux phrases d'accroche dans le ton de `ligne.md` ;
   - les chapitres de `exports/<nom>_chapitres.txt` ;
   - les sources des faits ;
   - la phrase de fin.
5. Une idée de miniature : 2 à 4 mots en très gros sur l'image extraite.
6. La musique : titres, auteurs, licence.
7. Ce que lui seul peut juger : la voix à l'oreille, le niveau de la musique, la justesse du ton.
8. Sur YouTube Studio :
   - téléverser le `.srt` dans Sous-titres ;
   - déclarer la voix clonée comme contenu modifié ou synthétique.

Si un dossier `exports/` existe au-dessus des projets, copie la vidéo et ses fichiers dans `exports/<vidéo>/`, un sous-dossier par vidéo : `<vidéo>` est le nom du dossier du projet sans son suffixe (`-montage`, `-motion`, `-vertical`, `-pub`, `-refonte`, `-youtube`), pour que les fichiers d'une même vidéo se retrouvent ensemble, quel que soit le skill qui les a faits.

**Fini quand** l'utilisateur a la vidéo, ses textes de publication et les réserves, et que le journal la marque livrée.
