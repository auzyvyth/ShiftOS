// After the sale: one read of where each buyer stands, shared by the Sold tab,
// the aftercare plans component and the "This week" call list so all three say
// the same thing about the same buyer.
//
// Three stages, in the order a buyer lives them:
//   handover  -> the paperwork checklist (useHandover owns the data)
//   renewals  -> insurance + road tax expiry on the customers row. Ticking the
//                handover insurance / road tax step fills these (DB trigger
//                trg_sync_customer_expiry), which is the link between stage 1 and 2.
//   aftercare -> the visits the seller promised (service_packages): an oil
//                change, a periodic service, a care visit. Each visit has a due
//                date on a fixed schedule, so the seller knows when to call.
//
// Pure functions, no React, no Supabase: `npm run test:aftercare`.

const DAY = 86400000;
export const RENEWAL_DUE_DAYS = 30;   // insurance / road tax inside this = due
export const SERVICE_DUE_DAYS = 14;   // an aftercare visit inside this = due
export const PLAN_EXPIRY_DAYS = 60;   // plan ending with visits unused

const daysUntil = (iso, now) => (iso ? Math.round((new Date(iso).getTime() - now.getTime()) / DAY) : null);

// What dealers actually give a buyer to keep them coming back. Visits and months
// are a starting point the seller can change before saving. Labels live in the
// i18n files under aftercare.presets.<key>.
export const AFTERCARE_PRESETS = [
  { key: "first_service", visits: 1, months: 6, name: "Free first service" },
  { key: "oil_change", visits: 2, months: 12, name: "Oil change" },
  { key: "periodic_service", visits: 4, months: 24, name: "Periodic service" },
  { key: "care_visit", visits: 2, months: 12, name: "Care visit (wash + check)" },
];

// Catalogue items that make sense as a repeat visit. PPF, tint, warranty and
// insurance are one-off add-ons sold on the deal, not something the buyer comes
// back for three times, so they are not offered as an aftercare plan.
export const AFTERCARE_CATEGORIES = ["service", "workshop", "other"];

const addMonths = (iso, months) => {
  const d = new Date(iso);
  const whole = Math.floor(months);
  d.setMonth(d.getMonth() + whole);
  const rest = months - whole;
  if (rest > 0) d.setDate(d.getDate() + Math.round(rest * 30.4));
  return d;
};

// Visit N is due at sold_at + N x (valid_months / total_visits). A fixed
// schedule, so it needs no visit rows and every surface computes the same date.
// A late visit does not push the next one back: "every 6 months" stays put.
export function nextVisitDue(pkg) {
  const total = Number(pkg?.total_visits) || 0;
  const used = Number(pkg?.used_visits) || 0;
  if (!pkg?.sold_at || total <= 0 || used >= total) return null;
  const months = Number(pkg.valid_months) || 12;
  let due = addMonths(pkg.sold_at, (months / total) * (used + 1));
  if (pkg.expires_at && due > new Date(pkg.expires_at)) due = new Date(pkg.expires_at);
  return due.toISOString().slice(0, 10);
}

// The one status per buyer for the Aftercare stage.
//   none | done | due | soon | active
export function aftercareSummary(pkgs = [], now = new Date()) {
  if (!pkgs.length) return { key: "none" };
  let best = null;
  for (const p of pkgs) {
    const left = Math.max(0, (p.total_visits || 0) - (p.used_visits || 0));
    const expiresIn = daysUntil(p.expires_at, now);
    if (left === 0 || (expiresIn !== null && expiresIn < 0)) continue;
    const due = nextVisitDue(p);
    const days = daysUntil(due, now);
    if (!best || (days ?? 9999) < (best.days ?? 9999)) best = { pkg: p, due, days, left, expiresIn };
  }
  if (!best) return { key: "done" };
  const key = best.days !== null && best.days <= 0 ? "due"
    : best.days !== null && best.days <= SERVICE_DUE_DAYS ? "soon" : "active";
  return { key, ...best };
}

// Insurance + road tax, soonest first. missing = no date on the record yet.
export function renewalSummary(c, now = new Date()) {
  const rows = [
    { field: "insurance_expiry", kind: "insurance", date: c?.insurance_expiry || null },
    { field: "road_tax_expiry", kind: "road_tax", date: c?.road_tax_expiry || null },
  ].map((r) => {
    const days = daysUntil(r.date, now);
    const key = days === null ? "missing" : days < 0 ? "overdue" : days <= RENEWAL_DUE_DAYS ? "due" : "ok";
    return { ...r, days, key };
  });
  const dated = rows.filter((r) => r.days !== null).sort((a, b) => a.days - b.days);
  const soonest = dated[0] || null;
  const key = !soonest ? "missing" : soonest.key;
  return { key, soonest, rows, missing: rows.filter((r) => r.key === "missing").length };
}

// "Coming up" on the Sold tab: what needs doing for which buyer, most urgent
// first, ONE row per buyer (extra reasons ride along as `also`). Raw data only;
// the UI turns it into words in the seller's language.
export function buildComingUp({ customers = [], handoverDeals = [], statusForLead, packagesByCustomer = {}, now = new Date() } = {}) {
  const items = [];
  const custByLead = new Map(customers.filter((c) => c.lead_id).map((c) => [c.lead_id, c]));

  for (const deal of handoverDeals) {
    const st = statusForLead ? statusForLead(deal.id) : null;
    if (!st || st.done) continue;
    const c = custByLead.get(deal.id);
    items.push({
      kind: "handover", rank: 1, weight: -(new Date(deal.updated_at || deal.created_at || now).getTime()),
      customerId: c?.id || null, leadId: deal.id,
      name: c?.name || deal.buyer_name || null, phone: c?.phone || deal.phone || null,
      progress: st.progress, next: st.next?.label || null,
    });
  }

  for (const c of customers) {
    const base = { customerId: c.id, leadId: c.lead_id || null, name: c.name || null, phone: c.phone || null };
    for (const r of renewalSummary(c, now).rows) {
      if (r.key !== "overdue" && r.key !== "due") continue;
      items.push({ ...base, kind: "renewal", rank: r.key === "overdue" ? 0 : 2, weight: r.days, renewal: r.kind, date: r.date, days: r.days });
    }
    for (const p of packagesByCustomer[c.id] || []) {
      const left = Math.max(0, (p.total_visits || 0) - (p.used_visits || 0));
      if (left === 0) continue;
      const expiresIn = daysUntil(p.expires_at, now);
      if (expiresIn !== null && expiresIn < 0) continue;
      const due = nextVisitDue(p);
      const days = daysUntil(due, now);
      if (days !== null && days <= SERVICE_DUE_DAYS) {
        items.push({ ...base, kind: "service", rank: 2, weight: days, plan: p.package_name, date: due, days, left });
      } else if (expiresIn !== null && expiresIn <= PLAN_EXPIRY_DAYS) {
        items.push({ ...base, kind: "plan_ending", rank: 3, weight: expiresIn, plan: p.package_name, date: p.expires_at, days: expiresIn, left });
      }
    }
  }

  items.sort((a, b) => a.rank - b.rank || a.weight - b.weight);
  const seen = new Map();
  for (const it of items) {
    const key = it.customerId ? `c:${it.customerId}` : `l:${it.leadId}`;
    const prev = seen.get(key);
    if (prev) { (prev.also ||= []).push(it); continue; }
    seen.set(key, it);
  }
  return [...seen.values()];
}
