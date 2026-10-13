// Google Identity Services (GIS) plumbing shared by One Tap (GoogleOneTap.jsx)
// and the in-page sign-in sheet (components/auth/SignInSheet.jsx). Both sign in
// with an ID token (supabase.auth.signInWithIdToken), so the page never leaves.
//
// Needs VITE_GOOGLE_CLIENT_ID (the same web client the Supabase Google provider
// uses, also listed under Supabase "Authorized Client IDs").

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

// In-app browsers (Google app, Facebook, Instagram, LINE, Android WebView) do
// not report the page origin the way Chrome does, and Google answers with a
// hard "origin_mismatch" block even when the domain is authorised. There, use
// the plain OAuth redirect instead (a top-level navigation they handle fine).
export function isEmbeddedBrowser() {
  const ua = navigator.userAgent || '';
  return /GSA\/|FBAN|FBAV|Instagram|Line\/|; ?wv\)/i.test(ua);
}

// True when the in-page Google button can be used on this device.
export function canUseGoogleIdToken() {
  return Boolean(GOOGLE_CLIENT_ID) && !isEmbeddedBrowser();
}

export function loadGsi() {
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
export async function makeNonce() {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}
