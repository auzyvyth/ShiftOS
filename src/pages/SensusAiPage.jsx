import React, { useEffect, useRef, useState } from "react";
import { motion, MotionConfig, animate, useInView, useScroll, useSpring, useMotionValue, useReducedMotion } from "framer-motion";
import CustomerCircle from "../components/sensus/CustomerCircle";
import { Helmet } from "react-helmet";
import { publicClient } from "../supabaseClient";
import * as S from "../config/sensusCopy";

// SENSUS-1: landing page for Sensus AI, presented by the owner as a Sensus
// associate. Deliberately SEPARATE from the marketplace: no MarketplaceHeader,
// no XDrive/Drevo branding, one action (book a demo). Copy lives in
// src/config/sensusCopy.js, shared with api/og.js.
//
// A request goes through the definer RPC `sensus_request_demo` (migration
// 20261017a), which rate-limits and fires notify_ops (Telegram + admin push).
// publicClient, not supabase: a stale saved login must never hold the form.
//
// Look (owner, 2026-10-17): a dark "black & gold" palette, no bright colours.
// Gold is the ONE accent (primary button, labels, outbound AI); steel marks
// inbound AI; ivory is the text and the "after" side of the before/after block.

const C = {
  bg: "#0B0B0C", panel: "#161618", line: "rgba(233,223,204,0.10)",
  text: "#EFE9DD", muted: "rgba(233,223,204,0.68)", faint: "rgba(233,223,204,0.46)",
  gold: "#B08D57", ivory: "#E9DFCC",
  inbound: "#8C96A8", outbound: "#B08D57", human: "#3A3A3F",
};
const DIR_COLOR = { inbound: C.inbound, outbound: C.outbound, human: C.human };

const CSS = `
.sx{background:${C.bg};color:${C.text};font-family:var(--xd-font-body,'Outfit',system-ui,sans-serif);min-height:100vh;-webkit-font-smoothing:antialiased}
.sx *{box-sizing:border-box}
.sx-w{max-width:1080px;margin:0 auto;padding:0 16px}
.sx-top{position:sticky;top:0;z-index:10;background:rgba(11,11,12,.78);-webkit-backdrop-filter:blur(20px) saturate(140%);backdrop-filter:blur(20px) saturate(140%);border-bottom:1px solid ${C.line}}
.sx-top .sx-w{display:flex;align-items:center;justify-content:space-between;height:60px}
.sx-mark{font-weight:700;letter-spacing:.22em;font-size:18px;color:${C.ivory}}
.sx-mark small{display:block;font-size:9px;letter-spacing:.2em;color:${C.faint};font-weight:500;margin-top:2px}
.sx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:10px;background:${C.gold};color:#0B0B0C;font-weight:700;font-size:15px;border:0;cursor:pointer;text-decoration:none;transition:transform 100ms ease-out,filter 150ms ease;-webkit-tap-highlight-color:transparent}
button.sx-ghost{background:transparent;cursor:pointer;font-family:inherit}
.sx-btn:active,.sx-ghost:active{transform:scale(.97)}
@media (hover:hover){.sx-btn:hover{filter:brightness(1.08)}.sx-ghost:hover{border-color:${C.gold}}}
.sx-btn:disabled{opacity:.6;cursor:default}
.sx-btn.sm{min-height:38px;padding:0 14px;font-size:13px}
.sx-ghost{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;border-radius:10px;border:1px solid rgba(233,223,204,.24);color:${C.text};font-weight:600;font-size:15px;text-decoration:none;transition:transform 100ms ease-out,border-color 150ms ease;-webkit-tap-highlight-color:transparent}
.sx-hero{padding:72px 0 56px;background:radial-gradient(120% 80% at 80% 0%,#1C1A16 0%,${C.bg} 60%)}
.sx-eb{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.gold}}
.sx h1{font-size:clamp(34px,6.4vw,64px);line-height:1.04;font-weight:800;letter-spacing:-.025em;margin:14px 0 18px;max-width:15ch;text-wrap:balance}
.sx-sub{font-size:clamp(16px,1.6vw,19px);line-height:1.6;color:${C.muted};max-width:60ch;margin:0 0 28px}
.sx-ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.sx-note{font-size:13px;color:${C.faint};margin-top:12px}
.sx-trust{border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};padding:22px 0}
.sx-trust p{margin:0 0 10px;font-size:12px;color:${C.faint};letter-spacing:.04em}
.sx-brands{display:flex;flex-wrap:wrap;gap:8px 22px;font-weight:700;font-size:15px;color:rgba(233,223,204,.8);letter-spacing:.04em}
.sx-sec{padding:64px 0}
.sx h2{font-size:clamp(24px,3.4vw,38px);line-height:1.15;font-weight:800;letter-spacing:-.018em;margin:0 0 12px;text-wrap:balance}
.sx-lead{color:${C.muted};font-size:16px;line-height:1.6;max-width:62ch;margin:0 0 28px}
.sx-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.sx-card{background:${C.panel};border:1px solid ${C.line};border-radius:14px;padding:22px;min-width:0}
.sx-stat{font-size:44px;font-weight:800;line-height:1;letter-spacing:-.03em;color:${C.gold};font-variant-numeric:tabular-nums}
.sx-card h3{font-size:17px;font-weight:700;margin:12px 0 6px}
.sx-card p{margin:0;color:${C.muted};font-size:14.5px;line-height:1.55}
.sx-k{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.faint}}
.sx-src{font-size:12px;color:${C.faint};margin-top:12px}
.sx-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:${C.muted};margin-bottom:18px}
.sx-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:1px}
.sx-stages{list-style:none;margin:0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.sx-stage{display:flex;gap:14px;align-items:flex-start;background:${C.panel};border:1px solid ${C.line};border-radius:12px;padding:14px 16px;min-width:0}
.sx-stage .sx-num{flex:0 0 32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#0B0B0C}
.sx-stage b{display:block;font-size:15px;margin-bottom:3px}
.sx-stage span{font-size:13.5px;color:${C.muted};line-height:1.45}
.sx-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.sx-chip{font-size:13px;padding:7px 12px;border-radius:999px;border:1px solid ${C.line};color:${C.muted}}
.sx-tbl{width:100%;border-collapse:collapse;font-size:14.5px}
.sx-tbl td{padding:11px 0;border-bottom:1px solid ${C.line};vertical-align:top}
.sx-tbl td:last-child{text-align:right;font-weight:700;white-space:nowrap;padding-left:12px;font-variant-numeric:tabular-nums}
.sx-fit{margin:0;padding-left:18px;color:${C.muted};line-height:1.9;font-size:15px}
.sx-form{display:grid;gap:14px}
.sx-row2{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.sx-form label{display:grid;gap:6px;font-size:13px;font-weight:600;color:${C.muted}}
.sx-in{width:100%;min-height:48px;border-radius:10px;border:1px solid rgba(233,223,204,.18);background:#0F0F11;color:${C.text};padding:0 14px;font-size:16px;font-family:inherit}
textarea.sx-in{padding:12px 14px;min-height:88px;resize:vertical}
.sx-in:focus{outline:2px solid ${C.gold};outline-offset:1px;border-color:transparent}
.sx-consent{display:flex !important;grid-template-columns:none !important;gap:10px !important;align-items:flex-start;font-weight:400 !important;line-height:1.5}
.sx-consent input{width:18px;height:18px;margin-top:2px;flex:0 0 auto;accent-color:${C.gold}}
.sx-err,.sx-card p.sx-err{color:#fca5a5;font-size:14px;margin:0}
.sx-steps{display:flex;gap:6px}.sx-steps span{flex:1;height:3px;border-radius:2px;background:${C.line}}.sx-steps span.on{background:${C.gold}}
.sx-opts{border:0;margin:0;padding:0;display:grid;gap:8px;min-width:0}
.sx-opts legend{font-size:13px;font-weight:600;color:${C.muted};margin-bottom:8px;padding:0}
.sx-opts label{display:flex;align-items:center;gap:10px;min-height:46px;padding:0 14px;border-radius:10px;border:1px solid rgba(233,223,204,.16);background:#0F0F11;font-size:15px;font-weight:500;color:${C.text};cursor:pointer;transition:border-color .15s ease,background .15s ease}
.sx-opts label.on{border-color:${C.gold};background:rgba(176,141,87,.10)}
.sx-opts input{accent-color:${C.gold};width:16px;height:16px;flex:0 0 auto}
.sx-opts-row{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.sx-early{display:grid;gap:4px;padding:14px 16px;border-radius:10px;background:rgba(176,141,87,.10);border:1px solid rgba(176,141,87,.35);font-size:14px;line-height:1.5}
.sx-early span{color:${C.muted}}
.sx-nofit{margin:0;padding-left:18px;color:${C.faint};line-height:1.9;font-size:15px}
.sx-faq details{border-bottom:1px solid ${C.line};padding:16px 0}
.sx-faq summary{cursor:pointer;font-weight:700;font-size:16px;list-style:none}
.sx-faq summary::-webkit-details-marker{display:none}
.sx-faq p{color:${C.muted};line-height:1.6;margin:10px 0 0;font-size:15px}
.sx-ba{display:grid;gap:12px}
.sx-ba-row{display:grid;grid-template-columns:1fr 28px 1fr;gap:10px;align-items:stretch}
.sx-ba-cell{border-radius:14px;padding:18px 20px;min-width:0;font-size:15.5px;line-height:1.5}
.sx-ba-cell .sx-k{display:block;margin-bottom:6px}
.sx-ba-before{background:${C.panel};border:1px solid ${C.line};color:${C.muted}}
.sx-ba-after{background:${C.ivory};color:#0B0B0C;font-weight:600}
.sx-ba-after .sx-k{color:#7A6440}
.sx-ba-arrow{display:flex;align-items:center;justify-content:center;color:${C.gold};font-size:20px}
.sx-hero{position:relative;overflow:hidden}
.sx-hero .sx-w{position:relative}
.sx-glow{position:absolute;left:-260px;top:-260px;width:520px;height:520px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,rgba(176,141,87,.22),rgba(176,141,87,0));will-change:transform}
.sx-bar{position:absolute;left:0;right:0;bottom:-1px;height:2px;background:${C.gold};transform-origin:0 50%}
.sx-word{display:inline-block;white-space:pre}
.sx-card{transition:border-color .3s ease,transform .3s ease}
@media (hover:hover){.sx-card:hover{border-color:rgba(176,141,87,.35)}}
.sx-foot{border-top:1px solid ${C.line};padding:28px 0 40px;font-size:13px;color:${C.faint};line-height:1.7}
.sx-foot a{color:${C.muted}}
@media (prefers-reduced-motion:reduce){.sx-btn,.sx-ghost{transition:none}.sx-btn:active,.sx-ghost:active{transform:none}}
@media (prefers-reduced-transparency:reduce){.sx-top{background:${C.bg};backdrop-filter:none;-webkit-backdrop-filter:none}}
@media (max-width:640px){.sx-ba-row{grid-template-columns:1fr;gap:6px}.sx-ba-arrow{transform:rotate(90deg);height:20px}.sx-hero{padding:48px 0 40px}.sx-sec{padding:48px 0}.sx-top .sx-btn{display:none}}
`;

const scrollToForm = (e) => {
  e?.preventDefault?.();
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("demo")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
};

// Motion (owner, 2026-10-17: "the page is too static"). Content rises in once as
// it enters view; nothing loops except the active-stage pulse on the circle.
// MotionConfig reducedMotion="user" drops every transform for visitors who ask
// for less motion, leaving plain fades.
const EASE = [0.23, 1, 0.32, 1];
function Reveal({ children, delay = 0, y = 24, x = 0, className, style, as = "div" }) {
  const M = motion[as];
  return (
    <M className={className} style={style}
      initial={{ opacity: 0, y, x }} whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: EASE }}>
      {children}
    </M>
  );
}

// "40%" counts up from 0 the first time it scrolls into view.
function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const m = String(value).match(/^(\D*)(\d+)(.*)$/);
  const [shown, setShown] = useState(m && !reduce ? `${m[1]}0${m[3]}` : value);
  useEffect(() => {
    if (!m || !inView || reduce) return;
    const c = animate(0, Number(m[2]), { duration: 1.4, ease: EASE, onUpdate: (v) => setShown(`${m[1]}${Math.round(v)}${m[3]}`) });
    return () => c.stop();
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{shown}</span>;
}

// Gold light that trails the pointer across the hero (mouse/trackpad only).
function HeroGlow() {
  const x = useMotionValue(-999), y = useMotionValue(-999);
  const sx = useSpring(x, { stiffness: 120, damping: 24 }), sy = useSpring(y, { stiffness: 120, damping: 24 });
  useEffect(() => {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    const hero = document.querySelector(".sx-hero");
    if (!hero) return;
    const move = (e) => { const r = hero.getBoundingClientRect(); x.set(e.clientX - r.left); y.set(e.clientY - r.top); };
    hero.addEventListener("pointermove", move);
    return () => hero.removeEventListener("pointermove", move);
  }, [x, y]);
  return <motion.div className="sx-glow" aria-hidden="true" style={{ x: sx, y: sy }} />;
}

// Two steps (owner, 2026-10-17): step 1 asks type + volume, so the demo can be
// prepared and a dealer below the line (isSensusFit) gets an honest "may be
// early" screen instead of a demo slot. Nobody is turned away: both paths save.
function DemoForm() {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ type: "", enquiries: "", name: "", dealership: "", role: "", phone: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const fit = S.isSensusFit(f.type, f.enquiries);

  const next = (e) => {
    e.preventDefault();
    if (!f.type || !f.enquiries) return setErr("Please answer both questions.");
    setErr(""); setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.name.trim().length < 2) return setErr(S.SENSUS_ERRORS.sensus_bad_name);
    if (f.dealership.trim().length < 2) return setErr(S.SENSUS_ERRORS.sensus_bad_dealership);
    if (f.phone.replace(/\D/g, "").length < 9) return setErr(S.SENSUS_ERRORS.sensus_bad_phone);
    if (!consent) return setErr("Please tick the box so I can contact you about the demo.");
    setBusy(true);
    const source = (() => { try { return new URLSearchParams(window.location.search).get("utm_source") || document.referrer || null; } catch { return null; } })();
    const { error } = await publicClient.rpc("sensus_request_demo", {
      p_name: f.name, p_dealership: f.dealership, p_phone: f.phone,
      p_role: f.role || null, p_enquiries: f.enquiries || null, p_note: f.note || null,
      p_source: source ? String(source).slice(0, 80) : null, p_dealer_type: f.type || null,
    });
    setBusy(false);
    if (error) {
      const key = Object.keys(S.SENSUS_ERRORS).find((k) => (error.message || "").includes(k));
      if (key === "sensus_rate_limited") { setDone(true); return; }
      setErr(key ? S.SENSUS_ERRORS[key] : "Something went wrong. Please try again, or message me on WhatsApp.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="sx-card" role="status">
        <h3 style={{ marginTop: 0, fontSize: 20 }}>{fit ? S.FORM.doneTitle : "Got it"}</h3>
        <p>{fit ? S.FORM.doneBody : S.FORM.earlyDone}</p>
      </div>
    );
  }

  const steps = (
    <div className="sx-steps" aria-hidden="true">
      <span className={step >= 1 ? "on" : ""} /><span className={step >= 2 ? "on" : ""} />
    </div>
  );

  if (step === 1) {
    return (
      <form className="sx-form sx-card" onSubmit={next} noValidate>
        {steps}
        <p className="sx-k" style={{ margin: 0 }}>Step 1 of 2</p>
        <p style={{ margin: 0 }}>{S.FORM.step1}</p>
        <fieldset className="sx-opts">
          <legend>What best describes your business?</legend>
          {S.DEALER_TYPES.map((o) => (
            <label key={o.id} className={f.type === o.id ? "on" : ""}>
              <input type="radio" name="type" value={o.id} checked={f.type === o.id} onChange={set("type")} />{o.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="sx-opts sx-opts-row">
          <legend>Roughly how many enquiries a month?</legend>
          {S.ENQUIRY_OPTIONS.map((o) => (
            <label key={o.id} className={f.enquiries === o.id ? "on" : ""}>
              <input type="radio" name="enq" value={o.id} checked={f.enquiries === o.id} onChange={set("enquiries")} />{o.label}
            </label>
          ))}
        </fieldset>
        {err && <p className="sx-err" role="alert">{err}</p>}
        <button className="sx-btn" type="submit">{S.FORM.next}</button>
      </form>
    );
  }

  return (
    <form className="sx-form sx-card" onSubmit={submit} noValidate>
      {steps}
      <p className="sx-k" style={{ margin: 0 }}>Step 2 of 2</p>
      {!fit && (
        <div className="sx-early" role="note">
          <b>{S.FORM.earlyTitle}</b>
          <span>{S.FORM.earlyBody}</span>
        </div>
      )}
      <div className="sx-row2">
        <label>Your name<input className="sx-in" value={f.name} onChange={set("name")} autoComplete="name" maxLength={100} /></label>
        <label>Business name<input className="sx-in" value={f.dealership} onChange={set("dealership")} autoComplete="organization" maxLength={120} /></label>
      </div>
      <div className="sx-row2">
        <label>WhatsApp number<input className="sx-in" value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="012 345 6789" maxLength={20} /></label>
        <label>Your role (optional)<input className="sx-in" value={f.role} onChange={set("role")} placeholder="Owner, GM, sales manager" maxLength={60} /></label>
      </div>
      {fit && <label>Anything I should know? (optional)<textarea className="sx-in" value={f.note} onChange={set("note")} maxLength={1000} placeholder="Brands you sell, branches, the channel most enquiries come in on" /></label>}
      <label className="sx-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{S.FORM.consent}</label>
      {err && <p className="sx-err" role="alert">{err}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="sx-ghost" onClick={() => { setErr(""); setStep(1); }}>{S.FORM.back}</button>
        <button className="sx-btn" type="submit" disabled={busy} style={{ flex: 1 }}>{busy ? S.FORM.sending : fit ? S.FORM.submit : S.FORM.earlySubmit}</button>
      </div>
    </form>
  );
}

export default function SensusAiPage() {
  const wa = S.waUrl("Hi, I'd like to see a Sensus AI demo for my dealership.");
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });
  return (
    <MotionConfig reducedMotion="user">
    <div className="sx">
      <Helmet>
        <html lang="en" />
        <title>{S.SEO_TITLE}</title>
        <meta name="description" content={S.SEO_DESC} />
        <link rel="canonical" href={S.CANON} />
        <meta property="og:title" content={S.SEO_TITLE} />
        <meta property="og:description" content={S.SEO_DESC} />
        <meta property="og:url" content={S.CANON} />
        <meta name="theme-color" content={C.bg} />
        <script type="application/ld+json">{JSON.stringify(S.SERVICE_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(S.FAQ_LD)}</script>
      </Helmet>
      <style>{CSS}</style>

      <header className="sx-top">
        <div className="sx-w">
          <div className="sx-mark">SENSUS<small>DEALER AI HUB</small></div>
          <a className="sx-btn sm" href="#demo" onClick={scrollToForm}>Book a demo</a>
        </div>
        <motion.div className="sx-bar" style={{ scaleX: bar }} aria-hidden="true" />
      </header>

      <main>
        <section className="sx-hero">
          <HeroGlow />
          <div className="sx-w">
            <Reveal delay={0} y={12}><div className="sx-eb">{S.HERO.eyebrow}</div></Reveal>
            <h1 aria-label={S.HERO.h1}>
              {S.HERO.h1.split(" ").map((w, i, a) => (
                <motion.span key={i} className="sx-word" aria-hidden="true"
                  initial={{ opacity: 0, y: 28, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.8, delay: 0.08 + i * 0.07, ease: EASE }}>
                  {w}{i < a.length - 1 ? " " : ""}
                </motion.span>
              ))}
            </h1>
            <Reveal delay={0.5}><p className="sx-sub">{S.HERO.sub}</p></Reveal>
            <Reveal delay={0.62}>
              <div className="sx-ctas">
                <a className="sx-btn" href="#demo" onClick={scrollToForm}>{S.HERO.cta}</a>
                {wa && <a className="sx-ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp me</a>}
              </div>
              <div className="sx-note">{S.HERO.ctaNote}</div>
            </Reveal>
          </div>
        </section>

        <section className="sx-sec" style={{ paddingBottom: 48 }}>
          <div className="sx-w">
            <Reveal><h2>{S.BEFORE_AFTER.title}</h2></Reveal>
            <div className="sx-ba" style={{ marginTop: 24 }}>
              {S.BEFORE_AFTER.rows.map((r) => (
                <div className="sx-ba-row" key={r.after}>
                  <Reveal className="sx-ba-cell sx-ba-before" y={16}><span className="sx-k">Before</span>{r.before}</Reveal>
                  <Reveal className="sx-ba-arrow" y={0} x={-8} delay={0.25}><span aria-hidden="true">&rarr;</span></Reveal>
                  <Reveal className="sx-ba-cell sx-ba-after" y={16} delay={0.4}><span className="sx-k">With Sensus</span>{r.after}</Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sx-trust">
          <div className="sx-w">
            <p>{S.TRUST_LINE}</p>
            <div className="sx-brands">{S.BRANDS.map((b) => <span key={b}>{b}</span>)}</div>
            <p style={{ margin: "12px 0 0" }}>{S.COMPANY_LINE}</p>
          </div>
        </section>

        <section className="sx-sec">
          <div className="sx-w">
            <Reveal><h2>{S.PROBLEMS.title}</h2></Reveal>
            <div className="sx-grid" style={{ marginTop: 24 }}>
              {S.PROBLEMS.items.map((p, i) => (
                <Reveal className="sx-card" key={p.title} delay={i * 0.08}>
                  <div className="sx-stat"><CountUp value={p.stat} /></div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </Reveal>
              ))}
            </div>
            <div className="sx-src">{S.PROBLEMS.source}</div>
          </div>
        </section>

        <section className="sx-sec" style={{ paddingTop: 0 }}>
          <div className="sx-w">
            <Reveal><h2>{S.HOW.title}</h2></Reveal>
            <div className="sx-grid" style={{ marginTop: 24 }}>
              {S.HOW.steps.map((s, i) => (
                <Reveal className="sx-card" key={s.k} delay={i * 0.08}>
                  <div className="sx-k">{i + 1}. {s.k}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </Reveal>
              ))}
            </div>
            <div className="sx-chips">{S.CHANNELS.map((c, i) => <Reveal as="span" className="sx-chip" key={c} y={10} delay={i * 0.05}>{c}</Reveal>)}</div>
          </div>
        </section>

        <CustomerCircle circle={S.CIRCLE} colors={DIR_COLOR} fallback={
        <section className="sx-sec" style={{ paddingTop: 0 }}>
            <div className="sx-w">
              <h2>{S.CIRCLE.title}</h2>
              <p className="sx-lead">{S.CIRCLE.lead}</p>
              <div className="sx-legend">
                {Object.entries(S.CIRCLE.legend).map(([k, v]) => (
                  <span key={k}><i className="sx-dot" style={{ background: DIR_COLOR[k], boxShadow: k === "human" ? `inset 0 0 0 1px ${C.faint}` : undefined }} />{v}</span>
                ))}
              </div>
              <ol className="sx-stages">
                {S.CIRCLE.stages.map((s) => (
                  <li className="sx-stage" key={s.n}>
                    <span className="sx-num" style={{ background: s.dir.length > 1 ? `linear-gradient(135deg, ${DIR_COLOR[s.dir[0]]} 50%, ${DIR_COLOR[s.dir[1]]} 50%)` : DIR_COLOR[s.dir[0]], ...(s.dir[0] === "human" && { color: C.text, boxShadow: `inset 0 0 0 1px ${C.faint}` }) }}>{s.n}</span>
                    <div style={{ minWidth: 0 }}><b>{s.title}</b><span>{s.body}</span></div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        } />

        <section className="sx-sec">
          <div className="sx-w">
            <Reveal><h2>{S.IMPACT.title}</h2></Reveal>
            <div className="sx-grid" style={{ marginTop: 24 }}>
              {S.IMPACT.groups.map((g, i) => (
                <Reveal className="sx-card" key={g.title} delay={i * 0.1}>
                  <div className="sx-k">{g.title}</div>
                  <table className="sx-tbl"><tbody>
                    {g.rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
                  </tbody></table>
                </Reveal>
              ))}
            </div>
            <div className="sx-src">{S.IMPACT.note}</div>
          </div>
        </section>

        <section className="sx-sec" id="demo" style={{ paddingTop: 0, scrollMarginTop: 72 }}>
          <div className="sx-w sx-grid" style={{ alignItems: "start" }}>
            <div>
              <h2>{S.FORM.title}</h2>
              <p className="sx-lead">{S.FORM.lead}</p>
              <div className="sx-k" style={{ marginBottom: 8 }}>{S.FIT.title}</div>
              <ul className="sx-fit">{S.FIT.items.map((x) => <li key={x}>{x}</li>)}</ul>
              <div className="sx-k" style={{ margin: "20px 0 8px" }}>{S.NOT_FIT.title}</div>
              <ul className="sx-nofit">{S.NOT_FIT.items.map((x) => <li key={x}>{x}</li>)}</ul>
              {(S.CONTACT.name || wa || S.CONTACT.linkedin) && (
                <div style={{ marginTop: 24, color: C.muted, fontSize: 14, lineHeight: 1.7 }}>
                  {S.CONTACT.name && <div style={{ color: C.text, fontWeight: 700 }}>{S.CONTACT.name}</div>}
                  <div>{S.CONTACT.title}</div>
                  <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>WhatsApp</a>}
                    {S.CONTACT.linkedin && <a href={S.CONTACT.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>LinkedIn</a>}
                  </div>
                </div>
              )}
            </div>
            <DemoForm />
          </div>
        </section>

        <section className="sx-sec sx-faq" style={{ paddingTop: 0 }}>
          <div className="sx-w"><div style={{ maxWidth: 780 }}>
            <h2>Questions dealers ask</h2>
            {S.FAQ.map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div></div>
        </section>
      </main>

      <footer className="sx-foot">
        <div className="sx-w">
          {S.FOOTER.disclaimer}{" "}
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}
