# Filling in the car spec table

`src/utils/carSpecs.js` prefills the technical half of a listing, and it covers
**57 of the 345 brand+model pairs** the form offers. 288 are missing — 83% of
the catalogue. Whole brands return nothing: BMW, Audi, Mercedes, Hyundai, Kia,
Lexus, Volkswagen, Daihatsu, Suzuki, Subaru, Volvo.

So a seller picks a brand and a model and then types engine, power, doors, seats
and consumption by hand for four cars out of five. This folder closes that.

## The design: JSON in git is the master

```
  a collection run                tools/specs/data/*.json     <- the master
        |                                   |
        |  (paste one file)                 |  npm run specs:build
        v                                   v
   one JSON batch  ------------->  src/utils/carSpecs.js       <- generated
                                            +
                                    a report of chassis codes
                                    the decoder doesn't know
```

**The JSON files are the source of truth and `carSpecs.js` is a projection of
them.** Never hand-edit the generated block — fix the batch file and regenerate,
or the next run silently reverts your correction.

Why not write to the `car_specs` table instead, which was the original plan:

- **There is no service-role key in this environment.** A script cannot write to
  Supabase; only a human with the dashboard, or an agent with an MCP connector,
  can. A pipeline whose ingest step needs a person is not a pipeline.
- **`carSpecs.js` never reaches a buyer.** It is imported only through `CarForm`,
  which is seller-side, so the bundle-weight argument for keeping the rows out
  of the JS file is much weaker than it first looks.
- **The diff is the review.** A PR shows exactly which numbers changed. A row
  inserted into a database shows nothing.
- `car_specs` still exists and is still the right home for the fields the JS
  file has no room for. It is now an optional mirror, not a gate.

## Running it

```
npm run specs:build     # validate every batch, regenerate carSpecs.js
npm run specs:check     # validate and report staleness, write nothing (in npm test)
npm run test:specs      # the validator's own tests
```

Drop a batch into `tools/specs/data/`, run `specs:build`, read the diff, commit.
`npm test` fails if the generated block is stale, so the two cannot drift.

## The validator is the safeguard, not the paste step

A person pasting JSON is moving text, not checking torque figures. So the check
has to be machine-made. `lib/validate.mjs` rejects a batch outright on:

- a value the form or the DB cannot store (any enum, 7 doors, a future year)
- a figure outside a plausible band — the shape of a unit slip: kW in
  `horsepower`, L/100km in `fuel_consumption`, kgm in `torque_nm`, litres in
  `engine_cc`
- **overlapping generations for one model**, which is the dangerous one:
  `lookupFullSpec` uses `rows.find()`, so two rows covering the same year
  resolve by array position. Nothing errors, and which specs a seller gets
  depends on file order.
- an internal contradiction: an Electric row with an engine, `year_to` before
  `year_from`, a `primary_variant` that is not in `variants[]`
- a chassis code carrying its serial (`AGH30W-0123456` instead of `AGH30`)
- **any mention of money** in `source_note` — no price, valuation or
  depreciation, project-wide, because the source has none and any figure would
  be invented

`low` confidence and a missing `engine_cc` warn but pass. 40 assertions in
`tests/specsPipeline.test.mjs`.

## The two conversions, and why they matter

| batch JSON | `carSpecs.js` |
|---|---|
| `year_from` / `year_to` | `yearFrom` / `yearTo` |
| `year_to: null` | `yearTo: 2099` |

The second is the one that bites. `lookupFullSpec` (`carSpecs.js:130`) matches
with `y >= r.yearFrom && y <= r.yearTo`, and `2024 <= null` is **false** — so a
null row never matches the year test and survives only on the newest-generation
fallback. All 48 current rows in the file use `2099`. The generator does this
conversion so no run has to remember it.

The nine remaining fields — `generation`, `market`, `chassis_codes`,
`primary_variant`, `torque_nm`, `drivetrain`, `variants`, `confidence`,
`source_note` — are dropped from the JS output and kept in the JSON, which is
where they stay useful.

## Chassis codes are reported, never auto-patched

A batch's `chassis_codes` are checked against `src/utils/chassisDecode.js` and
anything unknown is printed for a human to add. It is not written automatically
because a code may need an `alt` marker (Type R, hybrid, 450h) and getting that
wrong makes the decoder fill a variant with the wrong mechanicals — the one
outcome worse than filling nothing.

The first batch found a real gap this way: the decoder knows `GGL20` and `GYL20`
for the 2015-2022 Lexus RX but not **`AGL20`/`AGL25`**, which is the RX300 2.0
turbo — the volume Malaysian variant.

## Ordering the backlog

`my_regs_4y` on each `backlog.json` entry is that nameplate's new registrations
in Malaysia, 2023 to Jul 2026, out of `reg_car_month` — the JPJ open data behind
the Market Demand tab. The platform has no search data to rank by
(`analytics_events` has no search or filter event, `car_hunts` is empty), so
this is the documented proxy. 227 of the 288 matched a real count; the rest sort
last.

## One thing to know about the numbers

These come from a language model's knowledge, not a licensed spec feed. The
prompt makes that safe rather than pretending otherwise: unknown figures are
`null`, every row carries a `confidence`, and anything that cannot be done
honestly goes in `skipped` with a reason.

Treat `low` confidence rows as drafts. The form already tells the seller these
are prefills — the *"Specs auto-filled — review Technical section and adjust if
needed"* banner at `CarForm.jsx:2425` — and a seller looking at the car is the
last check. `put` at `CarForm.jsx:1283` skips falsy values, so a `null` just
leaves the field blank for them to fill.

## Batch size

6-8 models a run, not 20. Each model is 2-3 generations, so 20 models is 40-60
rows of dense figures from memory in one pass, which is where wrong numbers come
from. The bigger accuracy lever is nulling what is not known rather than filling
it — a blank costs a seller seconds, a wrong number can get published.

## Running a collection batch by hand

`ROUTINE.md` is gone. It described a scheduled job writing to `car_specs`, and
that job was never created — the `create_trigger` call failed on connectors and
the design has since moved to JSON-in-git anyway.

```
npm run specs:next            # prints the next 8 models, skipping what is done
```

Paste that block into the `<targets>` section of `PROMPT.md`, run the prompt in
a fresh chat, save the JSON it returns to `tools/specs/data/<date>-batch-NN.json`,
then `npm run specs:build` and read the diff.

`specs:next` works out where to resume by reading `data/` and the hand-curated
half of `carSpecs.js`, so nothing has to be tracked anywhere else and two runs
cannot collide on the same model.
