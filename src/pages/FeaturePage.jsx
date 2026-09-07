import React, { useEffect, useRef } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  ArrowRight, ArrowLeft, Check, MessageCircle, ChevronRight,
  Car, Package, Wallet, Clock, Calculator, Gauge, Globe,
  Users, CalendarClock, Banknote, Tag, ClipboardCheck,
  LineChart, TrendingUp, Percent, Receipt, Landmark, FileSignature,
  BellRing, X,
} from "lucide-react";

const WA = "https://wa.me/601111521742?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

// ─────────────────────────────────────────────────────────────────────────────
// Content — one entry per feature page. Every capability and step below maps to
// a real function in the product (per-unit P&L / fetchPnl, stock_units, leads
// pipeline, RevOpsPage, dealer_products + HP board, post_sale_tasks handover
// sequence, expiry-reminders). Order also drives the "explore more" cross-links.
// ─────────────────────────────────────────────────────────────────────────────
const FEATURES = {
  "smart-inventory": {
    icon: Car,
    kicker: "Inventory & Stock",
    titleLead: "Every unit, real cost, real profit —",
    titleAccent: "before you price it",
    sub: "Track each car from purchase to sale with its true landed cost, ageing and per-unit P&L. Stop pricing off the asking figure and guessing your margin.",
    seo: "ShiftOS Smart Inventory — used car stock management for Malaysian dealers. Track purchase cost, recon, days-in-stock, holding cost and true per-unit profit.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "Stock lives in a WhatsApp group and three Excel sheets that never quite agree.",
      "You price off gut feel — recon, road tax and floor-plan interest are never in the number.",
      "Aged units quietly bleed interest; nobody notices a car's been sitting 120 days.",
      "Two salesmen chase the same car and you only find out at handover.",
    ],
    solutions: [
      "One live stock list — purchase price, recon and days-in-stock on every unit.",
      "A live cost floor built from your real overheads, so you never price below break-even.",
      "Per-unit P&L: front gross, back gross, holding cost and handover fees, auto-calculated.",
      "Assign a car to one rep and it locks out of everyone else's pool — no double-selling.",
    ],
    capabilities: [
      { icon: Package, title: "Per-unit stock ledger", desc: "Purchase price, recon cost, encumbrance status (clear / under HP) and days-in-stock tracked on every unit." },
      { icon: Wallet, title: "True per-unit P&L", desc: "Front gross (sale − cost − recon − services − commission − handover) plus back-end F&I gross, in one modal." },
      { icon: Clock, title: "Holding-cost tracking", desc: "Floor-plan interest or overhead-per-day × days held, deducted automatically so ageing stock shows its real drag." },
      { icon: Calculator, title: "Cost-floor pricing", desc: "Set your monthly overhead, fleet size and floor-plan rate once; every car shows the price you can't go below." },
      { icon: Gauge, title: "Recon & ad-spend reconciliation", desc: "Booked recon estimate vs actual jobs, plus ad spend per unit (Mudah, Carlist, FB, TikTok), folded into gross." },
      { icon: Globe, title: "Bulk import & instant storefront", desc: "Import a PDF or Excel stock list in one pass, and publish any unit to your own XDrive storefront with one toggle." },
    ],
  },

  "leads-crm": {
    icon: Users,
    kicker: "Leads & CRM",
    titleLead: "Every enquiry, every channel,",
    titleAccent: "one pipeline",
    sub: "Capture leads from WhatsApp, walk-ins and the marketplace, then move them through a visual pipeline until they're won — with follow-ups and test drives that never slip.",
    seo: "ShiftOS Leads CRM — capture and manage car enquiries from WhatsApp, walk-in and the XDrive marketplace in one visual sales pipeline built for Malaysian dealers.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "Enquiries scatter across WhatsApp, Instagram DMs, Mudah chat and sticky notes.",
      "No follow-up system — hot buyers go cold because nobody circled back.",
      "You can't tell which source or which salesman actually closes.",
      "Test drives and deposits live in someone's head, not a system.",
    ],
    solutions: [
      "One inbox: WhatsApp, walk-in, referral and marketplace enquiries auto-captured as leads.",
      "A drag-and-drop pipeline from new → contacted → test drive → negotiation → won.",
      "Every lead tagged by source and salesman, so conversion is finally measurable.",
      "Test-drive bookings, deposits and loan status tracked right on the lead.",
    ],
    capabilities: [
      { icon: Users, title: "Visual pipeline board", desc: "Drag a lead between stages; win it and the deal fans out to sold car, customer and handover automatically." },
      { icon: MessageCircle, title: "Auto lead capture", desc: "WhatsApp and marketplace enquiries land as leads with buyer name, phone and the exact car they asked about." },
      { icon: CalendarClock, title: "Test drives & appointments", desc: "Book a test drive against a car and a rep; every appointment stays in one calendar view." },
      { icon: Banknote, title: "Deposit & loan tracking", desc: "Deposit taken, bank, loan amount and approval status carried on the lead — no separate notebook." },
      { icon: Tag, title: "Source & rep attribution", desc: "Walk-in, WhatsApp, referral or marketplace — see which channel and which salesman actually convert." },
      { icon: ClipboardCheck, title: "Won = done, automatically", desc: "Closing a lead marks the car sold, creates the customer record and seeds the handover checklist in one move." },
    ],
    steps: {
      title: "How a lead moves",
      sub: "One pipeline from first message to closed deal.",
      items: [
        { title: "New", desc: "Enquiry captured from WhatsApp, walk-in or the marketplace." },
        { title: "Contacted", desc: "First reply logged; the follow-up clock starts." },
        { title: "Test drive", desc: "Booked against the car and the assigned salesman." },
        { title: "Negotiation", desc: "Price, trade-in and financing worked through." },
        { title: "Deposit", desc: "Deposit taken and recorded on the lead." },
        { title: "Won", desc: "Car flips to sold, customer created, handover seeded." },
      ],
    },
  },

  "revenue-analytics": {
    icon: LineChart,
    kicker: "Revenue & Profit",
    titleLead: "Your real profit —",
    titleAccent: "front and back, per unit",
    sub: "Not asking price. Not revenue. The actual gross you made this month — per car, per salesman, per source — computed from cost, recon, commission, holding and F&I add-ons.",
    seo: "ShiftOS Revenue Analytics — see true gross profit per unit, per salesman and month-over-month, with automatic commission and F&I back-end revenue.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "You know revenue, not profit — margin is a monthly guess.",
      "Commission is worked out by hand and argued over.",
      "No idea which salesman or which source is actually making money.",
      "Last month vs this month is a feeling, not a number.",
    ],
    solutions: [
      "Gross-profit month-to-date built from real parts — cost, recon, commission, holding, F&I.",
      "Commission calculated automatically on every closed deal.",
      "A per-salesman scoreboard: units, gross and conversion.",
      "This-month-vs-last, per unit and in total, on one dashboard.",
    ],
    capabilities: [
      { icon: LineChart, title: "Gross-profit MTD", desc: "Front + back gross recomputed live from cost, recon, services, commission and handover — never a stale stored figure." },
      { icon: Wallet, title: "Front & back gross split", desc: "See vehicle margin and F&I add-on margin separately, per unit and in aggregate." },
      { icon: Users, title: "Per-salesman scores", desc: "Units closed, gross generated, response time and conversion rate for every rep." },
      { icon: TrendingUp, title: "Month-over-month", desc: "MTD vs last-month-to-date on revenue, units and GP, with a daily gross-profit sparkline." },
      { icon: Percent, title: "Commission, automatic", desc: "Flat, % of sale or % of margin — every closed deal's commission calculated by the rule you set." },
      { icon: Receipt, title: "Add-on revenue", desc: "Back-end F&I revenue and average add-on per deal, so you see the money beyond the metal." },
    ],
  },

  "fi-documents": {
    icon: Landmark,
    kicker: "F&I & Documents",
    titleLead: "Back-end profit and paperwork,",
    titleAccent: "done properly",
    sub: "Sell warranty, insurance, tint and coating as tracked products, run HP financing, and issue the sales agreement and receipts — all recorded against the deal.",
    seo: "ShiftOS F&I & Documents — sell and track F&I add-ons, manage HP financing, and generate sales agreements and receipts for Malaysian used-car deals.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "Add-ons sold on the side, never recorded, never counted as profit.",
      "Loan applications tracked on a whiteboard; LOUs expire unnoticed.",
      "Sales agreements and deposit receipts retyped in Word every single time.",
      "F&I is a black box — you can't see back-end contribution.",
    ],
    solutions: [
      "A product catalogue (warranty, insurance, tint, coating) sold per deal and counted as back gross.",
      "An HP board: loan status from submitted → approved, with LOU expiry tracking.",
      "Generate the sales agreement and deposit receipt, and email them to the buyer.",
      "Back-end revenue flows straight into per-unit and monthly P&L.",
    ],
    capabilities: [
      { icon: Receipt, title: "F&I product catalogue", desc: "Define add-ons with cost and selling price; attach them to a deal and the margin books as back gross." },
      { icon: Landmark, title: "HP financing board", desc: "Track each loan — bank, amount, status (submitted / pending / approved / declined) and LOU validity." },
      { icon: FileSignature, title: "Document generation", desc: "Sales agreement, deposit receipt and more, generated from the deal's own data — no retyping." },
      { icon: MessageCircle, title: "Email straight to the buyer", desc: "Issue a document to the buyer's inbox and keep a record of it against the deal." },
      { icon: Calculator, title: "Insurance & loan estimates", desc: "Quick insurance premium and monthly-instalment estimates while you're closing." },
      { icon: Users, title: "Dedicated F&I role", desc: "An F&I officer seat so financing and paperwork have a clear owner, scoped by role and permission." },
    ],
  },

  "post-sale-handover": {
    icon: ClipboardCheck,
    kicker: "Post-Sale Handover",
    titleLead: "After “sold” comes the hard part —",
    titleAccent: "we run the checklist",
    sub: "The Malaysian ownership transfer — loan settlement, Puspakom, JPJ pindah milik, road tax, geran — as an automated 8-step checklist seeded the moment a deal is won.",
    seo: "ShiftOS Post-Sale Handover — automate the Malaysian car ownership transfer: loan settlement, Puspakom B5/B7, JPJ pindah milik, road tax and geran, as a per-sale checklist.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "“Sold” is where the real admin starts — and it lives on paper and WhatsApp.",
      "Puspakom B5/B7, JPJ pindah milik, road tax, geran — miss one and the buyer waits.",
      "Nobody's sure who owns which step: you, the runner, or the buyer.",
      "Handover costs are never deducted, so your “profit” is overstated.",
    ],
    solutions: [
      "An 8-step handover board auto-created the moment the lead is won.",
      "Every Malaysian step in order, with the official fee and who's responsible.",
      "B7 auto-marked N/A on cash deals, so nothing irrelevant clutters the list.",
      "Handover costs feed back into the unit's gross, so your profit stays honest.",
    ],
    capabilities: [
      { icon: ClipboardCheck, title: "Auto-seeded checklist", desc: "Win a deal and the 8-step handover appears — no setup, idempotent, identical no matter who closed it." },
      { icon: Landmark, title: "The Malaysian sequence", desc: "Loan settlement, buyer insurance, Puspakom B5 & B7, JPJ pindah milik, road tax, geran, then handover." },
      { icon: Users, title: "An owner for every step", desc: "Each step shows who's responsible — you, a runner, the dealer or the customer — and its live status." },
      { icon: Wallet, title: "Costs in your P&L", desc: "Puspakom, JPJ and other official fees sum into the unit's handover cost and reduce its gross." },
      { icon: Receipt, title: "Customer records & packages", desc: "Every won deal becomes a customer with car, plate, price and contact — ready for prepaid service packages." },
      { icon: BellRing, title: "Expiry reminders", desc: "Road tax and insurance expiring in 30 / 7 days, and overdue handover steps, trigger reminders automatically." },
    ],
    steps: {
      title: "The 8-step Malaysian handover",
      sub: "Seeded automatically when a deal is won — official fees are the standard rates and editable.",
      items: [
        { title: "Loan settlement", meta: "if under HP", desc: "Clear the previous owner's hire-purchase so the car can transfer." },
        { title: "Buyer insurance", desc: "New owner's policy in place before transfer." },
        { title: "Puspakom B5", meta: "RM30", desc: "Ownership-transfer inspection at Puspakom." },
        { title: "Puspakom B7", meta: "RM60 · financed only", desc: "Hire-purchase inspection — auto-marked N/A on cash deals." },
        { title: "JPJ pindah milik", meta: "RM100", desc: "Ownership transfer at JPJ — biometric for both parties, buyer within 7 days." },
        { title: "Road tax", desc: "Renewed under the new owner." },
        { title: "Geran collection", desc: "Collect the new registration card (geran)." },
        { title: "Handover", desc: "Keys and documents handed to the buyer — deal complete." },
      ],
    },
  },
};

const ORDER = ["smart-inventory", "leads-crm", "revenue-analytics", "fi-documents", "post-sale-handover"];

function Reveal({ children, delay = 0, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { threshold: 0.1 });
    if (delay) { const t = setTimeout(() => io.observe(el), delay); return () => { clearTimeout(t); io.disconnect(); }; }
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className="fp-reveal" style={style}>{children}</div>;
}

function Logo() {
  return (
    <Link to="/shiftos" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#e02020,#991b1b)", borderRadius: 7, transform: "rotate(6deg)", boxShadow: "0 3px 12px rgba(220,38,38,0.5)" }} />
        <span style={{ position: "relative", fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>S</span>
      </div>
      <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" style={{ height: 21, width: "auto", display: "block" }} />
    </Link>
  );
}

export default function FeaturePage() {
  const { slug } = useParams();
  const data = FEATURES[slug];

  useEffect(() => {
    if (data) window.scrollTo(0, 0);
  }, [slug, data]);

  if (!data) return <Navigate to="/shiftos" replace />;

  const HeroIcon = data.icon;
  const others = ORDER.filter((s) => s !== slug);

  return (
    <div className="fp-root">
      <Helmet>
        <title>{`${data.titleLead.replace(/[—-]\s*$/, "").trim()} ${data.titleAccent} | ShiftOS`}</title>
        <meta name="description" content={data.seo} />
      </Helmet>

      <style>{FP_CSS}</style>
      <div className="fp-bg" />
      <div className="fp-grid" />

      <div className="fp-content">
        {/* Nav */}
        <nav className="fp-nav">
          <div className="fp-wrap fp-nav-inner">
            <Logo />
            <div className="fp-nav-links">
              <Link to="/shiftos#features" className="fp-nav-link">All features</Link>
              <a href="https://xdrive.my" target="_blank" rel="noopener noreferrer" className="fp-nav-link">Marketplace</a>
              <Link to="/shiftos#pricing" className="fp-btn-primary" style={{ padding: "9px 18px", fontSize: 13 }}>
                Start free <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="fp-wrap" style={{ padding: "72px 24px 8px", textAlign: "center" }}>
          <Reveal>
            <Link to="/shiftos#features" className="fp-back">
              <ArrowLeft size={13} /> ShiftOS features
            </Link>
          </Reveal>
          <Reveal delay={60}>
            <div className="fp-eyebrow"><HeroIcon size={13} /> {data.kicker}</div>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="fp-h fp-hero-h1">
              {data.titleLead}{" "}<span className="fp-red">{data.titleAccent}</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="fp-hero-sub">{data.sub}</p>
          </Reveal>
          <Reveal delay={240}>
            <div className="fp-cta-row">
              <Link to="/shiftos#pricing" className="fp-btn-primary" style={{ fontSize: 15, padding: "14px 30px" }}>
                Start free <ArrowRight size={16} />
              </Link>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="fp-btn-outline" style={{ fontSize: 15, padding: "14px 30px" }}>
                <MessageCircle size={16} /> Talk to us
              </a>
            </div>
          </Reveal>
        </section>

        {/* Pain / solution split */}
        <section className="fp-wrap" style={{ paddingTop: 56 }}>
          <Reveal>
            <div className="fp-glass fp-ps">
              <div className="fp-ps-l">
                <p className="fp-ps-label" style={{ color: "#f87171" }}>{data.painTitle}</p>
                <ul className="fp-list">
                  {data.pains.map((p, i) => (
                    <li key={i}><X size={16} className="fp-x" /><span>{p}</span></li>
                  ))}
                </ul>
              </div>
              <div className="fp-ps-r">
                <p className="fp-ps-label" style={{ color: "#4ade80" }}>{data.solutionTitle}</p>
                <ul className="fp-list">
                  {data.solutions.map((s, i) => (
                    <li key={i}><Check size={16} className="fp-check" /><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Capabilities */}
        <section className="fp-wrap" style={{ paddingTop: 64 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <p className="fp-kicker">What you get</p>
              <h2 className="fp-h" style={{ fontSize: 42, color: "#fff", marginTop: 12 }}>Built into the workflow</h2>
            </div>
          </Reveal>
          <div className="fp-feat-grid">
            {data.capabilities.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 30}>
                <div className="fp-glass fp-feat">
                  <div className="fp-icon"><Icon size={20} color="#ef4444" /></div>
                  <p className="fp-feat-title">{title}</p>
                  <p className="fp-feat-desc">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Optional numbered sequence (post-sale handover, leads pipeline) */}
        {data.steps && (
          <section className="fp-wrap" style={{ paddingTop: 72 }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <p className="fp-kicker">Step by step</p>
                <h2 className="fp-h" style={{ fontSize: 42, color: "#fff", marginTop: 12, marginBottom: 10 }}>{data.steps.title}</h2>
                <p className="fp-muted" style={{ maxWidth: 560, margin: "0 auto" }}>{data.steps.sub}</p>
              </div>
            </Reveal>
            <div className="fp-steps">
              {data.steps.items.map((st, i) => (
                <Reveal key={st.title} delay={i * 25}>
                  <div className="fp-glass fp-step">
                    <div className="fp-step-num">{i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <p className="fp-step-title">
                        {st.title}
                        {st.meta && <span className="fp-step-meta">{st.meta}</span>}
                      </p>
                      <p className="fp-feat-desc" style={{ margin: 0 }}>{st.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* Cross-links to other features */}
        <section className="fp-wrap" style={{ paddingTop: 72 }}>
          <Reveal>
            <p className="fp-kicker" style={{ textAlign: "center", marginBottom: 22 }}>The rest of ShiftOS</p>
          </Reveal>
          <div className="fp-more-grid">
            {others.map((s) => {
              const o = FEATURES[s];
              const OIcon = o.icon;
              return (
                <Reveal key={s}>
                  <Link to={`/features/${s}`} className="fp-glass fp-more">
                    <div className="fp-icon" style={{ width: 38, height: 38 }}><OIcon size={17} color="#ef4444" /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="fp-more-title">{o.kicker}</p>
                      <p className="fp-feat-desc" style={{ margin: "2px 0 0" }}>{o.titleLead} {o.titleAccent}</p>
                    </div>
                    <ChevronRight size={16} color="#64748b" style={{ flexShrink: 0 }} />
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Final CTA */}
        <section className="fp-wrap" style={{ padding: "72px 24px 96px" }}>
          <Reveal>
            <div className="fp-glass" style={{ padding: "60px 32px", textAlign: "center", background: "radial-gradient(ellipse 800px 400px at 50% -10%, rgba(220,38,38,0.2) 0%, rgba(255,255,255,0.04) 100%)" }}>
              <h2 className="fp-h" style={{ fontSize: 46, color: "#fff", marginBottom: 14 }}>Run your dealership on ShiftOS</h2>
              <p className="fp-muted" style={{ maxWidth: 500, margin: "0 auto 34px" }}>
                One system for stock, leads, F&I, revenue and handover. Start free — no card, live in 30 minutes.
              </p>
              <div className="fp-cta-row" style={{ justifyContent: "center" }}>
                <Link to="/shiftos#pricing" className="fp-btn-primary" style={{ fontSize: 15, padding: "15px 34px" }}>
                  Start free <ArrowRight size={16} />
                </Link>
                <a href={WA} target="_blank" rel="noopener noreferrer" className="fp-btn-outline" style={{ fontSize: 15, padding: "15px 34px" }}>
                  <MessageCircle size={16} /> WhatsApp us
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer className="fp-footer">
          <div className="fp-wrap fp-footer-inner">
            <Logo />
            <div className="fp-footer-links">
              <Link to="/shiftos#features" className="fp-nav-link">Features</Link>
              <Link to="/shiftos#pricing" className="fp-nav-link">Pricing</Link>
              <Link to="/login" className="fp-nav-link">Log in</Link>
              <Link to="/" className="fp-nav-link">xdrive.my</Link>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#1f2937", marginTop: 20 }}>© {new Date().getFullYear()} XDrive · ShiftOS</p>
        </footer>
      </div>
    </div>
  );
}

const FP_CSS = `
  .fp-root{position:relative;min-height:100vh;background:#06080F;font-family:'Outfit','Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
  .fp-bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:
    radial-gradient(ellipse 1100px 700px at 10% -10%, rgba(220,38,38,0.16) 0%, transparent 65%),
    radial-gradient(ellipse 900px 600px at 90% 5%, rgba(37,99,235,0.10) 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 50% 90%, rgba(220,38,38,0.05) 0%, transparent 55%),
    #06080F;}
  .fp-grid{position:fixed;inset:-1px;z-index:0;pointer-events:none;
    background-image:linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px);
    background-size:52px 52px;
    -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 100%);
    mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 100%);}
  .fp-content{position:relative;z-index:1;}
  .fp-wrap{max-width:1120px;margin:0 auto;padding:0 24px;}

  .fp-nav{position:sticky;top:0;z-index:100;background:rgba(6,8,15,0.78);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);border-bottom:1px solid rgba(255,255,255,0.07);}
  .fp-nav-inner{height:64px;display:flex;align-items:center;justify-content:space-between;}
  .fp-nav-links{display:flex;align-items:center;gap:26px;}
  .fp-nav-link{color:#6b7280;font-size:14px;font-weight:500;text-decoration:none;transition:color .15s;}
  .fp-nav-link:hover{color:#fff;}

  .fp-h{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em;line-height:1.02;}
  .fp-hero-h1{font-size:60px;color:#fff;margin:20px auto 22px;max-width:900px;}
  .fp-red{background:linear-gradient(135deg,#fb7185,#dc2626 60%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
  .fp-hero-sub{font-size:18px;color:#94a3b8;max-width:640px;margin:0 auto 34px;line-height:1.65;}
  .fp-muted{font-size:15px;color:#94a3b8;line-height:1.65;}

  .fp-kicker{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#64748b;}
  .fp-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:5px 16px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.25);color:#fca5a5;margin-bottom:20px;}
  .fp-back{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;text-decoration:none;margin-bottom:20px;transition:color .15s;}
  .fp-back:hover{color:#fca5a5;}

  .fp-btn-primary{background:linear-gradient(135deg,#e02020,#b91c1c);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;text-decoration:none;white-space:nowrap;box-shadow:0 4px 24px rgba(220,38,38,0.38),inset 0 1px 0 rgba(255,255,255,0.14);transition:transform .15s,box-shadow .15s;padding:13px 26px;}
  .fp-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(220,38,38,0.52);}
  .fp-btn-outline{background:rgba(255,255,255,0.04);color:#e2e8f0;border:1px solid rgba(255,255,255,0.16);border-radius:11px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;text-decoration:none;white-space:nowrap;transition:background .2s,border-color .2s,transform .15s;padding:13px 26px;}
  .fp-btn-outline:hover{background:rgba(255,255,255,0.09);border-color:rgba(255,255,255,0.28);transform:translateY(-1px);}
  .fp-cta-row{display:flex;gap:12px;flex-wrap:wrap;}

  .fp-glass{background:linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%);border:1px solid rgba(255,255,255,0.1);border-radius:20px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 8px 40px rgba(0,0,0,0.38);position:relative;}
  .fp-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(220,38,38,0.18),rgba(220,38,38,0.06));border:1px solid rgba(220,38,38,0.28);flex-shrink:0;}

  .fp-ps{display:grid;grid-template-columns:1fr 1fr;overflow:hidden;}
  .fp-ps-l{padding:34px 32px;background:rgba(239,68,68,0.04);border-right:1px solid rgba(255,255,255,0.08);}
  .fp-ps-r{padding:34px 32px;}
  .fp-ps-label{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:0 0 18px;}
  .fp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;}
  .fp-list li{display:flex;gap:11px;align-items:flex-start;font-size:14px;line-height:1.55;color:#cbd5e1;}
  .fp-x{color:#f87171;flex-shrink:0;margin-top:1px;}
  .fp-check{color:#4ade80;flex-shrink:0;margin-top:1px;}

  .fp-feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .fp-feat{padding:26px;height:100%;transition:border-color .25s,background .25s,transform .2s;}
  .fp-feat:hover{border-color:rgba(220,38,38,0.38);transform:translateY(-3px);}
  .fp-feat-title{font-size:15px;font-weight:700;color:#f1f5f9;margin:16px 0 9px;}
  .fp-feat-desc{font-size:13px;color:#6b7280;line-height:1.65;margin:0;}

  .fp-steps{display:flex;flex-direction:column;gap:12px;max-width:760px;margin:0 auto;}
  .fp-step{display:flex;gap:18px;align-items:flex-start;padding:20px 22px;}
  .fp-step-num{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:18px;color:#fff;background:linear-gradient(135deg,rgba(220,38,38,0.9),rgba(153,27,27,0.9));box-shadow:0 3px 12px rgba(220,38,38,0.35);}
  .fp-step-title{font-size:15px;font-weight:700;color:#f1f5f9;margin:0 0 5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .fp-step-meta{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fca5a5;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.25);padding:2px 8px;border-radius:20px;}

  .fp-more-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:900px;margin:0 auto;}
  .fp-more{display:flex;align-items:center;gap:14px;padding:18px 20px;text-decoration:none;transition:border-color .2s,transform .2s;}
  .fp-more:hover{border-color:rgba(220,38,38,0.38);transform:translateY(-2px);}
  .fp-more-title{font-size:14px;font-weight:700;color:#f1f5f9;margin:0;}

  .fp-footer{border-top:1px solid rgba(255,255,255,0.06);padding:44px 24px;text-align:center;}
  .fp-footer-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;}
  .fp-footer-links{display:flex;gap:26px;flex-wrap:wrap;}

  .fp-reveal{opacity:0;transform:translateY(22px);transition:opacity .6s ease,transform .6s ease;}
  .fp-reveal.in{opacity:1;transform:none;}

  @media (max-width:860px){
    .fp-nav-links{gap:16px;}
    .fp-nav-links .fp-nav-link:nth-child(2){display:none;}
    .fp-hero-h1{font-size:42px;}
    .fp-hero-sub{font-size:16px;}
    .fp-ps{grid-template-columns:1fr;}
    .fp-ps-l{border-right:none;border-bottom:1px solid rgba(255,255,255,0.08);}
    .fp-feat-grid{grid-template-columns:1fr;}
    .fp-more-grid{grid-template-columns:1fr;}
  }
`;
