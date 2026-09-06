# ShiftOS — Pending Tasks

> **BRANCH IN FLIGHT — `claude/marketplace-hero-styling-160xcm` @ `90a68a8`,
> 9 commits ahead of `origin/main`, NOT merged, NOT on staging, NEVER BUILT.**
> It rewrites the marketplace hero across `MarketplacePage.jsx`,
> `MarketplaceHeader.jsx`, `SearchAutocomplete.jsx` and `DESIGN.md`. `npm install`
> failed in that container (proxy 403 on the xlsx CDN pin) so `npm run build` and
> `npm run lint` never ran — treat the whole branch as unverified. Its open items
> are HERO-1..5, written in that branch's OWN `TODO.md` — read them with
> `git show origin/claude/marketplace-hero-styling-160xcm:TODO.md`. They are
> deliberately not copied here: that branch edits this file too, so duplicating
> them would guarantee a merge conflict. Do NOT start new work over the same
> public files until it is staged, built and merged, or abandoned.
>
> `main` is at `25bcecf` (PR #360) and IS what production serves. Safe to branch
> from for anything that does not touch the marketplace hero.
>
> **Staging can be identical to prod and still look reviewed — check before you
> trust it.** PR #359 was asked for on the basis that "staging had been
> reviewed". Staging was at `ed7069d`, the PRE-SQUASH head of PR #358, whose
> content was already on `main` under `2f6c0c3`: a content-diff of branch vs
> staging came back as nothing but deletions of the new work, i.e. staging held
> exactly what prod held and none of the six new commits. The review had been of
> the previous cycle. Staging was pushed for real and the deploy confirmed before
> the PR was opened. `git log` alone would not have caught this — the 11 commits
> "on staging but not on the branch" looked like unique work and were duplicates.
>
> **`main` was a month stale until today — know why, so it does not recur.**
> Production was being served by `a5e58b4`, a commit on
> `claude/listings-approval-popup-ck4403` (PR #347) that was **promoted to
> production inside the Vercel dashboard and never merged to `main`**. Meanwhile
> `origin/main` sat at `aadff43` from 2026-08-03. A session branched off
> `origin/main`, built against a month-old tree, and its push would have
> reverted the whole platform-console rewrite (-1352 lines) had it merged.
>
> `main` has since been force-updated to the live tree. Before that, `main`'s 50
> "unique" commits were verified BY CONTENT to already exist in `a5e58b4` under
> different hashes (xlsx CDN pin, #205 srcset, #206 IC hashing, #207 warranty
> field, #209 Salesman Premium) — squash drift, not lost work. The only files
> `main` had that prod lacked were `CarCardMarket.jsx`, `BrandStrip.jsx` and the
> shadcn toast trio: zero references in the live tree (toast was replaced by
> `sonner`), so superseded, not dropped. Old `main` is preserved at
> `backup/main-pre-reconcile-20260903` (`aadff43`) — delete once comfortable.
>
> **Rule that prevents a repeat: promoting a branch preview to production in
> Vercel does NOT update `main`.** Ship via `main` (Vercel's production branch)
> so the repo stays the source of truth. If you ever promote from the dashboard
> again, push that commit to `main` in the same sitting.
> And before building: confirm what prod actually serves (Vercel deployment
> with `target: production`), not just that `git status` says clean.

## JPJ registration data now refreshes itself — 2026-09-05

The Market Demand tab shipped reading four year-files that had been loaded BY
HAND on 2026-09-05 and that nothing was ever going to touch again. There is no
symptom when this goes stale: the numbers still render, they are just older
every month. Migration `20260905p`, cron jobids 14 and 15.

- **Two jobs, not one, because pg_net is asynchronous.** `net.http_get` returns a
  request id and the body lands in `net._http_response` later, so a fetch and its
  parse cannot share a transaction. `reg_refresh_start()` enqueues (Mon 02:00
  UTC), `reg_refresh_finish()` drains (02:20). A response that has not arrived
  yet is left pending rather than failed, for 30 minutes.
- **Weekly, not monthly.** data.gov.my republishes the whole year-file when it
  revises anything, so a weekly pull picks up corrections and not only the new
  month. One 28MB fetch (2026's file today; it grows all year).
- **Which years: the current one, plus the previous one during Jan-Mar.** That
  window covers both late revisions to the closed year and the 1 Jan rollover,
  when the new year's file may not exist yet.
- **The truncation guard is the important part.** `reg_load_response` DELETEs the
  whole year before inserting, so a half-received body would silently wipe most
  of it and leave a table that still looks plausible. A year-file only ever
  grows, so a body under 90% of the last good load's `total_bytes` is refused and
  logged `ok=false`. Proven live inside a rolled-back probe: a 1KB body returned
  "failed: body smaller than last good load" and left all 9,087 2026 rows intact.
- Full round trip run live before scheduling: 52,571 rows and 3,048,094
  registrations unchanged, 2026 rewritten cleanly, `ok=true`. Re-running is a
  no-op, which is what makes a weekly job safe.
- `reg_refresh_queue` has RLS on and deliberately NO policy — only the SECURITY
  DEFINER job touches it. All three functions are revoked from `public`, `anon`
  and `authenticated`; verified with `has_function_privilege`, not by reading the
  migration back.
- [ ] **JPJ-1: nothing alerts if the refresh fails.** A failed week writes
  `reg_ingest_log.ok = false` and stops there. `notify_ops()` already exists and
  is the one ops-alert entry point — call it from `reg_refresh_finish()` on a
  failure so a silently stale tab cannot last a month.

## AI proxy was never metered, and would 403 the moment credits are funded — 2026-09-05

> **DEPLOYED 2026-09-05** — `ai-proxy` v21 and `chat-assist` v2. Both were
> diffed against the deployed versions first (the repo was a strict superset:
> nothing existed only on Supabase), and each kept its own `verify_jwt`
> (ai-proxy false, chat-assist true). The DB half (`20260905m`) was already
> live. The repo/deployed gap for these two is now closed.

Found while triaging the SECURITY DEFINER grants. `ai-proxy` builds its client
as `createClient(url, anonKey)` and then passes the caller's token only to
`auth.getUser(token)` — which identifies the user but does NOT attach the token
to the client. Every query it makes therefore runs as the `anon` role. Proven
against the live DB inside a rolled-back DO block:

- The `profiles` read (`.eq('id', user.id).single()`) returns **0 rows** as anon
  — `profiles` has no anon SELECT policy — so `.single()` errors and the
  function returns **403 "profile not found"** before it ever reaches Anthropic.
  Every AI feature would fail this way. It is masked today only because
  `AI_FEATURES_ENABLED = false` (`src/utils/aiFeatureFlag.js`) while Anthropic
  credits are unfunded. **Flipping that flag would NOT have turned AI on** — it
  would have produced a 403 with no obvious cause.
- `record_ai_request` came back **`42501 permission denied for function`** as
  anon, and the code only `console.error`'d it and carried on. So the shared
  400/day per-dealer quota — the one control between a dealer and an unbounded
  Anthropic bill — has never been enforced, and the usage log has never been
  written. Evidence: `ai_request_log` has **0 rows, ever**; `ai_usage` has a
  single row from 2026-05-18, before this code path existed.

- [x] **AI-1: `ai-proxy` now uses a caller-scoped client**, the same shape
  `chat-assist` already had (`global.headers.Authorization`). RLS still applies
  to every read; the difference is that the reads run as the user instead of as
  anon. `anonClient` is kept for `auth.getUser()` only, which is its correct use.
- [x] **AI-2: a usage-record failure is now a refusal, not a warning.** Both
  `ai-proxy` and `chat-assist` return 500 "could not record AI usage" instead of
  proceeding unmetered. Deliberately fail-closed: on a paid API, an unrecorded
  request is worse than a refused one.
- [x] **AI-3: `record_ai_request` is scoped to the caller** (`20260905m`). It was
  callable by any signed-in account for any dealer id, so anyone could burn a
  competitor's daily pool to zero or poison their usage log. Guard mirrors
  ai-proxy's `resolveDealerId` exactly, which is what `get_my_dealer_id()`
  already computes; verified compatible with `chat-assist`, which resolves the
  dealer identically.
- [ ] **AI-4: verify end to end when credits are funded.** The deploy half is
  done (see above); what is left is to flip `AI_FEATURES_ENABLED`, then check
  `ai_request_log` grows by one row per request and that the 401st request in a
  day is refused. `ai_request_log` was still at 0 rows on 2026-09-05, which is
  expected while the flag is off — it is not proof the fix works. Until a row lands in
  that table, the quota is unproven — that is the lesson ACT-13 already taught
  (a config recorded as done is not done until data proves it fired).

## Caller-scoping sweep — 2026-09-05 (`authenticated` is not a boundary here)

Migration `20260905m`. Same family as the anon sweep below, one grant level up.
It matters because **anonymous sign-in gives guest buyers the `authenticated`
role**, so "authenticated only" protects nothing against the public on this
project — any visitor who opens a chat can call these.

- [x] **SEC-B1 (MED, was live): `get_plan_usage(p_dealer_id)` returned ANY
  dealer's commercial position** — plan, price, listing and seat caps, active
  listings, seat count, HP submissions MTD. No caller check at all. Now scoped
  to `auth.uid()` / `get_my_dealer_id()` / `is_superadmin()`; the one caller
  (`DashboardPage.jsx:1100`) already passes its own dealer id. Verified: own
  scope returns the full object, another dealer's raises `not authorized`.
- [x] **SEC-B2 (MED, was live): `get_dealer_slug_analytics(p_dealer_id, p_days)`
  returned ANY dealer's per-salesman link clicks and WhatsApp taps.** The same
  leak `get_car_analytics` had, one level up. Every caller
  (`PerformanceTab.jsx:167`, `DashboardPage.jsx:3080` and `:4309`) hands it the
  same `dealerId` it hands `get_dealer_car_analytics` on the adjacent line, and
  that function already enforced this exact guard — so the fix was compatible by
  construction. Verified: own dealer returns rows, another dealer returns none.
  The `p_days` default is 90 and was preserved; changing it would have silently
  shortened the dashboard's analytics window.
- [ ] **SEC-B3 (open, pre-existing, unrelated to the guard): `get_plan_usage`
  returns NULL for a profile whose `plan` has no `plan_config` row.** The live
  superadmin-owned dealer account has `plan = 'superadmin'`, which is not a
  plan, so the INNER JOIN drops the row and the settings card renders nothing.
  Residue of the C4 tiering split-brain. Either add the row or LEFT JOIN and
  render the caps as unlimited.
- [ ] **SEC-B4 (open): the remaining `authenticated` definer surface is not
  audited.** 169 functions; this pass read the ones that take an argument and
  do work while checking nothing. Not re-checked: `count_other_dealer_vin_plate`
  (count-only, but it is a VIN/plate existence oracle across dealers) and
  `redeem_invite` (the code is the credential, which is the accepted pattern).
  The buyer-admin pair (`admin_set_buyer_ban`, `admin_revoke_buyer_sessions`) was
  checked and is correct — both go through `_assert_buyer_action_allowed`, which
  requires superadmin, refuses self-targeting, and refuses a non-buyer target.

## Anon SECURITY DEFINER sweep — 2026-09-05 (two real holes closed)

Migration `20260905l_anon_definer_sweep`, applied to the live DB. The Supabase
advisor lists 127 SECURITY DEFINER functions `anon` may EXECUTE; most are
trigger functions (PostgREST never exposes those) or anon-facing by design.
Three took an argument, did real work, and checked nothing about the caller.
Each was confirmed live as `anon` inside a rolled-back DO block before the fix,
and re-probed after it.

- [x] **SEC-A1 (HIGH, was live): `login_throttle_clear(p_email)` reset ANY
  email's login lockout.** Body was one unconditional
  `delete from auth_login_throttle where email = $1`, EXECUTE granted to anon.
  The 3-strike lockout `login_throttle_fail` applies was therefore removable by
  anyone, for anyone, over the public REST endpoint — call it between password
  attempts and there is no throttle. Proven as anon: target's row went 1 -> 0.
  It now reads the caller's own email off `auth.users` via `auth.uid()` and
  clears only that row, so clearing is something you EARN by logging in rather
  than something you request by naming an email. `LoginPage.jsx:397` calls it
  right after a successful `signInWithPassword`, so a session exists by then —
  verified unbroken. Anon EXECUTE revoked. Degrades safely: with no session it
  no-ops, and `login_throttle_fail` already zeroes a counter after 15 quiet
  minutes, so a lingering row can never lock a real user out.
  Worth noting alongside ACT-6: leaked-password protection is off (Pro-only),
  so weak passwords are accepted — the throttle was the only brute-force
  control on that path.

- [x] **SEC-A2 (MED, was live): `get_car_analytics(uuid[])` leaked every
  seller's per-car numbers to anon.** It aggregated `analytics_events` for
  whatever car ids you handed it, with no ownership filter and no auth check.
  Car ids are public by design (straight off `public_car_listings`), so any
  visitor could pull views, enquiries and a 7-day series for every listing on
  the marketplace — one dealer's demand signal readable by their competitor.
  Proven as anon against 5 arbitrary public listings. It was also DEAD: the
  dashboard and salesman panel both use `get_dealer_car_analytics(p_dealer_id,
  p_days)`, which HAS the ownership check (`auth.uid() = dealer` or
  `get_my_dealer_id() = dealer` or `is_superadmin()`). Superseded predecessor
  left behind with the hole in it, zero `pg_depend` rows — dropped rather than
  patched, because a second analytics entry point is the exact drift this repo
  keeps getting bitten by.

- [x] **SEC-A3 (LOW): `cron_key_matches(p_key)` was an anon-callable oracle for
  the cron key.** Long random key so not practically guessable, but a
  yes/no oracle anyone can query at network speed should not exist. Its only
  caller (`notify-chat-unread`) runs on the service-role client, which bypasses
  grants — revoked from anon AND authenticated.

- [x] **SEC-A4: defence in depth on 11 admin/ops RPCs.** `admin_list_listing_
  reports`, `admin_resolve_listing_report`, `decide_kyc_verification`,
  `get_pending_kyc`, `get_error_logs`, `get_error_summary`,
  `get_landing_page_visits`, `get_marketplace_funnel`, `get_marketplace_top`,
  `get_platform_engagement`, `broadcast_notification`. All of them already
  raise unless `is_superadmin()`, so this changed the error and not the
  behaviour — but a grant nobody can justify is how the first two holes got
  here. `get_marketplace_stats` deliberately KEEPS anon (the marketplace header
  needs it). Verified with `has_function_privilege`, never by reading the
  migration back.

- [ ] **SEC-A5 (LOW, left open on purpose): the waitlist pair still runs as
  anon.** `waitlist_lookup(p_phone)` returns queue position + referral code for
  any phone (a membership/enumeration oracle), and `waitlist_credit_referrer
  (p_ref_code)` flips `founding_member` for a code. Neither can be revoked:
  `api/waitlist.js` is a public Vercel route that builds its client with the
  ANON key, so revoking breaks signup. Credit-referrer is weaker than it looks
  — it requires the code to already have >= 1 real referral, so it can only
  re-apply a promotion that was genuinely earned, and it is idempotent. Both
  sit behind the edge rate limit (3 req/IP/5min, `middleware.js`). Real fix is
  a service-role key for that route, which is a Vercel env change (user
  action); do that and revoke both.

- [ ] **SEC-A6 (open): 169 SECURITY DEFINER functions are executable by
  `authenticated`.** Not audited this session. It matters more than it sounds
  because a GUEST BUYER is `authenticated`, not `anon` — anonymous sign-in
  hands out the authenticated role. So "authenticated only" is not a real
  boundary against the public on this project, and any function relying on it
  needs an internal ownership check, the way `get_dealer_car_analytics` does.
  Same triage as this pass: ignore trigger functions, read the ones that take
  an argument and do work.

## Marketplace seller trust signals — 2026-09-03 (verified + sold count shipped)

`ShowroomCard` now shows the seller's sold count and an identity-verified tick,
both off `public_car_listings` (`seller_sold_count` added via
`seller_public_stats`; `dealer_is_verified` already existed and was unused).
Rationale: XDrive owns the CRM *and* the marketplace, so it can show seller
behaviour a pure marketplace cannot observe. That is the one differentiator
Mudah/Carlist cannot copy without building a CRM.

- [ ] **TRUST-1: nothing is verified yet, so the tick renders on zero cards.**
  `select count(*) from profiles where is_verified` = 0. The plumbing is live
  and correct; it lights up the moment KYC approvals start flowing through the
  platform console Review queue. Until someone is approved, the marketplace
  shows no verification at all. Start approving, or the badge is decoration.

- [ ] **TRUST-2: reply speed is NOT shipped, on purpose — the metric is wrong.**
  The obvious third signal ("replies in ~15 min") was built up to the point of
  checking the data and then dropped. `leads.first_response_at` is stamped by
  trigger `set_first_response_at` on any STAGE CHANGE off 'new', so it measures
  CRM hygiene, not replies: one seller's median "reply" is 69,275 minutes (48
  days — someone dragging a stale card), and a rep who answers on WhatsApp but
  never touches the stage scores nothing. Best seller answers 28% of leads
  inside an hour; no honest threshold gives anyone the badge. In-app chat is too
  thin to substitute (13 threads, 62 seller messages). To make it real, stamp a
  reply time from an ACTUAL outbound reply (`chat_messages` seller message, or
  the WhatsApp tap) rather than the stage change — then revisit. Do not publish
  a buyer-facing speed claim off the stage-change proxy.

- [x] **TRUST-3 — DONE 2026-09-04, and it was a live bug, not just drift.**
  The two client-side counts were ADDED together (`soldOwned + soldAssigned`),
  so every car where the seller is both owner and assignee counted twice —
  **14 of 26 sold cars live**. The mini page was claiming roughly double what
  the marketplace card showed for the same seller. `SalesmanProfilePage` now
  reads `seller_public_stats.sold_count`, the same source
  `public_car_listings.seller_sold_count` is built from, and that view does a
  `count(DISTINCT listing_id)` over the union so it cannot double-count.

## Listing reports + buyer accessibility — 2026-09-03 (SHIPPED, follow-ups open)

All of the below is LIVE on prod (`24486e8`). Follow-ups only.

- [ ] **A11Y-2: roll `useDialogA11y` out to the rest of the buyer overlays.**
  `src/hooks/useDialogA11y.js` (role=dialog + aria-modal, focus in/restore, Tab
  trap, Escape) is written and applied to `ReportListingButton` ONLY.
  `ContactGate`, `BuyerChat`/`ChatSheet` and the CarDetailPage photo lightbox
  still have none — a screen reader keeps reading the page behind them and Tab
  walks out. There are ~76 portalled overlays in total; do the buyer-facing
  ones, do NOT hand-roll per-overlay copies.
- [ ] **A11Y-3: dealer/salesman panels are unusable with a screen reader.**
  ~709 form controls, 3 real `<label htmlFor>`. Bulk in `DashboardPage.jsx`
  (152), `Salesmanpanel.jsx` (57), `LeadDrawer.jsx` (40), `CarForm.jsx` (36).
  Deliberately deferred — owner's call that a blind car seller is rare, buyers
  first. Note the codebase's image `alt` coverage is already 100% (116/116);
  an early audit claiming otherwise was a bad grep (single-line match on
  multi-line JSX tags) — do not redo that work.
- [ ] **A11Y-4: verify with a real screen reader.** Everything shipped is
  structurally correct but was never run through VoiceOver/NVDA. Check: skip
  link appears on first Tab, grid cards announce year+model+price, report sheet
  traps focus and Escape returns focus to the flag.
- [ ] **REPORT-2: is the report flag too quiet?** It moved off the photo (the
  sticky header's Heart/Compare/Share paint over that corner and
  `.cdp-mosaic-cell` is `overflow:hidden`, so it was clipped and buried) to the
  end of the price row beside `~RM x/mo`. It is now a bare `th.textMuted` flag
  at 26px. May be too faint to find on the light xdrive.my card.
- [ ] **OPS-1: `dealer_risk_snapshot` (designed, not built).** The admin console
  already has Errors/Activity/Posture/Alerts tabs, so signals are surfaced — but
  each queue is an island and the fraud signals in `AdminPage.jsx` (duplicate
  plate, shared phone across accounts, rejection count) are computed ad hoc on
  every page load, only for `pending_approval` listings, and thrown away.
  Proposal: nightly edge function writes one row per dealer
  (`dealer_id, computed_at, score, signals jsonb, top_reasons[]`) from data
  already collected, and calls `notify_ops()` only on a threshold cross.
  Must stay ADVISORY — it ranks the queue, it never auto-penalises, same rule
  as reports.

## Idle logout stopped stealing links + daily traffic numbers — 2026-09-04

### The compare link that went to a login page (real user, fixed)
A test user was away ~3 days, tapped a shared
`xdrive.my/compare?a=…&b=…` link and landed on a bare login page with the link
gone. Cause: `useIdleLogout` ended with
`window.location.href = '/login?timeout=1'`, fired from WHATEVER page the app
happened to mount on — and `/compare` is a PUBLIC route that renders perfectly
well signed out. `LoginPage` never read `?timeout=1` either, so there was no
explanation waiting at the other end.
- Signing out is now silent and **never navigates**. The reason is parked in
  `src/utils/authNotice.js` and read once by `LoginPage`, which says "You hadn't
  used ShiftOS for N days, so we signed you out to keep your account safe."
  `?timeout=1` is still honoured for tabs/bookmarks from before the change.
- The ONE exception is `pathNeedsSession()` — a page that cannot render without
  a session reloads so its own guard runs. Public pages are left alone.
- `SalesmanPremium` had no `SIGNED_OUT` listener (Lite has always had one), so
  an idle sign-out with the tab open left the panel mounted on a dead session:
  stale pipeline on screen, every write silently rejected. It has one now.

- **IDLE-1 — DONE. `IDLE_MS` is 30 days, and the number is not arbitrary.**
  24h was never a decision anyone made out loud. 30 days is NIST SP 800-63B's
  reauthentication reference for AAL1, which is precisely what ShiftOS is:
  password/Google sign-in, no MFA, no money moving through the app. Checked
  against live sessions when it changed: at 7 days, 3 of 22 would have been cut
  on the spot; at 30 days, none.
  **Also confirmed: `not_after` is NULL on all 22 live `auth.sessions` rows**,
  so Supabase has NO session time-box or inactivity timeout of its own — the
  client-side timer is the entire logout policy. Do not assume a server-side
  backstop exists.

- [ ] **IDLE-2: the actual big-league pattern is device visibility, not a
  shorter timer.** Google/Meta/Spotify never time out a session at all; they can
  afford that because you can see your signed-in devices, kill them from
  anywhere, and get told when a new one appears. We copied the convenient half
  (a long session) and none of the safety half, so IDLE_MS stays a backstop
  until these land. The plumbing already exists for both:
  - **Signed-in devices + "Sign out everywhere"** in Settings, both panels.
    `auth.sessions` carries `user_agent`, `ip`, `created_at`, `refreshed_at`.
    Needs a SECURITY DEFINER RPC to list (device + last-used only — NEVER the
    token, and truncate the IP) and one to revoke every session but the current.
    One live user currently holds **7 sessions** and has no way to see it.
  - **New-device sign-in push.** A `salesman_notifications` row IS a push
    (`trg_push_on_salesman_notification`), so this needs no edge function: fire
    on a session whose `user_agent` is new for that user. This single alert does
    more for a stolen account than any timeout value — it reaches the rep in
    seconds instead of waiting out a timer.
  Once both ship, IDLE_MS can go effectively permanent and we are running the
  big-league model rather than an imitation of it.

### Daily traffic numbers on the Premium dashboard
Owner's call, and the right one: no new section. The existing traffic strip and
My Performance rows keep their 30-day totals and gain a small green `+N` for
today beside each.
- **The reason this needed a migration at all:** `get_salesman_analytics`
  (d0..d6) and `get_salesman_minipage_daily` bucketed by ROLLING 24-HOUR
  WINDOWS anchored on `now()`, while the dashboard chart already labelled the
  last bucket "Today". At 9am, "Today" was counting from 9am YESTERDAY. Measured
  live on the busiest seller at the time of the fix: the honest KL-today figure
  was 2, the rolling window said 5. Migration `20260904f` rebuckets both by
  Malaysian calendar day (`Asia/Kuala_Lumpur`), signatures unchanged.
- Because d6 now genuinely IS today, the badges read a bucket the dashboard
  ALREADY loads — **no new RPC, no new query on the page**, and the chart and
  the badge cannot disagree because they are the same array.
- Badges show only when the number is above zero. A `+0` on every tile every
  morning teaches people to stop reading the row.
- Lite reads `get_salesman_analytics` too, so its chart was silently corrected
  by the same migration with no client change.

## SEC sweep #2 of Salesman Premium + Lite — 2026-09-04

Second pass over both panels. Four fixed and pushed; the DB and edge halves are
already LIVE (migration `20260904e`, send-telegram **v16**).

- **SEC-TG-RELAY (fixed + DEPLOYED, v16). The August fix scoped the BOT but not
  the DESTINATION, so this was still an open relay on the platform bot.**
  `send-telegram` took `channel_id` straight from the request body and never
  checked it belonged to the caller. Any account with no bot token of its own
  falls back to the platform bot (`TELEGRAM_BOT_TOKEN`) — which includes every
  solo salesman AND every anonymous guest buyer the chat flow creates. So any
  logged-in user could send arbitrary text to any Telegram chat id and have it
  arrive from the official XDrive bot: phishing our own sellers, from our own
  brand, with no rate limit. Now the destination must be one of the ids the
  caller already saved on a profile they own (`telegram_chat_id`, their own or
  their dealer's `telegram_channel_id`), else 403 `unknown_destination`; and
  `role='buyer'` is rejected outright. `DashboardPage.jsx:1369` had to change
  with it — it only persisted the channel id when a new BOT TOKEN was typed, so
  a dealer editing just the channel would now fail the test.
- **SEC-SENTRY-URL (fixed, not yet on prod).** PostgREST puts every filter in
  the query string, so `.eq("phone", phone)` (SalesmanPremium 1785/1941,
  SalesmanLite 1687/1741/2557/2745) produced `/rest/v1/leads?phone=60123456789`
  — a real buyer's number, in a URL Sentry records as an http breadcrumb and
  attaches to every error event it sends. `sendDefaultPii:false` and the replay
  masking do NOT cover breadcrumb URLs. `src/instrument.js` now scrubs PII query
  VALUES (phone/email/ic/name/address) out of breadcrumbs and span descriptions,
  keeping the key so the URL is still readable when debugging.
- **SEC-AI-NOTES (fixed, not yet on prod) — was open from the August sweep.**
  `notes` is free text a rep typed during a call and routinely holds a phone or
  an IC; it went to the AI in the clear, on all four prompts. New
  `src/utils/redactForAI.js` mirrors the DB's `redact_for_ai` (email, IC, any
  9+-digit run — a price like "45,000 - 50,000" survives, "0123456789" does
  not). `buyer_name` is dropped from lead scoring and from the follow-up
  suggestion; it is kept ONLY in the WhatsApp draft prompt, which has to greet
  the buyer by name.
- **SEC-RESTORE (fixed + migration LIVE). A dead button that also broke the
  PDPA purge.** SalesmanLite's "Reactivate" wrote `account_status`/`is_active`
  directly; `prevent_profile_privilege_escalation` reverts both, so the update
  "succeeded" with no error and the user stayed locked out — but `deleted_at`
  was NOT guarded and DID get cleared, and `purge-deleted-accounts` selects
  `deleted_at < cutoff`, which a NULL never matches. The account could then be
  neither restored nor purged: locked out forever, data kept forever. Now
  `restore_my_account()` checks the 30-day window server-side and opens a
  one-statement escape hatch (`app.allow_self_restore`, the same shape as
  `use_dealer_invite`'s `app.allow_tenant_move`). `deleted_at`, `suspended_at`
  and `suspension_reason` are all guarded now — a suspended seller could
  previously erase the reason shown to them in `SuspendedBanner`. Live check
  found 0 stranded rows, so nobody had pressed it yet.
- **SEC-INVITE-ORACLE (fixed, migration LIVE).** `redeem_invite(text)` was
  EXECUTE-able by `anon` — an unauthenticated oracle turning a guessed code into
  a dealer id, with no rate limit. Revoked from `public` AND `anon` (a revoke
  from anon alone no-ops when the grant is held by PUBLIC; a revoke from public
  alone misses Supabase's explicit default-privilege grant to anon — this one
  needed both). Zero invite rows existed, so there was no live exposure.

**Still open — next session:**
- **SEC-INVITE-ENTROPY.** `dealer_invites.code` generation was never reviewed;
  there are no rows to sample. Before the first invite is issued, confirm the
  code is long and random enough that the (now authenticated-only) redeem path
  cannot be brute-forced, and consider a per-caller attempt limit.
- **SEC-SUSPEND-GATE.** `SuspendedBanner` is an overlay, not a gate — the panel
  underneath has already mounted and fetched. It only ever exposes the
  suspended user's OWN data, so this is a product-integrity issue rather than a
  leak, but a suspended seller can still drive the app from the console.

**Checked and found SOUND this pass — do not re-audit without a reason:** every
realtime subscription in both panels is filtered to `salesman_id`/`dealer_id`
`=eq.<uid>`; no `dangerouslySetInnerHTML`, no `console.log`, `rel="noopener
noreferrer"` on every `target="_blank"`; profile saves use an explicit column
whitelist (no mass assignment); a linked salesman cannot UPDATE a dealer's
`car_listings` (no policy grants it), so the commission_amount writes are not
exploitable; the Lite -> Premium self-upgrade is already closed by
`isPremiumSalesman` (`src/utils/salesmanPlan.js`) requiring a column the user
cannot write; `panelCache.js` redaction and logout purge are correct; Sentry
session replay is fully masked.

## SEC sweep of Salesman Premium + Lite — 2026-08-30

Three findings fixed and pushed; the server half is already LIVE.

- **SEC-TG (fixed + DEPLOYED, v15).** `send-telegram` verified the caller's JWT
  but never checked the caller had any relationship to the `dealer_id` in the
  body, then used it to look up a bot token with the service-role key. Any
  authenticated user — including an anonymous guest buyer, since anonymous
  sign-in is on for chat — could send arbitrary Telegram messages through
  ANOTHER dealer's bot, and harvest the bot's `@username` off the `not_started`
  path by enumerating ids. Now derives the dealer scope from the caller's own
  profile instead of validating the supplied one, so no version of the call can
  get it wrong; a mismatched body `dealer_id` returns 403.
  Deployed as **v15**, `verify_jwt` still false (it does its own auth). Repo and
  deployed are byte-identical again — the drift trap is closed for this one.
- **SEC-CACHE (fixed, not yet on prod).** Premium wrote raw lead rows to
  localStorage and `LEAD_SELECT` is `*`, so buyer IC numbers and home addresses
  sat in plaintext on disk. Lite had redacted since forever — the helper was a
  local `const` in Lite, which is exactly why Premium never got it. Now one copy
  in `src/utils/panelCache.js`, imported by both.
- **SEC-LOGOUT (fixed, not yet on prod).** Neither panel cleared its cached
  listings/leads/enquiries/appointments on sign-out, so a shared phone kept the
  last rep's pipeline. `clearPanelDataCache()` runs on both logouts and on
  account deletion; non-PII prefs (goal, tour) deliberately survive.

**Still open from the sweep — next session should pick these up:**
- **SEC-AI-NOTES.** `SalesmanPremium.jsx:1234` sends raw lead `notes` and
  `buyer_name` to the AI for scoring. `phone` is already reduced to
  `"present"`/`"missing"`, so someone was thinking about this — `notes` is the
  remaining gap and is free text a rep typed, which can hold a phone or an IC.
  Suggested fix: run notes through the same redaction idea as `redact_for_ai`
  before they leave the browser.
- **SEC-AI-QUOTA — DONE 2026-09-04. It was NOT accounting-only, and the
  one-line fix as written would have made things worse.** Adding
  `feature: "lead_score"` moves the call from `general` (max_tokens 1024) to
  `lead_score` (512). The request was already over budget: every lead went in
  uncapped, each answer echoed a 36-char uuid plus a sentence of `reason`, and
  the busiest rep has 82 leads — roughly 3,700 tokens of reply. The response
  truncated, `JSON.parse` threw, and `catch { /* silent */ }` swallowed it, so
  **AI lead scoring silently rendered nothing for the only two reps with enough
  leads to need it.** Fixed together: score the 40 most recently touched leads,
  answer by index instead of uuid, and drop `reason` (it was stored on every
  score and rendered nowhere). Now roughly 400 tokens against 512.

**Checked and found SOUND — do not re-audit these without a reason:** all four
`get_salesman_*` analytics RPCs embed an ownership predicate; `leads` RLS
requires `salesman_id = auth.uid()` with a matching WITH CHECK (so the id-only
lead updates in both panels are NOT exploitable — missing belt-and-braces, not a
hole); `ai-proxy` pins model/max_tokens server-side and enforces a shared daily
quota; `set_my_ic` hashes with a per-user salt and nulls the plaintext. No XSS
sinks, no raw `chat_messages` read, no secrets in either bundle.

## 💡 Ideas (unrefined — capture only, not scheduled)

Raw ideas as they come up in conversation, so none get lost. Not vetted,
not scoped, not prioritized — just parked here until picked up on purpose.

- **IDEA-1: Regional bump (paid visibility, by state/region)** — instead of a
  flat "bump my listing" button, let a salesman/dealer see (from their own
  dashboard analytics) which state/region is sending them the most views,
  and pay to bump specifically for that region — more eyes where the buyers
  already are → better CVR. Should support picking multiple regions.
  Needs real design work (pricing, how "region" is inferred per viewer,
  UI). BLOCKED on scale: owner's read is that bumping needs a real
  inventory base (~1k+ listings) before the infra is worth building — the
  marketplace doesn't have that yet, so this stays an idea, not a build.
  (Came up 2026-08-19 while fixing the /for-salesmen comparison copy —
  the old copy wrongly implied Mudah/Carlist charge "per listing"; the
  real model is per-bump, which is what sparked this.)

- **IDEA-2: True WhatsApp Business API integration — in-app inbox +
  reply-based lead scoring + AI that carries a conversation over days** —
  owner's framing (2026-08-23): stop competing on "content" (views/likes
  are vanity metrics — "fishing with a net that's broken," most viewers
  were never going to buy) and instead give sellers real buyer-intent
  data. Three asks, all blocked on the same root cause:
  1. **In-app chat, not deep-links.** Technically possible via the
     WhatsApp Business Platform (Cloud API) — a real product, not what
     `wa.me` deep-links do today throughout `SalesmanPremium.jsx` /
     `SalesmanLite.jsx`. Needs Meta Business verification, a WhatsApp
     Business Account, and approved message templates for anything sent
     outside a 24h customer-service window; billed per conversation. The
     approval/verification process is the real cost here, not the code.
  2. **Auto lead-scoring by reply rate.** Impossible today — WhatsApp
     opens outside ShiftOS and nothing comes back in, so the app never
     sees whether a lead replied. Only becomes buildable once inbound
     messages land via a Business API webhook; reply-rate/response-time
     would then feed the existing AI scoring (`ai-proxy`, see
     `SalesmanPremium.jsx:1024`).
  3. ~~AI that stays on-message for days, sending unsupervised.~~
     **SCRATCHED by owner 2026-08-23: "who would want to talk to an AI when
     buying a car, they need trust."** Correct call — a car is a high-trust,
     high-ticket purchase; a buyer who suspects they're texting a bot instead
     of a person stops trusting the thread, which kills the exact channel
     that closes deals. Not pursuing an AI that messages buyers unsupervised.
     What survives: AI drafts + times the nudge ("day 3, no reply, here's a
     suggested message"), a human still reviews and hits send — same pattern
     as the WA-reply drafting Premium already has
     (`SalesmanPremium.jsx:2008`). Keeps a real person on every message a
     buyer receives while still killing the "forgot to follow up" problem.
  Bigger vision behind this: move sellers past views/likes as their only
  signal — surface real intent (saved_cars, price_alerts, WA-tap-without-
  reply, repeat visits, photo/scroll engagement) the way AutoRaptor's
  equity-mining/lead-scoring does, but from XDrive's own buyer-behavior
  data. Not scoped — Meta Business verification is a real gate, not just
  a code change — needs its own design pass before it's a dev task.

- **IDEA-3: Dashboard AI copilot — one chatbot that knows the user's own
  data, for questions and small actions** — owner's framing (2026-08-29):
  a chatbot in the dashboard that "knows every data the user's got" so it
  can handle small things, instead of scattered one-off AI buttons. BLOCKED
  on AI tokens not being loaded yet (same root cause that just forced the
  three existing AI features — chat draft/ask, OutreachHub AI draft, AI
  Caption Writer — into "coming soon", see `src/utils/aiFeatureFlag.js`),
  and on cost/scope design before it's a dev task. Recommendation when this
  gets picked up: do NOT build a general chatbot with the whole DB dumped
  into its context — expensive per call, goes stale, and is a multi-tenancy
  risk if it ever reasons past what one dealer_id is allowed to see. Scope
  it instead as a natural-language front end over metrics ShiftOS ALREADY
  computes server-side and scopes correctly (`gm_pnl_snapshot`,
  `get_salesman_analytics`, the "This week" call list, `gm_salesman_scores`)
  — the AI calls those as tools, never queries raw tables itself, so it
  can't invent a number (same no-hallucinated-price/revenue rule as every
  other AI feature) and can't cross a tenant boundary. Start read-only
  ("how's my pipeline this week", "who have I been ignoring", "what's my
  GP this month") — no write actions in v1; a write path is a separate,
  much bigger trust design (undo, confirmation, audit trail) that
  shouldn't block shipping the Q&A layer. Reuse the existing
  `salesman_ai_quota_ok()` daily-cap pattern rather than inventing new
  metering, since at RM35/month the whole Premium tier price has to cover
  the Claude API cost per user.
  Second half of the ask (2026-08-29): it should also be a creative partner,
  not just a Q&A layer — listing copywriting and ad copy that's actually
  better than what a seller would write themselves. This one's a different
  shape from the metrics Q&A above: it needs the CAR's own data (brand,
  model, year, mileage, price, condition, included services), not the
  dealer's business metrics, so it's closer to the existing AI Caption
  Writer (`SalesmanPremium.jsx:2173`, currently "coming soon") than to
  `gm_pnl_snapshot` — likely the same feature, generalized: caption writer
  today only serves one preset shape (WA/TikTok/IG/FB caption); "creative
  partner" implies also full listing descriptions, and maybe critiquing an
  existing listing's photos/copy and suggesting what's weak about it. Scope
  later alongside the metrics copilot — same funding blocker, same
  per-listing quota pattern as `feature="caption"` already uses.

- **IDEA-6 - BUILT 2026-09-05: JPJ market demand (data.gov.my registrations)**
  Shipped as the **Market Demand** tab in the dealer dashboard's INVENTORY
  group (`src/components/MarketDemandTab.jsx`, wired in DashboardPage.jsx).
  Renumbered from IDEA-5, which was already taken by the /plans work.
  - **NO SECRETS anywhere.** data.gov.my needs no key, no auth, no
    registration. Nothing added to Vercel or Supabase env vars.
  - Ingestion is `pg_net` from the database itself - Supabase's network can
    reach data.gov.my even though the Claude web sandbox cannot. The whole
    50 MB CSV lands in ONE request, so no chunking. Two steps, two separate
    transactions (pg_net is async). Procedure: `tools/jpj/README.md`.
  - One rollup table `reg_car_month` (month, maker, maker_canon, model,
    model_key, colour, fuel, body_type, n) - deliberately ONE table, not the
    two originally planned, so no two rollups can disagree. `model_key` is a
    GENERATED column mirroring keyOf() in src/utils/modelKey.js.
  - Loaded 2023-2026(Jul): 3.05M registrations -> 52,571 rollup rows, zero
    malformed rows. Refresh monthly; data.gov.my runs ~1 month in arrears.
  - **NEW REGISTRATIONS ONLY, not ownership transfers** - but recon imports
    get a first plate, so they ARE here: Alphard 57k, Harrier 18.6k, Vellfire
    14.2k, Lexus RX 12.2k over 4 years. That is this platform's segment.
  - Still open: what share of a given model's rows are recon vs CBU. Needs a
    different signal - the source has no recon flag.
  - Known data gap, surfaced honestly in the UI: JPJ does not break out
    performance variants (a BMW M4 is counted inside "4 Series"), so those
    models get a "not tracked separately" note rather than a zero.
  - `state` includes "Rakan Niaga" (dealer stock, no real state) and it is a
    large share - excluded from everything; there is no state view yet.
  - NOT built, and deliberately: no price/valuation anywhere on this page.
    The source has no price column, so any figure would be invented.

- **IDEA-4: One account, one door — stop making people classify themselves
  at sign-in** — owner's framing (2026-08-30), triggered by a real new user:
  a friend was told to "log in as a buyer" and reported ending up in the Lite
  dashboard. Her row is a correct buyer (`role='buyer'`, no listings, no
  leads, nothing written), so no data was wrong — the confusion is the
  product's. Today sign-in asks people to pick a door BEFORE they are
  identified: the header dropdown offers `/buyer-login` and `/login`
  ("Access your dashboard"), and the main marketplace nav has a link
  literally labelled "Salesman Lite" (`MarketplaceHeader.jsx:290` →
  `/for-salesmen`). Nobody arriving thinks "I am a buyer account" — they
  think "that is my Google account" — and both doors run the same Google
  OAuth anyway, so the choice buys nothing and costs comprehension.
  Owner's deeper point: one email = one account = ONE role
  (`profiles.role` is a single column), so the two doors imply a
  buyer/seller split the data model does not actually have. The trap that
  follows: a buyer who later wants to sell has no upgrade path at all and
  would need a second email.
  Direction when picked up (not scoped yet): collapse to ONE sign-in, ask
  what someone wants to do only AFTER auth and only when the account has no
  role yet; and treat selling as a capability an existing account can gain,
  not a different identity requiring a different address. Note this is a
  product/UX change, distinct from the plain routing bug found at the same
  time (five hand-copied ROLE_ROUTES maps that drop `buyer`, so a buyer
  reaching `/salesman-lite` or `/salesman-premium` is sent to `/dashboard`,
  which has no role guard to bounce them back) — that bug should be fixed
  on its own regardless of whether this redesign happens.

- **IDEA-5 — BUILT 2026-08-30 (`/plans`, `src/pages/PlansPage.jsx`). One plan
  page for every seller tier, and deliberately NO buyer card on it** — owner's framing (2026-08-30), following the one-door sign-in
  work: a single "create an account" surface listing Salesman Lite (free),
  Salesman Premium (RM35), and the dealer tiers (RM299/599/1199/2999), replacing
  the scattered entry points (`/for-salesmen`, `/shiftos#pricing`, the Get
  Started dropdown, `/choose-plan`). Owner's open question was whether buyers
  should also pick a "buyer plan" there.
  Recommendation on that question: no. A plan is something you pay for or that
  caps what you can do, and buyers have neither a price nor a cap, so a "Buyer —
  Free" card next to Dealer Pro reframes browsing as a product tier and revives
  the same "which one am I?" question the merged sign-in door just removed. It
  also leaks the seller funnel: every visitor gets a legitimate reason to click
  the cheapest card and leave. Buyers should reach an account only through the
  thing they were already doing (save a car, message a seller), never a tier
  choice — the saved-cars hook already does the right shape here
  (`useSavedCars.js:10/17` works logged out in localStorage, then migrates the
  rows on sign-in at `:21-30`).
  Prerequisite, not optional: AUTH-1 below. This page is the surface that would
  turn the anonymous-session-becomes-a-seller hole into a routine occurrence.
  SHIPPED as described, buyer card excluded. `/signup`, `/register` and
  `/onboarding` now redirect here instead of straight into Salesman Lite signup
  (App.jsx), `/choose-plan` renders the same page, and the header's two-way
  "Get Started" dropdown collapsed into one link to it. Prices and caps are
  derived from `PLAN_CONFIG` via `src/utils/plans.js` rather than retyped, so
  what we show and what the caps enforce cannot drift. AUTH-1 was closed first,
  as required. Dealer Group (RM2999) is intentionally not listed — it has no
  onboarding route.

## CHAT-EMAIL — BUILT 2026-08-31 (see CLAUDE.md for the rules)

Shipped on `claude/buyer-notification-emails-n0yv8d`. Backend is LIVE on the
production Supabase project; the frontend is only on the branch.

Live already: `sync_identity_from_auth_user` (auth.users AFTER UPDATE),
`chat_after_message` email de-dup, `email_unsubscribe`, `cron_key_matches`,
`profiles.notify_email_opt_out` / `notify_unsub_token`,
`chat_threads.buyer_email_notified_at`, edge function `notify-chat-unread` v2,
cron jobid 13 (*/30). Existing unread threads were stamped as already-notified
so the first run cannot email anyone about days-old replies.

**BLOCKED ON TWO SUPABASE DASHBOARD SETTINGS — the capture flow cannot work
until these are done:**
1. Auth -> Email Templates -> "Change Email Address": the body must include
   `{{ .Token }}` (the 6-digit code). While it only carries a link, a buyer has
   no code to type — the prompt falls back to the cross-tab listener, which only
   works if they open the link in the same browser.
2. Auth -> Attack Protection -> turn on CAPTCHA (Turnstile). This is the guard
   against guest-account spam; per-user rate limits are defeated by rotating
   anonymous sign-ins, which cost a spammer nothing.

**Still open, deliberately not built:**
- **The collision case has no email channel.** A buyer whose address already has
  an account is declined (no merge, on purpose) and therefore gets no unread
  emails on that thread. The safe way to cover it is a one-time claim token
  minted in the anon session and redeemed after a real sign-in
  (`claim_guest_threads(token)`) — proof of both sides, no takeover surface.
  Only worth building if that case turns out to be common.
- **Per-dealer volume caps on threads/messages** in the shape of the existing
  40-chat-leads/hour guard. Per-uid caps do not hold against account rotation.
- **ACT-VERIFY-CHAT-EMAIL.** The send path is verified end to end for auth and
  query (cron key 200, wrong key 401, `{"sent":0}` with the backlog suppressed)
  but no email has actually been delivered yet — nothing qualified. Reply to a
  buyer thread, wait 30 min, confirm the email arrives and the unsubscribe link
  works.
- Never run `npm run build` expecting it to pass in a web session: this sandbox
  cannot `npm install` (the proxy blocks `cdn.sheetjs.com`, an `xlsx`
  dependency). Staging is the first real build.

## ⚠️ USER ACTION REQUIRED — remind every session until done

- **ACT-VERIFY-PUSH: confirm on a real phone that notifications now arrive
  immediately.** `send-push` v18 is deployed (2026-08-30) with `urgency: 'high'`
  and TTL capped at 24h. The server side was never the problem and was measured
  at 193ms; the fix is a request to FCM for immediate delivery, so ONLY a real
  device can confirm it. Send a chat message between two accounts and time it.
  If it is still slow, the next suspect is the device, not us: Android battery
  optimisation on the installed PWA, or notification permission granted but the
  app restricted in the background.
  Second thing to watch in the same pass: roughly a third of sends were failing
  (`{"sent":2,"failed":2}` in `net._http_response`) and the old code discarded
  the reason. v18 logs the status per endpoint, so the Supabase function logs
  will now say why. 13 subscriptions, all FCM.

> **ACT-DEPENDABOT DONE — all 5 alerts cleared 2026-08-30.** `npm audit` now reports
> 0 vulnerabilities. Two bumps in `package.json`: `pdfjs-dist` ^5.7.284 -> ^6.3.289
> (the only production-reachable one — arbitrary JS execution from a malicious PDF,
> GHSA-hq66-cqwq-w95j, live at `src/pages/ImportStockPage.jsx:4` where dealers upload
> supplier PDFs) and `vite` ^5.4.21 -> ^7.3.6 (clears the other 4: two vite path
> traversals, a Windows NTLM leak, and the transitive esbuild dev-server advisory —
> all dev-server only, none shipped to production).
> **Vite 7, not 8, on purpose.** `@vitejs/plugin-react@5.1.4` peer-supports vite only
> up to `^7.0.0`, and vite 8 drops its `esbuild` dependency for rolldown. Vite 7 clears
> every advisory (they all cap at `<=6.4.2`) with no plugin majors. `.nvmrc` is 20.19.1
> which satisfies vite 7's `^20.19.0` engine, so no Node bump was needed.
> The `cdn.sheetjs.com` 403 is a hard org egress policy denial, still unfixable from a
> web session — but it turned out NOT to block this work: `npm audit` talks only to the
> registry, and `npm install --package-lock-only` reuses the existing `xlsx` lock entry
> instead of refetching the tarball. That is the workaround for any future dep bump here.
> To actually build/test, `xlsx` was pointed at a throwaway local stub for the install
> only; `package.json` and the lock's `xlsx` entry were restored byte-identical before
> committing (verified — the lock diff does not touch xlsx).
> Verified: production build clean, eslint clean, 21 perf + 10 tour tests pass, and a
> runtime smoke test confirmed pdf.js v6 still honours every API `ImportStockPage` uses
> (getDocument/numPages/getPage/getTextContent/getAnnotations, `transform` row
> reconstruction and Drive link-annotation extraction).
> NOT verified from here: the import-stock flow in a real browser. Worth one manual pass
> with a real dealer PDF and an xlsx before trusting it, since the xlsx half of that page
> could not be exercised at all with the stub in place.

- **ACT-1: Enable TOTP in Supabase dashboard — DEFERRED until revenue (user: paid)** — 2FA (SEC-1) will not work end-to-end until the TOTP factor type is enabled: Supabase → Authentication → Settings → Multi-Factor → enable **TOTP**. Until then, the "Enable 2FA" button in Settings will error on enroll. Owner is deferring this until revenue/Supabase Pro (treats it as a paid feature — note: standard app-based TOTP MFA is typically free on Supabase; the paid MFA add-on is Phone/SMS, which we are avoiding anyway — worth re-checking billing before permanently shelving). Interim idea from owner: keep Gmail/Google link verification and add an email verification code as a lightweight second factor. NOTE (2026-08-05): TOTP is NOT deprecated — Bank Negara's RMiT (28 Nov 2025) bans **SMS OTP** as a standalone factor, not TOTP. TOTP (authenticator-app codes, RFC 6238) is offline/device-local and is one of the regulator's recommended interception-resistant replacements, so it stays the correct choice here. Do NOT enable Supabase's Phone/SMS OTP factor. Passkeys (FIDO2/WebAuthn) are the gold standard but are not a native Supabase MFA factor yet.
> **ACT-13 DONE — verified end to end 2026-08-29.** Anonymous sign-ins are on and guest
> chat works for the first time. It had been recorded as done on 2026-08-24 but the
> dashboard toggle was never SAVED, so `signInAnonymously()` was refused and every guest
> got the "Chat isn't available right now" screen — 0 anonymous users out of 23 across
> five days, and nobody noticed because the chat had never been exercised by a human.
> Proof it is fixed, read from the live database after the toggle was saved: 1 anonymous
> user, 1 anonymous thread ("Guest 8C37"), and the buyer's first message produced a real
> pipeline lead (`lead_source='chat'`, car linked, rep attributed).
> The safety guard is verified and must stay: `handle_new_user()` forces `role='buyer'`
> on any anonymous session, so a guest can never be created as a dealer.
> Lesson worth keeping: a config toggle recorded as done is not done until something in
> the data proves it fired.

- **ACT-2: Decide on full 2FA enforcement (SEC-1b)** — Client-side 2FA only challenges the password login path. Google OAuth and magic-link logins are NOT challenged. True enforcement across all auth methods needs RLS policies keyed on `aal2` so the database rejects aal1 sessions. Confirm if/when you want this hardening built.

- **ACT-4: Enable Google One Tap (`VITE_GOOGLE_CLIENT_ID`)** — The Google One Tap popup for new marketplace visitors (`src/components/GoogleOneTap.jsx`) is built but no-ops until the Google OAuth **Web client ID** is exposed to the frontend. Steps: (1) Vercel → env `VITE_GOOGLE_CLIENT_ID=<google web client id>` (same client used by Supabase's Google provider); (2) Google Cloud Console → that Web client → add `https://xdrive.my` (+ preview origin) to **Authorized JavaScript origins**; (3) Supabase → Auth → Providers → Google → add the same client ID under **Authorized Client IDs** so `signInWithIdToken` accepts the One Tap token. Until done, the popup simply never shows (no error).

- **ACT-6: Enable Leaked Password Protection — BLOCKED (needs Supabase Pro)** — Supabase → Authentication →
  Settings → Password → turn on **"Check against HaveIBeenPwned"**. Until then,
  signups/resets accept known-breached passwords. One toggle, no code. NOT DOABLE on the
  free tier — the HIBP check is a Pro-plan feature. DEFERRED until revenue starts and
  Supabase Pro is acquired; do not keep surfacing it as an actionable toggle until then.
  (Flagged by the onboarding security audit, 2026-07-20; marked blocked 2026-08-05.)

- **ACT-7 (optional): Migrate auth to PKCE flow** — the Supabase client currently
  uses the implicit flow (tokens land in the URL hash, which can leak via history/
  referrer). PKCE is best practice but switching `flowType` changes how the
  email-confirm and password-reset links are parsed (AuthConfirmPage/token_hash,
  ResetPasswordPage/`type=recovery`), so it needs its own tested pass — do NOT
  flip it blindly. Deferred from the audit to avoid regressing reset/confirm.

- **ACT-9 (dev-only): vite 5 -> 8 major upgrade** — vite `5.4.21` + its esbuild
  carry HIGH/MODERATE **dev-server** advisories (path traversal, dev-server CORS,
  Windows fs.deny bypass). Production is a static Vercel build, so it is NOT
  affected — the risk is only a developer running `npm run dev`. The fix is the
  breaking vite@8 major; do it as its own tested upgrade, not folded into a
  security push. (Audit follow-up, 2026-07-20.)

- **ACT-10: Add CAPTCHA (Cloudflare Turnstile) to public write forms** — F5 of the
  marketplace security review. The DB-side flood caps are in (create_lead_from_whatsapp
  per-dealer cap, car_hunts/leads/error_logs rate limits), but DB throttles keyed on a
  client-supplied identifier are bypassable — the real proof-of-human control is a
  CAPTCHA. Steps: (1) Cloudflare → Turnstile → create a widget, get the site key +
  secret; (2) Vercel env `VITE_TURNSTILE_SITE_KEY=<site key>`; (3) Supabase edge secret
  `TURNSTILE_SECRET=<secret>`; (4) render the Turnstile widget in ContactGate + the
  car-hunt/enquiry forms and pass the token to a small verify step (edge function or
  inline verify against siteverify) before create_lead_from_whatsapp / hunt insert.
  Until done, public lead/hunt writes rely on DB rate limits alone. (Audit F5, 2026-08-03.)

- ~~ACT-12: three values to set before push notifications can deliver~~ — **RESOLVED,
  verified live 2026-08-24.** Re-checked against the code per this file's own lesson
  (below) before re-nagging, instead of trusting the 2026-08-16 note. All three are done:
  1. VAPID_PRIVATE_KEY is valid — probed `send-push` directly (`net.http_post` from SQL) with
     no secret: got a clean `401 unauthorized`, not `vapid_misconfigured`. The function boots.
  2. PUSH_SHARED_SECRET matches Vault — same probe WITH `x-push-secret: get_push_secret()`:
     `200 {"sent":0}` (0 because the probe used a fake user id, not because it rejected).
  3. VITE_VAPID_PUBLIC_KEY is set on Vercel — inferred, not checked in the Vercel dashboard
     directly (no access from here): a real buyer subscription row exists dated today, and
     the frontend gates `subscribe()` on this env var being non-empty, so a subscription
     existing at all means it's set. `cron.job` id 7 (`appointment-reminder`, every 5 min)
     shows a REAL delivery today: `{"sent":1,"failed":0}` at 10:57 UTC. Push works end to end.
  If push ever looks dead again, verify like this before re-opening ACT-12 — don't take a
  stale TODO note's word for it.

> Reminder protocol: while ACT-2, ACT-4, ACT-9 or ACT-10 remain here, surface them at session start and whenever security/auth/import/dependency work is touched. (ACT-3, ACT-5 and NEW-8 completed 2026-08-05. **ACT-8 was found ALREADY COMPLETE and removed 2026-08-15** — `package.json` AND `package-lock.json` both resolve `xlsx` to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, and `vercel.json` CSP already whitelists `cdn.sheetjs.com` in connect-src; it had been sitting in this list as a blocked user-action for weeks after the fact. **ACT-12 verified RESOLVED 2026-08-24** — see entry above; drop from this nag list. ACT-1 and ACT-6 are deferred until revenue/Supabase Pro — do not nag until then.) LESSON: verify an ACT item against the code before re-surfacing it — a stale nag costs a session's attention every time.

## Dev tasks

---

### SESSION 2026-09-05 — CarDetailPage competitor audit (Mudah + Carlist), scoped

A competitor teardown of Mudah and Carlist was run against `CarDetailPage.jsx`
and produced six "priorities". Four of them are ALREADY BUILT, one reverses a
documented rule, and the colour half of it targets the wrong theme. Recorded
here so nobody re-runs the audit and re-opens the settled items.

**Already built — do NOT rebuild:**
- 1-big + 2x2 gallery with a "show all" overlay: `CarDetailPage.jsx:2211`
  (desktop 3-cell grid, primary spans both rows), thumbnail strip `:2337`,
  mobile swipeable panel `:2464`. Photo-count badge already on cards
  (`ShowroomCard.jsx:289`, `CarCard.jsx:481`).
- 6-8 spec icon grid with the long list hidden: `:2636` (mobile), `:3281`
  ("Quick stats grid — 8 cells"), tabs at `:3379`.
- 3-field cards on the similar/more-from-seller strips: `SellerStrip:900` is
  image + name + price at 152px, exactly what the audit recommends. The dense
  10-field card is the SEARCH card (`ShowroomCard.jsx`) and is correct there —
  the split by context is already right, do not flatten one into the other.
- Trust signals: `ReconTrust:270`, `WarrantyBanner:245`, `PriceIncludes:393`,
  `PuspakomDates:352`, `SellerRating:497`, plus `docs_verified` / `geran_status`
  / `condition_declared_at` / `auction_grade` in the public select `:1237`.

**Rejected — reverses RAPTOR-6:** a sticky bar with its own green WhatsApp
button. The car card is exactly two buttons (red "Book a Viewing" + neutral
"Contact") and every channel lives inside the `BuyerChat` sheet — see the
comment at `CarDetailPage.jsx:2676` and the rule in CLAUDE.md.
`StickyWhatsAppButton.jsx` exists and is deliberately NOT on this page (only
`CarListingPage.jsx:947`, `HomePage.jsx:1964`, `CalculatorPage.jsx:104`).
Making the EXISTING two-button card sticky on scroll breaks no rule and is
folded into CDP-3.

**Wrong theme:** the audit prescribes cream `#EDE4D3` on `#080C14`.
CarDetailPage on xdrive.my is LIGHT — `th` at `:933-946` is `pageBg #F6F7F9`,
`card #ffffff`, `text #0F172A`. The dark tokens apply only on dealer
subdomains. Its two real rules (green stays functional, red stays scarce) are
already how the code works (`#25D366` at `ShowroomCard.jsx:388`).

- [ ] **CDP-1 — package the trust signals into one named badge + a report.**
  The only item with real upside. XDrive already carries MORE signal than
  Carlist Qualified; what it lacks is Carlist's packaging — one badge a buyer
  recognises, backed by an inspection checklist and a downloadable report.
  Today the signals are scattered across five components and read as a sticker
  sheet rather than one claim. Name it **XDrive Verified** — XDrive is the
  marketplace, ShiftOS is the dealer product; the audit mixed the two up.
  Touches the DB (a report artifact needs somewhere to live), so it is its own
  session. Respect the anti-slop rule: one badge, not a sixth accent colour.

- [ ] **CDP-2 — decide the price hierarchy before building anything.**
  Carlist leads with monthly ("As Low As RM 778/mo") and shows total smaller
  underneath, with a Monthly/Total toggle on both search and detail. XDrive
  already renders the monthly figure, deliberately SECONDARY: `:2586` and
  `:4030` in `th.textMuted`, `ShowroomCard.jsx:377` on cards, and Sambung Bayar
  cars already lead with monthly (`SambungPriceBlock:201`). So this is not
  "add monthly" — it is inverting the hierarchy, and it is a product decision,
  not a design borrow.
  RECOMMENDATION ON RECORD (owner to overrule if they want): keep total
  primary, strengthen the monthly line typographically, no toggle. `calcMonthly`
  (`src/utils/financing.js`) derives that number from an assumed rate and
  tenure. Carlist can lead with a guessed instalment because it is lead-gen
  classifieds; XDrive's whole position is verified/inspected, and a headline
  number nobody can stand behind is the one thing that undercuts it — same
  logic as the no-invented-numbers rule in CLAUDE.md.

- [ ] **CDP-3 — price overlaid on the hero image + sticky mobile CTA card.**
  The one genuinely new layout idea in the audit: Carlist puts the price
  bottom-left ON the hero photo, the most-looked-at pixel. Small change at the
  gallery in `CarDetailPage.jsx:2211` / `:2464`. Bundle with making the
  existing M4 CTA card (`:2666`) sticky on mobile scroll — same two buttons,
  no new CTA. Verify at 375px.

- [ ] **CDP-4 — token drift: CarDetailPage light `pageBg` is `#F6F7F9`,
  DESIGN.md says `#F7F6F2`.** `CarDetailPage.jsx:934` against DESIGN.md's
  Color section. The audit surfaced this by accident. Cheap fix, but check the
  rest of the `th` block against DESIGN.md in the same pass rather than fixing
  one value — `card2`, `text`, `textSec`, `border` all look locally invented
  too (`#EEF1F5` / `#0F172A` / `#475569` vs DESIGN.md's `#F0EEE8` / `#111827`
  / `#4b5563`). Decide which file is the source of truth and make the other
  match; do not leave two palettes.

**Sequencing:** four separate sessions — one concern each, per the prompt
discipline rule. CDP-2 is a decision before it is a build. Nothing here should
start while the hero branch below is still unbuilt and unmerged.

---

### SESSION 2026-08-31 — pre-launch security sweep (Salesman Lite + marketplace)

Six fixes shipped this session (see commit "Security sweep: close the paid-tier
bypass..."). Every finding was proven live against the production database as
the role that would exploit it, probe rolled back. What is LEFT:

- [ ] **SWEEP-1 — the public page still names the seller's paperwork; decide if
  that is the line you want.** The scans are no longer published (the view hands
  out `document_types`, not URLs), so a buyer sees "Geran / Registration Card
  ✓ Available" and a line telling them to ask the seller. Two things worth a
  decision before real traffic.
  PARTLY ADDRESSED 2026-09-03 (owner's call): `plate_number` and the unused
  `vin` column were dropped from CarDetailPage's select, so neither ships in the
  page payload any more — both were fetched and never rendered. The remaining
  identifier, `vin_number`, is deliberately still shown, but relabelled from
  "VIN / Chassis" to "Chassis No." because that is what Malaysian sellers
  actually record there (a geran carries a chassis number, not a 17-character
  VIN). Note the columns are still ON the view — this only stops the car page
  requesting them.
  STILL OPEN: whether to publish the chassis number to everyone at all, and the
  fact that there is now no way for a serious buyer to see the geran. If you
  want a middle ground, the shape is "reveal to a buyer who has started a chat
  thread", not "publish to everyone".

- [x] **SWEEP-2 — DONE 2026-09-04.** `public_car_listings` recreated without
  `car_documents` and `included_services_cost`, and — since a DROP + CREATE of
  the one anon-facing view is the expensive half and this file already says not
  to pay it twice — without `plate_number` and `vin` as well. All four had ZERO
  consumers: checked every `.from('public_car_listings')` call in `src/`, every
  `api/` handler, every edge function, `pg_depend` for dependent views, and
  `pg_proc` for functions returning its row type. Migration
  `20260904c_sweep2_trim_public_car_listings.sql`.
  `plate_number` and `vin` are the leftovers SWEEP-1 noted were "still ON the
  view" — the registration plate and a dead duplicate of `vin_number`, both
  published to anon and read by nobody. `vin_number` (shown as "Chassis No.")
  is untouched; whether to publish IT is still SWEEP-1's open decision.
  Trap hit and worth remembering: `get_salesman_featured_listings(uuid)`
  RETURNS SETOF this view, so it holds a hard dependency on the row type and
  Postgres refused the DROP. `pg_depend` on rewrite rules only finds dependent
  VIEWS — it does not find functions. The function was dropped and recreated
  around the view (its body is `SELECT pcl.*`, so it followed the new column
  set unedited) and its grants re-asserted explicitly.
  Grants were NOT copied off the old objects. The view now has SELECT only for
  anon/authenticated/service_role; the INSERT/UPDATE/DELETE/TRUNCATE
  service_role used to carry could never have functioned (the view is not
  auto-updatable) and were deliberately not restored. Verified as anon after
  the fact: 66 rows readable, unchanged; `seller_sold_count` present; the
  featured-listings RPC still returns rows as anon; all four columns gone.

- [x] **SWEEP-2b — found while doing the above.** `seller_public_stats` carried
  INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for **anon** and
  authenticated — Supabase's blanket default-privileges grant, not anyone's
  decision. None could function (aggregate view, not auto-updatable), but they
  read as intent on an anon-facing object. Now SELECT only; anon SELECT stays on
  purpose, it is a public trust signal.
  Migration `20260904d_seller_public_stats_read_only_grants.sql`.

- [x] **SWEEP-3 — DONE 2026-09-04.** Both comments (`useCTAContext.js:48`,
  `useTenant.js:141`) claimed `public_dealer_profiles` "is security_invoker and
  anon RLS returns no rows". Both halves are false and now say so explicitly,
  along with why the RPC is still the right call (it is narrow, not because the
  view is closed). Re-verified before rewriting: the view has no
  `security_invoker` reloption, so it runs as its owner and never consults
  `profiles` RLS, and anon holds SELECT. Probed as anon: **2 rows readable, 0
  with an email, 2 with a whatsapp_number** — so SWEEP-4's fix still holds and
  the remaining public field is the storefront CTA number, which is intended.

- [x] **SWEEP-4 — DONE 2026-09-03. The constant did not need renaming; the code
  it fed was dead.** `Footer.jsx` hard-stops on `!isSubdomain()`, so the
  "superadmin fallback for the main domain" could never render on the main
  domain, and on a subdomain the tenant profile always won. The only way that
  branch could paint was a subdomain whose tenant had not resolved — printing
  ONE dealer's contact details on a DIFFERENT dealer's storefront. Removed the
  fallback fetch, `SUPERADMIN_ID`, and the now-unused `useState`/`useEffect`/
  `supabase` imports, then dropped the hardcoded id from
  `public_dealer_profiles` (migration `sweep4_drop_hardcoded_contact_id_from_dealer_profiles`)
  so email/phone are once again superadmin-only. Verified as anon: 0 rows
  publishing an email or phone, down from 1. Grants unchanged (CREATE OR REPLACE,
  same column list). The marketplace uses `MarketplaceFooter` and never touched
  this path. Note `1e7bf24e-...` is still hardcoded in two unrelated places —
  `HeroCarousel.jsx:709` (env-var default) and `DashboardPage.jsx:3945` (an
  `isOwner` check) — both out of scope here.

- [x] **SWEEP-5 — DONE 2026-09-03.** `salesman_under_listing_limit()` now reads
  `plan_config.listing_cap` (migration `sweep5_listing_cap_reads_plan_config`),
  so the RLS gate and the two triggers cannot drift apart. It closed two
  disagreements, not one: Lite (helper said 30, config says 10) and Premium
  (helper said unlimited via `is_salesman_premium()`, config says 30). Neither
  changes what anyone can do today — the triggers were already the binding
  constraint and the busiest salesman has 6 active listings against a cap of 10.
  The status filter now also excludes `unpublished`, matching the triggers'
  "private stock, not public listings" rule; the helper had been counting
  unpublished cars toward the cap. NULL cap (or no `plan_config` row) still
  means unlimited, as in the triggers. Proven with a rolled-back probe: under
  cap true, at cap false, NULL cap true.

- [x] **SWEEP-6 — DONE 2026-09-03, and it was NOT cosmetic: WhatsApp lead
  capture was broken.** The note above assumed "PostgREST resolves by argument
  names so it works today". It did not. Both overloads carried the SAME SIX
  PARAMETER NAMES with the same types, only in a different order, so a named
  call cannot pick one: proven live with
  `ERROR 42725: function create_lead_from_whatsapp(...) is not unique`.
  `api/whatsapp-lead.js:49` calls it by name with all six args, so every
  WhatsApp tap that reached it failed to record a lead. Last `lead_source =
  'whatsapp'` row is 2026-08-17, while enquiry and chat leads kept arriving
  through 08-31.
  Root cause worth remembering: `20260829_chat_creates_pipeline_lead.sql`
  rewrote the function with the parameters REORDERED. `CREATE OR REPLACE
  FUNCTION` matches on the argument type list, so a reordered signature does not
  replace the old function, it creates a second one beside it. Dropped the old
  `(uuid, uuid, text, text, text, text)` overload — the one comparing a raw
  regexp-stripped phone against the normalized column, i.e. the de-dup bug
  CLAUDE.md already records. Verified with a rolled-back probe: the exact call
  `api/whatsapp-lead.js` makes now resolves and stores the phone as
  `60123456789`.

- [x] **SWEEP-7 — ALREADY DONE (closed with the push work, verified 2026-09-04).**
  `push_swap_endpoint` now calls `push_endpoint_allowed(v_new)` instead of the
  old `^https://host/` shape check. Probed live: `fcm.googleapis.com` and
  `web.push.apple.com` pass; `evil.example.com`, the lookalike
  `fcm.googleapis.com.evil.com` and plain `http://` are all rejected.
  Original note kept below for context.

  ~~`push_swap_endpoint` accepts any https host.~~ The service
  worker has no Supabase session, so the OLD endpoint string is deliberately the
  credential (documented in `public/push-sw.js:76`) — that part is a reasonable
  design. What is loose is the NEW endpoint: it only has to match
  `^https://host/`, so anyone holding an endpoint could repoint that device's
  pushes anywhere. Restrict the new endpoint to the known push services
  (`fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`,
  `*.push.services.mozilla.com`). Low severity — endpoints are high-entropy and
  `push_subscriptions` is not readable — but it is a one-line predicate.

---

### SESSION 2026-08-30 — identity found while designing the plan page

- [x] **ROUTE-1 — DONE 2026-08-30. The "Dashboard" button on a seller's mini
  page, and where it sent people.** Owner reported the friend was on the
  PremiumMotors mini page (`/s/premiummotors`, account `auzyvyth+premium@gmail.com`,
  profile `f92eb826-...`) and a "Dashboard" button appeared, which she pressed.
  Two real faults behind it, both fixed:
  (a) `SalesmanProfilePage.jsx` rendered that button for ANY signed-in viewer
  and always labelled it "Dashboard" — including a buyer, whose destination was
  `/account`. The two headers already worded this by role ("My Account" for a
  buyer); the mini page did not. It now uses the same wording and icon.
  (b) `ROLE_ROUTES.salesman = '/salesman'` cannot be right for every salesman.
  A STANDALONE rep belongs on `/salesman-lite` or `/salesman-premium`; only a
  rep with `dealer_id` belongs on `/salesman`. Every "Dashboard" link in the app
  resolved standalone reps to the linked-salesman panel, and it only looked
  correct because `Salesmanpanel.jsx:517` catches it and re-navigates — after
  mounting the wrong panel. New `routeForProfile(profile)` in useRoleRedirect.js
  states the same rule BEFORE the navigation; `routeForRole(role)` stays for
  callers that genuinely have no profile. Updated: SalesmanProfilePage, Header,
  MarketplaceHeader, useBuyerGuard, BuyerAuthPage (each now selects
  `dealer_id, plan` alongside `role`). SalesmanLite/SalesmanPremium keep
  `routeForRole` on purpose — their calls are guarded by `role !== 'salesman'`,
  so the branch is unreachable there.
  NOT ESTABLISHED: exactly which of these the friend hit. `profiles` has no
  `updated_at`, so there is no way to tell whether her role was still 'buyer'
  (button -> /account) or had already flipped to 'salesman' by AUTH-1 (button ->
  a seller panel) at the moment she pressed it. Both paths are closed now.

- [x] **AUTH-1 — DONE 2026-08-30. A guest session can no longer become a
  seller.** Two halves, both shipped:
  (a) DB: `prevent_profile_privilege_escalation` now rejects any role other than
  `buyer` when `auth.users.is_anonymous` is true
  (`supabase/migrations/20260830d_guest_accounts_cannot_become_sellers.sql`,
  applied). Verified with a rolled-back `set_config('request.jwt.claims', ...)`
  probe: the guest account was BLOCKED, an email-backed buyer becoming a
  salesman still ALLOWED. It is in the trigger, not just the pages, so it holds
  whichever client does the write.
  (b) Frontend: `SalesmanOnboarding.jsx` and `DealerOnboarding.jsx` no longer
  adopt whatever session exists — an anonymous one is signed out and the signup
  form explains why (`guestNotice`). Without this the DB guard would surface as
  a raw error halfway through the form.
  Upgrading still works: linking an email flips `is_anonymous` to false and the
  same write then succeeds.

  CLEANUP DONE 2026-08-30 (owner's call): profile
  `c8cd260e-c308-4020-a234-d9f98906e64c` ("SITI ZAHIRAH") was the one account
  already created this way. Reverted to `role='buyer'` with `plan`, `slug`,
  `dealership` cleared and `onboarding_complete=false`, which removes the dead
  storefront and frees the `sitizahirah` slug. It had 0 listings and 0 leads, so
  nothing was lost. Left `is_active=true` on purpose — she is a legitimate
  buyer with 2 live chat threads, and deactivating would have broken those for
  no gain; the storefront dies with the role and slug, not with the flag.
  Verified after: 0 anonymous accounts hold a non-buyer role, her 2 threads
  intact, slug free.

- [x] **CHAT-1 — DONE 2026-08-30. Seller-to-seller chat no longer files a
  retail lead.** `chat_after_message` now reads the buyer side's role and skips
  lead creation unless it is `buyer`
  (`supabase/migrations/20260830e_seller_to_seller_chat_is_not_a_retail_lead.sql`,
  applied). The conversation and the notification are untouched — only the
  pipeline row is skipped. Guest buyers are `role='buyer'`, so they still create
  leads exactly as before.
  `start_chat_thread` is deliberately left permissive: dealer-to-dealer trade is
  real, and blocking the thread was never the goal.

  CORRECTION to how this was first reported: the two threads with a seller on
  the buyer side were BOTH the same account (the AUTH-1 guest, `SITI ZAHIRAH`),
  and both leads were created while it was still `role='buyer'` — the role
  flipped afterwards. So those two leads are genuine guest-buyer leads and were
  NOT deleted. This was the hole being real, not two dealers actually chatting.

---

### SESSION 2026-08-26 — Security follow-ups

- [x] **SEC-1: anon INSERT on `dealer_notifications` / `salesman_notifications`
  (push-spam vector)** — DONE 2026-08-30 (PR #334). Both `anon_trigger_insert`
  policies DROPPED. The preferred fix in the original note turned out to be
  unnecessary: `notify_new_booking` and `notify_dealer_salesman_note` were
  checked in `pg_proc` and are already `SECURITY DEFINER`, so nothing
  legitimate was relying on the policies — every producer is trigger fanout.
  Verified as anon before shipping (`set local role anon` inside a rolled-back
  `DO` block): the anon booking and public WhatsApp enquiry paths still fire
  their push, and a direct anon INSERT into either table is now rejected.

- [x] **SEC-2: salesman analytics RPCs cross-readable** — DONE 2026-08-30
  (PR #334). Ownership guards added inside `get_salesman_minipage_stats`,
  `get_salesman_minipage_daily`, `get_salesman_channel_breakdown` and
  `get_salesman_slug_analytics`, using the "my slug OR a slug belonging to my
  dealer" predicate the note called for, so Salesmanpanel's
  `profileData.slug || ""` still resolves. Also found and closed a worse hole
  the note did not cover: `get_salesman_slug_analytics` still had anon EXECUTE,
  so any unauthenticated visitor who knew a public slug could read that rep's
  per-car views, enquiries and channel breakdown. Revoked from `public` (not
  just `anon` — the grant was held by PUBLIC, so revoking anon would have
  no-opped) and verified with `has_function_privilege`.

---

### SESSION 2026-08-23 — AutoRaptor competitive audit (Salesman Premium)

Full report: published artifact
https://claude.ai/code/artifact/676e1a78-c251-47c7-aac9-fd459d077973 — complete
feature census of `SalesmanPremium.jsx` (8,888 lines) cross-referenced against
AutoRaptor's public product pages. Headline finding: AutoRaptor has NO
solo-agent product — it's dealership-only, quote-priced (~$399/mo base),
sold to businesses not individuals. So this isn't a lost-deal comparison,
it's a feature-mining exercise: what would still save a solo agent real time
if ported over.

Prioritized gaps worth building, ranked by time saved:

**RAPTOR-1 + RAPTOR-4 SHIPPED 2026-08-23 — do not rebuild.** Timed follow-up
nudges, AI-drafted, always human-sent. A nudge is a REMINDER with the message
already written, never an auto-send — the salesman reads the draft and presses
send in WhatsApp himself, because a buyer must know they are talking to a
person. Pieces: `scheduled_nudges` table + `fire_due_nudges()` sweep
(`supabase/migrations/20260823_raptor_scheduled_nudges.sql`, live cron jobid 12,
every 5 min), `src/hooks/useNudges.js`, `src/components/crm/NudgeQueue.jsx`, and
the AI-draft + "Remind me to send this later" controls in
`src/components/crm/OutreachHub.jsx`. The sweep inserts a `salesman_notifications`
row and lets the existing `trg_push_on_salesman_notification` trigger send the
push — no edge function, no JWT in cron. AI drafting reuses the `wa_reply` quota
key (50/day) and the prompt forbids inventing any price, discount or financing
figure. Still blocked for WHATSAPP conversations: seeing a buyer's reply that came
in over WhatsApp needs real Meta Business API access (see IDEA-2, and the
cost/verdict brief at https://claude.ai/code/artifact/e48b6e50-f0bf-4df0-aebb-57ac808f1892
— headline: dealer-tier only, never worth it for a solo agent). NOTE: the
in-app chat shipped later the same day makes this a partial problem, not a
total one — for buyers who chat inside ShiftOS the AI already reads the whole
conversation (redacted), no Meta account involved. Do not chase the WhatsApp
API assuming it is the only way to give the AI conversation context.
- [ ] **RAPTOR-2: Side-by-side deal/payment scenario desking.** Loans tab
  (`SalesmanPremium.jsx:6940`) produces one scenario per submission — it
  literally builds `const banks = [{ ...one bank... }]`. Add 2-3
  side-by-side tenure/down-payment comparisons before the application form,
  the way AutoRaptor's Payment Penciling does.
**RAPTOR-3 SHIPPED 2026-08-24 — do not rebuild.** Equity mining on the
Customers tab (`renderCustomers`, `src/pages/SalesmanPremium.jsx`): a
`Trade-up ready · N` filter pill, a per-customer strip naming the reason, and a
WhatsApp message button. Sorted strongest signal first, so the filtered view is
already a call list.
Two things the spec got wrong and this build corrects:
  1. "Bought 3+ years ago" alone returns ZERO rows and will keep returning zero
     until 2029 — the oldest `customers.purchase_date` in prod is 2026-03-08,
     the platform is six months old. So the trigger is ownership age >= 3y OR
     vehicle age >= 5y (now minus `car_year`). Vehicle age fires today: 10 of
     the 27 live customers qualify. Ownership age takes over as the platform
     ages; both reasons show when both fire.
  2. No estimated equity, trade-in value or payoff figure anywhere. `customers`
     has a selling price but there is no loan tenure or interest rate on any
     table, so an equity number would be invented — the same rule that governs
     AI drafts. The feature answers WHO to call, never what to offer, and the
     filter header says so out loud.
The WhatsApp opener names no price, instalment, trade-in value or approval. The
button is hidden when the stored phone has under 9 digits (prod has junk values
like "601" and "1212112" that would open a dead chat).
Also fixed while in there: the "Some policies have expired" line put its
highlighted word on its own line at 375px — the icon and text were siblings in a
flex row, so the inline span became a flex item.

**RAPTOR-6 SHIPPED 2026-08-24 — do not rebuild.** The car card is now two
buttons: red "Book a Viewing" plus one neutral **Contact**. Contact opens the
sheet `BuyerChat` already owned, which gained a chooser step in front of the
chat — WhatsApp / chat here in XDrive / call the seller — so a new contact
channel is a row in that list, never a fourth button on the card. Both CTA
blocks in `src/pages/CarDetailPage.jsx` (mobile card and desktop sidebar) pass
the same props and must stay in step. WhatsApp comes in as `onWhatsApp` and the
sheet closes before it runs (overlay rule 3); `handleWhatsApp` only opens the
enquiry modal, and the real `wa.me` open still happens synchronously inside
`handleEnquirySubmit`, so no popup blocker is involved. Verified in Chromium at
375px on both the light marketplace card and the dark subdomain card.

- [ ] **RAPTOR-5 (low priority): Click-to-call with auto-logging.** Not
  urgent — Malaysia's WhatsApp-first market makes voice less central than in
  AutoRaptor's US/SMS-centric design. If ever built, auto-log the outcome
  instead of today's manual log-after-the-fact (`logCall`, `SalesmanPremium.jsx:1356`).

Deliberately NOT recommended (see artifact §04 for the full case): DMS/80+
inventory integrations (ShiftOS listings already ARE the CRM data, nothing to
sync), soft credit pull via 700Credit (US-bureau-specific, no Malaysian
equivalent, needs its own scoping), Digital Retail website widgets (solo
agents don't have their own dealer website to embed one in), email campaigns
(Malaysian buyers are WhatsApp-first — this is a Premium strength vs
AutoRaptor already, not a gap to close).

---

### SESSION 2026-08-22b — Salesman Premium launch sweep

Full sweep of `src/pages/SalesmanPremium.jsx` (7,300+ lines) after the owner
asked to get Premium live this week. First pass found it already feature-rich
with no `TODO`/stub markers; owner pushed back that there were real gaps —
second, deeper pass (diffing against `Salesmanpanel.jsx`, the linked-salesman
panel) found genuine ones. Shipped the fixable ones; the rest are follow-ups
below. Build (`npm run build`) and lint both clean after these changes.

**Round 2 (same day):** owner flagged the onboarding tour and Settings tab.
- **PREM-8: onboarding tour was Lite's tour, unedited.** Welcome copy
  literally read "Welcome to ShiftOS **Lite**" and `TOUR_TABS`/`TOUR_STEPS`
  only walked Dashboard → Listings → Leads → Enquiries → Bookings → Join a
  Dealership — 4 of Premium's 10 real tabs (Analytics, Loans, Outreach,
  Settings) were never shown, including the two paid differentiators (Loans,
  Outreach). Fixed: retitled, and both arrays now cover all 10 tabs in nav
  order with tab-specific copy.
- **PREM-9: Settings was missing most of what Lite has.** Diffed field-by-
  field against `SalesmanLite.jsx`'s Settings tab. Premium had only Avatar,
  Cover Photo, Full Name, WhatsApp, Deposit terms, Processing fee, Slug.
  Added to match Lite: Telegram chat ID + test-message button, City/State,
  IC verification (hashed via `set_my_ic`, badge-only display — ported the
  verify UI, deliberately did NOT port Lite's 7-day hard-enforcement block on
  new listings, since that's a business-rule change beyond "the settings
  page" — flag if you want that enforced for Premium too), social links
  (Instagram/TikTok/Facebook/Website), and the `AvailabilityEditor` (booking
  windows — Premium has a Bookings tab that depends on this and had no way to
  configure it before).
- **PREM-10: added Bio/Response Time/Specializations as Premium-exclusive.**
  Owner's ask: "for premium users they can do a little more... an extra
  bio." Verified `SalesmanProfilePage.jsx` (the shared public mini-page for
  all salesman types) already renders `profile.bio`, `.response_time` and
  `.specializations` — but the only Settings editor for them was in
  `Salesmanpanel.jsx` (linked/dealer-team salesmen). Neither Lite nor
  Premium could set them. Ported the editor (textarea + tag input, same
  `about_text`-adjacent `bio` column) into Premium only, not Lite — makes it
  a real Premium differentiator instead of a dormant public-page block.
  Lite still can't set these; that's consistent with the tiering, not a bug.
- **PREM-11: IC verification made mandatory at Premium signup, not a
  runtime gate.** Owner's call after reading the "deliberately not ported"
  note on PREM-9: since Premium is paid, require IC as part of the same
  onboarding flow as payment — no separate later gate, no delay on
  publishing. `SalesmanOnboarding.jsx` step 2 (DETAILS) already had both a
  validating "Save & Continue" and a skip button ("Add IC Later — Get To My
  Panel"); the skip button is now hidden when `tier === 'premium'` (Lite
  unchanged, still optional), copy updated to say IC is required to activate
  Premium and that listings then publish immediately with no separate
  review. Resume flow re-verified safe: "Continue Sign-up" always re-enters
  at step 2 (`SalesmanOnboarding.jsx:547`), so a resumed premium session
  can't skip past the now-mandatory field. No changes needed in
  `SalesmanPremium.jsx` itself — the Settings-tab verify button from PREM-9
  stays as a path for any pre-existing premium account that predates this.
  Side note, not acted on: `profiles.ic_number` (plaintext column) is
  selected for resume-prefill (`SalesmanOnboarding.jsx:263`) but nothing in
  this file's salesman-identity path ever writes it — dead column read, not
  a live plaintext-IC leak. Worth a cleanup pass, not urgent.

**Round 3 (same day): pipeline + booking port from Lite.** Owner: "premium
hasn't been worked on for months so it's missing crucial features." Correct —
the bookings tab could only flip a raw status string. Ported Lite's whole
lifecycle while keeping Premium's own AI / broadcast / loans.

- **PREM-12: booking lifecycle ported.** Added `scheduleAptReminder`,
  `autoUpsertLeadFromAppt`, `buildConfirmBookingMsg`,
  `openConfirmBookingModal`, `sendConfirmBooking`,
  `moveConfirmBookingToPipeline`, `defaultBookingSlot`,
  `confirmSellerBooking`, `autoCreateLeadFromEnq` + 13 pieces of state.
  New UI: confirm-booking modal (editable WA message, or confirm-only),
  booking detail sheet (reschedule to a real slot, Telegram reminder picker
  with clear, cancel confirmation, showed-up/no-show on past bookings), and
  a seller-initiated booking modal. Confirm now also creates/advances the
  pipeline lead and arms the 1h reminder, so a confirmed booking can never
  sit outside the pipeline.
- **PREM-13: won flow ported.** `handleMarkWon` + `refreshCommissionData` +
  a confirm modal, intercepted in `advanceLeadStage`. Premium previously let
  a win happen behind the same 4.5s undo toast as any other stage change,
  and never flipped the linked car in local state. The DB trigger
  `auto_create_customer_on_won` was still doing the real fan-out (per the
  "Won = sold" doctrine in CLAUDE.md), so this was a UI-truthfulness gap
  rather than lost data — the salesman just never saw the sale register.

**Bugs found during the port (all fixed):**
- **PREM-B1 (HIGH): most bookings were invisible.** The appointments fetch
  filtered `.eq("salesman_id", uid).eq("dealer_id", uid)`. Only 17 of 71 live
  rows have `dealer_id = salesman_id`, so the rest silently never rendered.
  RLS already scopes this table; Lite filters on `salesman_id` alone. Removed
  the extra predicate.
- **PREM-B2 (HIGH): a lead at `test_drive` could never be advanced.**
  `advanceLeadStage` calls `setTestDriveConfirm({...}); return;` — but nothing
  in Premium ever rendered that modal (state was declared at `:273`, set at
  `:848`, referenced nowhere else). Every advance from that stage was a
  no-op. Ported Lite's outcome sheet.
- **PREM-B3 (MED): "Upcoming" was `!isToday`,** so past bookings were listed
  as upcoming forever and pending requests sat between confirmed viewings.
  Now split pending / today / confirmed-upcoming / past (collapsed).
- **PREM-B4 (MED): the appointments select omitted `remind_at`,
  `remind_sent` and `lead_id`,** so reminder state and lead linkage could not
  be read — the same incomplete-select trap CLAUDE.md's overlay rule 4 warns
  about. Widened to match Lite.
- **PREM-B5 (MED): `lead_activities` inserts hardcoded `dealer_id: null`** in
  three places (`updateLeadStage`, `logCall`, `handleLostReason`), detaching
  every Premium activity row from its dealership scope.
- **PREM-B6 (MED): converting an enquiry** inserted a raw unnormalized phone
  (so the same buyer never matched on a later booking → duplicate leads),
  hardcoded `dealer_id: null`, had no duplicate check, and never added the
  lead to local state. Routed through `autoCreateLeadFromEnq`. `handleAddLead`
  had the same raw-phone bug; also normalized.

**Still not ported from Lite:** the batch-WhatsApp modal (owner deferred it),
the follow-up modal, and the share-win prompt.

**Shipped:**
- **PREM-16: deal add-ons ported, catalogue given a home**
  (`src/pages/SalesmanPremium.jsx`). Premium could never record back-end
  gross — `deal_products` had no write path at all, so RevOps/P&L saw RM0 of
  add-on revenue for every Premium deal.
  - Attach/remove UI in the lead drawer, above the lost/delete zone: pick
    from your catalogue, override the price, running RM total in the header.
  - Catalogue itself is a **sub-tab under Listings** (Cars / Add-ons), not a
    new page — it reuses the existing `ServicesAddonsTab` component Lite
    already has, and it sits with the cars because both are "things I sell".
    Same `dealer_products` rows also feed CarForm's Included Services picker.
  - Small blue "Add-on" badge on pipeline cards for leads that carry one,
    from one `deal_products` fetch alongside leads (not N+1 per card).
  - Verified the write path against the live DB before shipping: both tables
    are `dealer_id = get_my_dealer_id()`, and `get_my_dealer_id()` returns
    `id` for `role='salesman' AND dealer_id IS NULL`, matching
    `getDealerIdFromProfile`. A solo Premium account resolves the same on
    both sides, so inserts land rather than being silently rejected.
- **PREM-15: row-glow highlight ported** (`triggerGlow`,
  `.sp-lead-glow`). Jumping to the pipeline from a follow-up nudge, or from
  the Stale Leads KPI tile, now pulses the exact cards that prompted the jump
  instead of dropping the user into an undifferentiated list. Nudge rows and
  the KPI tile are keyboard-operable; honours `prefers-reduced-motion`.
- **Extracted `SubTabs`** — Inbox and Listings share one switcher component
  rather than two copies of the same 25 lines of pill markup.
- **PREM-14: nav compacted 10 tabs to 8** (`src/pages/SalesmanPremium.jsx`).
  Bookings folded into Enquiries — renamed **Inbox** — as a two-button
  sub-tab (Bookings / Lead History), mirroring Lite's `inboxSubTab`. Merge
  moved out of the nav into a section at the bottom of Settings
  (`id="sp-merge"`); it is a one-time action, not permanent nav real estate.
  Loans and Outreach deliberately kept top-level — they are the two things
  Premium is actually sold on.
  - Routes did NOT change. `TAB_ALIASES` (`SalesmanPremium.jsx:203`) maps
    `bookings → enquiries + bookings sub-tab` and `merge → settings + scroll
    to #sp-merge`, so every old link, every in-app `switchTab("bookings")`
    call and the tour keep working.
  - Killed a real redundancy: the Enquiries tab rendered its OWN read-only
    copy of the appointments list (~48 lines) underneath the enquiry feed,
    duplicating `renderBookings()` with none of its actions. Deleted — the
    sub-tab shows the real interactive board.
  - Killed dead state: `newBookingsCount` was a session-only "unseen" counter
    that reset to 0 on every reload, so the nav badge lied after a refresh.
    The Inbox badge now derives from real state
    (`pendingBookingsCount + newEnquiriesCount`) and survives reloads.
  - Tour still has all 11 steps — Bookings and Join a Dealership are real
    features and still get introduced. `TOUR_HIGHLIGHT` repoints the
    spotlight to the tab that now hosts them, and both step bodies say where
    to find them.
- **PREM-1: the three "coming soon" kill switches removed.** Premium was
  fully built but invisible to real customers behind three separate flags:
  `PREMIUM_ENABLED = false` in `SalesmanOnboarding.jsx:210` (any premium
  onboarding request silently fell back to Lite), `soon: true` on
  `PLAN_META.salesman_full` in `ShiftOSPage.jsx` (landing-page pricing card
  showed a disabled "Coming soon" button), and `soon: true` in
  `PlanPickerModal.jsx` (same disabled state in the in-app plan switcher).
  Also rewrote the hardcoded dimmed "Coming soon" card in
  `SalesmanLiteLanding.jsx` (`/for-salesmen`) into a normal enabled upgrade
  card with a working `<Link>`, and dropped the now-dead `.sll-plan-soon` /
  `.sll-soon-ribbon` / `.sll-btn-disabled` CSS. All three onboarding entry
  points (landing page, `/for-salesmen`, in-app plan picker) now route a real
  signup through to `/salesman-onboarding/premium`.
- **PREM-2: Outreach Hub was unreachable for every solo Premium customer.**
  `showOutreach` gated on `hasFeature('salesman', 'outreach', permissions)`
  (`src/lib/permissions.js`), which only returns true if a `role_permissions`
  row has `feat_outreach: true` — a toggle meant to be set by a **dealer**
  for their team. A solo Premium salesman has no dealer above them and no
  dashboard to grant it to themselves; the one live Premium account had zero
  rows in `role_permissions`, confirmed via direct query. Since the redirect
  guard in `SalesmanPremium.jsx` already sends any salesman with `dealer_id`
  set to `/salesman` before this page ever renders, `dealer_id` is always
  null here — so `showOutreach` is now hardcoded `true` and the dead
  `usePermissions`/`hasFeature` imports were removed. Outreach is a paid
  Premium feature with no dealer to gate it behind; it should just be on.
- **PREM-3: back button / swipe-back could log a Premium salesman out
  mid-session.** Same bug class as `LITE-2` below, ported the identical fix:
  `SalesmanPremium.jsx` held all 10 tabs in a single `useState("dashboard")`,
  so every tab switch replaced state with no history entry — Back or swipe
  landed on the previous *page* (sign-in), not the previous tab. Now
  `/salesman-premium/:tab?` is the single source of truth (one route with an
  optional param, same as `/salesman-lite/:tab?` — **not** two separate
  `Route` entries, which would cross a route-id boundary on every tab switch
  and remount the component, wiping `tourStep` and looping the onboarding
  tour exactly like the bug documented at `App.jsx:193-206`).

**NOT shipped — three features TODO.md's own "V3" entry (see Done, below)
claimed Premium already had, which do not exist in the file:**
- **PREM-4: no Deal Sheet generator.** `Salesmanpanel.jsx` imports
  `generateDealSheet` from `../utils/dealSheet` and has a full "Customise
  Deal Sheet" UI (`Salesmanpanel.jsx:22`, `:4699`). Zero references anywhere
  in `SalesmanPremium.jsx`. Porting is mostly copy-adapt since the util and
  UI pattern already exist.
- **PREM-5: no Handover / post-sale tracking tab.** `Salesmanpanel.jsx`
  imports `PostSaleBoard` and has a full Handover tab (JPJ transfer,
  Puspakom B5/B7, road tax, insurance checklist) for won deals.
  `SalesmanPremium.jsx` has neither the import nor the tab. The DB trigger
  (`auto_create_customer_on_won`) still auto-seeds `post_sale_tasks` the
  instant a Premium salesman's lead hits `won` — the data exists, a Premium
  salesman just has no screen to see or work it. Same copy-adapt situation
  as PREM-4 (`PostSaleBoard` is a ready-made component, dealer-id scoped).
  Screen the customer-facing update path (buyer sees live checklist status)
  before shipping — it should already work via `PostSaleBoard`'s existing
  props, just needs verifying for a solo (no-dealer) salesman.
- **PREM-6: no customer records.** `Salesmanpanel.jsx:167` has
  `const showCustomers = hasFeature('salesman', 'customers', permissions)`
  gating a customer-records view; `SalesmanPremium.jsx` has zero `customer`-
  related code at all. This is the biggest of the three — needs its own
  screen built (or ported), not just an existing component wired in.
  Same permission-gating problem as PREM-2 applies here too: if ported using
  `hasFeature`, must use the solo-account bypass, not the dealer-permission
  gate, or it will be built-but-unreachable exactly like Outreach was.

Recommended order: PREM-5 and PREM-4 first (components already exist,
mechanical port), PREM-6 last (net-new screen). None of the three are
required for Premium to be live and honest about what it does — the plan
copy on the landing page/plan picker only promises "Advanced CRM automation"
and "Commission tracking," not deal sheets/handover/customer records by
name, so nothing sold is currently false. But they were the differentiators
implied by TODO's own (stale) V3 note, so treat as the real next milestone.

- [ ] **PREM-7 (LOW): Analytics has no daily WhatsApp-tap series.** Unchanged as
  a data gap, but the symptom is gone: the Analytics rebuild (2026-08-30,
  PR #334) REMOVED the WA-taps and CVR sparklines rather than leaving two tiles
  with a permanent blank gap where a chart should be. `waD = Array(7).fill(0)`
  is deleted along with them; both are plain numbers now, and the totals were
  always real. To bring the charts back, give the analytics RPC a genuine
  per-day WhatsApp-tap breakdown (bucket `analytics_events` by day — the dead
  `bucket7(evts, type)` helper that looked built for this was removed in the
  same pass, so it needs writing fresh), then re-add `data=` to those two
  `<Metric>` calls in `salesmanPremium/AnalyticsTab.jsx`. Nothing else is
  needed — the Spark component takes any 7-element array.

---

### CRON-1: two cron jobs still carry a hardcoded key literal

`cron.job` commands for **jobid 3 (`notify-price-alerts`)** and **jobid 7
(`appointment-reminders`)** paste a JWT straight into the SQL command text
instead of reading `public.get_cron_edge_key()` from Vault like jobs 5 and 10
now do. Both work TODAY, so this is not urgent — but it is a fourth copy of a
credential sitting in plaintext in a table, and the day that key rotates both
jobs die silently the same way the purge job did (pg_cron records a successful
run because it got an HTTP response; the response is just a 401).

Found 2026-08-22 while fixing the 30-day purge. Fix is mechanical: swap the
literal for `'Bearer ' || coalesce(public.get_cron_edge_key(), '')` via
`cron.alter_job`, then fire each job once and confirm a 200 in
`net._http_response`. Deliberately NOT bundled into the purge fix — no reason to
risk two working crons in a session about a broken one.

---

### SESSION 2026-08-21 — car detail page trust (research + geran requirement)

Full research report: `docs/research/cardetail-trust-research.html`
(published copy: https://claude.ai/code/artifact/46778936-5be8-445f-9799-447d2753cead).
Read it before picking any TRUST item up — it explains the five-rung trust ladder
these are ranked against (claim / structured self-report / openable document /
disclosed flaw / money on the line) and why one rung-4 item beats ten rung-1 ones.

**Shipped this session** (branch `claude/car-marketplace-trust-research-u6z9ns`,
pushed to `staging`, NOT in prod): named trust-document slots in CarForm, geran
required to publish with a declared-reason escape, `car_listings.geran_status`,
geran row on CarDetailPage. Owner still needs to confirm the staging preview
before this goes to prod.

- **TRUST-1: Ungate the condition map — DONE 2026-08-21.** Turned out not to be a
  gate removal. The real blocker was the form: the Damage Map field sat inside the
  recon-only block (`src/components/CarForm.jsx:2397`), so a local car could never
  get one, and live data showed 0 of 69 listings with a single mark — the map
  rendered on nothing. Shipped: `car_listings.condition_declared_at` (nullable, in
  `public_car_listings`), the map moved into a Condition Report field every car
  sees with an explicit "I walked around this car" declaration, and both detail-page
  breakpoints rendering on marks OR declaration with a summary line and the
  declaration date. Existing listings unaffected (no declaration, nothing renders).
  Still open from this item: whether CarForm should prompt for defect photos when
  the map has marks on it, and whether the declaration should be required to publish
  (it is optional today).
- **TRUST-2 + TRUST-3: dealer identity block + what "Verified" means — DONE 2026-08-21.**
  No new `profiles` columns were needed — `ssm_number`, `location`, `city`, `state`,
  `postcode`, `business_hours`, `phone`, `stat_years`, `is_verified`/`verified_at` all
  already existed. Shipped: `get_dealer_profile_by_id` extended (it is the only way an
  anon visitor sees a dealer), one `DealerIdentity` component used at both breakpoints,
  the badge linking to it instead of dead-ending, and SSM + postcode added to dealer
  Settings with a nudge naming the gaps. The verified line now states the real check —
  "SSM certificate and the owner's IC were checked" — which is what the admin button at
  `src/pages/AdminPage.jsx:1941` has always meant.
  **Three things for the owner:**
  1. **0 of 3 dealers are verified**, so the shield renders on no listing. The badge was
     never a lie, it is dead — same failure mode as the condition map. Verification is
     admin-only (`AdminPage.jsx:452`); dealers have no way to request it.
  2. Unverified dealers are shown **nothing** about verification rather than a negative
     "not verified" label — branding them before offering a way to get verified is the
     owner's call to make, not mine. Say if you want the negative state shown.
  3. `business_reg_number` is a **dead duplicate** of `ssm_number` — referenced nowhere
     in `src/`, empty in every row. Safe to drop; left alone for now.
- **TRUST-4 through TRUST-10 — DONE 2026-08-21.** All shipped on
  `claude/cardetail-trust-work-uwdwzk` / staging.
  - **TRUST-4 deposit terms** — `profiles.deposit_policy` (refundable /
    refundable_on_loan_rejection / non_refundable, CHECK-constrained) +
    `deposit_terms`, set once in dealer Settings, shown at the deposit ask. When
    unset the listing says so and tells the buyer to get it in writing.
  - **TRUST-5 CTA stack** — the two green buttons opened the SAME enquiry modal,
    differing only in lead attribution. Now one button carrying the rep's routing
    and named after them. "Go to dealer's page" duplicated "Visit Dealer's Page"
    (identical URL) and was removed.
  - **TRUST-6 review score** — tally lifted out of ReviewsSection (no second
    query) to sit beside the seller's name. Under 3 reviews the average is
    withheld and only the count shows.
  - **TRUST-7 filler copy** — "peace of mind" and "Inspection verified by the
    dealer" replaced; the Puspakom row no longer says "Verified" off a typed date.
  - **TRUST-8 theme leaks** — was listed as 3 spots, was closer to 30. Added a
    `LIGHT_ACCENT` map resolving accents at point of use instead of patching
    hardcodes one at a time.
  - **TRUST-9 market verdict** — floor of 5 comparables (16 of 41 listings were
    under it). Also relabelled: `compute_market_avg` averages other XDrive
    ASKING prices from a 69-car catalogue, so "market average" was overclaiming.
    Method note added; the RPC's `mileage_match` is no longer discarded.
  - **TRUST-10 price completeness** — official transfer fees (JPJ RM100,
    Puspakom B5 RM30, B7 RM60) sourced from `src/utils/postSaleSteps.js`, not
    invented. Revised after owner review (see below).

- **TRUST-10 follow-up — DONE 2026-08-21.** Owner caught two things.
  1. Processing fees vary by seller and location — only the JPJ/Puspakom rates are
     fixed nationally. Added `profiles.processing_fee` (NULL = not stated, 0 =
     none) with a field in all three seller surfaces.
  2. Salesman Lite/Premium had none of these fields. Worse: standalone agents own
     their listings, but `get_dealer_profile_by_id` is restricted to
     dealer/owner/superadmin, so `dealer` was NULL on their 9 public listings and
     `dealer?.handles_roadtax_insurance !== false` evaluated true — the page was
     printing "Road tax and insurance: Handled by the dealer" as a fact about a
     seller who had no such setting. Fixed by unifying on a `seller` object
     (`dealer || salesmanProfile`) and returning the terms from
     `get_salesman_by_id` too.
  3. Related find: `handles_roadtax_insurance` is NOT NULL DEFAULT true and all 26
     profile rows still carry the untouched default, so `true` cannot be told apart
     from "never answered". The listing now only states "Buyer arranges" when the
     flag is explicitly `false` (which requires someone to have flipped it);
     otherwise it says "Confirm with the seller".
  Still open: `DealerIdentity` ("About this dealer") is deliberately still gated on
  `dealer` only. A standalone agent has no SSM, and `is_verified` means something
  different for them (`get_salesman_by_id` derives it from whether an IC is on
  file, NOT the admin's "SSM + IC checked"), so reusing that block for agents
  would print a verification claim that is not true. Needs its own agent-framed
  variant if wanted.

- **TRUST-11 (ops, not UI): a named XDrive inspection standard** — the Carsome
  "175-point" move. "175-point" is countable, "thorough" is not. Needs someone to
  actually define and perform the inspection before any UI is worth building.
- **TRUST-12 (business, not UI): a guarantee with money behind it** — return window or
  deposit protection. Rung 5, the only rung that beats a cynic, and the only one that
  costs real money. cinch: 14-day money back + 90-day warranty. Carsome: 5-day.

**Open questions left from this session:**

- **TRUST-Q1: should Puspakom be hard-required for recon units?** Owner originally asked
  for the Puspakom report to be required too. It was deliberately left optional because
  B5/B7 is done at transfer time, so most stock has never had one and requiring it would
  make most inventory unlistable. If B5 is effectively standard on recon, gating it on
  `isRecon` only is a reasonable middle. Owner decision.
- **TRUST-Q2: `ownership` vs `registration_card` overlap in DOC_TYPES** — "Ownership /
  VOC" (`src/components/CarForm.jsx:277`) still exists alongside the new geran slot and
  a dealer could file a geran under it. Decide whether to retire `ownership`, relabel it
  to transfer-only documents, or migrate existing rows.
- **TRUST-Q3: `geran_status` is not surfaced outside the detail page** — it does not
  appear on `CarCard` or in search filters. If the tier is meant to be something dealers
  compete for (the Carlist "Qualified" move), it has to be visible in the list too.

---

### SESSION 2026-08-18 — Salesman Lite design cleanup

- **DESIGN-1: Replace Salesman Lite logo** — current logo needs a redesign/replacement.
  Not started; need the new logo asset/direction from the owner before implementing.

---

### SESSION 2026-08-16 — found while building the Buyers tab (not fixed, out of scope)

- **BUY-A: two session-id implementations disagree** — `src/utils/analytics.js:4` stores
  the visitor id under `"xdrive_session_id"`, `src/lib/analytics.js:4` stores it under
  `'shiftos_session'`. The same visitor therefore gets TWO different `session_id` values
  in `analytics_events` depending on which module fired the event, which inflates every
  distinct-session count (Funnel tab, `get_activity_summary`'s `distinct_sessions`).
  Fix: collapse to one module and one storage key; keep reading the old key once on
  migration so in-flight sessions are not double-counted.
- **BUY-B: `saved_cars` and `price_alerts` have no migration files** — both tables were
  created outside `supabase/migrations/`, so their schema and RLS are not version
  controlled. Same class of drift as the edge functions. Fix: dump the live definitions
  (columns + policies) into a migration so a rebuild reproduces them.
- **BUY-C: CLAUDE.md key-tables list is wrong about `leads`** — it documents a `source`
  column; the real column is `lead_source` (the one carrying the CHECK constraint).
  Cost a debugging round this session. Fix the line in CLAUDE.md.
- **BUY-D: Google One Tap bypasses the PDPA consent gate** — buyer signup now records
  `pdpa_consent` on every path that shows the tick box (email, Google button, magic
  link), but `src/components/GoogleOneTap.jsx:122` calls `ensureBuyerProfile` with no
  consent because One Tap is a Google-rendered popup we cannot put our consent text
  inside. Harmless today — One Tap no-ops until `VITE_GOOGLE_CLIENT_ID` is set (ACT-4)
  — but the moment ACT-4 is done, One Tap signups will land with consent unrecorded.
  Fix before enabling ACT-4: either show a one-time consent step on first landing for
  a One Tap account, or suppress One Tap until the marketplace consent line is
  acknowledged. Visible meanwhile in /platform → XDrive Ops → Buyers (PDPA consent).
- **BUY-E: existing buyers have no recorded consent** — the 6 accounts created before
  this fix show "Not given" and are deliberately NOT backfilled: stamping consent
  nobody gave would be a fabricated compliance record. `ensureBuyerProfile` records it
  the first time they return through a surface that asks. If they need to be cleared
  sooner, prompt them on `/account` rather than writing the column directly.

---

### SESSION 2026-07-05 — ROLES & STOREFRONT FIXES (adding roles under dealer)

#### CRITICAL — do first
- [x] **RF-C1: "Server unreachable" when creating non-salesman roles** — FIXED + DEPLOYED (invites v15). Root cause confirmed: deployed `invites` (v14) was missing `baggage, sentry-trace` in Access-Control-Allow-Headers, so the browser CORS preflight failed on every request (Sentry adds those headers) → "server unreachable". Source already had the fix but was never redeployed (DASH-5 debt). Redeployed with the fix + `Vary: Origin` + proper CORS on the 500 catch. NOTE: `send-telegram` and `ai-proxy` still carry the same un-redeployed CORS debt (not part of role creation; redeploy when convenient).
- [~] **RF-C2: Newly created salesman has no available cars from dealer** — NOT A CODE BUG (verified). Available Inventory query, dealer_id resolution (owner→profile.id), and RLS (`public_read_listings` allows authenticated read) all correct. Live data: Sentimas has 4 available open-pool cars (would show); "Fast" + "99test" dealers have 0 available cars; AiryMotors (solo) has 2 but both assigned. So an empty pool = that dealer genuinely has no available/unassigned cars, not a bug. NEEDS USER: confirm which dealer+salesman showed empty so the exact state can be checked. Possible UX follow-up: default a brand-new linked salesman to the "Available Inventory" tab (not empty "My Listings") + clearer empty-state copy.
- [~] **RF-C3: Sign-up email confirmation not working** — NOT GLOBALLY BROKEN (verified). Real email-click confirmations work (suemarine2000@gmail.com confirmed 238s after signup, 2026-07-03). The failing test used a Gmail `+`-alias (fasttrackautos+@gmail.com) which Supabase rejects as `email_address_invalid` (seen in auth logs) — test artifact, not a pipeline failure. USER ACTION for scale: default Supabase SMTP is rate-limited/not-for-production; configure custom SMTP via Resend (host smtp.resend.com, user `resend`, pass = RESEND_API_KEY, verified xdrive.my sender) in Supabase → Auth → SMTP for reliable delivery at volume. Test with a real (non-`+`) email.

- [x] **RF-C4: Pending-setup salesman state + resend email (Team tab)** — DONE. A dealer-created salesman appeared as a normal (usable) team member the instant the account was created, even before they clicked the emailed link and finished /salesman-setup. Added `profiles.setup_complete` (default false; backfilled true for all pre-existing rows so only new accounts start pending). SalesmanSetup.finish() sets it true. Team tab now renders a "Pending setup — {email} hasn't finished setting up their account" state with a Resend email + Remove buttons for any salesman where `!setup_complete`. Resend regenerates a fresh recovery link via the new `create-salesman` `resend_setup` action (v16) — the original link expires. Deployed: create-salesman v16.

#### NON-CRITICAL — after criticals
- [x] **RF-1: Storefront changeable dealer logo** — DONE. Added a "Dealership Logo" upload in Settings → Dealership Identity (uploads to the avatars bucket, saves site_logo_url immediately, clears the site-profile cache). Header now renders the logo with object-fit:contain at a fixed 30px height + capped/responsive width instead of cropping it into a 32px circle, so any square or wide logo fits snugly.
- [x] **RF-2: Center the "About / Get to know us" section** — DONE. Storefront About block (eyebrow + "Get to know us" title + about_text) centered (HomePage.jsx).
- [x] **RF-3: Floating WhatsApp button — mobile scroll behavior** — DONE. StickyWhatsAppButton already hid on scroll (#138) but flashed in on mobile load and hid jitterily on any upward scroll. Simplified to a clean threshold: hidden <140px, shown once scrolled down (stays put), desktop always on; initial state derived from viewport so no load flash.
- [x] **RF-4: Dealer Compare page invisible text/icons** — DONE (PR #149). Theme-aware text/chips on the dark subdomain; corner heart/remove buttons given dark pills (PR pending on branch).
- [x] **RF-5: New salesman shows "Inactive 30d+" badge** — DONE (PR #147). Badge now falls back to created_at as the floor so a brand-new hire isn't flagged stale.
- [x] **RF-6: Auto-logout after 1 day inactivity** — DONE. New `src/hooks/useIdleLogout.js` mounted in App: tracks last activity in localStorage (shared across tabs, survives reload); on mount / tab focus / every minute it checks the stored timestamp and, if >24h idle with a live session, signs out (scope:local) and redirects to /login?timeout=1. Strict by design — returning to a tab idle >24h logs out rather than resetting the clock.

---

### BILLING / PAYMENTS

- [x] **PAY-1: Salesman Premium payment gate (QR + approval)** — DONE. Ported the
  dealer flow: `SalesmanOnboarding.activate()` sets `payment_status:'pending'` for
  premium (lite stays free); `SalesmanPremium` gates on it and renders
  `DealerPendingApproval` (shared DuitNow QR at `public/payment-qr.png`) with a
  `redirectTo` prop; realtime auto-forwards on approval. AdminPage now surfaces
  solo premium salesmen (were invisible) with a "Mark Paid" action
  (superadmin RLS). Grandfathered premium rows (payment_status null) pass through.
  Original note below for reference (its "RM50/mo" was stale prose — corrected
  2026-08-15: live price is RM20/mo, and `plan_config` in the DB matches
  `src/utils/planConfig.js` exactly on all six plans, so C4 held. No pricing
  drift exists in code; this line was the only wrong copy):
  Salesman Premium (`salesman_full`, RM20/mo) previously activated for FREE at onboarding
  (`SalesmanOnboarding.activate()` sets `plan:'salesman_full'` with no payment).
  Apply the same pattern already shipped for dealers: on premium signup set
  `payment_status:'pending'`, show a QR pending screen (generalise/rename the
  existing `src/components/DealerPendingApproval.jsx`), and gate `/salesman-premium`
  until an admin marks payment received in `/platform`. The free Lite tier must stay
  unaffected. Reference (dealer flow, shipped 2026-07-02): `payment_status='pending'`
  at DealerOnboarding.submit → `DealerPendingApproval` QR screen (public/payment-qr.png)
  → DashboardPage gate → AdminPage "mark received" (superadmin_update_any_profile) →
  realtime auto-forward; storefront hidden while pending via the subdomain RPCs.

---

### UNIFIED CAR INTAKE (DMS workflow) — in progress

- [x] **DMS-1: AddCarForm (dealer unified intake)** — DONE. New `src/components/AddCarForm.jsx` replaces the old listing-then-prompt flow on the dealer dashboard "Add" tab. One 4-step flow: Identity → Procurement → Condition & Pricing (with live cost floor) → Photos & Publish. Publish toggle: ON inserts car_listings (trigger auto-creates stock_unit, then patches cost fields); OFF inserts stock_units directly (internal inventory, no public listing). Salesman CarForm untouched. `dealer_cost_settings` table created with RLS (dealer_id = get_my_dealer_id()).
- [x] **DMS-2: Dealer cost settings UI** — DONE. "Cost Floor" section in SettingsTab (Operations group): monthly_overhead, avg_fleet_size, floor_plan_rate, runner_fee, admin_fee, warranty_reserve_pct. Upserts to dealer_cost_settings. Cost floor degrades gracefully to govt rates until set.
- [x] **DMS-3: Plate / VIN decode (local lookup)** — DONE. `src/utils/carSpecs.js` lookup table for ~70 common Malaysian models auto-fills engine CC + body type in AddCarForm Step 1 when make+model match and fields are empty. JPJ plate API still restricted (real decode is future work).
- [x] **DMS-4: Holding cost in P&L** — DONE. fetchPnl computes daily holding (floor-plan interest priority, else overhead/fleet) × days held (purchase→sold or →today) and deducts it as a "Holding (Nd)" line in the P&L modal with a RM/day note.
- [x] **DMS-5: Estimated vs actual recon reconciliation** — DONE. fetchPnl fetches recon_jobs and shows actual recon total vs the booked estimate in the P&L modal (amber if over, green if under).
- [x] **DMS-6: Advertising spend per unit** — DONE. New `ad_spend` table + RLS. "Ads" button per stock row (view_cost gated) opens a modal to log/delete spend per channel (Mudah/Carlist/FB/TikTok/IG). Total deducted as an "Advertising" line in the P&L modal.

---

### SALESMAN LITE — launched first (context + follow-ups)

Launch note: Salesman Lite (`SalesmanLite.jsx`, solo lite, `/salesman-lite`,
signup → `/salesman-onboarding/lite`) is live. Premium (`SalesmanPremium.jsx`)
and the linked-salesman panel (`Salesmanpanel.jsx`) are separate surfaces.

- AI features in Lite: NONE — confirmed. `SalesmanLite.jsx` has zero AI code;
  the linked panel's AI (captions/WA reply/scoring) is gated `if (!isPremium)`
  + UpgradeBanner, so no non-premium salesman can reach AI. Correct as intended.
- [x] **LITE-1: Share-channel breakdown UI in SalesmanLite** — DONE. Added a
  `channelMap` fetch (`get_salesman_channel_breakdown`, slug-scoped) after the
  Lite analytics load, and a "Traffic Sources — which platform your links came
  from" `<ChannelBreakdown>` card in the Performance tab (next to Lead Sources).
  Optional follow-ups (not blocking): per-car breakdown in the Lite car-detail
  popup (no stats section there today) + `ShareMenu` per-channel `?src=` buttons
  in Lite (auto-detect already covers the plain `?ref=` links).

### STOCK IMPORT PARSER — image extraction + security hardening

Context: `ImportStockPage.jsx` converts an uploaded PDF/XLSX (or public Google
Sheet) to TEXT and sends it to Claude (feature `stock_import`) to extract a JSON
array of listings incl. `image_url` (→ saved as the listing photo, `:326`).
Real dealer files inspected: 2 PDFs + 1 Excel. The YAPNET PDF holds 893 `/Link`
annotations with `/URI` actions — every car's photos are a **Google Drive folder
link** attached to the row. Current text-only extraction captures NONE of them.

- [x] **IMP-0: Pre-upload guide popup + input hardening** — DONE. Step1Upload now
  has a "Before you upload" guide modal (share links publicly, image link per
  car, fill key columns, mark SOLD/ETA, avoid password-protected/scanned PDFs &
  pasted-in images, 50-car cap) and bulletproof file validation: extension
  allowlist, 20 MB cap, empty-file guard, and magic-byte sniff (%PDF / PK zip)
  so a renamed file is rejected before any parser runs.
- [x] **IMP-1: PDF per-row image extraction (link annotations)** — DONE. The PDF
  path in `buildClaudeMessages` now runs `page.getAnnotations()`, filters Drive
  `Link` annotations, assigns each to its nearest text row by y-position, and
  appends an inline `[image: <url>]` marker the AI maps into image_url. System
  prompt updated to recognise the marker.
- [x] **IMP-2: Drive FOLDER-link handling (self-serve, no OAuth)** — DONE. New
  `import-drive-images` edge function (deployed): JWT + role gated, uses a
  server-held Drive API KEY (public "anyone with link" folders — no dealer
  OAuth), lists the folder, downloads all images (capped 40/car, 300/request,
  15 MB each), rehosts to the `car-images` bucket under `<uid>/<listingId>/`,
  returns public URLs. `handleImport` inserts listings first, then resolves
  folders in batches of 20 and patches images via the dealer's RLS session
  (ownership enforced by the DB, not the function). SSRF-proof: only a Drive ID
  is extracted and used against googleapis.com — the user URL is never fetched.
  BLOCKED ON ACT-5 (Drive API key secret) to run end-to-end.
- [x] **IMP-3: XLSX hyperlink + `=IMAGE()` extraction** — DONE. The xlsx branch
  now scans every cell for a hyperlink target (`cell.l.Target`), an
  `=IMAGE("url")` formula, or an inline Drive URL, attaches it to that row, and
  emits an `IMAGE_LINK` column the AI maps into image_url (values-only
  `sheet_to_json` dropped these before).
- [x] **IMP-4: Zip-bomb / resource guard** — DONE. Step1 already caps file size
  (20 MB) + magic-byte sniff; the xlsx branch now also rejects a decoded grid
  over 500k cells before building rows, so a crafted sheet can't blow up the tab.
- [x] **IMP-5: Injection sanitization** — DONE. `sanitizeText` strips leading
  `= + - @` (and control chars) from every text field → CSV/formula injection
  neutralized on re-export. System prompt hardened to treat file content as
  untrusted data and never follow embedded instructions (LLM prompt injection).
- [x] **IMP-6: Post-extraction field validation** — DONE. Before insert every row
  is validated: `clampInt` bounds year (1980..now+2), price (≤20M), mileage
  (≤1.5M), engine_cc (≤12k); strings length-capped; `validImageUrl` requires
  http(s) on drive.google.com/googleusercontent or a direct image path, else
  null — junk like `http://taha40-0011092/` and `javascript:` is dropped.
  Verified with unit tests on the sanitizer/validator.

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

### TIER-2 READINESS AUDIT (2026-08-01) — gaps to close 50–150 unit dealers

Full cross-reference of the Tier 1/Tier 2 feature checklist against code + schema.
Everything else in both tiers verified BUILT — only these three are open. Ranked
by what unblocks closing Tier 2 dealers first.

- [ ] **T2-1: Multi-branch visibility** — MISSING (the only hard structural blocker).
  No `branch_id`/outlet concept exists anywhere in schema or code — the tenant model
  is flat (`dealer_id` only). A 50–150 unit dealer usually runs 2+ outlets and needs
  per-branch stock/GP/sales scoping + a group roll-up. Biggest schema change of the
  three. Scope before building: add `branches` table (dealer_id FK, name, address),
  optional `branch_id` on car_listings/stock_units/leads/profiles, a branch filter in
  the dealer dashboard, and a roll-up view. Keep single-branch dealers unaffected
  (null branch_id = default/HQ). Must respect RLS + `get_my_dealer_id()`.
- [ ] **T2-2: Multi-channel listing push (real feed, not copy-caption)** — PARTIAL.
  Today `src/utils/sharePack.js` formats a caption per platform, `ShareMenu.jsx` opens
  WhatsApp/Facebook share dialogs, and `telegram-notify` auto-posts — but there is NO
  actual API/data-feed push to Carlist/Mudah/IG; the dealer still re-types each car.
  Highest-frequency time-saver + top demo moment. Next step: a semi-automated push
  (data feed export or deep-link prefill) per channel, reusing the sharePack shaping
  layer (already built for exactly this). Investigate Carlist/Mudah feed formats first.
- [x] **T2-3: Standardized appraisal checklist (saved, not a reminder)** — DONE
  (2026-08-03). New `src/components/AppraisalChecklist.jsx` grades 8 inspection areas
  (exterior, interior, engine, transmission, suspension/brakes, electrical/aircon,
  tyres, documents) Good/Fair/Poor with per-area defect notes, deriving an overall
  A-D grade + areas-to-check count. Persisted to a new `stock_units.appraisal` jsonb
  column (additive; existing dealer RLS covers it). Captured optionally in AddCarForm
  intake step 3 (grade hints the recon estimate) AND editable in place from the
  StockTab detail drawer (so legacy + quick-add units can be appraised any time),
  saved via handleSaveAppraisal + logActivity. Compact grade badge on each stock row.
  DELIBERATE non-choices / follow-ups: (1) does NOT auto-cost defects into a recon RM
  figure — that would be fabricated money; the grade informs, the dealer sets recon.
  Add real per-defect cost bands later to auto-suggest. (2) Appraisal photos per area
  not yet captured (grades + notes only). (3) The StockTab quick-add "Add Unit" modal
  still shows only the green reminder — appraise those units from the detail drawer
  after adding.

### MARKETPLACE PERFORMANCE — 2nd audit (2026-08-08)

Context: DB is NOT the bottleneck. Measured `public_car_listings` default query
= ~27ms exec on a tiny dataset (69 listings, 42 active, 23 profiles). The prior
PERF-1..5 audit already fixed the query/RLS layer. Remaining slowness is the
FRONTEND load architecture of the main marketplace (xdrive.my).

- [x] **MPERF-1 (HIGH): Main marketplace loads through a wasted HomePage shell.**
  DONE. `App.jsx` now has a `RootRoute` that branches on the synchronous
  `isSubdomain()`; the main domain renders `MarketplacePage` eagerly and `HomePage`
  is lazy (storefront only). Original note below.
  App.jsx routes "/" → `HomePage` (EAGER). HomePage statically imports
  HeroCarousel (1113 lines), CarCard (830), SearchAutocomplete, Header, Footer +
  all storefront JSX — none of which a main-domain visitor ever sees. On the main
  domain HomePage just shows `<SciFiLoader/>` until `useTenant` settles, then
  renders the LAZY `<MarketplacePage/>` (a 2nd JS round-trip) which only THEN
  fetches cars. Net: bloated eager critical bundle + a serial waterfall
  (eager HP JS → tenant settle → lazy MP chunk → data fetch → paint) on the
  highest-traffic page. FIX: branch on `isSubdomain()` (synchronous, hostname-
  based — no auth wait) at the route level in App.jsx; when NOT a subdomain render
  `MarketplacePage` directly as the "/" element (it is fully self-contained — own
  MarketplaceHeader/Footer/cache, zero HomePage deps). Keep HomePage for the
  subdomain storefront only, and lazy-load it. Removes the HeroCarousel/HomePage
  weight from the marketplace critical path, the tenant-wait, and the extra chunk
  hop in one change. Biggest single win.
- [ ] **MPERF-2 (MED): HeroCarousel (1113 lines) is a static import in HomePage.**
  Even on the subdomain storefront it sits in the critical bundle. Lazy-load it
  with a lightweight placeholder so first paint isn't blocked on it.
  CORRECTION (2026-08-15): HeroCarousel does NOT pull framer-motion — verified.
  Lazy-loading it saves ~10 KB gzipped of its own source and nothing more; do not
  expect the vendor-motion chunk to move with it (see MPERF-8).
- [ ] **MPERF-3 (MED): Images depend on a free third-party proxy (wsrv.nl).**
  `src/utils/img.js cdnImg` routes every storage image through weserv for
  resize/WebP. Works, but adds an external dependency on the LCP path — first-hit
  resize latency + a `cdnTimedOut` fallback already exists because it sometimes
  stalls. When Supabase Pro lands, switch to native Supabase image transforms
  (same-origin, no 3rd party); until then keep weserv but consider width caps.
- [ ] **MPERF-4 (LOW): View still runs a LATERAL join + subquery per row.**
  `public_car_listings` LEFT JOIN LATERAL stock_units (puspakom dates) executes
  per row even though the marketplace CAR_FIELDS never selects those columns
  (~75 buffers, 24 loops in the plan). Negligible at 42 rows but will scale badly.
  Consider splitting a lean marketplace view (no LATERAL/no per-row subqueries)
  from the detail view, or denormalizing seller_role/puspakom onto car_listings.

#### Bundle audit follow-up (2026-08-15)

Method note for whoever picks these up: measured with a static import-graph walk
from `src/main.jsx` (follows local static imports, stops at `import()` boundaries)
plus per-file `gzip -9`. A real `vite build` was NOT possible in the web session —
`npm ci` 403s on `cdn.sheetjs.com` (the ACT-8 xlsx pin) and `npm install` is
sandboxed. Re-measure with a real build before trusting absolute numbers; the
rankings are sound, but gz-of-source overstates JS (it minifies further) and is
accurate for JSON (it does not).

- [x] **MPERF-5: Entry-bundle dead weight** — DONE (2026-08-15). Entry graph went
  52 modules / 448 KB source → 43 / 328 KB. Five things: (1) only the `en` locale
  is bundled now, `ms.json` is a chunk fetched when Malay is active (16 KB gz, the
  single biggest item and an exact saving since JSON does not minify); (2) CarCard
  made lazy at `BodyTypeCarousel` + `SavedCarsPanel` — it had re-entered the entry
  bundle through those two side doors after MPERF-1 removed the HomePage route;
  (3) `LegalModal` lazy in `ConsentBanner` AND `ContactGate` (the latter is the one
  that mattered — it is reachable from every car card); (4) `GoogleOneTap` behind a
  build-time env gate, it was shipping only to return null; (5) deleted the mount of
  a second, entirely unused toast system. NOT yet browser-tested — needs a staging pass.
- [x] **MPERF-6 — CLOSED AS WON'T-DO (owner decision, 2026-08-16). Do not re-open this
  as a perf item; the premise was wrong.** The original entry said ShowroomCard and
  CarCard are "two implementations of one job" to be collapsed. Reading both files says
  otherwise:
  - `ShowroomCard` is a **horizontal row** (`flexDirection:'row'`, 38%/max-210px image
    column, min-height 190px) — built for the marketplace list.
  - `CarCard` is a **vertical tile** (`flexDirection:'column'`, image on top + `cc-body`)
    — built for carousels and card grids.
  They are two LAYOUTS, not two implementations. Merging them yields one component with
  a layout branch — no code removed, and every consumer of both inherits a shared
  regression surface.
  FEATURE DELTA runs one way. CarCard has, ShowroomCard lacks: reserved banner, listing-age
  labels, market price band (below/fair/above), VERIFIED badge, high-value financing
  threshold, `useCompare` integration (ShowroomCard takes compare via props), responsive
  `cdnSrcSet` (ShowroomCard uses a single fixed 480px `cdnImg`), compact mode, subdomain
  theming. Collapsing onto ShowroomCard DROPS those from 6 surfaces incl. the storefront;
  collapsing onto CarCard makes the marketplace grid heavier (opposite of the goal) and
  needs a horizontal mode built.
  FACTUAL CORRECTION: the original entry claimed CarCard "also drags ContactGate +
  GradeBadge" as a differentiator. ShowroomCard imports BOTH (`ShowroomCard.jsx:5`, `:11`).
  That differentiator does not exist.
  PERF PREMISE ALREADY SPENT: the duplication on the marketplace route is real
  (MarketplacePage grid = ShowroomCard, BodyTypeCarousel on the same route = CarCard), but
  MPERF-5 already made that CarCard `lazy()`. It is a below-fold chunk, NOT entry-bundle
  weight — the "~17 KB gz on one route" figure counts a chunk MPERF-5 deliberately deferred.
  DECISION (owner, 2026-08-16): leave the two as-is — they are correctly separate
  components serving different layouts, and keeping them costs nothing now that CarCard
  is lazy on the marketplace route. The alternatives considered and rejected were
  (a) porting CarCard's features into ShowroomCard + adding a vertical mode so the
  carousels could drop CarCard, and (b) a blanket merge into one component with a layout
  branch. Both traded real regression risk across 6 surfaces for no bundle saving.
  LESSON for future audits: "two components doing the same thing" needs a layout/feature
  diff before it is filed as duplication — and a lazy-loaded chunk is not entry-bundle
  weight, so do not price it as though it were.
- [x] **MPERF-7: dead radix toast files — DONE (2026-08-16).** Deleted
  `src/components/ui/toast.jsx`, `src/components/ui/toaster.jsx`, `src/hooks/use-toast.js`
  and dropped `@radix-ui/react-toast` from package.json + package-lock.json (lockfile
  regenerated with `npm install --package-lock-only`, which works even though a full
  `npm ci` still 403s on the cdn.sheetjs.com xlsx pin). Also deleted
  `src/components/CarCardMarket.jsx` — a THIRD card component (141 lines) with zero
  importers that the MPERF audit missed entirely. Verified: sonner remains the only toast
  system and its `<Toaster>` is still mounted (`App.jsx:121`); the only surviving textual
  references are a stale diagram label (`MindMapPage.jsx:484`) and an inert name-map entry
  in `tools/install-missing-components.js:26` (that tool only acts on names that are
  actually imported, so it cannot resurrect the files). NOT lint/build-verified — no
  `node_modules` in the web session; the change is pure deletion of zero-importer files.
- [ ] **MPERF-8 (MED): framer-motion sits on the storefront critical path for two
  trivial animations.** It enters the HomePage chunk via `Header.jsx` (the mobile
  menu panel, gated on `mobileOpen`) and `StickyWhatsAppButton.jsx` (one button
  fade) — nothing else in that graph uses it. That is the whole `vendor-motion`
  chunk (~35 KB gz) for a drawer transition and a fade, both of which are plain CSS.
  Either convert both to CSS transitions and drop the dependency from these two
  components, or lazy-load the drawer. Check the other framer-motion users
  (`CarGallery`, `CalculatorPage`, `FinancingCalculator`, `AmortizationSchedule`,
  `CalculatorInfoSection`) before removing the dep outright — they are all on lazy
  routes, so they can keep it.

### SALESMAN LITE — routing / back-button UX

- [x] **LITE-2: Make each Salesman Lite tab its own route (fix back/swipe = logout)** —
  DONE (2026-08-09). `SalesmanLite.jsx` tabs are now real routes: added
  `/salesman-lite/:tab` in App.jsx; `activeTab` is derived from `useParams()` and
  `setActiveTab` navigates, so every tab switch pushes a history entry and Back/swipe
  returns to the previous tab. Also fixed the second half of the bug — `LoginPage.jsx`
  post-auth redirects now use `window.location.replace()` (via a `go()` helper) instead
  of `window.location.href =`, so `/login` no longer sits in history and backing out of
  the first tab exits cleanly instead of re-showing sign-in.
  FOLLOW-UP: Premium done (PREM-3, 2026-08-22b) — `SalesmanPremium.jsx` now routes
  per-tab the same way. Still open: `Salesmanpanel.jsx` (linked-salesman panel) has
  the same single-route `useState("dashboard")` smell, not yet fixed. Also confirm
  `AuthCallbackPage.jsx` (Google/OAuth) redirect uses `replace()`.

### SALESMAN LITE — account deletion (self-service)

- [x] **LITE-3: Delete-account flow (soft delete + 30-day grace)** — DONE (2026-08-09).
  Settings → Danger Zone "Delete account" (typed-DELETE confirm modal) calls the new
  `delete-account` edge function, which flips the caller's own profile to
  `account_status='deleted'` + `is_active=false` + `deleted_at=now()` (solo salesman
  only; linked salesmen are dealer-managed and blocked). Listings drop from the
  marketplace immediately (`public_car_listings` now excludes deleted owners) and the
  public mini page hides (get_salesman_by_slug already filters `is_active`). Logging back
  in within 30 days shows a Reactivate gate that clears the flags. A daily cron
  (`purge-deleted-accounts-daily`, 02:30 UTC) + the `purge-deleted-accounts` edge
  function hard-delete the auth user after 30 days. Prereq shipped: hardened the
  `NO ACTION` FKs to `profiles.id` (owned data → CASCADE, attribution pointers → SET NULL)
  so the purge — and the existing admin delete in `invites` — cascade cleanly.
  New column: `profiles.deleted_at`.

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

- [x] **NEW-8: Fix document email delivery** — DONE (2026-08-05). `RESEND_API_KEY` + `RESEND_FROM_EMAIL` edge secrets set and `xdrive.my` verified as a Resend sender; the "Send to buyer" button on issued documents now delivers. (ENT-14 unblocked.)

- [x] **NEW-9: Service package tracking** — DONE. `service_packages` table created (dealer_id, customer_id, lead_id, package_name, total_visits, used_visits, valid_months, sold_price, sold_at, expires_at generated column). RLS policy attached. UI in CustomersTab: expand per customer to see packages with visit progress bars; "+ Pkg" inline form; "Log visit" button decrements remaining visits in real-time.

#### TIER 4 — High complexity, longer-term

- [ ] **NEW-10: Workshop module** — Full job card system: service job per vehicle, parts used, labor hours, technician assigned, cost vs. quote, completion status. Parts inventory per VIN/plate. Service history timeline. High build cost but transforms ShiftOS into a full aftersales DMS.

- [ ] **NEW-11: AI car briefing on marketplace search (TikTok-style summary card)** —
  FUTURE BUILD (owner: not now, capture the vision). When a buyer searches the XDrive
  marketplace (e.g. "bmw m4 g82 csl 2024"), render an AI summary card BELOW the search
  bar and ABOVE the showroom results — like TikTok's "Summarised by AI" card in the
  reference screenshot. Owner scope = "full clone + better insights". Insights the card
  must cover:
    1. General car knowledge — engine/output, 0–100, body style, who it's for, key specs.
    2. **Our database** — how many of this exact car XDrive has in stock, from RM X, avg
       mileage, at N dealers, with a CTA into the already-filtered showroom results.
    3. **Market price** — typical MY market range for that model/year/variant, so the
       buyer can judge if a listing is fair.
    4. **Ownership costs** — road tax (by engine CC, official JPJ scale), insurance
       estimate, expected servicing/running cost band.
    5. **Investment view** — is it a good buy / does it hold value (depreciation trend,
       demand, collectibility for cars like the CSL).
    6. Sentiment card (positive/negative %, TikTok-style) — owner wants the full clone.
  BUILD DISCIPLINE (non-negotiable for accuracy — this is a big-ticket purchase, wrong
  numbers = liability + lost trust):
    - GROUND every hard number. Stock count / price / mileage / dealer count come from a
      real `car_listings` query, NOT the LLM. Road tax comes from the official CC scale
      (deterministic calc, not generated). The AI writes the narrative; facts are fed in.
    - Sentiment %s and "good investment" claims MUST be grounded on real signal (scraped/
      sourced review + resale data), not free-form model opinion — otherwise the card
      fabricates confidence. If that data isn't available at build time, ship those two
      sections LAST or gate them; do not let Claude invent them. Frame market/ownership
      figures as estimates.
    - CACHE HARD: normalize the free-text query to a canonical make/model/variant/year
      key; cache generated summaries in a table with a TTL (~30–90d). 2nd search of the
      same car = cache hit, not a paid API call. Without this, every search is billable.
    - The query→canonical-car NORMALIZATION step is the hard part (drives both cache hits
      and matching real listings) — prototype it first, on its own.
    - Reuse the existing `ai-proxy` edge function + prompt-injection-hardened system
      prompt (treat any listing text as untrusted). Slots into `src/pages/HomePage.jsx`
      search flow. Mobile-first card (test at 375px), dark marketplace theme.

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
  entirely). Contact/location block DONE (2026-08-03): storefront "Visit Us" card
  shows the full street address with a Google Maps "Get Directions" link (no API
  key — a maps-search URL built from the address) + a new Opening Hours card;
  dealer logo already renders in the storefront header (RF-1). Settings gained a
  Street Address (location) editor + multi-line Business Hours field; new
  profiles.business_hours column + get_dealer_profile_by_subdomain RPC recreated to
  return it (grants restored, verified as anon). STILL OPEN (both optional):
  1. (Optional) Google reviews integration — pull live reviews via Google Places
     API (needs Maps Platform API key + per-dealer place_id + edge-function proxy).
  2. (Optional) demote hero carousel + add on-page inventory search/filter; detail
     page can adopt dconcept.my framed gallery + status+code line + clean spec grid.

### DEALER DASHBOARD UX/BUG AUDIT (2026-06-07) — all DASH-1..9 shipped

Note: send-telegram, invites, ai-proxy and create-salesman edge functions have
the same `baggage`/`sentry-trace` CORS header fix applied in source (DASH-5) but
are NOT yet redeployed — only send-document was redeployed (the reported blocker).
Redeploy the other four when convenient to prevent the same Sentry preflight issue.

### PUBLIC CAR DETAIL PAGE (CarDetailPage) — engagement backlog

- [x] **CDP-COMMENTS: Comments / Q&A on listings** — DONE (2026-08-03).
  `src/components/comments/CommentsSection.jsx` renders a threaded Q&A block under
  Reviews on CarDetailPage (both mobile + desktop layouts). New `listing_comments`
  table (listing_id, dealer_id, author_id, author_name, body, parent_id, status,
  created_at) with RLS: public read of visible rows, authenticated own-write, dealer
  moderation via get_my_dealer_id(); dealer_id stamped by a BEFORE INSERT trigger so
  it can't be spoofed. Reply from the listing's dealer account gets a Seller badge
  derived from the author id (tamper-proof). Delete-own + honest empty state.
  DELIBERATE scope choice: posting is AUTHENTICATED-ONLY (no anonymous writes) — this
  removes the spam surface so it ships without the Turnstile CAPTCHA (ACT-10). Follow-
  ups when ACT-10 lands: allow anonymous captcha-gated posting, a report/flag path,
  and a dealer moderation queue in the dashboard (hide is possible via RLS today but
  has no UI yet).
- [x] **CDP-REVIEWS: Buyer reviews / ratings** — DONE. `reviews` table + RLS live;
  `src/components/reviews/ReviewsSection.jsx` (rendered on CarDetailPage) does
  logged-in buyer reviews, star rating, live average/count, one-review-per-buyer
  upsert, and an honest "No reviews yet" empty state (no fabricated defaults).
  OPTIONAL future enhancement (not blocking): a `verified_purchase` flag tied to
  a won deal to show "verified" stars — deliberately omitted for now, and the
  component is honest that reviews are not purchase-verified.

### INFRASTRUCTURE & APP-STORE READINESS AUDIT (2026-08-15)

Scope: infra rating + "do we need load balancing" + what it takes to ship on the App
Store / Play Store later. Verified against LIVE state (Supabase MCP advisors, `pg_indexes`,
`pg_stat_user_tables`, Vercel project API), not from memory.

**Headline: there is nothing to load-balance.** Vercel and Supabase both autoscale their
own compute — there is no LB for us to configure and no need for one. The real ceiling is
the Supabase PLAN TIER: org `Xdrive` is on **free** (nano compute, `max_connections=60`,
no read replica, no autoscale). Live now: 43 MB DB, 14 open connections, biggest table
`analytics_events` at 6,847 rows. Current scale is trivial; the constraint only bites when
mobile traffic patterns (background refresh, push-triggered opens) land. That is a
"upgrade the box" problem, not an architecture problem — do NOT build sharding/LB/queueing
for it.

Verified benign (do not re-audit): the 3 `rls_enabled_no_policy` INFO lints
(`auth_login_throttle`, `ops_alert_state`, `plan_config`) are correct-by-design — all three
are server/SECURITY-DEFINER-only tables, and `plan_config` is mirrored client-side as a
plain JS file (`src/utils/planConfig.js`), never queried. RLS-on + zero-policies = deny-all
to the client, which is the intent.

#### DB scale debt (from Supabase advisors — real counts, all currently harmless at 43 MB)
- [x] **INFRA-2: Drop duplicate indexes** — DONE (2026-08-15). Two identical index pairs
  were costing double write amplification for zero read benefit: `leads`
  {`idx_leads_dealer_stage`, `leads_dealer_stage_idx`} and `deal_products`
  {`deal_products_dealer_id_idx`, `idx_deal_products_dealer_id`}. Dropped the redundant
  one from each pair (kept the `idx_`-prefixed name for consistency).
- [ ] **INFRA-3 (HIGH at scale): `auth_rls_initplan` — 115 policies re-evaluate `auth.uid()`
  PER ROW.** Worst on the hot tables: `car_listings` (13), `leads` (7), `profiles` (5),
  `appointments` (5), `salesman_notifications` (5). FIX: wrap the call as
  `(select auth.uid())` so Postgres evaluates it once per query instead of per row. Same
  CLASS of bug as the shipped PERF-1 fix (marking helpers STABLE) but a different mechanism
  — PERF-1 did NOT fix this. NOT a quick job: 115 policies, and CLAUDE.md's RLS rule
  ("test with a real row read before shipping") applies to every one. Do it as its own
  session, hot tables first, and re-run the advisor after.
- [ ] **INFRA-4 (MED at scale): `multiple_permissive_policies` — 150 instances.**
  `profiles` (24), `car_listings` (19), `leads` (18), `appointments` (12),
  `loan_applications` (10). Every redundant PERMISSIVE policy on the same table+action is
  OR'd and evaluated per row, so they multiply RLS cost. Consolidate overlapping policies
  per (table, role, action). Pairs naturally with INFRA-3 — same tables, same test pass.
- [ ] **INFRA-5 (LOW, deliberately deferred): 62 unindexed foreign keys.** DO NOT bulk-add
  all 62 — that is cargo-culting the linter. Live row counts say every flagged table is
  tiny (`lead_activities` 196, `leads` 130, `appointments` 88, `car_listings` 69,
  `workshop_jobs` 0 — that module isn't built). Postgres seq-scans these faster than an
  index scan, and the advisor ALREADY flags 27 `unused_index` — adding 62 more makes write
  amplification and advisor noise worse today for zero read benefit. TRIGGER TO REVISIT:
  when `leads` or `lead_activities` clears ~10k rows, or the advisor starts reporting real
  seq scans on them. Then add only the hot-path ones: `leads.car_listing_id`,
  `lead_activities.dealer_id`, `appointments.car_listing_id`, `salesman_listings.listing_id`
  (the composite UNIQUE(salesman_id, listing_id) does NOT cover a listing_id-only lookup —
  wrong leading column).
- [ ] **INFRA-6 (REVIEW, not a fix): 2 `security_definer_view` ERRORs** — `public_car_listings`
  and `public_dealer_profiles`. These are DELIBERATE (CRIT-0: anon marketplace read without
  reopening a broad anon SELECT policy on `profiles`) and must stay. But SECURITY DEFINER
  views bypass RLS entirely, so a future `ALTER TABLE car_listings/profiles ADD COLUMN`
  can silently start exposing that column to anonymous visitors. ACTION: do a one-time
  column-by-column review of what each view selects, and add a standing rule — after ANY
  column added to `car_listings` or `profiles`, re-check both views. (This is the same
  discipline CLAUDE.md already requires for keeping `public_car_listings` updated; it needs
  a SECURITY note attached, not just a "remember to add the column" note.)
- [ ] **INFRA-7 (LOW): `car_listings` carries 20 indexes on 69 rows.** Clearly built for the
  marketplace filter paths (brand/year/price/state/body_type/trgm partials) so most will
  earn their keep at scale — but every one is write cost on every listing insert/update
  today. Re-check against the `unused_index` advisor once there is real marketplace traffic
  and drop whatever never gets scanned.
- [x] **INFRA-8: Edge rate limiter VERIFIED WORKING (was ACT-11, closed 2026-08-15).**
  The Upstash limiter in `middleware.js` protecting the 6 public API routes is live in
  production. Env vars were correct and present all along; no change was needed.
  **How it was proven, and the trap to avoid repeating:** the obvious probe — burst requests
  at a protected route and expect a 429 — **gives a FALSE NEGATIVE from any cloud/agent
  session.** The limiter keys on `x-forwarded-for`, and Vercel's fetcher
  (`web_fetch_vercel_url`, the only way out when the agent proxy 403s both `xdrive.my` AND
  `*.vercel.app`) rotates source IPs, so every request lands on its own counter and NOTHING
  ever trips. 26 probe requests across `/api/waitlist`, `/api/booking` and `/api/enquiry`
  returned 26x 405 / zero 429 — which reads exactly like a dead limiter but is not.
  **The reliable test is the Upstash Usage counter, not the response codes:** note COMMANDS
  before, fire a burst, refresh. Measured: 193 → 249 (+56 commands for 11 requests, ~5 per
  `limit()` call = the sliding-window Lua footprint) and STORAGE 0 B → 136 B as the `rl:*`
  keys materialised. That is proof the middleware reached Redis.
  Corollary: real users have stable IPs, so production IS protected even though a cloud
  probe cannot demonstrate it. Do NOT "fix" a non-existent fail-open based on 405s alone.
  Also do NOT trust the Upstash **Data Browser** for this — sliding-window keys carry a TTL
  equal to the window (60s for booking, 300s for waitlist), so it reads empty minutes later
  regardless of whether the limiter works. Usage counters are cumulative and TTL-proof.
  Still true and worth keeping: a MALFORMED value (e.g. the surrounding double quotes from
  the Upstash console's `.env`-style Connect snippet pasted into Vercel's UI, which does not
  strip them) fails CLOSED with 500s on all six endpoints — so a 500 on `/api/enquiry` or
  `/api/whatsapp-lead` means a bad env VALUE, not a handler bug. Vercel env vars are also
  scoped per environment (Production must be ticked) and need a redeploy to reach a running
  deployment.

#### Mobile / app-store readiness
Reality check: the PWA foundation is genuinely good — `vite.config.js` VitePWA is carefully
configured (manifest, 192/512 icons, standalone, deliberate `registerType:'prompt'` +
globIgnores to dodge the stale-SW blank-page trap), and `PrivacyPage.jsx` / `TermsPage.jsx`
already exist (both stores require them). Android via a Trusted Web Activity would work
close to as-is. iOS will NOT accept a bare WebView wrapper (App Review guideline 4.2,
"minimum functionality"). The items below are what actually stands between us and a
native build.

- [x] **PWA-1: installability pass — DONE (2026-08-16).** The manifest and service
  worker were solid, but nothing in the app ever invited an install and iOS had no
  icon. Shipped: (a) `index.html` gained `apple-touch-icon` (iOS reads almost none of
  the web manifest for Add to Home Screen — without it iOS screenshots the PAGE and
  uses that as the home-screen icon), `theme-color`, `apple-mobile-web-app-capable` +
  `-title`, and `viewport-fit=cover`; status bar is `black` not `black-translucent`
  on purpose, since translucent extends the webview under the notch and would need a
  safe-area audit of every panel. (b) manifest gained `id: '/'` (pins install
  identity — without it the identity derives from `start_url`, so changing start_url
  later would orphan existing installs), `scope`, `lang`; `orientation` left unset on
  purpose because the wide stock/P&L tables are better in landscape on a tablet.
  (c) new `InstallPrompt` — Android via `beforeinstallprompt`, iOS Safari via a
  Share-sheet hint, 30-day snooze on dismiss, suppressed in in-app webviews
  (FB/IG/TikTok cannot install). Scoped to the authenticated panels ONLY, the inverse
  of ConsentBanner's gate: install is worth real money to a daily dealer/salesman user
  and ~nothing to a marketplace buyer, so the public surfaces stay clean. Verified:
  lint + build clean, precache still excludes `index.html`/`index-*.js` (stale-SW
  guard intact), 375px screenshot, entry bundle +0.75 kB gzip with the card split into
  its own lazy chunk.
- [x] **PWA-2: offline fallback page — DONE.** `runtimeCaching` entry matching
  `request.mode === 'navigate'` with handler `NetworkOnly` plus a `handlerDidError`
  plugin returning `caches.match('/offline.html')` (`vite.config.js`), precached via
  `additionalManifestEntries` with revision pinned to `pkg.version`. index.html stays
  network-fresh; only a genuine network failure on a real navigation gets the fallback.
  Verified in a real build: `/offline.html` shows up in the generated precache list and
  the navigate route registers exactly as intended; the stale-`index.html` guard
  (globIgnores) is untouched. Also added `OfflineBanner` (mounted in `App.jsx`,
  `src/components/OfflineBanner.jsx`) for the more common case this alone doesn't
  cover — losing connectivity mid-session inside the SPA, where no navigation ever
  happens so the service-worker fallback never triggers. It listens for
  `online`/`offline` and shows/auto-hides a small top toast; no dismiss button, it
  disappears on its own once `navigator.onLine` flips back.
- [ ] **PWA-3: icon does not match brand (design decision needed).** `pwa-512x512.png`
  is the logo on a WHITE background, but the manifest declares
  `theme_color`/`background_color: #080C14`, so the Android splash renders a white
  icon block on near-black. The logo does sit inside the maskable safe circle, so
  `purpose: 'any maskable'` is fine as-is. Deliberately not changed — regenerating a
  brand asset is your call, not a silent refactor. Options: (a) leave it, (b) re-cut
  the icon on the #080C14 background, (c) set `background_color` to white so the
  splash matches the icon.
- [ ] **MOBILE-1 (DO THIS ONE EARLY — ACT-7 reclassified): migrate auth to PKCE.**
  `src/supabaseClient.js` sets no `flowType`, so it defaults to **implicit** (tokens land in
  the URL hash). TODO has this filed as ACT-7 "optional, deferred". For a native/wrapped app
  it stops being optional: OAuth, magic-link and password-reset callbacks inside a
  Capacitor/RN WebView need PKCE + a custom URL scheme or Universal/App Links, and implicit
  flow does not survive that handoff reliably. This is the ONE item where deferring makes it
  MORE expensive — the risk is regressing `AuthConfirmPage` (token_hash) and
  `ResetPasswordPage` (`type=recovery`) parsing, and that blast radius only grows with the
  user base. Do it now while it's small, with its own tested pass. Do NOT flip `flowType`
  blindly.
- [ ] **MOBILE-2 (BLOCKING DECISION — gates MOBILE-3 and MOBILE-4): pick the native path.**
  Capacitor-wrapping this React app vs a separate React Native client. This single call
  determines the shape of the push-notification work, the CORS allowlist change, and whether
  iOS 4.2 is satisfiable. Decide before any native work starts. Recommendation: Capacitor —
  it reuses this codebase, and 4.2 is clearable by shipping native capabilities (push,
  camera for listing photos, biometric unlock) rather than a rebuild.
- [x] **MOBILE-3 — CORRECTED AND LARGELY DONE (2026-08-16).** The original entry said "no
  push notification infrastructure exists (no FCM/APNs anywhere in the repo)". That was
  wrong, and wrong in the expensive direction: **web push was ~60% built months ago, live
  on Supabase, and simply never committed to this repo.** `grep` over `src/` found nothing
  because none of it was ever in git — the DB and the deployed edge functions were the only
  record. LESSON: never conclude a backend feature "does not exist" from a repo search;
  check `list_edge_functions`, `pg_proc` and `pg_trigger` first.
  What already existed: `send-push` + `send-push-warm-leads` edge functions, the
  `push_subscriptions` table (8 rows / 2 users, all 2026-05-27), and triggers
  `trg_push_on_enquiry` / `trg_push_on_appointment`. Also note web push needs NO native
  wrapper — it does not depend on MOBILE-2, and iOS works once the PWA is installed (PWA-1).
  FOUR separate faults were keeping it dead, all now fixed:
  1. **`send-push` had never booted, not once.** `webpush.setVapidDetails()` ran at module
     scope and threw on a malformed `VAPID_PRIVATE_KEY`, killing the worker before `serve()`
     — every call returned an opaque `WORKER_ERROR`. Now wrapped in try/catch and returns
     `{error:'vapid_misconfigured', detail:...}` so the cause is visible.
  2. **Both triggers were no-ops.** They gated on `current_setting('app.anon_key')`, which
     was never set, so every enquiry/appointment hit the early return. Repointed at a new
     `public.push_to_users()` sender that reads a Vault secret.
  3. **No subscribe path existed anywhere in git history.** Added
     `src/hooks/usePushNotifications.js` + `src/components/PushToggle.jsx`, wired into
     Salesman Lite, Salesman Premium, the linked salesman panel and the dealer dashboard.
  4. **No service-worker `push` handler**, so a delivered push would have shown Chrome's
     generic "site updated in background". Added `public/push-sw.js` via workbox
     `importScripts` (NOT injectManifest — that would rebuild the precache config behind
     the two outages documented in vite.config.js).
  Also fixed while in there: `send-push` was publicly callable (verify_jwt=false, CORS `*`,
  `user_ids` straight from the body = anyone could push to any user). Now requires either
  the shared secret (servers, any target) or a user JWT (forced to self), failing closed.
  New DB objects: `public.push_to_users`, `public.get_push_secret`, `public.get_cron_edge_key`,
  triggers `trg_push_on_dealer_notification` / `trg_push_on_salesman_notification`.
  End-to-end verified 2026-08-24 — see ACT-12 (now resolved) above.

- [x] **PUSH-3 (CRITICAL, found + fixed 2026-08-16): `push_to_users` took down BOTH public
  lead-capture paths.** It passed the request body to `net.http_post` as `::text`, but pg_net
  0.20 only exposes `http_post(url, body jsonb, params, headers, timeout)`. No overload
  matched → `42883` → the whole calling transaction aborted. Because every insert into
  `salesman_notifications` / `dealer_notifications` fires a push trigger, this killed the
  public booking form (`appointments` → `notify_salesman_new_booking`) AND every WhatsApp
  enquiry (`whatsapp_enquiries` → `notify_new_enquiry`). Both returned 500; no lead reached
  any pipeline. Shipped with the push work in #278 and live for the whole window.
  Fixed: body is jsonb; plus an `exception when others` guard in `push_to_users` and in both
  `notify_push_on_*_notification` triggers so a notification failure can NEVER roll back the
  business write that triggered it. LESSON: a trigger that decorates a core write (push,
  Telegram, analytics) must be non-fatal by construction — `notify_ops_telegram` already had
  the guard, the push path did not. Check this on any new AFTER-INSERT notifier.

- [ ] **CDP-1 (LOW): `salesmanProfile.job_title` never renders.** Both salesman cards on
  `src/pages/CarDetailPage.jsx` (mobile ~:2522, desktop ~:3562) render
  `{salesmanProfile.job_title && ...}`, but the profile comes from the `get_salesman_by_id`
  RPC, whose RETURNS TABLE has no `job_title` column — so it is always `undefined` and the
  line is dead. Fix: add `job_title` to the RPC's return, or drop the line. Noticed while
  fixing the contact buttons; not touched to keep that change focused.

- [x] **CDP-2 (HIGH, fixed 2026-08-16): the Call button leaked the seller's number to
  crawlers and dialled the wrong line.** Three separate faults, all real:
  1. CRAWLABLE. `vercel.json` rewrites bot user-agents to `/api/og`, and that handler emitted
     the number as structured JSON-LD — `AutoDealer.telephone` on every car page and
     `Person.telephone` on every agent page. The UA list includes googlebot, bingbot and the
     AI scrapers (GPTBot, ClaudeBot, PerplexityBot, ia_archiver). Both fields removed, and
     `whatsapp_number` dropped from the prerenderer's dealer select since nothing uses it now.
  2. WRONG NUMBER. It dialled `whatsapp_number`, but `profiles.phone` exists and is populated
     on 13/14 sellers — and DIFFERS from the WhatsApp number on 3 of them, so those sellers
     were getting calls on the wrong line. It also read `dealer?.whatsapp_number ||
     salesmanProfile?.whatsapp_number`, so the dealer's main line beat the rep who actually
     owns the listing.
  3. HARVESTABLE. The number shipped in the page payload on load, and `get_dealer_profile_by_id`
     / `get_salesman_by_*` hand one out to anon for ANY id, with dealer ids enumerable straight
     out of `public_car_listings` — so a bot never even had to load the page.
  Fix: new `get_listing_call_number(p_listing_id)` SECURITY DEFINER RPC returns ONE number for
  ONE listing, resolving the responsible seller via `resolve_lead_salesman` (rep, else dealer)
  and preferring `phone` over `whatsapp_number`. It refuses any listing the public cannot see
  (not available/reserved, or inactive dealer) and answers 404 identically for "no number" and
  "not visible" so it cannot be used to probe what exists. Called only on tap through the new
  `/api/call-number` route, rate-limited 6/IP/min in `middleware.js`. Nothing lands in the page
  payload. Verified as anon: assigned-rep listing returns the REP's line where the old code
  returned the dealer's; sold and bogus listing ids both return null.
  NOTE: deliberately NOT gated behind a form (owner decision). A buyer tapping Call is the
  highest-intent action on the page and pre-call friction loses calls, so Call still captures
  no lead — that is intended, not a missing-lead bug.

- [ ] **CDP-3 (MED): WhatsApp numbers still ship in the page payload.** CDP-2 closed the Call
  button and the crawler surface, but the wa.me CTAs still need a number at page-load time, so
  `get_dealer_profile_by_id` / `get_salesman_by_id` / `get_salesman_by_slug` /
  `get_dealer_profile_by_subdomain` continue to return `whatsapp_number` to anon for any id —
  the bulk-harvest vector is open for WhatsApp even though it is closed for the call line.
  Closing it means moving every wa.me build to on-tap (the enquiry modal already defers the
  actual open to submit time, so CarDetailPage is most of the way there) and then stripping the
  number from those RPCs. Blast radius is why it was deferred: storefront header,
  StickyWhatsAppButton, car cards, ContactGate and useCTAContext all read it at load. Needs its
  own tested pass with a full staging sweep.

- [ ] **PUSH-2 (MED): solo Salesman Lite gets no `salesman_notifications` row for an organic
  enquiry.** `notify_salesman_new_enquiry` resolves the rep from `NEW.salesman_id`, then
  `ref_slug`, then falls back to looping `profiles WHERE dealer_id = NEW.dealer_id`. A solo
  Lite salesman owns themselves (`dealer_id IS NULL`), so that loop matches NOBODY and no
  salesman notification is written. It is missing rule 4 of the `resolve_lead_salesman`
  doctrine in CLAUDE.md ("the dealer IS a self-owned salesman → attribute to them") — the
  exact inline-reimplementation drift that section was written to prevent.
  IMPACT IS LIMITED, which is why this is not a blocker: the Lite user still gets the PUSH,
  because they are their own dealer and `notify_new_enquiry` writes a `dealer_notifications`
  row that the push fan-out picks up. What they miss is the in-app salesman bell entry.
  FIX: make `notify_salesman_new_enquiry` call `resolve_lead_salesman()` instead of its own
  inline resolution, so there is one resolver again. Verify no double-notify results (the
  same person would then be both dealer and salesman for that enquiry — dedupe by user id).

- [x] **CRON-1: two cron jobs had never once succeeded (found + fixed 2026-08-16).**
  `expiry-reminders-daily` and `warm-leads-push` both built their auth header as
  `'Bearer ' || current_setting('app.service_role_key'|'app.anon_key', true)`. Neither GUC
  has ever been set, and in SQL `'text' || NULL` is NULL — so the entire headers value went
  NULL and the statement errored. `cron.job_run_details` showed status='failed' for every
  run. **Consequence: the road tax / insurance / overdue-handover reminder system (NEW-6,
  NEW-7) has never delivered a single notification since it shipped.** Fixed by copying the
  working token from `appointment-reminders` (the only job that was succeeding, because it
  carries a literal) into Vault as `cron_edge_key`, adding `public.get_cron_edge_key()`, and
  rebuilding both commands with `jsonb_build_object` so a null value can never collapse the
  whole object again. NOT yet verified end-to-end — next scheduled runs are 00:00 UTC
  (expiry-reminders) and 09:00 UTC (warm-leads). Check `cron.job_run_details` after those.
  WATCH: `notify-price-alerts` and `appointment-reminders` carry literal JWTs inline in
  `cron.job.command`. They work, but the token is sitting in plaintext in the job table and
  will break silently whenever it is rotated — move them to `get_cron_edge_key()` too.
- [ ] **MOBILE-4: edge function CORS allowlist will reject the native origin.** `invites`,
  `create-salesman`, `send-document` and `import-drive-images` all hard-allowlist
  `https://xdrive.my` / `*.xdrive.my` / localhost. A native shell's origin
  (`capacitor://localhost` or similar) gets silently rejected by every one of them. Cheap
  one-line fix per function — but easy to forget until a store build mysteriously breaks, so
  it is logged here. Depends on MOBILE-2 for the exact origin string.
- [ ] **MOBILE-5: subdomain tenancy does not map onto a single app bundle.** `useTenant.js`
  resolves the dealer from the hostname (`<sub>.xdrive.my`); a native app has one fixed
  origin and no address bar. Not a bug today — but decide the in-app dealer-switching model
  (login-derived tenant vs an explicit picker) BEFORE more logic gets baked into hostname
  detection, or this becomes a rewrite instead of an addition.

### INFRASTRUCTURE

- **INFRA-1: Supabase storage cleanup** — Storage is full. Audit bucket usage, delete orphaned images (listings that were deleted but images remain), consider image compression pipeline or CDN offload. (Requires manual review of what to delete — user decision needed.)

### FOLLOW-UP / MINOR

- [x] **ENT-14: Document email delivery UI** — DONE (2026-08-05). Unblocked by NEW-8 (RESEND secrets set + sender verified). "Send to buyer" on issued documents delivers the HTML doc via the `send-document` edge function / Resend.

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
- **V3: Salesman Lite vs Premium gates confirmed** — Lite: dashboard, listings, leads, inbox, performance. Premium (salesman_full): loans/HP submissions, financing (bank comparison) calculator, AI features, Outreach Hub. Gated via `isPremium = profile.plan === 'salesman_full'` in SalesmanPremium.
  **CORRECTED 2026-08-22b:** this entry originally also claimed "deal sheet
  generator" and "customer records" — verified false, neither exists in
  `SalesmanPremium.jsx`. See PREM-4/PREM-5/PREM-6 in Dev tasks above.
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
