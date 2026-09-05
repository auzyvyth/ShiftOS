# The Cowork prompt

Paste everything between the two rules below into a fresh Cowork session. Fill in
the `<targets>` block from `backlog.json` before you send it — six models a run,
top of the list first.

Run it two or three times a day. Each run is independent; nothing carries over
between sessions, which is why the targets are named explicitly rather than left
for it to choose.

---

You are compiling a reference spec sheet for ShiftOS, a Malaysian used-car
dealership platform. The rows you produce prefill a seller's listing form, so a
dealer sees them and edits them before publishing. They are a convenience, not a
claim of record.

Return **one JSON document in one code block, and nothing else** — no preamble,
no explanation before or after, no commentary between objects. Your entire reply
is the code block.

## What a row is

One object per **model generation** — not per nameplate, not per trim. A
generation is bounded by `year_from`/`year_to` and is what a Japanese chassis
code identifies. A nameplate with three generations produces three objects.

## Output shape

```json
{
  "schema_version": "1.0",
  "generated_at": "YYYY-MM-DD",
  "batch": { "requested": 0, "returned": 0, "skipped": 0 },
  "specs": [
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
        { "name": "RX300",  "engine_cc": 1998, "cylinders": 4, "horsepower": 235, "torque_nm": 350, "transmission": "Auto", "drivetrain": "AWD", "fuel_type": "Petrol", "seats": 5, "fuel_consumption": 11.4, "notes": null },
        { "name": "RX450h", "engine_cc": 3456, "cylinders": 6, "horsepower": 313, "torque_nm": 335, "transmission": "Auto", "drivetrain": "AWD", "fuel_type": "Hybrid", "seats": 5, "fuel_consumption": 16.8, "notes": "Combined system output." }
      ],

      "confidence": "high",
      "source_note": "RX350L is the 7-seat long body and is a separate row."
    }
  ],
  "skipped": [
    { "make": "", "model": "", "reason": "" }
  ]
}
```

## Closed vocabularies — no other value is valid

```
transmission   "Auto" | "Manual"
fuel_type      "Petrol" | "Diesel" | "Hybrid" | "Electric"
body_type      "Sedan" | "SUV" | "MPV" | "Hatchback" | "Coupe" | "Pickup"
drivetrain     "FWD" | "RWD" | "AWD" | "4WD"
market         "JDM" | "CBU" | "CKD"
confidence     "high" | "medium" | "low"
```

These are the listing form's own options, so a value outside them cannot be
stored and the row is thrown away. Map to the nearest member:

- **Any automatic is `"Auto"`** — CVT, DCT, AMT, torque converter alike. Name the
  real gearbox in `variants[].notes` if it is worth knowing.
- **A plug-in hybrid is `"Hybrid"`.** `"Electric"` means there is no engine.
- **A van, kei van, minivan or people-mover is `"MPV"`.** A Toyota Hiace is
  `"MPV"`. `"Pickup"` means an open cargo bed.
- **A 3-door hatch is `"Hatchback"`** with `doors: 3`.
- A kei car is whatever body it actually has — usually `"Hatchback"` or `"MPV"`.

## Units

- `engine_cc` — cubic centimetres, integer. A 2.0 litre is `1998`, not `2000`,
  unless the displacement really is 2000.
- `horsepower` — metric PS/hp as the maker quotes it, integer. For a hybrid use
  the **combined system output** and say so in `notes`.
- `torque_nm` — newton-metres, integer. From kgm, multiply by 9.807.
- `fuel_consumption` — **km/L**, one decimal. If you are working from an
  L/100km figure, divide 100 by it. A result below 4 or above 40 means you have
  the unit inverted.

## Rules that decide whether a row is usable

1. **Write `null` rather than a guess.** A blank field is visibly blank and the
   seller fills it. An invented figure looks authoritative and gets published.
   Every `null` you write should also pull `confidence` down.
2. **`primary_variant` and the flat spec block must be the highest-volume
   Malaysian variant of that generation**, and must match that variant's entry in
   `variants[]` exactly. The flat block is what prefills the form; `variants[]` is
   reference only. If they disagree the row is contradictory.
3. **No price, no valuation, no depreciation, no "typically sells for".** In no
   field, including `source_note`. There is no price data behind this and any
   figure would be invented.
4. **Describe the market the row claims.** A JDM-market Alphard 2.5 and a
   US-market Sienna are different cars with different figures. `market` says which
   one you described; where a model was sold both as a JDM import and a local CBU
   with different specs, that is two rows.
5. **`chassis_codes` are UPPERCASE and carry no serial.** `AGH30`, never
   `AGH30W-0123456`. Omit the array (`[]`) for a model that has no Japanese
   chassis code, e.g. a European or Malaysian-assembled car.
6. **Anything you cannot do honestly goes in `skipped` with a real reason.** A
   model silently left out is indistinguishable from one nobody has reached yet,
   and the backlog then never finishes. `skipped` entries are expected and are not
   a failure.
7. **Confidence, honestly graded.** `high` — you know this car and would defend
   every figure. `medium` — the shape is right, one or two numbers are from
   memory. `low` — you are reconstructing it and expect corrections. Below `low`,
   skip it instead.

## Coverage expectation

For each target, produce every generation from roughly 2005 onward that was sold
new in Japan or Malaysia. Older generations only if the nameplate is still
commonly imported. Do not pad the list with generations that never reach a
Malaysian forecourt.

`variants[]` should cover the trims that differ **mechanically** — a different
engine, gearbox, drivetrain or seat count. Do not enumerate trim levels that only
change upholstery and wheels.

## Targets for this run

<targets>
Lexus RX
Mazda 3
Toyota Voxy
Lexus NX
Toyota Hiace
Toyota Yaris Cross
</targets>

Produce rows for exactly these models. Do not add others.

---
