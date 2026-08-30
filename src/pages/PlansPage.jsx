import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import PlanCard from '../components/onboarding/PlanCard';
import { SALESMAN_PLANS, DEALER_PLANS } from '../utils/plans';
import { supabase } from '../supabaseClient';
import { ensureBuyerProfile } from '../lib/buyerAuth';

/*
 * The one place a seller picks what they are signing up for.
 *
 * Before this, "create an account" had four different answers: /signup,
 * /register and /onboarding all redirected straight into Salesman Lite signup
 * (App.jsx), the header's Get Started menu went somewhere else again, and the
 * dealer tiers only existed on /shiftos#pricing. So the default outcome of
 * tapping "create an account" was becoming a Salesman Lite seller without ever
 * being asked — which is how a buyer ended up in a seller dashboard.
 *
 * SELLERS ONLY, on purpose. There is no buyer card here. A plan is something
 * with a price or a cap and buying a car has neither; a free "Buyer" card next
 * to RM1,199 Dealer Pro turns browsing into a tier and re-asks the "which one
 * am I?" question the merged sign-in door just removed. Buyers get the exit
 * line at the bottom instead, and are only asked to identify themselves when
 * they need something kept (see useSavedCars, BuyerPushPrompt).
 *
 * Two routes render this: /plans (public, from every "start selling" CTA) and
 * /choose-plan (after a Google sign-in that carried no plan). The only
 * difference is the exit line — a signed-in visitor arrived holding a seller
 * stub profile, so leaving has to rewrite that stub to a real buyer, or the
 * stub is what routes them into seller surfaces tomorrow.
 */
export default function PlansPage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data?.session?.user));
    });
    return () => { alive = false; };
  }, []);

  const notSelling = async () => {
    if (busy) return;
    if (!signedIn) { navigate('/cars'); return; }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) await ensureBuyerProfile(data.session.user);
    } catch {
      /* fall through — /account's own guard re-checks and bounces if needed */
    }
    // Full navigation, not navigate(): the header resolves the role once on
    // mount, and this just changed it.
    window.location.href = '/account';
  };

  const gutter = 'clamp(20px, 4vw, 48px)';

  const section = (title, blurb, plans, cols) => (
    <section style={{ marginBottom: 48 }}>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)', marginBottom: 6,
      }}>{title}</p>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 20, maxWidth: 620, lineHeight: 1.5 }}>
        {blurb}
      </p>
      <div className={`plans-grid plans-grid-${cols}`}>
        {plans.map((p) => (
          <PlanCard key={p.tier} plan={p} current={false} onSelect={(route) => navigate(route)} />
        ))}
      </div>
    </section>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#08090f', fontFamily: "'Outfit', sans-serif" }}>
      <Helmet>
        <title>Plans &amp; Pricing | XDrive</title>
        <meta name="description" content="Sell cars on XDrive. Free for individual salesmen, RM35/month for Premium, dealer plans from RM299/month with a 14-day free trial." />
        <link rel="canonical" href="https://xdrive.my/plans" />
      </Helmet>

      <style>{`
        .plans-grid { display: grid; gap: 16px; }
        .plans-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .plans-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-width: 900px) { .plans-grid-3 { grid-template-columns: 1fr; } }
        @media (max-width: 760px) { .plans-grid-2 { grid-template-columns: 1fr; } }
      `}</style>

      <MarketplaceHeader />

      <main style={{ maxWidth: 1360, margin: '0 auto', padding: `48px ${gutter} 72px` }}>
        <header style={{ marginBottom: 40, maxWidth: 720 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(220,38,38,0.8)', marginBottom: 12,
          }}>Plans</p>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(38px, 8vw, 72px)',
            lineHeight: 0.95, letterSpacing: '0.02em', color: '#ffffff', margin: 0,
          }}>Start selling on XDrive</h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginTop: 16, lineHeight: 1.6 }}>
            Pick how you sell. You can change plan later without losing your
            listings — switching only restarts that product&apos;s setup.
          </p>
        </header>

        {section(
          'For individual salesmen and agents',
          'You sell cars yourself, under your own name. Your listings go live on the marketplace and enquiries come straight to you.',
          SALESMAN_PLANS, 2,
        )}

        {section(
          'For dealerships',
          'You run a lot and a team. Adds the dealer dashboard, a shared lead pipeline, stock and profit tracking, and seats for your salesmen.',
          DEALER_PLANS, 3,
        )}

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, marginTop: 8,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Not selling anything?
          </p>
          <button
            type="button"
            onClick={notSelling}
            disabled={busy}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8,
              padding: '10px 16px', color: '#ffffff', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer', fontFamily: "'Outfit', sans-serif",
            }}
          >
            {busy ? 'One moment…' : "I'm just here to buy a car"}
          </button>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            Browsing, saving and messaging sellers are free and need no plan.
          </p>
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
