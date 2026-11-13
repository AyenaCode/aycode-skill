# aycode-skill

Skills pour Claude Code. Chaque skill a son propre dossier dans `skills/`.

## Skills

| Skill | Rôle |
|---|---|
| [`pub-video`](skills/pub-video/SKILL.md) | Fabrique une pub vidéo en motion design pour un produit, à partir de son URL ou de son code. Le skill écrit le concept, le storyboard et la voix off, puis cale une musique libre au temps près, pose les bruitages et exporte le `.mp4`. |
| [`pentester`](skills/pentester/SKILL.md) | Relit le code en pensant comme un attaquant, sans rien attaquer. Couvre le mobile (React Native), les API, le web et l'infra (Docker, Kubernetes, CI). Il écrit un rapport Markdown simple, avec la gravité et le correctif de chaque faille. |
| [`montage-youtube`](skills/montage-youtube/SKILL.md) | Monte une vidéo YouTube à partir de rushs enregistrés, face caméra ou capture d'écran commentée. Il coupe les silences, les hésitations et les reprises, nettoie la voix, puis exporte le `.mp4` et ses sous-titres `.srt`. Une vidéo de référence peut fixer le rythme. |
| [`video-verticale`](skills/video-verticale/SKILL.md) | Fabrique une vidéo verticale pour Reels, TikTok et Shorts, à partir d'un sujet (motion design) ou d'un enregistrement vertical. Il dérushe, incruste des sous-titres animés mot à mot, ajoute un titre d'accroche, des zooms sur les coupes, une musique baissée sous la voix et des bruitages, puis exporte le `.mp4` et sa couverture. |

## Installation

```bash
git clone https://github.com/AyenaCode/aycode-skill.git
mkdir -p ~/.claude/skills
cp -r aycode-skill/skills/<skill> ~/.claude/skills/
```

Remplace `<skill>` par le nom du skill, par exemple `pentester`. Il s'appelle ensuite avec `/<skill>` dans Claude Code.

## pub-video

### Prérequis

- Node.js 20 ou plus
- FFmpeg, avec ffprobe
- Optionnel : `yt-dlp`, pour télécharger une vidéo de référence
- Optionnel : `whisper.cpp`, pour transcrire une référence et caler la voix off

Au premier usage, le skill lance `install.sh`, sans sudo. Ce script installe les dépendances Node, un Chromium sans écran et la commande `pub-video` dans `~/.local/bin`. Ensuite, `pub-video doctor` vérifie que tout est en place.

## montage-youtube

### Prérequis

- Node.js 20 ou plus
- FFmpeg, avec ffprobe
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) et un modèle (`large-v3-turbo` conseillé, `small` suffit pour commencer)
- Optionnel : `yt-dlp`, pour mesurer une vidéo de référence en ligne

Au premier usage, le skill lance `install.sh`, sans sudo. Ce script met la commande `montage-youtube` dans `~/.local/bin`. Ensuite, `montage-youtube doctor` vérifie que tout est en place. Si whisper.cpp n'est pas dans `~/whisper.cpp`, indique son chemin avec les variables `WHISPER_CLI` et `WHISPER_MODEL`.

## video-verticale

### Prérequis

- Les skills `montage-youtube` et `pub-video`, installés : il reprend leur montage, leur transcription, leur musique, leurs bruitages et leur mixage
- FFmpeg avec libass (sous-titres incrustés), comme celui des paquets Ubuntu ou Homebrew

Au premier usage, le skill lance `install.sh`, sans sudo. Ce script met la commande `video-verticale` dans `~/.local/bin`. Ensuite, `video-verticale doctor` vérifie que tout est en place, skills frères compris. La police des sous-titres (Montserrat Black par défaut) se télécharge depuis Google Fonts dans chaque projet.

## Licence

[MIT](LICENSE).

Les polices Manrope de `skills/pub-video/demo/assets/fonts/` sont sous [SIL Open Font License 1.1](https://fonts.google.com/specimen/Manrope/license).
