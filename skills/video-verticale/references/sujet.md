# Branche sujet : motion design avec pub-video

But : une vidéo verticale qui explique un sujet en motion design, fabriquée avec le moteur, la musique et les bruitages de `pub-video`. Le dossier du skill `pub-video` est celui qu'affiche `video-verticale doctor`. On le note ici `<pub-video>`.

## 1. Le sujet et ses faits

- Cherche le sujet dans des sources de premier rang : documentation officielle, institution, étude, article de référence. Un blog qui cite une source se remplace par la source.
- Remplis la table « Faits vérifiés » du `brief.md` de `pub-video` : un fait par ligne, avec sa source et sa date. Un fait absent de la table reste hors de la vidéo, à l'écran comme dans la voix.
- Dans la section « Produit », écris le sujet : pour qui, sa question dans ses mots, la promesse (ce qu'il saura à la fin), la preuve, l'action demandée (suivre, commenter, essayer).

## 2. Le projet

`pub-video new projets/<sujet>-motion --video <nom> --format 9:16 --lang <langue>`. Il n'y a pas de produit à capturer : l'étape « Connaître le produit » de `pub-video` est remplacée par la section 1 ci-dessus.

## 3. Ce qu'on reprend de pub-video

Suis les étapes 4 à 8 du `SKILL.md` de `pub-video` et leurs références dans `<pub-video>/references/`, en lisant « produit » comme « sujet » :

- `concept.md` : l'angle, les trois accroches, le texte à l'écran. Prends la structure ci-dessous à la place de la trame publicitaire.
- `son.md` : la musique se choisit avant d'animer.
- `moteur.md` et `mouvement.md` : écrire les scènes et réussir le mouvement.
- `controle.md` : contrôles et revue des planches.
- `voix.md` : l'enregistrement et le mixage de la voix.

`produit.md` et `pub-video capture` ne servent pas.

## 4. Structure d'une explication (30 à 60 s)

| Moment | Durée | Rôle |
|---|---|---|
| Accroche | 0 à 2 s | une question ou un fait surprenant, en gros, dès la première image |
| Promesse | 2 à 4 s | ce que le spectateur saura à la fin |
| Points | 3 × 6 à 12 s | une idée par scène, une image par idée (schéma, chiffre animé, avant/après) |
| Chute | 3 à 5 s | la leçon en une phrase |
| Appel | 2 à 3 s | suivre, commenter, essayer |

Les images se dessinent en typographie, formes, icônes et schémas faits en CSS ou SVG. Aucune photo de personne réelle. Le logo d'une marque n'apparaît que si le sujet en parle.

## 5. La voix et les sous-titres

- `pub-video` écrit le texte de la voix ; l'utilisateur l'enregistre, puis `pub-video voice mix` l'ajoute à la vidéo.
- Les sous-titres de la voix seront incrustés au centre-bas de l'image (`sous_titres.hauteur` 0,68, soit y ≈ 1 300 sur 1 920). Laisse donc libre de texte la bande y 1 180 à 1 440 dans les scènes, ou note dans `brief.md` la hauteur où les scènes laissent de la place.
- L'export avec voix devient la source de `video-verticale new` (étape 4 du skill), avec `--voix render/<vidéo>_voice.wav` (la voix seule, écrite par le mixage de `pub-video`). Il a déjà sa musique et ses bruitages : dans `verticale.json`, laisse `musique` à `null` et `bruitages` vide.
