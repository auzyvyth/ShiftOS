/**
 * notify-seller-unread
 *
 * The seller half of the email backup. notify-chat-unread emails a BUYER when a
 * seller's reply sits unread; nothing did the same for a SELLER. A lead
 * notification row (salesman_notifications / dealer_notifications) is the push
 * — trg_push_on_*_notification fires on insert — but a push only reaches a
 * device that is registered. A rep who signed out, never turned push on, or
 * whose phone threw its subscription away heard nothing, and the lead sat
 * there. On a marketplace that is a lost sale.
 *
 * Runs on pg_cron every 15 min. Secrets: RESEND_API_KEY, SITE_URL.
 *
 * Who gets an email — a lead row that is:
 *  - one of LEAD_TYPES (enquiry, chat, booking, unconfirmed booking)
 *  - older than GRACE_MIN (give the push and the app a chance first) and newer
 *    than MAX_AGE_H (a two-day-old lead emailed now is noise, not rescue)
 *  - not already emailed (emailed_at), and not marked read
 *  - UNSEEN:
 *      chat_message -> the thread still has seller_unread > 0. That count is
 *                      cleared when the seller opens the conversation, so it is
 *                      the one honest "have they seen it" signal we have.
 *      everything else -> the recipient has NO registered push device, i.e.
 *                      the push could not have reached them. (is_read is only
 *                      set from the bell menu, so on its own it would email
 *                      people who already handled the lead in the app.)
 *
 * Rules baked in, do not "simplify" them away:
 *  - One email per PERSON per run, listing every waiting lead, and at most one
 *    email per person per THROTTLE_MIN. Rows skipped by the throttle are picked
 *    up by a later run (they stay un-emailed until MAX_AGE_H).
 *  - Only the notification TITLE goes in the email (e.g. "New enquiry: Adam
 *    Haris"), never the body — chat bodies can carry what a buyer typed,
 *    including a phone number. Anything else: open the app.
 *  - Sent only to profiles.email (the account's own, verified sign-in address),
 *    honours notify_email_opt_out, and carries the same unsubscribe link as the
 *    buyer email (email_unsubscribe(p_token)).
 *  - ?dry=1 reports what WOULD be sent and sends nothing.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL       = Deno.env.get('SITE_URL') ?? 'https://xdrive.my';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const LEAD_TYPES   = ['new_enquiry', 'chat_message', 'new_booking', 'booking_unconfirmed'];
const GRACE_MIN    = 15;
const MAX_AGE_H    = 48;
const THROTTLE_MIN = 60;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Note = {
  id: string;
  table: 'salesman_notifications' | 'dealer_notifications';
  recipient: string;
  type: string;
  title: string;
  ref_id: string | null;
  created_at: string;
};

const LABEL: Record<string, string> = {
  new_enquiry: 'Enquiry',
  chat_message: 'Message',
  new_booking: 'Viewing booked',
  booking_unconfirmed: 'Booking not confirmed',
};

function klTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

function buildHtml(name: string, items: Note[], openUrl: string, unsubUrl: string) {
  const rows = items.map(n => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
      <p style="margin:0 0 3px;font:600 11px system-ui,sans-serif;color:#dc2626;text-transform:uppercase;letter-spacing:.04em">${esc(LABEL[n.type] ?? 'Lead')} &middot; <span style="color:#6b7280;text-transform:none;letter-spacing:0">${esc(klTime(n.created_at))}</span></p>
      <p style="margin:0;font:500 14px system-ui,sans-serif;color:#111827">${esc(n.title)}</p>
    </td></tr>`).join('');
  const count = items.length === 1 ? 'A buyer is' : `${items.length} buyers are`;
  return `<!doctype html><html><body style="margin:0;background:#f9fafb;padding:24px 12px">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px">
    <tr><td>
      <p style="margin:0 0 6px;font:700 17px system-ui,sans-serif;color:#111827">Hi ${esc(name)}, ${count} waiting for you</p>
      <p style="margin:0 0 12px;font:400 13px system-ui,sans-serif;color:#6b7280;line-height:1.6">
        These reached your account but not your phone, so we're emailing you instead. Buyers who wait usually move on.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="margin:20px 0 0">
        <a href="${openUrl}" style="display:inline-block;padding:11px 20px;border-radius:9px;background:#dc2626;color:#fff;font:700 14px system-ui,sans-serif;text-decoration:none">Open ShiftOS to reply</a>
      </p>
      <p style="margin:18px 0 0;font:400 12px system-ui,sans-serif;color:#6b7280;line-height:1.6">
        Tip: turn on notifications in the app so these reach your phone straight away.
      </p>
      <p style="margin:22px 0 0;font:400 11px system-ui,sans-serif;color:#9ca3af;line-height:1.6">
        You're getting this because a lead on your ShiftOS account went unseen.
        <a href="${unsubUrl}" style="color:#9ca3af">Turn these emails off</a>.
      </p>
    </td></tr>
  </table></body></html>`;
}

// A backup that fails silently is worse than none: the owner believes leads
// are covered. Failures go to notify_ops (Telegram + superadmin push, 15-min
// throttle per key) — headline on the first line, detail after.
async function alertOps(detail: string) {
  try {
    await db.rpc('notify_ops', { p_key: 'err:seller_email', p_text: `Seller lead email backup failed\n${detail}`.slice(0, 900) });
  } catch (e) {
    console.error('notify-seller-unread: notify_ops failed', e);
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'ShiftOS <alerts@xdrive.my>', to, subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  // Cron target with verify_jwt off, so the check is here and MANDATORY — same
  // pattern as notify-chat-unread (cron_key_matches answers yes/no and never
  // returns the key). Do NOT copy the `if (CRON_SECRET)` pattern: that secret
  // is not set on this project, so it lets everything through.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let authorised = false;
  if (bearer) {
    const { data } = await db.rpc('cron_key_matches', { p_key: bearer });
    authorised = data === true;
  }
  if (!authorised) return new Response('unauthorized', { status: 401 });

  const dry = new URL(req.url).searchParams.get('dry') === '1';

  try {
    if (!dry && !RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
    const now = Date.now();
    const newest = new Date(now - GRACE_MIN * 60_000).toISOString();
    const oldest = new Date(now - MAX_AGE_H * 3_600_000).toISOString();

    const pick = (table: Note['table'], who: string) =>
      db.from(table)
        .select(`id, ${who}, type, title, ref_id, created_at, is_read`)
        .in('type', LEAD_TYPES)
        .is('emailed_at', null)
        .lt('created_at', newest)
        .gt('created_at', oldest)
        .limit(500);

    const [s, d] = await Promise.all([
      pick('salesman_notifications', 'salesman_id'),
      pick('dealer_notifications', 'dealer_id'),
    ]);
    if (s.error) throw s.error;
    if (d.error) throw d.error;

    const notes: Note[] = [
      ...(s.data ?? []).filter(r => !r.is_read && r.salesman_id).map(r => ({
        id: r.id, table: 'salesman_notifications' as const, recipient: r.salesman_id,
        type: r.type, title: r.title, ref_id: r.ref_id, created_at: r.created_at,
      })),
      ...(d.data ?? []).filter(r => !r.is_read && r.dealer_id).map(r => ({
        id: r.id, table: 'dealer_notifications' as const, recipient: r.dealer_id,
        type: r.type, title: r.title, ref_id: r.ref_id, created_at: r.created_at,
      })),
    ];
    if (!notes.length) return Response.json({ ok: true, sent: 0, reason: 'nothing waiting' });

    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean))] as string[];
    const recipients = uniq(notes.map(n => n.recipient));
    const threadRefs = uniq(notes.filter(n => n.type === 'chat_message').map(n => n.ref_id));

    const since = new Date(now - THROTTLE_MIN * 60_000).toISOString();
    const [devices, threads, people, recentS, recentD] = await Promise.all([
      db.from('push_subscriptions').select('user_id').in('user_id', recipients),
      threadRefs.length
        ? db.from('chat_threads').select('id, seller_unread').in('id', threadRefs)
        : Promise.resolve({ data: [], error: null }),
      db.from('profiles')
        .select('id, email, full_name, dealership, role, is_active, account_status, notify_email_opt_out, notify_unsub_token')
        .in('id', recipients),
      db.from('salesman_notifications').select('salesman_id').in('salesman_id', recipients).gt('emailed_at', since),
      db.from('dealer_notifications').select('dealer_id').in('dealer_id', recipients).gt('emailed_at', since),
    ]);
    for (const r of [devices, threads, people, recentS, recentD]) if (r.error) throw r.error;

    const hasDevice = new Set((devices.data ?? []).map(r => r.user_id));
    const threadUnread = new Map((threads.data ?? []).map(t => [t.id, t.seller_unread ?? 0]));
    const personBy = new Map((people.data ?? []).map(p => [p.id, p]));
    const throttled = new Set([
      ...(recentS.data ?? []).map(r => r.salesman_id),
      ...(recentD.data ?? []).map(r => r.dealer_id),
    ]);

    const unseen = (n: Note) => {
      if (n.type === 'chat_message' && n.ref_id && threadUnread.has(n.ref_id)) {
        return (threadUnread.get(n.ref_id) ?? 0) > 0;
      }
      return !hasDevice.has(n.recipient);
    };

    const byPerson = new Map<string, Note[]>();
    for (const n of notes) {
      if (!unseen(n) || throttled.has(n.recipient)) continue;
      const p = personBy.get(n.recipient);
      if (!p?.email || p.notify_email_opt_out) continue;
      if (p.is_active === false || (p.account_status && p.account_status !== 'active')) continue;
      byPerson.set(n.recipient, [...(byPerson.get(n.recipient) ?? []), n]);
    }

    if (dry) {
      return Response.json({
        ok: true, dry: true, people: byPerson.size,
        rows: [...byPerson.values()].reduce((a, l) => a + l.length, 0),
        by_type: [...byPerson.values()].flat().reduce((a: Record<string, number>, n) => ({ ...a, [n.type]: (a[n.type] ?? 0) + 1 }), {}),
      });
    }

    let sent = 0;
    const failures: string[] = [];
    for (const [uid, list] of byPerson) {
      const p = personBy.get(uid)!;
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data: home } = await db.rpc('push_home_path', { p_user_id: uid });
      const openUrl = `${SITE_URL}${typeof home === 'string' ? home : '/login'}`;
      const unsubUrl = `${SITE_URL}/unsubscribe?t=${p.notify_unsub_token}`;
      const name = p.full_name || p.dealership || 'there';
      const subject = list.length === 1
        ? `${LABEL[list[0].type] ?? 'Lead'}: ${list[0].title}`.slice(0, 120)
        : `${list.length} buyers are waiting on ShiftOS`;
      try {
        await sendEmail(p.email, subject, buildHtml(name, list, openUrl, unsubUrl));
        sent++;
        const stamp = new Date().toISOString();
        for (const table of ['salesman_notifications', 'dealer_notifications'] as const) {
          const ids = list.filter(n => n.table === table).map(n => n.id);
          if (ids.length) {
            const { error } = await db.from(table).update({ emailed_at: stamp }).in('id', ids);
            if (error) console.error(`notify-seller-unread: stamp ${table} failed`, error.message);
          }
        }
      } catch (e) {
        // One bad address must not stop the rest of the run — but it must be
        // visible: the rows stay un-emailed and the failure is in the response.
        console.error(`notify-seller-unread: email to ${uid} failed:`, e);
        failures.push(uid);
      }
    }

    if (failures.length) await alertOps(`${failures.length} of ${byPerson.size} emails failed to send (sent ${sent}). See notify-seller-unread logs.`);
    return Response.json({ ok: failures.length === 0, sent, failed: failures.length }, { status: failures.length && !sent ? 502 : 200 });
  } catch (e) {
    console.error('notify-seller-unread failed:', e);
    await alertOps(String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
