# astro-visibility

Astrophotography session planner for Claude Code. Computes which deep-sky objects are observable and imageable from any location at any time, accounting for altitude, azimuth, astronomical twilight, and your imaging gear.

---

## What it does

Given a location, a time, and optionally a telescope/camera setup, the skill runs a Python script that queries a curated catalog of 12 000+ deep-sky objects and returns a ranked table of the best targets for the session — with altitude/azimuth at peak visibility, rise/set/transit times, and a framing verdict ("fits well", "too large for sensor", etc.).

All astronomical computations are done by the script (`visibility.py`), never estimated mentally. The algorithms follow Meeus *Astronomical Algorithms*; alt/az precision is well under one arcminute.

---

## Trigger phrases

- "What can I image tonight?"
- "Nebulae to the west from [city]"
- "What's visible to the north? I have no zenith coverage"
- "Give me targets for [date]"
- "What do I avoid tonight — my mount can't reach the zenith"

---

## Workflow

1. **Location** — named place (coordinates derived) or explicit lat/lon. Always confirmed before running. Convention: latitude North +, longitude East +.
2. **Time** — defaults to now (system clock in UTC). Pass `--datetime` for a specific moment or date.
3. **Gear** (optional) — focal length + sensor dimensions drive the framing assessment per object. Omitting gear still gives a full visibility list.
4. **Script run** — `python3 visibility.py --lat … --lon … --tz … --direction … [options]`
5. **Results** — table of best objects with peak time, alt/az, compass, and framing verdict. Narrative summary with top picks and any warnings.

---

## Key script parameters

| Flag | Description |
|---|---|
| `--lat` / `--lon` | Decimal degrees (N+ / E+) |
| `--tz` | IANA timezone, e.g. `Europe/Rome` |
| `--datetime` | Local ISO 8601, e.g. `2026-08-15T23:00`. Omit = now |
| `--direction` | `N \| NE \| E \| SE \| S \| SW \| W \| NW \| any` |
| `--min-alt` | Minimum altitude in degrees (default 20°). Below ~15° atmospheric extinction degrades imaging. |
| `--max-alt` | Zenith exclusion — use `--max-alt 80` when mount or obstructions block overhead sky |
| `--types` | Filter by type: `emission,reflection,planetary,snr,galaxy,globular,open,cluster_nebula` |
| `--max-mag` | Exclude objects fainter than this magnitude |
| `--focal` / `--sensor-w` / `--sensor-h` | Gear parameters (mm) for framing assessment |
| `--top` | Limit output to top N results |
| `--json` | Machine-readable output for post-processing |

---

## Catalog

- **Source**: OpenNGC (CC-BY-SA 4.0) + curated supplement for non-NGC/IC objects
- **Count**: 12 096 objects
- **Coordinates**: equatorial J2000.0 decimal degrees
- **Types**: `emission`, `reflection`, `planetary` (nebulae), `snr` (supernova remnants), `galaxy`, `globular`, `open`, `cluster_nebula`
- **Size overrides**: large complexes (IC 1396, IC 1805, IC 1848, IC 1318) have corrected angular sizes — OpenNGC reports the embedded cluster, not the full nebula

To add an object: edit the curated list in `build_catalog.py` and rerun it, or add an entry directly to `catalog.json` with J2000 coords, type, size in arcmin, and magnitude.

---

## Files

```
astro-visibility/
├── SKILL.md              ← skill definition loaded by Claude Code
├── visibility.py         ← computation engine (run via Bash)
├── catalog.json          ← 12 096 deep-sky objects
└── build_catalog.py      ← catalog builder from OpenNGC source
```

---

## Common sensor dimensions (mm)

| Camera | Width × Height |
|---|---|
| Full frame | 36 × 24 |
| APS-C Canon | 22.3 × 14.9 |
| APS-C Sony/Nikon | 23.5 × 15.7 |
| Micro 4/3 | 17.3 × 13 |
| ASI2600 / IMX571 | 23.5 × 15.7 |
| ASI533 / IMX533 | 11.3 × 11.3 |
| ASI183 / IMX183 | 13.2 × 8.8 |
| ASI294 / IMX294 | 19.1 × 13 |

---

## Notes

- "Astronomical night" = Sun below −18°. On summer nights at high latitudes it may not exist; the script flags this.
- Azimuth convention: 0° = North, 90° = East, 180° = South, 270° = West.
- If you observe regularly from the same site, the skill offers to save your location to memory after the first session.
- Results are presented in the user's language; object designations (M42, NGC 7000 …) are never translated.
