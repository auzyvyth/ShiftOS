import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../../hooks/useModalHistory';
import { Bell, Check, Copy, ExternalLink } from 'lucide-react';
import {
  usePushNotifications, isIOS, isStandalone, isInAppBrowser, isAndroid,
} from '../../hooks/usePushNotifications';

// PUSH-ONBOARD (owner, 2026-10-31): the LAST screen of every way a seller gets
// an account, the signup wizard (SalesmanOnboarding) and the set-up email page
// (SalesmanSetup). On 2026-10-31 not one real seller had a push device, so a
// buyer's message reached them by email at best.
//
// Required where the browser CAN do it: one button, no skip. Where it cannot,
// the screen says what to do instead and lets them through, because a gate with
// no way out loses the signup:
//   - in-app browser (Instagram / Facebook / TikTok, where ads land): open in Chrome / Safari
//   - iPhone outside the home-screen app: Apple only allows push for installed apps,
//     and that app keeps its own login, so it cannot finish HERE; the dashboard's
//     required strip asks again inside the app
//   - permission already blocked: the browser never asks again; how to unblock it
//   - our own failure (save failed, no key configured): never trap on our bug
// Uses usePushNotifications, which owns every browser trap. No second path.
//
// Also the gate in front of Live presentation (SalesmanProfilePage openLive):
// sellers mostly use Live, and viewers message during and after it. Passing
// `onCancel` turns it into a portalled pop-up (scroll lock, Back closes it and
// does NOT start the live), with its own eyebrow / title / intro.

const DONE_PAUSE_MS = 1200;

export default function LeadAlertsStep({ userId, onDone, onCancel, eyebrow = 'Last step', title = 'TURN ON LEAD ALERTS', intro }) {
  const push = usePushNotifications(userId);
  const overlay = typeof onCancel === 'function';
  useModalHistory(overlay, overlay ? onCancel : () => {});
  useEffect(() => {
    if (!overlay) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [overlay]);
  const [result, setResult] = useState(null); // null | 'dismissed' | 'failed'
  const [copied, setCopied] = useState(false);
  // The device check waits on the service worker. If it never comes up, stop
  // waiting after a few seconds and show the button rather than a spinner forever.
  const [waitedOut, setWaitedOut] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setWaitedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  // Already on for this account on this device: nothing to ask.
  useEffect(() => {
    if (push.subscribed && push.checked) {
      const t = setTimeout(finish, DONE_PAUSE_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [push.subscribed, push.checked]); // eslint-disable-line react-hooks/exhaustive-deps

  // No VAPID key on this deploy: nothing the seller can do, so do not block.
  useEffect(() => {
    if (!push.configured) finish();
  }, [push.configured]); // eslint-disable-line react-hooks/exhaustive-deps

  const mode = (() => {
    if (push.subscribed && push.checked) return 'on';
    if (isInAppBrowser()) return 'inapp';
    if (isIOS() && !isStandalone()) return 'ios';
    if (!push.supported) return 'unsupported';
    if (push.permission === 'denied') return 'denied';
    return 'ask';
  })();

  const turnOn = async () => {
    setResult(null);
    // enable() waits on the service worker; a worker that never comes up must
    // not leave the seller staring at "Turning on..." with no way forward.
    const r = await Promise.race([
      push.enable(),
      new Promise((res) => setTimeout(() => res({ ok: false, reason: 'timeout' }), 20000)),
    ]);
    if (r.ok) { setTimeout(finish, DONE_PAUSE_MS); return; }
    if (r.reason === 'dismissed') setResult('dismissed');
    else if (r.reason !== 'denied') setResult('failed');
    // 'denied' re-renders as the blocked screen via push.permission
  };

  const appUrl = `${window.location.origin}/login`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(appUrl); setCopied(true); } catch { setCopied(false); }
  };
  // Android in-app browsers honour an intent link straight into Chrome.
  const chromeIntent = `intent://${window.location.host}/login#Intent;scheme=https;package=com.android.chrome;end`;

  // A supported browser still checking whether this device is already on.
  if (mode === 'ask' && !push.checked && !waitedOut) {
    return <Shell overlay={overlay} onCancel={onCancel}><p style={S.sub}>Checking this device...</p></Shell>;
  }

  return (
    <Shell overlay={overlay} onCancel={onCancel}>
      <div style={S.ring}>{mode === 'on' ? <Check size={26} color="#4ade80" /> : <Bell size={26} color="#dc2626" />}</div>
      <p style={S.eyebrow}>{eyebrow}</p>
      <h1 style={S.title}>{mode === 'on' ? 'ALERTS ARE ON' : title}</h1>

      {mode === 'on' && <p style={S.sub}>A buyer's message, booking or WhatsApp tap will reach this phone, even with the app closed.</p>}

      {mode === 'ask' && (
        <>
          <p style={S.sub}>
            {intro || 'Buyers move on fast. Turn on alerts so a new message, booking or enquiry reaches your phone the moment it happens, even with the app closed.'}
          </p>
          <button type="button" style={{ ...S.btn, opacity: push.busy ? 0.6 : 1 }} disabled={push.busy} onClick={turnOn}>
            <Bell size={16} /> {push.busy ? 'Turning on...' : 'Turn on alerts'}
          </button>
          {result === 'dismissed' && <p style={S.warn}>Your phone asked and nothing was picked. Tap the button again and choose Allow.</p>}
          {result === 'failed' && (
            <>
              <p style={S.warn}>That did not save on our side. Try once more.</p>
              <button type="button" style={S.ghost} onClick={finish}>Continue, I will turn it on in Settings</button>
            </>
          )}
        </>
      )}

      {mode === 'inapp' && (
        <>
          <p style={S.sub}>
            You are inside {/Instagram/i.test(navigator.userAgent) ? 'Instagram' : /TikTok|musical_ly|Bytedance/i.test(navigator.userAgent) ? 'TikTok' : 'an app'}'s built-in browser, and alerts cannot work in here. Open your account in {isIOS() ? 'Safari' : 'Chrome'} and sign in with the same email.
          </p>
          {isAndroid() ? (
            <a href={chromeIntent} style={{ ...S.btn, textDecoration: 'none' }}><ExternalLink size={16} /> Open in Chrome</a>
          ) : (
            <p style={S.steps}>Tap the <b>···</b> menu at the top, then <b>Open in browser</b>. Then add it to your Home Screen and turn alerts on there.</p>
          )}
          <button type="button" style={S.ghost} onClick={copyLink}><Copy size={14} /> {copied ? 'Link copied' : 'Copy the link'}</button>
          <button type="button" style={S.skip} onClick={finish}>Continue here for now</button>
        </>
      )}

      {mode === 'ios' && (
        <>
          <p style={S.sub}>On iPhone, Apple only sends alerts to apps on your Home Screen. It takes ten seconds:</p>
          <ol style={S.list}>
            <li>Tap <b>Share</b> (the square with the arrow) at the bottom of Safari.</li>
            <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            <li>Open the app from your Home Screen, sign in, and tap <b>Turn on alerts</b>.</li>
          </ol>
          <button type="button" style={S.skip} onClick={finish}>I will do it now, continue</button>
        </>
      )}

      {mode === 'unsupported' && (
        <>
          <p style={S.sub}>This browser cannot receive alerts. Open your account in Chrome (Android) or Safari (iPhone) to turn them on.</p>
          <button type="button" style={S.ghost} onClick={copyLink}><Copy size={14} /> {copied ? 'Link copied' : 'Copy the link'}</button>
          <button type="button" style={S.skip} onClick={finish}>Continue for now</button>
        </>
      )}

      {mode === 'denied' && (
        <>
          <p style={S.sub}>Alerts are blocked for this site, so your phone will not ask again. To unblock:</p>
          <ol style={S.list}>
            <li>Tap the icon left of the address bar (a lock or sliders).</li>
            <li>Open <b>Permissions</b> or <b>Site settings</b>, set <b>Notifications</b> to <b>Allow</b>.</li>
            <li>Reload this page.</li>
          </ol>
          <button type="button" style={S.ghost} onClick={() => window.location.reload()}>I unblocked it, reload</button>
          <button type="button" style={S.skip} onClick={finish}>Continue, we will email you instead</button>
        </>
      )}
    </Shell>
  );
}

function Shell({ children, overlay, onCancel }) {
  if (!overlay) {
    return (
      <div style={S.root}>
        <div style={S.card}>{children}</div>
      </div>
    );
  }
  return createPortal(
    <div style={S.overlay} role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" style={S.close} onClick={onCancel}>×</button>
      <div style={S.card}>{children}</div>
    </div>,
    document.body,
  );
}

const S = {
  root: { minHeight: '100vh', background: '#070A12', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontFamily: "var(--xd-font-body, 'Outfit', system-ui, sans-serif)", boxSizing: 'border-box' },
  overlay: { position: 'fixed', inset: 0, zIndex: 10050, background: '#070A12', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 20px 32px', fontFamily: "var(--xd-font-body, 'Outfit', system-ui, sans-serif)", boxSizing: 'border-box' },
  close: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24, lineHeight: 1, cursor: 'pointer' },
  card: { width: 'min(420px, 100%)', textAlign: 'center' },
  ring: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' },
  eyebrow: { fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600, margin: '0 0 8px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(38px, 9vw, 52px)', letterSpacing: 2, color: '#E8EDF5', lineHeight: 1.05, margin: '0 0 14px', fontWeight: 400 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 22px' },
  steps: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 14px' },
  list: { textAlign: 'left', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: '0 0 22px', paddingLeft: 20 },
  btn: { width: '100%', height: 52, background: '#dc2626', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', boxSizing: 'border-box' },
  ghost: { width: '100%', height: 46, marginTop: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' },
  skip: { marginTop: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' },
  warn: { fontSize: 12, color: '#fca5a5', margin: '12px 0 0', lineHeight: 1.5 },
};
