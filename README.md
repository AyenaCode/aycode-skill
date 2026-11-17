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

`/aycode:planner <la tâche>` s'arrête après le plan. Pour reprendre une tâche interrompue : `/aycode:ship .local/plans/<tâche>.plan.md`.

Les règles du projet (`CLAUDE.md`, `AGENTS.md`) passent avant celles des skills. Les commandes de vérification (tests, lint, build) sont trouvées dans le projet.

## pub-video

### Prérequis

- Node.js 20 ou plus
- FFmpeg, avec ffprobe
- Optionnel : `yt-dlp`, pour télécharger une vidéo de référence
- Optionnel : `whisper.cpp`, pour transcrire une référence et caler la voix off

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

## Licence

[MIT](LICENSE).

Les polices Manrope de `skills/pub-video/demo/assets/fonts/` sont sous [SIL Open Font License 1.1](https://fonts.google.com/specimen/Manrope/license).
