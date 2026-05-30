test_git_sha_in_repo() {
  local tmp out
  tmp=$(mktemp -d)
  (cd "$tmp" && git init -q && git -c user.email=t@t -c user.name=t commit --allow-empty -q -m "x")
  out=$(cd "$tmp" && "$BIN/git-sha.sh")
  if [[ ! "$out" =~ ^[0-9a-f]{7,}$ ]]; then
    echo "expected short SHA, got '$out'"
    rm -rf "$tmp"
    return 1
  fi
  rm -rf "$tmp"
}

test_git_sha_not_in_repo() {
  local tmp out
  tmp=$(mktemp -d)
  out=$(cd "$tmp" && "$BIN/git-sha.sh")
  rm -rf "$tmp"
  if [[ "$out" != "null" ]]; then
    echo "expected 'null', got '$out'"
    return 1
  fi
}

test_git_sha_no_commits() {
  local tmp out
  tmp=$(mktemp -d)
  (cd "$tmp" && git init -q)
  out=$(cd "$tmp" && "$BIN/git-sha.sh")
  rm -rf "$tmp"
  if [[ "$out" != "null" ]]; then
    echo "expected 'null', got '$out'"
    return 1
  fi
}
