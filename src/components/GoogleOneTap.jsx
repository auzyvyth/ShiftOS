import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { reportAuthFailure } from '../utils/authErrors';
import { supabase } from '../supabaseClient';
import { ensureBuyerProfile, markBuyerIntent } from '../lib/buyerAuth';
import { isSubdomain } from '../hooks/useTenant';
import { GOOGLE_CLIENT_ID, isEmbeddedBrowser, loadGsi, makeNonce } from '../lib/googleIdentity';

// Google One Tap sign-in for new, signed-out marketplace visitors.
//
// Requires a Google OAuth *Web* client ID exposed to the frontend as
// VITE_GOOGLE_CLIENT_ID (the same client used by the Supabase Google provider).
// When the env var is absent the component is a no-op, so it ships safely and
// "turns on" once the client ID is configured in the hosting environment.
//
// Setup checklist (one-time, outside the code):
//   1. Vercel env: VITE_GOOGLE_CLIENT_ID=<google web client id>
//   2. Google Cloud console -> Credentials -> the Web client -> add the site
//      origin (https://xdrive.my) to "Authorised JavaScript origins".
//   3. Supabase -> Auth -> Providers -> Google -> add the same client ID under
//      "Authorized Client IDs" so signInWithIdToken accepts the One Tap token.

const CLIENT_ID = GOOGLE_CLIENT_ID;
const DISMISS_KEY = 'xdrive_onetap_dismissed_at';
const DISMISS_WINDOW = 24 * 60 * 60 * 1000; // don't nag for 24h after a dismissal

export default function GoogleOneTap() {
  const started = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || started.current) return;
    if (isSubdomain()) return; // marketplace only, not dealer storefronts
    if (isEmbeddedBrowser()) return; // see isEmbeddedBrowser() in lib/googleIdentity.js
    started.current = true;
    let cancelled = false;

    (async () => {
      // Signed-out visitors only.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || session) return;

      // Respect a recent manual dismissal so we don't pester returning visitors.
      try {
        const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (at && Date.now() - at < DISMISS_WINDOW) return;
      } catch { /* ignore storage errors */ }

      const { raw, hashed } = await makeNonce();
      try { await loadGsi(); } catch { return; }
      if (cancelled || !window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: hashed,
        auto_select: false,
        // Keep the prompt alive when the visitor clicks elsewhere on the page
        // (e.g. the cookie banner's "Accept"): an outside click used to dismiss
        // One Tap AND bank a 24h cooldown, so tapping the cookie banner killed
        // the sign-in prompt for a full day. The visitor closes it with its own
        // ✕ instead.
        cancel_on_tap_outside: false,
        context: 'signin',
        // Google made FedCM mandatory for One Tap in current Chrome — without
        // this flag the prompt is silently suppressed on up-to-date browsers
        // (the "it just doesn't show" symptom). Opt in so it renders.
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          if (!response?.credential) return;
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: raw,
          });
          // The ID-token path can reject if the nonce or the Supabase "Authorized
          // Client IDs" list is out of sync — which used to make the tap silently
          // do nothing. Fall back to the standard OAuth redirect (the exact flow
          // /buyer-login uses) so the user still gets signed in.
          if (error || !data?.session) {
            if (error) console.warn('[GoogleOneTap]', error.message);
            markBuyerIntent(); // /auth/callback materialises a buyer profile -> /account
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            return;
          }
          // One Tap sets the session directly (no /auth/callback), so materialise
          // the buyer profile here — but do NOT navigate. signInWithIdToken fires
          // onAuthStateChange, which MarketplaceHeader listens to and uses to swap
          // "Sign In" for a "My Account" link in place. The visitor stays on the
          // page they were browsing and reaches their dashboard from the header
          // whenever they want (the old forced redirect to /account yanked them
          // off the listing they were on — the opposite of the intended UX).
          try {
            await ensureBuyerProfile(data.user);
          } catch (err) {
            console.error('[GoogleOneTap] buyer profile setup failed:', err);
            reportAuthFailure('onetap_profile_setup', err);
            toast.error("You're signed in, but we couldn't finish setting up your account.", {
              description: 'Open My Account from the top-right menu to try again.',
            });
          }
          // The header resolved the role on SIGNED_IN, which fired before the
          // line above rewrote the trigger's default 'dealer' stub to 'buyer' —
          // so it briefly showed a "Dashboard" link to /dashboard (which then
          // bounces a buyer to /account). Now that the profile is corrected,
          // tell the header to re-resolve so it shows "My Account" straight away.
          window.dispatchEvent(new Event('xdrive:auth-refreshed'));
          const name =
            data.user?.user_metadata?.full_name ||
            data.user?.user_metadata?.name ||
            '';
          toast.success(name ? `Signed in as ${name}` : 'Signed in', {
            description: 'Your account is in the top-right menu whenever you need it.',
          });
        },
      });

      window.google.accounts.id.prompt((notification) => {
        // Under FedCM several of these moment-inspection methods are deprecated
        // and can throw — guard so dismissal tracking never breaks the prompt.
        try {
          if (notification.isSkippedMoment?.() || notification.isDismissedMoment?.()) {
            try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
          }
        } catch { /* FedCM: moment inspection unsupported — ignore */ }
      });
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
