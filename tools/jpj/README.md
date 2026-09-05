# JPJ car registrations - phase 0

Decides whether the data.gov.my car-registration dataset is worth building
on, before any schema or UI exists. See IDEA-5 in `TODO.md`.

**This cannot run in a Claude web session** - `data.gov.my`, `api.data.gov.my`
and `storage.data.gov.my` are all blocked by the egress proxy (403 on CONNECT),
through both curl and WebFetch. Run it on your own machine.

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
