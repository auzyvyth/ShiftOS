# ShiftOS — Pending Tasks

## User-action required (blocked on user)

### A. Vercel env var
Add `VITE_SUPABASE_ANON_KEY` to Vercel project env vars in the Vercel dashboard.
Once done, remove the hardcoded fallback key from `src/lib/supabaseClient.js`.

### B. Lexus logo
Real Lexus SVG is not available in simple-icons or any accessible npm package.
User must manually source the official SVG and drop it into `/public/brands/lexus.svg`.
Current file is a geometric approximation (L inside oval).

---

## Priority 1 — Enterprise HP Workflow (remaining gaps)

### HP-1. Bank scorecard — surface in FIPanel
Scorecard logic already exists in HPBoard. Missing: embed it as a sub-tab or section
inside FIPanel so F&I officers see approval rate %, avg days to decision, and
rejection breakdown per bank without leaving the FI panel.

### HP-2. Sequential multi-bank queue with CCRIS warning
CCRIS warning alert and queue_order tracking exist. Missing:
- `attempt_number` column on `deal_financing`
- "Try next bank?" prompt after a rejection (dropdown pre-filled with remaining banks)
- CCRIS counter: warn at 3 cumulative submissions across all deals for the same buyer
- Full bank attempt history visible in LeadDrawer and FIPanel

### HP-6. HP document checklist — remaining gaps
Checkbox checklist per deal exists (8 docs). Missing:
- Employment type field on deal_financing auto-selects the checklist template
  (employed: payslips; self-employed: bank statements + SSM + tax returns)
- Incomplete checklist blocks the "Submit to Bank" button with a warning

---

## Priority 3 — Monetisation Infrastructure (needed before billing)

### BILLING-1. Plan tier enforcement
- 6 tiers: Salesman Lite, Salesman Premium, Dealer Starter (≤20 listings), Dealer Growth (≤60), Dealer Pro (≤150), Dealer Group (unlimited + multi-branch)
- Add `plan_tier` column to `profiles`
- Enforce listing cap on car_listings insert (RPC or trigger)
- Enforce user seat cap on invites
- Show upgrade prompt when cap is hit

### BILLING-2. Usage tracking
- Track active listing count, seat count, monthly HP submissions per dealer
- Visible to superadmin in admin panel
- Basis for billing and upsell triggers

### BILLING-3. Multi-branch (Dealer Group tier only)
- Currently single-dealer tenancy per subdomain
- Dealer groups: one login, branch-level P&L separation, cross-branch stock visibility
- Architectural change — scope carefully before starting

---

## Priority 4 — Role completeness QA (must work before first paying customer)

### V1. `invites` edge function — non-salesman roles
Confirm that manager / accountant / fi_officer / admin creation via the `invites` Edge Function
actually creates a Supabase auth user (not just inserts a profile row).
If it only inserts a profile row those users cannot log in.

### V2. Commission realtime subscription scope
TeamTab realtime channel only calls `fetchSold` (team count).
Wire it to also call `fetchSoldPerSalesman` so per-salesman tiles update live.

### V3. Salesman Lite vs Premium feature gates
- Confirm which features are visible/hidden per salesman tier
- Lite: basic pipeline, lead stages, WA messaging
- Premium: deal sheet generator, HP submissions, financing calculator, customer records

---

## Priority 5 — CRM polish

### CRM-1. Customer remarketing — Phase 2
- WhatsApp blast to customers whose road tax / insurance expires in the next 30 days
- "Send reminder" flow in Customers tab that pre-fills WA message template

---

## Done (reference)

- **DESIGN-SYSTEM: Tokens replaced with user-specified lean definition** — `src/theme/tokens.js` now contains exactly the 5 color keys, border, radius, font, stageColors, activityDot specified. All UI primitives updated to inline removed constants.
- **DESIGN-SYSTEM (layer 1): Premium-light tokens + primitives** — `src/components/ui/*` primitives (Card, Button, Stat, Badge, SectionHeader, SubTabBar). Living style guide at `/style-guide`.
- **HP-3: PUSPAKOM B7 expiry tracking** — `puspakom_b7_date` on stock_units, expiry badge in LeadDrawer, "expired B7" and "missing B7" alerts in OversightTab.
- **HP-4: LOU tracking** — `lou_received_at`, `lou_expires_at` on deal_financing; "Log LOU Received" button; 14-day expiry with red/orange/green status; milestone shown in LeadDrawer.
- **HP-5: JPJ transfer tracking** — `jpj_status`, `jpj_submitted_at`, `jpj_completed_at` on leads; 3-state milestone (pending → submitted → completed); overdue detection (>7 days); full section in LeadDrawer.
- **HP-6 (partial): HP document checklist** — `hp_docs` JSONB on deal_financing; 8-doc checkbox checklist in LeadDrawer; docs completion counter. (Employment type template + submission blocking still pending above.)
- **HP-1 (partial): Bank scorecard** — `bank_name`, `rejection_reason_category`, approval rate %, avg days to decision in HPBoard. (FIPanel surface still pending above.)
- **HP-2 (partial): CCRIS warning** — warning alert when rejection_reason_category === 'ccris_issue'; queue_order on insert. (Sequential prompt + attempt_number still pending above.)
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
