import React, { useState, useMemo } from "react";
import {
  Banknote, Check, ChevronRight, Plus, Search, Copy, AlertCircle,
  TrendingDown, User, X, Loader2, Share2,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";

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

// Indicative promo rates. Flat p.a., which is how Malaysian hire purchase is
// quoted. They move, so the rate stays editable per attempt rather than being
// treated as a quote.
export const BANKS = [
  { name: "Public Bank",      rate: 3.20, islamic: false },
  { name: "CIMB Bank",        rate: 3.25, islamic: false },
  { name: "Maybank",          rate: 3.30, islamic: false },
  { name: "RHB Bank",         rate: 3.50, islamic: false },
  { name: "Hong Leong Bank",  rate: 3.50, islamic: false },
  { name: "Affin Bank",       rate: 3.50, islamic: false },
  { name: "Bank Muamalat",    rate: 3.60, islamic: true  },
  { name: "Bank Islam",       rate: 3.60, islamic: true  },
];

// How the buyer earns decides which documents the bank asks for. Getting this
// wrong is why a buyer gets sent home and comes back a week later.
const EMPLOYMENT = [
  { key: "Salaried",      label: "Salaried",      hint: "Fixed monthly pay, EPF deducted" },
  { key: "Self-employed", label: "Self-employed", hint: "Own business, freelance, has SSM" },
  { key: "Commission",    label: "Commission",    hint: "Agent or sales, income varies" },
];

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

// Malaysian hire purchase is quoted FLAT: interest = principal x rate x years,
// spread evenly over every instalment. Not a reducing-balance amortisation.
export const flatMonthly = (principal, ratePct, years) => {
  if (!(principal > 0) || !(years > 0)) return 0;
  return (principal + principal * (ratePct / 100) * years) / (years * 12);
};

// Years needed to bring `principal` down to a target instalment, same flat
// formula rearranged. Returns null when no tenure can reach it (the interest
// alone already exceeds the target).
const tenureForMonthly = (principal, ratePct, monthly) => {
  const r = ratePct / 100;
  const denom = 12 * monthly - principal * r;
  if (denom <= 0) return null;
  return principal / denom;
};

// Principal that lands exactly on a target instalment at a given tenure — the
// difference against the current loan is the extra down payment needed.
const principalForMonthly = (monthly, ratePct, years) => {
  const r = ratePct / 100;
  if (!(years > 0)) return 0;
  return (monthly * 12 * years) / (1 + r * years);
};

// Debt service ratio: the share of net monthly income already committed to
// debt once this car is added. Banks each set their own ceiling and lower
// incomes are treated more strictly — these are the commonly used bands, shown
// as a guide only.
const dsrCeiling = (income) => (income < 3000 ? 60 : income <= 5000 ? 65 : 70);

const MAX_TENURE = 9; // Hire Purchase Act caps consumer vehicle loans at 9 years

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

function SectionHead({ n, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
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

/* ── DSR meter — the one screen that answers "can they afford this?" ─────── */

function DsrMeter({ income, commitments, monthly, loan, rate, tenure, onApplySuggestion }) {
  if (!(income > 0)) {
    return (
      <p style={{ margin: 0, fontSize: T.size.base, color: C.textMuted, lineHeight: 1.6 }}>
        Enter the buyer&apos;s net monthly income to see their debt service ratio — the
        affordability sum the bank itself runs.
      </p>
    );
  }
  const ceiling = dsrCeiling(income);
  const dsr = ((commitments + monthly) / income) * 100;
  const over = dsr > ceiling;
  const tone = dsr <= ceiling - 10 ? C.success : over ? C.danger : C.warn;
  const toneText = dsr <= ceiling - 10 ? C.successText : over ? C.dangerText : C.warnText;
  const verdict = dsr <= ceiling - 10 ? "Comfortable" : over ? "Over the usual ceiling" : "Tight but within the usual ceiling";

  // What it would take to get under the ceiling. Both are the same flat formula
  // rearranged, on figures the salesman entered — no estimate, no prediction.
  const headroom = income * (ceiling / 100) - commitments;
  const needTenure = over && headroom > 0 ? tenureForMonthly(loan, rate, headroom) : null;
  const tenureFix = needTenure && needTenure <= MAX_TENURE ? Math.ceil(needTenure) : null;
  const dpFix = over && headroom > 0
    ? Math.max(0, loan - principalForMonthly(headroom, rate, tenure))
    : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: T.size.hero, lineHeight: 1, color: toneText }}>
          {dsr.toFixed(0)}%
        </span>
        <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color: toneText }}>{verdict}</span>
        <span style={{ marginLeft: "auto", fontSize: T.size.sm, color: C.textMuted, whiteSpace: "nowrap" }}>
          guide ceiling {ceiling}%
        </span>
      </div>

      {/* Bar with the ceiling marked, so "how far over" is readable at a glance */}
      <div style={{ position: "relative", height: 8, borderRadius: R.pill, background: C.fillStrong, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, dsr)}%`, background: tone, borderRadius: R.pill, transition: "width .25s" }} />
      </div>
      <div style={{ position: "relative", height: 12, marginBottom: 10 }}>
        <span style={{ position: "absolute", left: `${Math.min(100, ceiling)}%`, transform: "translateX(-50%)", fontSize: T.size.xs, color: C.textDim, whiteSpace: "nowrap" }}>
          ▲ {ceiling}%
        </span>
      </div>

      <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textSec, lineHeight: 1.6 }}>
        {rm(commitments)} existing commitments + {rm(monthly)} this car, against {rm(income)} net income.
      </p>

      {over && (
        <div style={{ padding: "11px 12px", borderRadius: R.md, background: withAlpha(C.danger, 0.07), border: `1px solid ${withAlpha(C.danger, 0.2)}` }}>
          <p style={{ margin: "0 0 8px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.dangerText, display: "flex", alignItems: "center", gap: 7 }}>
            <TrendingDown size={14} style={{ flexShrink: 0 }} /> What brings it under {ceiling}%
          </p>
          {headroom <= 0 ? (
            <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec, lineHeight: 1.6 }}>
              Their existing commitments alone already use the whole ceiling. No tenure or
              down payment on this car changes that — a guarantor or settling another loan first.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {tenureFix && tenureFix > tenure && (
                <button
                  onClick={() => onApplySuggestion?.({ tenure: tenureFix })}
                  style={{ ...suggestionSx, cursor: "pointer" }}
                >
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    Stretch to <strong style={{ color: C.text }}>{tenureFix} years</strong> — instalment drops to about {rm(flatMonthly(loan, rate, tenureFix))}
                  </span>
                  <ChevronRight size={13} style={{ flexShrink: 0, color: C.textDim }} />
                </button>
              )}
              {dpFix > 0 && (
                <button
                  onClick={() => onApplySuggestion?.({ extraDp: Math.ceil(dpFix / 100) * 100 })}
                  style={{ ...suggestionSx, cursor: "pointer" }}
                >
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    Or <strong style={{ color: C.text }}>{rm(Math.ceil(dpFix / 100) * 100)}</strong> more down payment at {tenure} years
                  </span>
                  <ChevronRight size={13} style={{ flexShrink: 0, color: C.textDim }} />
                </button>
              )}
              {!tenureFix && !(dpFix > 0) && (
                <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec, lineHeight: 1.6 }}>
                  Not reachable by stretching tenure or adding a deposit on this car.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p style={{ margin: "10px 0 0", fontSize: T.size.sm, color: C.textDim, lineHeight: 1.6 }}>
        A guide, not a decision. Every bank sets its own ceiling and reads CCRIS itself —
        this is the same sum they run, on the numbers you entered.
      </p>
    </div>
  );
}

const suggestionSx = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "8px 10px", borderRadius: R.sm, background: C.fill,
  border: `1px solid ${C.border}`, color: C.textSec,
  fontSize: T.size.sm, fontFamily: "inherit", lineHeight: 1.5,
};

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
        background: docs[k] ? withAlpha(C.success, 0.06) : "transparent",
        border: `1px solid ${docs[k] ? withAlpha(C.success, 0.18) : C.border}`,
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: docs[k] ? C.success : "transparent",
        border: `1px solid ${docs[k] ? C.success : C.borderStrong}`,
      }}>
        {docs[k] && <Check size={12} color="#fff" strokeWidth={3} />}
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

/* ── New application — one flow ──────────────────────────────────────────── */

const emptyDraft = {
  lead_id: null, listing_id: null,
  buyer_name: "", buyer_phone: "", buyer_ic: "", buyer_employment_type: "Salaried",
  car_model: "", car_price: "", down_payment: "", loan_tenure: 7,
  buyer_income: "", existing_commitments: "", notes: "",
};

function NewApplication({ userId, dealerId, leads, onCreated }) {
  const [d, setD] = useState(emptyDraft);
  const [docs, setDocs] = useState({});
  const [picked, setPicked] = useState([]);      // bank names chosen as attempts
  const [saving, setSaving] = useState(false);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");

  const set = (k) => (v) => setD((p) => ({ ...p, [k]: v }));
  const num = (v) => parseFloat(v) || 0;

  const price   = num(d.car_price);
  const dp      = num(d.down_payment);
  const tenure  = parseInt(d.loan_tenure) || 7;
  const loan    = Math.max(0, price - dp);
  const income  = num(d.buyer_income);
  const commits = num(d.existing_commitments);
  const dpPct   = price > 0 ? (dp / price) * 100 : 0;

  const rows = useMemo(
    () => BANKS.map((b) => ({ ...b, monthly: flatMonthly(loan, b.rate, tenure) }))
               .sort((a, b) => a.monthly - b.monthly),
    [loan, tenure],
  );
  const bestMonthly = rows.length ? rows[0].monthly : 0;
  // DSR is shown against the cheapest instalment on the table — the best case.
  // If the best case is already over the ceiling, none of them clear it.
  const dsrBank = rows.find((r) => picked.includes(r.name)) || rows[0];

  const pickLead = (lead) => {
    const car = lead.car_listings;
    setD((p) => ({
      ...p,
      lead_id: lead.id,
      listing_id: lead.car_listing_id || null,
      buyer_name: lead.buyer_name || "",
      buyer_phone: lead.phone || "",
      buyer_ic: lead.buyer_ic || "",
      car_model: car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : p.car_model,
      car_price: car?.selling_price ? String(car.selling_price) : p.car_price,
    }));
    setLeadPickerOpen(false);
    setLeadQuery("");
    toast.success("Buyer and car filled in from the lead");
  };

  const applySuggestion = ({ tenure: t, extraDp }) => {
    if (t) { set("loan_tenure")(t); toast.success(`Tenure set to ${t} years`); }
    if (extraDp) { set("down_payment")(String(Math.round(dp + extraDp))); toast.success("Down payment raised"); }
  };

  const togglePick = (name) =>
    setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  const canSubmit = d.buyer_name.trim() && loan > 0 && picked.length > 0;

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    // One row per BUYER CASE; each chosen bank is an attempt inside it, so a
    // decline can be followed by the next bank without retyping the buyer.
    const attempts = picked.map((name) => {
      const b = BANKS.find((x) => x.name === name);
      return {
        name, rate: b?.rate ?? null, tenure, loan_amount: loan,
        monthly: Number(flatMonthly(loan, b?.rate ?? 0, tenure).toFixed(2)),
        status: "Submitted", reason: null, decided_at: null,
      };
    });
    const docCols = Object.fromEntries(Object.entries(DOCS).map(([k, v]) => [v.col, !!docs[k]]));

    const { data, error } = await supabase.from("loan_applications").insert({
      salesman_id: userId,
      dealer_id: dealerId || null,
      lead_id: d.lead_id, listing_id: d.listing_id,
      buyer_name: d.buyer_name.trim() || null,
      buyer_phone: d.buyer_phone || null,
      buyer_ic: d.buyer_ic || null,
      buyer_employment_type: d.buyer_employment_type,
      car_model: d.car_model || null,
      car_price: price || null,
      loan_amount: loan,
      down_payment: dp || null,
      loan_tenure: tenure,
      buyer_income: income || null,
      existing_commitments: commits || null,
      banks: attempts,
      status: "Submitted",
      notes: d.notes || null,
      ...docCols,
    }).select("*").single();

    setSaving(false);
    if (error) { console.error("submitLoan:", error); toast.error("Could not save the application"); return; }
    toast.success(`Application saved — ${attempts.length} bank${attempts.length > 1 ? "s" : ""}`);
    setD(emptyDraft); setDocs({}); setPicked([]);
    onCreated(data);
  };

  const openLeads = leads.filter((l) => !["lost", "closed_lost"].includes(l.stage));
  const shownLeads = leadQuery
    ? openLeads.filter((l) => `${l.buyer_name || ""} ${l.phone || ""}`.toLowerCase().includes(leadQuery.toLowerCase()))
    : openLeads;

  return (
    <div>
      {/* 1 — buyer */}
      <div style={cardSx}>
        <SectionHead n="1" title="Who is buying" sub="Pull it from a lead you already have, or type it in." />

        {!d.lead_id ? (
          <button onClick={() => setLeadPickerOpen((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 12,
            padding: "10px 12px", borderRadius: R.md, cursor: "pointer", fontFamily: "inherit",
            background: withAlpha(C.info, 0.07), border: `1px solid ${withAlpha(C.info, 0.22)}`,
            color: C.infoText, fontSize: T.size.base, fontWeight: T.weight.semibold,
          }}>
            <User size={14} /> Start from a lead
            <ChevronRight size={14} style={{ marginLeft: "auto", transform: leadPickerOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          </button>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 11px",
            borderRadius: R.md, background: withAlpha(C.success, 0.07), border: `1px solid ${withAlpha(C.success, 0.2)}`,
          }}>
            <Check size={13} color={C.successText} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: T.size.sm, color: C.textSec }}>Linked to a lead — it will show on that lead too.</span>
            <button onClick={() => setD((p) => ({ ...p, lead_id: null, listing_id: null }))}
              style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {leadPickerOpen && !d.lead_id && (
          <div style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${C.line}` }}>
              <Search size={13} color={C.textDim} style={{ flexShrink: 0 }} />
              <input autoFocus value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search your leads…"
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: T.size.base, fontFamily: "inherit" }} />
            </div>
            <div style={{ maxHeight: 210, overflowY: "auto" }}>
              {shownLeads.length === 0 ? (
                <p style={{ margin: 0, padding: "16px 12px", fontSize: T.size.sm, color: C.textDim, textAlign: "center" }}>No matching leads.</p>
              ) : shownLeads.map((l) => (
                <button key={l.id} onClick={() => pickLead(l)} style={{
                  display: "block", width: "100%", textAlign: "left", padding: "9px 11px", cursor: "pointer",
                  background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`, fontFamily: "inherit",
                }}>
                  <span style={{ display: "block", fontSize: T.size.base, color: C.text, fontWeight: T.weight.medium }}>{l.buyer_name || "Unnamed lead"}</span>
                  <span style={{ display: "block", fontSize: T.size.sm, color: C.textMuted, marginTop: 1 }}>
                    {[l.phone, l.car_listings ? [l.car_listings.year, l.car_listings.brand, l.car_listings.model].filter(Boolean).join(" ") : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="Buyer name">
            <input style={inputSx} value={d.buyer_name} onChange={(e) => set("buyer_name")(e.target.value)} placeholder="Ahmad bin Ali" />
          </Field>
          <Field label="Phone">
            <div style={{ ...inputSx, display: "flex", alignItems: "center", padding: 0, overflow: "hidden" }}>
              <span style={{ padding: "9px 10px", color: C.textMuted, background: C.fillSubtle, borderRight: `1px solid ${C.borderStrong}`, fontSize: T.size.base, flexShrink: 0 }}>+60</span>
              <input type="tel" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: T.size.base, padding: "9px 10px", fontFamily: "inherit" }}
                value={(d.buyer_phone || "").replace(/^\+?60/, "")}
                onChange={(e) => set("buyer_phone")("+60" + e.target.value.replace(/\D/g, ""))} placeholder="123456789" />
            </div>
          </Field>
          <Field label="IC number">
            <input style={inputSx} value={d.buyer_ic} onChange={(e) => set("buyer_ic")(e.target.value)} placeholder="901231-10-1234" />
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelSx}>How they earn — this decides the document list</label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {EMPLOYMENT.map((e) => {
              const on = d.buyer_employment_type === e.key;
              return (
                <button key={e.key} onClick={() => set("buyer_employment_type")(e.key)} title={e.hint} style={{
                  padding: "7px 13px", borderRadius: R.pill, cursor: "pointer", fontFamily: "inherit",
                  fontSize: T.size.base, fontWeight: T.weight.semibold,
                  background: on ? withAlpha(C.info, 0.14) : C.fill,
                  border: `1px solid ${on ? withAlpha(C.info, 0.35) : C.border}`,
                  color: on ? C.infoText : C.textSec,
                }}>{e.label}</button>
              );
            })}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: T.size.sm, color: C.textDim }}>
            {EMPLOYMENT.find((e) => e.key === d.buyer_employment_type)?.hint}
          </p>
        </div>
      </div>

      {/* 2 — the car and the money */}
      <div style={cardSx}>
        <SectionHead n="2" title="The car and the money" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="Car">
            <input style={inputSx} value={d.car_model} onChange={(e) => set("car_model")(e.target.value)} placeholder="Toyota Vios 2020" />
          </Field>
          <Field label="Car price (RM)">
            <input type="number" inputMode="numeric" style={inputSx} value={d.car_price} onChange={(e) => set("car_price")(e.target.value)} placeholder="85000" />
          </Field>
          <Field label={`Down payment (RM)${price > 0 ? ` · ${dpPct.toFixed(0)}%` : ""}`}>
            <input type="number" inputMode="numeric" style={inputSx} value={d.down_payment} onChange={(e) => set("down_payment")(e.target.value)} placeholder="10000" />
          </Field>
        </div>

        {price > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {[10, 15, 20, 30].map((pct) => (
              <button key={pct} onClick={() => set("down_payment")(String(Math.round((price * pct) / 100)))} style={{
                padding: "4px 10px", borderRadius: R.pill, cursor: "pointer", fontFamily: "inherit", fontSize: T.size.sm,
                background: C.fill, border: `1px solid ${C.border}`, color: C.textSec,
              }}>{pct}%</button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={labelSx}>Tenure</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[5, 7, 9].map((y) => {
              const on = tenure === y;
              return (
                <button key={y} onClick={() => set("loan_tenure")(y)} style={{
                  padding: "7px 14px", borderRadius: R.pill, cursor: "pointer", fontFamily: "inherit",
                  fontSize: T.size.base, fontWeight: T.weight.semibold,
                  background: on ? withAlpha(C.info, 0.14) : C.fill,
                  border: `1px solid ${on ? withAlpha(C.info, 0.35) : C.border}`,
                  color: on ? C.infoText : C.textSec,
                }}>{y} yrs</button>
              );
            })}
            <select value={tenure} onChange={(e) => set("loan_tenure")(parseInt(e.target.value))}
              style={{ ...inputSx, width: "auto", minWidth: 92, padding: "7px 10px" }}>
              {Array.from({ length: MAX_TENURE }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{y} yrs</option>)}
            </select>
          </div>
        </div>

        {loan > 0 && (
          <p style={{ margin: "14px 0 0", fontSize: T.size.base, color: C.textSec }}>
            Financing <strong style={{ color: C.text }}>{rm(loan)}</strong> over {tenure} years.
          </p>
        )}
      </div>

      {/* 3 — affordability */}
      <div style={cardSx}>
        <SectionHead n="3" title="Can they afford it?" sub="The debt service ratio decides most applications before a banker ever reads the file." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Field label="Net monthly income (RM)" hint="After EPF and tax — what lands in the bank">
            <input type="number" inputMode="numeric" style={inputSx} value={d.buyer_income} onChange={(e) => set("buyer_income")(e.target.value)} placeholder="5000" />
          </Field>
          <Field label="Existing commitments (RM/mo)" hint="Other car, house, PTPTN, cards">
            <input type="number" inputMode="numeric" style={inputSx} value={d.existing_commitments} onChange={(e) => set("existing_commitments")(e.target.value)} placeholder="800" />
          </Field>
        </div>
        <DsrMeter
          income={income} commitments={commits}
          monthly={dsrBank ? dsrBank.monthly : 0}
          loan={loan} rate={dsrBank ? dsrBank.rate : 0} tenure={tenure}
          onApplySuggestion={applySuggestion}
        />
      </div>

      {/* 4 — banks */}
      <div style={cardSx}>
        <SectionHead n="4" title="Which banks to try" sub="Pick more than one — if the first says no, the second is already on the file." />
        {loan <= 0 ? (
          <p style={{ margin: 0, fontSize: T.size.base, color: C.textMuted }}>Enter a car price to compare instalments.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {rows.map((b, i) => {
              const on = picked.includes(b.name);
              const isBest = i === 0;
              return (
                <button key={b.name} onClick={() => togglePick(b.name)} style={{
                  display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
                  padding: "11px 12px", borderRadius: R.md, cursor: "pointer", fontFamily: "inherit",
                  background: on ? withAlpha(C.info, 0.09) : C.fillSubtle,
                  border: `1px solid ${on ? withAlpha(C.info, 0.32) : C.border}`,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: on ? C.info : "transparent",
                    border: `1px solid ${on ? C.info : C.borderStrong}`,
                  }}>
                    {on && <Check size={12} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{b.name}</span>
                      {isBest && (
                        <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "1px 6px", borderRadius: R.pill, background: withAlpha(C.success, 0.14), border: `1px solid ${withAlpha(C.success, 0.3)}`, color: C.successText }}>Lowest</span>
                      )}
                      {b.islamic && (
                        <span style={{ fontSize: T.size.xs, padding: "1px 6px", borderRadius: R.pill, background: C.fillStrong, color: C.textMuted }}>Islamic</span>
                      )}
                    </span>
                    <span style={{ display: "block", fontSize: T.size.sm, color: C.textMuted, marginTop: 2 }}>
                      {b.rate.toFixed(2)}% flat · total interest {rm(b.monthly * tenure * 12 - loan)}
                    </span>
                  </span>
                  <span style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontFamily: "'Bebas Neue',sans-serif", fontSize: T.size.xl, lineHeight: 1, color: C.text }}>{rm(b.monthly)}</span>
                    <span style={{ display: "block", fontSize: T.size.xs, color: C.textDim, marginTop: 2 }}>/month</span>
                  </span>
                </button>
              );
            })}
            <p style={{ margin: "4px 0 0", fontSize: T.size.sm, color: C.textDim, lineHeight: 1.6 }}>
              Indicative promo rates, quoted flat. Confirm the rate with the banker before you
              tell a buyer anything — they move, and the buyer&apos;s profile changes them.
            </p>
          </div>
        )}
      </div>

      {/* 5 — documents */}
      <div style={cardSx}>
        <SectionHead n="5" title="Documents to collect" sub={`For a ${(EMPLOYMENT.find((e) => e.key === d.buyer_employment_type)?.label || "").toLowerCase()} buyer.`} />
        <DocChecklist
          employment={d.buyer_employment_type}
          docs={docs}
          buyerName={d.buyer_name.split(" ")[0]}
          onToggle={(k) => setDocs((p) => ({ ...p, [k]: !p[k] }))}
        />
      </div>

      {/* notes + submit */}
      <div style={cardSx}>
        <Field label="Notes (optional)">
          <textarea rows={2} style={{ ...inputSx, resize: "vertical" }} value={d.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Anything the banker should know" />
        </Field>
        <button onClick={submit} disabled={!canSubmit || saving} style={{
          marginTop: 14, width: "100%", padding: "13px", borderRadius: R.md, border: "none",
          background: canSubmit && !saving ? C.accent : C.fillStrong,
          color: canSubmit && !saving ? C.onAccent : C.textDim,
          fontSize: T.size.lg, fontWeight: T.weight.bold, fontFamily: "inherit",
          cursor: canSubmit && !saving ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {saving ? <><Loader2 size={15} style={{ animation: "ldspin 1s linear infinite" }} /> Saving…</>
                  : `Save application${picked.length ? ` · ${picked.length} bank${picked.length > 1 ? "s" : ""}` : ""}`}
        </button>
        {!canSubmit && (
          <p style={{ margin: "8px 0 0", fontSize: T.size.sm, color: C.textDim, textAlign: "center" }}>
            {!d.buyer_name.trim() ? "Add the buyer's name" : loan <= 0 ? "Add the car price" : "Pick at least one bank"} to save.
          </p>
        )}
        <style>{`@keyframes ldspin{to{transform:rotate(360deg)}}`}</style>
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
      name, rate: b?.rate ?? null, tenure, loan_amount: loan,
      monthly: Number(flatMonthly(loan, b?.rate ?? 0, tenure).toFixed(2)),
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
    const msg = `Hi${first ? ` ${first}` : ""}, here's the list of documents for your car loan — it updates as I receive each one:\n${url}`;
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
                    {a.rate != null ? `${Number(a.rate).toFixed(2)}%` : "—"}{a.monthly ? ` · ${rm2(a.monthly)}/mo` : ""}
                  </span>
                </div>
                {a.reason && <p style={{ margin: "6px 0 0", fontSize: T.size.sm, color: C.textSec, lineHeight: 1.5 }}>{a.reason}</p>}
                {decide?.idx === i ? (
                  <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["Pending", "Approved", "Declined"].map((s) => (
                        <button key={s} onClick={() => setDecide((p) => ({ ...p, status: s }))} style={{
                          padding: "5px 11px", borderRadius: R.pill, cursor: "pointer", fontFamily: "inherit", fontSize: T.size.sm, fontWeight: T.weight.semibold,
                          background: decide.status === s ? withAlpha(STATUS[s].fill, 0.16) : C.fill,
                          border: `1px solid ${decide.status === s ? withAlpha(STATUS[s].fill, 0.35) : C.border}`,
                          color: decide.status === s ? STATUS[s].text : C.textSec,
                        }}>{s}</button>
                      ))}
                    </div>
                    <input value={decide.reason} onChange={(e) => setDecide((p) => ({ ...p, reason: e.target.value }))}
                      placeholder={decide.status === "Declined" ? "Why? e.g. CTOS record, DSR too high" : "Any condition? e.g. needs 20% down"}
                      style={{ ...inputSx, fontSize: T.size.sm }} />
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
                    {b.rate.toFixed(2)}% · {rm(flatMonthly(Number(app.loan_amount) || 0, b.rate, app.loan_tenure || 7))}/mo
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
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, fontWeight: T.weight.semibold }}>Documents</p>
            {/* The buyer gets the same list on their phone, ticking off as each
                one arrives — beats them turning up with two of seven papers. */}
            <button onClick={shareWithBuyer} disabled={sharing} style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              padding: "5px 10px", borderRadius: R.sm, fontFamily: "inherit", fontSize: T.size.sm,
              cursor: sharing ? "wait" : "pointer",
              background: withAlpha(C.info, 0.1), border: `1px solid ${withAlpha(C.info, 0.28)}`, color: C.infoText,
            }}>
              {sharing ? <Loader2 size={12} style={{ animation: "ldspin 1s linear infinite" }} /> : <Share2 size={12} />}
              Send list to buyer
            </button>
          </div>
          <DocChecklist
            employment={app.buyer_employment_type}
            docs={Object.fromEntries(Object.entries(DOCS).map(([k, v]) => [k, !!app[v.col]]))}
            buyerName={(app.buyer_name || "").split(" ")[0]}
            onToggle={(k) => patch({ [DOCS[k].col]: !app[DOCS[k].col] })}
          />

          {app.notes && (
            <p style={{ margin: "14px 0 0", fontSize: T.size.sm, color: C.textSec, lineHeight: 1.6 }}>{app.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

export default function LoanDesk({ userId, dealerId, leads = [], applications = [], setApplications, onLeadSync }) {
  const [view, setView] = useState("new");

  const open = applications.filter((a) => !["Approved", "Declined"].includes(a.status || rollUp(a.banks))).length;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Defined once here, not inside a view: the share button's spinner lives
          in ApplicationCard, which renders while NewApplication is unmounted. */}
      <style>{`@keyframes ldspin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ margin: "0 0 4px", fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text }}>Loans</p>
      <p style={{ margin: "0 0 16px", fontSize: T.size.base, color: C.textMuted, lineHeight: 1.6 }}>
        Work out what the buyer can carry, pick the banks worth trying, and keep every
        application in one place.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { key: "new",  label: "New application" },
          { key: "list", label: "Applications", badge: applications.length },
        ].map(({ key, label, badge }) => (
          <button key={key} onClick={() => setView(key)} style={{
            fontSize: T.size.base, fontWeight: T.weight.semibold, padding: "7px 15px", borderRadius: R.md,
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
            background: view === key ? withAlpha(C.info, 0.15) : C.fill,
            border: `1px solid ${view === key ? withAlpha(C.info, 0.35) : C.border}`,
            color: view === key ? C.infoTextHi : C.textMuted,
          }}>
            {label}
            {badge > 0 && (
              <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, background: C.info, color: "#fff", borderRadius: R.pill, padding: "0 5px", minWidth: 16, textAlign: "center" }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {view === "new" ? (
        <NewApplication
          userId={userId} dealerId={dealerId} leads={leads}
          onCreated={(row) => {
            setApplications((p) => [row, ...p]);
            if (row.lead_id) onLeadSync?.(row.lead_id, leadPatchFor(row));
            setView("list");
          }}
        />
      ) : applications.length === 0 ? (
        <div style={{ ...cardSx, textAlign: "center", padding: "36px 20px" }}>
          <Banknote size={22} color={C.textDim} />
          <p style={{ margin: "10px 0 4px", fontSize: T.size.base, color: C.textSec }}>No applications yet.</p>
          <p style={{ margin: "0 0 14px", fontSize: T.size.sm, color: C.textDim }}>Start one and it stays here until the bank decides.</p>
          <button onClick={() => setView("new")} style={{
            padding: "9px 18px", borderRadius: R.md, background: C.accent, border: "none",
            color: C.onAccent, fontSize: T.size.base, fontWeight: T.weight.bold, cursor: "pointer", fontFamily: "inherit",
          }}>New application</button>
        </div>
      ) : (
        <div>
          {open > 0 && (
            <p style={{ margin: "0 0 12px", fontSize: T.size.sm, color: C.textMuted, display: "flex", alignItems: "center", gap: 7 }}>
              <AlertCircle size={13} color={C.warnText} style={{ flexShrink: 0 }} />
              {open} still waiting on a bank.
            </p>
          )}
          {applications.map((a) => (
            <ApplicationCard key={a.id} app={a} onLeadSync={onLeadSync}
              onChange={(next) => setApplications((p) => p.map((x) => (x.id === next.id ? next : x)))} />
          ))}
        </div>
      )}
    </div>
  );
}
