// Brands in stock (STOREFRONT-2 stage 4 phase B): one tile per brand the dealer has a car of
// for sale, most cars first, each opening /cars filtered to that brand. Fills itself from the
// dealer's own stock (useDealerStock); hidden under MIN_BRANDS brands and while loading.
// Logos come from the ONE map (src/config/brandLogos.js); a brand without a checked logo is a
// wordmark. The tile is a white plate on both themes so a logo drawn for white always reads.
import { Link } from "react-router-dom";
import { LOGOS } from "../../../config/brandLogos";
import { stockBrands, MIN_BRANDS } from "../../../utils/storefrontStock";
import { useDealerStock } from "./stockParts";
import { FadeIn } from "./ui";
import { wrap, secLight, accentOf } from "./shared";

export default function Brands({ tenant, carsBase }) {
  const rows = useDealerStock(tenant?.id);
  const brands = stockBrands(rows || []);
  if (!rows || brands.length < MIN_BRANDS) return null;
  return (
    <section style={{ ...secLight, padding: "36px 0", "--sf-accent": accentOf(tenant) }} aria-label="Brands in stock">
      <style>{`
        .sfb-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
        .sfb-tile { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; width: 116px; }
        .sfb-plate { width: 116px; height: 72px; border-radius: 12px; background: #FFFFFF; display: grid; place-items: center;
          border: 1px solid var(--sf-border, rgba(255,255,255,0.08)); transition: transform .2s ease, box-shadow .2s ease; }
        .sfb-tile:hover .sfb-plate { transform: translateY(-2px); box-shadow: 0 0 0 2px var(--sf-accent, #DC2626); }
        .sfb-plate img { max-width: 76px; max-height: 44px; object-fit: contain; }
        .sfb-word { font-size: 15px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #111827;
          text-align: center; padding: 0 8px; line-height: 1.15; }
        .sfb-name { font-size: 13px; font-weight: 600; color: var(--sf-text, #F0F0F0); }
        .sfb-n { font-size: 12px; color: var(--sf-muted, rgba(255,255,255,0.62)); font-variant-numeric: tabular-nums; }
        @media (max-width: 640px) {
          .sfb-row { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; margin: 0 -20px; padding: 0 20px 6px;
            scrollbar-width: none; overscroll-behavior-x: contain; }
          .sfb-row::-webkit-scrollbar { display: none; }
          .sfb-tile, .sfb-plate { width: 96px; flex-shrink: 0; }
          .sfb-plate { height: 64px; }
        }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <p className="sfv-eyebrow" style={{ justifyContent: "center", marginBottom: 20 }}>Brands in stock</p>
          <div className="sfb-row">
            {brands.map((b) => (
              <Link key={b.name} className="sfb-tile" to={`${carsBase}?brand=${encodeURIComponent(b.name)}`}
                aria-label={`${b.name}: ${b.count} ${b.count === 1 ? "car" : "cars"}`}>
                <span className="sfb-plate">
                  {LOGOS[b.name]
                    ? <img src={LOGOS[b.name]} alt="" loading="lazy" decoding="async" />
                    : <span className="sfb-word">{b.name}</span>}
                </span>
                <span style={{ textAlign: "center", lineHeight: 1.3 }}>
                  <span className="sfb-name">{b.name}</span><br />
                  <span className="sfb-n">{b.count} {b.count === 1 ? "car" : "cars"}</span>
                </span>
              </Link>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
