import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { useModalHistory } from "../../hooks/useModalHistory";
import useVisualViewport from "../../hooks/useVisualViewport";
import { panel as C, panelRadius as R, withAlpha } from "../../theme/tokens";
import { DEFAULT_EIR } from "../../utils/financing";
import { carLabel, eirForTenure, isLocalNew, LOCAL_NEW_EIR, RATE_MAX, clampRateInput } from "../../utils/liveMaths";
import { QUESTIONS, DEPOSIT_OPTIONS, YEAR_OPTIONS, assessReadiness, docsFor, unanswered } from "../../utils/loanReadiness";
import { initialLiveRate, LIVE_RATE_LOCAL_KEY } from "../live/liveCopy";
import { loanCheckCopy, buyerMessage } from "./loanCheckCopy";

/*
 * Loan check (IDEA-23): what to fix BEFORE any bank sees the file.
 * Three short steps (credit record, income, the car), then two tabs: what to
 * fix, and what to bring (sent to the buyer on WhatsApp; a person presses send).
 * Never an approval: the maths and the rules are src/utils/loanReadiness.js.
 *
 * Saved as one `loan_checks` row per lead (a walk-in has no lead). Credit
 * answers are personal data: the row holds the answers only, never an IC.
 * Full-screen, portalled, sized off the visual viewport (CLAUDE.md overlay rules).
 */

const STEPS = ["credit", "income", "car", "result"];

const TONE = {
  red: { fg: C.dangerText, dot: C.dangerText },
  amber: { fg: C.warnText, dot: C.warnText },
  info: { fg: C.textSec, dot: C.textMuted },
  green: { fg: C.successText, dot: C.successText },
};
const OUTCOME_TONE = { ready: "green", fix: "amber", hold: "red" };

// "Encik Hafiz bin Ali" -> "Encik Hafiz"; "Hafiz bin Ali" -> "Hafiz".
const HONORIFICS = ["encik", "en", "en.", "puan", "pn", "pn.", "cik", "tuan", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "dr", "dr."];
const greetName = (full) => {
  const w = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  return HONORIFICS.includes(w[0].toLowerCase()) && w[1] ? `${w[0]} ${w[1]}` : w[0];
};

const priceOf = (car) => (car?.selling_price ? String(Math.round(Number(car.selling_price))) : "");

function initialAnswers(existing, car) {
  if (existing?.answers) return { ...existing.answers };
  const rate = isLocalNew(car)
    ? initialLiveRate(LOCAL_NEW_EIR, RATE_MAX, LIVE_RATE_LOCAL_KEY)
    : initialLiveRate(DEFAULT_EIR, RATE_MAX);
  const eir = rate.basis === "flat" ? Math.round(eirForTenure(Number(rate.eir), "flat", 7) * 100) / 100 : Number(rate.eir);
  return { price: priceOf(car), dep: 10, years: 7, eir: String(eir), pay: "", commit: "" };
}

export default function LoanCheck({ lead = null, listings = [], userId, dealerId = null, existing = null, onClose, onSaved }) {
  const { i18n } = useTranslation();
  const t = loanCheckCopy(i18n.language);
  const vv = useVisualViewport();

  const leadCar = lead?.car_listings || null;
  const ownCar = (listings || []).find((c) => c.id === (lead?.car_listing_id || existing?.listing_id)) || leadCar;
  const [carId, setCarId] = useState(ownCar?.id || "");
  const car = (listings || []).find((c) => c.id === carId) || (carId && ownCar?.id === carId ? ownCar : null);

  const [a, setA] = useState(() => initialAnswers(existing, ownCar));
  const [buyer, setBuyer] = useState(lead?.buyer_name || existing?.buyer_name || "");
  const [step, setStep] = useState(existing ? "result" : "credit");
  const [tab, setTab] = useState("fix");
  const [msgLang, setMsgLang] = useState("ms");
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState(existing);
  const [copied, setCopied] = useState(false);
  const dirty = useRef(false);

  const set = (k, v) => { dirty.current = true; setA((p) => ({ ...p, [k]: v })); };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useModalHistory(true, onClose, { isDirty: () => dirty.current });

  const scroller = useRef(null);
  useEffect(() => { scroller.current?.scrollTo?.(0, 0); }, [step, tab]);

  const result = useMemo(() => assessReadiness(a, { listings }), [a, listings]);
  const docs = useMemo(() => docsFor(a, result), [a, result]);
  const missing = step === "credit" || step === "income" ? unanswered(a, step) : [];
  const carName = car ? carLabel(car) : (a.car_name || "");

  const message = buyerMessage(msgLang, {
    name: greetName(buyer),
    car: car ? [car.brand, car.model].filter(Boolean).join(" ") : a.car_name,
    docs,
    askCcris: a.ccris !== "clean" || a.late !== "none",
    monthly: result.monthly, years: result.years, deposit: result.deposit,
  });

  const phone = String(lead?.phone || "").replace(/\D/g, "");
  const waPhone = phone ? (phone.startsWith("6") ? phone : `6${phone}`) : "";

  const save = async ({ sent = false } = {}) => {
    if (saving) return null;
    setSaving(true);
    const payload = {
      salesman_id: userId,
      dealer_id: dealerId || null,
      lead_id: lead?.id || row?.lead_id || null,
      listing_id: car?.id || null,
      buyer_name: buyer.trim() || null,
      answers: { ...a, car_name: car ? carName : a.car_name || null },
      outcome: result.outcome,
      fix_count: result.fixCount,
      ...(sent ? { sent_at: new Date().toISOString() } : {}),
    };
    const q = row?.id
      ? supabase.from("loan_checks").update(payload).eq("id", row.id).select("*").maybeSingle()
      : supabase.from("loan_checks").insert(payload).select("*").maybeSingle();
    const { data, error } = await q;
    setSaving(false);
    if (error || !data) {
      console.error("saveLoanCheck:", error);
      toast.error(t.saveFailed);
      return null;
    }
    dirty.current = false;
    setRow(data);
    onSaved?.(data);
    return data;
  };

  const sendWhatsApp = () => {
    // Open synchronously (popup blockers), then record it.
    if (waPhone) window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    save({ sent: true });
  };

  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard blocked: the text is on screen to select */ }
  };

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (step === "car") { setTab("fix"); setStep("result"); return; }
    setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    if (step === "result") { setStep("car"); return; }
    const i = STEPS.indexOf(step);
    if (i <= 0) onClose(); else setStep(STEPS[i - 1]);
  };

  const outcomeTone = TONE[OUTCOME_TONE[result.outcome]];
  const flagRows = result.flags.length
    ? result.flags.map((f) => ({ ...f, title: t.flags[f.key].title(f.params), fix: t.flags[f.key].fix(f.params) }))
    : [{ key: "nothing", tone: "green", title: t.nothing.title, fix: t.nothing.fix }];
  const showNothing = result.flags.length > 0 && result.flags.every((f) => f.tone === "info");
  if (showNothing) flagRows.push({ key: "nothing", tone: "green", title: t.nothing.title, fix: t.nothing.fix });

  /* ── pieces ─────────────────────────────────────────────────────────── */
  const chip = ({ on, onClick, children, key }) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={on} style={{
      minHeight: 44, padding: "0 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      fontSize: 14, fontWeight: on ? 600 : 500,
      background: on ? C.text : C.fill, color: on ? C.bg : C.textSec,
      border: `1px solid ${on ? C.text : C.borderStrong}`,
    }}>{children}</button>
  );

  const question = (q) => (
    <div key={q.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{t.q[q.key]}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {q.options.map((o) => chip({ key: o, on: a[q.key] === o, onClick: () => set(q.key, o), children: t.o[q.key][o] }))}
      </div>
    </div>
  );

  const money = ({ label, value, onChange, prefix = "RM", mode = "numeric" }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.textSec, minWidth: 0 }}>
      {label}
      <span style={{ position: "relative", display: "block" }}>
        <span style={{ position: "absolute", left: 14, top: 15, fontSize: 14, color: C.textMuted }}>{prefix}</span>
        <input inputMode={mode} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{
          width: "100%", boxSizing: "border-box", height: 48, borderRadius: 12, border: `1px solid ${C.borderStrong}`,
          background: C.surface, color: C.text, fontSize: 18, fontWeight: 600, fontFamily: "inherit",
          padding: "0 14px 0 46px", fontVariantNumeric: "tabular-nums", outline: "none",
        }} />
      </span>
    </label>
  );

  const head = (n, title, intro) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 12, color: C.textMuted, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>{t.stepOf(n)}</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 14, color: C.textSec, lineHeight: 1.45 }}>{intro}</p>
    </div>
  );

  const card = { borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` };
  const rm = (n) => Math.round(n || 0).toLocaleString("en-MY");

  /* ── screens ────────────────────────────────────────────────────────── */
  const body = (() => {
    if (step === "credit") return (<>
      {head(1, t.steps.credit, t.intro.credit)}
      {QUESTIONS.credit.map(question)}
    </>);

    if (step === "income") return (<>
      {head(2, t.steps.income, t.intro.income)}
      {QUESTIONS.income.filter((q) => !q.only || q.only(a)).map(question)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {money({ label: t.pay, value: a.pay, onChange: (v) => set("pay", v) })}
        {money({ label: t.commit, value: a.commit, onChange: (v) => set("commit", v) })}
      </div>
      <p style={{ margin: "-12px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.45 }}>{t.commitHint}</p>
    </>);

    if (step === "car") return (<>
      {head(3, t.steps.car, t.intro.car)}
      {!lead && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.textSec }}>
          {t.buyerName}
          <input value={buyer} onChange={(e) => { dirty.current = true; setBuyer(e.target.value); }} style={{
            height: 48, borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: C.surface, color: C.text,
            fontSize: 16, fontFamily: "inherit", padding: "0 14px", outline: "none",
          }} />
        </label>
      )}
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.textSec }}>
        {t.carName}
        <select value={carId} onChange={(e) => {
          const id = e.target.value;
          setCarId(id);
          const c = (listings || []).find((x) => x.id === id);
          if (c) set("price", priceOf(c));
        }} style={{
          height: 48, borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: C.surface, color: C.text,
          fontSize: 15, fontFamily: "inherit", padding: "0 12px", outline: "none",
        }}>
          <option value="">-</option>
          {(listings || []).filter((c) => c.status !== "sold" && c.status !== "archived" && !c.is_model_card).map((c) => (
            <option key={c.id} value={c.id}>{carLabel(c)}</option>
          ))}
          {ownCar && !(listings || []).some((c) => c.id === ownCar.id) && <option value={ownCar.id}>{carLabel(ownCar)}</option>}
        </select>
      </label>
      {money({ label: t.price, value: a.price, onChange: (v) => set("price", v) })}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t.deposit}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DEPOSIT_OPTIONS.map((d) => chip({ key: d, on: Number(a.dep) === d, onClick: () => set("dep", d), children: d ? `${d}%` : t.depNone }))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t.term}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {YEAR_OPTIONS.map((y) => chip({ key: y, on: Number(a.years) === y, onClick: () => set("years", y), children: t.years(y) }))}
        </div>
      </div>
      {money({ label: t.rate, value: a.eir, prefix: "%", mode: "decimal", onChange: (v) => set("eir", clampRateInput(v)) })}
      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: 14 }}>
        <span style={{ fontSize: 14, color: C.textSec }}>{t.monthlyAbout}</span>
        <span style={{ fontSize: 24, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>RM {rm(result.monthly)}</span>
      </div>
    </>);

    // result
    if (tab === "fix") return (<>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, color: outcomeTone.fg, background: withAlpha(outcomeTone.fg, 0.12) }}>
          {t.pill[result.outcome]}
        </span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: outcomeTone.fg }}>
          {result.outcome === "fix" ? t.outcome.fix(result.fixCount) : t.outcome[result.outcome]}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.45 }}>{t.disclaimer}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>{t.monthlyAbout}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>RM {rm(result.monthly)}</span>
          <span style={{ fontSize: 12, color: C.textSec }}>{t.termLine(result.years, result.deposit, result.eir)}</span>
        </div>
        <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>{t.dsrLabel}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{result.dsr == null ? "-" : `${Math.round(result.dsr * 100)}%`}</span>
          <span style={{ fontSize: 12, color: C.textSec }}>{t.band[result.band || "none"]}</span>
        </div>
      </div>

      <div style={{ ...card, display: "flex", flexDirection: "column" }}>
        {flagRows.map((f, i) => (
          <div key={f.key + i} style={{ display: "flex", gap: 12, padding: 14, borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", marginTop: 6, background: TONE[f.tone].dot }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>{f.fix}</div>
            </div>
          </div>
        ))}
      </div>

      {result.fitCars.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t.fitTitle}</div>
          {result.fitCars.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, background: C.fillSubtle, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, color: C.text, minWidth: 0 }}>{c.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>RM {rm(c.monthly)}{t.perMonth}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t.oneBank.title}</div>
        <p style={{ margin: 0, fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>{t.oneBank.body}</p>
      </div>
    </>);

    return (<>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{t.bringTitle}</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.textSec, lineHeight: 1.45 }}>{t.bringIntro}</p>
      </div>
      <div style={{ ...card, display: "flex", flexDirection: "column" }}>
        {docs.map((d, i) => (
          <div key={d} style={{ display: "flex", gap: 12, padding: "12px 14px", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <span style={{ fontSize: 13, color: C.textMuted, width: 18, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{t.docs[d].label}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>{t.docs[d].why}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: C.textMuted }}>{t.msgLabel}</span>
          <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {["ms", "en"].map((l) => (
              <button key={l} type="button" onClick={() => setMsgLang(l)} aria-pressed={msgLang === l} style={{
                minWidth: 40, minHeight: 32, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                background: msgLang === l ? C.fillStrong : "transparent", color: msgLang === l ? C.text : C.textMuted,
                border: `1px solid ${msgLang === l ? C.borderStrong : C.border}`,
              }}>{l === "ms" ? "BM" : "EN"}</button>
            ))}
          </span>
        </div>
        <div style={{ padding: 14, borderRadius: "14px 14px 4px 14px", background: "#134e3a", color: "#ecfdf5", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-line", userSelect: "text" }}>
          {message}
        </div>
        {!waPhone && <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{t.noPhone}</p>}
        <button type="button" onClick={copyMessage} style={{
          alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 12px", borderRadius: 10,
          background: "transparent", border: `1px solid ${C.border}`, color: C.textSec, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
        }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t.copied : t.copy}</button>
      </div>
    </>);
  })();

  /* ── footer ─────────────────────────────────────────────────────────── */
  const btn = { minHeight: 48, borderRadius: 12, border: 0, fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "0 18px" };
  const primary = { ...btn, flex: 1, background: C.accent, color: "#fff" };
  const ghost = { ...btn, background: C.fillStrong, color: C.text };
  const saveLabel = saving ? "..." : row && !dirty.current ? t.saved : lead ? t.save : t.saveWalkIn;

  const footer = step === "result" ? (
    tab === "fix" ? (
      <>
        <button type="button" style={ghost} onClick={goBack}>{t.back}</button>
        <button type="button" style={primary} onClick={() => setTab("bring")}>{t.tabs.bring}</button>
      </>
    ) : (
      <>
        {waPhone
          ? <button type="button" style={{ ...ghost, flex: 1 }} onClick={sendWhatsApp}>{t.send}</button>
          : <button type="button" style={{ ...ghost, flex: 1 }} onClick={copyMessage}>{copied ? t.copied : t.copy}</button>}
        <button type="button" style={{ ...primary, opacity: row && !dirty.current ? 0.6 : 1 }} disabled={saving}
          onClick={async () => { const r = await save(); if (r) { toast.success(t.savedToast); onClose(); } }}>{saveLabel}</button>
      </>
    )
  ) : (
    <>
      {step !== "credit" && <button type="button" style={ghost} onClick={goBack}>{t.back}</button>}
      <button type="button" style={{ ...primary, opacity: missing.length ? 0.5 : 1 }} disabled={missing.length > 0} onClick={goNext}
        title={missing.length ? t.answerAll : undefined}>
        {t.next[step]}
      </button>
    </>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.title} style={{
      position: "fixed", left: 0, right: 0, top: vv.offsetTop, height: vv.height, zIndex: 9000,
      background: C.bg, color: C.text, display: "flex", flexDirection: "column",
      fontFamily: "var(--xd-font-body, Outfit, system-ui, sans-serif)",
    }}>
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 12px", borderBottom: `1px solid ${C.line}` }}>
          <button type="button" onClick={goBack} aria-label={t.back} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: C.fill, border: 0, color: C.text, cursor: "pointer" }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: C.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[buyer || t.walkIn, carName].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "transparent", border: 0, color: C.textSec, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </header>

        {step === "result" ? (
          <div style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
            {["fix", "bring"].map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} style={{
                flex: 1, minHeight: 40, borderRadius: 10, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                background: tab === k ? C.fillStrong : "transparent", color: tab === k ? C.text : C.textSec,
              }}>{t.tabs[k]}</button>
            ))}
          </div>
        ) : (
          <div aria-hidden="true" style={{ display: "flex", gap: 6, padding: "12px 16px 0" }}>
            {["credit", "income", "car"].map((s, i) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= STEPS.indexOf(step) ? C.text : C.fillStrong }} />
            ))}
          </div>
        )}

        <main ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 22, WebkitOverflowScrolling: "touch" }}>
          {body}
        </main>

        <footer style={{ display: "flex", gap: 10, padding: "12px 16px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${C.line}`, background: C.bg }}>
          {footer}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
