// What a dealer's own site (<sub>.drevo.my) says in its "Why us" and "How it works"
// sections (STOREFRONT-1, 2026-11-20). ONE rule, used by the page (HomePage.jsx), the
// header link and the footer link, so a link never points at a section that is hidden.
//
// A dealer site shows ONLY what the dealer wrote. There is no fallback text: the old
// default ("Scam Protection: every car is verified", "I negotiate on your behalf",
// "My service is completely free") was written for a solo agent, claimed checks
// nothing makes, and appeared on every dealer that never filled the form in.
// Settings saves blank boxes as "", so blanks are dropped here, not shown as empty cards.

const text = (v) => (typeof v === "string" ? v.trim() : "");

function filled(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ title: text(x?.title), desc: text(x?.desc) }))
    .filter((x) => x.title);
}

// -> { title, items } or null (section hidden)
export function storefrontWhy(saved, siteName) {
  const items = filled(saved?.items);
  if (!items.length) return null;
  return { title: text(saved?.title) || (siteName ? `Why choose ${siteName}` : "Why choose us"), items };
}

// -> { title, steps } or null (section hidden)
export function storefrontHow(saved) {
  const steps = filled(saved?.steps);
  if (!steps.length) return null;
  return { title: text(saved?.title) || "How it works", steps };
}

export const hasHowItWorks = (tenant) => !!storefrontHow(tenant?.storefront_how);

// The Get in Touch section always shows (it holds the contact buttons), so each
// blank field falls back on its own. Words fit a dealer team: no "I" / "me".
export const STOREFRONT_CTA_DEFAULT = {
  title: "Ready to find your next car?",
  subtitle: "Tell us what you are looking for and we will help you find the right car.",
  primary_label: "Browse all cars",
  secondary_label: "WhatsApp us",
};

export function storefrontCta(saved) {
  const out = {};
  for (const k of Object.keys(STOREFRONT_CTA_DEFAULT)) out[k] = text(saved?.[k]) || STOREFRONT_CTA_DEFAULT[k];
  return out;
}
