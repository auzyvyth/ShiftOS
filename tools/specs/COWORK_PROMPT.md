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

## The backlog — 288 models, work down this list

Every brand+model in the listing form with no spec row — 83% of the catalogue
(345 pairs exist, 57 have specs). Whole brands are at zero: BMW, Audi,
Mercedes, Hyundai, Kia, Lexus, Volkswagen, Daihatsu, Suzuki, Subaru, Volvo.

The number is that nameplate's Malaysian new registrations, 2023 to Jul 2026,
from JPJ open data. There is no search data on this platform, so registrations
are the demand proxy. A 0 means no registrations in that window — discontinued,
grey import, or never sold here — and those sort last.

A dash for codes means the car never had a Japanese chassis code (European,
Korean, Chinese or Malaysian-assembled). Do not invent one.

- [ ]   1. 20792  Ford Ranger
           codes: —
- [ ]   2. 17377  Chery Omoda 5
           codes: —
- [ ]   3. 12970  BYD Atto 3
           codes: —
- [ ]   4. 12274  Lexus RX
           codes: GGL10 GYL10 GGL20 GYL20 TALA10 AALH10
- [ ]   5.  8531  Mercedes C-Class
           codes: —
- [ ]   6.  8475  Tesla Model 3
           codes: —
- [ ]   7.  8350  Tesla Model Y
           codes: —
- [ ]   8.  7780  Mazda Mazda 3
           codes: BM5FS BMLFS
- [ ]   9.  7542  Haval H6
           codes: —
- [ ]  10.  7448  BMW 3 Series
           codes: —
- [ ]  11.  7244  Mercedes A-Class
           codes: —
- [ ]  12.  6107  Mercedes GLC
           codes: —
- [ ]  13.  4885  Mercedes E-Class
           codes: —
- [ ]  14.  4790  Lexus NX
           codes: AGZ10 AYZ10 AAZH20 TAZA20
- [ ]  15.  4194  BYD Seal
           codes: —
- [ ]  16.  4157  Volkswagen Tiguan
           codes: —
- [ ]  17.  4067  Kia Carnival
           codes: —
- [ ]  18.  3808  Toyota Land Cruiser
           codes: URJ200 UZJ200 VDJ200 VJA300 FJA300
- [ ]  19.  3712  BMW X1
           codes: —
- [ ]  20.  3522  BMW 5 Series
           codes: —
- [ ]  21.  3490  Porsche Cayenne
           codes: —
- [ ]  22.  3485  MINI Countryman
           codes: —
- [ ]  23.  3456  Mercedes CLA
           codes: —
- [ ]  24.  3254  Mercedes GLA
           codes: —
- [ ]  25.  3163  Honda Stepwgn
           codes: RK1 RK5 RP1 RP3 RP5 RP6 RP8
- [ ]  26.  2831  BYD Dolphin
           codes: —
- [ ]  27.  2787  BMW X3
           codes: —
- [ ]  28.  2568  MINI Cooper
           codes: —
- [ ]  29.  2527  Subaru XV
           codes: GP7 GT3 GT7
- [ ]  30.  2275  BMW X4
           codes: —
- [ ]  31.  2272  BMW 2 Series
           codes: —
- [ ]  32.  2255  MG MG5
           codes: —
- [ ]  33.  2250  BMW X5
           codes: —
- [ ]  34.  2131  Hyundai Staria
           codes: —
- [ ]  35.  1944  Volvo XC60
           codes: —
- [ ]  36.  1916  Porsche Macan
           codes: —
- [ ]  37.  1910  BMW iX
           codes: —
- [ ]  38.  1899  Suzuki Jimny
           codes: —
- [ ]  39.  1819  Volkswagen Golf
           codes: —
- [ ]  40.  1674  Subaru Forester
           codes: SH5 SH9 SJ5 SJG SK5 SK9 SKE
- [ ]  41.  1657  Land Rover Defender
           codes: —
- [ ]  42.  1595  Nissan Kicks
           codes: —
- [ ]  43.  1498  Volvo XC90
           codes: —
- [ ]  44.  1486  Volvo XC40
           codes: —
- [ ]  45.  1471  Toyota GR86
           codes: ZN8
- [ ]  46.  1409  Mercedes GLE
           codes: —
- [ ]  47.  1402  Chery Tiggo 7
           codes: —
- [ ]  48.  1321  Porsche Taycan
           codes: —
- [ ]  49.  1305  Suzuki Swift
           codes: —
- [ ]  50.  1213  Mazda MX-5
           codes: NCEC ND5RC
- [ ]  51.  1131  Lexus IS
           codes: GSE20 GSE30 AVE30
- [ ]  52.  1131  Mazda CX-60
           codes: —
- [ ]  53.  1038  Mercedes G-Class
           codes: —
- [ ]  54.   966  BMW i5
           codes: —
- [ ]  55.   940  Lexus LX
           codes: URJ201 VJA310
- [ ]  56.   905  Volkswagen Arteon
           codes: —
- [ ]  57.   897  BMW i4
           codes: —
- [ ]  58.   876  Toyota Supra
           codes: JZA80 DB02 DB22 DB42
- [ ]  59.   812  Toyota Estima
           codes: ACR50 GSR50 AHR20
- [ ]  60.   794  Toyota 86
           codes: ZN6
- [ ]  61.   790  Mercedes S-Class
           codes: —
- [ ]  62.   758  BMW 7 Series
           codes: —
- [ ]  63.   603  Chery Tiggo 8
           codes: —
- [ ]  64.   572  Volvo EX30
           codes: —
- [ ]  65.   560  Kia Sportage
           codes: —
- [ ]  66.   533  BMW 4 Series
           codes: —
- [ ]  67.   522  Volvo C40
           codes: —
- [ ]  68.   512  Land Rover Range Rover
           codes: —
- [ ]  69.   502  MINI Clubman
           codes: —
- [ ]  70.   496  Toyota Crown
           codes: GRS200 GRS210 AWS210 ARS220 AZSH20
- [ ]  71.   474  Lamborghini Urus
           codes: —
- [ ]  72.   462  Lexus ES
           codes: AXZH10
- [ ]  73.   458  Land Rover Range Rover Sport
           codes: —
- [ ]  74.   457  Subaru BRZ
           codes: ZC6 ZD8
- [ ]  75.   440  Land Rover Range Rover Velar
           codes: —
- [ ]  76.   422  BMW X7
           codes: —
- [ ]  77.   400  MG HS
           codes: —
- [ ]  78.   366  Ford Everest
           codes: —
- [ ]  79.   364  Hyundai Santa Fe
           codes: —
- [ ]  80.   355  Mercedes GLB
           codes: —
- [ ]  81.   333  Audi Q8
           codes: —
- [ ]  82.   318  Nissan GT-R
           codes: R35
- [ ]  83.   303  Hyundai Tucson
           codes: —
- [ ]  84.   301  Lexus UX
           codes: MZAA10 MZAH10
- [ ]  85.   296  Mazda BT-50
           codes: —
- [ ]  86.   294  Mazda Mazda 2
           codes: DE3FS DE5FS DJ3FS DJ5FS
- [ ]  87.   258  BMW 1 Series
           codes: —
- [ ]  88.   252  Ford Mustang
           codes: —
- [ ]  89.   249  Toyota C-HR
           codes: NGX10 NGX50 ZYX10 ZYX11
- [ ]  90.   245  BMW Z4
           codes: —
- [ ]  91.   243  Kia Sorento
           codes: —
- [ ]  92.   237  Porsche Panamera
           codes: —
- [ ]  93.   230  Hyundai Ioniq 5
           codes: —
- [ ]  94.   222  Hyundai Ioniq 6
           codes: —
- [ ]  95.   216  Audi Q7
           codes: —
- [ ]  96.   212  Daihatsu Move
           codes: LA100S LA150S
- [ ]  97.   209  Daihatsu Taft
           codes: —
- [ ]  98.   202  Hyundai Creta
           codes: —
- [ ]  99.   190  Mazda Mazda 6
           codes: GJ2FP GJ5FP
- [ ] 100.   161  Volvo S60
           codes: —
- [ ] 101.   158  Volvo V60
           codes: —
- [ ] 102.   147  MINI Convertible
           codes: —
- [ ] 103.   138  Volvo S90
           codes: —
- [ ] 104.   137  Volkswagen Touareg
           codes: —
- [ ] 105.   136  Lamborghini Huracan
           codes: —
- [ ] 106.   136  Volvo EX90
           codes: —
- [ ] 107.   128  Subaru WRX
           codes: GDB GRB VAB VAG
- [ ] 108.   117  Audi A5
           codes: —
- [ ] 109.   117  BMW 8 Series
           codes: —
- [ ] 110.   116  Bentley Bentayga
           codes: —
- [ ] 111.   115  MG ZS
           codes: —
- [ ] 112.   113  Honda Stream
           codes: —
- [ ] 113.   112  Ferrari F8
           codes: —
- [ ] 114.   108  BMW X6
           codes: —
- [ ] 115.   104  Honda Fit
           codes: —
- [ ] 116.   102  Subaru Levorg
           codes: VM4 VMG VN5
- [ ] 117.    99  Rolls Royce Cullinan
           codes: —
- [ ] 118.    98  Lexus RC
           codes: ASC10 GSC10
- [ ] 119.    95  Audi RS3
           codes: —
- [ ] 120.    91  Hyundai Kona
           codes: —
- [ ] 121.    91  Land Rover Range Rover Evoque
           codes: —
- [ ] 122.    85  Ferrari Roma
           codes: —
- [ ] 123.    85  Mercedes CLS
           codes: —
- [ ] 124.    83  Lexus LC
           codes: URZ100
- [ ] 125.    77  Audi TT
           codes: —
- [ ] 126.    73  Audi Q5
           codes: —
- [ ] 127.    62  Daihatsu Tanto
           codes: L375S LA600S LA650S
- [ ] 128.    59  Rolls Royce Ghost
           codes: —
- [ ] 129.    58  Ferrari 812
           codes: —
- [ ] 130.    58  Jaguar I-Pace
           codes: —
- [ ] 131.    55  Bentley Continental GT
           codes: —
- [ ] 132.    55  Hyundai Palisade
           codes: —
- [ ] 133.    55  Mazda CX-9
           codes: —
- [ ] 134.    51  Ferrari Purosangue
           codes: —
- [ ] 135.    50  Audi Q3
           codes: —
- [ ] 136.    48  Mercedes GLS
           codes: —
- [ ] 137.    46  Mercedes V-Class
           codes: —
- [ ] 138.    44  Kia EV6
           codes: —
- [ ] 139.    44  Lexus LS
           codes: USF40 VXFA50
- [ ] 140.    42  Rolls Royce Spectre
           codes: —
- [ ] 141.    41  Ferrari SF90
           codes: —
- [ ] 142.    41  Mitsubishi Lancer
           codes: —
- [ ] 143.    38  Daihatsu Copen
           codes: L880K LA400K
- [ ] 144.    38  Nissan Leaf
           codes: AZE0 ZE1
- [ ] 145.    36  Audi RS6
           codes: —
- [ ] 146.    30  Toyota RAV4
           codes: ZSA44 MXAA54 AXAH54
- [ ] 147.    29  Alfa Romeo Giulia
           codes: —
- [ ] 148.    29  Audi A7
           codes: —
- [ ] 149.    29  Mercedes AMG GT
           codes: —
- [ ] 150.    28  Audi A4
           codes: —
- [ ] 151.    28  Audi S3
           codes: —
- [ ] 152.    28  Lamborghini Revuelto
           codes: —
- [ ] 153.    28  Subaru Impreza
           codes: —
- [ ] 154.    27  Porsche 911
           codes: —
- [ ] 155.    27  Tesla Model X
           codes: —
- [ ] 156.    26  Land Rover Discovery
           codes: —
- [ ] 157.    24  Honda S2000
           codes: AP1 AP2
- [ ] 158.    24  Nissan Teana
           codes: —
- [ ] 159.    21  Rolls Royce Phantom
           codes: —
- [ ] 160.    20  Mazda RX-7
           codes: —
- [ ] 161.    18  Jaguar F-Pace
           codes: —
- [ ] 162.    17  Subaru Outback
           codes: —
- [ ] 163.    16  Audi A8
           codes: —
- [ ] 164.    16  Daihatsu Move Canbus
           codes: LA800S LA810S LA850S LA860S
- [ ] 165.    15  Honda NSX
           codes: —
- [ ] 166.    14  Audi A6
           codes: —
- [ ] 167.    14  Jaguar XF
           codes: —
- [ ] 168.    13  Rolls Royce Wraith
           codes: —
- [ ] 169.    12  Ferrari Portofino
           codes: —
- [ ] 170.    12  Lexus GX
           codes: —
- [ ] 171.    11  Kia Niro
           codes: —
- [ ] 172.    10  Audi RS5
           codes: —
- [ ] 173.    10  Volkswagen Polo
           codes: —
- [ ] 174.     9  Audi RS4
           codes: —
- [ ] 175.     9  Daihatsu Wake
           codes: —
- [ ] 176.     9  Lexus GS
           codes: —
- [ ] 177.     8  Hyundai Elantra
           codes: —
- [ ] 178.     8  Nissan Murano
           codes: —
- [ ] 179.     7  Honda Freed
           codes: GB3 GB4 GB5 GB6 GB7 GB8
- [ ] 180.     7  Jaguar F-Type
           codes: —
- [ ] 181.     7  Jaguar XJ
           codes: —
- [ ] 182.     7  Mazda RX-8
           codes: SE3P
- [ ] 183.     7  Mitsubishi Pajero
           codes: —
- [ ] 184.     6  Alfa Romeo Stelvio
           codes: —
- [ ] 185.     6  Audi A3
           codes: —
- [ ] 186.     6  Tesla Model S
           codes: —
- [ ] 187.     6  Toyota Prius
           codes: NHW20 ZVW30 ZVW35 ZVW50 ZVW51 ZVW55 MXWH60
- [ ] 188.     6  Toyota Sienta
           codes: NHP170 NSP170 NCP175 MXPC10 MXPL10
- [ ] 189.     5  Kia Cerato
           codes: —
- [ ] 190.     5  Suzuki Alto
           codes: —
- [ ] 191.     5  Volkswagen T-Roc
           codes: —
- [ ] 192.     4  Honda ZR-V
           codes: —
- [ ] 193.     4  Hyundai Sonata
           codes: —
- [ ] 194.     4  Nissan March
           codes: K12 K13
- [ ] 195.     3  Alfa Romeo 4C
           codes: —
- [ ] 196.     3  Alfa Romeo Giulietta
           codes: —
- [ ] 197.     3  Audi R8
           codes: —
- [ ] 198.     3  Bentley Mulsanne
           codes: —
- [ ] 199.     3  Jaguar XE
           codes: —
- [ ] 200.     3  Kia Stinger
           codes: —
- [ ] 201.     3  Nissan Note
           codes: E11 E12 E13
- [ ] 202.     3  Rolls Royce Dawn
           codes: —
- [ ] 203.     2  Audi S4
           codes: —
- [ ] 204.     2  Kia Picanto
           codes: —
- [ ] 205.     2  Nissan Juke
           codes: F15
- [ ] 206.     2  Porsche Cayman
           codes: —
- [ ] 207.     2  Subaru Crosstrek
           codes: —
- [ ] 208.     2  Subaru Legacy
           codes: —
- [ ] 209.     1  Daihatsu Mira
           codes: L275S LA350S
- [ ] 210.     1  Daihatsu Thor
           codes: M900S M910S
- [ ] 211.     1  Ford Focus
           codes: —
- [ ] 212.     1  Honda CR-Z
           codes: —
- [ ] 213.     1  Honda Insight
           codes: ZE2 ZE4
- [ ] 214.     1  Honda Legend
           codes: —
- [ ] 215.     1  Hyundai i20
           codes: —
- [ ] 216.     1  Hyundai i30
           codes: —
- [ ] 217.     1  Kia Rio
           codes: —
- [ ] 218.     1  Kia Soul
           codes: —
- [ ] 219.     1  Mitsubishi Attrage
           codes: —
- [ ] 220.     1  Mitsubishi Galant
           codes: —
- [ ] 221.     1  Mitsubishi Mirage
           codes: —
- [ ] 222.     1  Nissan Terra
           codes: —
- [ ] 223.     1  Porsche Boxster
           codes: —
- [ ] 224.     1  Volkswagen ID.4
           codes: —
- [ ] 225.     1  Volkswagen Jetta
           codes: —
- [ ] 226.     1  Volkswagen Passat
           codes: —
- [ ] 227.     1  Volkswagen T-Cross
           codes: —
- [ ] 228.     0  Alfa Romeo Tonale
           codes: —
- [ ] 229.     0  Audi e-tron GT
           codes: —
- [ ] 230.     0  Bentley Flying Spur
           codes: —
- [ ] 231.     0  BMW M2
           codes: —
- [ ] 232.     0  BMW M3
           codes: —
- [ ] 233.     0  BMW M4
           codes: —
- [ ] 234.     0  BMW M5
           codes: —
- [ ] 235.     0  BYD Destroyer 05
           codes: —
- [ ] 236.     0  BYD Han
           codes: —
- [ ] 237.     0  BYD Tang
           codes: —
- [ ] 238.     0  Chery Tiggo 4
           codes: —
- [ ] 239.     0  Daihatsu Boon
           codes: —
- [ ] 240.     0  Daihatsu Cast
           codes: —
- [ ] 241.     0  Daihatsu Hijet
           codes: S321V S331V S700V S710V
- [ ] 242.     0  Daihatsu Mira e:S
           codes: —
- [ ] 243.     0  Daihatsu Rocky
           codes: A200S A210S
- [ ] 244.     0  Daihatsu Terios
           codes: —
- [ ] 245.     0  Ford Bronco
           codes: —
- [ ] 246.     0  Ford Explorer
           codes: —
- [ ] 247.     0  Ford F-150
           codes: —
- [ ] 248.     0  Ford Fiesta
           codes: —
- [ ] 249.     0  Ford Puma
           codes: —
- [ ] 250.     0  Geely Azkarra
           codes: —
- [ ] 251.     0  Geely Coolray
           codes: —
- [ ] 252.     0  Geely Okavango
           codes: —
- [ ] 253.     0  Haval H2
           codes: —
- [ ] 254.     0  Haval H9
           codes: —
- [ ] 255.     0  Haval Jolion
           codes: —
- [ ] 256.     0  Honda Mobilio
           codes: —
- [ ] 257.     0  Honda Pilot
           codes: —
- [ ] 258.     0  Hyundai i10
           codes: —
- [ ] 259.     0  Hyundai Veloster
           codes: —
- [ ] 260.     0  Hyundai Venue
           codes: —
- [ ] 261.     0  Jaguar E-Pace
           codes: —
- [ ] 262.     0  Kia K5
           codes: —
- [ ] 263.     0  Kia Seltos
           codes: —
- [ ] 264.     0  Kia Telluride
           codes: —
- [ ] 265.     0  Land Rover Discovery Sport
           codes: —
- [ ] 266.     0  Mercedes SL
           codes: —
- [ ] 267.     0  MG MG3
           codes: —
- [ ] 268.     0  MG MG6
           codes: —
- [ ] 269.     0  Mitsubishi Eclipse Cross
           codes: —
- [ ] 270.     0  Mitsubishi Evo
           codes: CT9A CZ4A
- [ ] 271.     0  Nissan 350Z
           codes: —
- [ ] 272.     0  Nissan 370Z
           codes: —
- [ ] 273.     0  Nissan Patrol
           codes: —
- [ ] 274.     0  Nissan Qashqai
           codes: —
- [ ] 275.     0  Nissan Sylphy
           codes: —
- [ ] 276.     0  Proton Arena
           codes: —
- [ ] 277.     0  Proton Juara
           codes: —
- [ ] 278.     0  Subaru STI
           codes: —
- [ ] 279.     0  Suzuki Baleno
           codes: —
- [ ] 280.     0  Suzuki Celerio
           codes: —
- [ ] 281.     0  Suzuki Ciaz
           codes: —
- [ ] 282.     0  Suzuki Ertiga
           codes: —
- [ ] 283.     0  Suzuki SX4
           codes: —
- [ ] 284.     0  Suzuki Vitara
           codes: —
- [ ] 285.     0  Suzuki XL7
           codes: —
- [ ] 286.     0  Tesla Cybertruck
           codes: —
- [ ] 287.     0  Toyota Prado
           codes: TRJ150 GDJ150
- [ ] 288.     0  Volkswagen Amarok
           codes: —
