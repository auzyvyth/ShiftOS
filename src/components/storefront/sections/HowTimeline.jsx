// How it works, version B "Timeline" (STOREFRONT-2 stage 4): the dealer's steps down one line,
// each on a numbered dot in their colour. Only the steps the dealer wrote (storefrontHow);
// hidden when blank, the same rule as version A and the header/footer links (hasHowItWorks).
// Keeps id="how-it-works" so those links still land here.
import { storefrontHow } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secB, accentOf } from "./shared";

export default function HowTimeline({ tenant }) {
  const how = storefrontHow(tenant?.storefront_how);
  if (!how?.steps?.length) return null;
  return (
    <section id="how-it-works" className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .htl { max-width: 760px; list-style: none; margin: 0; padding: 0; }
        .htl-step { position: relative; display: flex; gap: 20px; padding-bottom: 32px; }
        .htl-step:last-child { padding-bottom: 0; }
        .htl-step:not(:last-child)::before { content: ''; position: absolute; left: 15px; top: 40px; bottom: 8px; width: 2px;
          background: rgba(255,255,255,0.10); border-radius: 2px; }
        .htl-step .sfv-t { margin-top: 4px; }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="sfv-head">
            <p className="sfv-eyebrow">Simple process</p>
            <h2 className="sec-title">{how.title}</h2>
          </div>
        </FadeIn>
        <ol className="htl">
          {how.steps.map((s, i) => (
            <li key={i} className="htl-step">
              <span className="sfv-dot" aria-hidden>{i + 1}</span>
              <FadeIn delay={i * 0.05} style={{ minWidth: 0 }}>
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
