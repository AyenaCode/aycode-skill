# Sensation : un site qui répond comme un objet réel

Règles obligatoires (règle permanente « Sensation » de `SKILL.md`) pour tout ce que le visiteur touche, glisse, survole ou fait défiler. Elles viennent des principes d'interface fluide d'Apple. Si le skill `apple-design` est installé, charge-le aussi : il donne le détail et les valeurs. Chaque règle dit comment la vérifier avec `pilote`.

Le principe : l'interface se comporte comme le monde physique. Elle répond tout de suite, bouge sans rupture, garde l'élan du geste, résiste aux limites et se laisse rattraper en plein mouvement.

## 1. Répondre tout de suite

- Le retour visuel part à l'appui (`pointerdown`, `:active`), pas au relâchement. Le geste se valide au relâchement.
- Aucun délai artificiel sur le chemin d'une action : pas de minuterie, d'anti-rebond ni d'attente de fin de transition avant de réagir.
- Pendant un geste (glisser, curseur, tiroir), l'interface suit en continu, pas seulement à la fin.

**Vérifier :** `pilote mesure clique @eN` puis `pilote mesure glisse ...` donnent une réaction de 100 ms au plus. `pilote filme glisse ...` montre l'élément qui suit le geste sur chaque image.

## 2. Suivre le doigt à l'identique

- Un élément saisi reste collé au doigt, à l'endroit exact où il a été pris : il ne saute pas pour se centrer sous le doigt.
- Pointer Events avec `setPointerCapture`, pour suivre même quand le doigt sort de l'élément.
- Garde les dernières positions et leurs instants : la vitesse au relâchement en dépend (règle 5).

## 3. Tout se rattrape en plein mouvement

C'est la règle la plus importante.
- Toute animation peut être interrompue et inversée à tout moment. L'entrée n'est jamais bloquée pendant une transition.
- Une nouvelle animation part de la valeur **affichée** à cet instant, jamais de la valeur cible de la précédente : sinon l'élément saute.
- Le mouvement piloté par un geste utilise des ressorts, qui repartent naturellement de la position et de la vitesse courantes. Les transitions CSS et `@keyframes` sont réservées à ce que le visiteur ne manipule pas.
- En 2D, un ressort par axe (X et Y), pour que les deux axes gardent chacun leur vitesse.

**Vérifier :** `pilote filme clique @eN puis attends 120 puis clique @eN` (ouvrir puis refermer en plein mouvement). La planche montre un demi-tour fluide depuis la position atteinte, sans saut ni retour à zéro.

## 4. Des ressorts plutôt que des durées

- On règle un ressort par son **amortissement** (rebond) et sa **vitesse de réponse**, pas par une durée.
- Par défaut, aucun rebond (amortissement critique) : le mouvement se pose sans osciller.
- Un léger rebond seulement quand le geste avait de l'élan (lancer, glisser puis lâcher). Un menu qui apparaît ne rebondit pas ; une carte qu'on lance, si.
- Avec Motion : `transition={{ type: 'spring', bounce: 0 }}` par défaut, un petit `bounce` après un geste lancé (vérifie les options du jour dans la documentation de Motion). GSAP n'a pas de ressort : il garde le mouvement scénarisé (scroll cinématique, entrées), et Draggable avec InertiaPlugin couvre le lancer.

## 5. L'élan passe du geste à l'animation

- Au relâchement, l'animation démarre exactement à la vitesse du doigt : aucune couture visible entre le geste et la suite.
- On projette où le geste allait (comme la décélération d'un défilement), puis on se pose sur la cible la plus proche de ce point projeté, pas de la position du relâchement. Un petit geste vif produit un grand déplacement.

**Vérifier :** `pilote filme --images 16 glisse <de> <à> --duree 150` (geste court et vif). L'élément continue sur sa lancée après le relâchement, puis ralentit, sans arrêt brusque.

## 6. Cohérence dans l'espace

- Un élément repart par où il est arrivé : un panneau entré par la droite sort par la droite.
- Un menu, une infobulle ou un panneau naît de l'élément qui l'a ouvert (`transform-origin` sur le déclencheur).
- Une transition réversible a des courbes en miroir à l'aller et au retour.
- Le mouvement intermédiaire indique déjà où il va : ce qui grandit pousse vers sa position finale.

## 7. Des limites souples

Au bout d'une zone (carrousel, tiroir, scène qu'on fait tourner), le mouvement résiste de plus en plus au lieu de s'arrêter net, puis revient en place au relâchement. L'élément suit de moins en moins le doigt à mesure qu'il dépasse la limite (déplacement affiché = dépassement × taille × k / (taille + k × |dépassement|), avec k ≈ 0,55).

**Vérifier :** `pilote filme glisse` au-delà de la limite : l'élément ralentit et revient, il ne se bloque pas.

## 8. Des gestes bien reconnus

- Un seuil d'environ 10 px avant de décider la direction d'un glisser, puis un suivi à l'identique.
- Toucher : surbrillance à l'appui, validation au relâchement, annulation si le doigt s'éloigne avant de lâcher.
- Pas d'attente de double-toucher là où le double-toucher n'existe pas : il retarde chaque toucher simple.
- Le défilement de la page reste au doigt : une zone qui capte le geste (`touch-action: none`) se limite à l'interaction signature.

## 9. Des images propres

- Seulement `transform` et `opacity` sur ce qui bouge ([`performance.md`](performance.md)).
- Le déplacement par image reste petit : un mouvement très rapide gagne à être étiré ou légèrement flouté plutôt que de sauter.

## 10. Matière et profondeur

- La translucidité (`backdrop-filter`, sur de petites surfaces) et des ombres larges et douces disent ce qui est au-dessus de quoi.
- Trois plans au plus : le fond, le contenu, ce qui flotte (menus, panneaux, curseur).

## 11. Plusieurs sens à la fois

- Mouvement, son (coupé par défaut, activable) et vibration (`navigator.vibrate`, Android seulement) disent la même chose au même instant, pour les gestes forts uniquement.

## 12. Mouvement réduit

En `prefers-reduced-motion`, les déplacements deviennent des fondus courts et les scènes en boucle s'arrêtent sur une image. Le retour d'action reste : un bouton change d'état, un panneau apparaît. On réduit le mouvement, on ne retire pas la réponse.

## 13. Typographie fine

- Grands titres : espacement des lettres resserré et interligne court. Petits textes : espacement légèrement ouvert et interligne aéré.
- Police variable avec `font-optical-sizing: auto` quand elle a un axe optique.
- Les chiffres qui changent (compteurs, prix) en chiffres à largeur fixe (`font-variant-numeric: tabular-nums`), pour qu'ils ne tremblent pas.
