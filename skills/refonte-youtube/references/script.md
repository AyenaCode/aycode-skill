# Écrire le nouveau script

Le script garde le fond de l'ancienne vidéo et change la forme. La barre : une vidéo qu'on regarde jusqu'au bout. Le spectateur sait dès la première phrase ce qu'il va gagner, et chaque minute lui donne une raison de rester.

## 1. Partir de l'ancienne vidéo

- Dans `source.md` et dans la section « Ancienne vidéo » de `brief.md`, relève le message, les étapes et les preuves (démonstrations, chiffres, résultats). C'est la matière du script. Les formules de remplissage partent : « salut à tous », « comme je vous disais », les répétitions, les digressions.
- **Tout ce qui se dit est vrai.** Un fait vient de l'ancienne vidéo ou d'une source que tu as lue. Il entre dans la table « Faits vérifiés » de `brief.md` avec cette source. Ce qui est dépassé (prix, interface changée, version) se demande à l'utilisateur ou se retire. Rendre une phrase plus percutante ne crée pas de nouveau chiffre ni de nouvelle promesse.
- L'ordre peut changer : le résultat le plus fort passe en tête, une démonstration remonte avant l'explication.

## 2. La structure d'une vidéo YouTube longue

| Moment | Rôle | Durée sur 10 min |
|---|---|---|
| Accroche | le problème ou le résultat, montré, en une ou deux phrases ; puis la promesse de la vidéo | 0 à 30 s |
| Plan annoncé | ce qu'on va voir, en une phrase, sans liste longue | 30 à 45 s |
| Chapitres | une idée par chapitre ; chacun s'ouvre sur sa question et se ferme sur son résultat | 1 à 3 min chacun |
| Relances | toutes les 60 à 90 s, une phrase qui ouvre la suite : « et c'est là que ça devient intéressant », une question, un teaser du chapitre suivant | quelques secondes |
| Fin | le résultat résumé en une phrase, puis une seule action demandée (abonnement, vidéo suivante, lien) | 15 à 30 s |

- **L'accroche n'a ni salut, ni présentation, ni logo.** La première phrase dit au spectateur ce qu'il a à gagner ou à perdre. Elle s'appuie sur la meilleure image de la vidéo, ou sur une séquence animée.
- Chaque chapitre a un titre court, celui que verra YouTube : 2 à 5 mots, une promesse plutôt qu'une étiquette (« Le réglage qui double la vitesse » plutôt que « Paramètres »). Le premier titre est à 0:00 (`# Intro` suffit). Il faut au moins 3 chapitres, de 10 s au moins chacun.
- La durée visée vaut à 10 % près. `refonte-youtube plan` la mesure dès que le script existe.

## 3. Écrire pour l'oreille et pour la voix clonée

- **Une réplique = une ou deux phrases, 25 mots au plus.** Une réplique courte donne une meilleure prise de voix, et l'image change avec elle.
- Des phrases courtes, au présent, en « tu » ou en « vous » selon l'ancienne vidéo ou la ligne éditoriale (`publish/ligne.md` s'il existe). Un verbe d'action par phrase.
- La ponctuation fait les pauses de la voix : une virgule donne une respiration, un point une vraie pause. Ni parenthèses, ni abréviations, ni émojis, ni symbole (`→`, `&`, `/`). Écris « pour cent », « euros », « par exemple ». Écris aussi en toutes lettres un nombre qui se lit mal à voix haute.
- Les noms propres et les sigles s'écrivent comme ils se prononcent si la voix les déforme. `mots` le révèle, et la forme écrite exacte va dans « Noms et termes ».
- Le débit visé tourne autour de 150 à 170 mots par minute parlée (`plan` l'affiche). Au-dessus, la voix se presse ; en dessous, la vidéo traîne.

## 4. Les mots forts

`*mot fort*` affiche ces mots en grand, au moment où ils sont dits, dans un cadre de la couleur d'accent.

- Un mot fort toutes les 5 à 10 secondes environ : un chiffre, un résultat, le nom d'une étape, une opposition. Il en faut au moins un par chapitre.
- 1 à 4 mots, jamais une phrase entière : il se lit en un coup d'œil.
- Il ne double pas un texte déjà à l'image (carton, titre dans une capture). Sur un écran chargé en bas, passe `style.position_mots` à `haut` dans `refonte.json`.

## 5. Le visuel de chaque réplique

Chaque ligne commence par ce qu'on voit (syntaxe : `refonte-youtube help script`). Choisis-le en écrivant, avec [`visuel.md`](visuel.md). La voix et l'image se répondent : la réplique dit ce que l'image montre, au même moment.

## 6. Critère de fin

- Chaque réplique a son visuel, et chaque fait a sa ligne dans « Faits vérifiés ».
- `refonte-youtube plan` sort sans erreur, et la durée tient dans la cible.
- Les alertes de `plan` sont corrigées ou justifiées dans `brief.md`.
- L'accroche, les titres de chapitre et la fin sont notés dans la section « Script » de `brief.md`.
