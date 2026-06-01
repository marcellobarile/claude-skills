# cv-builder — Design Spec

> **What is this file.** Implementation contract for the `cv-builder` Claude Code skill.
> Audience: the engineer/agent implementing the skill. Owner: marcellobarile.
> Companion: none yet (no separate solution-proposal). This file is the single source of truth
> for scope, behavior, and structure.

## Purpose

A skill that builds a professional, HR-friendly CV for the user. It first gathers data from the
user's online presence (best-effort), then interviews the user to fill gaps, then renders a
self-contained HTML page with print-to-PDF export. Generic master CV — no job-description
tailoring.

## Scope

In scope:
- Best-effort data gathering from GitHub, Medium, personal sites, plus user-pasted exports
  (e.g. LinkedIn) for gated sources.
- Gap-filling interview, one question at a time.
- Persistent structured profile reused across sessions.
- 3 selectable visual templates sharing one semantic HTML structure.
- Self-contained HTML output (inline CSS, no external deps) with print-to-PDF via CSS `@page` /
  `@media print` and a `window.print()` button.
- HR best-practice rules applied to content and layout (skimmability).
- Fixed footer: AI-as-tool-for-humans tagline + AI-assisted disclaimer.

Out of scope (YAGNI):
- Job-description tailoring / ATS keyword optimization.
- Headless PDF generation (Playwright/Puppeteer/Chromium).
- Multi-language CV variants beyond the user's chosen output language.
- Cover letters.

## Skill structure

Follows existing repo conventions (cf. `skills/mind-gym/`):

```
skills/cv-builder/
  SKILL.md
  references/
    hr-best-practices.md     # section order, length, action verbs, quantify, what to avoid, 6-second skim rule
    question-bank.md         # gap-filling questions grouped by CV section
  assets/
    templates/
      base.html              # semantic HTML skeleton with placeholders (single render target)
      classic.css            # theme 1 — sober, single-column
      modern-accent.css      # theme 2 — light sidebar + color accent
      minimal.css            # theme 3 — minimal, high whitespace
```

No `setup.mjs`/`teardown.mjs` needed (no slash commands or hooks). Installer copies the dir as-is.

### Output language

Inferred at runtime from the conversation. Never hardcode a default language. The HTML `lang`
attribute is set accordingly.

## Persistent state

Under `~/.claude/cv-builder/` (create on first use):

- `profile.json` — structured profile. Shape:
  ```json
  {
    "identity":   { "fullName": "", "headline": "", "location": "", "languageOfCv": "" },
    "contacts":   { "email": "", "phone": "", "website": "", "github": "", "linkedin": "", "medium": "", "other": [] },
    "summary":    "",
    "experience": [ { "role": "", "company": "", "start": "", "end": "", "location": "", "bullets": [], "stack": [] } ],
    "skills":     { "groups": [ { "label": "", "items": [] } ] },
    "education":  [ { "degree": "", "institution": "", "start": "", "end": "", "notes": "" } ],
    "projects":   [ { "name": "", "url": "", "description": "", "stack": [] } ],
    "webPresence":[ { "kind": "github|medium|talk|site", "url": "", "metric": "", "note": "" } ],
    "certifications": [],
    "lastUpdated": "YYYY-MM-DD"
  }
  ```
- `sources/` — cache of raw pasted exports and fetched text (e.g. `linkedin-export.txt`,
  `github-<user>.json`) so the CV can be regenerated/updated without re-interviewing.

Read these files directly. If missing, treat the profile as empty.

## Workflow (5 phases)

### 1. Discovery
- Ask for URLs: GitHub, LinkedIn, Medium, personal site (whichever the user has).
- Best-effort fetch:
  - **GitHub** → public REST API (no auth): profile, top repos, primary languages, stars,
    pinned/notable projects, contribution signal. Use a couple of API calls; degrade gracefully
    on rate-limit (HTTP 403 / `X-RateLimit-Remaining: 0`) → ask the user to paste instead.
  - **Medium** → RSS feed `https://medium.com/feed/@<handle>` for article titles/links/dates.
  - **Personal site / other public pages** → WebFetch, extract relevant facts.
  - **Gated sources (LinkedIn)** → do not scrape; ask the user to paste their profile export or
    the relevant text. Cache to `sources/`.
- Normalize everything into `profile.json`.

### 2. Gap-filling
- Diff gathered data against the full CV model. Identify missing/weak fields.
- Ask **one question at a time**, drawn from `references/question-bank.md`, prioritizing
  high-impact gaps (summary, recent experience bullets with quantified impact, headline).
- Apply HR rules while capturing answers (turn raw duties into action-verb + quantified-result
  bullets where the user provides the numbers; never fabricate metrics).
- Update `profile.json` (set `lastUpdated`).

### 3. Style selection
- Present the 3 templates (`classic`, `modern-accent`, `minimal`) with a one-line description
  each. User picks one. Default suggestion allowed but user chooses.

### 4. Render
- Load `assets/templates/base.html`, inline the chosen theme CSS into a `<style>` block (output
  must be a single self-contained `.html` file — no external CSS/JS/font URLs; use system font
  stack).
- Populate from `profile.json`, applying `hr-best-practices.md` (section order, 1–2 page target,
  skimmable hierarchy, no text walls).
- Include a visible **"Save as PDF"** button calling `window.print()` (hidden in print via
  `@media print`).
- **Fixed footer** in every template, rendered small/discreet below the content:
  1. A curated, sober one-line tagline on the theme *"AI as a tool in service of humans"* (the
     agent crafts/curates the exact wording in the output language; keep it tasteful, not
     gimmicky).
  2. A small disclaimer: *"CV drafted with the support of an AI"* (output language).
- Save to the current working directory as `cv-<slug-of-fullName>.html`.

### 5. Export
- Tell the user: open the HTML, click "Save as PDF" (or browser Print → Save as PDF). The print
  CSS guarantees A4 layout, hides the button, and avoids page-break-inside on entries.

## HTML / CSS requirements

- Semantic markup: `<header>`, `<section>` per CV block, `<h1>`/`<h2>` hierarchy.
- `@page { size: A4; margin: <sensible> }`.
- `@media print`: hide interactive controls, ensure colors/backgrounds print (or degrade to
  print-safe), avoid `break-inside: avoid` violations on experience/education items.
- Responsive enough to read on screen; print is the canonical target.
- Accessible: sufficient color contrast, real text (no text-as-image), logical heading order.
- System font stack only (offline-safe, no Google Fonts).

## HR best-practices (captured in references/hr-best-practices.md)

- Recommended section order for a generic CV; length 1–2 pages.
- 6-second skim rule → strong visual hierarchy, scannable bullets.
- Action verbs + quantified results; one idea per bullet; no first-person fluff.
- Reverse-chronological experience.
- What to avoid (per common HR guidance): photos/age/marital status where culturally
  inappropriate, dense paragraphs, unexplained acronyms, irrelevant detail.

## Testing / verification

Manual verification (no automated test harness in this repo for skills):
- Render with a sample `profile.json` covering all sections → open in a browser → confirm
  skimmable layout, all 3 themes render, footer (tagline + disclaimer) present.
- Print preview → confirm A4, button hidden, no awkward mid-entry page breaks.
- Empty-profile path → skill interviews from scratch without crashing.
- Rate-limited GitHub path → falls back to asking for a paste.

## Repo integration

- Add `skills/cv-builder/` with the files above.
- Update `README.md` skills table (between the `<!-- SKILLS:START -->` markers) with the new
  skill name + description.
