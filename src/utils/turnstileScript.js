// One Cloudflare Turnstile script loader for the whole app.
//
// Two things need Turnstile now and they must not each grow their own copy of
// this (the duplication this repo keeps getting bitten by):
//   - src/components/Turnstile.jsx  — the visible widget on the public write
//     forms (enquiry modal, ContactGate). Its token is verified by OUR server
//     in api/enquiry.js + api/whatsapp-lead.js via lib/turnstile.js.
//   - src/hooks/useAuthCaptcha.js   — the invisible widget for auth calls. Its
//     token is verified by SUPABASE, not by us.
// Same site key, same <script> tag, two different verifiers.
//
// Everything no-ops when VITE_TURNSTILE_SITE_KEY is unset, so local dev and a
// pre-setup prod keep working exactly as they do today.

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;

export function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    // Null the promise so a later caller retries rather than inheriting the
    // failure forever — an ad blocker that dies once may not die twice.
    s.onerror = () => { scriptPromise = null; reject(new Error('turnstile script failed to load')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}
