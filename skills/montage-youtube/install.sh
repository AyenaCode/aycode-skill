#!/usr/bin/env bash
# Setup of the montage-youtube skill, run before each use, user level only (no sudo): points the
# `montage-youtube` command in ~/.local/bin at this copy of the skill, which moves to a new folder on each
# plugin update. No Node packages to install. System tools (ffmpeg, whisper.cpp) are only
# checked: `montage-youtube doctor` says how to install a missing one.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"

command -v node >/dev/null || { echo "Node.js manque. Installe-le (version 20 ou plus) : https://nodejs.org ou « sudo apt install nodejs »."; exit 1; }
mkdir -p "$BIN"
chmod +x "$SKILL/cli/montage-youtube.mjs"
ln -sfn "$SKILL/cli/montage-youtube.mjs" "$BIN/montage-youtube"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Ajoute $BIN à ton PATH pour appeler « montage-youtube » directement." ;; esac
"$BIN/montage-youtube" doctor
