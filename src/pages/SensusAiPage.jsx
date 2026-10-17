import React, { useState } from "react";
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
// Look follows Sensus's own deck: black ground, white type, teal = inbound AI,
// orange = outbound AI (the colours only ever encode that, as in their circle).

const C = {
  bg: "#07080a", panel: "#101215", line: "rgba(255,255,255,0.09)",
  text: "#f5f6f7", muted: "rgba(255,255,255,0.66)", faint: "rgba(255,255,255,0.45)",
  inbound: "#3bb5c3", outbound: "#f26a21", human: "#e5e7eb",
};
const DIR_COLOR = { inbound: C.inbound, outbound: C.outbound, human: C.human };

const CSS = `
.sx{background:${C.bg};color:${C.text};font-family:var(--xd-font-body,'Outfit',system-ui,sans-serif);min-height:100vh;-webkit-font-smoothing:antialiased}
.sx *{box-sizing:border-box}
.sx-w{max-width:1080px;margin:0 auto;padding:0 16px}
.sx-top{position:sticky;top:0;z-index:10;background:rgba(7,8,10,.92);backdrop-filter:blur(8px);border-bottom:1px solid ${C.line}}
.sx-top .sx-w{display:flex;align-items:center;justify-content:space-between;height:60px}
.sx-mark{font-weight:700;letter-spacing:.22em;font-size:18px}
.sx-mark small{display:block;font-size:9px;letter-spacing:.2em;color:${C.faint};font-weight:500;margin-top:2px}
.sx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:10px;background:#fff;color:#07080a;font-weight:700;font-size:15px;border:0;cursor:pointer;text-decoration:none}
.sx-btn:disabled{opacity:.6;cursor:default}
.sx-btn.sm{min-height:38px;padding:0 14px;font-size:13px}
.sx-ghost{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;border-radius:10px;border:1px solid rgba(255,255,255,.22);color:${C.text};font-weight:600;font-size:15px;text-decoration:none}
.sx-hero{padding:72px 0 56px;background:radial-gradient(120% 80% at 80% 0%,#1a1d22 0%,${C.bg} 60%)}
.sx-eb{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.inbound}}
.sx h1{font-size:clamp(34px,6.4vw,64px);line-height:1.04;font-weight:800;letter-spacing:-.02em;margin:14px 0 18px;max-width:14ch}
.sx-sub{font-size:clamp(16px,1.6vw,19px);line-height:1.6;color:${C.muted};max-width:60ch;margin:0 0 28px}
.sx-ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.sx-note{font-size:13px;color:${C.faint};margin-top:12px}
.sx-trust{border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};padding:22px 0}
.sx-trust p{margin:0 0 10px;font-size:12px;color:${C.faint};letter-spacing:.04em}
.sx-brands{display:flex;flex-wrap:wrap;gap:8px 22px;font-weight:700;font-size:15px;color:rgba(255,255,255,.78);letter-spacing:.04em}
.sx-sec{padding:64px 0}
.sx h2{font-size:clamp(24px,3.4vw,38px);line-height:1.15;font-weight:800;letter-spacing:-.01em;margin:0 0 12px}
.sx-lead{color:${C.muted};font-size:16px;line-height:1.6;max-width:62ch;margin:0 0 28px}
.sx-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.sx-card{background:${C.panel};border:1px solid ${C.line};border-radius:14px;padding:22px;min-width:0}
.sx-stat{font-size:44px;font-weight:800;line-height:1;letter-spacing:-.02em}
.sx-card h3{font-size:17px;font-weight:700;margin:12px 0 6px}
.sx-card p{margin:0;color:${C.muted};font-size:14.5px;line-height:1.55}
.sx-k{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.faint}}
.sx-src{font-size:12px;color:${C.faint};margin-top:12px}
.sx-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:${C.muted};margin-bottom:18px}
.sx-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:1px}
.sx-stages{list-style:none;margin:0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.sx-stage{display:flex;gap:14px;align-items:flex-start;background:${C.panel};border:1px solid ${C.line};border-radius:12px;padding:14px 16px;min-width:0}
.sx-num{flex:0 0 32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#07080a}
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
.sx-in{width:100%;min-height:48px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0b0c0f;color:${C.text};padding:0 14px;font-size:16px;font-family:inherit}
textarea.sx-in{padding:12px 14px;min-height:88px;resize:vertical}
.sx-in:focus{outline:2px solid ${C.inbound};outline-offset:1px;border-color:transparent}
.sx-consent{display:flex !important;grid-template-columns:none !important;gap:10px !important;align-items:flex-start;font-weight:400 !important;line-height:1.5}
.sx-consent input{width:18px;height:18px;margin-top:2px;flex:0 0 auto}
.sx-err{color:#fca5a5;font-size:14px;margin:0}
.sx-faq details{border-bottom:1px solid ${C.line};padding:16px 0}
.sx-faq summary{cursor:pointer;font-weight:700;font-size:16px;list-style:none}
.sx-faq summary::-webkit-details-marker{display:none}
.sx-faq p{color:${C.muted};line-height:1.6;margin:10px 0 0;font-size:15px}
.sx-foot{border-top:1px solid ${C.line};padding:28px 0 40px;font-size:13px;color:${C.faint};line-height:1.7}
.sx-foot a{color:${C.muted}}
@media (max-width:640px){.sx-hero{padding:48px 0 40px}.sx-sec{padding:48px 0}.sx-top .sx-btn{display:none}}
`;

const scrollToForm = (e) => {
  e?.preventDefault?.();
  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function DemoForm() {
  const [f, setF] = useState({ name: "", dealership: "", role: "", phone: "", enquiries: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

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
      p_source: source ? String(source).slice(0, 80) : null,
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
        <h3 style={{ marginTop: 0, fontSize: 20 }}>{S.FORM.doneTitle}</h3>
        <p>{S.FORM.doneBody}</p>
      </div>
    );
  }

  return (
    <form className="sx-form sx-card" onSubmit={submit} noValidate>
      <div className="sx-row2">
        <label>Your name<input className="sx-in" value={f.name} onChange={set("name")} autoComplete="name" maxLength={100} /></label>
        <label>Dealership<input className="sx-in" value={f.dealership} onChange={set("dealership")} autoComplete="organization" maxLength={120} /></label>
      </div>
      <div className="sx-row2">
        <label>WhatsApp number<input className="sx-in" value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="012 345 6789" maxLength={20} /></label>
        <label>Your role (optional)<input className="sx-in" value={f.role} onChange={set("role")} placeholder="Owner, GM, sales manager" maxLength={60} /></label>
      </div>
      <label>Enquiries a month (roughly)
        <select className="sx-in" value={f.enquiries} onChange={set("enquiries")}>
          <option value="">Choose one</option>
          {S.ENQUIRY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label>Anything I should know? (optional)<textarea className="sx-in" value={f.note} onChange={set("note")} maxLength={1000} placeholder="Brands you sell, branches, the channel most enquiries come in on" /></label>
      <label className="sx-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{S.FORM.consent}</label>
      {err && <p className="sx-err" role="alert">{err}</p>}
      <button className="sx-btn" type="submit" disabled={busy}>{busy ? S.FORM.sending : S.FORM.submit}</button>
    </form>
  );
}

export default function SensusAiPage() {
  const wa = S.waUrl("Hi, I'd like to see a Sensus AI demo for my dealership.");
  return (
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
      </header>

      <main>
        <section className="sx-hero">
          <div className="sx-w">
            <div className="sx-eb">{S.HERO.eyebrow}</div>
            <h1>{S.HERO.h1}</h1>
            <p className="sx-sub">{S.HERO.sub}</p>
            <div className="sx-ctas">
              <a className="sx-btn" href="#demo" onClick={scrollToForm}>{S.HERO.cta}</a>
              {wa && <a className="sx-ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp me</a>}
            </div>
            <div className="sx-note">{S.HERO.ctaNote}</div>
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
            <h2>{S.PROBLEMS.title}</h2>
            <div className="sx-grid" style={{ marginTop: 24 }}>
              {S.PROBLEMS.items.map((p) => (
                <div className="sx-card" key={p.title}>
                  <div className="sx-stat">{p.stat}</div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              ))}
            </div>
            <div className="sx-src">{S.PROBLEMS.source}</div>
          </div>
        </section>

        <section className="sx-sec" style={{ paddingTop: 0 }}>
          <div className="sx-w">
            <h2>{S.HOW.title}</h2>
            <div className="sx-grid" style={{ marginTop: 24 }}>
              {S.HOW.steps.map((s, i) => (
                <div className="sx-card" key={s.k}>
                  <div className="sx-k">{i + 1}. {s.k}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
            <div className="sx-chips">{S.CHANNELS.map((c) => <span className="sx-chip" key={c}>{c}</span>)}</div>
          </div>
        </section>

        <section className="sx-sec" style={{ paddingTop: 0 }}>
          <div className="sx-w">
            <h2>{S.CIRCLE.title}</h2>
            <p className="sx-lead">{S.CIRCLE.lead}</p>
            <div className="sx-legend">
              {Object.entries(S.CIRCLE.legend).map(([k, v]) => (
                <span key={k}><i className="sx-dot" style={{ background: DIR_COLOR[k] }} />{v}</span>
              ))}
            </div>
            <ol className="sx-stages">
              {S.CIRCLE.stages.map((s) => (
                <li className="sx-stage" key={s.n}>
                  <span className="sx-num" style={{ background: s.dir.length > 1 ? `linear-gradient(135deg, ${DIR_COLOR[s.dir[0]]} 50%, ${DIR_COLOR[s.dir[1]]} 50%)` : DIR_COLOR[s.dir[0]] }}>{s.n}</span>
                  <div style={{ minWidth: 0 }}><b>{s.title}</b><span>{s.body}</span></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="sx-sec" style={{ paddingTop: 0 }}>
          <div className="sx-w">
            <h2>{S.IMPACT.title}</h2>
            <div className="sx-grid" style={{ marginTop: 24 }}>
              {S.IMPACT.groups.map((g) => (
                <div className="sx-card" key={g.title}>
                  <div className="sx-k">{g.title}</div>
                  <table className="sx-tbl"><tbody>
                    {g.rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
                  </tbody></table>
                </div>
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
  );
}
