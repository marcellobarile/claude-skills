test_slug_basic_path() {
  local out
  out=$(mkdir -p /tmp/foo/src/proj && cd /tmp/foo/src/proj && "$BIN/slug.sh")
  # Slug should map / to -. With pwd -P, /tmp on macOS resolves to /private/tmp.
  case "$out" in
    -Users-foo-src-proj|-private-tmp-foo-src-proj|-tmp-foo-src-proj) ;;
    *) echo "unexpected slug '$out'"; return 1 ;;
  esac
}

test_slug_root() {
  local out
  out=$(cd / && "$BIN/slug.sh")
  assert_eq "$out" "-"
}

test_slug_tmp_marked() {
  local out
  out=$(cd /tmp && "$BIN/slug.sh")
  case "$out" in
    -tmp|-private-tmp) ;;
    *) echo "unexpected slug '$out'"; return 1 ;;
  esac
}

test_slug_with_spaces() {
  local tmpdir="/tmp/dbgdec test with spaces"
  trap "rmdir '$tmpdir' 2>/dev/null || true" RETURN
  mkdir -p "$tmpdir"
  local out
  out=$(cd "$tmpdir" && "$BIN/slug.sh")
  case "$out" in
    "-private-tmp-dbgdec test with spaces"|"-tmp-dbgdec test with spaces") ;;
    *) echo "unexpected slug '$out'"; return 1 ;;
  esac
}
