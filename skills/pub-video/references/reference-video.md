# Analyser une vidéo de référence

L'utilisateur fournit une vidéo dont il aime le style. On en tire un rythme, une structure et des procédés. Ses images, sa musique, ses textes et sa marque restent à leur auteur.

## Mesurer

```
pub-video ref <url ou fichier> [--lang fr]
```

Pour une URL, la vidéo est téléchargée avec yt-dlp dans `references/`. La commande écrit :

- `references/<id>_plans-N.png` : une image par plan, dans l'ordre, avec sa seconde,
- `references/<id>.srt` : le texte parlé, horodaté (si whisper.cpp est installé),
- `references/<id>.json` : toutes les mesures,

et affiche la fiche de rythme :

| Ligne | Ce qu'elle t'apprend |
|---|---|
| plans | le nombre de plans et leur durée moyenne : le débit de montage à reproduire |
| musique | le tempo, et la part des coupes qui tombent sur un temps. Une netteté sous 4 veut dire : pas de musique rythmée, la voix porte tout |
| niveau | la force sonore visée |
| parole | mots par minute et part du temps parlé : le débit et la densité de la voix off |

Une vidéo longue (plus de 5 minutes) se découpe d'abord : `ffmpeg -ss 60 -t 60 -i <fichier> -c copy references/extrait.mp4`, sur le passage le plus représentatif.

## Regarder

Ouvre chaque planche avec l'outil de lecture d'image et décris ce que tu vois, en mots concrets :

1. **Cadre et composition** : format, place du sujet, plein écran ou encadré, marges.
2. **Typographie** : taille des titres par rapport au cadre, graisse, casse, nombre de mots par écran, place du texte, sous-titres ou non.
3. **Couleur** : fonds clairs ou sombres, nombre de couleurs, contrastes.
4. **Matière** : aplats, dégradés, photos, captures d'écran, grain, ombres.
5. **Procédés récurrents** : gros plans sur l'écran, incrustations, flèches, surlignages, compteurs, images empilées.
6. **Transitions** : coupes franches, zooms, glissements ; lesquelles reviennent.

Lis le `.srt` pour la structure du discours : comment la vidéo accroche, dans quel ordre elle avance, comment elle conclut, quel ton elle prend.

## Décider

Écris dans `brief.md`, section Référence :

- **On reprend** : 3 à 5 traits mesurables ou visibles (« une coupe toutes les 1,2 s », « un seul mot clé à l'écran, en très gros », « gros plans sur l'interface », « voix à 190 mots par minute, sans musique »).
- **On laisse** : ce qui ne sert pas ce produit ou ce format (une vidéo horizontale de 20 minutes ne se copie pas dans une pub verticale de 30 s : on en garde le ton et les procédés, pas la durée des plans).
- **On adapte** : comment chaque trait repris se traduit ici (« débit de parole rapide → 5,8 syllabes par seconde dans `voice check --rate 5.8` »).

Quand la référence et la marque du produit se contredisent (couleurs, police), la marque du produit gagne : la référence donne la manière, le produit donne la matière.

Si la référence appartient à l'utilisateur et qu'il veut en réutiliser un élément (sa voix, son logo animé), il le dit et fournit le fichier.

## Critère de fin

La section Référence de `brief.md` liste ce qu'on reprend, ce qu'on laisse et comment on adapte, chaque trait appuyé sur une mesure ou sur une image précise des planches.
