#!/usr/bin/env bash
# Generate decision id: YYYY-MM-DD-HHMM-<kebab-slug>
# kebab slug: lowercase, alphanum + hyphen, max 5 words, stopwords filtered.
# Usage: decision-id.sh "<free-text description>"
set -euo pipefail

input="${1:-}"
if [[ -z "$input" ]]; then
  echo "Usage: decision-id.sh <description>" >&2
  exit 1
fi

ts=$(date +"%Y-%m-%d-%H%M")

# Stopword list (common short words)
stopwords='^(the|a|an|of|for|to|in|on|at|is|are|and|or|but|with|by|as|use|using)$'

# Tokenize: lowercase, replace non-alphanum with space, split, filter stopwords, take first 5
kebab=$(echo "$input" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -c 'a-z0-9' ' ' \
  | tr -s ' ' '\n' \
  | { grep -vE "$stopwords" || true; } \
  | { grep -v '^$' || true; } \
  | head -n 5 \
  | tr '\n' '-' \
  | sed 's/-$//')

if [[ -z "$kebab" ]]; then
  kebab="untitled"
fi

echo "${ts}-${kebab}"
