# cv-builder

Builds a professional, HR-friendly CV for Claude Code. Scrapes your public online presence (GitHub, Medium, personal site), fills gaps with a one-question-at-a-time interview, then renders a self-contained HTML page with print-to-PDF support. Profile persists across sessions for fast regeneration.

---

## What it does

| Phase | What happens |
|---|---|
| **Discovery** | Fetches GitHub profile + top repos (REST API), Medium RSS feed, personal site (web fetch). LinkedIn is gated — user pastes an export. |
| **Gap-filling** | Diffs gathered data against a full CV model. Asks one question at a time from a curated bank, applying HR writing rules (action verb + quantified result). |
| **Theme selection** | User picks from 3 themes (classic / modern-accent / minimal). |
| **Render** | Fills `base.html` with profile data, inlines the chosen CSS, outputs a single self-contained `.html` file. No external URLs in the output. |
| **PDF export** | User opens the HTML and does Print → Save as PDF. Print CSS enforces A4 layout and hides the export button. |

---

## Trigger phrases

- "Build my CV"
- "Generate my résumé from my GitHub"
- "Update my CV — I changed jobs"
- "Create an HTML CV with my LinkedIn and GitHub"

---

## Persistent state

All data lives under `~/.claude/cv-builder/` (created on first use):

```
~/.claude/cv-builder/
├── profile.json       ← structured CV data (see schema below)
└── sources/           ← cached raw exports / fetched text
```

`profile.json` fields: `identity`, `contacts`, `summary`, `experience[]`, `skills.groups[]`, `education[]`, `projects[]`, `webPresence[]`, `certifications[]`, `lastUpdated`.

See `assets/templates/sample-profile.json` for a filled example.

---

## Themes

| Theme | Character |
|---|---|
| `classic` | Sober single-column, safe for conservative industries |
| `modern-accent` | Light horizontal rules + color accent, clean and contemporary |
| `minimal` | High whitespace, monochrome, no decorative elements |

All themes produce a single self-contained `.html` with no external CSS/JS/font URLs.

---

## Data sources

| Source | Method | Notes |
|---|---|---|
| **GitHub** | `GET /users/<u>` + `/users/<u>/repos?sort=stars&per_page=10` | No auth. On 403 / rate-limit exhausted, asks user to paste instead. |
| **Medium** | `https://medium.com/feed/@<handle>` (RSS) | Extracts article titles, links, dates. |
| **Personal site** | Web fetch | Extracts relevant facts. |
| **LinkedIn** | Manual paste | Not scraped. User exports from LinkedIn and pastes the text. |

---

## Output file

Saved to the current working directory as `cv-<slug-of-fullName>.html`. The file is fully self-contained — no internet connection needed to open or print it.

Footer on every theme includes:
- A tasteful one-liner on AI as a tool in service of humans (crafted by the agent).
- *"CV drafted with the support of an AI"* in the CV language.

---

## Files

```
cv-builder/
├── SKILL.md
├── assets/
│   └── templates/
│       ├── base.html           ← HTML template with {{TOKEN}} placeholders
│       ├── classic.css
│       ├── modern-accent.css
│       ├── minimal.css
│       └── sample-profile.json ← filled profile example
└── references/
    ├── hr-best-practices.md    ← section ordering, bullet style, skimmability rules
    └── question-bank.md        ← gap-filling interview questions, prioritized
```

---

## HR writing rules (applied automatically)

- Every experience bullet: action verb + quantified result. Numbers are never invented.
- Section order follows recruiter scanning pattern: identity → summary → experience → skills → education → projects → certs → web presence.
- Summary capped at 3 lines.
- Longest entries trimmed to keep the CV on 1–2 pages.
