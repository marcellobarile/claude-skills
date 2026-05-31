---
name: astro-visibility
description: >
  Computes which deep-sky objects (nebulae, galaxies, clusters) are observable and
  imageable from a given location at a given time, with altitude, azimuth,
  astronomical-night window, rise/set/transit, and framing suggestions based on the
  imaging gear. ALWAYS use this skill when the user asks what is visible/imageable in
  a region of the sky ("what's to the north/south/east/west", "nebulae to the west
  from [place]", "what should I image tonight", "targets for tonight", "objects
  visible from [place]", "what do I avoid because it goes through the zenith"), or for
  any astrophotography session planning that depends on location and time. The skill
  asks for or derives the geolocation, uses real-time clock, and uses the user's gear
  parameters when known, computing everything with a precise Python script (never by
  hand).
---

# Astro Visibility - Observation / astrophotography planning

This skill answers questions of the form "what is visible/imageable in direction X
from location Y, now or at a given time". The astronomical computations (altitude,
azimuth, transit, twilight) **must always be done by the script**, never mentally:
hand calculations are error-prone and precision is the whole point here.

Script: `scripts/visibility.py` (catalog in `scripts/catalog.json`).

> **Output language.** The skill's files and the script output are in English. Present
> the results to the user in the user's own language, per the user's preferences /
> the surrounding instructions. Translate labels and the narrative accordingly; keep
> object designations (M42, NGC 7000, IC 1396...) unchanged.

---

## Workflow

Run the steps in order. Do not skip geolocation or time.

### Step 1 - Determine the geographic location (required)

Location is indispensable. Determine it in this priority order:

1. **Place named in the request** (e.g. "from Gioia del Colle"): obtain its latitude
   and longitude. If you are not certain of them, use `places_search` or a web
   search. **Convention: latitude North positive, longitude East positive** (West =
   negative).
2. **Saved observing site in memory**: if the user's usual imaging site is in
   memory, use it.
3. **Otherwise ask**: explicitly ask where they are observing from (city or
   coordinates). Do not assume a default location.

Also derive the **IANA timezone** from the place (e.g. Italy -> `Europe/Rome`).

Always confirm the location used (e.g. "Gioia del Colle, 40.8N 16.9E, Europe/Rome").

> If the user observes regularly from the same site and it isn't in memory yet, after
> answering offer to save it to memory for next time.

### Step 2 - Determine the instant (real time by default)

- Default: **now**. The script uses the system clock in UTC when `--datetime` is not
  passed: this is the correct behavior for "what can I see now / tonight".
- If the user gives a moment ("tonight at 23:00", "August 15", "in three hours"),
  convert to local ISO and pass it with `--datetime` (e.g. `2026-08-15T23:00`).
- For "tonight" with no time: leave the default. The script still latches onto the
  current night's astronomical-night window and plans within it.

### Step 3 - Imaging gear (if in memory)

Check whether the user's astrophotography gear is in memory: **focal length** (mm)
and **sensor dimensions** (width x height in mm), or a camera model from which to
derive them. If present:

- Pass `--focal`, `--sensor-w`, `--sensor-h`. The script computes the imaged field
  and assesses, per object, whether framing is ideal, too large/small, etc., and
  factors that into the ranking.

If gear is **not** in memory: run anyway (framing assessment is simply omitted).
You may then offer to save the gear to memory to personalize future results.

> Common sensors (mm): Full frame 36x24 - APS-C Canon 22.3x14.9 - APS-C Sony/Nikon
> 23.5x15.7 - Micro 4/3 17.3x13 - ASI2600/IMX571 23.5x15.7 - ASI533/IMX533 11.3x11.3
> - ASI183/IMX183 13.2x8.8 - ASI294/IMX294 19.1x13. When unsure, ask.

### Step 4 - Run the computation

```bash
python3 scripts/visibility.py \
  --lat <LAT> --lon <LON> --tz <TZ> \
  [--datetime <LOCAL_ISO>] \
  --direction <N|NE|E|SE|S|SW|W|NW|any> \
  --min-alt <deg> \
  [--max-alt <deg>] \
  [--types <list>] [--max-mag <m>] \
  [--focal <mm> --sensor-w <mm> --sensor-h <mm>] \
  [--top <n>]
```

Key parameters:

- `--direction`: the requested region of sky. `any` = whole sky.
- `--min-alt`: minimum useful altitude. Default 20 deg. Below ~15-20 deg atmospheric
  extinction and light pollution badly degrade imaging.
- `--max-alt`: **use it to exclude the zenith zone** when the user says they have no
  overhead visibility (obstructions, mount, roof). Typical value `--max-alt 80`. Omit
  it when there is no such constraint.
- `--types`: filter by type (`emission,reflection,planetary,snr,galaxy,globular,open,cluster_nebula`).
  E.g. "nebulae only" -> `emission,reflection,planetary,snr,cluster_nebula`.
- `--max-mag`: exclude objects too faint for the gear/sky.

The script returns, per qualifying object: best time within the dark window,
altitude and azimuth at that time, compass point, and (if gear is given) a framing
verdict. Use `--json` if you need to post-process the data.

### Step 5 - Present the results

- Lead with the **context**: location, instant, astronomical-night window, applied
  constraints (direction, altitude, zenith excluded).
- Then the **table** of best objects.
- Add a short practical note: the top picks, any warnings (low objects, objects that
  overflow the frame, objects that would be in the zenith and were excluded), and
  when to image them.
- Keep it concise and technical. No emoji. Present in the user's language.

---

## Request -> command mapping examples

**"Nebulae to the west from Gioia del Colle, tonight"**
-> location 40.8, 16.9, Europe/Rome - time: default - direction W - nebula types
```
python3 scripts/visibility.py --lat 40.8 --lon 16.9 --tz Europe/Rome \
  --direction W --min-alt 20 --types emission,reflection,planetary,snr,cluster_nebula
```

**"What do I image to the north tonight? I have no zenith visibility"**
-> direction N - zenith exclusion with `--max-alt 80`
```
python3 scripts/visibility.py --lat 40.8 --lon 16.9 --tz Europe/Rome \
  --direction N --min-alt 20 --max-alt 80
```

**"What's good tonight with my setup?"** (gear in memory)
-> direction any - pass focal and sensor
```
python3 scripts/visibility.py --lat 40.8 --lon 16.9 --tz Europe/Rome \
  --direction any --min-alt 25 --focal 530 --sensor-w 23.5 --sensor-h 15.7 --top 20
```

---

## Accuracy notes

- Algorithms based on Meeus, *Astronomical Algorithms*. Alt/az precision well under
  one arcminute; transit/twilight times to the minute. More than enough for planning.
- Catalog coordinates: equatorial J2000.0. Precession over a few years is negligible
  for this purpose.
- "Astronomical night" is defined as Sun below -18 deg. On summer nights at high
  latitudes it may not exist; the script flags this case.
- Conventions: latitude North +, longitude East +, azimuth from North towards East
  (0=N, 90=E, 180=S, 270=W).
- The catalog is built from OpenNGC (authoritative) by `scripts/build_catalog.py`,
  which is reproducible. To add an object, edit the curated list there and rerun it,
  or add an entry directly to `catalog.json` (J2000 coords, type, size in arcmin,
  magnitude).
