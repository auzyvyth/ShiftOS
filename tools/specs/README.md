# Filling in the car spec table

`src/utils/carSpecs.js` prefills the technical half of a listing, and it covers
**57 of the 345 brand+model pairs** the form offers. 288 are missing — 83% of
the catalogue. Whole brands return nothing: BMW, Audi, Mercedes, Hyundai, Kia,
Lexus, Volkswagen, Daihatsu, Suzuki, Subaru, Volvo.

So a seller picks a brand and a model and then types engine, power, doors, seats
and consumption by hand for four cars out of five. This folder is the pipeline
for closing that.

## The loop

1. Open `backlog.json`, take the top six models not yet done.
2. Paste them into the `<targets>` block of `COWORK_PROMPT.md` and run it in a
   fresh Cowork session.
3. Cowork replies with one JSON document. Copy it.
4. Insert it into `car_specs` (see below).
5. Tick those models off the backlog.

Twenty models a run, three runs a day, clears the 288 in about five days — but
prefer `ROUTINE.md`, which does the same thing without any copy-paste.

## The files

| file | what it is |
|---|---|
| `SCHEMA.md` | The JSON contract. Field-by-field, where each one lands, the enums, the units. Read this if a row gets rejected. |
| `COWORK_PROMPT.md` | The thing you paste into Cowork. Self-contained — it repeats the schema so the session needs no other context. |
| `backlog.json` | The 288 uncovered models, ordered by real Malaysian registration volume, with their chassis codes and known generation boundaries already filled in. |
| `ROUTINE.md` | The same job as a scheduled routine that writes straight to the database, so there is no copy-paste at all. Must be created from the claude.ai Routines UI — a Claude Code session cannot attach the Supabase connector, and without it the run has no database. |

## Why the backlog is ordered the way it is

`my_regs_4y` on each entry is that nameplate's new registrations in Malaysia,
2023 to Jul 2026, straight out of `reg_car_month` — the JPJ open data behind the
Market Demand tab. So the order is what Malaysians actually register, not a guess
at what feels popular:

```
12,274  Lexus RX          3,808  Toyota Land Cruiser
 7,780  Mazda 3           3,163  Honda Stepwgn
 5,794  Toyota Voxy       2,527  Subaru XV
 4,790  Lexus NX          1,696  Honda N-Box
 4,474  Toyota Hiace      1,674  Subaru Forester
 4,084  Toyota Yaris Cross
```

`null` means the nameplate does not appear in JPJ under that name — either it is
too rare to register, or JPJ folds it into a parent (the same gap the Market
Demand tab already surfaces for performance variants). Those go last.

## Where the JSON goes

The rows are bigger than `carSpecs.js` wants to carry — variants, torque,
drivetrain, chassis codes, provenance — and there will eventually be hundreds of
them. That is a database table, not a bundled JS array:

```sql
create table public.car_specs (
  id             bigserial primary key,
  make           text    not null,
  model          text    not null,
  generation     text,
  year_from      smallint not null,
  year_to        smallint,               -- null = current
  market         text    not null check (market in ('JDM','CBU','CKD')),
  chassis_codes  text[]  not null default '{}',

  body_type      text    check (body_type in ('Sedan','SUV','MPV','Hatchback','Coupe','Pickup')),
  doors          smallint,
  seats          smallint,

  primary_variant  text,
  engine_cc        integer,
  cylinders        smallint,
  horsepower       integer,
  torque_nm        integer,
  transmission     text  check (transmission in ('Auto','Manual')),
  drivetrain       text  check (drivetrain in ('FWD','RWD','AWD','4WD')),
  fuel_type        text  check (fuel_type in ('Petrol','Diesel','Hybrid','Electric')),
  fuel_consumption numeric(4,1),

  variants     jsonb   not null default '[]',
  confidence   text    not null check (confidence in ('high','medium','low')),
  source_note  text,
  created_at   timestamptz not null default now(),

  unique (make, model, year_from)
);
```

The `unique (make, model, year_from)` is what makes a re-run harmless: insert
with `on conflict do nothing` and a model done twice costs nothing.

**The table is live** (migrations `20260905n` / `20260905o`) and read-only:
`select` to authenticated, nothing at all to anon, writes only via service role.
Nothing in the app reads it yet, which is deliberate — moving the spec lookup
onto it is a code change with a real trade-off attached:

> `carSpecs.js` is deliberately tier 1 of the lookup — a bundled table, zero
> latency, works offline, no request. A DB table is easy to grow and easy for
> this pipeline to write, but reading it puts a network round-trip in front of
> every listing form. The sane end state is both: the DB is the master store this
> pipeline writes to, and a generator emits the top-N Malaysian models back into
> `carSpecs.js` as the offline fast path. Decide that before wiring the form to
> the table.

## One thing to know about the numbers

These come from a language model's knowledge, not a licensed spec feed. The
prompt is built to make that safe rather than to pretend otherwise: unknown
figures must be `null` rather than guessed, every row carries a `confidence`, and
anything it cannot do honestly goes in `skipped` with a reason.

Treat `low` confidence rows as drafts. The form already tells the seller these
are prefills — the green *"Specs auto-filled — review Technical section and
adjust if needed"* banner at `CarForm.jsx:2425` — and a seller looking at the car
is the last check.

One caveat the prompt cannot solve: JDM trims genuinely differ. An Alphard is 7
or 8 seats depending on trim. `primary_variant` names which one the flat spec
block describes, and `variants[]` carries the rest.
