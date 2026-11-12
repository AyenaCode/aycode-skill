# aycode-skill

Skills pour Claude Code. Chaque skill a son propre dossier dans `skills/`.

## Skills

| Skill | Rôle |
|---|---|
| [`pub-video`](skills/pub-video/SKILL.md) | Fabrique une pub vidéo en motion design pour un produit, à partir de son URL ou de son code. Le skill écrit le concept, le storyboard et la voix off, puis cale une musique libre au temps près, pose les bruitages et exporte le `.mp4`. |

## Installation

```bash
git clone https://github.com/AyenaCode/aycode-skill.git
mkdir -p ~/.claude/skills
cp -r aycode-skill/skills/pub-video ~/.claude/skills/
```

Le skill s'appelle ensuite avec `/pub-video` dans Claude Code.

## pub-video

### Prérequis

- Node.js 20 ou plus
- FFmpeg, avec ffprobe
- Optionnel : `yt-dlp`, pour télécharger une vidéo de référence
- Optionnel : `whisper.cpp`, pour transcrire une référence et caler la voix off

Au premier usage, le skill lance `install.sh`, sans sudo. Ce script installe les dépendances Node, un Chromium sans écran et la commande `pub-video` dans `~/.local/bin`. Ensuite, `pub-video doctor` vérifie que tout est en place.

## Licence

[MIT](LICENSE).

Les polices Manrope de `skills/pub-video/demo/assets/fonts/` sont sous [SIL Open Font License 1.1](https://fonts.google.com/specimen/Manrope/license).
