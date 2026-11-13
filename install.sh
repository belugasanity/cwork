#!/bin/sh
set -eu

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'cwork needs Node.js 22+ with npm. Install Node.js, then rerun this installer.' >&2
  exit 1
fi
project_dir=$(CDPATH= cd -P "$(dirname "$0")" && pwd)
exec node "$project_dir/scripts/install.mjs" "$@"
