import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { ensureBuyerProfile } from '../lib/buyerAuth';
import { isSubdomain } from '../hooks/useTenant';

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

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';
const DISMISS_KEY = 'xdrive_onetap_dismissed_at';
const DISMISS_WINDOW = 24 * 60 * 60 * 1000; // don't nag for 24h after a dismissal

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById('gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.id = 'gsi-client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Google validates a *hashed* nonce; signInWithIdToken needs the raw one.
async function makeNonce() {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

export default function GoogleOneTap() {
  const started = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || started.current) return;
    if (isSubdomain()) return; // marketplace only, not dealer storefronts
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
        cancel_on_tap_outside: true,
        context: 'signin',
        callback: async (response) => {
          if (!response?.credential) return;
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: raw,
          });
          if (error) { console.warn('[GoogleOneTap]', error.message); return; }
          // One Tap sets the session directly (no /auth/callback), so materialise
          // the buyer profile here, then refresh so auth-aware UI updates.
          await ensureBuyerProfile(data.user);
          window.location.reload();
        },
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isSkippedMoment?.() || notification.isDismissedMoment?.()) {
          try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
        }
      });
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
