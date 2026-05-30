test_ensure_creates_dir() {
  local root slug
  root=$(mktemp -d)
  slug="-test-slug-foo"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/ensure-project-dir.sh" "$slug" >/dev/null
  [[ -d "$root/$slug" ]] || { echo "dir not created"; rm -rf "$root"; return 1; }
  [[ -f "$root/$slug/INDEX.md" ]] || { echo "INDEX.md not created"; rm -rf "$root"; return 1; }
  rm -rf "$root"
}

test_ensure_idempotent() {
  local root slug
  root=$(mktemp -d)
  slug="-foo"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/ensure-project-dir.sh" "$slug" >/dev/null
  echo "extra row" >> "$root/$slug/INDEX.md"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/ensure-project-dir.sh" "$slug" >/dev/null
  if ! grep -q "extra row" "$root/$slug/INDEX.md"; then
    echo "INDEX clobbered"
    rm -rf "$root"
    return 1
  fi
  rm -rf "$root"
}

test_ensure_substitutes_placeholder_from_schema() {
  local root slug
  root=$(mktemp -d)
  slug="-some-project"
  mkdir -p "$root/.schema"
  cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md "$root/.schema/"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/ensure-project-dir.sh" "$slug" >/dev/null
  if ! grep -qF -- "$slug" "$root/$slug/INDEX.md"; then
    echo "placeholder not substituted"
    rm -rf "$root"
    return 1
  fi
  if grep -q "{{PROJECT_SLUG}}" "$root/$slug/INDEX.md"; then
    echo "placeholder leaked"
    rm -rf "$root"
    return 1
  fi
  rm -rf "$root"
}

test_ensure_inline_fallback_when_no_schema() {
  local root slug
  root=$(mktemp -d)
  slug="-fallback"
  DEBUG_DECISIONS_ROOT="$root" "$BIN/ensure-project-dir.sh" "$slug" >/dev/null
  if ! grep -q "^# Decisions" "$root/$slug/INDEX.md"; then
    echo "inline fallback did not produce header"
    rm -rf "$root"
    return 1
  fi
  if ! grep -qF -- "$slug" "$root/$slug/INDEX.md"; then
    echo "inline fallback did not include slug"
    rm -rf "$root"
    return 1
  fi
  rm -rf "$root"
}

test_ensure_missing_slug_arg_fails() {
  if "$BIN/ensure-project-dir.sh" 2>/dev/null; then
    echo "expected non-zero exit on missing slug"
    return 1
  fi
}
