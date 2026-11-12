# aycode-skill

Mes skills pour agents de code (Claude Code aujourd'hui, Codex ensuite).

Chaque skill vit dans son propre dossier sous `skills/<nom>/`, avec un `SKILL.md` à sa racine. Cette disposition est celle qu'attendent les plugins Claude Code et Codex : le dépôt pourra devenir un plugin sans déplacer de fichier.

## Skills

| Skill | Ce qu'il fait |
|---|---|
| [`pub-video`](skills/pub-video/SKILL.md) | Fabrique une pub vidéo en motion design pour un produit, à partir de son URL ou de son code : concept, storyboard, voix off, musique libre calée au temps près, bruitages, rendu `.mp4`. |

## Installer un skill dans Claude Code

```bash
git clone https://github.com/AyenaCode/aycode-skill.git
mkdir -p ~/.claude/skills
cp -r aycode-skill/skills/pub-video ~/.claude/skills/
```

Le skill est ensuite disponible dans Claude Code sous `/pub-video`.

### Prérequis de `pub-video`

- Node.js 20 ou plus
- FFmpeg (avec ffprobe)
- Optionnels : `yt-dlp` (télécharger une vidéo de référence), `whisper.cpp` (transcrire une référence, caler la voix off)

Au premier usage, le skill lance son installation (`install.sh`, sans sudo) : dépendances Node partagées, Chromium sans écran, et la commande `pub-video` dans `~/.local/bin`. `pub-video doctor` vérifie que tout est en place.

## À venir

- Plugin Claude Code
- Plugin Codex
- D'autres skills
