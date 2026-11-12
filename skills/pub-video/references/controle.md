# Contrôler et revoir

Deux filets : la machine mesure, puis tu regardes. Aucun ne remplace l'autre.

## 1. Les contrôles automatiques

```
pub-video check <vidéo>
```

Trois secondes pour une pub de 30 s. Il lit le code, joue la vidéo à 10 mesures par seconde, et examine chaque texte à lire. Sortie en trois groupes : **erreurs** (à corriger avant tout rendu), **avertissements** (à corriger ou à justifier dans `brief.md`), **à regarder**.

| Catégorie | Ce qu'il a trouvé | Correction |
|---|---|---|
| `source` | hasard sans graine, horloge, minuterie, transition CSS, ressource distante, `gsap.to()` nu, fichier introuvable | voir « Animer » dans [`moteur.md`](moteur.md) |
| `structure` | trou entre deux scènes, scène hors d'un temps de la musique, fin vide, pas de musique, pas de bruitage, plus de 7 sons dans une seconde | recale les bornes des scènes sur `bar()` ; complète le son, ou éclaircis-le (`sfx: false` un son sur deux) |
| `polices` | texte rendu avec une police du système | `pub-video font "…"`, ou corrige `--font-display`, `--font-text` et `--font-mono` dans `theme.css` |
| `lecture` | texte affiché trop peu de temps pour ses mots, ou trop petit | allonge la tenue (0,5 s + 0,25 s par mot), raccourcis le texte, ou grossis-le (30 px au moins) |
| `zones` | texte à lire hors de la zone sûre pendant au moins 0,4 s | remonte-le ou rentre-le ; place-le dans un calque `safe` |
| `collisions` | deux textes l'un sur l'autre pendant au moins 0,3 s | écarte-les, ou fais sortir le premier avant l'arrivée du second |
| `visibilité` | texte caché par un autre élément, sans contraste, jamais affiché, ou balisage qui fuit à l'écran | change l'ordre de création, la couleur, ou le fond |
| `rendu` | la même seconde donne deux images selon le chemin | un `from()` après un `to()` → `fromTo` ; un `frame()` qui garde un état → recalcule depuis `lt` |

Un texte décoratif (grand mot de fond, filigrane) s'exclut des contrôles avec l'attribut `data-deco`. Les textes dans un téléphone ou un navigateur font partie de l'image et ne sont pas contrôlés en lecture.

Relance `check` après chaque série de corrections, jusqu'à zéro erreur.

## 2. La revue visuelle

Les contrôles ne voient ni la beauté ni le sens. Fais deux passes complètes, en ouvrant chaque planche avec l'outil de lecture d'image.

**Passe 1 : chaque scène**

```
pub-video sheet <vidéo> --guides
```

Trois moments par scène (elle se pose, elle tient, elle va sortir), avec la zone sûre en pointillés. Pour chaque scène, réponds :

1. **Hiérarchie.** Où va l'œil en premier ? Est-ce le bon élément ? Y a-t-il un seul point fort ?
2. **Composition.** Marges égales, alignements nets, un tiers de vide ? Un élément touche-t-il un bord ou un autre élément ?
3. **Lisibilité.** Chaque texte se lit-il d'un coup d'œil sur un téléphone tenu à bout de bras ? Contraste, taille, longueur des lignes, mot seul en fin de ligne ?
4. **Marque.** Les couleurs, la police et le ton sont-ils ceux du produit ? Le vrai produit est-il visible et assez grand ?
5. **Vérité.** Tout ce qui est écrit figure-t-il dans les faits de `brief.md` ? Une donnée personnelle ou un tiers apparaît-il ?
6. **Finition.** Ombres, arrondis et épaisseurs cohérents ? Une image floue ou étirée ? Un élément coupé par le cadre sans intention ?

Pour un doute sur un détail : `pub-video stills <vidéo> <seconde> --scale 1` et regarde l'image en taille réelle.

**Passe 2 : le mouvement et les transitions**

```
pub-video sheet <vidéo> --transitions
pub-video sheet <vidéo> --every 0.1 --from <début d'une scène> --to <une seconde plus tard>
```

Sept images autour de chaque changement de scène, puis l'entrée de chaque scène décomposée. Réponds :

1. **Continuité.** Une image vide, un flash, un élément de l'ancienne scène qui traîne, un bord nu pendant la transition ?
2. **Cause.** Voit-on d'où vient chaque transition ? Y a-t-il 3 à 5 sortes en tout ?
3. **Ordre d'entrée.** Les éléments arrivent-ils dans l'ordre où on doit les lire ? Décalés, pas tous ensemble ?
4. **Tenue.** L'image complète de chaque scène reste-t-elle assez longtemps ? Une scène attend-elle immobile ?
5. **Premier et dernier instants.** L'image à 0,1 s montre-t-elle déjà quelque chose ? La dernière seconde laisse-t-elle lire l'appel à l'action ?

Compare enfin avec la liste « Signes d'une vidéo générée » de [`mouvement.md`](mouvement.md).

Écris chaque défaut trouvé, corrige-le, puis refais la planche concernée pour vérifier. Une passe est finie quand tu ne trouves plus rien à corriger.

**Le rythme, en vidéo**

```
pub-video preview <vidéo>
```

Demi-taille, sans flou, 20 secondes de calcul. Extrais-en des images pour vérifier le calage sur la musique : l'image de la révélation doit être celle du temps annoncé par `music fit`.

## 3. Après le rendu final

`pub-video build <vidéo>` vérifie lui-même le fichier : nombre exact d'images, taille, format de couleur, piste son, niveau, crête, et que le drop s'entend encore sous les bruitages. Il s'arrête avec une erreur si l'un manque. Le rendu final dure plusieurs minutes : lance-le en arrière-plan et attends sa fin avant d'en lancer un autre sur la même vidéo, car les fichiers de son et l'export portent le même nom. Regarde ensuite trois images du fichier livré :

```
ffmpeg -y -ss 0.5 -i exports/<fichier>.mp4 -frames:v 1 render/controle_debut.png
```

(de même à la seconde de la révélation et une seconde avant la fin). Tu vérifies que le fichier exporté montre bien ce que les planches montraient, avec le flou de mouvement sur les gestes rapides.

## Critère de fin

- `pub-video check` : zéro erreur ; chaque avertissement corrigé, ou justifié en une ligne dans `brief.md`.
- Deux passes de revue faites sur des planches fraîches, sans défaut restant.
- Les trois images du fichier exporté sont conformes.
