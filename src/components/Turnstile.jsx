import React, { useEffect, useRef } from 'react';

// Cloudflare Turnstile proof-of-human widget for public write forms (ContactGate,
// enquiry modal). Rendered in `interaction-only` mode: invisible and frictionless
// for real buyers, only surfacing a challenge to suspicious traffic. The token it
// produces is verified server-side in the /api routes (lib/turnstile.js).
//
// No-ops (renders nothing) when VITE_TURNSTILE_SITE_KEY is unset so local dev and
// pre-setup prod keep working; the server verify then fails open to match.

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;
function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('turnstile script failed to load')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Props: onToken(token|null) — fired with a fresh token on solve, null on expiry/error.
export default function Turnstile({ onToken, action, className }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  // Always call the latest onToken without re-rendering the widget.
  const cbRef = useRef(onToken);
  cbRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        if (widgetId.current !== null) return; // guard StrictMode double-mount
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          size: 'flexible',
          action: action || undefined,
          callback: (t) => cbRef.current?.(t),
          'expired-callback': () => cbRef.current?.(null),
          'error-callback': () => cbRef.current?.(null),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
      }
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className={className} />;
}
