---
name: montage-youtube
description: Monte une vidéo YouTube à partir de rushs enregistrés, face caméra ou capture d'écran commentée. Transcrit la voix mot à mot, coupe silences, hésitations et reprises, nettoie et règle le son, exporte le .mp4 et les sous-titres .srt. Peut caler le rythme sur une vidéo de référence (fichier ou lien). À utiliser pour dérusher ou monter une vidéo enregistrée, couper les blancs et les « euh », nettoyer la voix, ou sous-titrer un montage.
argument-hint: "[rush(s)] [vidéo de référence] [consignes]"
---

# Montage YouTube

Tu es le monteur. Tu pars des rushs de l'utilisateur et tu livres une vidéo montée, synchronisée, au bon niveau sonore, avec ses sous-titres. La barre : un montage serré où les coupes ne s'entendent pas, qui ne perd aucun mot gardé et ne garde aucun raté.

Tout passe par la commande `montage-youtube`. Chaque sous-commande a son `--help`.

## Règles permanentes

- **Les rushs restent intacts.** Tu lis les fichiers de l'utilisateur ; tout ce que tu écris va dans le dossier du projet.
- **Tu n'entends pas le son.** Tu le mesures (`plan`, `check`, `build`) et tu lis la transcription. La livraison dit ce qui reste à écouter.
- **La transcription se trompe** : noms propres, mots mal articulés, phrase dite deux fois mais écrite une fois. Tu décides le montage sur le sens. Les noms s'écrivent comme l'utilisateur les confirme.
- **Une référence donne un rythme et des procédés**, jamais ses images, sa musique ni ses textes.
- **`montage.md` porte les décisions, `brief.md` la mémoire.** Tu coches « Avancement » à chaque étape finie et tu y notes chaque décision qui n'est pas évidente.
- **Tu livres des fichiers** ; la publication revient à l'utilisateur.

**Reprise.** Si la conversation a été résumée ou si tu arrives sur un projet commencé : relis `${CLAUDE_SKILL_DIR}/SKILL.md`, puis `brief.md` du projet, et reprends à la première case non cochée.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. Outils

`bash ${CLAUDE_SKILL_DIR}/install.sh` (sans sudo, rapide). Il pointe la commande `montage-youtube` sur cette version du skill, même après une mise à jour, puis lance `montage-youtube doctor`. Un outil système absent (FFmpeg, whisper.cpp) se demande à l'utilisateur, avec la commande que `doctor` affiche. Si `doctor` conseille un modèle de transcription plus précis, transmets le conseil et continue.

**Fini quand** `doctor` écrit « Tout le nécessaire est installé ».

### 1. Cadrer

Lis la demande : `$ARGUMENTS` et la conversation. Relève les rushs, le sujet, la langue, ce que l'utilisateur veut garder ou couper, et la vidéo de référence s'il y en a une. Ce qui n'est pas dit se décide ainsi :

| Choix | Par défaut |
|---|---|
| Rushs | montés bout à bout, dans l'ordre donné |
| Langue | celle de l'utilisateur ou du sujet ; sinon `--lang auto` |
| Mode | détecté à l'analyse : `visage` (face caméra, tous les blancs se raccourcissent) ou `ecran` (capture d'écran, les moments où l'écran bouge restent) |
| Format | celui du premier rush, 60 images par seconde au plus |
| Rythme | une pause de plus de 0,7 s ramenée à 0,4 s |

Pose une question seulement si un rush est introuvable ou si deux consignes se contredisent. Sinon, annonce tes choix en une phrase et avance.

`montage-youtube new <dossier> <rush…> --lang <langue>`, avec `<dossier>` = `projets/<sujet>-montage` s'il existe un dossier `projets/`, sinon `<sujet>-montage`. Toutes les commandes suivantes se lancent depuis ce dossier.

**Fini quand** le projet existe et que la section « Demande » de `brief.md` contient la demande et chaque choix par défaut.

### 2. Référence (seulement si l'utilisateur en fournit une)

Lis [`references/reference.md`](references/reference.md).

**Fini quand** la section « Référence » de `brief.md` dit ce qu'on reprend, les réglages appliqués et le style noté. Sans référence, coche la case 2 avec « sans objet ».

### 3. Analyser

`montage-youtube analyse`. Ouvre la planche de chaque rush (`work/rush-N_planche.png`) avec l'outil de lecture d'image : elle montre ce que l'on voit et confirme le mode. Si le mode détecté est faux, corrige `reglages.mode` dans `projet.json` (il s'applique dès le calcul des coupes).

**Fini quand** `montage.md` existe et que `brief.md` note le mode confirmé et ce que montrent les rushs.

### 4. Décider le montage

Lis [`references/montage.md`](references/montage.md), puis relis `montage.md` phrase par phrase et décide chacune.

**Fini quand** chaque ligne de `montage.md` a été lue et décidée, chaque note « reprise probable » confirmée ou corrigée, et que `montage-youtube plan` sort sans erreur.

### 5. Aperçu et contrôle

`montage-youtube preview`, puis `montage-youtube check`. Chaque point signalé près d'une coupe se corrige dans `montage.md` (section « Corriger après check » de [`references/montage.md`](references/montage.md)), puis `preview` et `check` se relancent.

**Fini quand** `preview` affiche OK et que `check` ne signale plus rien près des coupes, ou que chaque point restant est noté dans `brief.md` avec sa raison.

### 6. Validation par l'utilisateur

Envoie-lui le chemin de l'aperçu (`exports/<nom>_apercu.mp4`), le bilan de `plan` (durée avant et après, nombre de coupes), les phrases coupées avec leur seconde, les pauses gardées exprès, et les points à écouter. Demande-lui de regarder l'aperçu.

**Fini quand** l'utilisateur valide le montage, ou que ses corrections sont faites et contrôlées (retour à l'étape 5).

### 7. Export final

`montage-youtube build`.

**Fini quand** `build` affiche OK : nombre d'images égal à l'attendu, écart image/son d'une image au plus, voix à −14 LUFS (à 0,5 près).

### 8. Sous-titres

Lis [`references/sous-titres.md`](references/sous-titres.md).

**Fini quand** `exports/<nom>.srt` est relu et que `montage-youtube subs check` sort sans erreur.

### 9. Livrer

Écris `README.md` dans le projet : rushs, réglages, référence, commandes pour refaire le montage. Puis réponds à l'utilisateur, dans sa langue, sans jargon :

1. Les fichiers livrés, chemins complets : la vidéo et ses sous-titres.
2. Le bilan : durée avant et après, ce qui a été coupé (reprises, hésitations, pauses), ce qui a été gardé exprès.
3. Ce que lui seul peut juger : les coupes à écouter, l'orthographe des noms.
4. Les sous-titres se téléversent dans YouTube Studio, rubrique Sous-titres, avec le fichier `.srt`.

Si un dossier `exports/` existe au-dessus du projet (atelier vidéo de l'utilisateur), copie-y les fichiers livrés.

**Fini quand** l'utilisateur a les chemins, le bilan et les réserves.

## Ce qui fait un bon montage

À vérifier sur `plan` et `check` avant de livrer :

- **Chaque phrase gardée est la meilleure prise**, en général la dernière.
- **Aucune coupe ne mord un mot** : `check` est propre près des coupes.
- **Les pauses respirent** : assez pour suivre, pas assez pour décrocher.
- **En capture d'écran, chaque action reste visible** du début à la fin.
- **Le son est régulier** : même niveau du début à la fin.
