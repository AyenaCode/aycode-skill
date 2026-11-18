# Musique et bruitages

Sur une vidéo longue, la musique porte sans se faire remarquer : elle ne couvre jamais la voix et ne lasse pas en dix minutes. Les bruitages ponctuent les moments forts, pas chaque geste.

## 1. La musique

- **2 à 4 morceaux sans paroles** pour 10 minutes. Un morceau en boucle s'entend. Le premier a de l'énergie (l'accroche). Ceux du milieu sont plus calmes et réguliers. Le dernier remonte pour la fin.
- Cherche-les depuis le dossier du projet, où les fichiers vont dans `audio/music/` :

```
pub-video music find --min 120 --mood calm,relaxed --genre ambient,corporate --max 8
pub-video music find --min 90 --mood energetic,motivating --max 6       # pour l'accroche
pub-video music scan audio/music/<fichier>                              # tempo, énergie, changements
pub-video music licence                                                 # licence du jour, copie datée
```

- Écoute-les par la mesure : `scan` montre l'énergie. Évite un morceau dont l'énergie change brutalement au milieu, et un morceau qui a des paroles.
- Inscris-les dans `refonte.json`, dans l'ordre, avec la partie gardée de chacun (secondes dans le morceau) :

```json
"musique": [
  { "fichier": "audio/music/intro.mp3", "debut": 0, "fin": 75, "titre": "…", "auteur": "…", "licence": "https://mixkit.co/license/#musicFree" },
  { "fichier": "audio/music/fond-1.mp3", "debut": 4 },
  { "fichier": "audio/music/fond-2.mp3", "debut": 0 }
]
```

  Les morceaux s'enchaînent par un fondu de `mixage.fondu_musique` secondes (3 par défaut). Si la musique finit avant la vidéo, `build` le dit : ajoute un morceau.
- **La licence est écrite** : titre, auteur, source, adresse de la licence et date, dans la section « Musique » de `brief.md`. Une musique sans licence claire n'entre pas.

## 2. Les niveaux

| Réglage (`mixage` dans `refonte.json`) | Défaut | Effet |
|---|---|---|
| `musique_sous_voix` | 12 | écart en LU entre la voix et la musique, mesuré sur toute la vidéo |
| `baisse` | 10 | dB de baisse en plus quand la voix parle ; la musique remonte dans les pauses et les séquences sans voix |
| `lufs` | −14 | niveau final, celui que YouTube vise |

Le niveau se mesure ; tu ne l'entends pas. La musique couvre la voix ? Monte `musique_sous_voix` à 15 ou `baisse` à 13. Elle disparaît ? Descends-les à 10 et 8. La livraison demande à l'utilisateur d'écouter au casque et sur le haut-parleur d'un téléphone.

## 3. Les bruitages

Ils viennent de `pub-video` (`pub-video sfx list` donne la liste) :

| Réglage (`bruitages` dans `refonte.json`) | Défaut | Quand |
|---|---|---|
| `mots_forts` | `pop` | à l'arrivée de chaque mot fort ; `null` pour aucun |
| `chapitres` | `whoosh` | à chaque carte de chapitre |
| `cartons` | `hit` | à chaque carton |
| `sequences` | 0,45 | gain du son propre des séquences animées (pub-video le rend seul à −14 LUFS, trop fort sous la voix) |
| `volume` | 1 | tous les bruitages ensemble |

- Dans le script, `son=ding` (ou `son=ding+0.6`, en secondes après le début de la réplique) ajoute un bruitage là où l'image montre une action : un clic, un résultat, une validation.
- Une séquence animée garde ses propres bruitages, et sa musique si elle en avait une. Rends-la sans musique (voir [`motion.md`](motion.md)).
- Un vrai enregistrement remplace un son synthétique : `pub-video sfx get <type>` le met dans `audio/sfx/<type>.wav`.
- **Peu, mais juste** : un bruitage sans action à l'image se retire. Sur dix minutes, une quarantaine de mots forts avec chacun leur `pop`, c'est déjà beaucoup. Si les mots forts sont nombreux, passe `mots_forts` à `swish`, plus doux, ou baisse `volume` à 0,7.
