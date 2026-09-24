import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { handoffSuffix } from '../lib/authHandoff';
import { consumeBuyerIntent, consumeBuyerConsent, ensureBuyerProfile } from '../lib/buyerAuth';

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, subdomain, dealer_id, onboarding_complete, plan, full_name, ic_number, dealership')
        .eq('id', session.user.id)
        .maybeSingle();

      // Did this auth flow start as a buyer? (marketplace buyer login/One Tap, or
      // a buyer signup whose user metadata carries account_type=buyer.)
      const buyerIntent = consumeBuyerIntent() || session.user?.user_metadata?.account_type === 'buyer';
      // Ticked on the buyer auth page before we redirected out to Google / the email
      // link. This is the only point where the profile row gets created for those
      // flows, so it is the only place the consent can be recorded.
      const buyerConsent = consumeBuyerConsent();

      // A marketplace engagement button (save alert / write review / ask a
      // question) stashes the page the buyer was on in post_auth_return so we can
      // return them there after sign-in instead of dumping them on /account and
      // losing their pending action. Read-and-clear; only honor a same-origin URL
      // so a poisoned value can't become an open redirect. Falls back to /account.
      const buyerDest = () => {
        let dest = '/account';
        try {
          const raw = sessionStorage.getItem('post_auth_return');
          sessionStorage.removeItem('post_auth_return');
          if (raw) {
            const u = new URL(raw, window.location.origin);
            if (u.origin === window.location.origin) dest = u.pathname + u.search + u.hash;
          }
        } catch { /* ignore */ }
        return dest;
      };

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

      const { role, subdomain, dealer_id } = profile;

      // Platform superadmin has its own console (/platform) — never a dealer
      // dashboard or a subdomain. Mirror LoginPage.redirectByRole so every auth
      // method (password, Google, magic link) agrees on where superadmin lands.
      if (role === 'superadmin') {
        navigate('/platform');
        return;
      }

      // Brand-new, context-less seller sign-in (e.g. the /login "Continue with
      // Google" button): the trigger left a default dealer stub with zero
      // onboarding progress, and there was no buyer intent (returned above) and no
      // onboarding intent (override above). Rather than dumping them into the
      // dealer flow, send them to the salesman plan chooser. Guarded to a BARE stub
      // (no name/IC/dealership) so a dealer who is mid-onboarding still resumes
      // /dealer-onboarding instead of being bounced to the chooser.
      const bareStub =
        profile.onboarding_complete === false &&
        !subdomain &&
        !profile.full_name &&
        !profile.ic_number &&
        !profile.dealership &&
        ['dealer', 'owner', 'salesman'].includes(role);
      if (bareStub) {
        navigate('/choose-plan');
        return;
      }

      // Incomplete onboarding — route back to the correct onboarding page.
      // A dealer with a subdomain has completed onboarding regardless of the flag —
      // use subdomain as the authoritative signal to prevent flag drift locking users out.
      if (role === 'dealer' && profile.onboarding_complete === false && !subdomain) {
        navigate('/dealer-onboarding');
        return;
      }

      if (role === 'salesman' && profile.onboarding_complete === false) {
        // Preserve the premium tier across a mid-onboarding re-auth. Without the
        // tier param the onboarding page defaults to lite and silently downgrades
        // a premium signup back to the free plan.
        const savedPlan = session.user?.user_metadata?.tier || profile.plan;
        const isPremium = savedPlan === 'premium' || savedPlan === 'salesman_full';
        navigate(isPremium ? '/salesman-onboarding/premium' : '/salesman-onboarding');
        return;
      }

      if (role === 'dealer') {
        // Cross-subdomain handoff only makes sense on the real domain — a
        // Vercel preview/localhost has no dealer subdomains to jump to, and
        // doing it anyway leaves the preview build entirely (lands on real
        // prod). Mirrors LoginPage.jsx's isProd guard.
        const isProd = window.location.hostname === 'xdrive.my' || window.location.hostname.endsWith('.xdrive.my');
        if (subdomain && isProd) {
          window.location.href = `https://${subdomain}.xdrive.my/dashboard${handoffSuffix(session)}`;
        } else {
          navigate('/dashboard');
        }
      } else if (role === 'salesman') {
        const target = dealer_id ? 'salesman' : 'salesman-lite';
        window.location.href = `https://xdrive.my/${target}${handoffSuffix(session)}`;
      } else if (role === 'manager') {
        navigate('/manager');
      } else if (role === 'accountant') {
        navigate('/accountant');
      } else if (role === 'fi_officer') {
        navigate('/fi');
      } else if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'buyer') {
        navigate(buyerDest());
      } else {
        navigate('/salesman');
      }
    };

    // Bail out immediately if Supabase already signalled an error in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (urlParams.get('error') || hashParams.get('error')) {
      window.location.href = '/login?error=auth_failed';
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
      } catch {
        window.location.href = '/login?error=auth_failed';
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
      window.location.href = '/login?error=auth_failed';
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
