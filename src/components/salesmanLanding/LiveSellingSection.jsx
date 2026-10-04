import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { monthlyPayment, DEFAULT_EIR, DEFAULT_LOAN_RATIO } from "../../utils/financing";
import { LIVE_SELLING } from "../../config/salesmanLandingCopy";

// Premium "Live selling" section on /for-salesmen: a static recreation of the
// live presentation's Cars screen (src/components/live/LivePresenter.jsx), the
// same poster layout. Sample car only, but the instalments come from the real
// formula (financing.js) at the default deposit and rate, so the picture never
// shows a number the product would not. The contact box shows a placeholder,
// never a phone number: no real person's details on a marketing page.

const SAMPLE = { n: 3, name: "2021 Honda City", spec: "1.5 V · 38,000 km · Auto", price: 72800 };
const DOWN = Math.round(SAMPLE.price * (1 - DEFAULT_LOAN_RATIO));
const LOAN = SAMPLE.price - DOWN;
const TENURES = [9, 7, 5];
const PICKED = 7;
const fmt = (n) => Math.round(n).toLocaleString("en-MY");

export default function LiveSellingSection({ reveal, fadeUp }) {
  return (
    <motion.section className="sll-section lss" variants={fadeUp} {...reveal}>
      <style>{CSS}</style>
      <div className="sll-wrap lss-grid">
        <div className="lss-copy">
          <p className="sll-kicker">{LIVE_SELLING.kicker}</p>
          <h2 className="sll-h2">{LIVE_SELLING.title}</h2>
          <p className="lss-lead">{LIVE_SELLING.lead}</p>
          <ul className="lss-list">
            {LIVE_SELLING.points.map((p) => (
              <li key={p}><Check size={16} className="sll-tick" /> {p}</li>
            ))}
          </ul>
          <Link to="/salesman-onboarding/premium" className="sll-btn sll-btn-dark">
            Start Premium <ArrowRight size={17} />
          </Link>
        </div>

        <figure className="lss-stage" aria-label="Live presentation screen, sample car">
          <div className="lss-top">
            <span className="lss-live"><i />Live</span>
            <span className="lss-seg"><b>Cars</b><span>Budget</span></span>
          </div>
          <div className="lss-sheet">
            <div className="lss-title">
              <span className="lss-num">#{SAMPLE.n}</span>
              <div style={{ minWidth: 0 }}>
                <p className="lss-name">{SAMPLE.name}</p>
                <p className="lss-spec">{SAMPLE.spec}</p>
              </div>
            </div>
            <div className="lss-pair">
              <div className="lss-photo" aria-hidden="true">
                <svg viewBox="0 0 120 60" width="78%">
                  <path d="M8 42 L14 30 Q18 24 28 22 L44 14 Q52 10 66 10 L84 11 Q94 12 102 22 L110 26 Q114 28 114 34 L114 42 Z" fill="#cfd5db" />
                  <circle cx="32" cy="44" r="8" fill="#6b7280" /><circle cx="94" cy="44" r="8" fill="#6b7280" />
                </svg>
              </div>
              <table className="lss-brk">
                <tbody>
                  <tr><td>Price</td><td>RM {fmt(SAMPLE.price)}</td></tr>
                  <tr><td>Deposit</td><td>RM {fmt(DOWN)}</td></tr>
                  <tr className="lss-loan"><td>Loan</td><td>RM {fmt(LOAN)}</td></tr>
                  <tr><td>Rate</td><td>{DEFAULT_EIR}% EIR</td></tr>
                </tbody>
              </table>
            </div>
            <div className="lss-low">
              <div className="lss-contact"><b>Your name</b><span>Shown on tap</span></div>
              <table className="lss-ten">
                <thead><tr><th>Tenure</th><th>Monthly</th></tr></thead>
                <tbody>
                  {TENURES.map((y) => (
                    <tr key={y} className={y === PICKED ? "lss-def" : undefined}>
                      <td>{y} years</td>
                      <td>RM {fmt(monthlyPayment(LOAN, DEFAULT_EIR, y * 12))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lss-cta">Comment #{SAMPLE.n}, your deposit &amp; tenure</p>
          </div>
          <figcaption className="lss-note">Sample car. {LIVE_SELLING.note}</figcaption>
        </figure>
      </div>
    </motion.section>
  );
}

const CSS = `
  .lss-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 48px; align-items: center; }
  .lss-lead { font-size: 17px; line-height: 1.6; color: #4b5563; margin: 0 0 18px; }
  .lss-list { list-style: none; padding: 0; margin: 0 0 24px; display: grid; gap: 10px; }
  .lss-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.5; color: #1f2937; }
  .lss-list li svg { flex-shrink: 0; margin-top: 3px; }
  .lss-stage { margin: 0; width: 100%; max-width: 380px; justify-self: center; background: #F7F6F2; border: 1px solid rgba(0,0,0,.08); border-radius: 22px; overflow: hidden; box-shadow: 0 18px 40px -18px rgba(15,23,42,.35); }
  .lss-top { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #fff; border-bottom: 1px solid rgba(0,0,0,.06); }
  .lss-live { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #dc2626; }
  .lss-live i { width: 7px; height: 7px; border-radius: 50%; background: #dc2626; }
  .lss-seg { display: inline-flex; gap: 2px; padding: 3px; background: #F1EFEA; border-radius: 8px; font-size: 12px; font-weight: 700; color: #4b5563; }
  .lss-seg > * { padding: 4px 10px; border-radius: 6px; }
  .lss-seg b { background: #fff; color: #0f1115; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
  .lss-sheet { margin: 12px; padding: 12px; background: #fff; border-radius: 14px; border: 1px solid rgba(0,0,0,.06); display: flex; flex-direction: column; gap: 10px; }
  .lss-title { display: flex; align-items: center; gap: 10px; }
  .lss-num { font-family: 'Bebas Neue', sans-serif; font-size: 30px; line-height: 1; color: #fff; background: #0f1115; border-radius: 8px; padding: 5px 9px 2px; flex-shrink: 0; }
  .lss-name { font-family: 'Bebas Neue', sans-serif; font-size: 28px; line-height: .95; margin: 0; color: #0f1115; }
  .lss-spec { font-size: 12px; color: #6b7280; margin: 3px 0 0; }
  .lss-pair { display: grid; grid-template-columns: minmax(0, 42fr) minmax(0, 58fr); gap: 10px; align-items: center; }
  .lss-photo { aspect-ratio: 4 / 3; border-radius: 10px; background: #EDEAE3; display: flex; align-items: center; justify-content: center; }
  .lss-brk, .lss-ten { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  .lss-brk td { padding: 2px 0; font-size: 13px; color: #4b5563; }
  .lss-brk td:last-child { text-align: right; font-weight: 700; color: #111827; white-space: nowrap; }
  .lss-brk .lss-loan td { padding-top: 5px; border-top: 1px solid rgba(0,0,0,.1); font-weight: 700; color: #0f1115; }
  .lss-brk .lss-loan td:last-child { font-size: 15px; }
  .lss-low { display: grid; grid-template-columns: minmax(0, 36fr) minmax(0, 64fr); gap: 10px; }
  .lss-contact { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 10px; background: #F1EFEA; text-align: center; padding: 8px 4px; }
  .lss-contact b { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #0f1115; }
  .lss-contact span { font-size: 11px; color: #6b7280; }
  .lss-ten th { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #9ca3af; padding: 0 8px 3px; text-align: right; }
  .lss-ten th:first-child { text-align: left; }
  .lss-ten td { padding: 5px 8px; font-size: 13px; font-weight: 600; color: #4b5563; border-top: 1px solid rgba(0,0,0,.06); }
  .lss-ten td:last-child { text-align: right; font-size: 16px; font-weight: 800; color: #111827; }
  .lss-ten .lss-def td { background: #0f1115; color: #fff; border-top-color: transparent; }
  .lss-ten .lss-def td:first-child { border-radius: 8px 0 0 8px; }
  .lss-ten .lss-def td:last-child { border-radius: 0 8px 8px 0; font-size: 20px; }
  .lss-cta { margin: 0; padding: 7px 8px; border-radius: 8px; background: #0f1115; color: #fff; text-align: center; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .lss-note { font-size: 12px; color: #6b7280; text-align: center; padding: 0 12px 12px; margin: 0; }
  @media (max-width: 820px) {
    .lss-grid { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  }
`;
