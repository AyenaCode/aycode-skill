# Le son : musique, bruitages, mixage

Tu ne peux pas écouter. Tu choisis sur des mesures (tempo, structure, niveaux), tu poses chaque son sur une action visible, et tu dis à l'utilisateur ce qu'il doit juger à l'oreille.

## 1. Choisir la musique

Elle se choisit après le storyboard et avant d'animer : son tempo devient la grille de temps de la vidéo.

**Ce qu'on cherche**

- **L'humeur du concept** : une pub vive pour des vendeurs n'a pas la musique d'une appli de méditation.
- **Un tempo qui porte le débit voulu** : 100 à 128 BPM pour une pub vive, 80 à 100 pour un ton posé. À 120 BPM, une mesure dure 2 s et 30 s font 15 mesures.
- **Un drop** : un moment où la basse et la batterie entrent d'un coup. Il portera la révélation de la marque. Il doit laisser devant lui la durée de l'accroche (3 à 6 s) et derrière lui de la musique pleine jusqu'à la fin.
- **Instrumentale**, pour laisser la place à la voix.
- **Un rythme net** (colonne « netteté » de l'analyse au-dessus de 6) : les coupes se caleront dessus.

**Chercher, analyser, classer**

```
pub-video music find --mood energetic,confident --max 8     # ou --genre pop,house   ou --tag technology
pub-video music find --genre house --tag technology --bpm 115-130   # critères cumulés, tempo imposé
pub-video music scan audio/music/mixkit-706.mp3 --bars      # structure mesure par mesure du candidat retenu
```

`find` télécharge les morceaux depuis Mixkit, vérifie que chaque fichier a la durée annoncée pour son titre, mesure chacun et affiche un classement : tempo, seconde du drop, hauteur du saut d'énergie. Il note la source et la licence dans `audio/music/candidats.json`. Si aucun ne convient : `--skip 8` pour les suivants, une autre humeur, ou `--pages 2`.

Lis la sortie de `scan` comme une partition : chaque ligne « monte » ou « baisse » est un changement de section, « DROP » est le plus fort. Choisis le morceau dont la structure épouse le storyboard : intro retenue pendant l'accroche, drop à la révélation, énergie pleine pendant la démonstration.

**Caler**

```
pub-video music fit audio/music/mixkit-706.mp3 --at 5      # le drop tombera à 5 s de la vidéo
```

`--at` est la seconde de la révélation dans le storyboard. La commande affiche le `bpm` et le bloc `music` à coller dans `setup()`, et dit sur quel temps placer la révélation (`b(10)` à 120 BPM). Quand le coup du drop arrive après sa barre de mesure (un silence, puis la basse), elle donne deux temps : la scène commence sur la barre, le logo et `drop_hit` tombent sur le coup (`b(12.5)`). Pour caler un autre moment que le drop détecté : `--drop <seconde du morceau>`.

Ensuite :

1. Colle `bpm` et `music` dans `setup()`.
2. Règle `bars` pour que la durée soit un nombre entier de mesures proche de la cible (30 s à 100 BPM : 12 ou 13 mesures de 2,4 s).
3. Vérifie que les bornes des scènes tombent toujours sur des mesures, et relance `pub-video voice check`.

**Le bloc `music`**

```js
music: {
	src: '../audio/music/mixkit-706.mp3',   // chemin depuis videos/
	start: 17.008,                           // seconde du morceau jouée à t = 0
	drop: 5,                                 // seconde de la vidéo où tombe le drop : build vérifie qu'il s'entend
	intro: { until: 5, lowpass: [1500, 12000], lift: 0 },   // avant le drop : son étouffé qui s'ouvre ; lift = dB ajoutés si l'intro est très faible
	gain: 1,                                 // volume relatif de la musique
	fadeIn: 0.08, fadeOut: 1.2               // fondus d'entrée et de fin, en secondes
}
```

Retire `intro` si le morceau a déjà une vraie introduction retenue et bien audible.

**Licence**

La licence Mixkit « Stock Music Free License » (https://mixkit.co/license/#musicFree) autorise les publicités en ligne et les réseaux sociaux sans crédit ; elle exclut la télévision, la radio, les CD et DVD, les jeux vidéo, et l'usage du morceau seul. Elle peut changer : le jour de la livraison, `pub-video music licence` la lit et en garde une copie datée dans `audio/music/`. Écris dans `brief.md` : titre, auteur, adresse de la page du morceau, licence et son adresse, date de lecture.

Autres sources, si Mixkit ne donne rien :

| Source | Comment | Condition |
|---|---|---|
| Incompetech (Kevin MacLeod) | catalogue avec tempo et genre : https://incompetech.com/music/royalty-free/pieces.json ; fichier : `https://incompetech.com/music/royalty-free/mp3-royaltyfree/<Titre>.mp3` | CC BY 4.0 : crédit obligatoire, à écrire dans la description de la publication : « Titre Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 » |
| Openverse | `https://api.openverse.org/v1/audio/?q=<mots>&license=by&license_type=commercial,modification` | CC BY : reprendre le champ `attribution` ; écarter BY-SA et NC |
| Un morceau fourni par l'utilisateur | dépose-le dans `audio/music/` | l'utilisateur confirme qu'il en a les droits |

Tout morceau se passe à `pub-video music scan`, quelle que soit sa source. Dis toujours à l'utilisateur : garder la trace de la licence, une réclamation automatique de droits reste possible sur les plateformes, et aucune de ces licences ne couvre la télévision ni la radio.

## 2. Les bruitages

`pub-video sfx list` donne les 24 sons intégrés et leur usage. Ils sont fabriqués par le skill : aucun fichier, aucune licence.

Les fonctions du kit posent déjà le son de leur geste (voir [`moteur.md`](moteur.md)). Tu ajoutes à la main, avec `s.cue(t, 'type', options)` :

| Moment | Son | Placement |
|---|---|---|
| Avant un impact, une révélation | `riser`, `d` = sa durée | il finit sur l'impact : `s.cue(s.dur - b(1), 'riser', { d: b(1) })` dans la scène d'avant |
| La révélation sur le drop | `drop_hit` | au temps 0 de la scène |
| Un grand chiffre, l'offre | `impact`, avec `hole: 0.25` | la musique se tait un quart de seconde avant |
| Une réussite, une vente | `kaching`, `sparkle`, `check` | à l'instant où le résultat s'affiche |
| Un message, une commande qui arrive | `notif` | avec l'entrée de la notification |
| Le dernier temps de la pub | `final` | 2 à 3 s avant la fin, pour qu'il résonne |

Options d'un repère : `v` (volume, 1 par défaut), `pitch` (1 par défaut ; fais-le monter sur une série : 1, 1.08, 1.16), `pan` (−1 à 1 ; le kit le règle d'après la place de l'élément), `d` (durée, pour `riser` et `scroll`), `hole` (silence de musique avant le son, en secondes).

**Règles**

- **Un son par action visible, au même instant.** Un élément qui apparaît, un appui, un changement de scène, un chiffre qui défile.
- **Rien sans action.** Un son que rien n'explique à l'image se retire.
- **La taille du son suit la taille du geste** : `tick` et `pop` pour le petit, `whoosh` pour un plein écran, `impact` pour un temps fort. Trois ou quatre gros sons par pub suffisent.
- **Les séries montent** : pitch croissant sur une liste qui arrive.
- **Pas plus de 5 ou 6 sons par seconde** : sur une liste longue, un son sur deux. `K.type`, `K.count` et `K.bars` s'y tiennent déjà ; `pub-video check` signale toute seconde qui en compte plus de 7.
- **Le dernier son finit avant la fin** : rien dans la dernière demi-seconde.

`pub-video check` signale les passages de plus de 3 s sans aucun bruitage : vérifie qu'aucune action n'y est muette.

**Un vrai enregistrement à la place d'un son intégré**

Si l'utilisateur trouve un son artificiel : `pub-video sfx get whoosh <id Mixkit>` remplace ce type par un enregistrement dans tout le projet (catégories : https://mixkit.co/free-sound-effects/whoosh/, `/click/`, `/impact/`, `/notification/`, `/pop/`, `/transition/`). Licence « Sound Effects Free License » : pubs en ligne autorisées, sans crédit ; `pub-video music licence --sfx` en garde une copie datée.

## 3. Mixage et niveaux

`pub-video build` fabrique trois pistes (`render/<vidéo>_music.wav`, `_sfx.wav`, `_mix.wav`), puis masterise : un gain fixe jusqu'à −14 LUFS et un limiteur de crête à −2 dB. Un gain fixe garde l'intro douce et le drop fort tels que tu les as voulus.

Lis ce que `build` affiche :

- **« niveaux moyens : musique −19 dB, bruitages −24 dB »** : les bruitages sont brefs, donc plus bas en moyenne. Un écart de 3 à 8 dB est normal. Au-delà de 10 dB, ils risquent d'être noyés : `--sfx-gain 1.4`. En dessous de 2 dB, ils écrasent la musique : `--sfx-gain 0.8`.
- **« niveau sonore : −14.1 LUFS, crête −1.7 dB »** : la cible. Une alerte « loin de la cible » signale un son trop clairsemé (pas de musique).
- `--music-gain` (0,8 par défaut) baisse ou monte la musique ; `--skip-video` refait le son sans redessiner les images.

- **« drop à 5,54 s : la musique monte de 10 dB, le mixage de 7 dB »** : le drop s'entend encore sous les bruitages. Une alerte « s'entend à peine » veut dire que les sons des deux temps d'avant le couvrent : baisse leur `v` ou retire-en.

## 4. Ce que tu dis à l'utilisateur

Dans la livraison : « Je n'ai pas pu écouter le son. J'ai vérifié le tempo, le calage du drop et les niveaux par la mesure. Écoute au casque puis sur le haut-parleur du téléphone : la musique plaît-elle, les bruitages sont-ils trop forts ou trop faibles, un son gêne-t-il ? » Chaque réponse se règle en une commande (`--sfx-gain`, `--music-gain`, `sfx get`, autre morceau).

## Critère de fin

- `setup()` porte `bpm` et `music` ; la révélation est sur le temps indiqué par `music fit`.
- `brief.md`, section Musique : titre, auteur, source, licence et adresse, date, tempo, calage ; la copie datée de la licence est dans `audio/music/`.
- Chaque ligne du storyboard a son son dans la page.
