import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Check, ChevronRight, Plus, Copy, Loader2, Share2, Eye,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import { BANK_RATES, RATE_BASIS, rateLabel, monthlyPayment } from "../../utils/financing";
import { assessReadiness } from "../../utils/loanReadiness";
import { loanCheckCopy } from "./loanCheckCopy";
import { premiumDark as PD, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";

// Salesman Premium only, so it is drawn in premiumDark (SIMPLE-2): depth by
// tone, no borders, red for fills, mint the only green, no blue or amber.
// Mapped once onto the token names this file already used.
const C = {
  bg: PD.canvas, surface: PD.card, surfaceRaised: PD.raised, fillSubtle: PD.card, fill: PD.raised, fillStrong: PD.hover,
  line: PD.line, border: "transparent", borderStrong: "transparent",
  text: PD.text, textSec: PD.textSec, textMuted: PD.textMuted, textDim: PD.textMuted,
  accent: PD.accent, onAccent: PD.onAccent,
  danger: "#dc2626", dangerText: PD.accentText,
  success: "#6ee7b7", successText: PD.up,
  info: "#a3a9b5", infoText: PD.text, infoTextHi: PD.text,
  warn: "#a3a9b5", warnText: PD.textSec,
};

/*
 * Loan desk — one buyer case, from "can they afford it" to "which bank said yes".
 *
 * This replaced three stacked full-width panels (a comparison calculator, a
 * SEPARATE submit form that re-asked car price and down payment, and the
 * applications list) that a salesman had to scroll past in one column. The two
 * forms were the real redundancy: comparing banks and submitting an application
 * are one action in real life, not two, so they are now one flow.
 *
 * What the panel is FOR, in the order a Malaysian deal actually happens:
 *   1. who is the buyer + which car        (pull from a lead, don't retype)
 *   2. can they afford it                  (DSR — the sum every salesman does by hand)
 *   3. which bank, at what instalment      (compare, then pick one or more)
 *   4. what documents do I collect         (depends on how they earn)
 *   5. who said yes                        (per-bank outcome, with the reason)
 *
 * Honesty rules, same as everywhere else in this app: DSR is the bank's own
 * affordability yardstick and is shown as a GUIDE, never as an approval. Every
 * number on screen is arithmetic on figures the salesman typed — nothing here
 * predicts a decision, and the copy says so out loud.
 */

// Indicative bank rates, as EIR — one table for the whole app
// (src/utils/financing.js). They move, so the rate stays editable per attempt
// rather than being treated as a quote.
export const BANKS = BANK_RATES;

// Column-backed so a tick survives a reload. doc_ssm / doc_tax_form were added
// with this rebuild; the rest already existed in the table and had no UI at all.
const DOCS = {
  ic_front:          { col: "doc_ic_front",          label: "IC — front" },
  ic_back:           { col: "doc_ic_back",           label: "IC — back" },
  payslip_1:         { col: "doc_payslip_1",         label: "Payslip — latest month" },
  payslip_2:         { col: "doc_payslip_2",         label: "Payslip — 2 months ago" },
  payslip_3:         { col: "doc_payslip_3",         label: "Payslip — 3 months ago" },
  epf:               { col: "doc_epf",               label: "EPF / KWSP statement" },
  bank_statement:    { col: "doc_bank_statement",    label: "Bank statement — 3 to 6 months" },
  employment_letter: { col: "doc_employment_letter", label: "Employment confirmation letter" },
  ssm:               { col: "doc_ssm",               label: "SSM / business registration" },
  tax_form:          { col: "doc_tax_form",          label: "Form B + LHDN tax receipt" },
  ccris_ctos:        { col: "doc_ccris_ctos",        label: "CCRIS / CTOS check" },
};

const DOC_SETS = {
  "Salaried": {
    required: ["ic_front", "ic_back", "payslip_1", "payslip_2", "payslip_3", "epf", "bank_statement"],
    optional: ["employment_letter", "ccris_ctos"],
  },
  "Self-employed": {
    required: ["ic_front", "ic_back", "ssm", "bank_statement", "tax_form"],
    optional: ["ccris_ctos"],
  },
  "Commission": {
    required: ["ic_front", "ic_back", "payslip_1", "payslip_2", "payslip_3", "bank_statement", "epf"],
    optional: ["ccris_ctos"],
  },
};
const docSetFor = (employment) => DOC_SETS[employment] || DOC_SETS.Salaried;

/* ── The arithmetic ──────────────────────────────────────────────────────── */

// Hire purchase is charged on the REDUCING BALANCE at an EIR since the
// Hire-Purchase (Amendment) Act 2026 — this desk used to quote flat. The
// shared maths in src/utils/financing.js, in years.
export const loanMonthly = (principal, ratePct, years) =>
  years > 0 ? monthlyPayment(principal, ratePct, years * 12) : 0;

const rm = (n) => "RM " + Math.round(Number(n) || 0).toLocaleString("en-MY");
const rm2 = (n) => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS = {
  Submitted: { fill: C.info,    text: C.infoText,    label: "Submitted" },
  Pending:   { fill: C.warn,    text: C.warnText,    label: "Pending" },
  Approved:  { fill: C.success, text: C.successText, label: "Approved" },
  Declined:  { fill: C.danger,  text: C.dangerText,  label: "Declined" },
};

// One case can be tried at several banks. The case is Approved the moment any
// bank says yes, Declined only when every bank has said no.
const rollUp = (attempts = []) => {
  if (!attempts.length) return "Submitted";
  if (attempts.some((a) => a.status === "Approved")) return "Approved";
  if (attempts.every((a) => a.status === "Declined")) return "Declined";
  if (attempts.some((a) => a.status === "Pending")) return "Pending";
  return "Submitted";
};

// One-tap wording for an outcome note. Written for the BUYER, because the buyer
// is who reads it on the status link — so it says what it means for them and
// what happens next, never the bank's internal shorthand. A salesman jotting
// "CTOS bad, DSR 78" for himself is how someone's credit record ends up
// forwarded round a WhatsApp group.
const OUTCOME_NOTES = {
  Approved: [
    "Approved as applied for",
    "Approved, but the bank wants a bigger down payment",
    "Approved over a shorter loan period than we asked for",
    "Approved for a smaller amount than we asked for",
    "Approved once the remaining documents are in",
  ],
  Declined: [
    "This bank could not approve it. We are trying another",
    "Their minimum income for this amount was not met",
    "Existing monthly commitments were too high for this amount",
    "The bank wanted a larger down payment than we agreed",
    "Credit record needs tidying up before this bank will look again",
  ],
  Pending: [
    "Submitted, waiting for the bank to come back",
    "The bank has asked for extra documents",
  ],
};

// Mirrors the DB trigger trg_sync_lead_loan so the linked lead's badge moves
// straight away instead of only after a reload. The trigger is what actually
// persists it — this is the optimistic copy, and the two must agree, including
// the mapping onto leads.loan_status's CHECK values.
export const leadPatchFor = (row) => {
  const attempts = Array.isArray(row.banks) ? row.banks : [];
  const bank = (attempts.find((a) => a.status === "Approved") || attempts[0])?.name || null;
  return {
    loan_bank: bank,
    loan_amount: row.loan_amount ?? null,
    loan_status: row.status === "Approved" ? "approved" : row.status === "Declined" ? "rejected" : "submitted",
    loan_updated_at: new Date().toISOString(),
  };
};

/* ── Small shared bits ───────────────────────────────────────────────────── */

const inputSx = {
  background: C.fill, border: `1px solid ${C.borderStrong}`, borderRadius: R.md,
  color: C.text, padding: "9px 11px", fontSize: T.size.base, outline: "none",
  width: "100%", fontFamily: "inherit", boxSizing: "border-box",
};
const cardSx = {
  background: C.fillSubtle, border: `1px solid ${C.border}`,
  borderRadius: R.lg, padding: 16, marginBottom: 14,
};
const labelSx = { fontSize: T.size.sm, color: C.textMuted, display: "block", marginBottom: 5 };

function Field({ label, hint, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelSx}>{label}</label>
      {children}
      {hint && <p style={{ margin: "4px 0 0", fontSize: T.size.sm, color: C.textDim }}>{hint}</p>}
    </div>
  );
}

function SectionHead({ n, title, sub, tourId }) {
  return (
    <div data-tour-id={tourId} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      <span style={{
        width: 22, height: 22, borderRadius: R.pill, flexShrink: 0, marginTop: 1,
        background: withAlpha(C.info, 0.14), border: `1px solid ${withAlpha(C.info, 0.3)}`,
        color: C.infoText, fontSize: T.size.xs, fontWeight: T.weight.bold,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text }}>{title}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>{sub}</p>}
      </div>
    </div>
  );
}

function StatusPill({ status, small }) {
  const s = STATUS[status] || STATUS.Submitted;
  return (
    <span style={{
      fontSize: small ? T.size.xs : T.size.sm, fontWeight: T.weight.bold, flexShrink: 0,
      padding: small ? "2px 7px" : "3px 9px", borderRadius: R.pill,
      background: withAlpha(s.fill, 0.14), border: `1px solid ${withAlpha(s.fill, 0.3)}`, color: s.text,
    }}>{s.label}</span>
  );
}

/* ── Document checklist ──────────────────────────────────────────────────── */

function DocChecklist({ employment, docs, onToggle, buyerName }) {
  const set = docSetFor(employment);
  const doneCount = set.required.filter((k) => docs[k]).length;
  const allDone = doneCount === set.required.length;

  const copyList = () => {
    const lines = [
      `Hi${buyerName ? ` ${buyerName}` : ""}, for the loan application I'll need these:`,
      "",
      ...set.required.map((k) => `- ${DOCS[k].label}`),
    ];
    navigator.clipboard?.writeText(lines.join("\n"))
      .then(() => toast.success("Document list copied — paste it to the buyer"))
      .catch(() => toast.error("Could not copy"));
  };

  const Row = ({ k, optional }) => (
    <button
      onClick={() => onToggle(k)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        padding: "9px 10px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit",
        background: docs[k] ? withAlpha(C.success, 0.08) : C.fill,
        border: "none",
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: docs[k] ? C.success : "transparent",
        border: `1.5px solid ${docs[k] ? C.success : C.textMuted}`,
      }}>
        {docs[k] && <Check size={12} color={C.bg} strokeWidth={3} />}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: T.size.base, color: docs[k] ? C.textSec : C.text }}>
        {DOCS[k].label}
      </span>
      {optional && <span style={{ fontSize: T.size.xs, color: C.textDim, flexShrink: 0 }}>optional</span>}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: allDone ? C.successText : C.text }}>
          {doneCount} of {set.required.length} collected
        </span>
        <button onClick={copyList} style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          padding: "5px 10px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit",
          background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, fontSize: T.size.sm,
        }}>
          <Copy size={12} /> Copy list for buyer
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {set.required.map((k) => <Row key={k} k={k} />)}
        {set.optional.map((k) => <Row key={k} k={k} optional />)}
      </div>
    </div>
  );
}

/* ── Send a checked buyer to a bank ───────────────────────────────────────── */

// An application only ever starts from a saved loan check (owner, 2026-10-25:
// one flow). The check already asked who, which car, the money and how they
// earn, and it is the ONE affordability rule (loanReadiness.js). This screen
// asks only what the check does not: contact details for the bank, which banks
// to try, which documents are in, and notes. It used to retype all of it and
// run a second DSR with different ceilings, so one buyer could read "tight" in
// the check and "over the ceiling" here.
const EARN_TO_EMPLOYMENT = { salary: "Salaried", commission: "Commission", business: "Self-employed", gig: "Self-employed" };
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function ApplyFromCheck({ check, lead, userId, dealerId, onCreated, onCancel, onEditCheck }) {
  const { i18n } = useTranslation();
  const lc = loanCheckCopy(i18n.language);
  const a = check?.answers || {};
  const result = useMemo(() => assessReadiness(a), [a]);
  const employment = EARN_TO_EMPLOYMENT[a.earn] || "Salaried";
  const price = result.price;
  const dp = result.deposit;
  const loan = result.loan;
  const tenure = result.years;

  const [phone, setPhone] = useState(lead?.phone || "");
  const [ic, setIc] = useState(lead?.buyer_ic || "");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState({});
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () => BANKS.map((b) => ({ ...b, monthly: loanMonthly(loan, b.rate, tenure) })).sort((x, y) => x.monthly - y.monthly),
    [loan, tenure],
  );
  const togglePick = (name) => setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  const buyerName = (check?.buyer_name || lead?.buyer_name || "").trim();
  const canSubmit = buyerName && loan > 0 && picked.length > 0;

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    // One row per BUYER CASE; each chosen bank is an attempt inside it.
    const attempts = picked.map((name) => {
      const b = BANKS.find((x) => x.name === name);
      return {
        name, rate: b?.rate ?? null, rate_basis: RATE_BASIS, tenure, loan_amount: loan,
        monthly: Number(loanMonthly(loan, b?.rate ?? 0, tenure).toFixed(2)),
        status: "Submitted", reason: null, decided_at: null,
      };
    });
    const docCols = Object.fromEntries(Object.entries(DOCS).map(([k, v]) => [v.col, !!docs[k]]));
    const { data, error } = await supabase.from("loan_applications").insert({
      salesman_id: userId,
      dealer_id: dealerId || null,
      lead_id: check?.lead_id || null,
      listing_id: check?.listing_id || null,
      buyer_name: buyerName || null,
      buyer_phone: phone || null,
      buyer_ic: ic || null,
      buyer_employment_type: employment,
      car_model: a.car_name || null,
      car_price: price || null,
      loan_amount: loan,
      down_payment: dp || null,
      loan_tenure: tenure,
      buyer_income: toNum(a.pay) || null,
      existing_commitments: toNum(a.commit) || null,
      banks: attempts,
      status: "Submitted",
      notes: notes || null,
      ...docCols,
    }).select("*").single();
    setSaving(false);
    if (error) { console.error("submitLoan:", error); toast.error("Could not save the application"); return; }
    toast.success(`Application saved — ${attempts.length} bank${attempts.length > 1 ? "s" : ""}`);
    onCreated(data);
  };

  return (
    <div>
      {/* What the check settled, read-only. Changing it means changing the check. */}
      <div style={cardSx}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text }}>{buyerName || lc.walkIn}</p>
            <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textSec }}>{a.car_name || "—"}</p>
          </div>
          <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "3px 9px", borderRadius: R.pill, background: C.fill, color: check?.outcome === "ready" ? C.successText : check?.outcome === "hold" ? C.dangerText : C.text, flexShrink: 0 }}>
            {lc.pill[check?.outcome] || ""}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ padding: 12, borderRadius: R.md, background: C.fill, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>Loan</p>
            <p style={{ margin: "4px 0 0", fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, fontVariantNumeric: "tabular-nums" }}>{rm(loan)}</p>
            <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textSec }}>{tenure} years · {dp > 0 ? `${rm(dp)} down` : "no down payment"}</p>
          </div>
          <div style={{ padding: 12, borderRadius: R.md, background: C.fill, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{lc.dsrLabel}</p>
            <p style={{ margin: "4px 0 0", fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, fontVariantNumeric: "tabular-nums" }}>{result.dsr == null ? "—" : `${Math.round(result.dsr * 100)}%`}</p>
            <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textSec }}>{lc.band[result.band || "none"]}</p>
          </div>
        </div>
        <button onClick={onEditCheck} style={{ marginTop: 12, padding: 0, background: "none", border: "none", color: C.textSec, fontSize: T.size.sm, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
          Change the answers in the loan check
        </button>
      </div>

      {/* Contact details the bank form needs; the check never asks for an IC. */}
      <div style={cardSx}>
        <SectionHead n="1" title="For the bank" sub="Only on the application. The loan check never stores an IC." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="Phone">
            <div style={{ ...inputSx, display: "flex", alignItems: "center", padding: 0, overflow: "hidden" }}>
              <span style={{ padding: "9px 10px", color: C.textMuted, fontSize: T.size.base, flexShrink: 0 }}>+60</span>
              <input type="tel" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: T.size.base, padding: "9px 10px 9px 0", fontFamily: "inherit" }}
                value={(phone || "").replace(/^\+?60/, "")}
                onChange={(e) => setPhone("+60" + e.target.value.replace(/\D/g, ""))} placeholder="123456789" />
            </div>
          </Field>
          <Field label="IC number">
            <input style={inputSx} value={ic} onChange={(e) => setIc(e.target.value)} placeholder="901231-10-1234" />
          </Field>
        </div>
      </div>

      <div style={cardSx}>
        <SectionHead n="2" tourId="loan-banks" title="Which banks to try" sub="Start with one. Every application sits on the buyer's CCRIS for 12 months and the next bank sees it." />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.map((b, i) => {
            const on = picked.includes(b.name);
            return (
              <button key={b.name} onClick={() => togglePick(b.name)} aria-pressed={on} style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
                padding: "11px 12px", borderRadius: R.md, cursor: "pointer", fontFamily: "inherit",
                background: on ? C.fillStrong : C.fill, border: "none",
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: on ? C.accent : "transparent", border: `1.5px solid ${on ? C.accent : C.textMuted}`,
                }}>
                  {on && <Check size={12} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{b.name}</span>
                    {i === 0 && <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, color: C.successText }}>Lowest</span>}
                    {b.islamic && <span style={{ fontSize: T.size.xs, color: C.textMuted }}>Islamic</span>}
                  </span>
                  <span style={{ display: "block", fontSize: T.size.sm, color: C.textMuted, marginTop: 2 }}>
                    {b.rate.toFixed(2)}% EIR · total interest {rm(b.monthly * tenure * 12 - loan)}
                  </span>
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "block", fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, fontVariantNumeric: "tabular-nums" }}>{rm(b.monthly)}</span>
                  <span style={{ display: "block", fontSize: T.size.xs, color: C.textMuted, marginTop: 2 }}>/month</span>
                </span>
              </button>
            );
          })}
          <p style={{ margin: "4px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.6 }}>
            Indicative rates, as EIR on the reducing balance (the law since June 2026). Confirm
            the rate with the banker before you tell a buyer anything.
          </p>
        </div>
      </div>

      <div style={cardSx}>
        <SectionHead n="3" title="Documents collected" sub={`For a ${employment.toLowerCase()} buyer. Tick each one as it comes in.`} />
        <DocChecklist
          employment={employment}
          docs={docs}
          buyerName={buyerName.split(" ")[0]}
          onToggle={(k) => setDocs((p) => ({ ...p, [k]: !p[k] }))}
        />
      </div>

      <div style={cardSx}>
        <Field label="Notes (optional)">
          <textarea rows={2} style={{ ...inputSx, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the banker should know" />
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onCancel} style={{ padding: "13px 18px", borderRadius: R.pill, border: "none", background: C.fill, color: C.text, fontSize: T.size.base, fontWeight: T.weight.semibold, fontFamily: "inherit", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!canSubmit || saving} style={{
            flex: 1, padding: "13px", borderRadius: R.pill, border: "none",
            background: canSubmit && !saving ? C.accent : C.fillStrong,
            color: canSubmit && !saving ? C.onAccent : C.textMuted,
            fontSize: T.size.base, fontWeight: T.weight.bold, fontFamily: "inherit",
            cursor: canSubmit && !saving ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {saving ? <><Loader2 size={15} style={{ animation: "ldspin 1s linear infinite" }} /> Saving…</>
                    : `Save application${picked.length ? ` · ${picked.length} bank${picked.length > 1 ? "s" : ""}` : ""}`}
          </button>
        </div>
        {!canSubmit && (
          <p style={{ margin: "8px 0 0", fontSize: T.size.sm, color: C.textMuted, textAlign: "center" }}>
            {!buyerName ? "The check has no buyer name: add it in the loan check" : loan <= 0 ? "The check has no car price: add it in the loan check" : "Pick at least one bank"} to save.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── One saved case ──────────────────────────────────────────────────────── */

function ApplicationCard({ app, onChange, onLeadSync }) {
  const [open, setOpen] = useState(false);
  const [addingBank, setAddingBank] = useState(false);
  const [decide, setDecide] = useState(null);   // { idx, status, reason }
  const [sharing, setSharing] = useState(false);
  const attempts = Array.isArray(app.banks) ? app.banks : [];
  const status = app.status || rollUp(attempts);
  const set = docSetFor(app.buyer_employment_type);
  const docsDone = set.required.filter((k) => app[DOCS[k].col]).length;

  const patch = async (fields) => {
    const next = { ...app, ...fields };
    onChange(next);   // optimistic — a tick that lags feels broken
    const { error } = await supabase.from("loan_applications")
      .update({ ...fields, updated_at: new Date().toISOString() }).eq("id", app.id);
    if (error) { console.error("loan patch:", error); toast.error("Could not save"); onChange(app); return; }
    // The DB trigger has already moved the lead; keep the open pipeline in step.
    if (next.lead_id) onLeadSync?.(next.lead_id, leadPatchFor(next));
  };

  const saveDecision = async () => {
    if (!decide) return;
    const next = attempts.map((a, i) => i === decide.idx
      ? { ...a, status: decide.status, reason: decide.reason || null, decided_at: new Date().toISOString() }
      : a);
    await patch({ banks: next, status: rollUp(next), status_reason: decide.reason || null, decided_at: new Date().toISOString() });
    setDecide(null);
  };

  const addBank = async (name) => {
    const b = BANKS.find((x) => x.name === name);
    const tenure = app.loan_tenure || 7;
    const loan = Number(app.loan_amount) || 0;
    const next = [...attempts, {
      name, rate: b?.rate ?? null, rate_basis: RATE_BASIS, tenure, loan_amount: loan,
      monthly: Number(loanMonthly(loan, b?.rate ?? 0, tenure).toFixed(2)),
      status: "Submitted", reason: null, decided_at: null,
    }];
    await patch({ banks: next, status: rollUp(next) });
    setAddingBank(false);
    toast.success(`${name} added to this case`);
  };

  const untried = BANKS.filter((b) => !attempts.some((a) => a.name === b.name));

  // The token is minted server-side (ensure_loan_share_token) and only for the
  // owner of the application; it is reused on later shares so an already-sent
  // link never goes dead.
  const shareWithBuyer = async () => {
    if (sharing) return;
    setSharing(true);
    const { data: token, error } = await supabase.rpc("ensure_loan_share_token", { p_id: app.id });
    setSharing(false);
    if (error || !token) { console.error("ensure_loan_share_token:", error); toast.error("Could not create the link"); return; }
    const url = `${window.location.origin}/loan/${token}`;
    const first = (app.buyer_name || "").split(" ")[0];
    const msg = `Hi${first ? ` ${first}` : ""}, here's your car loan page — where each bank stands and what documents are still needed. It updates as things move:\n${url}`;
    const digits = (app.buyer_phone || "").replace(/\D/g, "");
    if (digits.length >= 9) {
      window.open(`https://wa.me/${digits.startsWith("6") ? digits : "6" + digits}?text=${encodeURIComponent(msg)}`, "_blank");
      return;
    }
    // No usable phone on file — hand them the link rather than a dead chat.
    navigator.clipboard?.writeText(url)
      .then(() => toast.success("Link copied — send it to the buyer"))
      .catch(() => toast.error("Could not copy the link"));
  };

  return (
    <div style={{ background: C.fillSubtle, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 14, marginBottom: 10 }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left",
        background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {app.buyer_name || "Unnamed buyer"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted }}>
            {[app.car_model, app.loan_amount ? rm(app.loan_amount) : null, app.loan_tenure ? `${app.loan_tenure} yrs` : null]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusPill status={status} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap", fontSize: T.size.sm, color: C.textMuted }}>
        <span>{attempts.length} bank{attempts.length === 1 ? "" : "s"}</span>
        <span style={{ color: docsDone === set.required.length ? C.successText : C.textMuted }}>
          Docs {docsDone}/{set.required.length}
        </span>
        <span style={{ marginLeft: "auto" }}>{new Date(app.created_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "2-digit" })}</span>
        <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", color: C.textDim }} />
      </div>

      {app.status_reason && !open && (
        <p style={{ margin: "8px 0 0", fontSize: T.size.sm, color: C.textSec }}>{app.status_reason}</p>
      )}

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          {/* Attempts */}
          <p style={{ margin: "0 0 8px", fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, fontWeight: T.weight.semibold }}>Banks tried</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            {attempts.map((a, i) => (
              <div key={`${a.name}-${i}`} style={{ padding: "10px 11px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{a.name}</span>
                  <StatusPill status={a.status} small />
                  <span style={{ marginLeft: "auto", fontSize: T.size.sm, color: C.textMuted, whiteSpace: "nowrap" }}>
                    {a.rate != null ? `${Number(a.rate).toFixed(2)}% ${rateLabel(a.rate_basis)}` : "—"}{a.monthly ? ` · ${rm2(a.monthly)}/mo` : ""}
                  </span>
                </div>
                {a.reason && <p style={{ margin: "6px 0 0", fontSize: T.size.sm, color: C.textSec, lineHeight: 1.5 }}>{a.reason}</p>}
                {decide?.idx === i ? (
                  <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["Pending", "Approved", "Declined"].map((s) => (
                        <button key={s} onClick={() => setDecide((p) => ({ ...p, status: s }))} style={{
                          padding: "5px 11px", borderRadius: R.pill, cursor: "pointer", fontFamily: "inherit", fontSize: T.size.sm, fontWeight: T.weight.semibold,
                          background: decide.status === s ? withAlpha(STATUS[s].fill, 0.16) : C.fillStrong,
                          border: `1px solid ${decide.status === s ? withAlpha(STATUS[s].fill, 0.35) : C.border}`,
                          color: decide.status === s ? STATUS[s].text : C.textSec,
                        }}>{s}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {(OUTCOME_NOTES[decide.status] || []).map((t) => (
                        <button key={t} onClick={() => setDecide((p) => ({ ...p, reason: t }))} style={{
                          padding: "5px 9px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit",
                          fontSize: T.size.xs, textAlign: "left", lineHeight: 1.35,
                          background: decide.reason === t ? withAlpha(C.info, 0.22) : C.fillStrong,
                          border: `1px solid ${decide.reason === t ? withAlpha(C.info, 0.3) : C.border}`,
                          color: decide.reason === t ? C.infoText : C.textSec,
                        }}>{t}</button>
                      ))}
                    </div>
                    <input value={decide.reason} onChange={(e) => setDecide((p) => ({ ...p, reason: e.target.value }))}
                      placeholder="Or write it in your own words"
                      style={{ ...inputSx, background: C.fillStrong, fontSize: T.size.sm }} />
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 5, fontSize: T.size.xs, color: C.textDim }}>
                      <Eye size={11} style={{ flexShrink: 0 }} /> The buyer reads this on their status link
                    </p>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={saveDecision} style={{ padding: "7px 14px", borderRadius: R.sm, background: C.accent, border: "none", color: C.onAccent, fontSize: T.size.sm, fontWeight: T.weight.bold, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                      <button onClick={() => setDecide(null)} style={{ padding: "7px 14px", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, fontSize: T.size.sm, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDecide({ idx: i, status: a.status, reason: a.reason || "" })} style={{
                    marginTop: 8, padding: "4px 10px", borderRadius: R.sm, background: "transparent",
                    border: `1px solid ${C.border}`, color: C.textMuted, fontSize: T.size.sm, cursor: "pointer", fontFamily: "inherit",
                  }}>Record outcome</button>
                )}
              </div>
            ))}
          </div>

          {/* Try another bank — the whole point of one case holding many attempts */}
          {addingBank ? (
            <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: "hidden" }}>
              {untried.length === 0 ? (
                <p style={{ margin: 0, padding: "14px 12px", fontSize: T.size.sm, color: C.textDim, textAlign: "center" }}>Every bank on the list has been tried.</p>
              ) : untried.map((b) => (
                <button key={b.name} onClick={() => addBank(b.name)} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "9px 11px", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`, fontFamily: "inherit",
                }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.size.base, color: C.text }}>{b.name}</span>
                  <span style={{ fontSize: T.size.sm, color: C.textMuted, flexShrink: 0 }}>
                    {b.rate.toFixed(2)}% · {rm(loanMonthly(Number(app.loan_amount) || 0, b.rate, app.loan_tenure || 7))}/mo
                  </span>
                </button>
              ))}
              <button onClick={() => setAddingBank(false)} style={{ width: "100%", padding: "8px", background: C.fill, border: "none", color: C.textMuted, fontSize: T.size.sm, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingBank(true)} style={{
              display: "flex", alignItems: "center", gap: 7, marginBottom: 14,
              padding: "8px 12px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit",
              background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, fontSize: T.size.sm, fontWeight: T.weight.semibold,
            }}>
              <Plus size={13} /> Try another bank
            </button>
          )}

          {/* Documents */}
          <p style={{ margin: "0 0 8px", fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, fontWeight: T.weight.semibold }}>Documents</p>
          <DocChecklist
            employment={app.buyer_employment_type}
            docs={Object.fromEntries(Object.entries(DOCS).map(([k, v]) => [k, !!app[v.col]]))}
            buyerName={(app.buyer_name || "").split(" ")[0]}
            onToggle={(k) => patch({ [DOCS[k].col]: !app[DOCS[k].col] })}
          />

          {app.notes && (
            <p style={{ margin: "14px 0 0", fontSize: T.size.sm, color: C.textSec, lineHeight: 1.6 }}>{app.notes}</p>
          )}

          {/* One link answers the "any news?" message three times a day: it shows
              the buyer where each bank stands and what paperwork is still owed,
              and it updates itself every time an outcome is recorded above. */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <button onClick={shareWithBuyer} disabled={sharing} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
              padding: "10px 12px", borderRadius: R.md, fontFamily: "inherit",
              fontSize: T.size.sm, fontWeight: T.weight.semibold,
              cursor: sharing ? "wait" : "pointer",
              background: withAlpha(C.info, 0.1), border: `1px solid ${withAlpha(C.info, 0.28)}`, color: C.infoText,
            }}>
              {sharing ? <Loader2 size={13} style={{ animation: "ldspin 1s linear infinite" }} /> : <Share2 size={13} />}
              Send the buyer their status link
            </button>
            <p style={{ margin: "6px 0 0", fontSize: T.size.xs, color: C.textDim, textAlign: "center", lineHeight: 1.5 }}>
              Shows bank outcomes and outstanding documents. Never their IC, income or your notes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

// The Loans tab: check a buyer first, then send the checked file to a bank and
// track it. `checks` = the seller's saved loan checks; `applyFrom` = a check the
// seller just chose to send ({ check, lead }), set by the page.
const OUTCOME_HUE = { ready: C.successText, fix: C.text, hold: C.dangerText };

export default function LoanDesk({
  userId, dealerId, leads = [], applications = [], setApplications, onLeadSync,
  checks = [], onNewCheck, onOpenCheck, applyFrom = null, onApplyDone,
}) {
  const { i18n } = useTranslation();
  const lc = loanCheckCopy(i18n.language);
  const open = applications.filter((a) => !["Approved", "Declined"].includes(a.status || rollUp(a.banks))).length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Defined once here: the share button's spinner lives in ApplicationCard. */}
      <style>{`@keyframes ldspin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ margin: "0 0 4px", fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text }}>Loans</p>
      <p style={{ margin: "0 0 16px", fontSize: T.size.base, color: C.textMuted, lineHeight: 1.6 }}>
        Check the buyer first, fix what the bank would reject, then send it to a bank and track it here.
      </p>

      {applyFrom ? (
        <ApplyFromCheck
          check={applyFrom.check} lead={applyFrom.lead}
          userId={userId} dealerId={dealerId}
          onCancel={() => onApplyDone?.(null)}
          onEditCheck={() => onOpenCheck?.(applyFrom.check, applyFrom.lead)}
          onCreated={(row) => {
            setApplications((p) => [row, ...p]);
            if (row.lead_id) onLeadSync?.(row.lead_id, leadPatchFor(row));
            onApplyDone?.(row);
          }}
        />
      ) : (
        <>
          {/* Step one, always: the loan check. Walk-in buyers start here; a
              lead's check also opens from its card in Leads. */}
          <div style={{ ...cardSx, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <p style={{ margin: 0, flex: "1 1 220px", fontSize: T.size.base, color: C.textSec, lineHeight: 1.5 }}>{lc.newCheckHint}</p>
              <button data-tour-id="loan-new" onClick={() => onNewCheck?.()} style={{
                display: "flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 16px", borderRadius: R.pill,
                background: C.accent, border: "none", color: C.onAccent, fontSize: T.size.base, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit",
              }}>
                <Plus size={14} />{lc.newCheck}
              </button>
            </div>
            {checks.slice(0, 5).map((ck) => {
              const lead = ck.lead_id ? leads.find((l) => l.id === ck.lead_id) : null;
              return (
                <button key={ck.id} onClick={() => onOpenCheck?.(ck, lead)} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: R.md,
                  background: C.fill, border: "none", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.size.base, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[ck.buyer_name || lc.walkIn, ck.answers?.car_name].filter(Boolean).join(" · ")}
                  </span>
                  <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: OUTCOME_HUE[ck.outcome] || C.textSec, flexShrink: 0 }}>
                    {ck.outcome === "fix" ? lc.pill.fix : lc.pill[ck.outcome]}
                  </span>
                  <ChevronRight size={14} color={C.textMuted} style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>

          <p data-tour-id="loan-list" style={{ margin: "6px 0 10px", fontSize: T.size.xs, fontWeight: T.weight.semibold, letterSpacing: T.track.label, textTransform: "uppercase", color: C.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
            Applications{applications.length > 0 ? ` · ${applications.length}` : ""}
            {open > 0 && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: T.weight.normal, color: C.textSec }}>· {open} waiting on a bank</span>}
          </p>
          {applications.length === 0 ? (
            <p style={{ ...cardSx, margin: 0, fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.6 }}>
              No applications yet. Open a loan check and tap &ldquo;{lc.apply}&rdquo; when the file is ready.
            </p>
          ) : applications.map((a) => (
            <ApplicationCard key={a.id} app={a} onLeadSync={onLeadSync}
              onChange={(next) => setApplications((p) => p.map((x) => (x.id === next.id ? next : x)))} />
          ))}
        </>
      )}
    </div>
  );
}
