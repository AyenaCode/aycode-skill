# Rassembler les images d'une vidéo nouvelle

Sans ancienne vidéo, rien n'est filmé. L'image vient de trois sources : les captures des pages qui prouvent ce que dit la voix, les clips que l'utilisateur fournit, et les séquences animées qui racontent ce qui ne se capture pas. Le spectateur doit sentir une vidéo construite, pas un diaporama.

## 1. Les faits d'abord

Chaque fait dit ou affiché a sa source primaire : annonce officielle, documentation, page produit, étude. Il entre dans « Faits vérifiés » de `brief.md` avec l'adresse et la date. Cette source sert deux fois : elle prouve le fait, et sa capture le montre.

## 2. Les captures

Depuis le dossier du projet, en lecture seule (la commande ouvre et fait défiler les pages, rien de plus) :

```
pub-video capture <url> [<url>…] --device desktop --out images/captures
```

Pour chaque page, elle écrit `images/captures/<nom>.png` (un écran) et `<nom>_full.png` (la page entière).

- **Montrer le détail** : `[image images/captures/<nom>.png zoom=1.5@0.3,0.4]` zoome vers le passage qui compte (fractions de la largeur et de la hauteur). Regarde la capture avant de choisir le point.
- **Parcourir une page** : `[image images/captures/<nom>_full.png defile]` la fait défiler de haut en bas. Une page de plus de 8 000 px de haut se recadre d'abord sur la partie utile : `ffmpeg -i <nom>_full.png -vf crop=iw:5000:0:0 images/captures/<nom>_haut.png`.
- **Un tiers se montre seulement par la page publique citée comme source.** Pas de capture d'un réseau social qui montre des personnes privées. Les données personnelles visibles se recadrent hors du champ.

## 3. Les clips de l'utilisateur

Les vidéos que l'utilisateur fournit (captures d'écran filmées, démonstrations, plans de coupe dont il a les droits) vont dans `clips/`. Regarde-les avec `refonte-youtube planche --fichier clips/<nom>.mp4 --pas 1`, puis utilise-les comme une ancienne vidéo : `[video clips/<nom>.mp4 0:10-0:25 zoom]`, `[=]` pour la suite. Une vidéo d'un tiers n'entre jamais, même courte.

## 4. Les séquences animées

Elles portent ce qui ne se capture pas : l'accroche, une idée abstraite, un chiffre, un parcours, un tuto, une comparaison. Pour une vidéo nouvelle, compte 6 à 10 séquences sur 10 minutes. Lis [`motion.md`](motion.md), y compris sa section sur les personnages et les objets.

## 5. Le dosage

Sur 10 minutes, environ :

| Images | Part du temps |
|---|---|
| captures (zoom ou défilement) et clips | la moitié |
| séquences animées | un tiers |
| cartons et images fournies | le reste, un carton par minute au plus |

Deux captures fixes ne se suivent pas plus de deux fois de suite. Entre elles, un clip, une séquence ou un carton relance l'œil.

## Critère de fin

Chaque fait a sa source dans « Faits vérifiés ». Chaque capture et chaque clip prévus sont dans le projet et ont été regardés. La section « Images » de `brief.md` liste ce que montre chacun.
