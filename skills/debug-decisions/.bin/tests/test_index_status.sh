#!/usr/bin/env bash
# Tests for index-update-status.sh

setup_index_with_row() {
  local root="$1" slug="$2" id="$3" status="$4" tags="${5:-tag}"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/ensure-project-dir.sh "$slug" >/dev/null
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/index-append.sh \
    "$slug" "$id" "2026-05-25" "$status" "$tags" "Title"
}

test_status_update_basic() {
  local root="$(mktemp -d)" slug="-x"
  setup_index_with_row "$root" "$slug" "id-1" "active"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-update-status.sh" "$slug" "id-1" "reverted:2026-05-26"
  if ! grep -qE "^\| id-1 .* \| reverted:2026-05-26 " "$root/$slug/INDEX.md"; then
    echo "status not updated"; cat "$root/$slug/INDEX.md"; rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_status_update_preserves_critical_marker() {
  local root="$(mktemp -d)" slug="-x"
  setup_index_with_row "$root" "$slug" "id-c" "active" "critical"
  # After append with tag "critical": status should be "⚠ active" in the row
  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-update-status.sh" "$slug" "id-c" "reverted:2026-05-26"
  if ! grep -qE '^\| id-c .* \| ⚠ reverted:2026-05-26 ' "$root/$slug/INDEX.md"; then
    echo "critical marker lost"; cat "$root/$slug/INDEX.md"; rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_status_update_id_not_found() {
  local root="$(mktemp -d)" slug="-x"
  setup_index_with_row "$root" "$slug" "id-1" "active"
  if DEBUG_DECISIONS_ROOT="$root" "$BIN/index-update-status.sh" "$slug" "id-missing" "reverted" 2>/dev/null; then
    echo "expected failure on missing id"; rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}

test_status_update_only_target_row() {
  # Multiple rows; updating one must not touch others.
  local root="$(mktemp -d)" slug="-x"
  setup_index_with_row "$root" "$slug" "id-1" "active"
  DEBUG_DECISIONS_ROOT="$root" ~/.claude/debug-decisions/.bin/index-append.sh \
    "$slug" "id-2" "2026-05-25" "active" "tag" "Other title"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/index-update-status.sh" "$slug" "id-1" "reverted:2026-05-26"
  if ! grep -qE "^\| id-2 .* \| active " "$root/$slug/INDEX.md"; then
    echo "id-2 row was changed"; cat "$root/$slug/INDEX.md"; rm -rf "$root"; return 1
  fi
  rm -rf "$root"
}
