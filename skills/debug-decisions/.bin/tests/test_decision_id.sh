test_id_format() {
  local out
  out=$("$BIN/decision-id.sh" "Use hooks instead of skill for X")
  if [[ ! "$out" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}-[a-z0-9-]+$ ]]; then
    echo "bad format: '$out'"
    return 1
  fi
}

test_id_kebab_lowercase_alnum() {
  local out kebab
  out=$("$BIN/decision-id.sh" "Use Hooks Instead Of Skill")
  kebab=$(echo "$out" | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}-//')
  if [[ ! "$kebab" =~ ^[a-z0-9-]+$ ]]; then
    echo "kebab portion has bad chars: '$kebab'"
    return 1
  fi
}

test_id_slug_max_5_segments() {
  local out kebab segments
  out=$("$BIN/decision-id.sh" "one two three four five six seven eight nine")
  kebab=$(echo "$out" | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}-//')
  segments=$(echo "$kebab" | tr '-' '\n' | wc -l | tr -d ' ')
  if [[ "$segments" -gt 5 ]]; then
    echo "expected <=5 segments, got $segments ($kebab)"
    return 1
  fi
}

test_id_strips_stopwords() {
  local out kebab
  out=$("$BIN/decision-id.sh" "the use of hooks for the X")
  kebab=$(echo "$out" | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}-//')
  if echo "$kebab" | grep -qE '(^|-)(the|of|for)(-|$)'; then
    echo "stopword leaked: '$kebab'"
    return 1
  fi
}

test_id_empty_input_fails() {
  if "$BIN/decision-id.sh" "" 2>/dev/null; then
    echo "expected non-zero exit on empty input"
    return 1
  fi
}

test_id_all_stopwords_becomes_untitled() {
  local out kebab
  out=$("$BIN/decision-id.sh" "the a an of for to in on at")
  kebab=$(echo "$out" | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}-//')
  if [[ "$kebab" != "untitled" ]]; then
    echo "expected 'untitled', got '$kebab'"
    return 1
  fi
}
