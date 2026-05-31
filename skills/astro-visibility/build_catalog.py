#!/usr/bin/env python3
"""
build_catalog.py - Build scripts/catalog.json from the full OpenNGC database.

Source: OpenNGC by Mattia Verga - https://github.com/mattiaverga/OpenNGC
(CC-BY-SA-4.0). All imaging-relevant types are included (galaxies, clusters,
nebulae, planetary nebulae, SNRs) with no magnitude or size cutoff.

Two passes:
  1. CURATED: hand-picked objects from the TARGETS dict - applied first,
     providing common names and type/size overrides where OpenNGC is generic.
  2. BULK: all remaining imaging-type rows not already in the curated set.

Run:  python3 build_catalog.py
"""

import csv, json, os, urllib.request

BASE = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/"
HERE = os.path.dirname(os.path.abspath(__file__))

IMG_TYPES = {"G","GPair","GTrpl","GGroup","GCl","OCl","PN","HII","EmN","Neb","RfN","SNR","Cl+N"}

# ── Curated targets: common names + occasional type/size overrides ────────────
TARGETS = {
    "M42": {"name":"Orion Nebula","type":"emission"},
    "M43": {"name":"De Mairan's Nebula"},
    "M78": {"name":"M78","type":"reflection"},
    "M1":  {"name":"Crab"},
    "M27": {"name":"Dumbbell"},  "M57": {"name":"Ring"},
    "M97": {"name":"Owl"},       "M31": {"name":"Andromeda"},
    "M33": {"name":"Triangulum"},"M51": {"name":"Whirlpool"},
    "M63": {"name":"Sunflower"}, "M94": {"name":"M94"},
    "M106":{"name":"M106"},      "M101":{"name":"Pinwheel"},
    "M81": {"name":"Bode's"},    "M82": {"name":"Cigar"},
    "M108":{"name":"M108"},      "M109":{"name":"M109"},
    "M64": {"name":"Black Eye"}, "M104":{"name":"Sombrero"},
    "M87": {"name":"Virgo A"},   "M84": {"name":"M84"},
    "M86": {"name":"M86"},       "M49": {"name":"M49"},
    "M65": {"name":"Leo Triplet (M65)"}, "M66":{"name":"Leo Triplet (M66)"},
    "M95": {"name":"M95"},   "M96": {"name":"M96"},   "M105":{"name":"M105"},
    "M83": {"name":"Southern Pinwheel"},
    "M13": {"name":"Hercules"},  "M92": {"name":"M92"},
    "M3":  {"name":"M3"},        "M5":  {"name":"M5"},
    "M15": {"name":"M15"},       "M22": {"name":"M22"},
    "M4":  {"name":"M4"},        "M2":  {"name":"M2"},
    "M45": {"name":"Pleiades"},  "M44": {"name":"Beehive"},
    "M35": {"name":"M35"},       "M36": {"name":"M36"},
    "M37": {"name":"M37"},       "M38": {"name":"M38"},
    "M11": {"name":"Wild Duck"}, "M6":  {"name":"Butterfly"},
    "M7":  {"name":"Ptolemy"},   "M34": {"name":"M34"},
    "M52": {"name":"M52"},       "M16": {"name":"Eagle"},
    "M17": {"name":"Omega"},     "M8":  {"name":"Lagoon"},
    "M20": {"name":"Trifid"},
    "NGC2024":{"name":"Flame"},
    "NGC2237":{"name":"Rosette","type":"emission"},
    "NGC2244":{"name":"Rosette Cluster"},
    "NGC2264":{"name":"Cone / Christmas Tree"},
    "NGC281": {"name":"Pacman"},
    "NGC7635":{"name":"Bubble"},
    "NGC7789":{"name":"Caroline's Rose"},
    "NGC869": {"name":"Double Cluster (h Per)"},
    "NGC884": {"name":"Double Cluster (chi Per)"},
    "NGC1499":{"name":"California"},
    "NGC7000":{"name":"North America"},
    "NGC6888":{"name":"Crescent"},
    "NGC6960":{"name":"Western Veil"},
    "NGC6992":{"name":"Eastern Veil"},
    "NGC7027":{"name":"NGC7027"},
    "NGC6543":{"name":"Cat's Eye"},
    "NGC7293":{"name":"Helix"},
    "NGC6334":{"name":"Cat's Paw"},
    "NGC891": {"name":"NGC891"},
    "NGC3628":{"name":"Hamburger"},
    "NGC4565":{"name":"Needle"},
    "NGC4889":{"name":"Coma Cluster"},
    "NGC6946":{"name":"Fireworks"},
    "NGC7380":{"name":"Wizard"},
    "NGC7023":{"name":"Iris","type":"reflection"},
    "NGC5139":{"name":"Omega Centauri"},
    # IC — size overrides where OpenNGC gives embedded cluster, not nebula extent
    "IC434": {"name":"Horsehead","type":"emission"},
    "IC405": {"name":"Flaming Star"},
    "IC410": {"name":"Tadpoles"},
    "IC443": {"name":"Jellyfish","type":"snr"},
    "IC1396":{"name":"Elephant's Trunk","type":"emission","size":170},
    "IC1805":{"name":"Heart","type":"emission","size":150},
    "IC1848":{"name":"Soul","type":"emission","size":150},
    "IC5070":{"name":"Pelican","type":"emission"},
    "IC1318":{"name":"Gamma Cygni / Sadr","type":"emission","size":180},
}

# ── Objects absent from OpenNGC (e.g. Sharpless), with cited coordinates ─────
SUPPLEMENT = [
    {"id":"Sh2-129","name":"Squid / Flying Bat","type":"emission",
     "ra_deg":317.95,"dec_deg":59.95,"size_arcmin":150,"mag":None,
     "constellation":"Cep","_source":"Wikipedia/SIMBAD J2000"},
]

TYPE_MAP = {
    "G":"galaxy","GPair":"galaxy","GTrpl":"galaxy","GGroup":"galaxy",
    "GCl":"globular","OCl":"open","PN":"planetary",
    "HII":"emission","EmN":"emission","Neb":"emission",
    "RfN":"reflection","SNR":"snr","Cl+N":"cluster_nebula",
}

def fetch(name):
    for p in (os.path.join(HERE,name), os.path.join("/tmp",name)):
        if os.path.exists(p): return open(p,encoding="utf-8").read()
    print(f"  downloading {name} ...")
    return urllib.request.urlopen(BASE+name).read().decode("utf-8")

def load_rows():
    rows, messier = {}, {}
    for fn in ("NGC.csv","addendum.csv"):
        for r in csv.DictReader(fetch(fn).splitlines(), delimiter=';'):
            rows[r["Name"].upper()] = r
            if r.get("M","").strip():
                messier["M"+str(int(r["M"]))] = r["Name"].upper()
    return rows, messier

def ra_to_deg(s):
    h,m,sec = s.split(":"); return (int(h)+int(m)/60+float(sec)/3600)*15

def dec_to_deg(s):
    sign = -1 if s.strip()[0]=="-" else 1
    d,m,sec = s.strip().lstrip("+-").split(":")
    return sign*(int(d)+int(m)/60+float(sec)/3600)

def mag_val(r):
    m = r.get("V-Mag","").strip() or r.get("B-Mag","").strip()
    return float(m) if m else None

def size_val(r):
    s = r.get("MajAx","").strip(); return round(float(s),1) if s else None

def make_id(r):
    """Clean id: prefer M## if Messier, else strip leading zeros. Fall back to raw name."""
    if r.get("M","").strip(): return "M"+str(int(r["M"]))
    n = r["Name"]
    try:
        if n.startswith("NGC"): return "NGC"+str(int(n[3:]))
        if n.startswith("IC"):  return "IC"+str(int(n[2:]))
    except ValueError:
        pass   # e.g. "NGC0080 NED01" — keep raw name
    return n.replace(" ","_")

def first_common_name(r):
    cn = r.get("Common names","").strip()
    return cn.split(",")[0].strip() if cn else ""

def resolve(tid, rows, messier):
    if tid.startswith("M") and tid[1:].isdigit():
        key = messier.get(tid)
    elif tid.startswith("NGC"): key = "NGC%04d"%int(tid[3:])
    elif tid.startswith("IC"):  key = "IC%04d"%int(tid[2:])
    else: key = tid.upper()
    if not key or key.upper() not in rows: return None
    row = rows[key.upper()]
    seen = 0
    while row["Type"]=="Dup" and seen<3:
        seen+=1
        ref = (("NGC%04d"%int(row["NGC"])) if row.get("NGC","").strip()
               else ("IC%04d"%int(row["IC"])) if row.get("IC","").strip() else None)
        if ref and ref in rows: row=rows[ref]
        else: break
    return row

def main():
    rows, messier = load_rows()
    out = []
    included_names = set()   # OpenNGC Name.upper() already added

    # Pass 1: curated
    missing = []
    for tid, meta in TARGETS.items():
        row = resolve(tid, rows, messier)
        if row is None: missing.append(tid); continue
        rname = row["Name"].upper()
        otype = meta.get("type") or TYPE_MAP.get(row["Type"],"emission")
        size  = meta.get("size") or size_val(row)
        out.append({"id":tid, "name":meta["name"], "type":otype,
                    "ra_deg":round(ra_to_deg(row["RA"]),4),
                    "dec_deg":round(dec_to_deg(row["Dec"]),4),
                    "size_arcmin":size, "mag":mag_val(row),
                    "constellation":row.get("Const","")})
        included_names.add(rname)

    # Pass 2: bulk — ALL imaging-type rows not yet included
    for rname, row in rows.items():
        if rname in included_names: continue
        if row["Type"] not in IMG_TYPES: continue
        if row["Type"]=="Dup": continue
        oid  = make_id(row)
        cn   = first_common_name(row)
        name = cn if cn else oid
        out.append({"id":oid, "name":name, "type":TYPE_MAP[row["Type"]],
                    "ra_deg":round(ra_to_deg(row["RA"]),4),
                    "dec_deg":round(dec_to_deg(row["Dec"]),4),
                    "size_arcmin":size_val(row), "mag":mag_val(row),
                    "constellation":row.get("Const","")})
        included_names.add(rname)

    # Supplement
    for s in SUPPLEMENT:
        out.append({k:s[k] for k in ("id","name","type","ra_deg","dec_deg",
                                      "size_arcmin","mag","constellation")})

    out.sort(key=lambda o:(o["type"],o["id"]))
    catalog = {
        "_meta":{
            "description":"Full deep-sky catalog for astrophotography planning.",
            "source":"OpenNGC (github.com/mattiaverga/OpenNGC, CC-BY-SA-4.0) "
                     "+ sourced supplement for non-NGC/IC objects.",
            "coordinates":"Equatorial J2000.0, decimal degrees.",
            "overrides":"Size corrected for large complexes (IC1396, IC1805, IC1848, "
                        "IC1318) where OpenNGC reports the embedded cluster.",
            "count":len(out),
        },
        "objects":out,
    }
    path = os.path.join(HERE,"catalog.json")
    with open(path,"w",encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False)   # compact: no indent for 12k objects
    print(f"Wrote {len(out)} objects to {path}  ({os.path.getsize(path)//1024} KB)")
    if missing: print("UNRESOLVED:", missing)

if __name__=="__main__":
    main()
