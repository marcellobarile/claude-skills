#!/usr/bin/env bash
# Append a row to <slug>/INDEX.md, immediately after the table header separator.
# Truncates title to keep total line length <= 140 chars.
# Adds "⚠ " prefix to status if tags contain "critical".
#
# Usage: index-append.sh <slug> <id> <date> <status> <tags-csv> <title>
# Env: DEBUG_DECISIONS_ROOT
set -euo pipefail

slug="${1:?slug required}"
id="${2:?id required}"
date="${3:?date required}"
status="${4:?status required}"
tags="${5:-}"
title="${6:-}"

ROOT="${DEBUG_DECISIONS_ROOT:-$HOME/.claude/debug-decisions}"
INDEX="$ROOT/$slug/INDEX.md"

if [[ ! -f "$INDEX" ]]; then
  echo "INDEX not found: $INDEX" >&2
  exit 1
fi

# Add critical marker if applicable
if [[ ",$tags," == *",critical,"* ]]; then
  status="⚠ $status"
fi

# Compose row prefix/suffix and compute byte budget via Python3.
# macOS awk counts bytes (not chars), so we keep byte length <= 140
# to satisfy both the spec and the test measurement.
prefix="| $id | $date | $status | $tags | "
suffix=" |"

title=$(python3 -c "
import sys
prefix = sys.argv[1]
suffix = sys.argv[2]
title = sys.argv[3]
ellipsis = '…'
total_bytes = 140
used_bytes = len(prefix.encode('utf-8')) + len(suffix.encode('utf-8'))
budget_bytes = max(total_bytes - used_bytes, 5)
title_bytes = len(title.encode('utf-8'))
if title_bytes > budget_bytes:
    # Trim chars from the right until encoded length fits budget-3 (room for ellipsis)
    ellipsis_bytes = len(ellipsis.encode('utf-8'))
    max_content_bytes = budget_bytes - ellipsis_bytes
    while len(title.encode('utf-8')) > max_content_bytes and title:
        title = title[:-1]
    title = title + ellipsis
print(title, end='')
" "$prefix" "$suffix" "$title")

row="${prefix}${title}${suffix}"

# Insert immediately after the table separator line "|---..." (first such match only)
tmp=$(mktemp)
awk -v row="$row" '
  /^\|---/ && !inserted { print; print row; inserted=1; next }
  { print }
' "$INDEX" > "$tmp"
mv "$tmp" "$INDEX"
