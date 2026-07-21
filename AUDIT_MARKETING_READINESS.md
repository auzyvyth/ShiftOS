# Dealer Dashboard — Marketing-Readiness Audit (2026-07-20)

Scope: the funnel a cold dealer prospect walks — landing page → onboarding →
trial/payment → first-run dashboard — plus tier enforcement consistency.
Verified against live DB (plan_config, profiles, storage) and deployed edge
functions, not just source.

## CRITICAL — fix before spending a single ringgit on dealer marketing

- [x] **MKT-C1: Trial promise vs payment gate contradiction.** — FIXED
  (2026-07-21). The enforcer was the DB, not the frontend: migration
  `trial_first_dealer_signup` rewrites `prevent_profile_privilege_escalation`
  so the forced `payment_status='pending'` applies ONLY to solo Salesman
  Premium (its sole access control, PAY-1 preserved); dealers now run on the
  trial machinery the same trigger already enforces. DealerOnboarding no
  longer sets pending and forwards straight to the dashboard; a trial
  countdown banner (amber, red at <=3 days) shows days left; the expired
  gate now renders DealerPendingApproval in a new "expired" variant (QR +
  data-is-safe copy) and auto-forwards when subscription_status flips
  active; AdminPage "Mark Payment Received" now also sets
  subscription_status='active' so one click fully activates. Original
  finding below for reference: Every surface
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

- [x] **MKT-C2: Tier features are marketing fiction — only caps are real.**
  — FIXED (2026-07-21) via option (a), honest reframe: Growth/Pro feature
  lists on PlanPickerModal, DealerOnboarding, en.json and ms.json now sell
  caps + service level (priority support, assisted onboarding, dedicated AM)
  plus the one genuinely gated feature (AI Sales Manager chat, Pro). No
  module is claimed as tier-exclusive anymore. Original finding:
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

- [x] **MKT-H1: RESOLVED AS BY-DESIGN.** The XDRIVE row is deliberately
  pinned to `plan='superadmin'` by `trg_protect_superadmin_always_active`
  (an UPDATE attempt is silently reverted). DB caps treat it as unlimited;
  the Starter-label UI fallback affects only the house account's own
  cosmetics. No action. Original finding: Profile
  1e7bf24e… has `role='dealer', plan='superadmin'` — not a plan_config key, so
  DB cap triggers treat it as unlimited while the UI's `getPlanConfig()` falls
  back to Dealer Starter labels/caps. Backfill to a real plan key (or
  `dealer_group`).

- [x] **MKT-H2: FIXED (2026-07-21).** "Fast" and "99test" set to
  `subscription_status='active'` — demo-safe. Original finding: "Fast" and
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
- [ ] **MKT-M2: `send-telegram` redeploy SKIPPED deliberately (2026-07-21).**
  The local source has the CORS fix but NO platform-bot fallback, while
  TODO ACT-3 describes the deployed version as having one — the deployed
  code could not be verified this session, and deploying local source
  blindly risks regressing that fallback. Reconcile the two sources first,
  then redeploy.
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
