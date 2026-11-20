// About, version C "Opening line" (STOREFRONT-2 stage 4): the first thing the dealer wrote in
// About, set large, the rest below at reading size. Only their own words, cut where they
// already put a break (a blank line, else the end of their first sentence); nothing added.
// Hidden when they wrote none, the same rule as version A.
import { FadeIn } from "./ui";
import { wrap, secB, accentOf } from "./shared";

const LEAD_MAX = 240; // longer than this reads as a wall of large type: no lead then

// "First paragraph" if short enough, else "first sentence" if short enough, else no lead.
function aboutLead(text) {
  const all = String(text || "").trim();
  const [first, ...more] = all.split(/\n\s*\n/);
  if (first.length <= LEAD_MAX && more.length) return { lead: first.trim(), rest: more.join("\n\n").trim() };
  const m = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(all);
  if (m && m[1].length <= LEAD_MAX) return { lead: m[1].trim(), rest: m[2].trim() };
  if (all.length <= LEAD_MAX) return { lead: all, rest: "" };
  return { lead: "", rest: all };
}

export default function AboutLead({ tenant, siteName }) {
  if (!tenant?.about_text) return null;
  const { lead, rest } = aboutLead(tenant.about_text);
  return (
    <section className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .ald { max-width: 860px; }
        .ald-lead { margin: 0 0 24px; color: var(--sf-text, #F0F0F0);
          font-size: clamp(1.25rem, 2.6vw, 1.75rem); font-weight: 600; line-height: 1.45; letter-spacing: -0.01em; white-space: pre-line; }
        .ald-rest { white-space: pre-line; max-width: 760px; }
        .ald-bar { width: 40px; height: 2px; border-radius: 2px; background: var(--sf-accent); margin: 0 0 24px; }
      `}</style>
      <div style={wrap}>
        <FadeIn>
          <div className="ald">
            <p className="sfv-eyebrow">About {siteName}</p>
            <h2 className="sec-title" style={{ marginBottom: 24 }}>Get to know us</h2>
            <div className="ald-bar" aria-hidden />
            {lead && <p className="ald-lead">{lead}</p>}
            {rest && <p className="sfv-d ald-rest">{rest}</p>}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
