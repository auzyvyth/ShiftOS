# ShiftOS — Project Context

## Pending tasks — session start protocol
1. Read `TODO.md` at the start of every session.
2. Present the pending items to the user and ask which one to work on first.
3. After completing an item, delete it from `TODO.md`, commit the updated file, and push.
4. Do not start work without asking the user which item to tackle.

## App Store / Play Store readiness — PAUSED (owner, 2026-10-09)
**Store work is paused until there is revenue** (`TODO.md` MOBILE section: "everything
else needs money, and a technical partner"). Do NOT suggest or push MOBILE-8..11
unprompted, and ignore the "every session" rule below until the owner lifts the pause.
A session on 2026-10-13 kept nudging MOBILE-8 because this heading still said
"every session"; the pause note lived only in TODO.md.

(Original rule, suspended:) The owner wants forward progress toward shipping on the Apple App Store and
Google Play in EVERY session, not only when asked. Treat it as a background
work stream running alongside whatever else the session is doing: before
ending a session, check whether an open MOBILE-*/PWA-* item in `TODO.md` was
moved forward. Don't let a session close having advanced nothing here — unless
the whole stream is genuinely blocked on an owner decision (see below), in
which case say so rather than picking a path yourself.
- Roadmap lives in `TODO.md` under `MOBILE-1`..`MOBILE-5` and `PWA-1`..`PWA-3`
  (search those keys). Read the full entry before touching auth flow, the
  manifest, or edge function CORS — this area has already taken down prod
  once (MOBILE-1 PKCE migration, #369→#370, reverted same day) and a retry
  needs a staging click-through, not a code-read.
- **MOBILE-2 is DECIDED (2026-09-14): Capacitor.** `capacitor.config.json`,
  `android/`, `ios/` are scaffolded — see `TODO.md` MOBILE-2 for what's real
  vs. still provisional (`appId` is a placeholder pending an owner call on
  whether the store listing is branded ShiftOS or XDrive). **Current
  state (re-audited 2026-10-09): NOT just signups left — real build work remains.**
  Done: MOBILE-4 CORS, MOBILE-6 absolute /api URLs, MOBILE-7 account deletion, and a
  privacy page already exists at `/privacy` (src/pages/PrivacyPage.jsx). Still to BUILD:
  MOBILE-8 native push (web push does not run in the app's WebView), MOBILE-9 Google
  sign-in inside the app, MOBILE-10 deep links for email links, real icon/splash (the
  native icons are still Capacitor's default), and a first device build. Owner-only:
  MOBILE-5 tenancy decision, PWA-3 icon call, app name/appId, Apple + Google accounts,
  a Mac for the iOS build. Update this line as each is resolved so it never goes
  stale.

## Brand is DREVO now (owner, 2026-10-16) — write "Drevo", never "XDrive"
XDrive is being retired (it collides with BMW's xDrive); `drevo.my` is bought.
Full plan and status: `TODO.md` BRAND-1.
- **Every NEW article, feature, page, copy string, email or notification says
  "Drevo", not "XDrive".** Do not add a new "XDrive" anywhere. Existing XDrive
  text is renamed in one go on switch day, not piecemeal.
- **Never hardcode a domain in new code.** Use `SITE_URL` / `ROOT_DOMAIN` /
  `isOwnHost` from `src/config/site.js`, or a relative link (`/showroom`). That
  file is the one place the domain lives; it still says `xdrive.my` until the
  switch, and flipping it is the switch.
- "ShiftOS" (the seller/dealer software name) is retiring too, but WHAT it
  becomes is an open owner call. Don't add new "ShiftOS" text; ask if unsure.
- Never rename identifiers to match (`ShiftOSPage`, the `/shiftos` route,
  `xd_*` storage keys, DB values like `drevo_enquiry`): renaming a key resets
  every user's saved setting; renaming a route breaks links.

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

## Legal subjects — always verify, never reason from vibes (mistake made 2026-09-14)
When a feature touches something that could be illegal, regulated, or expose the
platform to liability (a payment/financing arrangement, data privacy, consumer
protection, anything with a real-world "who's at fault if this goes wrong"), DO
NOT answer from parametric memory or a gut sense of "feels legally murky." Web
search the actual law/regulator position FIRST, before giving a recommendation,
the same way an AI-provider question gets checked against real docs instead of
memory.
- **What happened:** Sambung Bayar (car loan takeover) was treated as "informal
  but tolerated" and the advice was to keep it and just add disclosure. That was
  wrong — it's a criminal offence under s.38 of the Hire Purchase Act 1967
  (Malaysia): fine up to RM10,000, up to 3 years jail, contract void under the
  Contracts Act 1950. A search would have caught this before, not after, a
  recommendation was given and partially built.
- **The tell to watch for:** if a justification for keeping/building something
  sounds like "well it's common practice" or "it's a gray area" on a subject
  with real legal weight, that itself is the signal to go verify — common
  practice and legal are not the same thing.
- Once verified, if something needs to come out, remove it fully (feature +
  data), don't just soften it with a disclosure/warning label bolted on —
  that was the first (also wrong) instinct here.
- Checked at the same time and confirmed clean: `financing_type` FINANCING_TYPES
  filter also had a 'sambung_bayar' option (dead column, always NULL, but still
  a selectable buyer-facing filter) — removed alongside CarForm's option. Same
  root cause (a feature list including a value nobody checked the legality of),
  so anywhere a new payment/financing/ownership-transfer TYPE is added to this
  product, check it against real law before it ships, not after a user catches it.

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
- **Salesman Premium is moving to `premiumDark`** (`src/theme/tokens.js`, owner 2026-10-25:
  "keep dark, premium, colours that complement"). Depth by tone (card #111318 on the near-black
  canvas, rows #181b21), no borders on cards, Drevo red for fills only, mint `up` (red's
  complement, desaturated) as the only green; no blue/purple/amber. Adopted one tab at a time:
  Dashboard (`salesmanPremium/DashboardTab.jsx`) + `crm/ThisWeek.jsx`, then Listings
  (`salesmanPremium/ListingsTab.jsx`, `VerifyBadgePrompt theme="premium"`) and its pop-ups:
  `CarDetailPopup theme="premium"`, `LoanPosterSheet theme="premium"` (Lite and the linked
  panel pass nothing and keep `panel`), and the add/edit sheet `ListingFormModal`. CarForm is
  shared with the LIGHT dealer dashboard, so it is themed by `.pd-form`
  (`salesmanPremium/premiumForm.css`, remaps its Tailwind colour classes, only inside that
  sheet) plus its `dark` prop (only Premium passes it) for the inline step dots, sticky
  footers (CarForm + QuickSteps via QuickCarFlow) and `DamageMap theme`. A new colour class
  in CarForm needs a line in premiumForm.css or it shows light in Premium. Chat tab:
  `SellerInbox theme="premium"` -> `THEMES.premium` in `chat/ChatThread.jsx` (no bubble glow,
  neutral AI bar + privacy note; `LEGACY` keeps light/dark exactly as before). Any new colour
  in the chat components goes in THEMES as a key, never inline, or Premium drifts. Leads tab:
  cards, rail and `ChatSheet theme="premium"`; the stage buttons KEEP their per-stage hues (owner);
  one heat pill per card; the desktop grid flows with the page (sticky rail), never an inner
  scroller. Inbox tab (Bookings | Lead history, owner kept both): status pills are one tone, the
  WORD carries the colour (pending red, confirmed mint); pending/confirmed cards carry no pill
  (the section heading says it); booking cards grid on desktop; `BookingWeekCalendar` is
  Premium-only and on `PD` (no amber: "needs your OK" = dashed block + red dot). `SubTabs
  premium` is the premiumDark switch (Inbox, Listings, Sold, Analytics pass it). Outreach tab:
  `OutreachHub` + `NudgeQueue` take `theme="premium"` (dealer = light, linked salesman = `dark`,
  unchanged). Premium drops the four count tiles (three were the Hot/Cold/All switch counts; one
  line "N contacted today" stays), the 0-100 ring (it was only time since contact, the age chip
  says it), the footer count, and the car + price in the open lead's header (the car card has
  them). Only a lead silent 7+ days is red; WhatsApp buttons are the red fill, no green gradient. Analytics tab
  (`salesmanPremium/AnalyticsTab.jsx`, own `PD` CARD/EYEBROW/STAT, not shared.jsx's `panel` ones):
  top card = commission + cars sold ALL TIME with "Recent sales" folded in (it sat under Listings);
  no "sold this month" (Dashboard tile). Listings = ONE tap-through card (taps + views as its
  working, views line) where four tiles were (WA taps = Dashboard tile, "Enquiries" = the Inbox
  count); per-car table lists cars for sale only. Desktop Listings = two half-width columns (left:
  tap-through, by car, by platform; right: the views chart, 7-day total; owner: "too wide"). `ChannelBreakdown theme="premium"`: neutral bars,
  mint WA count, no second "Direct" note (Lite + linked panel keep brand colours). Sold tab:
  `SoldCustomers` / `ComingUp` are Premium-only and on `PD`; the shared `PostSaleBoard`,
  `PostSaleChecklist` and `ServicePackages` take `theme="premium"` (dealer = light, linked
  salesman = `dark`, both unchanged). On the Handover pill `ComingUp skipHandover` drops the
  handover rows (the board below lists them); the board drops "N in processing" (the pill's
  badge) and the checklist its progress bar (the deal header has it). The rest of
  Premium still uses `panel`; do not mix the two inside one tab. Each fact shows ONCE on the
  dashboard: the 7-day traffic chart stays (owner: "it's valuable"; its legend carries the
  only views total), "visits from shared links" sits under Share in Your page, no platform
  breakdown (Analytics has it), no second follow-up list (This week is the one), the goal is
  the bar in "Sold this month". Listings card = photo (state as a pill on it), name + status
  menu, price + margin (only when computable), specs, one traffic line, ONE "improve" line
  (`listingScore`'s first fix), Caption + Edit + ···; Link lives in ···. No page-link bar
  (Dashboard has it) and no "Live on XDrive" strip (the Available pill says it). Settings: each section's name is said once (rail/breadcrumb +
  header); the shared cards inside take `theme="premium"` and then drop their own heading
  (VerifyIdentity, AvailabilityEditor, PushToggle, ChangePasswordCard, ReferralCard, MyNewModels);
  photo + cover are one card; no read-only username box (the Google preview shows the link).

### Anti-slop UI rules (non-negotiable)
- NEVER put a decorative coloured left accent bar / vertical side-line on list rows or cards to signal status or category — it reads as generic AI slop. Convey state with a small pill/tag, a status dot, or a very subtle full-row background tint (stage/status hue at ~5-10% alpha) instead.
- Keep colours low-saturation and DON'T stack multiple saturated accents in one component (e.g. a row of green + purple + red + amber buttons). One primary accent per card; push secondary/rarely-used actions into an overflow (⋮) menu rather than lining them all up.
- Prefer one clear primary action visible; hide the long tail behind a kebab/overflow menu.

## System map — `docs/ARCHITECTURE.md`
The one drawing of the whole system (Mermaid): surfaces, the lead-to-sale flow,
notifications, scheduled jobs, sign-in routing, deploy path. Read it first in a new
area. **Update it in the same commit** as any change that adds a screen, a table
family, a cron job or an outside service. Check diagrams parse before committing.
The phone-friendly page (tap a diagram to pinch-zoom) is BUILT from that file:
`node tools/build-system-map.mjs <out.html>` outside the repo, then republish the
artifact. Never hand-edit the page or commit its HTML: it would be a second copy.
`src/pages/MindMapPage.jsx` (`/mindmap`) is an older hand-drawn map, long stale (it
still says "21 pages") — do not update it; it is pending removal.

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
- src/components/DamageMap.jsx — THE condition-report diagram (auction-sheet "unfolded car"),
  used by CarForm, CarDetailPage, ListingReviewModal and the dealer ListingDetailDrawer. One
  copy only: the drawer had its own fork reading a `{zone}` shape nothing writes, so it showed
  every car as clean. Pass `theme="light"|"dark"` to match the surface. Marks are
  `{x,y,type,severity,panel,v:2}`; marks without `v` came from the old top-down drawing and
  are re-projected onto the top view by `toCurrent` - never strip `v` when saving.

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
- **The reverse is guarded too: a car with a live won deal cannot leave `sold`.**
  `trg_guard_sold_car` (on `car_listings`) raises `car_has_won_deal`. 12 won deals
  had been orphaned by someone flipping the car back to `available` from a status
  dropdown. The ONE way out is `undo_car_sale(listing_id)`: it moves the won
  lead(s) to `negotiating`, deletes the customer + handover rows the won-trigger
  made (a re-win recreates them), and relists the car; it refuses if a service
  package was sold on the deal. Every status control routes the error through
  `src/utils/undoSale.js` (`offerUndoSale`). Never add a status write that
  bypasses it or sets `app.undo_sale` from the client.
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
- **`useHandover` loads FULL step rows (`TASK_COLS`) and keeps them on the device**, and the board
  hands them to the checklist as `initialTasks`, so opening a deal paints at once (2026-10-25: it
  showed "Loading handover steps..." on every open, behind three queries in a row). The checklist
  still refreshes in the background, its three reads in parallel; a tap bumps `edits` so a late
  read never un-ticks a step. Premium opens a deal as a POP-UP (`HandoverSheet` in
  PostSaleBoard.jsx, `theme="premium"` only; portal, scroll lock, `useModalHistory`); the dealer
  dashboard and linked panel keep the inline expand.
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
In the UI a package is an **aftercare plan** (2026-10-12): presets for what dealers
actually give (free first service, oil change, periodic service, care visit) plus only the
`service`/`workshop`/`other` catalogue items. PPF/tint/warranty are one-off add-ons, not
repeat visits. Visit N is due at `sold_at + N x valid_months/total_visits`
(`src/utils/aftercare.js nextVisitDue`); the Sold tab's Coming up list and This week's
`service_due` both read that one date. A visit is a dated row with an undo, not an integer
someone increments. A package expiring with visits unused surfaces in "This week"
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

## A seller's "Delete" archives the car, never a hard DELETE (2026-10-18)
Lite + Premium `handleDeleteListing` set `status='archived'`. A real DELETE unlinks the
car from 33 tables (each with triggers), took up to 5s and passed the 8s limit whenever
the DB was busy, and stripped the car off buyers' chats and leads. `archived` is already
excluded by `public_car_listings`, the listing cap and the one-card-per-model index; the
panels load listings with `.neq("status","archived")`. A won-deal car is refused
(`car_has_won_deal`) and offers Undo sale. Still hard-deleting, and still blocked by FKs
with no ON DELETE rule (`ai_caption_logs`, `broadcast_logs`, `service_packages`): the
dealer dashboard and the console.
- **The update must `.select("id")` and check a row came back, and the device copy
  (`sp_listings_` / `slite_listings_`) must be rewritten** (2026-10-19). RLS refuses as "0 rows,
  no error", and Premium never rewrote its saved copy, so a deleted car came back on reopen.

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
- **"Find a car by model" = the hub pages, `/used-cars/:brand/:model`.** One
  module, `src/utils/modelHubs.js`, owns the URL, the grouping and every
  sentence, and is shared by the SPA page (`UsedCarsHubPage.jsx`), the crawler
  render (`api/og.js`) and the sitemap. Grouping goes through `canonicalModel`
  (modelKey.js); the DB trigger `trg_normalize_car_model` (on `car_listings`)
  keeps `model` to the plain catalogue name and moves engine size / trim into
  `variant`, so do not re-add a model free-text path that bypasses it. A hub
  exists only while its model has a live car (else 404, never an empty page),
  and its copy may only quote numbers from the rows (asking prices, counts).
  Brand-only `/showroom/<brand>` is impossible: it collides with car slugs.
- **Every public page needs a crawler entry in `api/og.js`.** Bots never run
  the SPA; a route missing there gets the generic "Quality used cars" page.
  Share the copy through a `src/config/*Copy.js` file (see
  `salesmanLandingCopy.js`, `guidesCopy.js`, `featurePagesCopy.js`) — never
  retype it into og.js.
- **Articles are the exception: the crawler text is GENERATED from the article
  component.** `tools/generate-article-pages.mjs` renders each
  `src/pages/articles/*.jsx` to plain HTML into
  `src/config/articlePages.generated.js`, which og.js and the sitemap read
  (full body, FAQ, JSON-LD, dates). After editing an article, run
  `npm run articles:build` and bump its `dateModified`; `npm test` fails on a
  stale file (`articles:check`) and the build regenerates it anyway. A new
  article is a new file in that folder plus its route in App.jsx, nothing
  else. Articles are Malay by default; an English one sets `lang: 'en'` in its
  ARTICLE so the crawler page is served `lang="en"` with English links
  (`buildArticleHtml`, api/og.js). The generator gets `SITE_URL` from
  `src/config/site.js`, so build URLs from it, not a typed domain. Article copy is buyer-facing: never promise something about XDrive
  listings the platform does not check (three CTAs claimed every car was
  Puspakom-inspected / fully documented; nothing verifies that).
- **The public grids survive a database outage (2026-10-02).** The free DB
  froze twice in a day and the marketplace went blank. Every public listing
  query goes through `withTimeout` (a stalled DB HANGS requests, it does not
  fail them), and on failure the unfiltered views fall back to the device's
  saved copy, `LIVE_CARS_CACHE_KEY` (`readLiveCarsFallback`, 7 days, in
  `src/config/marketplaceConfig.js`), with `StaleListingsNotice` above the
  grid. Users: MarketplacePage grid + hero rows, CarListingPage `/showroom`.
  Never show that copy under an active filter or on a dealer storefront.
- **`/` and `/showroom` arrive with the newest cars inside the HTML (2026-10-18).**
  `middleware.js` sends real visitors on the main domain, unfiltered, to
  `api/shell.js` (CDN-cached 60s, plain index.html if the DB is slow). It embeds
  the 15 newest cars as a JSON data block and preloads the first two photos;
  `src/utils/serverSeed.js` copies them into `LIVE_CARS_CACHE_KEY` before React
  renders, so both pages paint cars on their first render (mobile LCP was 6.6s
  waiting on JS, then the DB, then the photo). The preload URL must equal what
  the card renders (`cdnImg(url, 480, 72)` ShowroomCard, `cdnImg(url, 300, 65)`
  HeroCarRow): change one size, change `PHOTO` in api/shell.js or the photo
  downloads twice. Never put anything private in that block: it is public HTML.
- **New cars enter through the hero's Used & Recon | New pill, never the car rows (2026-10-22).**
  The pill is MODES only; Hot deals and Finance calculator are links under the search.
  `NewCarPicker` (brand logo tiles -> model photo cards) opens `/new-cars/:brand/:model`;
  the model page's "Near" picker (device-remembered, `readBuyerState`) only SORTS advisors
  (that state, then its price zone), never filters, so no pick lands on an empty list.
  Brand logos: `LOGOS` in NewCarPicker, files in `public/brands/`; a brand without a CURRENT
  logo file renders as a wordmark (the old proton.svg was the ProtonMail logo; proton.png +
  byd.png + perodua.png are the owner's files, trimmed onto a transparent background). Brands come from live model cards (`liveNewCarBrands`,
  `src/utils/newCars.js`), so Perodua/Toyota/Honda appear by themselves once an advisor
  posts. The hero car rows filter `is_model_card = false`: model cards had taken every
  "All cars" slot.
- **"Continue looking" + the red line under a car's photo (REVISIT-1, 2026-10-23)** is the
  buyer's OWN history, kept on the device only (`src/utils/viewProgress.js`, key
  `xd_view_progress`, 40 cars, 30 days). Progress = scroll depth on the car page up to the
  top of "You might also like", the MAX ever reached (`CarDetailPage.jsx`, REVISIT-1 effect).
  The line is ONE component, `ViewProgressBar`, in ShowroomCard, CarCard and HeroCarRow; a
  new car card adds it, never a second bar. The hero row shows only when a viewed car is
  still live, and replaces the MPV row so the hero keeps its height. It sits under the
  cookie banner's `preferences` tier: off = nothing recorded and `setConsent` wipes it.
  Never send it to the server or into `analytics_events`.
- The marketplace header/footer live on a LIGHT surface. `body` is `#080C14`,
  so a translucent background in the site chrome composites over near-black —
  which is how the announcement bar ended up a dark band above a white header.
  Paint an explicit light colour, and don't reuse a grey across both surfaces.

## Phone numbers: ONE rule, ONE box, Malaysia only (INPUT-1, 2026-10-28)
Every phone input is `src/components/ui/PhoneInput.jsx` (fixed "+60", typed or pasted
0 / 60 / +60 not counted twice, cut at 10 digits, red when invalid); every check is
`src/lib/phone.js` (`isValidMyPhone`, `{ mobileOnly }` for a seller's WhatsApp,
`toPlus60`, `normalizePhone` = the DB's `normalize_my_phone`). The api/* routes import
the same file. Never add a raw `<input type="tel">` or a digit-count check (`>= 9`) again:
that is how a signup saved a number with extra digits. Malaysia only (owner + PDPA).
An OPTIONAL buyer number that fails is dropped, never a reason to block a lead.

## Seller numbers never ship to the public (CDP-3, 2026-10-05)
Every public WhatsApp button links to `sellerWaUrl({ car, slug, seller, text })`
(`src/utils/sellerWhatsApp.js`) -> `/api/wa` (rate-limited per IP in
`middleware.js`) -> `get_seller_whatsapp` -> 302 to wa.me. Call goes through
`/api/call-number`. `get_salesman_by_id` / `get_salesman_by_slug` /
`get_dealer_profile_by_id` return NULL numbers plus `has_whatsapp` / `has_phone`;
gate buttons on those flags. Never add a number back to a public RPC, view or
page payload, and never build `wa.me/<number>` from one on a public page. The
one exception is a dealer's OWN storefront (`get_dealer_profile_by_subdomain`).

## Multi-tenancy
All queries scoped by dealer_id via RLS + frontend .eq('dealer_id', dealerId)
`car_listings` has NO public SELECT policy (this line used to say it was open,
and a chat car card shipped trusting it: sellers saw the card, buyers got null).
The public reads live cars through the `public_car_listings` view. Anything a
buyer must see about a specific car outside the view goes through a SECURITY
DEFINER function that checks the caller's right to it (chat: `chat_thread_cards`).
Never use session.user.id / user.id in queries — always derive via getDealerIdFromProfile(profile):
  - manager or admin role → profile.dealer_id
  - superadmin / dealer / owner role → profile.id
Subdomain detection: xdrive.my and www.xdrive.my → tenant=null (public marketplace)
  Only <sub>.xdrive.my triggers dealer profile lookup (useTenant.js)
**A failed storefront lookup is NOT "this dealer doesn't exist" (2026-10-02).**
vyth.xdrive.my said it did not exist while the dealer row was live: a stale saved
login held the auth lock, every `supabase` request waits on that lock, so the
lookup never left the browser, and a 6s timer settled `null`. Now `useTenant`
looks up via `publicClient` (`src/supabaseClient.js` — anon, no session, no lock),
caps each attempt with `withTimeout`, and a failure returns `error`, which
HomePage/CarListingPage render as "Couldn't load, try again". Only a clean empty
RPC answer is a miss. Use `publicClient` for any public read that must not wait
on a login.
**Never return a promise from an `onAuthStateChange` callback (2026-10-12).**
supabase-js AWAITS the callback while holding the auth lock (we pass
`lock: processLock`), so a callback that awaits a `supabase` query deadlocks the
tab for good on the next background token refresh: every later request never
leaves the browser. `MarketplaceHeader` did `(_, s) => resolve(s)` and a signed-in
seller's showroom search sat on skeletons. Write `(_, s) => { resolve(s); }`,
never `async (_, s) => ...`. The marketplace + showroom grids and
`useMarketplaceStats` read through `publicClient` so a dead login cannot blank them.

## Production releases happen after MIDNIGHT, and only when nobody is live (owner, 2026-10-21)
Sellers run Live presentation on TikTok in the evening; a release or a DB change during a
live can stall it in front of their audience. So:
- **Daytime = staging only.** Build, push staging, the owner tests the preview.
- **The owner's "ship tonight" is the approval.** Schedule a `send_later` check-in for
  00:05 Malaysia time (16:05 UTC). At that time: run
  `select count(*) from seller_live_state where live_until > now();`. If it is 0, merge the
  PR, verify the Vercel production deploy is READY, apply any queued migrations in the same
  slot, and leave the owner a short summary. If someone is live, check again every 30 min;
  give up at 03:00 and say so (never release after that without asking).
- **The owner tests Live on their own seller accounts** (owner, 2026-10-24): a live on
  `premiummotors` or `airymotors` is the owner, not a seller, and does NOT hold a release.
  Read who is live with `select p.slug from seller_live_state s join profiles p on p.id =
  s.seller_id where s.live_until > now();`. Other `airy*` slugs (airyproton, airybyd,
  airyauzy...) look like the owner's too but are unconfirmed: ask before treating them so.
- **Emergency fix (something broken for users):** only on the owner's explicit "ship now",
  and say first if anyone is live.
- What a release does to an open page: nothing until it reloads (`registerType: 'prompt'`,
  `vite.config.js`; LivePresenter loads no further chunks once open). A DB migration is the
  bigger hazard: it freezes the API up to 45s, and the presenter heartbeat
  (`set_live_listing`) and the mini page "Live now" poll both go through it.
- "Who is online right now" was not answerable from the database (`auth.sessions` only
  updates on the hourly token refresh; `analytics_events` skips sellers' devices and anyone
  without analytics consent). **ONLINE-1 (2026-10-21)**: every app tab announces itself on the
  Realtime PRESENCE channel `online-now` (`src/components/OnlineBeacon.jsx`, mounted in
  App.jsx; payload `{a: seller|buyer|visitor|team, live}`, one random key per DEVICE, no user id), and
  console Home counts it (`useOnlineNow`). A guest in chat (anonymous sign-in) is a buyer; a
  signed-out device of ours (`isInternalDevice`) is `team` and is shown apart, never as a visitor. Presence lives in the realtime server's memory: NO
  database writes. The channel is public and spoofable, so it is a dashboard number, never
  the release gate: `seller_live_state` stays the gate.
  **ONLINE-2**: the NAMES of who is live come from `get_live_sellers()` (superadmin-only,
  reads `seller_live_state`; `src/hooks/useLiveSellers.js`), shown under the counts. Never
  put a name or user id on the presence channel: it is public, anyone can read it.

## Disk IO is WRITES here (IO-1, 2026-10-21)
The DB is ~57 MB and every read is served from memory (cache hit 100%), so disk IO comes
from writes: cron run logs, pg_net request/response rows, realtime subscription rows, auth
refresh tokens. Before adding anything that runs on a timer or on every page open:
- **A cron job that calls an edge function sits behind `where exists (...)`** that is a
  superset of what the function selects (migration `20261021d_cron_diet.sql`, pattern from
  appointment-reminders). Idle runs then cost one in-memory check, no function call.
- **Every frequent cron job runs on :00/:15/:30/:45 ONLY (IO-5, 2026-10-22,
  `20261022a_cron_align.sql`).** Supabase's `archive_timeout` = 2min seals and archives a whole
  16 MB WAL segment for ANY 2-minute window with a write, and every cron run writes its own log
  row even when guarded (`cron.log_run` is Supabase's, not ours). Measured: 188 kB real WAL vs
  ~288 MB archived in 44 min. Scattered minutes froze the DB on 2026-10-22. A new job picks one
  of those four minutes, never its own. appointment-reminders is every 15 min; its edge function
  AND its cron guard look back 35 min (`20261028b`; was 20), so ONE skipped run loses no reminder. Change cadence and look-back together or reminders drop.
- **Never re-save something unchanged on every app open.** `healPushSubscription` re-saved
  the device (a delete + insert) on every open; it now saves at most once a day per account
  + endpoint (`xd_push_saved_<uid>`), and Settings re-saves if the row is missing.
- **Live updates go through `liveChannel(client, name)`, never `postgres_changes` directly
  (IO-2, 2026-10-24, `src/lib/liveChannel.js`, `npm run test:livechannel`).** While ANY
  postgres_changes listener is connected Realtime polls the DB nonstop (`realtime.list_changes`,
  ~121k calls / ~30 min DB time a day). DB trigger `rt_notify` (migration `20261024a`) sends
  `{op, id, key, table}` to private topics `rt:<table>:<column>:<value>` (`rt:<table>:all`
  unfiltered); the client re-reads the ROW through RLS, so the message never carries buyer data
  and topic rights (`rt_topic_allowed`, policy `rt_private_receive` on `realtime.messages`) only
  guard ids. Drop-in: same `.on('postgres_changes', {table, filter}, cb)` / `.subscribe()` /
  `client.removeChannel(ch)`. A NEW live screen: use `col=eq.val` filters, and if it watches a
  new table or column, add that column to the table's `rt_notify(...)` trigger arguments in a
  migration, or nothing ever arrives (a refused topic falls back to postgres_changes, a
  silent topic does not). Step 2, dropping the tables from `supabase_realtime`
  (`20261025a`), waits until old tabs are gone.
- **(Legacy) Only subscribe `postgres_changes` to tables IN the `supabase_realtime` publication**
  (`select tablename from pg_publication_tables where pubname='supabase_realtime'`). A
  subscription to any other table never fires but still opens a socket and writes
  `realtime.subscription` rows. `useTenant` had one on `profiles` for every storefront visitor.
- **A hidden screen drops its live updates and catches up on return (IO-6, 2026-10-22,
  `src/lib/realtimeIdle.js`).** After 2 min hidden a client disconnects its realtime socket; on
  return it reconnects (phoenix rejoins every channel itself) and REPLAYS what it missed: each
  `postgres_changes` listener's table, under its own `col=eq.val` filter, rows changed since the
  disconnect, fed to the SAME callback as INSERT/UPDATE (liveChannel bindings too, via
  `liveBindings`). Installed once per client (App.jsx: main +
  public; AdminPage: platformClient), never per screen. A new listener needs nothing extra, but
  its filter must stay `col=eq.val` (anything else is not replayed) and its table needs one of
  `updated_at` / `last_message_at` / `created_at`. Missed DELETEs are not replayed.
- Realtime's change polling (`realtime.list_changes`) is removed by IO-2 (liveChannel, above)
  once `20261024a` is applied and old tabs reload; `20261025a` then drops the publication.

## Deployment pipeline — 3 stages
**API functions run in `syd1` (Sydney), next to the database (Supabase `ap-southeast-2`)**
(`vercel.json` `regions`, 2026-10-21). They ran in Vercel's default `iad1` (Washington):
every database call crossed the Pacific and a buyer's booking took ~15s. Never move them
away from the database region; the edge middleware and `api/shell.js` run near the user.
**The GitHub repo must stay PUBLIC while Vercel is on Hobby (2026-10-24).** With the repo
private, Hobby checks every commit author against the Vercel account and blocked every
production build ("commit author did not have contributing access"), even the owner's own
commit made on github.com (the Vercel login email differs from the commit email). Redeploy
needs Pro. #538-#542 sat blocked until the repo went public again. Going private needs Pro
first. Keys live in Vercel/Supabase settings, never in the repo.
**Vercel builds exactly TWO branches: `main` (prod) and `staging` (the one preview).**
`vercel.json` `git.deploymentEnabled` = `"**": false` + those two (owner, 2026-10-03:
the free plan was being flooded by a build per session branch). Never add a branch
to that list, never push a second preview branch, and push staging ONCE per round of
changes, not after every commit. Session/feature branches (`claude/*`, `ccr-*`,
`temp/*`) build nothing now — that is intended.
```
local (main) → staging branch → production (main on GitHub)
```
- **local main**: all development happens here, commits stay local until staged
- **staging**: `git push origin main:staging --force` → triggers Vercel preview URL
- **Before EVERY force-push to staging, `git fetch origin staging` and run
  `git log --oneline HEAD..origin/staging`.** Any commit listed is someone else's
  unshipped work (another session builds on the same staging) and a force-push deletes it
  from the only place it lives. Put your commits ON TOP of it instead. On 2026-10-21 a push
  wiped two Live presenter fixes from another session; they were recovered from the local
  object store only because the fetch had happened minutes earlier.
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

## Car spec batches — act on a pasted batch automatically
If the user pastes a raw JSON document shaped like `tools/specs/PROMPT.md`'s
envelope (`schema_version`/`generated_at`/`batch`/`specs`/`skipped`), that IS the
instruction — run the intake yourself, do not ask first. Full runbook:
`tools/specs/README.md` → "Automated batch intake (paste JSON → done)".
- **Schema 3.0 = trim catalogue (owner's call, 2026-09-27).** Each trim is a fixed
  category the seller picks (Carlist model), and every spec incl. tyre size fills
  from it — sellers never invent trim names. Only `high` + sourced trims get
  locked; medium/low prefill and stay editable. Roadmap: (1) batch format +
  prompt DONE, (2) `car_variants` table + `car_listings.variant_id`, (3) CarForm
  Brand > Model > Year > Trim picker with a "not listed" request to Review,
  (4) map existing listings, (5) buyer trim filter + per-trim pages.

## DB migrations
- **Before EVERY migration, check it will actually be used; if not, PARK it (owner, 2026-10-28).**
  Focus is getting sellers to list. The owner will onboard dealerships by hand later, so the
  dealer dashboard has no users (on 2026-10-28, in the last 30 days 8 of 9 standalone salesmen listed and
  every dealer / owner / linked account listed nothing). Ask two things: (1) which surface
  reads or writes what it touches (search `src/`, `api/`, `supabase/functions/`); (2) does
  that surface have live users (check the DB, not just the code). Seller panels (Lite,
  Premium), the marketplace, buyers and the console = used. Dealer dashboard, manager /
  admin / accountant / F&I roles = NOT used. Unused -> write the SQL into `supabase/parked/`
  with a row in its README (what, waiting for what), never into `supabase/migrations/`,
  and do not apply it. Exceptions that ship anyway: a security hole, and anything broken
  for users who exist today. A change to a shared table (`car_listings`, `leads`,
  `profiles`) counts as used if any live surface touches it.
- Schema changes (ALTER TABLE, CREATE VIEW) go directly to the live Supabase DB via MCP apply_migration
- **Every migration freezes the live API for everyone, up to 45 seconds** (PostgREST
  reloads its schema; measured 2026-09-26, TODO PERF-LOAD). Owner's rule, 2026-09-26:
  - **DDL only after midnight Malaysia time (00:00-09:00 MYT, 16:00-01:00 UTC), and only
    when nobody is live** (owner, 2026-10-21; it was 22:00, which overlaps evening lives).
    Run `date -u` and the `seller_live_state` check before every `apply_migration`.
    Outside the window, do NOT apply it: write the migration file, commit it, and queue it
    for tonight's release. Only an explicit "apply it now" from the owner overrides this,
    per migration.
  - **One migration per change, not one per statement.** Each call is one freeze;
    five small migrations froze the API five times on 2026-09-26.
  - **A migration that DROPs anything needs the owner to confirm it in the tool, and
    that prompt often never reaches them** (2026-10-09: "cancelled" four times, nothing
    applied). After ONE cancel, stop retrying: check the live state read-only, then
    paste the SQL in chat (wrapped in begin/commit) for the owner to run in the
    Supabase SQL Editor, and verify afterwards with has_*_privilege / column checks.
  - Read-only `execute_sql` (SELECT) does not trigger a reload and is fine any time.
    Anything that creates/alters/drops/grants DOES, even through `execute_sql`.
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
- **CORS lives in ONE file: `supabase/functions/_shared/cors.ts`.** Every
  browser-called function imports it; deploy it alongside (`files: [index.ts,
  ../_shared/cors.ts]` — the MCP deploy bundles the relative import fine). Do not
  hand-roll a per-function allowlist again; there were five and they disagreed.
  Test a deploy from SQL: `net.http_post(..., headers => {Origin, Authorization: anon
  key})`, then read `net._http_response.headers->>'access-control-allow-origin'`.
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
- telegram-enquiry-notify — platform-bot Telegram for new enquiries/bookings (DB triggers
  notify_salesman_new_enquiry / notify_salesman_new_booking). In the repo since 2026-10-11;
  requires `x-webhook-secret` (vault `telegram_webhook_secret` = edge `WEBHOOK_SECRET`; verified
  equal 2026-10-11, deployed v18).
- invites — creates auth user + profile for manager/admin/accountant/fi_officer roles
- create-salesman — creates salesman accounts + `resend_setup` action
- send-document — emails issued dealer_documents to the buyer via Resend
- expiry-reminders — daily cron (00:00 UTC = 8am KL); fires dealer_notifications for road
  tax/insurance expiring in 30 or 7 days, and for overdue post_sale_tasks steps. Also
  notifies salesman_notifications. 24h dedup.
- appointment-reminder — cron every 15 min (`*/15 * * * *`, jobid 7; was 5 min until IO-5). Two independent jobs:
  (1) Telegram "1 hour before" reminder for CONFIRMED bookings, opt-in via `remind_at`
  (set by "Schedule Telegram Reminder" in the Bookings tab), dedup via `remind_sent`.
  (2) Push nag for PENDING (unconfirmed) bookings whose appointment_date is within
  -2h..+5h of now — inserts one `salesman_notifications` row (type=`booking_unconfirmed`,
  ref_id=appointment id) per booking, which auto-fires a PWA push (see Web push below).
  Dedup is by ref_id already existing in salesman_notifications, so each pending booking
  gets exactly one nag, not one per tick.
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
- **ONE DEVICE, ONE IDENTITY: `push_subscriptions` is UNIQUE on `(endpoint, admin_slot)`.**
  The single exception (20261013b): a device may also hold ONE superadmin row
  (`admin_slot = true`), because the owner runs /platform and their own seller
  account in the same browser. Every other account still gets one slot, last
  registrant wins. A seller's sign-out never removes the admin row.
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
  - **EXCEPT the 30-day idle sign-out** (`useIdleLogout` parks reason `idle`
    just BEFORE signOut; `usePushHeal` skips the forget when that notice is
    seconds old). That is the owner's own phone; unregistering it is how a rep
    who went quiet stopped hearing about new leads at all. A deliberate
    sign-out still forgets the device.
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
  **On every SELLER surface it is now `required` (2026-09-26): no dismiss at
  all.** Dealer dashboard (dealer/owner only; `dealer_notifications` push to
  `dealer_id` alone), Salesmanpanel, Lite, Premium and `SellerInbox`. Both
  dealers had zero devices. The iOS-not-installed and browser-denied states
  keep their close button: nothing on the page can fix either. Buyers stay
  dismissible.
- **SELLERS have an email backup too: `notify-seller-unread`** (cron jobid 17,
  every 15 min, migration `20260926b`). Buyers had one (`notify-chat-unread`);
  sellers did not, so a lead whose push had no device to land on was simply
  lost. It emails a lead row (`new_enquiry`, `chat_message`, `new_booking`,
  `booking_unconfirmed`) that is 15 min - 48 h old, unread, not yet emailed
  (`emailed_at` on both notification tables) and UNSEEN: a chat whose thread
  still has `seller_unread > 0`, or anything else when the recipient has NO
  `push_subscriptions` row. `is_read` alone is not "seen" — it is only set
  from the bell menu. One email per person per hour, TITLE only (never the
  body), `profiles.email` only, same unsubscribe token as the buyer email.
  Failures call `notify_ops` (key `err:seller_email`). `?dry=1` sends nothing.
- **`salesman_notifications` has NO `dealer_id` column** (dealer_notifications
  does). `expiry-reminders` filtered + inserted on it for months: every salesman
  handover alert was a 400 and nothing noticed, because pg_cron reports the HTTP
  call as "succeeded". Recurring alerts ROLL UP to one row per person per day —
  one row per item sent a dealer 53 pushes in a morning.
- iOS only allows web push for a PWA installed to the home screen (16.4+). PWA-1 shipped
  the install prompt, so that prerequisite is met — `src/components/InstallPrompt.jsx`.
- The local `Notification.permission` code in Salesman Lite
  (`src/pages/SalesmanLite.jsx:849`) is NOT push. It only fires while the tab is open.
  Do not confuse the two.

## Platform console (/platform) nav — ONE taxonomy: what am I doing
`AdminPage.jsx` `NAV` array. Five sections in the left rail, each with its own tab
strip; `activeSection` picks the section, `activeTab` the tab (ids are unique
across all sections, one state each).
  work → home, review · people → accounts, waitlist, prospects
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
- **Reach (REACH-1, 2026-10-21): Accounts shows, per seller, notifications on/off and
  "app on the home screen"**, from `get_account_reach(p_ids)` (SECURITY DEFINER; counts and
  dates only, never an endpoint). Home screen = `app_home_screen`, one row per account, stamped
  by `useHomeScreenMark` (App.jsx) via `mark_home_screen_app` when the signed-in app runs
  standalone; the old `pwa_installed` event is anonymous and per device, so it cannot answer
  this. Installs made before 2026-10-21 show only once the seller next opens from the home
  screen. "Ask them on WhatsApp" opens `wa.me` with steps + `?install=1` link; a human sends.
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
- **Account lifecycle is guarded by `trg_zy_guard_profile_lifecycle`** (on `profiles`,
  migration `20261005f`): for any non-platform UPDATE, `onboarding_complete` is one-way,
  `suspended_at`/`suspension_reason` cannot change, a suspended or deleted account cannot
  switch itself on, and finishing onboarding switches a seller ON (owner, 2026-10-05:
  approval is an ID check, not an access gate). It exists because the onboarding branch
  of `prevent_profile_privilege_escalation` skipped those guards -- a suspended seller
  could revive themselves. Suspended sellers appeal; they never self-restore.
- **Prospects (the owner's own sales CRM)** is `ProspectsTab.jsx` on
  `platform_prospects` (superadmin-only RLS). Linking to an account, waitlist
  import, contact stamping and the do-not-contact refusal are DB triggers
  (migration `20260926c`) — never re-do them client-side. Messaging is a human
  `wa.me` send, never a blast or the Cloud API (Meta needs prior opt-in; PDPA
  s.43 makes a "stop" final).
- **Account state is answered ONCE: `src/utils/accountState.js`** (`accessState`,
  `reviewState`, `billingState`, `headlineState`, `isPlatformAccount`). Never read
  `approval_status` / `is_active` / `subscription_status` raw in a console tab and
  paint it — each has moved meaning (pending is NOT locked out; subscription_status
  means nothing for a salesman; is_active=false without suspended_at is not a
  suspension; "active" is not "paid"). Nothing is dimmed or coloured without a word.
  "Paying" = `billingState(a).paying` everywhere (Home, Billing).
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
- **The admin account NEVER signs in on the main client (2026-10-12).** /platform has
  its own login and never adopts the main session (it used to copy the tokens over,
  so both clients shared one session and the admin sat in the slot the seller
  sign-in uses: /login jumped to the admin's 2FA and no salesman could sign in).
  Every main sign-in path refuses `superadmin` (`src/utils/platformOnly.js`,
  `src/lib/platformEvict.js`, local-scope sign-out) and `usePlatformSessionGuard`
  (App.jsx) evicts one that slips through. A seller and the admin can be signed in
  in one browser at once. Never add a path that hands a session between the two clients.

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
- **Chat and saving a car need a real account on the marketplace (owner, 2026-10-14,
  the Mudah model).** 13 guests had opened chats, sellers answered 9, and with no
  email or push on file those replies reached nobody. `isRealBuyer` /
  `requestBuyerSignIn` (`src/lib/buyerAuth.js`) are the one check. **Signing in never
  leaves the page (owner, 2026-10-14):** `requestBuyerSignIn` opens
  `src/components/auth/SignInSheet.jsx` (mounted once by `SignInSheetHost` in App.jsx)
  over the car; Google's button signs in with an ID token in a popup, like One Tap
  (`src/lib/googleIdentity.js`, shared with GoogleOneTap), and the chat / save carries
  on. Only the fallbacks (email, in-app browsers, a rejected token) redirect, and they
  come back to the car with `?contact=chat`. After ANY redirect sign-in a stashed
  return beats the account's home for sellers too (`preferReturn`,
  `src/utils/postAuthRoute.js`): a seller testing chat landed on their dashboard.
  **The in-page button and One Tap run ONLY on origins in `ID_TOKEN_ORIGINS`
  (`src/lib/googleIdentity.js`, default `https://xdrive.my`), which must equal the
  Google Cloud "Authorized JavaScript origins" list.** Any other origin (www, the
  staging preview, a subdomain) gets Google's dead-end "Error 400: origin_mismatch"
  page, so it uses the redirect sign-in instead (2026-10-16, a real buyer was blocked).
  `toggleSave` parks the id in the device list so a redirect still saves it. WhatsApp and Call stay
  open. A guest's EXISTING thread keeps working. Dealer subdomains keep guest chat
  and device-only saves: sign-in lives on xdrive.my and that session cannot reach
  `<sub>.xdrive.my` (separate storage per origin) - do not gate there without
  solving that first.
- Guest buyers (subdomains + legacy threads) use Supabase anonymous sign-in (needs the project toggle, ACT-13).
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

### "Find me" posts (FINDME-1) — a chat can hang off a POST, not a car
Buyers post the car they want; approved sellers answer "I have it". Migration
`20260925b_find_me_posts.sql`. What changed under chat because of it:
- `chat_threads.listing_id` is now NULLABLE: a thread has a car OR a
  `find_me_post_id` (CHECK `chat_threads_subject`). Any code that reads
  `thread.listing` must handle null. Inboxes name a post thread by its post:
  sellers via `chat_post_subjects(thread_ids)` (they cannot read
  `find_me_posts`, so an embed is null), buyers via `get_my_chat_threads`.
- Post chats are created ONLY by `find_me_reply(post, first_message)`, which
  checks the seller is approved + active, one chat per seller per post, 5
  sellers per post, 10 new post chats per seller per day. Never insert a
  post thread from the client.
- The seller sees "Buyer in <state>" (`buyer_revealed=false`) until the buyer
  replies; `chat_after_message` then swaps in the real name BEFORE creating
  the lead (`lead_source='find_me'`). PDPA s.8: the buyer's identity reaches a
  seller only by the buyer's own reply. Do not show buyer name/contact earlier.
- The board is read through `list_find_me_posts` / `get_find_me_post` (no
  `buyer_id` ever leaves the DB). Posting is `create_find_me_post` (signed-in
  non-anonymous `role='buyer'` only); "Found it" is `close_find_me_post`.
- `chat_messages.listing_id` = a car sent as a card. Which car a seller may
  send is ONE function, `chat_can_send_car(thread, listing)`: the insert
  policy and the picker RPC `chat_sendable_cars` both call it, so do not
  re-filter cars client-side. It enforces the exclusivity lock and the
  thread's dealer. The card's `body` is the car's name, so previews, push,
  email and lead notes need no card-specific code. A sent car fills a BLANK
  `leads.car_listing_id` (`chat_after_message`) — that is what lets a Find me
  win mark the car sold; it never overwrites a car the lead already has.
- Supabase grants new functions to `anon` DIRECTLY, so `revoke ... from
  public` is not enough for a write function: also revoke from anon.
- UI: `src/pages/FindMePage.jsx` (`/find-me`, `/find-me/:id`). Error text for
  every `find_me_*` exception lives in `src/utils/findMe.js findMeError` — a
  new exception code needs a line there or the user reads "Something went
  wrong". A page that sends a buyer to sign in calls `setPostAuthReturn()`
  (`src/lib/buyerAuth.js`); all three sign-in paths honour it.

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

## Seller referrals + payment log (REFER-1, 2026-10-04) — one path, in the DB
Migration `20261004a_seller_referrals.sql`. Owner's terms: 30 days of Premium per
invited seller who has made TWO paid Premium payments; one level; no joining fee;
max 12 a year; never cash (Act 500 anti-pyramid: reward only from real sales).
- **Payments are rows in `subscription_payments`, written ONLY by
  `record_subscription_payment(p_user)` (superadmin).** The console's "Log RM35
  payment" button calls it. For a standalone salesman it moves `plan_expires_at`
  forward and sets `payment_status` NULL — 'received' never expired, so a paid
  seller used to stay Premium forever. Never flip `payment_status='received'` for
  a salesman again.
- Invite link = `xdrive.my/plans?invite=<slug>` (`src/utils/invite.js`), NOT
  `?ref=` (that is buyer attribution). Captured in `main.jsx` before routing
  (`/signup` redirects drop the query). `profiles.referred_by` is writable only via
  `claim_referral(code)` (`trg_guard_profile_referral`); the panels call it on load.
- The reward is `grant_referral_reward`, fired inside the payment RPC; one
  `referral_rewards` row per invited seller (granted | capped | ineligible).
  The UI card is `src/components/referral/ReferralCard.jsx` (Lite + Premium settings).
- Hardening (`20261005a`, applies AFTER a + b): `claim_referral` is capped at 10 tries
  per seller per 24h (`referral_claim_attempts`, every try logged; errors are RETURNED,
  not raised, or the log row rolls back and the cap counts nothing). The card's
  "Did another seller invite you?" box calls it, because the stored invite only lives
  on the phone that tapped the link. A seller's `slug` is LOCKED once onboarding is
  done (`trg_guard_profile_slug`): it IS the invite code. A mistaken/refunded payment
  is undone with `void_subscription_payment` (console "Void"), which takes the months
  back and, below 2 paid, the inviter's 30 days too. A referrer suspended when the
  reward fell due gets it on a PLATFORM restore (`trg_referral_on_restore`); a self-
  restore cannot move `plan_expires_at` (escalation guard), so it waits.

## Lite -> Premium upgrade + the free trial (2026-10-04, migration 20261004b)
- **The trial is 7 DAYS, not a month (owner, 2026-10-25, migration 20261025c).** One
  number in two places: the trigger `apply_premium_free_month()` and
  `PLAN_CONFIG.salesman_full.trialDays`. Trials started before that keep their 30 days
  (the date is stamped at start). Console "Set up a seller" picks 7 days or 1 month
  (`trial_days` in create-salesman, only 7 or 30 accepted) for prospects promised a
  month. After it ends: drop to Lite as below, never a full lock (owner's pick).
  `accountState.js` reads a 7- or 30-day gap as a trial; any other length = paid.
- **The free trial is a paid-through date, not a trial flag:** `plan_expires_at =
  now() + 7 days`, set server side (`trg_zz_premium_free_month` on a Premium signup,
  `start_premium_trial()` from Lite). `subscription_status='trial'` never granted
  Premium (is_salesman_premium ignores it), which is why Premium signups used to land
  on Lite. `premium_trial_started_at` = the one free month is used.
- The upgrade door is Lite Settings > Premium (`src/components/premium/PremiumUpgradeCard.jsx`).
  `/plans` -> Premium for an already-onboarded seller goes there
  (`SalesmanOnboarding.jsx`), not back into signup.
- **A half-finished signup resumes the plan saved on the account** (`user_metadata.tier`,
  stamped by `signUp()`). Guards send it to the bare `/salesman-onboarding` and the wizard
  reads the tier from there (2026-10-07). Never hard-code `/salesman-onboarding/lite` in a
  redirect: `SalesmanLite.jsx` did, and every Premium signup that closed the PWA after the
  email link came back as Lite.
- `enforce_listing_cap` gives an unpaid `salesman_full` row the LITE cap: `plan` is
  self-writable between lite/full, so the cap must follow entitlement, not `plan`.

## Premium lapse -> Lite (2026-10-19, migration 20261019a)
Premium ends by itself when `plan_expires_at` passes (no flag to flip). Around that:
- **Cars over the Lite cap are LOCKED, not left live** (owner). `sweep_premium_lapses()`
  (cron hourly :41) keeps reserved cars, then the newest, up to the Lite cap; the rest go
  `status='unpublished'` + `plan_locked_at` (+ `plan_locked_status` to restore). Lite shows
  them under Available, blacked out (`get_my_locked_listings`). `trg_zz_unlock_plan_cars`
  (on profiles) puts them back the moment Premium returns, whatever restored it.
  `enforce_listing_cap_on_publish` now uses the entitlement cap, or a locked car could be
  republished on the 30-car Premium cap.
- **Two pushes per lapse, never more:** `premium_ending` 3 days before, `premium_ended` on
  the day. Banners: `src/components/premium/PremiumStatusBanner.jsx` (one line, closes until
  tomorrow; owner: "make it not annoying"). Pay screen is ONE component, `PremiumPayBox.jsx`.
- No standalone seller has `payment_status='received'` any more: it never expires. Only
  `record_subscription_payment` grants Premium time.
- **`salesman_has_full_page` must never let a NULL through** (2026-10-22, `20261022b`). Its
  `coalesce(..., true)` is for "no salesman row"; `payment_status = 'received'` on a NULL
  status made a lapsed seller NULL, so it read TRUE and kept the full page, unlimited posters
  and Telegram reminders. Wrap every nullable test inside it in `coalesce(..., false)`.

## Lite vs Premium split (owner, 2026-10-13) -- "get found" vs "work the lead"
Lite (free) = get found and get the lead: up to 10 live cars (`plan_config`; cut to 5, then back to 10 on 2026-10-14), a
BASIC page, marketplace listing, every buyer channel (WhatsApp, chat, bookings), lead
alerts, a lead list with stages, per-car views + WhatsApp taps. Never gate a buyer's way
to reach a Lite seller. Premium = working the lead: reminders + call log, "WhatsApp all"
quiet leads, Performance, commission + monthly goal, Telegram booking reminders, add-ons
catalogue, and the full page (banner, bio, social links, job title, specialisations).
- **Live presentation is on Lite too (owner, 2026-10-18): "Live gets them in, the lead tools
  make them pay."** The mini page shows the button to every owner (`SalesmanProfilePage.jsx`,
  no plan check); the DB side (`set_live_listing`) never had one. `/for-salesmen` sells it as
  free: its main buttons sign up to Lite (`liveCta`), Premium is the secondary button and
  the plan card. The feature line lives on the Lite card in `src/utils/plans.js`, not in
  `SALESMAN_PREMIUM_FEATURE_LINES`. Do not re-gate Live without rewriting that copy.
- New-car cards work the same on Lite: one `CarForm` (Used / Recon / New), no plan check in
  any `new_car_*` function, and cards skip the listing cap (`enforce_listing_cap`).
- In `SalesmanLite.jsx` a Premium tool is replaced by `PremiumRow` / `renderPremiumPanel`,
  both opening `goPremium` (the one upgrade screen). Do not add a second upgrade surface.
- The basic page is enforced in the DB: `get_salesman_by_slug` / `get_salesman_by_id`
  return those fields NULL unless `salesman_has_full_page(id)` (definer-only helper;
  dealer-linked salesmen always count as full), plus `page_basic`. Nothing is deleted:
  upgrading brings it all back. Telegram reminders: `trg_zz_lite_no_booking_reminder`
  nulls `remind_at` for Lite sellers. Migrations `20261014a_lite_cap_five.sql` + `20261014b_lite_cap_ten.sql`.
- The Lite loan calculator was REMOVED (flat-rate maths, see HP-EIR). Do not bring a
  calculator back into Lite without `src/utils/financing.js`.

## New-car advisors (NEWCAR-1, 2026-10-07) -- a price LIST, never listings
Brand sales advisors (Proton/Perodua/Toyota/BYD/Honda) sell cars whose price the BRAND sets, per
variant, per zone. So there is ONE platform table, `new_car_models` (superadmin-write,
console > Marketplace > New car prices). Only CARDS ever show on an advisor's page, never
an automatic price list (built twice, rejected twice as clutter). **Since NEWCAR-2 (owner,
2026-10-22, migration 20261022e, reverses "the page starts EMPTY") the advisor TICKS the
models they sell** (`StarterModelPicker`, at signup and in Settings > New cars) and
`new_car_add_cards()` makes a card each, carrying the platform's photos from
`new_car_model_media` (uploaded per model in the console price tab). Such a card has
`stock_photos = true`. **No model card (`is_model_card`) is ever in a used/recon surface,
stock photos or the seller's own** (owner, 2026-10-23): marketplace grid + body-type rows,
`/showroom`, similar cars, `/used-cars` hubs, `api/shell.js`, `api/og.js`, the sitemap and
`get_marketplace_stats`. Filtering on `stock_photos` let every card with the seller's own
photo through, and the main grid filtered nothing, so ten Proton advisors were ten identical
Sagas. New cars are reached ONLY through the hero's New pill (`/new-cars/:brand/:model`) and
the advisor's mini page; `CONDITION_OPTIONS` has no 'new'. The flag drops when the seller
changes the card's photos; a client can never set it (`trg_new_car_stock_photos`). A console photo
change re-syncs every card still on stock photos. Only models with photos are offered.
Photos must be ones the owner took or has the brand's written permission to use
(Copyright Act 1987 s.36). Settings > New cars is otherwise a brand picker + READ-ONLY
price list. `seller_hidden_models` is no longer written. Rebates are NOT stored on the server: promos expire (the ones in the owner's 2026-10-08
file had); the presenter's rebate box is where a current one goes (kept on the device to month end). Never copy a new car into `car_listings`: it blows the listing cap,
floods the marketplace with identical cards, goes stale when the brand changes a price,
and the won-trigger marks it sold on the first deal.
- Zones: Peninsular, Sabah/Sarawak, Labuan, Langkawi. The zone comes from the seller's
  state/city in ONE SQL function, `new_car_price_zone()`, and the price from
  `new_car_zone_price()`. A zone with no price shows "ask", NEVER the Peninsular number.
- Reads: `get_my_new_car_catalogue(brand)` (settings + NewCarForm, subject = auth.uid()),
  `get_new_model_advisors(brand, model)` (public page: advisors with a LIVE CARD of the
  model), `get_new_car_listing_info(listing)` (car page panel
  `src/components/newcar/NewCarListingInfo.jsx`: specs, price basis, the advisor's other
  cards). The panel says "sales advisor" (their own claim); only `is_verified` may read
  "Verified by XDrive". Nothing checks brand employment, so never "authorised"/"official agent".
  No phone numbers: buttons go through `sellerWaUrl` (CDP-3).
- `/new-cars/:brand/:model` is "the salesman is the product": price once, then the
  advisors. The mini page does NOT link to it (it lists that advisor's competitors).
- **Each advisor on `/new-cars/:brand/:model` links to THEIR CARD for the model (NEWCAR-STATS,
  2026-10-25)**: `get_new_model_advisors` returns `card_id` / `card_slug` (migration `20261025b`).
  After cards left the browse surfaces (2026-10-23) the page linked only to `/s/<slug>`, so cards
  got ZERO views and their sellers' dashboards read 0. Taps there carry `car_id` (card_click,
  whatsapp_click) and the page logs a `page_view` (`source: new_model_page`).
  **A model card's canonical is its model page** (CarDetailPage Helmet + `api/og.js` car branch;
  `og:url` and the Car schema keep the card's own URL so shares still preview the card). Ten
  advisors = ten near-identical "Proton X50 for sale" pages otherwise. Cards stay out of the sitemap.
- Wording/helpers: `src/utils/newCars.js`, shared with `api/og.js` and the sitemap.
- Hide a catalogue row, never delete it: delete cascades through the advisors' hide lists.
- Live presenter: cards are ordinary listings; `officialNew` (seller_type new_car) adds
  the "official price" note to condition-new cars.
- A card's slug is set in `new_car_card_fill`: `car_slug_trigger` runs first (alphabetical)
  while brand/model are still empty, so cards had a NULL slug and linked to /showroom/null.
- `profiles.seller_type` allows `new_car`; `new_car_brand` is the brand. **"Sells new" = `new_car_brand`
  is set, NOT `seller_type='new_car'`** (owner, 2026-10-17, migration 20261017a): a broker who also
  sells new Proton is `seller_type='broker'` + `new_car_brand='Proton'`. Signup offers one or two
  picks (`sellsToDb`, SalesmanOnboarding.jsx). Never key a new-car check on seller_type again.
- **Add car for every salesman starts at `CarKindChooser`** (Used / Recon / New -> brand), rendered
  by CarForm and CarFormFast. A price-list card always edits in NewCarForm.
- **An advisor's CARD is a real listing** (`car_listings.new_car_model_id`, migration
  20261008b), made in `src/components/newcar/NewCarForm.jsx`.
  **One card per MODEL, not per variant** (owner, 2026-10-17, migration 20261017c; unique index
  `car_listings_one_card_per_model`). Trigger `new_car_card_fill` anchors the card on the model's
  CHEAPEST variant priced for the advisor's zone ("from" price, `variant` NULL), re-anchored on
  every console edit; the car page's variant switch (`VariantChips`, rendered UNDER THE PRICE in
  both CarDetailPage price blocks; one picker, never a second one down in the panel) drives price,
  specs and the enquiry text through `useNewCarVariant`. Cards skip the listing cap, never reserve, and can
  never be marked sold (the trigger keeps the old status). **A win on a card INSERTS a sold unit**
  (`new_car_unit=true`, `new_car_unit_on_won`, BEFORE UPDATE on leads) with the variant the
  seller picked in the won confirm (`WonVariantPick` -> `leads.new_car_model_id`, validated to the
  card's model, else the anchor), and moves the lead onto it, so "won = a sold car_listings row"
  still holds and the card stays up. Undo sale on a unit deletes it and puts the lead back on
  the card. Never let the client set `new_car_unit`.

## Seller first-run: one checklist, and a handover resets it (INTRO-1, 2026-10-18)
- **One setup list:** `src/components/onboarding/StarterTasks.jsx`. Premium = 6 rows
  (`PREMIUM_TASK_KEYS`: account [always ticked, the head start], car, see your page,
  photo, bio, get verified), at the TOP of the Premium dashboard. While it shows,
  `SellerIdCard` drops its "Get verified" invite (`inviteInChecklist`); rejected and
  review banners still show. Ticked rows are hidden; the "n/6" count and the bar
  in the header carry progress. Lite keeps its 2. The owner's
  "Only you" strip on the mini page reads `starterTodoKeys` from the same file; never
  give it its own list again (it had one, and it disagreed with the dashboard's).
- **A console-made account starts like a fresh signup.** The owner signs in as the
  seller to add cars, so every intro plays for the owner and is marked done on the
  account. Saving the password on `/salesman-setup` resets `onboarding_tour_done` and
  `starter_tasks`. Any NEW first-run flag must be reset there too.
- The Premium tour's "seen" backup is `sessionStorage` (`sp_tour_seen_<uid>`), never
  `localStorage`: a persistent copy made every DB reset invisible on that device.
- **A console-made account answers what signup answers** (2026-10-19). `CreateSellerModal` asks
  "how do they sell" + brand through the SAME helpers as signup (`src/utils/sellsHow.js`), plus
  shop address, and job title + bio on Premium (the only plan whose page shows them).
  `create-salesman` uses signup's business-name fallback (blank = full name) and tags the login
  `account_type`/`tier` like `signUp()`. The setup email lists every saved field, read back
  from the profile row. A new signup question goes in both, or console accounts drift again.
- Console "Set up a seller" offers Lite or Premium. Premium = the free trial (7 days or 1 month), written
  by `create-salesman` (service role skips `apply_premium_free_month`), never the
  `payment_status='pending'` pay-first lock.

## Premium page budget finder (BUDGET-1, 2026-10-23) — the Premium page's edge
"What fits your budget?" on `/s/:slug`, Premium only (`!profile.page_basic`), a DROP-DOWN closed
on landing (owner: never fill the page with it). `src/components/agent/BudgetFinder.jsx` +
`src/utils/pageBudget.js` (`npm run test:pagebudget`). It runs the Live presenter's engine
(`budgetMatches`, which takes `depositFor` for a per-car % deposit), so page and live quote the
same monthly. Rates are DEFAULTS (new Proton/Perodua 4.8%, else `DEFAULT_EIR`): the seller's own
rates live on their device and a buyer's browser cannot read them. Every priced car counts, at any
price (owner, 2026-10-25: no cap, same as the card). A tap opens WhatsApp via `/api/wa` with the buyer's
budget in the text (tracked as `whatsapp_click`, `metadata.source = 'budget_finder'`). Never word
a fit as approval; the fine print always says the bank decides.

## Agent page Share + link preview (SHARE-1, 2026-10-25)
The Share button on `/s/:slug` (`sharePage`, SalesmanProfilePage.jsx) opens the phone's share
sheet (copies the link on desktop). The preview WhatsApp/Facebook show is `api/agent-card.js`,
ONE size for every agent (1200x630 JPEG): cover as a banner on top, then a white card like the
page's: photo, role, name, town, and chips for cars for sale (measured), "Verified" (only
`is_verified`) and specialisations. Photos via `sharp`, words via `satori` from the fonts in
`api/_fonts` (no server fonts needed; `vercel.json` includeFiles ships them). NEVER the phone
number (CDP-3: the image is a public URL) or the bio (WhatsApp already prints it under the
picture). og.js and the SPA take the URL from `agentShareImage()` (src/utils/agentSeo.js), whose
`v=` changes with anything drawn, so an edit is a new URL. The endpoint takes a SLUG only, never an image URL.
The Share button's link is `/s/<slug>?src=share&v=<agentCardVersion>`: `v` makes an edited card a
new link to WhatsApp (it caches previews per exact URL, for days), `src=share` files the visit
under "Shared link". Premium dashboard "visits from shared links" = `shareVisits()`
(`src/utils/detectChannel.js`): channels share, copy, whatsapp, telegram only (Facebook / IG /
TikTok visits are mostly bio links, not shares). The seller's own taps are never counted
(`internalTraffic.js`); buyers' taps log a `share` event (`metadata.source='minipage'`).

## Agent page trust signals (/s/:slug) — measured, never typed (2026-10-03)
`src/hooks/useAgentTrust.js` + `src/utils/agentTrust.js` (wording, thresholds,
`npm run test:agenttrust`). Every signal is a fact we hold, not a claim the agent makes.
- **Reply time is MEASURED** (`get_agent_reply_time`, median over chat, unanswered
  bursts count as 24h, hidden under 5 samples). The free-text `profiles.response_time`
  was removed from every settings form and is no longer read. Do not add it back.
- **"Documents checked by XDrive"** reads `car_listings.docs_verified`, which only a
  superadmin can set (`set_listing_docs_verified`; `trg_protect_listing_docs_verified`
  blocks sellers). Never label a seller-set flag as an XDrive check.
- **Recently sold** (`get_agent_recent_sales`) returns car + MONTH only. No price, no buyer.
- **Terms** show only what the agent set; wording is `DEPOSIT_POLICY_COPY`, shared
  with CarDetailPage. **Report this agent** = `report_seller` (same table, same cap
  as `report_listing`; `listing_snapshot.kind='seller'`).
- `ic_verified_at` only means an IC NUMBER was typed. Only `is_verified` (granted by
  a person, `verified_by`) may be called "verified" on a public page.

## Live presentation (LIVE-1) — the mini page as a live-stream tool
`src/components/live/LivePresenter.jsx`, opened by the owner-only "Live presentation"
button on `SalesmanProfilePage.jsx` (every seller plan, Lite included, since 2026-10-18). One car per screen, "#N", price, and a monthly
table (deposit rows x 5/7/9 years) from `financing.js` — the calculation poster,
generated. The default cell equals `calcMonthly`, so it matches the card.
- **Contact (name + phone) is OFF by default, shown only on the seller's tap, per live**
  (owner, 2026-10-04: top-bar contact button). The box itself is NOT tappable (owner,
  2026-10-22: tapping it hid it mid-live); the top-bar button is the one switch. TikTok can strike a
  live for a phone number (checked 2026-10-03), so never default it on or persist it.
  NEVER a URL, QR code or messaging-app logo. The quotation poster (it prints the
  mini-page link) must not be the live tool.
- **The way from a live to the page is the seller's TikTok BIO LINK (BIOLINK-1, 2026-10-23).**
  TikTok's LIVE rules bar QR codes and third-party links on screen (checked 2026-10-23), so the
  presenter never shows a URL or our brand: the comment pill carries a second line "All my cars:
  link in bio" (`.lp-bio`, on unless switched off in Adjust > Look, `xd_live_bio`). The setup list
  has a `biolink` step that ticks only when a TikTok/Instagram visit is MEASURED
  (`hasBioLinkVisit`, StarterTasks.jsx), and the live report counts those visits (`fromBio`,
  liveMaths.js) and offers the link to copy when there were none. The copied link has no `?src=`:
  the in-app browsers tag themselves, and `?src=tiktok` would mislabel Instagram.
- **Cars screen = one big number, at the top (LIVE-UI, owner 2026-10-22).** TikTok's comments
  cover the bottom-left of the stream, so the top holds what a viewer must read: #N + title
  with the "Comment #N" line beside it (a bar under it on a phone), then the picked monthly
  (`.lp-big`, the ONLY big number) over three tenure tiles. Then the deposit chips, then the
  read-only working (price - rebate - deposit = loan, a rule above the loan) and the rest
  (totals, salary guide, notes, offer, contact). Must fit the stage with no scroll at 375x667
  and on desktop. Designed on the canvas https://claude.ai/artifact/LCNR7RxPnyHxMHnkAeqEvC.
- **Controls and answers are kept apart (owner, 2026-10-22).** A VIEWER's question is a tap
  on stage: deposit chips, tenure tiles, variant, NCD. What the SELLER sets lives in Adjust,
  a POP-UP over the stage (`.lp-modal`: blurred backdrop, red close top right; owner,
  2026-10-22: the in-page panel was "leceh"). Three tabs: **Financing** (the rates, then
  "Monthly budget" right under them, insurance, this car's insurance), **Rebates** (every car),
  **Look** (colour, comment line, offer). "Monthly budget" (BM "Bajet bulanan") fills the
  deposit; it was "Target monthly", which confused sellers. Hints are one short line each.
  The working is read-only. Never make a result row editable again: tapping a row to type
  (2026-10-17, `EditCell`) left nobody able to tell a setting from a result. The one
  exception is Rebate (owner, 2026-10-22, after a seller said opening Adjust for one car was
  slower): tapping its line turns the number into a box typed in place (`rebateEdit`, Enter
  or tapping away sets it). Adjust > Rebates stays for setting every car before a live.
  Do not extend this to deposit, rate or loan.
- **Ending the live ALWAYS asks** (`confirmEnd`, "Keep presenting" focused; owner,
  2026-10-22). A seller aiming for Adjust's close ended the stream: the in-page panel's X sat a
  row below the live's X. Now Adjust is a pop-up whose backdrop COVERS the top bar, so while it
  is open the live's X cannot be hit; its red close and a backdrop tap close only Settings.
  Esc and Back close the top layer first (photo, Settings), then ask (`requestExit`). Never put
  an end-the-live control where a Settings close could be. A control that opens Adjust carries
  `data-adjust-open`, or its own click closes it again.
- **Deposit chips: `[RM x ✎] None 10% 20% 30%`** (`DepositChip`). The first chip is typed
  into IN PLACE (same slot, same size, the sheet follows each keystroke, Enter or tapping
  away sets it); empty or 0 = the None chip. Budget uses the same chip: `[RM x ✎] None
  RM 10k RM 20k`. No +/- steppers: 30 taps to reach RM30k on camera.
- The bridge is the bio link: `set_live_listing` (presenter, debounced + 4-min
  heartbeat, 10-min window) -> `seller_live_state` -> `get_salesman_live(slug)` polled
  by the mini page -> "Live now" card. Never let a client write that table directly.
- "#N" is the position in the mini page's `listings` array; presenter and page share
  the array, so do not re-sort one without the other.
- **Tenure pick**: tapping a tenure row shows that instalment big, with a
  take-home-pay guide that ALWAYS prints its rule ("instalment at 35% of take-home
  pay. The bank decides." — `SALARY_SHARE`, `src/utils/liveMaths.js`). Never show the
  salary number without the rule, never word it as approval.
- **Flat (brochure) rates are accepted and converted** per tenure with `flatToEir`
  (`eirForTenure`). Never feed a flat number straight into `monthlyPayment`.
- **No price cap on any estimate (owner, 2026-10-25; reverses 2026-10-03).** `calcMonthly`,
  the cards, the car page and the page budget finder give every priced car a monthly.
  `HIGH_VALUE_THRESHOLD` (RM300k) now only switches on the "banks decide case by case"
  notes (presenter, loan poster, post copy). Do not bring back a null above it.
- **Phone: one portrait stage (9:16 max). Desktop: phone height, TWICE its width**
  (owner, 2026-10-18). Sellers film their monitor with a phone held upright. The
  stage is laid out at `DESK_W` x `STAGE_H` (750x667, about square) and magnified
  with CSS zoom to the screen height (`deskZoom`, `.lp-desk`). ONE grid, `.lp-grid`,
  two arrangements by `grid-template-areas`: phone = answer, chips, photo | working, rest.
  **Desktop is CAMERA-SAFE (LIVE-CAM, owner 2026-10-24):** sellers either film the monitor
  with an upright phone (the sides get cut) or put the screen under their camera in a split
  (TikTok's comments cover the bottom half), so everything a viewer reads sits in the
  TOP-CENTRE 64%: title, comment line, contact, monthly, tenure tiles, deposit chips. Photo |
  working go below, then totals beside the salary guide, then notes. Never move a viewer's
  number to the edges or the bottom half again. Desktop also has a Full screen button
  (`toggleFull`, hides the browser's tabs and address bar). The full-screen wide
  sheet (2026-10-04) spilled out of the camera frame; the phone-width column (morning
  of 2026-10-18) was too small to read on camera. Do not go wider than DESK_W.
  Sizes are container units and `.lp-fit` auto-shrinks the Cars screen to fit
  (80% floor on a phone, 65% on desktop, then it scrolls; owner 2026-10-24: never scroll).
  The working's FIGURES are large and its labels quiet (owner, 2026-10-24: the seller reads
  them aloud mid-live, "rebat berapa?"); NCD sits under the working on desktop (`ncd` grid area; under the photo it squeezed the photo). Check the desktop sheet renders at zoom ~1.
- **Show working** under the big number (price - deposit = loan, months, rate) and
  **Budget tab** (`budgetMatches` / `maxMonthlyFromPay` in liveMaths.js): a viewer's
  monthly budget or take-home pay (35% rule backwards, rule always printed) lists
  the cars that fit by #N; "Just above" only within 25%. Tapping one opens it with
  that deposit + tenure, so the numbers match. Never word a fit as approval.
  **One screen, no scrolling (BUDGET-2, owner 2026-10-24; replaces the "All cars" grid, its
  switch and `xd_live_budview`, the counts strip and the per-car "Komitmen x% gaji" line).**
  Every car once (`budgetAll`) in two columns on the desktop stage: left = fits (dearest
  first), right = tight / just above, then over budget ("Heavy"), as full rows with their
  commitments % (owner, 2026-10-24: the #N chips said nothing). The right column pages tight +
  over as ONE list (`groups.side`). One column
  on a phone. A column longer than a page (desktop 4 fit / 3 right, phone 3 / 2) pages with
  a "1/3 >" button, ONE tap, never a scroll. Rows: the photo fills the row's height (owner:
  no empty space), the name gets the full width, the price (or what makes it fit) shares the
  last line with the monthly. A model card's row keeps its variant chips (`options`, lent by
  `budgetMatches`). `budgetMatches` and `budgetAll` share ONE pricing loop (`priceBudgetRows`):
  never give a view its own maths. The auto-fit (`fit.current`) now runs on Budget too, and
  grows back after shrinking (a narrower zoom unwraps names).
  **The seller's settings are a POP-UP, on every screen size** (owner, 2026-10-24: the panel
  that stayed open on desktop pushed the cars down). One summary line ("No deposit · 7 years
  at 4.8% / 6.5% EIR") with a Change button opens it (`budgetSetOpen`, `.lp-bsetpop`): deposit,
  years, and the interest rates, the SAME saved setting as Adjust > Financing (`rateRow`, one
  store, `xd_live_rate` / `xd_live_rate_local`), never a second copy. On desktop the
  Monthly | Take-home switch sits in the title's place, beside the comment line.
  **DSR in Budget (owner, 2026-10-24)**: take-home pay mode has a "Komitmen" box.
  Commitments come off the SAME 35% (`maxMonthlyFromPay(pay, commitments)`), so there is still
  ONE comfort rule: with no commitments it equals the Cars screen's salary guide. Bands: Selesa
  <= 35% DSR, Ketat <= 60% (`DSR_TIGHT`; also the "just above" line, via `nearCap`),
  Membebankan above; they name the columns. Bank Negara sets no DSR cap; most banks sit around
  60-70% (checked 2026-10-24) and the note says each bank decides. A tight row says what would
  make it fit: a longer tenure first (`fitYears`), else the deposit. "Bajet kereta"
  (`priceForMonthly`) was removed with the insurance switch: it left insurance out and read
  too generous. Verdict colours are MUTED green / amber / red, on the column dots
  only. The seller's own settings are ink when picked; the accent stays on the viewer's
  number. `npm run test:live`.
- Contact, once switched on, is a loud accent "Contact me" banner UNDER THE COMMENT LINE at
  the top (2026-10-24: at the foot it fell below the fold on a model card), OFF by default
  (TikTok rule above).
  The seller's standing **Offer** (free tint, dashcam...) is typed in Adjust, remembered
  per device (`xd_live_offer`), and shown above the comment bar on every car.
- **A new-car model card gets a variant row** (`is_model_card`): it shares
  `useNewCarVariant` with the car page, so price + spec follow the pick on both.
  Its chips sit at the top of the answer block (`.lp-ans`), and the title drops the
  variant name (the picked chip names it).
  **What the variant adds (owner, 2026-10-24: hosts sell on "AV dapat 360 camera")**: a caption
  strip on the photo (`.lp-extras`, desktop only; on a phone the photo is a thumbnail) from
  `variantExtras` (liveMaths.js, `npm run test:live`): what the picked variant has over the next
  cheaper one, from `new_car_models.specs` safety + features, max 4. ADDITIONS ONLY, never "loses
  X": the spec sheets leave things out (X90 Lite lists cruise control, Prime does not), so a
  removal would be a false claim on camera. A seat change shows as "6 seats", never "+". The
  cheapest variant shows headline items (airbags, camera, screen). Wrong item = fix the spec in
  console > New car prices, never in the presenter.
- **Insurance is ALWAYS in the loan (owner, 2026-10-24; was an Off | In the loan switch in
  Adjust, `xd_live_ins`, removed).** Without the row the working was shorter and the photo beside
  it shrank. An "Insurance (est.)" row sits under Price and NCD pills under the working
  (0/25/30/38⅓/45/55, the viewer's, never typed). With it always on, Budget's "Car budget" line
  is gone (it read more generous than the cars, insurance not being in it).
  Loan = price + insurance - rebate - deposit; deposit % stays on the net price. The
  figure is ONE formula, `src/utils/motorInsurance.js` (the former PIAM tariff: first
  RM1,000 by cc + RM26/RM1,000 Peninsular, RM20.30 Sabah/Sarawak/Labuan, - NCD, + 8% SST
  + RM10), checked against a seller's Excel (X50 RM2,840 vs his RM2,869). The tariff
  ended in 2017, so it is always labelled an estimate. No cc (EVs) = no estimate: the row
  shows "-" and the seller taps it to type the figure, which wins for that car and hides
  the pills (Adjust no longer has its own insurance box: one place to set it). **The Insurance line is typed in place like Rebate, and a typed
  figure is REMEMBERED on the device until changed** (owner, 2026-10-24, a Proton advisor quotes
  his insurer's number per model): `xd_live_insfig`, keyed by listing, `<listing>:<variant>` on a
  model card (`insKey`), no month end. Never saved to the listing or the server. Budget adds
  the same insurance (`budgetMatches` `extraFor`), a model card's with its variant's cc.
  `npm run test:live`.
- **Every car the presenter names carries its VARIANT** (owner, 2026-10-21: "details is
  what we win in"): `carLabel` (liveMaths.js) = year, brand, model, variant, used by the
  Budget rows and the live report. Budget prices a new-car model card ONCE PER VARIANT
  (`budgetCars`, via `useNewCarInfos`) and lists the dearest variant that fits, by name;
  tapping it opens that card with that variant picked (`pickNewCarVariant`). One row per
  car per list. Never name a car by model alone, or price a card only at its cheapest.
  It is the ONLY insurance formula in the app (2026-10-18): the financing calculator,
  the dealer LeadDrawer deal sheet and `ownership.js calcInsuranceAnnual` (car page /
  Compare) all call it. They had their own band table that gave about HALF the tariff,
  plus a saloon / SUV switch: that split is a ROAD TAX rule, never insurance. Do not
  add a second insurance table anywhere.
- **Guards + reverse maths (LIVE-CALC, 2026-10-22)**, all in `liveMaths.js`, `npm run test:live`:
  tenures follow the car's age (`tenuresFor`: about 15 years old at loan end, bank policy, the note
  says "usually"; new cars uncapped; Budget prices each car on the SAME rows the Cars screen offers,
  or the row and the car it opens disagree); `rateWarning` flags an EIR under 4% (a flat number on
  the wrong switch) or over the HP Act cap (17% <=5y, 16% >5y); Adjust > "Target monthly" takes a
  target and fills the deposit (`depositToFit`, rounded UP to RM100); "just above" Budget rows say
  "+RM x deposit and it fits" and open with it; a TOTAL COUNTER under the salary guide (owner,
  2026-10-22: two tiles, "Total you pay" = deposit + every instalment, and "Interest"; `.lp-totals`).
  **No OTR line, on any car (owner, 2026-10-22):** used/recon OTR varies by dealer, and the 4 brands'
  official price is already on the road without insurance, so an OTR amount would double-count. A typed deposit >= price stays as typed and reads "no loan needed" (it used to fall back to
  10% silently). "No deposit" stays (owner: new-car rebates cover the deposit).
  **TWO rates, each set once and remembered per device** (owner 2026-10-22): NEW Proton/Perodua
  (`isLocalNew` in liveMaths.js, starts at `LOCAL_NEW_EIR` 4.8% EIR, key `xd_live_rate_local`) and
  every other car (starts at `DEFAULT_EIR`, key `xd_live_rate`). Used Protons stay on the other
  rate: 4.8% on a used Saga quotes a monthly lower than banks give. Each car, and each Budget row
  (`budgetMatches` `rateOf`), is worked on its own group's rate. Adjust > Live shows only the
  groups this live has. An empty box mid-typing never overwrites the last good rate.
  The rate box stops at 17 (`RATE_MAX` / `clampRateInput`, the legal EIR ceiling; a typo like 65
  for 6.5 becomes 17) and the "Rate" label has an info button (`lp-info`, hover with a mouse,
  tap on a phone; `pointerType === 'mouse'` only, or a tap opens and closes it at once) that
  explains EIR vs flat in both languages (`liveCopy.js rateInfo`).
  A model card's Budget row shows its variants ON TOP (`options` from `budgetMatches`): the ones the
  budget buys are tappable and the row's price + monthly follow the pick (and the car it opens);
  the rest are dimmed and struck through, never blurred (blur reads as a glitch on camera).
- **Photos go through `cdnImg` at 960px and are preloaded** (2026-10-22, `photoUrl` / `preload` in
  LivePresenter.jsx): the current car's photos plus the first photo of the cars either side, held
  as live Image objects. Raw uploads (2-5 MB) left the old photo on screen through three taps. The
  `<img>` is keyed by photo so a tap never shows the old photo under the new dot.
  **Full view** (expand button on the photo, `photoFull`): fills the STAGE (`.lp-full`, absolute in
  `.lp-stage`), never the browser window, so it is never wider than the calculator (owner,
  2026-10-22). Uncropped (`object-fit: contain`), tap halves / swipe / arrow keys step photos, X /
  Esc / Back close it (it registers `useModalHistory`). Not portalled: the presenter already is.
- **Rebate = money off the price, per car** (`netPrice`, liveMaths.js). Typed in Adjust >
  Rebates (one list, every car, one box each), never saved to the listing or the server.
  EVERY car's rebate is REMEMBERED ON THE DEVICE until the month ends, Malaysia time
  (`xd_live_rebates`, `rebatesForMonth`, `monthEnd`; owner 2026-10-22, it was model cards
  only). On a new-car model card ONE rebate covers every variant (keyed by the listing).
  On another device the list starts empty (device storage, by design). Loan =
  price - rebate - deposit; deposit % chips and the Budget tab use the net price.
  Shown as a "- RM x" line under the price: never a crossed-out "was" price, and
  never counted as the buyer's deposit. A NEW car always shows the line, "None" until
  set (owner, 2026-10-22: brands run a promo every month); other cars only once set.
- **Docs screen = what the bank asks the BUYER for** (top-bar "Docs", list in
  `liveCopy.js docsList`). One list for new, used and recon: the car does not change
  it, how the buyer earns does (Employee | Own business). Always says each bank sets
  its own list, and "never post your IC or payslip in the comments", as the dark bar at
  the TOP of the screen (`.lp-privacy`), out of the comment area. The top bar must
  fit three labels + four buttons at 360px in BM; check it after adding a button.
- **ONE accent, on exactly three things (owner, 2026-10-22):** the #N badge, whatever is
  selected (chips, tenure tile, NCD, variant), and the big monthly. Everything else is ink
  on white on a neutral stage: no tinted rows, no gradient, no red corner glow, and the
  top-bar tab, comment line and next button are ink, not accent. The rebate keeps green TEXT
  only. Budget highlights the 35% result (`.lp-hl`).
- **Accent colour is the seller's pick** (Adjust > Colour: 8 presets + any colour,
  remembered per device, `xd_live_accent`). Every accent in the presenter CSS is a
  variable (`--lp-a`, `--lp-a2`, `--lp-rgb`) set from
  `accentTheme()` in `src/utils/liveAccent.js`, which darkens a too-light pick until
  white text passes 3:1 (bold text) at the gradient's light end. Never hardcode a
  colour back into the presenter CSS, and never skip `accentTheme` for a new pick.
- **Presenter language (EN/BM) is the presenter's OWN switch** (top-bar "EN"/"BM"
  button), not the app's i18n language: a seller may run the dashboard in one and
  present in the other. Starts in the last presenter choice (`xd_live_lang`), else the
  app's. Every on-screen word lives in `src/components/live/liveCopy.js` (both
  languages); a new string goes there in BOTH, never hardcoded in the JSX.
- **Motion is for the camera (LIVE-MOTION, owner 2026-10-25)**: the big monthly ROLLS to a new
  value on a tap (`RollingNumber`, its own component so the per-render `fit` does not run ~40
  times; snaps on a new car), a new car slides in from the side the seller went with one pop on
  #N, the photo drifts 4% over 9s then holds. Slow, large moves only: a phone filming a monitor
  plus TikTok compression smears anything fast. No loops, no confetti. All off under reduced motion.
- **Jump to a car (LIVE-JUMP, 2026-10-25)**, 3+ cars only: desktop with 200px+ of margin = a list
  card RIGHT of the stage (`.lp-pick`, outside the zoomed stage, so outside an upright phone's
  frame); otherwise a list button in the bottom nav opens it as a sheet (viewers see it briefly).
  Search takes `#7` or a name. Keyboard: digits then Enter opens that #N (`typedNo`, clears after
  3s). One row per CAR (a model card is one row; variants stay chips). A sharer of the WHOLE
  screen in LIVE Studio shows the list too: they share the presenter window only.
- **Live report** on exit (lives of 1 min+): counts from the seller's own
  `analytics_events` (by slug) and `leads` (by salesman_id) since the presenter
  opened. Counts only, never a buyer name: the screen may still be on stream.
  `npm run test:live`.

## Loan check (IDEA-23, 2026-10-25) — fix the file BEFORE any bank sees it
A Proton SA: buyers go to 4-5 banks, all decline (CTOS, CCRIS, no bank record, late payments,
new job), then the SA chases documents. Premium only (owner, 2026-10-25): Lite's lead panel shows
it locked (`premiumRow.loanCheck`), opening `goPremium`.
Opened from the lead panel ("Loan check"), the Loans tab (walk-in buyer) and, once saved, a
status row on the lead card (the 3-button row is unchanged). Three steps, credit record FIRST,
then two tabs: what to fix, what to bring (sent to the buyer on WhatsApp, EN/BM switch, a
person presses send). Rules + maths: `src/utils/loanReadiness.js` (`npm run test:loancheck`),
on `financing.js` and the Live presenter's DSR bands. Words: `src/components/loans/loanCheckCopy.js`.
- **Never an approval, a score or a chance.** It lists what commonly gets a file declined.
- **One bank first, not five**: pending + approved applications show on CCRIS for 12 months.
- Saved in `loan_checks` (migration `20261025d`), one row per lead, answers only, never an IC.
  NOT in `loan_applications`: a row there flips `leads.loan_status` to submitted
  (`trg_sync_lead_loan`) though nothing went to a bank. Never on the Live presenter.
- **ONE flow into a bank application (owner, 2026-10-25).** An application starts ONLY from a
  saved check: the result's "Start the bank application" (`onApply`) closes the check and the
  Loans tab opens `ApplyFromCheck` (`src/components/loans/LoanDesk.jsx`) with buyer, car, price,
  deposit, years, income, commitments and how they earn filled in. It asks only phone + IC,
  banks, documents collected, notes. The old "New application" form (its own buyer/car/income
  fields, a second DSR with 60/65/70% ceilings, "cars that fit") is GONE: one buyer read "tight"
  in one and "over the ceiling" in the other. Affordability = `assessReadiness`, nowhere else.
  The application's document ticks still follow `DOC_SETS` by how the buyer earns, because the
  buyer's status page (`LoanSharePage.jsx`) must show the same list and has no other source;
  following the check's own list needs a column on `loan_applications` + the share RPC.
  LoanCheck + LoanDesk are Premium-only and drawn in `premiumDark` (a local `C` map onto `PD`).

## Loan poster (POSTER-1, 2026-10-16) — the seller's "Kiraan Loan" image
Opened from a car's menu in Lite, Premium (`salesmanPremium/ListingsTab.jsx`) and the
linked-salesman car popup (`Salesmanpanel.jsx`). Seller types price, deposit, rate (EIR or
flat) and gets one 1080x1350 JPEG: full-width photo with the car name on it, price + its
working on one line, 9/7/5 instalments as a stacked list, their name/photo/WhatsApp number
and mini-page link. Built in answer to SA Studio X (IDEA-18).
- **Our layout, never theirs (owner, 2026-10-16).** The first build was a near pixel copy
  (white card, navy tenure blocks side by side, navy seller band, "KIRAAN LOAN" header).
  The idea and the numbers are free to use; their arrangement and look are not. Keep the
  Drevo dark surface; do not drift back toward their template.
- Numbers + every printed word: `src/utils/loanPoster.js` (`npm run test:poster`). Drawing:
  `src/components/poster/renderLoanPoster.js`. Sheet: `src/components/poster/LoanPosterSheet.jsx`.
  Image loading shared with the calculator's quotation poster: `src/utils/posterImage.js`.
- A flat rate is converted PER TENURE (`eirForTenure`); never feed it raw. A missing or
  impossible number = no poster, never a guess.
- No "full loan" line and no insurance folded into the loan (owner can revisit): a
  no-deposit figure is how prices get inflated on paper.
- Quota is server side: `claim_loan_poster(listing)` (migrations `20261016b`, `20261018b`). Lite = 10 CARS a
  month (Malaysia time); the same car again that month is free. Premium + dealer-linked =
  unlimited via `salesman_has_full_page`. It refuses a car the seller cannot sell. The
  preview is free and watermarked; only the clean file claims. Limit 10 lives in BOTH the
  SQL and `LITE_POSTERS_PER_MONTH`.
- The seller's own number on their own poster is fine (they send it); this is NOT a public
  page, so CDP-3 does not apply. Never put this poster on a buyer-facing page.

## Background cut-out runs ON THE PHONE (CUTOUT-1, 2026-10-23)
`src/lib/cutout/index.js` (`cutOutBackground(src) -> PNG Blob`) + `cutout.worker.js`. Model:
ISNet (DIS project, Apache-2.0) at `public/models/isnet-wq8-v1.onnx`, Conv weights stored
8-bit and dequantized to float32 at load (47 MB, 97-99% mask match to the full model; the
dynamic 8-bit version lost car edges). Used by the Studio's Remove BG (`TikTokStudioV3.jsx removeBg`),
which only paid accounts can open (Premium, dealers, dealer-linked salesmen; Lite has no Studio).
- **Two engines, one per device** (2026-10-23): `cutout.gpu.worker.js` (`onnxruntime-web/webgpu`,
  graphics chip, ~6.7 MB gzipped engine) when `navigator.gpu` gives an adapter, else
  `cutout.worker.js` (`onnxruntime-web/wasm`, processor, single thread, 3.7 MB). Both run
  `cutout.core.js`. If the GPU path throws or returns garbage (NaN / flat mask), that photo is
  redone on the processor and the device stops trying the GPU for good (`xd_cutout_nogpu`).
  A download error never flips that flag.
- **The car's pixels are the seller's photo; the model only picks which to keep.** Never
  swap this for an image-generation model (Gemini etc.): it redraws the car. Gemini is for
  the scene BEHIND a cut-out (next step), never the cut-out itself.
- remove.bg (the old provider) shuts its self-service API 1 Dec 2026; its server route is gone.
- First use downloads 47 MB + a 14 MB engine (3.7 MB gzipped), then Cache Storage
  (`xd-cutout-v1`) serves it offline. The UI says so before the first download.
- The input is FIXED at 1024x1024 (sizes are baked into the graph; 512/768 fail). Photos
  over 2048 px are scaled down first to spare phone memory.
- `vercel.json` CSP carries `'wasm-unsafe-eval'` in script-src for this (WebAssembly only,
  not JS eval). A new model = a NEW filename (`-v2`): `/models/*` is cached immutable for a year.
- Licence: BRIA RMBG (1.4/2.0) is NON-commercial and @imgly/background-removal is AGPL;
  do not swap either in. BiRefNet is MIT but too heavy for phones (115 MB, crashes).
- **Photos are fetched with `?cors=1`** (`fetchPhoto`): the service worker holds car photos as opaque <img> copies and a CORS fetch of one fails as "Failed to fetch" (first staging test, 2026-10-23).
- Speed (owner, 2026-10-23): about 30 s on an Oppo Reno 10 5G, 1 min 20 s on a 4 GB Chromebook. Faster path if needed: WebGPU (`onnxruntime-web/webgpu`, +~7 MB gzipped engine).

## Studio backdrops behind a cut-out (BACKDROP-1, 2026-10-29) — Premium only
After Remove BG (CUTOUT-1) the Studio offers drawn scenes BEHIND the car: Studio, Spotlight,
Stripes, Brand (theme accent), Dusk, Light, plus a ground shadow and Car size / Car height
sliders (`src/components/studio/backdrops.js`, `npm run test:backdrops`). Drawn in canvas: no
AI, no server, no cost. Gate = the `backdrops` prop on `TikTokStudioV3`, passed ONLY by
SalesmanPremium.jsx (dealer dashboard and linked salesman do not get it). The picker shows only
once the background is removed; the first cut-out lands on Studio. The car is placed by the
opaque pixels of the cut-out (`cutoutBounds`), standing on the floor line, inside the
template's `carZone` when one is set. Slide fields: `backdrop` ('none' = off), `carShadow`,
`carFit {size, lift}`. A cut-out no longer gets the blurred copy behind it (it was a dark
smear) on any surface. AI scenes behind the car (Gemini / FLUX, ~US$0.02-0.04 each) are
PARKED until revenue covers them: if built, the key lives in an edge function, never the
browser, and the AI never draws the car or the numbers.

## Studio editor gestures (STUDIO-UX-1, 2026-10-29) — the rules that keep it usable
Tap selects, tap empty canvas unselects, double-tap a text edits it (measured in
`CanvasElement`'s onClick, 320ms: phones do not fire dblclick reliably). A press only moves an
object after 5px of travel (`DRAG_START_PX`; `LayerCanvas` the same), so a tap is not a drag and
not an Undo step; `touchcancel` ends a drag. Text elements carry `touch-action: none`, and the
phone canvas area never scrolls: it is SIZED to its measured box (`mobAreaRef`, ResizeObserver).
- **Never render a component declared INSIDE `TikTokStudioV3` as JSX** (`<BgAdjustPanel/>`):
  it is a new type every render, so React remounts it on every change and a slider drag dies
  after one step. Call it as a function (`BgAdjustPanel({...})`), and use the ONE slider,
  `studio/DragSlider.jsx` (a second copy inside the studio was the bug). No `<input type=range>`.
- The full-canvas dark gradient (`makeOverlayLayer`) is created LOCKED, or it catches every
  tap meant for empty space. Unlock it from the Layers list to edit it.
- Still open (owner, 2026-10-29): merge the two text systems (elements in px vs layers in %)
  and cut the panels down. One change of its own, not mixed into fixes.

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

## Dashboard caching — every tab paints from the device first (PERF-LOAD, 2026-09-26)
The database stalls (see DB migrations), so no dashboard screen may wait on the
network before showing anything. Two layers, both purged on logout:
- Panel bootstrap data (profile, listings, leads, enquiries, appts): `seedPanelCache`,
  window `PANEL_SEED_TTL` (7 days) in `src/utils/panelCache.js`.
- Every tab's own data: `usePersistentState(key, initial, { redact })`
  (`src/hooks/usePersistentState.js`) in place of the `useState` the fetch fills.
  Pattern: `const [rows, setRows, cached] = usePersistentState(...)`, then
  `loading = fetching && !cached` so the spinner shows only when there is nothing.
- **A new tab that fetches data uses this hook.** Key must END in the dealer/user id.
- **Redact IC numbers, buyer_address, hp_docs** (it is plaintext on disk).
- **A redacted row must never be the source of a write.** CustomersTab disables Edit
  while loading and refuses to save a row missing `ic_number`, or saving would blank
  the IC. Check the same thing on any tab whose edit form spreads the row back.
- DocumentsTab is deliberately NOT cached: documents carry buyer IC and address.
- A failed read keeps the cached value; never overwrite a good cache with [] on error.
- **A number that is still loading is a placeholder, never a 0** (2026-10-18).
  `src/components/ui/StatSkeleton.jsx`. The Lite + Premium dashboards showed 0 views /
  0 visits / 0 taps and "your pipeline is clear" until their requests answered.
  `carStatsMap` + `minipageStats` are now `usePersistentState`; `trafficReady` /
  `leadsReady` reveal each group of numbers together (with a 12s fallback for a
  stalled DB). Same rule for any new stat tile, and for empty states ("nothing
  waiting", `ThisWeek loading`): an all-clear before the data loads is a false one.

## Loan maths — ONE formula, EIR on the reducing balance (HP-EIR, 2026-09-26)
Hire-Purchase (Amendment) Act 2026 (in force 1 June 2026) abolished the flat rate
and the Rule of 78 for new agreements. Every instalment / total interest / schedule
comes from `src/utils/financing.js` (`monthlyPayment`, `loanTotals`, `amortize`,
`calcMonthly`, `BANK_RATES`, `DEFAULT_EIR`). There were 15 copies; do not add one.
- **A flat number is not an EIR.** 3.5% flat over 7 years = 6.44% EIR. Feeding a
  flat rate into the EIR formula understates the instalment ~9%, in the buyer's
  favour — a consumer-protection problem. Convert with `flatToEir()`.
- **Anything SAVED with a rate records its basis** (`rate_basis: RATE_BASIS` on deal
  sheets, loan attempts, document metadata; `deal_financials.loan_rate_basis`).
  Absent = saved before the switch = flat. Label with `rateLabel()`; never re-read
  an old flat record as EIR or recompute it.

## RLS policy safety
- NEVER write an RLS policy on a table whose USING/CHECK expression does a subquery on that SAME table — it causes infinite recursion and breaks every read (symptom: profile fetch fails → app redirects to login in a loop)
- For any policy that needs to reference `profiles` (especially policies ON profiles), use a SECURITY DEFINER helper that bypasses RLS: `get_my_dealer_id()`, `is_superadmin()`, `is_linked_salesman()`, `is_active_salesman()`
- Dealer profile rows have `dealer_id = NULL` (they own themselves) — to grant a salesman read access to their dealer, match `id = get_my_dealer_id()`, NOT `dealer_id = get_my_dealer_id()`
- leads.lead_source CHECK only allows: walk_in, whatsapp, referral, drevo_enquiry, enquiry, manual, chat, find_me — any other value rejects the whole insert
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

### A signup request never chooses its own role or dealer (SEC-11, 2026-10-28)
`handle_new_user` used to copy `raw_user_meta_data->>'role'` and `->>'dealer_id'`, which the
CLIENT sets in `supabase.auth.signUp({ options: { data } })`, and every role guard skips the signup
insert (`auth.uid()` is null there). So `data: {role: 'superadmin'}` made a platform admin and
`{role: 'manager', dealer_id: X}` joined dealer X's team. Now a signup is only buyer / salesman /
dealer, never linked (migration `20261028c`). Staff roles and dealer links come ONLY from the
service-role follow-up UPDATE in the `invites` / `create-salesman` edge functions;
`guard_profile_approval_cols` lets that through (`auth.role() = 'service_role'`) and approves it.
- Never read a privilege-bearing field (role, dealer_id, plan, approval) from `raw_user_meta_data`.
- Dealer invites need `_dealer_in_good_standing(dealer)` (platform-approved, active, not
  suspended), checked at creation AND at redemption; `dealer_invites` has no client INSERT/UPDATE.

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
5. **EVERY overlay registers `useModalHistory(isOpen, onClose)`** (2026-10-18). Tabs are real
   history entries, so an overlay outside history gets walked past: the phone's back swipe
   switched the tab and left the overlay (TikTok studio) sitting on top. The hook keeps ONE
   shared stack, so Back closes the top overlay only, and the old race (closing A + opening B
   in one tick closed B) is gone; do not go back to per-overlay popstate listeners. A page
   change made while an overlay's entry is on top takes that entry over, so a nav link inside
   the phone menu costs no dead Back press. Shared sheets register INSIDE the component
   (`useModalHistory(true, onClose)` when mounted only while open), never also in the page,
   or Back needs two presses. Lost work: pass `{ isDirty: () => bool }` and Back asks
   (`common.closeUnsaved`); a multi-step form wrapper (ListingFormModal, CarFormModal) asks
   every time. Proven by a Playwright harness of 15 back-gesture cases, not by reading.

## Product tour (Salesman Premium) — anchors and placement
A welcome card + one step per sidebar link the menu is SHOWING (`TOUR_STEPS` built from
`navTabs`, SalesmanPremium.jsx).
**Every Premium tab shows from day one (owner, 2026-10-25, SIMPLE-2, undoing SIMPLE-1).**
SIMPLE-1 (2026-10-21) hid Inbox, Sold, Analytics, Loans and Outreach until the seller "earned"
them; the owner rejected it ("it's the tabs that need to be simpler"), so `navTabs` is the fixed
ten and the simplifying happens INSIDE the tabs. The per-tab intros still wait for real data.
The Dashboard's `startingOut` (setup + greeting + page link until the first buyer) is unchanged.
Sidebar + phone drawer rows share ONE style (`navRow` / `navBadge`, SalesmanPremium.jsx): 40px
rows (44 on a phone), 12px corners, 16px icons; colours are still the old `panel` blue.
**Lite shows every tab from day one too (owner, 2026-10-25)** (`TABS_DESKTOP` / `TABS_MOBILE` +
`TOUR_PLAN` in SalesmanLite.jsx): Dashboard, Listings, Leads, Inbox, Performance, Settings. A
seller with no car who opens Leads or Inbox gets the "list a car first" screen (`gatedLocked`).
The tour is built from `TOUR_PLAN` (one list for steps AND anchors; never re-split them into two
index-matched arrays). Dashboard `startingOut` hides the Chat/Add-ons row and every card below
it until the first buyer. `gatedLocked` lock screens stay for deep links. The tour never switches tabs: it opens the nav (the drawer
on a phone) and rings each link where it sits (`data-tour-id`).
- **The bubble FOLLOWS the ringed link; the buttons do NOT (owner, 2026-10-18).** The
  bubble is words only, placed beside the link by `placeTourCard` (`src/utils/tourPlacement.js`:
  never overlap the target, never leave the viewport), on a phone too. Back / Skip / Next
  are ONE bar pinned to the bottom (centred on a phone, bottom-right on desktop), so Next
  never moves under the thumb. Do not put the buttons back in the bubble, and do not dock
  the bubble to the bottom of the phone again (it sat far from the link it described).
  `TOUR_BAR_H` is the space the bar takes; placement and the drawer's bottom padding use it.
- The bubble is MEASURED after render (`tourCardRef` + `tourCardH`), on EVERY render (no
  deps: an intro bubble mounts a render after its step, and keyed deps kept the last
  step's height, so it floated far above the target). An intro scrolls its target into
  view when anything covers it (`covered`, elementFromPoint): the sticky top bar hid the
  real ··· and the ring landed on the logout button. `npm run test:tour` after touching the geometry.
- Portalled to `document.body` (overlay rule 1). The bubble's scroll goes on an INNER
  wrapper: `overflow` on the bubble clips the arrow.
- `startTour()` records the entry tab and `dismissTour()` returns there.
- **Per-tab intros (INTRO-2, 2026-10-18)** run on the SAME engine (`tourMode` = "main" or a
  tab key; `TAB_INTROS` in SalesmanPremium.jsx; copy in `salesmanPremium.intro.*`, en + ms).
  First visit to Listings, Leads, Sold, Loans or Outreach, only after the sidebar tour is done.
  Each step rings an in-page `data-tour-id`; a step whose target is missing or zero-height
  (no car yet) is dropped at start. Seen = `profiles.starter_tasks.intro_<tab>` (the console
  handover already resets starter_tasks; no new column). The tour, every intro and the
  first-sale card count as SEEN after 3s on screen, not only on Skip/finish: closing the app or
  leaving the tab mid-way used to record nothing, so they replayed every visit (2026-10-18).
  `markStarterTask` re-reads the row before merging, so one flag never erases another. A spacer under the tab content gives bottom-most controls room above the bar.
- **An intro waits until its tab has something real to show.** Sold plays only after the
  first won deal (`handover.deals`), Outreach only once there is a live lead. A new seller's
  Sold tab is three empty states; an intro there explains things they cannot see and then
  never returns once they can. Any new tab intro needs the same check.
- **First sale card (INTRO-3)**: `renderFirstSale` in SalesmanPremium.jsx, shown once when
  `handover.deals` has exactly ONE deal won in the last 14 days (never "first car" for a
  seller with an old or second sale), after the win confirm closes and outside any tour.
  Names the car and buyer from the deal. "Show me" opens Sold, where the Sold intro plays.
  The Sold intro's Handover and Customers steps switch the pill (`onEnter`) and ring the
  seller's own first row (`handover-deal-<id>` / `customer-<id>`), so the buyer they just
  sold to is on screen; a step's `targets` are selectors, best first, the pill as fallback.
  Seen = `starter_tasks.first_sale_seen`. Copy in `salesmanPremium.firstSale` (en + ms);
  it names no product, because the seller-side name is still an open owner call.
- **First-poster intro (INTRO-4, 2026-10-18)**: `POSTER_INTRO` in SalesmanPremium.jsx, tourMode
  "poster" (it belongs to the Listings tab). Plays once on Listings when the seller has a car that is
  not sold, after the Listings intro, with no form or sheet open. ACTION steps (`waitFor`): tap ···
  (`lst-more`), tap Loan poster (`lst-poster`), check the numbers (`poster-numbers`, the one Next),
  download (`poster-download`); the bar shows "Tap the ringed button" instead of Next. Closing the
  menu or sheet early goes back to step 1; `LoanPosterSheet onDownloaded` ends it. It lifts itself
  above the sheet (`zBase` 10000; the sheet is 9999). The Listings intro lost its "···" step to it.
  Seen = `starter_tasks.intro_poster`. Premium only; Lite has no intro engine (10 free posters/month).
- Motion: ring and bubble FADE in per step (keyed) and then track the target with no
  position transition (a transition made the ring trail behind a scroll). Reduced motion off.

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
