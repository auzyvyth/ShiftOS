# Brief: the free Live calculator ad for new-car SAs (script v2, waiting for the owner's OK)

Step 3 of the process in the `drevo-ad` skill: words only. Stills come after the owner approves this.
Owner's direction (2026-11-10): the hook is "a spreadsheet calculator costs RM70, ours is free", and
rebate + insurance moved into the free presenter so the claim is true.

## Who it is for
A Proton / Perodua / Toyota / Honda / BYD sales advisor who goes live on TikTok and answers
"bulanan berapa?", "rebat ada?", "NCD saya 45%" all night, today from a paid spreadsheet.

## What the FREE presenter does (checked in code and on screen, 2026-11-10)
| What | Where |
|---|---|
| Tap a deposit chip, the monthly rolls; 9 / 7 / 5 year tiles | `src/components/live/LivePresenter.jsx` (`DepositChip`, `RollingNumber`) |
| Rebate typed on its own line (new cars), loan and monthly follow | `LivePresenter.jsx` `rebateEdit`; free since 2026-11-10 |
| Insurance estimate in the loan, NCD pills (0 to 55%), or type the insurer's figure | `LivePresenter.jsx` `insFor`, `src/utils/motorInsurance.js`; free since 2026-11-10 |
| Rate as EIR or the bank's flat rate (converted per tenure) | `src/utils/financing.js` `flatToEir` |
| Official price per zone for 5 brands, cards made by ticking models | `new_car_models`, `new_car_add_cards()` |
| No phone number, link or QR on screen unless the seller taps Contact | contact OFF by default |
Tested on the harness (`harness/main.jsx?basic=1&new=1`) at 375x667 and 1366x768: fits with no scroll;
175,000 + 2,918 insurance - 3,000 rebate - 17,200 deposit = 157,718 loan.

Premium only (the ad's last scene): Viewer + Budget ("gaji 3k dapat kereta apa?"), Docs, variant extras,
totals, salary guide, the every-car rebate list, colour, comment line, car list.

## What the free one does NOT do (so the ad never says "everything")
- Budget view ("ikut bajet customer") is Premium. The ad says "deposit, rebat, insurans", never "semua".
- On Lite a used / recon car has no rebate line (the every-car list is Premium). The ad shows a new car.
- Not live yet: the change is on branch `ccr-abb5c812-3sxmyn`. The ad cannot run before it is in production.

## Real usage today (read-only, 2026-11-10)
- 10 standalone sellers, 6 sell new cars, 5 on Premium time now, 0 payments logged (all 10 founding spots open).
- 37 live new-car model cards. Prices held for BYD, Honda, Perodua, Proton, Toyota.

## Rules for this ad
- **RM70 needs proof on file**: a dated screenshot of the competitor's price, kept by the owner. Fine print
  on the hook: "Harga kalkulator Excel berbayar, dilihat Nov 2026." Never name them. No screenshot = use
  the fallback hook below (no number).
- **"Percuma" must be plain**: Lite is free with no card and no end date. Say so; do not let the 7-day
  Premium trial read as the free part (CPA 1999 s.10, s.14 free offers).
- **Never approval.** Every monthly is the presenter's maths with "Anggaran. Bank yang tentukan."
- **Insurance is an estimate** and is labelled so on the app's own row.
- Sample viewer in the Premium scene, labelled "Contoh data". Owner's own car photos only (Copyright Act
  1987 s.36 for stock model photos). No brand logo, no TikTok UI, no Excel UI or logo drawn.
- No "your live is safe from strikes", no invented numbers.

## Script v2, ~26 s
| Time | Picture (real free presenter, recorded) | Headline BM / EN |
|---|---|---|
| 0-2.5 s | Phone on the red floor, presenter open on a new car, big monthly on screen. | "Kalkulator Excel: RM70. / *Drevo: percuma.*" / "Excel calculator: RM70. / *Drevo: free.*" |
| 2.5-5 s | Same shot, one move: tap 10% deposit, the monthly rolls; tap the 9-year tile. Black pill: "Percuma. Tiada kad." / "Free. No card." | "Deposit, rebat, insurans. / *Satu tap, masa live.*" / "Deposit, rebate, insurance. / *One tap, on your live.*" |
| Card 1: "Rebat" / "Rebate" | Tap the Rebate line, type 3000, loan and monthly drop. | "Rebat bulan ni? / *Taip, siap.*" / "This month's rebate? / *Type it. Done.*" |
| Card 2: "Insurans" / "Insurance" | Tap NCD 45%: insurance, loan and monthly change. | "NCD 45%? / *Tap sekali.*" / "45% NCD? / *One tap.*" |
| Card 3: "Premium" | Viewer view: 3000 typed, the answer car lands, the ladder fills. Small tag "Premium · 7 hari percuma". | "Gaji RM3,000. / *Dapat kereta apa?*" / "Pay RM3,000. / *Which car fits?*" |
| 22-26 s | CTA | "Kalkulator live: / *percuma.*" + drevo.my + "Premium: 7 hari percuma, RM35 sebulan untuk 10 penjual pertama, kemudian RM49" |

Fallback hook (no price proof): "Kalkulator loan berbayar? / *Drevo: percuma.*" / "Paying for a loan calculator? / *Drevo is free.*"
Fine print (above y 1440, app scenes): "Anggaran sahaja, bank yang tentukan." / "Estimates only, the bank decides."

Also cut one STATIC image from the approved hook still for a Meta click-to-WhatsApp ad (the competitor's format).

## Open before stills
1. Owner OKs script v2, and sends the RM70 screenshot (or picks the fallback hook).
2. Which new car and the owner's own photos of it.
3. The free rebate + insurance change tested on staging, then released (after midnight rule).
4. `drevo.my` must open the app (`src/config/site.js` still says `xdrive.my`).
5. Harness: record with `?basic=1&new=1` for scenes 1-4 and the full presenter for the Premium scene.

## Competitor seen 2026-11-10 ("Zweet Data", owner's screenshot, not stored here)
A static image ad with a "Chat on WhatsApp" button selling a spreadsheet loan calculator per brand:
"Tool Wajib Setiap SA", "Kira loan depan customer dalam 10 saat". One car at a time, the SA's phone number
printed on the sheet, brand logos drawn, rates shown as 3.00% / 2.60% (read as flat; do not claim this
about them without checking their product).

## Autopost (Zernio): not in this ad, and not on the free plan (checked 2026-11-10)
Not built, so not advertised. Zernio's free allowance is 2 connected accounts for OUR whole account, not
per seller; then $6 / account / month (3-10), $3 (11-100), $1 (101+). One seller with Instagram + TikTok
is about $12, more than RM35. Facebook API = Pages only; Instagram needs a Business / Creator account.
Next step if wanted: pilot on the 2 free accounts with the owner's own Instagram + TikTok. See TODO IDEA-16.

## DMS video: later
Not before the DMS-AUDIT holes are closed. Higgsfield only for scene footage around the app (TODO IDEA-33).
