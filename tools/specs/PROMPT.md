# Car spec collection — run prompt

Paste everything below the line into a fresh Claude/Cowork chat. Replace the
`<targets>` block with the output of `npm run specs:next`.

Then: save the JSON it returns to `tools/specs/data/<date>-batch-NN.json`, run
`npm run specs:build`, read the diff, commit.

---

You are collecting reference car specifications for ShiftOS, a Malaysian used-car
platform. The output prefills the technical fields of a listing form, so a seller
does not type engine size, power, doors, seats and fuel economy by hand.

Return **one JSON document in one code block, and nothing else**. No preamble, no
commentary after it, no explanation of what you did. The file is machine-read.

## What a row is

**One object per GENERATION, not per model and not per trim.** A nameplate sold
across three generations is three objects. A generation sold as 2.0 and 3.5 is
ONE object — the flat fields describe the highest-volume Malaysian variant, and
the rest go in `variants[]`.

## The envelope

```json
{
  "schema_version": "2.0",
  "generated_at": "YYYY-MM-DD",
  "batch": { "requested": 8, "returned": 7, "skipped": 1 },
  "specs": [ ...row objects... ],
  "skipped": [ { "make": "X", "model": "Y", "reason": "why" } ]
}
```

`skipped` is not optional. A model you leave out silently looks identical to one
nobody has reached yet, and the backlog then never finishes.

## The row

```json
{
  "make": "Lexus", "model": "RX", "generation": "AL20",
  "year_from": 2015, "year_to": 2022, "market": "CBU",
  "chassis_codes": ["AGL20", "AGL25", "GYL20"],
  "body_type": "SUV", "doors": 5, "seats": 5,
  "primary_variant": "RX300",
  "engine_cc": 1998, "cylinders": 4, "horsepower": 238, "torque_nm": 350,
  "transmission": "Auto", "drivetrain": "AWD", "fuel_type": "Petrol",
  "fuel_consumption": null,
  "confidence": "medium",
  "source_note": "AGL20/AGL25 are the RX300 2.0 turbo. RX350L is a separate 7-seat body.",
  "variants": [
    { "name": "RX300", "horsepower": 238, "torque_nm": 350, "transmission": "Auto",
      "drivetrain": "AWD", "fuel_type": "Petrol", "seats": 5, "notes": "8AR-FTS 1998cc turbo" },
    { "name": "RX450h", "horsepower": 313, "torque_nm": null, "transmission": "Auto",
      "drivetrain": "AWD", "fuel_type": "Hybrid", "seats": 5, "notes": "V6 hybrid, combined output" }
  ]
}
```

Required on every row: `make`, `model`, `year_from`, `body_type`, `confidence`.

## Closed enums — any other value is rejected outright

```
transmission   "Auto" | "Manual"
fuel_type      "Petrol" | "Diesel" | "Hybrid" | "Electric"
body_type      "Sedan" | "SUV" | "MPV" | "Hatchback" | "Coupe" | "Pickup"
drivetrain     "FWD" | "RWD" | "AWD" | "4WD"
market         "JDM" | "CBU" | "CKD"
confidence     "high" | "medium" | "low"
```

The awkward mappings, because the form has no other option:

- **A CVT is `"Auto"`.** So is a DCT, an AMT, a torque converter, a single-speed
  EV reduction gear. Put the real gearbox in `variants[].notes`.
- **A plug-in hybrid is `"Hybrid"`.** `"Electric"` means no engine at all.
- **A van, a kei van and a people-carrier are all `"MPV"`.** A Hiace is `"MPV"`.
  There is no Van or Wagon option. `"Pickup"` means an open bed.
- **A 3-door hatch is `"Hatchback"` with `doors: 3`.** A wagon is usually
  `"Hatchback"` too unless it is clearly a sedan shape.

## Units, pinned

- `engine_cc` — cubic centimetres. 1998, never 2.0.
- `horsepower` — **PS/hp as quoted in Malaysia.** Never kW. If you are about to
  write a number near 200 for a big turbo engine, check you have not written kW.
- `torque_nm` — Newton-metres. Multiply kgm by 9.807.
- `fuel_consumption` — **km/L, not L/100km.** Divide 100 by the L/100km figure.
  Anything under 4 or over 40 is the wrong unit. **If you are not confident,
  write `null`** — this field is nulled on most rows and that is fine.
- `year_to` — `null` means still on sale. Never write a future year.

## Rules that will reject the whole batch

1. **Generations of one model must not overlap.** If a facelift ran to 2022, the
   next generation starts at **2023**, not 2022. The lookup resolves an
   overlapping year by array position, so it silently returns whichever row
   happens to come first. Check every model you return for this.
2. **`primary_variant` must appear by name in `variants[]`.** The flat block IS
   that variant. If they disagree nobody can tell which car the numbers describe.
3. **`chassis_codes` are UPPERCASE with no serial suffix.** `AGH30`, never
   `AGH30W-0123456`. **If you do not know a model's codes, use `[]`.** Do not
   invent them — most non-Japanese models genuinely have none, and a wrong code
   makes the decoder fill the wrong car.
4. **An `Electric` row has `engine_cc: null` and `cylinders: null`.**
5. **No money, anywhere.** No price, RM figure, valuation, deposit, instalment,
   depreciation or "holds its value" — not in `source_note`, not in `notes`. The
   platform never states a price it has not been given, and any figure here would
   be invented.
6. **`null`, never a guess.** An unknown figure is `null` and `confidence` drops.
   A plausible-looking wrong number is worse than a blank: the blank is visibly
   blank and gets filled by the seller, the wrong number gets published.

## Confidence, honestly

- `high` — you know this car well and would defend every figure.
- `medium` — the shape is right; one or two numbers are from memory of a spec
  sheet. **This is the normal answer.**
- `low` — you are reconstructing it. Expect the seller to correct it.
- Below `low` — put it in `skipped` with a reason instead.

Malaysian-market figures where markets differ. A JDM Alphard 2.5 and a US Sienna
are not the same car; `market` says which one the row describes.

## Targets

Do every model in this block. Each is 1-3 generations, so expect 15-25 rows.

<targets>
PASTE THE OUTPUT OF `npm run specs:next` HERE
</targets>
