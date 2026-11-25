#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "[FAIL] 未找到 Node.js，请先安装 Node.js >= 22.4.0: https://nodejs.org/" >&2
  exit 1
fi
exec node "$SCRIPT_DIR/scripts/suite.js" install "$@"
