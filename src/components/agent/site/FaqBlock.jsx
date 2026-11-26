import React, { useState } from 'react';
import { Plus } from 'lucide-react';

// "Questions buyers ask" (PAGE-SITE 3): the seller's OWN questions and answers (page_site.faq).
// One open at a time. The answers are the seller's words; the page labels them so.
export default function FaqBlock({ faq, firstName }) {
  const list = faq || [];
  const [open, setOpen] = useState(0);
  if (!list.length) return null;
  return (
    <section className="ps fq" id="ap-faq" aria-label="Questions buyers ask">
      <div className="ps-head">
        <div>
          <h2>Questions <span>buyers ask</span></h2>
          <p>Answered by {firstName}.</p>
        </div>
      </div>
      <div className="fq-list">
        {list.map((x, i) => {
          const on = open === i;
          return (
            <div key={i} className="fq-it">
              <button type="button" id={`fq-q${i}`} aria-expanded={on} aria-controls={`fq-a${i}`} onClick={() => setOpen(on ? -1 : i)}>
                <span>{x.q}</span>
                <i aria-hidden="true"><Plus size={16} /></i>
              </button>
              <div id={`fq-a${i}`} role="region" aria-labelledby={`fq-q${i}`} className="fq-a" hidden={!on}><p>{x.a}</p></div>
            </div>
          );
        })}
      </div>
      <style>{`
        .fq-list { border-top: 1px solid var(--line, #e5e7eb); }
        .fq-it { border-bottom: 1px solid var(--line, #e5e7eb); }
        .fq-it button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 56px; padding: 14px 0; border: none; background: none;
          cursor: pointer; text-align: left; font-family: inherit; font-size: 15px; font-weight: 600; color: var(--t1, #0a0a0b); }
        .fq-it button span { min-width: 0; overflow-wrap: anywhere; }
        .fq-it i { flex-shrink: 0; width: 30px; height: 30px; border-radius: 9px; corner-shape: squircle; display: flex; align-items: center; justify-content: center;
          background: var(--k1, #f4f4f6); color: var(--t1, #0a0a0b); transition: transform .25s ease, background .2s, color .2s; }
        .fq-it button[aria-expanded="true"] i { transform: rotate(45deg); background: var(--ink, #dc2626); color: var(--on-ink, #fff); }
        .fq-a p { margin: 0 0 16px; max-width: 62ch; font-size: 14.5px; line-height: 1.65; color: var(--t2, #4b5563); white-space: pre-line; overflow-wrap: anywhere; }
        @media (prefers-reduced-motion: reduce) { .fq-it i { transition: none; } }
      `}</style>
    </section>
  );
}
