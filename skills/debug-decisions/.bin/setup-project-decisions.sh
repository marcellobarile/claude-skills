#!/usr/bin/env bash
# Wire repo-scoped project decisions: <repo>/docs/decisions symlinked from
# ~/.claude/debug-decisions/<slug>. Idempotent.
# Usage: setup-project-decisions.sh <repo-path> <project-slug>
set -euo pipefail

repo="${1:?Usage: setup-project-decisions.sh <repo-path> <project-slug>}"
slug="${2:?Usage: setup-project-decisions.sh <repo-path> <project-slug>}"

repo_dec="$repo/docs/decisions"
proj_dec="$HOME/.claude/debug-decisions/$slug"

mkdir -p "$repo_dec"

if [[ -L "$proj_dec" ]]; then
  echo "Already linked: $proj_dec -> $(readlink "$proj_dec")"
  exit 0
fi

if [[ -d "$proj_dec" ]]; then
  shopt -s dotglob nullglob
  files=("$proj_dec"/*)
  if (( ${#files[@]} )); then
    mv "${files[@]}" "$repo_dec/"
  fi
  shopt -u dotglob nullglob
  rmdir "$proj_dec"
fi

mkdir -p "$(dirname "$proj_dec")"
ln -s "$repo_dec" "$proj_dec"
echo "Linked: $proj_dec -> $repo_dec"
