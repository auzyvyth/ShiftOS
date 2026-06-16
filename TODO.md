# ShiftOS — Pending Tasks

## ⚠️ USER ACTION REQUIRED — remind every session until done

- **ACT-1: Enable TOTP in Supabase dashboard** — 2FA (SEC-1) will not work end-to-end until the TOTP factor type is enabled: Supabase → Authentication → Settings → Multi-Factor → enable **TOTP**. Until then, the "Enable 2FA" button in Settings will error on enroll.
- **ACT-2: Decide on full 2FA enforcement (SEC-1b)** — Client-side 2FA only challenges the password login path. Google OAuth and magic-link logins are NOT challenged. True enforcement across all auth methods needs RLS policies keyed on `aal2` so the database rejects aal1 sessions. Confirm if/when you want this hardening built.

- **ACT-3: Set `TELEGRAM_BOT_TOKEN` edge secret** — Salesman Lite "listing is live" Telegram ping (and appointment-reminder cron) fall back to the platform bot when a user has no personal `telegram_bot_token`. This requires the platform bot token set as a Supabase edge secret: Supabase → Edge Functions → Secrets → `TELEGRAM_BOT_TOKEN=<botfather token>`. Without it, `send-telegram` returns `no_token` for Lite salesmen (silent no-op; dealers with their own token are unaffected). Could not verify whether it is already set from the session.

> Reminder protocol: while ACT-1, ACT-2 or ACT-3 remain here, surface them at session start and whenever 2FA/security/Telegram work is touched.

## Dev tasks

---

### UNIFIED CAR INTAKE (DMS workflow) — in progress

- [x] **DMS-1: AddCarForm (dealer unified intake)** — DONE. New `src/components/AddCarForm.jsx` replaces the old listing-then-prompt flow on the dealer dashboard "Add" tab. One 4-step flow: Identity → Procurement → Condition & Pricing (with live cost floor) → Photos & Publish. Publish toggle: ON inserts car_listings (trigger auto-creates stock_unit, then patches cost fields); OFF inserts stock_units directly (internal inventory, no public listing). Salesman CarForm untouched. `dealer_cost_settings` table created with RLS (dealer_id = get_my_dealer_id()).
- [x] **DMS-2: Dealer cost settings UI** — DONE. "Cost Floor" section in SettingsTab (Operations group): monthly_overhead, avg_fleet_size, floor_plan_rate, runner_fee, admin_fee, warranty_reserve_pct. Upserts to dealer_cost_settings. Cost floor degrades gracefully to govt rates until set.
- [x] **DMS-3: Plate / VIN decode (local lookup)** — DONE. `src/utils/carSpecs.js` lookup table for ~70 common Malaysian models auto-fills engine CC + body type in AddCarForm Step 1 when make+model match and fields are empty. JPJ plate API still restricted (real decode is future work).
- [x] **DMS-4: Holding cost in P&L** — DONE. fetchPnl computes daily holding (floor-plan interest priority, else overhead/fleet) × days held (purchase→sold or →today) and deducts it as a "Holding (Nd)" line in the P&L modal with a RM/day note.
- [x] **DMS-5: Estimated vs actual recon reconciliation** — DONE. fetchPnl fetches recon_jobs and shows actual recon total vs the booked estimate in the P&L modal (amber if over, green if under).
- [x] **DMS-6: Advertising spend per unit** — DONE. New `ad_spend` table + RLS. "Ads" button per stock row (view_cost gated) opens a modal to log/delete spend per channel (Mudah/Carlist/FB/TikTok/IG). Total deducted as an "Advertising" line in the P&L modal.

---

### LAUNCH PAGE AUDIT — ranked by conversion impact

- [ ] **PAGE-1: Add product screenshots** — BLOCKED ON USER ASSETS. "See It In Action" section has 4 placeholder slots ready (Per-Unit P&L modal, Owner dashboard, Sales CRM pipeline, Post-Sale handover board). Send 4 PNG/JPG screenshots (16:9) and they drop straight into `public/screenshots/` + the grid in ShiftOSPage.jsx.
- [x] **PAGE-2: Free-trial pricing copy** — DONE. Starter/Growth cards show "14 days free, then RMxxx/mo · no card required"; CTAs now "Start Free Trial"; hero trust line reads "14-day free trial · No credit card · No contract · Live in 30 minutes". Pro shows "Book a Demo" + "For multi-branch dealers" sub-label.
- [x] **PAGE-3: Onboarding tier carry** — DONE (Growth → /onboarding/dealer_growth, Pro → WhatsApp demo).
- [x] **PAGE-4: Pro CTA → WhatsApp** — DONE (Pro card + nav "Book a Demo" open the demo WhatsApp link).
- [x] **PAGE-5: Remove anonymous testimonial** — DONE. The unattributed "— Dealer, Penang" quote was removed (not replaced with a fabricated name). Slot now holds the FAQ section. Add a real named quote later when available.
- [x] **PAGE-6: Language whiplash** — DONE. All six pain quotes converted to English to match the English solution titles/descriptions.
- [x] **PAGE-7: FAQ section** — DONE. 6 Q&As (PDPA/data safety, Excel/CSV import, data on cancel, mobile, listing/seat cap, onboarding+language) in an accordion above the final CTA; copy researched against PDPA 2025 amendments.
- [x] **PAGE-8: Stats strip rewrite** — DONE. Replaced invented stats with a "Replaces the five tools you juggle today" strip naming Excel sheets, WhatsApp lead chats, manual JPJ/Puspakom tracking, printed paperwork, Telegram posts.
- [x] **PAGE-9: Benefit-led feature copy** — DONE. Each of the 9 feature cards now leads with an outcome headline (category demoted to a small kicker, mechanics in the supporting line).
- [x] **PAGE-10: Plan comparison table** — DONE. Collapsible "Compare all features" 3-column table (Starter/Growth/Pro) under the dealer pricing cards; grouped rows, Growth column highlighted, fits 375px.
- [x] **PAGE-11: Mobile nav** — DONE. Hamburger menu at <=860px revealing Features/Pricing/FAQ/Marketplace/Log in + both CTAs.
- [x] **PAGE-12: Footer text contrast** — DONE. Copyright + "Powered by" lines bumped from #1f2937 to #4b5563.
- [x] **PAGE-13: Soften final CTA** — DONE. "Built for dealers who want real numbers — leaner operations, more sales, and zero guesswork."
- [x] **PAGE-14: City eyebrow** — DONE. "PENANG · KL · JB" → "BUILT FOR MALAYSIA".
- [ ] **PAGE-WATCH: xlsx 2FA gate** — Future: require 2FA challenge before dealer file upload to neutralise the xlsx prototype-pollution risk (low-priority, attacker must already be authenticated dealer).

---

### FEATURE ROADMAP — ranked by priority + ROI

#### TIER 1 — Core revenue intelligence (highest ROI, justify RM5k/month)

- [x] **NEW-1: Real per-unit gross profit** — DONE. P&L modal restructured into Front End (vehicle) and Back End (F&I/add-ons) sections. Front gross = sale price − purchase − recon − services − commission − handover processing. Back gross = add-on revenue − add-on cost. Both labelled clearly; total gross shown at the bottom. fetchPnl now computes frontGross + backGross separately.

- [x] **NEW-2: Auto-create customer record on "won" + seed handover** — DONE. `auto_create_customer_on_won` trigger upgraded: now also captures buyer IC + email into the customers row, AND pre-seeds the full Malaysian post_sale_tasks handover checklist (8 steps, B7 auto-NA when not financed) the instant a lead hits won/closed_won. Idempotent via NOT EXISTS + UNIQUE(lead_id, step_key). Frontend lazy-seed kept as fallback for pre-existing won deals.

- [x] **NEW-3: Car intake / procurement workflow** — DONE. StockTab "Add Stock" form reorganised into two sections: Procurement (price, date, source, recon est., asking price) and Inspection & Compliance (encumbrance status with plain-English labels, Puspakom B5/B7 dates with fee hints). Added a green intake checklist reminder (physical inspection, geran sighted, keys, service history, photos) so nothing gets forgotten on day one.

#### TIER 2 — Retention + accuracy (builds on Tier 1)

- [x] **NEW-4: Customers panel — post-sale lifecycle per customer** — DONE. CustomersTab now fetches post_sale_tasks per lead and shows a handover progress bar (% done) in a new column. Service packages (NEW-9) inline expanded rows also added — "N service pkgs" link expands per customer, "+ Pkg" button adds a new package inline with name/visits/validity/price. Visit log button decrements remaining visits.

- [x] **NEW-5: Connect handover costs to per-unit P&L** — DONE. StockTab P&L modal (`fetchPnl`) now fetches post_sale_tasks for the listing, sums cost of all non-NA steps (Puspakom B5/B7 + JPJ + road tax etc.), deducts it from net P&L, and shows a "Handover processing" cost line. Matches the handover board's processing-cost total logic.

- [x] **NEW-6: Road tax & insurance renewal reminders** — DONE. `expiry-reminders` edge function deployed (v2, verify_jwt=false for cron). Checks all customers daily at 00:00 UTC (8am KL); fires dealer_notifications at 30-day and 7-day marks for road tax and insurance expiry. 24-hour dedup guard prevents repeat alerts.

#### TIER 3 — Stickiness + operations (medium value, lower complexity)

- [x] **NEW-7: Overdue handover step reminders** — DONE. Same `expiry-reminders` edge function also handles overdue post_sale_tasks: finds pending/in_progress steps where due_date < today, inserts dealer_notifications AND salesman_notifications (if lead has a salesman). 24-hour dedup. Cron runs daily 00:00 UTC.

- [ ] **NEW-8: Fix document email delivery** — BLOCKED ON USER ACTION. `send-document` edge function code is correct and complete. Edge function logs show zero calls to it — it has never been triggered. Root cause: `RESEND_API_KEY` is not set as a Supabase edge function secret. Fix: (1) Set secret in Supabase dashboard → Edge Functions → Secrets: `RESEND_API_KEY=<your key>` and `RESEND_FROM_EMAIL=noreply@xdrive.my`. (2) Verify `xdrive.my` as a sender domain in your Resend dashboard. Once secrets are set, the "Send to buyer" button on issued documents will work immediately.

- [x] **NEW-9: Service package tracking** — DONE. `service_packages` table created (dealer_id, customer_id, lead_id, package_name, total_visits, used_visits, valid_months, sold_price, sold_at, expires_at generated column). RLS policy attached. UI in CustomersTab: expand per customer to see packages with visit progress bars; "+ Pkg" inline form; "Log visit" button decrements remaining visits in real-time.

#### TIER 4 — High complexity, longer-term

- [ ] **NEW-10: Workshop module** — Full job card system: service job per vehicle, parts used, labor hours, technician assigned, cost vs. quote, completion status. Parts inventory per VIN/plate. Service history timeline. High build cost but transforms ShiftOS into a full aftersales DMS.

---

### DEALER SUBDOMAIN PERFORMANCE AUDIT (2026-06-07) — ranked by impact

- [x] **CRIT-0 (CRITICAL, FOUND MID-AUDIT — FIXED): Anonymous visitors got "This dealer page doesn't exist" on every subdomain** — root cause of the "very slow" perception: migration `rebuild_views_security_invoker` (2026-05-27) rebuilt `public_dealer_profiles` with `security_invoker = true`, subjecting it to `profiles` RLS. No RLS policy grants anon read on dealer profile rows (only own-profile/team/superadmin), so `useTenant()` resolved `tenant: null` for every logged-out visitor and HomePage.jsx:436 rendered the "dealer not found" page — a real customer-facing outage on every `*.xdrive.my` storefront for ~11 days (you didn't see it because superadmin's SELECT policy grants read on ALL profiles). DONE: added `get_dealer_profile_by_subdomain()` SECURITY DEFINER RPC (migration `add_get_dealer_profile_by_subdomain_rpc`, mirrors the existing `get_salesman_by_slug`/`get_dealer_profile_by_id` "Option B" pattern — narrow lookup by exact key, no broad anon SELECT policy reopened); switched `useTenant.js` to call the RPC instead of querying the view directly. Verified returns correct row as `anon` role.
- [x] **PERF-1 (CRITICAL): RLS policy bloat on car_listings/profiles** — DONE: RLS helper functions (`get_my_dealer_id`, `is_active_salesman`, `is_superadmin`, `is_platform_admin`, `get_my_role_and_dealership`) were `VOLATILE` despite being pure `auth.uid()`-keyed reads, preventing planner caching and forcing per-row re-evaluation. Migration `mark_rls_helper_functions_stable` marks them `STABLE` (confirmed remaining `VOLATILE`-named functions are real mutations and correctly left alone). Measured: dealer-scoped listings query went from ~70ms+ planning overhead to **2.88ms planning / 1.6ms execution**.
- [x] **PERF-2 (CRITICAL): Listings/hero queries wait on full tenant resolution** — DONE. Added `get_dealer_id_by_subdomain` SECURITY DEFINER RPC; HomePage fires it on mount into `fastDealerId` (HomePage:198-203) and the listings fetch gates on `fastDealerId` rather than the full tenant resolve (:250). HeroCarousel uses the same RPC.
- [x] **PERF-3 (HIGH): Triple-redundant dealer-profile fetch** — DONE. HomePage no longer does its own profile fetch; uses `tenant?.whatsapp_number` directly (HomePage:1508).
- [x] **PERF-4 (MEDIUM): Redundant per-row dealer join in listings query** — DONE. `useJoin = !dealerId || !tenant` skips the per-row dealer join on storefronts (every row is the same dealer, already in tenant) and only keeps it for the mixed-dealer marketplace (HomePage:256-262, :275 attaches tenant client-side).
- [x] **PERF-5 (LOW): Sold-count stat delayed by flat 800ms timer** — DONE. `Promise.all([load(), fetchSoldCount()])` fires both in parallel (HomePage:302); the 800ms timer is gone.

### DEALER SUBDOMAIN STOREFRONT REDESIGN (2026-06-14) — ref: dconcept.my

Audit summary: storefront is brochure-first not inventory-first; carries fake
stats (hardcoded 4.9 star / RM0 consultation), default testimonials, and a
ShiftOS "For Dealers" self-promo block rendered on the dealer's own customer
site; About (about_text) and logo (site_logo_url) are stored but never rendered;
no location/map/hours, no real reviews, no on-site finance/trade-in tools.

- [x] **SF-1: Car-card status banner** — DONE. `CarCard.jsx` (shared by marketplace +
  storefront) shows a "JUST ARRIVED" pill and a "RESERVED" corner banner driven by
  `status==='reserved'`. Detail-page status line not added (was optional).
- [x] **SF-2: Auto-reserve from lead lifecycle (public view)** — DONE. DB trigger
  auto-sets `car_listings.status='reserved'` when a lead with a linked car advances
  to `deposit_taken`; reverts to `available` on `lost`; never clobbers `sold`.
- [x] **SF-2b: Reserved-by attribution** — DONE. DB: `car_listings.reserved_by` (FK
  profiles) + `reserved_at`; `sync_car_reservation_on_lead_stage` trigger stamps
  `reserved_by=NEW.salesman_id` + `reserved_at=now()` on deposit_taken and clears both
  on lost/closed_lost; existing reserved cars backfilled. The public_car_listings VIEW
  was deliberately NOT changed — it is anon-readable, so exposing the name there would
  leak staff names to public visitors (violates the constraint). Name is shown only on
  authenticated surfaces: AnalyticsTab listings grid Reserved badge (desktop + mobile,
  mapped via salesmen list), LeadGridCard chip + LeadDrawer Car-of-Interest tag (dealer
  pipeline), Salesmanpanel lead card ("Reserved by you"). Trigger verified by test.
- [ ] **SF-3: Inventory-first storefront restructure** — PARTIAL. Already done: About
  text renders on storefront (HomePage:919-938), "For Dealers" self-promo gated to
  marketplace-only (:1326), 4.9-star fake stat removed, fake "RM 0 / Free Consultation"
  stat removed (stats strip now 2 real cells: In Stock + Cars Sold). Default testimonials no longer
  fall back on storefronts (subdomain shows real reviews or the section is hidden
  entirely). STILL OPEN:
  1. Add a real contact/location block (address, hours, map/click-to-call) — no
     such block exists today; render dealer logo (site_logo_url) in storefront header.
  2. (Optional) Google reviews integration — pull live reviews via Google Places
     API (needs Maps Platform API key + per-dealer place_id + edge-function proxy).
  3. (Optional) demote hero carousel + add on-page inventory search/filter; detail
     page can adopt dconcept.my framed gallery + status+code line + clean spec grid.

### DEALER DASHBOARD UX/BUG AUDIT (2026-06-07) — all DASH-1..9 shipped

Note: send-telegram, invites, ai-proxy and create-salesman edge functions have
the same `baggage`/`sentry-trace` CORS header fix applied in source (DASH-5) but
are NOT yet redeployed — only send-document was redeployed (the reported blocker).
Redeploy the other four when convenient to prevent the same Sentry preflight issue.

### INFRASTRUCTURE

- **INFRA-1: Supabase storage cleanup** — Storage is full. Audit bucket usage, delete orphaned images (listings that were deleted but images remain), consider image compression pipeline or CDN offload. (Requires manual review of what to delete — user decision needed.)

### FOLLOW-UP / MINOR

- **ENT-14: Document email delivery UI** — "Send to buyer" button on issued documents; sends HTML doc to buyer email via Supabase Edge Function / Resend. Blocked until ENT-15/NEW-8 is fixed.

---

## Done (reference)

- **PS-A: Post-sale handover board (Module A)** — post_sale_tasks table; Handover tab on dealer dashboard + salesman panel; Malaysian transfer checklist (loan settlement, insurance, Puspakom B5/B7, JPJ pindah milik, road tax, geran, handover) with per-step status/owner/cost/due date and processing-cost total.
- **FIX: Salesman pipeline pollution** — Add-to-deals now uses salesman_listings (many-to-many feature), no longer dumps fake "New prospect" leads into the dealer pipeline.
- **FIX: Lead attribution** — Dealer pipeline cards show "by {salesman}" via salesman_id join.
- **FIX: Null-phone crash** — formatWhatsAppURL guards null; all-tabs crash resolved.

- **SEC-1: 2FA / TOTP** — Supabase native MFA; enroll (QR+verify) in Settings, AAL2 challenge on password login, disable. (needs ACT-1 to function)
- **SEC-2: Permission matrix** — role_permissions table + RLS, usePermissions hook, Settings matrix; enforces view_commission + view_all_leads in Salesmanpanel.
- **SEC-2b: Extend permission matrix** — Added manager/admin to CONFIGURABLE_ROLES; view_cost, view_gross, export_data capabilities; StockTab columns and Analytics Export CSV gated.
- **SEC-3: Audit log hardening** — tightened activity_log INSERT RLS (no forged entries); logActivity wired into dealer_products/vendors/recon_jobs.
- **SEC-4: Log out all devices** — signOut({ scope: 'global' }) in Settings.
- **SEC-5: Telegram token write-only** — never prefilled/read back; only overwritten when a new value is typed.
- **SEC-5b: Telegram token server-side** — `send-telegram` edge function reads token from DB server-side; testTelegram in Settings now calls edge function instead of Telegram API directly.
- **SET-1: Editable WhatsApp templates** — per-dealer whatsapp_templates with {{placeholders}} + Settings editor.
- **SET-2: Add Lead IC/email/address** — buyer_ic/email/address on leads + AddLeadModal.
- **SET-3: Deal sheet branding** — logo + custom disclaimer + signature/deposit block on DealPage.
- **SET-4: Commission structure** — commission_config (percent_gross/percent_sale/flat) drives suggested commission in CarForm.
- **ENT-1: Stock — encumbrance + B5 tracking** — encumbrance_status (clear/under_hp/unknown) and puspakom_b5_date on stock_units; badge in StockTab/LeadDrawer; Handover Checklist generation blocked if encumbrance not cleared.
- **ENT-2: Document approval gate** — doc_status (draft → issued) on dealer_documents; manager/owner confirm before issuing; issued docs locked from editing.
- **ENT-3: Master audit log wiring** — logActivity wired to listing price edits, status changes, document create/delete/issue, stock cost edits, settings changes, commission approve/pay, vendors, recon jobs.
- **ENT-4: Buyer IC enforcement** — Buyer IC required before generating Sales Agreement or Deposit Receipt; inline validation error.
- **ENT-5: Listings filter panel** — Collapsible filter sidebar in ShowroomPage: price range, mileage, condition, transmission, state, year range, fuel type, colour. URL param persistence.
- **ENT-6: Analytics CSV export** — Export CSV button on Analytics tab, gated by export_data permission.
- **ENT-7: Settings change log** — Dealership name, subdomain, brand color changes logged to activity_log; last-changed-by + timestamp shown in Settings.
- **ENT-8: Stock movement log** — History timeline per stock unit from activity_log; "Edit Prices" button allows inline editing of purchase_price/recon_cost/asking_price; changes logged.
- **ENT-9: Commission approval workflow** — Approve payout + mark paid actions for manager/owner; logged to activity_log.
- **ENT-10: Listings expiry warnings** — Road tax expiry banners on listing cards (table + mobile) when within 30 days; red/orange/yellow colour coding.
- **ENT-11: HP Board approval status** — per-submission status (pending/approved/rejected/disbursed) in LeadDrawer HP section; sequential rejection with category + next-bank prompt.
- **ENT-12: Add form duplicate detection** — Warn on blur if VIN or plate number already exists when adding a new listing.
- **ENT-13: Team member inactivity flag** — "Inactive 30d+" badge on salesman tiles in TeamTab.
- **AUD-1: AVG Days in Stock fix** — daysInStock() falls back to purchase_date || created_at; avgDays computed over activeUnits.
- **AUD-2: Response time drill-down** — Per-salesman response time bar chart in RevOpsPage Revenue sub-tab using gm_salesman_scores RPC.
- **AUD-3: VIN / plate number in stock list** — plate_number shown as primary identifier badge in StockTab row.
- **AUD-4: Deposit / booking fee tracker** — Deposit amount, date, method, receipt no, balance due fields on leads; shown in LeadDrawer.
- **AUD-5: Appointment / viewing calendar** — Appointment creation (date/time, type, notes) in LeadDrawer; list of upcoming appointments per lead with cancel action; lead_id FK added to appointments table.
- **AUD-6: Stock → Listing auto-link** — listing_id auto-populated when stock unit is created with a matching listing.
- **AUD-7: Multi-bank parallel HP submission** — Multiple bank rows per lead in deal_financing; sequential rejection with category dropdown; attempt_number; "try next bank" prompt.
- **AUD-8: Full P&L per unit** — P&L modal in StockTab: purchase price + recon + deal products + HP commission + gross.
- **AUD-9: Recon job card system** — Recon jobs per stock unit with stages (todo/in_progress/done), vendor, cost, ETA, notes; inline in StockTab.
- **AUD-10: CSV stock import** — Working CSV parser (Papa Parse) behind Import CSV button; column mapping, preview, and insert.
- **AUD-11: Trade-in module** — trade_ins table linked to lead; trade-in form in LeadDrawer with plate, make/model/year, valuation, agreed price.
- **AUD-12: Vendor / supplier directory** — Vendors modal in StockTab with name, category, contact; linked to recon jobs.
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
