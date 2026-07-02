import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getPlanConfig } from '../utils/planConfig';

// Shown to a dealer whose paid signup is complete but awaiting payment
// confirmation. Used both right after onboarding and as the dashboard gate.
// When an admin marks payment_status != 'pending' (AdminPage "mark received"),
// the realtime subscription auto-forwards them into the dashboard.
export default function DealerPendingApproval({ planKey, dealershipName, email, profileId }) {
  const cfg = getPlanConfig(planKey);
  const amount = cfg?.price ? `RM ${Number(cfg.price).toLocaleString('en-MY')}` : '';
  const reference = dealershipName || email || '';

  useEffect(() => {
    if (!profileId) return;
    const ch = supabase
      .channel('dealer-approval-' + profileId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` },
        (payload) => {
          if (payload.new?.payment_status && payload.new.payment_status !== 'pending') {
            window.location.href = '/dashboard';
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profileId]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const box = {
    width: 'min(440px, 92%)',
    background: '#0d1420',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '32px 28px',
    textAlign: 'center',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#070A12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
        <div style={{ width: 30, height: 30, background: '#dc2626', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>X</div>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color: '#E8EDF5' }}>SHIFTOS</span>
      </div>

      <div style={box}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.9)', margin: '0 0 12px', fontWeight: 600 }}>
          Awaiting Payment Confirmation
        </p>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 2, color: '#E8EDF5', lineHeight: 1.05, marginBottom: 8 }}>
          ALMOST THERE
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.7, margin: '0 0 22px' }}>
          Scan the QR to pay{cfg?.label ? ` for ${cfg.label}` : ''}. We'll activate your dashboard as soon as we confirm payment.
        </p>

        {amount && (
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
            <span style={{ color: '#F0F0F0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{amount}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: 600 }}>/ month</span>
          </div>
        )}

        {/* DuitNow / bank QR — drop your real QR at public/payment-qr.png */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 14, width: 220, height: 220, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src="/payment-qr.png"
            alt="Scan to pay"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.innerHTML =
                '<div style="color:#111;font-size:12px;font-weight:600;text-align:center;line-height:1.6;padding:10px">Payment QR<br/>coming soon<br/><span style="color:#6b7280;font-weight:400">Contact us on WhatsApp<br/>to complete payment</span></div>';
            }}
          />
        </div>

        {reference && (
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '0 0 20px' }}>
            Payment reference: <span style={{ color: '#E8EDF5', fontWeight: 600 }}>{reference}</span>
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          style={{ width: '100%', height: 46, background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: 10 }}
        >
          I've Paid — Check Status
        </button>
        <button
          onClick={logout}
          style={{ width: '100%', height: 44, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 20, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        This page updates automatically once your payment is confirmed.
      </p>
    </div>
  );
}
