import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, ExternalLink } from "lucide-react";
import { monthlyPayment, DEFAULT_EIR, DEFAULT_LOAN_RATIO } from "../../utils/financing";
import { LIVE_SELLING, EXAMPLE_PAGE } from "../../config/salesmanLandingCopy";

// Premium "Live selling" section on /for-salesmen: a static recreation of the
// live presentation's Cars screen (src/components/live/LivePresenter.jsx), the
// same poster layout. Sample car only, but the instalments come from the real
// formula (financing.js) at the default deposit and rate, so the picture never
// shows a number the product would not. The contact box shows a placeholder,
// never a phone number: no real person's details on a marketing page.
// Themed to THIS page, not the presenter: reuses the page's .sll-showcase
// layout and .sll-phone frame, Outfit only (the page loads no Bebas), and its
// neutral greys (#fafafa / #eceaea / #0a0a0a) rather than the presenter's beige.

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
      <div className="sll-wrap sll-showcase">
        <div className="sll-showcase-copy">
          <p className="sll-kicker">{LIVE_SELLING.kicker}</p>
          <h2 className="sll-h2">{LIVE_SELLING.title}</h2>
          <p className="sll-showcase-lead">{LIVE_SELLING.lead}</p>
          <ul className="sll-showcase-list lss-list">
            {LIVE_SELLING.points.map((p) => (
              <li key={p}><Check size={16} className="sll-tick" /> {p}</li>
            ))}
          </ul>
          <div className="lss-ctas">
            <Link to="/salesman-onboarding/premium" className="sll-btn sll-btn-dark">
              Start Premium <ArrowRight size={17} />
            </Link>
            <Link to={EXAMPLE_PAGE.path} className="sll-example lss-example">
              See a Premium page <ExternalLink size={14} />
            </Link>
          </div>
        </div>

        <figure className="sll-phone lss-stage" aria-label="Live presentation screen, sample car">
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
  .lss-list { margin-bottom: 24px; }
  .lss-ctas { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; }
  .lss-ctas .lss-example { margin-top: 0; }
  .lss-list li { align-items: flex-start; line-height: 1.45; }
  .lss-list li svg { margin-top: 4px; }
  .lss-stage { margin: 0; padding: 0; overflow: hidden; background: #fafafa; }
  .lss-top { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #fff; border-bottom: 1px solid #eceaea; }
  .lss-live { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #dc2626; }
  .lss-live i { width: 7px; height: 7px; border-radius: 50%; background: #dc2626; }
  .lss-seg { display: inline-flex; gap: 2px; padding: 3px; background: #f3f4f6; border-radius: 8px; font-size: 12px; font-weight: 700; color: #6b7280; }
  .lss-seg > * { padding: 4px 10px; border-radius: 6px; }
  .lss-seg b { background: #fff; color: #0a0a0a; box-shadow: 0 1px 2px rgba(10,10,10,.12); }
  .lss-sheet { margin: 12px; padding: 12px; background: #fff; border-radius: 14px; border: 1px solid #eceaea; display: flex; flex-direction: column; gap: 10px; }
  .lss-title { display: flex; align-items: center; gap: 10px; }
  .lss-num { font-size: 22px; font-weight: 900; line-height: 1; letter-spacing: -.02em; color: #fff; background: #0a0a0a; border-radius: 8px; padding: 6px 8px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .lss-name { font-size: 20px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; margin: 0; color: #0a0a0a; }
  .lss-spec { font-size: 12px; color: #6b7280; margin: 2px 0 0; }
  .lss-pair { display: grid; grid-template-columns: minmax(0, 42fr) minmax(0, 58fr); gap: 10px; align-items: center; }
  .lss-photo { aspect-ratio: 4 / 3; border-radius: 10px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; }
  .lss-brk, .lss-ten { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  .lss-brk td { padding: 2px 0; font-size: 13px; color: #4b5563; }
  .lss-brk td:last-child { text-align: right; font-weight: 700; color: #1f2733; white-space: nowrap; }
  .lss-brk .lss-loan td { padding-top: 5px; border-top: 1px solid #eceaea; font-weight: 700; color: #0a0a0a; }
  .lss-brk .lss-loan td:last-child { font-size: 15px; }
  .lss-low { display: grid; grid-template-columns: minmax(0, 36fr) minmax(0, 64fr); gap: 10px; }
  .lss-contact { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 10px; background: #fafafa; border: 1px solid #eceaea; text-align: center; padding: 8px 4px; }
  .lss-contact b { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #0a0a0a; }
  .lss-contact span { font-size: 11px; color: #6b7280; }
  .lss-ten th { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #9ca3af; padding: 0 8px 3px; text-align: right; }
  .lss-ten th:first-child { text-align: left; }
  .lss-ten td { padding: 5px 8px; font-size: 13px; font-weight: 600; color: #4b5563; border-top: 1px solid #eceaea; }
  .lss-ten td:last-child { text-align: right; font-size: 16px; font-weight: 800; color: #1f2733; }
  .lss-ten .lss-def td { background: #0a0a0a; color: #fff; border-top-color: transparent; }
  .lss-ten .lss-def td:first-child { border-radius: 8px 0 0 8px; }
  .lss-ten .lss-def td:last-child { border-radius: 0 8px 8px 0; font-size: 20px; }
  .lss-cta { margin: 0; padding: 7px 8px; border-radius: 8px; background: #0a0a0a; color: #fff; text-align: center; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lss-note { font-size: 12px; color: #6b7280; text-align: center; padding: 0 12px 12px; margin: 0; }
`;
