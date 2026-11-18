# Faire fabriquer la vidéo

La vidéo se fabrique avec le skill `refonte-youtube`, par étapes, chacune confiée à un sous-agent (outil Agent, type général). Les sous-agents travaillent un par un : un rendu occupe toute la machine, et chacun garde son travail hors de ton contexte. Le sous-agent ne connaît que son brief : remplis-le en entier, avec des chemins absolus. Sans outil de sous-agent, suis toi-même chaque brief, l'un après l'autre.

Après chaque rapport :

- remplis la ligne de l'étape dans le tableau « Fabrication » de `publish-youtube/<date>.md` ;
- mets à jour le statut de la vidéo dans le journal ;
- reporte dans « Sujet » chaque fait que le sous-agent a retiré.

Les dossiers :

| Journée | Projet de la vidéo | Projet des séquences |
|---|---|---|
| vidéo du jour | `projets/<date>-<sujet>-youtube` | `projets/<date>-<sujet>-motion` |
| refonte | `projets/<sujet>-refonte` | `projets/<sujet>-motion` |

## Brief « Script »

```
Prépare une vidéo YouTube avec le skill refonte-youtube : charge-le avec l'outil Skill (dans le plugin aycode, il s'appelle « aycode:refonte-youtube »).
Branche : <nouvelle | refonte>. Atelier : <chemin absolu de l'atelier>. Dossier du projet : <projet>.
<Branche nouvelle> Sujet : <titre de travail>. Format : <format>.
<Branche refonte> Ancienne vidéo : <fichier ou lien>.
Promesse : <ce que le spectateur saura faire ou comprendre à la fin>
Accroche, de 0 à 30 s : <phrase et image>
Plan : <chapitres, avec ce que chacun montre>
Faits vérifiés, les seuls autorisés à l'écran et dans la voix :
- <fait> : <source primaire, adresse, date>
Images prévues : <pages à capturer ; clips de l'utilisateur, chemins absolus>
Séquences animées prévues : <nom : ce qu'elle montre>
Ligne éditoriale : <atelier>/publish-youtube/ligne.md (public, ton, phrase de fin, règles, style) ; lis aussi les références qu'elle liste.
Langue : <langue>. Durée visée : <durée>. Profil de voix : <profil>.

Fais les étapes 0 à 3 de refonte-youtube (outils, cadrer, lire l'ancienne vidéo ou rassembler les images, écrire le script), puis arrête-toi : la validation, la voix, la musique, les séquences et le rendu viennent ensuite. Mets le profil de voix dans refonte.json (voix.profil) et les couleurs de ligne.md dans style ; si ligne.md donne une autre police que Montserrat, lance « refonte-youtube police "<police>" ».
Tu travailles seul : tu décides chaque choix et tu le notes dans brief.md. Un fait qui ne se confirme pas à sa source sort de la vidéo.

Rapport, en moins de 250 mots :
- le chemin de script.md et la durée estimée par plan ;
- l'accroche telle qu'elle sera dite ;
- les chapitres avec leur temps ;
- chaque séquence animée du script : nom, réplique, durée visée, ce qu'elle montre ;
- les captures faites, les faits retirés, les alertes de plan restantes.
```

## Brief « Voix et musique »

```
Continue la vidéo du projet <projet absolu> avec le skill refonte-youtube (outil Skill ; « aycode:refonte-youtube » dans le plugin aycode). Atelier : <chemin absolu>.
Le script est validé : coche l'étape 4 de brief.md avec « validé par publish-youtube ».
Fais l'étape 5 (voix, profil « <profil> », puis mots) et l'étape 6 (musique et bruitages), puis arrête-toi.
Tu travailles seul : tu décides chaque choix et tu le notes dans brief.md.

Rapport, en moins de 150 mots :
- la durée réelle donnée par plan ;
- les répliques redites et les écarts de mots restants ;
- les morceaux de musique avec leur licence ;
- la durée réelle de chaque réplique qui porte une séquence animée.
```

## Brief « Séquence animée »

Un brief par séquence, avec la durée réelle de sa réplique (rapport « Voix et musique », ou `refonte-youtube plan`).

```
Fabrique une séquence animée avec le skill pub-video (outil Skill ; « aycode:pub-video » dans le plugin aycode), pour la vidéo du projet <projet absolu>. Atelier : <chemin absolu>.
Lis d'abord <chemin du skill refonte-youtube>/references/motion.md : il dit comment une séquence de refonte diffère d'une pub (16:9, ni voix ni musique, au moins un bruitage), et comment dessiner et animer un personnage et des objets.
Projet pub-video : <projet des séquences> (« pub-video new <projet des séquences> --video <nom> --format 16:9 --bars <mesures> --lang <langue> » ; s'il existe, la commande ajoute seulement la vidéo).
Séquence : <nom>. Durée : au moins <durée> s, un nombre entier de mesures à 120 BPM (2 s par mesure).
Ce qu'elle montre : <idée, étapes, chiffres, personnage ou non>.
Ce que dit la voix pendant ce temps : <réplique(s)>.
Faits autorisés à l'écran : <faits vérifiés concernés, avec leur source>.
Style : couleurs <accent, fond, texte> de <projet>/refonte.json. Un personnage déjà dessiné se trouve dans <projet des séquences>/assets/personnages.js : réutilise-le. S'il n'existe pas et que la séquence en demande un, crée ce fichier.
Suis les étapes 6 à 8 de pub-video (scènes, contrôles, rendu), puis copie exports/<nom>-<durée>s_sans-voix.mp4 vers <projet>/motion/<nom>.mp4.
Tu travailles seul : tes contrôles et tes revues de planches remplacent les validations.

Rapport, en moins de 120 mots :
- le chemin copié et sa durée ;
- ce que montre la séquence, en deux lignes ;
- le résultat de pub-video check ;
- le personnage créé ou réutilisé.
```

## Brief « Assemblage »

```
Termine la vidéo du projet <projet absolu> avec le skill refonte-youtube (outil Skill ; « aycode:refonte-youtube » dans le plugin aycode). Atelier : <chemin absolu>.
La voix, la musique et les séquences animées sont prêtes : coche l'étape 7 de brief.md.
Fais l'étape 8 (aperçu, puis revue complète des planches, avec chaque correction), puis l'étape 10 (export final). Écris ensuite le README.md de l'étape 11, sans répondre à l'utilisateur.
L'étape 9 est remplacée par tes contrôles : coche-la avec « contrôlée par publish-youtube ».
Tu travailles seul : tu décides chaque choix et tu le notes dans brief.md. Un fait qui ne se confirme pas à sa source sort de la vidéo.

Rapport, en moins de 200 mots :
- les chemins de la vidéo, du .srt et des chapitres, avec la durée ;
- ce que montrent les 30 premières secondes ;
- les défauts trouvés sur les planches et leur correction ;
- le niveau du son et la musique sous la voix ;
- les mots forts encore placés par estimation ;
- ce qui reste à écouter ou à vérifier.
```

## Brief « Correction »

```
Corrige la vidéo du projet <projet absolu> avec le skill refonte-youtube (outil Skill ; « aycode:refonte-youtube » dans le plugin aycode). Atelier : <chemin absolu>.
Défaut : <ce qui ne va pas, à quelle seconde ou à quelle réplique ; ou les corrections de l'utilisateur sur le script>.
Corrige script.md ou refonte.json. Si le défaut vient d'une séquence animée, corrige-la dans <projet des séquences> avec pub-video, puis recopie-la dans motion/.
Relance plan. Une réplique modifiée se redit (voix, puis mots) si la voix existe déjà. Puis refais le rendu le plus avancé déjà fait : apercu, ou build si l'export final existe.
Rapport de même forme que celui de l'étape qui a produit le défaut.
```
