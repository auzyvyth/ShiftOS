import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "../supabaseClient";
import { trackPageView } from "../utils/analytics";
import {
  ArrowRight, Check, MessageCircle, Wallet, ChevronDown, Share2, ShieldCheck,
  X as XIcon, ExternalLink, Languages, Calculator, Repeat, Clock, LayoutDashboard, Users,
} from "lucide-react";
import MarketplaceHeader from "../components/MarketplaceHeader";
import MarketplaceFooter from "../components/MarketplaceFooter";
import PlanTour from "../components/salesmanLanding/PlanTour";
import LiveDemo from "../components/salesmanLanding/LiveDemo";
import PosterDemo from "../components/salesmanLanding/PosterDemo";
import { ROOT_DOMAIN } from "../config/site";
import { PLAN_CONFIG } from "../utils/planConfig";
import {
  CANON, SEO_KEYWORDS, SOFTWARE_LD, FAQ_LD, FAQ_LD_EN, webpageLd, EXAMPLE_PAGE,
  DEFAULT_LANG, LANG_KEY, LANDING_COPY, landingCopy,
} from "../config/salesmanLandingCopy";

// Short on purpose (owner, 2026-10-23): one line per idea with a real picture
// beside it (the live presenter, a loan poster drawn by the real renderer, the
// page, real screenshots). The long copy lives on for the crawler (api/og.js).
// Audience (owner, 2026-10-06): agents who work out instalments on TikTok /
// Facebook lives. The hero sells Premium as one app in three parts (owner,
// 2026-10-28); Lite is the free way in, one link under the button. Every claim on this page must match
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
// Hero: index-matched to copy.short.offer.parts and to the screenshots in
// public/for-salesmen (hero-<key>-<lang>.webp, the real app on sample data).
const HERO_ICONS = [Calculator, LayoutDashboard, Users];
const HERO_SHOTS = ["calc", "dash", "leads"];
// The plan card body: the hero's three numbered parts, same icons, so the
// cards read as the same "3 in 1" and Lite vs Premium compares part by part.
function PlanGroups({ groups }) {
  return (
    <div className="sll-plan-groups">
      {groups.map((g, i) => {
        const Icon = HERO_ICONS[i] || Check;
        return (
          <div key={g.h} className="sll-plan-group">
            <p className="sll-plan-gh">
              <span className="sll-plan-gic"><Icon size={15} /><span>{i + 1}</span></span> {g.h}
            </p>
            <ul className="sll-plan-list">
              {g.items.map((x) => (
                <li key={x}><Check size={15} className="sll-tick" /> {x}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

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
  const pc = s.planCards;
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
        {/* ── Hero (owner, 2026-10-28): laid out like a product-box ad. The
            three parts, a real screen of each, the price and how it is billed,
            so nobody reads the product as "a calculator". ── */}
        <section className="sll-hero">
          <div className="sll-wrap sll-langbar">
            <button type="button" className="sll-lang" onClick={switchLang} lang={t.switchTo}>
              <Languages size={14} /> {t.switchLabel}
            </button>
          </div>
          <div className="sll-wrap sll-hero-inner">
            <span className="sll-tag">{s.offer.tag}</span>
            <h1 className="sll-h1">
              {s.offer.h1a}<br /><span className="sll-red">{s.offer.h1b}</span>
            </h1>
            <p className="sll-sub">{s.offer.sub}</p>
            <p className="sll-lead">{s.offer.line}</p>

            <ol className="sll-parts">
              {s.offer.parts.map((part, i) => {
                const Icon = HERO_ICONS[i];
                return (
                  <li key={part.title} className="sll-part">
                    <span className="sll-part-ic"><Icon size={22} /><span className="sll-part-n">{i + 1}</span></span>
                    <span className="sll-part-copy">
                      <strong>{part.title}</strong>
                      <span>{part.line}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="sll-devices">
              {HERO_SHOTS.map((k, i) => (
                <figure key={k} className={`sll-device sll-device-${i}`}>
                  <img src={`/for-salesmen/hero-${k}-${lang}.webp`} alt={s.offer.parts[i].alt}
                    width={600} height={1068} decoding="async" fetchPriority={i === 1 ? "high" : "auto"} />
                </figure>
              ))}
              <div className="sll-sticker" aria-label={`${s.offer.priceKicker} ${s.offer.price}${s.offer.per}, ${s.offer.priceNote}`}>
                <span className="sll-sticker-k">{s.offer.priceKicker}</span>
                <span className="sll-sticker-p">{s.offer.price}<small>{s.offer.per}</small></span>
                <span className="sll-sticker-n">{s.offer.priceNote}</span>
              </div>
            </div>
            <p className="sll-shots-note">{s.offer.shotsNote}</p>

            <ul className="sll-badges">
              {s.offer.badges.map((x) => (
                <li key={x}><span className="sll-badge-ic"><Check size={15} /></span>{x}</li>
              ))}
            </ul>

            <div className="sll-hero-cta">
              <Link to={PREMIUM_SIGNUP} className="sll-btn sll-btn-red sll-btn-lg">
                {s.offer.cta} <ArrowRight size={18} />
              </Link>
              <p className="sll-hero-bill">{s.offer.billing}</p>
              <Link to={LITE_SIGNUP} className="sll-hero-lite">{s.offer.liteLink}</Link>
            </div>
          </div>
        </section>

        {/* ── Try it: the real Live presentation, real cars (LiveDemo.jsx) ── */}
        <section className="sll-section sll-try">
          <div className="sll-wrap sll-try-inner">
            <div>
              <p className="sll-kicker">{s.offer.tryKicker}</p>
              <h2 className="sll-h2 sll-try-h">{s.offer.tryTitle}</h2>
            </div>
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

        {/* ── Plans: Premium first, then Lite, then how paying works ── */}
        <section className="sll-section sll-section-alt" id="pricing">
          <div className="sll-wrap">
            <p className="sll-kicker">{s.plansKicker}</p>
            <h2 className="sll-h2">{s.plansTitle}</h2>
            <div className="sll-plans">
              <div className="sll-plan sll-plan-pro">
                <span className="sll-plan-badge">{pc.premium.badge}</span>
                <div className="sll-plan-head">
                  <span className="sll-plan-name">{t.plans.premiumName}</span>
                  <span className="sll-plan-price">RM{PLAN_CONFIG.salesman_full.price}<span>{t.plans.premiumPer}</span></span>
                  <span className="sll-plan-bill">{pc.premium.billing}</span>
                </div>
                <PlanGroups groups={pc.premium.groups} />
                <div className="sll-plan-more">
                  <p>{pc.premium.moreLabel}</p>
                  <ul>{pc.premium.more.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <Link to={PREMIUM_SIGNUP} className="sll-btn sll-btn-red sll-btn-block">
                  {s.offer.cta} <ArrowRight size={17} />
                </Link>
              </div>
              <div className="sll-plan">
                <div className="sll-plan-head">
                  <span className="sll-plan-name">{t.plans.liteName}</span>
                  <span className="sll-plan-price">RM0<span>{t.plans.litePer}</span></span>
                  <span className="sll-plan-bill">{pc.lite.billing}</span>
                </div>
                <PlanGroups groups={pc.lite.groups} />
                <Link to={LITE_SIGNUP} className="sll-btn sll-btn-dark sll-btn-block">{t.liteCta}</Link>
              </div>
            </div>

            <div className="sll-pay">
              <p className="sll-pay-k">{pc.payKicker}</p>
              <ol className="sll-pay-steps">
                {pc.paySteps.map((st, i) => (
                  <li key={st.when} className="sll-pay-step">
                    <span className="sll-pay-n">{i + 1}</span>
                    <span className="sll-pay-when">{st.when}</span>
                    <strong>{st.title}</strong>
                    <span className="sll-pay-line">{st.line}</span>
                  </li>
                ))}
              </ol>
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
  .sll-langbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
  .sll-lang { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 7px 14px; border-radius: 999px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: border-color .15s, color .15s; }
  .sll-lang:hover { border-color: #0a0a0a; color: #0a0a0a; }
  .sll-lang svg { flex-shrink: 0; }

  /* Hero: product-box layout */
  .sll-hero { padding: 20px 0 56px; border-bottom: 1px solid #eceaea; background: linear-gradient(#fff 55%, #f5f5f4); overflow: hidden; }
  .sll-hero-inner { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .sll-tag { display: inline-block; background: #dc2626; color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; padding: 8px 20px; border-radius: 999px; margin-bottom: 14px; }
  .sll-h1 { font-size: clamp(46px, 8vw, 88px); font-weight: 900; line-height: 0.95; letter-spacing: -0.035em; text-transform: uppercase; margin: 0; }
  .sll-sub { font-size: clamp(14px, 2.2vw, 22px); font-weight: 800; letter-spacing: 0.32em; text-transform: uppercase; margin: 12px 0 14px; padding-left: 0.32em; }
  .sll-lead { font-size: clamp(15px, 2vw, 18px); line-height: 1.55; color: #374151; max-width: 640px; margin: 0 0 28px; }
  .sll-parts { list-style: none; padding: 0; margin: 0 0 30px; display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; max-width: 940px; }
  .sll-part { display: flex; align-items: flex-start; gap: 14px; text-align: left; padding: 0 22px; }
  .sll-part + .sll-part { border-left: 1px solid #e5e7eb; }
  .sll-part-ic { position: relative; width: 50px; height: 50px; border-radius: 13px; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-part-n { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%; background: #dc2626; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
  .sll-part-copy strong { display: block; font-size: 18px; font-weight: 800; line-height: 1.2; color: #0a0a0a; }
  .sll-part-copy span { display: block; font-size: 14px; line-height: 1.4; color: #4b5563; margin-top: 3px; }

  /* Three real screens in phone frames; the middle one sits in front */
  .sll-devices { position: relative; display: flex; justify-content: center; align-items: flex-end; width: 100%; max-width: 880px; padding: 10px 0 0; }
  .sll-device { margin: 0; flex: 0 0 auto; width: 250px; border-radius: 34px; padding: 9px; background: #0a0a0a; box-shadow: 0 28px 60px rgba(10,10,10,0.22); }
  .sll-device img { display: block; width: 100%; height: auto; border-radius: 26px; }
  .sll-device-0, .sll-device-2 { transform: scale(0.88); transform-origin: bottom center; z-index: 1; }
  .sll-device-0 { margin-right: -34px; }
  .sll-device-2 { margin-left: -34px; }
  .sll-device-1 { z-index: 2; width: 270px; }
  .sll-sticker { position: absolute; right: 0; bottom: 40px; z-index: 3; display: flex; flex-direction: column; align-items: center; background: #dc2626; color: #fff; padding: 14px 22px 12px; border-radius: 16px; transform: rotate(-6deg); box-shadow: 0 16px 36px rgba(220,38,38,0.35); line-height: 1; }
  .sll-sticker-k { font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.9; }
  .sll-sticker-p { font-size: 44px; font-weight: 900; letter-spacing: -0.03em; margin: 6px 0 4px; }
  .sll-sticker-p small { font-size: 16px; font-weight: 700; letter-spacing: 0; }
  .sll-sticker-n { font-size: 12.5px; font-weight: 700; }
  .sll-shots-note { font-size: 12px; color: #9ca3af; margin: 14px 0 22px; }

  .sll-badges { list-style: none; padding: 0; margin: 0 0 26px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 24px; }
  .sll-badges li { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #1f2733; }
  .sll-badge-ic { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #0a0a0a; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-hero-cta { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .sll-hero-bill { font-size: 13.5px; color: #4b5563; margin: 4px 0 0; max-width: 460px; line-height: 1.5; }
  .sll-hero-lite { font-size: 14px; font-weight: 600; color: #374151; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #d1d5db; }
  .sll-hero-lite:hover { color: #0a0a0a; text-decoration-color: #0a0a0a; }

  /* Try it: the interactive presenter, under the hero */
  .sll-try-inner { display: grid; grid-template-columns: 1fr minmax(320px, 400px); gap: 56px; align-items: center; }
  .sll-try-h { margin-bottom: 0; }
  .sll-btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-size: 15px; font-weight: 700; padding: 14px 26px; border-radius: 10px; text-decoration: none; cursor: pointer; border: none; transition: transform .15s, box-shadow .15s, background .15s; }
  .sll-btn:hover { transform: translateY(-1px); }
  .sll-btn-lg { font-size: 16px; padding: 16px 32px; }
  .sll-btn-red { background: #dc2626; color: #fff; box-shadow: 0 8px 24px rgba(220,38,38,0.28); }
  .sll-btn-red:hover { background: #c11f1f; box-shadow: 0 10px 30px rgba(220,38,38,0.38); }
  .sll-btn-dark { background: #0a0a0a; color: #fff; }
  .sll-btn-dark:hover { background: #222; }
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



  /* Plans: Premium is the dark card (the hero's phone frames), Lite white */
  .sll-plans { display: grid; grid-template-columns: 1.1fr 1fr; gap: 18px; align-items: start; }
  .sll-plan { position: relative; border: 1px solid #e5e7eb; border-radius: 22px; padding: 30px 28px; display: flex; flex-direction: column; background: #fff; }
  .sll-plan-pro { background: #0a0a0a; border-color: #0a0a0a; color: #fff; box-shadow: 0 28px 60px rgba(10,10,10,0.22); }
  .sll-plan-badge { position: absolute; top: -14px; right: 22px; background: #dc2626; color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; padding: 8px 14px; border-radius: 10px; transform: rotate(-4deg); box-shadow: 0 10px 24px rgba(220,38,38,0.35); }
  .sll-plan-head { margin-bottom: 18px; }
  .sll-plan-name { display: block; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
  .sll-plan-pro .sll-plan-name { color: rgba(255,255,255,0.6); }
  .sll-plan-price { display: block; font-size: 52px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
  .sll-plan-price span { font-size: 17px; font-weight: 700; color: #9ca3af; letter-spacing: 0; }
  .sll-plan-bill { display: inline-block; margin-top: 12px; font-size: 13px; font-weight: 700; color: #1f2733; background: #f3f4f6; border-radius: 999px; padding: 6px 12px; }
  .sll-plan-pro .sll-plan-bill { color: #fff; background: rgba(255,255,255,0.1); }
  .sll-plan-groups { flex: 1; margin-bottom: 18px; }
  .sll-plan-group { padding: 14px 0 6px; border-top: 1px solid #f0efee; }
  .sll-plan-pro .sll-plan-group { border-top-color: rgba(255,255,255,0.1); }
  .sll-plan-gh { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 800; margin: 0 0 4px; }
  .sll-plan-gic { position: relative; width: 30px; height: 30px; border-radius: 9px; background: #0a0a0a; color: #fff; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sll-plan-gic span { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .sll-plan-pro .sll-plan-gic { background: #fff; color: #0a0a0a; }
  .sll-plan-list { list-style: none; padding: 0; margin: 0 0 6px; }
  .sll-plan-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 14.5px; color: #1f2733; padding: 5px 0; line-height: 1.4; }
  .sll-plan-pro .sll-plan-list li { color: rgba(255,255,255,0.88); }
  .sll-tick { color: #dc2626; flex-shrink: 0; margin-top: 2px; }
  .sll-plan-pro .sll-tick { color: #f87171; }
  .sll-plan-more { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; margin-bottom: 22px; }
  .sll-plan-more p { font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin: 0 0 10px; }
  .sll-plan-more ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 7px; }
  .sll-plan-more li { font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.08); border-radius: 999px; padding: 6px 11px; }

  /* How paying works: three steps under the cards */
  .sll-pay { margin-top: 26px; background: #fff; border: 1px solid #e5e7eb; border-radius: 22px; padding: 24px 26px; }
  .sll-pay-k { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #dc2626; margin: 0 0 16px; }
  .sll-pay-steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .sll-pay-step { position: relative; padding-left: 44px; }
  .sll-pay-n { position: absolute; left: 0; top: 0; width: 32px; height: 32px; border-radius: 50%; background: #0a0a0a; color: #fff; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .sll-pay-when { display: block; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
  .sll-pay-step strong { display: block; font-size: 18px; font-weight: 800; margin: 2px 0 4px; }
  .sll-pay-line { display: block; font-size: 14px; line-height: 1.45; color: #4b5563; }

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

  /* Laptops and 1080p monitors (Chromebooks: ~1366x650 after the browser bar).
     The centred ad layout is ~1300px tall, so the price and the button sat two
     screens down. Here the hero goes two columns: words + button left, the
     three phones + price sticker right, all inside one screen. */
  @media (min-width: 1024px) and (max-height: 1000px) {
    .sll-hero { padding: 8px 0 36px; }
    .sll-langbar { margin-bottom: 0; }
    .sll-hero-inner { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 540px); column-gap: 36px; align-items: start; text-align: left;
      grid-template-areas: "tag dev" "h1 dev" "sub dev" "lead dev" "parts dev" "cta dev" "badges note"; }
    .sll-tag { grid-area: tag; justify-self: start; font-size: 12px; padding: 6px 16px; margin-bottom: 10px; }
    .sll-h1 { grid-area: h1; font-size: clamp(44px, 4.6vw, 62px); white-space: nowrap; }
    .sll-sub { grid-area: sub; font-size: 15px; letter-spacing: 0.26em; padding-left: 0; margin: 8px 0 10px; }
    .sll-lead { grid-area: lead; font-size: 15px; margin: 0 0 16px; max-width: 520px; }
    .sll-parts { grid-area: parts; grid-template-columns: 1fr; gap: 10px; margin: 0 0 18px; max-width: 520px; }
    .sll-part { padding: 0; gap: 12px; }
    .sll-part + .sll-part { border-left: 0; }
    .sll-part-ic { width: 38px; height: 38px; border-radius: 11px; }
    .sll-part-ic svg { width: 18px; height: 18px; }
    .sll-part-n { width: 18px; height: 18px; font-size: 10px; top: -6px; right: -6px; }
    .sll-part-copy strong { font-size: 15px; }
    .sll-part-copy span { font-size: 13px; margin-top: 1px; }
    .sll-devices { grid-area: dev; align-self: center; padding: 0; }
    .sll-device { width: 178px; border-radius: 26px; padding: 6px; }
    .sll-device img { border-radius: 20px; }
    .sll-device-1 { width: 196px; }
    .sll-device-0 { margin-right: -26px; }
    .sll-device-2 { margin-left: -26px; }
    .sll-sticker { right: -10px; bottom: 18px; padding: 10px 16px 9px; }
    .sll-sticker-p { font-size: 32px; }
    .sll-sticker-p small { font-size: 13px; }
    .sll-shots-note { grid-area: note; margin: 8px 0 0; text-align: center; }
    .sll-badges { grid-area: badges; justify-content: flex-start; gap: 6px 16px; margin: 12px 0 0; }
    .sll-badges li { font-size: 12.5px; }
    .sll-badge-ic { width: 20px; height: 20px; }
    .sll-badge-ic svg { width: 12px; height: 12px; }
    .sll-hero-cta { grid-area: cta; align-items: flex-start; gap: 6px; }
    .sll-hero-cta .sll-btn-lg { font-size: 15px; padding: 13px 26px; }
    .sll-hero-bill { font-size: 12.5px; margin: 2px 0 0; text-align: left; }
    .sll-hero-lite { font-size: 13px; }
    .sll-section, .sll-dark { padding: 56px 0; }
    .sll-h2 { font-size: clamp(26px, 3.4vw, 38px); margin-bottom: 28px; }
  }

  @media (max-width: 860px) {
    .sll-pay-steps { grid-template-columns: 1fr; gap: 16px; }
    .sll-plan { padding: 26px 20px; }
    .sll-plan-price { font-size: 44px; }
    .sll-steps, .sll-plans, .sll-pains, .sll-feat, .sll-feat-flip, .sll-try-inner { grid-template-columns: 1fr; }
    .sll-parts { grid-template-columns: 1fr; gap: 14px; max-width: 420px; margin-bottom: 24px; }
    .sll-part { padding: 0; }
    .sll-part + .sll-part { border-left: 0; }
    .sll-part-ic { width: 44px; height: 44px; }
    .sll-part-copy strong { font-size: 16px; }
    .sll-device { width: 37%; border-radius: 22px; padding: 5px; }
    .sll-device img { border-radius: 18px; }
    .sll-device-1 { width: 42%; }
    .sll-device-0 { margin-right: -6%; }
    .sll-device-2 { margin-left: -6%; }
    .sll-sticker { right: -4px; bottom: -6px; padding: 9px 13px 8px; border-radius: 12px; }
    .sll-sticker-p { font-size: 28px; }
    .sll-sticker-p small { font-size: 12px; }
    .sll-sticker-k, .sll-sticker-n { font-size: 10.5px; }
    .sll-shots-note { margin-top: 18px; }
    .sll-try-inner { gap: 28px; }
    .sll-feat { gap: 28px; padding: 8px 0 36px; }
    .sll-feat + .sll-feat { padding-top: 36px; }
    .sll-feat-flip .sll-feat-copy, .sll-feat-flip .sll-feat-pic { order: 0; }
    .sll-feat-line { font-size: 16px; }
    .sll-hero { padding: 12px 0 44px; }
    .sll-langbar { margin-bottom: 24px; }
    .sll-hero-mock { max-width: 400px; width: 100%; margin: 0 auto; }
    .sll-phone { max-width: 340px; margin: 0 auto; }
    /* Three items in one wrapped inline row read as clanky on narrow screens
       (a checkmark stranding itself on the next line from its own text) —
       one clean item per line instead. */
    .sll-microtrust { flex-direction: column; align-items: flex-start; gap: 10px; }
    .sll-final .sll-microtrust { align-items: center; }
  }
`;
