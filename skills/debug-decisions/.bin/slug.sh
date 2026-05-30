#!/usr/bin/env bash
# Resolve current working directory to a project slug, matching the convention
# used by ~/.claude/projects/ (replace `/` with `-`).
# Uses `pwd -P` to resolve symlinks so /tmp on macOS becomes /private/tmp.
set -euo pipefail

cwd=$(pwd -P)
echo "${cwd//\//-}"
