# Dealer dashboard numbers audit (2026-11-12)

Owner: "the maths are not aligned in the whole dashboard, too many numbers". This lists every
number that is computed in more than one way, what the dealer sees, and the one fix. Read-only
audit: code read + live DB counts on 2026-11-12. No security content (that stays out of this repo).

Rule going forward: **one question, one source, one formula.** A screen that needs the number
calls the source; it never recomputes it.

## Live data that makes the drift visible (all dealers, 2026-11-12)
| Fact | Count |
|---|---|
| Stock cars in stock | 142 |
| ...with NO buy price | **100** (70%) |
| ...with NO purchase date | **138** |
| ...whose stored `days_in_stock` is more than 2 days wrong | **125** |
| Sold: car listings vs stock records | 34 vs 32 |
| Car and stock record disagree on "sold" | 3 |

## 1. Profit per car: two formulas (HIGH)
- `src/utils/carPnl.js` (done 2026-11-12): buy + recon + holding + ads + services + commission +
  transfer + admin + warranty, add-ons net. Used by the car pop-up, Stock row + P&L, Reports
  revenue drill-down, add-car estimate.
- DB trigger `compute_stock_unit_gp` -> `stock_units.gross_profit`: sold - buy - recon - services -
  commission only. **No holding, ads, transfer, admin, warranty, add-ons.**
- `gm_pnl_snapshot` sums that column, and **Overview "Gross this month"** and **Revenue (RevOps)
  "GP MTD"** show it. So the month total is always higher than the cars it is made of.
- Fix: a SQL `car_pnl()` mirroring carPnl.js (same test cases), and the trigger + snapshot use it.
  DB change, after midnight.

## 2. A car with no buy price shows a fake profit (HIGH)
- 100 of 142 stock cars have buy price 0. Every profit screen treats 0 as "free car" and shows
  most of the asking price as profit.
- Fix: carPnl returns `costMissing`; screens show "Add the buy price" instead of a number, and
  totals say "N cars left out (no buy price)". `gm_pnl_snapshot` already skips them for GP
  (`has_cost`); the client screens must match.

## 3. Days on the lot: four clocks (HIGH)
| Where | Start date |
|---|---|
| Inventory row badge, Overview avg days, Performance avg days, Reports > Listings avg age, AI Manager | listing `created_at` |
| Stock list days, Stock "Avg days", "Over 60 days" | stored `stock_units.days_in_stock` (stale for 125 cars), else purchase date / created |
| Overview "aged 60+" (`gm_pnl_snapshot`) | `purchase_date` only, so the 138 cars without one never count |
| carPnl holding cost | purchase date, else stock created, else listing created |
- Fix: one `daysOnLot(car)` = carPnl's rule (`daysHeld` in carPnl.js) everywhere; stop reading the
  stored column (or drop it); `gm_pnl_snapshot` uses the same coalesce.

## 4. "Ageing" means three different numbers (MEDIUM)
- 30 days: Inventory badge turns red, Overview "stale", Reports avg-age warning.
- 45 days: Performance avg-days warning.
- 60 days: Stock "Over 60 days", Overview "aged 60+", Owner verdict.
- Fix: one threshold pair in one file (e.g. watch at 30, ageing at 60), used by all.

## 5. Revenue and units sold: two sources (MEDIUM)
- Overview + RevOps: `stock_units` sold rows by `sold_date` (32 sold).
- Reports revenue drill-down + Inventory "Sold" pill: `car_listings` status / `sold_at` (34 sold).
- 3 cars disagree on whether they are sold.
- Fix: the won-deal trigger is the truth for "sold" (CLAUDE.md); both tables must flip together,
  and every count reads `car_listings.status='sold'` + `sold_at`. Repair the 3 mismatched rows.

## 6. Views and enquiries: three windows (MEDIUM)
- Inventory row + car pop-up Analytics: last 30 days (pop-up can switch 7/30/90).
- Performance > listings and Reports > Listings: all time (no `p_days`).
- "Enquiries" = WhatsApp + calls + bookings taps on the row; = leads count elsewhere.
- Fix: label every view number with its window, default 30 days everywhere; call taps "taps",
  and only leads "enquiries".

## 7. Stock value: asking vs cost (LOW)
- Stock strip "Stock value" = sum of ASKING prices. Overview "Capital tied up" = sum of COST.
  Both correct, but look like the same thing. Fix: keep both, word them "Asking value" and
  "Money tied up", never two tiles that look alike on one screen.

## 8. Reports > Listings (to delete)
- Its own avg age, CVR and views (all time) duplicate the car pop-up and Inventory row.
  Delete with the pop-up merge.

## Order
1 + 2 first (they change money numbers), then 3 + 4 (one clock, one threshold), then 5, 6, 7.
