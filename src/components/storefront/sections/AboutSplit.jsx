// About, version B "Side by side" (STOREFRONT-2 stage 4): the heading and the dealer's town on
// the left, their own About text on the right behind a line in their colour. Every word is the
// dealer's (about_text, Settings) or a fact we hold (city / state). Hidden when they wrote none,
// the same rule as version A.
import { MapPin } from "lucide-react";
import { FadeIn } from "./ui";
import { wrap, secB, accentOf } from "./shared";

export default function AboutSplit({ tenant, siteName }) {
  if (!tenant?.about_text) return null;
  const place = [tenant.city, tenant.state].filter(Boolean).join(", ");
  return (
    <section className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .abs { display: grid; gap: 24px; }
        @media (min-width: 900px) { .abs { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; } }
        .abs-place { display: inline-flex; align-items: center; gap: 6px; margin: 16px 0 0; font-size: 13px; color: var(--sf-muted, rgba(255,255,255,0.55)); }
        .abs-text { white-space: pre-line; border-left: 2px solid var(--sf-accent); padding-left: 24px; }
        @media (max-width: 480px) { .abs-text { padding-left: 16px; } }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="abs">
            <div>
              <p className="sfv-eyebrow">About {siteName}</p>
              <h2 className="sec-title">Get to know us</h2>
              {place && <p className="abs-place"><MapPin size={13} /> {place}</p>}
            </div>
            <p className="sfv-d abs-text">{tenant.about_text}</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
