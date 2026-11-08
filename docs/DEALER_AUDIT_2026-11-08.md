# Drevo DMS — Dealership Operations Audit

**Audited:** 8 Nov 2026 · **Environment:** production, `drevo.my/dashboard`, dealer account `vyth` (Owner role)
**Method:** I clicked through the live app in the browser, read the code (`auzyvyth/ShiftOS`, branch `main`) and ran read-only database queries (Supabase project `lemdkdizdlcirhbzqlos`). I didn't change any application code.
**Test data:** Every record I created was tagged `AUDIT-TEST`. The test car was saved as *Internal stock only*, so it was never shown on the public marketplace. No WhatsApp, email or Telegram messages were sent.

> **Context.** `CLAUDE.md` (DB migrations section) says the dealer dashboard had **no live users** as of 28 Oct 2026. The live account is owner test data, with names like "Alfatest", "laptopapa" and "Rolls Royce Cullinan". This audit treats Drevo as a product a real dealer is about to adopt. Several problems below already exist in this data, which means they would already have hurt a real dealership.

---

## 1. Executive Summary

**Operational readiness: not ready for a real dealership. Score: 4/10.**

Drevo has a strong **front office**: lead capture, a pipeline, a lead drawer with a built-in financing and on-road calculator, a shareable deal sheet, a handover checklist that follows Malaysian steps (B5/B7/JPJ/road tax/insurance), and customer renewal tracking. A sales advisor could work leads in it today.

The **back office isn't safe to run a business on**. The same car can be sold twice. Profit has at least four different definitions that disagree. A sale can record the full selling price as gross profit. Deposits don't reliably reserve the car, and two buyers can put a deposit on the same car. The app has no payment ledger, invoice or official receipt. And every staff role, salesmen included, can read and edit vehicle purchase prices at the database level.

**Biggest strengths**
1. The lead drawer: stages, activity log, deposit block, HP submission, add-ons, trade-in, quick WhatsApp templates, financing + on-road calculator and deal sheet all sit on one screen.
2. One database trigger handles a win: the car is marked sold, a customer record is created, and an 8-step handover checklist is seeded.
3. The Malaysian handover checklist, Puspakom B5/B7 flags, encumbrance status and road-tax/insurance renewal tracking.
4. The live **cost floor** on Add Listing: purchase + recon + transfer + road tax + admin + commission = floor, with the estimated gross shown live. Tested correct.
5. Market Demand: JPJ registration data matched against your stock.

**Biggest weaknesses**
1. **Financial integrity.** The dashboards contradict each other on every core number (section 3.3).
2. **No transactional controls.** There's no lock against selling a car twice, no deposit exclusivity, and no approval on price or discount.
3. **No money layer.** There are no payments, invoices, official receipts, refunds or receivables. Deposits are stored in four different places.
4. **Two "assignment" fields.** The dealer assigns a lead with `leads.assigned_to`, but salesmen only see leads by `leads.salesman_id`.
5. **Navigation sprawl.** There are 17 tabs plus a hidden Stock page and six separate role panels. Analytics repeats across Overview, Revenue, Performance, Listings and GM Oversight.

**Would I recommend a dealership adopt it today?** **No.** It's fine for lead management only, if the dealer keeps money, stock costs and sales records in their existing system. It shouldn't be anyone's system of record for stock, deposits or profit until the P0 items in section 8 are fixed.

---

## 2. Seventeen-Tab Audit

The sidebar has six groups and 16 items, plus Settings, for 17 tabs. A hidden 18th screen, **Stock** (`/dashboard/stock`), is reachable only from Add Listing → save, or from "Back to Inventory". Six other role panels exist outside this dashboard: `/manager`, `/admin`, `/accountant`, `/fi` and `/salesman` (plus Lite and Premium).

| # | Tab (group) | Intended user | Purpose & features found | Related / overlaps | Problems found | Keep separate? |
|---|---|---|---|---|---|---|
| 1 | **Overview** (Reports) | Owner, GM | KPI tiles, AI Sales Manager alert strip, 30-day revenue, stock snapshot, lead pipeline, lead sources, team on duty, recent activity | GM Oversight, Revenue, AI Manager | "21 appointments today" when the real number is **0** (counts every future appointment, `OverviewTab.jsx:149-151`). "Stale" uses listing `created_at`, not purchase date. Stays stale after a sale until a hard reload. | Keep, as the single home dashboard |
| 2 | **Revenue** (Reports → Analytics) | Owner, Accounts | Revenue/GP MTD, stock turn, vehicle vs add-on split, lead performance (30d), add-on revenue | Overview, GM Oversight | Stock turn uses 28 active cars while Overview says 26. "32 units over 45 days" while Overview says 26 stale. Oldest lead shown as "4472h" while Overview says 216d. Lead performance says 0 leads but still lists a salesman row. | Merge into **Reports** |
| 3 | **Performance** (Reports → Analytics) | Sales Manager | Traffic chart, team scorecard, listings & inventory block, website traffic, per-salesman link stats | Listings, Team, Overview | Within this one page: "Stale 60D+: 26" and "Aged >45 days: 4 (4 critical >60d)". A salesman with score 0 and 0% conversion gets a **TOP** badge. "Page visits 250" vs "Store visits 39" with no definitions. | Merge into **Reports** |
| 4 | **Listings** (Reports → Analytics) | Marketing | Active/sold/avg age, incomplete-listing nudges, ageing list, per-listing views/WA/calls/bookings/CVR, Export CSV | Inventory, Performance | Third copy of the inventory-age numbers (avg age 170d here, 174d Overview, 168d Inventory, 163d Stock). | Merge into **Marketing** |
| 5 | **GM Oversight** (Reports) | Owner, GM | Revenue/GP/units/capital tied, targets, revenue trend, "What drove revenue", "Eyes here" alerts, activity trail | Overview, Revenue | A fourth copy of the same KPIs. The activity trail is valuable but lives only here. | Merge with Overview |
| 6 | **Leads / CRM** (Sales): Pipeline, Appointments, Outreach | Sales Advisor, Sales Manager | Kanban by stage, search, source/salesperson filters, Add Lead, lead drawer, booking list/week, outreach | HP Board, Customers, Documents | Duplicate leads accepted (same phone). Assigning a lead doesn't reach the salesman (see P1-2). Appointment times are saved 8 hours late (P1-1). The Add Lead source list lacks Mudah/Carlist/Facebook/TikTok/Instagram even though the filter offers them. Opening a lead takes 2 clicks (card → column modal → lead). The "Negotiating" filter chip is missing. | Keep (core) |
| 7 | **HP Board** (Sales) | F&I, Sales Manager | Bank submission tracker, approval rate, disbursed totals, Mark Disbursed | Lead drawer (HP Submission), `/fi` panel | No way to create a submission here; it only shows what was created in a lead drawer. | Move under CRM as a "Financing" view |
| 8 | **Inventory** (Inventory) | Stock Controller, Owner | KPI strip, Available/Reserved/Sold/Unpublished tabs, table with cost/recon/gross, filters, tools | Stock (hidden), Listings, Add Listing | "TOTAL LISTINGS 42 — *Active inventory*" counts sold cars. Three stock values: RM6.47M "Stock value", RM5.35M "Total value", RM6.12M "Capital tied" elsewhere. Car GP (Month) RM1,303 while Overview says RM3,000. | Keep; merge Stock into it |
| 9 | **Add Listing** (Inventory) | Stock Controller | Choice: *Publish to marketplace* or *Internal stock only*; 4-step wizard; live cost floor | Inventory, Stock | Accepted year **2035** and mileage **−100 km**. "Internal stock: 1 phase" but the wizard shows 4 steps. Plate saved on the listing but **not** on `stock_units.registration_number`. | Make an "Add" button on Inventory |
| 10 | **Market Demand** (Inventory) | Owner, Buyer | JPJ new-registration data vs your stock, brand filters | none | Brand duplicates (Icaur/iCaur, Jac/JAC, Mclaren/McLaren). Data is new-car registrations, which is only indirectly useful for a used/recon buyer. | Move to Reports or Marketing |
| 11 | **Handover** (Operations) | Kerani/Admin | Post-sale 8-step board, overdue counts | Customers, Documents | 12 of 13 deals show as overdue by 130+ days, so the board has no signal. The same car (Cullinan) appears in three buyers' handovers. Deals show "No car linked". | Merge with Customers into **After-sales** |
| 12 | **Customers** (Operations) | After-sales | Buyer list, road tax/insurance due, handover %, Edit, Aftercare packages | Handover, Leads | "This month: 0" while Overview says 1 unit sold this month (status-only sale, no customer). 11 customers share a phone with another customer, with no duplicate merge. | Merge with Handover |
| 13 | **Documents** (Operations) | Kerani | Sales Agreement, Deposit Receipt, Handover Checklist; draft → issue; resend | Lead drawer | No lead/customer picker, so buyer details are retyped. The deposit isn't pulled from the lead. Receipt shows "Date: —" and the old "XDRIVE" brand. Two sales agreements exist for the same car to different buyers. No invoice, official receipt, refund note or payment voucher. | Keep, but drive it from the deal |
| 14 | **Storefront** (Growth) | Marketing | Hero carousel (5 slides max), Services & Add-ons catalogue | Settings → Homepage, Settings → Services | 3 of 5 slots are taken by **sold, hidden** slides, which blocks new ones. Services are also edited in Settings → Services. | Merge into Settings → Website |
| 15 | **AI Manager** (Growth) | Owner, Sales Manager | Chat with preset prompts (briefing, reprice, "Roast my team") | Overview AI strip | **Broken: every request returns HTTP 400.** Its own tiles say 0 cold leads and 0 appointments today while Overview says 42 and 21. "Roast my team" isn't a professional label. | Remove until fixed |
| 16 | **Team** (Admin) | Owner | Staff counts by role, leaderboard, per-salesman card, assigned cars, commission approve payout, deactivate/remove, broadcast message | Settings → Team, Performance | "14 cars sold" but the leaderboard credits 3 (11 sales have no salesperson). "5 active · 100% active rate" sits next to "diara · Inactive 30d+". The commission card doesn't include new sales (test sale added RM5,300 gross and RM0 commission). | Keep; merge Settings → Team into it |
| 17 | **Settings** | Owner | 17 sections: Dealership, Contact, Homepage, Page Content, Commission, Cost Floor, Deal Sheet, Viewing Hours, Services, Handover, Telegram, WhatsApp, Verify ID, Security, Team, Plan & Billing, Delete Account | Storefront, Team | Overlaps Storefront (Homepage/Services) and Team. | Keep |
| (18) | **Stock** (hidden) | Stock Controller | Stock units with B5/B7/encumbrance chips, recon jobs, ad spend, unit P&L, vendors, CSV/AI import | Inventory | Not in the navigation. Shows "**−9yr**" age for a 2035 car. Its "Net" figure disagrees with the unit P&L modal and with the Add form (section 3.3). | Merge into Inventory |

**Data model issues found** (read-only DB inspection):
- `appointments` (51 rows) and `bookings` (0 rows) are two booking tables.
- Deposits are stored on `leads.deposit_*`, `deal_financials.deposit_received`, `appointments.deposit_amount` and `bookings.deposit_amount`.
- Vehicle facts are duplicated between `car_listings` and `stock_units` (brand, model, year, VIN, colour, mileage…), and `stock_units` has both `vin` and `vin_number`.
- `car_listings` has **29 triggers**.
- There's no payments or invoice table.

---

## 3. Functional Test Results

### 3.1 Test log

Role for all runtime tests: **Owner**. "DB" = verified by a read-only SQL query after the action.

| ID | Role/persona | Page | Action | Test data | Expected | Actual | Status | Evidence | Sev |
|---|---|---|---|---|---|---|---|---|---|
| T01 | Stock ctrl | Add Listing | Year validation | Year 2035 | Rejected | Saved; Stock card shows "−9yr" | FAIL | DB `stock_units.year=2035` | P2 |
| T02 | Stock ctrl | Add Listing | Mileage validation | −100 km | Rejected | Saved | FAIL | DB `mileage=-100` | P2 |
| T03 | Stock ctrl | Add Listing | Cost floor maths | 35,000 + 2,500 recon, asking 30,000 | Floor 38,870, est. gross −8,870 | Exactly that; loss shown in red | PASS | Screenshot | — |
| T04 | Stock ctrl | Add Listing | Save internal stock | Toyota Vios, RM35k, asking RM42.8k | Listing + stock unit, not public | Created; listing `unpublished` | PASS | DB | — |
| T05 | Stock ctrl | Add Listing | Plate carried to stock unit | "AUDIT 0001" | Same plate on both | Listing has it, `stock_units.registration_number` is NULL | FAIL | DB | P2 |
| T06 | Stock ctrl | Stock → Recon Jobs | Add recon job | Tyres RM800 | Job saved, P&L updated | Saved. Card "Net" unchanged (RM5,300). P&L modal now uses RM800 **instead of** the RM2,500 estimate, so profit **rises** to RM7,000 | PARTIAL | DB + screenshot | P1 |
| T07 | Accounts | Stock / DB | Stored GP on unsold unit | n/a | NULL or projected | `stock_units.gross_profit = −37,500` | FAIL | DB | P2 |
| T08 | Advisor | CRM → Add Lead | Create lead with car | AUDIT-TEST Buyer One | Lead created | Created | PASS | DB | — |
| T09 | Advisor | CRM → Add Lead | Duplicate phone | Same number, new name | Warning or merge | 2nd lead created silently. 37 existing leads already share a phone | FAIL | DB | P2 |
| T10 | Advisor | Add Lead modal | Submit button usability | n/a | Clickable | Success toast sits **on top of** the submit button; real clicks hit the toast | FAIL | Screenshot | P2 |
| T11 | Advisor | Lead drawer | Financing + on-road calc | RM42,800, 10% down | Correct sums | On-road 43,729 = 42,800 + 90 + 689 + 150 ✓ | PASS | Screen | — |
| T12 | Advisor | Lead drawer | Generate Deal Sheet (quotation) | n/a | Shareable sheet | "Deal Sheet ready, valid 7 days" | PASS | Screen | — |
| T13 | Sales Mgr | Lead drawer | Assign to salesman | diara | Lead appears in salesman's pipeline | Writes `leads.assigned_to`; `salesman_id` stays NULL. Salesman RLS only shows `salesman_id = me`, so **she never sees it** | FAIL | DB + `pg_policies` | P1 |
| T14 | Advisor | Lead drawer | Schedule viewing | 7 Nov 2026 10:00 | Saved 10:00 MYT | Shown and stored as **18:00 MYT** (`10:00+00`). A past date is also accepted | FAIL | DB; `LeadDrawer.jsx:331` | P1 |
| T15 | Advisor | Lead drawer | Appointment attributed to rep | n/a | `salesman_id` set | NULL | FAIL | DB | P2 |
| T16 | Advisor | Lead drawer | Move to Deposit Taken | n/a | Prompts for deposit; car reserved | No prompt. Car **not** reserved (trigger only reserves `available` cars), but the UI shows "Reserved by diara" | FAIL | DB + `sync_car_reservation_on_lead_stage` | P0 |
| T17 | Kerani | Lead drawer | Save deposit | RM1,000, balance due RM99,999 | Balance auto = price − deposit | Accepts 99,999 (> car price). No receipt generated | FAIL | DB | P2 |
| T18 | Kerani | Documents | Generate deposit receipt | Same buyer | Prefilled from lead | Buyer, IC and deposit retyped by hand. Advisor defaults to the owner. "Date: —". Brand "XDRIVE". Method "Bank Transfer" while the lead says "Cash" | PARTIAL | Screenshot | P2 |
| T19 | Kerani | Documents | IC validation | `000000-00-0000` | Rejected | Accepted | FAIL | Screen | P3 |
| T20 | Advisor | Lead drawer | 2nd buyer, same car, Deposit Taken | DUP lead | Blocked: car already holds a deposit | Allowed. Picker shows no "deposit taken" flag | FAIL | DB | P0 |
| T21 | Advisor | Lead drawer | Cancel → Lost | Reason "Financing rejected" | Ask refund vs forfeit; record refund | Asks loss reason only (good). No refund step | PARTIAL | Screen | P1 |
| T22 | Sales Mgr | Lead drawer | Mark Won | Closer diara | Car sold, customer, handover, financials | Car sold ✓, customer ✓, 8 tasks ✓, `deal_financials` row created | PASS (mechanics) | DB | — |
| T23 | Owner | Lead drawer | Final price / discount approval at win | n/a | Enter agreed price; approve discount | No price asked; sold price = asking. No approval | FAIL | DB | P1 |
| T24 | Accounts | DB | Deal financial record | after T22 | GP ≈ RM5k | **`gross_profit = 42,800`** (purchase 0, recon 0). `deposit_received = 0` despite RM1,000 | FAIL | DB | **P0** |
| T25 | Accounts | DB | Commission carried | RM600 entered at Add Listing | RM600 (or rule 2% = RM856) | `car_listings.commission_amount = 0`; Team commission unchanged | FAIL | DB + Team tab | P1 |
| T26 | Owner | Dashboards | Numbers after the sale | +RM42,800 revenue | All pages agree | Revenue +42,800 ✓. MTD Gross **RM8,300** (Overview/GM) vs **RM6,413** (Inventory). Neither deducts the RM800 recon job | FAIL | Screens | P1 |
| T27 | Owner | Overview | Refresh after sale | n/a | Updates | Old figures until a full page reload | FAIL | Screens | P3 |
| T28 | Advisor | Lead drawer | **Sell an already-sold car again** | DUP lead → Won | Blocked | Allowed: **2 customers, 16 handover tasks** on one car. Closer may be "Unassigned". No second financial row | FAIL | DB | **P0** |
| T29 | Owner | AI Manager | Morning briefing | Preset prompt | Briefing | "Connection error". `ai-proxy` returns **400**: client sends `messages`, server needs `prompt` | FAIL | Network; `AISalesManager.jsx:91-96`, `ai-proxy/index.ts:112` | P1 |
| T30 | Owner | Overview | "Appointments today" | n/a | 0 (true count) | 21 | FAIL | DB `appts_today_real = 0` | P2 |
| T31 | Owner | CRM | Search "AUDIT" | n/a | 2 hits | 2 hits, stage chips filter | PASS | Screen | — |
| T32 | Marketing | Storefront | Add hero slide | n/a | Possible | Blocked "Max 5", but 3 slots hold sold, hidden slides | FAIL | Screen | P3 |
| T33 | Security | DB policy | Salesman access to stock cost | Policy `stock_team_all` | Hidden from sales | Every linked role (incl. salesman) has **ALL** on `stock_units` (purchase price, recon, edit, delete) | FAIL (policy) | `pg_policies` | **P0** |
| T34 | Security | DB policy | Edit issued documents | `documents_team_update` | Issued = locked | Any team member can UPDATE `dealer_documents` | FAIL (policy, needs runtime confirm) | `pg_policies` | P1 |
| T35 | Audit | DB | Audit trail | n/a | Changes logged | `activity_log` captures stock/listing/lead changes ✓. **No** audit triggers on `customers`, `deal_financials`, `dealer_documents` | PARTIAL | `pg_trigger` | P2 |

**Not tested (and why):**
- Runtime logins as Manager, Salesman, Accounts, F&I or Admin: you chose Owner + code review. Permission findings T33/T34 come from reading the policies, not from logging in as those roles.
- CSV import/export and AI Import: would load or extract real stock data.
- Outreach "WhatsApp all", Telegram, email Resend: would message real numbers.
- Add HP Submission and Mark Disbursed.
- Editing purchase price after sale.
- Two people editing the same record at once.
- Deactivating a salesperson with live leads: would affect your real staff account.

### 3.2 What works well (verified)
The cost-floor calculator, the on-road calculator, the deal sheet link, pipeline search, the loss-reason capture, the won-trigger fan-out (car → sold, customer, handover), sequential document numbers (DR-2026-003), and stock-unit change logging in `activity_log`.

### 3.3 One question, many answers (same account, same minute)

| Question | Answers found |
|---|---|
| How many cars am I selling? | 26 (Overview) · 28 (Revenue "stock turn") · 32 "units in stock" (Performance) · 33 Available (Stock) · 42 "Total listings — Active inventory" (Inventory) |
| How many are ageing? | 26 stale 30d+ (Overview) · 32 over 45d (Revenue) · 26 stale 60d+ **and** 4 aged >45d (Performance, same page) · 32 aging 60d+ (Inventory) · 4 aged 60d+ (GM) |
| Average days on lot | 174 · 170 · 168 · 163 |
| Money tied in stock | RM6,119,097 (cost) · RM6,472,464 "Stock value" · RM5,350,000 "Total value" |
| Gross profit this month | RM3,000 (Overview/Revenue/GM) vs RM1,303 (Inventory/Stock). After the test sale: RM8,300 vs RM6,413 |
| Profit on the test Vios | Add form RM3,930 · Stock card RM5,300 · Unit P&L RM7,000 · `stock_units.gross_profit` −37,500 → 5,300 · `deal_financials.gross_profit` **42,800** |
| Cars sold / by whom | Team "14 sold" · leaderboard 3 · 13 won leads · 14 customers. 11 of 14 sold cars have no salesperson, 9 have no customer, 6 won deals have no car |
| Cold leads / appts today | 42 & 21 (Overview) vs 0 & 0 (AI Manager). Truth: 0 appointments today |

---

## 4. Workflow (End-to-End Scenario) Results

| Scenario | Result | Summary |
|---|---|---|
| **1. Vehicle acquisition** (Vios RM35k) | **PARTIAL** | Good wizard and cost floor. No validation. The plate didn't copy to the stock unit. The recon job doesn't flow to unit gross, and an actual recon job *replaces* the full estimate. No supplier payment or documents (purchase invoice, seller IC, geran copy) captured. |
| **2. Customer enquiry** | **PARTIAL** | Lead, car link, calculator and deal sheet all work. Assignment doesn't reach the salesman. Appointment saved 8h late, with no salesperson. Duplicates aren't detected. |
| **3. Reservation / deposit / cancel / refund** | **FAIL** | Deposit isn't required to enter the stage. The car isn't reserved for internal stock. A second buyer's deposit on the same car is accepted. The receipt is retyped by hand. Cancelling has no refund or forfeit record. The trigger un-reserves a car when *any* deposit lead is lost, even if another buyer still holds a deposit (code: `sync_car_reservation_on_lead_stage`). |
| **4. Vehicle sale** | **PARTIAL** | Win automation works. No final price, discount approval, payment or balance check before "sold". Commission is dropped. The car can be sold again. |
| **5. Financial reporting** | **FAIL** | Gross profit differs by page. `deal_financials` records 100% of the price as profit. The deposit isn't carried. Commission is 0. The recon job is ignored. |
| **6. Mistakes & exceptions** | **FAIL** | Duplicate customer → allowed. Wrong vehicle info → allowed. Wrong payment amount → allowed. Cancelled booking → no refund record. Car sold twice → **allowed**. Customer changes vehicle → re-linking works, but the old car's reservation isn't released. Salesperson leaves → not tested. Purchase price edited after sale → not tested (logged in `activity_log`, no lock found). Concurrent edits → not tested; no record versioning found. |

**Clicks for common jobs (Owner, desktop):**
- New walk-in lead with car: ~8 clicks. The form is good; the car search box being separate from the select is clunky.
- Open a lead: 2 clicks (card → column modal → lead).
- Take a deposit and print a receipt: ~25 clicks across 2 tabs, with name, IC and amount typed twice.
- Find a car's true profit: 4 screens, 4 answers.

---

## 5. Tab Consolidation

**Current (17 + hidden):** Reports {Overview, Revenue, Performance, Listings, GM Oversight} · Sales {Leads/CRM, HP Board} · Inventory {Inventory, Add Listing, Market Demand} · Operations {Handover, Customers, Documents} · Growth {Storefront, AI Manager} · Admin {Team} · Settings · (Stock, hidden)

| Tab | Verdict | Why |
|---|---|---|
| Overview | **REDESIGN** | One home: today's actions (follow-ups due, viewings today, deposits awaiting balance, cars missing docs) + 4 trusted KPIs |
| Revenue / Performance / Listings / GM Oversight | **MERGE** → **Reports** (Sales, Stock, Team, Marketing sub-tabs) | Four tabs repeat the same numbers with different maths |
| Leads / CRM | **KEEP** | Core daily tool |
| HP Board | **MOVE** → CRM "Financing" view | It only reads drawer data |
| Inventory + hidden Stock + Add Listing | **MERGE** → **Stock** (list, unit page, "Add car" button) | One vehicle record, one place |
| Market Demand | **MOVE** → Reports | Analysis, not an operation |
| Handover + Customers | **MERGE** → **After-sales** | Same customers, same lifecycle |
| Documents | **REDESIGN** → generated from the **Deal** | Stop retyping |
| Storefront | **MOVE** → Settings → Website | Settings already has Homepage and Services |
| AI Manager | **REMOVE** until fixed | Broken, and its numbers contradict Overview |
| Team | **KEEP**, absorb Settings → Team | |
| Settings | **KEEP** | |

**Proposed navigation (8):**
1. **Today** (home)
2. **Leads**: pipeline, appointments, outreach, financing
3. **Deals** *(new)*: one record per sale holding car, buyer, agreed price, discount approval, payments, documents, commission
4. **Stock**: units, add car, recon, costs, docs status
5. **After-sales**: handover, customers, renewals, aftercare
6. **Reports**: sales, stock, team, marketing, market demand
7. **Team**
8. **Settings** (incl. website)

The **Deal** is the missing object. Today a "deal" is spread across `leads`, `deal_financials` (only shown in `/accountant`), `customers`, `dealer_documents` and `post_sale_tasks`.

---

## 6. Missing Features (ranked by business importance)

| Rank | Feature | Problem solved | Who | Essential? | Where |
|---|---|---|---|---|---|
| 1 | **Sale lock**: one active deposit and one won deal per car (DB-enforced) | Double-selling, double deposits | All | **Essential** | DB + Deals |
| 2 | **Payments ledger** (deposit, balance, loan disbursement, refund; each with a receipt no.) + **outstanding balance** view | Cash control, receivables | Accounts, Kerani, Owner | **Essential** | Deals |
| 3 | **One profit definition** (price − purchase − recon actual-or-estimate − transfer/admin − commission − add-on cost) used everywhere | Owner can't trust any number today | Owner, Accounts | **Essential** | Shared server function |
| 4 | **Final selling price + discount approval** at win (manager approves below the floor) | Margin leakage | Sales Mgr, Owner | **Essential** | Deals |
| 5 | **Invoice / Official Receipt / Refund note** generated from the deal | Paperwork, audit | Kerani, Accounts | **Essential** | Documents |
| 6 | **Role-based field security**: hide purchase price from salesmen | Pricing leaks to buyers | Owner | **Essential** | RLS + UI |
| 7 | **Duplicate detection** on phone/IC for leads and customers | Split history, double counting | Advisor, After-sales | Essential | CRM |
| 8 | **Vehicle acquisition record**: seller, purchase docs (geran, B5, seller IC), supplier payment, settlement of seller's HP | Legal transfer readiness | Stock ctrl, Kerani | Essential | Stock |
| 9 | **Commission calculation from rules** at win, with approve/pay | Commission disputes | Sales Mgr, Accounts | Essential | Deals/Team |
| 10 | **Salesperson offboarding**: bulk reassign leads/cars | Staff turnover | Sales Mgr | Essential | Team |
| 11 | Monthly **P&L** with operating expenses (`expense_entries` exists but has 0 rows and no UI found) | Net vs gross profit | Owner | Optional now | Reports |
| 12 | Warranty register + complaint log | After-sales disputes | After-sales | Optional | After-sales |
| 13 | Record locking / "edited by X" warnings | Two staff editing | All | Optional | Global |

---

## 7. Useless or Unnecessary Features (today)

- **AI Manager tab**: broken, duplicates Overview, and its preset "Roast my team" is unprofessional.
- **Four analytics tabs plus GM Oversight**: the same KPIs with different maths. More tabs lower trust.
- **Market Demand** as a top-level Inventory tab: interesting, but it's new-car registration data and nobody acts on it daily.
- **Handover board** in its current state: 12 of 13 deals are "overdue 130d+", so the alert is noise. It needs completion and archiving rules.
- **Hero carousel slots held by sold cars**.
- **"Revenue — Last 30 days" chart on Overview**: one sale makes a single spike, and the chart is a less useful version of the Revenue tab.
- **`bookings` table**: unused alongside `appointments`.

---

## 8. Critical Bugs

### P0: data/financial integrity or security
1. **The same car can be sold more than once.** No DB constraint stops a second won lead on a sold car. Runtime: the test Vios was sold to 2 buyers, creating 2 customers and 16 handover tasks. Existing data already has the Cullinan sold 3 times (listing `67b534ce…`, 3 won leads). Fix in the won trigger (`auto_create_customer_on_won`): refuse when the car is already sold to another lead.
2. **`deal_financials` records the full selling price as gross profit.** The auto row (`trg_auto_deal_financial` on `car_listings`) writes `purchase_price=0, recon_cost=0, gross_profit=42,800, deposit_received=0` for a car bought at RM35,000 with a RM1,000 deposit. Anything reading this table (the Accountant panel) overstates profit by about 8×.
3. **Deposits don't protect the car.** `sync_car_reservation_on_lead_stage` reserves only `available` cars and never checks for an existing deposit. A second deposit on the same car is accepted. Losing **any** deposit lead flips a reserved car back to `available`, even if another buyer still holds a deposit.
4. **Salesmen (every linked role) have full access to stock costs.** RLS policy `stock_team_all` on `stock_units` = `ALL` where `dealer_id = get_my_dealer_id()`. A linked salesman resolves to the dealer id, so they can read and edit purchase prices. *Confirmed by policy inspection; not confirmed by logging in as a salesman.*

### P1: major operational failure
1. **Appointment times are saved 8 hours late** from the lead drawer: `LeadDrawer.jsx:331` sends a local `datetime-local` string, and the DB treats it as UTC. 10:00 becomes 18:00 MYT, and reminders fire at the wrong time.
2. **Dealer assignment doesn't reach the salesman.** `LeadDrawer.jsx:768` writes `leads.assigned_to`, but salesman visibility, the Team leaderboard and attribution use `salesman_id`.
3. **Profit has 4+ definitions** (section 3.3). In the unit P&L (`DashboardPage.jsx` ~7150), one small recon job *replaces* the whole estimate, so profit goes **up** when you log a cost.
4. **Commission is lost.** The RM600 entered at Add Listing is saved as `commission_amount = 0`, and nothing is calculated at win.
5. **No final price, discount approval or balance check before "Won".**
6. **AI Manager is dead.** `AISalesManager.jsx:91-96` sends `messages`; `supabase/functions/ai-proxy/index.ts:112` returns 400 without `prompt`.
7. **No payment ledger or refund record.** Deposits are scattered across 4 tables.
8. **Issued documents are editable by any staff member** (`documents_team_update`). Confirm at runtime and lock issued rows.

### P2: significant inconvenience or broken function
- No validation on year, mileage, IC, or balance greater than price; past appointments allowed.
- Duplicate leads and customers.
- The toast covers the modal's submit button.
- The UI shows "Reserved by diara" while the DB says not reserved.
- The appointment gets no salesperson.
- Plate isn't copied to the stock unit.
- `stock_units.gross_profit` is stored negative for unsold units.
- "Appointments today" counts all future appointments (`OverviewTab.jsx:149-151`).
- Documents aren't prefilled from the lead; the receipt shows "Date: —" and "XDRIVE".
- No audit trigger on `customers`, `deal_financials` or `dealer_documents`.
- Inventory "Total listings — Active inventory" counts sold cars.
- Customers "This month 0" while a car was sold this month.
- The Stock page is hidden from the navigation.
- **The deposit receipt clause** says a cancellation fee "up to 5% … as per the Consumer Protection Act 1999". I couldn't find a 5% provision in the Act. Have a lawyer confirm or remove it before any dealer issues these receipts.

### P3: minor or cosmetic
- "TOP" badge on a zero-score salesman.
- Hours shown as "4472h".
- "−9yr" car age.
- "Negotiating" filter chip missing.
- 2-click lead open.
- Duplicate brand names in Market Demand.
- Sold slides block the hero carousel.
- "Internal stock: 1 phase" label vs a 4-step wizard.
- Old "XDRIVE" title in the browser tab.

---

## 9. Role-Based Permissions (recommended)

V = view, C = create, E = edit, A = approve, D = delete. "Own" = their own records only.

| Area | Owner | GM / Sales Mgr | Sales Advisor | Kerani / Admin | Stock Ctrl | Accounts | Marketing | After-sales |
|---|---|---|---|---|---|---|---|---|
| Leads | VCEAD | VCE (all), reassign | VCE (own) | VC | — | V | V (source only) | V |
| Stock: specs & status | VCEAD | VE | V (no cost) | V | VCE | V | VE (listing text/photos) | V |
| Stock: **purchase price / recon / margin** | V E | V | **hidden** | — | VCE | VE | hidden | hidden |
| Selling price & discount | A | A (within limit) | propose | — | — | V | — | — |
| Deposits & payments | V A | V | C (receipt request) | VC | — | VCE A (refunds) | — | V |
| Documents (draft) | all | VCE | C (own deals) | VCE | — | V | — | V |
| Documents (issued) | V, void with reason | V | V | V | — | V | — | V |
| Commission | A | V (team), propose | V (own) | — | — | VE, pay | — | — |
| Customers / handover | all | V | V (own) | VCE | V | V | V (marketing consent only) | VCE |
| Team & settings | all | V | — | — | — | — | — | — |
| Delete anything financial | soft-delete only, logged | — | — | — | — | — | — | — |

Today the policies don't separate cost from sale data (`stock_team_all`), let any staff member edit documents and customers, and give admins and managers hard DELETE on leads (`leads_owner_delete`). Use soft-delete plus the audit log for all financial records.

---

## 10. Prioritised Roadmap

**MUST FIX BEFORE LAUNCH**
1. DB guard: one won deal per car, one active deposit per car, and no win on a sold car.
2. Fix `trg_auto_deal_financial` to copy purchase, recon, deposit and commission. Backfill the existing rows.
3. One server-side profit function. Every tile reads it, and dashboards stop computing their own.
4. Hide cost fields from sales roles (RLS split or column-level view). Lock issued documents.
5. Appointment timezone fix (`LeadDrawer.jsx:331`) and a single assignment field (`salesman_id`).
6. A Deal record with agreed price, discount approval, payments ledger and balance, with receipt/invoice generated from it.
7. Fix or remove AI Manager. Fix "appointments today".

**SHOULD FIX SOON**
- Input validation.
- Duplicate detection.
- Deposit-taken requires an amount and auto-generates the receipt.
- Cancel → refund/forfeit record.
- Commission from rules at win.
- Merge Inventory + Stock.
- Prefill documents.
- Reconcile the counts shown in section 3.3.
- Audit triggers on money tables.
- Lawyer review of the receipt T&Cs.

**NICE TO HAVE**
- Tab consolidation to 8 (section 5).
- Today home screen.
- Offboarding / bulk reassign.
- Handover auto-archive.
- Expense entry UI for net profit.

**FUTURE DEVELOPMENT**
- Bank/HP integrations.
- JPJ/MySikap document checklist with uploads.
- Warranty and complaints module.
- Record locking.
- Accounting export (e.g. to a cloud accounting package).

---

## 11. Final Verdict

**Would I run a real Malaysian used/recon dealership on Drevo today?** Not as my main system. I'd let advisors use the pipeline and lead drawer. Stock costs, deposits and profit would stay in my existing books.

**What stops adoption:** I could sell the same car twice, take two deposits on one car, and see four different profit numbers. My salesmen could read my buy prices. Appointments would be booked 8 hours off. There's no receipt-backed payment trail.

**What would make me pay:** A **Deal** screen that takes a car from deposit to delivery with one buyer record. It would generate the receipt, agreement and invoice, track the balance until the loan disburses, calculate commission, and show one profit figure I can trust, all on the same lead drawer advisors already like.

**The five most important changes**
1. DB-enforced sale and deposit exclusivity per car.
2. One trusted profit calculation, with `deal_financials` fixed.
3. A Deal record with a payments ledger plus generated receipt and invoice.
4. Cost-price security by role, and locked issued documents.
5. A single salesperson field plus the appointment timezone fix.

---

## Appendix A: Test records and cleanup status

I tried to delete the test records in one transaction, but the database tool's confirmation prompt went unanswered before it timed out. **The test records are still in production** (lead activities cascade with the leads):

- `car_listings` `f6e45cc9-fac8-4615-b1ca-65cc922969cd` (2035 Toyota Vios 1.5 G AUDIT-TEST, status sold, never public)
- `stock_units` `7e1a8bdd-7429-44ff-860d-0d89979297f5` (+1 recon job, cascades)
- `leads` `18390ba3-ec8d-4371-804c-5cae4b96037c`, `c6360714-94fe-4ab6-b3e9-19b01d9fd34b`
- `appointments` `c2de8642-5cc6-486b-b716-a047a9234390`
- `customers` ×2, `post_sale_tasks` ×16, `deal_financials` ×1, `dealer_documents` ×1 (draft DR-2026-003), all tied to the listing/leads above

Cleanup SQL (run once, in the Supabase SQL editor or by approving the prompt):
```sql
begin;
delete from post_sale_tasks where lead_id in ('18390ba3-ec8d-4371-804c-5cae4b96037c','c6360714-94fe-4ab6-b3e9-19b01d9fd34b');
delete from customers where lead_id in ('18390ba3-ec8d-4371-804c-5cae4b96037c','c6360714-94fe-4ab6-b3e9-19b01d9fd34b') and name like 'AUDIT-TEST%';
delete from deal_financials where listing_id='f6e45cc9-fac8-4615-b1ca-65cc922969cd';
delete from dealer_documents where listing_id='f6e45cc9-fac8-4615-b1ca-65cc922969cd';
delete from appointments where id='c2de8642-5cc6-486b-b716-a047a9234390';
delete from leads where id in ('18390ba3-ec8d-4371-804c-5cae4b96037c','c6360714-94fe-4ab6-b3e9-19b01d9fd34b') and buyer_name like 'AUDIT-TEST%';
delete from stock_units where id='7e1a8bdd-7429-44ff-860d-0d89979297f5';
delete from car_listings where id='f6e45cc9-fac8-4615-b1ca-65cc922969cd' and variant='1.5 G AUDIT-TEST';
commit;
```
`activity_log` rows mentioning AUDIT-TEST are left in place on purpose, because it's the audit trail.

Until cleanup runs, Overview, GM Oversight and Team include one extra RM42,800 sale. Customers and Handover show two AUDIT-TEST buyers.
