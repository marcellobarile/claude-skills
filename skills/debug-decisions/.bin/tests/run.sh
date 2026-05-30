#!/usr/bin/env bash
# Minimal test runner. Each test is a function `test_<name>` that exits non-zero on fail.
set -u

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
FAILED_TESTS=()

run() {
  local name="$1"
  if "$name" >/tmp/dbgdec-test.out 2>&1; then
    echo "  ok  $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL $name"
    cat /tmp/dbgdec-test.out
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$name")
  fi
}

assert_eq() {
  local actual="$1" expected="$2" msg="${3:-assertion failed}"
  if [[ "$actual" != "$expected" ]]; then
    echo "$msg: expected '$expected', got '$actual'" >&2
    return 1
  fi
}

for f in "$@"; do
  # shellcheck disable=SC1090
  source "$f"
done

for fn in $(declare -F | awk '{print $3}' | grep '^test_'); do
  run "$fn"
done

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
