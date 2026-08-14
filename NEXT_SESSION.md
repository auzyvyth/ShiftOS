# Next session — start here

## Where things are
- Branch: `claude/showroom-audit-issues-5x3wcx` (2 commits, pushed). NOT merged.
- A Vercel **preview** builds automatically for this branch — use it to review.
- Nothing is on staging or prod yet. Do not push to prod without the owner saying so.

## What shipped this session (Showroom audit — Issue 1 only)
Two root causes behind "search broke + showroom didn't detect my account":

1. **Listing-load recovery** (`346eceb`) — `src/lib/authRetry.js`, wired into
   `CarListingPage.jsx` (/showroom, /cars) and `MarketplacePage.jsx` (/).
   A stale/expired session token on the marketplace origin made PostgREST 401 the
   anon-readable `public_car_listings` read, and the grid swallowed it into
   "Failed to load listings". Now: on an auth error it refreshes the session, or
   drops the dead local token and retries anon, so listings always load. The bare
   `catch {}` now logs the real error.
   -> **Verifiable on the Vercel preview.** The two-word search ("honda civic")
   returns 4 real rows in the DB, so this is the fix for the reported failure.

2. **Cross-origin session** (`62f637e`) — `src/lib/sessionStorage.js`, wired via
   `supabaseClient.js` `auth.storage`. Session now lives in a cookie scoped to
   `.xdrive.my` (chunked, since a session can exceed the 4KB cookie cap) so every
   subdomain + the apex share ONE login.
   -> **CANNOT be verified on the preview** (`*.vercel.app` can't set a
   `.xdrive.my` cookie — it falls back to localStorage there, same as before).
   Only activates on real `xdrive.my`. Verify AFTER merge, on production.
   -> **No forced re-login**: first read migrates the existing localStorage
   session into the cookie.

### How to verify after merge (on production xdrive.my)
- Log in on the salesman panel / a subdomain, then open the public showroom on
  `xdrive.my` — you should already be recognized (saved searches + liked cars),
  and "Save search" should NOT bounce to the Google account picker.
- Confirm normal login / OAuth callback / dashboard / salesman panels still work
  (this touched the auth storage core).

### Known follow-up (not blocking)
- `src/lib/authHandoff.js` (token-in-URL cross-subdomain handoff) is now largely
  redundant for the xdrive.my family since the cookie is shared. Its stale-session
  purge (lines ~132-135) only clears localStorage, not the cookie — harmless
  (setSession overwrites the cookie), but worth simplifying/reviewing later. Still
  needed for shiftos.com <-> xdrive.my (different domains).

## Still open from the audit (Issues 2 & 3 — not started)
Owner said do Issue 1 first. These are documented and diagnosed:

- **Issue 3 (Low, easiest win): admin shows deleted accounts as "Suspended".**
  `AdminPage.jsx` labels purely `is_active === false ? "Suspended" : "Active"` and
  never reads `account_status`. Live data: 1 profile is `account_status='deleted'`
  (shows as Suspended), 6 are genuinely suspended. Fix: read `account_status` /
  `deleted_at` and render a distinct "Deleted (purges in N days)" state. Isolated,
  ~20 min. Data-still-available is by design (LITE-3 soft delete + 30-day purge).

- **Issue 2 (Medium): enquiry/booking phone-dedup is unbounded.** The reported
  faris case was actually CORRECT (no data loss — the enquiry lead was promoted to
  viewing_booked, so it just moved out of the "new" column). The real latent risk:
  DB dedup functions `enquiry_to_lead`, `create_lead_from_whatsapp`,
  `create_lead_from_booking` match by phone alone, dealer-wide, newest lead, with
  NO stage guard and NO time window — so a brand-new enquiry from a repeat number
  can fold into an old `won`/`lost` lead (lost opportunity), and
  `create_lead_from_booking` overwrites `car_listing_id`/`notes` on merge. The
  frontend `autoUpsertLeadFromAppt` (Salesmanpanel.jsx) already added the right
  guard (name-match + single-lead) — port that safety into the DB functions.

## Deploy flow reminder (from CLAUDE.md)
- local main -> `git push origin main:staging --force` -> Vercel preview -> owner OK
- prod: temp branch -> PR (base main) -> squash merge -> reset local main. Only on
  explicit "push to prod". This session used the assigned feature branch instead of
  main:staging, per the task's branch instructions — its own Vercel preview covers review.
