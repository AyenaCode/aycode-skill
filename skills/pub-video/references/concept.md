# Concept, storyboard, voix off

But : décider ce que la pub dit et montre, seconde par seconde, avant d'animer quoi que ce soit. Tout part des faits de `brief.md`.

## 1. L'angle

Écris dans `brief.md`, section Produit, une ligne pour chacun : pour qui, leur problème dans leurs mots, la promesse, la preuve, l'offre, l'action demandée. Puis :

- **Une promesse, une seule.** La pub entière sert une phrase que le spectateur peut répéter. Les autres qualités du produit restent pour une autre pub.
- **Le spectateur d'abord.** L'accroche parle de sa situation (« Tu vends sur WhatsApp ? »), pas du produit.
- **Trois accroches, puis une.** Écris-en trois de natures différentes (une question, une scène vécue, un chiffre ou un contraste) et garde celle qui est la plus concrète et la plus visuelle.
- **Un fil visuel.** Une forme, un geste ou un objet qui revient d'un bout à l'autre : la bulle de message, le téléphone, un cercle de la couleur de marque. Il fait d'une suite de scènes un seul film.

## 2. La structure

Trame pour 30 s (15 mesures à 120 BPM). Adapte les durées à la musique choisie.

| Moment | Mesures | Rôle | Ce qu'on voit |
|---|---|---|---|
| Accroche | 0 à 1,5 | arrêter le pouce | la situation du spectateur, en gros, dès la première image |
| Tension | 1,5 à 2,5 | ce que ça lui coûte | la conséquence, en un mot fort |
| Révélation | 2,5 à 3,5 | la marque et la promesse, sur le drop | logo, nom, promesse en une ligne |
| Démonstration | 3,5 à 9,5 | la preuve par l'image | 2 ou 3 temps du vrai produit en action, un bénéfice chacun |
| Preuve | 9,5 à 11 | pourquoi y croire | un chiffre vrai, des utilisateurs réels, une garantie |
| Offre | 11 à 13 | ce que ça coûte | le prix ou l'essai, en gros |
| Appel à l'action | 13 à 15 | quoi faire maintenant | bouton, adresse, logo |

Autres trames, quand elles servent mieux le produit :

- **Démonstration d'abord** : le produit en action dès la première seconde, la marque à 3 s. Pour un produit qui se comprend en le voyant.
- **Avant / après** : la même scène deux fois. Pour un gain net de temps ou d'argent.
- **Trois raisons** : accroche, puis trois bénéfices numérotés. Pour un produit aux qualités multiples.
- **Produit sans écran** (ligne de commande, API) : son terminal tient le rôle du produit. Il est à l'écran dès l'accroche (la commande qui se tape, le message qui tombe) ; la scène Offre devient la commande d'installation, ou disparaît si le produit est gratuit.

Règles publiées par les plateformes :

- TikTok : accrocher dans les 3 premières secondes ; montrer le produit en usage très tôt ; pas de longue introduction ni d'animation de logo en ouverture ; son présent ; appel à l'action à l'image et dans la voix ; 21 à 34 s pour une pub.
- YouTube (ABCD) : capter dès l'ouverture, faire apparaître la marque dans les 5 premières secondes, raconter avec des personnes et une émotion, finir sur une action claire.
- Meta : concevoir en vertical avec le son, messages clés dans la zone sûre.

## 3. Format, durée, zones sûres

| Usage | Format | Durée | Zone sûre (`safe`) |
|---|---|---|---|
| TikTok, Reels, Shorts, Statut WhatsApp, en organique | `9:16` | 15 à 34 s | `universal` : x 65 à 940, y 270 à 1440 |
| Pub payante Reels ou TikTok | `9:16` | 15 à 30 s | `ads` : x 65 à 940, y 270 à 1248 (Meta réserve les 35 % du bas) |
| Fil Instagram ou Facebook | `4:5` ou `1:1` | 15 à 30 s | marge de 5 % |
| YouTube, site, présentation | `16:9` | 15 à 60 s (6 s pour un bumper) | marge de 5 % |

La zone sûre vaut pour ce qui doit être lu : textes, logo, bouton. Les fonds et les appareils peuvent remplir tout le cadre. Les chiffres de Meta sont officiels ; ceux de TikTok viennent de gabarits non publiés en clair : vérifie le rendu dans l'aperçu de la plateforme avant une campagne payante.

Un second format n'est pas un recadrage : c'est une seconde page `videos/<nom>-<format>.html` qui reprend les scènes avec une mise en page refaite.

## 4. Le texte à l'écran

- **6 mots au plus par bloc.** Ce qui dépasse va dans la voix off.
- **Les mots du produit et de son public**, relevés dans les captures. Pas de vocabulaire de publicitaire (« révolutionnaire », « solution innovante »).
- **Un message du produit se cite mot pour mot** (erreur, sortie de commande). S'il est trop long pour le temps de sa scène, montre la partie qui porte le sens et note la coupe dans `brief.md`.
- **Des verbes et des chiffres.** « Ta boutique en 2 gestes » plutôt que « Création simplifiée ».
- **Le texte ne répète pas la voix mot pour mot** : l'écran donne le mot clé, la voix dit la phrase.
- **La marque est écrite** à la révélation et à la fin ; l'adresse ou l'action à la fin.
- **Langue et ton du produit** : tutoiement s'il tutoie, ponctuation et typographie de la langue (espaces avant « ? » et « : » en français, apostrophes courbes).

## 5. Le storyboard

Remplis la table de `brief.md`, une ligne par scène. Elle doit suffire à construire la scène sans rien décider de plus.

| Scène | Mesures | Secondes | À l'image | Texte à l'écran | Mouvement | Son | Voix off |
|---|---|---|---|---|---|---|---|
| accroche | 0 à 1,5 | 0 à 3 | fond sombre ; des bulles de message s'empilent | « Tu vends sur WhatsApp ? » | titre qui s'écrase mot par mot ; bulles qui jaillissent sur les croches | `hit` × 2, `pop` montants | Tu vends sur WhatsApp ? |

- Les noms de scène sont courts et sans espace : ils servent dans la page et dans le script de la voix.
- La colonne Son nomme les sons de `pub-video sfx list`, et les transitions sont celles de `K.transition` (voir [`moteur.md`](moteur.md)).
- **Sortie d'une scène → entrée de la suivante** : écris la transition et sa cause dans la colonne Mouvement de la scène qui arrive.
- Compte les sortes de transition : 3 à 5 pour toute la pub.
- Note pour chaque écran du produit le fichier de capture et la partie montrée.

Relis le storyboard avec ces questions, et corrige avant d'avancer :

1. Sans le son, comprend-on la promesse ? Sans l'image, la voix suffit-elle ?
2. Le produit est-il à l'écran avant 3 s, la marque avant 5 s ?
3. Chaque scène a-t-elle une seule idée et un seul point où regarder ?
4. Chaque affirmation est-elle dans la table des faits ?
5. Reste-t-il au moins 2 s pour lire l'appel à l'action ?

## 6. Le squelette des scènes

Reporte le storyboard dans `videos/<vidéo>.html` : une scène vide par ligne, aux bonnes mesures. La page se charge déjà, et la voix off peut se vérifier contre ces durées.

```js
const accroche = scene('accroche', bar(0), bar(1.5), (el, s) => {});
const tension = scene('tension', bar(1.5), bar(2.5), (el, s) => {});
const marque = scene('marque', bar(2.5), bar(3.5), (el, s) => {});
```

Le tempo par défaut est 120. Quand la musique sera choisie, `bpm` changera et ces durées suivront : relance alors `pub-video voice check`.

## 7. La voix off

Écris `audio/voix/<vidéo>.txt`, une réplique par scène :

```
# Voix off — vendeurs
accroche | Tu vends sur WhatsApp ? « C'est combien ? », « C'est dispo ? »…
tension | … et tu perds des ventes.
marque | Avec Asimé, vends plus, sans effort.
offre+0.5 | Trente jours offerts, puis deux mille francs par mois.
```

`nom-de-scène | texte` place la réplique sur la scène ; `nom+0.5` la retarde d'une demi-seconde ; `3.0-5.5 | texte` donne des secondes exactes.

- **Écris pour l'oreille** : phrases courtes, mots simples, une idée par réplique. Lis-la à voix haute dans ta tête : si tu reprends ton souffle au milieu, coupe.
- **Chaque réplique finit avant sa scène** : `pub-video voice check <vidéo>` compte les syllabes (5,2 par seconde, un débit posé) et signale ce qui déborde. Vise 60 à 88 % de remplissage : la voix respire, la musique existe.
- **Les nombres et les adresses s'écrivent comme on les dit** : « deux mille francs », « asimé point net ».
- **Le nom de la marque** est dit à la révélation et dans la dernière réplique. L'appel à l'action est dit.
- **Une scène peut rester sans voix** : la révélation sur le drop, un impact. Le silence de la voix donne du poids.

## Critère de fin

- `brief.md` : Concept et Storyboard complets.
- `audio/voix/<vidéo>.txt` écrit ; `pub-video voice check <vidéo>` sans « TROP LONG ».
- Les cinq questions de relecture ont une réponse oui.
