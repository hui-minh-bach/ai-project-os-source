#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Cần Node.js 22+"; exit 1; fi
MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$MAJOR" -lt 22 ]; then echo "Cần Node.js 22+. Đang dùng Node $MAJOR"; exit 1; fi
exec node src/launcher.mjs
