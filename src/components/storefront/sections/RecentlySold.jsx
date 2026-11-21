// Recently sold (STOREFRONT-2 stage 4 phase B): the dealer's last sold cars, car + month only.
// NEVER a price or a buyer (same rule as the agent page's get_agent_recent_sales): the lookup
// get_dealer_recent_sales (migration 20261121a, SECURITY DEFINER, public storefronts only)
// returns neither, and soldCards (storefrontStock.js) prints only name + month + photo.
// Hidden when nothing sold in the last 12 months, while loading and when the read fails.
// Exists only once DB_PHASE_B is on (storefrontLayout.js): before that the lookup is not there.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { publicClient } from "../../../supabaseClient";
import { withTimeout } from "../../../config/marketplaceConfig";
import { soldCards } from "../../../utils/storefrontStock";
import { cdnImg } from "../../../utils/img";
import { FadeIn } from "./ui";
import { wrap, secB, accentOf } from "./shared";

export default function RecentlySold({ tenant }) {
  const sub = tenant?.subdomain;
  const [cards, setCards] = useState(null);
  const rail = useRef(null);
  useEffect(() => {
    if (!sub) return undefined;
    let on = true;
    withTimeout(publicClient.rpc("get_dealer_recent_sales", { p_subdomain: sub }))
      .then(({ data, error }) => on && setCards(error ? [] : soldCards(data)))
      .catch(() => on && setCards([]));
    return () => { on = false; };
  }, [sub]);
  if (!cards || cards.length === 0) return null;
  const step = (dir) => {
    const el = rail.current;
    const card = el?.firstElementChild;
    if (el) el.scrollBy({ left: dir * (card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .sfs-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 24px; }
        .sfs-arrows { display: none; gap: 8px; }
        .sfs-arrow { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
          background: var(--sf-card, #111113); border: 1px solid var(--sf-border, rgba(255,255,255,0.1)); color: var(--sf-muted, #C0C0C6); }
        @media (hover: hover) and (pointer: fine) { .sfs-arrows { display: flex; } }
        .sfs { display: grid; grid-auto-flow: column; grid-auto-columns: 250px; gap: 16px; overflow-x: auto;
          scroll-snap-type: x mandatory; padding: 4px 20px 12px; margin: 0 -20px; scrollbar-width: none; overscroll-behavior-x: contain; }
        .sfs::-webkit-scrollbar { display: none; }
        .sfs-card { scroll-snap-align: start; min-width: 0; border-radius: 12px; overflow: hidden;
          background: var(--sf-card, #111113); border: 1px solid var(--sf-border, rgba(255,255,255,0.07)); }
        .sfs-ph { position: relative; aspect-ratio: 4 / 3; background: var(--sf-bg2, #141416); }
        .sfs-ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sfs-pill { position: absolute; left: 10px; top: 10px; padding: 4px 10px; border-radius: 999px; font-size: 11px;
          font-weight: 700; letter-spacing: .08em; text-transform: uppercase; background: var(--sf-accent, #DC2626); color: var(--sf-on-accent, #fff); }
        .sfs-body { padding: 12px 14px 14px; }
        .sfs-name { font-size: 15px; font-weight: 600; color: var(--sf-text, #F0F0F0); margin: 0 0 4px; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sfs-when { font-size: 13px; color: var(--sf-muted, rgba(255,255,255,0.62)); margin: 0; }
        @media (max-width: 640px) { .sfs { grid-auto-columns: 66%; gap: 12px; } }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="sfs-top">
            <div>
              <p className="sfv-eyebrow">Recently sold</p>
              <h2 className="sec-title">Cars that went home</h2>
            </div>
            {cards.length > 3 && (
              <div className="sfs-arrows">
                <button type="button" className="sfs-arrow" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
                <button type="button" className="sfs-arrow" aria-label="Next" onClick={() => step(1)}><ChevronRight size={18} /></button>
              </div>
            )}
          </div>
        </FadeIn>
        <div className="sfs" ref={rail}>
          {cards.map((c, i) => (
            <div key={i} className="sfs-card">
              <div className="sfs-ph">
                {c.photo && <img src={cdnImg(c.photo, 480, 70)} alt={c.name} loading="lazy" decoding="async"
                  onError={(e) => { if (e.currentTarget.src !== c.photo) e.currentTarget.src = c.photo; }} />}
                <span className="sfs-pill">Sold</span>
              </div>
              <div className="sfs-body">
                <p className="sfs-name">{c.name}</p>
                <p className="sfs-when">{c.when}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
