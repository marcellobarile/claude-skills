#!/usr/bin/env bash
# Tests for index-append.sh

test_append_basic() {
  local root slug index
  root=$(mktemp -d)
  slug="-x"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/ensure-project-dir.sh "$slug" >/dev/null

  index="$root/$slug/INDEX.md"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" \
    "$slug" "2026-05-25-1430-foo" "2026-05-25" "active" "hooks,arch" "Title here"

  local row
  row=$(grep -E "^\| 2026-05-25-1430-foo " "$index" || true)
  if [[ -z "$row" ]]; then
    echo "row not found in:"; cat "$index"
    rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_append_critical_prefix() {
  local root slug
  root=$(mktemp -d)
  slug="-x"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/ensure-project-dir.sh "$slug" >/dev/null

  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" \
    "$slug" "id1" "2026-05-25" "active" "critical,db" "title"

  if ! grep -qE '^\| id1 .* \| ⚠ active ' "$root/$slug/INDEX.md"; then
    echo "critical marker missing"
    cat "$root/$slug/INDEX.md"
    rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_append_truncates_long_title() {
  local root slug long
  root=$(mktemp -d)
  slug="-x"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/ensure-project-dir.sh "$slug" >/dev/null

  long=$(printf 'X%.0s' {1..300})
  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" \
    "$slug" "id1" "2026-05-25" "active" "x" "$long"

  local line
  line=$(grep "^| id1 " "$root/$slug/INDEX.md")
  # Use awk to count characters (Unicode-aware); fallback to byte count
  local char_count
  if command -v awk >/dev/null 2>&1; then
    char_count=$(printf '%s' "$line" | awk '{print length($0)}')
  else
    char_count=${#line}
  fi
  if [[ $char_count -gt 140 ]]; then
    echo "line too long: $char_count chars (max 140)"
    echo "$line"
    rm -rf "$root"; return 1
  fi
  if [[ "$line" != *"…"* ]]; then
    echo "no ellipsis marker; line: $line"
    rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_append_short_title_not_truncated() {
  local root slug
  root=$(mktemp -d)
  slug="-x"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/ensure-project-dir.sh "$slug" >/dev/null

  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" \
    "$slug" "id1" "2026-05-25" "active" "x" "Short title"

  if ! grep -qE '^\| id1 .* Short title \|$' "$root/$slug/INDEX.md"; then
    echo "short title was modified"
    cat "$root/$slug/INDEX.md"
    rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_append_inserts_newest_on_top() {
  local root slug
  root=$(mktemp -d)
  slug="-x"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/ensure-project-dir.sh "$slug" >/dev/null

  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" "$slug" "id-first" "2026-05-24" "active" "x" "first"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" "$slug" "id-second" "2026-05-25" "active" "x" "second"

  local lineno_first lineno_second
  lineno_first=$(grep -n "^| id-first " "$root/$slug/INDEX.md" | cut -d: -f1)
  lineno_second=$(grep -n "^| id-second " "$root/$slug/INDEX.md" | cut -d: -f1)
  if [[ "$lineno_second" -ge "$lineno_first" ]]; then
    echo "ordering wrong: second=$lineno_second first=$lineno_first"
    cat "$root/$slug/INDEX.md"
    rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_append_missing_index_fails() {
  local root slug
  root=$(mktemp -d)
  slug="-noindex"
  mkdir -p "$root/$slug"
  if DEBUG_DECISIONS_ROOT="$root" "$BIN/index-append.sh" "$slug" "id1" "2026-05-25" "active" "x" "title" 2>/dev/null; then
    echo "expected non-zero exit when INDEX missing"
    rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}
