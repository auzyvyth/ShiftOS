# Dealer Dashboard — Marketing-Readiness Audit (2026-07-20)

Scope: the funnel a cold dealer prospect walks — landing page → onboarding →
trial/payment → first-run dashboard — plus tier enforcement consistency.
Verified against live DB (plan_config, profiles, storage) and deployed edge
functions, not just source.

## CRITICAL — fix before spending a single ringgit on dealer marketing

- [ ] **MKT-C1: Trial promise vs payment gate contradiction.** Every surface
  promises "14-day free trial · no credit card" (ShiftOSPage cards, PlanPicker,
  DealerOnboarding step copy "Your 14-day free trial starts immediately").
  Reality: `DealerOnboarding.submit()` sets `payment_status:'pending'`, and
  DashboardPage:10018 hard-gates any dealer with pending status behind the
  DuitNow QR screen until a superadmin manually marks payment received. A
  marketed dealer signs up expecting a free trial and hits a paywall + wait.
  DB already defaults `subscription_status='trial'` / `trial_ends_at=now()+14d`,
  and the "Your trial has ended" lockout (DashboardPage:10029) already enforces
  expiry — the machinery for a real trial EXISTS. FIX (recommended): stop
  setting `payment_status:'pending'` at dealer onboarding; let the trial run,
  show a countdown banner, and gate payment at trial end (reuse
  DealerPendingApproval as the expiry screen). Alternative (if cash-up-front
  is deliberate): remove every "free trial / no card" claim — currently it is
  false advertising, which will torch trust in a market that runs on referrals.

- [ ] **MKT-C2: Tier features are marketing fiction — only caps are real.**
  Growth is sold with "F&I add-on revenue tracking, Post-sale handover board,
  Priority support"; Pro with "Custom branding, Dedicated account manager".
  In code, the ONLY plan gate in the dealer dashboard is the AI chat at
  DashboardPage:3586 (`plan === 'dealer_pro'`). A Starter dealer gets F&I,
  handover, RevOps, outreach, AI manager — everything — at RM299. Either
  (a) reframe marketing honestly around caps (30/80/150 listings, 4/8/15
  seats) + the Pro AI chat, or (b) actually gate F&I + handover + AI manager
  to Growth+. (a) is a copy change; (b) is product work. Decide before
  dealers anchor on "everything for RM299".

## HIGH

- [ ] **MKT-H1: Junk plan value on the XDRIVE house dealer.** Profile
  1e7bf24e… has `role='dealer', plan='superadmin'` — not a plan_config key, so
  DB cap triggers treat it as unlimited while the UI's `getPlanConfig()` falls
  back to Dealer Starter labels/caps. Backfill to a real plan key (or
  `dealer_group`).

- [ ] **MKT-H2: Both demo dealers are locked out as expired.** "Fast" and
  "99test" (`subscription_status='expired'`, trials ended 2026-05-19) — if
  either is used for demos or screenshots, it renders the "trial has ended"
  wall. Extend via AdminPage or mark active.

- [ ] **MKT-H3: Signup email deliverability (carried from RF-C3/ACT list).**
  Default Supabase SMTP is rate-limited and not for production. Configure
  custom SMTP (Resend, verified xdrive.my sender) BEFORE driving signup
  volume, or confirmation emails will silently throttle.

- [ ] **MKT-H4: Landing page "See It In Action" still has 4 placeholder
  slots (PAGE-1).** Cold traffic converts on screenshots. Blocked on user
  assets: 4 PNGs (16:9) — P&L modal, owner dashboard, CRM pipeline, handover
  board.

## MEDIUM

- [ ] **MKT-M1: Storage headroom.** car-images: 652 files / 253 MB. Not full
  today, but no orphan-image cleanup exists (INFRA-1) and every new dealer
  adds ~0.4 MB/photo. Schedule orphan sweep + compression before scale.
- [ ] **MKT-M2: `send-telegram` edge function still carries the un-redeployed
  CORS fix (Sentry `baggage`/`sentry-trace` preflight). ai-proxy v13 is fixed;
  redeploy send-telegram when convenient.
- [ ] **MKT-M3: `dealer_group` has no self-serve path** (by design — "Talk to
  our team"). planConfig.js now includes it so the UI no longer falls back to
  Starter labels for Group accounts.

## Verified working (no action)

- New tier caps enforce correctly: `enforce_listing_cap` + `check_seat_cap`
  read plan_config live; NULL = unlimited; no existing dealer exceeds the new
  caps (max active listings on any account: 37, on an uncapped plan).
- Payment approval loop: AdminPage "Mark Paid" → `payment_status='received'`
  → realtime auto-forward on the pending screen. Works for both dealers and
  solo premium salesmen.
- Trial expiry lockout works (useSubscription → expired → upgrade wall).
- First-run onboarding checklist banner exists for new dealers
  (`onboarding_complete === false` → guided banner with storefront link).
- ai-proxy quota: shared 400/day per dealership pool, feature keys pinned
  server-side; `tiktok_studio` registered in lib/aiGuard.js (Vercel
  /api/ai-messages path) — dealer roles pass.
