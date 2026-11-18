# Proposer les trois sujets du jour

But : trois sujets, un par créneau, que le public cherche ou regarde en ce moment, que la ligne éditoriale couvre, qui tiennent la durée de `ligne.md` en motion design sans remplissage ni rien filmer, et dont chaque fait se confirme à la source. L'utilisateur en choisit un : chaque proposition est complète, prête à fabriquer.

## Les créneaux

Chaque proposition occupe un créneau :

| Créneau | Ce que c'est | Preuve de demande |
|---|---|---|
| actu | une nouveauté des 7 derniers jours dans les thèmes : sortie, mise à jour, règle, panne, chiffre officiel | l'annonce officielle, datée |
| astuce | un tuto durable : « comment… », une fonction cachée, une erreur courante | un volume de recherche, une vidéo très vue ou une question qui revient |
| expertise | le cœur du positionnement de `ligne.md` : ce que l'utilisateur sait mieux que les autres | une règle officielle, une doc ou un cas public |

Sans positionnement dans `ligne.md`, le créneau expertise devient une astuce.

## Chercher

Les plateformes (TikTok, Instagram, YouTube) et Google Trends bloquent souvent la lecture automatique : les chiffres de vues seront partiels. Croise plusieurs signaux.

Lance un sous-agent de recherche par créneau, en même temps (outil Agent, modèle rapide). Chacun reçoit les thèmes, le public, la langue et la durée de `ligne.md`, les sujets du journal des 60 derniers jours, la date du jour et son créneau. Il rend, en moins de 550 mots :

- 3 à 5 candidats avec, pour chacun : la preuve de demande (chiffre, source, adresse, date), la source primaire des faits, et ce qu'on montrerait à l'image ;
- pour son candidat n°1 : 5 à 8 faits relus dans la source primaire elle-même, chacun avec sa citation exacte, son adresse et sa date, et ce qu'il n'a pas pu confirmer.

Sans outil de sous-agent, fais les recherches toi-même.

Les sources, de la plus solide à la plus fragile :

1. Les relevés de l'utilisateur listés dans `ligne.md` (classements de vidéos, analyses) : de vrais chiffres, à leur date.
2. Les annonces officielles : journaux des modifications, notes de version, blogs des éditeurs, sites publics.
3. La demande de recherche : Google Trends (zone et 90 jours), pages publiques de volumes de recherche (source commerciale, à dire comme telle).
4. Les études publiques : instituts, régulateurs.
5. Les vidéos très vues trouvées sur le web, avec leur nombre de vues et leur date.

Un article de presse ou un blog sert à trouver la source primaire, jamais à la remplacer. Un chiffre se recopie de sa source ; sans chiffre, la preuve s'écrit « aucune mesure trouvée ».

## Retenir

Écarte un candidat :

- traité dans `journal.md` depuis moins de 60 jours (même sujet ou même angle) ;
- qui demande de filmer une personne, un objet ou un vrai écran : `pub-video` dessine du texte, des formes, des icônes, des schémas et des interfaces génériques ;
- dont les faits clés n'ont pas de source primaire ;
- qui demande plus d'une idée pour tenir debout, ou trop mince pour tenir la durée minimale de `ligne.md` : une idée, mais assez de matière (étapes, signes, chiffres, conséquences) pour la remplir ;
- qu'une règle de `ligne.md` exclut.

Puis prends, par créneau, le candidat qui a la preuve de demande la plus forte ; à preuve égale, le plus utile au public.

Pour chaque proposition, numérotée 1 à 3, écris dans « Sujets » de `publish/<date>.md` :

- le titre de travail et le mot-clé `<sujet>` ;
- le créneau ;
- la promesse : ce que le spectateur saura faire ou comprendre à la fin ;
- l'accroche, de 0 à 2 s : la phrase et ce qu'on voit ;
- 5 à 8 faits, chacun avec sa source primaire (adresse) et sa date, puis ce qui reste non confirmé et donc hors de la vidéo ;
- la preuve de demande ;
- la durée qu'il tient, dans la fourchette de `ligne.md`.

## Critère de fin

La section « Recherche » liste chaque candidat avec sa preuve ou « aucune mesure trouvée », et la section « Sujets » a trois propositions complètes, une par créneau, aucune traitée dans le journal depuis 60 jours.
