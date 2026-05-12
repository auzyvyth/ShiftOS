/**
 * notify-price-alerts
 *
 * Runs on a schedule (every 30 min via pg_cron or Supabase cron).
 * For each active price_alert, finds car_listings created since the
 * alert was last notified, checks the filter match, and sends one
 * digest email per user via Resend.
 *
 * Secrets needed (set via `supabase secrets set`):
 *   RESEND_API_KEY   — your Resend API key
 *   SITE_URL         — https://xdrive.my  (no trailing slash)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL       = Deno.env.get('SITE_URL') ?? 'https://xdrive.my';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Service-role client bypasses RLS so we can read all active alerts + listings
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return 'RM ' + n.toLocaleString('en-MY');
}

function matchesAlert(car: Record<string, unknown>, alert: Record<string, unknown>): boolean {
  if (alert.brand     && (car.brand as string)?.toLowerCase()     !== (alert.brand as string)?.toLowerCase())     return false;
  if (alert.model     && (car.model as string)?.toLowerCase()     !== (alert.model as string)?.toLowerCase())     return false;
  if (alert.variant   && !(car.variant as string)?.toLowerCase().includes((alert.variant as string)?.toLowerCase())) return false;
  if (alert.body_type && (car.body_type as string)?.toLowerCase() !== (alert.body_type as string)?.toLowerCase()) return false;
  if (alert.state     && (car.state as string)?.toLowerCase()     !== (alert.state as string)?.toLowerCase())     return false;
  if (alert.condition && (car.condition as string)?.toLowerCase() !== (alert.condition as string)?.toLowerCase()) return false;
  if (alert.max_price && Number(car.selling_price) > Number(alert.max_price)) return false;
  if (alert.min_year  && Number(car.year) < Number(alert.min_year))           return false;
  if (alert.max_year  && Number(car.year) > Number(alert.max_year))           return false;
  return true;
}

function buildEmailHtml(cars: Record<string, unknown>[], alert: Record<string, unknown>): string {
  const filterDesc = [
    alert.brand,
    alert.model,
    alert.variant,
    alert.body_type,
    alert.state,
    alert.condition,
    alert.max_price ? `≤ ${fmt(Number(alert.max_price))}` : null,
    alert.min_year  ? `From ${alert.min_year}` : null,
  ].filter(Boolean).join(' · ') || 'All cars';

  const showroomUrl = (() => {
    const p = new URLSearchParams();
    if (alert.brand)     p.set('brand',     alert.brand as string);
    if (alert.model)     p.set('model',     alert.model as string);
    if (alert.variant)   p.set('variant',   alert.variant as string);
    if (alert.body_type) p.set('body_type', alert.body_type as string);
    if (alert.state)     p.set('state',     alert.state as string);
    if (alert.condition) p.set('condition', alert.condition as string);
    if (alert.max_price) p.set('max_price', String(alert.max_price));
    if (alert.min_year)  p.set('year_from', String(alert.min_year));
    if (alert.max_year)  p.set('year_to',   String(alert.max_year));
    return `${SITE_URL}/showroom?${p.toString()}`;
  })();

  const carRows = cars.map(c => {
    const name  = [c.year, c.brand, c.model, c.variant].filter(Boolean).join(' ');
    const price = c.selling_price ? fmt(Number(c.selling_price)) : 'P.O.R';
    const slug  = c.slug || c.id;
    const link  = `${SITE_URL}/showroom/${slug}`;
    const img   = Array.isArray(c.images) && c.images[0] ? c.images[0] : null;
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          ${img ? `<img src="${img}" alt="${name}" width="80" height="60" style="object-fit:cover;border-radius:6px;float:left;margin-right:14px;"/>` : ''}
          <div>
            <a href="${link}" style="font-size:14px;font-weight:700;color:#111827;text-decoration:none;">${name}</a><br/>
            <span style="font-size:13px;color:#dc2626;font-weight:700;">${price}</span>
            ${c.mileage ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">${Number(c.mileage).toLocaleString('en-MY')} km</span>` : ''}
            ${c.state   ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">${c.state}</span>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:'Outfit',Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#111827;padding:20px 24px;">
      <span style="color:#dc2626;font-size:20px;font-weight:800;letter-spacing:-0.03em;">XDrive</span>
      <span style="color:#6b7280;font-size:13px;margin-left:8px;">Price Alert</span>
    </div>
    <div style="padding:24px;">
      <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 4px;">
        ${cars.length} new listing${cars.length > 1 ? 's' : ''} match your search
      </h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">
        Filter: <strong>${filterDesc}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;">${carRows}</table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${showroomUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">
          View all matching cars →
        </a>
      </div>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        You're receiving this because you saved a search on XDrive.<br/>
        <a href="${SITE_URL}/showroom" style="color:#9ca3af;">Manage your alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'XDrive Alerts <alerts@xdrive.my>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Allow cron invocations and manual POST triggers
  // Reject if no service key header (basic guard against public invocation)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Fetch all active alerts
    const { data: alerts, error: alertErr } = await db
      .from('price_alerts')
      .select('*')
      .eq('is_active', true);

    if (alertErr) throw alertErr;
    if (!alerts?.length) return new Response(JSON.stringify({ sent: 0, reason: 'no_active_alerts' }), { status: 200 });

    // 2. Fetch listings created in the last 35 min (overlaps 30-min cron with buffer)
    const since = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const { data: newCars, error: carErr } = await db
      .from('car_listings')
      .select('id,slug,brand,model,variant,year,selling_price,mileage,state,condition,body_type,images,created_at')
      .eq('status', 'available')
      .gte('created_at', since);

    if (carErr) throw carErr;
    if (!newCars?.length) return new Response(JSON.stringify({ sent: 0, reason: 'no_new_listings' }), { status: 200 });

    // 3. Group alerts by user email to send one digest per user
    const emailBuckets = new Map<string, { alert: Record<string, unknown>; matches: Record<string, unknown>[] }[]>();

    for (const alert of alerts) {
      const matches = newCars.filter(car => matchesAlert(car, alert));
      if (!matches.length) continue;

      // Skip if this alert was notified in the last 25 min (dedup guard)
      if (alert.last_notified_at) {
        const lastNotified = new Date(alert.last_notified_at).getTime();
        if (Date.now() - lastNotified < 25 * 60 * 1000) continue;
      }

      const bucket = emailBuckets.get(alert.email) ?? [];
      bucket.push({ alert, matches });
      emailBuckets.set(alert.email, bucket);
    }

    // 4. Send one email per user, update last_notified_at
    let sent = 0;
    const updateIds: string[] = [];

    for (const [email, buckets] of emailBuckets) {
      // Flatten all matches for this user into a single email (deduplicated by id)
      const allMatches = [...new Map(buckets.flatMap(b => b.matches).map(c => [c.id, c])).values()];
      const subject = `${allMatches.length} new car${allMatches.length > 1 ? 's' : ''} match your XDrive alert`;

      // Use the first alert's filter for the email description (most users have 1)
      const primaryAlert = buckets[0].alert;

      try {
        await sendEmail(email, subject, buildEmailHtml(allMatches, primaryAlert));
        sent++;
        updateIds.push(...buckets.map(b => b.alert.id as string));
      } catch (e) {
        console.error(`Failed to send to ${email}:`, e);
      }
    }

    // 5. Bulk-update last_notified_at for all alerted IDs
    if (updateIds.length) {
      await db
        .from('price_alerts')
        .update({ last_notified_at: new Date().toISOString() })
        .in('id', updateIds);
    }

    return new Response(JSON.stringify({ sent, newCars: newCars.length, alerts: alerts.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('notify-price-alerts error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
