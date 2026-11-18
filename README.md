# aycode-skill

Skills pour les agents de code, livrés en plugin Claude Code. Chaque skill a son propre dossier dans `skills/`.

## Skills

| Skill | Rôle |
|---|---|
| [`ship`](skills/ship/SKILL.md) | Mène une tâche de code de bout en bout. Il fait valider le plan au dev, puis enchaîne les étapes : coder, vérifier, commiter. Il simplifie ensuite tout le changement, le fait contrôler par un vérificateur indépendant et écrit un rapport dans la langue du dev. |
| [`planner`](skills/planner/SKILL.md) | Planifie une tâche de code sans l'écrire. Il écrit un résumé court dans la langue du dev, que le dev peut modifier, et un plan détaillé que `ship` exécute. |
| [`pub-video`](skills/pub-video/SKILL.md) | Fabrique une pub vidéo en motion design pour un produit, à partir de son URL ou de son code. Le skill écrit le concept, le storyboard et la voix off, puis cale une musique libre au temps près, pose les bruitages et exporte le `.mp4`. |
| [`pentester`](skills/pentester/SKILL.md) | Relit le code en pensant comme un attaquant, sans rien attaquer. Couvre le mobile (React Native), les API, le web et l'infra (Docker, Kubernetes, CI). Il écrit un rapport Markdown simple, avec la gravité et le correctif de chaque faille. |
| [`montage-youtube`](skills/montage-youtube/SKILL.md) | Monte une vidéo YouTube à partir de rushs enregistrés, face caméra ou capture d'écran commentée. Il coupe les silences, les hésitations et les reprises, nettoie la voix, puis exporte le `.mp4` et ses sous-titres `.srt`. Une vidéo de référence peut fixer le rythme. |
| [`video-verticale`](skills/video-verticale/SKILL.md) | Fabrique une vidéo verticale pour Reels, TikTok et Shorts, à partir d'un sujet (motion design) ou d'un enregistrement vertical. Il dérushe, incruste des sous-titres animés mot à mot, ajoute un titre d'accroche, des zooms sur les coupes, une musique baissée sous la voix et des bruitages, puis exporte le `.mp4` et sa couverture. |
| [`refonte-youtube`](skills/refonte-youtube/SKILL.md) | Refait une ancienne vidéo YouTube en version pro et animée. Il transcrit l'ancienne vidéo et réécrit un script plus accrocheur. Il le fait dire par ta voix clonée (voicebox), redécoupe les images sur cette voix, incruste les mots forts et ajoute des séquences en motion design, une musique libre et des bruitages. Il exporte ensuite le `.mp4`, ses sous-titres `.srt` et ses chapitres YouTube. |
| [`publish`](skills/publish/SKILL.md) | Produit les vidéos verticales du jour (3 par défaut). Il cherche les sujets qui ont de la demande, fait fabriquer chaque vidéo par `video-verticale` et `pub-video`, génère la voix off avec ta voix clonée (voicebox) ou te donne les textes à enregistrer, contrôle le tout et livre les vidéos avec leur légende. |

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
- Optionnel : [voicebox](https://github.com/jamiepine/voicebox), pour générer la voix off avec une voix clonée (`pub-video voice synth`)

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
/aycode:publish finir
```

Lance-le depuis ton atelier vidéo, le dossier où vivent tes projets. Il y crée `publish/` : ta ligne éditoriale (`ligne.md`, remplie au premier lancement), le journal des vidéos déjà faites et une page par journée, qui sert aussi de mémoire pour reprendre.

1. Il cherche des sujets qui ont de la demande, dans trois créneaux : une actu de la semaine, une astuce durable et ton domaine d'expertise. Chaque fait vient d'une source primaire, avec sa date.
2. Il fait fabriquer chaque vidéo par `video-verticale` et `pub-video`, l'une après l'autre, chacune par un sous-agent.
3. La voix off :
   - **automatique** si [voicebox](https://github.com/jamiepine/voicebox) tourne sur ta machine et que le profil de ta voix clonée est noté dans `ligne.md` : les vidéos sortent finies ;
   - **manuelle** sinon : il te donne les textes, réplique par réplique, et le dossier où déposer tes fichiers (enregistrés ou générés ailleurs). Ensuite, `/aycode:publish finir` termine les vidéos.
4. Il contrôle chaque vidéo, puis te livre les fichiers, leur couverture, une légende prête à coller et les sources.

Il ne publie rien : la publication reste à toi.

### Prérequis

- Les skills `video-verticale`, `pub-video` et `montage-youtube`, fournis avec le plugin
- Optionnel : voicebox, avec un profil créé une fois à partir d'un enregistrement de ta voix. Sur Linux, il n'y a pas encore de version prête à installer : compile-le, ou lance son `docker-compose.yml` (adresse `http://127.0.0.1:17600`). `pub-video voice profils` dit si la commande le trouve.

## Licence

[MIT](LICENSE).

Les polices Manrope de `skills/pub-video/demo/assets/fonts/` sont sous [SIL Open Font License 1.1](https://fonts.google.com/specimen/Manrope/license).
