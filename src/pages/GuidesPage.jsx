import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { Search, Shield, Car, MessageCircle, FileCheck, CheckCircle, ChevronRight, Calculator, Star, AlertCircle, HelpCircle } from 'lucide-react';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';

// ── How It Works page ─────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    icon: Search,
    title: 'Browse Verified Listings',
    body: "Search by brand, budget, location, or body type. Every car on XDrive is listed by a certified dealer — no private sellers, no phantom listings. What you see is what's actually on the lot.",
    tips: ['Use the brand filter to narrow by make', 'Filter by state to find cars near you', 'Toggle "Recon" to see imported units'],
  },
  {
    step: '02',
    icon: Shield,
    title: 'Check the Full Details',
    body: 'Each listing shows the full spec sheet: year, mileage, engine size, transmission, colour, and condition. Scroll down to see the "What\'s Included" section — warranty, tinting, insurance, and any dealer add-ons are all listed upfront.',
    tips: ['Look for the Verified badge on listings', 'Check "What\'s Included" for value-add items', 'View all photos in the gallery before deciding'],
  },
  {
    step: '03',
    icon: Calculator,
    title: 'Run the Finance Calculator',
    body: 'Before you call anyone, use our Finance Calculator to estimate your monthly installment, road tax, and insurance cost. Adjust the down payment, tenure, and interest rate until it fits your budget. You can even download a PDF quotation.',
    tips: ['Aim for monthly repayment ≤ 15% of take-home', 'Most banks offer 2.4–3.5% flat rate for new cars', 'Budget for road tax + insurance on top of installment'],
    cta: { label: 'Open Calculator', to: '/calculator' },
  },
  {
    step: '04',
    icon: MessageCircle,
    title: 'Contact the Dealer Directly',
    body: 'Hit the WhatsApp button on any listing to connect directly with the dealer\'s salesperson. No middlemen, no lead-selling — your number goes to one person. Discuss availability, negotiate, and book a test drive.',
    tips: ['Ask for the latest OTR price', 'Confirm the unit is still available before visiting', 'Request a physical inspection report if buying recon'],
  },
  {
    step: '05',
    icon: Car,
    title: 'Test Drive & Inspect',
    body: 'Visit the dealership for a test drive. For used and recon cars, request an independent inspection or ask the dealer for the Carfax / JPJ record. Check for accident history, service records, and ownership history.',
    tips: ['Bring a friend or mechanic if buying used', 'Test all electrical features (A/C, windows, infotainment)', 'Verify the chassis and engine numbers match the grant'],
  },
  {
    step: '06',
    icon: FileCheck,
    title: 'Sign & Drive',
    body: "Once you've agreed on a price, the dealer handles the loan application, JPJ transfer, insurance, and road tax. XDrive dealers use a digital document system — no lost paperwork. You'll receive all documents in one package.",
    tips: ['Keep a copy of the sale & purchase agreement', 'Confirm the loan approval letter before paying deposit', 'Ensure road tax and insurance are valid before driving off'],
  },
];

function HowItWorksPage() {
  return (
    <>
      <Helmet>
        <title>How It Works — XDrive Malaysia</title>
        <meta name="description" content="Learn how to buy a car on XDrive Malaysia. Browse verified listings, use the finance calculator, contact dealers directly, and drive away with confidence." />
      </Helmet>
      <MarketplaceHeader />
      <main style={{ paddingTop: 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>

        {/* Hero */}
        <div style={{ background: '#111827', padding: '56px 20px 48px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 12px' }}>Buyer's Guide</p>
          <h1 style={{ color: 'white', fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 800, margin: '0 0 14px', lineHeight: 1.15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.03em' }}>
            How to Buy a Car on XDrive
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 16, maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Six steps from browsing to driving — with verified dealers, transparent pricing, and no hidden fees.
          </p>
          <Link to="/showroom" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 14,
            padding: '12px 24px', borderRadius: 10, textDecoration: 'none',
          }}>
            Start Browsing Cars <ChevronRight size={15} />
          </Link>
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

const FAQS = [
  {
    q: 'Are all listings on XDrive from certified dealers?',
    a: 'Yes. XDrive only allows verified, registered car dealers to list inventory. Private sellers are not permitted. Every dealer goes through a manual verification process before going live.',
  },
  {
    q: 'What does "Recon" mean?',
    a: '"Recon" (reconditioned) refers to vehicles originally manufactured for export markets (Japan, UK, etc.) that have been imported, converted to Malaysian road specifications, and registered locally. They typically offer more features at lower prices but may have higher road tax. Always confirm the conversion spec with the dealer.',
  },
  {
    q: 'Is the listed price the final price?',
    a: 'Listed prices are the asking prices set by the dealer. In Malaysia, car prices are generally negotiable within 2–5%. Use our Finance Calculator to plan your budget, then negotiate the OTR (on-the-road) price directly with the dealer.',
  },
  {
    q: 'What is OTR price?',
    a: 'OTR (On-The-Road) price is the total cost including road tax, insurance, and registration fees — the amount you actually pay before driving off. Our Finance Calculator estimates OTR including road tax and insurance.',
  },
  {
    q: 'How do I contact a dealer?',
    a: 'Each listing has a "WhatsApp Dealer" button that connects you directly to the dealer\'s salesperson. No middlemen or lead brokers — your contact goes straight to the person who can close the deal.',
  },
  {
    q: 'Can I compare multiple cars?',
    a: 'Yes. Click the compare icon on any listing to add it to your compare bar, then head to the Compare page to view specs side by side.',
  },
  {
    q: 'How accurate is the Finance Calculator?',
    a: 'The calculator uses current JPJ road tax tables and standard insurance tariff formulas. Financing figures are estimates based on flat interest rate inputs — actual bank rates vary by lender and credit profile. Use it for budgeting, then get a formal letter of offer from your bank.',
  },
  {
    q: 'What documents do I need to buy a car?',
    a: 'For new loans: IC copy, 3 months payslips, 3 months bank statements, EPF statement (optional). For civil servants: EA form or letter of employment. Self-employed: 6 months bank statements + business registration. The dealer will guide you through the paperwork.',
  },
  {
    q: 'Does XDrive charge buyers any fees?',
    a: 'No. XDrive is completely free for buyers. Dealers pay a subscription fee to list inventory — you pay nothing to browse, contact, or compare cars.',
  },
];

function FAQPage() {
  const [open, setOpen] = React.useState(null);
  return (
    <>
      <Helmet>
        <title>FAQ — XDrive Malaysia</title>
        <meta name="description" content="Frequently asked questions about buying a car on XDrive Malaysia. Answers on pricing, dealers, financing, and more." />
      </Helmet>
      <MarketplaceHeader />
      <main style={{ paddingTop: 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>
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
                  <span style={{ color: '#111827', fontSize: 14, fontWeight: 600, lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif" }}>{q}</span>
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
                <a href="https://wa.me/60174155191" style={{ color: '#dc2626', fontWeight: 600 }}>+60 17-415 5191</a>
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

const BUYING_TIPS = [
  {
    category: 'Budget',
    icon: Calculator,
    items: [
      'Cap your monthly repayment at 15% of take-home pay.',
      'Add RM 3,000–6,000 for road tax + insurance on a typical RM 80k–120k car.',
      'Keep RM 2,000–3,000 in reserve for minor repairs in the first year.',
      'Down payment of 10% is standard; 20%+ reduces total interest significantly.',
    ],
  },
  {
    category: 'New vs Used vs Recon',
    icon: Car,
    items: [
      'New: manufacturer warranty, zero mileage, but highest depreciation in year 1–2.',
      'Used (local): lower price, known maintenance history if buying from a dealer.',
      'Recon: imported, usually more features per ringgit — check JPJ compliance and conversion spec.',
      'Always ask for the grant (vehicle ownership card) and verify engine/chassis numbers match.',
    ],
  },
  {
    category: 'Financing',
    icon: FileCheck,
    items: [
      'Get pre-approved from 2–3 banks before visiting a dealer — use the best offer.',
      'Flat rate 2.4–3.5% = ~4.5–6.5% effective interest rate (EIR). Compare EIR, not flat rate.',
      'Avoid extending tenure beyond 7 years — total interest balloons.',
      'Islamic hire-purchase (HP) vs conventional: functionally similar, choose based on your bank\'s rate.',
    ],
  },
  {
    category: 'What to Check Before Signing',
    icon: Shield,
    items: [
      'Confirm the car is not under a finance lien (check JPJ portal).',
      'Verify the accident history — ask for a PDRM report or inspection record.',
      'Read the sale & purchase agreement carefully before signing.',
      'Confirm all included accessories/services are written into the agreement.',
    ],
  },
];

function BuyersGuidePage() {
  return (
    <>
      <Helmet>
        <title>Buyer's Guide — XDrive Malaysia</title>
        <meta name="description" content="Expert tips for buying a car in Malaysia. Budget planning, new vs recon comparison, financing advice, and what to check before signing." />
      </Helmet>
      <MarketplaceHeader />
      <main style={{ paddingTop: 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>
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
