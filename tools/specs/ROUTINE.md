# The scheduled collection routine

Create this from the **claude.ai Routines UI**, not from a Claude Code session —
a session cannot attach connectors to a routine it creates ("the connectors
parameter is not available for this organization"), and without the Supabase
connector the run has no database and does nothing.

Your existing "SHIFTOS Salesman Lite — daily content drop" routine has Supabase
attached and works, so create this one the same way.

## Settings

| field | value |
|---|---|
| Name | ShiftOS car spec collection |
| Schedule | `0 1,6,13 * * *` (UTC) — 09:00, 14:00, 21:00 Malaysia |
| Session | new session each run |
| Connectors | **Supabase** — required, the run does nothing without it |
| Notifications | push on |

## Why it self-sequences

Each run starts cold and reads `car_specs` to see which models already have
rows, then takes the next 20 that don't. No shared state, no coordination, and
a re-run is harmless because the table is unique on (make, model, year_from) and
the prompt inserts with `on conflict do nothing`.

At 20 models a run, three runs a day, the 67-model backlog is finished after
**four runs — about a day and a half**. The fifth run finds nothing left, replies
"backlog complete" and stops. Disable the routine then; it has no ongoing work.

## The prompt

Paste everything below the rule.

---

You are collecting reference car specifications for ShiftOS, a Malaysian used-car dealership platform, and writing them straight into its database. Work autonomously; nobody is watching this run.

Supabase project id: lemdkdizdlcirhbzqlos
Target table: public.car_specs

## Step 1 — find where to start

Query the database first:

    select make, model, count(*) from public.car_specs group by 1,2 order by 1,2;

Every (make, model) already present is DONE. Skip it. From the backlog at the bottom of this message, take the next 20 models that do not appear in that result, in the order listed. If fewer than 20 remain, do those. If none remain, write nothing, reply "backlog complete — nothing to collect" and stop.

If you cannot reach the database at all, do not guess at what is done: stop and report that, so the run is visibly skipped rather than silently duplicating work.

## Step 2 — for each model, write rows as you go

One row per model GENERATION — not per nameplate, not per trim. A generation is what a Japanese chassis code identifies. A nameplate with three generations produces three rows.

**Insert each model's rows before moving to the next model.** Do not accumulate all 20 models and write at the end: a single reply that large truncates mid-document and the whole run is lost. Small, frequent writes mean a run that dies halfway still leaves real progress behind, and the next run picks up from it.

Insert with `on conflict do nothing` so a re-run is harmless — the table is unique on (make, model, year_from).

Column names and their allowed values:

    make              text, required
    model             text, required
    generation        text, the maker's own code (AL20, ZRR80, FL5). null if it genuinely has none — do not invent one.
    year_from         smallint, required
    year_to           smallint, null = still current. Never a future year.
    market            'JDM' | 'CBU' | 'CKD'
    chassis_codes     text[], UPPERCASE, NO serial suffix. 'AGH30' never 'AGH30W-0123456'. '{}' if the car has no Japanese chassis code.
    body_type         'Sedan' | 'SUV' | 'MPV' | 'Hatchback' | 'Coupe' | 'Pickup'
    doors             smallint 2-6
    seats             smallint 2-12
    primary_variant   text, the highest-volume Malaysian variant of that generation
    engine_cc         integer 500-8000
    cylinders         smallint 2-12
    horsepower        integer 20-1200
    torque_nm         integer 30-1500
    transmission      'Auto' | 'Manual'
    drivetrain        'FWD' | 'RWD' | 'AWD' | '4WD'
    fuel_type         'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'
    fuel_consumption  numeric, KM/L (not L/100km), 3-40
    variants          jsonb array, see below
    confidence        'high' | 'medium' | 'low'
    source_note       text, optional caveat

The enums are closed sets — they are the listing form's own options, and the database rejects anything else. Map to the nearest member:

- **Any automatic is 'Auto'** — CVT, DCT, AMT, torque converter alike. Name the real gearbox in a variant's notes if it matters.
- **A plug-in hybrid is 'Hybrid'.** 'Electric' means there is no engine.
- **A van, kei van, minivan or people-mover is 'MPV'.** A Toyota Hiace is 'MPV'. 'Pickup' means an open cargo bed.
- **A 3-door hatch is 'Hatchback'** with doors 3.

Units, because these are the likeliest errors:

- engine_cc is cubic centimetres. A 2.0 litre is 1998 if that is the real displacement, not a rounded 2000.
- horsepower is metric PS/hp as the maker quotes it. For a hybrid use combined system output and say so in the variant notes.
- torque_nm is newton-metres. From kgm, multiply by 9.807.
- fuel_consumption is **km/L**. If you have an L/100km figure, divide 100 by it. A result below 3 or above 40 means you inverted the unit — the database will reject it.

The flat spec columns describe `primary_variant` and prefill a seller's form. `variants` is reference data: cover only the trims that differ MECHANICALLY (different engine, gearbox, drivetrain or seat count), not trim levels that change upholstery and wheels. Shape:

    [{"name":"RX300","engine_cc":1998,"cylinders":4,"horsepower":235,"torque_nm":350,
      "transmission":"Auto","drivetrain":"AWD","fuel_type":"Petrol","seats":5,
      "fuel_consumption":11.4,"notes":null}]

`primary_variant` must match one of the entries in `variants` exactly, or the row contradicts itself.

## Rules that decide whether a row is worth writing

1. **Write null rather than a guess.** An unknown figure is null and pulls `confidence` down. A blank is visibly a blank and the seller fills it in; an invented figure looks authoritative and gets published on a real listing.
2. **No price, valuation, depreciation or "typically sells for" anywhere**, including source_note. There is no price data behind this and any figure would be invented. This is a hard project rule.
3. **Describe the market you are describing.** A JDM Alphard 2.5 and a US-market Sienna are different cars. Where a model was sold both as a JDM import and a local CBU with different specs, that is two rows with different `market`.
4. **Grade confidence honestly.** 'high' — you know this car and would defend every figure. 'medium' — the shape is right, one or two numbers are from memory. 'low' — you are reconstructing it and expect corrections. If you would rate it below 'low', skip the model and say so.
5. **Cover generations from roughly 2005 onward** that were sold new in Japan or Malaysia. Older only if the nameplate is still commonly imported. Do not pad with generations that never reach a Malaysian forecourt.
6. The chassis codes and generation boundaries in the backlog below were extracted from the platform's existing decoder. Treat them as a starting point: **correct them if they are wrong or incomplete**, and put the correction in source_note. Lexus RX in particular is known to be missing its AGL20/AGL25 codes.

## Step 3 — report

Finish with a short plain-text summary, not JSON:
- which models you wrote, and how many generation rows each
- the confidence spread
- anything you skipped and why
- any backlog entry whose chassis codes or generation boundaries you corrected

Then verify with `select count(*) from public.car_specs;` and state the new total.

## Backlog — in order, take the next 20 not already in the table

 1. Lexus RX | codes: GGL10 GYL10 GGL20 GYL20 TALA10 AALH10 | gens: 2009-2015, 2015-2022, 2022-
 2. Mazda Mazda 3 | codes: BM5FS BMLFS | gens: 2013-2019
 3. Toyota Voxy | codes: ZRR70 ZRR80 ZWR80 MZRA90 ZWR90 | gens: 2007-2014, 2014-2022, 2022-
 4. Lexus NX | codes: AGZ10 AYZ10 AAZH20 TAZA20 | gens: 2014-2021, 2021-
 5. Toyota Hiace | codes: KDH200 TRH200 GDH300 KDH300 | gens: 2004-2019, 2019-
 6. Toyota Yaris Cross | codes: MXPB10 MXPJ10 | gens: 2020-
 7. Toyota Land Cruiser | codes: URJ200 UZJ200 VDJ200 VJA300 FJA300 | gens: 2007-2021, 2021-
 8. Honda Stepwgn | codes: RK1 RK5 RP1 RP3 RP5 RP6 RP8 | gens: 2009-2015, 2015-2022, 2022-
 9. Subaru XV | codes: GP7 GT3 GT7 | gens: 2011-2017, 2017-2022
10. Honda N-Box | codes: JF1 JF2 JF3 JF4 | gens: 2011-2017, 2017-2023
11. Subaru Forester | codes: SH5 SH9 SJ5 SJG SK5 SK9 SKE | gens: 2008-2012, 2012-2018, 2018-
12. Toyota GR86 | codes: ZN8 | gens: 2021-
13. Mazda MX-5 | codes: NCEC ND5RC | gens: 2005-2015, 2015-
14. Lexus IS | codes: GSE20 GSE30 AVE30 | gens: 2005-2013, 2013-
15. Lexus LX | codes: URJ201 VJA310 | gens: 2007-2021, 2021-
16. Toyota Prado | codes: TRJ150 GDJ150 | gens: 2009-2024
17. Toyota Supra | codes: JZA80 DB02 DB22 DB42 | gens: 1993-2002, 2019-
18. Toyota Estima | codes: ACR50 GSR50 AHR20 | gens: 2006-2019
19. Toyota 86 | codes: ZN6 | gens: 2012-2020
20. Toyota Crown | codes: GRS200 GRS210 AWS210 ARS220 AZSH20 | gens: 2008-2012, 2012-2018, 2018-
21. Lexus ES | codes: AXZH10 | gens: 2018-
22. Subaru BRZ | codes: ZC6 ZD8 | gens: 2012-2020, 2021-
23. Nissan GT-R | codes: R35 | gens: 2007-
24. Lexus UX | codes: MZAA10 MZAH10 | gens: 2018-
25. Mazda Mazda 2 | codes: DE3FS DE5FS DJ3FS DJ5FS | gens: 2007-2014, 2014-2022
26. Nissan Elgrand | codes: E51 E52 | gens: 2002-2010, 2010-
27. Toyota C-HR | codes: NGX10 NGX50 ZYX10 ZYX11 | gens: 2016-2023
28. Toyota Roomy | codes: M900A M910A | gens: 2016-
29. Daihatsu Move | codes: LA100S LA150S | gens: 2010-2014, 2014-
30. Mazda Mazda 6 | codes: GJ2FP GJ5FP | gens: 2012-
31. Toyota Wish | codes: ZNE10 ZGE20 | gens: 2003-2009, 2009-2017
32. Subaru WRX | codes: GDB GRB VAB VAG | gens: 2000-2007, 2007-2014, 2014-2021
33. Subaru Levorg | codes: VM4 VMG VN5 | gens: 2014-2020, 2020-
34. Lexus RC | codes: ASC10 GSC10 | gens: 2014-
35. Honda S660 | codes: JW5 | gens: 2015-2022
36. Lexus LC | codes: URZ100 | gens: 2017-
37. Toyota Mark X | codes: GRX120 GRX130 | gens: 2004-2009, 2009-2019
38. Daihatsu Tanto | codes: L375S LA600S LA650S | gens: 2007-2013, 2013-2019, 2019-
39. Lexus LS | codes: USF40 VXFA50 | gens: 2006-2017, 2017-
40. Nissan Skyline | codes: V37 | gens: 2013-
41. Nissan Leaf | codes: AZE0 ZE1 | gens: 2010-2017, 2017-
42. Daihatsu Copen | codes: L880K LA400K | gens: 2002-2012, 2014-
43. Toyota RAV4 | codes: ZSA44 MXAA54 AXAH54 | gens: 2013-2018, 2018-
44. Honda S2000 | codes: AP1 AP2 | gens: 1999-2005, 2005-2009
45. Mitsubishi Delica | codes: CV1W CV5W | gens: 2007-
46. Toyota Prius | codes: NHW20 ZVW30 ZVW35 ZVW50 ZVW51 ZVW55 MXWH60 | gens: 2003-2009, 2009-2015, 2015-2022, 2022-
47. Toyota Prius Alpha | codes: ZVW40 ZVW41 | gens: 2011-2021
48. Toyota Aqua | codes: NHP10 MXPK10 MXPK11 | gens: 2011-2021, 2021-
49. Toyota Sienta | codes: NHP170 NSP170 NCP175 MXPC10 MXPL10 | gens: 2015-2022, 2022-
50. Toyota Raize | codes: A200A A210A | gens: 2019-
51. Toyota GR Yaris | codes: GXPA16 | gens: 2020-
52. Lexus CT | codes: ZWA10 | gens: 2011-2022
53. Honda Vezel | codes: RU1 RU2 RU3 RU4 RV3 RV5 RV6 | gens: 2013-2021, 2021-
54. Honda Freed | codes: GB3 GB4 GB5 GB6 GB7 GB8 | gens: 2008-2016, 2016-
55. Honda Shuttle | codes: GP8 GK8 GK9 | gens: 2015-2022
56. Honda Insight | codes: ZE2 ZE4 | gens: 2009-2014, 2018-2022
57. Honda Integra | codes: DC5 | gens: 2001-2006
58. Nissan Note | codes: E11 E12 E13 | gens: 2005-2012, 2012-2020, 2020-
59. Nissan Juke | codes: F15 | gens: 2010-2019
60. Nissan March | codes: K12 K13 | gens: 2002-2010, 2010-2022
61. Mazda RX-8 | codes: SE3P | gens: 2003-2012
62. Mitsubishi Evo | codes: CT9A CZ4A | gens: 2001-2007, 2007-2016
63. Daihatsu Move Canbus | codes: LA800S LA810S LA850S LA860S | gens: 2016-2022, 2022-
64. Daihatsu Mira | codes: L275S LA350S | gens: 2006-2018, 2018-
65. Daihatsu Hijet | codes: S321V S331V S700V S710V | gens: 2004-2021, 2021-
66. Daihatsu Rocky | codes: A200S A210S | gens: 2019-
67. Daihatsu Thor | codes: M900S M910S | gens: 2016-
