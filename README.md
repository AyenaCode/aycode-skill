# aycode-skill

Skills pour les agents de code, livrés en plugin Claude Code. Chaque skill a son propre dossier dans `skills/`.

## Skills

| Skill | Rôle |
|---|---|
| [`ship`](skills/ship/SKILL.md) | Mène une tâche de code de bout en bout. Il fait valider le plan au dev, puis enchaîne les étapes : coder, vérifier, commiter. Il simplifie ensuite tout le changement, le fait contrôler par un vérificateur indépendant et écrit un rapport dans la langue du dev. |
| [`planner`](skills/planner/SKILL.md) | Planifie une tâche de code sans l'écrire. Il écrit un résumé court dans la langue du dev, que le dev peut modifier, et un plan détaillé que `ship` exécute. |
| [`pub-video`](skills/pub-video/SKILL.md) | Fabrique une pub vidéo en motion design pour un produit, à partir de son URL ou de son code. Le skill écrit le concept, le storyboard et la voix off, la fait dire par ta voix clonée (voicebox), cale une musique libre au temps près, pose les bruitages et exporte le `.mp4`. |
| [`pentester`](skills/pentester/SKILL.md) | Relit le code en pensant comme un attaquant, sans rien attaquer. Couvre le mobile (React Native), les API, le web et l'infra (Docker, Kubernetes, CI). Il écrit un rapport Markdown simple, avec la gravité et le correctif de chaque faille. |
| [`montage-youtube`](skills/montage-youtube/SKILL.md) | Monte une vidéo YouTube à partir de rushs enregistrés, face caméra ou capture d'écran commentée. Il coupe les silences, les hésitations et les reprises, nettoie la voix, puis exporte le `.mp4` et ses sous-titres `.srt`. Une vidéo de référence peut fixer le rythme. |
| [`video-verticale`](skills/video-verticale/SKILL.md) | Fabrique une vidéo verticale pour Reels, TikTok et Shorts, à partir d'un sujet (motion design) ou d'un enregistrement vertical. Il dérushe, incruste des sous-titres animés mot à mot, ajoute un titre d'accroche, des zooms sur les coupes, une musique baissée sous la voix et des bruitages, puis exporte le `.mp4` et sa couverture. |
| [`refonte-youtube`](skills/refonte-youtube/SKILL.md) | Refait une ancienne vidéo YouTube en version pro et animée. Il transcrit l'ancienne vidéo et réécrit un script plus accrocheur. Il le fait dire par ta voix clonée (voicebox), redécoupe les images sur cette voix, incruste les mots forts et ajoute des séquences en motion design, une musique libre et des bruitages. Il exporte ensuite le `.mp4`, ses sous-titres `.srt` et ses chapitres YouTube. Il sait aussi faire une vidéo nouvelle sur un sujet, sans tournage. |
| [`publish-youtube`](skills/publish-youtube/SKILL.md) | Produit la vidéo YouTube du jour, de 8 à 10 minutes, sans tournage. Il cherche un sujet qui a de la demande et fait écrire le script, que tu valides. Puis il fait fabriquer la vidéo par `refonte-youtube` et `pub-video` : ta voix clonée, des captures des sources, des séquences animées avec personnages et objets, et la musique. Il te livre la vidéo avec ses titres, sa description et ses chapitres. `refonte <vidéo>` refait une ancienne vidéo de la chaîne. |
| [`publish`](skills/publish/SKILL.md) | Produit la vidéo verticale du jour, de 50 s à 1 min 30. Il te propose trois sujets qui ont de la demande et fait fabriquer celui que tu choisis par `video-verticale` et `pub-video`. La voix off est dite par ta voix clonée (voicebox), ou il te donne les textes à enregistrer. Il contrôle la vidéo et te la livre avec sa légende. |
| [`site-immersif`](skills/site-immersif/SKILL.md) | Conçoit et construit un site web immersif : scroll cinématique, 3D, shaders et une interaction signature à manipuler. Il propose trois concepts, fixe la direction artistique, prototype l'effet phare puis construit section par section. Il manipule lui-même le site avec `pilote` (toucher, glisser, défiler, clavier) et filme chaque geste pour juger l'effet, sur ordinateur et téléphone simulé, contre un budget de performance non négociable (Lighthouse mobile ≥ 95, affichage principal en 2 s). Le site vise le niveau d'accessibilité WCAG 2.2 AA, vérifié par un audit, et les règles d'interface fluide d'Apple : réponse immédiate, animations qu'on peut rattraper, ressorts, élan. Il s'appuie sur les skills officiels GSAP, Motion et les skills Three.js qu'il te propose d'installer. |

## Installation

### Claude Code

Dans Claude Code :

```
/plugin marketplace add AyenaCode/aycode-skill
/plugin install aycode@aycode
```

Ou depuis le terminal, en une ligne :

```bash
claude plugin install aycode --marketplace AyenaCode/aycode-skill
```

Les skills s'appellent ensuite avec `/aycode:<skill>`, par exemple `/aycode:pentester`.

Pour recevoir les mises à jour, active la mise à jour automatique dans `/plugin` > Marketplaces > `aycode`. Sinon, lance `claude plugin update aycode@aycode`.

### Autres agents de code (Codex, Cursor, OpenCode…)

```bash
npx skills add AyenaCode/aycode-skill
```

Ajoute `-g` pour tous tes projets, ou `--skill pentester` pour un seul skill. Les skills vidéo sont faits pour Claude Code : ailleurs, lance toi-même leur `install.sh` avant le premier usage.

## ship et planner

```
/aycode:ship <la tâche>
```

1. Le skill te propose de faire le plan avec le modèle le plus puissant (Fable, sinon Opus, en effort `xhigh`) : meilleur plan, mais plus cher. Si tu refuses, le plan est fait avec le modèle de ta session.
2. Il explore le projet et écrit deux fichiers dans `.local/plans/` : un résumé court dans ta langue (`<tâche>.brief.md`) et un plan détaillé pour l'agent (`<tâche>.plan.md`).
3. Tu relis le résumé, tu réponds aux points à décider, tu modifies le résumé si besoin, puis tu donnes ton accord. Rien n'est codé avant.
4. L'agent enchaîne les étapes sur une branche, un commit par étape, et coche l'avancement dans ton résumé. Il ne pousse rien.
5. Il simplifie tout le changement, lance toutes les vérifications du projet, puis un vérificateur indépendant, en lecture seule, contrôle le travail.
6. Le rapport final, dans ta langue, explique ce qui a changé, pourquoi, et comment le tester.

`ship` ne démarre que quand tu tapes sa commande. `planner` peut aussi se lancer tout seul quand tu demandes un plan dans la discussion. Il s'arrête après le plan, et tu démarres le travail avec `/aycode:ship .local/plans/<tâche>.plan.md`. C'est aussi cette commande qui reprend une tâche interrompue.

Les règles du projet (`CLAUDE.md`, `AGENTS.md`) passent avant celles des skills. Les commandes de vérification (tests, lint, build) sont trouvées dans le projet.

## pub-video

### Prérequis

- Node.js 20 ou plus
- FFmpeg, avec ffprobe
- Optionnel : `yt-dlp`, pour télécharger une vidéo de référence
- Optionnel : `whisper.cpp`, pour transcrire une référence et caler la voix off
- Optionnel : [voicebox](https://github.com/jamiepine/voicebox). Quand il répond avec le profil de ta voix clonée, c'est elle qui dit la voix off (`pub-video voice synth`) ; sans lui, ou si tu le demandes, tu enregistres la voix toi-même, guidé par une vidéo

À chaque usage, le skill lance `install.sh`, sans sudo. La première fois, ce script installe les dépendances Node, un Chromium sans écran et la commande `pub-video` dans `~/.local/bin`. Les fois suivantes, il ne fait que pointer la commande sur la version à jour du skill. Ensuite, `pub-video doctor` vérifie que tout est en place.

## montage-youtube

### Prérequis

- Node.js 20 ou plus
- FFmpeg, avec ffprobe
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) et un modèle (`large-v3-turbo` conseillé, `small` suffit pour commencer)
- Optionnel : `yt-dlp`, pour mesurer une vidéo de référence en ligne

À chaque usage, le skill lance `install.sh`, sans sudo. Ce script met la commande `montage-youtube` dans `~/.local/bin`, pointée sur la version à jour du skill. Ensuite, `montage-youtube doctor` vérifie que tout est en place. Si whisper.cpp n'est pas dans `~/whisper.cpp`, indique son chemin avec les variables `WHISPER_CLI` et `WHISPER_MODEL`.

## video-verticale

### Prérequis

- Les skills `montage-youtube` et `pub-video`, fournis avec le plugin : il reprend leur montage, leur transcription, leur musique, leurs bruitages et leur mixage
- FFmpeg avec libass (sous-titres incrustés), comme celui des paquets Ubuntu ou Homebrew

À chaque usage, le skill lance `install.sh`, sans sudo. Ce script met la commande `video-verticale` dans `~/.local/bin` et installe aussi ses deux skills frères quand ils sont à côté. Ensuite, `video-verticale doctor` vérifie que tout est en place, skills frères compris. La police des sous-titres (Montserrat Black par défaut) se télécharge depuis Google Fonts dans chaque projet.

## refonte-youtube

```
/aycode:refonte-youtube <vidéo ou lien> [durée visée, profil de voix, consignes]
```

1. Il télécharge l'ancienne vidéo si tu donnes un lien, la transcrit avec ses temps, repère ses changements de plan et dessine des planches d'images.
2. Il écrit un nouveau script, réplique par réplique. Chaque réplique dit ce qu'on voit : un passage de l'ancienne vidéo, une séquence animée, une image ou un carton. Les mots forts s'affichent quand ils sont dits. Tu valides le texte avant que la voix soit générée.
3. Il génère la voix avec ton profil voicebox, puis la retranscrit pour repérer les prises ratées.
4. Il cale les images sur la nouvelle voix. Un passage est coupé, ralenti ou accéléré pour tenir sa réplique, avec un zoom lent si l'image doit tenir. Puis il ajoute les titres de chapitre, la musique (baissée quand la voix parle) et les bruitages.
5. Tu valides un aperçu, puis il exporte la vidéo, les sous-titres `.srt` et les chapitres à coller dans la description.

### Prérequis

- Les skills `montage-youtube`, `pub-video` et `video-verticale`, fournis avec le plugin : il reprend leur transcription, leur voix clonée, leurs bruitages, leur musique et leurs séquences animées
- FFmpeg avec libass, et whisper.cpp (comme pour `montage-youtube`)
- [voicebox](https://github.com/jamiepine/voicebox), avec le profil de ta voix clonée
- Optionnel : `yt-dlp`, pour partir d'un lien

À chaque usage, le skill lance `install.sh`, sans sudo. Ce script met la commande `refonte-youtube` dans `~/.local/bin` et installe aussi ses trois skills frères quand ils sont à côté. Ensuite, `refonte-youtube doctor` vérifie que tout est en place.

## publish

```
/aycode:publish [consigne du jour]
/aycode:publish <1 | 2 | 3>
/aycode:publish finir
```

Lance-le depuis ton atelier vidéo, le dossier où vivent tes projets. Il y crée `publish/` : ta ligne éditoriale (`ligne.md`, remplie au premier lancement, avec la durée et le rythme des vidéos), le journal des vidéos déjà faites et une page par journée, qui sert aussi de mémoire pour reprendre.

1. Il te propose trois sujets qui ont de la demande, un par créneau : une actu de la semaine, une astuce durable et ton domaine d'expertise. Chaque fait vient d'une source primaire, avec sa date. Tu choisis celui à faire, tout de suite ou plus tard avec `/aycode:publish <numéro>`. Un sujet imposé dans la consigne du jour se fait sans proposition.
2. Un sous-agent fabrique la vidéo avec `video-verticale` et `pub-video` : 50 s à 1 min 30, la durée que le sujet tient sans remplissage, au rythme fixé dans `ligne.md`.
3. La voix off :
   - **automatique** si [voicebox](https://github.com/jamiepine/voicebox) tourne sur ta machine et que le profil de ta voix clonée est noté dans `ligne.md` : la vidéo sort finie ;
   - **manuelle** sinon : il te donne les textes, réplique par réplique, et le dossier où déposer tes fichiers (enregistrés ou générés ailleurs). Ensuite, `/aycode:publish finir` termine la vidéo.
4. Il contrôle la vidéo, puis te livre le fichier, sa couverture, une légende prête à coller et les sources.

Il ne publie rien : la publication reste à toi.

### Prérequis

- Les skills `video-verticale`, `pub-video` et `montage-youtube`, fournis avec le plugin
- Optionnel : voicebox, avec un profil créé une fois à partir d'un enregistrement de ta voix. Sur Linux, il n'y a pas encore de version prête à installer : compile-le, ou lance son `docker-compose.yml` (adresse `http://127.0.0.1:17600`). `pub-video voice profils` dit si la commande le trouve.

## publish-youtube

```
/aycode:publish-youtube [consigne du jour]
/aycode:publish-youtube refonte <vidéo ou lien>
/aycode:publish-youtube finir
```

Lance-le depuis ton atelier vidéo. Il y crée `publish-youtube/` : la ligne éditoriale de ta chaîne (`ligne.md`, préremplie depuis celle de `publish` si elle existe), le journal des vidéos et une page par journée, qui sert aussi de mémoire pour reprendre.

1. Il cherche un sujet qui a de la demande et qui tient 8 à 10 minutes sans tournage : un tuto, une actu décryptée, un comparatif, des erreurs à éviter ou un concept expliqué. Chaque fait vient d'une source primaire, avec sa date.
2. Un sous-agent écrit le script avec `refonte-youtube`. Par défaut, la journée s'arrête là : tu relis le script, puis `/aycode:publish-youtube finir` lance la suite.
3. Des sous-agents génèrent ta voix clonée, choisissent la musique et fabriquent les séquences animées avec `pub-video` (personnages simples, objets, parcours, tutos). Puis ils assemblent la vidéo.
4. Il contrôle la vidéo sur des planches d'images, puis te livre la vidéo, ses sous-titres, trois titres, une description avec les chapitres et les sources, et une idée de miniature.

Avec `refonte <vidéo>`, il refait une ancienne vidéo de ta chaîne de la même façon. Il ne publie rien : la publication reste à toi.

### Prérequis

- Les skills `refonte-youtube`, `pub-video`, `montage-youtube` et `video-verticale`, fournis avec le plugin
- [voicebox](https://github.com/jamiepine/voicebox) avec le profil de ta voix clonée : une vidéo de dix minutes ne se fait pas sans

## site-immersif

```
/aycode:site-immersif [projet ou dossier] [produit, public, objectif, références]
```

Il se lance aussi tout seul quand tu demandes un site « effet waouh », une expérience 3D ou une animation au scroll.

1. Il fait l'état des lieux du projet et des skills spécialisés installés. Si tu donnes des sites de référence, il les analyse avec `pilote analyse` : bibliothèques, réglages du scroll, durées et courbes des animations, palette, polices, 3D et shaders, interactions, poids. Il filme chaque effet et t'écrit une fiche de procédés à transposer. Il en reprend les procédés, jamais le code, les images, les textes ni l'identité.
2. Il te propose trois concepts (sobre, audacieux, inattendu) avec leurs références. Tu choisis.
3. Il fixe la direction artistique (palette, typographie, matière, mouvement, son) et la carte des sections, en alternant tension et repos.
4. Il prototype seule l'interaction signature, l'effet phare, et tu l'essaies avant la suite.
5. Il pose les fondations : contenu réel, polices et chargement optimisés, version mouvement réduit.
6. Il construit section par section. Chaque section passe le contrôle avec `pilote` : il touche, glisse, fait défiler et parcourt au clavier, filme chaque geste en planche d'images et mesure la fluidité, la réaction et les décalages, sur téléphone simulé puis ordinateur. Il interrompt chaque animation en plein mouvement pour vérifier qu'elle repart sans saut. Il audite l'accessibilité (axe-core, contraste mesuré sur l'image réellement affichée, taille des cibles tactiles). Lighthouse mobile complète le contrôle.
7. Il ajoute une raison de revenir sur le site, puis te livre les mesures, les captures et les licences des ressources.

Tout est noté dans `immersif.md`, à la racine du projet, qui sert aussi de mémoire pour reprendre.

### Prérequis

- Node.js 20 ou plus
- Playwright dans le projet, pour `pilote` : `npm i -D playwright && npx playwright install chromium`
- axe-core dans le projet, pour l'audit d'accessibilité : `npm i -D axe-core`
- Optionnel : Google Chrome, pour analyser les sites de référence qui utilisent des vidéos MP4 (`--chrome`) ; le Chromium de test ne les lit pas

`pilote` (`skills/site-immersif/pilote/pilote.mjs`) garde un navigateur ouvert entre deux commandes et rend un retour compact : les éléments à l'écran avec une référence courte (`@e3 [button] "Commencer"`), ce qui apparaît et disparaît après chaque action, des planches d'images filmées pendant un geste et des mesures (fluidité, réaction, décalages, scripts trop lents). `--visible` ouvre une vraie fenêtre qui utilise ta carte graphique, pour des mesures 3D réalistes. `analyse <url>` relève la recette d'un site de référence. `node skills/site-immersif/pilote/pilote.mjs aide` liste les commandes.
- Recommandé : les skills spécialisés, que le skill te propose d'installer quand la techno choisie en a besoin. Ce sont les skills officiels [GSAP](https://github.com/greensock/gsap-skills) et [Motion](https://motion.dev/docs/ai-kit), et des skills communautaires pour Three.js, WebGPU et les shaders, dont la liste est dans [`references/techno.md`](skills/site-immersif/references/techno.md)

## Licence

[MIT](LICENSE).

Les polices Manrope de `skills/pub-video/demo/assets/fonts/` sont sous [SIL Open Font License 1.1](https://fonts.google.com/specimen/Manrope/license).
