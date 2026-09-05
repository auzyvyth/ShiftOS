# The Cowork prompt

Paste everything between the two rules below into a fresh Cowork session. Fill in
the `<targets>` block with the next six models from the backlog at the bottom of
this file before you send it — top of the list first.

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

## The backlog — work down this list, six a run

All 67 models that have a Japanese chassis code but no spec row. The number is
that nameplate's new registrations in Malaysia, 2023 to Jul 2026, from JPJ open
data — so the order is what Malaysians actually register, not a guess at what
feels popular. A dash means JPJ does not list the nameplate under that name.

The chassis codes and generation boundaries are already known — hand them to the
session as a starting point and let it fill in or correct them. Tick each model
off here as its JSON lands in the database.

- [ ]  1.  12274  Lexus RX
         codes: GGL10 GYL10 GGL20 GYL20 TALA10 AALH10
         gens:  2009-2015, 2015-2022, 2022-
- [ ]  2.   7780  Mazda Mazda 3
         codes: BM5FS BMLFS
         gens:  2013-2019
- [ ]  3.   5794  Toyota Voxy
         codes: ZRR70 ZRR80 ZWR80 MZRA90 ZWR90
         gens:  2007-2014, 2014-2022, 2022-
- [ ]  4.   4790  Lexus NX
         codes: AGZ10 AYZ10 AAZH20 TAZA20
         gens:  2014-2021, 2021-
- [ ]  5.   4474  Toyota Hiace
         codes: KDH200 TRH200 GDH300 KDH300
         gens:  2004-2019, 2019-
- [ ]  6.   4084  Toyota Yaris Cross
         codes: MXPB10 MXPJ10
         gens:  2020-
- [ ]  7.   3808  Toyota Land Cruiser
         codes: URJ200 UZJ200 VDJ200 VJA300 FJA300
         gens:  2007-2021, 2021-
- [ ]  8.   3163  Honda Stepwgn
         codes: RK1 RK5 RP1 RP3 RP5 RP6 RP8
         gens:  2009-2015, 2015-2022, 2022-
- [ ]  9.   2527  Subaru XV
         codes: GP7 GT3 GT7
         gens:  2011-2017, 2017-2022
- [ ] 10.   1696  Honda N-Box
         codes: JF1 JF2 JF3 JF4
         gens:  2011-2017, 2017-2023
- [ ] 11.   1674  Subaru Forester
         codes: SH5 SH9 SJ5 SJG SK5 SK9 SKE
         gens:  2008-2012, 2012-2018, 2018-
- [ ] 12.   1471  Toyota GR86
         codes: ZN8
         gens:  2021-
- [ ] 13.   1213  Mazda MX-5
         codes: NCEC ND5RC
         gens:  2005-2015, 2015-
- [ ] 14.   1131  Lexus IS
         codes: GSE20 GSE30 AVE30
         gens:  2005-2013, 2013-
- [ ] 15.    940  Lexus LX
         codes: URJ201 VJA310
         gens:  2007-2021, 2021-
- [ ] 16.    904  Toyota Prado
         codes: TRJ150 GDJ150
         gens:  2009-2024
- [ ] 17.    876  Toyota Supra
         codes: JZA80 DB02 DB22 DB42
         gens:  1993-2002, 2019-
- [ ] 18.    812  Toyota Estima
         codes: ACR50 GSR50 AHR20
         gens:  2006-2019
- [ ] 19.    794  Toyota 86
         codes: ZN6
         gens:  2012-2020
- [ ] 20.    496  Toyota Crown
         codes: GRS200 GRS210 AWS210 ARS220 AZSH20
         gens:  2008-2012, 2012-2018, 2018-
- [ ] 21.    462  Lexus ES
         codes: AXZH10
         gens:  2018-
- [ ] 22.    457  Subaru BRZ
         codes: ZC6 ZD8
         gens:  2012-2020, 2021-
- [ ] 23.    318  Nissan GT-R
         codes: R35
         gens:  2007-
- [ ] 24.    301  Lexus UX
         codes: MZAA10 MZAH10
         gens:  2018-
- [ ] 25.    294  Mazda Mazda 2
         codes: DE3FS DE5FS DJ3FS DJ5FS
         gens:  2007-2014, 2014-2022
- [ ] 26.    284  Nissan Elgrand
         codes: E51 E52
         gens:  2002-2010, 2010-
- [ ] 27.    249  Toyota C-HR
         codes: NGX10 NGX50 ZYX10 ZYX11
         gens:  2016-2023
- [ ] 28.    229  Toyota Roomy
         codes: M900A M910A
         gens:  2016-
- [ ] 29.    212  Daihatsu Move
         codes: LA100S LA150S
         gens:  2010-2014, 2014-
- [ ] 30.    190  Mazda Mazda 6
         codes: GJ2FP GJ5FP
         gens:  2012-
- [ ] 31.    168  Toyota Wish
         codes: ZNE10 ZGE20
         gens:  2003-2009, 2009-2017
- [ ] 32.    128  Subaru WRX
         codes: GDB GRB VAB VAG
         gens:  2000-2007, 2007-2014, 2014-2021
- [ ] 33.    102  Subaru Levorg
         codes: VM4 VMG VN5
         gens:  2014-2020, 2020-
- [ ] 34.     98  Lexus RC
         codes: ASC10 GSC10
         gens:  2014-
- [ ] 35.     92  Honda S660
         codes: JW5
         gens:  2015-2022
- [ ] 36.     83  Lexus LC
         codes: URZ100
         gens:  2017-
- [ ] 37.     65  Toyota Mark X
         codes: GRX120 GRX130
         gens:  2004-2009, 2009-2019
- [ ] 38.     62  Daihatsu Tanto
         codes: L375S LA600S LA650S
         gens:  2007-2013, 2013-2019, 2019-
- [ ] 39.     44  Lexus LS
         codes: USF40 VXFA50
         gens:  2006-2017, 2017-
- [ ] 40.     40  Nissan Skyline
         codes: V37
         gens:  2013-
- [ ] 41.     38  Nissan Leaf
         codes: AZE0 ZE1
         gens:  2010-2017, 2017-
- [ ] 42.     38  Daihatsu Copen
         codes: L880K LA400K
         gens:  2002-2012, 2014-
- [ ] 43.     30  Toyota RAV4
         codes: ZSA44 MXAA54 AXAH54
         gens:  2013-2018, 2018-
- [ ] 44.     24  Honda S2000
         codes: AP1 AP2
         gens:  1999-2005, 2005-2009
- [ ] 45.      0  Mitsubishi Delica
         codes: CV1W CV5W
         gens:  2007-
- [ ] 46.      -  Toyota Prius
         codes: NHW20 ZVW30 ZVW35 ZVW50 ZVW51 ZVW55 MXWH60
         gens:  2003-2009, 2009-2015, 2015-2022, 2022-
- [ ] 47.      -  Toyota Prius Alpha
         codes: ZVW40 ZVW41
         gens:  2011-2021
- [ ] 48.      -  Toyota Aqua
         codes: NHP10 MXPK10 MXPK11
         gens:  2011-2021, 2021-
- [ ] 49.      -  Toyota Sienta
         codes: NHP170 NSP170 NCP175 MXPC10 MXPL10
         gens:  2015-2022, 2022-
- [ ] 50.      -  Toyota Raize
         codes: A200A A210A
         gens:  2019-
- [ ] 51.      -  Toyota GR Yaris
         codes: GXPA16
         gens:  2020-
- [ ] 52.      -  Lexus CT
         codes: ZWA10
         gens:  2011-2022
- [ ] 53.      -  Honda Vezel
         codes: RU1 RU2 RU3 RU4 RV3 RV5 RV6
         gens:  2013-2021, 2021-
- [ ] 54.      -  Honda Freed
         codes: GB3 GB4 GB5 GB6 GB7 GB8
         gens:  2008-2016, 2016-
- [ ] 55.      -  Honda Shuttle
         codes: GP8 GK8 GK9
         gens:  2015-2022
- [ ] 56.      -  Honda Insight
         codes: ZE2 ZE4
         gens:  2009-2014, 2018-2022
- [ ] 57.      -  Honda Integra
         codes: DC5
         gens:  2001-2006
- [ ] 58.      -  Nissan Note
         codes: E11 E12 E13
         gens:  2005-2012, 2012-2020, 2020-
- [ ] 59.      -  Nissan Juke
         codes: F15
         gens:  2010-2019
- [ ] 60.      -  Nissan March
         codes: K12 K13
         gens:  2002-2010, 2010-2022
- [ ] 61.      -  Mazda RX-8
         codes: SE3P
         gens:  2003-2012
- [ ] 62.      -  Mitsubishi Evo
         codes: CT9A CZ4A
         gens:  2001-2007, 2007-2016
- [ ] 63.      -  Daihatsu Move Canbus
         codes: LA800S LA810S LA850S LA860S
         gens:  2016-2022, 2022-
- [ ] 64.      -  Daihatsu Mira
         codes: L275S LA350S
         gens:  2006-2018, 2018-
- [ ] 65.      -  Daihatsu Hijet
         codes: S321V S331V S700V S710V
         gens:  2004-2021, 2021-
- [ ] 66.      -  Daihatsu Rocky
         codes: A200S A210S
         gens:  2019-
- [ ] 67.      -  Daihatsu Thor
         codes: M900S M910S
         gens:  2016-
