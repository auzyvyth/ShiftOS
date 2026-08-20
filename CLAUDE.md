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
- Font: system-ui (body — native OS font, no webfont), Bebas Neue (display)
- Cards: bg-gray-900, border-gray-800
- Public marketplace surfaces: read `DESIGN.md` (tokens, scales, grid, anti-slop rules) before any public-facing UI change.

### Anti-slop UI rules (non-negotiable)
- NEVER put a decorative coloured left accent bar / vertical side-line on list rows or cards to signal status or category — it reads as generic AI slop. Convey state with a small pill/tag, a status dot, or a very subtle full-row background tint (stage/status hue at ~5-10% alpha) instead.
- Keep colours low-saturation and DON'T stack multiple saturated accents in one component (e.g. a row of green + purple + red + amber buttons). One primary accent per card; push secondary/rarely-used actions into an overflow (⋮) menu rather than lining them all up.
- Prefer one clear primary action visible; hide the long tail behind a kebab/overflow menu.

## Key files
- src/pages/HomePage.jsx — public XDrive marketplace
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
`create_lead_from_whatsapp` (ContactGate/WhatsApp tap) and the `enquiry_to_lead` trigger
(enquiry form). Resolution order, first hit wins:
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
- src/components/postsale/{PostSaleBoard,PostSaleChecklist}.jsx + src/hooks/usePostSaleTasks.js + src/utils/postSaleSteps.js
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
service_packages (dealer_id, customer_id, lead_id, listing_id, package_name, total_visits, used_visits, valid_months, sold_price, sold_at, expires_at[generated]) — prepaid service bundles per customer. Managed in CustomersTab.

## Service categories (serviceCategories.js)
Keys: protection, tint, window_tint, warranty, insurance, road_tax, service, accessories, workshop, other
Usage: import { getCategoryCfg } from '../utils/serviceCategories'
Each entry: { icon: LucideComponent, color: hex, twColor: tailwind-class, label: string }

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

## Edge functions — THE REPO IS NOT THE SOURCE OF TRUTH (read before touching one)
Plain version: what is running on Supabase is often NOT what is in `supabase/functions/`.
Some functions were built straight in the Supabase dashboard and never committed; others
were edited in the repo and never redeployed. Both directions exist RIGHT NOW.
- **ALWAYS run `mcp__Supabase__get_edge_function` and diff it against the repo file
  BEFORE you edit or redeploy anything.** Redeploying "the repo version" without
  checking silently deletes whatever only exists in the deployed version.
- Same rule for discovery: `mcp__Supabase__list_edge_functions` is the real inventory.
  As of 2026-08-16 there were **16 deployed but only 10 in the repo**. Missing from the
  repo entirely: `send-push`, `send-push-warm-leads`, `notify-price-alerts`,
  `appointment-reminder`, `telegram-enquiry-notify`, `bootstrap-superadmin-alias`.
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
- ai-proxy — proxies Claude API calls for AI features
- delete-account / purge-deleted-accounts — LITE-3 self-service deletion + 30-day purge
- import-drive-images — rehosts Google Drive folder images into the car-images bucket
- send-push — web push sender (see below)
- send-push-warm-leads — deployed only; pushes dealers when warm leads sit 3+ days
- notify-price-alerts, appointment-reminder, bootstrap-superadmin-alias — deployed only

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
- **VAPID keys are permanent. NEVER regenerate them.** Every push subscription is
  cryptographically bound to the public key it was created with. Swap the key and every
  existing subscription dies silently — no error the user ever sees, they just stop
  getting notifications and cannot be migrated. If a key must change, every user has to
  re-subscribe from scratch. There is also no such thing as running two keys side by side.
- iOS only allows web push for a PWA installed to the home screen (16.4+). PWA-1 shipped
  the install prompt, so that prerequisite is met — `src/components/InstallPrompt.jsx`.
- The local `Notification.permission` code in Salesman Lite
  (`src/pages/SalesmanLite.jsx:849`) is NOT push. It only fires while the tab is open.
  Do not confuse the two.

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
