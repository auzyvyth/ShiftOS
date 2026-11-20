// How it works, version C "In a row" (STOREFRONT-2 stage 4): the dealer's steps side by side
// on a computer, joined by a line, each on a numbered dot in their colour; on a phone they
// stack. Only the steps the dealer wrote (storefrontHow); hidden when blank, the same rule as
// version A and the header/footer links. Keeps id="how-it-works" so those links land here.
import { storefrontHow } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secB, accentOf } from "./shared";

export default function HowRow({ tenant }) {
  const how = storefrontHow(tenant?.storefront_how);
  if (!how?.steps?.length) return null;
  return (
    <section id="how-it-works" className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .hrw { display: grid; grid-template-columns: repeat(${how.steps.length}, minmax(0, 1fr)); gap: 32px; list-style: none; margin: 0; padding: 0; }
        .hrw-step { position: relative; min-width: 0; }
        .hrw-step:not(:last-child)::after { content: ''; position: absolute; top: 15px; left: 48px; right: -16px; height: 2px;
          background: var(--sf-border, rgba(255,255,255,0.10)); border-radius: 2px; }
        .hrw-step .sfv-dot { margin-bottom: 20px; }
        @media (max-width: 900px) {
          .hrw { grid-template-columns: 1fr; gap: 24px; }
          .hrw-step { display: flex; gap: 16px; }
          .hrw-step:not(:last-child)::after { display: none; }
          .hrw-step .sfv-dot { margin-bottom: 0; }
        }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="sfv-head">
            <p className="sfv-eyebrow">Simple process</p>
            <h2 className="sec-title">{how.title}</h2>
          </div>
        </FadeIn>
        <ol className="hrw">
          {how.steps.map((s, i) => (
            <li key={i} className="hrw-step">
              <span className="sfv-dot" aria-hidden>{i + 1}</span>
              <FadeIn delay={i * 0.06} style={{ minWidth: 0 }}>
                <h3 className="sfv-t">{s.title}</h3>
                {s.desc && <p className="sfv-d">{s.desc}</p>}
              </FadeIn>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
