# Dealer dashboard: code diagnosis of the 8 Nov 2026 audit

Source audit: `docs/DEALER_AUDIT_2026-11-08.md`. This file says WHERE each finding lives
(file:line or DB object) and WHY it happens, then a fix order. Diagnosed 8 Nov 2026 by
reading the repo and the live DB (read-only). Nothing was changed.

Plain version: the audit is right on every P0. Two of them are worse than it says:
salesmen can also read buy prices on `car_listings`, and they can read every buyer lead
the dealer has, not just their own. Most bugs come from the same habit: the browser
and the database both try to do the "won" and "sold" work, and each half-does it.

---

## P0: money, double-selling, security

### P0-1. A car can be sold more than once
- **Where:** DB trigger `auto_create_customer_on_won` (on `leads`, trigger `trg_lead_won`).
- **Why:** it checks `v_car.status IS DISTINCT FROM 'sold'` only to skip re-flipping the
  car. It then **always** inserts a customer and the 8 handover steps. Nothing asks
  "does another lead already own this win?". Live data: listing `67b534ce…` has 3 won
  leads, the audit Vios has 2.
- **Made worse by the client:** `confirmCloseSale` in `src/components/leads/LeadDrawer.jsx:694-726`
  re-writes the car (`status`, `sold_at`, `assigned_to: selectedCloser || null`) and
  `stock_units` after the trigger already did. On the second sale the closer was
  "Unassigned", so it **wiped the first salesman's credit** (activity log 12:18:44:
  `assigned_to 5397ede4… -> null`). That is a new bug, not in the audit.
- **Fix:** in the trigger, `RAISE EXCEPTION 'car_already_sold'` when another lead on the
  same `car_listing_id` is already `won/closed_won`. Back it with a partial unique index:
  `create unique index leads_one_win_per_car on leads(car_listing_id) where stage in ('won','closed_won') and car_listing_id is not null and new_car_model_id is null`
  (model cards are excluded because `new_car_unit_on_won` moves the lead onto a fresh unit).
  The index can't be created until the 2 duplicate sets are cleaned up. Delete the car +
  stock writes from `confirmCloseSale`, because the trigger owns them (CLAUDE.md "Won = sold").

### P0-2. `deal_financials` books the whole price as profit
- **Where:** DB function `fn_auto_deal_financial` (trigger `trg_auto_deal_financial` on `car_listings`).
- **Why:** it inserts only `selling_price`. `purchase_price`, `recon_cost` and
  `included_services_cost` fall to their **default 0**. `gross_profit` is a GENERATED column
  (`selling - purchase - recon - services`), so it comes out at 42,800. `deposit_received`
  and `commission_amount` are never copied either. The generated formula also **leaves
  out commission and handover costs**, which makes it a 5th profit definition.
- **Fix:** copy purchase/recon/services from `stock_units` (the costed record) plus
  `commission_amount`, and the deposit from the won lead. Do it as an upsert, not
  `ON CONFLICT DO NOTHING`. Backfill existing rows. Long-term the profit maths moves into
  one function (see P1-3), and the generated column becomes a plain column fed by it.

### P0-3. A deposit doesn't hold the car
- **Where:** DB function `sync_car_reservation_on_lead_stage` (trigger `trg_lead_reservation` on `leads`).
- **Why, three holes:**
  1. It reserves only `WHERE status = 'available'`. Internal stock is `unpublished`, so a
     deposit on it reserves nothing (audit T16).
  2. It never checks for another lead already at `deposit_taken` on the car (T20).
  3. On `lost`, it frees the car `WHERE status = 'reserved'` without checking whether
     another buyer still holds a deposit.
  It also writes `reserved_by = NEW.salesman_id`, which is NULL when the dealer assigned
  through `assigned_to` (see P1-2).
- **Why the UI lies:** `src/components/leads/LeadGridCard.jsx:21-22` shows "Reserved"
  from the **lead's stage** (`deposit_taken && car`), not from the car's status.
- **Fix:** reject a second `deposit_taken` on a car (raise + partial unique index, same
  shape as P0-1). Reserve from `available` OR `unpublished`. Free the car only when no other
  open deposit lead remains. Grid card reads `car.status === 'reserved'`.

### P0-4. Salesmen can read and edit buy prices (wider than the audit says)
- **`stock_units`:** policy `stock_team_all` = ALL where `dealer_id = get_my_dealer_id()`.
  A linked salesman resolves to the dealer's id, so they get read/write/delete on every
  stock unit (purchase price, recon, gross).
- **New: `car_listings` too.** Policy `authenticated_reads_own_dealer_listings` (SELECT,
  `dealer_id = get_my_dealer_id()`) lets every linked role read `purchase_price`,
  `base_price`, `recon_cost` and `commission_amount` straight off the listing.
  **Locking `stock_units` alone does not close the leak.**
- **New: leads.** Policy `leads_dealer_reads_salesman_leads` (SELECT) starts with
  `dealer_id = get_my_dealer_id() OR ...`. Permissive policies are OR'd, so any linked
  salesman can read **every** buyer lead of the dealer (name, phone, IC, address) through
  the API. `leads_team_update` lets them **edit** any of them too. The salesman panel
  only *shows* their own leads because `src/pages/Salesmanpanel.jsx:837` filters on
  `salesman_id`, and that filter is in the browser, not the database.
- **Live exposure today:** 7 linked accounts, all test accounts (`diara`, `testsales` and
  staff logins). None has signed in since 24 Sep 2026.
- **Fix:**
  - `stock_units`: limit to money roles. The helper already exists, `can_see_dealer_money(dealer_id)`
    (dealer + accountant). Widen it with manager and a stock-controller role if wanted.
  - `car_listings`: rows can't be hidden, because salesmen need the specs. So the cost
    columns must leave the table: `stock_units` holds cost, and readers switch to it
    (`DashboardPage.jsx:4515`, `:6825` and `RevOpsPage`). Then drop or null
    `purchase_price`, `base_price` and `recon_cost` on `car_listings`. Postgres column
    privileges won't work here because the owner and the salesman share the `authenticated` role.
    Note for Lite/Premium: `base_price` is the solo seller's own cost and feeds
    `solo_commission_is_margin`. Handle it per seller type rather than dropping it blind.
  - `leads`: rewrite `leads_dealer_reads_salesman_leads` so the dealer-wide branch requires
    a dealer/owner/manager/admin role, and scope `leads_team_update` the same way.
    Salesmen keep `leads_salesman_linked_*` (own rows).

---

## P1: things that break daily work

| # | Finding | Where | Root cause | Fix |
|---|---|---|---|---|
| 1 | Appointments saved 8h late | `LeadDrawer.jsx:331` (input `:1871`) | Sends the raw `datetime-local` string (`2026-11-07T10:00`). Postgres `timestamptz` reads it as UTC. Same trap on follow-up at `:1154`. | `new Date(v).toISOString()` before insert; block past dates. |
| 2 | Assigning a lead doesn't reach the salesman | `LeadDrawer.jsx:768` writes `assigned_to` | Salesman panel, RLS, leaderboard and `reserved_by` all key on `salesman_id`. Two fields for one fact. | Write `salesman_id`; backfill `salesman_id = coalesce(salesman_id, assigned_to)`; stop writing `leads.assigned_to`. (`car_listings.assigned_to` is a different thing, the exclusivity lock, and stays.) |
| 3 | Logging a recon job raises profit | `DashboardPage.jsx:7151-7153` | `reconCost = jobs.length > 0 ? actual : estimate`. One RM800 job replaces the RM2,500 estimate. The Stock card and `compute_stock_unit_gp` use `stock_units.recon_cost` (the estimate) and ignore jobs. | One rule in one place: `greatest(actual, estimate)` until the unit is closed, then actual. Feed it into `stock_units.recon_cost` with a trigger on `recon_jobs`, so every surface reads one number. |
| 4 | Commission lost (RM600 -> 0) | `src/components/AddCarForm.jsx:391` sends `num(form.commission_amount)` | **Not reproduced from code.** The insert sends the form value, and `solo_commission_is_margin` skips dealers. The activity log shows 0 at creation, so the value never got into form state. Suspects: draft restore (`:230-233`) or the rule auto-fill (`:260-267`). Needs one click test. Separately, nothing calculates commission at win. | Click-test first. Then calculate commission at win from `commission_config` when the listing has none. |
| 5 | No final price / discount approval at win | `LeadDrawer.jsx:694` `confirmCloseSale` | The close modal only picks a closer. `sold_price` falls back to asking price in `fn_sync_stock_unit_on_sale`. | Ask for the agreed price in the close modal, write `car_listings.sold_price`, and require manager approval below the cost floor. This is the start of the "Deal" record. |
| 6 | AI Manager returns 400 | `src/components/AISalesManager.jsx:91-96` sends `messages`; `supabase/functions/ai-proxy/index.ts:106-113` requires `prompt` | Contract mismatch. | Client sends `prompt` (fold history into it), or the proxy accepts `messages`. **Diff the deployed function first** (CLAUDE.md edge-function rule). |
| 7 | No payments ledger | schema | Deposit lives in `leads.deposit_*`, `deal_financials.deposit_received`, `appointments.deposit_amount` and `bookings.deposit_amount`. | New `deal_payments` table (kind: deposit, balance, disbursement, refund; receipt no.). Retire the other three over time. |
| 8 | Issued documents editable | policy `documents_team_update` on `dealer_documents` | No status check in USING. | `USING (... AND status <> 'issued')`; voiding becomes its own owner-only function. |

---

## P2/P3: confirmed causes

- **"21 appointments today"**: `src/components/OverviewTab.jsx:150-151` uses `.gte(today)`
  with no upper bound, and `:168` counts the whole result. Add `.lt(tomorrow)` in Malaysia time.
- **Unsold unit stored GP −37,500**: `compute_stock_unit_gp` takes `coalesce(sold_price,0) − costs`
  for unsold units too. Return NULL until sold.
- **Plate not on the stock unit**: `auto_create_stock_unit` doesn't copy `plate_number`
  into `registration_number`, and it seeds `purchase_price = 0` (AddCarForm patches it
  afterwards, which is why a failed patch leaves a RM0 car).
- **Year 2035 / mileage −100 accepted**: `AddCarForm.jsx:341` checks only that the fields are
  filled. Add range checks plus a DB `CHECK` (year 1950..current+1, mileage >= 0).
- **Appointment has no salesperson**: `LeadDrawer.jsx:325-334` omits `salesman_id`.
- **Receipt "Date: —"**: `DashboardPage.jsx:8889` prints `issued_at`, which a draft doesn't have.
  Print the draft date with a DRAFT mark.
- **5% cancellation clause**: `DashboardPage.jsx:9030` cites the Consumer Protection Act 1999
  for "up to 5%". The Act sets no 5%. Its Part IIIA (unfair contract terms) can strike a
  forfeiture term that causes a "significant imbalance" against the buyer. Remove the citation
  and let each dealer set the forfeiture wording. Have a lawyer check before any dealer issues receipts.
- **Two booking tables, duplicated vehicle facts, 29 triggers on `car_listings`**: confirmed.
  Of those 29, five do sale/stock syncing (`trg_auto_deal_financial`, `trg_sync_stock_unit`,
  `trg_sync_sold_status_to_stock`, `trg_sync_asking_price_to_stock`, `trg_auto_create_stock_unit`),
  plus `trg_sync_stock_sold_to_listing` going the other way on `stock_units`. That is the loop
  behind most of the number drift.
- **Contradicting KPIs (audit 3.3)**: each tab computes its own counts and GP client-side
  (OverviewTab, RevOpsPage, Inventory/Stock in DashboardPage, GM RPCs). No single bug;
  it goes away with P1-3 / one server-side metrics function.

---

## Fix order

Each batch = one migration (one API freeze, after midnight, nobody live) + its client
change, staging first.

1. **Lock-down (security):** `stock_units` to money roles; `leads` dealer-wide read/update to
   manager roles; `dealer_documents` issued = read-only. Small, no data moves.
2. **Sale integrity:** P0-1 + P0-3 trigger changes, the two unique indexes, and clean-up of the
   duplicate wins (Cullinan ×3, audit Vios ×2) + audit test rows. Remove the client sold-writes from
   `confirmCloseSale`.
3. **One profit:** fix `fn_auto_deal_financial` (P0-2) + backfill; recon rule (P1-3); unsold GP NULL;
   copy plate. Then point Overview / Revenue / Inventory / GM at one server function.
4. **Cost columns off `car_listings`** (rest of P0-4). Bigger, because every cost reader moves to `stock_units`.
5. **Daily-work fixes, client only:** timezone, `salesman_id` assignment, appointments-today, AI Manager,
   validation, appointment salesperson, receipt date + clause.
6. **Deal record:** agreed price + approval at win, `deal_payments`, receipts/invoice generated from it.

Batches 1-2 are what stops a real dealer losing money or data. Do them before the first dealer is onboarded.
