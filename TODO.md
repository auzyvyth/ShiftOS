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

### 1. Accountant payroll payout view
**Priority: high**
- AccountantPanel has P&L but no "run payroll" screen.
- Need: per-salesman breakdown of deals closed this month, commission owed, one-click "mark as paid" that stamps a payout record.
- Tables involved: `car_listings` (assigned_to, commission_amount, sold_at), new `commission_payouts` table.

### 2. F&I module — deal gross + menu selling
**Priority: high**
- FIPanel is ~575 lines and thin.
- Need: menu selling UI (present up to 4 products per deal to customer), per-deal F&I gross tracking, F&I officer commission report.
- Tables involved: `deal_products`, `dealer_products`.

### 3. Hire-purchase / loan tracking per deal
**Priority: high — biggest pain point for MY dealers**
- No HP data anywhere in the app.
- Need: bank name, loan amount, interest rate, tenure, monthly instalment, submission status (pending / approved / rejected / disbursed).
- Suggest new table: `deal_financing (id, lead_id, listing_id, dealer_id, bank_name, loan_amount, rate, tenure, status, approved_at)`.

### 4. Customer record + remarketing
**Priority: medium**
- Once a car is sold the customer disappears.
- Need: customer card linked to the sold lead (name, contact, purchase date, car bought).
- Phase 2: WhatsApp blast to customers whose road tax / insurance expires in the next 30 days.

### 5. Manager approval workflow UI
**Priority: medium**
- Migration for listing approval exists but ManagerPanel has no visible approve / reject queue.
- Salesmen should be able to "submit for approval"; managers see a pending queue and can approve or send back with a note.

### 6. Multi-branch support
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

## Done this session (reference)
- Analytics RPC migration — Salesmanpanel + DashboardPage (rawEvents removed, 3 RPCs deployed)
- React.memo on CarCard + CarCardMarket (marketplace perf)
- Self-booking prevention on CarDetailPage
- Brand strip layout fix (vertical stacking bug — width:auto)
- Brand strip / cards horizontal alignment fix (padding moved to inner div)
- Real brand SVGs: Kia, Audi, Subaru, Volkswagen (simple-icons)
- Team tab leaderboard (gold/silver/bronze ranks, sold count + commission per salesman)
- Per-salesman Sales stat tile (was showing team total for every member)
