import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabaseClient';
import { canUseGoogleIdToken, loadGsi, makeNonce, GOOGLE_CLIENT_ID } from '../../lib/googleIdentity';
import {
  ensureBuyerProfile, isRealBuyer, markBuyerIntent, sendBuyerToSignIn, setPostAuthReturn,
} from '../../lib/buyerAuth';
import { reportAuthFailure } from '../../utils/authErrors';

// Sign in WITHOUT leaving the page (owner, 2026-10-14). Opened by
// requestBuyerSignIn() when a signed-out buyer taps "Chat here" or the heart.
// Before this, both sent the buyer to /buyer-login, and after Google they
// could land on a dashboard and have to find the car again.
//
// Google's own button signs in with an ID token in a popup, the same way One
// Tap does on the marketplace home: the session is set right here, the sheet
// closes, and whatever the buyer was doing carries on. Only when that cannot
// work (no client id, an in-app browser, a rejected token) does it fall back to
// the full-page redirect, which returns to `returnUrl`.

const COPY = {
  chat: { title: 'Sign in to chat with the seller', sub: 'Takes a few seconds. You stay on this page and the chat opens right after.' },
  save: { title: 'Sign in to save this car', sub: 'Your saved cars follow you to any device. You stay on this page.' },
};

const C = {
  bg: '#FFFFFF', ink: '#0f1115', text: '#111827', sub: '#6b7280', line: '#e5e7eb',
};

export default function SignInSheet({ reason = 'chat', returnUrl, onDone }) {
  const copy = COPY[reason] || COPY.chat;
  const btnRef = useRef(null);
  const doneRef = useRef(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [gsiFailed, setGsiFailed] = useState(!canUseGoogleIdToken());
  const [busy, setBusy] = useState(false);

  const finish = (ok) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(ok);
  };

  // Overlay rule 2, but stackable: this can open over the Contact sheet, which
  // already locked the page. Restore whatever was there, not ''.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Signed in some other way while the sheet is open (One Tap, another tab):
  // that counts too. Plain callback, never async (see CLAUDE.md, auth lock).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && isRealBuyer(session?.user)) finish(true);
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The full-page Google sign-in, for when the in-page one cannot run.
  const redirectToGoogle = async () => {
    setBusy(true);
    markBuyerIntent();
    setPostAuthReturn(returnUrl);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      reportAuthFailure('signin_sheet_google_redirect', error);
      toast.error("Couldn't start Google sign-in. Please try again.");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (gsiFailed) return;
    let cancelled = false;
    (async () => {
      try {
        const { raw, hashed } = await makeNonce();
        await loadGsi();
        if (cancelled || !window.google?.accounts?.id || !btnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          auto_select: false,
          callback: async (response) => {
            if (!response?.credential) return;
            setBusy(true);
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google', token: response.credential, nonce: raw,
            });
            if (error || !data?.session) {
              // Token rejected (nonce / Supabase client-id list out of sync):
              // the redirect still gets them in, and back to this car.
              if (error) console.warn('[SignInSheet]', error.message);
              redirectToGoogle();
              return;
            }
            try {
              await ensureBuyerProfile(data.user);
            } catch (err) {
              reportAuthFailure('signin_sheet_profile_setup', err);
            }
            window.dispatchEvent(new Event('xdrive:auth-refreshed'));
            const name = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || '';
            toast.success(name ? `Signed in as ${name}` : 'Signed in');
            finish(true);
          },
        });
        const width = Math.min(360, Math.max(220, btnRef.current.offsetWidth || 320));
        window.google.accounts.id.renderButton(btnRef.current, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
          shape: 'rectangular', logo_alignment: 'center', width,
        });
        if (!cancelled) setGsiReady(true);
      } catch (err) {
        console.warn('[SignInSheet] Google button unavailable:', err);
        if (!cancelled) setGsiFailed(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiFailed]);

  const sheet = (
    <div onClick={() => !busy && finish(false)} className="sis-back"
      style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sis-title" className="sis-card"
        style={{ background: C.bg, width: '100%', maxWidth: 440, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', fontFamily: 'var(--xd-font-body)', color: C.text }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="sis-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{copy.title}</h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: C.sub, lineHeight: 1.5 }}>{copy.sub}</p>
          </div>
          <button onClick={() => finish(false)} aria-label="Close" disabled={busy}
            style={{ background: 'none', border: 'none', padding: 4, margin: '-4px -4px 0 0', cursor: 'pointer', color: C.sub, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {busy ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 44, color: C.sub, fontSize: 14 }}>
            <Loader2 size={18} style={{ animation: 'sis-spin 1s linear infinite' }} /> Signing you in…
          </div>
        ) : gsiFailed ? (
          <button onClick={redirectToGoogle}
            style={{ width: '100%', height: 44, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: C.text, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Continue with Google
          </button>
        ) : (
          <div style={{ minHeight: 44, display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div ref={btnRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
            {!gsiReady && <Loader2 size={18} style={{ color: C.sub, animation: 'sis-spin 1s linear infinite', alignSelf: 'center', position: 'absolute' }} />}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: C.line }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.line }} />
        </div>

        <button onClick={() => sendBuyerToSignIn(returnUrl)} disabled={busy}
          style={{ width: '100%', height: 44, borderRadius: 8, border: `1px solid ${C.line}`, background: '#f9fafb', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Use email instead
        </button>

        <p style={{ margin: '14px 0 0', fontSize: 12, color: C.sub, lineHeight: 1.5, textAlign: 'center' }}>
          By continuing you agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener" style={{ color: C.text }}>Terms</a> and{' '}
          <a href="/privacy" target="_blank" rel="noopener" style={{ color: C.text }}>Privacy Policy</a>.
        </p>
      </div>
      <style>{`
        @keyframes sis-spin { to { transform: rotate(360deg); } }
        .sis-card { border-radius: 18px 18px 0 0; }
        @media (min-width: 640px) {
          .sis-back { align-items: center !important; }
          .sis-card { border-radius: 16px; }
        }
      `}</style>
    </div>
  );

  return createPortal(sheet, document.body);
}
