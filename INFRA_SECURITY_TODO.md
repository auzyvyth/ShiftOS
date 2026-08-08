# Infra & Security TODO (filtered from external audit)

Context: an external AI audit (Grok) reviewed xdrive.my. This file keeps only the
items that are (a) genuinely missing and (b) appropriate for a Vercel + Vite/React +
Supabase serverless stack. Generic enterprise advice that does NOT apply to us
(Kubernetes, Kafka/RabbitMQ, circuit breakers, service mesh, multi-region active-active,
self-managed PgBouncer, Elasticsearch) has been dropped on purpose — adding it now is
tech debt, not resilience.

## Already done (do NOT redo — verified in repo/DB on 2026-08-07)
- RLS enabled on every public table (Supabase security advisor: 0 `rls_disabled_in_public`).
- Rate limiting: Upstash + `middleware.js` on 6 public endpoints (enquiry, whatsapp-lead,
  booking, waitlist, ai-messages, car-specs).
- Bot protection: Cloudflare Turnstile on enquiry + whatsapp-lead (`lib/turnstile.js`).
- Error tracking: Sentry (`src/instrument.js`) with tracing + session replay.
- XSS: only one `dangerouslySetInnerHTML` (DashboardPage doc print) and it is DOMPurify-sanitized.
- No `service_role` key anywhere in `api/` or `src/` bundles.
- IDOR-safe public APIs: `enquiry.js`/`booking.js` re-derive `dealer_id` from the DB row,
  never trust the client body.
- Vercel Analytics + Speed Insights, hashed immutable assets, HSTS, robots walls internal routes.
- CI (lint + build) on every PR.

## HIGH — do first (low effort, real exposure)

- [ ] **Security response headers.** `vercel.json` only sets Cache-Control. Add to the
      `headers` block (source `/(.*)`):
      `Content-Security-Policy` (start report-only, then enforce),
      `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'`,
      `X-Content-Type-Options: nosniff`,
      `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
      CSP must allow `*.supabase.co` (connect/img) and `wss://*.supabase.co`.

- [ ] **Sentry PII leak via Session Replay.** `sendDefaultPii: true` + `replaysSessionSampleRate: 0.1`
      with no masking captures buyer PII (phone, IC, loan amounts, prices) off the dealer dashboard.
      Set `maskAllText` / `blockAllMedia` on the replay integration (or disable replay on
      authenticated routes), and reconsider `sendDefaultPii`.

- [ ] **Enable leaked-password protection.** Supabase advisor flags `auth_leaked_password_protection`
      is OFF. One toggle in Auth settings (HaveIBeenPwned check). No code.

## MEDIUM

- [ ] **`public_car_listings` SECURITY DEFINER view.** Advisor ERROR: the view runs as owner and
      bypasses the caller's RLS. It is the public marketplace read surface so this may be intended,
      but confirm it exposes ONLY public columns (no PII/cost columns), or set `security_invoker=on`.

- [ ] **Verify private storage for documents.** Confirm buyer docs (IC, geran, contracts,
      dealer_documents) live in a PRIVATE bucket served via short-lived signed URLs — NOT in the
      public `car-images` bucket. Path convention `dealer_id/...` so policies can enforce ownership.

- [ ] **Audit log** — see dedicated "Activity log / user-session forensics" section below.
      (Correction: an `activity_log` table already EXISTS and works; the work is hardening it,
      not building it.)

- [ ] **Server-side payload validation (Zod).** Not installed (0 refs). `api/` routes validate
      ad-hoc. Add Zod schemas to enquiry/booking/waitlist/whatsapp-lead/ai-messages payloads as
      defense-in-depth (RLS + DB CHECKs already catch a lot, so this is hardening, not a hole).

- [ ] **Dependency scanning in CI.** CI runs lint+build only. Add `npm audit --audit-level=high`
      (non-blocking to start) and/or enable Dependabot. Low effort.

## LOW / revisit later

- [ ] **RLS-enabled-no-policy tables** (`auth_login_throttle`, `plan_config`). Currently deny-all
      (safe). Confirm they are intentionally server/service-role-only; otherwise add explicit policies.
- [ ] **~200 SECURITY DEFINER functions executable by anon/authenticated** (advisor WARN, mostly the
      `get_my_dealer_id`/`is_*` helper family — expected). Spot-check that none MUTATE data or leak
      cross-tenant rows when called directly with the anon key.
- [ ] **Image optimization pipeline.** Car images served direct from Supabase Storage with no resize.
      Add Supabase image transformations (or Vercel image optimization) for thumbnails when traffic/egress grows.
- [ ] **Backup / restore drill.** Document the Supabase recovery plan and actually test a restore
      (or PITR) once. Do not assume backups work untested.
- [ ] `extension_in_public` + `materialized_view_in_api` advisor hygiene notes — cosmetic, batch later.

## Activity log / user-session forensics

Verified against the live DB (project lemdkdizdlcirhbzqlos) on 2026-08-08.

### What already exists (do NOT rebuild)
- `public.activity_log` — 1,367 rows, live (newest entry 3 days old), spanning 2026-05-18 to now.
  Columns: `id, dealer_id, actor_id, actor_name, actor_role, table_name, record_id, action,
  field_changes(jsonb), summary, is_anomaly, anomaly_reason, created_at`.
- Written SERVER-SIDE by DB triggers (correct, tamper-resistant pattern):
  `log_dealer_activity`, `approve_listing`, `reject_listing`, `set_listing_docs_verified`,
  `gm_exception_alerts`.
- RLS enabled; read scoped to own dealer + superadmin.
- Purpose-built actions (approved, assigned, marked_sold, prices_updated, status_changed,
  issued, docs_verified, encumbrance_updated, settings_updated) capture the actor at 0% null.
- Supabase `auth.sessions` already stores `ip`, `user_agent`, `aal`, `refreshed_at` per session.

### The three defects to fix

- [ ] **1. Capture session/device context (the missing "session id and stuff") — HIGH.**
      `activity_log` has no `session_id`, `ip`, or `user_agent`, so an action can't be tied to a
      login session or device/location. Fix:
      - `ALTER TABLE public.activity_log ADD COLUMN session_id uuid, ADD COLUMN ip text,
        ADD COLUMN user_agent text;`
      - Populate inside the triggers from context already available server-side — no client change:
        - `session_id := (auth.jwt() ->> 'session_id')::uuid`  (every Supabase access token carries
          this claim; it is the PK of `auth.sessions`).
        - `ip := current_setting('request.headers', true)::json ->> 'x-forwarded-for'`
        - `user_agent := current_setting('request.headers', true)::json ->> 'user-agent'`
      - Result: `activity_log.session_id` joins directly to `auth.sessions.id` for full
        who/what/when/where/which-device forensics.

- [ ] **2. Lock the table to append-only + un-forgeable — HIGH (integrity hole).**
      Current grants are far too broad: `authenticated` holds INSERT/UPDATE/DELETE/**TRUNCATE**;
      `anon` holds INSERT/UPDATE/SELECT. RLS blocks per-row UPDATE/DELETE (no policy) but
      **TRUNCATE is not governed by RLS** — a logged-in user with any direct SQL path could wipe
      the whole log. Also the INSERT policy only checks `dealer_id`, NOT `actor_id = auth.uid()`,
      so entries are forgeable within one's own dealer. Fix:
      - `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.activity_log FROM authenticated;`
      - `REVOKE ALL ON public.activity_log FROM anon;`
      - Keep only `SELECT` for `authenticated` (RLS already scopes it). All writes go through the
        `SECURITY DEFINER` triggers only.
      - If any legitimate client-side insert path remains, add `actor_id = auth.uid()` to its
        `WITH CHECK`. No UPDATE/DELETE policies at all → immutable by construction.

- [ ] **3. Fix the null-actor catch-all — MEDIUM.**
      `log_dealer_activity` on generic create/delete/update leaves `actor_id` NULL 88% (delete) /
      83% (create) of the time, because it fires in service-role / cascade / trigger-chain contexts
      where `auth.uid()` is NULL. Fix: when `auth.uid()` is NULL, stamp `actor_role = 'system'`
      (and a source tag) instead of a blank actor, so "unknown" is distinguishable from
      "system-initiated". Where a real user is behind a cascade, thread the actor through explicitly.

### Related, lower priority
- [ ] **Durable login history — LOW.** `auth.audit_log_entries` is empty (0 rows for 25 users) and
      `auth.sessions` holds only CURRENT sessions, so there is no retained login/logout history.
      If forensic login history matters, capture auth events yourself (Supabase auth hook, or a
      daily snapshot of `auth.sessions` into an owned table). Skip until compliance requires it.
- [ ] **Retire `error_logs` — LOW.** 3 rows, redundant with Sentry. Drop it or route to Sentry.

## Explicitly NOT doing (and why)
- Kubernetes / containers / ECS — Vercel already gives stateless autoscaling.
- Kafka / RabbitMQ / SQS — no high-volume async pipeline yet; Supabase + Edge Functions cover it.
- Circuit breakers / service mesh / multi-region active-active — single-region Vercel+Supabase is
  correct at this scale; revisit only when a real availability SLA demands it.
- Elasticsearch / Typesense — Postgres full-text + indexes are fine until search is a proven bottleneck.
- OpenTelemetry distributed tracing — Sentry tracing already covers the app; OTel adds ops burden for
  no current gain given there is no multi-service backend to trace across.
