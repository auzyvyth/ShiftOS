# Brief: the renewals ad (draft script, waiting for the owner's OK)

Step 1 of the process in `LESSONS.md`: words only. Stills come after the owner approves this.

## What the app really does (Premium only; Lite has no customer list)
| What | Where |
|---|---|
| Ticking the Insurance or Road tax step in the handover fills the expiry date, defaulting to 12 months from that day. The seller can change it. | DB trigger `sync_customer_expiry_from_task` on `post_sale_tasks` |
| Each buyer card has a Renewals box: the date, "in N days" or "overdue" | `src/pages/salesmanPremium/SoldCustomers.jsx:161-166, 213` |
| A Remind button opens WhatsApp with the message already written. The seller presses send. | `SoldCustomers.jsx:176-181, 237` |
| The "Coming up" list on the Sold tab puts renewals, handovers and aftercare visits in date order | `SoldCustomers.jsx:48-116`, `src/utils/aftercare.js:98` |
| The dashboard's "This week" list adds a call row 45 days before the expiry | `src/utils/thisWeek.js:25, 124-136` |
| A phone notification goes out at 30 days and again at 7 days, at 8am | `supabase/functions/expiry-reminders/index.ts:101-125` |
| A "Trade-up ready" flag shows once the buyer has owned the car 3 years, or the car is 5+ years old | `SoldCustomers.jsx:150, 264-275` |

## Fix before the ad runs (the ad promises these)
1. **The notification never shows up in the seller's own list.** It is saved to the dealer table
   (`expiry-reminders/index.ts:121`). The phone still gets it, but Lite and Premium only read
   `salesman_notifications`. Tapping it opens the dashboard, not that buyer.
   Fix: write to `salesman_notifications` for solo sellers and link to `/salesman-premium/sold?c=<id>`.
2. **It only sends on exactly day 30 and day 7** (`index.ts:113`). If the daily job skips a day,
   nothing is sent. Fix: send when the expiry is 7 days away or less and nothing has gone out yet.
3. **If the seller has no name set, the drafted message signs off "XDrive"** (`SoldCustomers.jsx:178, 184`).
   This gets renamed on switch day.

## Real usage today (read-only, 2026-11-03)
- 23 customers on the whole platform. 10 have an insurance date and 7 have a road tax date.
- One renewal notification has been sent, ever (30 Oct).
- premiummotors' two buyers fall due Aug-Oct 2027, so there is no real renewal to film.

## Rules for this ad
- **No real buyers on screen (PDPA).** A customer row holds a buyer's name, phone and plate. None of it
  was ever public. Record the real component on a demo account with made-up buyers, labelled
  "Contoh data / Sample data".
- **Do not promise insurance commission.** Under the Financial Services Act 2013, anyone who arranges a
  policy or its renewal for an insurer counts as an insurance agent and must be registered with PIAM.
  "Earn on every renewal" would push unregistered SAs into that. What the ad can say is true for everyone:
  each renewal gives the SA a reason to get back in touch, every year.
- No invented numbers (no RM amounts, no "3x repeat sales").

## Hook fact (true, checked)
Private cars have not needed a road tax sticker since 10 Feb 2023, and JPJ stopped printed slips on
1 Feb 2026. The buyer has nothing on the windscreen to remind them, so they forget the date. The app remembers it.

## Draft script, single topic, ~22 s
One topic, not a chapter in the big ad: retention is ~10%, so this ad has to land in the first 5 s.

| Time | Picture | Headline BM / EN |
|---|---|---|
| 0-4 s | Phone on the red floor. A real notification slides in: "Road tax expiring · Aiman · Honda City · 7 days" | "Cukai jalan pembeli / *tamat minggu depan.*" / "Your buyer's road tax / *ends next week.*" |
| 4-7 s | Windscreen, no sticker. The Coming up list fills with dates. | "Dia lupa. / *Drevo ingat.*" / "They forgot. / *Drevo didn't.*" |
| Card: "Tarikh isi sendiri" / "Dates fill themselves" | Handover: tick Insurance, and the expiry 12 months out appears on the buyer card | "Tick sekali. / *Setahun diingatkan.*" / "Tick once. / *Reminded for a year.*" |
| Card: "Satu tap" / "One tap" | Tap Remind and WhatsApp opens with the message written. A thumb presses send. | "Mesej dah siap. / *Anda tekan hantar.*" / "Message written. / *You press send.*" |
| Card: "Tahun depan" / "Next year" | Trade-up ready flag on the same buyer | "Setiap renewal, / *satu sebab untuk mesej.*" / "Every renewal, / *a reason to reach out.*" |
| 19-22 s | CTA as in the main ad | "Cuba Premium 7 hari percuma" + drevo.my |

Fine print on the first scene: "Contoh data. Tiada sticker cukai jalan sejak 2023." / "Sample data. No road tax sticker since 2023."
