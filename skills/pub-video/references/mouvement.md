# Ce qui fait un mouvement de qualité

Les règles d'un motion designer, à appliquer scène par scène. Elles disent quoi viser ; [`moteur.md`](moteur.md) dit comment l'écrire.

## Avant d'animer : la composition

Une scène ratée à l'arrêt reste ratée en mouvement. Fixe d'abord l'image finale de chaque scène.

- **Un point focal.** Un seul élément domine par la taille, le contraste ou la couleur. Le reste le sert.
- **Trois niveaux de taille au plus** par scène : le titre, le support, le détail. Sur 1080 de large : titre 110 à 170 px, support 60 à 72, détail 34 à 46. Rien de lu sous 30 px.
- **Une grille.** Marges latérales de 90 px ; les éléments s'alignent sur les mêmes verticales d'une scène à l'autre. Un texte centré a une raison (logo, chiffre, appel à l'action).
- **Du vide.** Un tiers de l'image reste libre. Le vide dirige l'œil autant que le texte.
- **La couleur de marque porte le sens.** Fond neutre pour montrer le produit, aplat de marque pour la révélation et l'appel à l'action, couleur d'accent pour un mot ou un chiffre. Deux scènes voisines ont des fonds différents.
- **De la profondeur.** Trois plans : un fond (aplat, halo, grain), le sujet, un premier plan qui passe devant (une carte, une notification, un doigt). Les ombres sont larges et douces.
- **Le vrai produit en grand.** Un écran du produit occupe au moins la moitié de la hauteur quand il est le sujet. Un détail important se montre en gros plan (caméra) plutôt qu'en petit dans un téléphone entier.

## Le rythme vient de la musique

- **Les scènes changent sur les mesures**, les accents tombent sur les temps, les suites d'éléments sur les croches (`b(0.5)`).
- **La révélation de la marque tombe sur le drop.** Tout ce qui précède monte vers ce temps : montée sonore, accélération des coupes, silence d'un quart de seconde juste avant.
- **Le débit varie.** Scènes courtes (2 à 4 temps) pour l'accroche et l'énumération, scènes longues (8 temps) pour la démonstration. Une pub au débit constant paraît mécanique.
- **Une image arrive, se pose, tient, sort.** Compte la tenue : 0,5 s plus 0,25 s par mot à lire. Un titre de 4 mots tient 1,5 s.
- **L'arrêt est un geste.** Un titre se pose net et reste immobile pendant qu'on le lit. Si une scène tient plus de 1,5 s, une seule chose continue de bouger, et elle a un sens : un défilement, un compteur, un doigt qui approche.

## Les courbes ont un rôle

| Ce qui se passe | Courbe | Durée |
|---|---|---|
| Un élément arrive | décélération longue : `swift`, `expo.out` | 0,45 à 0,7 s |
| Un mot s'écrase sur un temps | `expo.out`, court | 0,3 à 0,35 s |
| Un objet se pose (carte, téléphone, pastille) | ressort amorti : `spring`, `springy` | 0,5 à 0,7 s |
| Un élément sort | accélération : `exit`, `power3.in` | 0,2 à 0,3 s |
| Un déplacement visible de bout en bout, la caméra | `glide`, `expo.inOut` | 0,6 à 1,2 s |
| Une valeur défile | `power2.out` | 1 à 2 temps |

- **La sortie dure la moitié de l'entrée.** Ce qui part ne mérite plus l'attention.
- **L'opacité ne rebondit jamais** ; le dépassement se réserve à la position et à l'échelle des objets, et reste discret sur une interface.
- **Varie les courbes selon le rôle.** La même courbe sur tout est la marque d'une vidéo générée.

## La chorégraphie

- **Décale.** Les éléments d'un groupe entrent l'un après l'autre : 60 à 120 ms entre deux mots, 80 à 150 ms entre deux cartes, 20 à 35 ms entre deux lettres.
- **Enchaîne en recouvrant.** L'élément suivant part quand le précédent est à mi-course, pas quand il a fini.
- **Guide l'œil.** Le nouvel élément apparaît là où l'œil se trouve déjà, ou la chose qui bouge y mène. Un déplacement du haut gauche vers le bas droit d'une scène à l'autre se prépare.
- **Varie les entrées** dans une même scène : le titre s'écrase, les cartes montent, la pastille jaillit. Tout qui arrive en fondu vers le haut est l'autre marque d'une vidéo générée.
- **Donne une cause.** Un élément est poussé, tiré, déposé, déclenché par un appui. Un bouton s'enfonce avant que la suite arrive.
- **Anticipe et prolonge** sur les gestes forts : un léger recul avant un départ, une secousse après un impact (`K.shake`).

## Les transitions

- **3 à 5 sortes dans toute la pub**, choisies au storyboard, chacune reprise au moins deux fois pour que la vidéo ait une grammaire.
- **Chacune a sa cause** : l'iris part du bouton qu'on vient de toucher, la poussée suit le sens de lecture, le zoom entre dans l'écran qu'on regardait, le balayage porte la couleur de marque.
- **Un tiers de coupes franches au plus**, placées sur un temps fort, entre deux images qui se répondent (même forme, même place).
- **Un élément peut traverser la coupe** : le logo, un téléphone, une couleur de fond qui devient l'aplat de la scène suivante.
- **La sortie d'une scène est déjà la transition.** Ne fais pas sortir chaque élément puis entrer la transition : c'est deux gestes pour un.

## Le texte animé

- **6 mots au plus par bloc**, 2 lignes de préférence. Le spectateur lit ou regarde, pas les deux.
- **Le mot clé est traité à part** : couleur d'accent, surligneur (`K.mark`), trait à la main (`K.scribble`), taille au-dessus.
- **Le style d'entrée suit le sens** : `slam` pour une affirmation, `mask` pour une révélation élégante, `pop` pour une liste vive, `rise` pour un support, `blur` pour une respiration.
- **Un chiffre se compte** (`K.count`) ; une adresse se tape (`K.type`) ; une liste arrive item par item.
- **Les lignes sont équilibrées** : coupe aux articulations de la phrase, jamais un mot seul sur la dernière ligne.

## La caméra

- Un mouvement de caméra par scène au plus, lent et continu (`glide`), avec un but : entrer dans un détail, suivre une action, révéler la suite.
- Le gros plan remplace l'explication : zoom 1,4 à 1,8 sur le bouton, le prix, la ligne qui change.
- Un téléphone légèrement incliné en 3D à l'arrivée, presque de face quand on lit son écran.

## Le son suit l'image

Détail dans [`son.md`](son.md). L'essentiel : chaque action visible s'entend au même instant, rien ne sonne sans action, un souffle porte chaque changement de scène, une montée précède chaque impact.

## Signes d'une vidéo générée, à éliminer

- Éléments qui flottent ou respirent en boucle sans raison.
- Zoom lent permanent sur toute l'image.
- La même entrée (fondu vers le haut) pour tout.
- La même courbe et la même durée partout.
- Rebond sur des éléments d'interface sérieux.
- Scène qui attend immobile que la suivante arrive.
- Titres centrés partout, sur fond dégradé violet.
- Icônes génériques à la place des vrais écrans du produit.
- Texte long affiché d'un bloc.
- Transition différente à chaque coupe.
