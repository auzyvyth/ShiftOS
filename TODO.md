# ShiftOS — Pending Tasks

## ⚠️ USER ACTION REQUIRED — remind every session until done

- **ACT-1: Enable TOTP in Supabase dashboard** — 2FA (SEC-1) will not work end-to-end until the TOTP factor type is enabled: Supabase → Authentication → Settings → Multi-Factor → enable **TOTP**. Until then, the "Enable 2FA" button in Settings will error on enroll.
- **ACT-2: Decide on full 2FA enforcement (SEC-1b)** — Client-side 2FA only challenges the password login path. Google OAuth and magic-link logins are NOT challenged. True enforcement across all auth methods needs RLS policies keyed on `aal2` so the database rejects aal1 sessions. Confirm if/when you want this hardening built.

> Reminder protocol: while ACT-1 or ACT-2 remain here, surface them at session start and whenever 2FA/security work is touched.

## Dev tasks

### SECURITY (verified gaps — settings audit)

- **SEC-1: 2FA / TOTP** — Authenticator-app MFA via Supabase native API (`supabase.auth.mfa.enroll/challenge/verify`). Enrollment UI (QR + verify) in Settings → Account Security; AAL2 challenge step on login when a verified factor exists; unenroll option. (IN PROGRESS)
- **SEC-2: Permission matrix** — Owner-controlled per-role visibility toggles (hide cost/gross/recon from salesman, restrict delete, scope leads to own). New `role_permissions` table + gating helper. Large build.
- **SEC-3: Audit log completeness + RLS** — Wire `logActivity` into unlogged write paths (dealer_products, vendors, recon_jobs, customers); add RLS policy to `activity_log` (dealer_id = auth.uid()); add table to migrations. (overlaps ENT-3)
- **SEC-4: Session management** — "Log out all devices" via `signOut({ scope: 'global' })` in Settings; optional idle timeout.
- **SEC-5: Telegram token hardening** — Move `telegram_bot_token` out of `profiles` (admin-readable) into an edge-function secret / server-side store; UI only writes, never reads back.

### SETTINGS (verified gaps)

- **SET-1: Editable WhatsApp templates** — Template editor in Settings replacing hardcoded `WHATSAPP_TEMPLATES` in leadsHelpers.js; per-dealer storage with `{{placeholders}}`.
- **SET-2: Add Lead — IC / email / address** — Add buyer_ic, buyer_email, buyer_address to AddLeadModal + leads table for real HP applications.
- **SET-3: Deal sheet branding** — Add logo, custom disclaimer, and signature/deposit-acknowledgment block to DealPage template.
- **SET-4: Commission settings** — Per-role commission structure (% of gross / flat / tiered) so payouts auto-calculate.

### CRITICAL (legal / compliance)

- **ENT-1: Stock — encumbrance + B5 tracking** — Add `encumbrance_status` (clear/under_hp/unknown) and `puspakom_b5_date` to `stock_units`; show badge in StockTab and LeadDrawer; block Handover Checklist generation if encumbrance not cleared.
- **ENT-2: Document approval gate** — Add `doc_status` (draft → issued) to `dealer_documents`; manager/owner must confirm before doc becomes "issued"; issued docs locked from editing; draft badge shown in list.
- **ENT-3: Master audit log wiring** — `activity_log` table exists (GM-2) but not wired to: listing price edits, status changes, document create/delete, stock cost edits. Add DB triggers or app-layer logging for all write paths.
- **ENT-4: Buyer IC enforcement** — Buyer IC must be non-empty before generating Sales Agreement or Deposit Receipt; show inline validation error.

### MAJOR (operational gaps)

- **ENT-5: Listings filter panel** — Add collapsible filter sidebar/drawer: price range, mileage range, condition (new/used), transmission, state, status. Persist filters in URL params.
- **ENT-6: Analytics CSV export** — Export button on Analytics tab → downloads listings performance + salesman leaderboard as Excel/CSV for accountant/GM review.
- **ENT-7: Settings change log** — Log dealership name, subdomain, and brand color changes to `activity_log`; show last-changed-by + timestamp in Settings tab.
- **ENT-8: Stock movement log** — Per stock unit: timeline of purchase price edits, recon cost changes, asking price adjustments, with user + timestamp.
- **ENT-9: Commission approval workflow** — Commission amounts visible in TeamTab but no approval step; add "Approve payout" action for manager/owner before commission is marked paid.
- **ENT-10: Listings expiry warnings** — Road tax expiry and insurance expiry banners on listing cards when within 30 days; shown in StockTab aging alerts section.
- **ENT-11: HP Board approval status** — Track lender response (pending / approved / rejected) per submission; show status badge in HP Board; notify salesman when status changes.

### BUGS (broken data)

- **AUD-1: AVG Days in Stock = 0** — Stock overview metric shows 0 despite 215 units. Find the days-in-stock calculation in StockTab/OversightTab and fix the aggregation (likely using created_at or a missing `acquired_at` date).
- **AUD-2: Response time drill-down** — Analytics shows 6,217 min avg but no per-salesman breakdown. Add a per-salesman response time table to the Analytics → Revenue sub-tab using the existing `gm_salesman_scores` RPC or a new query on `analytics_events`.

### OPERATIONAL GAPS (high impact)

- **AUD-3: VIN / plate number in stock list** — Add `plate_number` and `vin` columns to `stock_units` (if missing); display plate number as primary identifier in StockTab row and LeadDrawer header so identical make/model units are distinguishable.
- **AUD-4: Deposit / booking fee tracker** — On leads at "Deposit Taken" stage: add deposit amount, payment method (cash/transfer/online), receipt number, balance due, and refund policy fields. Store in `leads` or a new `deposits` table. Show deposit summary in LeadDrawer.
- **AUD-5: Appointment / viewing calendar** — "Appts Today" shows in Overview but no create/manage UI exists. Add appointment creation (date, time, salesperson, car, buyer name/phone) in LeadDrawer and a calendar/list view in a new Appointments tab or sub-tab under Leads.
- **AUD-6: Stock → Listing auto-link** — When a stock unit is created and a listing already exists for the same car (matched by listing_id or plate), auto-populate the `listing_id` FK rather than requiring manual dropdown selection.
- **AUD-7: Multi-bank parallel HP submission** — ENT-11 tracks single-bank status. Extend `deal_financing` to allow multiple bank rows per lead; show all banks in a table per deal with individual status badges; "Submit to another bank" button without closing the current submission.

### MISSING MODULES (larger scope)

- **AUD-8: Full P&L per unit** — Per-car P&L: purchase price + all recon costs + advertising spend + HP commission earned + road tax/insurance paid. GM-1 gives MTD rollup; this is per-unit drill-down. Add a "P&L" expand row in StockTab.
- **AUD-9: Recon job card system** — Assign workshop tasks per stock unit (stages: wash → polish → engine → tyres → inspection → ready), set ETA, track vendor, upload before/after photos, record cost per job line. New `recon_jobs` table linked to `stock_units`.
- **AUD-10: CSV stock import** — Replace "coming soon" placeholder on Import Stock button with a working CSV parser (Papa Parse). Map columns: make, model, year, plate, purchase price, recon, asking price. Validate and preview before insert.
- **AUD-11: Trade-in module** — Record trade-in vehicle (plate, make, model, year, km, condition, valuation, agreed price) linked to a lead. New `trade_ins` table. Show trade-in offset in deal P&L.
- **AUD-12: Vendor / supplier directory** — Dealer-scoped directory of workshops, tint shops, bodywork vendors with name, contact, category. Link vendor to recon job card for cost attribution. New `vendors` table.

### MINOR (polish)

- **ENT-12: Add form duplicate detection** — Warn (not block) if a VIN or plate number already exists when adding a new listing.
- **ENT-13: Team member inactivity flag** — Highlight salesman tile in TeamTab if no activity in 30+ days.
- **ENT-14: Document email delivery** — "Send to buyer" button on issued documents; sends HTML doc to buyer email via Supabase Edge Function / Resend.
- **ENT-15: Email delivery not working** — Resend / edge function email sending is failing end-to-end. Investigate RESEND_API_KEY secret, sender domain verification (alerts@xdrive.my), and edge function logs. notify-price-alerts was redeployed with verify_jwt=false to fix 401 cron block, but actual delivery needs end-to-end testing.

### Infrastructure

- **INFRA-1: Supabase storage cleanup** — Storage is full. Audit bucket usage, delete orphaned images (listings that were deleted but images remain), consider image compression pipeline or CDN offload.

---

## Done (reference)

- **V1: `invites` edge function deployed** — manager/accountant/fi_officer/admin creation now calls `auth.admin.createUser()` via the new `invites` edge function; profile upserted with retry loop; DELETE path also deletes auth user. These roles can now actually log in.
- **V2: TeamTab realtime wired to fetchSoldPerSalesman** — car_listings change event now calls both `fetchSold` (total count) and `fetchSoldPerSalesman` (per-salesman tiles) so commission tiles update live without a manual refresh.
- **V3: Salesman Lite vs Premium gates confirmed** — Lite: dashboard, listings, leads, inbox, performance. Premium (salesman_full): all Lite tabs + loans/HP submissions, financing calculator, deal sheet generator, AI features, customer records. Gated via `isPremium = profile.plan === 'salesman_full'` in SalesmanPremium.
- **DESIGN-SYSTEM: Tokens replaced with user-specified lean definition** — `src/theme/tokens.js` now contains exactly the 5 color keys, border, radius, font, stageColors, activityDot specified. All UI primitives updated to inline removed constants.
- **DESIGN-SYSTEM (layer 1): Premium-light tokens + primitives** — `src/components/ui/*` primitives (Card, Button, Stat, Badge, SectionHeader, SubTabBar). Living style guide at `/style-guide`.
- **HP-3: PUSPAKOM B7 expiry tracking** — `puspakom_b7_date` on stock_units, expiry badge in LeadDrawer, "expired B7" and "missing B7" alerts in OversightTab.
- **HP-4: LOU tracking** — `lou_received_at`, `lou_expires_at` on deal_financing; "Log LOU Received" button; 14-day expiry with red/orange/green status; milestone shown in LeadDrawer.
- **HP-5: JPJ transfer tracking** — `jpj_status`, `jpj_submitted_at`, `jpj_completed_at` on leads; 3-state milestone (pending → submitted → completed); overdue detection (>7 days); full section in LeadDrawer.
- **HP-6: HP document checklist** — employment type toggle (Employed/Self-Employed/Commission) auto-populates required doc checklist; Submit blocked with "X doc(s) missing" until all required docs ticked; checklist pre-saved to hp_docs on insert.
- **HP-1: Bank scorecard in FIPanel** — BankScorecard component in HP Board tab; per-bank approval rate %, avg days to decision, approved/rejected/pending counts sorted by approval rate.
- **HP-2: Sequential multi-bank queue** — rejection category dropdown (DSR/CCRIS/valuation gap/employment/vehicle age/margin) before confirming reject; "Try next bank?" prompt after rejection with dropdown of untried banks; 3+ attempt warning banner; attempt_number saved to deal_financing.
- **GM-1: Real-time owner P&L dashboard** — OversightTab with `gm_pnl_snapshot` RPC; MTD/LMTD revenue & gross; units sold; days-on-lot aging; capital tied; 30-day sparkline; goal pace tracking.
- **GM-2: Audit trail** — `activity_log` table; timeline in OversightTab with anomaly detection; filters by entity type.
- **GM-3: Salesman quality score** — `gm_salesman_scores` RPC; ranked scorecard in OversightTab: conversion rate, response time, avg gross, doc completion rate, close rate.
- **AUDIT-FIX (ARCH): Dashboard tabs merged** — Analytics now holds Listings / Revenue (was RevOps) / Marketplace as sub-tabs; new Storefront tab holds Hero Carousel / Services & Add-ons as sub-tabs. Nav dropped from 16 to 13 items. Legacy deep-links alias to new parent+sub-tab.
- **AUDIT-FIX (C2): Auth token leakage hardened** — cross-subdomain session handoff now passes tokens in the URL hash fragment; new `src/lib/authHandoff.js` helper, wired into LoginPage, AuthCallbackPage, useTenant, DashboardPage, Salesmanpanel, SalesmanLite, SalesmanPremium.
- **AUDIT-FIX (C5): Tenant spoofing closed** — `?tenant=` storefront override now gated to localhost/vercel preview only.
- **AUDIT-FIX (H1): Managers/admins can access dashboard** — useRoleRedirect now accepts an array of allowed roles.
- **AUDIT-FIX (M2): Category definitions unified** — serviceCategories.js is the single source.
- **AUDIT-FIX (M5): Dealership name-change cap enforced server-side** — DB trigger `enforce_dealership_change_cap`.
- **AUDIT-FIX: Stale lead logic** — OR→AND fix in Salesmanpanel and SalesmanPremium.
- **AUDIT-FIX: callClaude → ai-proxy** — all AI features route through working Edge Function.
- **AUDIT-FIX: Analytics data scope, loan form data leak, duplicate leads on appointment, dashboard tab order, ErrorBoundary on lazy tabs.**
- Analytics RPC migration, React.memo on CarCard, self-booking prevention, brand SVGs, team leaderboard, customer records, manager approval workflow, deal presentation screen, accountant payroll payout, F&I module, HP loan tracking, pipeline redesign, deal sheet v2.
- **MKT-1–12: Marketplace audit fixes** — keyboard nav, focus-visible, form labels, HeroCarousel image optimisation, duplicate font removal, dynamic canonical URLs, nav contrast, lang toggle aria-labels.
- **Lexus logo** — redrawn from reference image: horizontal oval ring + angled L emblem + LEXUS wordmark at `/public/brands/lexus.svg`.
- **Documents panel enterprise upgrade** — Full generate form with payment deadline/method, vehicle details (engine no/CC/odometer/prev owners), compliance declarations (Puspakom B5/B7/encumbrance), exceptions noted for handover checklist. 3 document types with proper Malaysian legal output (CPA 1999, SA/DR/HC).
