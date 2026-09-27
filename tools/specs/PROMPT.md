# Car spec collection — run prompt (schema 3.0: every trim)

Run `npm run specs:next`, paste its `<targets>` block over the one at the
bottom, then paste everything below the line into a fresh Claude/Cowork chat
**with web search on**. Paste the JSON it returns straight into a ShiftOS
session; the intake runs itself (`README.md` → "Automated batch intake").

---

You are building the trim catalogue for XDrive, a Malaysian used-car
marketplace. Every trim you return becomes a fixed category a seller PICKS
("BMW M4 Competition M xDrive G82", "Toyota Alphard 2.5 Z AH40"), and every
spec field of their listing fills from it. Sellers do not type specs. So a
wrong figure goes onto every listing of that trim — accuracy beats coverage.

Return **one JSON document in one code block, and nothing else.**

## Shape

One object per GENERATION. Inside it, one object per TRIM in `variants[]`.
Every trim is complete on its own — never "same as above". The figures in
this example illustrate the shape; look every real figure up.

```json
{
  "schema_version": "3.0",
  "generated_at": "YYYY-MM-DD",
  "batch": { "requested": 4, "returned": 4, "skipped": 0 },
  "specs": [{
    "make": "Toyota", "model": "Alphard", "generation": "AH40",
    "year_from": 2023, "year_to": null, "market": "JDM",
    "chassis_codes": ["AGH40", "AAHH40"],
    "body_type": "MPV", "doors": 5, "seats": 7,
    "primary_variant": "2.5 Z",
    "source_note": "Shape example only - do not copy its figures.",
    "variants": [{
      "name": "2.5 Z", "year_from": null, "year_to": null,
      "body_type": null, "doors": null, "seats": null,
      "engine_cc": 2487, "cylinders": 4, "aspiration": "NA",
      "horsepower": 182, "torque_nm": 235,
      "transmission": "Auto", "gearbox": "CVT", "drivetrain": "FWD",
      "fuel_type": "Petrol", "fuel_consumption": null,
      "tyre_front": "225/60 R18", "tyre_rear": "225/60 R18",
      "confidence": "medium", "source": null, "notes": null
    }]
  }],
  "skipped": [{ "make": "X", "model": "Y", "reason": "why", "whole_model": false }]
}
```

## What counts as a trim

- A trim = one line on the Malaysian price list (or one JDM grade for a grey
  import). If power, engine, drivetrain, seats or tyres differ, it is a
  separate trim. Paint, a sunroof or a body kit alone is not.
- `name` is the trim ONLY, no make, no model: `"2.5 Z"`, `"350S"`,
  `"Competition M xDrive"`, `"RX350 F Sport"`, `"Type R"`. Use the Malaysian
  distributor's name when it was sold here new, the JDM grade name otherwise.
  Same car, same spelling, every time — buyers filter on this string.
- Cover **every generation** of each target sold in Malaysia (new or recond),
  and every trim of each. A trim sold only part of the generation gets its own
  `year_from`/`year_to`; otherwise leave them `null`.
- `body_type`/`doors`/`seats` on a trim override the generation's; `null` means
  "same as the generation".
- `primary_variant` = the highest-volume trim in Malaysia.

## Closed values — anything else rejects the batch

```
transmission  "Auto" | "Manual"          (a CVT/DCT/AMT/EV is "Auto")
gearbox       free text: "CVT", "8-speed torque converter", "7-speed DCT", "6-speed manual"
aspiration    "NA" | "Turbo" | "Supercharged" | "Twincharged" | null (Electric only)
fuel_type     "Petrol" | "Diesel" | "Hybrid" | "Electric"   (plug-in = "Hybrid")
body_type     "Sedan" | "SUV" | "MPV" | "Hatchback" | "Coupe" | "Pickup"
drivetrain    "FWD" | "RWD" | "AWD" | "4WD"
market        "JDM" | "CBU" | "CKD"
confidence    "high" | "medium" | "low"
```
Vans are `"MPV"`, wagons `"Hatchback"`, convertibles `"Coupe"`.

## Units

`engine_cc` cc (1998, not 2.0) · `horsepower` PS as quoted in Malaysia, never kW
(hybrids: combined system output) · `torque_nm` Nm · `fuel_consumption` km/L,
not L/100km, `null` if unsure · tyres exactly `"225/45 R18"` or `"255/35 ZR19"`,
factory-standard size, no load index; `tyre_rear` equals `tyre_front` unless
staggered · `doors` 2-5 · `seats` 2-9.

## Confidence and source — this decides what gets LOCKED

- `"high"` = you checked it against a page you actually opened in this session
  (manufacturer/distributor spec sheet or brochure) and every figure agrees.
  `source` names that page or document. A high trim must have no null engine,
  cylinders, power or front tyre. **High trims are locked on listings.**
- `"medium"` = right car, one or two figures from memory. `source` may be null.
  Prefilled, seller can edit.
- `"low"` = reconstructed. Prefilled, flagged as a draft.
- Never cite a page you did not open. Writing from memory → `source: null` and
  the trim cannot be high. Below low → leave the trim out and say so in `skipped`.

## Rules that reject the batch

1. Every trim has every key shown above. Unknown = `null`, never a guess.
2. Generations of one model must not overlap: if one ends 2022, the next starts 2023.
3. `primary_variant` matches a trim `name` exactly; trim names are unique per generation.
4. `chassis_codes`: real codes only, UPPERCASE, no serial (`AGH30`, never
   `AGH30W-0123456`). Unsure → `[]`.
5. Electric → `engine_cc`, `cylinders`, `aspiration` all `null`.
6. No money anywhere: no price, RM, valuation, deposit, instalment, depreciation.
7. `skipped` lists every target or trim left out, with a reason. Set
   `"whole_model": true` only when the entire model was skipped.

## Targets

Do every model below, every generation, every trim.

<targets>
PASTE THE OUTPUT OF `npm run specs:next` HERE
</targets>
