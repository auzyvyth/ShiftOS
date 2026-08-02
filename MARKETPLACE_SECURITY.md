# Marketplace Security Review + Secure-Marketplace Playbook

Date: 2026-08-02. Scope: the public XDrive marketplace surface (anonymous +
buyer-authenticated), its data exposure, its public write/abuse vectors, and a
build roadmap benchmarked against Carlist.my / Mudah.my. Read alongside
`AUDIT_DEALER_DASHBOARD.md` (internal dashboard) — this doc is the *public-facing*
counterpart.

Method: read `pg_policies`, table/column grants, RLS helper + rate-limit
function bodies, edge-function auth gating, Supabase security advisors, and the
public React surfaces (HomePage, CarDetailPage, ContactGate, App routes).

---

## TL;DR — what you are NOT controlling that you should be

1. **[HIGH] Any logged-in account can read every dealer's cost, margin & commission.**
   The public marketplace read policy `public_read_listings` on `car_listings` is
   granted to `{public}` (= anon **and** authenticated) and `authenticated` still
   holds table-level `SELECT`. The curated `public_car_listings` VIEW correctly
   hides financials — but only anon is forced through it. A free buyer account can
   query the **base table** directly and pull `purchase_price`, `recon_cost`,
   `commission_amount`, `my_commission`, `gross_profit`, `sold_price`,
   `admin_notes` for every active/sold car, every dealer.
2. **[HIGH] Buyer "car hunt" PII is world-readable + the intake is unthrottled.**
   `car_hunts` exposes `hunter_name / hunter_phone / hunter_email / budget` to
   anyone (anon SELECT on `status='active'`), and "Anyone can create a hunt"
   (INSERT `WITH CHECK true`) has no rate limit or validation. Lead-harvesting +
   spam vector.
3. **[MED-HIGH] Staff invite codes are enumerable.** `dealer_invites_public_select_by_code`
   returns **all** unused, unexpired invites (`code`, `email`, `invited_name`,
   `dealer_id`) — it is not filtered to a supplied code. Anyone can list pending
   staff invites platform-wide; if redemption trusts the code alone, that is an
   account-takeover path, and either way it is a PII leak.
4. **[MED] Weak share-token access on `workshop_jobs`.** Anon `SELECT` **and**
   `UPDATE` are gated only by `length(share_token) > 10`, with no format/entropy
   constraint (contrast the loan token, which requires a 36-char UUID). If tokens
   are short or guessable, anyone can read customer PII and tamper with job
   status/price.
5. **[MED] Lead-spam protection is bypassable by design.** All rate limits are
   DB-only and keyed on a client-supplied identifier with a null-bypass:
   `leads_public_rate_ok` returns `true` when phone is null — and `ContactGate`
   always sends phone `null`; `whatsapp_enquiry_rate_ok` returns `true` on null
   session. `create_lead_from_whatsapp` only *dedupes* (name+car/24h), so varying
   the name floods any dealer's pipeline. There is **no CAPTCHA / proof-of-human
   anywhere** in the codebase.
6. **[MED] `error_logs` unbounded public insert (`WITH CHECK true`).** No rate
   limit; JSONB `context/metadata`. Storage-exhaustion + log-poisoning — and
   INFRA-1 already notes storage is full.
7. **[LOW] `waitlist_signups` unthrottled anon insert; `anon` holds stray
   INSERT/UPDATE grants on `car_listings`** (RLS blocks them today, but it is a
   least-privilege violation); 4 functions with mutable `search_path`; one
   extension in `public`.
8. **[PLATFORM] Already tracked in TODO — still open:** ACT-1 TOTP not enabled,
   ACT-2 full 2FA enforcement (aal2 RLS), ACT-6 leaked-password protection off,
   ACT-7 PKCE flow. These are real and belong on this list.

## What you ARE already controlling well (so we do not regress it)

- RLS enabled across the schema; tenant isolation via `get_my_dealer_id()` mirrored
  client + DB; helper functions marked `STABLE`.
- Curated `public_car_listings` VIEW hides cost/commission from anonymous
  visitors; `anon` `SELECT` grant on the base table is revoked.
- `profiles` upsert carries a no-privilege-escalation `CHECK` (cannot self-promote
  to `superadmin`).
- Edge functions are auth + role gated: `ai-proxy` requires a valid user (no open
  Claude-cost abuse); `import-drive-images` is JWT + dealer/owner/superadmin gated
  and SSRF-proofed (only a Drive file id is used against googleapis.com).
- Main public writes (leads, appointments, enquiries, bookings, analytics) DO
  carry rate-limit + `is_dealer_active` gating and event-type/format allowlists.
- No `service_role` key in the frontend bundle; auth token handoff via URL hash;
  24h idle logout; hardened `activity_log` INSERT; stock-import input hardening
  (magic-byte sniff, formula-injection strip, LLM prompt-injection guard).

---

## Fixes, in priority order (propose — do NOT ship blind; these are RLS changes)

**F1 — Close the margin/commission leak (do first).**
Restrict the marketplace read to anonymous only, and force authenticated browsing
through the view. Verify first that every "browse other dealers" read in the app
uses `public_car_listings` (not the base table) before shipping.
- Option A (surgical): `ALTER POLICY public_read_listings ON car_listings TO anon;`
  Dealers/salesmen keep their own-row policies; buyers read the view.
- Option B (defence in depth): also `REVOKE SELECT ON car_listings FROM authenticated;`
  and grant column-scoped SELECT, or move all public reads to the view + RPCs.
- Then confirm the view stays curated on every future `ALTER TABLE` (already a
  CLAUDE.md rule).

**F2 — `car_hunts`:** replace the blanket public SELECT with a narrow
`get_active_hunts()` RPC that returns only non-PII fields (brand/model/budget
band), keep contact behind a dealer-authenticated path; add a rate-limit function
to the INSERT (mirror `leads_public_rate_ok`) + basic field validation.

**F3 — `dealer_invites`:** drop `dealer_invites_public_select_by_code`; replace
with `redeem_invite(p_code text)` SECURITY DEFINER RPC that looks up the single
row by exact code and returns only what redemption needs. Never expose the code
list.

**F4 — `workshop_jobs`:** require a UUID-format `share_token` (mirror
`loan_share_token_update`), and drop anon `UPDATE` to the minimum the customer flow
needs (or move status changes behind an RPC). Confirm tokens are generated as
`gen_random_uuid()`.

**F5 — Lead-spam:** (a) add a per-session/IP throttle that does **not** null-bypass;
(b) add a CAPTCHA/Cloudflare Turnstile challenge to `ContactGate` and hunt/enquiry
forms; (c) make `create_lead_from_whatsapp` rate-limit, not just dedupe.

**F6 — `error_logs`:** add a rate-limit function to the INSERT policy + size caps
on the JSONB columns, or route client errors through an edge function that
throttles.

**F7 — Hygiene:** revoke stray `anon` INSERT/UPDATE on `car_listings`; set
`search_path` on the 4 flagged functions; enable ACT-1/2/6 in the Supabase
dashboard; schedule the ACT-7 PKCE migration.

---

## Benchmark: what a secure marketplace like Carlist / Mudah actually controls

These platforms treat trust & safety as a product surface, not just infra. The
control domains you will need as you open the marketplace to public sellers:

**1. Identity & seller verification.** Carlist verifies every seller and their
sales records; dealers are onboarded against business identity (SSM/business
registration). Build: dealer KYC (SSM number + doc upload + manual/there-party
verification), a visible "Verified Dealer" badge (you already have
`dealer_is_verified` / `docs_verified` columns — wire them to a real verification
workflow, not a self-serve flag), and phone/email OTP verification before a
listing goes live.

**2. Listing moderation.** New/edited listings should enter a `pending` state and
be screened (auto rules + human/AI review) before public display — for stolen-car
plates, duplicate/undercut-price scams, off-platform contact stuffing, and banned
content. You currently publish on insert. Add a moderation queue + an appeal path.

**3. Contact protection & anti-scraping.** Carlist/Mudah keep buyer↔seller contact
inside the platform (in-app chat, number masking) rather than exposing raw phone
numbers that scrapers harvest. Your `ContactGate` hands off straight to WhatsApp
(raw number). Consider: masked/relay numbers, an in-app enquiry thread, and
rate-limited/authenticated contact reveal so competitors can't scrape every
dealer's line.

**4. Fraud & scam defence.** Mirror Carlist's public scam-awareness playbook
(suspiciously low prices, deposit-before-viewing, fake-inspection, imported-doc
fraud) with in-product signals: price-anomaly flags, "never pay a deposit before
viewing" interstitials, a **Report Listing** button on every card (you have
`ReportBugButton` — add a listing-report table + moderation), and seller-history
transparency.

**5. Bot / abuse layer.** CAPTCHA (Turnstile/hCaptcha) on every public write;
edge/WAF rate limiting by IP (Vercel/Cloudflare), not just DB-by-identifier;
account-age + velocity checks on new sellers.

**6. Data protection (PDPA 2024, in force from 2025).** You are a data controller
holding buyer + seller PII. Obligations now include: **72-hour breach
notification** to the Commissioner (and affected individuals on significant harm),
a named **Data Protection Officer**, data-portability rights, and fines up to
**RM1,000,000** / 3 years imprisonment. Action: appoint a DPO, write a breach
runbook, minimise PII in public reads (F1–F3 directly serve this), and keep your
privacy policy current. Refs:
[Mayer Brown — PDPA amendments](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines),
[DLA Piper — DBN & DPO guidelines](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/),
[PDP Department (official)](https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-amendment-act-2024/).

**7. Payments / deposits.** If you ever hold deposits, use an escrow/PSP — never
custody funds directly; show anti-fraud guidance at the money step. Carlist's scam
guide: [Avoid Scammers — Carlist.my](https://www.carlist.my/news/avoid-scammers-watch-out-for-these-common-tactics-61948/61948/).

### The non-negotiable rules (pin these)
- Public reads go through a **curated VIEW or RPC**, never the base table. Every
  new column is private by default.
- Every public **write** is CAPTCHA-gated **and** server-rate-limited on an
  identifier the client cannot rotate or null out.
- PII (phone/email/IC/address) is never in an anon- or broadly-authenticated read
  path; contact is mediated, masked, or authenticated.
- New listings and new sellers are **untrusted until verified/moderated**.
- Least privilege on grants; RLS is the gate, the frontend filter is convenience.
- Have a breach runbook + DPO before you scale PII volume (PDPA).
