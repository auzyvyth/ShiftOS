# Car spec sheet — the JSON contract

One shape, used by both sides: what Cowork emits, and what we ingest. If a field
is not in this document it does not get written, and if a value is not in one of
the enums below the row is rejected rather than guessed at.

Every field name here matches a **database column name exactly**, so ingestion is
a straight map with no translation layer. The one place that differs is
`src/utils/carSpecs.js`, whose in-memory rows are camelCase (`yearFrom`,
`yearTo`); the generator converts those two keys and nothing else.

## Where each field lands

| JSON field | `car_specs` column | `car_listings` column | CarForm field |
|---|---|---|---|
| `make` | `make` | `brand` | `brand` |
| `model` | `model` | `model` | `model` |
| `year_from` / `year_to` | `year_from` / `year_to` | — (bounds the match) | — |
| `engine_cc` | `engine_cc` | `engine_cc` | `engineCc` |
| `cylinders` | `cylinders` | `cylinders` | `cylinders` |
| `horsepower` | `horsepower` | `horsepower` | `horsepower` |
| `transmission` | `transmission` | `transmission` | `transmission` |
| `fuel_type` | `fuel_type` | `fuel_type` | `fuelType` |
| `body_type` | `body_type` | `body_type` | `bodyType` |
| `doors` | `doors` | `doors` | `doors` |
| `seats` | `seats` | `seats` | `seats` |
| `fuel_consumption` | `fuel_consumption` | `fuel_consumption` | `fuelEconomyKpl` |
| `torque_nm`, `drivetrain` | stored | *(no column yet)* | *(not shown yet)* |
| `chassis_codes` | stored | — | feeds `chassisDecode.js` |
| `variants[]` | stored as jsonb | — | reference only |
| `confidence`, `source_note` | stored | — | never shown to a buyer |

`torque_nm` and `drivetrain` have no `car_listings` column today. They are
collected anyway because adding a column later is cheap and re-collecting 67
models is not.

## Enums — closed sets, no other value is accepted

These are the form's own vocabularies (`CarForm.jsx:124-125`, `:2759`). A value
outside them fails ingestion; it does not get coerced.

```
transmission      "Auto" | "Manual"
fuel_type         "Petrol" | "Diesel" | "Hybrid" | "Electric"
body_type         "Sedan" | "SUV" | "MPV" | "Hatchback" | "Coupe" | "Pickup"
drivetrain        "FWD" | "RWD" | "AWD" | "4WD"
market            "JDM" | "CBU" | "CKD"
confidence        "high" | "medium" | "low"
```

Notes on the awkward ones:

- **A CVT is `"Auto"`.** So is a DCT, an AMT and a torque converter. The form has
  two options and a buyer filters on two options. Put the real gearbox in
  `variants[].notes` if it matters.
- **A plug-in hybrid is `"Hybrid"`, not `"Electric"`.** `"Electric"` means no
  engine at all.
- **A kei van is `"MPV"`.** There is no Van or Wagon option, and `"Pickup"` means
  an open bed. A Hiace is `"MPV"`.
- **A 3-door hatch is still `"Hatchback"`** — `doors: 3` carries that.
- `body_type` is per generation, so a nameplate sold as both a wagon and a sedan
  needs two rows or a `variants[]` entry, not a blended answer.

## The row

One object per **generation**, not per nameplate and not per trim. A generation
is the unit because that is what a chassis code identifies and what
`lookupFullSpec` matches on (`carSpecs.js:130`, `yearFrom..yearTo`).

```json
{
  "make": "Lexus",
  "model": "RX",
  "generation": "AL20",
  "year_from": 2015,
  "year_to": 2022,
  "market": "JDM",
  "chassis_codes": ["AGL20W", "AGL25W", "GYL20W", "GYL25W"],

  "body_type": "SUV",
  "doors": 5,
  "seats": 5,

  "primary_variant": "RX300",
  "engine_cc": 1998,
  "cylinders": 4,
  "horsepower": 235,
  "torque_nm": 350,
  "transmission": "Auto",
  "drivetrain": "AWD",
  "fuel_type": "Petrol",
  "fuel_consumption": 11.4,

  "variants": [
    {
      "name": "RX300",
      "engine_cc": 1998, "cylinders": 4, "horsepower": 235, "torque_nm": 350,
      "transmission": "Auto", "drivetrain": "AWD", "fuel_type": "Petrol",
      "seats": 5, "fuel_consumption": 11.4, "notes": null
    },
    {
      "name": "RX450h",
      "engine_cc": 3456, "cylinders": 6, "horsepower": 313, "torque_nm": 335,
      "transmission": "Auto", "drivetrain": "AWD", "fuel_type": "Hybrid",
      "seats": 5, "fuel_consumption": 16.8, "notes": "Combined system output."
    }
  ],

  "confidence": "high",
  "source_note": "RX350L is the 7-seat long body and is a separate row."
}
```

### Field rules

- `year_to`: `null` means "still current". Never write a future year.
- `generation`: the maker's own code (`AL20`, `FL5`, `ZRR80`, `W205`). If the
  generation genuinely has no code, use `null` — do not invent one.
- `chassis_codes`: UPPERCASE, **no serial suffix**. `AGH30`, never
  `AGH30W-0123456`. This is what `chassisDecode.js` matches on.
- **`primary_variant` and the flat spec block are the autofill values.** They must
  be the highest-volume Malaysian variant for that generation, and they must be
  identical to that variant's entry in `variants[]`. The flat block is what
  prefills a seller's form; `variants[]` is reference data.
- `fuel_consumption` is **km/L**, not L/100km. Divide 100 by the L/100km figure.
  A number under 4 or over 40 is almost certainly the wrong unit.
- `torque_nm` is Nm. Convert from kgm by multiplying by 9.807.

## The envelope

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-09-05",
  "batch": { "requested": 6, "returned": 5, "skipped": 1 },
  "specs": [],
  "skipped": [
    { "make": "Daihatsu", "model": "Hijet", "reason": "Kei truck; body_type has no Van option and Pickup would be wrong." }
  ]
}
```

`specs` is shown empty here only so this example parses as-is; a real run fills
it with the row objects above.

`skipped` is not optional. A model left out silently looks identical to a model
nobody has reached yet, and the backlog then never converges.

## Hard rules

1. **`null`, never a guess.** An unknown figure is `null` and the row's
   `confidence` drops. A plausible-looking invented number is worse than a blank,
   because a blank is visibly a blank and a wrong number gets published.
2. **No price, no valuation, no depreciation, no "worth around".** Not in any
   field, not in `source_note`. Project-wide rule — the source has no price and
   any figure would be invented.
3. **Malaysian-market figures where the market differs.** A JDM Alphard 2.5 and a
   US-market Sienna are not the same car. `market` says which one the row
   describes.
4. **No prose outside the JSON.** The output is one code block containing one
   JSON document. No preamble, no "here is your data", no trailing commentary.
5. **Confidence must be honest.** `high` = you know this model well and would
   defend every figure. `medium` = the shape is right, one or two figures are
   from memory of a spec sheet. `low` = you are reconstructing it; expect the
   seller to correct it. Anything you would rate below `low` should be `skipped`
   instead.
