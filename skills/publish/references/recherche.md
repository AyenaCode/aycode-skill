# Choisir les sujets du jour

But : des sujets que le public cherche ou regarde en ce moment, que la ligne éditoriale couvre, qu'on explique en 30 à 45 s de motion design sans rien filmer, et dont chaque fait se confirme à la source.

## Les créneaux

Chaque vidéo du jour occupe un créneau, dans cet ordre (au-delà de trois vidéos, le cycle recommence) :

| Créneau | Ce que c'est | Preuve de demande |
|---|---|---|
| actu | une nouveauté des 7 derniers jours dans les thèmes : sortie, mise à jour, règle, panne, chiffre officiel | l'annonce officielle, datée |
| astuce | un tuto durable : « comment… », une fonction cachée, une erreur courante | un volume de recherche, une vidéo très vue ou une question qui revient |
| expertise | le cœur du positionnement de `ligne.md` : ce que l'utilisateur sait mieux que les autres | une règle officielle, une doc ou un cas public |

Sans positionnement dans `ligne.md`, le créneau expertise devient une astuce.

## Chercher

Les plateformes (TikTok, Instagram, YouTube) et Google Trends bloquent souvent la lecture automatique : les chiffres de vues seront partiels. Croise plusieurs signaux.

Lance un sous-agent de recherche par créneau, en même temps (outil Agent, modèle rapide). Chacun reçoit les thèmes, le public et la langue de `ligne.md`, la date du jour et son créneau. Il rend, en moins de 400 mots, 3 à 5 candidats avec, pour chacun : la preuve de demande (chiffre, source, adresse, date), la source primaire des faits, et ce qu'on montrerait à l'image. Sans outil de sous-agent, fais les recherches toi-même.

Les sources, de la plus solide à la plus fragile :

1. Les relevés de l'utilisateur listés dans `ligne.md` (classements de vidéos, analyses) : de vrais chiffres, à leur date.
2. Les annonces officielles : journaux des modifications, notes de version, blogs des éditeurs, sites publics.
3. La demande de recherche : Google Trends (zone et 90 jours), pages publiques de volumes de recherche (source commerciale, à dire comme telle).
4. Les études publiques : instituts, régulateurs.
5. Les vidéos très vues trouvées sur le web, avec leur nombre de vues et leur date.

Un article de presse ou un blog sert à trouver la source primaire, jamais à la remplacer. Un chiffre se recopie de sa source ; sans chiffre, la preuve s'écrit « aucune mesure trouvée ».

## Choisir

Écarte un candidat :

- traité dans `journal.md` depuis moins de 60 jours (même sujet ou même angle) ;
- qui demande de filmer une personne, un objet ou un vrai écran : `pub-video` dessine du texte, des formes, des icônes et des schémas ;
- dont les faits clés n'ont pas de source primaire ;
- qui demande plus d'une idée pour tenir debout ;
- qu'une règle de `ligne.md` exclut.

Puis prends, par créneau, le candidat qui a la preuve de demande la plus forte ; à preuve égale, le plus utile au public.

Pour chaque sujet retenu, écris dans « Sujets » de `publish/<date>.md` :

- le titre de travail et le mot-clé `<sujet>` ;
- le créneau ;
- la promesse : ce que le spectateur saura faire ou comprendre à la fin ;
- l'accroche, de 0 à 2 s : la phrase et ce qu'on voit ;
- 3 à 5 faits, chacun avec sa source primaire (adresse) et sa date ;
- la preuve de demande.

## Critère de fin

La section « Recherche » liste chaque candidat avec sa preuve ou « aucune mesure trouvée », et la section « Sujets » a un sujet complet par vidéo, aucun traité dans le journal depuis 60 jours.
