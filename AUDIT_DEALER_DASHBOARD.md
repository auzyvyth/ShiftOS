# Dealer Dashboard Audit — Misaligned Data & Silent Errors

Date: 2026-06-06. Read-only audit. Nothing was changed except this report.
Same bug class as the five Salesman Lite fixes: **silent failures** — no crash,
just a `0` or a wrong-but-plausible number that survives because nobody checks the math.

## Root cause (one sentence)

Every finding below is **drift between two things that should be one**: two columns
for one concept, two stage names for one outcome, two tables as the source of one
number, or two code paths for one action where only one stays in sync. The dealer
side has more of these than Salesman Lite because more surfaces (RevOps, Oversight,
Overview, Stock, Leads) each re-derive the same figures independently.

The recurring drift pairs found:
- `won` vs `closed_won` / `lost` vs `closed_lost` (lead stage)
- `plan` vs `selected_plan` (profile tier) — and a third copy in `plan_config`
- `gross_profit` column vs recomputed-from-parts (it is a dead column, always 0)
- `sold_at` vs `sold_date` (car_listings has both; stock_units has only sold_date)
- `commission_amount` vs `my_commission` (now fixed in Salesman Lite; clean in DashboardPage)
- `assigned_to` vs `salesman_id` (lead ownership)
- `car_listings` vs `stock_units` as the source of "sold/revenue/units"

---

## CRITICAL

### C1. `car_listings.gross_profit` is a dead column — RevOps headline P&L is always wrong
- DB fact: 132/132 sold rows have `gross_profit` non-null and **zero** are nonzero.
  The trigger `trg_compute_listing_gp` runs `compute_listing_gp()`, which only sets
  `days_in_stock` — it never computes gross profit. (Same dead trigger from the
  Salesman Lite fix.)
- `src/pages/RevOpsPage.jsx:266` selects `gross_profit`; `:290-300` does
  `gp = r.gross_profit != null ? Number(r.gross_profit) : <recompute>`. Because the
  column is non-null (`0`), the `!= null` branch ALWAYS wins and the fallback never
  runs. Every sold car contributes **0** to "Gross Profit This Month."
- Fix: either make the frontend ignore the column and always recompute from parts,
  or implement `compute_listing_gp()` properly. Recommend frontend-recompute
  (DashboardPage `fetchPnl` already does this correctly and is the reference).

### C2. RevOps / Services "won deals" filter on the wrong stage values
- DB fact: live `leads.stage` distribution is `won`=14, `closed_won`=1,
  `deposit_taken`=1, `closed_lost`=2, `lost`=1. The canonical won value is **`won`**.
- `src/pages/RevOpsPage.jsx:431-433` and `src/pages/ServicesPage.jsx:170-175` filter
  `.in("stage", ["closed_won","deposit_taken"])` — which matches only ~2 rows.
- `attachRate = uniqueLeads.size / wonCount` (RevOps `:445`, Services `:185`) then
  divides by a near-zero denominator → attach rate balloons past 100%, or renders
  `—` when `wonCount = 0`. The add-on revenue KPIs are driven by a stage enum that
  doesn't match production.

### C3. Closing a sale writes `closed_won`, but the pipeline board only buckets `won`
- `src/components/leads/LeadDrawer.jsx:673` writes `stage:'closed_won'` (and siblings
  to `closed_lost` at `:698`).
- `src/pages/LeadsPage.jsx:102-107` builds buckets only for `STAGE_ORDER`
  (`new…won,lost`) and guards `if (map[l.stage]) …`. `closed_won`/`closed_lost`
  aren't in `STAGE_ORDER`, so the lead is **silently dropped** from the board (still
  counted in the "All" total, so counts look almost right). A closed deal vanishes
  from the list.

### C4. Plan tiering is split-brained — caps are effectively not enforced
- DB facts: of 12 profiles, all 12 have `selected_plan`, only 7 have `plan`, and
  `plan <> selected_plan` for all 12. Existing `selected_plan` values are legacy junk
  (`standard`, `salesman_free`) that aren't even `plan_config` keys.
- The cap triggers `check_listing_cap()` and `enforce_listing_cap()` join
  `plan_config` on `profiles.plan`. But the new onboarding writes `selected_plan`
  (e.g. `dealer_starter`) and never sets `plan`. So a new dealer gets `plan = NULL`
  → join yields nothing → `cap IS NULL` → **unlimited listings, no enforcement.**
- Worse, there are THREE disagreeing sources of caps/prices:
  - frontend `src/utils/planConfig.js` (today: Starter 30/RM299, Growth 80/RM599, Pro ∞/RM1199)
  - DB `plan_config` table (Starter 20/RM399, Growth 60/RM799, Pro 150/RM1499)
  - legacy `profiles.plan` values
- Fix: pick ONE plan column (recommend `selected_plan` since onboarding + frontend
  use it), make the cap triggers read it, backfill legacy values to real plan keys,
  and reconcile `plan_config` to match `planConfig.js`. This is the prerequisite for
  the tiering-enforcement work.

### C5. DashboardPage GP sparkline is permanently flat (`sold_at` vs `sold_date`)
- `src/pages/DashboardPage.jsx:361-372` `bucketGPByMonth(units)` does
  `if (!u.sold_at …) return;` on **stock_units** rows, which only have `sold_date`
  (`sold_at` lives on car_listings). Every row early-returns → `gpSparkData` is
  always `[0,0,0,0,0,0]` feeding the "Gross Profit (month)" sparkline at `:6067`.
- The KPI's numeric value is computed separately and correctly (uses `sold_date`,
  `:5632-5638`), so only the trend line is dead — which is why it went unnoticed.
- Fix: use `u.sold_date` at `:365-366`.

---

## HIGH

### H1. RevOps front-gross fallback omits commission (and fetches no commission column)
- `src/pages/RevOpsPage.jsx:294-298` fallback = `sold_price - purchase_price -
  recon_cost - included_services_cost`. Per the documented model it should also
  subtract commission. The row select (`:266`) fetches neither `commission_amount`
  nor `my_commission`. Even once C1 is fixed, GP would be overstated by commission.

### H2. `addLead` writes `dealer_id: user.id` — orphans manager/admin leads
- `src/hooks/useLeads.js:31-33` sets `dealer_id: user.id`. For manager/admin users
  `user.id` is not the dealer id, so the lead is invisible to the dealer pipeline.
  Violates the CLAUDE.md rule (derive via `getDealerIdFromProfile`). It also forces
  `stage:'new'`, silently ignoring the "Initial Stage" selector in AddLeadModal.

### H3. AddLeadModal offers `lead_source` values the CHECK constraint rejects
- `src/components/leads/AddLeadModal.jsx:196-198` populates the dropdown from all of
  `SOURCE_CONFIG` (incl. `mudah, carlist, facebook, tiktok, instagram, other`). The
  CHECK only allows `walk_in, whatsapp, referral, drevo_enquiry, enquiry, manual`.
  Picking Facebook/Mudah makes the insert throw; `handleSubmit` (`:89-92`) swallows
  it with `console.error` and no toast → modal stays open, lead silently not created.

### H4. AddLeadModal car list queried with `eq('dealer_id', user.id)`
- `src/components/leads/AddLeadModal.jsx:36-39`. Manager/admin get an empty car
  dropdown (can't link a car to a lead). LeadsPage's own `load()` does it correctly
  via role check; the modal does not.

### H5. "Won" via the progress bar bypasses the entire close flow
- `src/components/leads/LeadDrawer.jsx:650` only opens the close modal for the literal
  `'closed_won'`, but the progress bar (`:969`) terminal node is `won`. Clicking Won
  writes `stage:'won'` directly (`:656-666`) and **skips** the close modal, the
  car-sold sync, the stock_units sync, and the sibling-lost sync (`:677-702`). The
  proper `closed_won` flow is unreachable from the UI.

### H6. Two sources of truth for "sold/revenue/units": car_listings vs stock_units
- RevOps (`RevOpsPage.jsx:263-270`) computes revenue/units from **car_listings**.
  `gm_pnl_snapshot` (consumed by `OversightTab.jsx:547-550`, `OverviewTab.jsx:268,375`)
  computes the same from **stock_units**. A dealer comparing RevOps "Revenue This
  Month" to Oversight "Revenue (MTD)" sees two different numbers with no explanation.

### H7. Scoreboard keys on `assigned_to`; rest of app uses `salesman_id`
- DB fact: `assigned_to` set on 25/64 leads, `salesman_id` on 40/64. `gm_salesman_scores`
  filters every metric on `l.assigned_to = s.id`, so it computes over the minority of
  leads — salesmen look far less productive than they are (`OversightTab.jsx:213-241`).

### H8. Inconsistent terminal-state checks flip a real `won` to `closed_lost`
- `LeadDrawer.jsx:701` sibling-update excludes `closed_won/closed_lost/lost` but NOT
  `won`. If a sibling lead for the same car was marked Won via H5 (stage=`won`),
  closing a different lead for that car silently flips the genuine win to
  `closed_lost`. Deposit panel gate (`:1143`) also omits `closed_won`.

---

## MEDIUM

### M1. `compute_stock_unit_gp()` omits services + commission
- The stock_units GP trigger computes `sold_price - purchase_price - recon_cost`
  only. It ignores `included_services_cost`, commission, and handover costs, so
  `stock_units.gross_profit` is overstated. Anything trusting that column (vs the
  frontend `fetchPnl` recompute) is too high.

### M2. Duplicate listing-cap triggers
- `car_listings` has BOTH `enforce_listing_cap`→`check_listing_cap()` and
  `trg_enforce_listing_cap`→`enforce_listing_cap()`. Two triggers doing the same job
  on every insert. Drop one.

### M3. Overlapping / mutually-triggering stock<->listing sync
- On a listing sale, both `fn_sync_stock_unit_on_sale()` and
  `sync_sold_status_to_stock()` write to stock_units; and `sync_stock_sold_to_listing()`
  writes back to car_listings, which re-fires the listing triggers. Guards
  (`status != 'sold'`) currently stop the loop, but it is fragile and does redundant
  work. `fn_sync_stock_unit_on_sale` also overwrites `recon_cost` with the listing's
  value on the ON CONFLICT UPDATE, which can clobber a recon cost entered on the
  stock unit.

### M4. OverviewTab treats closed deals as active pipeline
- `OverviewTab.jsx:178` `activeLeads = allLeads.filter(l => !['sold','lost'].includes(l.stage))`.
  `'sold'` isn't even a lead stage; `won`/`closed_won`/`closed_lost` are all counted
  as open pipeline → inflated "Open Leads" KPI (`:373`), source breakdown (`:191`),
  and cold-lead alerts (`:206`).

### M5. `gm_pnl_snapshot` LMTD window is approximate
- The last-month clause adds `(now() - v_month_start)` (a full intraday interval) to
  last month's start, so the "vs last month" delta drifts by time-of-day and ignores
  month-length differences. Owners act on this trend (`OversightTab.jsx:548`,
  `OverviewTab.jsx:268`).

### M6. Appointment insert reads non-existent `lead.name`
- `LeadDrawer.jsx:310-311` uses `lead.name` (always undefined; the column is
  `buyer_name`) → appointments always save `buyer_name = NULL`.

### M7. `calcInsuranceEst` tier loop is wrong
- `LeadDrawer.jsx:133-146` has duplicate `cap` values and subtracts the full cap per
  band rather than the band width → plausible-but-incorrect premium that feeds the
  deal sheet (`:496`, `:621`).

### M8. Add-on avg-per-deal numerator/denominator mismatch
- `RevOpsPage.jsx:436-439` / `ServicesPage.jsx:178-181`: `totalRevenue` includes
  add-ons with null `lead_id`, but `uniqueLeads` excludes them, so
  `avgPerDeal = totalRevenue / uniqueLeads.size` is overstated for counter sales.

### M9. `fn_auto_deal_financial()` writes to `deal_financials` with no real conflict target
- On listing sale it inserts into `deal_financials` with `ON CONFLICT DO NOTHING` but
  no unique constraint named; an un-sell + re-sell can duplicate the row. Confirm the
  revenue dashboards read the intended table (RevOps reads car_listings, not this).

### M10. `defaultTasksFor` financed-detection is a parallel seed path to the DB trigger
- `postSaleSteps.js:93` re-derives `financed` from loan fields on whatever lead object
  it's handed; if a trimmed lead is passed it can seed B7 as pending instead of `na`,
  inflating the handover progress denominator. It also duplicates the DB
  `auto_create_customer_on_won` logic — two seeders that can diverge.

---

## LOW

- **L1.** RevOps response-time bar uses a hardcoded divisor `6217` (`RevOpsPage.jsx:859`)
  — meaningless on any other dataset.
- **L2.** `Number(r.sold_price)` reduces with no `|| 0` guard (`RevOpsPage.jsx:436`,
  `ServicesPage.jsx:178`) — one null-join from `RM NaN`.
- **L3.** StockTab `handleMarkSold` (`DashboardPage.jsx:5692`) optimistic-updates but
  never refetches; joined/derived fields go stale until remount.
- **L4.** Neither mark-sold path writes actual `sold_price` to car_listings
  (`DashboardPage.jsx:5684`, `8924`); per-salesman gross uses asking price as a proxy
  and overstates if a car sells below asking.
- **L5.** `OverviewTab.delta()` returns null when prev=0, hiding genuine growth-from-zero.
- **L6.** `useLeads.fetchLeads` has no frontend `dealer_id` filter — relies entirely on
  RLS (defense-in-depth gap).
- **L7.** Swallowed query errors throughout RevOps/Services (no `error` checks on selects).
- **L8.** Inline loan calculator uses flat-rate while HP rows use reducing-balance
  (`LeadDrawer.jsx:34-39` vs `:617`) — same deal shows two different monthly figures.

---

## What is clean (checked, not buggy)

- DashboardPage `fetchPnl` and the StockTab P&L modal recompute GP from parts and do
  NOT trust the dead `gross_profit` column. This is the reference implementation.
- `commission_amount` is used consistently across DashboardPage (read and write); no
  `my_commission` reference remains outside the (now-fixed) Salesman Lite history.
- DashboardPage multi-tenant scoping derives `dealer_id` via `getDealerIdFromProfile`
  before child queries; no tenant leak found there.
- `deal_products.sold_price` and `post_sale_tasks.cost` are named consistently.
- PostSaleChecklist progress math correctly excludes `status='na'`.

---

## Recommended fix order (by impact / effort)

1. **C4 (tiering)** — collapse to one plan column (`selected_plan`), fix cap triggers,
   backfill legacy values, reconcile `plan_config` with `planConfig.js`. Unblocks the
   tiering goal and stops new dealers getting unlimited listings free.
2. **C1 + H1** — stop trusting `gross_profit`; recompute from parts incl. commission
   in RevOps (mirror `fetchPnl`). Fixes the headline revenue number.
3. **C2 + C3 + H5 + H8 + M4** — standardize the won/lost stage handling. Pick ONE set
   (recommend `won`/`lost`, since that's 14 rows and the canonical STAGE_ORDER) and
   make the close flow, board buckets, RevOps/Services filters, and OverviewTab all
   agree. This single fix kills five findings.
4. **H2 + H3 + H4** — AddLead correctness: derive dealer_id, restrict lead_source to
   the allowed set (or widen the CHECK), surface insert errors with a toast.
5. **C5 + M6** — column-name typos (`sold_at`→`sold_date`, `lead.name`→`buyer_name`).
6. **H6 + H7** — pick one source of truth (stock_units vs car_listings) and one
   ownership column (`salesman_id`) for the analytics RPCs.
7. DB hygiene: M1, M2, M3, M5, M9 (trigger cleanup and GP completeness).
8. The LOW items as time permits.
