# ShiftOS — Project Context

## Pending tasks — session start protocol
1. Read `TODO.md` at the start of every session.
2. Present the pending items to the user and ask which one to work on first.
3. After completing an item, delete it from `TODO.md`, commit the updated file, and push.
4. Do not start work without asking the user which item to tackle.

## Capturing ideas — do this any time, unprompted
Whenever the user floats a product/feature idea mid-conversation (not a direct
task request — a "what if" / "I once had an idea" / brainstorm aside), add it
to the `## 💡 Ideas` section at the top of `TODO.md` as its own `IDEA-N` bullet,
commit, and push. Don't wait to be asked each time — the user loses most of
their ideas otherwise, so capture-by-default is the point. Keep it short: what
the idea is, why, and any constraint that blocks building it now. Do NOT treat
an idea as a scheduled task (no checkbox, don't present it as a pending item to
tackle) until the user explicitly decides to build it — at that point move it
out of Ideas into a normal dev-task entry.

## Session end protocol — "FFT"
When the user says "FFT", produce a handoff summary for the next agent. No questions, just write it. Structure:
1. **Deploy status** — what merged to prod (PR #, commit sha), CI state, branch sync state, whether local main / staging / feature branch are aligned.
2. **What shipped this session** — each change as a titled bullet with the file(s) touched and a one-line why. Include root cause for any bug fix.
3. **Open items for next agent** — unfinished work, blocked tasks, anything from TODO.md still pending, with recommended next step.
4. **Rule set** — condensed restatement of the non-negotiables below (multi-tenancy/security, deployment flow, design/mobile, prompt discipline) plus current tier pricing.
Keep it scannable (headings + bullets), no emojis. Verify deploy/git state with real commands before writing — do not assume.

## Challenge my decisions — don't just execute
I want a design/engineering counterweight, not a yes-man. Before building what I
ask for, judge whether the request is actually the right move. If it adds clutter,
redundancy, tech debt, a clunky UX, or a worse structure, SAY SO FIRST and propose
the better option with reasoning — then let me make the final call.
- Fix the problem, not the literal instruction. Ask "what is the real goal here?"
  and solve that. If I say "improve the placeholder" but the real issue is three
  overlapping inputs collecting one kind of data, the right answer is to collapse
  the redundancy, not to polish all three. (This exact case happened — I caught it,
  you should have.)
- Name redundancy, duplication and clutter the moment you see it. Multiple
  fields/columns/components doing the same job is a smell — flag it and propose one.
- Push back BEFORE implementing, not after I object. A short "here's why X is worse
  and Y is better" up front beats silently shipping X.
- Be direct and specific about why something is a bad idea (clunky, confusing,
  hard to maintain, breaks a pattern, hurts mobile/SEO/perf). No hedging, no flattery.
- This is not permission to bikeshed or refuse work — make the case concisely, and
  if I still want it my way, do it my way.

## How to talk to me — plain English + always show me the code
I am not reading this to be impressed. Explain things in SIMPLE terms.
- Use plain words. If a technical term is unavoidable, define it in half a sentence
  the first time ("VAPID keys — the keypair that proves to Google/Apple that a push
  is really from us").
- Lead with what it means for me / the product, then the mechanism. Not the reverse.
- No jargon walls, no acronym soup, no showing off. Short sentences.
- ALWAYS attach a code reference to any claim about the codebase or any change you
  made — `src/pages/SalesmanLite.jsx:7095`, `supabase/functions/send-push/index.ts:42`,
  or the DB object name (`trg_push_on_appointment` on `appointments`). "I added a
  button to settings" is useless; "added the test button at
  `src/pages/SalesmanLite.jsx:7095`" is what I need to go look at it.
- Same rule for bugs: name the exact file:line or DB object where the problem lives,
  not just a description of it.
- When something has a gotcha, say the consequence in one line ("change this key and
  all 8 existing subscriptions die silently"), not a paragraph of theory.

## Stack
React + Vite, Supabase, Tailwind CSS, deployed on Vercel

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint (quiet)

## Supabase project
Project ID: lemdkdizdlcirhbzqlos

## Design system
- Background: #080C14 / bg-gray-950
- Accent: red-600 / #dc2626
- Font: `var(--xd-font-body)` (src/index.css) = Outfit, falling back to system-ui.
  Bebas Neue for display/headings. Do NOT hardcode `system-ui, sans-serif` on a
  public surface — CarDetailPage did, and it was the only marketplace page not
  in Outfit, so walking from the marketplace into a car changed the typeface.
- Cards: bg-gray-900, border-gray-800
- Public marketplace surfaces: read `DESIGN.md` (tokens, scales, grid, anti-slop rules) before any public-facing UI change.
- Dealer/salesman DASHBOARD surfaces: read `DASHBOARD_DESIGN.md` (the "quiet terminal"
  language — tokens, tabular figures, delta contract, sparkline spec, dense table rules)
  before building any dashboard panel, stat tile, data table or trend. Reference
  implementation is `src/components/MarketDemandTab.jsx`.

### Anti-slop UI rules (non-negotiable)
- NEVER put a decorative coloured left accent bar / vertical side-line on list rows or cards to signal status or category — it reads as generic AI slop. Convey state with a small pill/tag, a status dot, or a very subtle full-row background tint (stage/status hue at ~5-10% alpha) instead.
- Keep colours low-saturation and DON'T stack multiple saturated accents in one component (e.g. a row of green + purple + red + amber buttons). One primary accent per card; push secondary/rarely-used actions into an overflow (⋮) menu rather than lining them all up.
- Prefer one clear primary action visible; hide the long tail behind a kebab/overflow menu.

## Key files
- src/pages/MarketplacePage.jsx — THE public XDrive marketplace (`/` on xdrive.my).
  App.jsx RootRoute picks it synchronously by hostname.
- src/pages/HomePage.jsx — the DEALER SUBDOMAIN storefront (`/` on <sub>.xdrive.my).
  It is not the marketplace; it uses Header/Footer, not MarketplaceHeader/Footer.
- src/pages/CarListingPage.jsx — the browse grid: `/showroom` (marketplace) and
  `/cars` (subdomain). Its filter whitelists + sanitisers are IMPORTED from
  src/config/marketplaceConfig.js — never re-declare them here, they were
  duplicated once and the copies are what drift.
- src/pages/CarDetailPage.jsx — single car listing page (has "What's Included" services strip)
- src/pages/SalesmanPanel.jsx — salesman role dashboard (file: Salesmanpanel.jsx)
- src/pages/DashboardPage.jsx — owner/admin dashboard (see nav tabs below)
- src/pages/RevOpsPage.jsx — dealer revenue analytics dashboard (userId prop)
- src/pages/ServicesPage.jsx — dealer product catalogue + add-on revenue stats (userId prop)
- src/pages/LeadsPage.jsx — leads CRM board (embedded in dashboard)
- src/components/HeroCarousel.jsx — homepage hero
- src/components/CarForm.jsx — multi-step listing form (8 steps; step 6 has Included Services)
- src/components/leads/LeadDrawer.jsx — right-side lead detail panel (collapsible add-ons section)
- src/hooks/useProfile.js — logged-in user's own profile row; exports useProfile() + getDealerIdFromProfile(profile)
- src/hooks/useTenant.js — subdomain/tenant detection; exports getSubdomain(), isSubdomain(), useTenant()
- src/hooks/useRoleRedirect.js — role-based routing hook
- src/hooks/useSiteProfile.js — dealer profile context
- src/utils/serviceCategories.js — shared icon/color/label map for service categories

## Roles
owner / superadmin / dealer → /dashboard
salesman → /salesman
admin → /admin
manager → /manager
accountant → /accountant
fi_officer → /fi

## Dashboard nav tabs (DashboardPage.jsx)
listings, add, leads, analytics, team, hero, stock, enquiries, bookings, documents, revops, services, settings
Dealer dashboard NAV (DashboardPage.jsx NAV array): overview, crm, listings, add, stock, hp, handover, analytics, team, customers, outreach, ai_manager, documents, storefront, oversight
  ↳ handover = post-sale lifecycle board (PostSaleBoard). Salesman panel also has a "handover" tab scoped to their own won deals.

## Won = sold: one trigger does everything (DO NOT split this brain again)
A lead reaching `won`/`closed_won` is the SINGLE source of truth for a closed deal.
The DB trigger `auto_create_customer_on_won` (on leads) is what fans it out — it must
do ALL of: (a) flip the linked `car_listings` row to `status='sold'` + stamp `sold_at`
+ set `assigned_to` to the salesman, (b) create the `customers` row, (c) seed the 8-step
`post_sale_tasks` handover checklist. Because it lives in the DB it fires no matter which
client moves the lead (salesman panel `advanceLeadStage`, dealer `LeadDrawer`, kanban drag).
- NEVER add a "won" code path on the frontend that only writes `leads.stage` and assumes
  something else marks the car sold — that orphans the win (car stays "available/Earn",
  sold-count/commission/analytics read `car_listings.status='sold'` so they ignore it,
  handover board stays empty). This split-brain has now bitten twice. The fix is always
  in the trigger, not a per-client patch.
- Sold-count, commission breakdown, RevOps and Overview all key off `car_listings.status='sold'`
  + `sold_at` + `commission_amount` (+ `assigned_to` for per-salesman). If a won deal isn't
  showing there, the car didn't get flipped — check the trigger, not the UI.
- Frontend `advanceLeadStage` (Salesmanpanel) also optimistically flips the car in local
  `myListings` state on win so the card updates without a reload; the DB trigger is the
  real persistence.

## getDealerIdFromProfile MUST mirror DB get_my_dealer_id() (never drift)
`src/hooks/useProfile.js getDealerIdFromProfile(profile)` and the SQL SECURITY DEFINER
`get_my_dealer_id()` MUST return the same id for the same user, or the frontend scopes
queries/writes to a different id than RLS expects → reads come back empty and writes are
silently rejected (no error). Canonical rule (both sides):
  - dealer / superadmin / owner → profile.id (they ARE the dealer)
  - salesman with dealer_id = NULL (Salesman Lite) → profile.id (owns itself)
  - linked salesman / manager / admin → profile.dealer_id
Prior bug: the JS helper had no `salesman` branch, so a linked salesman resolved to their
OWN id — handover board empty, salesman-logged calls/appointments silently RLS-rejected.

## Inbound lead attribution — ONE resolver, never inline it again
Every server-side path that turns an inbound contact into a `leads` row MUST get its
`salesman_id` from the SECURITY DEFINER helper `resolve_lead_salesman(p_dealer_id, p_car_id,
p_ref_slug, p_explicit)`. Do NOT re-implement the resolution inline — that drift is what
made WhatsApp/enquiry leads vanish from a salesman's pipeline TWICE. Callers today:
`create_lead_from_whatsapp` (ContactGate/WhatsApp tap), the `enquiry_to_lead` trigger
(enquiry form), and `start_chat_thread` (in-app chat — it resolves once onto
`chat_threads.salesman_id`, and `chat_after_message` reuses that rather than resolving again). Resolution order, first hit wins:
  1. explicit rep the caller already resolved (e.g. api/enquiry.js set `salesman_id`)
  2. `ref_slug` → must be `role='salesman'` AND scoped to this dealer (`id=dealer OR dealer_id=dealer`)
  3. `car_listings.assigned_to` (the exclusivity-lock closer)
  4. the "dealer" IS a self-owned salesman (`role='salesman' AND dealer_id IS NULL`) → attribute to them
  5. else NULL → genuinely unassigned, stays in the shared dealer pool
Why this matters per surface (all fetch by `salesman_id`):
  - Salesman Lite (standalone, dealer_id NULL) → SalesmanLite.jsx  → rule 4 owns every inbound lead
  - Salesman Premium (standalone, dealer_id NULL) → SalesmanPremium.jsx → same as Lite (rule 4)
  - Salesman under a dealer (dealer_id set) → Salesmanpanel.jsx → rules 2/3 attribute; unassigned → dealer pool
Routing: `dealer_id ? /salesman : plan==='salesman_full' ? /salesman-premium : /salesman-lite`.
If a lead ever doesn't show for a rep, check `resolve_lead_salesman`, not the panel query.

## Post-sale handover (Module A)
- Won deal (lead.stage = won/closed_won) → DB trigger `auto_create_customer_on_won` fires immediately: flips the linked car to `status='sold'` (sold_at + assigned_to), creates the customers row (name/phone/IC/email/car/plate/price) AND pre-seeds 8-step post_sale_tasks checklist (B7 auto-NA if not financed). Idempotent — safe to re-trigger.
- Salesman Premium: Handover and Customers are ONE nav tab, `sold` (`/salesman-premium/sold`),
  with two pills — Handover | Customers (`renderSold` in SalesmanPremium.jsx). They were two
  separate tabs with no nav slot, reachable only from two unlabelled Dashboard tiles, and nobody
  found either. `/salesman-premium/handover` and `/salesman-premium/customers` still resolve via
  TAB_ALIASES, so every existing deep link (`?deal=`, `?c=`, `?from=`) keeps working — do NOT
  split them back into two destinations.
- src/components/postsale/{PostSaleBoard,PostSaleChecklist}.jsx + src/hooks/usePostSaleTasks.js + src/utils/postSaleSteps.js

### One post-sale state for Pipeline + Handover + Customers (`useHandover`)
Pipeline, Handover and Customers all answer the same question — "what happened after
the win?" — and each used to find out on its own: `PostSaleBoard` fetched on mount and
`customers` was fetched ONCE at page bootstrap and never refetched. So a deal won in the
pipeline stayed invisible on the other two tabs until a full page reload, and the pipeline
never said the buyer had moved into handover at all.
- `src/hooks/useHandover.js` owns won deals + their `post_sale_tasks` + progress + next
  step. Instantiate it ONCE per page and pass the same instance to every surface
  (`SalesmanPremium.jsx` does: `handover` → `PostSaleBoard controller={handover}`, the
  won lead card's chip, the customer row's chip). `PostSaleBoard` without a `controller`
  self-instantiates — that is the dealer dashboard and `Salesmanpanel`, unchanged.
- **Any new path that closes a deal MUST call `handover.refresh()` + `refreshCustomers()`
  after the write** (see `handleMarkWon`, SalesmanPremium.jsx). The DB trigger has already
  created the customer and the 8 steps by the time the leads UPDATE returns, so one
  refetch lands everything; skipping it puts the split-brain straight back.
- `PostSaleChecklist` reports its live steps up via `onTasksChange` so a ticked step moves
  the percentage on every surface at once. That callback is held in a REF inside the
  checklist — parents pass an inline arrow, so keying the effect on it would re-fire every
  render and, since reporting up re-renders the parent, spin forever.
- Tabs link both ways: `?deal=<leadId>` on the handover tab opens that deal,
  `?c=<customerId>` on customers scrolls to that buyer.
- A failed read in `useHandover` sets `error` and the board renders a retry — it used to
  swallow the error and render "No sold deals yet", the one empty state that makes a
  salesman think their win vanished.

### Expiry dates are captured at the handover step, not typed into a form
`customers.insurance_expiry` / `road_tax_expiry` are what the expiry-reminders cron and
the "This week" renewal rows run on. Nobody was filling them (1 of 27 customers had an
insurance date) because the only entry point was a form on the dealer dashboard, while
the trigger's road-tax carry-over reads `car_listings.road_tax_expiry`, filled on 1 of 69
listings. The date is captured where it is actually known instead: ticking the handover
`insurance` or `road_tax` step done writes `post_sale_tasks.result_date` (prefilled +12
months — both run 12-month terms in Malaysia, editable on the step).
- DB trigger `trg_sync_customer_expiry` on `post_sale_tasks` fans it out to `customers`,
  so it fires whichever client ticks the step. Do NOT re-implement this per client.
- A typed `result_date` always wins; the +12m default only ever FILLS A BLANK, so it
  cannot stomp a date someone corrected by hand. Reopening a step never blanks a date.
- `customers` has NO `updated_at` column — writing one throws 42703 and kills the update.

### Service packages: one implementation, shared by both Customers tabs
`src/hooks/useServicePackages.js` + `src/components/crm/ServicePackages.jsx`, rendered by
BOTH the dealer CustomersTab and Salesman Premium `renderCustomers`. They previously
carried two near-identical copies of add-package / log-visit — do not fork it again.
A package is PICKED from `dealer_products` (the catalogue that already existed) rather
than retyped as free text; a visit is a dated row with an undo, not an integer someone
increments. A package expiring with visits unused surfaces in "This week"
(`kind: 'package_unused'`) — a customer who already paid and has not come back.
- Malaysian sequence (fees are official rates, editable): loan settlement → buyer insurance → Puspakom B5 (RM30) → B7 (RM60, financed only, auto-NA if not financed) → JPJ pindah milik (RM100, biometric both parties, buyer within 7 days) → road tax → geran collection → handover
- Handover processing costs (sum of non-NA step costs) are deducted from per-unit gross in StockTab P&L modal
- F&I add-ons (Module C) already live in LeadDrawer (deal_products); revenue/gross (Module B) in RevOpsPage; customer expiry reminders (Module D) in CustomersTab

## Key DB tables
car_listings (dealer_id, assigned_to, status, commission_amount, sold_at, included_services JSONB, included_services_cost numeric)
stock_units (dealer_id, listing_id, purchase_price, recon_cost, status, included_services JSONB, puspakom_b5_date, puspakom_b7_date, encumbrance_status[clear|under_hp|unknown])
profiles (role, slug, dealership, site_name, whatsapp_number, brand_color)
  ↳ manager/admin rows also have dealer_id (FK to profiles.id of their parent dealer)
appointments (dealer_id, salesman_id, car_listing_id, appointment_date)
analytics_events (dealer_id, salesman_slug, event_type, car_id)
leads (dealer_id, salesman_id, stage, source, buyer_name, phone, buyer_email, buyer_ic, buyer_address, loan_bank, loan_amount, loan_status, …)
dealer_products (dealer_id, name, category, cost_price, selling_price, is_active)
deal_products (dealer_id, lead_id, listing_id, product_id, sold_price)
salesman_listings (dealer_id, salesman_id, listing_id) — many-to-many; a salesman features a dealer car on their own listings WITHOUT creating a lead. Pipeline = real buyers only.

## Car ownership model — assignment is an EXCLUSIVITY lock
Two ways a salesman ends up selling a car, reconciled by one rule:
- `car_listings.assigned_to = NULL` → OPEN: any salesman can feature it (salesman_listings)
  and sell it; whoever wins the lead earns it (trigger sets assigned_to to the closer).
- `car_listings.assigned_to = <rep>` → EXCLUSIVE: the dealer has locked it to one rep (e.g.
  high-value units). It DROPS OUT of every other salesman's Available Inventory feature pool
  and only that rep can sell it. So the assigned rep is always the closer → no commission
  ambiguity, and the won-trigger's `COALESCE(assigned_to, closer)` stays correct.
Enforcement points (keep in sync):
  - Salesman panel Available Inventory query filters `.is('assigned_to', null)`; addCarToMyDeals
    guards against featuring an assigned car (race safety).
  - Dealer dash handleAssign() evicts other salesmen's salesman_listings rows for that car on
    assign, so exclusivity is retroactive (already-featured reps lose it).
  - Never reintroduce a path that lets a non-assignee feature/sell an assigned car.
post_sale_tasks (dealer_id, lead_id, listing_id, salesman_id, step_key, status[pending|in_progress|done|na], owner_role, due_date, cost, notes, sort_order) — handover checklist per won deal. Steps in src/utils/postSaleSteps.js. Auto-seeded by DB trigger on won + lazy-seeded on first board open. UNIQUE(lead_id, step_key).
customers (dealer_id, lead_id, listing_id, name, phone, email, ic_number, purchase_date, car_brand, car_model, car_year, car_plate, selling_price, payment_type, road_tax_expiry, insurance_expiry, notes) — auto-created by trigger on won. UNIQUE(lead_id).
service_packages (dealer_id, customer_id, lead_id, listing_id, product_id→dealer_products, package_name, total_visits, used_visits, valid_months, sold_price, sold_at, expires_at[generated]) — prepaid service bundles per customer. `package_name` is a SNAPSHOT of what was sold; `product_id` links it to the catalogue entry it came from.
service_visits (dealer_id, package_id, customer_id, visited_on, notes, logged_by) — one row per visit burned against a package. `service_packages.used_visits` is a CACHED count maintained by trigger `trg_sync_package_used_visits` — read it, NEVER write it from the client or it drifts from the rows that are the real record.

## Service categories (serviceCategories.js)
Keys: protection, tint, window_tint, warranty, insurance, road_tax, service, accessories, workshop, other
Usage: import { getCategoryCfg } from '../utils/serviceCategories'
Each entry: { icon: LucideComponent, color: hex, twColor: tailwind-class, label: string }

## Marketplace — one definition per question
- **"Hot deal" is `public_car_listings.is_hot_deal`** (selling_price <= 97% of
  original_price, migration 20260831h). The grids, the hero shelf and
  `get_marketplace_stats()` all read that one column. It is a COLUMN because
  PostgREST cannot compare two columns in a filter — which is exactly why the
  grids had drifted to a looser `original_price > 0` test that called every car
  with a recorded list price a deal. Do not re-implement the threshold client-side.
- **Any nav entry point for a filtered view must be gated on that view having
  rows.** `useMarketplaceStats()` (module-cached, shared by MarketplaceHeader,
  MarketplaceFooter and MarketplacePage — one RPC between the three) exists for
  this. An always-visible "Hot Deals" link over an empty filter is a dead end,
  and it shipped that way.
- **A marketplace card's seller type reads `seller_role` on the view, never the
  `dealer:profiles!dealer_id` embed.** Anon cannot read `profiles`, so that
  embed is null for every logged-out buyer; a filter on it silently matches
  everything. Rule: role 'salesman' = "Agent", everything else = "Dealer" —
  same rule in the query, the chip and ShowroomCard's badge.
- The marketplace header/footer live on a LIGHT surface. `body` is `#080C14`,
  so a translucent background in the site chrome composites over near-black —
  which is how the announcement bar ended up a dark band above a white header.
  Paint an explicit light colour, and don't reuse a grey across both surfaces.

## Multi-tenancy
All queries scoped by dealer_id via RLS + frontend .eq('dealer_id', dealerId)
Public car_listings SELECT is open (for XDrive marketplace)
Never use session.user.id / user.id in queries — always derive via getDealerIdFromProfile(profile):
  - manager or admin role → profile.dealer_id
  - superadmin / dealer / owner role → profile.id
Subdomain detection: xdrive.my and www.xdrive.my → tenant=null (public marketplace)
  Only <sub>.xdrive.my triggers dealer profile lookup (useTenant.js)

## Deployment pipeline — 3 stages
```
local (main) → staging branch → production (main on GitHub)
```
- **local main**: all development happens here, commits stay local until staged
- **staging**: `git push origin main:staging --force` → triggers Vercel preview URL
- **production**: NEVER push to origin/main directly — always via temp branch → PR → merge
- NEVER deploy to production without explicit user instruction ("push to prod" / "go live")
- Every feature or fix must go to staging first and be confirmed before production

## Git workflow (web session — proxy restriction)
This session's git proxy blocks direct push to origin/main. Use this workflow every time:
1. Commit to local main
2. `git push origin main:staging --force` → user reviews on Vercel preview
3. When user says to push to prod:
   a. `git checkout -b temp/<name> && git push -u origin temp/<name>`
   b. Create PR via mcp__github__create_pull_request (base: main)
   c. Merge via mcp__github__merge_pull_request (squash)
   d. `git checkout main && git fetch origin main && git reset --hard origin/main`
   e. Delete temp branch
- Before starting any work: git status → must say "up to date with origin/main"
- If git status shows divergence, STOP and warn the user before doing anything else.
- Never use --force on main without warning the user.
- Never run git reset --hard without warning the user that local changes will be lost.

### Squash-merge drift — diagnose by content, never by commit hash
PRs into `main` are merged via **squash**, which collapses a branch's commits into ONE
new commit with a fresh hash. If a long-lived session/feature branch keeps building on
its pre-squash history while that same work lands on `main` under a new hash, the two
histories "diverge" even though the content is identical — `git log branch..main` and
`main..branch` will both show commits, none of which are actually new work.
- NEVER assume commits unique to your branch (per `git log origin/main..HEAD`) are
  "new work to ship" — first diff the actual FILE CONTENT against `origin/main`
  (`git diff origin/main <commit> -- <file>` or `git show origin/main:<file> | grep ...`)
  to confirm the change isn't already present under a different hash.
- NEVER force-push a diverged branch over `main` or rebase blindly — either can silently
  revert work that landed on `main` after your branch's last sync point, or drop real
  changes during bad conflict resolutions. This is almost certainly how features went
  missing in a prior session.
- To ship real new work from a diverged branch: create a fresh branch off `origin/main`,
  cherry-pick ONLY the commits you've confirmed (by content-diff) are genuinely new,
  resolve conflicts in favor of `main`'s version when both sides fix the same bug
  differently, then PR → squash-merge as normal.
- Prevention: rebase your working branch onto `origin/main` regularly (e.g. start of
  each session) so drift never accumulates into a large diff to untangle later.

## DB migrations
- Schema changes (ALTER TABLE, CREATE VIEW) go directly to the live Supabase DB via MCP apply_migration
- Always update public_car_listings VIEW after adding columns to car_listings
- Supabase branch (isolated staging DB) available at ~$9.70/month — ask user before enabling

### CREATE OR REPLACE FUNCTION does NOT replace a function whose params you reordered
It matches on the ARGUMENT TYPE LIST. Change the order of the parameters (or their
types, or add one) and you have not replaced anything — you now have TWO functions
with the same name. If both end up with the same parameter NAMES, every named call
dies with `ERROR 42725: function ... is not unique`, because neither PostgREST nor
Postgres can choose. This took down WhatsApp lead capture: `20260829` rewrote
`create_lead_from_whatsapp` with the args in a new order, the old overload stayed,
and `api/whatsapp-lead.js` (which calls it by name) silently stopped recording
leads. Nothing errors visibly — the caller logs and moves on.
- After rewriting any DB function, list its overloads before you walk away:
  `select oid::regprocedure from pg_proc where proname = '<name>';`
  More than one row is a bug unless you deliberately want an overload.
- Reordering params means `drop function <name>(<old type list>)` in the SAME
  migration. Renaming a param has the same trap (`CREATE OR REPLACE` refuses
  outright there, which is the friendlier failure).
- Same rule for VIEWS, different failure: `CREATE OR REPLACE VIEW` can only APPEND
  columns, and only with identical names/types/order for the existing ones. To
  remove or reorder a column you must DROP + CREATE — which drops every grant, so
  re-assert them explicitly (see the share-token rules about never copying grants).
- **Before dropping a view, search `pg_proc` too, not just `pg_depend`.** A
  function declared `RETURNS SETOF <view>` holds a hard dependency on the view's
  ROW TYPE, and the usual `pg_depend`-on-`pg_rewrite` query finds only dependent
  VIEWS — it returns zero rows and the DROP still fails. `get_salesman_featured_
  listings(uuid)` is one of these on `public_car_listings`. Drop and recreate the
  function around the view in the SAME migration and re-assert its EXECUTE grants;
  a body of `select v.*` follows the new column set with no edit.
- Because a DROP + CREATE of an anon-facing view is the expensive, risky half,
  batch every column you intend to remove into ONE migration. Do not pay that
  cost once per column.

## Edge functions — THE REPO IS NOT THE SOURCE OF TRUTH (read before touching one)
Plain version: what is running on Supabase is often NOT what is in `supabase/functions/`.
Some functions were built straight in the Supabase dashboard and never committed; others
were edited in the repo and never redeployed. Both directions exist RIGHT NOW.
- **ALWAYS run `mcp__Supabase__get_edge_function` and diff it against the repo file
  BEFORE you edit or redeploy anything.** Redeploying "the repo version" without
  checking silently deletes whatever only exists in the deployed version.
- Same rule for discovery: `mcp__Supabase__list_edge_functions` is the real inventory.
  Re-checked against the live inventory 2026-09-11: 18 deployed, 16 in the repo,
  so exactly TWO are missing from the repo — `telegram-enquiry-notify` and
  `bootstrap-superadmin-alias`. The other three this line used to name
  (`send-push`, `send-push-warm-leads`, `notify-price-alerts`) have since been
  committed, as was `appointment-reminder` on 2026-08-21. The gap is closing;
  keep closing it rather than trusting this count — run the tool.
- When you touch a drifted function, commit the deployed source into the repo as part
  of the same change so the gap closes instead of growing.
- Caught this way (2026-08-16, `send-telegram`): deployed v10 had a
  `TELEGRAM_BOT_TOKEN` platform-bot fallback that the repo lacked, while the repo had
  the `baggage, sentry-trace` CORS fix (DASH-5) that the deployed version lacked. A
  plain redeploy from the repo would have killed Telegram for every solo salesman.
  Fix was to MERGE both (`supabase/functions/send-telegram/index.ts`), not pick a side.
- The same trap applies to DB objects. Triggers/functions built in the dashboard do not
  appear in the repo at all — search `pg_proc` / `pg_trigger` before declaring something
  "doesn't exist yet". `grep` over `src/` is not evidence about the database.

### Function list (repo + deployed)
- send-telegram — sends a Telegram message server-side; reads the dealer bot token from
  the DB (never exposed to the client), falls back to the platform bot (`TELEGRAM_BOT_TOKEN`
  edge secret) for solo salesmen who have no bot of their own
- telegram-notify — webhook; auto-posts new listings to the dealer Telegram channel
- telegram-enquiry-notify — deployed only, not in repo
- invites — creates auth user + profile for manager/admin/accountant/fi_officer roles
- create-salesman — creates salesman accounts + `resend_setup` action
- send-document — emails issued dealer_documents to the buyer via Resend
- expiry-reminders — daily cron (00:00 UTC = 8am KL); fires dealer_notifications for road
  tax/insurance expiring in 30 or 7 days, and for overdue post_sale_tasks steps. Also
  notifies salesman_notifications. 24h dedup.
- appointment-reminder — cron every 5 min (`*/5 * * * *`, jobid 7). Two independent jobs:
  (1) Telegram "1 hour before" reminder for CONFIRMED bookings, opt-in via `remind_at`
  (set by "Schedule Telegram Reminder" in the Bookings tab), dedup via `remind_sent`.
  (2) Push nag for PENDING (unconfirmed) bookings whose appointment_date is within
  -2h..+5h of now — inserts one `salesman_notifications` row (type=`booking_unconfirmed`,
  ref_id=appointment id) per booking, which auto-fires a PWA push (see Web push below).
  Dedup is by ref_id already existing in salesman_notifications, so each pending booking
  gets exactly one nag, not one per 5-min tick.
- ai-proxy — proxies Claude API calls for AI features
- delete-account / purge-deleted-accounts — LITE-3 self-service deletion + 30-day purge
- import-drive-images — rehosts Google Drive folder images into the car-images bucket
- send-push — web push sender (see below)
- send-push-warm-leads — deployed only; pushes dealers when warm leads sit 3+ days
- notify-price-alerts, bootstrap-superadmin-alias — deployed only

## Web push — most of it already exists, do NOT rebuild it
Plain version: push notifications were about 60% built months ago, live on Supabase but
never committed to this repo, and dead because of a few missing pieces. Anyone picking up
"add push notifications" must read this first or they will build a duplicate.
- Sender: `send-push` edge function. Reads `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` edge
  secrets, subject hardcoded `mailto:support@xdrive.my`. Deletes subscriptions on a 410
  response (that is the correct way to clear dead ones).
- Storage: `push_subscriptions` (user_id, endpoint, subscription jsonb, created_at).
- Producers: DB triggers `trg_push_on_enquiry` (on `whatsapp_enquiries`) and
  `trg_push_on_appointment` (on `appointments`) POST to send-push via `net.http_post`.
- **Also (found 2026-08-21, undocumented until now):** `trg_push_on_dealer_notification`
  (on `dealer_notifications`) and `trg_push_on_salesman_notification` (on
  `salesman_notifications`) — both AFTER INSERT triggers that call SECURITY DEFINER
  helper `push_to_users(user_ids, title, body, url, tag)`, which reads the push secret
  from Vault and POSTs to send-push. **This means any INSERT into `dealer_notifications`
  or `salesman_notifications` already sends a real push — you never need to call
  send-push directly from an edge function/cron.** `push_to_users` resolves the
  notification URL via `push_home_path(user_id)` (routes to `/salesman-lite`,
  `/salesman-premium`, `/salesman`, or `/dashboard` per role) unless the caller passes
  an explicit URL. Both trigger functions swallow errors (`exception when others` +
  `raise warning`) so a push failure never blocks the notification row write.
- **ONE DEVICE, ONE IDENTITY: `push_subscriptions` is UNIQUE on `endpoint`.**
  It was UNIQUE (user_id, endpoint), so one phone could be registered under
  several accounts at once and nothing ever removed the stale rows — the only
  cleanup in the system was send-push deleting on a 410. Live when this was
  found: 13 rows across 9 devices, 3 of them carrying more than one identity
  (one held a salesman, a buyer AND the superadmin), and one browser carrying
  two different anonymous guests a day apart. Whoever registers last owns the
  device.
  - Registering goes through **`push_register_device(p_subscription)`**, never a
    client upsert. RLS is `auth.uid() = user_id` for every command, so the
    UPDATE half of an upsert is checked against the row ALREADY there — user B
    upserting onto a phone user A once used is rejected outright, and B could
    never turn notifications on at all. The RPC drops the stale row and claims
    the endpoint atomically, writing `user_id` from `auth.uid()` and never from
    anything the caller passes.
  - Signing out calls **`push_forget_device(p_endpoint)`**, from the
    `SIGNED_OUT` branch of `usePushHeal` (App.jsx) — NOT from the ~19
    `supabase.auth.signOut()` call sites. It has to be a SECURITY DEFINER
    function taking the endpoint as an ARGUMENT because by then there is no
    session: `auth.uid()` is null and an RLS delete cannot work. The endpoint is
    the credential, and only that browser holds it. Guard the `INITIAL_SESSION`
    event — it also reports a null session, on every logged-out marketplace page
    load.
  - `push_subscriptions(user_id)` has its own index. The old composite unique
    was doubling as the index for send-push's `.in("user_id", ...)`, the one
    query this table exists for; dropping it without a replacement turns every
    push into a seq scan.
- **`push_home_path` routes `role='buyer'` to `/account/messages`.** It used to
  fall through to `else '/dashboard'` — the dealer dashboard, which a buyer
  cannot use. Chat was unaffected (`chat_after_message` passes its URL
  explicitly); anything relying on the default was not.
- **The buyer's own on/off switch is `PushToggle` on `/account`.** Before that a
  buyer could switch notifications on from inside a conversation and then had
  nowhere to see the state or turn them back off — the toggle was mounted on
  every seller panel and no buyer surface. The Bell higher up that page is email
  price alerts, a different thing.
- **Platform console > Buyers shows the state** — `push_device_count` /
  `push_last_at` / `chat_unread` from `get_buyer_accounts`, device rows and
  thread state from `get_buyer_detail`, and a "Can't be reached" filter (unread
  reply + no device). Both RPCs are SECURITY DEFINER because
  `push_subscriptions` is owner-only RLS: a superadmin `.from()` returns an
  EMPTY ARRAY WITH NO ERROR and the panel would read "push off" for everyone
  while looking correct. Neither RPC returns an endpoint, subscription keys, or
  a message body.
- **VAPID keys are permanent. NEVER regenerate them.** Every push subscription is
  cryptographically bound to the public key it was created with. Swap the key and every
  existing subscription dies silently — no error the user ever sees, they just stop
  getting notifications and cannot be migrated. If a key must change, every user has to
  re-subscribe from scratch. There is also no such thing as running two keys side by side.
- **BUYERS get push too, and the ask lives in the conversation** —
  `src/components/chat/PushPromptStrip.jsx`, rendered by `ChatThread` for
  `role='buyer'` after the buyer has sent their FIRST message (so it covers both
  BuyerChat on the car page and BuyerInbox on /account/messages, one
  implementation). A seller's reply already pushed the buyer
  (`chat_after_message` -> `push_to_users`), but `PushToggle` was on every seller
  panel and no buyer surface, so no buyer had a subscription and chat was a
  channel the seller could answer on and the buyer never heard back through — a
  guest who closed the tab never learned there was a reply. Do NOT reuse
  `PushToggle` here (settings card, wrong shape) and do NOT prompt on chat open:
  both sides share `usePushNotifications`, which owns every browser trap, and a
  permission prompt before the buyer has typed anything gets reflexively blocked
  — a denied permission is a dead end no later prompt can recover.
- **The push prompt is PERSISTENT, and SELLERS get it too.** `PushPromptStrip`
  takes `audience='buyer' | 'seller'`; the seller copy renders above the thread
  list in `SellerInbox`, because `PushToggle` lives in Settings and Settings is
  the one screen a rep never opens — so a seller with the app shut heard nothing
  when a buyer messaged and had no way to learn that was even a setting.
  Dismissal is COMPONENT STATE ONLY — it is deliberately not written to
  localStorage (it was, first forever, then for a week). One reflexive tap
  otherwise silenced the single prompt whose whole job is to arrive at the
  moment it matters, and the person then sat in a chat that could never reach
  them. The strip stops rendering for good only when `subscribed` is true.
- iOS only allows web push for a PWA installed to the home screen (16.4+). PWA-1 shipped
  the install prompt, so that prerequisite is met — `src/components/InstallPrompt.jsx`.
- The local `Notification.permission` code in Salesman Lite
  (`src/pages/SalesmanLite.jsx:849`) is NOT push. It only fires while the tab is open.
  Do not confuse the two.

## Platform console (/platform) nav — ONE taxonomy: what am I doing
`AdminPage.jsx` `NAV` array. Five sections in the left rail, each with its own tab
strip; `activeSection` picks the section, `activeTab` the tab (ids are unique
across all sections, one state each).
  work → home, review · people → accounts, waitlist
  marketplace → marketplace(Settings), funnel, engagement, buyers, broadcast, platform(Volume)
  money → billing · safety → activity, sessions, posture, errors, alerts
- It landed on Dealers, a directory; it lands on **Home** now — the queues are the
  daily job (P3). Home shows counts and how long the oldest item has waited, and
  states NO money.
- **Review is ONE queue** for three kinds of item — cars, new sellers, ID checks —
  filtered by type pills (P4). Do NOT split it back into "Verify" + "Approvals".
  `UserApprovalsTab` takes `kindFilter`/`embedded`/`refreshKey`/`onCounts` so the
  merged queue can host it; with no props it renders standalone exactly as before.
- **MRR and subscription mix are stated in Billing and nowhere else** (P2). They
  used to render on Dealers, Platform Stats AND Billing, and the copies disagreed
  (Billing multiplied plan price by every dealer, counting trial + expired as
  revenue). There is no `stats.mrr` any more — revenue is computed once, in
  `BillingTab`. Do not add a second copy to a dashboard "for convenience".
- The rail used to be three consoles — "ShiftOS Ops" and "XDrive Ops" split by
  PRODUCT, "Security" split by FUNCTION — so the top level answered no single
  question (P1). Symptom: marketplace settings sat in one console, marketplace
  analytics in another. Keep the taxonomy single: a new destination goes in the
  section matching what the operator is DOING, never a new product console.
- **Dealers and Salesmen are ONE table** — `src/components/platform/AccountsTab.jsx`,
  role filter (All / Dealers / Standalone / Under a dealer). They are the same
  object with a different `role`; two tables is what let them drift to two
  standards (the paying account could not be deleted, the growth account could be
  destroyed in one click). Clicking a row opens the ACCOUNT RECORD — identity,
  plan/billing, activity, actions — instead of four tabs and four searches. Every
  write to an account lives there; do not add action buttons back onto the row.
- **Activity counts come from `get_account_activity(p_ids)`, never client-side
  queries.** `leads` has no superadmin SELECT policy and must not get one — lead
  rows carry buyer name, phone, IC and address. The RPC returns COUNTS ONLY. It
  is also the one activity source for dealers and salesmen alike.
- **Suspension goes through `set_account_suspended(user, bool, reason)`** — never
  write `profiles.is_active` directly. It stamps `suspension_reason` +
  `suspended_at` and inserts the dealer/salesman notification row, and that row
  IS the push. The reason is shown to the seller verbatim in `SuspendedBanner`
  (now rendered by SalesmanLite and SalesmanPremium too — they showed nothing
  before, so a suspended standalone seller lost the marketplace with a working
  dashboard and no explanation).
- Global search lives in the console header and searches accounts, pending
  listings and waitlist out of already-loaded state — no queries. Per-tab search
  boxes are for filtering within a tab, not for finding someone.
- Account deletion in the console is a SOFT delete (`account_status='deleted'` +
  `is_active=false` + `deleted_at`), the same three columns the `delete-account`
  edge function writes, with a Restore button for the 30-day window. Migration
  20260828e dropped both DELETE policies on `profiles`, so a client-side hard
  delete is now impossible — do not add one back. Full findings and what is still
  open: `AUDIT_PLATFORM_CONSOLE.md`.

### Platform admin push (/platform console) — built 2026-08-26
The superadmin account gets the SAME alerts the ops Telegram channel gets, on its
own device. One DB fanout drives both, so they can never disagree.
- `notify_ops(p_key, p_text)` is the single ops-alert entry point: 15-minute
  throttle (`ops_alert_state`) -> Telegram -> `push_to_users(<all superadmins>)`.
  Producers: `notify_admin_on_new_signup`, `notify_admin_on_pending_listing`,
  `trg_notify_error_log`, `trg_notify_activity_anomaly`. Do NOT add a fifth ops
  alert that only posts to Telegram — call `notify_ops`.
  `notify_ops_telegram(p_key, p_text)` still exists as a thin shim (deployed-only
  edge functions may call it by name); new code must not use it.
- The push title is the FIRST LINE of the message and the body is the rest, so
  keep writing ops messages as "headline\ndetail...". URL is always `/platform`;
  tag is the key's family (`ops:err`, `ops:new_signup`, …) so repeats replace.
- `push_home_path()` routes `role='superadmin'` to `/platform`. `owner` is a real
  dealer account and stays on `/dashboard` — do not lump them together.
- UI: Safety section -> **Alerts** tab (`src/components/platform/AlertsTab.jsx`).
- **The console runs on the ISOLATED `platformClient` session**, and
  `push_subscriptions` is RLS'd on `auth.uid() = user_id`. So `PushToggle` /
  `usePushNotifications` / `healPushSubscription` all take a `client` argument
  (defaults to the main client) and the console passes `platformClient`. Save the
  admin's device through the main client and the row is rejected — or filed under
  whichever dealer happens to be logged in on that browser. `usePushHeal`
  (App.jsx) heals the MAIN client's user only; `AdminPage.jsx` runs its own heal
  for the platform account.

## AI trust boundary — AI drafts, a HUMAN sends (hard rule)
An AI must never message a car buyer unsupervised. Owner's call, 2026-08-23:
"who would want to talk to an AI when buying a car, they need trust." AI may
write a draft; a person reads it and presses send. Do not add an auto-send path
to any buyer-facing channel (WhatsApp, Telegram, SMS, email), and do not treat a
scheduled send as an exception — schedule the REMINDER, not the send.
Any AI message prompt must also forbid inventing a price, discount, deposit,
instalment, trade-in value, loan rate or financing approval; if a number is
needed, the draft asks the buyer to confirm with the salesman.

### An AI call that answers per-row MUST be capped to fit its max_tokens
`ai-proxy` pins `max_tokens` PER FEATURE server-side (`FEATURES`, index.ts:14) —
`lead_score` 512, `wa_reply` 1024, `sales_manager`/`crm_assist` 1000. A prompt
that sends N rows and asks for N answers grows with the user's data and silently
blows that budget: the reply truncates mid-JSON, `JSON.parse` throws, and these
call sites all `catch { /* silent */ }`, so the feature renders NOTHING and no
error is ever logged. Lead scoring shipped this way and was dead for the only two
reps with enough leads to need it (82 leads -> ~3,700 tokens against 1,024).
- Cap the batch, and echo a short INDEX rather than a 36-char uuid per row.
- Do not ask for prose you do not render. Lead scoring returned a `reason`
  sentence per lead that was stored on every score and displayed nowhere.
- Budget it: rows x per-row tokens must fit the feature's cap with room to spare.
- Always pass `feature:` — an unknown or missing key falls back to `general`,
  which bills the wrong bucket AND silently changes the token budget.

## In-app buyer chat — the AI must never read a raw number
Buyers message sellers inside ShiftOS (not WhatsApp). Built 2026-08-23.
- Tables: `chat_threads` (one per listing+buyer, unique index), `chat_messages`
  (append-only — there is deliberately NO update/delete policy).
- **Every message is stored twice**: `body` (raw, what the two humans see,
  revealed on tap) and `body_ai` (`redact_for_ai(body)` — phones, IC, emails
  masked at 9+ digits). Masking in the UI does NOT hide anything from the AI,
  because the AI reads the database. So: **every AI path reads the
  `chat_messages_ai` view, which has no `body` column at all.** Never point an
  AI feature at `chat_messages`.
- AI runs server-side (`supabase/functions/chat-assist`) precisely so the prompt
  can't leak: the browser sends only a thread id, the function fetches the
  transcript itself. Sellers only; a buyer calling it gets 403.
- Threads are created ONLY by `start_chat_thread(listing_id)`, which derives
  dealer_id/salesman_id from the listing — a buyer cannot attach themselves to a
  seller of their choosing. Posting is capped at 20 messages/minute and you can
  only post as yourself, as the side you actually are.
- Guest buyers use Supabase anonymous sign-in (needs the project toggle, ACT-13).
  `handle_new_user()` forces `role='buyer'` for anonymous users — without that
  branch every guest gets a `role='dealer'` profile. Do not remove it.
- Frontend: `src/hooks/useChat.js`, `src/components/chat/{ChatThread,SellerInbox,BuyerChat}.jsx`.
  Notifications reuse the existing path (a `salesman_notifications` row IS the
  push) and fire only on the first unread of a burst.
- **A buyer message creates a pipeline lead** (`chat_after_message`, migration
  20260829). Every other inbound path did and chat did not, so a buyer who chose
  "chat here" existed in the Inbox and nowhere else — no pipeline row, no
  follow-up, invisible to "This week" and to every count. The lead is created on
  the buyer's FIRST MESSAGE, not when the thread opens (opening a chat and
  typing nothing is not a lead), `lead_source='chat'`, and `chat_threads.lead_id`
  makes it exactly one per thread. Notes carry `body_ai`, never `body`.
  A guest buyer has no phone, so the lead has none — the pipeline card and the
  detail panel hide the WhatsApp/Call actions rather than linking to `wa.me/`
  with nothing after it.
- **`chat_threads.lead_id` is NOT unique — one lead can own several threads.**
  A buyer who chats about a second car gets a second thread, and
  `chat_after_message` dedups it onto the SAME lead by phone. So every lead ->
  thread lookup takes the newest (`order last_message_at desc, limit 1`);
  `.maybeSingle()` throws PGRST116 the moment a buyer chats about two cars, and
  the failure looks like "this buyer has no conversation".
- **A conversation is a SCREEN, never a pane in a card. Two screens, and the
  open one is full-bleed.** `SellerInbox` renders the thread list; tapping a row
  portals `ChatThread` into a fixed layer over the whole viewport (back arrow
  returns). Same shape in `BuyerInbox` and in `BuyerChat`'s sheet. Do NOT put
  the 320px-list-beside-thread split pane back, and do NOT wrap a conversation
  in a bordered card inside a tab that already has a header and a nav.
- **The full-screen layer is sized off `useVisualViewport`, never `vh` /
  `window.innerHeight`.** `top: vv.offsetTop; height: vv.height` — so when the
  keyboard opens the layer's bottom edge lands ON the keyboard: the composer
  follows it up, the header does not move, and the message list just gets
  shorter. The old chat tab was sized off `window.innerHeight` (the LAYOUT
  viewport, which does not shrink for a keyboard), so the browser's only way to
  reach a focused composer was to scroll — and the whole chat box flew upward.
  Any surface that pins its own container this way passes `viewportPinned` to
  `ChatThread` so the composer does not pin itself a second time.
  `SellerInbox` still MEASURES the list panel's height off `window.innerHeight`
  (`getBoundingClientRect().top`, minus the page's own `bottomInset` — Lite
  `isMobile ? 80 : 24`, Premium 24). That is correct for the LIST, which must
  not collapse when a keyboard opens somewhere else.
- **Full-bleed does not mean full-width text**: `ChatThread contentMaxWidth`
  caps and centres the header, message column and composer (780 seller / 760
  buyer) so bubbles don't sit a foot apart on a monitor. It caps the CONTENT,
  not the scroller — capping the scroller moves the scrollbar off the edge.
- **The thread header has a pipeline-stage button** (`SellerInbox` stagePill ->
  `ChatThread headerBelow`). Chat is the one inbound channel where the seller is
  answering someone whose pipeline card they cannot see. It expands INSIDE the
  thread rather than as a popover: ChatThread's root is `overflow:hidden` so an
  absolutely positioned panel is clipped, and portalling something this small
  only buys overlay bugs. `leads` RLS returns only rows where `salesman_id =
  auth.uid()`, so a lead sitting unassigned in the dealer pool reads back null —
  that is "not yours to see", NOT "no lead", and the two are separated on
  `lead_id`. Never tell a rep a real buyer isn't in the pipeline.
- **Answering a chat lead goes through `src/components/chat/ChatSheet.jsx`, one
  portalled conversation opened over whatever surface you are on.** Do NOT add a
  per-surface "go to the Inbox" link: `SellerInbox` is an embedded TAB in
  SalesmanLite/SalesmanPremium, not a route, and the dealer dashboard has no
  inbox at all — a dealer's only way into a chat on their own listing is this
  sheet. RLS already allows it (`chat_thread_role()` returns `'seller'` for the
  thread's salesman AND for its `dealer_id`).
- The pipeline card shows the chat in place of the WhatsApp button when a thread
  exists — not beside it (that row is capped at three buttons and one accent).
  Which leads have a thread comes from the `useChatThreads` rows the nav badge
  ALREADY loads (`threadByLead`), so no pipeline surface gains a query; the
  dealer's LeadDrawer has no such hook and does one indexed read on open.
- Every lead detail panel has a phone field that renders when the lead has NO
  number — that empty row is the point. Saving reads the row back (the
  normalize trigger rewrites it) and rejects under 9 digits.
- **De-dup on phone always goes through `normalize_my_phone`, on BOTH sides.**
  `trg_leads_normalize_phone` stores every `leads.phone` as `60xxxxxxxxx`, so
  comparing a raw `"0123456789"` against it never matches and the same buyer
  gets a new lead per channel. This was live in `create_lead_from_whatsapp`
  until 2026-08-29. `profiles` stores the local `01…` form — never compare the
  two columns raw.
- **`BuyerChat` is the car page's ONE Contact button (RAPTOR-6, 2026-08-24)** — it
  is no longer just the chat trigger. Its sheet has two steps: a chooser (WhatsApp
  / chat here / call) and then the chat itself. The car card is now exactly two
  buttons: red "Book a Viewing" (the page owns it) + neutral "Contact". Do NOT
  add a fourth CTA back onto that card — a new way to reach the seller becomes a
  row inside the chooser, not another button. `CarDetailPage` has TWO CTA blocks
  (mobile card and desktop sidebar) and both pass the same props — change one,
  change the other or the layouts drift. WhatsApp is handed in as `onWhatsApp`
  and closes the sheet before it runs (overlay rule 3); it opens the enquiry
  modal, and the real `wa.me` deep link still fires synchronously inside
  `handleEnquirySubmit`, so nothing here is exposed to a popup blocker.

### Buyer email capture + unread-reply email (CHAT-EMAIL, 2026-08-31)
Most buyers here are guests (anonymous sign-in), so a seller's reply reached
nobody once the tab closed — push needs a granted permission on a live device.
The fix is an EMAIL ADDRESS, not an account: we need somewhere to send to, and
we never fuse two identities.
- Ask lives in `src/components/chat/BuyerEmailPrompt.jsx`, rendered by
  `ChatThread` in the same slot and on the same trigger as `PushPromptStrip` —
  AFTER the buyer's first message, never on chat open. ONE ask at a time: email
  first, push only once an address exists (`buyerHasEmail` in ChatThread).
- **`updateUser({ email })`, never `signInWithOtp`.** updateUser upgrades the
  anonymous user IN PLACE and keeps the same `auth.uid()`, so the thread,
  messages, lead, push subscription and saved cars all carry over with nothing
  to migrate. `signInWithOtp` (what `BuyerAuthPage.jsx:86` uses) signs into a
  DIFFERENT user and strands the conversation.
- Verification is a **6-digit code typed into the sheet** (`verifyOtp`, type
  `email_change`). A confirm link opens a new tab and the conversation is gone.
  Needs the Supabase email-change template to emit `{{ .Token }}`.
- **An address that already has an account is DECLINED, not merged.**
  Re-pointing a conversation onto another account because someone typed its
  address in that tab is an account-takeover shape and irreversible. The guest
  thread keeps working; they are told to sign in normally.
- **Everything downstream is one trigger:** `sync_identity_from_auth_user` on
  `auth.users` AFTER UPDATE fills `profiles.email`, relabels ALL that buyer's
  `chat_threads` (buyer_label is a snapshot `start_chat_thread` writes once) and
  renames + fills the email on the pipeline lead. `on_auth_user_created` is
  INSERT-only, which is why none of this happened before. Do NOT re-do any of it
  client-side. It swallows its own errors — it runs inside the auth transaction
  and a relabel must never fail someone's verification.
- Seller side needs no work: `useChat.js:150` already subscribes to `event:'*'`
  on `chat_threads`, so Lite, Premium and the dealer ChatSheet repaint live.
- Lead de-dup matches VERIFIED email as well as phone (`chat_after_message`).
  Unverified would let someone type a stranger's address and merge into that
  stranger's customer record.
- Send: `supabase/functions/notify-chat-unread` (cron jobid 13, every 30 min).
  Quotes `body_ai` NEVER `body`; carries an unsubscribe link checked by
  `email_unsubscribe(p_token)`, a SECURITY DEFINER function taking the token as
  an ARGUMENT. `chat_threads.buyer_email_notified_at` dedups, and a new seller
  reply clears it so the window reopens.
- **Cron auth: use `cron_key_matches(p_key)`.** The key pg_cron sends is not the
  service-role key, and the `CRON_SECRET` edge secret the other cron functions
  guard on is NOT SET on this project — so their `if (CRON_SECRET)` check lets
  anything through. Do not copy that pattern.

### Deleting an anonymous user deletes the conversation (latent, do not trip it)
`chat_threads.buyer_id -> auth.users ON DELETE CASCADE`, and `chat_messages`
cascades off the thread. Supabase's own guidance is to purge anonymous users
periodically; doing that here would delete live chats and make the seller's
inbox row vanish. No such cron exists today. Before any anon-cleanup job is
added, that FK must become ON DELETE SET NULL with the thread keeping its label.

## "This week" call list — the retention loop (don't scatter it again)
`src/utils/thisWeek.js` (ranking) + `src/components/crm/ThisWeek.jsx` (UI), on
the Salesman Premium dashboard, first thing on the page. It merges four things
that already existed on four separate tabs nobody opened: leads never replied
to, leads going quiet, due nudges, and past buyers with a renewal or an ageing
car. Sources are the page's existing `leads`/`customers` state plus `useNudges`
— no new queries.
- **One row per HUMAN, not per reason.** Someone whose insurance lapsed AND who
  is trade-up ready is one phone call; extra reasons ride along as `also`.
- Ranking: never replied > due reminder > going quiet / renewal > trade-up.
- **`last_contacted_at` is the heartbeat of this feature.** Every path that
  counts as contacting someone MUST stamp it, or the same names come back
  tomorrow and the list stops being believable. Writers today: OutreachHub
  (`:140`), `logCall` and `handleThisWeekContacted` in `SalesmanPremium.jsx`.
  `updated_at` is NOT a substitute — it moves on any edit.
- No invented numbers in any draft (no price, instalment, discount, trade-in
  value, rate or approval), and no auto-send: Message opens WhatsApp with the
  text and the human presses send.

## Performance tab (Salesman Premium) — DIAGNOSIS only, never a call list
`src/utils/salesPerformance.js` (all the maths, pure + unit-tested via
`npm run test:perf`) + `src/pages/salesmanPremium/AnalyticsTab.jsx` (UI) +
`src/hooks/useStageHistory.js` (the funnel's stage history). Two sub-tabs:
**Selling** (funnel drop-off, close rate + 30d trend, reply speed, loss reasons,
source quality, ranked coaching insights) and **Listings** (the traffic metrics
the tab used to be, unchanged).
- **The line: this page says WHERE you are losing deals across many leads.
  "This week" on the dashboard says WHO to call today.** Premium already had two
  call lists (ThisWeek + `useNudges`); a third one here is the duplication the
  rules above forbid. Salesman Lite's `renderPerformance` nudges are ACTION
  nudges ("6 stale leads → go to Leads") — do NOT port them here, that is the
  overlap this split exists to avoid.
- **The funnel reads stage HISTORY, not `leads.stage`.** A lost deal is charged
  to the stage it actually died at, via `lead_activities` rows of type
  `stage_changed` (`to_stage`). Reading only the current stage puts every loss at
  "New" and blames the wrong step for everything. Guarded by a test.
- **Weakest step = most PEOPLE lost, not the highest percentage**, and it needs
  `reached >= 4`. A 100% drop-off on one lead is noise, and acting on it sends
  the rep to fix a stage they have been to once.
- **Every insight has a minimum sample size and quotes a real number.** Below the
  threshold the card says what unlocks it instead of inventing a pattern. No
  invented money anywhere — nothing here knows a rep's commission rate, so there
  is no "this is costing you RM x" (same rule as AI drafts).
- `useStageHistory` only runs when the lazy tab mounts, so no other surface gains
  a query, and it selects three columns — no buyer name, phone or note.

## Equity mining / trade-up list (RAPTOR-3) — built, don't rebuild
Customers tab in `SalesmanPremium.jsx` (`renderCustomers`) has a `Trade-up
ready` filter. Two triggers, OR'd: owned 3+ years (`purchase_date`) or a car 5+
model-years old (`car_year`). The vehicle-age one exists because the platform is
six months old — an ownership-age-only rule returns zero rows until 2029.
- **Never show an estimated equity, trade-in or payoff figure here.** No table
  holds a loan tenure or rate, so any such number is invented. This surfaces WHO
  to call; the salesman inspects the car before quoting. Same rule as AI drafts.
- The WhatsApp opener is a fixed string with no price, instalment or approval in
  it, and only renders when the stored phone has 9+ digits.

## Follow-up nudges (RAPTOR-1/4) — built, don't rebuild
A nudge = a reminder with the message already drafted, queued against one lead.
- `scheduled_nudges` (dealer_id, salesman_id, lead_id, draft_message, reason,
  ai_drafted, scheduled_for, status, notified_at, actioned_at). status flow:
  pending -> ready -> sent | dismissed | expired. Partial unique index
  `scheduled_nudges_one_open_per_lead` allows only ONE open nudge per lead.
- `fire_due_nudges()` — SECURITY DEFINER sweep, pg_cron jobid 12 every 5 min.
  Dismisses nudges on closed/deleted leads, expires ignored ones after 7 days,
  flips due ones to `ready` and inserts a `salesman_notifications` row. That row
  is the push (trg_push_on_salesman_notification does the rest) — pure SQL, no
  edge function and no service-role JWT in the cron command.
- Frontend: `src/hooks/useNudges.js`, `src/components/crm/NudgeQueue.jsx`, and
  the AI-draft + "Remind me to send this later" controls in
  `src/components/crm/OutreachHub.jsx` (salesman-scoped only — the dealer-wide
  hub passes no salesmanId and hides both).
- AI drafting reuses the `wa_reply` quota key (50/day). `salesman_ai_quota_ok()`
  returns false for any feature key it doesn't recognise, so inventing a new key
  would silently disable the button for everyone — reuse an existing one.

## P&L model (StockTab)
fetchPnl in DashboardPage.jsx computes per-unit gross in two parts:
- Front gross = sale price − purchase price − recon cost − included services − commission − handover processing costs
- Back gross = F&I add-on revenue − add-on cost (deal_products)
- Total gross = front + back
Both displayed in separate labelled sections in the P&L modal.

## RLS policy safety
- NEVER write an RLS policy on a table whose USING/CHECK expression does a subquery on that SAME table — it causes infinite recursion and breaks every read (symptom: profile fetch fails → app redirects to login in a loop)
- For any policy that needs to reference `profiles` (especially policies ON profiles), use a SECURITY DEFINER helper that bypasses RLS: `get_my_dealer_id()`, `is_superadmin()`, `is_linked_salesman()`, `is_active_salesman()`
- Dealer profile rows have `dealer_id = NULL` (they own themselves) — to grant a salesman read access to their dealer, match `id = get_my_dealer_id()`, NOT `dealer_id = get_my_dealer_id()`
- leads.lead_source CHECK only allows: walk_in, whatsapp, referral, drevo_enquiry, enquiry, manual — any other value rejects the whole insert
- After adding any policy, test it with a real row read before shipping

### A share token is a PASSWORD — check it, don't pattern-match it (bit twice, same day)
A "secret link" is only secret if the query compares the token to a value the CALLER
supplied. A predicate that merely describes the token's SHAPE (`length(t) >= 32`,
`t ~ '^[0-9a-f-]+$'`, `t IS NOT NULL`) is a ROW FILTER, not an ownership check — it
matches every shared row at once, for anybody, with no token needed. Both live bugs
on `loan_applications` were exactly this:
  - policy `loan_share_token_update` → anon could UPDATE every shared application,
    then set `share_token` to a value of its choosing and read the row back
  - view `loan_application_share_view` → anon could SELECT every shared application
    AND the tokens themselves, which unlock the rest
Rules that follow:
  - Bearer access belongs in a SECURITY DEFINER **function** that takes the token as
    an ARGUMENT (`where share_token = p_token`), never in a policy or a view, because
    only a function can require the caller to present it. `get_loan_share(p_token)` is
    the pattern to copy.
  - **Never return the token as a column.** Anything that can read the row can then
    replay the link.
  - A share surface is READ-only. There is no legitimate anon INSERT/UPDATE/DELETE on
    `loan_applications` — if a policy seems to need one, the design is wrong.
  - `revoke ... from anon` is NOT enough when the grant is held by `PUBLIC` (`=X/...`
    in `proacl`) — anon inherits it and the revoke silently no-ops. Revoke from
    `public`, then grant the real roles explicitly. Verify with
    `has_function_privilege('anon', ...)` / `has_table_privilege('anon', ...)`, never
    by reading the migration back.
  - **Never copy grants off an existing object when recreating it.** Migration
    20260826d recreated that view "verbatim", carrying its `grant ... to anon` along
    and preserving the hole. Read what each grant allows, or drop it.
  - Test every anon-reachable surface AS anon before shipping: `set local role anon`
    inside a DO block that raises at the end, so the probe rolls itself back.

### Naming a subject in an argument is not an ownership check (same family)
A share token at least has to be presented. An argument that merely NAMES whose
row to touch — an email, a dealer id, a list of car ids — proves nothing at all,
and a SECURITY DEFINER function that acts on it is doing the caller's bidding
with the database's privileges. Two live examples, both fixed 2026-09-05
(`20260905l`): `login_throttle_clear(p_email)` deleted ANY email's brute-force
lockout, and `get_car_analytics(uuid[])` returned ANY seller's per-car views and
enquiries. Both were granted to `anon`.
  - Derive the subject from the SESSION (`auth.uid()`), then use the argument
    only to confirm it. `get_dealer_car_analytics` is the pattern to copy: it
    takes `p_dealer_id` but refuses unless it matches `auth.uid()`,
    `get_my_dealer_id()` or `is_superadmin()`.
  - **`authenticated` is not a boundary against the public here.** Anonymous
    sign-in (guest buyers) hands out the `authenticated` role, so every
    authenticated-only grant is reachable by any visitor who opens a chat. The
    check has to be inside the function.
  - When a function is superseded by a guarded version, DROP the old one. Both
    holes above were dead or near-dead predecessors of a correct function that
    already existed — a second entry point is the drift, not a spare.
  - Trigger functions (`returns trigger`) are not PostgREST-callable, so ignore
    them when triaging the advisor's anon/authenticated definer lists and read
    the ones that take an argument and do work.

## Theme — know which surface you're on
- The DEALER DASHBOARD is LIGHT: white cards (#fff), border #e5e7eb, primary text #111827, secondary #6b7280, accent #dc2626. Any panel embedded in the dealer dashboard (incl. handover/PostSaleBoard, CRM bookings) MUST be light to match — do NOT force a dark wrapper on it.
- The #080C14 / dark background applies to the PUBLIC marketplace + marketing surfaces (HomePage, hero, public car pages), NOT the dealer dashboard.
- On dark surfaces only: use white/light text (rgba(255,255,255,x)); on the light dealer dashboard use dark text (#111827 / #6b7280 / rgba(0,0,0,x)).

## Mobile-first requirement
- Every UI change must be mobile-friendly — test at 375px width before considering done
- Sidebar/panel layouts: use `hidden md:block` for desktop sidebar, horizontal scrolling pill nav for mobile
- Fixed pixel widths on layout containers are banned — use flex/grid with minWidth: 0 on flex children
- Match the text color to the surface (see Theme section above) — never light text on a light card

## Overlay / modal rules (non-negotiable — these bugs have bitten twice)
1. **Always use `createPortal(jsx, document.body)`** for any bottom-sheet, drawer, or full-screen overlay. Without it, parent stacking contexts (overflow:hidden, transform, z-index) clip the blur and allow the parent to still scroll.
2. **Always lock body scroll**: `document.body.style.overflow = 'hidden'` when the overlay opens; restore to `''` in the cleanup. Do this in a `useEffect` keyed on the open boolean, NOT inline.
3. **`closeAndRun` pattern for nested actions**: when an action button inside an overlay should open a second modal, ALWAYS close the first overlay before opening the second. Pattern: `const closeAndRun = (fn) => () => { setDetailUnit(null); fn(); };`. Never open two overlays in parallel unless explicitly designed for it.
4. **SELECT queries for detail drawers must be complete**: never use a partial select for a view that shows all spec fields. Expand the `select()` call to include every column needed before building the detail UI — patching it afterwards requires re-reading the file every time.
5. **`useModalHistory` race condition**: the hook's `history.back()` cleanup fires `popstate` asynchronously. If you call `setModalA(null)` and `setModalB(open)` in the same tick, the cleanup for A fires `history.back()` which the just-registered B handler catches → B closes immediately. **Do NOT register `useModalHistory` for lightweight popups that have their own × / overlay-click close controls.** Only register it for primary drawers (LeadDrawer, main detail panels).

## Product tour (Salesman Premium) — anchors and placement
14 steps in `TOUR_STEPS` (SalesmanPremium.jsx), index-matched to `TOUR_TABS`.
- **Every step rings the thing it is TALKING ABOUT**, never a nav button standing in
  for it. Pointing at the Settings nav while describing the invite box is what put the
  card on top of that box. Steps with no nav slot ring their own content:
  `TOUR_HIGHLIGHT` maps the step's tab -> a `data-tour-id` (`sp-merge`,
  `customers-heading`, `handover-heading`); the Inbox pair rings the sub-tab pills
  (`bookings`, `leadhistory`, set in salesmanPremium/shared.jsx SubTabs).
- **Placement lives in `src/utils/tourPlacement.js` (`placeTourCard`) and its rule is:
  never overlap the target, never leave the viewport.** It picks the side with the most
  free space. Do NOT reintroduce a per-surface branch or a guessed card height — the card
  is MEASURED after render (`tourCardRef` + `tourCardH`). Guarded by
  `tests/tourPlacement.test.mjs` (`npm run test:tour`) — run it after touching the geometry.
- The card is portalled to `document.body` (overlay rule 1). Its scroll goes on an INNER
  wrapper: `overflow` on the card clips the arrow, which is absolutely positioned outside
  the padding box.
- Tour navigation uses `switchTab(tab, { replace: true })` — one history entry per step
  turned the phone back gesture into a walk back through the whole tour. `startTour()`
  records the entry tab and `dismissTour()` returns there.
- In-content targets (`TOUR_IN_CONTENT`) re-measure on scroll; nav-anchored steps scroll
  the page back to the top so the panel starts at its beginning.

## Prompt discipline
- Never write more than 80 lines of instructions per prompt
- Always read the target file first before editing
- One concern per session: data OR layout OR styling OR mobile
- Never use emojis in UI code, commit messages, or responses

## Dealer dashboard audit — pending fixes (2026-06-06)
Full report: AUDIT_DEALER_DASHBOARD.md. Root cause across all: drift between two
things that should be one (stage names, plan columns, GP source, sold timestamp,
source-of-truth table). Reference for "done right": DashboardPage `fetchPnl`.

### CRITICAL
- [x] C4 — Tiering split-brain. Caps enforce on `profiles.plan`; onboarding writes
  `selected_plan` (legacy junk values); DB `plan_config` is a third disagreeing copy.
  New dealers get unlimited listings, no enforcement. FIX: collapse to one column
  (`selected_plan`), point cap triggers `check_listing_cap`/`enforce_listing_cap` at
  it, backfill legacy values to real keys, reconcile `plan_config` with
  `src/utils/planConfig.js`. Prerequisite for tiering enforcement.
- [x] C1 — `car_listings.gross_profit` is a dead column (always 0; trigger
  `compute_listing_gp` only sets days_in_stock). RevOpsPage.jsx:290-300 trusts it so
  GP MTD is always wrong. FIX: stop trusting the column, recompute from parts like
  fetchPnl (and add commission — see H1).
- [x] C2 — RevOpsPage.jsx:431 / ServicesPage.jsx:170 filter won deals as
  `closed_won,deposit_taken` but prod uses `won`. FIX: filter on the real won stage(s).
- [x] C3 — LeadDrawer.jsx:673 writes `closed_won`; LeadsPage.jsx:102-107 only buckets
  STAGE_ORDER so closed deals vanish from the board. FIX: standardize stage set (see below).
- [x] C5 — DashboardPage.jsx:365 `bucketGPByMonth` reads `u.sold_at` on stock_units
  (only `sold_date` exists) -> GP sparkline always flat. FIX: use `sold_date`.

### HIGH
- [x] H1 — RevOps front-gross fallback omits commission and fetches no commission
  column (RevOpsPage.jsx:294). FIX: subtract commission_amount; add to select.
- [x] H2 — useLeads.js:31 `addLead` sets `dealer_id: user.id` (orphans manager/admin
  leads) and forces `stage:'new'`. FIX: derive via getDealerIdFromProfile; honor payload stage.
- [x] H3 — AddLeadModal.jsx:196 offers lead_source values the CHECK rejects -> silent
  insert failure. FIX: restrict options to allowed set (or widen CHECK) + show error toast.
- [x] H4 — AddLeadModal.jsx:36 car list uses `eq('dealer_id', user.id)`; empty for
  manager/admin. FIX: derive dealer id by role.
- [x] H5 — LeadDrawer.jsx:650 close modal only fires for literal `closed_won`, but the
  progress bar writes `won`, bypassing close+car+stock+sibling sync. FIX: route Won
  through the close flow.
- [x] H6 — Two sources of truth: RevOps uses car_listings, Oversight/Overview use
  stock_units -> different revenue/units for same month. FIX: pick one source.
- [x] H7 — gm_salesman_scores keys on `assigned_to` (25/64 rows); app uses
  `salesman_id` (40/64). FIX: key the RPC on salesman_id.
- [x] H8 — LeadDrawer.jsx:701 sibling-lost update omits `won`, can flip a real win to
  closed_lost; deposit gate :1143 omits closed_won. FIX: consistent terminal-state set.

### MEDIUM
- [x] M1 — compute_stock_unit_gp omits included_services_cost + commission -> stock GP overstated.
- [x] M2 — Duplicate listing-cap triggers (enforce_listing_cap + trg_enforce_listing_cap). Drop one.
- [x] M3 — Overlapping/mutually-firing stock<->listing sync triggers; recon_cost clobbered on sale.
- [x] M4 — OverviewTab.jsx:178 counts won/closed_* as active pipeline. FIX: exclude real terminal stages.
- [x] M5 — gm_pnl_snapshot LMTD window carries intraday remainder / ignores month length.
- [x] M6 — LeadDrawer.jsx:310 appointment insert reads `lead.name` (undefined) -> buyer_name NULL. Use buyer_name.
- [x] M7 — calcInsuranceEst (LeadDrawer.jsx:133) duplicate caps / subtracts full cap per band -> wrong premium.
- [x] M8 — Add-on avgPerDeal numerator includes null-lead rows, denominator excludes them (RevOps:436 / Services:178).
- [x] M9 — fn_auto_deal_financial ON CONFLICT DO NOTHING with no constraint target -> dup on re-sell. Confirm reader.
- [x] M10 — defaultTasksFor (postSaleSteps.js:93) parallel B7 seed path can diverge from the DB won-trigger.

### LOW
- [x] L1 — RevOpsPage.jsx:859 hardcoded `6217` response-time bar divisor.
- [x] L2 — Unguarded `Number(sold_price)` reduces (RevOps:436 / Services:178) -> NaN risk.
- [x] L3 — DashboardPage.jsx:5692 StockTab handleMarkSold never refetches; derived fields stale.
- [x] L4 — Neither mark-sold path writes actual sold_price to car_listings; per-salesman gross uses asking price.
- [x] L5 — OverviewTab delta() returns null when prev=0, hides growth-from-zero.
- [x] L6 — useLeads.fetchLeads has no frontend dealer_id filter (RLS-only).
- [x] L7 — Swallowed select errors across RevOps/Services (no error checks).
- [x] L8 — Inline loan calc flat-rate vs HP reducing-balance -> two monthly figures for one deal.

### Recommended order
1) C4 (tiering)  2) C1+H1 (GP/commission)  3) C2+C3+H5+H8+M4 (one stage standard kills 5)
4) H2+H3+H4 (AddLead correctness)  5) C5+M6 (column typos)  6) H6+H7 (one source/owner)
7) DB hygiene M1/M2/M3/M5/M9  8) LOW items.
