import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  ArrowRight, Check, Globe, Car, MessageCircle, LineChart,
  Link2, Wallet, ChevronDown, Share2, ShieldCheck, X as XIcon,
  Smartphone, Zap, Lock, Eye, ListChecks,
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
    a: "Yes. Salesman Lite costs RM0 — no credit card, no contract, no trial that quietly bills you later. You get up to 10 active car listings, your own page on the XDrive marketplace, a lead pipeline to track enquiries, and direct WhatsApp enquiries at no cost. Premium is coming soon for when you outgrow it — but plenty of agents never need to." },
  { q: "Do I need to build a website?",
    a: "No. The moment you sign up you get a ready-made page at xdrive.my/s/yourname with all your cars on it. No hosting, no domain, no design work — just add your cars and share the link." },
  { q: "How do buyers contact me?",
    a: "Every listing has a WhatsApp button that opens a chat straight to you. No shared inbox, no platform sitting in the middle, no lead sold to three other agents. The enquiry is yours." },
  { q: "Can I still use Mudah and Carlist?",
    a: "Absolutely. Salesman Lite works alongside them. The difference is this page is yours, it lives on Malaysia's XDrive marketplace, and it doesn't charge you per listing." },
  { q: "What happens when I have more than 10 cars?",
    a: "Salesman Premium (RM20/month) is coming soon — it triples your cap to 30 listings and adds priority marketplace placement, commission tracking, advanced analytics and a custom subdomain. Your Lite page and cars carry straight over. Until then, Lite's 10 listings and lead pipeline are yours free." },
  { q: "How long does setup take?",
    a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel — add your first car with a few photos to go live. IC verification can wait until just before your listings appear on the marketplace, so nothing holds up getting started." },
  { q: "Apa itu Salesman Lite?",
    a: "Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, senaraikan sehingga 10 kereta, dan terima enquiry pembeli terus di WhatsApp — tanpa sebarang kos atau kad kredit." },
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

const PAINS = [
  "Your best cars sit buried under 200 others on Mudah.",
  "You pay per listing — then the platform keeps the lead, not you.",
  "Buyers ask \"got other cars?\" and you're forwarding photos one by one.",
  "You've got no page to send anyone. Just screenshots in a chat.",
];

const FEATURES = [
  { Icon: Globe, title: "A page that's actually yours", body: "A clean profile at xdrive.my/s/yourname with every car you're selling. Send it once — buyers see your whole stock, your name, your number." },
  { Icon: Car, title: "List up to 10 cars, free", body: "Photos, price and specs, published straight onto Malaysia's XDrive marketplace. No per-listing fee, no bidding for placement." },
  { Icon: MessageCircle, title: "Leads land in your WhatsApp", body: "Every car has a WhatsApp button that messages you directly. No shared inbox, no lead resold to three other agents." },
  { Icon: ListChecks, title: "A pipeline, not a lost chat", body: "Every enquiry becomes a tracked lead — drag through stages, set follow-up reminders, log calls, send ready-made WhatsApp replies. The CRM other apps charge for, free on Lite." },
  { Icon: LineChart, title: "See which cars pull", body: "Basic analytics show views and WhatsApp taps per listing — so you know what buyers actually want, and reprice what's gone cold." },
  { Icon: Link2, title: "One link for everything", body: "Drop it in your WhatsApp status, Instagram bio, or under your Mudah ad. Every buyer, one tap from your entire stock." },
  { Icon: Wallet, title: "Free, and it stays free", body: "RM0 forever on Lite. No credit card to start, no trial timer. Upgrade to Premium only when your business asks for it." },
];

const WHY = [
  { Icon: Smartphone, title: "Built for your phone", body: "Add a car, snap photos, publish — all from the phone that's already in your hand at the lot." },
  { Icon: Zap, title: "Live in minutes", body: "No website, no designer, no waiting. Sign up and your first car is on the marketplace the same day." },
  { Icon: Eye, title: "You look established", body: "A proper page beats a folder of screenshots. Buyers trust an agent with a real presence." },
  { Icon: Lock, title: "Yours to keep", body: "Your page, your link, your leads. Move up to Premium and everything comes with you." },
];

const STEPS = [
  { n: "01", title: "Sign up free", body: "Email or Google, your phone, and a name for your link. No card, no catch — IC verification can wait until you publish." },
  { n: "02", title: "Add your cars", body: "Upload photos and set your price. Each car goes live on XDrive the moment you publish." },
  { n: "03", title: "Share & sell", body: "Send your one link. Buyers browse your stock and WhatsApp you straight away." },
];

const SHOWCASE_CARS = [
  { name: "2019 Honda Civic 1.5 TC-P", price: "RM 98,800", tag: "Low mileage" },
  { name: "2021 Perodua Ativa 1.0 AV", price: "RM 62,500", tag: "Under warranty" },
  { name: "2018 Toyota Vellfire 2.5", price: "RM 218,000", tag: "1 owner" },
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
      {/* This is a salesman-recruitment page, not the buyer marketplace — the
          global announcement bar carries buyer-facing copy ("Buy your next
          car, safely...") that's out of place here. */}
      <MarketplaceHeader hideAnnouncement />

      <main className="sll">
        {/* ── Hero ── */}
        <section className="sll-hero">
          <div className="sll-wrap">
            <span className="sll-eyebrow">Salesman Lite · <span className="sll-red">Free forever</span></span>
            <h1 className="sll-h1">
              One link.<br />All your cars.<br /><span className="sll-red">Zero ringgit.</span>
            </h1>
            <p className="sll-lead">
              Salesman Lite is a free page on XDrive built for Malaysian car agents.
              List your stock, share one link, and let buyers WhatsApp you directly —
              no website to build, nothing to pay, no lead sold out from under you.
            </p>
            <div className="sll-cta-row">
              <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red">
                Sign up free <ArrowRight size={17} />
              </Link>
              <a href="#how" className="sll-btn sll-btn-ghost">See how it works</a>
            </div>
            <p className="sll-microtrust">
              <span className="sll-microtrust-item"><Check size={14} /> Free forever</span>
              <span className="sll-microtrust-item"><Check size={14} /> No credit card</span>
              <span className="sll-microtrust-item"><Check size={14} /> Live in minutes</span>
            </p>
          </div>
        </section>

        {/* ── Marketplace band ── */}
        <div className="sll-band-line">
          <div className="sll-wrap">
            Your cars, live on Malaysia's car marketplace — <strong>xdrive.my</strong>
          </div>
        </div>

        {/* ── Pain ── */}
        <section className="sll-section">
          <div className="sll-wrap">
            <p className="sll-kicker">Sound familiar?</p>
            <h2 className="sll-h2">Selling cars online shouldn't cost you the lead.</h2>
            <div className="sll-pains">
              {PAINS.map((p) => (
                <div key={p} className="sll-pain">
                  <span className="sll-pain-x"><XIcon size={15} /></span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
            <p className="sll-pain-fix">Salesman Lite fixes all four — for free.</p>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="sll-section sll-section-alt">
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

        {/* ── Page showcase ── */}
        <section className="sll-section">
          <div className="sll-wrap sll-showcase">
            <div className="sll-showcase-copy">
              <p className="sll-kicker">Your page does the selling</p>
              <h2 className="sll-h2">Send one link. They see everything.</h2>
              <p className="sll-showcase-lead">
                No more forwarding photos car by car. Your XDrive page shows your whole
                stock, your prices and a WhatsApp button on every listing — open on any
                phone, ready to share the second a buyer asks.
              </p>
              <ul className="sll-showcase-list">
                <li><Check size={16} className="sll-tick" /> Your name and number, front and centre</li>
                <li><Check size={16} className="sll-tick" /> Every car with photos, price and specs</li>
                <li><Check size={16} className="sll-tick" /> Tap-to-WhatsApp on each listing</li>
              </ul>
            </div>
            <div className="sll-phone">
              <div className="sll-phone-top">
                <span className="sll-phone-url">xdrive.my/s/<strong>ahmad</strong></span>
              </div>
              <div className="sll-phone-hero">
                <div className="sll-phone-avatar">A</div>
                <div>
                  <div className="sll-phone-name">Ahmad · Car Agent</div>
                  <div className="sll-phone-sub">Klang Valley · 24 cars sold</div>
                </div>
              </div>
              {SHOWCASE_CARS.map((c) => (
                <div key={c.name} className="sll-phone-car">
                  <div className="sll-phone-thumb" />
                  <div className="sll-phone-carinfo">
                    <div className="sll-phone-cn">{c.name}</div>
                    <div className="sll-phone-cp">{c.price} <span>· {c.tag}</span></div>
                  </div>
                  <div className="sll-phone-wa"><MessageCircle size={14} /></div>
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

        {/* ── Why it works ── */}
        <section className="sll-section">
          <div className="sll-wrap">
            <p className="sll-kicker">Built for how you actually sell</p>
            <h2 className="sll-h2">Made for agents, not office desks.</h2>
            <div className="sll-why">
              {WHY.map((w) => (
                <div key={w.title} className="sll-why-item">
                  <div className="sll-why-ic"><w.Icon size={18} /></div>
                  <div>
                    <h3 className="sll-why-t">{w.title}</h3>
                    <p className="sll-why-b">{w.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mid CTA band ── */}
        <section className="sll-midcta">
          <div className="sll-wrap sll-midcta-inner">
            <div>
              <h3 className="sll-midcta-h">Ready when you are.</h3>
              <p className="sll-midcta-p">Your free page takes minutes and costs nothing.</p>
            </div>
            <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red">
              Sign up free <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        {/* ── Lite vs Premium ── */}
        <section className="sll-section sll-section-alt">
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
                  {["Up to 10 active listings", "Your page on the XDrive marketplace", "Direct WhatsApp enquiries", "Lead pipeline + follow-up reminders", "Basic performance analytics", "No credit card required"].map((x) => (
                    <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
                  ))}
                </ul>
                <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red sll-btn-block">Sign up free</Link>
              </div>
              <div className="sll-plan sll-plan-alt sll-plan-soon">
                <span className="sll-soon-ribbon">Coming soon</span>
                <div className="sll-plan-dim">
                  <div className="sll-plan-head">
                    <span className="sll-plan-name">Salesman Premium</span>
                    <span className="sll-plan-price">RM20<span>/month</span></span>
                  </div>
                  <ul className="sll-plan-list">
                    {["Everything in Lite", "Up to 30 active listings", "Priority marketplace placement", "Advanced CRM automation", "Commission tracking", "Advanced analytics + custom subdomain"].map((x) => (
                      <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
                    ))}
                  </ul>
                </div>
                <span className="sll-btn sll-btn-block sll-btn-disabled" aria-disabled="true">Coming soon</span>
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
            <h2 className="sll-final-h">Your free car-sales page<br />is minutes away.</h2>
            <p className="sll-final-p">Join the Malaysian agents putting their whole stock behind one link.</p>
            <div className="sll-cta-row sll-cta-center">
              <Link to="/salesman-onboarding/lite" className="sll-btn sll-btn-red sll-btn-lg">
                Sign up free <ArrowRight size={18} />
              </Link>
            </div>
            <p className="sll-microtrust sll-center">
              <span className="sll-microtrust-item"><ShieldCheck size={14} /> PDPA 2010 compliant</span>
              <span className="sll-microtrust-item"><Share2 size={14} /> One shareable link</span>
              <span className="sll-microtrust-item"><Wallet size={14} /> RM0</span>
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
  .sll-lead { font-size: clamp(15px, 2vw, 18px); line-height: 1.65; color: #4b5563; max-width: 580px; margin: 0 0 30px; }
  .sll-cta-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .sll-cta-center { justify-content: center; }
  .sll-btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px 26px; border-radius: 10px; text-decoration: none; cursor: pointer; border: none; transition: transform .15s, box-shadow .15s, background .15s; }
  .sll-btn:hover { transform: translateY(-1px); }
  .sll-btn-lg { font-size: 16px; padding: 16px 32px; }
  .sll-btn-red { background: #dc2626; color: #fff; box-shadow: 0 8px 24px rgba(220,38,38,0.28); }
  .sll-btn-red:hover { background: #c11f1f; box-shadow: 0 10px 30px rgba(220,38,38,0.38); }
  .sll-btn-dark { background: #0a0a0a; color: #fff; }
  .sll-btn-dark:hover { background: #222; }
  .sll-btn-ghost { background: #fff; color: #0a0a0a; border: 1.5px solid #0a0a0a; }
  .sll-btn-ghost:hover { background: #0a0a0a; color: #fff; }
  .sll-btn-block { display: flex; justify-content: center; width: 100%; margin-top: 4px; }
  .sll-microtrust { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; font-size: 13px; font-weight: 600; color: #6b7280; margin: 24px 0 0; }
  .sll-microtrust-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .sll-microtrust svg { color: #dc2626; flex-shrink: 0; }
  .sll-center { justify-content: center; }

  .sll-band-line { background: #0a0a0a; color: #fff; padding: 15px 0; font-size: 14px; font-weight: 500; text-align: center; }
  .sll-band-line strong { color: #fff; font-weight: 800; }

  /* Sections */
  .sll-section { padding: 74px 0; }
  .sll-section-alt { background: #fafafa; border-top: 1px solid #eceaea; border-bottom: 1px solid #eceaea; }
  .sll-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #dc2626; margin: 0 0 12px; }
  .sll-kicker-light { color: #f87171; }
  .sll-h2 { font-size: clamp(28px, 4.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 40px; }
  .sll-h2-light { color: #fff; }

  /* Pain */
  .sll-pains { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 26px; }
  .sll-pain { display: flex; gap: 12px; align-items: flex-start; font-size: 16px; font-weight: 500; color: #1f2733; line-height: 1.5; padding: 18px 20px; border: 1px solid #eceaea; border-radius: 12px; }
  .sll-pain-x { width: 26px; height: 26px; border-radius: 7px; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-pain-fix { font-size: clamp(18px, 2.4vw, 24px); font-weight: 800; letter-spacing: -0.01em; margin: 0; }

  /* Features grid */
  .sll-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .sll-card { border: 1px solid #eceaea; border-radius: 16px; padding: 26px 24px; transition: border-color .18s, box-shadow .18s, transform .18s; background: #fff; }
  .sll-card:hover { border-color: #0a0a0a; box-shadow: 0 12px 34px rgba(10,10,10,0.06); transform: translateY(-2px); }
  .sll-card-ic { width: 44px; height: 44px; border-radius: 12px; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .sll-card-t { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 8px; }
  .sll-card-b { font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0; }

  /* Showcase */
  .sll-showcase { display: grid; grid-template-columns: 1fr 340px; gap: 48px; align-items: center; }
  .sll-showcase-copy .sll-h2 { margin-bottom: 18px; }
  .sll-showcase-lead { font-size: 16px; line-height: 1.65; color: #4b5563; margin: 0 0 20px; }
  .sll-showcase-list { list-style: none; padding: 0; margin: 0; }
  .sll-showcase-list li { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 500; color: #1f2733; padding: 7px 0; }
  .sll-phone { border: 1px solid #e5e7eb; border-radius: 22px; padding: 14px; background: #fff; box-shadow: 0 24px 60px rgba(10,10,10,0.10); }
  .sll-phone-top { text-align: center; padding: 4px 0 12px; }
  .sll-phone-url { font-size: 12px; color: #9ca3af; background: #f3f4f6; padding: 5px 12px; border-radius: 20px; }
  .sll-phone-url strong { color: #0a0a0a; }
  .sll-phone-hero { display: flex; align-items: center; gap: 11px; padding: 6px 4px 14px; border-bottom: 1px solid #f0f0f0; margin-bottom: 10px; }
  .sll-phone-avatar { width: 40px; height: 40px; border-radius: 50%; background: #dc2626; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-phone-name { font-size: 14px; font-weight: 700; color: #0a0a0a; }
  .sll-phone-sub { font-size: 11px; color: #9ca3af; }
  .sll-phone-car { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 12px; }
  .sll-phone-car:hover { background: #fafafa; }
  .sll-phone-thumb { width: 52px; height: 40px; border-radius: 8px; background: linear-gradient(135deg,#e5e7eb,#d1d5db); flex-shrink: 0; }
  .sll-phone-carinfo { flex: 1; min-width: 0; }
  .sll-phone-cn { font-size: 12px; font-weight: 700; color: #0a0a0a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sll-phone-cp { font-size: 12px; font-weight: 700; color: #dc2626; }
  .sll-phone-cp span { color: #9ca3af; font-weight: 500; }
  .sll-phone-wa { width: 30px; height: 30px; border-radius: 8px; background: #25D366; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

  /* Dark how-it-works */
  .sll-dark { background: #0a0a0a; color: #fff; padding: 74px 0; }
  .sll-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .sll-step { border-top: 2px solid #dc2626; padding-top: 20px; }
  .sll-step-n { font-size: 15px; font-weight: 800; color: #dc2626; letter-spacing: 0.04em; }
  .sll-step-t { font-size: 20px; font-weight: 700; margin: 12px 0 8px; color: #fff; }
  .sll-step-b { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.6); margin: 0; }
  .sll-dark-cta { margin-top: 44px; }

  /* Why */
  .sll-why { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px 40px; }
  .sll-why-item { display: flex; gap: 15px; align-items: flex-start; }
  .sll-why-ic { width: 40px; height: 40px; border-radius: 10px; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-why-t { font-size: 17px; font-weight: 700; margin: 2px 0 6px; }
  .sll-why-b { font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0; }

  /* Mid CTA */
  .sll-midcta { background: #0a0a0a; color: #fff; padding: 40px 0; }
  .sll-midcta-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .sll-midcta-h { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; color: #fff; }
  .sll-midcta-p { font-size: 15px; color: rgba(255,255,255,0.6); margin: 0; }

  /* Plans */
  .sll-plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
  .sll-plan { border: 1px solid #eceaea; border-radius: 18px; padding: 30px 28px; display: flex; flex-direction: column; background: #fff; }
  .sll-plan-alt { border: 1.5px solid #0a0a0a; }
  /* Coming-soon premium card: dimmed content, disabled CTA, corner ribbon */
  .sll-plan-soon { position: relative; overflow: hidden; }
  .sll-plan-soon .sll-plan-dim { opacity: 0.5; filter: grayscale(0.2); }
  /* Fixed width + text-align:center so the text sits centered on the diagonal
     strip itself — shrink-to-fit content with only symmetric padding still
     left it reading off-corner because the strip wasn't long enough to span
     the actual corner it's meant to sit across. */
  .sll-soon-ribbon { position: absolute; top: 22px; right: -58px; width: 200px; transform: rotate(45deg); background: #dc2626; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; text-align: center; padding: 6px 0; box-shadow: 0 4px 14px rgba(0,0,0,0.22); z-index: 2; }
  .sll-btn-disabled { background: #9ca3af; color: #fff; cursor: not-allowed; pointer-events: none; box-shadow: none; }
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
  .sll-faq-a { font-size: 14.5px; line-height: 1.7; color: #4b5563; margin: 0 2px 20px; max-width: 660px; }

  /* Final CTA */
  .sll-final { background: #0a0a0a; color: #fff; padding: 88px 0; text-align: center; }
  .sll-final-h { font-size: clamp(30px, 5vw, 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0 0 16px; color: #fff; }
  .sll-final-p { font-size: 16px; color: rgba(255,255,255,0.6); margin: 0 0 30px; }
  .sll-final .sll-microtrust { color: rgba(255,255,255,0.5); justify-content: center; }

  @media (max-width: 860px) {
    .sll-grid, .sll-steps, .sll-plans, .sll-pains, .sll-why, .sll-showcase { grid-template-columns: 1fr; }
    .sll-hero { padding: 64px 0 48px; }
    .sll-phone { max-width: 340px; margin: 0 auto; }
    .sll-midcta-inner { flex-direction: column; align-items: flex-start; }
    /* Three items in one wrapped inline row read as clanky on narrow screens
       (a checkmark stranding itself on the next line from its own text) —
       one clean item per line instead. */
    .sll-microtrust { flex-direction: column; align-items: flex-start; gap: 10px; }
    .sll-final .sll-microtrust { align-items: center; }
  }
`;
