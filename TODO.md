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

## Priority 1 — Enterprise HP Workflow (closes the biggest dealer pain)

### HP-1. Bank performance scorecard
The single most valuable GM/owner insight tool missing from the platform.
- Add `bank_name`, `rejection_reason_category` (dropdown: DSR / CCRIS / valuation gap / employment type / vehicle age / margin), `days_to_decision` (auto from submitted_at → status change) to `deal_financing`
- Build bank scorecard view in FIPanel + DashboardPage: approval rate %, avg days to decision, rejection breakdown by reason, per-bank table sortable by approval rate
- This is the data model that enables a future bank recommendation engine

### HP-2. Sequential multi-bank queue with CCRIS warning
- When a submission is rejected, prompt "Try next bank?" with a dropdown + CCRIS counter (warn at 3 submissions: "further applications will damage buyer's credit score")
- Store submission sequence order on `deal_financing` (attempt_number column)
- Show full bank attempt history per deal in LeadDrawer and FIPanel

### HP-3. PUSPAKOM B7 expiry tracking
- Add `puspakom_b7_date` and `puspakom_b7_expiry` (auto = b7_date + 60 days) to `leads` or `deal_financing`
- Show expiry badge in LeadDrawer (green / yellow <14 days / red expired)
- Alert in manager dashboard for deals with B7 expiring within 7 days

### HP-4. LOU (Letter of Offer) tracking
- Add `lou_issued_at`, `lou_signed_at`, `lou_document_url` to `deal_financing`
- Stage milestone: Approved → LOU Issued → LOU Signed → JPJ → Disbursed
- LeadDrawer HP section shows which milestone the deal is at

### HP-5. JPJ transfer tracking
- Add `jpj_submitted_at`, `jpj_completed_at`, `jpj_notes` to `deal_financing` or a separate `deal_jpj` table
- Visible in LeadDrawer and FIPanel deal view
- Disbursement gate: JPJ completed triggers disbursement-ready status

### HP-6. HP document checklist per deal
- Checklist tied to `deal_financing`: IC copy, payslips (x3), EPF statement, bank statements (x6 for self-employed), SSM cert, tax returns, booking receipt
- Employment type auto-selects checklist template (employed / self-employed / commission-based)
- Incomplete checklist blocks HP submission with warning

---

## Priority 2 — Owner / GM Oversight (what justifies the price)

### GM-1. Real-time owner P&L dashboard
- Today's gross: units sold today × avg gross per unit
- Month-to-date: units sold, gross profit, F&I gross, total revenue
- Cash flow view: disbursements expected this week (approved HP deals pending JPJ)
- Days-on-lot aging: stock older than 30 / 60 / 90 days with carrying cost estimate
- Accessible from DashboardPage owner home tab, not buried in analytics

### GM-2. Audit trail
- Log every status change across leads, deal_financing, car_listings with: who changed it, from/to value, timestamp
- New `activity_log` table: entity_type, entity_id, actor_id, field, old_value, new_value, created_at
- Viewable per-deal in LeadDrawer (timeline) and per-entity in admin panel
- Required for any compliance or dispute resolution claim

### GM-3. Salesman quality score
- Per-salesman metrics visible to owner/manager: submission rejection rate, avg doc completeness at submission, avg days from lead to won, close rate %
- Shown in TeamTab alongside existing leaderboard

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

- **AUDIT-FIX (C2): Auth token leakage hardened** — cross-subdomain session handoff now passes tokens in the URL hash fragment (never sent in Referer headers or server logs) instead of the query string; new `src/lib/authHandoff.js` helper, wired into LoginPage, AuthCallbackPage, useTenant, DashboardPage, Salesmanpanel, SalesmanLite, SalesmanPremium (also fixed premium leaving tokens uncleared in URL). Backward-compatible reader so in-flight redirects during deploy don't break. NOTE: full one-time-exchange-code flow still ideal long-term but needs cross-subdomain testing.
- **AUDIT-FIX (C5): Tenant spoofing closed** — `?tenant=` storefront override now gated to localhost/vercel preview only; ignored in production so nobody can serve a competitor's storefront under xdrive.my
- **AUDIT-FIX (H1): Managers/admins can access dashboard** — useRoleRedirect now accepts an array of allowed roles; DashboardPage allows dealer/superadmin/owner/manager/admin instead of redirecting managers to the stripped /manager route
- **AUDIT-FIX (M2): Category definitions unified** — serviceCategories.js is now the single source; DashboardPage PRODUCT_CATEGORIES and ServicesPage CATEGORIES derive from it (removed 3-way drift in labels/colors)
- **AUDIT-FIX (M5): Dealership name-change cap enforced server-side** — DB trigger `enforce_dealership_change_cap` owns the counter/timestamp and rejects changes past 2 (superadmin exempt); client can no longer bypass via direct API call
- **AUDIT-FIX: Stale lead logic (SalesmanPremium)** — same OR→AND fix applied to premium panel
- **AUDIT-FIX: callClaude → ai-proxy** — all premium AI features (captions, WA replies, lead scoring, followup suggestions) now route through the working Edge Function instead of direct Anthropic API (which had no key)
- **AUDIT-FIX: Analytics data scope** — removed dead `dealer_id.eq.${userId}` arm from salesman car fetch; only `assigned_to` filter used
- **AUDIT-FIX: Loan form data leak** — loanLeads now filtered by `salesman_id` so salesmen only see their own buyers' contacts
- **AUDIT-FIX: Duplicate leads on appointment** — `.is("dealer_id", null)` replaced with `.eq("dealer_id", profile.dealer_id)` so existing leads are found correctly
- **AUDIT-FIX: Stale lead logic** — changed OR to AND so a lead is only stale when follow_up is overdue AND no activity in 48h
- **AUDIT-FIX: Dashboard tab order** — reordered NAV to daily-workflow priority: Leads → Listings → Add → Stock → HP Board → Analytics → RevOps → Team → Customers → ...
- **AUDIT-FIX: ErrorBoundary on lazy tabs** — TabErrorBoundary class wraps all lazy-loaded dashboard tabs; errors show retry button instead of white screen

- Analytics RPC migration — Salesmanpanel + DashboardPage (rawEvents removed, 3 RPCs deployed)
- React.memo on CarCard + CarCardMarket (marketplace perf)
- Self-booking prevention on CarDetailPage
- Brand strip layout fix and horizontal alignment fix
- Real brand SVGs: Kia, Audi, Subaru, Volkswagen (simple-icons)
- Team tab leaderboard (gold/silver/bronze ranks, sold count + commission per salesman)
- Per-salesman Sales stat tile
- Customer records (Phase 1) — customers table, DB trigger on lead won, Customers tab + expiry colour-coding
- Manager approval workflow — RPCs, Approvals tab, rejection reason to salesman
- Deal presentation screen — shareable token, 7-day expiry, PDF, WA CTA
- Accountant payroll payout — Commissions Ledger sub-tab, mark-as-paid
- F&I module — FIPanel rewrite: Deals tab, HP submissions per deal, Calculator
- HP loan tracking — deal_financing table, EIR (HPAA 2026), HPBoard, HP Board tab
- Pipeline redesign — list view, stage stepper, instant stage changes
- Deal sheet v2 — inline HP/on-road calculator, road tax (JPJ formula), insurance (tariff + NCD + SST), buyer name + salesman in snapshot
