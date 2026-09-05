# JPJ car registrations - phase 0

Decides whether the data.gov.my car-registration dataset is worth building
on, before any schema or UI exists. See IDEA-5 in `TODO.md`.

**This cannot run in a Claude web session** - `data.gov.my`, `api.data.gov.my`
and `storage.data.gov.my` are all blocked by the egress proxy (403 on CONNECT),
through both curl and WebFetch. Run it on your own machine.

Phase 0 is **finished** - the answers are in IDEA-5 in `TODO.md`, and the
feature is built (see "Refreshing the data" below). This script is kept for
re-checking a full year locally; the live pipeline does not use it.

## Run

```bash
pip install pandas pyarrow
python3 tools/jpj/jpj_phase0.py 2024
```

It downloads `https://storage.data.gov.my/transportation/cars_2024.parquet`,
prints a report and writes `tools/jpj/phase0-report.md`. The parquet is deleted
afterwards unless you pass `--keep`. If the URL has changed, grab the file from
the Download button on
<https://data.gov.my/data-catalogue/registration_transactions_car>
and pass the path instead:

```bash
python3 tools/jpj/jpj_phase0.py ~/Downloads/cars_2024.parquet
```

Parquet and CSV files in this folder are gitignored - they are hundreds of MB
and must never be committed. `phase0-report.md` is small and is the thing to
share.

## What it answers

1. The real column list, dtypes and null rates - not what the docs claim.
2. **New registrations only, or ownership transfers too?** Three independent
   tests (row volume against the new-car market, presence of nameplates that
   stopped being sold new years ago, and the shape of the model mix). If it
   includes transfers, this is the actual used market and worth far more than
   the plan currently assumes.
3. Whether the model strings can be joined onto `CAR_DATA`, or whether that
   is a hand-curation project. Prints the top 60 verbatim plus a long-tail
   sample.
4. Whether `colour` is a small controlled vocabulary that maps onto `COLOURS`
   (`src/config/marketplaceConfig.js:48`).
5. How many rows the two proposed rollups would hold per year.
6. A worked colour split for the most common model - the number that would
   become the stock-unit badge.

## Note on the tests

Test A's new-car volume band (600-800k passenger cars a year) is approximate.
Test B is the stronger evidence: a Perodua Kancil cannot be registered new in
a recent year. Where they disagree, the report says to trust B.


---

# Refreshing the live data

Phase 0 is done and the pipeline is live. There are **no secrets anywhere** -
data.gov.my needs no key, no auth and no registration, so nothing goes in
Vercel or Supabase env vars.

Supabase's own network is not blocked (only this sandbox is), so the database
fetches the file itself with `pg_net`. The whole 50 MB CSV lands in one
request; no chunking is needed.

Two steps, and they must be **two separate transactions** - `pg_net` delivers
the response asynchronously, so a single transaction will never see it.

```sql
-- 1. Fire the fetch. Note the returned request id.
select net.http_get(
  'https://storage.data.gov.my/transportation/cars_2026.csv',
  timeout_milliseconds := 120000
);

-- 2. A few seconds later, in a NEW statement, parse it in.
select * from public.reg_load_response(<request_id>, 2026);
```

`reg_load_response` deletes that year first, so re-running it is safe and
picks up revisions to an already-loaded year. It reports source rows, rows
skipped as malformed, and rollup rows written, and logs the same to
`reg_ingest_log`.

Run it monthly for the current year. data.gov.my publishes roughly a month in
arrears - as of Sep 2026 the latest complete month was July 2026.

## Loaded so far

2023, 2024, 2025, 2026 (to July). 3.05M registrations, 52,571 rollup rows,
zero malformed rows across all four years.

## Gotchas

- `reg_load_response` is SECURITY DEFINER and destructive (it deletes a year
  before reloading). Execute is **service role only** - do not grant it to
  `authenticated`, and note that Supabase's default privileges re-grant
  EXECUTE to `anon` on every newly created function, so a plain
  `revoke ... from public` is not enough. Verify with
  `has_function_privilege('anon', ...)`, never by reading the migration back.
- `net._http_response` only keeps responses for a short window. If step 2 says
  "request not found", just re-run step 1.
- Do not select `content` from `net._http_response` to inspect it - it is 50 MB.
  Use `length(content)` and `status_code`.
- JPJ does not break out performance variants: a BMW M4 is counted inside
  "4 Series". The UI says so rather than showing a zero.
