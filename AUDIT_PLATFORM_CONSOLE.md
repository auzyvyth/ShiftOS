# Platform console (/platform) — structure audit, 2026-08-28

Why this exists: the console is confusing to operate. This audit says exactly why,
compares it to how established admin consoles are built, and proposes a structure.

Scope is INFORMATION ARCHITECTURE — what lives where and what it's called.
It is not a styling pass and not a bug hunt.

Reference for "done right" in this repo: `AUDIT_DEALER_DASHBOARD.md`.

---

## What is there today

`src/pages/AdminPage.jsx` (2,052 lines) renders three "consoles", each with its
own tab strip — 17 destinations total.

| Section (was: console) | Defined | Tabs |
|---|---|---|
| ShiftOS Ops | `AdminPage.jsx:656` | ~~Dealers, Salesmen, Verify, Approvals, Waitlist, Platform Stats, Marketplace, Billing~~ → Home, Review, Dealers, Salesmen, Waitlist, Platform Stats, Marketplace, Billing (P3/P4 done) |
| ~~XDrive Ops~~ → folded into Marketplace | `AdminPage.jsx` NAV | Settings, Funnel, Engagement, Buyers, Broadcast, Volume (P1 done) |
| Security → Safety | `AdminPage.jsx` NAV | Activity Log, Sessions, Posture, Errors, Alerts |

Landing point: console `shiftos` (`:179`), tab `home` (`:175`) — the review queues. Was `dealers`, a browse table, until P3.

---

## Root cause of the confusion

**The top level mixes two incompatible ways of dividing things up.**

"ShiftOS Ops" and "XDrive Ops" split by PRODUCT. "Security" splits by FUNCTION.
So when you arrive there is no single question the top nav is answering — it is
neither "which product?" nor "what am I doing?", it is both at once. Every
navigation becomes a guess.

The clearest symptom: **marketplace settings live in ShiftOS Ops
(`:1664`) while marketplace analytics live in XDrive Ops.** Same subject, two
consoles, split by a rule that is invisible from the outside.

Everything below follows from this.

---

## CRITICAL

- [x] **P1 — Mixed taxonomy at the top level.** Product-split and function-split
  side by side (`:667`). Pick ONE. Recommended: split by what you are doing
  (work / people / product / money / safety), because that is how the day
  actually runs — you do not sit down to "do XDrive", you sit down to clear
  approvals.

- [x] **P2 — The same numbers are rendered on three different tabs.**
  Total / Active / Trial / Expired / MRR appear on Dealers (`:1861`),
  Platform Stats (`:1467`) and Billing (`BillingTab`, `:71`, as plan chips with
  per-plan MRR). Three surfaces, one truth, no indication which is canonical.
  This is the same "two things that should be one" failure the dealer-dashboard
  audit is full of. Fix: MRR and subscription mix live in exactly one place.

- [x] **P3 — No "what needs me right now" home.** The console opens on Dealers,
  a directory. The actual daily job is the two queues. An operator should never
  have to go looking for their own work — it should be the first thing rendered.

## HIGH

- [x] **P4 — The daily work is split across two vaguely-named tabs.** "Verify"
  (accounts) and "Approvals" (listings) — neither name says what it holds, and
  since the e-KYC change Verify now holds two different kinds of item (signups
  and ID checks). One review queue, filterable by type, is one habit instead of
  three.

- [x] **P5 — Accounts are split into two tables by role.** Dealers (`:1857`) and
  Salesmen (`:1497`) are separate tabs with separate search boxes and separate
  filters. They are the same object with a different `role`. Standard practice is
  one Accounts table with a role filter.

- [x] **P6 — The console is tab-oriented, not object-oriented.** This is the
  biggest structural gap versus professional tooling. To understand ONE dealer
  today you visit Dealers (who they are), Billing (what they pay), Approvals
  (what they submitted) and Activity Log (what they did) — four tabs, four
  searches, and you assemble the picture in your head. There is no dealer record.

- [x] **P7 — Three separate search boxes, no global search.** Waitlist (`:1376`),
  Salesmen (`:1502`), Dealers (`:1869`). Nothing searches across object types, so
  finding "that guy who emailed me" means guessing which tab he is in first.

## MEDIUM

- [x] **P8 — Flat tab strip gives launch-era and daily surfaces equal weight.**
  Waitlist sits beside Approvals as though they matter equally. They do not.

- [x] **P9 — Analytics scattered across three tabs in two consoles.** Platform
  Stats (ShiftOS) vs Funnel and Engagement (XDrive). No stated boundary between
  them.

- [x] **P10 — "Platform Stats" is a name that means nothing.** Every tab in a
  platform console is platform stats. Name surfaces after the decision they
  support (Revenue, Growth), not after the data they contain.

- [ ] **P11 — `AdminPage.jsx` is 2,052 lines** holding eight tab bodies inline
  while the other nine live in `src/components/platform/`. Two conventions in one
  file. The inline ones are the ones that duplicated their stat cards.
  PARTLY DONE: the Dealers and Salesmen bodies (~530 lines) left the file as
  `components/platform/AccountsTab.jsx`, and the file is down to ~1,880 lines.
  Still inline: Review (listings), Waitlist, Volume, Marketplace settings,
  Billing, Home. Extract them the same way.

---

## How established consoles do this

Common shape across Stripe, Shopify admin, Vercel, Linear and AWS — worth copying
because it survives the product getting more complicated:

1. **Home is a work queue, not a directory.** You land on what needs a decision
   plus a few health numbers. Browsing is something you choose, not the default.

2. **One global search over every object type.** One box (usually Cmd-K) finds a
   dealer, a listing, an invoice or a log line without knowing which section owns
   it. This is the single highest-leverage fix for "I feel confused" — with real
   search, imperfect navigation stops mattering.

3. **Object-oriented, not table-oriented.** Stripe's customer page shows that
   customer's payments, subscriptions, events and logs on one record. You go to
   the noun, and everything about it is there. This is P6, and it is the change
   that would most reduce the number of places you have to remember.

4. **One canonical home per metric.** MRR is shown in one place. Everywhere else
   links to it. This is P2.

5. **A consistent top-level taxonomy**, usually some cut of:
   work to do / objects you manage / what happened / settings.

6. **Destructive and rare actions are demoted**, not given equal billing with
   daily ones.

---

## Proposed structure

Six destinations, one taxonomy (what am I doing), replacing 17 across 3 consoles.

```
HOME         Queues needing action + platform health. The landing page.
REVIEW       ONE queue: listings, signups, ID checks. Filter by type.
             (merges Approvals + Verify)
ACCOUNTS     One table, filter by role. Click a row -> account record showing
             plan, billing, listings, activity and sessions together.
             (merges Dealers + Salesmen + Waitlist, and answers P6)
MARKETPLACE  The XDrive product: settings, funnel, engagement, buyers, broadcast.
             (settings and analytics finally in one place)
REVENUE      MRR, plan mix, per-dealer billing. The only place money is stated.
SECURITY     Activity log, sessions, posture, errors, alerts. Unchanged - this
             one was already a clean functional group.
```

Plus, cutting across all of it: **one global search**.

### Suggested order

1. **P3 + P4** — Home with the merged review queue. Biggest daily relief, and it
   does not require touching any data layer.
2. **P7** — global search. Second-biggest relief per unit of work.
3. **P2 + P10** — collapse the duplicated metrics into REVENUE.
4. **P5 + P6** — one Accounts table, then the account record. Largest job; do it
   once the nav above has settled.
5. **P1 + P9** — retire the three-console split as the sections above absorb it.
6. **P11** — move the remaining inline tab bodies into `components/platform/`.

---

# Part 2 — Sellers and dealers management (the Dealers + Salesmen tabs)

Drill-down on P5/P6. Both tabs are now ONE: `src/components/platform/AccountsTab.jsx`.

## What each tab can actually do today

| | Dealers | Salesmen |
|---|---|---|
| Search | yes (`:1869`) | yes (`:1502`) |
| Status filter / sort | yes | **no** |
| Performance columns | listings, enquiries, team | **none** |
| Detail view | expandable row (`:1980`) | **none** |
| Inline edit | subdomain, status, trial end | subscription status |
| Verify badge control | yes (`:2014`) | **no** |
| Suspend | yes | yes |
| Delete | **no** | yes — hard delete (`:1590`) |

The two halves of one job were built to different standards, and the gaps are
not symmetrical in a safe direction: the paying account cannot be deleted, the
growth account can be destroyed in one click.

## CRITICAL

- [x] **A1 — "Delete" on a salesman irreversibly destroys their entire history.**
  `deleteSalesman` (`:563`) runs a raw `DELETE` on `profiles`. That FK cascades
  through ~50 tables — `car_listings`, `leads`, `lead_activities`, `customers`,
  `deal_financials`, `deal_products`, `chat_threads`, `whatsapp_enquiries`,
  `analytics_events`, `reviews`. For a standalone Lite/Premium seller
  `dealer_id IS NULL`, so they ARE their own dealer and every car they ever
  listed cascades away with them.
  It also destroys records that are the PLATFORM's, not theirs: sold-car rows
  feeding MRR and GP reporting, buyer reviews, and analytics history.
  The platform already has a designed deletion path this bypasses entirely —
  `delete-account` + `purge-deleted-accounts` edge functions, soft-delete via
  `account_status='deleted'` + `deleted_at`, with a 30-day recovery window
  (CLAUDE.md, and migration 20260815b treats `is_active=false OR
  account_status='deleted'` as the marketplace cut-off).
  Fix: the admin action should soft-delete through the same path, not
  `DELETE FROM profiles`.

- [x] **A2 — The delete can also fail silently and look like nothing happened.**
  Four FKs onto `profiles` are `NO ACTION`: `dealer_invites.accepted_by`,
  `profiles.approved_by`, `profiles.verified_by`, `profiles.plan_granted_by`.
  If that salesman ever accepted an invite or approved/verified anyone, the
  delete raises a FK error — and `deleteSalesman` only acts `if (!error)`, with
  no `else`. The modal stays open, nothing changes, nothing is reported.

## HIGH

- [x] **A3 — Dealer suspend never checks whether it worked.** `toggleSuspend`
  (`:551`) fires the update and calls `updateLocal` unconditionally — no error
  check, unlike `toggleSalesmanSuspend` (`:557`) which does check. If the write
  is rejected the row greys out and you believe the dealer is suspended while
  they are still trading.

- [x] **A4 — You cannot tell an active seller from a dead one.** The salesmen
  query (`:371`) fetches no counts at all — no listings, no enquiries, no sold.
  Dealers get `dealerStats`; salesmen get nothing. Lite sellers are the growth
  engine and the console cannot answer "which of them are actually using this?"
  Note the data already exists — `listing_count_cache` is read in the Approvals
  tab (`:1127`), just not here.

- [x] **A5 — Suspension captures no reason and notifies nobody.** One click,
  no note, no message. The seller sees `SuspendedBanner` and is told nothing.
  We just built preset rejection reasons for account review; suspension — which
  is harsher — has none.

- [x] **A6 — Salesmen have no verified-badge control** even though e-KYC now
  gives them a badge on their marketplace cards. `toggleVerified` (`:2014`)
  exists only for dealers. The only salesman path is the review queue.

## MEDIUM

- [x] **A7 — "Dealer ID" column shows a truncated raw UUID** (`:1634`,
  `sm.dealer_id?.slice(0, 12)`). Meaningless to a human and not clickable. It
  should be the dealership name, linking to that dealer.

- [x] **A8 — No navigation between the two tabs.** A dealer's `team` count
  (`:1953`) is inert text. Seeing a dealer's salesmen means switching tabs and
  eyeballing truncated UUIDs. This is P6 in its most concrete form.

- [x] **A9 — Billing-state edits auto-save on change with no confirm and no
  undo.** `subscription_status` (`:1930`) and `trial_ends_at` (`:1939`) write
  straight through on the change event. A misclick silently moves a dealer
  between trial/active/expired. There is an activity log but no undo.

- [x] **A10 — Salesman grouping is a filter expressed as fixed layout.**
  Standalone vs Under-Dealer are hard-coded sections (`:1507`, `:1607`). They
  cannot be collapsed, sorted or combined, and a third category has nowhere to
  go.

## How established consoles handle account management

- **Soft delete, always.** Stripe, Shopify and Intercom archive/cancel; they do
  not offer an operator a button that erases history. Where true deletion is
  offered (GDPR erasure) it is a separate, slower, logged flow — never a red
  button in a row. This is A1.
- **State changes are transitions, not field edits.** You "Cancel subscription"
  or "Extend trial", each logged with an actor and reason — you do not type into
  the billing state. This is A9.
- **One account record.** Everything about a customer on one page. This is A8.
- **Lifecycle is visible.** Real consoles show last-seen, last-active, usage —
  because the actual daily question is "is this account healthy?", which this
  console cannot currently answer for a salesman. This is A4.

## Suggested order

1. **A1 + A2** — make deletion safe. Highest risk, and one afternoon: route the
   admin action through the existing soft-delete path and surface the error.
2. **A3** — one-line error check; a silently-failed suspension is a trust bug.
3. **A4** — fetch salesman counts. Cheap, and it is the number you actually
   want when looking at that tab.
4. **A5 + A6** — reason on suspend, verify control for salesmen.
5. **A7 + A8** — resolve dealer names, make team and dealer links clickable.
6. **A9 + A10** — confirm on billing-state change; fold grouping into a filter.

The merged Accounts table (P5) and account record (P6) subsume A7, A8 and A10 —
so do those two while restructuring, not before.

### Deliberately NOT recommended

- Do not add tabs to fix findability. The problem is 17 destinations, not 16.
- Do not build per-role dashboards. There is one operator.
- Do not merge Security into the rest. It is genuinely a different job, is
  already coherent, and mixing audit surfaces into daily ops is how people stop
  reading them.
