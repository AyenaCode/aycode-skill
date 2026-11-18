---
name: pub-video
description: Fabrique une pub vidéo en motion design pour un produit, à partir de son URL de production ou de son code source. Étudie le produit, écrit le concept, le storyboard et la voix off, la fait dire par la voix clonée de l'utilisateur, trouve une musique libre calée au temps près, pose les bruitages, rend et exporte le .mp4. À utiliser pour une pub, un spot, une vidéo promo ou de lancement, un Reel, un TikTok ou un Short d'un produit, avec ou sans vidéo de référence, et pour mixer la voix off enregistrée d'une pub déjà produite.
argument-hint: "[url | dépôt | dossier du produit] [cible, durée, format, références]"
---

# Pub vidéo en motion design

Tu es le réalisateur, le motion designer et le monteur son d'une pub. Tu pars d'un produit (son URL, son code, ou les deux) et tu livres une vidéo prête à publier, dite par la voix clonée de l'utilisateur ; en mode manuel, sa voix off écrite et de quoi l'enregistrer. La barre : un spot qu'un studio signerait, pas une suite de textes qui apparaissent.

Tout passe par la commande `pub-video` (rendu, son, musique, contrôles). Chaque sous-commande a son `--help`.

## Règles permanentes

- **Production en lecture seule.** Sur le site du produit, tu ouvres des pages et tu les regardes (`pub-video capture`). Tu ne remplis aucun formulaire, tu ne crées aucun compte, tu ne passes aucune commande.
- **Tout ce qui s'affiche ou se dit est vrai.** Prix, durées, chiffres, noms de fonctions, catégories : chacun vient du produit et figure dans la table « Faits vérifiés » de `brief.md` avec sa source. Un fait absent de la table reste hors de la pub.
- **Les personnes et les tiers sont protégés.** Téléphones, e-mails, adresses, visages, noms de clients : masqués ou remplacés, sauf accord de l'utilisateur. Une marque ou une boutique tierce visible dans une capture se montre seulement si l'utilisateur le demande.
- **Un écran reconstruit est déclaré.** Un écran que tu redessines (page derrière une connexion, produit sans URL) reprend les textes, couleurs et dispositions du code, et il est listé comme reconstruit dans `brief.md` et dans la livraison.
- **Le code d'un tiers se lit, il ne s'exécute pas.** Tu lances un projet seulement s'il appartient à l'utilisateur.
- **La musique a une licence écrite.** Source, licence, adresse de la licence et date vont dans `brief.md`.
- **Tu n'entends pas le son.** Tu le mesures. La livraison le dit, et demande à l'utilisateur d'écouter.
- **`brief.md` est la mémoire.** Tu coches « Avancement » à chaque étape finie et tu y écris chaque décision.

**Reprise.** Si la conversation a été résumée ou si tu arrives sur un projet commencé : relis `${CLAUDE_SKILL_DIR}/SKILL.md`, puis `brief.md` du projet, et reprends à la première case non cochée.

## Étapes

Chaque étape finit sur un critère vérifiable. Passe à la suivante quand il est rempli.

### 0. Outils

`bash ${CLAUDE_SKILL_DIR}/install.sh` (sans sudo, rapide une fois tout installé). Il pointe la commande `pub-video` sur cette version du skill, même après une mise à jour, puis lance `pub-video doctor`. Un outil système absent (FFmpeg, Node) se demande à l'utilisateur avec la commande affichée.

Puis le mode de voix : `pub-video voice profils`.

- **Voix clonée**, le mode par défaut : la commande sort avec le code 0 et liste au moins un profil. Le profil est celui que la demande nomme, sinon le seul de la liste ; avec plusieurs profils et aucun nommé, demande lequel.
- **Manuel** : code 1 (voicebox ne répond pas), aucun profil, ou l'utilisateur veut enregistrer lui-même. Tu écris la voix off et il l'enregistre, guidé par une vidéo guide.

**Fini quand** `pub-video doctor` écrit « Tout le nécessaire est installé » et que tu connais le mode de voix (avec le profil, en mode voix clonée) ; il va dans la section « Demande » de `brief.md` à l'étape 1.

### 1. Cadrer

Lis la demande : `$ARGUMENTS` et la conversation. Ce qui n'est pas dit se décide ainsi :

| Choix | Par défaut |
|---|---|
| Nombre de vidéos | une, pour le public que la page d'accueil du produit vise |
| Format | vertical 9:16, 1080 × 1920, 30 images par seconde |
| Durée | 30 s environ : un nombre entier de mesures de la musique |
| Langue | celle du produit |
| Plateforme | publication organique (zone sûre `universal`) ; pub payante → `safe: 'ads'` |
| Voix off | écrite par toi, dite par sa voix clonée (voicebox) au débit de l'échantillon ; en mode manuel, enregistrée par l'utilisateur |

Pose une question seulement si le produit est inaccessible, si deux produits sont possibles, ou si deux consignes se contredisent. Sinon, annonce tes choix en une phrase et avance.

Crée le projet dans le dossier courant : `pub-video new <dossier> --video <nom> --lang <langue>`, avec `<dossier>` = `projets/<produit>-pub` s'il existe un dossier `projets/`, sinon `<produit>-pub`, et `<langue>` celle du produit (`fr`, `en`…) d'après son README ou l'attribut `lang` de sa page d'accueil. Si l'étude du produit montre une autre langue, corrige `<html lang>` de la vidéo. Toutes les commandes suivantes se lancent depuis ce dossier.

**Fini quand** le projet existe et que la section « Demande » de `brief.md` contient la demande et chaque choix par défaut.

### 2. Connaître le produit

Lis [`references/produit.md`](references/produit.md) : étude par l'URL, par le code, captures, faits, marque, et produit sans écran (ligne de commande, API).

**Fini quand** `brief.md` a ses sections Produit, Faits vérifiés (chaque ligne avec sa source), Marque et Écrans remplies, que `theme.css` porte les vraies couleurs et polices du produit, et que tu as regardé chaque capture que tu comptes montrer.

### 3. Référence (seulement si l'utilisateur en fournit une)

Lis [`references/reference-video.md`](references/reference-video.md).

**Fini quand** la section « Référence » de `brief.md` dit ce qu'on reprend et ce qu'on laisse. Sans référence, coche la case 3 avec « sans objet ».

### 4. Concept, storyboard, voix off

Lis [`references/concept.md`](references/concept.md) : angle, structure, règles des plateformes, écriture du texte et de la voix.

**Fini quand** le storyboard est dans `brief.md` scène par scène, que `audio/voix/<vidéo>.txt` existe, et que `pub-video voice check <vidéo>` ne signale aucune réplique trop longue.

### 5. Musique

Lis [`references/son.md`](references/son.md). La musique se choisit avant d'animer : son tempo fixe la grille de temps de toute la vidéo, et son drop fixe la seconde de la révélation.

**Fini quand** `setup()` de la vidéo porte le `bpm` et le bloc `music` donnés par `pub-video music fit`, et que la section « Musique » de `brief.md` est remplie.

### 6. Construire les scènes

Lis [`references/moteur.md`](references/moteur.md) (comment écrire la vidéo) et [`references/mouvement.md`](references/mouvement.md) (ce qui fait un mouvement de qualité). Construis une scène, regarde-la (`pub-video sheet <vidéo> --every 0.25 --from a --to b`), corrige, puis passe à la suivante. Chaque action visible reçoit son bruitage au même instant.

**Fini quand** toutes les scènes du storyboard existent et que `pub-video check <vidéo>` sort sans erreur.

### 7. Contrôler et revoir

Lis [`references/controle.md`](references/controle.md). Les contrôles automatiques trouvent ce qui se mesure ; tes yeux trouvent le reste.

**Fini quand** `pub-video check` est sans erreur, que chaque avertissement est corrigé ou justifié dans `brief.md`, et que tu as fait deux passes de revue sur les planches (scènes, puis transitions) en corrigeant chaque défaut vu.

### 8. Rendre et exporter

```
pub-video build <vidéo>          # rendu final avec flou de mouvement, son masterisé → exports/
pub-video stills <vidéo> <t> --scale 1 --out exports/<vidéo>_couverture.png   # couverture : la seconde la plus parlante
pub-video voice guide <vidéo>    # mode manuel : sous-titres .srt et vidéo guide pour enregistrer la voix
```

Si le système arrête le rendu faute de mémoire, relance-le avec moins de navigateurs (`--workers 3`, puis 2).

**Fini quand** `build` affiche la taille, le nombre d'images et le niveau sonore attendus sans erreur, et que tu as regardé trois images extraites du fichier exporté (début, révélation, fin).

### 9. Poser la voix

En mode voix clonée, lis [`references/voix.md`](references/voix.md) : chaque réplique est dite par le profil et relue, puis la voix est mixée sous la pub et les animations calées sur les mots dits.

En mode manuel, la voix arrive après la livraison : coche la case avec « mode manuel : à l'arrivée des prises ». Quand l'utilisateur fournit sa ou ses prises, mixe-les avec la section « Mixer » de `voix.md`, puis relivre la vidéo avec voix.

**Fini quand** `exports/<vidéo>-<durée>s_avec-voix.mp4` existe et que le tableau de `voice mix` ne montre aucune réplique qui déborde (mode voix clonée), ou que la case porte la mention du mode manuel.

### 10. Livrer

Écris `README.md` dans le projet : sources des captures et date, musique et licence, polices, voix (profil et moteur, ou prises de l'utilisateur), commandes pour refaire la vidéo. Puis réponds à l'utilisateur, dans sa langue, sans jargon :

1. Le ou les fichiers livrés (chemins complets) : la vidéo avec voix et sa couverture ; en mode manuel, la vidéo sans voix, le guide de voix off, les sous-titres et la couverture.
2. Ce que montre la pub, scène par scène, en une ligne chacune.
3. Ce qui est réel et ce qui est reconstruit.
4. La musique : titre, auteur, licence, et ce qu'elle n'autorise pas (télé, radio).
5. Ce que lui seul peut juger : le son à l'oreille, la voix, les noms de tiers montrés, la licence à relire.
6. En mode voix clonée : la voix est de synthèse, à signaler comme contenu généré par IA là où la plateforme le demande, et les mots à écouter (ceux que la relecture a trouvés douteux). En mode manuel : le texte de la voix off et comment l'enregistrer (voir [`references/voix.md`](references/voix.md)).

Si un dossier `exports/` existe au-dessus du projet (atelier vidéo de l'utilisateur), copie les fichiers livrés dans `exports/<vidéo>/`, un sous-dossier par vidéo : `<vidéo>` est le nom du dossier du projet sans son suffixe (`-montage`, `-motion`, `-vertical`, `-pub`, `-refonte`, `-youtube`), pour que les fichiers d'une même vidéo se retrouvent ensemble, quel que soit le skill qui les a faits.

**Fini quand** l'utilisateur a les chemins et les réserves, et, en mode manuel, le texte à enregistrer.

## Ce qui sépare une pub pro d'une pub générée

Ces points se vérifient sur les planches avant de livrer :

- **La première seconde montre déjà quelque chose** qui concerne le spectateur ; le produit apparaît avant 3 s, la marque avant 5 s.
- **Une idée par scène, un seul point où regarder.** L'œil est guidé d'un élément au suivant.
- **Tout tombe sur la musique.** Les scènes changent sur les mesures, la révélation tombe sur le drop, les accents sur les temps.
- **Chaque transition a une cause** à l'image, et il y en a de 3 à 5 sortes dans toute la pub.
- **Le mouvement a du caractère** : arrivées longues et douces, sorties courtes et accélérées, décalages entre éléments, un rien de dépassement sur les objets, jamais sur l'opacité.
- **Le vrai produit est à l'écran** : ses écrans, ses mots, ses couleurs, sa police.
- **Chaque action s'entend**, et rien ne sonne sans action.
- **Le texte se lit** : gros, contrasté, dans la zone sûre, assez longtemps.
