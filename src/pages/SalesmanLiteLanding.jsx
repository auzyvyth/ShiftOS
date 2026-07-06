import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  ArrowRight, Check, Globe, Car, MessageCircle, LineChart,
  Link2, Wallet, ChevronDown, Share2, ShieldCheck,
} from "lucide-react";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";

// ─── SEO ─────────────────────────────────────────────────────────────────────
const CANON = "https://xdrive.my/for-salesmen";
const SEO_TITLE = "Salesman Lite — Free Car Listing Page for Malaysian Car Agents | XDrive";
const SEO_DESC =
  "Salesman Lite is a free account for Malaysian car salesmen and agents. Get your own car listing page on xdrive.my, list up to 10 cars, and receive buyer enquiries straight on WhatsApp. Akaun jual kereta percuma untuk salesman — tiada kad kredit.";
const SEO_KEYWORDS = [
  "salesman kereta online", "app salesman kereta Malaysia", "akaun jual kereta percuma",
  "free car listing Malaysia", "senarai kereta percuma", "car agent page Malaysia",
  "jual kereta online percuma", "profil salesman kereta", "listing kereta percuma Malaysia",
  "car salesman website Malaysia", "WhatsApp car enquiries", "XDrive salesman lite",
].join(", ");

const FAQS = [
  { q: "Is Salesman Lite really free?",
    a: "Yes. Salesman Lite costs RM0 — no credit card, no contract. You get up to 10 active car listings, your own page on the XDrive marketplace, and direct WhatsApp enquiries at no cost." },
  { q: "Do I need my own website?",
    a: "No. The moment you sign up you get a ready-made page at xdrive.my/s/yourname with all your cars on it — nothing to build or host." },
  { q: "How do buyers contact me?",
    a: "Every listing has a WhatsApp button that messages you directly. No middleman and no shared inbox — the lead is yours." },
  { q: "Can I still use Mudah and Carlist?",
    a: "Yes. Salesman Lite works alongside Mudah and Carlist. The difference is this page is yours, it's on Malaysia's XDrive marketplace, and it's free." },
  { q: "What if I have more than 10 cars?",
    a: "Upgrade to Salesman Premium (RM50/month) for unlimited listings, priority placement, a full lead CRM, commission tracking and a custom subdomain." },
  { q: "Apa itu Salesman Lite?",
    a: "Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, senaraikan sehingga 10 kereta, dan terima enquiry pembeli terus di WhatsApp — tanpa sebarang kos." },
];

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "XDrive Salesman Lite",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: CANON,
  description: SEO_DESC,
  offers: { "@type": "Offer", price: "0", priceCurrency: "MYR" },
  areaServed: "MY",
};
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const FEATURES = [
  { Icon: Globe, title: "Your own car page", body: "A shareable profile at xdrive.my/s/yourname with every car you sell — live in minutes, nothing to build." },
  { Icon: Car, title: "List up to 10 cars", body: "Photos, price and specs, published straight onto Malaysia's XDrive marketplace." },
  { Icon: MessageCircle, title: "Direct WhatsApp leads", body: "Buyers tap and message you directly from any listing. The enquiry is yours, not a shared inbox." },
  { Icon: LineChart, title: "See what's working", body: "Basic analytics — views and WhatsApp taps, per listing — so you know which cars pull." },
  { Icon: Link2, title: "One link for everything", body: "Drop your page link in your WhatsApp status, bio or ads. Everything a buyer needs, one tap away." },
  { Icon: Wallet, title: "Free, forever", body: "RM0. No credit card, no contract. Upgrade only when you want more." },
];

const STEPS = [
  { n: "01", title: "Sign up free", body: "Email, phone and a name for your link. Two minutes, no card." },
  { n: "02", title: "Add your cars", body: "Upload photos and set your price. They go live on XDrive instantly." },
  { n: "03", title: "Share & sell", body: "Send your link. Buyers browse your cars and WhatsApp you directly." },
];

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sll-faq">
      <button className="sll-faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <ChevronDown size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {open && <p className="sll-faq-a">{a}</p>}
    </div>
  );
}

export default function SalesmanLiteLanding() {
  return (
    <>
      <Helmet>
        <title>{SEO_TITLE}</title>
        <meta name="description" content={SEO_DESC} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <link rel="canonical" href={CANON} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESC} />
        <meta property="og:url" content={CANON} />
        <meta property="og:site_name" content="XDrive" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(SOFTWARE_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(FAQ_LD)}</script>
      </Helmet>

      <style>{CSS}</style>
      <MarketplaceHeader />

      <main className="sll">
        {/* ── Hero ── */}
        <section className="sll-hero">
          <div className="sll-wrap">
            <span className="sll-eyebrow">Salesman Lite · <span className="sll-red">Free</span></span>
            <h1 className="sll-h1">
              Sell more cars.<br />Look professional.<br /><span className="sll-red">Zero cost.</span>
            </h1>
            <p className="sll-lead">
              A free storefront on XDrive for every Malaysian car agent. List your cars,
              share one link, and get buyers on WhatsApp — no website, no fees, no credit card.
            </p>
            <div className="sll-cta-row">
              <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red">
                Start free <ArrowRight size={17} />
              </Link>
              <a href="#how" className="sll-btn sll-btn-ghost">See how it works</a>
            </div>
            <p className="sll-microtrust">
              <Check size={14} /> Free forever &nbsp;·&nbsp; <Check size={14} /> Up to 10 listings &nbsp;·&nbsp; <Check size={14} /> Live in 2 minutes
            </p>
          </div>
        </section>

        {/* ── Marketplace line ── */}
        <div className="sll-band-line">
          <div className="sll-wrap">
            Your cars, live on Malaysia's car marketplace — <strong>xdrive.my</strong>
          </div>
        </div>

        {/* ── Features ── */}
        <section className="sll-section">
          <div className="sll-wrap">
            <p className="sll-kicker">What you get</p>
            <h2 className="sll-h2">Everything to sell online. Nothing to pay.</h2>
            <div className="sll-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="sll-card">
                  <div className="sll-card-ic"><f.Icon size={20} /></div>
                  <h3 className="sll-card-t">{f.title}</h3>
                  <p className="sll-card-b">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works (inverted) ── */}
        <section className="sll-dark" id="how">
          <div className="sll-wrap">
            <p className="sll-kicker sll-kicker-light">How it works</p>
            <h2 className="sll-h2 sll-h2-light">Live in three steps.</h2>
            <div className="sll-steps">
              {STEPS.map((s) => (
                <div key={s.n} className="sll-step">
                  <span className="sll-step-n">{s.n}</span>
                  <h3 className="sll-step-t">{s.title}</h3>
                  <p className="sll-step-b">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="sll-dark-cta">
              <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red">
                Create my free page <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Lite vs Premium ── */}
        <section className="sll-section">
          <div className="sll-wrap">
            <p className="sll-kicker">Start free, grow later</p>
            <h2 className="sll-h2">Lite is free. Premium when you're ready.</h2>
            <div className="sll-plans">
              <div className="sll-plan">
                <div className="sll-plan-head">
                  <span className="sll-plan-name">Salesman Lite</span>
                  <span className="sll-plan-price">RM0<span>/forever</span></span>
                </div>
                <ul className="sll-plan-list">
                  {["Up to 10 active listings", "Your page on the XDrive marketplace", "Direct WhatsApp enquiries", "Basic performance analytics", "No credit card required"].map((x) => (
                    <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
                  ))}
                </ul>
                <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red sll-btn-block">Start free</Link>
              </div>
              <div className="sll-plan sll-plan-alt">
                <div className="sll-plan-head">
                  <span className="sll-plan-name">Salesman Premium</span>
                  <span className="sll-plan-price">RM50<span>/month</span></span>
                </div>
                <ul className="sll-plan-list">
                  {["Unlimited listings", "Priority marketplace placement", "Full CRM + lead pipeline", "Commission tracking", "Advanced analytics", "Custom profile subdomain"].map((x) => (
                    <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
                  ))}
                </ul>
                <Link to="/salesman-onboarding/premium" className="sll-btn sll-btn-dark sll-btn-block">Go Premium</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="sll-section sll-faq-sec">
          <div className="sll-wrap sll-wrap-narrow">
            <p className="sll-kicker">Questions</p>
            <h2 className="sll-h2">Good to know.</h2>
            <div className="sll-faqs">
              {FAQS.map((f) => <Faq key={f.q} {...f} />)}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="sll-final">
          <div className="sll-wrap">
            <h2 className="sll-final-h">Your free car-sales page<br />is two minutes away.</h2>
            <div className="sll-cta-row sll-cta-center">
              <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red">
                Start free <ArrowRight size={17} />
              </Link>
            </div>
            <p className="sll-microtrust sll-center">
              <ShieldCheck size={14} /> PDPA 2010 compliant &nbsp;·&nbsp; <Share2 size={14} /> One shareable link &nbsp;·&nbsp; <Wallet size={14} /> RM0
            </p>
          </div>
        </section>
      </main>

      <MarketplaceFooter />
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
  .sll { font-family: 'Outfit', system-ui, sans-serif; background: #ffffff; color: #0a0a0a; -webkit-font-smoothing: antialiased; }
  .sll-wrap { max-width: 1080px; margin: 0 auto; padding: 0 22px; }
  .sll-wrap-narrow { max-width: 760px; }
  .sll-red { color: #dc2626; }

  /* Hero */
  .sll-hero { padding: 84px 0 60px; border-bottom: 1px solid #eceaea; }
  .sll-eyebrow { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; margin-bottom: 22px; }
  .sll-h1 { font-size: clamp(40px, 7vw, 76px); font-weight: 900; line-height: 0.98; letter-spacing: -0.03em; margin: 0 0 22px; }
  .sll-lead { font-size: clamp(15px, 2vw, 18px); line-height: 1.65; color: #4b5563; max-width: 560px; margin: 0 0 30px; }
  .sll-cta-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .sll-cta-center { justify-content: center; }
  .sll-btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px 26px; border-radius: 10px; text-decoration: none; cursor: pointer; border: none; transition: transform .15s, box-shadow .15s, background .15s; }
  .sll-btn:hover { transform: translateY(-1px); }
  .sll-btn-red { background: #dc2626; color: #fff; box-shadow: 0 8px 24px rgba(220,38,38,0.28); }
  .sll-btn-red:hover { background: #c11f1f; box-shadow: 0 10px 30px rgba(220,38,38,0.38); }
  .sll-btn-dark { background: #0a0a0a; color: #fff; }
  .sll-btn-dark:hover { background: #222; }
  .sll-btn-ghost { background: #fff; color: #0a0a0a; border: 1.5px solid #0a0a0a; }
  .sll-btn-ghost:hover { background: #0a0a0a; color: #fff; }
  .sll-btn-block { display: flex; justify-content: center; width: 100%; margin-top: 4px; }
  .sll-microtrust { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #6b7280; margin: 24px 0 0; }
  .sll-microtrust svg { color: #dc2626; }
  .sll-center { justify-content: center; }

  .sll-band-line { background: #0a0a0a; color: #fff; padding: 15px 0; font-size: 14px; font-weight: 500; letter-spacing: 0.01em; text-align: center; }
  .sll-band-line strong { color: #fff; font-weight: 800; }

  /* Sections */
  .sll-section { padding: 74px 0; }
  .sll-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #dc2626; margin: 0 0 12px; }
  .sll-kicker-light { color: #f87171; }
  .sll-h2 { font-size: clamp(28px, 4.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 40px; }
  .sll-h2-light { color: #fff; }

  /* Features grid */
  .sll-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .sll-card { border: 1px solid #eceaea; border-radius: 16px; padding: 26px 24px; transition: border-color .18s, box-shadow .18s, transform .18s; background: #fff; }
  .sll-card:hover { border-color: #0a0a0a; box-shadow: 0 12px 34px rgba(10,10,10,0.06); transform: translateY(-2px); }
  .sll-card-ic { width: 44px; height: 44px; border-radius: 12px; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .sll-card-t { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 8px; }
  .sll-card-b { font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0; }

  /* Dark how-it-works */
  .sll-dark { background: #0a0a0a; color: #fff; padding: 74px 0; }
  .sll-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .sll-step { border-top: 2px solid #dc2626; padding-top: 20px; }
  .sll-step-n { font-size: 15px; font-weight: 800; color: #dc2626; letter-spacing: 0.04em; }
  .sll-step-t { font-size: 20px; font-weight: 700; margin: 12px 0 8px; color: #fff; }
  .sll-step-b { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.6); margin: 0; }
  .sll-dark-cta { margin-top: 44px; }

  /* Plans */
  .sll-plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
  .sll-plan { border: 1px solid #eceaea; border-radius: 18px; padding: 30px 28px; display: flex; flex-direction: column; }
  .sll-plan-alt { border: 1.5px solid #0a0a0a; }
  .sll-plan-head { margin-bottom: 22px; }
  .sll-plan-name { display: block; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
  .sll-plan-price { font-size: 40px; font-weight: 900; letter-spacing: -0.03em; }
  .sll-plan-price span { font-size: 15px; font-weight: 600; color: #9ca3af; letter-spacing: 0; }
  .sll-plan-list { list-style: none; padding: 0; margin: 0 0 24px; flex: 1; }
  .sll-plan-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 14.5px; color: #1f2733; padding: 7px 0; line-height: 1.4; }
  .sll-tick { color: #dc2626; flex-shrink: 0; margin-top: 2px; }

  /* FAQ */
  .sll-faq-sec { background: #fafafa; border-top: 1px solid #eceaea; }
  .sll-faqs { border-top: 1px solid #e5e7eb; }
  .sll-faq { border-bottom: 1px solid #e5e7eb; }
  .sll-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; font-size: 16px; font-weight: 700; color: #0a0a0a; padding: 20px 2px; }
  .sll-faq-a { font-size: 14.5px; line-height: 1.7; color: #4b5563; margin: 0 2px 20px; max-width: 640px; }

  /* Final CTA */
  .sll-final { background: #0a0a0a; color: #fff; padding: 88px 0; text-align: center; }
  .sll-final-h { font-size: clamp(30px, 5vw, 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0 0 30px; color: #fff; }
  .sll-final .sll-microtrust { color: rgba(255,255,255,0.5); }

  @media (max-width: 860px) {
    .sll-grid, .sll-steps, .sll-plans { grid-template-columns: 1fr; }
    .sll-hero { padding: 64px 0 48px; }
  }
`;
