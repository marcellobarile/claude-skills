# personal-trainer

An elite personal training and mental coaching agent for Claude Code. Acts as a
first-class coach with deep experience in athletic training, sport science, and
mental performance. Adapts to the user's goals, health conditions, available
equipment, and schedule — then builds structured plans, tracks sessions, measures
progress, and exports data in CSV format.

---

## What it does

The skill operates in **persistent coach mode**: it saves a full user profile and
training history to `~/.claude/personal-trainer/` and reads them at the start of
every session, so the context is never lost between conversations.

At each invocation it automatically detects what the user needs:

| User action | Mode activated |
|---|---|
| First use (no profile) | **Intake** — guided onboarding interview |
| "I want a new plan" / "my plan is stale" | **Plan Generation** |
| "Just finished my workout" / provides reps & weights | **Session Log** |
| "How am I doing?" / "check my progress" | **Progress Review** |
| "I hurt my shoulder" / reports illness | **Profile Update + Plan Adjustment** |
| "Export my history" | **CSV Export** |
| General question / in-session cue | **Coaching Response** / **Live Guide** |

---

## Intake protocol

On first use, the skill runs a conversational onboarding — one topic at a time, no
forms. It collects:

1. **Name and basic biometrics** (optional: age, sex, height, weight)
2. **Health screening** — injuries, chronic conditions, medications, surgical
   history, pregnancy. Flags anything requiring physician clearance.
3. **Experience level** — beginner, intermediate, advanced, or competitive athlete
4. **Primary goal** — one of:
   - Body recomposition (reduce fat, preserve or gain muscle)
   - Strength (maximize One Repetition Maximum (1RM) on key lifts)
   - Muscle mass / hypertrophy
   - General fitness / health maintenance
   - Sport / competition preparation (asks which sport and event date)
5. **Secondary goal** (optional)
6. **Available equipment** — mapped to tiers:
   - Tier 0: bodyweight only
   - Tier 1: resistance bands / light dumbbells
   - Tier 2: adjustable dumbbells + bench
   - Tier 3: full dumbbell rack + cables
   - Tier 4: barbell + squat rack / power rack
   - Tier 5: Olympic platform / specialized equipment
7. **Schedule** — days per week, session duration, preferred time, fixed rest days
8. **Exercise preference** — stability (master the same lifts) vs. variety (rotate
   accessories frequently) vs. mixed
9. **Mental coaching style** — technical-only or motivational support; internal vs.
   external accountability

Everything is saved to `~/.claude/personal-trainer/profile.json` and confirmed
with the user before the first plan is generated.

---

## Plan generation

Plans are built on evidence-based frameworks from the bundled
`references/training-methods.md`:

- **Periodization** matched to goal and experience:
  - Beginners / strength focus → Linear Periodization (LP)
  - Intermediates → Daily Undulating Periodization (DUP): rotating rep ranges
    across sessions (e.g. strength day / hypertrophy day / metabolic day)
  - Advanced / competition → Block periodization (accumulation → intensification
    → realization)
- **Volume management** via landmarks (per muscle group per week):
  - Minimum Effective Volume (MEV) → Maximum Adaptive Volume (MAV) →
    Maximum Recoverable Volume (MRV) progression across the mesocycle
- **Load prescription** via Rate of Perceived Exertion (RPE) or percentage of
  One Repetition Maximum (1RM), depending on user experience
- **Exercise selection** from `references/exercises-library.md` — 12 movement
  pattern categories, each catalogued by equipment tier with injury-safe
  substitutions
- **Injury-aware programming** — any injury or condition in the profile drives
  automatic exercise substitution (e.g. herniated L4-L5 → no conventional
  barbell deadlift; substitutes trap-bar deadlift, Romanian deadlift, hip thrust)
- **Deload** every 3–6 weeks: volume cut ~40%, intensity maintained
- **Variety preference** respected: stability → fixed compounds for 4–8 weeks;
  variety → rotating accessory work weekly; mixed → stable primary lifts, rotating
  accessories

The plan is shown as a readable weekly template and saved as
`~/.claude/personal-trainer/plans/{slug}.json` with the full structured data
(exercises, sets, reps, load, rest, coaching cue, injury modification per
exercise).

---

## Session logging

When the user reports completing a workout, the skill:

1. Extracts all exercise data from the message (exercises, sets × reps × weight,
   Rate of Perceived Exertion (RPE) per set)
2. Asks for anything not provided (energy level 0–10, overall session feel, notes)
3. Calculates estimated One Repetition Maximum (1RM) for key lifts using the
   Epley formula: `weight × (1 + reps / 30)`
4. Saves the structured session to
   `~/.claude/personal-trainer/sessions/YYYY-MM-DD-N.json`
5. Updates `~/.claude/personal-trainer/progress.json` with new bests and volume data
6. Delivers a brief coaching response: data summary, RPE observation, mental
   coaching anchor (post-session reflection)

---

## Progress tracking

`progress.json` is a running aggregate updated after every session. It tracks:

- **Per exercise**: best weight × reps, estimated 1RM trend, volume per session
- **Overall**: total sessions logged, adherence rate (logged vs. planned),
  body weight trend (if provided), subjective wellbeing trend

Progress reviews synthesize this into: biggest win, what's trending, one
programming recommendation, and a constructive reframe of any setback.

---

## Mental coaching

Woven into every interaction — not delivered as a separate lecture unless
explicitly requested.

- **Pre-session**: "intention check" — one thing to focus on today
- **Post-session**: anchor — what went well, what to carry forward
- **Setback reframe**: missed session = data point, not failure; injury =
  opportunity to address a weakness
- **Tone calibration**: energetic when the user signals motivation; clinical and
  precise when they signal fatigue or frustration
- **Accountability without shame**: missed sessions acknowledged neutrally,
  plan recalibrated

---

## CSV export

Produces two export formats depending on context:

### Plan template export (forward-looking)

For plans not yet started or mid-cycle. Uses `week_number` + `day_of_week`
columns (no real dates — the structure repeats weekly).

```
week_number,day_of_week,session_type,session_focus,duration_min,target_rpe,intensity_zone,notes
```

Multi-week progressive plans repeat the 7-day block for each week with
progressions documented in the `notes` / `intensity_zone` columns.

### Historical session export

For completed and logged sessions:

- **`sessions.csv`** — one row per session:
  `date, session_number, plan_slug, day_label, duration_min, overall_rpe, energy_level, notes`

- **`volume.csv`** — one row per exercise per session:
  `date, exercise_name, set_number, reps, weight_kg, rpe, estimated_1rm_kg`

- **`progress.csv`** — one row per key lift per week:
  `week_start, exercise_name, best_weight_kg, best_reps, estimated_1rm_kg, total_volume_kg`

All historical exports use ISO 8601 dates (`YYYY-MM-DD`). Weights are always
in kg; lbs input is converted and flagged with a `weight_unit` column.

---

## Persistent state

All data lives under `~/.claude/personal-trainer/` (created on first use):

```
~/.claude/personal-trainer/
├── profile.json           ← user profile, health history, preferences
├── progress.json          ← aggregate progress across all plans
├── plans/
│   └── {slug}.json        ← each training plan (full weekly structure in days[])
└── sessions/
    └── {YYYY-MM-DD-N}.json  ← individual session logs (N = count per day)
```

---

## Reference files

The skill bundles two reference documents loaded on demand:

- **`references/training-methods.md`** — periodization models (LP, Daily
  Undulating Periodization (DUP), block), volume landmarks (Minimum Effective
  Volume (MEV) / Minimum Volume (MV) / Maximum Adaptive Volume (MAV) /
  Maximum Recoverable Volume (MRV)), loading schemes, Rate of Perceived
  Exertion (RPE) / Reps In Reserve (RIR) scales, cardiovascular training zones,
  sport-specific conditioning, deload protocols, recovery principles, injury
  modification table.

- **`references/exercises-library.md`** — ~80 exercises across 12 movement
  pattern categories (squat, hip hinge, unilateral lower, horizontal push/pull,
  vertical push/pull, core, carry, conditioning, prehab), each tagged with
  minimum equipment tier and primary muscles. Includes a quick substitution
  guide per tier and injury-specific alternatives.

---

## Safety guardrails

- Never loads a contraindicated joint or structure.
- Explicitly flags physician clearance when a condition warrants it.
- Nutrition advice limited to general principles — refers to a registered
  dietitian for specifics.
- Stops the session and directs to emergency care if the user describes
  symptoms of a medical emergency (chest pain, dizziness, acute injury).

---

## Model recommendation

This skill performs best with **Claude Opus**. When running on a lighter model,
plan generation is kept focused; complex programming decisions are flagged for
re-invocation with Opus.

---

## Trigger phrases

The skill activates on: *help me train, design my workouts, coach me, track my
session, log my workout, how do I get stronger, I want to lose fat and gain
muscle, prepare me for [sport/race/competition], check my progress*, and
whenever the user shares session data (sets/reps/weights), Rate of Perceived
Exertion (RPE) feedback, or asks to export training history.
