#!/usr/bin/env python3
"""
Phase 0 for the JPJ open-data car registrations (data.gov.my).

Answers, from the real file rather than the docs:
  1. What columns actually exist, and how much of each is null.
  2. THE decisive question: is this NEW registrations only, or does it
     include ownership transfers (pindah milik)? Three independent tests.
  3. Are the model strings clean enough to join onto CAR_DATA, or is
     that a hand-curation project?
  4. Is `colour` a small controlled vocabulary that maps onto our
     COLOURS list (src/config/marketplaceConfig.js:48)?
  5. How big would the proposed rollup tables be?

Usage:
    pip install pandas pyarrow
    python3 tools/jpj/jpj_phase0.py 2024
    python3 tools/jpj/jpj_phase0.py 2024 --keep      # keep the parquet
    python3 tools/jpj/jpj_phase0.py /path/to/file.parquet

Writes tools/jpj/phase0-report.md. That file is the deliverable - it is
small and safe to commit or paste back. The parquet itself is not.
"""
import os
import sys
import io
import urllib.request
import contextlib

URL = "https://storage.data.gov.my/transportation/cars_{year}.parquet"

# Nameplates that stopped being sold NEW in Malaysia many years ago.
# If these show up in a recent year, the file is not new-registrations-only.
DISCONTINUED = [
    "WIRA", "WAJA", "GEN-2", "GEN2", "SAVVY", "SATRIA", "ARENA",
    "KANCIL", "KELISA", "KENARI", "VIVA",
    "WISH", "ESTIMA", "MARK X", "AVANZA",
    "STREAM", "JAZZ", "ODYSSEY",
    "LATIO", "GRAND LIVINA", "TEANA", "SYLPHY",
]

# Malaysian new passenger-car market, approximate. Total industry volume
# runs ~700-820k vehicles a year including commercials, so passenger cars
# land roughly 600-750k. Treat as a band, not a number.
TIV_LOW, TIV_HIGH = 600_000, 800_000


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def resolve_source(arg):
    """Return (local_path, label, downloaded_bool)."""
    if arg.endswith(".parquet") or os.path.sep in arg:
        if not os.path.exists(arg):
            die("no such file: " + arg)
        return arg, os.path.basename(arg), False
    if not (arg.isdigit() and len(arg) == 4):
        die("pass a 4-digit year (e.g. 2024) or a path to a .parquet file")
    url = URL.format(year=arg)
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cars_%s.parquet" % arg)
    if os.path.exists(dest):
        print("using cached %s" % dest)
        return dest, os.path.basename(dest), False
    print("downloading %s" % url)
    try:
        urllib.request.urlretrieve(url, dest)
    except Exception as e:
        die("download failed (%s).\nIf that URL 404s, open\n  "
            "https://data.gov.my/data-catalogue/registration_transactions_car\n"
            "and use the Download button, then re-run with the file path." % e)
    return dest, os.path.basename(dest), True


def vc(df, col, top=None):
    """Value counts as a list of (value, count), safely."""
    if col not in df.columns:
        return []
    s = df[col].value_counts(dropna=False)
    if top:
        s = s.head(top)
    return list(s.items())


def main():
    if len(sys.argv) < 2:
        die("usage: python3 tools/jpj/jpj_phase0.py <year|path.parquet> [--keep]")
    keep = "--keep" in sys.argv
    arg = [a for a in sys.argv[1:] if not a.startswith("--")][0]

    try:
        import pandas as pd
    except ImportError:
        die("pandas is not installed. Run:  pip install pandas pyarrow")

    path, label, downloaded = resolve_source(arg)
    size_mb = os.path.getsize(path) / 1e6
    print("reading %s (%.1f MB)" % (label, size_mb))
    df = pd.read_parquet(path)
    n = len(df)
    out = io.StringIO()
    w = lambda s="": out.write(s + "\n")

    w("# JPJ car registrations - phase 0 report")
    w()
    w("Source file: `%s` (%.1f MB, %s rows)" % (label, size_mb, format(n, ",")))
    w()

    # ---------- 1. columns ----------
    w("## 1. Columns as they actually are")
    w()
    w("| column | dtype | nulls | distinct | sample values |")
    w("|---|---|---|---|---|")
    for c in df.columns:
        nulls = int(df[c].isna().sum())
        try:
            distinct = int(df[c].nunique(dropna=True))
        except TypeError:
            distinct = -1
        samples = [str(v) for v in df[c].dropna().head(3).tolist()]
        w("| `%s` | %s | %s (%.1f%%) | %s | %s |" % (
            c, df[c].dtype, format(nulls, ","), 100.0 * nulls / max(n, 1),
            format(distinct, ",") if distinct >= 0 else "?",
            ", ".join(samples)[:60]))
    w()

    date_col = next((c for c in ("date_reg", "date", "reg_date") if c in df.columns), None)
    if date_col:
        d = pd.to_datetime(df[date_col], errors="coerce")
        w("Date range on `%s`: **%s to %s**" % (date_col, d.min(), d.max()))
        w()

    # ---------- 2. the decisive question ----------
    w("## 2. New registrations only, or transfers too?")
    w()
    w("This decides how much the whole project is worth. Three independent tests.")
    w()

    # test A - volume
    w("### Test A - volume against the new-car market")
    w()
    w("Malaysia registers roughly %s-%s new passenger cars a year." % (
        format(TIV_LOW, ","), format(TIV_HIGH, ",")))
    w("This file has **%s rows**." % format(n, ","))
    if n < TIV_LOW * 0.6:
        verdict_a = "BELOW the new-car band - partial year, or a filtered subset."
    elif n <= TIV_HIGH * 1.25:
        verdict_a = "MATCHES the new-car band - points to NEW REGISTRATIONS ONLY."
    else:
        verdict_a = ("WELL ABOVE the new-car band (%.1fx the top of it) - points to "
                     "TRANSFERS BEING INCLUDED." % (n / float(TIV_HIGH)))
    w()
    w("Reading: **%s**" % verdict_a)
    w()

    # test B - discontinued nameplates
    w("### Test B - nameplates that are no longer sold new")
    w()
    model_col = next((c for c in ("model", "model_name") if c in df.columns), None)
    hits = []
    dead_rows = 0
    if model_col:
        up = df[model_col].astype(str).str.upper()
        for nameplate in DISCONTINUED:
            # word-boundary match: "VIVA" must not fire inside "VIVACE".
            pat = r"\b" + nameplate.replace("-", r"[- ]?") + r"\b"
            c = int(up.str.contains(pat, regex=True, na=False).sum())
            if c:
                hits.append((nameplate, c))
        hits.sort(key=lambda t: -t[1])
        dead_rows = int(up.str.contains(
            "|".join(r"\b" + h[0].replace("-", r"[- ]?") + r"\b" for h in hits),
            regex=True, na=False).sum()) if hits else 0
    dead_pct = 100.0 * dead_rows / max(n, 1)

    if not model_col:
        w("No model column found - test skipped.")
        verdict_b = "inconclusive"
    elif not hits:
        w("None of the %d dead nameplates appear at all. Strong signal for" % len(DISCONTINUED))
        w("**NEW REGISTRATIONS ONLY**.")
        verdict_b = "new only"
    else:
        w("%d of %d dead nameplates appear, covering **%s rows (%.2f%% of the file)**:" % (
            len(hits), len(DISCONTINUED), format(dead_rows, ","), dead_pct))
        w()
        w("| nameplate | rows | share |")
        w("|---|---|---|")
        for nm, c in hits[:15]:
            w("| %s | %s | %.2f%% |" % (nm, format(c, ","), 100.0 * c / max(n, 1)))
        w()
        if dead_pct >= 2.0 and len(hits) >= 3:
            w("A Proton Wira or Perodua Kancil cannot be registered NEW in a recent")
            w("year - they stopped being built over a decade ago. At this volume and")
            w("spread, that means **TRANSFERS ARE INCLUDED**, which makes this the")
            w("actual used market.")
            verdict_b = "transfers included"
        else:
            w("Too few and too scattered to conclude much. A trickle of dead")
            w("nameplates is consistent with new-registration data - old unsold")
            w("stock and rebuilt/imported units do get first-registered late.")
            w("Treat as **NEW REGISTRATIONS ONLY, leaning uncertain**, and let")
            w("test A break the tie.")
            verdict_b = "new only (weak)"
    w()

    # test C - concentration
    w("### Test C - shape of the model mix")
    w()
    if model_col:
        top10 = df[model_col].value_counts().head(10)
        share = 100.0 * top10.sum() / max(n, 1)
        w("Top 10 models are %.1f%% of all rows." % share)
        w()
        w("| model | rows | share |")
        w("|---|---|---|")
        for m, c in top10.items():
            w("| %s | %s | %.1f%% |" % (m, format(c, ","), 100.0 * c / max(n, 1)))
        w()
        w("New-registration data tracks what is on sale this year. Transfer data")
        w("tracks the whole car parc, so it skews to whatever was sold in huge")
        w("numbers years ago (Myvi, Axia, Saga).")
    w()

    w("### Combined reading")
    w()
    w("- Test A (volume): %s" % verdict_a)
    w("- Test B (dead nameplates): **%s**" % verdict_b)
    w()
    w("If the two disagree, trust test B - a Kancil in a recent year is a fact,")
    w("whereas the volume band is my approximation of the new-car market and")
    w("could simply be wrong.")
    w()

    # ---------- 3. model strings ----------
    w("## 3. Model strings - how much mapping work is this?")
    w()
    if model_col:
        nd = df[model_col].nunique()
        w("**%s distinct model strings.**" % format(nd, ","))
        w()
        cum = df[model_col].value_counts()
        for k in (50, 100, 200, 500):
            if k <= len(cum):
                w("- Top %d models cover %.1f%% of rows." % (
                    k, 100.0 * cum.head(k).sum() / max(n, 1)))
        w()
        w("That last figure is the budget: if the top 200 cover 90%+, the mapping")
        w("table is an afternoon, not a project.")
        w()
        w("### Top 60 models verbatim")
        w()
        w("```")
        for m, c in cum.head(60).items():
            w("%-42s %s" % (str(m)[:42], format(c, ",")))
        w("```")
        w()
        w("### 40 random models from the long tail")
        w()
        tail = cum.tail(max(len(cum) - 200, 0))
        if len(tail):
            samp = tail.sample(min(40, len(tail)), random_state=1)
            w("```")
            for m, c in samp.items():
                w("%-42s %s" % (str(m)[:42], format(c, ",")))
            w("```")
        w()

    # ---------- 4. colour ----------
    w("## 4. Colour - the column the whole feature rests on")
    w()
    colour_col = next((c for c in ("colour", "color") if c in df.columns), None)
    if not colour_col:
        w("**No colour column in this file.** That kills the headline feature -")
        w("re-check the catalogue page before going further.")
    else:
        cc = vc(df, colour_col)
        w("**%d distinct values.** Full list, in order:" % len(cc))
        w()
        w("| value | rows | share |")
        w("|---|---|---|")
        for v, c in cc[:40]:
            w("| %s | %s | %.2f%% |" % (v, format(c, ","), 100.0 * c / max(n, 1)))
        w()
        w("Ours (`COLOURS`, src/config/marketplaceConfig.js:48): White, Black,")
        w("Silver, Grey, Red, Blue, Brown, Green, Orange, Yellow, Gold, Maroon.")
        w("If the list above is Malay (putih/hitam/perak) it is still a 12-ish")
        w("value lookup, not a problem.")
    w()

    # ---------- 5. other vocabularies ----------
    w("## 5. Remaining vocabularies")
    w()
    for col in ("maker", "state", "fuel", "type"):
        if col not in df.columns:
            continue
        items = vc(df, col, top=25)
        w("### `%s` - %s distinct" % (col, format(df[col].nunique(), ",")))
        w()
        w("```")
        for v, c in items:
            w("%-32s %s (%.1f%%)" % (str(v)[:32], format(c, ","), 100.0 * c / max(n, 1)))
        w("```")
        if col == "state":
            rn = int(df[col].astype(str).str.contains("Rakan", case=False, na=False).sum())
            w()
            w("`Rakan Niaga` rows: **%s (%.1f%%)** - these have no usable state," % (
                format(rn, ","), 100.0 * rn / max(n, 1)))
            w("so any state-level feature has to exclude them and say so.")
        w()

    # ---------- 6. rollup sizing ----------
    w("## 6. How big are the proposed rollups?")
    w()
    if date_col:
        df["_month"] = pd.to_datetime(df[date_col], errors="coerce").dt.to_period("M").astype(str)
    grains = []
    if date_col and colour_col and model_col:
        g1 = [c for c in ("_month", "maker", model_col, "state", colour_col) if c in df.columns]
        grains.append(("reg_colour_month", g1))
    if date_col and model_col:
        g2 = [c for c in ("_month", "maker", model_col, "state", "fuel", "type") if c in df.columns]
        grains.append(("reg_model_month", g2))
    if grains:
        w("| rollup | grain | rows for THIS year |")
        w("|---|---|---|")
        for name, cols in grains:
            rows = df.groupby(cols, dropna=False).size().shape[0]
            w("| `%s` | %s | %s |" % (name, " x ".join(c.strip("_") for c in cols),
                                      format(rows, ",")))
        w()
        w("Multiply by the number of years kept. Anything over a few million rows")
        w("total means the grain is too fine and `state` should come out of the")
        w("colour rollup.")
    w()

    # ---------- 7. does the target feature compute? ----------
    w("## 7. Proof the headline feature is computable")
    w()
    if model_col and colour_col:
        top_model = df[model_col].value_counts().index[0]
        sub = df[df[model_col] == top_model]
        w("Colour split for **%s** (%s rows) in this file:" % (
            top_model, format(len(sub), ",")))
        w()
        w("```")
        for v, c in sub[colour_col].value_counts().head(12).items():
            w("%-20s %6s  %5.1f%%" % (str(v)[:20], format(c, ","), 100.0 * c / max(len(sub), 1)))
        w("```")
        w()
        w("That percentage is the badge. If it reads sensibly, phase 0 passed.")
    w()

    report = out.getvalue()
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "phase0-report.md")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(report)
    print(report)
    print("\nwrote %s" % dest)

    if downloaded and not keep:
        os.remove(path)
        print("removed %s (pass --keep to retain it)" % os.path.basename(path))


if __name__ == "__main__":
    main()
