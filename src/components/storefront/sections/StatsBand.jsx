// By the numbers, version C "Colour band" (STOREFRONT-2 stage 4): one short band in the
// dealer's colour with the figures in white. The band is the section's only accent; the colour
// is darkened until white reads on it (shared.js accentOf). Same numbers and the same hide
// rule as version A (statsParts.js).
import { wrap, accentOf } from "./shared";
import { statList, statNumber } from "./statsParts";

export default function StatsBand({ tenant, soldCount, stock }) {
  const items = statList({ tenant, soldCount, stock });
  if (items.length === 0) return null;
  return (
    <section style={{ background: accentOf(tenant), padding: "40px 0" }} aria-label="By the numbers">
      <style>{`
        .stc { display: grid; grid-template-columns: repeat(${items.length}, minmax(0, 1fr)); gap: 24px; text-align: center; }
        .stc-n { font-size: clamp(2rem, 4.5vw, 3rem); margin: 0 0 8px; color: #fff; }
        .stc-l { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,0.85); margin: 0; }
        @media (max-width: 720px) { .stc { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 16px; } }
      `}</style>
      <div style={wrap}>
        <div className="stc">
          {items.map((s) => (
            <div key={s.key}>
              <p className="sfv-num stc-n">{statNumber(s.value)}</p>
              <p className="stc-l">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
