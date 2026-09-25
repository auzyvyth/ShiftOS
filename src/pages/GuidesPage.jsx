import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { Search, Shield, Car, MessageCircle, FileCheck, CheckCircle, ChevronRight, Calculator, Star, AlertCircle, HelpCircle } from 'lucide-react';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import { GUIDE_META, GUIDE_STEPS, GUIDE_FAQS, GUIDE_TIPS, GUIDE_FAQ_LD } from '../config/guidesCopy';

// Copy lives in src/config/guidesCopy.js (shared with api/og.js); icons stay here.
const HOW_IT_WORKS_STEPS = GUIDE_STEPS.map((st, i) => ({ ...st, icon: [Search, Shield, Calculator, MessageCircle, Car, FileCheck][i] }));
const FAQS = GUIDE_FAQS;
const BUYING_TIPS = GUIDE_TIPS.map((t, i) => ({ ...t, icon: [Calculator, Car, FileCheck, Shield][i] }));

// One Helmet per guide screen, from the shared meta (+ FAQ schema on /guides/faq).
function GuideHead({ page, jsonLd }) {
  const m = GUIDE_META[page];
  return (
    <Helmet>
      <title>{m.title}</title>
      <meta name="description" content={m.description} />
      <link rel="canonical" href={`https://xdrive.my${m.path}`} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}

// ── How It Works page ─────────────────────────────────────────────────────────


function HowItWorksPage() {
  return (
    <>
      <GuideHead page="how" />
      <MarketplaceHeader />
      <main style={{ paddingTop: 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "system-ui,sans-serif" }}>

        {/* Hero */}
        <div style={{ background: '#111827', padding: '56px 20px 48px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 12px' }}>Buyer's Guide</p>
          <h1 style={{ color: 'white', fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.03em' }}>
            How to Buy a Car on XDrive
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 16, maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
            {GUIDE_META.how.intro}
          </p>
          <Link to="/showroom" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 14,
            padding: '12px 24px', borderRadius: 10, textDecoration: 'none',
          }}>
            Start Browsing Cars <ChevronRight size={15} />
          </Link>
          <p style={{ margin: '22px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
            This guide was written by AI.
          </p>
        </div>

        {/* Steps */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '56px 20px 64px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {HOW_IT_WORKS_STEPS.map(({ step, icon: Icon, title, body, tips, cta }) => (
              <div key={step} style={{
                background: 'white', border: '1px solid #DDE3EC', borderRadius: 16, padding: '28px 28px 24px',
                display: 'flex', gap: 24, alignItems: 'flex-start',
              }}>
                {/* Step number + icon */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color="#dc2626" />
                  </div>
                  <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>{step}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ color: '#111827', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{title}</h2>
                  <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: '0 0 16px' }}>{body}</p>

                  {/* Tips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tips.map((tip) => (
                      <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <CheckCircle size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.5 }}>{tip}</span>
                      </div>
                    ))}
                  </div>

                  {cta && (
                    <Link to={cta.to} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16,
                      background: '#111827', color: 'white', fontWeight: 600, fontSize: 13,
                      padding: '9px 18px', borderRadius: 8, textDecoration: 'none',
                    }}>
                      {cta.label} <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trust callout */}
          <div style={{ background: '#111827', borderRadius: 16, padding: '32px 28px', marginTop: 48, textAlign: 'center' }}>
            <Star size={24} color="#dc2626" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 10px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.03em' }}>
              Only Certified Dealers on XDrive
            </h3>
            <p style={{ color: '#9ca3af', fontSize: 14, maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Every dealer is manually verified. No private ads, no scam listings. If a car is listed, it exists — and a real human is ready to sell it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/showroom" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 13,
                padding: '10px 20px', borderRadius: 8, textDecoration: 'none',
              }}>
                Find Cars <ChevronRight size={13} />
              </Link>
              <Link to="/calculator" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.08)', color: '#d1d5db', fontWeight: 600, fontSize: 13,
                padding: '10px 20px', borderRadius: 8, textDecoration: 'none',
              }}>
                Finance Calculator
              </Link>
            </div>
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

// ── FAQ page ──────────────────────────────────────────────────────────────────


function FAQPage() {
  const [open, setOpen] = React.useState(null);
  return (
    <>
      <GuideHead page="faq" jsonLd={GUIDE_FAQ_LD} />
      <MarketplaceHeader />
      <main style={{ paddingTop: 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "system-ui,sans-serif" }}>
        <div style={{ background: '#111827', padding: '56px 20px 48px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 12px' }}>Support</p>
          <h1 style={{ color: 'white', fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.03em' }}>
            Frequently Asked Questions
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 16, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Everything buyers ask us before making their purchase.
          </p>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 64px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #DDE3EC', borderRadius: 14, overflow: 'hidden', background: 'white' }}>
            {FAQS.map(({ q, a }, i) => (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '18px 22px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{ color: '#111827', fontSize: 14, fontWeight: 600, lineHeight: 1.5, fontFamily: "system-ui,sans-serif" }}>{q}</span>
                  <HelpCircle size={16} style={{ color: open === i ? '#dc2626' : '#9ca3af', flexShrink: 0, marginTop: 1, transition: 'color 0.15s' }} />
                </button>
                {open === i && (
                  <div style={{ padding: '0 22px 18px' }}>
                    <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, background: 'white', border: '1px solid #DDE3EC', borderRadius: 14, padding: '24px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ color: '#111827', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Still have questions?</p>
              <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                WhatsApp us at{' '}
                <a href="https://wa.me/601111521742" style={{ color: '#dc2626', fontWeight: 600 }}>+60 11-1152 1742</a>
                {' '}or email{' '}
                <a href="mailto:hello@xdrive.my" style={{ color: '#dc2626', fontWeight: 600 }}>hello@xdrive.my</a>
              </p>
            </div>
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

// ── Buyer's Guide page ────────────────────────────────────────────────────────


function BuyersGuidePage() {
  return (
    <>
      <GuideHead page="buying" />
      <MarketplaceHeader />
      <main style={{ paddingTop: 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "system-ui,sans-serif" }}>
        <div style={{ background: '#111827', padding: '56px 20px 48px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 12px' }}>Resources</p>
          <h1 style={{ color: 'white', fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.03em' }}>
            Buyer's Guide
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 16, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Everything you need to know to make a smart car purchase in Malaysia.
          </p>
        </div>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 20px 64px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 20 }}>
            {BUYING_TIPS.map(({ category, icon: Icon, items }) => (
              <div key={category} style={{ background: 'white', border: '1px solid #DDE3EC', borderRadius: 14, padding: '24px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#dc2626" />
                  </div>
                  <h2 style={{ color: '#111827', fontSize: 15, fontWeight: 700, margin: 0 }}>{category}</h2>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map((item) => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626', flexShrink: 0, marginTop: 6 }} />
                      <span style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.6 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/calculator" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#111827', color: 'white', fontWeight: 700, fontSize: 14,
              padding: '12px 22px', borderRadius: 10, textDecoration: 'none',
            }}>
              Open Finance Calculator <ChevronRight size={14} />
            </Link>
            <Link to="/showroom" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 14,
              padding: '12px 22px', borderRadius: 10, textDecoration: 'none',
            }}>
              Browse Cars <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function GuidesPage() {
  const { slug } = useParams();
  if (slug === 'faq') return <FAQPage />;
  if (slug === 'buying') return <BuyersGuidePage />;
  return <HowItWorksPage />;
}
