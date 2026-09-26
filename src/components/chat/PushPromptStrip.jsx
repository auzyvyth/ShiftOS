import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { usePushNotifications, isIOS, isStandalone } from '../../hooks/usePushNotifications';
import { panel } from '../../theme/tokens';

// Palette for the dashboard mounts (Lite + Premium), defined once here rather
// than copied into each panel. The chat mounts keep passing their own THEMES
// entry, because they have to match the thread they sit against.
export const PANEL_THEME = {
  panel: panel.surfaceRaised,
  border: panel.border,
  sub: panel.textSec,
};

// The one-line "turn on notifications" strip, shown to whoever is waiting on a
// reply — a BUYER inside the conversation, or a SELLER above their inbox.
//
// Why this exists: a reply on either side already fires a real push
// (chat_after_message -> push_to_users), but that only lands if the recipient
// has a push_subscriptions row. Nothing in the app had ever asked a buyer for
// one, and a seller's only way to one was a card buried in Settings that most
// of them never opened. So chat was a channel both sides could answer on and
// neither reliably heard back through.
//
// It is deliberately NOT PushToggle. That component is a settings card with a
// title, a blurb, an on/off state and a test-send button — right for a Settings
// page, wrong for a line above a message box. Both share the part that matters,
// `usePushNotifications`, which owns every browser trap (permission gestures,
// iOS install requirement, denied dead ends, browser/database drift).
//
// Timing (buyer): after their first message, not on open. Someone who has just
// opened a chat and typed nothing has not asked for anything yet, and a
// permission prompt there is the kind users reflexively block — and a denied
// permission is a dead end no later prompt can recover.
//
// PERSISTENT BY DESIGN. Dismissal used to be written to localStorage — first as
// forever, then as a week. Either way one reflexive tap silenced the single
// prompt whose whole job is to arrive at the moment it matters, and the person
// then sat in a chat that could never reach them with no sign anything was
// wrong. Dismissal is now component state only: it clears the strip for this
// view and it is back on the next visit, and it goes away for good only when
// notifications are actually on (`subscribed`), which is the state we wanted.
//
// NEVER RENDER NOTHING WHEN THE ANSWER IS "YOU CAN'T YET". This used to return
// null on iOS-outside-a-PWA and on a denied permission. Both are the two states
// where the user is MOST likely to be wondering why replies never reach them,
// and silence is what made push look broken on a fresh phone while it worked
// fine on the tester's own. Say the reason in one line instead; there is
// nothing to tap in either case, so no button.

// The success confirmation is a RECEIPT, not a banner: it exists to close the
// loop on a tap that otherwise has no visible result (the browser's own
// permission dialog vanishes and nothing on the page changes). Once it has been
// read it is clutter, and it used to be permanent — `justEnabled` was checked
// before the `subscribed` early-return, so the green "Done." line sat at the top
// of the dashboard for the rest of the session with nothing to close it.
const DONE_VISIBLE_MS = 6000;

const COPY = {
  buyer: {
    ask: 'Get notified when the seller replies — no need to keep this open.',
    done: 'Done. We will notify you when the seller replies, even with this page closed.',
    ios: 'To get alerts when the seller replies, add this site to your home screen first — Share, then Add to Home Screen.',
    denied: 'Notifications are blocked for this site in your browser settings, so replies will only show up here.',
  },
  seller: {
    ask: 'Get notified the moment a buyer messages you, even with this closed.',
    done: 'Done. New buyer messages will reach this device.',
    ios: 'To get alerts when a buyer messages you, add XDrive to your home screen first — Share, then Add to Home Screen.',
    denied: 'Notifications are blocked for this site in your browser settings, so new messages will only show up here.',
  },
  // The panel-wide variant. Same mechanism, but it is not standing above a
  // message list, so it names what a seller actually misses while the app is
  // shut — an enquiry or a booking, not only a chat reply.
  // Platform console. The toggle for this lives in Safety > Alerts, and the
  // superadmin account had NO registered device at all — so every ops alert
  // (new signup, listing awaiting review, KYC submitted, error spikes) was
  // being raised and reaching nobody.
  admin: {
    ask: 'Turn on alerts for this device — signups, listings awaiting review, ID checks and errors.',
    done: 'Done. Platform alerts will reach this device.',
    ios: 'To get platform alerts on your phone, add XDrive to your home screen first — Share, then Add to Home Screen.',
    denied: 'Notifications are blocked for this site in your browser settings, so platform alerts cannot reach this device.',
  },
  // Dealer dashboard. Only the dealer's own account gets these (every
  // dealer_notifications row pushes to dealer_id alone), and on 2026-09-26 both
  // dealer accounts had ZERO registered devices — every enquiry, booking and
  // overdue alert was reaching nobody off the dashboard.
  dealer_home: {
    ask: 'Turn on notifications so new enquiries, bookings and buyer messages reach this device. Leads are lost when nobody hears them.',
    done: 'Done. New enquiries, bookings and messages will reach this device.',
    ios: 'To get alerts on your phone, add XDrive to your home screen first — Share, then Add to Home Screen.',
    denied: 'Notifications are blocked for this site in your browser settings, so nothing can reach this device. Allow them in the site settings.',
  },
  seller_home: {
    ask: 'Turn on notifications so a new enquiry, booking or message reaches your phone.',
    done: 'Done. New enquiries, bookings and messages will reach this device.',
    ios: 'To get alerts on your phone, add XDrive to your home screen first — Share, then Add to Home Screen.',
    denied: 'Notifications are blocked for this site in your browser settings, so nothing can reach this device.',
  },
};

// `boxed` is for the dashboard mounts: standing on its own in a page body, the
// chat variant's single top border reads as an unfinished edge rather than a
// divider between two panes.
export default function PushPromptStrip({
  t,
  audience = 'buyer',
  boxed = false,
  // The platform console runs on an ISOLATED supabase session, and
  // push_subscriptions is RLS'd on auth.uid() = user_id — saving the admin's
  // device through the main client files it under whichever dealer happens to
  // be signed in on that browser, or rejects it outright. Same `client`
  // argument PushToggle and usePushNotifications already take. When the caller
  // knows who it is, it passes userId too and the lookup below is skipped.
  client = supabase,
  userId: userIdProp = null,
  // REQUIRED = no "Not now" on the ask. The strip stays until push is on.
  // The iOS and denied states keep their close button: nothing on this page
  // can fix either, and a banner you can neither act on nor close is just a
  // broken page.
  required = false,
}) {
  const [userId, setUserId] = useState(userIdProp);
  const [dismissed, setDismissed] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const [note, setNote] = useState(null);
  const copy = COPY[audience] || COPY.buyer;

  // A guest buyer is signed in anonymously, which is still a real auth.uid() —
  // push_subscriptions is RLS'd on auth.uid() = user_id, so their row saves like
  // anyone else's.
  useEffect(() => {
    if (userIdProp) { setUserId(userIdProp); return undefined; }
    let cancelled = false;
    client.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data?.user?.id || null);
    });
    return () => { cancelled = true; };
  }, [client, userIdProp]);

  const { supported, configured, permission, subscribed, busy, enable } = usePushNotifications(userId, client);

  // Retire the confirmation on its own. Cleared on unmount so a panel switched
  // away from mid-countdown does not set state into a dead component.
  useEffect(() => {
    if (!justEnabled) return undefined;
    const timer = setTimeout(() => setDismissed(true), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [justEnabled]);

  const handleEnable = async () => {
    setNote(null);
    const res = await enable();
    if (res.ok) { setJustEnabled(true); return; }
    setNote(res.reason === 'denied'
      ? 'Your browser is blocking notifications for this site. You can turn them back on in its site settings.'
      : 'Could not turn notifications on. You will still see the message here.');
  };

  const row = (children) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
      background: t.panel, padding: '9px 12px', flexShrink: 0,
      ...(boxed
        ? { border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 14 }
        : { borderTop: `1px solid ${t.border}` }),
    }}>
      {children}
    </div>
  );

  // Checked FIRST, ahead of the confirmation: this is the one flag every exit
  // route sets, so anything it cannot reach can never be closed.
  if (dismissed) return null;

  if (justEnabled) {
    return row(<>
      <Bell size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>{copy.done}</p>
      <DismissBtn t={t} onClick={() => setDismissed(true)} />
    </>);
  }

  if (!userId || !supported || !configured || subscribed) return null;

  // iOS refuses web push outside an installed PWA, so the button could never
  // succeed there. Say why rather than showing a dead button — or nothing.
  if (isIOS() && !isStandalone()) {
    return row(<>
      <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>{copy.ios}</p>
      <DismissBtn t={t} onClick={() => setDismissed(true)} />
    </>);
  }

  if (permission === 'denied') {
    return row(<>
      <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>{copy.denied}</p>
      <DismissBtn t={t} onClick={() => setDismissed(true)} />
    </>);
  }

  return row(<>
    <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
    <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
      {note || copy.ask}
    </p>
    {(!note || required) && (
      <button type="button" onClick={handleEnable} disabled={busy}
        style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'system-ui,sans-serif' }}>
        {busy ? 'Turning on…' : note ? 'Try again' : 'Turn on'}
      </button>
    )}
    {!required && <DismissBtn t={t} onClick={() => setDismissed(true)} />}
  </>);
}

function DismissBtn({ t, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Not now"
      style={{ flexShrink: 0, background: 'none', border: 'none', color: t.sub, cursor: 'pointer', padding: 2, display: 'flex' }}>
      <X size={13} />
    </button>
  );
}
