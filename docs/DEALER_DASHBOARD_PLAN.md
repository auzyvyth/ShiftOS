# Dealer dashboard: restructure plan + session handoff (2026-11-09)

Owner, 2026-11-09: "fuck the designs, let's work on the real stuff, functions, brain load when looking at
the dashboard, hierarchy, functions that's the same in 2 tabs, mergeable tabs and features".
This file is the plan for that, plus everything the 2026-11-09 session found and left open.
It is NOT a security audit (those stay out of this public repo, CLAUDE.md "DMS audit lessons" rule 1).

Branch: `ccr-10f2178f-k01t0b` (12 commits on top of `origin/main` 1d8aded). Nothing from it is on
staging or prod yet. Read part B before touching anything.

---

## PART A: THE PLAN

### The problem in one line
15 places to go, and the same few facts are computed separately in 4-5 of them. "How is this month
going?" is answered by Overview, Revenue, GM Oversight, AI Manager and Performance, each with its own
query. That is the brain load. It is structure, not looks.

### Today's map (`src/pages/DashboardPage.jsx`, `NAV_GROUPS` at ~line 10468, renders at ~11115-11900)
| Sidebar group | Item (tab id) | What renders |
|---|---|---|
| Reports | Overview (`overview`) | AI Manager button + `OverviewTab.jsx` |
| Reports | Revenue (`analytics?sub=revenue`) | `RevOpsPage.jsx` |
| Reports | Performance (`analytics?sub=performance`) | `PerformanceTab.jsx` |
| Reports | Listings (`analytics?sub=listings`) | `AnalyticsTab` (DashboardPage.jsx:3280) |
| Reports | GM Oversight (`oversight`) | `OversightTab.jsx` |
| Sales | Leads / CRM (`crm`) | `CRMPanel.jsx`: Leads (`LeadsPage`) / Bookings (`BookingsTab`) / Outreach (`OutreachHub`) |
| Sales | HP Board (`hp`) | `HPBoard` |
| Inventory | Inventory (`listings`) | `StockStatsStrip` + `STAT_CARDS` + listing grid |
| Inventory | Add Listing (`add`) | `AddCarForm` (public or `mode="internal"`) |
| Inventory | Market Demand (`market`) | `MarketDemandTab.jsx` |
| Operations | Handover (`handover`) | `PostSaleBoard` |
| Operations | Customers (`customers`) | `crm/CustomersTab.jsx` |
| Operations | Documents (`documents`) | `DocumentsTab` (DashboardPage.jsx:8619) |
| Growth | Storefront (`storefront`) | Hero Carousel (`HeroSlidesPage`) / Services & Add-ons (`ServicesPage`) |
| Growth | AI Manager (`ai_manager`) | `AISalesManager.jsx` (not on `dealer_starter`) |
| Admin | Team (`team`) | `TeamTab` (DashboardPage.jsx:4508) |
| (gear) | Settings | `SettingsTab` (1044): identity, contact, frontpage, storefront, team, commission, handover_ops, costs, services, dealsheet, whatsapp, telegram, availability, verify, plan, security, danger |
| (hidden) | Stock (`stock`) | `StockTab` (6739), reached only from inside Inventory |

### The same fact in several places
| Fact | Where it shows today |
|---|---|
| Revenue / gross this month | Overview KPIs, RevOps KPIs, Oversight "Live Performance", AI Manager |
| 30-day revenue chart | `OverviewTab.jsx:439`, Oversight "Revenue Trend" (`OversightTab.jsx:780`) |
| "Needs your attention" | Overview alert cards, Oversight "Eyes Here" (`:790`), AI Manager briefing |
| Activity feed | Overview "Recent Conversations", Oversight "Activity Trail" (`:805`) |
| Days on lot / capital tied / aged stock | Overview "Stock", Performance "Listings & Inventory", Stock tab, Inventory's TWO strips (`DashboardPage.jsx:11175` + `:11178`) |
| Website traffic | Performance "Website & Traffic", Analytics > Listings "Marketplace Analytics" |
| Salesman performance | Overview "Team on Duty", Performance team table (TEAM-HEALTH), Team tab "Leaderboard", Oversight "What Drove Revenue" |
| Add-on product catalogue | TWO editors of `dealer_products`: Settings > Services (`ProductsCatalogue`, DashboardPage.jsx:601) and Storefront > Services & Add-ons (`ServicesPage.jsx:341`) |
| Add a car | Add Listing tab, Inventory's add button, Stock's Add Stock Unit / AI Import / Import CSV |
| Team settings | Team tab AND Settings > Team (permissions matrix, WA templates, deal sheet) + Settings > Commission |
| Storefront | Storefront tab (hero) AND Settings > Front Page + Settings > Storefront Content |

### Broken or dead (verified by reading the code, not clicked)
**ALL 7 FIXED on 2026-11-09 (step 1, branch `claude/new-session-xem5pv`).** What changed:
- RevOps "Open leads" -> `crm`. `handleTabChange(tab, query)` now takes a query.
- `CRMPanel` takes `initialTab` / `openLeadId` / `onTabChange` from the URL
  (`/dashboard/crm?sub=bookings`, `?lead=<id>`); `/dashboard/bookings` and `/outreach` redirect there.
  Overview: appointments -> Bookings; "price waiting" -> opens the OLDEST pending lead.
- `onOpenDoc` reaches `LeadDrawer`: "Make deposit receipt / sales agreement" under Deposit.
- `EnquiriesTab` (CRMPanel) and `MarketplaceAnalyticsTab` + helpers + the recharts import deleted (~1,530 lines).
- `outreach` dropped from TITLES; analytics title names the open sub; the analytics SubTabBar is gone.
- HPBoard / CustomersTab use `getDealerIdFromProfile(profile)`. Still on `userId` (harmless while
  only the dealer logs in, same pattern): CRMPanel, RevOps, Services, Stock, Documents, PriceEditModal.

1. RevOps "Open leads" goes to tab `"leads"`, which does not exist: `DashboardPage.jsx:11806`
   (`onNavigateToLeads={() => handleTabChange("leads")}`). Should be `crm`.
2. Overview alerts land in the wrong place (`OverviewTab.jsx:385-400`): "appointments today" -> `crm`
   opens on Leads, not Bookings; "price waiting for your OK" opens the lead list, not that lead.
   CRMPanel has no way to be told which sub-tab to open (`crmTab` is local state, `CRMPanel.jsx:2194`).
3. `onOpenDoc` is passed to `CRMPanel` (`DashboardPage.jsx:~11840`) but `CRMPanel` does not accept it
   (`CRMPanel.jsx:2193`). The lead -> document prefill is dead (it lived in the unused EnquiriesTab).
4. Dead code, ~1,500 lines: `EnquiriesTab` (`CRMPanel.jsx:56-1265`, never rendered),
   `MarketplaceAnalyticsTab` (`DashboardPage.jsx:4199`, never rendered). Check with grep before deleting.
5. `TITLES` (`DashboardPage.jsx:~10450`) lists `outreach` and `market`/`stock` pages; `outreach` is not a tab.
6. Analytics is double-navigated: 3 sidebar items AND a `SubTabBar` inside (`:11793`).
7. `HPBoard dealerId={userId}` and `CustomersTab dealerId={userId}` (`:11876`, `:11888`) use the user id
   where every other tab uses `getDealerIdFromProfile(profile)`. Harmless while only dealer owners log in;
   same mistake that once emptied the handover board.

### Target: 6 sections, one question each
1. **Today** - "what needs me right now?" Overview + Oversight "Eyes Here" + AI Manager briefing as one
   page. ONE alert list; each alert opens the exact item (needs a deep-link into CRM sub-tab / lead id).
   AI Manager becomes a card here, not a tab.
2. **Sales** - "who am I selling to?" Leads | Bookings | Follow-ups (Outreach) | Loans (HP Board).
3. **Cars** - "what am I selling?" Inventory + Stock as one list: For sale | In stock (unpublished) |
   Market demand. ONE Add button (import inside it).
4. **Sold** - "what happens after the sale?" Handover | Customers | Documents (Premium already did this
   as one Sold tab, see CLAUDE.md "Post-sale handover").
5. **Reports** - "how are we doing over time?" Money (RevOps + Oversight targets/charts/what drove
   revenue) | Team (Performance + leaderboard) | Marketing (traffic, once).
6. **Team** - people, roles, permissions (move Settings > Team here).
Settings keeps business settings only; the add-on catalogue and storefront content get ONE home each.
Old URLs (`/dashboard/handover`, `/dashboard/oversight`, `?sub=`) must redirect, like Premium's `TAB_ALIASES`.

### Order of work (each step is one commit / one staging round)
1. **Fix the broken links + delete dead code** (list above, items 1-7). ~1h, no visible move. For item 2,
   give `CRMPanel` an `initialTab` prop (and a lead id to open) and route `/dashboard/crm?sub=bookings`.
2. **DONE 2026-11-09. One add-on catalogue.** `ProductsCatalogue` deleted; Settings > Services is a shortcut to Storefront > Services & Add-ons. `ServicesPage` gained the activity log (`src/utils/activityLog.js`, shared), real error checks on every write, "In N listings", and the dealer id. Was: Keep one editor (suggest `ServicesPage`, it has the revenue stats), remove
   `ProductsCatalogue` from Settings, point Settings' "services" entry at it.
3. **Today.** Merge Overview + Oversight "Eyes Here"/targets + AI Manager. Biggest drop in brain load.
   Decide with the owner what of Oversight goes to Today vs Reports > Money.
4. **Cars** (Inventory + Stock) and **Sold** (Handover + Customers + Documents).
5. **Reports**: every number once, shared queries. Prefer the DB RPCs that already exist
   (`gm_pnl_snapshot`, `gm_salesman_scores` / `_team_health`) over client maths. Source of truth for
   money is `stock_units` (CLAUDE.md H6 + "A dealer's cost lives on stock_units ONLY").
Why now: CLAUDE.md records no live dealer users, so moving tabs breaks nobody's habits.
Before step 3 onward: challenge the owner on what Oversight is FOR (GM role vs owner); it may be a role
view rather than a tab.

---

## PART B: SESSION HANDOFF (2026-11-09)

### Deploy status
- Branch `ccr-10f2178f-k01t0b`, based on `origin/main` 1d8aded (#588). 12 commits, all pushed to the branch.
- **Not on staging, not on prod.** `origin/staging` has 6 commits from OTHER sessions not on main
  (VIN mask, login throttle, DB hygiene, cron, IO-9). Before pushing staging: `git fetch origin staging`,
  `git log --oneline HEAD..origin/staging`, and put this branch ON TOP of those, never force over them.
- Migration `supabase/migrations/20261110a_team_health.sql` is **QUEUED, NOT APPLIED**. Needs the
  owner's "ship tonight", then the midnight-MYT slot with nobody live (`seller_live_state`).
  Until it is applied, Performance's team table still uses the OLD `gm_salesman_scores` (diara shows 90).
- Build note: `npm ci` fails on a 403 from cdn.sheetjs.com (xlsx). Workaround used: install without
  xlsx, restore package files, stub `node_modules/xlsx` for a vite build, delete the stub after. The
  postinstall rewrites `public/llms.txt`; `git checkout public/llms.txt` after.

### What shipped on the branch (oldest first)
1. **Dashboard caching** (7c5f366). Every dealer tab paints from the device first.
   - `PANEL_SEED_TTL` = 30 days (`src/utils/panelCache.js`).
   - Thumbnails go through `cdnImg(...)` + `imgFallback` in DashboardPage.
   - Listings / salesmen are kept on a failed read (`if (!carsError) setListings(...)`).
   - Notifications, `HeroSlidesPage` and `OutreachHub` cache via `usePersistentState`; every
     `useCachedFetch` fetcher THROWS on error so a cached copy is kept.
   - Supabase Pro needs nothing extra: it only makes the revalidate faster.
2. **Dashboard on the main domain** (7d563c5). Root cause of the black bar in the installed app: dealer
   login went to `<sub>.drevo.my/dashboard`, outside the PWA scope. `src/utils/postAuthRoute.js:94` now
   `${SITE_URL}/dashboard`. Test `tests/postAuthRoute.test.mjs` (28/28).
3. **StayInApp** (a714f09). `src/components/StayInApp.jsx`, mounted in App.jsx: in the installed app,
   `target=_blank` / `window.open` of OUR pages becomes an in-app navigate (Android opens a Custom Tab
   even same-origin). Still opens the bar by design: storefront subdomain, Facebook share, other sites.
   CLAUDE.md section "The installed app never shows Chrome's black bar".
4. **Team health** (16a32d2, 320455b). Root cause of `diara` (juneeveylyn) scoring 90 after 45 idle
   days: on 2026-11-08 the DEALER created, assigned and won a lead for her; the old RPC credited it
   (1/1 win = 40, reply to the auto 'created' row = 15, GP = 25, free 10).
   - ONE SQL function `_team_health(dealer)` (in 20261110a). It judges activity by the salesman's OWN
     actions and gives each rep a status: active / quiet 7d / inactive 14d / never / new.
   - There is no score when a rep is inactive, never started, new, or has under 3 leads in 30 days.
   - Score weights: conversion 35, reply 25, follow-through 20, gross 10, docs 10.
   - `gm_salesman_scores` returns it, and the daily `notify_team_health` cron (`team-health-daily`,
     01:00 UTC) sends one push per dealer, the same issue at most weekly.
   - `trg_lead_salesman_from_assigned` sets `salesman_id` from `assigned_to` and refuses a salesman from
     another dealer (it backfills 4 leads).
   - UI: `src/utils/teamHealth.js` (words), the `PerformanceTab.jsx` team rows (status pill, issues, why
     there is no score) and `src/components/team/SalesmanHealthSheet.jsx` (pop-up).
   - `AddLeadModal` now also sets `salesman_id`.
   - Tested read-only against the live DB: diara reads inactive, 45 days quiet, 25 untouched, no score.
   - CLAUDE.md section "TEAM-HEALTH"; `docs/ARCHITECTURE.md` has the cron row.
5. **premiumLight look** (494e718 .. bf63759). Applies to Overview, the AI Manager button, the team
   table and the health sheet only. Final state, owner-approved direction:
   - plain white cards (`PL.cardBg = '#ffffff'`) with `PL.shadow`, no borders, on a light grey page
     `PL.canvas = '#eef0f4'` (painted on body, `DashboardPage.jsx:236`);
   - tappable cards are `.pl-key` raised keys (`src/theme/premiumLight.css`, neutral grey bottom lip);
   - status pills are one grey fill with a coloured word.
   - Tried and dropped: a red tint inside the cards (read pink), then slate.
   - **Open:** the owner was choosing the page colour from 3 previews: 1 cool grey `#eef0f4` (set),
     2 neutral `#efefef`, 3 warm stone `#f2efea`. It's a one-line change in `src/theme/tokens.js`.
   - The owner then said to stop design work. Do NOT restyle more tabs unless asked; the rest still use
     the old bordered look, and CLAUDE.md says do not mix the two looks inside one tab.

### Screenshot harness (CLAUDE.md "Show me what you built")
A Vite page seeds `cf:v1:` cache keys with mock data and blocks supabase.co in Playwright. Source was in
the session's /tmp (gone with the container). To rebuild it:
1. Make `tmp-harness/ov.html` + `ov.jsx` at the repo root. Never commit them.
2. Import the component and `put(\`overview:${D}\`, {...})` the shapes `OverviewTab` caches.
3. Run `npx vite --port 3011` and screenshot `http://localhost:3011/tmp-harness/ov.html`.
4. Shoot at 375px and 1280px, `deviceScaleFactor: 2`.

### Other open items
- Dependabot: 21 vulnerabilities on main (1 critical, 3 high). Not looked at. Worth a session.
- The rest of `TODO.md` (DMS-AUDIT etc.) is unchanged by this session.
