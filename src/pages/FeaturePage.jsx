import React, { useEffect, useRef } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { FEATURES, ORDER, featureTitle } from "../config/featurePagesCopy";
import {
  ArrowRight, ArrowLeft, Check, MessageCircle, ChevronRight,
  Car, Package, Wallet, Clock, Calculator, Gauge, Globe,
  Users, CalendarClock, Banknote, Tag, ClipboardCheck,
  LineChart, TrendingUp, Percent, Receipt, Landmark, FileSignature,
  BellRing, X,
} from "lucide-react";

const WA = "https://wa.me/601111521742?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

// Content lives in src/config/featurePagesCopy.js (shared with api/og.js).
const ICONS = { Banknote, BellRing, Calculator, CalendarClock, Car, ClipboardCheck, Clock, FileSignature, Gauge, Globe, Landmark, LineChart, MessageCircle, Package, Percent, Receipt, Tag, TrendingUp, Users, Wallet };

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
      <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" style={{ height: 17, width: "auto", display: "block" }} />
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

  const HeroIcon = ICONS[data.icon];
  const others = ORDER.filter((s) => s !== slug);

  return (
    <div className="fp-root">
      <Helmet>
        <title>{`${featureTitle(data)} | ShiftOS`}</title>
        <meta name="description" content={data.seo} />
        <link rel="canonical" href={`https://xdrive.my/features/${slug}`} />
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
            {data.capabilities.map(({ icon, title, desc }, i) => {
              const Icon = ICONS[icon];
              return (
              <Reveal key={title} delay={i * 30}>
                <div className="fp-glass fp-feat">
                  <div className="fp-icon"><Icon size={20} color="#ef4444" /></div>
                  <p className="fp-feat-title">{title}</p>
                  <p className="fp-feat-desc">{desc}</p>
                </div>
              </Reveal>
              );
            })}
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
              const OIcon = ICONS[o.icon];
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
