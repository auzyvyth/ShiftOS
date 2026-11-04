import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import PricingCards from '../components/pricing/PricingCards';
import { DEALER_PLANS, salesmanPricingCards } from '../utils/plans';
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

  // Light page (owner, 2026-11-03): the same PricingCards as /for-salesmen.
  // Dealer cards have no featured card: the seller plans are where the money is now.
  const dealerCards = DEALER_PLANS.map((p) => ({
    key: p.tier, name: p.label, price: p.price.replace(/^RM /, 'RM'), per: p.priceSub,
    desc: p.trial, cta: 'Start free trial', to: p.route, features: [...p.caps.slice(0, 1), ...p.features],
  }));

  const section = (title, blurb, cards) => (
    <section style={{ marginBottom: 56 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 6px', textAlign: 'center' }}>{title}</p>
      <p style={{ fontSize: 15, color: '#6b7280', margin: '0 auto 24px', maxWidth: 560, lineHeight: 1.5, textAlign: 'center' }}>{blurb}</p>
      <PricingCards cards={cards} />
    </section>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'var(--xd-font-body)' }}>
      <Helmet>
        <title>Plans &amp; Pricing | Drevo</title>
        <meta name="description" content="Sell cars on Drevo. Free for individual salesmen, Premium from RM35/month (founding price), dealer plans from RM299/month with a 14-day free trial." />
        <link rel="canonical" href="https://drevo.my/plans" />
      </Helmet>

      <MarketplaceHeader />

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: `56px ${gutter} 72px` }}>
        <header style={{ margin: '0 auto 44px', maxWidth: 720, textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#0b0b0f', margin: 0 }}>
            Pick how you sell
          </h1>
          <p style={{ fontSize: 16, color: '#6b7280', marginTop: 14, lineHeight: 1.6 }}>
            Change plan later without losing your cars or your leads.
          </p>
        </header>

        {section(
          'For individual salesmen and agents',
          'You sell cars yourself, under your own name. Your cars go live on the marketplace and buyers come straight to you.',
          salesmanPricingCards('en'),
        )}

        {section(
          'For dealerships',
          'You run a lot and a team: the dealer dashboard, a shared lead pipeline, stock and profit, and seats for your salesmen.',
          dealerCards,
        )}

        <div style={{
          borderTop: '1px solid #ececef', paddingTop: 24, marginTop: 8,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Not selling anything?</p>
          <button
            type="button"
            onClick={notSelling}
            disabled={busy}
            style={{
              background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10,
              padding: '10px 16px', color: '#111827', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {busy ? 'One moment…' : "I'm just here to buy a car"}
          </button>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
            Browsing, saving and messaging sellers are free and need no plan.
          </p>
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
