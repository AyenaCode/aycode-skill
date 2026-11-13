#!/usr/bin/env bash
# One-time setup of the video-verticale skill, user level only (no sudo): puts the `video-verticale`
# command in ~/.local/bin. No Node packages to install. The montage-youtube and pub-video skills it builds
# on are only checked: `video-verticale doctor` says how to install a missing one.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"

command -v node >/dev/null || { echo "Node.js manque. Installe-le (version 20 ou plus) : https://nodejs.org ou « sudo apt install nodejs »."; exit 1; }
mkdir -p "$BIN"
chmod +x "$SKILL/cli/video-verticale.mjs"
ln -sfn "$SKILL/cli/video-verticale.mjs" "$BIN/video-verticale"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Ajoute $BIN à ton PATH pour appeler « video-verticale » directement." ;; esac
"$BIN/video-verticale" doctor
