#!/usr/bin/env bash
# Setup of the video-verticale skill, run before each use, user level only (no sudo): points the
# `video-verticale` command in ~/.local/bin at this copy of the skill, which moves to a new folder on each
# plugin update. No Node packages to install. The montage-youtube and pub-video skills it builds on are set
# up too when they sit next to it (the aycode plugin); otherwise `video-verticale doctor` says how to get them.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"

command -v node >/dev/null || { echo "Node.js manque. Installe-le (version 20 ou plus) : https://nodejs.org ou « sudo apt install nodejs »."; exit 1; }
mkdir -p "$BIN"
chmod +x "$SKILL/cli/video-verticale.mjs"
ln -sfn "$SKILL/cli/video-verticale.mjs" "$BIN/video-verticale"
# Siblings: their install.sh points their commands at the same version. A missing tool is reported, not fatal.
for s in montage-youtube pub-video; do
	if [ -f "$SKILL/../$s/install.sh" ]; then bash "$SKILL/../$s/install.sh" || true; fi
done
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Ajoute $BIN à ton PATH pour appeler « video-verticale » directement." ;; esac
"$BIN/video-verticale" doctor
