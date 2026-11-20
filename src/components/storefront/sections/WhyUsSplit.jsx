// Why us, version B "Side by side" (STOREFRONT-2 stage 4): the dealer's heading on the left
// (it stays in view on a computer while the reasons scroll), their reasons on the right as a
// list with a tick in their colour. Only what the dealer wrote (storefrontWhy); hidden when
// blank, the same rule as version A.
import { Check } from "lucide-react";
import { storefrontWhy } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secA, accentOf } from "./shared";

export default function WhyUsSplit({ tenant, siteName }) {
  const why = storefrontWhy(tenant?.storefront_why, tenant?.site_name || tenant?.dealership);
  if (!why?.items?.length) return null;
  return (
    <section className="sec-pad" style={{ ...secA, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .wys { display: grid; gap: 28px; }
        @media (min-width: 900px) { .wys { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: start; }
          .wys-head { position: sticky; top: 96px; } }
        .wys-row { display: flex; gap: 16px; padding: 20px 0; border-top: 1px solid var(--sf-border, rgba(255,255,255,0.08)); }
        .wys-row:last-child { border-bottom: 1px solid var(--sf-border, rgba(255,255,255,0.08)); }
        .wys-tick { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
          background: var(--sf-accent); color: var(--sf-on-accent, #fff); margin-top: 2px; }
      `}</style>
      <div style={wrap}>
        <div className="wys">
          <FadeIn className="wys-head">
            <p className="sfv-eyebrow">Why {siteName}</p>
            <h2 className="sec-title">{why.title}</h2>
          </FadeIn>
          <div>
            {why.items.map((b, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="wys-row">
                  <span className="wys-tick" aria-hidden><Check size={16} strokeWidth={3} /></span>
                  <div>
                    <h3 className="sfv-t">{b.title}</h3>
                    {b.desc && <p className="sfv-d">{b.desc}</p>}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
