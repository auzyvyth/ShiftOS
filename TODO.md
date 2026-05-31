# ShiftOS — Pending Tasks

## Dev tasks

### Marketplace audit fixes

**High priority**
- **MKT-1: CarCard keyboard accessibility** — replace `<div onClick>` with `<article tabIndex={0} onKeyDown>` so listings are reachable by keyboard (WCAG 2.1 fail)
- **MKT-2: Search input label** — wrap HeroCarousel search input in `<label>` or add `aria-label`; same for any unlabelled inputs on MarketplacePage filters
- **MKT-3: focus-visible outlines** — add global `:focus-visible` outline (2px red) to all buttons, links, and interactive elements; currently invisible to keyboard users
- **MKT-4: Booking form labels** — CarDetailPage booking form uses placeholders only; add visible `<label>` elements for each field

**Medium priority**
- **MKT-5: HeroCarousel image mounting** — only mount active + next slide images in DOM; current opacity-toggle approach keeps all slides loaded (memory waste with 10+ slides)
- **MKT-6: Deduplicate font loading** — Outfit/DM Sans loaded in index.html AND injected again inside CarDetailPage and HomePage component stylesheets; remove in-component font imports
- **MKT-7: Add `font-display: swap`** — index.html Google Fonts link missing this param; causes FOIT on slow connections
- **MKT-8: Responsive image `sizes` attribute** — listing mosaic/grid images have no `sizes` attr; browser downloads full-size on mobile unnecessarily
- **MKT-9: Fix hardcoded canonical URL** — CarDetailPage uses `https://xdrive.my` hardcoded in canonical and OG url tags; should use `window.location.origin` or a dynamic base

**Low priority**
- **MKT-10: Nav link color contrast** — Header nav links use `rgba(140,140,150,0.85)` on dark background; borderline WCAG AA; nudge opacity up
- **MKT-11: Language toggle aria-labels** — EN/BM buttons in Header have no aria-label or title attribute
- **MKT-12: Fallback image alt text** — CarDetailPage fallback/error image renders with empty alt; add descriptive alt

---

## User-action required (blocked on user)

### B. Lexus logo
Real Lexus SVG is not available in simple-icons or any accessible npm package.
User must manually source the official SVG and drop it into `/public/brands/lexus.svg`.
Current file is a geometric approximation (L inside oval).

---

---

---

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
