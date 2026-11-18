# Les séquences animées

Une séquence animée montre ce que l'ancienne vidéo ne montrait pas bien : une accroche qui claque, un chiffre qui monte, un schéma, une comparaison avant/après, une fin. Elle se fabrique avec `pub-video`, au format 16:9, et la voix de la refonte passe par-dessus.

## 1. Combien et lesquelles

- **3 à 6 pour 10 minutes de refonte, 6 à 10 pour une vidéo nouvelle** (voir [`images.md`](images.md)). Chacune coûte du temps de fabrication : réserve-les aux moments qui comptent.
- L'accroche (presque toujours), les 2 ou 3 idées clés qui méritent un schéma ou un chiffre, la fin avec l'action demandée.
- Dans `script.md` : `[motion <nom>]` sur la réplique qu'elle illustre, ou sur une ligne sans texte si elle se suffit. Sa durée : `plan` affiche la voix de la réplique (estimée tant que la voix n'existe pas). La séquence dure au moins cela, sinon sa dernière image reste à l'écran. Si elle dure plus, la réplique s'allonge et la voix se tait à la fin.

## 2. Fabriquer une séquence

Un seul projet `pub-video` pour toutes les séquences de la refonte, une vidéo par séquence :

```
pub-video new projets/<sujet>-motion --video <nom> --format 16:9 --bars <mesures> --lang <langue>
pub-video new projets/<sujet>-motion --video <autre-nom> --format 16:9 --bars <mesures>   # les suivantes
```

À 120 BPM, une mesure dure 2 s : `--bars 4` donne 8 s.

Suis ensuite les étapes 6 à 8 du `SKILL.md` de `pub-video` (construire les scènes, contrôler, rendre), avec ses références `moteur.md`, `mouvement.md` et `controle.md`. Différences pour une séquence de refonte :

- **Ni voix off ni musique dans la séquence.** La voix et la musique de la refonte passent par-dessus. Laisse `music: null` dans `setup()` : l'avertissement « pas de musique » de `pub-video check` est alors voulu, note-le dans `brief.md`. Les bruitages des actions restent et passent dans le mixage de la refonte. Une séquence a au moins un bruitage : sans aucun son, le rendu de `pub-video` s'arrête sur un mixage silencieux.
- **Les couleurs et la police de la refonte** : `style.accent`, `style.fond` et `style.texte` de `refonte.json`, ou la marque de l'utilisateur si elle est connue.
- **Ce qui s'affiche est vrai** : les chiffres et les textes viennent de « Faits vérifiés » du `brief.md` de la refonte.
- **Le texte à l'écran ne répète pas la voix mot pour mot** : il en garde le cœur, en 6 mots au plus.

Puis copie l'export dans le projet de refonte :

```
cp projets/<sujet>-motion/exports/<nom>-<durée>s_sans-voix.mp4 projets/<sujet>-refonte/motion/<nom>.mp4
```

## 3. Raconter avec des personnages et des objets

Pour un parcours, une histoire ou un tuto, la séquence peut mettre en scène un personnage simple et des objets. Ils sont dessinés en SVG dans la page de la séquence et animés sur la timeline de la scène. Le moteur de `pub-video` charge les extensions GSAP DrawSVG, MotionPath et MorphSVG.

**Le style : plat et géométrique.** Une tête ronde, un corps en rectangle arrondi, des bras et des jambes en traits épais à bouts ronds, deux points pour les yeux. Deux ou trois couleurs de la refonte, sans ombre ni détail. Un personnage réaliste, une bouche qui parle ou une animation de dessin animé complexe dépassent le moteur : reste simple et lisible.

**Un personnage, dessiné une fois.** Écris son SVG dans `assets/personnages.js` du projet motion, sous forme de texte exporté. Chaque membre est un groupe nommé (`tete`, `corps`, `bras-g`, `bras-d`, `jambe-g`, `jambe-d`), avec son point de rotation à l'articulation. Chaque séquence l'importe (`import { lea } from '../assets/personnages.js'`) et le place avec `h(el, 'abs', lea, { … })`. Il garde ainsi la même tête dans toute la vidéo.

| Ce qu'il fait | Comment |
|---|---|
| marcher | bras et jambes qui pivotent de ±20° en alternance, `yoyo` et `repeat` sur un temps, le corps qui monte de 4 px à chaque pas |
| saluer, montrer | un bras qui pivote vers le haut ou vers l'objet, avec un léger dépassement |
| réagir | la tête qui recule (surprise), un petit rebond (joie), une bulle qui apparaît (idée, question) |
| suivre un parcours | un chemin SVG tracé avec `K.draw`, et le personnage ou un repère qui le suit (`motionPath: { path, align, alignOrigin: [0.5, 1] }`, `ease: 'none'`) ; chaque étape s'allume en arrivant (`K.enter`, style `pop`) |
| transformer | `morphSVG` d'une forme vers une autre : le problème qui devient la solution |

**Les objets** : les pictogrammes de `K.icon`, les maquettes `K.phone`, `K.browser` et `K.terminal`, ou un objet simple dessiné de la même façon (ordinateur, document, pièce, fusée, cadenas).

**Un tuto** se montre étape par étape : un numéro, une maquette, `K.pointer` ou `K.tap` sur l'action, `K.type` pour ce qui se tape, une seule action par temps. Chaque geste a son bruitage.

Toutes ces animations vivent sur la timeline de la scène (`s.to`, `s.fromTo`), aux instants donnés par `b()`, comme le reste du moteur (voir `moteur.md` de `pub-video`).

## 4. Critère de fin

Chaque `[motion …]` du script a son fichier dans `motion/`, `plan` ne signale plus de séquence introuvable ni plus courte que sa réplique (ou l'écart est voulu et noté), et chaque séquence est listée dans la section « Séquences animées » de `brief.md`.
