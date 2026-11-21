#!/usr/bin/env python3
"""
stocklist.py - weekly dealer stock-list PDF -> Drevo (listings stay with the app's importer).

What it does (run on your own laptop; nothing is kept on disk except two small login files):
  explain    show what it takes from the PDF and where each thing goes (run this first, read-only)
  parse      read the PDF, check it, write a clean CSV of the cars still for sale
  tidy       re-split model / variant / engine / body on cars already in the app (dry run unless --yes)
  status     compare the PDF with the database (read only)
  create     TEST: make REAL listings + photos for the first 5 qualifying cars (--limit N, --dry-run, --status available)
  photos     for cars that exist but have no photos: download from the private Drive
             folders with YOUR Google login, shrink, upload to Supabase, save the URLs
  unpublish  cars the PDF marks SOLD but that are still live -> status 'unpublished'
  login      one-time Supabase login (paste the session from your browser)
  google     one-time Google login for Drive (read-only)

Cars are matched on the CHASSIS number (the PDF has no plates), stored in car_listings.vin.
Photos are processed ONE AT A TIME in memory: no image is ever saved to disk.
No service-role key is used: everything goes through your own dealer login, so the database
rules apply exactly as in the app. Setup + steps: tools/stocklist/README.md
"""
import argparse, csv, hashlib, io, json, os, re, sys, time
from pathlib import Path

CFG_DIR = Path(os.environ.get("DREVO_STOCK_DIR", Path.home() / ".drevo_stock"))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://lemdkdizdlcirhbzqlos.supabase.co")
BUCKET = "car-images"
MIN_PHOTOS = 10         # owner rule (2026-11-21): a folder with fewer usable photos is NOT imported
MAX_PHOTOS = 60         # ALL photos in the folder are taken; 60 is only a safety ceiling against a runaway folder
LONG_SIDE = 1600
WEBP_QUALITY = 78
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
REDIRECT = "http://localhost:1/"   # never loads; you copy the address bar (see README)
DRIVE = "https://www.googleapis.com/drive/v3"

# Left edge of each column on the PDF page (points). The generator uses one layout; parse()
# fails loudly if a row stops looking right, so a layout change is never imported silently.
COLS = [("brand", 20), ("model", 60), ("spec", 133), ("year", 198), ("reg", 222), ("ap", 250),
        ("chassis", 267), ("co", 340), ("colour", 358), ("mileage", 395), ("options", 440),
        ("arr", 660), ("remarks", 680), ("base", 760), ("price", 790)]
BRANDS = {"BMW": "BMW", "MINI": "MINI", "LAND ROVER": "Land Rover", "BYD": "BYD"}
COUNTRY = {"JP": "Japan", "UK": "UK", "MY": "Malaysia"}


# ---------------------------------------------------------------- PDF
def parse(pdf_path):
    import pdfplumber
    rows, problems = [], []
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            tables = page.find_tables()
            if not tables:
                continue
            words = page.extract_words()
            for trow in tables[0].rows:
                x0, top, x1, bot = trow.bbox
                inside = [w for w in words if top <= (w["top"] + w["bottom"]) / 2 <= bot]
                if not inside or any(w["text"] == "BRAND" for w in inside):
                    continue
                cells = {k: [] for k, _ in COLS}
                for w in sorted(inside, key=lambda w: (round(w["top"]), w["x0"])):
                    col = [k for k, left in COLS if left - 2 <= w["x0"]][-1]
                    cells[col].append(w["text"])
                r = {k: " ".join(v).strip() for k, v in cells.items()}
                links = [h["uri"] for h in page.hyperlinks
                         if top <= (h["top"] + h["bottom"]) / 2 <= bot and h.get("uri")]
                r["drive"] = links[0] if links else ""
                r["page"] = pno
                why = _check(r)
                if why:
                    problems.append(f"page {pno}: {why}: {r['brand']} {r['model']} {r['chassis']}")
                    continue
                rem = r["remarks"].upper()
                r["sold"] = rem.startswith("SOLD")
                r["arrived"] = r["arr"].upper() == "Y"
                r["eta"] = "ETA" in rem
                r["vin"] = re.sub(r"\s+", "", r["chassis"]).upper()
                r["price_rm"] = int(round(float(r["price"].replace(",", "")) * 1000))
                r["mileage_km"] = int(r["mileage"].replace(",", "")) if r["mileage"] else None
                rows.append(r)
    return rows, problems


def _check(r):
    if not re.fullmatch(r"20\d\d|19\d\d", r["year"]): return "year not a year"
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9-]{5,}", r["chassis"].replace(" ", "")): return "chassis looks wrong"
    if not re.fullmatch(r"\d+(\.\d)?", r["price"].replace(",", "")): return "price not a number"
    if r["mileage"] and not re.fullmatch(r"[\d,]+", r["mileage"]): return "mileage not a number"
    return ""


def brand_name(b):
    return BRANDS.get(b.upper(), b.title())


# ---------------------------------------------------------------- one clean field per fact
# The PDF writes model, engine, body and trim in a different mix on every row ("CIVIC 2.0L(T) HATCHBACK" +
# "TYPE R", "NX250 2.5L" + "VERSION L"). Each fact gets its OWN field, so cars can be searched and ranked:
#   model (Civic) | variant = trim only (Type R) | year | engine_cc (2000) | body_type (Hatchback) | fuel_type
# Lexus keeps its model number at the front of the variant ("250 Version L"): NX 250 and NX 350 are different cars.
# Anything the rules get wrong is fixed once in model_map.csv (next to this file), not in the code.
BODY_WORDS = {"HATCHBACK": "Hatchback", "SEDAN": "Sedan", "COUPE": "Coupe", "MPV": "MPV", "PICKUP": "Pickup"}
# Only models where the body type is not in doubt. Values must be in BODY_TYPES (src/config/marketplaceConfig.js).
MODEL_BODY = {"ALPHARD": "MPV", "VELLFIRE": "MPV", "STEPWAGON": "MPV", "HARRIER": "SUV", "NX": "SUV", "RX": "SUV",
              "GX": "SUV", "LAND CRUISER": "SUV", "GR YARIS": "Hatchback", "CAYENNE": "SUV", "MACAN": "SUV", "JIMNY": "SUV", "DEFENDER": "SUV", "COUNTRYMAN": "SUV"}
TWO_WORD_MODELS = ("MOVE CANBUS", "LAND CRUISER", "FAIRLADY Z", "GR YARIS")
UPPER_OK = {"JCW", "AMG", "GT", "RS", "GR", "SUV", "MPV", "III", "II", "IV"}
CASE_FIX = {"SDRIVE": "sDrive", "XDRIVE": "xDrive", "20I": "20i"}
LEXUS_RE = re.compile(r"^(IS|ES|GS|LS|UX|NX|RX|GX|LX|RC|LC)\s*(\d{3}h?)$", re.I)
ENGINE_RE = re.compile(r"(\d\.\d)\s*L?\s*(\(T\)|TURBO)?", re.I)


def _title(s):
    out = []
    for t in re.split(r"[\s\-()]+", s.strip()):
        if not t: continue
        u = t.upper()
        if u in CASE_FIX: out.append(CASE_FIX[u])
        elif len(t) <= 2 or u in UPPER_OK: out.append(u)
        elif re.search(r"\d", t): out.append(t)
        else: out.append(t.capitalize())
    return " ".join(out)


def _take(text):
    """Pull engine size, turbo, hybrid and body words out of a text. Returns (rest, litres, turbo, hybrid, body)."""
    litres = turbo = hybrid = body = None
    m = ENGINE_RE.search(text)
    if m:
        litres, turbo = float(m.group(1)), bool(m.group(2))
        text = text[:m.start()] + " " + text[m.end():]
    if re.search(r"\bHYBRID\b", text, re.I):
        hybrid = True
        text = re.sub(r"\bHYBRID\b", " ", text, flags=re.I)
    for word, label in BODY_WORDS.items():
        if re.search(rf"\b{word}\b", text, re.I):
            body = label
            text = re.sub(rf"\b{word}\b", " ", text, flags=re.I)
    return " ".join(text.split()), litres, turbo, hybrid, body


def load_overrides():
    p = Path(__file__).with_name("model_map.csv")
    if not p.exists(): return {}
    with open(p, newline="", encoding="utf-8") as f:
        return {(x["brand"].strip().upper(), x["raw_model"].strip().upper(), x["raw_spec"].strip().upper()): x
                for x in csv.DictReader(f) if x.get("brand")}


OVERRIDES = load_overrides()


def clean_car(r):
    brand = brand_name(r["brand"])
    m_rest, l1, t1, h1, b1 = _take(r["model"])
    s_rest, l2, t2, h2, b2 = _take(r["spec"])
    litres, turbo, hybrid, body = l1 or l2, t1 or t2, h1 or h2, b1 or b2
    toks, front = m_rest.split(), []
    if brand == "Lexus" and toks and LEXUS_RE.match(toks[0]):
        g = LEXUS_RE.match(toks[0])
        model, front, toks = g.group(1).upper(), [g.group(2)], toks[1:]
    else:
        two = next((w for w in TWO_WORD_MODELS if m_rest.upper().startswith(w)), None)
        if two:
            model, toks = _title(two), m_rest[len(two):].split()
        else:
            model, toks = (_title(toks[0]) if toks else ""), toks[1:]
    variant = _title(" ".join(front + toks + s_rest.split()))
    out = {"brand": brand, "model": model, "variant": variant, "body_type": body or MODEL_BODY.get(model.upper(), ""),
           "engine_cc": int(round(litres * 1000)) if litres else "", "fuel_type": "Hybrid" if hybrid else "",
           "turbo": bool(turbo), "source": "rules"}
    ov = OVERRIDES.get((brand.upper(), r["model"].strip().upper(), r["spec"].strip().upper()))
    if ov:
        for k in ("model", "variant", "body_type"):
            if ov.get(k, "").strip(): out[k] = ov[k].strip()
        out["source"] = "model_map.csv"
    return out


def arrival_text(r):
    return "arrived" if r["arrived"] else ("coming " + r["remarks"] if r["eta"] else "not arrived")


def reg_text(r):
    m = re.fullmatch(r"([A-Za-z]{3})(?:\s+(\d{1,2}))?", r["reg"].strip())
    if not m: return f"{r['reg']} {r['year']}".strip()
    return (f"{m.group(2)} " if m.group(2) else "") + f"{m.group(1).title()} {r['year']}"


CSV_COLS = ["brand", "model", "variant", "year", "engine_cc", "body_type", "fuel_type", "price", "mileage", "colour",
            "vin", "import_country", "condition", "registration_date", "options", "arrival"]


def csv_row(r):
    c = clean_car(r)
    return {"brand": c["brand"], "model": c["model"], "variant": c["variant"], "year": r["year"],
            "engine_cc": c["engine_cc"], "body_type": c["body_type"], "fuel_type": c["fuel_type"],
            "price": r["price_rm"], "mileage": r["mileage_km"] if r["mileage_km"] is not None else "",
            "colour": r["colour"].title(), "vin": r["vin"], "import_country": COUNTRY.get(r["co"].upper(), ""),
            "condition": "recon", "registration_date": reg_text(r), "options": r["options"],
            "arrival": arrival_text(r)}


def write_csv(rows, path):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS)
        w.writeheader()
        for r in rows: w.writerow(csv_row(r))


def summary(rows, problems):
    sold = [r for r in rows if r["sold"]]
    live = [r for r in rows if not r["sold"]]
    vins = [r["vin"] for r in rows]
    dup = sorted({v for v in vins if vins.count(v) > 1})
    print(f"{len(rows)} cars read | {len(live)} for sale | {len(sold)} sold | "
          f"{sum(1 for r in live if not r['arrived'])} for sale but not arrived yet")
    print(f"photo links: {sum(1 for r in rows if r['drive'])} of {len(rows)} cars")
    if dup: print("DUPLICATE chassis numbers:", ", ".join(dup))
    if problems:
        print(f"{len(problems)} rows did not look right and were skipped:")
        for p in problems[:15]: print("  ", p)
    return not problems and not dup


# ---------------------------------------------------------------- Supabase (plain REST)
def _cfg(name):
    p = CFG_DIR / name
    return json.loads(p.read_text()) if p.exists() else None


def _save(name, data):
    CFG_DIR.mkdir(parents=True, exist_ok=True)
    p = CFG_DIR / name
    p.write_text(json.dumps(data))
    os.chmod(p, 0o600)


def anon_key():
    k = os.environ.get("SUPABASE_ANON_KEY")
    if not k:
        sys.exit("Set SUPABASE_ANON_KEY (the public anon key, same as VITE_SUPABASE_ANON_KEY in Vercel).")
    return k


class Supa:
    def __init__(self):
        import requests
        self.http = requests.Session()
        s = _cfg("supabase.json")
        if not s: sys.exit("Not logged in. Run: python stocklist.py login")
        self._refresh(s["refresh_token"])

    def _refresh(self, refresh_token):
        r = self.http.post(f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
                           headers={"apikey": anon_key()}, json={"refresh_token": refresh_token}, timeout=30)
        if r.status_code != 200:
            sys.exit("Login expired. Log in on the website, then run: python stocklist.py login")
        d = r.json()
        _save("supabase.json", {"refresh_token": d["refresh_token"]})
        self.token, self.uid, self.born = d["access_token"], d["user"]["id"], time.time()

    def h(self, extra=None):
        if time.time() - self.born > 2700:   # tokens last an hour; renew at 45 min
            self._refresh(_cfg("supabase.json")["refresh_token"])
        return {"apikey": anon_key(), "Authorization": f"Bearer {self.token}", **(extra or {})}

    def my_listings(self):
        out, start = [], 0
        while True:
            r = self.http.get(f"{SUPABASE_URL}/rest/v1/car_listings", timeout=60,
                              params={"select": "id,vin,vin_number,status,images,brand,model,variant,year,engine_cc,body_type,fuel_type",
                                      "dealer_id": f"eq.{self.uid}", "order": "id"},
                              headers=self.h({"Range": f"{start}-{start + 999}"}))
            r.raise_for_status()
            page = r.json()
            out += page
            if len(page) < 1000: return out
            start += 1000

    def patch(self, listing_id, body, only_status=None):
        params = {"id": f"eq.{listing_id}", "dealer_id": f"eq.{self.uid}"}
        if only_status: params["status"] = f"eq.{only_status}"
        r = self.http.patch(f"{SUPABASE_URL}/rest/v1/car_listings", params=params, json=body, timeout=60,
                            headers=self.h({"Prefer": "return=representation"}))
        r.raise_for_status()
        return len(r.json()) == 1   # RLS refuses with 0 rows and no error: always check

    def upload(self, path, data):
        r = self.http.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}", data=data, timeout=120,
                           headers=self.h({"Content-Type": "image/webp", "x-upsert": "true"}))
        r.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


def db_index(listings):
    idx = {}
    for l in listings:
        for v in (l.get("vin"), l.get("vin_number")):
            if v: idx[re.sub(r"\s+", "", v).upper()] = l
    return idx


# ---------------------------------------------------------------- Google Drive (read only)
def google_token():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    d = _cfg("google.json")
    if not d: sys.exit("No Google login. Run: python stocklist.py google")
    creds = Credentials.from_authorized_user_info(d, SCOPES)
    if not creds.valid:
        creds.refresh(Request())
        _save("google.json", json.loads(creds.to_json()))
    return creds.token


def drive_id(url):
    m = re.search(r"/folders/([\w-]+)", url) or re.search(r"[?&]id=([\w-]+)", url) or re.search(r"/file/d/([\w-]+)", url)
    return m.group(1) if m else None


RESKEYS = {}   # folder id -> resourcekey from the link (older Drive shares need it)


def note_reskey(url, fid):
    m = re.search(r"resourcekey=([\w-]+)", url or "")
    if m and fid: RESKEYS[fid] = m.group(1)


def why(r):
    try: e = r.json()["error"]; return f"{r.status_code} {e.get('status','')} {e.get('message','')[:160]}"
    except Exception: return f"{r.status_code} {r.text[:120]}"


def drive_get(http, tok, path, **params):
    for attempt in range(4):
        hdr = {"Authorization": f"Bearer {tok}"}
        if RESKEYS: hdr["X-Goog-Drive-Resource-Keys"] = ",".join(f"{k}/{v}" for k, v in RESKEYS.items())
        r = http.get(f"{DRIVE}/{path}", params={"supportsAllDrives": "true", **params}, headers=hdr, timeout=60)
        if r.status_code in (429, 500, 503): time.sleep(2 ** attempt); continue
        return r
    return r


def folder_images(http, tok, fid, depth=1):
    """Image files in a folder (and one level of sub-folders), sorted by name. HEIC is counted, skipped."""
    out, skipped, token = [], 0, None
    while True:
        r = drive_get(http, tok, "files", q=f"'{fid}' in parents and trashed=false", orderBy="name",
                      pageSize=100, pageToken=token, includeItemsFromAllDrives="true",
                      fields="nextPageToken,files(id,name,mimeType,size)")
        if r.status_code != 200: return out, skipped, "drive " + why(r)
        d = r.json()
        for f in d.get("files", []):
            mt = f.get("mimeType", "")
            if mt in ("image/jpeg", "image/png", "image/webp"): out.append(f)
            elif mt.startswith("image/"): skipped += 1
            elif mt == "application/vnd.google-apps.folder" and depth > 0:
                o, s, _ = folder_images(http, tok, f["id"], depth - 1)
                out += o; skipped += s
        token = d.get("nextPageToken")
        if not token: return out, skipped, ""


def shrink(raw):
    """bytes -> WebP bytes, longest side 1600. One image in memory at a time."""
    from PIL import Image, ImageOps
    im = Image.open(io.BytesIO(raw))
    if im.format == "JPEG": im.draft("RGB", (LONG_SIDE, LONG_SIDE))   # decode small: far less RAM
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((LONG_SIDE, LONG_SIDE))
    out = io.BytesIO()
    im.save(out, "WEBP", quality=WEBP_QUALITY, method=4)
    return out.getvalue()


# ---------------------------------------------------------------- commands
def cmd_parse(a):
    rows, problems = parse(a.pdf)
    ok = summary(rows, problems)
    live = [r for r in rows if not r["sold"]]
    out = a.out or f"stock_{time.strftime('%Y%m%d')}.csv"
    write_csv(live, out)
    print(f"wrote {out} ({len(live)} cars, sold ones left out). Names after SOLD and the BASE column are never exported.")
    return 0 if ok else 1


def cmd_status(a):
    rows, problems = parse(a.pdf)
    summary(rows, problems)
    idx = db_index(Supa().my_listings())
    live = [r for r in rows if not r["sold"]]
    new = [r for r in live if r["vin"] not in idx]
    nophoto = [r for r in live if r["vin"] in idx and not (idx[r["vin"]].get("images") or [])]
    sold_live = [r for r in rows if r["sold"] and r["vin"] in idx and idx[r["vin"]]["status"] == "available"]
    print(f"in the app already: {len(live) - len(new)} | not in the app yet: {len(new)} | "
          f"in the app with no photos: {len(nophoto)} | SOLD in the PDF but still live: {len(sold_live)}")
    return 0


def cmd_explain(a):
    rows, problems = parse(a.pdf)
    print("WHAT IT TAKES FROM THE PDF -> WHAT IT PUTS WHERE")
    print("  PDF column            -> CSV / listing column     rule")
    for l in ("BRAND            -> brand                       as written, tidy case (BMW, MINI, Land Rover kept)",
              "MODEL            -> model                       the base model only (Civic, Alphard, NX); engine and body words removed",
              "MODEL + SPEC     -> variant                     the trim only (Type R, SC, F Sport); Lexus keeps its number first (250 Version L)",
              "engine in MODEL  -> engine_cc                   2.5L -> 2500 (nominal, the PDF gives litres, not exact cc)",
              "HATCHBACK etc.   -> body_type                   only when the PDF says it, or the model is certain (Alphard = MPV)",
              "HYBRID           -> fuel_type                   Hybrid only; otherwise left blank (the PDF never says Petrol or Diesel)",
              "YEAR / REG       -> year, registration_date     year as a number; REG as '27 Jul 2023' or 'Jul 2023'",
              "CHASSIS          -> vin                         exactly as written, spaces removed; this is the match key",
              "C.O. (JP)        -> import_country              JP -> Japan",
              "COLOUR, MILEAGE  -> colour, mileage",
              "OPTIONS          -> options                     the dealer's text, unchanged",
              "ADS PRICE        -> price                       RM'000 x 1000 (219 -> 219000)",
              "ARR / ETA        -> arrival                     arrived / coming <ETA> / not arrived (info only, decide how to show it)",
              "(none)           -> condition                   always 'recon' (imported cars)"):
        print("  " + l)
    print("\nNEVER TAKEN: the name after SOLD, BASE, AP (permit code), the clickable photo link is used for photos only.")
    print(f"PHOTOS: the car's Drive folder -> every JPEG/PNG/WebP inside (one sub-folder level too), sorted by name, up to {MAX_PHOTOS}; "
          f"fewer than {MIN_PHOTOS} = car NOT taken.\n  Each is shrunk to {LONG_SIDE}px WebP and stored at {BUCKET}/<your id>/<listing id>/NN-hash.webp; "
          "the URLs are saved in car_listings.images, in order (the first is the cover).")
    print("\nHOW EVERY KIND OF CAR IS CLEANED (check these; fix a wrong one in model_map.csv):")
    seen = {}
    for r in rows:
        c = clean_car(r)
        k = (r["brand"], r["model"], r["spec"])
        seen.setdefault(k, [c, 0])[1] += 1
    for (b, m, s), (c, n) in sorted(seen.items()):
        flag = "  [model_map.csv]" if c["source"] != "rules" else ""
        print(f"  {n:3}x {b} | {m} | {s}\n        -> model={c['model']} | variant={c['variant']} | body={c['body_type'] or '-'} | "
              f"cc={c['engine_cc'] or '-'} | fuel={c['fuel_type'] or '-'}{' | turbo (no column yet)' if c['turbo'] else ''}{flag}")
    print(f"\n{len(seen)} kinds of car in {len(rows)} rows.")
    return 0


def cmd_tidy(a):
    """Re-split model / variant / engine / body on cars ALREADY in the app (matched by chassis). Dry run unless --yes."""
    rows, _ = parse(a.pdf)
    sb = Supa()
    idx = db_index(sb.my_listings())
    changes = []
    for r in rows:
        l = idx.get(r["vin"])
        if not l: continue
        c = clean_car(r)
        want = {"model": c["model"], "variant": c["variant"]}
        if c["engine_cc"]: want["engine_cc"] = c["engine_cc"]
        if c["body_type"]: want["body_type"] = c["body_type"]
        if c["fuel_type"]: want["fuel_type"] = c["fuel_type"]
        diff = {k: (l.get(k), v) for k, v in want.items() if v and (l.get(k) or "") != v}
        if diff: changes.append((l, r, diff))
    for l, r, diff in changes[:60]:
        print(f"{r['vin']}  " + "; ".join(f"{k}: {o!r} -> {n!r}" for k, (o, n) in diff.items()))
    if len(changes) > 60: print(f"... and {len(changes) - 60} more")
    print(f"{len(changes)} cars already in the app would change (only model, variant, engine_cc, body_type, fuel_type).")
    if not changes or not a.yes: print("Dry run. Add --yes to apply."); return 0
    done = sum(sb.patch(l["id"], {k: n for k, (o, n) in d.items()}) for l, r, d in changes)
    print(f"changed {done} of {len(changes)}")
    return 0


def cmd_unpublish(a):
    rows, _ = parse(a.pdf)
    sb = Supa()
    idx = db_index(sb.my_listings())
    todo = [(r, idx[r["vin"]]) for r in rows if r["sold"] and r["vin"] in idx and idx[r["vin"]]["status"] == "available"]
    for r, l in todo: print(f"  {brand_name(r['brand'])} {r['model']} {r['year']}  {r['vin']}")
    print(f"{len(todo)} live cars are marked SOLD in the PDF.")
    if not todo or not (a.yes or input("Unpublish them? type yes: ").strip() == "yes"): return 0
    done = sum(sb.patch(l["id"], {"status": "unpublished"}, only_status="available") for _, l in todo)
    print(f"unpublished {done} of {len(todo)}")
    return 0


def cmd_photos(a):
    import requests
    rows, _ = parse(a.pdf)
    sb, http = Supa(), requests.Session()
    idx = db_index(sb.my_listings())
    # only cars with NO photos yet: a car that already has photos is never touched or overwritten
    todo = [(r, idx[r["vin"]]) for r in rows if not r["sold"] and r["drive"] and r["vin"] in idx
            and not (idx[r["vin"]].get("images") or [])]
    if a.limit: todo = todo[:a.limit]
    if a.min_photos > a.max_photos: sys.exit("--min-photos cannot be bigger than --max-photos")
    print(f"{len(todo)} cars need photos" + (" (dry run: nothing is downloaded or written)" if a.dry_run else ""))
    if a.dry_run: return 0
    tok, held, failed, uploaded = google_token(), [], [], 0
    for n, (r, l) in enumerate(todo, 1):
        label = f"{brand_name(r['brand'])} {r['model']} {r['vin']}"
        fid = drive_id(r["drive"]); note_reskey(r["drive"], fid)
        if not fid: failed.append((label, "bad link")); continue
        meta = drive_get(http, tok, f"files/{fid}", fields="id,name,mimeType")
        if meta.status_code != 200:
            failed.append((label, f"no access: {why(meta)}")); continue
        mt = meta.json().get("mimeType", "")
        files, skipped, err = ([meta.json()], 0, "") if mt.startswith("image/") else folder_images(http, tok, fid)
        if err: failed.append((label, err)); continue
        # the rule: fewer than --min-photos (10) images in the folder = the car is not taken, nothing downloaded
        if len(files) < a.min_photos:
            held.append((label, f"{len(files)} usable photos" + (f" ({skipped} HEIC skipped)" if skipped else ""))); continue
        files = files[:a.max_photos]
        shrunk = []   # all shrunk photos of ONE car (about 10 x 300 KB) are held in memory, so a car is all or nothing
        for f in files:
            try:
                d = http.get(f"{DRIVE}/files/{f['id']}", params={"alt": "media", "supportsAllDrives": "true"},
                             headers={"Authorization": f"Bearer {tok}"}, timeout=120)
                if d.status_code != 200 or len(d.content) > 40_000_000: continue
                shrunk.append(shrink(d.content))
            except Exception as e:
                print(f"    skipped one file: {type(e).__name__}")
        if len(shrunk) < a.min_photos:   # some files failed: do not upload a half set
            held.append((label, f"only {len(shrunk)} of {len(files)} photos could be read")); continue
        urls = []
        for i, data in enumerate(shrunk, 1):
            name = f"{i:02d}-{hashlib.sha1(data).hexdigest()[:8]}.webp"   # new name per change: no stale CDN copy
            urls.append(sb.upload(f"{sb.uid}/{l['id']}/{name}", data))
        ok = sb.patch(l["id"], {"images": urls})
        uploaded += len(urls) if ok else 0
        print(f"[{n}/{len(todo)}] {label}: {len(urls)} photos" + ("" if ok else "  DATABASE REFUSED THE UPDATE"))
        if not ok: failed.append((label, "database refused the update"))
        time.sleep(0.3)
    print(f"\ndone: {uploaded} photos saved | NOT taken (under {a.min_photos} photos): {len(held)} | failed: {len(failed)}")
    for lab, reason in held + failed: print("  -", lab, "-", reason)
    return 0


WARRANTY_MONTHS = 60       # owner: every listing in this account gets 60 months
PAYMENT_TYPE = "loan"      # owner: financing shows "loan", not "cash only"


def markup_for(base):
    """Owner's rule: selling price = PDF price (the base) + RM3k..5k by price band. Edit markup.csv."""
    p = Path(__file__).with_name("markup.csv")
    tiers = sorted((int(r["price_from"]), int(r["markup"])) for r in csv.DictReader(open(p, encoding="utf-8")))
    m = tiers[0][1]
    for lo, mk in tiers:
        if base >= lo: m = mk
    return m


def guess_fuel(r, c):
    """Only what the PDF or the car itself tells us. Unsure -> blank (never a wrong fuel)."""
    if c["fuel_type"]: return c["fuel_type"]
    t = f"{r['model']} {r['spec']}".upper()
    if re.search(r"DIESEL|\bEV\b|ELECTRIC|PHEV|HYBRID", t): return None
    if c["brand"] in ("BYD", "Land Rover"): return None
    return "Petrol" if re.search(r"\d\.\dL", r["spec"].upper()) else None


def guess_transmission(c):
    if c["brand"] == "Honda" and c["model"] == "Civic" and (c["variant"] or "").upper().startswith("TYPE R"): return "Manual"
    return "Auto"


def looks_like_auction_sheet(raw):
    """Mostly white paper, almost no colour, scattered dark text. Used only to push such photos to the END."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)); im.draft("RGB", (320, 320))
        im = im.convert("RGB").resize((160, 160))
        g = im.convert("L").histogram(); n = 160 * 160
        white = sum(g[210:]) / n; dark = sum(g[:100]) / n
        sat = sum(im.convert("HSV").split()[1].histogram()[i] * i for i in range(256)) / n
        return white > 0.6 and sat < 30 and 0.04 < (1 - white) < 0.4
    except Exception:
        return False


def _slug(r, c):
    base = re.sub(r"[^a-z0-9]+", "-", " ".join(str(x) for x in (r["year"], c["brand"], c["model"], c["variant"]) if x).lower()).strip("-")
    return (base or "car") + "-" + hashlib.sha1((r["vin"] + str(time.time())).encode()).hexdigest()[:5]


def cmd_create(a):
    """TEST RUN: create REAL listings (with photos) for the first --limit cars that qualify. Photos are checked BEFORE a row is made."""
    import requests
    rows, _ = parse(a.pdf)
    sb, http = Supa(), requests.Session()
    have = db_index([l for l in sb.my_listings() if l.get("status") != "archived"])
    prof = http.get(f"{SUPABASE_URL}/rest/v1/profiles", params={"select": "state,city", "id": f"eq.{sb.uid}"}, headers=sb.h()).json()
    prof = prof[0] if prof else {}
    print(f"location for every car (from your dealer profile): {prof.get('city')}, {prof.get('state')}")
    todo = [r for r in rows if not r["sold"] and r["drive"] and r["vin"] not in have]
    print(f"{len(todo)} cars are for sale, have a photo link and are not in the app yet. "
          f"Will create at most {a.limit}, status '{a.status}'" + (" (dry run)" if a.dry_run else ""))
    tok, made, held = google_token(), 0, []
    for r in todo:
        if made >= a.limit: break
        c = clean_car(r)
        label = f"{brand_name(r['brand'])} {r['model']} {r['year']} {r['vin']}"
        fid = drive_id(r["drive"]); note_reskey(r["drive"], fid)
        print(f"checking {label} ...", flush=True)
        meta = drive_get(http, tok, f"files/{fid}", fields="id,name,mimeType") if fid else None
        if meta is None or meta.status_code != 200:
            held.append((label, "cannot open the Drive folder: " + (why(meta) if meta is not None else "no folder id in link " + r["drive"][:80]))); continue
        mt = meta.json().get("mimeType", "")
        files, skipped, err = ([meta.json()], 0, "") if mt.startswith("image/") else folder_images(http, tok, fid)
        if err or len(files) < a.min_photos:
            held.append((label, err or f"{len(files)} photos, needs {a.min_photos}")); continue
        files = files[:MAX_PHOTOS]
        base = int(r["price_rm"]); mk = markup_for(base)
        row = {"slug": _slug(r, c), "brand": c["brand"], "model": c["model"], "variant": c["variant"] or None,
               "year": r["year"], "selling_price": base + mk, "mileage": r["mileage_km"],
               "colour": r["colour"].title(), "engine_cc": c["engine_cc"] or None, "body_type": c["body_type"] or None,
               "fuel_type": guess_fuel(r, c), "transmission": guess_transmission(c),
               "condition": "recon", "is_recon": True, "import_country": COUNTRY.get(r["co"].upper()),
               "vin": r["vin"], "vin_number": r["vin"], "registration_date": reg_text(r),
               "options": r["options"] or None, "warranty_months": WARRANTY_MONTHS, "payment_type": PAYMENT_TYPE,
               "state": prof.get("state"), "city": prof.get("city"), "dealer_id": sb.uid, "status": a.status}
        print(f"    (PDF base RM{base:,} + markup RM{mk:,} = asking RM{base + mk:,})")
        print(f"\n--- {label}: {len(files)} photos in folder")
        for k, v in row.items(): print(f"    {k:15} {v}")
        if a.dry_run: made += 1; continue
        shrunk = []
        for f in files:
            try:
                d = http.get(f"{DRIVE}/files/{f['id']}", params={"alt": "media", "supportsAllDrives": "true"},
                             headers={"Authorization": f"Bearer {tok}"}, timeout=120)
                if d.status_code == 200 and len(d.content) <= 40_000_000:
                    shrunk.append((looks_like_auction_sheet(d.content), f["name"], shrink(d.content)))
            except Exception as e:
                print(f"    skipped one file: {type(e).__name__}")
        if len(shrunk) < a.min_photos:
            held.append((label, f"only {len(shrunk)} photos could be read")); continue
        sheets = [n for sh, n, _ in shrunk if sh]
        shrunk = [d for sh, n, d in shrunk if not sh] + [d for sh, n, d in shrunk if sh]   # auction sheets go LAST
        if sheets: print(f"    looks like an auction sheet, moved to the end: {', '.join(sheets)}")
        ins = http.post(f"{SUPABASE_URL}/rest/v1/car_listings", json=row, timeout=60,
                        headers=sb.h({"Prefer": "return=representation"}))
        if ins.status_code >= 300:
            held.append((label, f"database refused: {ins.text[:200]}")); continue
        lid = ins.json()[0]["id"]
        try:
            urls = [sb.upload(f"{sb.uid}/{lid}/{i:02d}-{hashlib.sha1(d).hexdigest()[:8]}.webp", d) for i, d in enumerate(shrunk, 1)]
            ok = sb.patch(lid, {"images": urls})
            if not ok: raise RuntimeError("database refused the photo update")
        except Exception as e:
            sb.patch(lid, {"status": "archived"})   # never leave a half-made car live
            held.append((label, f"photos failed ({e}); car archived")); continue
        sp = http.patch(f"{SUPABASE_URL}/rest/v1/stock_units", params={"listing_id": f"eq.{lid}", "dealer_id": f"eq.{sb.uid}"},
                        json={"purchase_price": base}, headers=sb.h({"Prefer": "return=representation"}))
        su = sp.json() if sp.status_code < 300 else []
        made += 1
        print(f"    CREATED id {lid}: {len(urls)} photos, base price saved on the stock record: {'yes' if su else 'NO (set it in the app)'}")
    print(f"\ndone: {made} cars {'shown' if a.dry_run else 'created'} | not taken: {len(held)}")
    for lab, reason in held: print("  -", lab, "-", reason)
    return 0


def cmd_login(a):
    print("1. Sign in at https://drevo.my/login with the dealer account.\n"
          "2. Press F12, Application tab, Local Storage, drevo.my. Copy the VALUE of the key that starts with sb- and ends with -auth-token.\n"
          "3. Paste it here and press Enter.")
    raw = input("> ").strip()
    try: tok = json.loads(raw)["refresh_token"]
    except Exception: sys.exit("That is not the session JSON (it should contain refresh_token).")
    _save("supabase.json", {"refresh_token": tok})
    Supa()
    print("Logged in. Do not use that browser tab again for now: the script now owns that session.")
    return 0


def cmd_google(a):
    from google_auth_oauthlib.flow import Flow
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    secret = Path(a.client_secret or CFG_DIR / "client_secret.json")
    if not secret.exists(): sys.exit(f"Put the Google OAuth file at {secret} (README step 2).")
    flow = Flow.from_client_secrets_file(str(secret), scopes=SCOPES, redirect_uri=REDIRECT)
    url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    print("Open this in your browser, allow read-only Drive access:\n\n" + url +
          "\n\nThe next page will fail to load (that is expected). Copy the full address from the address bar and paste it here.")
    flow.fetch_token(authorization_response=input("> ").strip())
    _save("google.json", json.loads(flow.credentials.to_json()))
    print("Google login saved.")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("parse", cmd_parse), ("explain", cmd_explain), ("status", cmd_status), ("tidy", cmd_tidy),
                     ("photos", cmd_photos), ("create", cmd_create), ("unpublish", cmd_unpublish)):
        p = sub.add_parser(name); p.add_argument("pdf"); p.set_defaults(fn=fn)
        if name == "parse": p.add_argument("--out")
        if name == "photos":
            p.add_argument("--limit", type=int); p.add_argument("--dry-run", action="store_true")
            p.add_argument("--max-photos", type=int, default=MAX_PHOTOS); p.add_argument("--min-photos", type=int, default=MIN_PHOTOS)
        if name == "create":
            p.add_argument("--limit", type=int, default=5); p.add_argument("--dry-run", action="store_true")
            p.add_argument("--min-photos", type=int, default=MIN_PHOTOS)
            p.add_argument("--status", default="unpublished", choices=["unpublished", "available"])
        if name in ("unpublish", "tidy"): p.add_argument("--yes", action="store_true")
    sub.add_parser("login").set_defaults(fn=cmd_login)
    g = sub.add_parser("google"); g.add_argument("--client-secret"); g.set_defaults(fn=cmd_google)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == "__main__":
    main()
