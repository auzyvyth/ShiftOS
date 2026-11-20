// Why us, version C "Numbered" (STOREFRONT-2 stage 4): the dealer's reasons side by side in
// columns, each under a large number with a short line in their colour. No cards, no icons.
// Only what the dealer wrote (storefrontWhy); hidden when blank, the same rule as version A.
import { storefrontWhy } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secA, accentOf } from "./shared";

export default function WhyUsNumbered({ tenant, siteName }) {
  const why = storefrontWhy(tenant?.storefront_why, tenant?.site_name || tenant?.dealership);
  if (!why?.items?.length) return null;
  return (
    <section className="sec-pad" style={{ ...secA, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .wyn { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 40px 32px; }
        .wyn-n { font-size: 40px; margin: 0 0 12px; }
        .wyn-bar { width: 24px; height: 2px; border-radius: 2px; background: var(--sf-accent); margin: 0 0 16px; }
        @media (max-width: 480px) { .wyn { gap: 32px; } .wyn-n { font-size: 32px; } }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="sfv-head">
            <p className="sfv-eyebrow">Why {siteName}</p>
            <h2 className="sec-title">{why.title}</h2>
          </div>
        </FadeIn>
        <div className="wyn">
          {why.items.map((b, i) => (
            <FadeIn key={i} delay={i * 0.06}>
              <p className="sfv-num wyn-n">{String(i + 1).padStart(2, "0")}</p>
              <div className="wyn-bar" aria-hidden />
              <h3 className="sfv-t">{b.title}</h3>
              {b.desc && <p className="sfv-d">{b.desc}</p>}
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
