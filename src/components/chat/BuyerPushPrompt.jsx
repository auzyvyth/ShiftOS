import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { usePushNotifications, isIOS, isStandalone } from '../../hooks/usePushNotifications';

// Asks the BUYER to turn on notifications, inside the conversation, after they
// have sent their first message.
//
// Why this exists: a seller's reply already fires a push (chat_after_message
// calls push_to_users on sender_role='seller'), but that only lands if the buyer
// has a push_subscriptions row — and nothing in the app had ever asked a buyer
// for one. PushToggle is rendered on every seller panel and on no buyer surface.
// So chat was a channel the seller could answer on and the buyer never heard
// back through: a guest who closed the tab simply never learned there was a
// reply. This is the missing half.
//
// It is deliberately NOT PushToggle. That component is a settings card with a
// title, a blurb, an on/off state and a test-send button — right for a Settings
// page, wrong for a line above a message box. Both share the part that matters,
// `usePushNotifications`, which owns every browser trap (permission gestures,
// iOS install requirement, denied dead ends, browser/database drift).
//
// Timing: after their first message, not on open. Someone who has just opened a
// chat and typed nothing has not asked for anything yet, and a permission prompt
// there is the kind users reflexively block — and a denied permission is a dead
// end no later prompt can recover.
//
// NEVER RENDER NOTHING WHEN THE ANSWER IS "YOU CAN'T YET". This component used
// to return null on iOS-outside-a-PWA and on a denied permission. Both are the
// two states where the buyer is MOST likely to be wondering why the seller's
// replies never reach them, and silence is what made buyer push look broken on
// a fresh phone while it worked fine on the tester's own. Say the reason in one
// line instead; there is nothing to tap in either case, so no button.

const DISMISS_KEY = 'xd_buyer_push_dismissed';
// A dismissal used to be permanent. One reflexive tap and that buyer could never
// be asked again on that device, on any listing, forever — for a prompt whose
// whole job is to arrive at the one moment it matters. Ask again in a week.
const DISMISS_DAYS = 7;

function dismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    // Legacy value from before this was a timestamp: treat as dismissed now, so
    // an existing buyer gets one more week of quiet rather than an instant re-ask.
    const at = raw === '1' ? Date.now() : Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

export default function BuyerPushPrompt({ t }) {
  const [userId, setUserId] = useState(null);
  const [dismissed, setDismissed] = useState(dismissedRecently);
  const [justEnabled, setJustEnabled] = useState(false);
  const [note, setNote] = useState(null);

  // A guest buyer is signed in anonymously, which is still a real auth.uid() —
  // push_subscriptions is RLS'd on auth.uid() = user_id, so their row saves like
  // anyone else's.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data?.user?.id || null);
    });
    return () => { cancelled = true; };
  }, []);

  const { supported, configured, permission, subscribed, busy, enable } = usePushNotifications(userId);

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode — ask again next visit */ }
  };

  const handleEnable = async () => {
    setNote(null);
    const res = await enable();
    if (res.ok) { setJustEnabled(true); return; }
    setNote(res.reason === 'denied'
      ? 'Your browser is blocking notifications for this site. You can turn them back on in its site settings.'
      : 'Could not turn notifications on. You will still see the reply here.');
  };

  const row = (children) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', borderTop: `1px solid ${t.border}`, background: t.panel, padding: '9px 12px', flexShrink: 0 }}>
      {children}
    </div>
  );

  if (justEnabled) {
    return row(<>
      <Bell size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
        Done. We will notify you when the seller replies, even with this page closed.
      </p>
    </>);
  }

  if (dismissed || !userId || !supported || !configured || subscribed) return null;

  // iOS refuses web push outside an installed PWA, so the button could never
  // succeed there. Say why rather than showing a dead button — or nothing.
  if (isIOS() && !isStandalone()) {
    return row(<>
      <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
        To get alerts when the seller replies, add this site to your home screen first — Share, then Add to Home Screen.
      </p>
      <DismissBtn t={t} onClick={close} />
    </>);
  }

  if (permission === 'denied') {
    return row(<>
      <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
        Notifications are blocked for this site in your browser settings, so replies will only show up here.
      </p>
      <DismissBtn t={t} onClick={close} />
    </>);
  }

  return row(<>
    <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
    <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
      {note || 'Get notified when the seller replies — no need to keep this open.'}
    </p>
    {!note && (
      <button type="button" onClick={handleEnable} disabled={busy}
        style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'system-ui,sans-serif' }}>
        {busy ? 'Turning on…' : 'Turn on'}
      </button>
    )}
    <DismissBtn t={t} onClick={close} />
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
