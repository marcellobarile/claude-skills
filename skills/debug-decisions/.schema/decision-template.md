---
id: <YYYY-MM-DD-HHMM-kebab-slug>
date: <YYYY-MM-DDTHH:MM+TZ>
project: <project-slug>
status: active
git_sha: <short-sha-or-null>
tags: []
---

# <Decision, one imperative line>

## Context
<1-3 lines: what we were doing, the constraint that emerged. Critical: extended prose OK.>

## Decision
<1 line: final choice, explicit>

## Alternatives considered
- **<option A>** — dropped: <reason, one line>
- **<option B>** — dropped: <reason, one line>

## Rationale
<Default: 2-4 bullet lines. Critical: extended prose OK.>

## Scope / Impact
- Files: `path/to/file`, `path/to/other`
- Areas: <subsystem or concept>
- Downstream dependencies: <decisions or components that now assume this choice>

## Revert plan
1. <Step 1: concrete file/command>
2. <Step 2>
3. Risks: <what breaks if I revert, one line>

## Follow-ups
- [ ] <todo or open question>
