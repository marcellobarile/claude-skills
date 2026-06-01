---
name: cv-builder
description: >
  Builds a professional, HR-friendly CV for the user. First gathers data from their
  online presence — GitHub (public API), Medium (RSS), personal site (web fetch) —
  and accepts pasted exports for gated sources like LinkedIn; then interviews the user
  to fill gaps one question at a time. Renders a skimmable, self-contained HTML page
  (3 selectable themes) with print-to-PDF, and persists a structured profile for fast
  regeneration. USE when the user asks to create/build/update/generate their CV,
  résumé, or curriculum vitae, wants a CV from their GitHub/LinkedIn/Medium, or asks
  for an HTML/PDF resume. Generic master CV — no job-description tailoring.
---

# cv-builder — Build an HR-friendly CV

Gather the user's online presence, fill the gaps by interview, render a skimmable HTML CV
with print-to-PDF. Profile persists across sessions for fast updates.

> **Output language.** Produce the CV and all questions in the user's language, inferred from
> the conversation. Set the HTML `lang` attribute accordingly. Do not hardcode a default.

## Persistent state — `~/.claude/cv-builder/`
Create on first use.
- `profile.json` — structured profile (schema below). Read directly; if missing, start empty.
- `sources/` — cache raw pasted exports / fetched text so the CV can be regenerated without
  re-interviewing.

`profile.json` schema: identity, contacts, summary, experience[], skills.groups[], education[],
projects[], webPresence[], certifications[], lastUpdated. (See `assets/templates/sample-profile.json`
for a filled example.)

## Workflow

### 1. Discovery
Ask which URLs the user has (GitHub, LinkedIn, Medium, personal site). Best-effort fetch:
- **GitHub** — public REST API (no auth): `GET https://api.github.com/users/<u>` and
  `.../users/<u>/repos?sort=stars&per_page=10`. Extract headline-worthy repos, primary
  languages, stars, repo count. On HTTP 403 / `X-RateLimit-Remaining: 0`, stop and ask the
  user to paste instead.
- **Medium** — fetch `https://medium.com/feed/@<handle>`; extract article titles/links/dates.
- **Personal site / public pages** — web-fetch, extract relevant facts.
- **Gated (LinkedIn)** — do NOT scrape. Ask the user to paste their profile/export; save to
  `sources/`.
Normalize everything into `profile.json`.

### 2. Gap-filling
Diff gathered data vs the full model. Ask ONE question at a time from
`references/question-bank.md`, prioritizing high-impact gaps. Apply `references/hr-best-practices.md`
while writing bullets (action verb + quantified result; never invent numbers). Update
`profile.json` and set `lastUpdated`.

### 3. Style selection
Offer the 3 themes with a one-line description each; the user picks one:
- **classic** — sober single-column.
- **modern-accent** — light rules + color accent.
- **minimal** — high whitespace, monochrome.

### 4. Render
- Load `assets/templates/base.html`. Fill `{{TOKENS}}`; for each `<!-- BEGIN x / END x -->`
  block, duplicate the inner markup once per array item (drop the block if the array is empty,
  and drop the whole `<section>` if it has no data).
- Remove the dev-preview `<link>` line and inline the chosen theme CSS file's full contents into
  `<style id="theme">`. Output MUST be a single self-contained `.html` (no external CSS/JS/font
  URLs).
- Footer (every theme): `{{AI_TAGLINE}}` = a sober one-liner on *AI as a tool in service of
  humans* (the agent crafts it, tasteful, in the CV language); `{{AI_DISCLAIMER}}` = *"CV drafted
  with the support of an AI"* in the CV language.
- Apply `references/hr-best-practices.md` (section order, length, skimmability).
- Save to the current working directory as `cv-<slug-of-fullName>.html`.

### 5. Export
Tell the user: open the HTML and click **Save as PDF** (or browser Print → Save as PDF). The
print CSS enforces A4, hides the button, and keeps entries from splitting across pages.

## Token reference
Scalars: `{{LANG}} {{FULL_NAME}} {{HEADLINE}} {{SUMMARY}} {{AI_TAGLINE}} {{AI_DISCLAIMER}}`.
Repeatable blocks (BEGIN/END): contact, experience (with nested bullet), skillgroup, project,
education, web, cert. See `assets/templates/base.html`.
