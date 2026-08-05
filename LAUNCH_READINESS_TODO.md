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

- [x] **P0-2 · De-hotpath the market-average aggregate in `public_car_listings`**
  DONE (2026-08-05, migrations `p0_2_market_price_stats_matview` +
  `p0_2_rebuild_public_car_listings_on_matview`). The full-table `GROUP BY` aggregate
  that ran on EVERY marketplace request now lives in a materialized view
  `market_price_stats` (same query: brand/model/year-bucket, HAVING count>=3), with a
  UNIQUE index on the group key so it refreshes CONCURRENTLY without locking reads.
  `public_car_listings` was rebuilt via CREATE OR REPLACE (columns byte-identical, so
  owner=postgres, anon SELECT grant, and the non-security_invoker behavior are all
  preserved) to LEFT JOIN the matview instead of the inline subquery. Refreshed hourly
  by pg_cron job `refresh-market-price-stats` (`7 * * * *`). Verified: anon reads 67
  curated rows, 41 with market_avg_price populated; security-definer behavior intact.
  Tradeoff: market averages are now up to ~1h stale (they're slow-moving — acceptable).
  Consumers (`MarketplacePage.jsx`, `HomePage.jsx`) need no change (same columns).

- [x] **P0-3 · Add `salesman_notifications` + `whatsapp_enquiries` to Supabase Realtime**
  DONE (2026-08-05, migration `add_salesman_realtime_tables`). Root cause of
  "salesman-lite notifications only appear on each visit": the client already
  subscribes (`SalesmanLite.jsx:1340,1346`, `SalesmanPremium.jsx:592,605`), but the
  `supabase_realtime` publication held only `appointments, car_listings,
  dealer_notifications, leads` — so Postgres never broadcast these two tables. Fix
  applied to the live DB:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.salesman_notifications;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_enquiries;
  ```
  Verified both are now in `pg_publication_tables`. Pre-checked both tables have RLS
  enabled + policies scoped by `salesman_id` (6 and 9 policies), so realtime delivers
  only to the owning salesman. Zero frontend changes. Dealers already worked
  (`dealer_notifications` was already published).

---

## P1 — High (do before or immediately after launch)

- [x] **P1-1 · Add indexes for the marketplace query shape**
  DONE (2026-08-05, migration `marketplace_query_indexes`). Added partial indexes on
  the public status set (`status = ANY('{available,reserved}')`, matching the exact
  marketplace predicate so they stay small): `idx_cl_pub_created (created_at DESC)`,
  `idx_cl_pub_price (selling_price)`, and btrees `idx_cl_pub_brand`,
  `idx_cl_pub_body_type`, `idx_cl_pub_state`, `idx_cl_pub_year`. No effect at 68 rows
  (Postgres seq-scans a tiny table) — this is forward-prep for thousands+.

- [x] **P1-2 · Switch marketplace `count: 'exact'` to estimated/planned**
  DONE. `MarketplacePage.jsx` now requests `count: 'exact'` ONLY on page 1 (the total
  result-set size doesn't change between pages), and guards `setTotal` so the null
  that later pages return can't clobber the load-more gate. Every "load more" no longer
  re-runs the exact COUNT over the aggregate-heavy view.

- [x] **P1-3 · Index or FTS the keyword search**
  DONE (2026-08-05, migration `p1_3_trgm_search_index`). Enabled `pg_trgm` in the
  dedicated `extensions` schema and added a partial GIN index
  `idx_cl_pub_search_trgm` on `(brand, model, variant) gin_trgm_ops` WHERE status in
  (available, reserved). The existing `ilike '%term%'` search is now index-backed with
  ZERO frontend change.

- [x] **P1-4 · Strip `_r=` from the URL after the post-deploy reload**
  DONE. `main.jsx` runs a one-shot `stripCacheBustParam()` before mount: if `?_r=` is
  present after the cache-busting reload, it's removed via `history.replaceState`
  (no navigation), keeping analytics referrers and canonical URLs clean.

- [ ] **P1-6 · Triage + fix the dependency vulnerabilities**
  GitHub Dependabot reports **21 alerts (14 high, 6 moderate, 1 low)**. Running
  `npm audit --package-lock-only` shows the deduplicated reality: **9 vulnerable
  packages (6 high, 2 moderate, 1 low)**. The gap is just counting — Dependabot
  counts each CVE separately, npm counts each package once (e.g. `sharp` = 4 CVEs,
  `brace-expansion`/`fast-uri`/`react-router` = 3 each). Same issues.
  Do NOT blind-run `npm audit fix --force` — the two biggest items are BREAKING major
  upgrades. Split the work:

  **6a · Apply the non-breaking (semver-compatible) fixes now — verify with a build.**
  These `npm audit fix` cleanly, no major version jump:
  - `react-router` / `react-router-dom` (high/mod) — **ships to the browser**, used
    for all routing. Open redirect via backslash in `<Link>`/`useNavigate` +
    arbitrary constructor injection. Highest real-world priority here.
  - `postcss` (high) — build-time; arbitrary `.map` file disclosure.
  - `brace-expansion`, `fast-uri` (high, transitive) — DoS / host-confusion.
  - `body-parser` (low) — used by the `server/` Express app (`server/routes/anthropic.js`);
    DoS via invalid limit. Only relevant if that server is actually deployed (Vercel
    prod uses `api/*` serverless, not `server/`).
  Run: `npm install && npm audit fix && npm run build`, smoke-test routing, commit.

  **6b · Breaking majors — schedule separately, test hard (own branch each).**
  - `vite` <=6.4.2 → **vite@8** (+ `esbuild`): the vulns are **dev-server only**
    (path traversal / dev-server request in local dev) — the production site is static
    build output, so real-world prod risk is low. But v6→v8 is a big jump; test the
    full build + PWA/service-worker plugin behavior before shipping.
  - `sharp` <0.35 → **sharp@0.35.3**: libvips CVEs. **Server-side only** (image
    processing, not shipped to browser). Confirm where sharp runs (`api/og.js`?
    import pipeline?) and test image output after upgrade.

  Cross-check: https://github.com/auzyvyth/ShiftOS/security/dependabot
  Effort: 6a S-M / 6b M · Risk: 6a low (compatible) / 6b M (major upgrades).

- [ ] **P1-5 · Confirm no precached vendor chunk exceeds the 3 MB SW cap**
  If a `vendor-*` chunk is over `maximumFileSizeToCacheInBytes: 3MB`
  (`vite.config.js:86`), the SW precache install fails, the worker never settles, and
  every visit re-triggers install → `controllerchange` → reload (a pathological
  every-visit version of the `_r` reload). Run `npm run build`, inspect
  `dist/assets/*.js` sizes. Likely fine (heavy chunks are in `globIgnores`), but
  verify. Effort: S · Risk: none (diagnostic).
  NOTE (2026-08-05): BLOCKED in the web session — `npm install`/`npm run build` fails
  because the proxy 403s the `cdn.sheetjs.com` xlsx pin (ACT-8). Run in a local env:
  `npm run build` then `ls -la dist/assets/*.js`; anything >3 MB needs a manual
  `globIgnores` entry in `vite.config.js`. Same env unblocks P1-6.

---

## P2 — Medium (hardening / hygiene)

- [ ] **P2-1 · Enable leaked-password protection (HIBP)** in Supabase Auth. One
  toggle, free. Flagged by the security advisor. Effort: S · Risk: none.

- [~] **P2-2 · Move `pg_net` extension out of the `public` schema.** DEFERRED
  (2026-08-05) — higher-risk than the WARN implies. `pg_net`'s functions actually live
  in the `net` schema (verified `net.http_post`); the extension is only *registered* in
  `public`. `pg_net` is known NOT to support `ALTER EXTENSION ... SET SCHEMA`, and every
  notification path (Telegram, web-push, enquiry/booking pings) calls `net.http_post`.
  Moving it blind could silently break all of them. Leaving as-is until it can be done
  with a tested drop/recreate in a maintenance window. Not a launch blocker.

- [x] **P2-3 · `analytics_events` growth plan.** Index side DONE / already present:
  `idx_analytics_events_dealer_created (dealer_id, created_at DESC)` and
  `idx_analytics_events_car_id` already cover the `get_car_analytics` read shape — no
  new index needed. REMAINING is a retention/rollup POLICY decision (how long to keep
  raw events before archiving/aggregating) — that's a product/data call for the owner,
  not a code change. Recommend: a monthly rollup + drop raw events older than N months
  once volume warrants.

- [ ] **P2-4 · Lazy-load `framer-motion` off the public first-load path.**
  `vendor-motion` (~50-100 KB gz) is on the public marketplace critical path. Consider
  code-splitting the animated sections. Effort: M · Risk: low.

- [ ] **P2-5 · Process guard: never upload IC/geran scans to the public
  `car-images` bucket.** Both public buckets (`avatars`, `car-images`) are
  world-readable by URL — correct for photos, but any PII scan placed there leaks.
  No code does this today; add a guard/convention so it stays that way.
  Effort: S · Risk: none (policy).

- [x] **P2-6 · Acknowledge/document the `public_car_listings` SECURITY DEFINER view.**
  DONE (2026-08-05). Added a `COMMENT ON VIEW public.public_car_listings` recording that
  the security-definer behavior is BY DESIGN (anon reads curated columns while the base
  table stays non-anon-readable), listing the columns that must never be exposed
  (purchase_price/recon_cost/commission_amount/gross_profit/admin_notes), warning not to
  set `security_invoker=true` (breaks anon reads — CRIT-0), and noting the
  market_avg_price source (market_price_stats matview, hourly cron). The comment travels
  with the object so a future editor sees the intent in the schema itself.

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
