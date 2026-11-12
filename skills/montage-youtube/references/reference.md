# Vidéo de référence

L'utilisateur donne une vidéo, ou son lien, dont il aime le rythme ou le style. On en mesure le rythme pour régler le montage, et on en note le style. Ses images, sa musique, ses textes et sa marque restent à leur auteur.

## Mesurer

```
montage-youtube ref <lien ou fichier> [--de 60] [--duree 300] [--lang fr]
```

La mesure porte sur un extrait de 5 minutes ; une URL n'est téléchargée que sur cet extrait. Choisis `--de` pour passer l'introduction et tomber sur un passage représentatif du corps de la vidéo.

| Ligne de la fiche | Ce qu'elle t'apprend |
|---|---|
| plans | changements d'image par minute : la densité de coupes à l'image (coupes franches, changements de plan) |
| parole | mots par minute et part du temps parlé : le débit et la densité de la voix |
| pauses | durée des pauses entre deux phrases : le réglage `pause` à reprendre |
| fond sonore | silence entre les phrases, ou musique et ambiance sous la voix |
| niveau | la force sonore de la référence |

## Appliquer

Les réglages conseillés (`pause`, `pauseMax`) viennent des pauses de la référence. Relance la commande avec `--appliquer` depuis le projet pour les écrire dans `projet.json`. Un rush lent ne devient pas une vidéo nerveuse par les seuls réglages : si les mots par minute des rushs (bilan de `plan`) sont loin de ceux de la référence, dis-le à l'utilisateur.

## Regarder

Ouvre chaque planche (`references/<id>_planche-N.png`) avec l'outil de lecture d'image et note, en mots concrets :

1. **Cadre** : face caméra, capture d'écran, les deux en alternance ; plein écran ou encadré.
2. **Texte à l'écran** : titres, mots clés, sous-titres incrustés ; leur taille et leur place.
3. **Procédés** : zooms sur le visage ou l'écran, images d'illustration, flèches, surlignages.
4. **Transitions** : coupes franches, zooms, glissements.

Lis `references/<id>.txt` pour la structure du discours : comment la vidéo accroche, comment elle avance, comment elle conclut.

## Décider

Écris dans `brief.md`, section « Référence » :

- **On reprend** : 2 à 4 traits mesurés (« pauses de 0,25 s », « 180 mots par minute », « une coupe toutes les 3 s »).
- **Réglages appliqués** : les valeurs écrites dans `projet.json`.
- **Style noté** : titres, zooms, bruitages, musique, images d'illustration. Ce montage ne les ajoute pas ; dis-le à l'utilisateur dans la livraison.

## Critère de fin

La section « Référence » de `brief.md` liste ce qu'on reprend, les réglages appliqués et le style noté, chaque trait appuyé sur une mesure de la fiche ou une image des planches.
