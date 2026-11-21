// "Trade in my car" pop-up on a dealer's own site (STOREFRONT-1, 2026-11-20).
// The buyer says what they drive; WhatsApp opens to the dealer with it typed in,
// and /api/enquiry saves a pipeline lead (note = the trade-in line), so the dealer
// has it even if the buyer never presses send. Rules + words: src/utils/tradeIn.js.
// Never a price or valuation here: the dealer has not seen the car.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import PhoneInput from "../ui/PhoneInput";
import Turnstile from "../Turnstile";
import { useModalHistory } from "../../hooks/useModalHistory";
import { isValidMyPhone, normalizePhone, MY_PHONE_ERROR } from "../../lib/phone";
import { checkTradeIn, tradeInWhatsApp } from "../../utils/tradeIn";
import { BRAND_OPTIONS, YEARS } from "../../config/marketplaceConfig";
import { apiUrl } from "../../utils/apiUrl";

const C = {
  card: "var(--sf-card, #111113)", field: "var(--sf-bg, #0B0B0D)", line: "var(--sf-border, rgba(255,255,255,0.09))",
  text: "var(--sf-text, #F0F0F0)", muted: "var(--sf-muted, #8A8A93)", bad: "var(--sf-bad, #f87171)",
};
const field = {
  width: "100%", boxSizing: "border-box", background: C.field, color: C.text,
  border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", fontSize: 15,
  fontFamily: "var(--xd-font-body)", outline: "none",
};
const label = { display: "block", fontSize: 12, color: C.muted, margin: "0 0 6px", fontWeight: 600 };

export default function TradeInSheet({ subdomain, siteName, whatsappNumber, onClose }) {
  const [form, setForm] = useState({ brand: "", model: "", year: "", mileage: "", name: "", phone: "" });
  const [token, setToken] = useState(null);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const dirty = Object.values(form).some(Boolean) && !sent;
  useModalHistory(true, onClose, { isDirty: () => dirty });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const trade = checkTradeIn(form);
    const errs = { ...trade.errors };
    if (!form.name.trim()) errs.name = "Your name, so the dealer knows who to reply to";
    if (!isValidMyPhone(form.phone)) errs.phone = form.phone ? MY_PHONE_ERROR : "Your number, so the dealer can call back";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // WhatsApp first and synchronously, inside the tap, or the browser blocks it.
    // A dealer's own number on their own site is the one CDP-3 exception.
    const wa = normalizePhone(whatsappNumber);
    if (wa) {
      const text = encodeURIComponent(tradeInWhatsApp(trade.car, siteName));
      window.open(`https://wa.me/${wa}?text=${text}`, "_blank", "noopener,noreferrer");
    }
    fetch(apiUrl("/api/enquiry"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "trade_in", subdomain, name: form.name.trim(), phone: form.phone, tradeIn: trade.car, token,
      }),
    }).catch((err) => console.error("[TradeInSheet] enquiry failed:", err));
    setSent(true);
  };

  const err = (k) => errors[k] && <p style={{ color: C.bad, fontSize: 12, margin: "6px 0 0" }}>{errors[k]}</p>;

  return createPortal(
    <div className="tis-overlay" role="dialog" aria-modal="true" aria-label="Trade in your car"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .tis-overlay { position: fixed; inset: 0; z-index: 100001; background: rgba(0,0,0,0.72);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center; }
        .tis-card { width: 100%; max-width: 460px; max-height: 92vh; overflow-y: auto; background: ${C.card};
          border: 1px solid ${C.line}; border-radius: 18px 18px 0 0; padding: 22px 20px 28px;
          font-family: var(--xd-font-body); color: ${C.text}; }
        .tis-card input::placeholder { color: var(--sf-muted, #4A4A52); opacity: 1; }
        .tis-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .tis-row > * { min-width: 0; }
        @media (min-width: 640px) { .tis-overlay { align-items: center; padding: 24px; } .tis-card { border-radius: 18px; } }
      `}</style>
      <div className="tis-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Trade in your car</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "8px 0 20px" }}>
              Thanks, {form.name.trim().split(" ")[0]}. {siteName || "The dealer"} has your car details and will get back to you
              {whatsappNumber ? " on WhatsApp." : " by phone."}
            </p>
            <button type="button" onClick={onClose} style={{ ...field, cursor: "pointer", fontWeight: 700, textAlign: "center" }}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
              Tell {siteName || "us"} what you drive. They will get back to you with an offer.
            </p>
            <div className="tis-row" style={{ marginBottom: 14 }}>
              <div>
                <label style={label} htmlFor="tis-brand">Brand</label>
                <input id="tis-brand" list="tis-brands" value={form.brand} maxLength={40} autoComplete="off"
                  onChange={(e) => set("brand")(e.target.value)} style={field} placeholder="e.g. Perodua" />
                <datalist id="tis-brands">{BRAND_OPTIONS.map((b) => <option key={b} value={b} />)}</datalist>
                {err("brand")}
              </div>
              <div>
                <label style={label} htmlFor="tis-model">Model</label>
                <input id="tis-model" value={form.model} maxLength={40} onChange={(e) => set("model")(e.target.value)}
                  style={field} placeholder="e.g. Myvi" />
                {err("model")}
              </div>
            </div>
            <div className="tis-row" style={{ marginBottom: 14 }}>
              <div>
                <label style={label} htmlFor="tis-year">Year</label>
                <select id="tis-year" value={form.year} onChange={(e) => set("year")(e.target.value)} style={{ ...field, cursor: "pointer" }}>
                  <option value="">Year</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {err("year")}
              </div>
              <div>
                <label style={label} htmlFor="tis-km">Mileage (km, optional)</label>
                <input id="tis-km" inputMode="numeric" value={form.mileage}
                  onChange={(e) => set("mileage")(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                  style={field} placeholder="e.g. 85000" />
                {err("mileage")}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="tis-name">Your name</label>
              <input id="tis-name" value={form.name} maxLength={100} autoComplete="name"
                onChange={(e) => set("name")(e.target.value)} style={field} />
              {err("name")}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label} htmlFor="tis-phone">Your phone number</label>
              <PhoneInput id="tis-phone" value={form.phone} onChange={set("phone")} style={field}
                prefixStyle={{ padding: "0 4px 0 0", color: C.muted }} inputStyle={{ padding: 0, background: "transparent", color: C.text }} />
              {err("phone")}
            </div>
            <Turnstile onToken={setToken} action="enquiry" />
            <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, margin: "10px 0 14px" }}>
              By sending, you agree to our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>Privacy Policy</a> and
              to being contacted about your trade-in.
            </p>
            <button type="submit" style={{ width: "100%", background: whatsappNumber ? "#25D366" : "var(--sf-accent, #DC2626)", color: "#fff", border: "none", borderRadius: 8,
              padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--xd-font-body)" }}>
              {whatsappNumber ? "Send on WhatsApp" : "Send my car details"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
