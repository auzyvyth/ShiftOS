import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Check, Circle, MessageCircle, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";

/*
 * What the buyer sees when their salesman sends them the loan-document link.
 *
 * The problem it solves is mundane and expensive: the buyer turns up with two
 * of the seven papers because nobody wrote the list down, and the application
 * waits another week. This is that list, on their phone, ticking off as the
 * salesman receives each one.
 *
 * Read-only by design. The buyer cannot tick anything — the salesman ticks it
 * when the document is actually in hand, so the list can't lie. Everything
 * comes from the get_loan_share RPC, which is deliberately narrow: no IC, no
 * income, no private notes, and no per-bank decline reasons, because whoever
 * holds this URL is treated as the buyer.
 *
 * Public marketplace surface, so it follows the dark public theme (DESIGN.md),
 * not the dealer dashboard's light one.
 */

const DOCS = {
  doc_ic_front:          "IC — front",
  doc_ic_back:           "IC — back",
  doc_payslip_1:         "Payslip — latest month",
  doc_payslip_2:         "Payslip — 2 months ago",
  doc_payslip_3:         "Payslip — 3 months ago",
  doc_epf:               "EPF / KWSP statement",
  doc_bank_statement:    "Bank statement — 3 to 6 months",
  doc_employment_letter: "Employment confirmation letter",
  doc_ssm:               "SSM / business registration",
  doc_tax_form:          "Form B + LHDN tax receipt",
  doc_ccris_ctos:        "CCRIS / CTOS check",
};

// Must stay in step with DOC_SETS in components/loans/LoanDesk.jsx — the
// salesman's checklist and the buyer's must never show a different list.
const DOC_SETS = {
  "Salaried":      ["doc_ic_front", "doc_ic_back", "doc_payslip_1", "doc_payslip_2", "doc_payslip_3", "doc_epf", "doc_bank_statement"],
  "Self-employed": ["doc_ic_front", "doc_ic_back", "doc_ssm", "doc_bank_statement", "doc_tax_form"],
  "Commission":    ["doc_ic_front", "doc_ic_back", "doc_payslip_1", "doc_payslip_2", "doc_payslip_3", "doc_bank_statement", "doc_epf"],
};

const rm = (n) => "RM " + Math.round(Number(n) || 0).toLocaleString("en-MY");

export default function LoanSharePage() {
  const { token } = useParams();
  const [row, setRow] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | missing

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_loan_share", { p_token: token });
      if (cancelled) return;
      const r = Array.isArray(data) ? data[0] : data;
      if (error || !r) { console.error("get_loan_share:", error); setState("missing"); return; }
      setRow(r);
      setState("ok");
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (state === "loading") {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "60px 0", color: "rgba(255,255,255,0.5)" }}>
          <Loader2 size={16} style={{ animation: "lsspin 1s linear infinite" }} /> Loading…
        </div>
        <style>{`@keyframes lsspin{to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }

  if (state === "missing") {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#f3f4f6" }}>This link isn&apos;t valid</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            It may have expired or been typed incorrectly. Ask your salesperson to send it again.
          </p>
        </div>
      </Shell>
    );
  }

  const required = DOC_SETS[row.buyer_employment_type] || DOC_SETS.Salaried;
  const done = required.filter((k) => row[k]);
  const outstanding = required.filter((k) => !row[k]);
  const pct = Math.round((done.length / required.length) * 100);
  const firstName = (row.buyer_name || "").split(" ")[0];

  const waDigits = (row.salesman_whatsapp || "").replace(/\D/g, "");
  const waMsg = `Hi${row.salesman_name ? ` ${row.salesman_name}` : ""}, about my car loan documents`;

  return (
    <Shell>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
        Loan application
      </p>
      <h1 style={{ margin: "0 0 6px", fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: "0.01em", color: "#fff", lineHeight: 1.1 }}>
        {firstName ? `${firstName}, here's what we need` : "What we need from you"}
      </h1>
      {row.car_model && (
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          For your {row.car_model}
          {row.loan_amount > 0 ? ` · financing ${rm(row.loan_amount)}` : ""}
          {row.loan_tenure ? ` over ${row.loan_tenure} years` : ""}.
        </p>
      )}

      {/* Progress */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: outstanding.length === 0 ? "#4ade80" : "#f3f4f6" }}>
            {done.length} of {required.length} received
          </span>
          {outstanding.length === 0 && (
            <span style={{ fontSize: 12.5, color: "#4ade80" }}>— everything&apos;s in</span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: outstanding.length === 0 ? "#22c55e" : "#3b82f6", borderRadius: 99, transition: "width .3s" }} />
        </div>
      </div>

      {/* Still needed first — it's the only part that needs action */}
      {outstanding.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
            Still needed
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {outstanding.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <Circle size={17} style={{ color: "rgba(255,255,255,0.28)", flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: "#f3f4f6" }}>{DOCS[k]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
            Received
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {done.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                <Check size={16} style={{ color: "#4ade80", flexShrink: 0 }} strokeWidth={3} />
                <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>{DOCS[k]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Send them */}
      {waDigits.length >= 9 && (
        <a
          href={`https://wa.me/${waDigits.startsWith("6") ? waDigits : "6" + waDigits}?text=${encodeURIComponent(waMsg)}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            padding: "14px", borderRadius: 12, textDecoration: "none",
            background: "#dc2626", color: "#fff", fontSize: 14.5, fontWeight: 700,
          }}
        >
          <MessageCircle size={17} /> Send them to {row.salesman_name?.split(" ")[0] || "your salesperson"}
        </a>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: 20, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <ShieldCheck size={16} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          Send documents only to the person you are already dealing with, and never share your
          banking passwords or TAC numbers with anyone — your salesperson will never ask for them.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080C14", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 18px 60px" }}>
        <p style={{ margin: "0 0 26px", fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "3px", color: "rgba(255,255,255,0.75)" }}>
          XDRIVE
        </p>
        {children}
      </div>
    </div>
  );
}
