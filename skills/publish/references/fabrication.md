# Faire fabriquer les vidéos

Chaque vidéo est fabriquée par un sous-agent (outil Agent, type général), l'une après l'autre : un rendu occupe toute la machine, et chaque sous-agent garde son travail hors de ton contexte. Le sous-agent ne connaît que son brief : remplis-le en entier, avec des chemins absolus. Sans outil de sous-agent, suis toi-même chaque brief, vidéo par vidéo.

Après chaque rapport :

- remplis la ligne de la vidéo dans le tableau « Vidéos » de `publish/<date>.md` ;
- ajoute la vidéo au journal, statut « fabriquée » ou « attend la voix » ;
- reporte dans « Sujets » chaque fait que le sous-agent a retiré.

## Brief de fabrication

```
Fabrique une vidéo verticale avec le skill video-verticale, branche « sujet » : charge-le avec l'outil Skill (dans le plugin aycode, il s'appelle « aycode:video-verticale »).
Atelier : <chemin absolu de l'atelier>. Dossiers : projets/<date>-<sujet>-motion, puis projets/<date>-<sujet>-vertical.

Sujet : <titre de travail>
Promesse : <ce que le spectateur saura faire ou comprendre à la fin>
Accroche, de 0 à 2 s : <phrase et image>
Faits vérifiés, les seuls autorisés à l'écran et dans la voix :
- <fait> : <source primaire, adresse, date>
Ligne éditoriale : <atelier>/publish/ligne.md (public, ton, phrase de fin, règles) ; lis aussi les références de style qu'elle liste.
Langue : <langue>. Durée : <durée>. Plateformes : Reels, TikTok et Shorts.

Voix off : <garde une des deux consignes>
- Automatique : voix de synthèse avec le profil voicebox « <profil> » et la consigne de ton « <consigne> ». Quand la vidéo sans voix est rendue, fais l'étape 10 de pub-video (voice synth, puis voice mix), puis les étapes 4 à 9 de video-verticale.
- Manuelle : arrête-toi quand la vidéo sans voix est rendue (pub-video build), que audio/voix/<vidéo>.txt passe « pub-video voice check » et que le guide est écrit (pub-video voice guide).

Tu travailles seul : tu décides chaque choix et tu le notes dans brief.md, et tes contrôles remplacent les validations par l'utilisateur. Un fait qui ne se confirme pas à sa source sort de la vidéo.

Rapport, en moins de 200 mots : les chemins livrés (vidéo et couverture, ou vidéo sans voix, script et guide), la durée, ce que montrent les 3 premières secondes, la musique et sa licence, le résultat de check, les faits retirés, et ce qui reste à écouter ou à vérifier.
```

## Brief de finition (après la voix off manuelle)

```
Termine la vidéo « <sujet> » avec le skill video-verticale, branche « sujet » (outil Skill ; « aycode:video-verticale » dans le plugin aycode). Atelier : <chemin absolu>.
La voix off est arrivée dans projets/<date>-<sujet>-motion/audio/voix/prises/ : <fichiers, dans l'ordre>.
Fais l'étape 10 de pub-video (voice mix avec ces fichiers), puis les étapes 4 à 9 de video-verticale dans projets/<date>-<sujet>-vertical.
Tu travailles seul ; ton rapport a la même forme que celui de la fabrication.
```

## Brief de correction

```
Corrige la vidéo « <sujet> » avec le skill video-verticale (outil Skill ; « aycode:video-verticale » dans le plugin aycode). Atelier : <chemin absolu>.
Défaut vu : <ce qui ne va pas, et à quelle seconde>.
Le projet d'habillage est projets/<date>-<sujet>-vertical ; si le défaut vient de l'image elle-même, corrige projets/<date>-<sujet>-motion, puis refais l'habillage.
Refais le rendu, check et la planche, puis rends un rapport de même forme que celui de la fabrication.
```
