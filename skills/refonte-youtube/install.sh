#!/usr/bin/env bash
# Setup of the refonte-youtube skill, run before each use, user level only (no sudo): points the
# `refonte-youtube` command in ~/.local/bin at this copy of the skill, which moves to a new folder on each
# plugin update. No Node packages to install. The skills it builds on (montage-youtube, pub-video,
# video-verticale) are set up too when they sit next to it (the aycode plugin); otherwise
# `refonte-youtube doctor` says how to get them.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"

command -v node >/dev/null || { echo "Node.js manque. Installe-le (version 20 ou plus) : https://nodejs.org ou « sudo apt install nodejs »."; exit 1; }
mkdir -p "$BIN"
chmod +x "$SKILL/cli/refonte-youtube.mjs"
ln -sfn "$SKILL/cli/refonte-youtube.mjs" "$BIN/refonte-youtube"
# video-verticale's install.sh also sets up montage-youtube and pub-video. A missing tool is reported, not fatal.
if [ -f "$SKILL/../video-verticale/install.sh" ]; then bash "$SKILL/../video-verticale/install.sh" || true; fi
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Ajoute $BIN à ton PATH pour appeler « refonte-youtube » directement." ;; esac
"$BIN/refonte-youtube" doctor
