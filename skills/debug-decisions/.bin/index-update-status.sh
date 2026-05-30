#!/usr/bin/env bash
# Update the status column for a specific id in INDEX.md.
# Preserves the ⚠ critical marker if it was present.
# Exits non-zero if the id is not found.
#
# Usage: index-update-status.sh <slug> <id> <new-status>
set -euo pipefail

slug="${1:?slug required}"
id="${2:?id required}"
new_status="${3:?new status required}"

ROOT="${DEBUG_DECISIONS_ROOT:-$HOME/.claude/debug-decisions}"
INDEX="$ROOT/$slug/INDEX.md"

if [[ ! -f "$INDEX" ]]; then
  echo "INDEX not found: $INDEX" >&2
  exit 1
fi

if ! grep -qE "^\| $id " "$INDEX"; then
  echo "id not found in INDEX: $id" >&2
  exit 2
fi

tmp=$(mktemp)
awk -v id="$id" -v new="$new_status" '
  $0 ~ "^\\| " id " " {
    n = split($0, parts, " \\| ")
    # After splitting by " | ":
    #   parts[1] = "| <id>"
    #   parts[2] = "<date>"
    #   parts[3] = "<status>"   ← column to update
    #   parts[4] = "<tags>"
    #   parts[5] = "<title> |"
    if (parts[3] ~ /^⚠ /) {
      parts[3] = "⚠ " new
    } else {
      parts[3] = new
    }
    line = parts[1]
    for (i=2; i<=n; i++) line = line " | " parts[i]
    print line
    next
  }
  { print }
' "$INDEX" > "$tmp"
mv "$tmp" "$INDEX"
