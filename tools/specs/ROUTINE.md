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

## Scope

**288 brand+model pairs** — every entry in `src/data/carData.js` with no row in
`src/utils/carSpecs.js`. That is 83% of the catalogue: 345 pairs exist, 57 have
specs. Whole brands sit at zero — BMW, Audi, Mercedes, Hyundai, Kia, Lexus,
Volkswagen, Daihatsu, Suzuki, Subaru, Volvo.

At two to three generations each, expect roughly **700-800 rows** when it is
finished. At 20 models a run, three runs a day, that is **about five days**. The
run after the last one finds nothing left, replies "backlog complete" and stops —
disable the routine then.

## How the order was decided

There is **no search data on this platform** — `analytics_events` has no search
or filter event, and `car_hunts` is empty. So the demand proxy is Malaysian new
registrations, 2023 to Jul 2026, out of `reg_car_month` (the JPJ open data behind
the Market Demand tab), matched to the catalogue on a normalised brand+model key.

227 of the 288 matched a real registration count. The other 61 have none in that
window — discontinued, grey import, or never sold here — and sort last,
alphabetically. If real search data ever exists, re-rank on it.

## Why it self-sequences

Each run starts cold, reads `car_specs` to see which models already have rows,
and takes the next 20 that do not. No shared state, no coordination. A re-run is
harmless: the table is unique on (make, model, year_from) and the prompt inserts
with `on conflict do nothing`.

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
6. Where the backlog lists chassis codes they came from the platform's existing Japanese-import decoder and are a starting point only: **correct them if they are wrong or incomplete**, and put the correction in source_note. Lexus RX in particular is known to be missing its AGL20/AGL25 codes. Most entries have no codes because the car is European, Korean, Chinese or Malaysian-assembled and never had a Japanese chassis code — write `'{}'` for those, do not invent one.
7. The number beside each entry is that nameplate's Malaysian new registrations, 2023 to Jul 2026. It sets the order; it is not a spec and never goes in a row. `0` means the nameplate has no registrations in that window — discontinued, grey import, or never sold here. Still collect it, but a nameplate with no Malaysian presence is a fair candidate to skip if you cannot do it above 'low'.

## Step 3 — report

Finish with a short plain-text summary, not JSON:
- which models you wrote, and how many generation rows each
- the confidence spread
- anything you skipped and why
- any backlog entry whose chassis codes or generation boundaries you corrected

Then verify with `select count(*) from public.car_specs;` and state the new total.

## Backlog — 288 models, in demand order. Take the next 20 not already in the table.

  1. 20792  Ford Ranger | codes: —
  2. 17377  Chery Omoda 5 | codes: —
  3. 12970  BYD Atto 3 | codes: —
  4. 12274  Lexus RX | codes: GGL10 GYL10 GGL20 GYL20 TALA10 AALH10
  5.  8531  Mercedes C-Class | codes: —
  6.  8475  Tesla Model 3 | codes: —
  7.  8350  Tesla Model Y | codes: —
  8.  7780  Mazda Mazda 3 | codes: BM5FS BMLFS
  9.  7542  Haval H6 | codes: —
 10.  7448  BMW 3 Series | codes: —
 11.  7244  Mercedes A-Class | codes: —
 12.  6107  Mercedes GLC | codes: —
 13.  4885  Mercedes E-Class | codes: —
 14.  4790  Lexus NX | codes: AGZ10 AYZ10 AAZH20 TAZA20
 15.  4194  BYD Seal | codes: —
 16.  4157  Volkswagen Tiguan | codes: —
 17.  4067  Kia Carnival | codes: —
 18.  3808  Toyota Land Cruiser | codes: URJ200 UZJ200 VDJ200 VJA300 FJA300
 19.  3712  BMW X1 | codes: —
 20.  3522  BMW 5 Series | codes: —
 21.  3490  Porsche Cayenne | codes: —
 22.  3485  MINI Countryman | codes: —
 23.  3456  Mercedes CLA | codes: —
 24.  3254  Mercedes GLA | codes: —
 25.  3163  Honda Stepwgn | codes: RK1 RK5 RP1 RP3 RP5 RP6 RP8
 26.  2831  BYD Dolphin | codes: —
 27.  2787  BMW X3 | codes: —
 28.  2568  MINI Cooper | codes: —
 29.  2527  Subaru XV | codes: GP7 GT3 GT7
 30.  2275  BMW X4 | codes: —
 31.  2272  BMW 2 Series | codes: —
 32.  2255  MG MG5 | codes: —
 33.  2250  BMW X5 | codes: —
 34.  2131  Hyundai Staria | codes: —
 35.  1944  Volvo XC60 | codes: —
 36.  1916  Porsche Macan | codes: —
 37.  1910  BMW iX | codes: —
 38.  1899  Suzuki Jimny | codes: —
 39.  1819  Volkswagen Golf | codes: —
 40.  1674  Subaru Forester | codes: SH5 SH9 SJ5 SJG SK5 SK9 SKE
 41.  1657  Land Rover Defender | codes: —
 42.  1595  Nissan Kicks | codes: —
 43.  1498  Volvo XC90 | codes: —
 44.  1486  Volvo XC40 | codes: —
 45.  1471  Toyota GR86 | codes: ZN8
 46.  1409  Mercedes GLE | codes: —
 47.  1402  Chery Tiggo 7 | codes: —
 48.  1321  Porsche Taycan | codes: —
 49.  1305  Suzuki Swift | codes: —
 50.  1213  Mazda MX-5 | codes: NCEC ND5RC
 51.  1131  Lexus IS | codes: GSE20 GSE30 AVE30
 52.  1131  Mazda CX-60 | codes: —
 53.  1038  Mercedes G-Class | codes: —
 54.   966  BMW i5 | codes: —
 55.   940  Lexus LX | codes: URJ201 VJA310
 56.   905  Volkswagen Arteon | codes: —
 57.   897  BMW i4 | codes: —
 58.   876  Toyota Supra | codes: JZA80 DB02 DB22 DB42
 59.   812  Toyota Estima | codes: ACR50 GSR50 AHR20
 60.   794  Toyota 86 | codes: ZN6
 61.   790  Mercedes S-Class | codes: —
 62.   758  BMW 7 Series | codes: —
 63.   603  Chery Tiggo 8 | codes: —
 64.   572  Volvo EX30 | codes: —
 65.   560  Kia Sportage | codes: —
 66.   533  BMW 4 Series | codes: —
 67.   522  Volvo C40 | codes: —
 68.   512  Land Rover Range Rover | codes: —
 69.   502  MINI Clubman | codes: —
 70.   496  Toyota Crown | codes: GRS200 GRS210 AWS210 ARS220 AZSH20
 71.   474  Lamborghini Urus | codes: —
 72.   462  Lexus ES | codes: AXZH10
 73.   458  Land Rover Range Rover Sport | codes: —
 74.   457  Subaru BRZ | codes: ZC6 ZD8
 75.   440  Land Rover Range Rover Velar | codes: —
 76.   422  BMW X7 | codes: —
 77.   400  MG HS | codes: —
 78.   366  Ford Everest | codes: —
 79.   364  Hyundai Santa Fe | codes: —
 80.   355  Mercedes GLB | codes: —
 81.   333  Audi Q8 | codes: —
 82.   318  Nissan GT-R | codes: R35
 83.   303  Hyundai Tucson | codes: —
 84.   301  Lexus UX | codes: MZAA10 MZAH10
 85.   296  Mazda BT-50 | codes: —
 86.   294  Mazda Mazda 2 | codes: DE3FS DE5FS DJ3FS DJ5FS
 87.   258  BMW 1 Series | codes: —
 88.   252  Ford Mustang | codes: —
 89.   249  Toyota C-HR | codes: NGX10 NGX50 ZYX10 ZYX11
 90.   245  BMW Z4 | codes: —
 91.   243  Kia Sorento | codes: —
 92.   237  Porsche Panamera | codes: —
 93.   230  Hyundai Ioniq 5 | codes: —
 94.   222  Hyundai Ioniq 6 | codes: —
 95.   216  Audi Q7 | codes: —
 96.   212  Daihatsu Move | codes: LA100S LA150S
 97.   209  Daihatsu Taft | codes: —
 98.   202  Hyundai Creta | codes: —
 99.   190  Mazda Mazda 6 | codes: GJ2FP GJ5FP
100.   161  Volvo S60 | codes: —
101.   158  Volvo V60 | codes: —
102.   147  MINI Convertible | codes: —
103.   138  Volvo S90 | codes: —
104.   137  Volkswagen Touareg | codes: —
105.   136  Lamborghini Huracan | codes: —
106.   136  Volvo EX90 | codes: —
107.   128  Subaru WRX | codes: GDB GRB VAB VAG
108.   117  Audi A5 | codes: —
109.   117  BMW 8 Series | codes: —
110.   116  Bentley Bentayga | codes: —
111.   115  MG ZS | codes: —
112.   113  Honda Stream | codes: —
113.   112  Ferrari F8 | codes: —
114.   108  BMW X6 | codes: —
115.   104  Honda Fit | codes: —
116.   102  Subaru Levorg | codes: VM4 VMG VN5
117.    99  Rolls Royce Cullinan | codes: —
118.    98  Lexus RC | codes: ASC10 GSC10
119.    95  Audi RS3 | codes: —
120.    91  Hyundai Kona | codes: —
121.    91  Land Rover Range Rover Evoque | codes: —
122.    85  Ferrari Roma | codes: —
123.    85  Mercedes CLS | codes: —
124.    83  Lexus LC | codes: URZ100
125.    77  Audi TT | codes: —
126.    73  Audi Q5 | codes: —
127.    62  Daihatsu Tanto | codes: L375S LA600S LA650S
128.    59  Rolls Royce Ghost | codes: —
129.    58  Ferrari 812 | codes: —
130.    58  Jaguar I-Pace | codes: —
131.    55  Bentley Continental GT | codes: —
132.    55  Hyundai Palisade | codes: —
133.    55  Mazda CX-9 | codes: —
134.    51  Ferrari Purosangue | codes: —
135.    50  Audi Q3 | codes: —
136.    48  Mercedes GLS | codes: —
137.    46  Mercedes V-Class | codes: —
138.    44  Kia EV6 | codes: —
139.    44  Lexus LS | codes: USF40 VXFA50
140.    42  Rolls Royce Spectre | codes: —
141.    41  Ferrari SF90 | codes: —
142.    41  Mitsubishi Lancer | codes: —
143.    38  Daihatsu Copen | codes: L880K LA400K
144.    38  Nissan Leaf | codes: AZE0 ZE1
145.    36  Audi RS6 | codes: —
146.    30  Toyota RAV4 | codes: ZSA44 MXAA54 AXAH54
147.    29  Alfa Romeo Giulia | codes: —
148.    29  Audi A7 | codes: —
149.    29  Mercedes AMG GT | codes: —
150.    28  Audi A4 | codes: —
151.    28  Audi S3 | codes: —
152.    28  Lamborghini Revuelto | codes: —
153.    28  Subaru Impreza | codes: —
154.    27  Porsche 911 | codes: —
155.    27  Tesla Model X | codes: —
156.    26  Land Rover Discovery | codes: —
157.    24  Honda S2000 | codes: AP1 AP2
158.    24  Nissan Teana | codes: —
159.    21  Rolls Royce Phantom | codes: —
160.    20  Mazda RX-7 | codes: —
161.    18  Jaguar F-Pace | codes: —
162.    17  Subaru Outback | codes: —
163.    16  Audi A8 | codes: —
164.    16  Daihatsu Move Canbus | codes: LA800S LA810S LA850S LA860S
165.    15  Honda NSX | codes: —
166.    14  Audi A6 | codes: —
167.    14  Jaguar XF | codes: —
168.    13  Rolls Royce Wraith | codes: —
169.    12  Ferrari Portofino | codes: —
170.    12  Lexus GX | codes: —
171.    11  Kia Niro | codes: —
172.    10  Audi RS5 | codes: —
173.    10  Volkswagen Polo | codes: —
174.     9  Audi RS4 | codes: —
175.     9  Daihatsu Wake | codes: —
176.     9  Lexus GS | codes: —
177.     8  Hyundai Elantra | codes: —
178.     8  Nissan Murano | codes: —
179.     7  Honda Freed | codes: GB3 GB4 GB5 GB6 GB7 GB8
180.     7  Jaguar F-Type | codes: —
181.     7  Jaguar XJ | codes: —
182.     7  Mazda RX-8 | codes: SE3P
183.     7  Mitsubishi Pajero | codes: —
184.     6  Alfa Romeo Stelvio | codes: —
185.     6  Audi A3 | codes: —
186.     6  Tesla Model S | codes: —
187.     6  Toyota Prius | codes: NHW20 ZVW30 ZVW35 ZVW50 ZVW51 ZVW55 MXWH60
188.     6  Toyota Sienta | codes: NHP170 NSP170 NCP175 MXPC10 MXPL10
189.     5  Kia Cerato | codes: —
190.     5  Suzuki Alto | codes: —
191.     5  Volkswagen T-Roc | codes: —
192.     4  Honda ZR-V | codes: —
193.     4  Hyundai Sonata | codes: —
194.     4  Nissan March | codes: K12 K13
195.     3  Alfa Romeo 4C | codes: —
196.     3  Alfa Romeo Giulietta | codes: —
197.     3  Audi R8 | codes: —
198.     3  Bentley Mulsanne | codes: —
199.     3  Jaguar XE | codes: —
200.     3  Kia Stinger | codes: —
201.     3  Nissan Note | codes: E11 E12 E13
202.     3  Rolls Royce Dawn | codes: —
203.     2  Audi S4 | codes: —
204.     2  Kia Picanto | codes: —
205.     2  Nissan Juke | codes: F15
206.     2  Porsche Cayman | codes: —
207.     2  Subaru Crosstrek | codes: —
208.     2  Subaru Legacy | codes: —
209.     1  Daihatsu Mira | codes: L275S LA350S
210.     1  Daihatsu Thor | codes: M900S M910S
211.     1  Ford Focus | codes: —
212.     1  Honda CR-Z | codes: —
213.     1  Honda Insight | codes: ZE2 ZE4
214.     1  Honda Legend | codes: —
215.     1  Hyundai i20 | codes: —
216.     1  Hyundai i30 | codes: —
217.     1  Kia Rio | codes: —
218.     1  Kia Soul | codes: —
219.     1  Mitsubishi Attrage | codes: —
220.     1  Mitsubishi Galant | codes: —
221.     1  Mitsubishi Mirage | codes: —
222.     1  Nissan Terra | codes: —
223.     1  Porsche Boxster | codes: —
224.     1  Volkswagen ID.4 | codes: —
225.     1  Volkswagen Jetta | codes: —
226.     1  Volkswagen Passat | codes: —
227.     1  Volkswagen T-Cross | codes: —
228.     0  Alfa Romeo Tonale | codes: —
229.     0  Audi e-tron GT | codes: —
230.     0  Bentley Flying Spur | codes: —
231.     0  BMW M2 | codes: —
232.     0  BMW M3 | codes: —
233.     0  BMW M4 | codes: —
234.     0  BMW M5 | codes: —
235.     0  BYD Destroyer 05 | codes: —
236.     0  BYD Han | codes: —
237.     0  BYD Tang | codes: —
238.     0  Chery Tiggo 4 | codes: —
239.     0  Daihatsu Boon | codes: —
240.     0  Daihatsu Cast | codes: —
241.     0  Daihatsu Hijet | codes: S321V S331V S700V S710V
242.     0  Daihatsu Mira e:S | codes: —
243.     0  Daihatsu Rocky | codes: A200S A210S
244.     0  Daihatsu Terios | codes: —
245.     0  Ford Bronco | codes: —
246.     0  Ford Explorer | codes: —
247.     0  Ford F-150 | codes: —
248.     0  Ford Fiesta | codes: —
249.     0  Ford Puma | codes: —
250.     0  Geely Azkarra | codes: —
251.     0  Geely Coolray | codes: —
252.     0  Geely Okavango | codes: —
253.     0  Haval H2 | codes: —
254.     0  Haval H9 | codes: —
255.     0  Haval Jolion | codes: —
256.     0  Honda Mobilio | codes: —
257.     0  Honda Pilot | codes: —
258.     0  Hyundai i10 | codes: —
259.     0  Hyundai Veloster | codes: —
260.     0  Hyundai Venue | codes: —
261.     0  Jaguar E-Pace | codes: —
262.     0  Kia K5 | codes: —
263.     0  Kia Seltos | codes: —
264.     0  Kia Telluride | codes: —
265.     0  Land Rover Discovery Sport | codes: —
266.     0  Mercedes SL | codes: —
267.     0  MG MG3 | codes: —
268.     0  MG MG6 | codes: —
269.     0  Mitsubishi Eclipse Cross | codes: —
270.     0  Mitsubishi Evo | codes: CT9A CZ4A
271.     0  Nissan 350Z | codes: —
272.     0  Nissan 370Z | codes: —
273.     0  Nissan Patrol | codes: —
274.     0  Nissan Qashqai | codes: —
275.     0  Nissan Sylphy | codes: —
276.     0  Proton Arena | codes: —
277.     0  Proton Juara | codes: —
278.     0  Subaru STI | codes: —
279.     0  Suzuki Baleno | codes: —
280.     0  Suzuki Celerio | codes: —
281.     0  Suzuki Ciaz | codes: —
282.     0  Suzuki Ertiga | codes: —
283.     0  Suzuki SX4 | codes: —
284.     0  Suzuki Vitara | codes: —
285.     0  Suzuki XL7 | codes: —
286.     0  Tesla Cybertruck | codes: —
287.     0  Toyota Prado | codes: TRJ150 GDJ150
288.     0  Volkswagen Amarok | codes: —
