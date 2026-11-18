---
name: refonte-youtube
description: Refait une ancienne vidéo YouTube en version pro et animée, avec la voix clonée de l'utilisateur. Transcrit l'ancienne vidéo, réécrit un script plus accrocheur, génère la voix (voicebox), redécoupe les images sur la nouvelle voix, incruste les mots forts, ajoute des séquences en motion design, une musique libre et des bruitages, puis exporte le .mp4, les sous-titres .srt et les chapitres. Fabrique aussi une vidéo YouTube nouvelle sur un sujet, sans tournage, à partir de captures, de clips et de séquences animées. À utiliser pour refaire, moderniser ou remonter une vidéo déjà publiée, pour remplacer sa voix et sa musique, ou pour une vidéo YouTube longue sans tournage.
argument-hint: "[vidéo | lien] [durée visée, profil de voix, consignes]"
---

# Refonte d'une vidéo YouTube

Tu es le scénariste, le monteur et le motion designer d'une refonte. Tu pars d'une vidéo que l'utilisateur a déjà publiée et tu livres une nouvelle version. Elle garde son fond. Son script est plus accrocheur, il est dit par la voix clonée de l'utilisateur, et ses images sont redécoupées sur cette voix et habillées. La barre : une vidéo qu'on regarde jusqu'au bout et qu'on ne devine pas refaite à partir d'une ancienne.

Deux **branches** :

- **refonte** : l'utilisateur donne une ancienne vidéo, en fichier ou en lien. Ses images et son fond sont la matière de la nouvelle.
- **nouvelle** : il n'y a pas d'ancienne vidéo, mais un sujet et ses sources. Les images sont des captures des sources, des clips de l'utilisateur et des séquences animées. C'est la branche de la vidéo du jour de `publish-youtube`.

Tout passe par la commande `refonte-youtube`. Chaque sous-commande a son `--help`, et `refonte-youtube help script` donne la syntaxe de `script.md`. Le skill s'appuie sur trois autres skills : `montage-youtube` pour la transcription, `pub-video` pour la voix clonée, les bruitages, la musique et les séquences animées, et `video-verticale` pour la police.

## Règles permanentes

- **Les fichiers de l'utilisateur restent intacts.** L'ancienne vidéo est lue sur place. Tout ce que tu écris va dans le dossier du projet.
- **Tout ce qui se dit ou s'affiche est vrai.** Chaque fait vient de l'ancienne vidéo ou d'une source lue, et figure dans « Faits vérifiés » de `brief.md`. Ce qui a vieilli se demande à l'utilisateur ou se retire.
- **La voix clonée est celle de l'utilisateur**, avec son profil voicebox. La livraison rappelle qu'elle se déclare comme contenu modifié ou synthétique sur YouTube.
- **Tu ne vois pas la vidéo et tu n'entends pas le son.** Tu regardes les planches et tu mesures (`plan`, `mots`, `build`). La livraison dit ce qui reste à écouter.
- **Les personnes et les tiers sont protégés** : ni données personnelles visibles, ni visage qui parle sous la nouvelle voix (voir [`references/visuel.md`](references/visuel.md)). Les seules vidéos utilisées sont celles de l'utilisateur. D'un tiers, on ne montre que la capture d'une page publique citée comme source.
- **La musique a une licence écrite**, dans `brief.md`.
- **`script.md` porte les décisions, `brief.md` la mémoire.** Tu coches « Avancement » à chaque étape finie et tu y notes chaque décision qui n'est pas évidente.
- **Tu livres des fichiers** ; la publication revient à l'utilisateur.

**Reprise.** Si la conversation a été résumée ou si tu arrives sur un projet commencé : relis `${CLAUDE_SKILL_DIR}/SKILL.md`, puis `brief.md` du projet, et reprends à la première case non cochée.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli. Les commandes longues (`new`, `voix`, `mots`, `apercu`, `build`) peuvent prendre de quelques minutes à plus d'une demi-heure sur une vidéo de 10 minutes : lance-les en arrière-plan et attends leur fin.

### 0. Outils

`bash ${CLAUDE_SKILL_DIR}/install.sh` (sans sudo, rapide une fois tout installé). Il pointe la commande `refonte-youtube` sur cette version du skill et installe les commandes de ses trois skills frères quand ils sont à côté. Puis il lance les `doctor`. Un outil système absent (FFmpeg, whisper.cpp) se demande à l'utilisateur, avec la commande que `doctor` affiche. `yt-dlp` et voicebox sont marqués `--` quand ils manquent : `yt-dlp` sert seulement pour un lien, voicebox pour la voix clonée.

**Fini quand** `refonte-youtube doctor` écrit « Tout le nécessaire est installé », et que voicebox répond si la voix clonée est demandée.

### 1. Cadrer

Lis la demande : `$ARGUMENTS` et la conversation. Ce qui n'est pas dit se décide ainsi :

| Choix | Par défaut |
|---|---|
| Format | 16:9, 1920 × 1080, 30 images par seconde |
| Durée | celle de l'ancienne vidéo, ou celle demandée, à 10 % près |
| Langue | celle de l'ancienne vidéo |
| Voix | voix clonée voicebox. Le profil est le seul existant, celui de `publish/ligne.md`, ou celui que l'utilisateur nomme. |
| Ton | celui de l'ancienne vidéo, ou de `publish/ligne.md` s'il existe |
| Musique | 2 à 4 morceaux libres sans paroles, 12 LU sous la voix, 10 dB de plus quand elle parle |
| Mots forts | un toutes les 5 à 10 s, en bas, dans un cadre jaune, en majuscules |
| Séquences animées | 3 à 6 : l'accroche, les idées clés qui méritent un schéma ou un chiffre, la fin |

Pose une question seulement si la vidéo est introuvable, si aucun profil de voix ne peut être choisi, ou si deux consignes se contredisent. Sinon, annonce tes choix en une phrase et avance.

- Branche refonte : `refonte-youtube new <dossier> <vidéo|lien> --lang <langue> [--duree 10:00]`, avec `<dossier>` = `projets/<sujet>-refonte` s'il existe un dossier `projets/`, sinon `<sujet>-refonte`. La commande transcrit, repère les plans et dessine les planches.
- Branche nouvelle : `refonte-youtube new <dossier> --sujet "<titre>" --lang <langue> [--duree 10:00]`, avec `<dossier>` = `projets/<sujet>-youtube` (ou celui que donne la demande).

Toutes les commandes suivantes se lancent depuis ce dossier.

**Fini quand** le projet existe et que la section « Demande » de `brief.md` contient la demande et chaque choix par défaut.

### 2. Lire l'ancienne vidéo, ou rassembler les images

**Branche nouvelle** : lis [`references/images.md`](references/images.md). L'étape est finie quand les faits de la vidéo sont dans « Faits vérifiés » avec leur source, et que chaque capture et chaque clip prévus sont dans le projet. Il faut aussi les avoir regardés et notés dans la section « Ancienne vidéo » de `brief.md`, renommée « Images ».

**Branche refonte** : lis `source.md` en entier et ouvre chaque planche qu'il liste avec l'outil de lecture d'image. Si une partie est floue, regarde-la de près avec `refonte-youtube planche --de <a> --a <b> --pas 1`.

**Fini quand** la section « Ancienne vidéo » de `brief.md` est remplie : ce qu'elle montre, son message, ses parties avec leurs temps, ses meilleurs passages à l'image, ce qui a vieilli. Les noms propres vus ou entendus vont dans « Noms et termes ». Si elle est surtout filmée face caméra, l'utilisateur le sait (voir [`references/visuel.md`](references/visuel.md)).

### 3. Écrire le script

Lis [`references/script.md`](references/script.md) et [`references/visuel.md`](references/visuel.md). Écris `script.md` : chapitres, répliques, visuel de chaque réplique, mots forts. Relance `refonte-youtube plan` après chaque passe et corrige ce qu'il signale.

**Fini quand** `plan` sort sans erreur, que la durée tient dans la cible, que chaque alerte est corrigée ou justifiée dans `brief.md`, et que la section « Script » de `brief.md` est remplie.

### 4. Validation du script par l'utilisateur

Envoie-lui le chemin de `script.md`, l'accroche telle qu'elle sera dite, la liste des chapitres avec leur temps (donnée par `plan`), la durée estimée, les faits qui ont changé ou disparu, et les séquences animées prévues. Demande-lui de relire le texte avant que la voix soit générée.

**Fini quand** l'utilisateur valide le script, ou que ses corrections sont faites et que `plan` est de nouveau sans erreur.

### 5. La voix

```
refonte-youtube voix --profil <nom>       # une prise par réplique ; seules les répliques nouvelles ou changées sont dites
refonte-youtube voix --ligne 12,31        # redit ces répliques avec une autre prise
refonte-youtube mots                      # transcrit la voix : cale les mots forts, signale les prises ratées
```

Pour chaque réplique signalée par `voix` (durée anormale) ou par `mots` (texte mal retrouvé), compare l'écrit et l'entendu. Un nom propre mal transcrit n'est pas une faute de la voix. Une prise vraiment ratée se redit avec `--ligne`. Si la même réplique rate deux fois, réécris-la plus simplement (voir [`references/script.md`](references/script.md), section 3). Après toute prise redite, relance `mots`.

**Fini quand** `voix` ne signale plus rien, que `mots` est propre ou que chaque écart restant est un nom noté dans `brief.md`, et que la section « Voix » de `brief.md` est remplie.

### 6. Musique et bruitages

Lis [`references/son.md`](references/son.md).

**Fini quand** `musique` de `refonte.json` liste les morceaux, et que chacun a sa licence dans la section « Musique » de `brief.md`.

### 7. Séquences animées

Lis [`references/motion.md`](references/motion.md). Fabrique chaque `[motion …]` du script avec `pub-video`.

**Fini quand** chaque séquence existe dans `motion/` et que `plan` ne signale plus de séquence introuvable. Sans séquence, coche la case avec « sans objet ».

### 8. Aperçu et revue

`refonte-youtube apercu`, puis la revue des planches de la section 4 de [`references/visuel.md`](references/visuel.md). Corrige, relance `apercu` (seuls les plans modifiés se rendent de nouveau), regarde encore.

**Fini quand** `apercu` affiche OK et qu'une passe complète sur les planches ne trouve plus rien.

### 9. Validation par l'utilisateur

Envoie-lui le chemin de l'aperçu (`exports/<nom>_apercu.mp4`) et sa durée, et dis-lui ce qui se passe dans les 30 premières secondes. Donne-lui la musique et son niveau sous la voix, les prises qu'il doit écouter et les mots dont l'orthographe est à confirmer. Demande-lui de regarder l'aperçu avec le son.

**Fini quand** l'utilisateur valide l'aperçu, ou que ses corrections sont faites et contrôlées (retour à l'étape 8).

### 10. Export final

`refonte-youtube build`, puis `refonte-youtube planche --final --de 0 --a 30 --pas 1` et une planche au milieu et à la fin.

**Fini quand** `build` affiche OK (nombre d'images, synchronisation, −14 LUFS à 0,5 près), que `exports/<nom>.srt` et `exports/<nom>_chapitres.txt` existent, et que tu as regardé les trois planches.

### 11. Livrer

Écris `README.md` dans le projet : ancienne vidéo, profil de voix, musiques et licences, police et licence, séquences animées et leur projet `pub-video`, commandes pour refaire la vidéo. Puis réponds à l'utilisateur, dans sa langue, sans jargon :

1. Les fichiers livrés, chemins complets : la vidéo, les sous-titres, les chapitres.
2. Ce qui a changé par rapport à l'ancienne vidéo : durée avant et après, accroche, chapitres, ce qui a été retiré ou mis à jour.
3. La musique : titres, auteurs, licence, et ce qu'elle n'autorise pas.
4. Ce que lui seul peut juger : la voix à l'oreille, le niveau de la musique, l'orthographe des noms.
5. La publication :
   - les chapitres se collent dans la description, le premier à 0:00 ;
   - le `.srt` se téléverse dans YouTube Studio, rubrique Sous-titres ;
   - la voix clonée se déclare comme contenu modifié ou synthétique ;
   - la miniature reste à faire.

Si un dossier `exports/` existe au-dessus du projet (atelier vidéo de l'utilisateur), copie-y les fichiers livrés.

**Fini quand** l'utilisateur a les chemins, le bilan et les réserves.

## Ce qui fait une refonte pro

À vérifier sur `plan`, `mots` et les planches avant de livrer :

- **La première phrase dit au spectateur ce qu'il gagne**, sur la meilleure image de la vidéo. Ni salut, ni logo, ni présentation.
- **La voix et l'image disent la même chose au même moment.** Aucun visage ne parle sous la nouvelle voix.
- **L'écran change toutes les 3 à 8 secondes**, sans image figée ni accéléré illisible.
- **Chaque chapitre tient sa promesse** : un titre court, une question au début, un résultat à la fin, une relance vers la suite.
- **Les mots forts se lisent d'un coup d'œil** et tombent sur le mot dit.
- **La musique porte sans couvrir**, et elle change au fil de la vidéo au lieu de tourner en boucle.
- **Chaque bruitage a son geste à l'image**, et il y en a peu.
