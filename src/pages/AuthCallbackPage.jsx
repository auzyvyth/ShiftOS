import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthCallbackPage() {
  useEffect(() => {
    const handle = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('no_session');

        const { data: profile } = await supabase
          .from('profiles')
          .select('subdomain, role, dealer_id, onboarding_complete')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile || profile.onboarding_complete === false) {
          window.location.href = '/onboarding';
          return;
        }

        const { role, subdomain, dealer_id } = profile;

        if (role === 'superadmin' || role === 'dealer') {
          if (subdomain) {
            const accessToken = session.access_token;
            const refreshToken = session.refresh_token;
            window.location.href = `https://${subdomain}.xdrive.my?access_token=${accessToken}&refresh_token=${refreshToken}`;
          } else {
            window.location.href = '/dashboard';
          }
        } else if (role === 'salesman') {
          window.location.href = dealer_id ? '/salesman' : '/salesman-lite';
        } else {
          window.location.href = '/salesman';
        }
      } catch {
        window.location.href = '/login?error=auth_failed';
      }
    };

    handle();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cb-root { min-height: 100vh; background: #080C14; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; font-family: 'DM Sans', sans-serif; }
        .cb-brand { display: flex; align-items: center; gap: 10px; color: #fff; }
        .cb-icon { width: 36px; height: 36px; background: #dc2626; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; }
        .cb-name { font-family: 'Bebas Neue', sans-serif; letter-spacing: 3px; font-size: 32px; line-height: 1; }
        .cb-label { font-family: 'Bebas Neue', sans-serif; letter-spacing: 3px; font-size: 18px; color: rgba(255,255,255,0.35); }
        .cb-dots span { animation: blink 1.4s infinite both; color: #dc2626; font-size: 28px; }
        .cb-dots span:nth-child(2) { animation-delay: .2s; }
        .cb-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%,80%,100% { opacity:0; } 40% { opacity:1; } }
      `}</style>
      <div className="cb-root">
        <div className="cb-brand">
          <span className="cb-icon">S</span>
          <span className="cb-name">ShiftOS</span>
        </div>
        <div className="cb-dots">
          <span>·</span><span>·</span><span>·</span>
        </div>
        <p className="cb-label">SIGNING YOU IN</p>
      </div>
    </>
  );
}
