#!/usr/bin/env python3
"""
astro-visibility - Vectorized deep-sky visibility engine for astrophotography.

Handles catalogs of any size (tested with the full OpenNGC ~12k objects) via
numpy batch computation. For a given location and instant (real time by default)
computes which objects are observable, with altitude/azimuth, transit, best window
inside the astronomical night, direction filter, zenith exclusion, framing assessment.

Algorithms: Meeus "Astronomical Algorithms". Alt/az < 1 arcmin accuracy.
"""

import argparse, json, math, os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import numpy as np

DEG = math.pi / 180.0
RAD = 180.0 / math.pi

# ── Time ──────────────────────────────────────────────────────────────────────

def julian_date(dt_utc):
    y, m = dt_utc.year, dt_utc.month
    d = dt_utc.day + (dt_utc.hour + dt_utc.minute/60 +
                      (dt_utc.second + dt_utc.microsecond/1e6)/3600) / 24
    if m <= 2: y -= 1; m += 12
    a = y // 100
    return (math.floor(365.25*(y+4716)) + math.floor(30.6001*(m+1))
            + d + (2-a+a//4) - 1524.5)

def gmst_deg(jd):
    t = (jd - 2451545.0) / 36525.0
    return (280.46061837 + 360.98564736629*(jd-2451545.0)
            + 0.000387933*t*t - t*t*t/38710000.0) % 360.0

def lst_deg(jd, lon): return (gmst_deg(jd) + lon) % 360.0

# ── Scalar alt/az (used for current-instant display) ─────────────────────────

def altaz_scalar(ra, dec, lst, lat):
    H = (lst - ra) * DEG
    d, p = dec*DEG, lat*DEG
    sa = math.sin(p)*math.sin(d) + math.cos(p)*math.cos(d)*math.cos(H)
    alt = math.asin(max(-1, min(1, sa))) * RAD
    az = (math.atan2(math.sin(H), math.cos(H)*math.sin(p)
                     - math.tan(d)*math.cos(p)) * RAD + 180) % 360
    return alt, az

# ── Sun position (Meeus ch.25, ~0.01 deg — for twilight only) ────────────────

def sun_radec(jd):
    t = (jd-2451545.0)/36525
    L0 = (280.46646+36000.76983*t+0.0003032*t*t) % 360
    M = (357.52911+35999.05029*t-0.0001537*t*t) % 360
    Mr = M*DEG
    C = ((1.914602-0.004817*t-0.000014*t*t)*math.sin(Mr)
         +(0.019993-0.000101*t)*math.sin(2*Mr)+0.000289*math.sin(3*Mr))
    om = 125.04-1934.136*t
    lm = (L0+C-0.00569-0.00478*math.sin(om*DEG))*DEG
    eps = (23.439291-0.0130042*t+0.00256*math.cos(om*DEG))*DEG
    ra = (math.atan2(math.cos(eps)*math.sin(lm), math.cos(lm))*RAD) % 360
    return ra, math.asin(math.sin(eps)*math.sin(lm))*RAD

def sun_alt(jd, lat, lon):
    ra, dec = sun_radec(jd)
    alt, _ = altaz_scalar(ra, dec, lst_deg(jd, lon), lat)
    return alt

# ── Astronomical night ────────────────────────────────────────────────────────

def _cross(jd0, a0, jd1, a1, thr):
    return jd0 if a1==a0 else jd0 + (thr-a0)/(a1-a0)*(jd1-jd0)

def find_dark_window(jd_start, lat, lon, sun_thr=-18.0, hours=24, step_min=2):
    n = int(hours*60/step_min)+1
    jds = [jd_start+i*step_min/1440 for i in range(n)]
    alts = [sun_alt(j, lat, lon) for j in jds]
    below = [a < sun_thr for a in alts]
    if all(below):  return jds[0], jds[-1]
    if not any(below): return None, None
    starts, ends = [], []
    for i in range(1, n):
        if below[i] and not below[i-1]: starts.append(_cross(jds[i-1],alts[i-1],jds[i],alts[i],sun_thr))
        if not below[i] and below[i-1]:  ends.append(_cross(jds[i-1],alts[i-1],jds[i],alts[i],sun_thr))
    ds = jds[0] if not starts else starts[0]
    de = next((e for e in ends if e > ds), jds[-1])
    return ds, de

# ── Analytic transit ──────────────────────────────────────────────────────────

def transit_alt_analytic(dec_deg, lat_deg):
    """Upper culmination altitude (degrees). Can be < 0 for objects below horizon."""
    return 90.0 - abs(lat_deg - dec_deg)

def transit_jd_analytic(ra_deg, lon_deg, jd_ref):
    """JD of upper transit nearest to jd_ref."""
    deg_to_next = (ra_deg - lst_deg(jd_ref, lon_deg)) % 360.0
    jd_next = jd_ref + deg_to_next / 360.98564736629
    jd_prev = jd_next - 360.0/360.98564736629
    return jd_next if abs(jd_next-jd_ref) < abs(jd_prev-jd_ref) else jd_prev

# ── Direction ─────────────────────────────────────────────────────────────────

DIRECTIONS = {
    "N":(0,45),"NE":(45,22.5),"E":(90,45),"SE":(135,22.5),
    "S":(180,45),"SW":(225,22.5),"W":(270,45),"NW":(315,22.5),
}

def az_to_compass(az):
    return ["N","NNE","NE","ENE","E","ESE","SE","SSE",
            "S","SSW","SW","WSW","W","WNW","NW","NNW"][int((az+11.25)%360/22.5)]

TYPE_LABEL = {
    "emission":"em.neb","reflection":"refl.neb","planetary":"pl.neb",
    "snr":"SNR","dark":"dark.neb","galaxy":"galaxy",
    "globular":"glob.cl","open":"open.cl","cluster_nebula":"cl+neb",
}

# ── Framing ───────────────────────────────────────────────────────────────────

def fov_arcmin(sensor_mm, focal_mm):
    return 2*math.atan(sensor_mm/(2*focal_mm))*RAD*60

def framing(size, fw, fh):
    if not size or not fw: return "unknown size", 0
    f = size / min(fw, fh)
    if f>1.2: return "too large (overflows)", f
    if f>0.85: return "very large (fills frame)", f
    if f>=0.20: return "ideal framing", f
    if f>=0.06: return "small in frame", f
    return "very small (point-like)", f

# ── Numpy batch visibility ────────────────────────────────────────────────────

def batch_visibility(objects, lat, lon, jd_start, jd_end, step_min,
                     min_alt, max_alt, direction):
    """
    Vectorized computation over all objects × all dark-window timesteps.
    Returns {obj_index: (jd, alt_deg, az_deg)} for the best qualifying moment.
    """
    n_steps = max(2, int((jd_end - jd_start)*1440/step_min)+1)
    d_arr = np.linspace(0, (jd_end-jd_start), n_steps)
    jd_arr = jd_start + d_arr                                # (n_steps,)

    # Vectorized LST (degrees)
    d0 = jd_arr - 2451545.0
    T  = d0 / 36525.0
    gmst = (280.46061837 + 360.98564736629*d0
            + 0.000387933*T*T - T*T*T/38710000.0) % 360.0
    lst_arr = (gmst + lon) % 360.0                           # (n_steps,)

    ra  = np.array([o["ra_deg"]  for o in objects])          # (n_obj,)
    dec = np.array([o["dec_deg"] for o in objects])

    lat_r = lat * DEG
    dec_r = dec * DEG                                        # (n_obj,)

    # Hour angle: (n_obj, n_steps)
    H = (lst_arr[np.newaxis,:] - ra[:,np.newaxis]) * DEG

    # Altitude (n_obj, n_steps)
    sin_alt = (np.sin(lat_r)*np.sin(dec_r)[:,np.newaxis]
               + np.cos(lat_r)*np.cos(dec_r)[:,np.newaxis]*np.cos(H))
    alt = np.degrees(np.arcsin(np.clip(sin_alt,-1,1)))

    # Azimuth
    az_s = np.arctan2(np.sin(H),
                      np.cos(H)*np.sin(lat_r)
                      - np.tan(dec_r)[:,np.newaxis]*np.cos(lat_r))
    az = (np.degrees(az_s) + 180.0) % 360.0

    # Altitude mask
    mask = alt >= min_alt
    if max_alt is not None:
        mask &= alt <= max_alt

    # Direction mask
    if direction and direction.lower() != "any":
        d = direction.upper()
        if d in DIRECTIONS:
            center, half = DIRECTIONS[d]
            diff = np.abs(((az - center + 180.0) % 360.0) - 180.0)
            mask &= diff <= half

    # Best per object
    results = {}
    # Mask alt for argmax: where mask False set to -999
    masked_alt = np.where(mask, alt, -999.0)
    any_valid = np.any(mask, axis=1)                         # (n_obj,)
    valid_idx = np.where(any_valid)[0]
    best_idx = np.argmax(masked_alt[valid_idx], axis=1)
    for ii, obj_i in enumerate(valid_idx):
        ti = best_idx[ii]
        results[int(obj_i)] = (float(jd_arr[ti]),
                               float(alt[obj_i, ti]),
                               float(az[obj_i, ti]))
    return results

# ── Formatting ────────────────────────────────────────────────────────────────

def jd_to_local(jd, tz):
    return datetime.fromtimestamp((jd-2440587.5)*86400,
                                  tz=timezone.utc).astimezone(tz)

def hhmm(jd, tz): return "-" if jd is None else jd_to_local(jd,tz).strftime("%H:%M")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Deep-sky visibility planning (numpy batch).")
    ap.add_argument("--lat",      type=float, required=True, help="Latitude N+")
    ap.add_argument("--lon",      type=float, required=True, help="Longitude E+")
    ap.add_argument("--tz",       default="UTC")
    ap.add_argument("--datetime", default=None,
                    help="Local ISO e.g. 2026-08-15T23:00. Default: now (real time)")
    ap.add_argument("--direction",default="any", help="N|NE|E|SE|S|SW|W|NW|any")
    ap.add_argument("--min-alt",  type=float, default=20.0)
    ap.add_argument("--max-alt",  type=float, default=None,
                    help="Max altitude — use to exclude zenith zone (e.g. 80)")
    ap.add_argument("--types",    default=None,
                    help="emission,reflection,planetary,snr,galaxy,globular,open,cluster_nebula")
    ap.add_argument("--max-mag",  type=float, default=None)
    ap.add_argument("--focal",    type=float, default=None)
    ap.add_argument("--sensor-w", type=float, default=None)
    ap.add_argument("--sensor-h", type=float, default=None)
    ap.add_argument("--step-min", type=float, default=5.0,
                    help="Sampling resolution in minutes (default 5, fine for planning)")
    ap.add_argument("--top",      type=int, default=15)
    ap.add_argument("--catalog",  default=None)
    ap.add_argument("--json",     action="store_true")
    args = ap.parse_args()

    try: tz = ZoneInfo(args.tz)
    except Exception: tz = timezone.utc; args.tz = "UTC"

    if args.datetime:
        dt = datetime.fromisoformat(args.datetime)
        dt = dt.replace(tzinfo=tz) if dt.tzinfo is None else dt
        dt_utc = dt.astimezone(timezone.utc)
    else:
        dt_utc = datetime.now(timezone.utc)
    jd_now = julian_date(dt_utc.replace(tzinfo=None))

    cat_path = args.catalog or os.path.join(os.path.dirname(__file__), "catalog.json")
    with open(cat_path, encoding="utf-8") as f:
        catalog = json.load(f)["objects"]

    # Apply type / mag pre-filters before batch (reduces work)
    types = set(t.strip() for t in args.types.split(",")) if args.types else None
    filtered = [o for o in catalog
                if (not types or o["type"] in types)
                and (args.max_mag is None or o.get("mag") is None
                     or o["mag"] <= args.max_mag)]

    fov_w = fov_h = None
    if args.focal and args.sensor_w and args.sensor_h:
        fov_w = fov_arcmin(args.sensor_w, args.focal)
        fov_h = fov_arcmin(args.sensor_h, args.focal)

    jd_dark_start, jd_dark_end = find_dark_window(jd_now - 6/24, args.lat, args.lon)
    if jd_dark_start is None:
        eff_start = eff_end = None
    else:
        eff_start = max(jd_dark_start, jd_now) if jd_now > jd_dark_start else jd_dark_start
        eff_end   = jd_dark_end

    # Batch computation
    results = []
    if eff_start is not None and filtered:
        batch = batch_visibility(filtered, args.lat, args.lon,
                                 eff_start, eff_end, args.step_min,
                                 args.min_alt, args.max_alt, args.direction)
        lst_now = lst_deg(jd_now, args.lon)
        for i, obj in enumerate(filtered):
            if i not in batch:
                continue
            bj, ba, baz = batch[i]
            alt_now, az_now = altaz_scalar(obj["ra_deg"], obj["dec_deg"],
                                           lst_now, args.lat)
            t_alt = transit_alt_analytic(obj["dec_deg"], args.lat)
            t_jd  = transit_jd_analytic(obj["ra_deg"], args.lon, jd_now)
            entry = {
                "id": obj["id"], "name": obj["name"], "type": obj["type"],
                "constellation": obj.get("constellation",""),
                "mag": obj.get("mag"), "size_arcmin": obj.get("size_arcmin"),
                "alt_now": alt_now, "az_now": az_now,
                "transit_alt": t_alt, "transit_jd": t_jd,
                "best_jd": bj, "best_alt": ba, "best_az": baz,
            }
            if fov_w:
                lbl, frac = framing(obj.get("size_arcmin"), fov_w, fov_h)
                entry["framing"] = lbl; entry["framing_frac"] = frac
            results.append(entry)

    def score(e):
        # Altitude capped at 70 deg: above that all targets are "well placed",
        # so mag/size/framing break the tie rather than a lucky meridian transit
        s = min(e["best_alt"], 70.0)
        mag = e.get("mag")
        sz  = e.get("size_arcmin") or 0
        # Magnitude: penalise faint objects; no extra credit for very bright
        if mag is not None:
            s -= max(0.0, mag - 10.0) * 3
        elif sz == 0:
            s -= 25   # no mag AND no size: unknown object, push to bottom
        else:
            s -= 5    # no mag but known size: mild penalty
        # Size bonus: up to +10 for large angular targets
        s += min(10.0, sz / 3.0)
        # Framing bonus (when FOV is known)
        if "framing_frac" in e:
            f = e["framing_frac"]
            if 0.20 <= f <= 0.85:  s += 15
            elif 0.06 <= f <= 1.2: s +=  5
            else:                   s -= 10
        return s
    results.sort(key=score, reverse=True)
    results = results[:args.top]

    meta = {
        "location": {"lat": args.lat, "lon": args.lon, "tz": args.tz},
        "instant_local": jd_to_local(jd_now, tz).strftime("%Y-%m-%d %H:%M %Z"),
        "dark_start": hhmm(jd_dark_start, tz), "dark_end": hhmm(jd_dark_end, tz),
        "direction": args.direction, "min_alt": args.min_alt, "max_alt": args.max_alt,
        "catalog_objects": len(catalog), "after_filters": len(filtered),
        "fov": (f"{fov_w:.1f}' x {fov_h:.1f}'" if fov_w else None),
    }

    if args.json:
        out = {"meta": meta, "objects": []}
        for e in results:
            o = dict(e); o["best_time"] = hhmm(e["best_jd"],tz)
            o["transit_time"] = hhmm(e["transit_jd"],tz)
            o.pop("best_jd",None); o.pop("transit_jd",None)
            out["objects"].append(o)
        print(json.dumps(out, indent=2, ensure_ascii=False)); return

    # Table output
    print(f"\nLocation : lat {args.lat:+.3f}, lon {args.lon:+.3f}  ({args.tz})")
    print(f"Instant  : {meta['instant_local']}")
    if jd_dark_start is None:
        print("Night    : no astronomical darkness tonight (Sun stays above -18 deg)")
    else:
        print(f"Night    : {meta['dark_start']} -> {meta['dark_end']}")
    dirtxt = "any" if args.direction.lower()=="any" else args.direction.upper()
    altrange = f"{args.min_alt:.0f}" + (f"-{args.max_alt:.0f} (zenith excluded)" if args.max_alt else "+")
    print(f"Filter   : dir={dirtxt}  alt={altrange} deg")
    print(f"Catalog  : {meta['after_filters']} objects (of {meta['catalog_objects']} total)")
    if meta["fov"]: print(f"FOV      : {meta['fov']}  (focal {args.focal:.0f}mm)")
    print()

    if not results:
        print("No object meets the constraints. Try widening direction, "
              "lowering --min-alt or removing --max-alt.")
        return

    id_w  = max(9, max((len(e["id"]) for e in results), default=9) + 1)
    nm_w  = 22
    hdr = f"{'ID':<{id_w}}{'Name':<{nm_w}}{'Type':<10}{'Mag':>5}  {'Time':>5}{'Alt':>4}  {'Az':>4} {'dir':>4}"
    if fov_w: hdr += "  Framing"
    print(hdr); print("-"*len(hdr))
    for e in results:
        mag_s = f"{e['mag']:5.1f}" if e["mag"] is not None else "    -"
        line = (f"{e['id']:<{id_w}}{e['name'][:nm_w-1]:<{nm_w}}"
                f"{TYPE_LABEL.get(e['type'],e['type']):<10}"
                f"{mag_s}  "
                f"{hhmm(e['best_jd'],tz):>5}"
                f"{e['best_alt']:>4.0f}  "
                f"{e['best_az']:>4.0f} "
                f"{az_to_compass(e['best_az']):>4}")
        if fov_w: line += f"  {e['framing']}"
        print(line)
    print()

if __name__ == "__main__":
    main()
