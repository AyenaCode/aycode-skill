# Faire fabriquer la vidéo

La vidéo choisie est fabriquée par un sous-agent (outil Agent, type général), qui garde son travail hors de ton contexte. Il ne connaît que son brief : remplis-le en entier, avec des chemins absolus. Sans outil de sous-agent, suis toi-même le brief.

Après le rapport :

- remplis la ligne de la vidéo dans le tableau « Vidéo » de `publish/<date>.md` ;
- ajoute la vidéo au journal, statut « fabriquée » ou « attend la voix » ;
- reporte dans « Sujets » chaque fait que le sous-agent a retiré.

## Brief de fabrication

```
Fabrique une vidéo verticale avec le skill video-verticale, branche « sujet » : charge-le avec l'outil Skill (dans le plugin aycode, il s'appelle « aycode:video-verticale »).
Atelier : <chemin absolu de l'atelier>. Dossiers : projets/<date>-<sujet>-motion, puis projets/<date>-<sujet>-vertical.

Sujet : <titre de travail>
Promesse : <ce que le spectateur saura faire ou comprendre à la fin>
Accroche, de 0 à 2 s : <phrase et image>
Faits vérifiés, les seuls autorisés à l'écran et dans la voix (relis chacun à sa source avant d'écrire la voix) :
- <fait> : <source primaire, adresse, date>
Hors de la vidéo, car non confirmé : <liste>
Ligne éditoriale : <atelier>/publish/ligne.md (public, ton, phrase de fin, règles, rythme) ; lis aussi les références de style qu'elle liste.
Langue : <langue>. Durée : <durée visée>, celle que le sujet tient sans remplissage, dans <fourchette de ligne.md>. Plateformes : Reels, TikTok et Shorts.
Rythme : celui de « Format » dans ligne.md<, et celui de la vidéo de référence de la consigne du jour : chemin de ses mesures>.
Chaque nombre affiché est le bon dès qu'on peut le lire (un compteur qui défile ne s'arrête pas sur une fausse valeur), et chaque ligne d'un grand titre reste séparée de la suivante, accents, virgules et queues de lettres compris.

Voix off : <garde une des deux consignes>
- Automatique : voix clonée avec le profil voicebox « <profil> »<, au débit noté dans ligne.md>. Quand la vidéo sans voix est rendue, fais l'étape 9 de pub-video (voice synth, relecture de chaque prise, voice mix, animations calées sur les mots dits), puis les étapes 4 à 9 de video-verticale.
- Manuelle : arrête-toi quand la vidéo sans voix est rendue (pub-video build), que audio/voix/<vidéo>.txt passe « pub-video voice check » et que le guide est écrit (pub-video voice guide).

Si le système arrête un rendu faute de mémoire, relance-le avec moins de navigateurs (--workers 3, puis 2).

Tu travailles seul : tu décides chaque choix et tu le notes dans brief.md, et tes contrôles remplacent les validations par l'utilisateur. Un fait qui ne se confirme pas à sa source sort de la vidéo.

Rapport, en moins de 200 mots : les chemins livrés (vidéo et couverture, ou vidéo sans voix, script et guide), la durée, ce que montrent les 3 premières secondes, la musique et sa licence, le résultat de check, les faits retirés, et ce qui reste à écouter ou à vérifier.
```

## Brief de finition (après la voix off manuelle)

```
Termine la vidéo « <sujet> » avec le skill video-verticale, branche « sujet » (outil Skill ; « aycode:video-verticale » dans le plugin aycode). Atelier : <chemin absolu>.
La voix off est arrivée dans projets/<date>-<sujet>-motion/audio/voix/prises/ : <fichiers, dans l'ordre>.
Fais l'étape 9 de pub-video (voice mix avec ces fichiers), puis les étapes 4 à 9 de video-verticale dans projets/<date>-<sujet>-vertical.
Tu travailles seul ; ton rapport a la même forme que celui de la fabrication.
```

## Brief de correction

```
Corrige la vidéo « <sujet> » avec le skill video-verticale (outil Skill ; « aycode:video-verticale » dans le plugin aycode). Atelier : <chemin absolu>.
Défaut vu : <ce qui ne va pas, et à quelle seconde>.
Le projet d'habillage est projets/<date>-<sujet>-vertical ; si le défaut vient de l'image elle-même, corrige projets/<date>-<sujet>-motion avec la voix déjà mixée (sans la régénérer), puis refais l'habillage. Garde la version précédente dans archives/.
Refais le rendu, check et la planche, regarde toi-même les secondes du défaut, puis rends un rapport de même forme que celui de la fabrication.
```
