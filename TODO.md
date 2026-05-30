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

## Code — in progress / next up

### 1. Customer remarketing — Phase 2
**Priority: medium**
- Phase 1 (customer records + expiry tracking) is done.
- Phase 2: WhatsApp blast to customers whose road tax / insurance expires in the next 30 days.
- Needs a "Send reminder" flow in the Customers tab that pre-fills a WA message template.

### 2. Multi-branch support
**Priority: low — architectural**
- Currently single-dealer tenancy per subdomain.
- Dealer groups with multiple outlets need one login, branch-level P&L separation, and cross-branch stock visibility.

---

## Verify / QA

### V1. `invites` edge function — non-salesman roles
Confirm that manager / accountant / fi_officer / admin creation via the `invites` Edge Function
actually creates a Supabase auth user (not just inserts a profile row).
If it only inserts a profile row those users cannot log in.

### V2. Commission realtime subscription scope
TeamTab has a realtime channel on `car_listings` for the team sold count.
Now that per-salesman sold counts are fetched client-side on mount,
confirm that updates (new sold listings) also trigger `fetchSoldPerSalesman` re-run.
Currently the realtime handler only calls `fetchSold` (team count) — wire it to `fetchSoldPerSalesman` too.

---

## Done (reference)

- Analytics RPC migration — Salesmanpanel + DashboardPage (rawEvents removed, 3 RPCs deployed)
- React.memo on CarCard + CarCardMarket (marketplace perf)
- Self-booking prevention on CarDetailPage
- Brand strip layout fix (vertical stacking bug — width:auto)
- Brand strip / cards horizontal alignment fix (padding moved to inner div)
- Real brand SVGs: Kia, Audi, Subaru, Volkswagen (simple-icons)
- Team tab leaderboard (gold/silver/bronze ranks, sold count + commission per salesman)
- Per-salesman Sales stat tile (was showing team total for every member)
- Customer records (Phase 1) — `customers` table, DB trigger on lead won, Customers tab in Dashboard + ManagerPanel with expiry colour-coding and inline edit
- Manager approval workflow — all salesmen require approval, manager RPCs, Approvals tab in ManagerPanel, rejection reason shown to salesman
- Deal presentation screen — shareable token page (/deal/:token), 1h expiry, PDF download, LeadDrawer integration
- Accountant payroll payout — Commissions → Ledger sub-tab: per-deal commission due, mark-as-paid checkbox, unpaid total
- F&I module — full FIPanel rewrite: Deals tab with per-deal product lines + F&I gross, HP submissions per deal, Calculator
- HP loan tracking — deal_financing table, EIR instalment (HPAA 2026 compliant), HPBoard component, HP Board tab in DashboardPage
