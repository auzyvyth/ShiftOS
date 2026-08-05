# XDrive Marketplace — Launch Readiness TODO

Source: security + performance audit (2026-08-05). Findings verified against the
live Supabase DB (`lemdkdizdlcirhbzqlos`) and the code on branch
`claude/xdrive-marketplace-readiness-0egqwn`.

Legend — **Effort**: S (<1h) / M (half day) / L (multi-day). **Risk**: risk of the
FIX itself breaking something. Priority tiers are ordered for a thousands-of-listings
public launch.

Overall verdict: **security is strong, no critical data-exposure hole found.** The
real blocker is one scalability item (the marketplace view). Notifications have a
clean one-line root cause.

---

## P0 — Blockers before public launch

- [ ] **P0-1 · Verify Turnstile + rate-limiter env vars are set in production**
  Both the captcha (`lib/turnstile.js:18`) and the edge rate-limiter
  (`middleware.js:53`) **fail open** when their secrets are unset — the site keeps
  working but with no bot protection at the edge. Only the DB-level rate caps remain.
  Confirm in Vercel prod: `TURNSTILE_SECRET`, `VITE_TURNSTILE_SITE_KEY`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
  Effort: S · Risk: none (config check).

- [ ] **P0-2 · De-hotpath the market-average aggregate in `public_car_listings`**
  The view recomputes a full-table aggregate (`GROUP BY lower(brand), lower(model),
  year-bucket HAVING count>=3`) on **every** query — every paginated fetch, every
  filter, every homepage load. Free at 68 rows; a full table scan + hash aggregate
  per request at thousands+. **This is the scaling wall.**
  Fix: move `market_avg_price` / `market_sample_count` into a materialized view (or a
  small rollup table) refreshed on a schedule (e.g. hourly cron), and join to that
  instead of the inline subquery. Rebuild `public_car_listings` on top of it.
  Where: view def in DB; consumers `MarketplacePage.jsx`, `HomePage.jsx:333`.
  Effort: M · Risk: M (view rewrite — test every marketplace filter after).

- [ ] **P0-3 · Add `salesman_notifications` + `whatsapp_enquiries` to Supabase Realtime**
  Root cause of "salesman-lite notifications only appear on each visit." The client
  already subscribes (`SalesmanLite.jsx:1340`, `SalesmanPremium.jsx`), but the
  `supabase_realtime` publication contains only `appointments, car_listings,
  dealer_notifications, leads` — so Postgres never broadcasts these two tables.
  Fix (production DB change — get sign-off first):
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.salesman_notifications;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_enquiries;
  ```
  RLS already scopes both to the owning salesman, so realtime will deliver correctly.
  Zero frontend changes. Dealers already work (`dealer_notifications` is published).
  Effort: S · Risk: low.

---

## P1 — High (do before or immediately after launch)

- [ ] **P1-1 · Add indexes for the marketplace query shape**
  Filters on `brand, body_type, state, year, selling_price, mileage, fuel_type,
  transmission` and sorts on `created_at`/`selling_price` have **no supporting
  index** (existing indexes are all `dealer_id`/`status` combos for the dashboard).
  At thousands of rows every filtered browse is a seq scan + sort.
  Add e.g. partial/composite indexes: `(status, created_at DESC)`,
  `(status, selling_price)`, and btrees on `brand`, `body_type`, `state`, `year`.
  Where: `car_listings`. Effort: S · Risk: low.

- [ ] **P1-2 · Switch marketplace `count: 'exact'` to estimated/planned**
  `MarketplacePage.jsx:193` runs an exact COUNT over the whole (aggregate-heavy) view
  on every page + every "load more," roughly doubling P0-2's cost. Use an estimated
  count, or only count on page 1. Effort: S · Risk: low.

- [ ] **P1-3 · Index or FTS the keyword search**
  `MarketplacePage.jsx:200` uses `ilike '%term%'` (leading wildcard → can't use a
  btree → seq scan per search). Add a `pg_trgm` GIN index on brand/model/variant, or
  route search through the existing `search_listing_terms` function (currently unused
  by MarketplacePage). Effort: M · Risk: low.

- [ ] **P1-4 · Strip `_r=` from the URL after the post-deploy reload**
  The cache-busting reload (`main.jsx:42-46`) leaves `?_r=<timestamp>` in the address
  bar, polluting analytics and canonical URLs. After load, if `_r` is present, remove
  it via `history.replaceState`. Effort: S · Risk: low.

- [ ] **P1-6 · Triage + fix the 21 Dependabot vulnerabilities**
  GitHub reports **21 vulns on the default branch: 14 high, 6 moderate, 1 low**
  (surfaced on `git push`). These are dependency CVEs, separate from the app-code
  audit. Do NOT blind-run `npm audit fix --force` — forced major upgrades on a Vite +
  React + Supabase app can break the build. Instead:
  1. `npm install` then `npm audit --json` to get the real advisory list + which are
     dev-only (build tooling) vs runtime (shipped to browser). Cross-check the
     Dependabot dashboard: https://github.com/auzyvyth/ShiftOS/security/dependabot
  2. Prioritize **runtime** high-severity first (anything bundled into the client or
     used by the `api/*` serverless + edge functions); dev/build-only advisories are
     lower real-world risk for a static SPA.
  3. Apply non-breaking `npm audit fix` (patch/minor) first; take Dependabot's
     individual PRs for the rest and run `npm run build` + smoke test each.
  4. Likely heavy/at-risk deps to check: `xlsx`, `jspdf`, `html2canvas`, transitive
     build-chain packages. Confirm against the actual audit output — do not assume.
  Effort: M · Risk: M (upgrades can break build/runtime — verify each).

- [ ] **P1-5 · Confirm no precached vendor chunk exceeds the 3 MB SW cap**
  If a `vendor-*` chunk is over `maximumFileSizeToCacheInBytes: 3MB`
  (`vite.config.js:86`), the SW precache install fails, the worker never settles, and
  every visit re-triggers install → `controllerchange` → reload (a pathological
  every-visit version of the `_r` reload). Run `npm run build`, inspect
  `dist/assets/*.js` sizes. Likely fine (heavy chunks are in `globIgnores`), but
  verify. Effort: S · Risk: none (diagnostic).

---

## P2 — Medium (hardening / hygiene)

- [ ] **P2-1 · Enable leaked-password protection (HIBP)** in Supabase Auth. One
  toggle, free. Flagged by the security advisor. Effort: S · Risk: none.

- [ ] **P2-2 · Move `pg_net` extension out of the `public` schema.** Advisor WARN;
  hygiene. Effort: S · Risk: low.

- [ ] **P2-3 · `analytics_events` growth plan.** Already 6,269 rows for 68 listings
  (~92/listing) and grows fastest. `get_car_analytics` scans it per dashboard load.
  Add time-based indexes and a retention/rollup strategy before it hits millions.
  Effort: M · Risk: low.

- [ ] **P2-4 · Lazy-load `framer-motion` off the public first-load path.**
  `vendor-motion` (~50-100 KB gz) is on the public marketplace critical path. Consider
  code-splitting the animated sections. Effort: M · Risk: low.

- [ ] **P2-5 · Process guard: never upload IC/geran scans to the public
  `car-images` bucket.** Both public buckets (`avatars`, `car-images`) are
  world-readable by URL — correct for photos, but any PII scan placed there leaks.
  No code does this today; add a guard/convention so it stays that way.
  Effort: S · Risk: none (policy).

- [ ] **P2-6 · Acknowledge/document the `public_car_listings` SECURITY DEFINER view.**
  The advisor flags it ERROR-level, but it is **by design** for a public marketplace
  (anon must read curated columns while the base table stays non-anon-readable). I
  verified it exposes only buyer-facing columns — no `purchase_price`, `recon_cost`,
  `commission_amount`, `gross_profit`, or `admin_notes`. Keep it column-restricted on
  every future edit; document the intent so it isn't "fixed" into breaking anon reads.
  Effort: S · Risk: none.

---

## P3 — Follow-on features / larger builds

- [ ] **P3-1 · Web Push for closed/backgrounded OS notifications ("google
  notification").** Today's browser notification (`SalesmanLite.jsx:1517-1548`) is
  **not** push — it uses the local Notification API and only fires on
  `visibilitychange` (tab return), throttled 24h. No VAPID / PushManager / push server
  exists. True closed-app notifications require:
  1. Generate VAPID keys; client `pushManager.subscribe()`; store subscription per user.
  2. Service-worker `push` event listener → `showNotification`.
  3. Send pushes from a Supabase edge function (build on existing
     `notify_push_on_enquiry` / `notify_push_on_appointment` DB hooks).
  4. Caveat: iOS needs the PWA installed to home screen (16.4+).
  Effort: L · Risk: M (new surface).

---

## Notes on what is already solid (do NOT "fix")

- Every public table has RLS enabled; anon is INSERT-only with strong `WITH CHECK`
  (dealer-active gate, DB-level per-phone/session rate limits, format + length caps).
- All privileged SECURITY DEFINER functions gate internally (`is_superadmin()` /
  `is_active_salesman()` / `auth.uid()` scoping). IC numbers are hashed with a
  per-user salt, never stored plaintext (`set_my_ic`).
- `prevent_profile_privilege_escalation` blocks self-grant of role/plan/payment/
  subscription/trial/reactivation.
- No service-role key in the client bundle; anon key correctly public; `.env`
  gitignored. AI proxy is hardened (session required, server-pinned models, per-dealer
  daily quota).
- The PWA/service-worker deploy-staleness handling in `main.jsx` / `vite.config.js` is
  carefully engineered — only the `_r` URL cleanup (P1-4) is worth touching.
