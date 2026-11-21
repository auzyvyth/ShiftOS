// Happy customers (STOREFRONT-2 stage 4 phase C): the dealer's handover photos, a grid of
// 3 across on desktop, 2 on a phone. Under each photo: the car and the month, plus the dealer's
// short caption. NEVER a buyer's name, number or plate: the lookup get_dealer_deliveries
// (migration 20261121b, SECURITY DEFINER, public storefronts only) holds none, and
// deliveryCards (deliveryCaption.js) re-applies the no-long-number rule before printing.
// Every photo was uploaded with the buyer's consent ticked (PDPA 2010 s.6); the dealer deletes
// one in a tap when a buyer asks (s.38), and it leaves this page on the next load.
// Hidden when there is no photo, while loading and when the read fails.
// Exists only once DB_PHASE_C is on (storefrontLayout.js): before that the lookup is not there.
import { useEffect, useState } from "react";
import { publicClient } from "../../../supabaseClient";
import { withTimeout } from "../../../config/marketplaceConfig";
import { deliveryCards } from "../../../utils/deliveryCaption";
import { cdnImg } from "../../../utils/img";
import { FadeIn } from "./ui";
import { wrap, secA, accentOf } from "./shared";

export default function Deliveries({ tenant }) {
  const sub = tenant?.subdomain;
  const [cards, setCards] = useState(null);
  useEffect(() => {
    if (!sub) return undefined;
    let on = true;
    withTimeout(publicClient.rpc("get_dealer_deliveries", { p_subdomain: sub }))
      .then(({ data, error }) => on && setCards(error ? [] : deliveryCards(data)))
      .catch(() => on && setCards([]));
    return () => { on = false; };
  }, [sub]);
  if (!cards || cards.length === 0) return null;

  return (
    <section className="sec-pad" style={{ ...secA, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .sfd { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        .sfd-card { min-width: 0; border-radius: 12px; overflow: hidden;
          background: var(--sf-card, #111113); border: 1px solid var(--sf-border, rgba(255,255,255,0.07)); }
        .sfd-ph { aspect-ratio: 4 / 3; background: var(--sf-bg2, #141416); }
        .sfd-ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sfd-body { padding: 12px 14px 14px; }
        .sfd-name { font-size: 15px; font-weight: 600; color: var(--sf-text, #F0F0F0); margin: 0; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sfd-cap { font-size: 14px; color: var(--sf-text, #F0F0F0); margin: 6px 0 0; line-height: 1.45; overflow-wrap: anywhere; }
        .sfd-when { font-size: 13px; color: var(--sf-muted, rgba(255,255,255,0.62)); margin: 4px 0 0; }
        @media (max-width: 760px) {
          .sfd { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .sfd-body { padding: 10px 10px 12px; }
          .sfd-name { font-size: 14px; }
          .sfd-cap { font-size: 13px; }
          .sfd-when { font-size: 12px; }
        }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="sfv-head">
            <p className="sfv-eyebrow">Happy customers</p>
            <h2 className="sec-title">Handed over with a smile</h2>
          </div>
        </FadeIn>
        <div className="sfd">
          {cards.map((c, i) => (
            <figure key={i} className="sfd-card" style={{ margin: 0 }}>
              <div className="sfd-ph">
                <img src={cdnImg(c.photo, 640, 72)} alt={c.name ? `${c.name} handed over` : "Car handed over"}
                  loading="lazy" decoding="async"
                  onError={(e) => { if (e.currentTarget.src !== c.photo) e.currentTarget.src = c.photo; }} />
              </div>
              <figcaption className="sfd-body">
                {c.name && <p className="sfd-name">{c.name}</p>}
                {c.caption && <p className="sfd-cap">{c.caption}</p>}
                {c.when && <p className="sfd-when">{c.when}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
