import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { trackPageView } from "../utils/analytics";
import {
  ArrowRight, Check, MessageCircle, Wallet, ChevronDown, Share2, ShieldCheck,
  X as XIcon, ExternalLink, Languages, Calculator, Repeat, Clock,
} from "lucide-react";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import PlanTour from "../components/salesmanLanding/PlanTour";
import LiveDemo from "../components/salesmanLanding/LiveDemo";
import PosterDemo from "../components/salesmanLanding/PosterDemo";
import { ROOT_DOMAIN } from "../config/site";
import {
  CANON, SEO_KEYWORDS, SOFTWARE_LD, FAQ_LD, FAQ_LD_EN, webpageLd, EXAMPLE_PAGE,
  DEFAULT_LANG, LANG_KEY, LANDING_COPY, landingCopy,
} from "../config/salesmanLandingCopy";

// Short on purpose (owner, 2026-10-23): one line per idea with a real picture
// beside it (the live presenter, a loan poster drawn by the real renderer, the
// page, real screenshots). The long copy lives on for the crawler (api/og.js).
// Audience (owner, 2026-10-06): agents who work out instalments on TikTok /
// Facebook lives. The hero sells Live presentation (free on Lite, owner 2026-10-18);
// Lite is the free way in, one button over. Every claim on this page must match
// what the product does — see the fact list at the top of salesmanLandingCopy.js.
// Malay first (owner, 2026-10-13): every visible string comes from
// landingCopy(lang); this page's language is its own per-device switch.

function readLang() {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    if (v && LANDING_COPY[v]) return v;
  } catch { /* storage blocked: fall back to Malay */ }
  return DEFAULT_LANG;
}
function saveLang(v) {
  try { window.localStorage.setItem(LANG_KEY, v); } catch { /* not persisted, still switches */ }
}

// ─── Scroll-reveal (restrained on purpose — see DESIGN.md: no ambient/looping
// decoration). One-shot fade+rise per section, staggered per grid item, so
// the page's existing light/dark section rhythm reads as a felt cadence
// instead of everything just appearing. Honors prefers-reduced-motion.
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const PREMIUM_SIGNUP = "/salesman-onboarding/premium";
const LITE_SIGNUP = "/salesman-onboarding/lite";

// Index-matched to copy.short.pains.
const PAIN_ICONS = [Calculator, Repeat, Clock];
const FINAL_TRUST_ICONS = [Wallet, ShieldCheck, Share2];

function Chips({ items }) {
  return (
    <ul className="sll-chips">
      {items.map((x) => <li key={x}><Check size={14} /> {x}</li>)}
    </ul>
  );
}

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
  const reduceMotion = useReducedMotion();
  const [lang, setLang] = useState(readLang);
  const t = landingCopy(lang);
  const s = t.short;
  const switchLang = () => { const next = t.switchTo; saveLang(next); setLang(next); };
  const reveal = reduceMotion
    ? {}
    : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 } };

  useEffect(() => trackPageView(supabase, "/for-salesmen", "landing_page_view"), []);

  return (
    <>
      <Helmet>
        <html lang={t.htmlLang} />
        <title>{t.seoTitle}</title>
        <meta name="description" content={t.seoDesc} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <link rel="canonical" href={CANON} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={t.seoTitle} />
        <meta property="og:description" content={t.seoDesc} />
        <meta property="og:url" content={CANON} />
        <meta property="og:site_name" content="XDrive" />
        <meta property="og:image" content="https://xdrive.my/og-default.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t.seoTitle} />
        <meta name="twitter:description" content={t.seoDesc} />
        <script type="application/ld+json">{JSON.stringify(webpageLd(lang))}</script>
        <script type="application/ld+json">{JSON.stringify(SOFTWARE_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(lang === "en" ? FAQ_LD_EN : FAQ_LD)}</script>
      </Helmet>

      <style>{CSS}</style>
      {/* This is a salesman-recruitment page, not the buyer marketplace — the
          global announcement bar carries buyer-facing copy ("Buy your next
          car, safely...") that's out of place here. */}
      <MarketplaceHeader hideAnnouncement />

      <main className="sll" lang={t.htmlLang}>
        {/* ── Hero: Live presentation ── */}
        <section className="sll-hero">
          <div className="sll-wrap sll-langbar">
            <button type="button" className="sll-lang" onClick={switchLang} lang={t.switchTo}>
              <Languages size={14} /> {t.switchLabel}
            </button>
          </div>
          <div className="sll-wrap sll-hero-inner">
            <div className="sll-hero-copy">
              <span className="sll-eyebrow">{t.heroEyebrow}</span>
              <h1 className="sll-h1">
                {t.heroH1Lines.map((line, i) => {
                  const last = i === t.heroH1Lines.length - 1;
                  return (
                    <React.Fragment key={line}>
                      {last ? <span className="sll-red">{line}</span> : line}
                      {!last && <br />}
                    </React.Fragment>
                  );
                })}
              </h1>
              <p className="sll-lead">{s.heroLine}</p>
              <div className="sll-cta-row">
                <Link to={LITE_SIGNUP} className="sll-btn sll-btn-red">
                  {t.liveCta} <ArrowRight size={17} />
                </Link>
                <Link to={PREMIUM_SIGNUP} className="sll-btn sll-btn-ghost">{t.premiumCta}</Link>
              </div>
              <p className="sll-microtrust">
                {t.heroTrust.map((x) => (
                  <span key={x} className="sll-microtrust-item"><Check size={14} /> {x}</span>
                ))}
              </p>
            </div>

            {/* The real Live presentation, real cars (LiveDemo.jsx) */}
            <div className="sll-hero-mock">
              <LiveDemo copy={t.demo} lang={lang} />
            </div>
          </div>
        </section>

        {/* ── Marketplace band ── */}
        <div className="sll-band-line">
          <div className="sll-wrap">
            {t.band.before}<strong>{t.band.strong}</strong>{t.band.after}
          </div>
        </div>

        {/* ── Pain: three short lines, then the fix ── */}
        <section className="sll-section sll-section-alt">
          <div className="sll-wrap">
            <p className="sll-kicker">{s.painKicker}</p>
            <motion.div className="sll-pains" variants={staggerParent} {...reveal}>
              {s.pains.map((line, i) => {
                const Icon = PAIN_ICONS[i] || XIcon;
                return (
                  <motion.div key={line} className="sll-pain" variants={fadeUp}>
                    <div className="sll-pain-ic"><Icon size={18} /></div>
                    <p>{line}</p>
                  </motion.div>
                );
              })}
            </motion.div>
            <p className="sll-pain-fix">{s.painFix}</p>
          </div>
        </section>

        {/* ── What you get: a real picture beside one line each ── */}
        <section className="sll-section">
          <div className="sll-wrap">
            <p className="sll-kicker">{s.getKicker}</p>

            <motion.div className="sll-feat" variants={fadeUp} {...reveal}>
              <div className="sll-feat-copy">
                <h2 className="sll-h2 sll-feat-h">{s.poster.title}</h2>
                <p className="sll-feat-line">{s.poster.line}</p>
                <Chips items={s.poster.chips} />
              </div>
              <div className="sll-feat-pic">
                <PosterDemo copy={s.poster} lang={lang} role={t.showcase.phoneRole} />
              </div>
            </motion.div>

            <motion.div className="sll-feat sll-feat-flip" variants={fadeUp} {...reveal}>
              <div className="sll-feat-copy">
                <h2 className="sll-h2 sll-feat-h">{s.page.title}</h2>
                <p className="sll-feat-line">{s.page.line}</p>
                <Chips items={s.page.chips} />
                <Link to={EXAMPLE_PAGE.path} className="sll-example">
                  {t.showcase.example} <strong>{EXAMPLE_PAGE.label}</strong> <ExternalLink size={14} />
                </Link>
              </div>
              <figure className="sll-phone sll-feat-pic" aria-label={t.showcase.phoneAria}>
                <div className="sll-phone-top">
                  <span className="sll-phone-url">{ROOT_DOMAIN}/s/<strong>ahmad</strong></span>
                </div>
                <div className="sll-phone-hero">
                  <div className="sll-phone-avatar">A</div>
                  <div>
                    <div className="sll-phone-name">Ahmad · {t.showcase.phoneRole}</div>
                    <div className="sll-phone-sub">{t.showcase.phoneArea}</div>
                  </div>
                </div>
                {t.showcase.cars.map((c) => (
                  <div key={c.name} className="sll-phone-car">
                    <div className="sll-phone-thumb" />
                    <div className="sll-phone-carinfo">
                      <div className="sll-phone-cn">{c.name}</div>
                      <div className="sll-phone-cp">{c.price} <span>· {c.tag}</span></div>
                    </div>
                    <div className="sll-phone-wa"><MessageCircle size={14} /></div>
                  </div>
                ))}
                <figcaption className="sll-phone-cap">{t.showcase.caption}</figcaption>
              </figure>
            </motion.div>
          </div>
        </section>

        {/* ── What you get with each plan: one real screenshot per tab ── */}
        <PlanTour copy={t.tour} />

        {/* ── How it works (inverted) ── */}
        <section className="sll-dark" id="how">
          <div className="sll-wrap">
            <p className="sll-kicker sll-kicker-light">{t.how.kicker}</p>
            <h2 className="sll-h2 sll-h2-light">{t.how.title}</h2>
            <motion.div className="sll-steps" variants={staggerParent} {...reveal}>
              {t.how.steps.map((st) => (
                <motion.div key={st.n} className="sll-step" variants={fadeUp}>
                  <span className="sll-step-n">{st.n}</span>
                  <h3 className="sll-step-t">{st.title}</h3>
                  <p className="sll-step-b">{st.body}</p>
                </motion.div>
              ))}
            </motion.div>
            <div className="sll-dark-cta">
              <Link to={LITE_SIGNUP} className="sll-btn sll-btn-red">
                {t.liveCta} <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Lite vs Premium ── */}
        <section className="sll-section sll-section-alt">
          <div className="sll-wrap">
            <p className="sll-kicker">{s.plansKicker}</p>
            <h2 className="sll-h2">{s.plansTitle}</h2>
            <div className="sll-plans">
              <div className="sll-plan sll-plan-alt">
                <div className="sll-plan-head">
                  <span className="sll-plan-name">{t.plans.premiumName}</span>
                  <span className="sll-plan-price">RM35<span>{t.plans.premiumPer}</span></span>
                  <span className="sll-plan-note">{t.plans.premiumNote}</span>
                </div>
                <ul className="sll-plan-list">
                  {s.premiumBullets.map((x) => (
                    <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
                  ))}
                  <li className="sll-plan-more">{s.more}</li>
                </ul>
                <Link to={PREMIUM_SIGNUP} className="sll-btn sll-btn-red sll-btn-block">{t.premiumCta}</Link>
              </div>
              <div className="sll-plan">
                <div className="sll-plan-head">
                  <span className="sll-plan-name">{t.plans.liteName}</span>
                  <span className="sll-plan-price">RM0<span>{t.plans.litePer}</span></span>
                </div>
                <ul className="sll-plan-list">
                  {s.liteBullets.map((x) => (
                    <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
                  ))}
                </ul>
                <Link to={LITE_SIGNUP} className="sll-btn sll-btn-dark sll-btn-block">{t.liteCta}</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <motion.section className="sll-section sll-faq-sec" variants={fadeUp} {...reveal}>
          <div className="sll-wrap sll-wrap-narrow">
            <p className="sll-kicker">{t.faq.kicker}</p>
            <h2 className="sll-h2" style={{ marginBottom: 8 }}>{t.faq.title}</h2>
            <p className="sll-updated">{t.faq.reviewed} {t.faq.reviewedLabel}.</p>
            <div className="sll-faqs">
              {t.faq.items.map((f) => <Faq key={f.q} {...f} />)}
            </div>
          </div>
        </motion.section>

        {/* ── Final CTA ── */}
        <motion.section className="sll-final" variants={fadeUp} {...reveal}>
          <div className="sll-wrap">
            <h2 className="sll-final-h">
              {t.final.titleLines[0]}<br />{t.final.titleLines[1]}
            </h2>
            <p className="sll-final-p">{t.final.body}</p>
            <div className="sll-cta-row sll-cta-center">
              <Link to={LITE_SIGNUP} className="sll-btn sll-btn-red sll-btn-lg">
                {t.liveCta} <ArrowRight size={18} />
              </Link>
            </div>
            <p className="sll-final-alt"><Link to={PREMIUM_SIGNUP}>{t.final.liteLink}</Link></p>
            <p className="sll-microtrust sll-center">
              {t.final.trust.map((x, i) => {
                const Icon = FINAL_TRUST_ICONS[i] || Check;
                return <span key={x} className="sll-microtrust-item"><Icon size={14} /> {x}</span>;
              })}
            </p>
          </div>
        </motion.section>
      </main>

      <MarketplaceFooter />
    </>
  );
}

const CSS = `
  /* No @import here — index.html loads Outfit 300-900 (incl. the 900 this page
     uses for .sll-h1 / .sll-plan-price / .sll-final-h) asynchronously. An
     @import inside a <style> tag is the slowest way to fetch a font: it blocks
     render until it resolves, on the one page the whole Lite campaign lands on. */
  .sll { font-family: 'Outfit', system-ui, sans-serif; background: #ffffff; color: #0a0a0a; -webkit-font-smoothing: antialiased; }
  .sll-wrap { max-width: 1080px; margin: 0 auto; padding: 0 22px; }
  .sll-wrap-narrow { max-width: 760px; }
  .sll-red { color: #dc2626; }

  /* Language switch: page-local (BM first), top of the hero */
  .sll-langbar { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .sll-lang { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 7px 14px; border-radius: 999px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: border-color .15s, color .15s; }
  .sll-lang:hover { border-color: #0a0a0a; color: #0a0a0a; }
  .sll-lang svg { flex-shrink: 0; }

  /* Hero */
  .sll-hero { padding: 28px 0 60px; border-bottom: 1px solid #eceaea; }
  .sll-hero-inner { display: grid; grid-template-columns: 1fr minmax(320px, 400px); gap: 56px; align-items: start; }
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

  /* Hero picture: the real Live presentation (LiveDemo.jsx) */
  .sll-hero-mock { min-width: 0; }

  /* Sections */
  .sll-section { padding: 74px 0; }
  .sll-section-alt { background: #fafafa; border-top: 1px solid #eceaea; border-bottom: 1px solid #eceaea; }
  .sll-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #dc2626; margin: 0 0 12px; }
  .sll-kicker-light { color: #f87171; }
  .sll-h2 { font-size: clamp(28px, 4.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 40px; }
  .sll-h2-light { color: #fff; }


  /* Pain: three short cards, then the fix */
  .sll-pains { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 30px; }
  .sll-pain { display: flex; align-items: flex-start; gap: 14px; background: #fff; border: 1px solid #eceaea; border-radius: 14px; padding: 20px; }
  .sll-pain p { font-size: 16px; line-height: 1.45; color: #1f2733; margin: 0; }
  .sll-pain-ic { width: 38px; height: 38px; border-radius: 10px; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-pain-fix { font-size: clamp(22px, 3vw, 30px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; margin: 0; }

  /* What you get: copy | real picture, alternating */
  .sll-feat { display: grid; grid-template-columns: 1fr 380px; gap: 56px; align-items: center; padding: 28px 0 44px; }
  .sll-feat + .sll-feat { border-top: 1px solid #eceaea; padding-top: 56px; }
  .sll-feat-flip { grid-template-columns: 380px 1fr; }
  .sll-feat-flip .sll-feat-copy { order: 2; }
  .sll-feat-flip .sll-feat-pic { order: 1; }
  .sll-feat-copy { min-width: 0; }
  .sll-feat-pic { justify-self: center; width: 100%; }
  .sll-feat-h { margin-bottom: 14px; }
  .sll-feat-line { font-size: 18px; line-height: 1.5; color: #4b5563; margin: 0 0 20px; max-width: 520px; }
  .sll-chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .sll-chips li { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #1f2733; background: #f5f5f4; border: 1px solid #eceaea; border-radius: 999px; padding: 7px 13px; }
  .sll-chips svg { color: #dc2626; flex-shrink: 0; }
  .sll-plan-more { color: #6b7280 !important; font-weight: 600; padding-left: 24px !important; }

  /* Last-updated stamp (FAQ) */
  .sll-updated { font-size: 12.5px; color: #9ca3af; margin: 0 0 28px; }


  .sll-example { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 20px; font-size: 15px; font-weight: 600; color: #0a0a0a; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #d1d5db; }
  .sll-example:hover { text-decoration-color: #0a0a0a; }
  .sll-example strong { font-weight: 800; }
  .sll-phone { margin: 0; max-width: 360px; border: 1px solid #e5e7eb; border-radius: 22px; padding: 14px; background: #fff; box-shadow: 0 24px 60px rgba(10,10,10,0.10); }
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
  .sll-phone-cap { font-size: 12px; color: #9ca3af; text-align: center; padding: 10px 0 2px; }
  .sll-phone-wa { width: 30px; height: 30px; border-radius: 8px; background: #25D366; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

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
  .sll-plan { border: 1px solid #eceaea; border-radius: 18px; padding: 30px 28px; display: flex; flex-direction: column; background: #fff; }
  .sll-plan-alt { border: 1.5px solid #0a0a0a; }
  .sll-plan-head { margin-bottom: 22px; }
  .sll-plan-name { display: block; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
  .sll-plan-price { font-size: 40px; font-weight: 900; letter-spacing: -0.03em; }
  .sll-plan-note { display: block; font-size: 13px; font-weight: 700; color: #dc2626; margin-top: 6px; }
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
  .sll-final-alt { margin: 16px 0 0; font-size: 14px; }
  .sll-final-alt a { color: rgba(255,255,255,0.75); text-decoration: underline; text-underline-offset: 3px; }
  .sll-final-alt a:hover { color: #fff; }
  .sll-final .sll-microtrust { color: rgba(255,255,255,0.5); justify-content: center; }

  @media (max-width: 860px) {
    .sll-steps, .sll-plans, .sll-pains, .sll-feat, .sll-feat-flip, .sll-hero-inner { grid-template-columns: 1fr; }
    .sll-feat { gap: 28px; padding: 8px 0 36px; }
    .sll-feat + .sll-feat { padding-top: 36px; }
    .sll-feat-flip .sll-feat-copy, .sll-feat-flip .sll-feat-pic { order: 0; }
    .sll-feat-line { font-size: 16px; }
    .sll-hero { padding: 16px 0 48px; }
    .sll-langbar { margin-bottom: 24px; }
    .sll-hero-inner { gap: 36px; }
    .sll-hero-mock { max-width: 400px; width: 100%; margin: 0 auto; }
    .sll-phone { max-width: 340px; margin: 0 auto; }
    /* Three items in one wrapped inline row read as clanky on narrow screens
       (a checkmark stranding itself on the next line from its own text) —
       one clean item per line instead. */
    .sll-microtrust { flex-direction: column; align-items: flex-start; gap: 10px; }
    .sll-final .sll-microtrust { align-items: center; }
  }
`;
