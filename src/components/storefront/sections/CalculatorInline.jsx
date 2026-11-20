// Loan calculator, version B "Inline" (STOREFRONT-2 stage 4): the calculator on the page
// itself, so a buyer gets a monthly figure without leaving. Price, deposit, years and the rate
// as an EIR (reducing balance). The maths is financing.js ONLY (monthlyPayment, DEFAULT_EIR,
// MAX_TENURE_YEARS): no flat rate here (HP-EIR, the law changed on 1 June 2026). The price
// starts at the dealer's newest car's price (a fact from the row), else empty. Fine print:
// an estimate, the bank decides. Never worded as an approval.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, ArrowRight } from "lucide-react";
import { monthlyPayment, DEFAULT_EIR, MAX_TENURE_YEARS } from "../../../utils/financing";
import { FadeIn } from "./ui";
import { wrap, secB, accentOf } from "./shared";
import { rm } from "./heroParts";

const YEARS = [5, 7, MAX_TENURE_YEARS];
const DEPOSITS = [0, 10, 20, 30];
const num = (v) => {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export default function CalculatorInline({ tenant, featured }) {
  const first = (featured || []).find((c) => Number(c.selling_price) > 0);
  // null = not typed yet: follow the newest car's price (the cars may arrive after this mounts).
  const [typed, setTyped] = useState(null);
  const price = typed ?? (first ? String(Math.round(first.selling_price)) : "");
  const [deposit, setDeposit] = useState(10);
  const [years, setYears] = useState(7);
  const [rate, setRate] = useState(String(DEFAULT_EIR));

  const p = num(price);
  const r = Math.min(num(rate), 30);
  const loan = Math.max(0, p * (1 - deposit / 100));
  const monthly = p > 0 ? monthlyPayment(loan, r, years * 12) : 0;

  return (
    <section className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .cin { display: grid; gap: 28px; }
        @media (min-width: 900px) { .cin { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: start; } }
        .cin-card { background: var(--sf-card, #111113); border: 1px solid var(--sf-border, rgba(255,255,255,0.07)); border-radius: 12px; padding: 24px; }
        .cin-grid { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 600px) { .cin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .cin-l { display: block; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: var(--sf-muted, rgba(255,255,255,0.62)); margin: 0 0 8px; }
        .cin-in { width: 100%; box-sizing: border-box; height: 46px; border-radius: 8px; padding: 0 14px; font-size: 16px; font-family: inherit;
          background: var(--sf-bg, #0C0C0E); color: var(--sf-text, #F0F0F0); border: 1px solid var(--sf-border, rgba(255,255,255,0.12)); font-variant-numeric: tabular-nums; }
        .cin-in:focus { outline: 2px solid var(--sf-accent); outline-offset: 1px; }
        .cin-seg { display: flex; gap: 6px; flex-wrap: wrap; }
        .cin-seg button { flex: 1; min-width: 52px; height: 46px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
          background: var(--sf-bg, #0C0C0E); color: var(--sf-text, #F0F0F0); border: 1px solid var(--sf-border, rgba(255,255,255,0.12)); }
        .cin-seg button[aria-pressed="true"] { background: var(--sf-accent); border-color: var(--sf-accent); color: var(--sf-on-accent, #fff); }
        .cin-out { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--sf-border, rgba(255,255,255,0.08));
          display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 24px; }
        .cin-big { font-size: clamp(2rem, 6vw, 2.6rem); font-weight: 800; letter-spacing: -0.02em; color: var(--sf-text, #F0F0F0); font-variant-numeric: tabular-nums; line-height: 1; }
        .cin-big small { font-size: 15px; font-weight: 600; color: var(--sf-muted, rgba(255,255,255,0.62)); margin-left: 4px; }
        .cin-loan { font-size: 13px; color: var(--sf-muted, rgba(255,255,255,0.62)); font-variant-numeric: tabular-nums; }
        .cin-fine { margin: 14px 0 0; font-size: 12px; line-height: 1.6; color: var(--sf-muted, rgba(255,255,255,0.55)); }
        .cin-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; font-size: 14px; font-weight: 600; color: var(--sf-accent-text, #F87171); text-decoration: none; }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="cin">
            <div>
              <p className="sfv-eyebrow">Loan estimate</p>
              <h2 className="sec-title">Work out your monthly</h2>
              <p className="sfv-d" style={{ marginTop: 12 }}>
                Type a car price, pick a deposit and how many years. The figure updates as you type.
              </p>
              <Link to="/calculator" className="cin-link">
                <Calculator size={15} /> Full calculator with repayment table <ArrowRight size={14} />
              </Link>
            </div>
            <div className="cin-card">
              <div className="cin-grid">
                <label>
                  <span className="cin-l">Car price (RM)</span>
                  <input className="cin-in" inputMode="numeric" value={price} placeholder="e.g. 80000"
                    onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, "").slice(0, 8))} />
                </label>
                <label>
                  <span className="cin-l">Interest rate (% EIR a year)</span>
                  <input className="cin-in" inputMode="decimal" value={rate}
                    onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} />
                </label>
                <div>
                  <span className="cin-l">Deposit</span>
                  <div className="cin-seg" role="group" aria-label="Deposit">
                    {DEPOSITS.map((d) => (
                      <button key={d} type="button" aria-pressed={deposit === d} onClick={() => setDeposit(d)}>{d === 0 ? "None" : `${d}%`}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="cin-l">Years</span>
                  <div className="cin-seg" role="group" aria-label="Years">
                    {YEARS.map((y) => (
                      <button key={y} type="button" aria-pressed={years === y} onClick={() => setYears(y)}>{y}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="cin-out" aria-live="polite">
                <div>
                  <span className="cin-l">Estimated monthly</span>
                  <div className="cin-big">{monthly > 0 ? rm(monthly) : "RM -"}<small>/month</small></div>
                </div>
                {p > 0 && <div className="cin-loan">Loan {rm(loan)} over {years * 12} months at {r}% EIR</div>}
              </div>
              <p className="cin-fine">
                An estimate only, on the reducing balance (EIR). Insurance, fees and any rebate are not included.
                The bank decides the rate, the amount and whether to approve the loan.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
