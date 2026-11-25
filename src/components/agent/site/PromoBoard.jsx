import React, { useMemo } from 'react';
import { activePromos, promoLine, untilLabel, daysLeft, myToday } from '../../../utils/pageSite';

// "Promos of the month" on a Premium page (PAGE-SITE 2). The seller types each
// promo with an END DATE; it disappears by itself after that day (pageSite.js).
// A strip that scrolls them under the hero, and a board with one row each and a
// WhatsApp ask that repeats only what is on the row. It never calls anything
// "official": it is the seller's own offer, and the fine print says to confirm.

export function PromoTicker({ site }) {
  const promos = useMemo(() => activePromos(site), [site]);
  if (!promos.length) return null;
  // Twice, so the strip loops without a gap (the animation moves -50%).
  const items = [...promos, ...promos];
  return (
    <div className="ps-tick" role="region" aria-label="Promos this month">
      <div className="ps-tick-track">
        {items.map((p, i) => (
          <span key={i} className="ps-tick-it" aria-hidden={i >= promos.length ? 'true' : undefined}><i />{promoLine(p)}</span>
        ))}
      </div>
    </div>
  );
}

export default function PromoBoard({ site, firstName, hasWa, waUrlFor, waIcon, onWhatsApp }) {
  const promos = useMemo(() => activePromos(site), [site]);
  if (!promos.length) return null;
  const today = myToday();
  return (
    <section className="ps" id="ap-promos" aria-label="Promos this month">
      <div className="ps-head">
        <div>
          <h2>Promos this month</h2>
          <p>Set by {firstName}. Each one disappears on its last day.</p>
        </div>
      </div>
      <div className="ps-promos">
        {promos.map((p, i) => {
          const left = daysLeft(p.until, today);
          return (
            <div className="ps-promo-row" key={`${p.model}-${i}`}>
              <div style={{ minWidth: 0 }}>
                <p className="ps-pm">{p.model}</p>
              </div>
              {p.price ? <p className="ps-pp"><small>from</small>RM {Math.round(p.price).toLocaleString('en-MY')}</p> : <span />}
              {p.text && <p className="ps-pt">{p.text}</p>}
              <div className="ps-end">
                <span className="ps-pill">{left <= 3 ? <b>{untilLabel(p.until, today)}</b> : untilLabel(p.until, today)}</span>
                {hasWa && (
                  <a className="ps-ask" href={waUrlFor(`Hi ${firstName}, I saw this on your page: ${promoLine(p)} (${untilLabel(p.until, today).toLowerCase()}).\nIs it still available? Can you tell me more?`)}
                    target="_blank" rel="noopener noreferrer" onClick={() => onWhatsApp?.('promo', p)}>
                    Ask about this
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="ps-fine">Offers are {firstName}'s own and can change. Ask to confirm the price and what is included before you decide.</p>
    </section>
  );
}
