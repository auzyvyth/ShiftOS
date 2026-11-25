import React, { useState } from 'react';
import { deliveryLine } from '../../../utils/pageSite';

// "Delivery to your town" (PAGE-SITE 2). The seller lists the towns they deliver to
// with km and minutes, typed by them: shown as the seller's ESTIMATE, never a
// calculated route (a wrong drive time on a public page is worse than none).
export default function DeliveryBlock({ delivery, firstName, hasWa, waUrlFor, onWhatsApp }) {
  const items = delivery?.items || [];
  const [pick, setPick] = useState(0);
  if (!items.length) return null;
  const it = items[Math.min(pick, items.length - 1)];
  const base = delivery.base || 'the showroom';
  return (
    <section className="ps" id="ap-delivery" aria-label="Delivery to your town">
      <div className="ps-head">
        <div>
          <h2>From {base} to your door</h2>
          <p>Pick your town to see how far {firstName} delivers.</p>
        </div>
      </div>
      <div className="ps-card ps-del">
        <div className="ps-towns" role="group" aria-label="Towns">
          {items.map((t, i) => <button key={`${t.town}-${i}`} type="button" aria-pressed={i === pick} onClick={() => setPick(i)}>{t.town}</button>)}
        </div>
        <div className="ps-route" aria-hidden="true"><span className="ps-dot" /><i /><span className="ps-dot ps-dot--end" /></div>
        <div className="ps-big">
          <div><b>{it.km}<small> km</small></b><span>{base} to {it.town}</span></div>
          {it.min && <div><b>{it.min >= 90 ? `${Math.floor(it.min / 60)}h${it.min % 60 ? ` ${it.min % 60}` : ''}` : it.min}<small>{it.min >= 90 ? (it.min % 60 ? ' min' : '') : ' min'}</small></b><span>about, by road</span></div>}
        </div>
        {hasWa && (
          <div>
            <a className="ps-wa" href={waUrlFor(`Hi ${firstName}, can you deliver a car to ${it.town}? (${deliveryLine(it)} from ${base}.)\nPlease tell me more.`)}
              target="_blank" rel="noopener noreferrer" onClick={() => onWhatsApp?.('delivery', it)}>
              Ask {firstName} about {it.town}
            </a>
          </div>
        )}
      </div>
      <p className="ps-fine">Distances and times are {firstName}'s own estimates. Delivery terms are agreed with {firstName} before you pay any deposit.</p>
    </section>
  );
}
