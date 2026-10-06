import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, ExternalLink } from "lucide-react";
import { LIVE_SELLING, EXAMPLE_PAGE, PREMIUM_CTA } from "../../config/salesmanLandingCopy";

// "Live presentation" detail section on /for-salesmen, directly under the hero.
// The hero already shows the presenter (LiveDemo.jsx), so this section is the
// point-by-point of what the tool does — showing the same picture twice is
// filler. Points come from LIVE_SELLING so the crawler render (api/og.js) reads
// the same list.

export default function LiveSellingSection({ reveal, fadeUp }) {
  return (
    <motion.section className="sll-section" id="live" variants={fadeUp} {...reveal}>
      <style>{CSS}</style>
      <div className="sll-wrap">
        <p className="sll-kicker">{LIVE_SELLING.kicker}</p>
        <h2 className="sll-h2 lss-h2">{LIVE_SELLING.title}</h2>
        <p className="sll-showcase-lead lss-lead">{LIVE_SELLING.lead}</p>
        <ul className="lss-list">
          {LIVE_SELLING.points.map((p) => (
            <li key={p}><Check size={16} className="sll-tick" /> {p}</li>
          ))}
        </ul>
        <p className="lss-note-line">{LIVE_SELLING.note}</p>
        <div className="lss-ctas">
          <Link to="/salesman-onboarding/premium" className="sll-btn sll-btn-red">
            {PREMIUM_CTA} <ArrowRight size={17} />
          </Link>
          <Link to={EXAMPLE_PAGE.path} className="sll-example lss-example">
            See an example page <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

const CSS = `
  .lss-h2 { margin-bottom: 18px; max-width: 760px; }
  .lss-lead { max-width: 680px; margin-bottom: 28px; }
  .lss-list { list-style: none; padding: 0; margin: 0 0 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 40px; }
  .lss-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; font-weight: 500; line-height: 1.45; color: #1f2733; padding: 7px 0; }
  .lss-list li svg { margin-top: 3px; }
  .lss-note-line { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
  .lss-ctas { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; }
  .lss-ctas .lss-example { margin-top: 0; }
  @media (max-width: 860px) {
    .lss-list { grid-template-columns: 1fr; }
  }
`;
