// Single source of truth for the documents that make a listing believable.
//
// A buyer can't verify a claim ("well maintained", "verified") — they can only
// verify a file they open themselves. These four are the ones worth naming and
// asking for by name; everything else stays in the free-form document list.
//
// Used by CarForm (the upload slots + publish gate) and the public listing page.
// Keep every caller on this list rather than re-declaring the keys inline, or
// the form and the listing page will drift apart.

export const TRUST_DOCS = [
  {
    key: "registration_card",
    label: "Geran / Registration Card",
    short: "Geran",
    hint: "The JPJ registration card — proves the car exists and who owns it.",
    required: true,
  },
  {
    key: "puspakom",
    label: "Puspakom Inspection",
    short: "Puspakom",
    hint: "B5 or B7 report, if the car has already been inspected.",
  },
  {
    key: "service_history",
    label: "Service History",
    short: "Service history",
    hint: "Workshop invoices or the stamped service book.",
  },
  {
    key: "loan_clearance",
    label: "Loan Clearance Letter",
    short: "Loan clearance",
    hint: "Bank settlement letter — proves there's no outstanding finance.",
  },
];

export const TRUST_DOC_KEYS = TRUST_DOCS.map((d) => d.key);

// The geran is required to publish, but there are two legitimate reasons a
// seller genuinely cannot attach one. Declaring the reason is not an escape
// hatch — it gets published on the listing, so the buyer learns it up front
// instead of at the deposit stage.
export const GERAN_REASONS = [
  {
    value: "under_hp",
    label: "Still under HP — the bank holds the geran",
    buyerLabel: "Geran held by the bank — car is still under hire purchase",
  },
  {
    value: "unregistered",
    label: "Recon unit — not registered in Malaysia yet",
    buyerLabel: "Unregistered recon unit — no Malaysian geran issued yet",
  },
];

export const geranStatusLabel = (status) =>
  status === "held"
    ? "Geran on file"
    : GERAN_REASONS.find((r) => r.value === status)?.buyerLabel || null;

const TIER_LABELS = [
  "No documents",
  "Partly documented",
  "Documented",
  "Fully documented",
];

// How many of the four named documents are attached, and which one to ask for
// next. Drives the meter in CarForm and the tier shown to buyers.
export function getTrustTier(carDocuments) {
  const docs = Array.isArray(carDocuments) ? carDocuments : [];
  const has = (key) => docs.some((d) => d?.type === key);
  const count = TRUST_DOCS.filter((t) => has(t.key)).length;
  const level = count >= 4 ? 3 : count >= 2 ? 2 : count === 1 ? 1 : 0;
  return {
    count,
    total: TRUST_DOCS.length,
    level,
    label: TIER_LABELS[level],
    nextMissing: TRUST_DOCS.find((t) => !has(t.key)) || null,
  };
}
