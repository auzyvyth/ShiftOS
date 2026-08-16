# Marketplace & Salesman Lite — Marketing Audit (2026-08-16)

Scope: the public marketplace funnel as a cold visitor walks it, with the
Salesman Lite campaign in mind — can an agent find the free product, can a
buyer trust what they see, is any of it discoverable by search.

Verified against the live DB and deployed functions, not just source. This
file exists because these findings previously lived only in a session handoff
message, which meant every new session re-derived them from scratch.

## Inventory reality (live, 2026-08-16)
69 car_listings total / 42 live · 5 sellers · 5 active Lite accounts ·
10 agent-owned listings · `original_price` NULL on all 69 rows.
Treat marketplace-reach claims in the Lite pitch with that in mind.

## DONE

- [x] **A1 — Header's loudest CTA sold the wrong product.** Both "Get Started"
  buttons hard-linked to `/shiftos#pricing` (RM299 dealer plan), so the free
  tier was priced out at first touch. Now a two-way chooser (agent / dealership)
  reusing the Sign In dropdown pattern. `MarketplaceHeader.jsx:334`, mobile pair
  at `:427`.
- [x] **A2 — No Salesman Lite entry point in the marketplace body.** Added the
  agent band between the results and the footer, `MarketplacePage.jsx:1193`
  (styles at `:755`). Below the results on purpose: recruits sellers without
  taxing the buyer's search.
- [x] **A3 — Footer sent salesman tiers to the wrong page.** `salesman_lite` /
  `salesman_full` pointed at `/shiftos?for=salesman#pricing`, a thinner retelling
  of the Lite story on the dealer page. Both now go to `/for-salesmen`
  (`MarketplaceFooter.jsx:21`), which is the page the pitch is written for and
  the one in the sitemap. Also added to the Product column (`:53`).
- [x] **B1 — Hot Deals hero tab was a guaranteed dead end.** Hidden while the
  count is zero (`MarketplacePage.jsx:844`). Tabs carry explicit string ids so
  hiding one can't shift another's active state.
- [x] **P1 — Seller-typed "was" price removed.** See the commit
  "Remove the seller-typed 'was' price, keep the real price-drop record".
  `original_price` is now written only by `PriceEditModal`
  (`DashboardPage.jsx:2654`) on a genuine price drop — the only writer left in
  the codebase or the DB.

## OPEN — highest value first

- [ ] **E1 — No listing-cap meter in Salesman Lite.** `SalesmanLite.jsx` is
  ~9,300 lines with zero cap UI; agents discover the 10-listing cap by hitting a
  publish error (`CarForm.jsx:1841`). It is also the only natural moment to
  offer RM20 Premium. GOTCHA: `get_plan_usage` excludes only `sold, archived`
  while `enforce_listing_cap` also excludes `unpublished`, so a meter built
  naively on the RPC will over-count. Reconcile the two before building.
- [ ] **B2 — Two hot-deal definitions.** `get_marketplace_stats` (DB) and the
  marketplace/showroom queries count ANY `original_price > 0`
  (`MarketplacePage.jsx:211`, `CarListingPage.jsx:515`); the badges use a 3%
  threshold (`HomePage.jsx:93`, `CarDetailPage.jsx:1285`, `ManagerPanel.jsx:1415`).
  A 1% drop lands in the feed with no badge. Fixing it properly wants an
  `is_hot_deal` column on `public_car_listings` — PostgREST cannot compare two
  columns in a filter.
- [ ] **B3 — Only dealers can create a hot deal.** `PriceEditModal` lives in
  `DashboardPage.jsx` alone; Salesman Lite/Premium have no price-drop control, so
  an agent can never produce one. Give the salesman panels the same control, or
  accept Hot Deals as a dealer-only signal.
- [ ] **B4 — Header Hot Deals link is an unconditional dead end.**
  `MarketplaceHeader.jsx:283` and `:409` link `/?hot_deals=true` regardless of
  whether any exist. Left alone deliberately: hiding it correctly means a stats
  call on every page render. Do it with B2's column.
- [ ] **A4 — Dead code in HomePage.** `HomePage.jsx:473` and `:1579-1683` are
  wrapped in `{!isSubdomain()}` but unreachable past the early return at `:536`
  (`useTenant.js:63-66` makes tenant always null on the root domain).
- [ ] **A5 — Agent band is un-instrumented.** `analytics_events.event_type` has
  a CHECK that would silently reject a new value, and tagging the link `?src=`
  would overwrite the visitor's real acquisition channel (`refTracking.js:17` —
  an explicit src always wins). Measuring the band needs a CHECK migration.
- [ ] **C1 — Lite landing oversells marketplace reach.** With 42 live listings,
  `SalesmanLiteLanding.jsx:164` (FEATURES[1]) leads on marketplace exposure.
  New agents driven to a thin marketplace get no enquiries and churn. Reweight
  toward the page-and-pipeline angle until inventory grows.
- [ ] **C2 — Font import sweep.** ~17 files still carry a redundant Bebas Neue
  `@import`; `index.html` already loads it. The three marketed pages are done.
- [ ] **C3 — `base_price` blocks agent listings.** Required to publish
  (`CarForm.jsx:1529`/`:1550`, review row `:3201`), but an agent brokering someone else's car has
  no cost figure. Owner decision pending on making it optional for Lite.
