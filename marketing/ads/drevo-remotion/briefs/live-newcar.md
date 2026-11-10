# Brief: the Live ad for new-car SAs (draft script, waiting for the owner's OK)

Step 3 of the process in the `drevo-ad` skill: words only. Stills come after the owner approves this.
Owner's ask (2026-11-10): a video for Salesman Premium aimed at new-car sellers who do live
presentations, plus autopost to Instagram / Facebook / TikTok. Autopost is NOT in this ad (see the end).

## Who it is for
A Proton / Perodua / Toyota / Honda / BYD sales advisor who goes live on TikTok and gets the same
three comments all night: "bulanan berapa?", "deposit 0 boleh?", "gaji 3k lepas tak?".

## What the app really does (all checked in code)
| What | Where | Plan |
|---|---|---|
| Tap a deposit chip, the monthly rolls to the new figure; three tenure tiles | `src/components/live/LivePresenter.jsx` (`DepositChip`, `RollingNumber`) | Lite (basic) + Premium |
| Viewer view: type the viewer's take-home pay, get the dearest car that fits + a ladder of the stock | `LivePresenter.jsx` `budgetView`, `revealPick` in `src/utils/liveMaths.js` | Premium |
| Variant chips on a model card: price, monthly and "what this variant adds" follow the pick | `useNewCarVariant`, `variantExtras` in `liveMaths.js` | Premium |
| Rebate typed in place, insurance estimate with NCD pills | `LivePresenter.jsx` `rebateEdit`, `src/utils/motorInsurance.js` | Premium |
| No phone number, link or QR on screen unless the seller taps Contact | `LivePresenter.jsx` (contact OFF by default) | all |
| Official price list per zone for 5 brands, cards made by ticking models | `new_car_models`, `new_car_add_cards()` | all |
| A 7-day Premium trial gets the FULL presenter | `PLAN_CONFIG.salesman_full.trialDays`, `page_basic` false on trial | - |

## Real usage today (read-only, 2026-11-10)
- 10 standalone sellers, 6 of them sell new cars, 5 on Premium time right now, 0 payments logged.
- 37 live new-car model cards. Prices held for BYD, Honda, Perodua, Proton, Toyota.
- So the founding offer (RM35 for the first 10 payers) is still true: nobody has paid yet.

## Rules for this ad
- **Sample viewers only.** The @name and pay on screen are made up, labelled "Contoh data / Sample data".
- **Never approval.** Every monthly is the presenter's own maths with "Anggaran. Bank yang tentukan." /
  "Estimate. The bank decides." on screen. "Fits your budget", never "lulus" / "approved".
- **Car photos must be the owner's own.** Model-card stock photos need the brand's written permission
  (Copyright Act 1987 s.36). No brand logo drawn; the car's name as text is fine.
- **No TikTok UI or logo drawn.** The comment in the hook is our own white chip, not a copy of TikTok's.
- **Do not promise "your live is safe from strikes".** Say only what is true: no number, no link on screen.
- No invented numbers ("answer 50 comments", "3x more leads"). "One tap" is true and is the claim.

## Hook: three options (pick one)
| | Line 1 / *line 2* (BM) | EN | Why |
|---|---|---|---|
| **A (my pick)** | Gaji RM3,000. / *Dapat kereta apa?* | Pay RM3,000. / *Which car fits?* | It is the exact comment every live gets, in the owner's own words (REVEAL-1). An SA recognises it in one second, and it also stops ordinary viewers. |
| B | Viewer tanya bulanan. / *Jawab satu tap.* | They ask the monthly. / *Answer in one tap.* | Says the benefit straight. Weaker stop: no question to be curious about. |
| C | Masih kira guna Excel / *masa live?* | Still using Excel / *on your live?* | Names the pain. The first ad already used the Excel angle. |

## Draft script, one topic, ~24 s (hook A)
Retention is ~10%, so seconds 0-5 carry problem, payoff and offer. The rest is for the few who stay.

| Time | Picture (real presenter, recorded) | Headline BM / EN |
|---|---|---|
| 0-2.5 s | A white comment chip drops in: "@aiman: gaji 3k dapat kereta apa?". Monitor on the red floor shows the presenter, Viewer view, empty. | "Gaji RM3,000. / *Dapat kereta apa?*" / "Pay RM3,000. / *Which car fits?*" |
| 2.5-5 s | Same shot, one move: 3000 is typed, the answer car lands with its monthly, the ladder fills. Black pill: "Drevo Live · 7 hari percuma" / "Drevo Live · 7 days free". | "Jawab masa live. / *Satu tap.*" / "Answer it live. / *One tap.*" |
| Card 1: "Bulanan" / "Monthly" | Cars screen: tap 10% deposit, the big monthly rolls; tap the 9-year tile. | "Tap deposit. / *Bulanan terus tukar.*" / "Tap the deposit. / *Monthly follows.*" |
| Card 2: "Varian" / "Variant" | Tap a dearer variant chip: price, monthly and the "what it adds" strip change. | "Tukar varian. / *Harga ikut sekali.*" / "Switch variant. / *Price follows.*" |
| Card 3: "Rebat" / "Rebate" | Tap the rebate line, type the month's rebate, loan and monthly drop. NCD pill tapped. | "Rebat bulan ni? / *Taip, siap.*" / "This month's rebate? / *Type it. Done.*" |
| 20-24 s | CTA as in the renewals ad | "Cuba Premium / *7 hari percuma.*" + "RM35 sebulan untuk 10 penjual pertama, kemudian RM49" + drevo.my |

Fine print (above y 1440, every app scene): "Contoh data. Anggaran sahaja, bank yang tentukan." /
"Sample data. Estimates only, the bank decides."

Cut on purpose: Docs screen, salary guide, colour picker, live report, "no number on screen". Five
features in 24 s is already the limit; each one more costs the hook's viewers nothing but dilutes the tail.

## Open before stills
1. Owner picks the hook (A / B / C) and OKs the script.
2. Which car and whose photos: the owner's own photos of one new model (X50?) on `premiummotors` or `airyproton`.
3. `drevo.my` must open the app before the ad runs (`src/config/site.js` still says `xdrive.my`).
4. Harness: a `harness/live.html` mounting the real `LivePresenter` on sample cars (new file; the two
   existing harness pages cover the calculator and the Sold tab only).

## Autopost (Zernio): not in this ad, and not on the free plan (checked 2026-11-10)
The ad may only sell what exists (CPA 1999 s.10, same rule as the "AI coming" card). Autopost is not built.
- Zernio's free allowance is 2 connected accounts for OUR whole Zernio account, not 2 per seller.
  After that: $6 per account a month (accounts 3-10), $3 (11-100), $1 (101+). Posts are unlimited.
- One seller connecting Instagram + TikTok = 2 accounts = about $12 a month at the first tier, more than
  the RM35 they pay. At 10 sellers (20 accounts) the bill is about $78 a month against RM350 revenue.
- Facebook: the API posts to PAGES only. Not a personal profile, not Marketplace, not groups, which is
  where SAs actually sell. Instagram needs a Business or Creator account.
- TikTok: Zernio's app has a shared daily cap on direct posts across all its customers (their docs).
- Could not open docs.zernio.com from this session (host not allowed); figures are from search results
  of that page plus two reviews. Re-read the live pricing page before any decision.
Options, cheapest first: (1) pilot on the 2 free accounts with the owner's own Instagram + TikTok, cost 0;
(2) put autopost in "Done for you" (RM99), where $12 fits; (3) Premium add-on priced above its cost;
(4) our own TikTok + Meta apps (free per post, weeks of app review each). See TODO IDEA-16.

## DMS video: later
Not before the DMS-AUDIT holes are closed. Higgsfield (AI video) can only make scene footage around the
app (a showroom, a handover): the app itself must still be the real recording (STYLE.md), and never an
AI-made car presented as stock.

## Competitor ad seen by the owner (2026-11-10): "Zweet Data" calculator
A static image ad with a "Chat on WhatsApp" button, selling a spreadsheet loan calculator per brand.
Their lines: "Tool Wajib Setiap SA", "Kira loan depan customer dalam 10 saat", "Tunjuk kiraan LIVE ikut
bajet customer", "Adjust deposit, interest, dan loan tahun terus masa live", "customer terus DM nak booking".
What it tells us:
- The market already knows "a calculator for my live". We do not need to explain the category.
- A sheet works ONE car at a time. It cannot answer "gaji 3k dapat kereta apa?" across the stock. Ours
  can (Viewer view), so hook A is the gap, and "10 saat" vs "satu tap" is ours to win.
- Their sheet prints the SA's phone number on the calculator. TikTok can strike a live for that; ours keeps it off.
- Their sheets show 3.00% / 2.60%, which read as flat rates. Ours converts to EIR (`src/utils/financing.js`).
  Do NOT say this about them in an ad without checking their product first.
- They draw Honda / Proton / Perodua logos. We do not (no brand permission).
- Theirs is paid. Our basic Live calculator is FREE on Lite (LIVE-BASIC). That is the strongest counter.
Changes proposed to the script (owner to OK):
1. Second hook line becomes "Excel tak boleh jawab. / *Drevo satu tap.*" / "A spreadsheet can't. / *Drevo, one tap.*"
   (never name the competitor).
2. CTA leads with free: "Kalkulator live: *percuma.*" then "Premium 7 hari percuma · RM35 sebulan untuk
   10 penjual pertama, kemudian RM49".
3. Also cut a STATIC image from the approved stills for a Meta click-to-WhatsApp ad, the format they
   use: cheap, and it lands in the owner's WhatsApp, which is how accounts are set up today.
