#!/usr/bin/env bash
# Ensure ~/.claude/debug-decisions/<slug>/ exists with INDEX.md bootstrapped.
# Idempotent: leaves existing INDEX untouched if present.
# Usage: ensure-project-dir.sh <slug>
# Env: DEBUG_DECISIONS_ROOT (default ~/.claude/debug-decisions) — for tests.
set -euo pipefail

slug="${1:-}"
if [[ -z "$slug" ]]; then
  echo "Usage: ensure-project-dir.sh <slug>" >&2
  exit 1
fi

ROOT="${DEBUG_DECISIONS_ROOT:-$HOME/.claude/debug-decisions}"
SCHEMA="$ROOT/.schema/INDEX-skeleton.md"

mkdir -p "$ROOT/$slug"

if [[ ! -f "$ROOT/$slug/INDEX.md" ]]; then
  if [[ -f "$SCHEMA" ]]; then
    sed "s|{{PROJECT_SLUG}}|$slug|g" "$SCHEMA" > "$ROOT/$slug/INDEX.md"
  else
    cat > "$ROOT/$slug/INDEX.md" <<EOF
# Decisions — $slug

| ID | Date | Status | Tags | Title |
|----|------|--------|------|-------|
EOF
  fi
fi

echo "$ROOT/$slug"
