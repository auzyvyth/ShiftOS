import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getPlanConfig } from '../utils/planConfig';
import { liveChannel } from "../lib/liveChannel";
import { useTranslation } from 'react-i18next';

// Shown to a dealer whose paid signup is complete but awaiting payment
// confirmation. Used both right after onboarding and as the dashboard gate.
// When an admin marks payment_status != 'pending' (AdminPage "mark received"),
// the realtime subscription auto-forwards them into the dashboard.
export default function DealerPendingApproval({ planKey, dealershipName, email, profileId, redirectTo = '/dashboard', variant = 'payment', trialDays = 14 }) {
  const { t } = useTranslation();
  const cfg = getPlanConfig(planKey);
  const amount = cfg?.price ? `RM ${Number(cfg.price).toLocaleString('en-MY')}` : '';
  const reference = dealershipName || email || '';
  const expired = variant === 'expired';

  useEffect(() => {
    if (!profileId) return;
    const ch = liveChannel(supabase, 'dealer-approval-' + profileId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` },
        (payload) => {
          // Forward on either activation path: payment confirmed (QR flow)
          // or subscription flipped active (expired-trial renewal — the row
          // may have no payment_status at all).
          const paid = payload.new?.payment_status && payload.new.payment_status !== 'pending';
          const activated = payload.new?.subscription_status === 'active';
          if (paid || activated) {
            window.location.href = redirectTo;
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profileId, redirectTo]);

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
    <div style={{ minHeight: '100vh', background: '#070A12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: "system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
        <div style={{ width: 30, height: 30, background: '#dc2626', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>X</div>
        <img src="/drevo-logo-white.png" alt="Drevo" width="688" height="120" style={{ height: 20, width: 'auto', display: 'block' }} />
      </div>

      <div style={box}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.9)', margin: '0 0 12px', fontWeight: 600 }}>
          {expired ? t("pending.freeTrialEnded") : t("pending.awaitingPaymentConfirmation")}
        </p>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 2, color: '#E8EDF5', lineHeight: 1.05, marginBottom: 8 }}>
          {expired ? t("pending.keepYourDashboard") : t("pending.almostThere")}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.7, margin: '0 0 22px' }}>
          {expired
            ? t("pending.expiredMsg", { days: trialDays, plan: cfg?.label ? ` ${cfg.label}` : '' })
            : t("pending.payMsg", { forPlan: cfg?.label ? t("pending.forPlan", { label: cfg.label }) : '' })}
        </p>

        {amount && (
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
            <span style={{ color: '#F0F0F0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{amount}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: 600 }}>/ month</span>
          </div>
        )}

        {/* DuitNow / bank QR — canonical asset at public/payment-qr.png */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 10, width: 250, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src="/payment-qr.png"
            alt={t("pending.scanToPayWithAny")}
            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.innerHTML =
                '<div style="color:#111;font-size:12px;font-weight:600;text-align:center;line-height:1.6;padding:10px">Payment QR<br/>coming soon<br/><span style="color:#6b7280;font-weight:400">Contact us on WhatsApp<br/>to complete payment</span></div>';
            }}
          />
        </div>

        {reference && (
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '0 0 20px' }}>
            {t("pending.paymentReference")} <span style={{ color: '#E8EDF5', fontWeight: 600 }}>{reference}</span>
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          style={{ width: '100%', height: 46, background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: 10 }}
        >
          {t("pending.iVePaidCheckStatus")}
        </button>
        <button
          onClick={logout}
          style={{ width: '100%', height: 44, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          {t("pending.logOut")}
        </button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 20, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        {t("pending.thisPageUpdatesAutomaticallyOnce")}
      </p>
    </div>
  );
}
