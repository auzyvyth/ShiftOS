/**
 * notify-chat-unread
 *
 * "Ali sent you a message" — emails a buyer when a seller's reply has sat
 * unread. This is the half of chat notifications that survives the buyer
 * closing the tab; push only reaches a device that granted permission and is
 * still around, and most buyers here start as guests.
 *
 * Runs on pg_cron. Secrets (same ones notify-price-alerts already uses):
 *   RESEND_API_KEY, SITE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (optional)
 *
 * Rules baked in, do not "simplify" them away:
 *  - Quotes `body_ai`, NEVER `body`. Anything leaving the app goes through the
 *    same redaction as the AI paths, so a phone number cannot land in an inbox.
 *  - Every email carries a working unsubscribe link. An unread-nag with no
 *    opt-out is what gets alerts@xdrive.my marked as spam, which would take the
 *    price alerts down with it.
 *  - GRACE_MIN: a reply is only "unread" if it has been sitting a while. Without
 *    it we email someone who is still looking at the conversation.
 *  - One email per BUYER, not per thread. Two cars, one person, one email.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL       = Deno.env.get('SITE_URL') ?? 'https://xdrive.my';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET    = Deno.env.get('CRON_SECRET') ?? '';

const GRACE_MIN = 15;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Row = {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  salesman_id: string | null;
  dealer_id: string | null;
  buyer_unread: number;
  last_message_at: string;
};

function buildHtml(
  sellerName: string,
  items: { car: string; preview: string; seller: string }[],
  unsubUrl: string,
  // True when this recipient typed their address into the anon chat box
  // (profiles.notify_email) rather than owning a real, signed-in account
  // (profiles.email). They read the reply here either way, but this is the
  // one nudge to turn "a guest who left an address" into an actual account —
  // saved chats, saved cars, one inbox instead of a fresh guest each visit.
  showSignup: boolean,
) {
  const rows = items.map(it => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb">
      <p style="margin:0 0 4px;font:600 14px system-ui,sans-serif;color:#111827">${esc(it.seller)}</p>
      <p style="margin:0 0 6px;font:400 12px system-ui,sans-serif;color:#6b7280">${esc(it.car)}</p>
      <p style="margin:0;font:400 14px system-ui,sans-serif;color:#374151;line-height:1.55">${esc(it.preview)}</p>
    </td></tr>`).join('');

  const signupBlock = showSignup ? `
      <p style="margin:18px 0 0;font:400 12px system-ui,sans-serif;color:#6b7280;line-height:1.6">
        Reading this as a guest —
        <a href="${SITE_URL}/buyer-signup" style="color:#dc2626;font-weight:600">sign up as a buyer</a>
        to keep every chat and saved car in one place.
      </p>` : '';

  return `<!doctype html><html><body style="margin:0;background:#f9fafb;padding:24px 12px">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px">
    <tr><td>
      <p style="margin:0 0 16px;font:700 17px system-ui,sans-serif;color:#111827">
        ${esc(sellerName)} sent you a message
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="margin:20px 0 0">
        <a href="${SITE_URL}/account/messages"
           style="display:inline-block;padding:11px 20px;border-radius:9px;background:#dc2626;color:#fff;font:700 14px system-ui,sans-serif;text-decoration:none">
          Open the chat to reply
        </a>
      </p>
      ${signupBlock}
      <p style="margin:22px 0 0;font:400 11px system-ui,sans-serif;color:#9ca3af;line-height:1.6">
        You are getting this because you asked us to tell you when a seller replies on XDrive.
        <a href="${unsubUrl}" style="color:#9ca3af">Turn these emails off</a>.
      </p>
    </td></tr>
  </table></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'XDrive <alerts@xdrive.my>', to, subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  // verify_jwt is false (this is a cron target, same as notify-price-alerts),
  // so the check happens here — and it is MANDATORY, not "only if a secret
  // happens to be set". An unauthenticated caller could otherwise fire the
  // whole queue at will.
  //
  // The key is checked against what pg_cron actually sends, via a SQL function
  // that answers yes/no and never returns the secret. The CRON_SECRET edge
  // secret the other cron functions guard on is NOT set on this project, so
  // their `if (CRON_SECRET)` check silently lets everything through — don't
  // copy that pattern here. Verified: a request with no key, and one with the
  // service-role key, both get 401; only the cron's own key is accepted.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let authorised = CRON_SECRET !== '' && bearer === CRON_SECRET;
  if (!authorised && bearer) {
    const { data } = await db.rpc('cron_key_matches', { p_key: bearer });
    authorised = data === true;
  }
  if (!authorised) return new Response('unauthorized', { status: 401 });

  try {
    const cutoff = new Date(Date.now() - GRACE_MIN * 60_000).toISOString();

    // Unread, seller spoke last, sat past the grace window, not already nagged.
    // chat_after_message clears buyer_email_notified_at on every new seller
    // reply, so a fresh reply re-opens the window without a second column.
    const { data: threads, error } = await db
      .from('chat_threads')
      .select('id, listing_id, buyer_id, salesman_id, dealer_id, buyer_unread, last_message_at')
      .gt('buyer_unread', 0)
      .eq('last_sender_role', 'seller')
      .eq('status', 'open')
      .is('buyer_email_notified_at', null)
      .lt('last_message_at', cutoff)
      .limit(200);

    if (error) throw error;
    if (!threads?.length) return Response.json({ ok: true, sent: 0, reason: 'nothing unread' });

    const rows = threads as Row[];
    const ids = <T,>(xs: (T | null)[]) => [...new Set(xs.filter(Boolean))] as T[];

    const [{ data: buyers }, { data: sellers }, { data: cars }] = await Promise.all([
      db.from('profiles').select('id, email, notify_email, full_name, notify_email_opt_out, notify_unsub_token')
        .in('id', ids(rows.map(r => r.buyer_id))),
      db.from('profiles').select('id, full_name, dealership')
        .in('id', ids([...rows.map(r => r.salesman_id), ...rows.map(r => r.dealer_id)])),
      db.from('car_listings').select('id, brand, model, year')
        .in('id', ids(rows.map(r => r.listing_id))),
    ]);

    const buyerBy  = new Map((buyers  ?? []).map(b => [b.id, b]));
    const sellerBy = new Map((sellers ?? []).map(s => [s.id, s]));
    const carBy    = new Map((cars    ?? []).map(c => [c.id, c]));

    // The preview. body_ai only — the redacted column is the one that may leave
    // the app. There is no `body` in this select on purpose.
    const { data: msgs } = await db
      .from('chat_messages')
      .select('thread_id, body_ai, created_at, sender_role')
      .in('thread_id', rows.map(r => r.id))
      .eq('sender_role', 'seller')
      .order('created_at', { ascending: false });

    const previewBy = new Map<string, string>();
    for (const m of msgs ?? []) {
      if (!previewBy.has(m.thread_id)) previewBy.set(m.thread_id, String(m.body_ai || '').slice(0, 180));
    }

    // Group by buyer: two cars with the same person is one email.
    // notify_email is the unverified address typed into the anon chat box —
    // fall back to it only when there is no real account email.
    const byBuyer = new Map<string, Row[]>();
    for (const r of rows) {
      const b = buyerBy.get(r.buyer_id);
      if (!(b?.email || b?.notify_email) || b.notify_email_opt_out) continue;
      byBuyer.set(r.buyer_id, [...(byBuyer.get(r.buyer_id) ?? []), r]);
    }

    let sent = 0;
    const notified: string[] = [];

    for (const [buyerId, list] of byBuyer) {
      const buyer = buyerBy.get(buyerId)!;
      const items = list.map(r => {
        const s = sellerBy.get(r.salesman_id ?? '') ?? sellerBy.get(r.dealer_id ?? '');
        const c = carBy.get(r.listing_id ?? '');
        return {
          seller: s?.full_name || s?.dealership || 'The seller',
          car: c ? [c.year, c.brand, c.model].filter(Boolean).join(' ') : 'Your car enquiry',
          preview: previewBy.get(r.id) || 'Open the chat to read the reply.',
        };
      });

      const headline = items[0].seller;
      const subject = list.length > 1
        ? `${headline} and others replied on XDrive`
        : `${headline} sent you a message`;
      const unsubUrl = `${SITE_URL}/unsubscribe?t=${buyer.notify_unsub_token}`;
      const to = buyer.email || buyer.notify_email;

      try {
        await sendEmail(to, subject, buildHtml(headline, items, unsubUrl, !buyer.email));
        sent++;
        notified.push(...list.map(r => r.id));
      } catch (e) {
        // One bad address must not stop the rest of the run.
        console.error(`chat-unread email to ${buyerId} failed:`, e);
      }
    }

    if (notified.length) {
      await db.from('chat_threads')
        .update({ buyer_email_notified_at: new Date().toISOString() })
        .in('id', notified);
    }

    return Response.json({ ok: true, sent, threads: notified.length });
  } catch (e) {
    console.error('notify-chat-unread failed:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
