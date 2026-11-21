// By the numbers, version B "Big numbers" (STOREFRONT-2 stage 4): the figures large in a row,
// a label under each, thin lines between. No icons and no count-up: the number is there the
// moment it is seen. Same numbers and the same hide rule as version A (statsParts.js).
import { FadeIn } from "./ui";
import { wrap, secLight, accentOf } from "./shared";
import { statList, statNumber } from "./statsParts";

export default function StatsBig({ tenant, soldCount, stock }) {
  const items = statList({ tenant, soldCount, stock });
  if (items.length === 0) return null;
  return (
    <section className="sec-pad" style={{ ...secLight, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .stb { display: grid; grid-template-columns: repeat(${items.length}, minmax(0, 1fr)); }
        .stb-cell { padding: 8px 24px; border-left: 1px solid var(--sf-border, rgba(255,255,255,0.08)); min-width: 0; }
        .stb-cell:first-child { border-left: none; padding-left: 0; }
        .stb-n { font-size: clamp(2.5rem, 6vw, 4.5rem); margin: 0 0 12px; }
        .stb-l { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--sf-muted, rgba(255,255,255,0.55)); margin: 0; }
        @media (max-width: 720px) {
          .stb { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 0; }
          .stb-cell:nth-child(odd) { border-left: none; padding-left: 0; }
          .stb-cell { padding: 0 16px; }
        }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <p className="sfv-eyebrow" style={{ marginBottom: 32 }}>By the numbers</p>
          <div className="stb">
            {items.map((s) => (
              <div key={s.key} className="stb-cell">
                <p className="sfv-num stb-n">{statNumber(s.value)}</p>
                <p className="stb-l">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
