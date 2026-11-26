import React, { useState } from 'react';

// "How buying works" (PAGE-SITE 3): the seller's OWN stops from first visit to handover
// (page_site.steps). One row of numbered stops; tapping one opens what happens there.
// No promise is added by Drevo: the words are the seller's, and the page says the bank decides.
export default function StepsBlock({ steps, firstName }) {
  const list = steps || [];
  const [at, setAt] = useState(0);
  if (!list.length) return null;
  const s = list[Math.min(at, list.length - 1)];
  const n = list.length;
  return (
    <section className="ps sb" id="ap-steps" aria-label="How buying works">
      <div className="ps-head">
        <div>
          <p className="sb-eb">How buying works</p>
          <h2>{n} {n === 1 ? 'stop' : 'stops'}, <span>one person to call</span></h2>
          <p>Tap each stop to see what happens, from the test drive to the day you drive home.</p>
        </div>
      </div>
      <div className="sb-rail" role="tablist" aria-label="Buying steps">
        {list.map((x, i) => (
          <button key={i} type="button" role="tab" id={`sb-t${i}`} aria-controls="sb-panel" aria-selected={i === at} onClick={() => setAt(i)}>
            <em>{String(i + 1).padStart(2, '0')}</em>
            <span>{x.t}</span>
          </button>
        ))}
      </div>
      <div className="sb-panel" id="sb-panel" role="tabpanel" aria-labelledby={`sb-t${at}`}>
        <p className="sb-k">Stop {at + 1} of {n}</p>
        <h3>{s.t}</h3>
        {s.d && <p className="sb-d">{s.d}</p>}
        <div className="sb-nav">
          <button type="button" disabled={at === 0} onClick={() => setAt(at - 1)}>Back</button>
          <button type="button" disabled={at >= n - 1} onClick={() => setAt(at + 1)}>Next stop</button>
        </div>
      </div>
      <p className="ps-fine">{firstName}'s own process. Loan approval is always the bank's decision.</p>
      <style>{`
        .sb-eb { margin: 0 0 8px; font-family: var(--wide, inherit); font-size: 10.5px; font-weight: 400; letter-spacing: .16em; text-transform: uppercase; color: var(--t3, #6b7280); }
        .sb-rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(112px, 1fr); gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 0 12px; padding-bottom: 2px; }
        .sb-rail::-webkit-scrollbar { display: none; }
        .sb-rail button { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-height: 84px; padding: 12px; border: 1px solid var(--line, #e5e7eb); background: transparent;
          border-radius: var(--r-chip, 10px); corner-shape: squircle; cursor: pointer; text-align: left; color: var(--t2, #4b5563); font-family: inherit; transition: background .2s, color .2s, border-color .2s; }
        .sb-rail em { font-style: normal; font-family: var(--head, 'Bebas Neue'), sans-serif; font-size: 24px; line-height: 1; color: var(--t3, #9ca3af); }
        .sb-rail span { font-size: 13px; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
        .sb-rail button[aria-selected="true"] { background: var(--ink, #dc2626); border-color: var(--ink, #dc2626); color: var(--on-ink, #fff); }
        .sb-rail button[aria-selected="true"] em { color: rgba(255,255,255,.85); }
        .sb-panel { padding: 22px; border: 1px solid var(--line, #e5e7eb); border-radius: var(--r-card, 16px); corner-shape: squircle; }
        .sb-k { margin: 0; font-family: var(--wide, inherit); font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--t3, #6b7280); }
        .sb-panel h3 { margin: 6px 0 0; font-family: var(--head, 'Bebas Neue'), sans-serif; font-weight: 400; font-size: 30px; line-height: 1; letter-spacing: .02em; text-transform: uppercase; color: var(--t1, #0a0a0b); overflow-wrap: anywhere; }
        .sb-d { margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: var(--t2, #4b5563); max-width: 60ch; overflow-wrap: anywhere; }
        .sb-nav { display: flex; gap: 8px; margin-top: 18px; }
        .sb-nav button { height: 44px; padding: 0 18px; border-radius: var(--r-btn, 12px); corner-shape: squircle; border: 1px solid var(--line2, #d1d5db); background: transparent; color: var(--t1, #0a0a0b);
          font-family: var(--bold, inherit); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
        .sb-nav button:last-child { background: var(--ink, #dc2626); border-color: var(--ink, #dc2626); color: var(--on-ink, #fff); }
        .sb-nav button:disabled { opacity: .35; cursor: default; }
      `}</style>
    </section>
  );
}
