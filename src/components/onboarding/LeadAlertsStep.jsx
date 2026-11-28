import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useModalHistory } from '../../hooks/useModalHistory';
import { Bell, Check, Copy, ExternalLink } from 'lucide-react';
import {
  usePushNotifications, isIOS, isStandalone, isInAppBrowser, isAndroid,
} from '../../hooks/usePushNotifications';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

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
const SLOW_MS = 15000;

// The screen has already closed when this runs, so every outcome is a toast.
// A request still open after 15s is almost always Chrome's quiet prompt: say
// where to look. If it then succeeds, the success toast follows.
function reportAlertsResult(attempt) {
  // Not a component: a hook here throws "Invalid hook call" the moment it runs.
  const tr = (k, o) => i18n.t(k, o);
  let settled = false;
  const slow = setTimeout(() => {
    if (!settled) toast(tr("leadAlerts.alertsAreNotOnYet"), { duration: 12000 });
  }, SLOW_MS);
  attempt.then((r) => {
    settled = true;
    clearTimeout(slow);
    if (r?.ok) toast.success(tr("leadAlerts.leadAlertsAreOnBuyers"));
    else if (r?.reason === 'denied') toast.error(tr("leadAlerts.alertsAreBlockedForThis"), { duration: 10000 });
    else toast.error(tr("leadAlerts.alertsDidNotTurnOn"), { duration: 8000 });
  }).catch(() => {
    settled = true;
    clearTimeout(slow);
    toast.error(tr("leadAlerts.alertsDidNotTurnOn"), { duration: 8000 });
  });
}

export default function LeadAlertsStep({ userId, onDone, onCancel, eyebrow = 'Last step', title = 'TURN ON LEAD ALERTS', intro }) {
  const { t: tr } = useTranslation();
  const push = usePushNotifications(userId);
  const overlay = typeof onCancel === 'function';
  useModalHistory(overlay, overlay ? onCancel : () => {});
  useEffect(() => {
    if (!overlay) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [overlay]);
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

  // Owner, 2026-10-31: the tap never holds them on this screen. Turning alerts
  // on can hang with no prompt at all (Chrome's quiet mode only shows a small
  // crossed bell in the address bar and waits), which left a seller staring at
  // "Turning on..." in front of their own live. So the tap starts the request
  // (it must start inside the tap, or the browser will not ask), closes the
  // screen at once, and the result arrives later as a toast.
  const turnOn = () => {
    const attempt = push.enable();
    finish();
    reportAlertsResult(attempt);
  };

  const appUrl = `${window.location.origin}/login`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(appUrl); setCopied(true); } catch { setCopied(false); }
  };
  // Android in-app browsers honour an intent link straight into Chrome.
  const chromeIntent = `intent://${window.location.host}/login#Intent;scheme=https;package=com.android.chrome;end`;

  // A supported browser still checking whether this device is already on.
  if (!overlay && mode === 'ask' && !push.checked && !waitedOut) {
    return <Shell overlay={overlay} onCancel={onCancel}><p style={S.sub}>{tr("leadAlerts.checkingThisDevice")}</p></Shell>;
  }

  return (
    <Shell overlay={overlay} onCancel={onCancel}>
      <div style={S.ring}>{mode === 'on' ? <Check size={26} color="#4ade80" /> : <Bell size={26} color="#dc2626" />}</div>
      <p style={S.eyebrow}>{eyebrow}</p>
      <h1 style={S.title}>{mode === 'on' ? tr("leadAlerts.alertsAreOn") : title}</h1>

      {mode === 'on' && <p style={S.sub}>{tr("leadAlerts.aBuyerSMessageBooking")}</p>}

      {mode === 'ask' && (
        <>
          <p style={S.sub}>
            {intro || tr("leadAlerts.buyersMoveOnFastTurn")}
          </p>
          <button type="button" style={S.btn} onClick={turnOn}>
            <Bell size={16} /> {tr("leadAlerts.turnOnAlerts")}
          </button>
        </>
      )}

      {mode === 'inapp' && (
        <>
          <p style={S.sub}>
            {tr("leadAlerts.youAreInside")} {/Instagram/i.test(navigator.userAgent) ? 'Instagram' : /TikTok|musical_ly|Bytedance/i.test(navigator.userAgent) ? 'TikTok' : tr("leadAlerts.anApp")}{tr("leadAlerts.sBuiltInBrowserAnd")} {isIOS() ? tr("leadAlerts.safari") : tr("leadAlerts.chrome")} {tr("leadAlerts.andSignInWithThe")}
          </p>
          {isAndroid() ? (
            <a href={chromeIntent} style={{ ...S.btn, textDecoration: 'none' }}><ExternalLink size={16} /> {tr("leadAlerts.openInChrome")}</a>
          ) : (
            <p style={S.steps}>{tr("leadAlerts.tapThe")} <b>···</b> {tr("leadAlerts.menuAtTheTopThen")} <b>{tr("leadAlerts.openInBrowser")}</b>{tr("leadAlerts.thenAddItToYour")}</p>
          )}
          <button type="button" style={S.ghost} onClick={copyLink}><Copy size={14} /> {copied ? tr("leadAlerts.linkCopied") : tr("leadAlerts.copyTheLink")}</button>
          <button type="button" style={S.skip} onClick={finish}>{tr("leadAlerts.continueHereForNow")}</button>
        </>
      )}

      {mode === 'ios' && (
        <>
          <p style={S.sub}>{tr("leadAlerts.onIphoneAppleOnlySends")}</p>
          <ol style={S.list}>
            <li>{tr("leadAlerts.tap")} <b>{tr("leadAlerts.share")}</b> {tr("leadAlerts.theSquareWithTheArrow")}</li>
            <li>{tr("leadAlerts.tap")} <b>{tr("leadAlerts.addToHomeScreen")}</b>{tr("leadAlerts.then")} <b>{tr("leadAlerts.add")}</b>.</li>
            <li>{tr("leadAlerts.openTheAppFromYour")} <b>{tr("leadAlerts.turnOnAlerts")}</b>.</li>
          </ol>
          <button type="button" style={S.skip} onClick={finish}>{tr("leadAlerts.iWillDoItNow")}</button>
        </>
      )}

      {mode === 'unsupported' && (
        <>
          <p style={S.sub}>{tr("leadAlerts.thisBrowserCannotReceiveAlerts")}</p>
          <button type="button" style={S.ghost} onClick={copyLink}><Copy size={14} /> {copied ? tr("leadAlerts.linkCopied") : tr("leadAlerts.copyTheLink")}</button>
          <button type="button" style={S.skip} onClick={finish}>{tr("leadAlerts.continueForNow")}</button>
        </>
      )}

      {mode === 'denied' && (
        <>
          <p style={S.sub}>{tr("leadAlerts.alertsAreBlockedForThis2")}</p>
          <ol style={S.list}>
            <li>{tr("leadAlerts.tapTheIconLeftOf")}</li>
            <li>{tr("leadAlerts.open")} <b>{tr("leadAlerts.permissions")}</b> or <b>{tr("leadAlerts.siteSettings")}</b>{tr("leadAlerts.set")} <b>{tr("leadAlerts.notifications")}</b> to <b>{tr("leadAlerts.allow")}</b>.</li>
            <li>{tr("leadAlerts.reloadThisPage")}</li>
          </ol>
          <button type="button" style={S.ghost} onClick={() => window.location.reload()}>{tr("leadAlerts.iUnblockedItReload")}</button>
          <button type="button" style={S.skip} onClick={finish}>{tr("leadAlerts.continueWeWillEmailYou")}</button>
        </>
      )}
    </Shell>
  );
}

function Shell({ children, overlay, onCancel }) {
  const { t: tr } = useTranslation();
  if (!overlay) {
    return (
      <div style={S.root}>
        <div style={S.card}>{children}</div>
      </div>
    );
  }
  return createPortal(
    <div style={S.overlay} role="dialog" aria-modal="true">
      <button type="button" aria-label={tr("leadAlerts.close")} style={S.close} onClick={onCancel}>×</button>
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
