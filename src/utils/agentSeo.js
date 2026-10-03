// What Google is handed for an agent page (/s/:slug) — ONE definition, read by
// the crawler render (api/og.js buildSalesmanHtml), the SPA page
// (SalesmanProfilePage) and the Premium settings preview (AgentSearchPreview).
// The preview is only honest if it runs the same code as the crawler, so never
// re-type this title or description anywhere else.
//
// Pure: no React, no Supabase. Imported by an edge function.

// Roughly where Google cuts a title / snippet on a phone. It measures pixels,
// not characters, so these are the safe side of the line, not the line itself.
export const TITLE_LIMIT = 60;
export const DESC_LIMIT = 155;

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

export function agentName(p) {
  return clean(p?.full_name) || clean(p?.dealership) || clean(p?.slug);
}

export function agentLocation(p) {
  return [p?.city, p?.state].map(clean).filter(Boolean).join(", ");
}

export function agentPageTitle(p) {
  const loc = agentLocation(p);
  return `${agentName(p)} — Car Agent${loc ? ` in ${loc}` : ""} | XDrive`;
}

// The agent's own bio, else a sentence built only from facts we hold.
// `bio` only — `about_text` is the DEALER's "About us", never the agent's.
export function agentPageDescription(p, carCount = 0) {
  const bio = clean(p?.bio);
  if (bio) return bio.length > DESC_LIMIT ? `${bio.slice(0, DESC_LIMIT - 3).trimEnd()}...` : bio;
  const loc = agentLocation(p);
  const cars = carCount > 0
    ? ` Browse ${carCount} ${carCount === 1 ? "car" : "cars"} for sale and message them directly.`
    : "";
  return `${agentName(p)} is a car sales agent${loc ? ` in ${loc}` : ""} on XDrive.${cars}`;
}

// Plain-English problems with how the result will read, worst first. Each is
// something the agent can fix in Settings; nothing here is a guess about rank.
export function agentSeoIssues(p) {
  const issues = [];
  const name = clean(p?.full_name);
  const bio = clean(p?.bio);
  if (!name) issues.push({ key: "name", text: "Add your name. Without it Google shows your username instead." });
  else if (name === name.toLowerCase() && /[a-z]/.test(name)) issues.push({ key: "name", text: "Your name is all lowercase. Capitalise it the way you write it, e.g. \"Ali Hassan\"." });
  else if (name === name.toUpperCase() && /[A-Z]{3}/.test(name)) issues.push({ key: "name", text: "Your name is in capitals, which reads like shouting in a search result. Write it as \"Ali Hassan\"." });
  if (!bio) issues.push({ key: "bio", text: "Add a bio. It is the grey text under your name on Google, and the words in it are what buyers search for (car models, area)." });
  else if (bio.length > DESC_LIMIT) issues.push({ key: "bio", text: `Google shows about the first ${DESC_LIMIT} characters of your bio. Put the cars you sell and your area first.` });
  if (!agentLocation(p)) issues.push({ key: "location", text: "Add your city and state (Contact & Location). Buyers search \"car agent <area>\"." });
  else if (agentPageTitle(p).length > TITLE_LIMIT) issues.push({ key: "title", text: "Your title is long enough that Google will cut the end off. A shorter city name helps, e.g. \"Kuala Lumpur\" instead of \"Wilayah Persekutuan Kuala Lumpur\"." });
  return issues;
}
