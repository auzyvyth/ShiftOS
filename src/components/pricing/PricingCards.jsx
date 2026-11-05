import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

/*
 * The pricing cards, light (owner, 2026-11-03: the old ones looked cheap and were
 * too big). One component for /plans and /for-salesmen; the words come from
 * salesmanPricingCards() in src/utils/plans.js. Each card: name (+ badge), price,
 * one line, the button, then at most five feature lines under a FEATURES rule.
 * The `featured` card (Premium) carries the only colour: a soft red glow at the
 * top, a red key button and red ticks. Every other card stays neutral on purpose.
 *
 * card = { key, name, badge?, price, per, desc, notes?, cta, to? | href?, selfTo?, selfLabel?, featured?, features[] }
 * selfTo: a small "sign up yourself" link under a WhatsApp button.
 */
export default function PricingCards({ cards, featuresLabel = "Features" }) {
  return (
    <div className={`pc-grid pc-n${cards.length}`}>
      <style>{CSS}</style>
      {cards.map((c) => (
        <div key={c.key} className={`pc-card${c.featured ? " pc-feat" : ""}`}>
          <div className="pc-top">
            <span className="pc-name">{c.name}</span>
            {c.badge && <span className="pc-badge">{c.badge}</span>}
          </div>
          <p className="pc-price">{c.price}{c.per && <span>{c.per}</span>}</p>
          <p className="pc-desc">{c.desc}</p>
          {c.href ? (
            <a className="pc-btn" href={c.href} target="_blank" rel="noopener noreferrer">{c.cta}</a>
          ) : (
            <Link className="pc-btn" to={c.to}>{c.cta}</Link>
          )}
          {c.selfTo && <Link className="pc-self" to={c.selfTo}>{c.selfLabel}</Link>}
          {/* Under the button, so every card's button sits at the same height. */}
          {c.notes?.length > 0 && (
            <div className="pc-notes">{c.notes.map((n) => <p key={n}>{n}</p>)}</div>
          )}
          <div className="pc-rule"><i /><span>{featuresLabel}</span><i /></div>
          <ul className="pc-list">
            {c.features.map((f) => (
              <li key={f}><span className="pc-tick"><Check size={11} strokeWidth={3} /></span>{f}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const CSS = `
.pc-grid { display: grid; gap: 14px; align-items: stretch; max-width: 1040px; margin: 0 auto; }
.pc-n3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pc-n2 { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 700px; }
.pc-card { position: relative; display: flex; flex-direction: column; min-width: 0; background: #fff; border: 1px solid #e7e7ea; border-radius: 18px; padding: 22px 22px 20px; box-shadow: 0 1px 2px rgba(16,24,40,0.04), inset 0 1px 0 #fff; font-family: var(--xd-font-body, 'Outfit', system-ui, sans-serif); }
.pc-feat { border-color: rgba(220,38,38,0.28); background: radial-gradient(ellipse 70% 150px at 50% 0, rgba(220,38,38,0.09), rgba(220,38,38,0) 70%), #fff; box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 24px 48px -24px rgba(220,38,38,0.28); }
.pc-feat::before { content: ""; position: absolute; top: -1px; left: 22%; right: 22%; height: 1px; background: linear-gradient(90deg, transparent, rgba(220,38,38,0.7), transparent); }
.pc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
.pc-name { font-size: 15px; font-weight: 600; color: #111827; }
.pc-badge { font-size: 11px; font-weight: 600; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
.pc-price { margin: 14px 0 0; font-size: 38px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: #0b0b0f; font-variant-numeric: tabular-nums; }
.pc-price span { margin-left: 3px; font-size: 14px; font-weight: 500; letter-spacing: 0; color: #9ca3af; }
.pc-desc { margin: 12px 0 0; font-size: 14px; line-height: 1.45; color: #6b7280; min-height: 40px; }
.pc-notes { margin-top: 12px; display: grid; gap: 4px; text-align: center; }
.pc-notes p { margin: 0; font-size: 12.5px; line-height: 1.45; color: #4b5563; }
.pc-notes p:first-child { color: #111827; font-weight: 600; }
.pc-btn { margin-top: 18px; display: flex; align-items: center; justify-content: center; height: 42px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; color: #111827; background: #f6f6f7; border: 1px solid #e4e4e7; box-shadow: inset 0 1px 0 #fff; transition: background 0.15s; }
.pc-btn:hover { background: #efeff1; }
.pc-self { margin-top: 8px; text-align: center; font-size: 12.5px; color: #6b7280; text-decoration: underline; text-underline-offset: 2px; }
.pc-self:hover { color: #111827; }
.pc-feat .pc-btn { color: #fff; border: none; background: linear-gradient(180deg, #ef4444, #dc2626); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(127,29,29,0.3), 0 8px 18px -8px rgba(220,38,38,0.55); }
.pc-feat .pc-btn:hover { background: linear-gradient(180deg, #f05252, #c81e1e); }
.pc-rule { display: flex; align-items: center; gap: 10px; margin: 20px 0 14px; }
.pc-rule i { flex: 1; height: 1px; background: #ececef; }
.pc-rule span { font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #9ca3af; }
.pc-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.pc-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; line-height: 1.4; color: #374151; }
.pc-tick { flex-shrink: 0; width: 18px; height: 18px; margin-top: 0.5px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b; }
.pc-feat .pc-tick { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
@media (max-width: 860px) {
  .pc-n3, .pc-n2 { grid-template-columns: 1fr; max-width: 440px; }
  .pc-feat { order: -1; }
  .pc-desc { min-height: 0; }
}
`;
