# cv-builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `cv-builder` skill that gathers the user's online presence + interviews them, then renders a skimmable, HR-friendly, self-contained HTML CV with print-to-PDF and 3 selectable themes.

**Architecture:** A `SKILL.md` workflow drives 5 phases (discovery → gap-filling → style → render → export). Knowledge lives in `references/*.md`; presentation lives in `assets/templates/` (one semantic `base.html` + 3 theme CSS). Persistent profile in `~/.claude/cv-builder/profile.json`. The render phase fills `{{tokens}}` in `base.html` and inlines the chosen CSS into a `<style>` block so the output `.html` is fully self-contained.

**Tech Stack:** Markdown (skill + references), semantic HTML5 + CSS (`@page`/`@media print`, system font stack), plain `window.print()` for PDF. No Node deps, no build step, no external fonts.

**Note on commits:** Per the repo owner's rule, the human commits. Each task ends with a **Checkpoint** (review the produced file) instead of a `git commit` step.

**Spec:** `docs/superpowers/specs/2026-06-01-cv-builder-design.md`

---

## File Structure

```
skills/cv-builder/
  SKILL.md                       # workflow + frontmatter trigger
  references/
    hr-best-practices.md         # section order, length, action verbs, skim rules, what to avoid
    question-bank.md             # gap-filling questions per CV section
  assets/
    templates/
      base.html                  # semantic skeleton with {{tokens}} + per-theme <link> (stripped at render)
      classic.css                # theme 1
      modern-accent.css          # theme 2
      minimal.css                # theme 3
      sample-profile.json        # realistic fixture used only to verify rendering
docs/superpowers/specs/2026-06-01-cv-builder-design.md   # (exists)
README.md                        # add skill row between <!-- SKILLS:START --> markers
```

Verification across tasks is visual: fill `base.html` tokens from `sample-profile.json`, link one theme, open in a browser, check print preview.

---

## Task 1: base.html semantic skeleton + token contract

**Files:**
- Create: `skills/cv-builder/assets/templates/base.html`
- Create: `skills/cv-builder/assets/templates/sample-profile.json`

- [ ] **Step 1: Write the sample fixture**

Create `sample-profile.json` with one realistic record per section (used only for visual checks):

```json
{
  "identity":   { "fullName": "Jane Q. Engineer", "headline": "Senior Backend Engineer · Distributed Systems", "location": "Milan, Italy", "languageOfCv": "en" },
  "contacts":   { "email": "jane@example.com", "phone": "+39 333 0000000", "website": "https://jane.dev", "github": "https://github.com/janeq", "linkedin": "https://linkedin.com/in/janeq", "medium": "https://medium.com/@janeq", "other": [] },
  "summary":    "Backend engineer with 9 years building high-throughput services. Cut p99 latency 40% across a payments platform serving 12M users.",
  "experience": [
    { "role": "Senior Backend Engineer", "company": "Acme Payments", "start": "2021", "end": "Present", "location": "Remote", "bullets": ["Led migration to event-driven architecture, cutting p99 latency 40%.", "Mentored 4 engineers; introduced trunk-based delivery."], "stack": ["Go", "Kafka", "PostgreSQL"] },
    { "role": "Backend Engineer", "company": "DataForge", "start": "2017", "end": "2021", "location": "Milan", "bullets": ["Built ingestion pipeline processing 2B events/day."], "stack": ["Java", "Spark"] }
  ],
  "skills":     { "groups": [ { "label": "Languages", "items": ["Go", "Java", "Python"] }, { "label": "Infra", "items": ["Kubernetes", "Kafka", "Terraform"] } ] },
  "education":  [ { "degree": "M.Sc. Computer Science", "institution": "Politecnico di Milano", "start": "2012", "end": "2016", "notes": "110/110 cum laude" } ],
  "projects":   [ { "name": "openqueue", "url": "https://github.com/janeq/openqueue", "description": "Lightweight durable job queue.", "stack": ["Go"] } ],
  "webPresence":[ { "kind": "github", "url": "https://github.com/janeq", "metric": "1.2k stars", "note": "12 public repos" }, { "kind": "medium", "url": "https://medium.com/@janeq", "metric": "8 articles", "note": "distributed systems" } ],
  "certifications": ["CKA — Certified Kubernetes Administrator (2023)"],
  "lastUpdated": "2026-06-01"
}
```

- [ ] **Step 2: Write base.html**

Self-contained-ready HTML5 skeleton. Uses `{{TOKEN}}` placeholders for scalars and HTML comment markers `<!-- BEGIN x / END x -->` around repeatable blocks (the render agent duplicates the block per array item). Ships with a `<link>` to `classic.css` for dev preview; the render phase removes the `<link>` and inlines the chosen theme into the empty `<style id="theme">`.

```html
<!doctype html>
<html lang="{{LANG}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{FULL_NAME}} — CV</title>
  <!-- DEV-PREVIEW-LINK: removed at render, theme inlined below -->
  <link rel="stylesheet" href="classic.css">
  <style id="theme">/* render phase inlines chosen theme CSS here */</style>
</head>
<body>
  <button class="no-print" id="printBtn" onclick="window.print()">Save as PDF</button>

  <main class="cv">
    <header class="cv__header">
      <h1 class="cv__name">{{FULL_NAME}}</h1>
      <p class="cv__headline">{{HEADLINE}}</p>
      <ul class="cv__contacts">
        <!-- BEGIN contact --><li><a href="{{CONTACT_URL}}">{{CONTACT_LABEL}}</a></li><!-- END contact -->
      </ul>
    </header>

    <section class="cv__section cv__summary">
      <h2>Summary</h2>
      <p>{{SUMMARY}}</p>
    </section>

    <section class="cv__section cv__experience">
      <h2>Experience</h2>
      <!-- BEGIN experience -->
      <article class="entry">
        <div class="entry__head">
          <span class="entry__role">{{ROLE}}</span>
          <span class="entry__company">{{COMPANY}}</span>
          <span class="entry__meta">{{START}}–{{END}} · {{LOCATION}}</span>
        </div>
        <ul class="entry__bullets">
          <!-- BEGIN bullet --><li>{{BULLET}}</li><!-- END bullet -->
        </ul>
        <p class="entry__stack">{{STACK}}</p>
      </article>
      <!-- END experience -->
    </section>

    <section class="cv__section cv__skills">
      <h2>Skills</h2>
      <!-- BEGIN skillgroup -->
      <div class="skillgroup"><span class="skillgroup__label">{{SKILL_LABEL}}</span><span class="skillgroup__items">{{SKILL_ITEMS}}</span></div>
      <!-- END skillgroup -->
    </section>

    <section class="cv__section cv__projects">
      <h2>Projects</h2>
      <!-- BEGIN project -->
      <article class="entry">
        <div class="entry__head"><a class="entry__role" href="{{PROJECT_URL}}">{{PROJECT_NAME}}</a><span class="entry__meta">{{PROJECT_STACK}}</span></div>
        <p>{{PROJECT_DESC}}</p>
      </article>
      <!-- END project -->
    </section>

    <section class="cv__section cv__education">
      <h2>Education</h2>
      <!-- BEGIN education -->
      <article class="entry">
        <div class="entry__head"><span class="entry__role">{{DEGREE}}</span><span class="entry__company">{{INSTITUTION}}</span><span class="entry__meta">{{EDU_START}}–{{EDU_END}}</span></div>
        <p class="entry__notes">{{EDU_NOTES}}</p>
      </article>
      <!-- END education -->
    </section>

    <section class="cv__section cv__web">
      <h2>Web Presence</h2>
      <ul class="weblist">
        <!-- BEGIN web --><li><a href="{{WEB_URL}}">{{WEB_KIND}}</a> — {{WEB_METRIC}} · {{WEB_NOTE}}</li><!-- END web -->
      </ul>
    </section>

    <section class="cv__section cv__certs">
      <h2>Certifications</h2>
      <ul>
        <!-- BEGIN cert --><li>{{CERT}}</li><!-- END cert -->
      </ul>
    </section>

    <footer class="cv__footer">
      <p class="cv__tagline">{{AI_TAGLINE}}</p>
      <p class="cv__disclaimer">{{AI_DISCLAIMER}}</p>
    </footer>
  </main>
</body>
</html>
```

- [ ] **Step 3: Verify it parses and previews**

Run: `open skills/cv-builder/assets/templates/base.html` (macOS) — confirm the page loads with tokens visible as literal text and no console errors. (CSS comes in Task 5.)

- [ ] **Step 4: Checkpoint**

Review `base.html` + `sample-profile.json`: every `profile.json` field from the spec maps to a token or repeatable block. No commit (human handles).

---

## Task 2: classic.css theme + print rules

**Files:**
- Create: `skills/cv-builder/assets/templates/classic.css`

- [ ] **Step 1: Write classic.css**

Sober single-column theme. MUST include the shared print contract every theme reuses: `@page { size: A4; margin: 14mm }`, `.no-print` hidden in print, `break-inside: avoid` on `.entry`, system font stack, accessible contrast.

```css
:root { --ink:#1a1a1a; --muted:#555; --rule:#ddd; --accent:#1a1a1a; }
* { box-sizing: border-box; }
body { margin:0; color:var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height:1.45; background:#f4f4f4; }
.cv { max-width: 800px; margin: 24px auto; background:#fff; padding: 32px 40px; }
.cv__name { font-size: 28px; margin:0; }
.cv__headline { color:var(--muted); margin:4px 0 12px; font-size:15px; }
.cv__contacts { list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:6px 16px; font-size:13px; }
.cv__contacts a { color:var(--accent); text-decoration:none; }
.cv__section { margin-top: 22px; }
.cv__section > h2 { font-size: 13px; text-transform: uppercase; letter-spacing:.08em; color:var(--muted); border-bottom:1px solid var(--rule); padding-bottom:4px; margin:0 0 10px; }
.entry { margin-bottom: 14px; break-inside: avoid; }
.entry__head { display:flex; flex-wrap:wrap; gap:4px 10px; align-items:baseline; }
.entry__role { font-weight:600; }
.entry__company { color:var(--muted); }
.entry__meta { margin-left:auto; color:var(--muted); font-size:12px; }
.entry__bullets { margin:6px 0 0; padding-left:18px; }
.entry__bullets li { margin:2px 0; }
.entry__stack, .entry__notes { color:var(--muted); font-size:12.5px; margin:4px 0 0; }
.skillgroup { display:flex; gap:10px; margin:4px 0; font-size:13.5px; }
.skillgroup__label { font-weight:600; min-width:90px; }
.weblist { margin:0; padding-left:18px; font-size:13.5px; }
.cv__footer { margin-top:28px; padding-top:10px; border-top:1px solid var(--rule); }
.cv__tagline { font-size:12.5px; font-style:italic; color:var(--muted); margin:0; }
.cv__disclaimer { font-size:11px; color:#999; margin:4px 0 0; }
.no-print { position:fixed; top:16px; right:16px; padding:8px 14px; border:0; border-radius:6px; background:var(--accent); color:#fff; cursor:pointer; font-size:13px; }
@page { size: A4; margin: 14mm; }
@media print {
  body { background:#fff; }
  .cv { margin:0; max-width:none; padding:0; }
  .no-print { display:none !important; }
  a { color: var(--ink); }
  .entry, section { break-inside: avoid; }
}
```

- [ ] **Step 2: Render preview with sample data**

Create a throwaway preview by token-substituting `sample-profile.json` into `base.html`. Quick path — run this Node one-liner from `skills/cv-builder/assets/templates/`:

Run:
```bash
node -e 'const fs=require("fs");let h=fs.readFileSync("base.html","utf8");h=h.replace(/\{\{FULL_NAME\}\}/g,"Jane Q. Engineer").replace(/\{\{HEADLINE\}\}/g,"Senior Backend Engineer").replace(/\{\{SUMMARY\}\}/g,"Backend engineer, 9 years.").replace(/\{\{LANG\}\}/g,"en").replace(/\{\{AI_TAGLINE\}\}/g,"Built with AI as a tool in service of human craft.").replace(/\{\{AI_DISCLAIMER\}\}/g,"CV drafted with the support of an AI.").replace(/\{\{[A-Z_]+\}\}/g,"—");fs.writeFileSync("_preview.html",h)' && open _preview.html
```
Expected: classic theme renders — name, headline, footer tagline + disclaimer visible; print button top-right.

- [ ] **Step 3: Check print preview**

In the browser, Cmd-P. Expected: A4 page, button hidden, footer present, no entry split mid-block.

- [ ] **Step 4: Clean up + checkpoint**

Run: `rm -f skills/cv-builder/assets/templates/_preview.html`
Review classic.css. No commit.

---

## Task 3: modern-accent.css theme

**Files:**
- Create: `skills/cv-builder/assets/templates/modern-accent.css`

- [ ] **Step 1: Write modern-accent.css**

Same structural selectors and the same print contract as Task 2, restyled: light left rule / color accent on headings, slightly larger name. Reuse the print block verbatim.

```css
:root { --ink:#161b22; --muted:#5a6472; --rule:#e3e8ef; --accent:#2f6feb; }
* { box-sizing:border-box; }
body { margin:0; color:var(--ink); font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height:1.5; background:#eef1f5; }
.cv { max-width:820px; margin:24px auto; background:#fff; padding:36px 44px; border-top:5px solid var(--accent); }
.cv__name { font-size:32px; margin:0; letter-spacing:-.01em; }
.cv__headline { color:var(--accent); font-weight:600; margin:4px 0 14px; font-size:15px; }
.cv__contacts { list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:6px 18px; font-size:13px; }
.cv__contacts a { color:var(--muted); text-decoration:none; }
.cv__section { margin-top:24px; }
.cv__section > h2 { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent); margin:0 0 10px; }
.entry { margin-bottom:15px; padding-left:14px; border-left:2px solid var(--rule); break-inside:avoid; }
.entry__head { display:flex; flex-wrap:wrap; gap:4px 10px; align-items:baseline; }
.entry__role { font-weight:700; }
.entry__company { color:var(--muted); }
.entry__meta { margin-left:auto; color:var(--muted); font-size:12px; }
.entry__bullets { margin:6px 0 0; padding-left:18px; }
.entry__bullets li { margin:2px 0; }
.entry__stack, .entry__notes { color:var(--muted); font-size:12.5px; margin:4px 0 0; }
.skillgroup { display:flex; gap:10px; margin:5px 0; font-size:13.5px; }
.skillgroup__label { font-weight:700; min-width:90px; color:var(--accent); }
.weblist { margin:0; padding-left:18px; font-size:13.5px; }
.cv__footer { margin-top:30px; padding-top:10px; border-top:1px solid var(--rule); }
.cv__tagline { font-size:12.5px; font-style:italic; color:var(--muted); margin:0; }
.cv__disclaimer { font-size:11px; color:#9aa3b0; margin:4px 0 0; }
.no-print { position:fixed; top:16px; right:16px; padding:8px 14px; border:0; border-radius:6px; background:var(--accent); color:#fff; cursor:pointer; font-size:13px; }
@page { size: A4; margin: 14mm; }
@media print {
  body { background:#fff; }
  .cv { margin:0; max-width:none; padding:0; border-top:4px solid var(--accent); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .no-print { display:none !important; }
  .entry, section { break-inside:avoid; }
}
```

- [ ] **Step 2: Preview**

Repeat the Task 2 Node one-liner but change `base.html`'s `<link>` href to `modern-accent.css` first (or edit `_preview.html` link). Open and confirm accent color prints (color-adjust exact).

- [ ] **Step 3: Clean up + checkpoint**

Run: `rm -f skills/cv-builder/assets/templates/_preview.html`. Review. No commit.

---

## Task 4: minimal.css theme

**Files:**
- Create: `skills/cv-builder/assets/templates/minimal.css`

- [ ] **Step 1: Write minimal.css**

Same selectors + print contract; maximal whitespace, no rules/borders except a hairline under name, monochrome.

```css
:root { --ink:#222; --muted:#777; --accent:#222; }
* { box-sizing:border-box; }
body { margin:0; color:var(--ink); font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height:1.55; background:#fff; }
.cv { max-width:760px; margin:40px auto; padding:0 28px; }
.cv__name { font-size:26px; font-weight:600; margin:0; }
.cv__headline { color:var(--muted); margin:2px 0 10px; font-size:14px; }
.cv__contacts { list-style:none; padding:0 0 14px; margin:0; border-bottom:1px solid #eee; display:flex; flex-wrap:wrap; gap:4px 16px; font-size:12.5px; }
.cv__contacts a { color:var(--muted); text-decoration:none; }
.cv__section { margin-top:26px; }
.cv__section > h2 { font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); font-weight:600; margin:0 0 8px; }
.entry { margin-bottom:16px; break-inside:avoid; }
.entry__head { display:flex; flex-wrap:wrap; gap:4px 10px; align-items:baseline; }
.entry__role { font-weight:600; }
.entry__company { color:var(--muted); }
.entry__meta { margin-left:auto; color:var(--muted); font-size:12px; }
.entry__bullets { margin:6px 0 0; padding-left:16px; }
.entry__bullets li { margin:3px 0; }
.entry__stack, .entry__notes { color:var(--muted); font-size:12.5px; margin:4px 0 0; }
.skillgroup { display:flex; gap:10px; margin:5px 0; font-size:13.5px; }
.skillgroup__label { font-weight:600; min-width:90px; }
.weblist { margin:0; padding-left:16px; font-size:13.5px; }
.cv__footer { margin-top:34px; padding-top:10px; border-top:1px solid #eee; }
.cv__tagline { font-size:12px; font-style:italic; color:var(--muted); margin:0; }
.cv__disclaimer { font-size:10.5px; color:#aaa; margin:4px 0 0; }
.no-print { position:fixed; top:16px; right:16px; padding:8px 14px; border:1px solid var(--ink); border-radius:6px; background:#fff; color:var(--ink); cursor:pointer; font-size:13px; }
@page { size: A4; margin: 16mm; }
@media print {
  .cv { margin:0; max-width:none; padding:0; }
  .no-print { display:none !important; }
  .entry, section { break-inside:avoid; }
}
```

- [ ] **Step 2: Preview + checkpoint**

Preview as in Task 3 with `minimal.css`. Confirm whitespace-heavy layout, footer present. `rm -f _preview.html`. Review. No commit.

---

## Task 5: references/hr-best-practices.md

**Files:**
- Create: `skills/cv-builder/references/hr-best-practices.md`

- [ ] **Step 1: Write the reference**

Concrete, agent-actionable rules (not prose essay). Cover, with specifics:

```markdown
# HR best-practices for the generated CV

## Length & density
- Target 1 page (≤7 yrs experience) or 2 pages max. Never 3.
- 6-second skim rule: a recruiter scans first. Strong hierarchy, scannable bullets, no text walls.

## Section order (generic, reverse-chronological)
1. Header (name, headline, contacts)
2. Summary (2–3 lines, value + 1 quantified proof)
3. Experience (most recent first)
4. Skills (grouped)
5. Projects (if relevant / strong)
6. Education
7. Web presence
8. Certifications
Drop empty sections entirely.

## Experience bullets
- Pattern: <action verb> + <what> + <quantified result>. One idea per bullet. Max ~2 lines.
- Action verbs: Led, Built, Cut, Scaled, Shipped, Reduced, Automated, Designed, Migrated.
- Quantify only with numbers the user gave. NEVER invent metrics.
- 2–4 bullets per role; oldest roles get fewer.

## What to avoid
- No photo, age, marital status, full address (privacy + bias; norm in EU/US tech).
- No first-person pronouns, no "responsible for", no buzzword soup.
- No unexplained acronyms — expand on first use.
- No dense paragraphs in Experience; bullets only.

## Skimmability
- Consistent date format. Right-aligned dates/meta.
- Keep each entry break-inside intact (handled by CSS).
```

- [ ] **Step 2: Checkpoint**

Review against spec's HR section — every listed rule present. No commit.

---

## Task 6: references/question-bank.md

**Files:**
- Create: `skills/cv-builder/references/question-bank.md`

- [ ] **Step 1: Write the question bank**

One-at-a-time gap-filling questions grouped by section, each tied to a `profile.json` field, phrased to elicit quantified results.

```markdown
# Gap-filling question bank

Ask ONE at a time. Skip any field already filled from discovery. Prioritize: headline → summary → recent experience bullets → skills.

## identity / contacts
- "Full name as it should appear on the CV?" → identity.fullName
- "One-line professional headline (role + specialty)?" → identity.headline
- "City / country for location?" → identity.location
- "Which contacts to show: email, phone, website? (LinkedIn/GitHub/Medium auto-added if given)" → contacts.*

## summary
- "In one sentence, what value do you bring? Then one quantified achievement to back it." → summary

## experience (per role with thin data)
- "For <role> at <company>: what were your 2–3 biggest results? Numbers if you have them (%, scale, time saved)." → experience[].bullets
- "Main tech/tools used in that role?" → experience[].stack
- "Start and end (month/year, or 'Present')?" → experience[].start/end

## skills
- "Group your top skills — e.g. Languages, Infra, Tools. List the items per group." → skills.groups

## projects
- "Any standout side/open-source projects worth showing? Name, link, one-line description, stack." → projects[]

## education
- "Highest relevant degree: title, institution, years, notable honors?" → education[]

## certifications
- "Any certifications to list? (name + year)" → certifications[]

## footer (defaults, confirm tone)
- AI_TAGLINE: craft a sober one-liner on 'AI as a tool in service of humans' in the CV's language.
- AI_DISCLAIMER: 'CV drafted with the support of an AI' (translated to the CV's language).
```

- [ ] **Step 2: Checkpoint**

Review: every `profile.json` section has at least one question. No commit.

---

## Task 7: SKILL.md

**Files:**
- Create: `skills/cv-builder/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Frontmatter `name` + multi-trigger `description`, then the 5-phase workflow. Must be self-contained (no reference to other skills by name).

````markdown
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
````

- [ ] **Step 2: Lint frontmatter**

Run: `head -20 skills/cv-builder/SKILL.md` and confirm valid YAML frontmatter with `name: cv-builder`.

- [ ] **Step 3: Checkpoint**

Cross-check SKILL.md against spec phases 1–5 and the token list in `base.html`. No commit.

---

## Task 8: README registration + final end-to-end check

**Files:**
- Modify: `README.md` (inside `<!-- SKILLS:START -->` … table)

- [ ] **Step 1: Add the README row**

Add a row to the skills table (keep alphabetical with existing rows):

```markdown
| `cv-builder` | Builds a professional, HR-friendly CV. Gathers data from the user's online presence (GitHub API, Medium RSS, personal site) plus pasted exports for gated sources like LinkedIn, interviews to fill gaps, then renders a skimmable self-contained HTML CV with 3 themes and print-to-PDF. Persists a structured profile for fast updates. Use when the user wants to create/update their CV/résumé from their online profiles or as HTML/PDF. |
```

- [ ] **Step 2: Full end-to-end render check**

From `skills/cv-builder/assets/templates/`, write a complete preview by substituting ALL of `sample-profile.json` (loop the BEGIN/END blocks) into `base.html` with `minimal.css` inlined, open it, and verify: all sections populated, footer tagline + disclaimer present, print preview is clean A4. Then `rm -f _preview.html`.

Run:
```bash
ls skills/cv-builder skills/cv-builder/references skills/cv-builder/assets/templates
```
Expected: SKILL.md, references/ (2 files), assets/templates/ (base.html + 3 css + sample-profile.json).

- [ ] **Step 3: Verify installer picks it up**

Run: `npm start` is interactive — instead confirm the skill dir matches the layout other skills use:
```bash
ls skills/mind-gym && echo "---" && ls skills/cv-builder
```
Expected: both contain `SKILL.md`. (Installer discovers skills by directory; no manifest edit needed beyond README.)

- [ ] **Step 4: Final checkpoint**

Review the whole `skills/cv-builder/` tree + README diff. Hand off to the human for commit.

---

## Self-Review

- **Spec coverage:** discovery/gap-fill/style/render/export → Tasks 7 (workflow) + 1–4 (assets) + 5–6 (knowledge); persistence → SKILL.md state section + sample schema; 3 themes → Tasks 2–4; self-contained HTML + print → base.html + each theme's print block; footer tagline+disclaimer → base.html + every theme + SKILL.md render step; HR rules → Task 5; README → Task 8. No gaps.
- **Placeholders:** none — all file contents are concrete; `{{TOKENS}}` are the intended runtime contract, not plan placeholders.
- **Type/name consistency:** token names in `base.html` (Task 1) match the token reference in SKILL.md (Task 7) and the preview substitutions (Tasks 2–4); CSS selectors are identical across all 3 themes (`.cv`, `.entry`, `.no-print`, footer classes); `profile.json` schema identical in spec, sample fixture, and SKILL.md.
- **Commits:** intentionally omitted per repo owner rule; replaced with checkpoints.
