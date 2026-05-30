#!/usr/bin/env bash
# Return short git SHA of HEAD, or the literal string "null" if not in a repo
# or repo has no commits.
set -u

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  sha=$(git rev-parse --short HEAD 2>/dev/null) || { echo "null"; exit 0; }
  echo "$sha"
else
  echo "null"
fi
