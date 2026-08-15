# ShiftOS — Pending Tasks

## ⚠️ USER ACTION REQUIRED — remind every session until done

- **ACT-1: Enable TOTP in Supabase dashboard — DEFERRED until revenue (user: paid)** — 2FA (SEC-1) will not work end-to-end until the TOTP factor type is enabled: Supabase → Authentication → Settings → Multi-Factor → enable **TOTP**. Until then, the "Enable 2FA" button in Settings will error on enroll. Owner is deferring this until revenue/Supabase Pro (treats it as a paid feature — note: standard app-based TOTP MFA is typically free on Supabase; the paid MFA add-on is Phone/SMS, which we are avoiding anyway — worth re-checking billing before permanently shelving). Interim idea from owner: keep Gmail/Google link verification and add an email verification code as a lightweight second factor. NOTE (2026-08-05): TOTP is NOT deprecated — Bank Negara's RMiT (28 Nov 2025) bans **SMS OTP** as a standalone factor, not TOTP. TOTP (authenticator-app codes, RFC 6238) is offline/device-local and is one of the regulator's recommended interception-resistant replacements, so it stays the correct choice here. Do NOT enable Supabase's Phone/SMS OTP factor. Passkeys (FIDO2/WebAuthn) are the gold standard but are not a native Supabase MFA factor yet.
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

> Reminder protocol: while ACT-2, ACT-4, ACT-9 or ACT-10 remain here, surface them at session start and whenever security/auth/import/dependency work is touched. (ACT-3, ACT-5 and NEW-8 completed 2026-08-05. **ACT-8 was found ALREADY COMPLETE and removed 2026-08-15** — `package.json` AND `package-lock.json` both resolve `xlsx` to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, and `vercel.json` CSP already whitelists `cdn.sheetjs.com` in connect-src; it had been sitting in this list as a blocked user-action for weeks after the fact. ACT-1 and ACT-6 are deferred until revenue/Supabase Pro — do not nag until then.) LESSON: verify an ACT item against the code before re-surfacing it — a stale nag costs a session's attention every time.

## Dev tasks

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

- [ ] **MPERF-1 (HIGH): Main marketplace loads through a wasted HomePage shell.**
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

### SALESMAN LITE — routing / back-button UX

- [x] **LITE-2: Make each Salesman Lite tab its own route (fix back/swipe = logout)** —
  DONE (2026-08-09). `SalesmanLite.jsx` tabs are now real routes: added
  `/salesman-lite/:tab` in App.jsx; `activeTab` is derived from `useParams()` and
  `setActiveTab` navigates, so every tab switch pushes a history entry and Back/swipe
  returns to the previous tab. Also fixed the second half of the bug — `LoginPage.jsx`
  post-auth redirects now use `window.location.replace()` (via a `go()` helper) instead
  of `window.location.href =`, so `/login` no longer sits in history and backing out of
  the first tab exits cleanly instead of re-showing sign-in.
  FOLLOW-UP (not done this session): Premium (`SalesmanPremium.jsx`) and the linked
  panel (`Salesmanpanel.jsx`) have the same single-route `useState("dashboard")` smell —
  apply the same per-tab routing to them. Also confirm `AuthCallbackPage.jsx`
  (Google/OAuth) redirect uses `replace()`.

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
- [ ] **MOBILE-3: no push notification infrastructure exists** (no FCM/APNs anywhere in the
  repo). Today "notifications" are DB rows (`dealer_notifications` / `salesman_notifications`)
  visible only while a tab is open. For a lead-response CRM, an app that cannot notify while
  closed is materially WORSE than the web version — this is the main thing that would make a
  native build worth downloading at all. Not urgent now, but keep the notification data model
  additive so FCM/APNs slots in without a rework. Note: expiry-reminders + overdue-handover
  already generate the right events; only delivery is missing.
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
