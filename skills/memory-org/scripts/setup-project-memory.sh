#!/usr/bin/env bash
# Wire repo-scoped project memory: <repo>/docs/memory symlinked from
# ~/.claude/projects/<slug>/memory. Idempotent.
# Usage: setup-project-memory.sh <repo-path> <project-slug>
set -euo pipefail

repo="${1:?Usage: setup-project-memory.sh <repo-path> <project-slug>}"
slug="${2:?Usage: setup-project-memory.sh <repo-path> <project-slug>}"

repo_mem="$repo/docs/memory"
proj_mem="$HOME/.claude/projects/$slug/memory"

mkdir -p "$repo_mem"

# If the project memory is already the symlink we want, done.
if [[ -L "$proj_mem" ]]; then
  echo "Already linked: $proj_mem -> $(readlink "$proj_mem")"
  exit 0
fi

# Move any existing real memory files into the repo, then replace with a symlink.
if [[ -d "$proj_mem" ]]; then
  shopt -s dotglob nullglob
  files=("$proj_mem"/*)
  if (( ${#files[@]} )); then
    mv "${files[@]}" "$repo_mem/"
  fi
  shopt -u dotglob nullglob
  rmdir "$proj_mem"
fi

mkdir -p "$(dirname "$proj_mem")"
ln -s "$repo_mem" "$proj_mem"
echo "Linked: $proj_mem -> $repo_mem"
