# Salesman Panel Audit (src/pages/Salesmanpanel.jsx) — pre-launch

Scope: the salesman dashboard under a dealer (route `/salesman`, 8157 lines).
Both linked salesmen AND standalone Salesman Lite (role `salesman`, `dealer_id = NULL`)
route here via `useRoleRedirect` — so anything keyed on `profile.dealer_id` silently
breaks for Lite. Findings ordered by launch impact. Line numbers are approximate.

## LAUNCH BLOCKERS

- [ ] B1 — **Team tab is a "coming soon" placeholder.** `renderTeam()` (~6483) renders
  a static "Team view coming soon" empty state, even though the team leaderboard
  (units sold this month per salesman) is ALREADY computed into `leaderboard` state
  (~765-788). FIX: render the existing `leaderboard` rows (name, units, isMe highlight)
  in `renderTeam()`; data is already there.

- [ ] B2 — **Mobile bottom nav crams 11 tabs into a fixed 60px row** (~6544-6610):
  dashboard, listings, incoming, leads, analytics, enquiries, loans, handover, team,
  settings, help — each `flex:1` at 375px ≈ 34px wide, labels only show when active.
  Unusable; convention is ≤5 primary items. FIX: reduce to 4-5 primary tabs + a "More"
  sheet, or a horizontal-scroll pill nav (per CLAUDE.md mobile rules).

- [ ] B3 — **No modal uses `createPortal` or body-scroll-lock.** 0 occurrences of
  `createPortal`, 0 of `body.style.overflow` across ~10 overlays (testDriveConfirm,
  waModal, followUpModal, dealSheetConfig, deleteConfirm, cancelConfirm, telegramSetup,
  carDetailPopup, reminder picker, loan edit). Violates the non-negotiable overlay rules
  in CLAUDE.md: background scrolls behind the sheet and parent stacking contexts can clip
  it. FIX: wrap overlays in `createPortal(jsx, document.body)` + lock body scroll in a
  `useEffect` keyed on the open boolean.

- [ ] B4 — **Leads tab loads empty for Salesman Lite.** Leads query (~657) filters
  `.eq("dealer_id", profile?.dealer_id)`. For a standalone Lite salesman `dealer_id` is
  NULL (they own themselves; their leads carry `dealer_id = profile.id`), so the filter
  matches nothing and the entire pipeline is blank. FIX: use
  `getDealerIdFromProfile(profile)` (returns `profile.id` for Lite) — the canonical helper.

## HIGH

- [ ] H1 — **Inconsistent dealer-id derivation** (same root cause as B4). `profile.dealer_id`
  is used directly in ~5 spots (657 leads, 209 incoming pool, 819/824 inventory, 868
  salesman_listings insert) while `getDealerIdFromProfile` is used in others (794 loans,
  828 loan, 1447 activities, 5828 loan submit, 5923 handover). Standardize ALL dealer
  scoping on `getDealerIdFromProfile(profile)` so Lite + linked behave identically.

- [ ] H2 — **Commission strip is all-time, not MTD.** The all-time commission query (~554)
  carries a stale comment "no sold_at column yet, date filter removed" — `sold_at` now
  exists. If the dashboard labels this figure as monthly/this-month it is wrong. FIX:
  decide all-time vs MTD and either relabel or add `.gte("sold_at", monthStart)`.

- [ ] H3 — **`submitLoan` fails silently on missing required fields** (~5826):
  `if (!bank_name || !loan_amount || !loan_tenure) return;` with no toast — the button
  appears dead. FIX: surface a validation toast / inline error.

- [ ] H4 — **`alert()` used for lead-claim errors** (~233, ~237) — blocking native
  dialogs, inconsistent with the `toast` UX used everywhere else in the file. FIX:
  replace with `toast.error(...)`.

## MEDIUM

- [ ] M1 — **Desktop sidebar nav can be clipped on short screens.** The `<nav>` (~6674)
  sets both `overflowY:"auto"` and `overflow:"hidden"` (the latter wins), so with logo +
  11 items + footer exceeding viewport height the bottom tabs (settings/help) become
  unreachable. FIX: drop `overflow:"hidden"`, keep `overflowY:"auto"`.

- [ ] M2 — **`window.confirm` for loan delete** (~5876) — native blocking dialog,
  inconsistent with the in-app confirm modals used elsewhere. FIX: use a confirm modal.

- [ ] M3 — **Loan calculator uses flat-rate interest** (`recalcLoanForm`, ~5904:
  `loan * rate/100 * tenure`) while HP financing is reducing-balance — two different
  monthly figures for the same deal (CLAUDE.md L8 drift). FIX: align the formula with the
  rest of the app or label it explicitly as flat-rate.

- [ ] M4 — **Local `featuredIds` shadows state `featuredIds`.** A `const featuredIds`
  inside `fetchAppts` (~575) shadows the component-level `featuredIds` state (~165).
  Harmless today but a readability/footgun. FIX: rename the local.

## LOW

- [ ] L1 — **AI lead scoring runs on every leads load** (~668) via `ai-proxy` with no
  caching/debounce — latency + token cost on each mount. FIX: cache per-lead score (e.g.
  store on the lead row or a short TTL cache) and only re-score changed leads.

- [ ] L2 — **Theme check.** Panel is dark (`#080a12`, `color:#fff`). Confirm this is
  intended vs the light dealer dashboard it conceptually sits under (CLAUDE.md: dealer
  dashboard is LIGHT). Not a bug if the salesman panel is its own surface — flagging for a
  product decision.

### Recommended order
1) B4+H1 (one dealer-id standard fixes the empty-pipeline blocker)
2) B1 (team tab — data already exists)
3) B2+M1 (nav: mobile bottom bar + desktop clip)
4) B3 (portal + scroll-lock pass over all overlays)
5) H2/H3/H4 (commission label, loan validation, alert→toast)
6) M2/M3/M4, then LOW.
