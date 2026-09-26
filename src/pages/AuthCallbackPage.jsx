import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { resolvePostAuthRoute, goPostAuth, POST_AUTH_COLUMNS } from '../utils/postAuthRoute';
import { reportAuthFailure } from '../utils/authErrors';
import { consumeBuyerIntent, consumeBuyerConsent, ensureBuyerProfile, consumePostAuthReturn } from '../lib/buyerAuth';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const routeSession = async (session) => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const type = params.get('type') || hashParams.get('type');

      if (type === 'recovery') {
        navigate('/reset-password');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`id, ${POST_AUTH_COLUMNS}`)
        .eq('id', session.user.id)
        .maybeSingle();
      // A failed read is NOT "no profile": treating it as one sends an existing
      // dealer into the signup wizard. Stop and say so instead.
      if (profileError) throw profileError;

      // Did this auth flow start as a buyer? (marketplace buyer login/One Tap, or
      // a buyer signup whose user metadata carries account_type=buyer.)
      const buyerIntent = consumeBuyerIntent() || session.user?.user_metadata?.account_type === 'buyer';
      // Ticked on the buyer auth page before we redirected out to Google / the email
      // link. This is the only point where the profile row gets created for those
      // flows, so it is the only place the consent can be recorded.
      const buyerConsent = consumeBuyerConsent();

      // A marketplace button (save alert / write review / Find me post) stashes
      // the page the buyer was on so they land back there, not on /account.
      const buyerDest = () => consumePostAuthReturn();

      // No profile at all → brand new user. A buyer goes straight to their account;
      // everyone else falls through to seller onboarding.
      if (!profile) {
        if (buyerIntent) {
          await ensureBuyerProfile(session.user, { consent: buyerConsent });
          navigate(buyerDest());
          return;
        }
        // Resume the correct onboarding flow. Prefer the account_type/plan saved
        // on the user's metadata at signup (travels with the account, so it works
        // even when the email is confirmed on a different device); fall back to
        // sessionStorage for same-device OAuth redirects.
        const meta = session.user?.user_metadata || {};
        const savedPlan = meta.tier || sessionStorage.getItem("ob_plan_slug");
        const acctType = meta.account_type || sessionStorage.getItem("ob_account_type");
        sessionStorage.removeItem("ob_plan_slug");
        sessionStorage.removeItem("ob_account_type");

        if (acctType === 'salesman') {
          navigate(`/salesman-onboarding/${savedPlan === 'premium' ? 'premium' : 'lite'}`);
        } else if (acctType === 'dealer') {
          navigate(`/dealer-onboarding/${['starter', 'growth', 'pro'].includes(savedPlan) ? savedPlan : 'starter'}`);
        } else if (savedPlan === 'lite' || savedPlan === 'premium') {
          navigate(`/salesman-onboarding/${savedPlan}`);
        } else if (savedPlan === 'starter' || savedPlan === 'growth' || savedPlan === 'pro') {
          navigate(`/dealer-onboarding/${savedPlan}`);
        } else {
          // Unknown context — a plain "Continue with Google" on the merged
          // sign-in door, with nothing saying what this person came to do. Ask
          // instead of guessing: /choose-plan offers the salesman plans AND an
          // "I'm just here to buy a car" exit. This used to go to /onboarding,
          // which App.jsx redirects to /salesman-onboarding/lite — so a shopper
          // was silently walked into the salesman signup wizard.
          navigate('/choose-plan');
        }
        return;
      }

      // A buyer-intent sign-in where the trigger pre-stamped a default dealer stub:
      // correct it to a buyer profile and route to /account, never a dealer panel.
      if (buyerIntent) {
        const role = await ensureBuyerProfile(session.user, { consent: buyerConsent });
        if (role === 'buyer') { navigate(buyerDest()); return; }
      }

      // Onboarding-intent override. The handle_new_user trigger stamps a default
      // role='dealer' stub the instant the auth user is created, so a SALESMAN who
      // signed up with Google has a dealer stub by the time we get here — which
      // would otherwise fall through to the dealer branch below and dump them in
      // dealer onboarding. Honor the intent saved on the account (user_metadata,
      // survives cross-device email confirm) or sessionStorage (same-device OAuth)
      // and resume the RIGHT flow + tier. Guarded to un-onboarded stubs so a real
      // onboarded dealer is never hijacked. Mirrors the !profile resume block above.
      {
        const meta = session.user?.user_metadata || {};
        const obAcct = meta.account_type || sessionStorage.getItem('ob_account_type');
        const obPlan = meta.tier || sessionStorage.getItem('ob_plan_slug');
        const unonboardedStub =
          profile.onboarding_complete === false &&
          !profile.subdomain &&
          ['dealer', 'owner', 'salesman'].includes(profile.role);
        if (unonboardedStub && (obAcct === 'salesman' || obAcct === 'dealer')) {
          sessionStorage.removeItem('ob_plan_slug');
          sessionStorage.removeItem('ob_account_type');
          if (obAcct === 'salesman') {
            navigate(`/salesman-onboarding/${obPlan === 'premium' ? 'premium' : 'lite'}`);
          } else {
            navigate(`/dealer-onboarding/${['starter', 'growth', 'pro'].includes(obPlan) ? obPlan : 'starter'}`);
          }
          return;
        }
      }

      const { role } = profile;

      // Everything else goes through the one shared router
      // (utils/postAuthRoute.js), which also sends a context-less bare signup
      // stub to /choose-plan. This page's own copy sent every standalone rep to
      // /salesman-lite (Premium was forwarded a second later) and hardcoded
      // https://xdrive.my, so a Google sign-in on staging landed on production.
      goPostAuth(resolvePostAuthRoute(profile, {
        session,
        buyerHome: role === 'buyer' ? buyerDest() : '/account',
        premiumHint: session.user?.user_metadata?.tier === 'premium',
      }), navigate);
    };

    // Bail out immediately if Supabase already signalled an error in the URL
    // Every failure below lands on /login with a short reason, and LoginPage
    // shows it (utils/authErrors callbackFailureMessage). It used to send a
    // bare ?error=auth_failed that nothing read, so a dead magic link or a
    // cancelled Google sign-in dropped people on a plain form with no hint.
    const fail = (reason) => {
      window.location.href = `/login?error=auth_failed&reason=${encodeURIComponent(reason)}`;
    };
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (urlParams.get('error') || hashParams.get('error')) {
      const code = urlParams.get('error_code') || hashParams.get('error_code') || urlParams.get('error') || hashParams.get('error');
      const description = urlParams.get('error_description') || hashParams.get('error_description') || '';
      console.error('[AuthCallbackPage] provider error:', code, description);
      // A cancelled Google prompt or a dead/used link is the person's doing;
      // anything else (bad OAuth config, server_error) is ours to hear about.
      if (!['access_denied', 'otp_expired'].includes(code)) {
        reportAuthFailure('callback_provider', { message: description || code, code });
      }
      fail(code);
      return;
    }

    let handled = false;
    let subscription;
    let fallbackTimer;

    const finish = async (session) => {
      if (handled || !session) return; // route exactly once, only with a session
      handled = true;
      subscription?.unsubscribe();
      clearTimeout(fallbackTimer);
      try {
        await routeSession(session);
      } catch (err) {
        console.error('[AuthCallbackPage] routing failed:', err);
        reportAuthFailure('callback_profile', err);
        fail('profile');
      }
    };

    // Catch the session NO MATTER WHEN it lands. detectSessionInUrl can finish
    // the PKCE code exchange BEFORE this effect subscribes — in that case the new
    // listener never receives SIGNED_IN, only INITIAL_SESSION (already carrying the
    // session). Listening for SIGNED_IN alone is a race that hangs until the 10s
    // timeout fires -> ?error=auth_failed (this is exactly what broke Google
    // sign-in on the Vercel preview). So act on every event that can carry a live
    // session, and additionally read it directly in case we subscribed too late.
    ({ data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY')) {
        finish(session);
      }
    }));

    // Belt-and-suspenders for the same race: if the exchange already completed,
    // grab the session directly instead of waiting for an event we may have missed.
    supabase.auth.getSession().then(({ data }) => finish(data.session)).catch(() => {});

    // Safety net: if no session materialises within 10s, bail out
    fallbackTimer = setTimeout(() => {
      if (handled) return;
      subscription?.unsubscribe();
      // Usually a link opened in a different browser than the one that asked
      // for it. Reported so a spike (or a broken exchange) is visible to us.
      console.error('[AuthCallbackPage] no session after 10s');
      reportAuthFailure('callback_timeout', { message: 'No session within 10s on /auth/callback' });
      fail('timeout');
    }, 10000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080C14',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      fontFamily: "system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes cb-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 36px rgba(220,38,38,0.75), 0 0 60px rgba(220,38,38,0.15); }
        }
        @keyframes cb-blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        .cb-icon { animation: cb-pulse 2.4s ease-in-out infinite; }
        .cb-dot { animation: cb-blink 1.4s infinite both; color: rgba(220,38,38,0.8); }
        .cb-dot:nth-child(2) { animation-delay: 0.2s; }
        .cb-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          className="cb-icon"
          style={{
            width: 34,
            height: 34,
            background: '#dc2626',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          ⚡
        </div>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 26,
          letterSpacing: 4,
          color: '#E8EDF5',
        }}>
          SHIFTOS
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
        <span className="cb-dot" style={{ fontSize: 22 }}>·</span>
        <span className="cb-dot" style={{ fontSize: 22 }}>·</span>
        <span className="cb-dot" style={{ fontSize: 22 }}>·</span>
      </div>

      <p style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 13,
        letterSpacing: 4,
        color: 'rgba(232,237,245,0.3)',
        marginTop: 2,
      }}>
        SIGNING YOU IN
      </p>
    </div>
  );
}
