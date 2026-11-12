# Décider le montage

`montage.md` liste les phrases de chaque rush, dans l'ordre, avec leur seconde, et la pause qui suit chacune. Sa légende, en tête du fichier, donne la syntaxe : `[x]` / `[ ]`, `~~mots~~`, `→ 0,8 s` / `→ garder`. `analyse` a déjà proposé des coupes ; tu les confirmes ou tu les corriges, et tu ajoutes les tiennes.

## Lire chaque phrase

Lis le fichier en entier une première fois pour saisir le propos, puis décide ligne par ligne :

| Ce que tu vois | Décision |
|---|---|
| Une phrase reprise plus loin, plus complète ou mieux dite | coupe la première prise `[ ]`, garde la dernière |
| Une phrase qui tourne court, suivie d'une pause et d'une phrase qui repart sur la même idée | faux départ : coupe-la |
| Une phrase qui commence par `(paroles?)` | voix non écrite par la transcription, très souvent une phrase dite deux fois. Si la phrase d'avant tourne court ou dit la même chose, c'est une reprise : coupe celle d'avant |
| Une consigne de tournage (« je recommence », « c'est bon, ça tourne ? », « coupe ») | coupe-la |
| Du bavardage avant le vrai début ou après la vraie fin | coupe-le |
| Un mot répété (« le le »), un faux départ dans la phrase (« on va, on clique ») | barre le premier : `~~le~~ le` |
| Une correction à la volée (« le bouton bleu, non, vert ») | garde la correction, barre l'erreur : `le bouton ~~bleu, non,~~ vert`. Si la phrase devient bancale, coupe-la entière et garde la suivante |
| `(euh?)` barré | hésitation coupée : laisse-la barrée |
| `(son)` | bruit sans parole (clic, clavier, souffle). En mode visage, coupe-le ; en mode écran, garde-le s'il accompagne une action |

Note « reprise probable » : vérifie-la toujours. Deux phrases qui commencent pareil peuvent dire deux choses différentes (« Nous allons créer… », « Nous allons valider… ») : garde les deux et retire la note.

Le texte reste tel quel, même faux : `plan` vérifie que chaque mot est à sa place. Les corrections d'orthographe se font dans les sous-titres. Les mots listés sous « Texte ignoré » ont été écrits par la transcription là où il n'y a pas de voix ; si l'un d'eux est une vraie phrase, dis-le à l'utilisateur.

Note dans `brief.md`, section « Décisions de montage », chaque choix qui n'est pas évident : quelle prise gardée et pourquoi, quelle pause gardée exprès.

## Les pauses

Par défaut, une pause de plus de `pauseMax` (0,7 s) est ramenée à `pause` (0,4 s). En mode écran, les moments où l'écran bouge pendant la pause restent en plus : une action se voit du début à la fin, les moments figés partent.

Change une pause en fin de ligne `⏸` :

- `→ 0,8 s` : un temps voulu, après une question, avant une révélation, entre deux parties.
- `→ garder` : une action à l'écran que la détection ne voit pas (texte tapé, petit menu), ou un silence qui fait partie du propos.

Les réglages de tout le projet sont dans `projet.json`, clé `reglages` : `pause`, `pauseMax`, `mode` (`auto`, `visage`, `ecran`), `nettoyage` de la voix (`non`, `leger`, `normal`, `fort`), `loudness` (−14). Un changement s'applique au prochain `plan`, `preview` ou `build`.

## Corriger après check

`check` classe chaque coupe : entre deux silences, dans le creux entre deux mots, ou en pleine syllabe. Seule une coupe dans la voix peut rogner un mot.

| Signalé | Correction dans `montage.md` |
|---|---|
| `manque` à une coupe dans la voix | la coupe mord sur le mot gardé : garde aussi le mot coupé voisin, ou coupe la phrase entière plutôt que quelques mots |
| `manque` à une coupe entre deux silences, sans mot `en trop` à côté | le mot gardé n'est pas là où la transcription le place : relis les phrases voisines, une reprise est peut-être mal découpée |
| `en trop` | un morceau du passage coupé est resté : barre-le dans la phrase voisine |
| `coupe en pleine syllabe` | déplace la coupe d'un mot : barre ou garde le mot voisin |
| `entendu autrement` | même place, mots proches : le plus souvent la transcription. Note le point à écouter dans `brief.md` |

Après chaque correction : `preview`, puis `check`.
