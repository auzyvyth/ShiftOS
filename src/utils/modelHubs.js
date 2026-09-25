// Brand + model landing pages ("hubs"): /used-cars, /used-cars/:brand,
// /used-cars/:brand/:model. ONE module shared by the SPA page
// (src/pages/UsedCarsHubPage.jsx), the crawler prerender (api/og.js) and the
// sitemap (api/sitemap.js), so the URL, the grouping and every sentence Google
// or an AI answer reads are computed in exactly one place.
//
// Every number in the copy comes from the rows passed in. Nothing here may
// state a price, rate or fact the data does not hold (see CLAUDE.md, AI trust
// boundary + legal rules): prices are "asking prices", counts are "on XDrive".
//
// Grouping goes through canonicalModel (src/utils/modelKey.js) — the same
// resolver the showroom model filter uses — on top of the DB trigger
// trg_normalize_car_model (migration 20260925a). One notion of "a model".

import { canonicalModel } from "./modelKey.js";

export const HUB_BASE = "/used-cars";
export const HUB_LIVE = ["available", "reserved"];
// Rows the hubs are built from. Small on purpose: the anon view is public.
export const HUB_ROW_COLS = "brand,model,status,selling_price,year,state";

export function hubSlug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function hubPath(brand, model) {
  if (!brand) return HUB_BASE;
  return model
    ? `${HUB_BASE}/${hubSlug(brand)}/${hubSlug(model)}`
    : `${HUB_BASE}/${hubSlug(brand)}`;
}

const rm = (n) => `RM ${Math.round(n).toLocaleString("en-MY")}`;

function summarise(rows) {
  const live = rows.filter((r) => HUB_LIVE.includes(r.status));
  const prices = live.map((r) => Number(r.selling_price)).filter((n) => n > 0);
  const years = live.map((r) => Number(r.year)).filter(Boolean);
  const states = [...new Set(live.map((r) => r.state).filter(Boolean))].sort();
  return {
    count: live.length,
    sold: rows.filter((r) => r.status === "sold").length,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
    states,
  };
}

// rows -> [{ brand, slug, path, ...summary, models: [{ model, slug, path, ...summary }] }]
// Only brands/models with at least one live car are returned: a hub over an
// empty filter is a dead end (same rule as the Hot Deals nav gate).
export function buildHubs(rows) {
  const byBrand = new Map();
  for (const r of rows || []) {
    if (!r?.brand || !r?.model) continue;
    const c = canonicalModel(r.brand, r.model);
    const brand = c.brand || String(r.brand).trim();
    const model = c.matched ? c.model : String(r.model).trim();
    const bk = hubSlug(brand);
    if (!byBrand.has(bk)) byBrand.set(bk, { brand, rows: [], models: new Map() });
    const b = byBrand.get(bk);
    b.rows.push(r);
    const mk = hubSlug(model);
    if (!b.models.has(mk)) b.models.set(mk, { model, rows: [], pairs: new Map() });
    const m = b.models.get(mk);
    m.rows.push(r);
    // The exact stored spellings behind this hub, so a page can fetch
    // precisely the cars it counted (see hubCarFilter).
    m.pairs.set(`${r.brand}\u0000${r.model}`, { brand: r.brand, model: r.model });
  }
  return [...byBrand.values()]
    .map((b) => ({
      brand: b.brand,
      slug: hubSlug(b.brand),
      path: hubPath(b.brand),
      ...summarise(b.rows),
      models: [...b.models.values()]
        .map((m) => ({ model: m.model, slug: hubSlug(m.model), path: hubPath(b.brand, m.model), pairs: [...m.pairs.values()], ...summarise(m.rows) }))
        .filter((m) => m.count > 0)
        .sort((x, y) => y.count - x.count || x.model.localeCompare(y.model)),
    }))
    .filter((b) => b.count > 0)
    .sort((x, y) => y.count - x.count || x.brand.localeCompare(y.brand));
}

// PostgREST or() filter selecting exactly the cars behind a hub:
// or=(and(brand.eq.Toyota,model.eq.Alphard),...). Values are quoted so a
// comma or bracket in a stored name cannot break out of the filter tree.
export function hubCarFilter(brand, model) {
  const q = (v) => `"${String(v).replace(/["\\]/g, "")}"`;
  const pairs = model ? model.pairs : brand.models.flatMap((m) => m.pairs);
  return pairs.map((p) => `and(brand.eq.${q(p.brand)},model.eq.${q(p.model)})`).join(",");
}

export function findHub(hubs, brandSlug, modelSlug) {
  const brand = hubs.find((b) => b.slug === brandSlug) || null;
  const model = brand && modelSlug ? brand.models.find((m) => m.slug === modelSlug) || null : null;
  return { brand, model };
}

function listStates(states) {
  if (!states.length) return "Malaysia";
  if (states.length <= 3) return states.join(", ");
  return `${states.slice(0, 3).join(", ")} and ${states.length - 3} more`;
}

// Page copy for a hub. `brand` is a buildHubs() brand entry; `model` optional.
export function hubCopy(brand, model) {
  if (!brand) {
    return {
      title: "Used Cars for Sale in Malaysia by Brand & Model | XDrive",
      description: "Browse used and recon cars for sale on XDrive by brand and model. Kereta terpakai dijual — compare asking prices and contact sellers directly.",
      h1: "Used cars by brand and model",
      intro: "Every brand and model with cars for sale on XDrive right now.",
      faqs: [],
    };
  }
  const h = model || brand;
  const name = model ? `${brand.brand} ${model.model}` : brand.brand;
  const price = h.minPrice == null ? "" : h.minPrice === h.maxPrice ? ` at ${rm(h.minPrice)}` : ` from ${rm(h.minPrice)} to ${rm(h.maxPrice)}`;
  const yearsTxt = h.minYear == null ? "" : h.minYear === h.maxYear ? `${h.minYear}` : `${h.minYear}–${h.maxYear}`;
  const carWord = h.count === 1 ? "car" : "cars";

  const faqs = [
    {
      q: `How much is a used ${name} on XDrive?`,
      a: `${h.count} used ${name} ${h.count === 1 ? "is" : "are"} listed on XDrive right now${price}${h.avgPrice && h.count > 1 ? `, averaging ${rm(h.avgPrice)}` : ""}. These are asking prices set by each seller — confirm the final price with the seller.`,
    },
  ];
  if (yearsTxt) {
    faqs.push({ q: `Which years of ${name} are for sale?`, a: `Listings on XDrive cover ${yearsTxt} ${name} models.` });
  }
  faqs.push({ q: `Where are the ${name} for sale located?`, a: `Cars are listed in ${listStates(h.states)}.` });
  if (!model && brand.models.length) {
    faqs.push({
      q: `Which ${brand.brand} models are for sale on XDrive?`,
      a: brand.models.map((m) => `${m.model} (${m.count})`).join(", ") + ".",
    });
  }
  if (h.sold > 0) {
    faqs.push({ q: `Have ${name} been sold on XDrive before?`, a: `Yes — ${h.sold} ${name} ${h.sold === 1 ? "has" : "have"} been sold through XDrive.` });
  }

  return {
    title: `Used ${name} for Sale in Malaysia | XDrive`,
    description: `${h.count} used ${name} ${carWord} for sale${price}${yearsTxt ? `, ${yearsTxt}` : ""}. ${name} terpakai dijual di ${listStates(h.states)}. Compare asking prices and contact sellers directly on XDrive.`,
    h1: `Used ${name} for sale`,
    intro: `${h.count} ${name} ${carWord} for sale on XDrive${price}${yearsTxt ? ` (${yearsTxt})` : ""}, in ${listStates(h.states)}.`,
    faqs,
  };
}

// Breadcrumb trail: [{ name, path }]
export function hubCrumbs(brand, model) {
  const c = [{ name: "Home", path: "/" }, { name: "Used cars", path: HUB_BASE }];
  if (brand) c.push({ name: brand.brand, path: brand.path });
  if (model) c.push({ name: model.model, path: model.path });
  return c;
}

export function faqLd(faqs) {
  return faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }
    : null;
}

export function breadcrumbLd(crumbs, site) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    // The current page may be passed with path: null — Google allows the last
    // crumb without an item URL.
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem", position: i + 1, name: c.name,
      ...(c.path == null ? {} : { item: `${site}${c.path === "/" ? "" : c.path}` }),
    })),
  };
}
