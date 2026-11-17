#!/usr/bin/env bash
# Setup of the pub-video skill, run before each use, user level only (no sudo). A rerun is quick, and it
# points the command at this copy of the skill, which moves to a new folder on each plugin update:
#   1. shared Node dependencies (Playwright, GSAP) in ~/.local/share/pub-video
#   2. the headless Chromium that draws the frames (reused if already downloaded)
#   3. the `pub-video` command in ~/.local/bin
# System tools (ffmpeg, node) are only checked: `pub-video doctor` says how to install a missing one.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/pub-video"
BIN="$HOME/.local/bin"

command -v node >/dev/null || { echo "Node.js manque. Installe-le (version 20 ou plus) : https://nodejs.org ou « sudo apt install nodejs npm »."; exit 1; }
mkdir -p "$DATA" "$BIN"
cd "$DATA"
# Node dependencies only when runtime.package.json changed since the last successful install.
if ! cmp -s "$SKILL/cli/runtime.package.json" .installed-package.json; then
	cp "$SKILL/cli/runtime.package.json" package.json
	if command -v pnpm >/dev/null; then pnpm install --silent; else npm install --silent --no-audit --no-fund; fi
	cp "$SKILL/cli/runtime.package.json" .installed-package.json
fi
node node_modules/playwright/cli.js install chromium-headless-shell
chmod +x "$SKILL/cli/pubvideo.mjs"
ln -sfn "$SKILL/cli/pubvideo.mjs" "$BIN/pub-video"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Ajoute $BIN à ton PATH pour appeler « pub-video » directement." ;; esac
"$BIN/pub-video" doctor
