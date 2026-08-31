#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Mahjong Live requires Node.js 20 or newer."
  echo "Install Node.js, then run: sh start-game.sh"
  exit 1
fi

node scripts/start.mjs
