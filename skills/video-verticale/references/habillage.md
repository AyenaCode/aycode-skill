# Habillage : décider verticale.json

But : décider chaque champ de `verticale.json`, puis juger le résultat sur les planches. Les temps des mots et des coupes sont dans `work/mots.json` (en secondes, sur la vidéo finale).

## Sous-titres (`sous_titres`)

| Champ | Rôle | Comment décider |
|---|---|---|
| `style` | `pop` : 2 ou 3 mots, le mot dit passe en couleur, chaque groupe entre en rebondissant. `mot` : un mot à la fois, très gros. `ligne` : une ou deux lignes posées, remplies au rythme de la voix. `aucun` : pas de sous-titres. | `pop` par défaut. `mot` pour un débit rapide et un ton énergique. `ligne` pour un ton posé, une explication, une citation. |
| `taille` | taille de la police (120 par défaut) | Le style ajuste déjà (`mot` plus gros, `ligne` plus petit). Baisse-la si un groupe déborde ; ne descends pas sous 90. |
| `couleur`, `accent` | texte, et mot dit ou mot fort (`#RRGGBB`) | La couleur de la marque de l'utilisateur en accent s'il en a une, sinon jaune `#FFD400`. Le texte reste blanc. |
| `hauteur` | centre des sous-titres, en part de la hauteur (0,68 par défaut) | Sous le visage, au-dessus de la zone des boutons. Entre 0,55 et 0,72 ; plus haut si le bas de l'image porte l'action. |
| `majuscules` | tout en capitales | Oui pour `pop` et `mot`, non pour `ligne`. |
| `mots_max` | mots par groupe en `pop` | 3 ; 2 pour un débit très rapide. |
| `emphase` | mots forts, en couleur d'accent et plus gros | 2 à 4 pour 30 s : les chiffres, le mot de la promesse, le résultat. Un mot ou une suite de mots, écrits comme ils sont dits. |
| `corrections` | orthographe : `{ "mot transcrit": "Mot juste" }` | Un mot par clé, en minuscules et sans ponctuation. Chaque nom propre, marque ou terme technique, confirmé par l'utilisateur. |
| `police` | changée avec `video-verticale police "<famille>" --graisse 900` | Montserrat Black par défaut. Une famille épaisse et lisible (Anton, Poppins, Archivo Black) ; la licence s'inscrit dans `licence_police`. |

Les emoji ne s'affichent pas en couleur dans les sous-titres incrustés : n'en mets pas.

## Titre d'accroche (`accroche`)

`{ "texte": "…", "debut": 0, "fin": 2.5 }`, en haut de l'image dans un bandeau de la couleur d'accent.

- Écris trois titres dans `brief.md` : une question, un chiffre, un résultat. Garde le plus concret.
- 6 mots au plus. Il dit la promesse de la première phrase en moins de mots, il ne la répète pas mot pour mot.
- Chaque chiffre est dit dans le rush ou figure dans les faits vérifiés.
- Il reste de 2 à 3 s. `\n` dans le texte force un retour à la ligne.
- Laisse `texte` vide si la première phrase se suffit.

## Zooms (`zooms`)

`[{ "t": 3.067, "z": 1.1 }, { "t": 5.967, "z": 1 }]` : à partir de `t`, l'image est agrandie de `z` (1 = cadre entier), jusqu'au zoom suivant.

- `new` en propose sur les coupes qui montrent un saut (plus de 0,5 s retirée), en alternance entre 1 et 1,1, espacés d'au moins 2 s. Garde-les, déplace-les ou retire-les.
- Un zoom tombe sur une coupe (temps de `cuts` dans `work/mots.json`) : il cache le saut. Hors coupe, un zoom souligne un mot fort, puis le cadre revient à 1 une ou deux secondes après.
- Entre 1,08 et 1,15. Au-delà, l'image perd en netteté et le visage risque d'être coupé.
- `sortie.cadrage` règle le centre du recadrage d'une source qui n'est pas en 9:16 : 0 à gauche, 0,5 au centre, 1 à droite.

## Musique (`musique`)

`{ "fichier": "audio/music/mixkit-123.mp3", "debut": 12.5, "gain": 0.6, "licence": "Mixkit Stock Music Free License https://mixkit.co/license/#musicFree, lue le <date>" }`, plus en option `fondu_sortie` (1,2 s).

1. Depuis le dossier d'habillage : `pub-video music find --mood <ambiance> --max 6`. Les morceaux vont dans `audio/music/`, leur source et leur licence dans `audio/music/candidats.json`. Ambiances : `calm`, `relaxed` sous une explication ; `energetic`, `driving`, `confident` sous un conseil rythmé ; `happy`, `playful` sous un ton léger.
2. `pub-video music scan <fichier>` montre la structure. Prends `debut` à un moment où le morceau est déjà plein (souvent son drop, moins une demi-seconde) : la première seconde a de l'énergie.
3. `pub-video music licence` enregistre le texte du jour de la licence. Note le chemin et la date dans `brief.md`.
4. Après l'aperçu, lis « musique X LU sous la voix » : vise 12 à 20. Monte `gain` si elle est trop basse, baisse-le ou monte `mixage.baisse` (8 dB par défaut, la baisse de la musique quand la voix parle) si elle couvre.

## Bruitages (`bruitages`)

`[{ "t": 0.02, "type": "whoosh_up" }, { "t": 1.71, "type": "pop", "v": 0.8 }]`. Les types : `pub-video sfx list`. `v` règle le volume (1 par défaut).

- `whoosh_up` ou `swoosh` à l'entrée du titre d'accroche.
- `pop` au début d'un mot fort (le temps `a` du mot dans `work/mots.json`).
- `hit` ou `sub` sous un grand chiffre. `riser` avec `d` (sa durée) qui finit sur une révélation.
- Un bruitage toutes les 3 à 5 s au plus, jamais sur chaque coupe ni sur chaque mot.
- Un vrai enregistrement remplace un son intégré : `pub-video sfx get <type> <id Mixkit>` depuis le dossier d'habillage.

## Revue des planches

Ouvre chaque planche et vérifie chaque point. Note chaque défaut vu et sa correction dans « Contrôles » de `brief.md`.

**Passe 1, le texte**

- Chaque groupe se lit d'un coup d'œil : 1 ligne en `pop` et `mot`, 2 au plus en `ligne`.
- Le mot en couleur est celui qui est dit à cet instant (compare avec les temps de `work/mots.json`).
- Les noms sont bien écrits ; aucun mot n'est coupé ou ne sort du cadre.
- Le titre d'accroche se lit dans la première seconde et a disparu avant de gêner.

**Passe 2, l'image**

- Le visage et l'action restent entiers à chaque zoom et après le recadrage.
- Rien d'important n'est caché sous les sous-titres ni dans les bandes que l'interface couvre (en haut, à droite, en bas).
- Les zooms tombent sur les coupes : aucun saut ne reste visible sans zoom.
