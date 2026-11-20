// "Check my loan" pop-up on a dealer's own site (STOREFRONT-1, 2026-11-20).
// Three short steps (pay, record, car), then what commonly gets a car loan declined
// and what to sort first, then the buyer sends it to the dealer: WhatsApp opens with
// a short line (no pay in it), and /api/enquiry saves the answers as the lead's note.
// Rules + every word that matters: src/utils/loanEnquiry.js. Never an approval.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft } from "lucide-react";
import PhoneInput from "../ui/PhoneInput";
import Turnstile from "../Turnstile";
import { useModalHistory } from "../../hooks/useModalHistory";
import { isValidMyPhone, normalizePhone, MY_PHONE_ERROR } from "../../lib/phone";
import { publicClient } from "../../supabaseClient";
import { withTimeout } from "../../config/marketplaceConfig";
import { apiUrl } from "../../utils/apiUrl";
import {
  LOAN_QUESTIONS, LOAN_DEPOSITS, LOAN_YEARS, LOAN_DISCLAIMER, OUTCOME_COPY, FLAG_COPY,
  checkLoanEnquiry, loanResult, toLoanCar, carsThatFit, loanEnquiryWhatsApp,
} from "../../utils/loanEnquiry";

const C = {
  card: "var(--sf-card, #111113)", field: "var(--sf-bg, #0B0B0D)", line: "var(--sf-border, rgba(255,255,255,0.09))", chip: "var(--sf-bg2, #18181B)",
  text: "var(--sf-text, #F0F0F0)", muted: "var(--sf-muted, #8A8A93)", bad: "var(--sf-bad, #f87171)", accent: "var(--sf-accent, #DC2626)",
};
const field = {
  width: "100%", boxSizing: "border-box", background: C.field, color: C.text,
  border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", fontSize: 15,
  fontFamily: "var(--xd-font-body)", outline: "none",
};
const label = { display: "block", fontSize: 12, color: C.muted, margin: "0 0 8px", fontWeight: 600 };
const rm = (n) => `RM ${Math.round(Number(n) || 0).toLocaleString("en-MY")}`;
const STEPS = ["pay", "record", "car"];
const STEP_KEYS = { pay: ["earn", "job", "confirmed"], record: ["late", "ccris", "history"] };

function Chips({ options, value, onPick }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(([v, text]) => {
        const on = String(value) === String(v);
        return (
          <button key={v} type="button" onClick={() => onPick(v)} aria-pressed={on}
            style={{ background: on ? C.text : C.chip, color: on ? "var(--sf-bg, #0B0B0D)" : C.text, border: `1px solid ${on ? C.text : C.line}`,
              borderRadius: 999, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--xd-font-body)" }}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

export default function LoanCheckSheet({ subdomain, dealerId, siteName, whatsappNumber, onClose }) {
  const [step, setStep] = useState("pay");
  const [a, setA] = useState({ dep: 10, years: 7 });
  const [carId, setCarId] = useState("");
  const [rows, setRows] = useState([]);
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [token, setToken] = useState(null);
  const [errors, setErrors] = useState({});
  const dirty = step !== "sent" && Object.keys(a).length > 2;
  useModalHistory(true, onClose, { isDirty: () => dirty });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // The dealer's own cars with a price, for the car step and "cars that fit".
  useEffect(() => {
    if (!dealerId) return;
    let live = true;
    withTimeout(publicClient.from("public_car_listings")
      .select("id, year, brand, model, variant, condition, selling_price, is_model_card")
      .eq("dealer_id", dealerId).in("status", ["available", "reserved"])
      .order("selling_price", { ascending: true }).limit(100))
      .then(({ data }) => { if (live && data) setRows(data.filter((r) => toLoanCar(r))); })
      .catch(() => {});
    return () => { live = false; };
  }, [dealerId]);

  const set = (k) => (v) => { setA((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const checked = useMemo(() => checkLoanEnquiry(a), [a]);
  const car = useMemo(() => toLoanCar(rows.find((r) => r.id === carId)), [rows, carId]);
  const result = useMemo(() => (checked.ok ? loanResult(checked.answers, car) : null), [checked, car]);
  const fits = useMemo(() => (checked.ok && !car ? carsThatFit(rows, checked.answers) : []), [checked, car, rows]);

  const next = () => {
    const keys = step === "pay" ? [...STEP_KEYS.pay, "pay", "commit"] : step === "record" ? STEP_KEYS.record : [];
    const errs = Object.fromEntries(keys.filter((k) => checked.errors[k]).map((k) => [k, checked.errors[k]]));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStep(step === "pay" ? "record" : step === "record" ? "car" : "result");
  };
  const back = () => setStep(step === "result" ? "car" : step === "car" ? "record" : "pay");

  const send = (e) => {
    e.preventDefault();
    const errs = {};
    if (!contact.name.trim()) errs.name = "Your name, so the dealer knows who to reply to";
    if (!isValidMyPhone(contact.phone)) errs.phone = contact.phone ? MY_PHONE_ERROR : "Your number, so the dealer can call back";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // WhatsApp first and synchronously, inside the tap, or the browser blocks it.
    // A dealer's own number on their own site is the one CDP-3 exception.
    const wa = normalizePhone(whatsappNumber);
    if (wa) {
      const text = encodeURIComponent(loanEnquiryWhatsApp(car, siteName));
      window.open(`https://wa.me/${wa}?text=${text}`, "_blank", "noopener,noreferrer");
    }
    fetch(apiUrl("/api/enquiry"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "loan_check", subdomain, carId: car?.id || null, name: contact.name.trim(), phone: contact.phone,
        loan: checked.answers, token,
      }),
    }).catch((err) => console.error("[LoanCheckSheet] enquiry failed:", err));
    setStep("sent");
  };

  const err = (k) => errors[k] && <p style={{ color: C.bad, fontSize: 12, margin: "6px 0 0" }}>{errors[k]}</p>;
  const question = (key) => {
    const q = LOAN_QUESTIONS.find((x) => x.key === key);
    if (q.only && !q.only(a)) return null;
    return (
      <div key={key} style={{ marginBottom: 18 }}>
        <span style={label}>{q.label}</span>
        <Chips options={Object.entries(q.options)} value={a[key]} onPick={set(key)} />
        {err(key)}
      </div>
    );
  };
  const money = (k, text, hint, optional) => (
    <div style={{ marginBottom: 16 }}>
      <label style={label} htmlFor={`lcs-${k}`}>{text}{optional ? " (optional)" : ""}</label>
      <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: C.muted }}>RM</span>
        <input id={`lcs-${k}`} inputMode="numeric" value={a[k] ?? ""} placeholder={hint}
          onChange={(e) => set(k)(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, fontFamily: "var(--xd-font-body)" }} />
      </div>
      {err(k)}
    </div>
  );
  const primary = (text, onClick, extra) => (
    <button type={onClick ? "button" : "submit"} onClick={onClick}
      style={{ width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: 14,
        fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--xd-font-body)", ...extra }}>{text}</button>
  );
  const outcomeText = result && (typeof OUTCOME_COPY[result.outcome] === "function"
    ? OUTCOME_COPY[result.outcome](result.fixCount) : OUTCOME_COPY[result.outcome]);
  const stepNo = STEPS.indexOf(step);

  return createPortal(
    <div className="lcs-overlay" role="dialog" aria-modal="true" aria-label="Check my loan"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .lcs-overlay { position: fixed; inset: 0; z-index: 100001; background: rgba(0,0,0,0.72);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center; }
        .lcs-card { width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; background: ${C.card};
          border: 1px solid ${C.line}; border-radius: 18px 18px 0 0; padding: 20px 20px 28px;
          font-family: var(--xd-font-body); color: ${C.text}; }
        .lcs-card input::placeholder { color: var(--sf-muted, #4A4A52); opacity: 1; }
        .lcs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: end; }
        .lcs-row > * { min-width: 0; }
        @media (min-width: 640px) { .lcs-overlay { align-items: center; padding: 24px; } .lcs-card { border-radius: 18px; } }
      `}</style>
      <div className="lcs-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {step !== "pay" && step !== "sent" && (
            <button type="button" onClick={back} aria-label="Back"
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4, marginLeft: -6 }}>
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", flex: 1 }}>Check my loan</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        {stepNo >= 0 && (
          <p style={{ color: C.muted, fontSize: 13, margin: "0 0 18px" }}>
            Step {stepNo + 1} of 3 · {["Your pay", "Your record", "The car"][stepNo]}. No IC or payslip needed.
          </p>
        )}

        {step === "pay" && (
          <>
            {STEP_KEYS.pay.map(question)}
            <div className="lcs-row">
              {money("pay", "Take-home pay a month", "e.g. 4000")}
              {money("commit", "Other loans a month", "e.g. 600", true)}
            </div>
            <p style={{ color: C.muted, fontSize: 12, margin: "-6px 0 18px", lineHeight: 1.5 }}>
              Other loans = house, car, personal loan, PTPTN, and 5% of any card balance.
            </p>
            {primary("Next", next)}
          </>
        )}

        {step === "record" && (
          <>
            {STEP_KEYS.record.map(question)}
            {primary("Next", next)}
          </>
        )}

        {step === "car" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={label} htmlFor="lcs-car">Which car?</label>
              <select id="lcs-car" value={carId} onChange={(e) => setCarId(e.target.value)} style={{ ...field, cursor: "pointer" }}>
                <option value="">Not sure yet, show me what fits</option>
                {rows.map((r) => { const c = toLoanCar(r); return <option key={r.id} value={r.id}>{c.label} · {rm(c.price)}</option>; })}
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <span style={label}>Deposit</span>
              <Chips options={LOAN_DEPOSITS.map((d) => [d, d ? `${d}%` : "None"])} value={a.dep} onPick={(v) => set("dep")(Number(v))} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <span style={label}>Loan term</span>
              <Chips options={LOAN_YEARS.map((y) => [y, `${y} years`])} value={a.years} onPick={(v) => set("years")(Number(v))} />
            </div>
            {primary("See my result", next)}
          </>
        )}

        {step === "result" && result && (
          <form onSubmit={send} noValidate style={{ marginTop: 14 }}>
            <div style={{ background: C.field, borderRadius: 12, padding: "16px 16px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: car ? 10 : 0 }}>{outcomeText}</div>
              {car && result.monthly > 0 && (
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  {car.label}: about <b style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{rm(result.monthly)}</b> a month over {result.years} years,
                  {" "}{rm(result.deposit)} down, at {car.eir}% a year (an estimate).
                </div>
              )}
            </div>
            {result.flags.map((f) => (
              <div key={f.key} style={{ padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {f.tone !== "info" && <span aria-hidden style={{ display: "inline-block", width: 7, height: 7, borderRadius: 99, background: f.tone === "red" ? C.bad : C.muted, marginRight: 8, verticalAlign: 2 }} />}
                  {FLAG_COPY[f.key].title(f.params)}
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{FLAG_COPY[f.key].fix(f.params)}</div>
              </div>
            ))}
            {!car && (
              <div style={{ padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  {fits.length ? "Cars here that fit your pay (tap one to check it)" : "No car here fits your pay at this deposit yet"}
                </div>
                {fits.map(({ car: c, monthly }) => (
                  <button key={c.id} type="button" onClick={() => setCarId(c.id)}
                    style={{ ...field, display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                    <span style={{ color: C.muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{rm(monthly)}/mo</span>
                  </button>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, margin: "8px 0 18px" }}>{LOAN_DISCLAIMER}</p>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Send this to {siteName || "the dealer"}</div>
              <div style={{ marginBottom: 14 }}>
                <label style={label} htmlFor="lcs-name">Your name</label>
                <input id="lcs-name" value={contact.name} maxLength={100} autoComplete="name"
                  onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))} style={field} />
                {err("name")}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label} htmlFor="lcs-phone">Your phone number</label>
                <PhoneInput id="lcs-phone" value={contact.phone} onChange={(v) => setContact((p) => ({ ...p, phone: v }))} style={field}
                  prefixStyle={{ padding: "0 4px 0 0", color: C.muted }} inputStyle={{ padding: 0, background: "transparent", color: C.text }} />
                {err("phone")}
              </div>
              <Turnstile onToken={setToken} action="enquiry" />
              <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, margin: "10px 0 14px" }}>
                Your answers (pay, other loans, record) go to {siteName || "the dealer"} only, so they can help with the loan.
                By sending, you agree to our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>Privacy Policy</a> and
                to being contacted about financing.
              </p>
              {primary(whatsappNumber ? "Send on WhatsApp" : "Send to the dealer", null, whatsappNumber ? { background: "#25D366" } : null)}
            </div>
          </form>
        )}

        {step === "sent" && (
          <div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "8px 0 20px" }}>
              Thanks, {contact.name.trim().split(" ")[0]}. {siteName || "The dealer"} has your answers and will get back to you
              {whatsappNumber ? " on WhatsApp." : " by phone."}
            </p>
            <button type="button" onClick={onClose} style={{ ...field, cursor: "pointer", fontWeight: 700, textAlign: "center" }}>Done</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
