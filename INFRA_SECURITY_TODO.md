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

- [ ] **Audit log for privileged actions.** No `audit_logs` table exists. Log who/what/when
      (+ old/new) for: role changes, price/commission edits, listing publish/unpublish, mark-sold,
      document access. Separate table, RLS readable by superadmin only. Matters more as team roles grow.

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

## Explicitly NOT doing (and why)
- Kubernetes / containers / ECS — Vercel already gives stateless autoscaling.
- Kafka / RabbitMQ / SQS — no high-volume async pipeline yet; Supabase + Edge Functions cover it.
- Circuit breakers / service mesh / multi-region active-active — single-region Vercel+Supabase is
  correct at this scale; revisit only when a real availability SLA demands it.
- Elasticsearch / Typesense — Postgres full-text + indexes are fine until search is a proven bottleneck.
- OpenTelemetry distributed tracing — Sentry tracing already covers the app; OTel adds ops burden for
  no current gain given there is no multi-service backend to trace across.
