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

| Console | Defined | Tabs |
|---|---|---|
| ShiftOS Ops | `AdminPage.jsx:656` | Dealers, Salesmen, Verify, Approvals, Waitlist, Platform Stats, Marketplace, Billing |
| XDrive Ops | `AdminPage.jsx:673` | Funnel, Engagement, Buyers, Broadcast |
| Security | `AdminPage.jsx:680` | Activity Log, Sessions, Posture, Errors, Alerts |

Landing point: console `shiftos` (`:179`), tab `dealers` (`:175`) — a browse table.

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

- [ ] **P1 — Mixed taxonomy at the top level.** Product-split and function-split
  side by side (`:667`). Pick ONE. Recommended: split by what you are doing
  (work / people / product / money / safety), because that is how the day
  actually runs — you do not sit down to "do XDrive", you sit down to clear
  approvals.

- [ ] **P2 — The same numbers are rendered on three different tabs.**
  Total / Active / Trial / Expired / MRR appear on Dealers (`:1861`),
  Platform Stats (`:1467`) and Billing (`BillingTab`, `:71`, as plan chips with
  per-plan MRR). Three surfaces, one truth, no indication which is canonical.
  This is the same "two things that should be one" failure the dealer-dashboard
  audit is full of. Fix: MRR and subscription mix live in exactly one place.

- [ ] **P3 — No "what needs me right now" home.** The console opens on Dealers,
  a directory. The actual daily job is the two queues. An operator should never
  have to go looking for their own work — it should be the first thing rendered.

## HIGH

- [ ] **P4 — The daily work is split across two vaguely-named tabs.** "Verify"
  (accounts) and "Approvals" (listings) — neither name says what it holds, and
  since the e-KYC change Verify now holds two different kinds of item (signups
  and ID checks). One review queue, filterable by type, is one habit instead of
  three.

- [ ] **P5 — Accounts are split into two tables by role.** Dealers (`:1857`) and
  Salesmen (`:1497`) are separate tabs with separate search boxes and separate
  filters. They are the same object with a different `role`. Standard practice is
  one Accounts table with a role filter.

- [ ] **P6 — The console is tab-oriented, not object-oriented.** This is the
  biggest structural gap versus professional tooling. To understand ONE dealer
  today you visit Dealers (who they are), Billing (what they pay), Approvals
  (what they submitted) and Activity Log (what they did) — four tabs, four
  searches, and you assemble the picture in your head. There is no dealer record.

- [ ] **P7 — Three separate search boxes, no global search.** Waitlist (`:1376`),
  Salesmen (`:1502`), Dealers (`:1869`). Nothing searches across object types, so
  finding "that guy who emailed me" means guessing which tab he is in first.

## MEDIUM

- [ ] **P8 — Flat tab strip gives launch-era and daily surfaces equal weight.**
  Waitlist sits beside Approvals as though they matter equally. They do not.

- [ ] **P9 — Analytics scattered across three tabs in two consoles.** Platform
  Stats (ShiftOS) vs Funnel and Engagement (XDrive). No stated boundary between
  them.

- [ ] **P10 — "Platform Stats" is a name that means nothing.** Every tab in a
  platform console is platform stats. Name surfaces after the decision they
  support (Revenue, Growth), not after the data they contain.

- [ ] **P11 — `AdminPage.jsx` is 2,052 lines** holding eight tab bodies inline
  while the other nine live in `src/components/platform/`. Two conventions in one
  file. The inline ones are the ones that duplicated their stat cards.

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

### Deliberately NOT recommended

- Do not add tabs to fix findability. The problem is 17 destinations, not 16.
- Do not build per-role dashboards. There is one operator.
- Do not merge Security into the rest. It is genuinely a different job, is
  already coherent, and mixing audit surfaces into daily ops is how people stop
  reading them.
