import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { matchesPathPrefix } from '../utils/routeMatch';
import {
  getDeferredPrompt,
  isInAppBrowser,
  isIOSSafari,
  isInstallPromptSnoozed,
  isStandalone,
  logPwaInstallIfStandalone,
  showInstallDialog,
  snoozeInstallPrompt,
  subscribeInstallPrompt,
} from '../utils/installPrompt';

// The card's markup is deliberately NOT in the entry bundle. This gate is
// mounted app-wide but the overwhelming majority of traffic is public
// marketplace visitors who never qualify, so the UI only gets fetched once the
// decision to show it has already been made.
const InstallPromptCard = lazy(() => import('./InstallPromptCard'));

// Deliberately the INVERSE of ConsentBanner's gate. Installing is worth real
// money to someone who opens this app every day — a dealer or salesman gets an
// icon, full screen and no address bar — and worth close to nothing to a buyer
// browsing one car on the public marketplace. Nagging 100% of marketplace
// traffic to install a dealership CRM would be pure annoyance, so the
// invitation only appears on the authenticated panels.
//
// Excluded on purpose: '/login', '/auth', '/reset-password' and every
// onboarding route (never interrupt a signup), and '/account' (buyer-side,
// public surface).
//
// '/platform' WAS excluded here as "the isolated superadmin console". That
// reasoning confused two different things: the console is isolated in its AUTH
// (its own supabase session), which says nothing about whether the person
// holding it wants the app on their phone. The consequence was a closed loop —
// iOS only permits web push to an installed PWA, so an owner running the
// console from an iPhone was never invited to install, could therefore never
// grant push, and every notify_ops() alert (new signup, listing awaiting
// review, KYC submitted, error spikes) had nowhere to land. Measured
// 2026-09-12: superadmin held zero push subscriptions while sellers held 11.
// The admin is the single user most dependent on alerts arriving while the app
// is shut.
const APP_PREFIXES = [
  '/dashboard', '/salesman', '/salesman-lite', '/salesman-premium',
  '/manager', '/accountant', '/fi', '/admin', '/accounts', '/platform',
];

// Long enough that the card never competes with the panel's own first paint or
// its data-loading skeletons.
const REVEAL_DELAY_MS = 2500;

export default function InstallPrompt() {
  const { pathname, search } = useLocation();
  const [deferred, setDeferred] = useState(getDeferredPrompt);
  const [visible, setVisible] = useState(false);

  // `?install=1` re-opens the invitation for someone who has already dismissed
  // it. Dismissal snoozes for 30 DAYS in this device's localStorage, which is
  // unreachable on a phone without a debugger — so "it doesn't show on mobile"
  // is indistinguishable from "I tapped Not now once, weeks ago", and neither
  // the owner nor anyone testing a fix could tell the two apart or reset it.
  // Only lifts the snooze: an installed app and an in-app webview still get
  // nothing, because in those cases the card is wrong rather than snoozed.
  const forceShow = useMemo(() => new URLSearchParams(search).has('install'), [search]);

  // Environment facts, not state — none of these change within a session, and
  // the snooze is only ever written by this component (which hides itself in
  // the same tick), so reading it once is correct.
  const eligible = useMemo(
    () => !isStandalone() && !isInAppBrowser() && (forceShow || !isInstallPromptSnoozed()),
    [forceShow],
  );
  const iosSafari = useMemo(() => isIOSSafari(), []);

  // The event may have been captured at module scope before this mounted, and
  // may also arrive later — getDeferredPrompt() above covers the first case,
  // this covers the second.
  useEffect(() => subscribeInstallPrompt(setDeferred), []);

  const onAppRoute = matchesPathPrefix(pathname, APP_PREFIXES);
  const mode = deferred ? 'native' : (iosSafari ? 'ios' : null);

  // Credits an install the first time this device is seen running standalone
  // on an app route — the only signal iOS gives us (see installPrompt.js).
  // Gated to app routes so a buyer who somehow installed from the marketplace
  // doesn't get counted in what this metric is meant to represent (operator
  // adoption), matching the scoping rationale above.
  useEffect(() => {
    if (onAppRoute) logPwaInstallIfStandalone();
  }, [onAppRoute]);

  useEffect(() => {
    if (!eligible || !onAppRoute || !mode) { setVisible(false); return undefined; }
    const t = setTimeout(() => setVisible(true), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible, onAppRoute, mode]);

  if (!visible || !mode) return null;

  const dismiss = () => { snoozeInstallPrompt(); setVisible(false); };

  const install = async () => {
    await showInstallDialog();
    // Single-use event: whether they accepted or backed out, this session is
    // done asking. 'appinstalled' snoozes too, but a dismissal has no event.
    snoozeInstallPrompt();
    setVisible(false);
  };

  return (
    <Suspense fallback={null}>
      <InstallPromptCard mode={mode} onInstall={install} onDismiss={dismiss} />
    </Suspense>
  );
}
