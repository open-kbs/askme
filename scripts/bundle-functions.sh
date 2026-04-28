#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARED="$ROOT/functions/_shared"
ENV_FILE="$ROOT/.env.local"
FN_DIRS=("$ROOT/functions/api" "$ROOT/functions/api-cleanup")

gen_env() {
  local out="$1/_env.mjs"
  echo "// Auto-generated from .env.local — do not edit" > "$out"
  if [[ -f "$ENV_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      key="${line%%=*}"
      value="${line#*=}"
      echo "process.env.${key} = ${value@Q};" >> "$out"
    done < "$ENV_FILE"
  fi
}

for fn in "${FN_DIRS[@]}"; do
  echo "Bundling $(basename "$fn")..."

  rm -rf "$fn/_shared"
  cp -r "$SHARED" "$fn/_shared"

  cp "$ROOT/config.json" "$fn/_shared/config.json"
  cp "$ROOT/assets/career.json" "$fn/_shared/career.json"

  gen_env "$fn"
done

echo "Bundle complete."
