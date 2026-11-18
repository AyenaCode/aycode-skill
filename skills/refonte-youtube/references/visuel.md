# Choisir et contrôler les images

Le spectateur ne sait pas que les images viennent d'une ancienne vidéo. Chacune doit montrer ce que dit la voix au même moment, et l'écran doit changer assez souvent pour garder l'œil.

## 1. Lire l'ancienne vidéo

- `source.md` donne ce qui est dit, avec ses temps, et les changements de plan (`✂ plan`).
- Chaque planche (`work/planches/planche-NN.png`) montre une image toutes les quelques secondes. Ouvre-les toutes avec l'outil de lecture d'image avant d'écrire.
- Pour choisir un passage précis : `refonte-youtube planche --de 3:10 --a 3:40 --pas 0.5`. Regarde où l'action commence et finit, et où se trouve à l'écran ce qui compte (pour un zoom).

## 2. Les visuels possibles

| Visuel | Quand |
|---|---|
| `[1:12-1:20]` | le cas courant : le passage où l'ancienne vidéo montre ce dont parle la réplique |
| `[=]` | la réplique suivante montre la suite de la même action |
| `[a-b c-d]` | plusieurs moments à la suite sous une même réplique (avant, puis après) |
| `[a-b entier]` | une action longue à montrer en entier, accélérée (jusqu'à ×4) : un chargement, une saisie, un défilement |
| `zoom`, `zoom=1.4@0.7,0.3` | une capture d'écran où le détail est petit : zoom progressif vers ce point (fractions de la largeur et de la hauteur) |
| `[motion nom]` | ce que l'ancienne vidéo ne montre pas bien : l'accroche, un chiffre, un schéma, une comparaison, la fin (voir [`motion.md`](motion.md)) |
| `[image fichier]` | une capture, un schéma ou un logo fourni par l'utilisateur ; il reçoit un zoom lent |
| `[carton "texte"]` | une transition, une question, un chiffre seul, sur un fond uni ; 1 à 4 mots |

## 3. Règles

- **Un visage qui parle ne se montre pas sous la nouvelle voix.** Les lèvres ne suivraient pas. Un passage face caméra ne sert que pour une réaction d'une seconde et demie au plus, ou sous un carton. Partout ailleurs, prends l'écran, une séquence animée, une image ou un carton. Si l'ancienne vidéo n'est presque que du face caméra, dis-le à l'utilisateur au cadrage : la refonte aura alors surtout des séquences animées, des cartons et des images.
- **L'image change toutes les 3 à 8 secondes** : nouveau passage, zoom, carton, séquence. Un même plan qui dure plus de 10 s se coupe en deux passages ou reçoit un zoom.
- **Une image ne se répète pas** (`plan` le signale), sauf un rappel voulu, noté dans `brief.md`.
- **Pas d'image figée** : `plan` signale une image tenue plus de 1,5 s. Allonge le passage, ajoutes-en un, ou passe en `entier`. Au-delà de 0,6 s, l'image tenue reçoit d'elle-même un zoom lent.
- **Pas d'accéléré illisible** : au-delà de ×2,5, vérifie sur la planche qu'on suit encore l'action.
- **Les personnes et les tiers sont protégés.** Des e-mails, téléphones ou noms de clients visibles dans l'ancienne vidéo ne passent pas dans la nouvelle. Choisis un autre passage, recadre avec un zoom, ou demande l'accord de l'utilisateur.
- **Le rythme suit la structure.** Dans l'accroche, l'image change à chaque réplique. Le début de chaque chapitre a sa carte de titre, automatique. Un carton marque une rupture ; il n'en faut pas plus d'un par minute.

## 4. Revue des planches (après chaque aperçu)

Après `refonte-youtube apercu` :

```
refonte-youtube planche --apercu --de 0 --a 30 --pas 0.5      # l'accroche, de près
refonte-youtube planche --apercu --de 0:30 --a 2:30 --pas 2   # puis le reste, par tranches de 2 minutes
```

Ouvre chaque planche et fais deux passes, en notant chaque défaut dans « Contrôles » de `brief.md` :

1. **Images.** Chaque plan montre-t-il ce que dit la réplique (compare avec `plan`) ? Y a-t-il un visage qui parle, une image figée, une coupe qui tombe au milieu d'un geste, une donnée personnelle, un bord noir inattendu ?
2. **Textes.** Les mots forts se lisent-ils (taille, contraste) sans cacher ce qui compte à l'écran ? Sont-ils bien écrits ? Les cartes de chapitre et les cartons sont-ils lisibles et sans faute ?

Corrige `script.md` ou `refonte.json`, relance `apercu` (seuls les plans modifiés sont rendus), regarde de nouveau.

**Fini quand** une passe complète sur toutes les planches ne trouve plus rien.
