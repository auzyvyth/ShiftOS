import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

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
        .select('id, role, subdomain, dealer_id, onboarding_complete')
        .eq('id', session.user.id)
        .maybeSingle();

      // No profile at all → brand new user, needs onboarding
      if (!profile) {
        navigate('/onboarding');
        return;
      }

      const { role, subdomain, dealer_id } = profile;

      // Only dealer/superadmin go through onboarding flow.
      // Team roles (manager, accountant, fi_officer, admin, salesman) are created
      // via invites and never set onboarding_complete — don't redirect them.
      if ((role === 'dealer' || role === 'superadmin') && profile.onboarding_complete === false) {
        navigate('/onboarding');
        return;
      }

      if (role === 'dealer' || role === 'superadmin') {
        if (subdomain) {
          const accessToken = session.access_token;
          const refreshToken = session.refresh_token;
          window.location.href = `https://${subdomain}.xdrive.my/dashboard?_at=${accessToken}&_rt=${refreshToken}`;
        } else {
          navigate('/dashboard');
        }
      } else if (role === 'salesman') {
        const at = session.access_token;
        const rt = session.refresh_token;
        const target = dealer_id ? 'salesman' : 'salesman-lite';
        const suffix = at && rt ? `?_at=${at}&_rt=${rt}` : '';
        window.location.href = `https://xdrive.my/${target}${suffix}`;
      } else if (role === 'manager') {
        navigate('/manager');
      } else if (role === 'accountant') {
        navigate('/accountant');
      } else if (role === 'fi_officer') {
        navigate('/fi');
      } else if (role === 'admin') {
        navigate('/admin');
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

    // onAuthStateChange fires as soon as Supabase finishes exchanging
    // the magic link / OAuth hash tokens — more reliable than getSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          clearTimeout(fallbackTimer);
          try {
            await routeSession(session);
          } catch {
            window.location.href = '/login?error=auth_failed';
          }
        }
      }
    );

    // Safety net: if nothing fires within 10s, bail out
    const fallbackTimer = setTimeout(() => {
      subscription.unsubscribe();
      window.location.href = '/login?error=auth_failed';
    }, 10000);

    return () => {
      subscription.unsubscribe();
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
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400&display=swap');
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
