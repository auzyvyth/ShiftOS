# POSTER-6: car poster styles (audit, scope, mockup) - 2026-11-27

Source: six reference ads the owner sent (four 4:5 "showroom" ads, one 9:16 story collage, one 9:16 card series).
Mockup: `docs/mockups/car-posters.html` (static, placeholder photos, mock seller + numbers). Nothing is built in the app yet.

## 1. Audit - what exists today

| Thing | Where | What it is | Gap against the references |
|---|---|---|---|
| Loan poster ("Kiraan") | `src/components/poster/renderLoanPoster.js:55`, sheet `LoanPosterSheet.jsx` | Canvas, 1080x1350, ONE look. Numbers from `loanPoster.js`. Quota by `claim_loan_poster` (Lite 4 cars/month, Premium unlimited), free watermarked preview | One style only. Uses `car.images[0]` only. No thumbs, no collage, no palette |
| Studio templates | `src/components/studio/carTemplates.js:115` (5 templates), applied by `applyProTemplate` (`TikTokStudioV3.jsx:~2900`) | DOM elements + layers on a 1080x1920 canvas, Premium / dealer / linked only, Lite has no Studio | 9:16 only, no 4:5. "Collage" (`:189`) is closest to the story reference but has no text panel and no price box. No palette, no auto-tint |
| Motion poster | `poster/motionPoster.js`, `MotionPosterSheet.jsx` | Loan numbers as short video | Not relevant to stills |
| Cut-out + backdrops | `src/lib/cutout`, `studio/backdrops.js` | On-phone background removal + drawn scenes (Premium) | Not wired into any poster (POSTER-2b is open) |

Known defects in the same area (fix in the same change): POSTER-4 (`carTemplates.js:246,251` prints "LOW DEPOSIT - FAST LOAN" / "BULAN INI SAHAJA" on every Monthly Deal); POSTER-3 (one poster maker).

**Data we already hold** (`car_listings`, see `CarForm.jsx`, `sharePack.js:31`): brand, model, variant, year, mileage, engine_cc, transmission, colour, `features[]`, previous_owners, warranty_months, `auction_grade` (recon only, seller-typed), origin / is_recon, `images[]`, selling_price. Monthly = `calcMonthly` / `loanPosterNumbers` (EIR).
**Not held, so never printed:** a "loan price", a verified inspection grade, a brand-certified claim, freight cost, "no processing fee".

## 2. Audit - what to NOT copy from the references

- **"Est. loan RM 3,261,161" above the cash price** (Ferrari, Bentley, Range Rover, Urus): no field behind it; it would be an invented number. Replaced by "From RM x / month" from `financing.js`.
- **"2.5% flat"** (KSS card): the Hire Purchase (Amendment) Act 2026 ended flat rates. Ours prints EIR (`HP-EIR`, CLAUDE.md).
- **"7 years free premium warranty", "no processing fees"**: only `warranty_months` from the listing, and no fee claim at all.
- **"Certified by Bentley" plate, brand logos, dealer logos, SSC plate**: not reproduced. Brand name is plain text.
- **Grade laurel**: shown only for a recon car with a typed `auction_grade`, worded "Auction grade", never "certified".
- **"Pre-order import from UK, GBP 10,000 freight included"**: we cannot check it. Ribbon is a fixed pick-list from the listing (Direct import / Recon / Brand new / 1 owner), no free text, no money in it.
- **Layout is ours** (POSTER-1 lesson): we take the organisation (hero, spec line, thumbs, price plates; collage + text panel; tinted card), not their wording, art or arrangement of words. Four colour looks of the reference are ONE layout with palettes.

## 3. Scope

**Decision (recommended): put the styles in the loan-poster canvas engine, not in Studio.** The references are one-tap posters made from listing data; Studio is a 9:16 editor, Premium-only, with element/layer maths. One engine also closes POSTER-3 and gives Lite a path. Studio keeps its own templates.

| Phase | What | Notes |
|---|---|---|
| P1 | `renderCarPoster(canvas, {style, palette, ...})` + `src/components/poster/styles/{showroom,collage,cards}.js`. "Kiraan" becomes style 0, unchanged | Pure layout functions (fit text, which cells with N photos, card tint) unit-tested: `npm run test:posterstyles`. Load Bebas Neue in `ensureFonts` |
| P2 | **Showroom** 1080x1350. Title (brand small, model + variant in accent), spec line, hero, 3-feature strip, 2 parallelogram thumbs, optional ribbon, CASH + FROM/MONTH plates, seller bar. Palettes: Carbon (Drevo red, default), Gunmetal, Forest; plates dark or white | 1 photo: thumbs row drops, hero grows. Features from `features[]` (22 chars), else transmission / owners / warranty. Italic = `skewX` (Outfit has no italic) |
| P3 | **Story collage** 1080x1920. 3 to 5 photos in a grid + text panel (tag, name, variant, km, white price box, monthly) + seller bar | Under 3 photos: not offered, says why |
| P4 | **Card series** 1080x1920: one card, or a 4-up sheet from Listings > Select (`BulkBar`). Card colour is taken from the photo (average colour, pulled dark), so no colour picker | Fallback to Drevo dark if the photo cannot be read |
| P5 | Sheet UI in `LoanPosterSheet.jsx`: style chips, palette dots, ribbon pick, which 2-4 photos | Premium look via the existing `theme="premium"`. Phone 375 first |
| P6 | Optional "Studio background" on the hero: on-phone cut-out + drawn backdrop (POSTER-2b) | 30 s to 80 s on a phone, cached per car. Ship after P5. Without it the hero is the seller's own photo with a scrim, as in the mockup |

**Quota + plans:** one credit per car per month whatever the style (reuse `claim_loan_poster`; re-rendering another style the same month is free). Recommended: Lite = Kiraan + Showroom Carbon; Premium = every style, palette, ribbon and the 4-up sheet. Owner call.
**No migration, no new table, no edge function.** Photos are read the way the sheet already does (`fetchDataUrl`). Cost columns are never read.
**Files:** `renderLoanPoster.js` (split), `poster/styles/*` (new), `LoanPosterSheet.jsx`, `utils/loanPoster.js` (ribbon + feature picks, EN/BM words), `utils/posterImage.js` (parallelogram clip, skew text), `carTemplates.js:246,251` (POSTER-4), `package.json` test script.
**Test plan (before any "done"):** Playwright on mock rows, 375 + desktop; 1 / 2 / 5 photos; no features; no price; 30-char brand and model; BM + EN; preview watermark; clean file after claim.
**Out of scope:** AI backdrops (parked), free-text colours, video, Studio changes.

## 4. Decisions needed from the owner

1. Engine, not Studio (recommended above)?
2. Which styles does Lite get (recommended: Showroom Carbon only)?
3. Ribbon pick-list: Direct import / Recon / Brand new / 1 owner. Anything else?
4. Order: P1+P2 first (Showroom, the closest to the four ads), then Card series, then Story?
