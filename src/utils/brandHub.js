// BRAND-HUB (owner 2026-11-25): /new-cars/:brand, one page per new-car brand. The SPA page
// (BrandHubPage.jsx) and the crawler page (api/og.js) both read THIS file, so they cannot
// disagree. Every number is computed from new_car_models rows (Peninsular, on the road without
// insurance) and every photo is ours (new_car_model_media). No claim, rebate or promotion is
// written here: promos expire and nothing in the database holds one.
//
// The keyword list in docs/BRAND_SEO_KEYWORDS.md comes from what ranks in Google Malaysia
// (ZigWheels, Paultan, Carlist, SoyaCincau, PCauto: "<brand> price", "<brand> price list",
// "<brand> SUV / hybrid / electric / 7 seater", "<model> price / variants / specs", Malay
// "harga kereta <brand>"). The page answers those with real rows: sections and FAQ, no stuffing.
import { slugPart, modelDisplayName, aliasOf } from "./newCars.js";
import { loanMonthly, loanRate, loanPath, rmLoan } from "./brandLoan.js";

export const hubPath = (brand) => `/new-cars/${slugPart(brand)}`;

// Budget lines a buyer searches ("under RM100k"). A band is shown only when it holds a model
// the previous shown band did not, and never when it already holds every model.
export const BUDGET_BANDS = [50000, 80000, 100000, 150000, 200000, 300000];

const rmK = (n) => `RM${Math.round(n / 1000)}k`;
const isHybrid = (f) => /hybrid/i.test(f || "");
const isEv = (f) => /^electric$/i.test(f || "");

// Rows (one brand, active) + media {model: [urls]} in; one entry per model, cheapest first.
export function hubModels(brand, rows, media = {}) {
  const by = new Map();
  for (const r of rows || []) {
    if (r.is_active === false || r.brand !== brand) continue;
    const price = Number(r.price_peninsular);
    if (!(price > 0)) continue;
    if (!by.has(r.model)) by.set(r.model, []);
    by.get(r.model).push(r);
  }
  return [...by.entries()].map(([model, vs]) => {
    const prices = vs.map((r) => Number(r.price_peninsular));
    const seats = Math.max(0, ...vs.map((r) => Number(r.specs?.seats) || 0));
    const cheapest = vs.slice().sort((a, b) => Number(a.price_peninsular) - Number(b.price_peninsular))[0];
    return {
      model,
      name: modelDisplayName(brand, model),
      path: `/new-cars/${slugPart(brand)}/${slugPart(model)}`,
      from: Math.min(...prices),
      to: Math.max(...prices),
      nVariants: vs.length,
      cheapestVariant: cheapest.variant,
      body: vs[0].body_type || null,
      fuels: [...new Set(vs.map((r) => r.fuel_type).filter(Boolean))],
      seats: seats || null,
      photo: (media[model] || []).filter(Boolean)[0] || null,
    };
  }).sort((a, b) => a.from - b.from);
}

const list = (ms) => ms.map((m) => m.name).join(", ");

// The extra sections, each one a search a buyer makes, each from real rows.
export function hubGroups(brand, models) {
  const out = [];
  const bodies = [...new Set(models.map((m) => m.body).filter(Boolean))];
  for (const body of bodies) {
    const ms = models.filter((m) => m.body === body);
    if (ms.length === models.length && bodies.length === 1) continue; // same as the full list
    out.push({ key: `body-${slugPart(body)}`, h2: `${brand} ${body} models`, ms,
      text: `${brand} ${body} ${ms.length === 1 ? "model" : "models"} on sale: ${list(ms)}.` });
  }
  const hyb = models.filter((m) => m.fuels.some(isHybrid));
  if (hyb.length) out.push({ key: "hybrid", h2: `${brand} hybrid cars`, ms: hyb,
    text: `${brand} hybrids, including plug-in hybrids: ${list(hyb)}.` });
  const ev = models.filter((m) => m.fuels.some(isEv));
  if (ev.length) out.push({ key: "electric", h2: `${brand} electric cars (EV)`, ms: ev,
    text: `${brand} electric cars: ${list(ev)}.` });
  const seven = models.filter((m) => m.seats && m.seats >= 7);
  if (seven.length) out.push({ key: "seven-seater", h2: `${brand} 7-seater cars`, ms: seven,
    text: `${brand} cars with seven seats or more: ${list(seven)}.` });
  let prev = "";
  for (const band of BUDGET_BANDS) {
    const ms = models.filter((m) => m.from <= band);
    const id = ms.map((m) => m.model).join("|");
    if (!ms.length || id === prev) continue;
    if (ms.length === models.length) break; // the whole list again adds nothing
    prev = id;
    out.push({ key: `under-${band}`, h2: `${brand} cars under RM${band.toLocaleString("en-MY")}`, ms,
      text: `${brand} models with a variant at or under RM${band.toLocaleString("en-MY")} (Peninsular, on the road without insurance): ${list(ms)}.` });
  }
  return out;
}

export function hubFaqs(brand, models, today = new Date()) {
  if (!models.length) return [];
  const rate = loanRate(brand);
  const cheap = models[0];
  const top = models.slice().sort((a, b) => b.to - a.to)[0];
  const mo = loanMonthly(cheap.from, { years: 9, rate });
  const nVar = models.reduce((s, m) => s + m.nVariants, 0);
  const faqs = [
    { q: `How much is a new ${brand} in Malaysia in ${today.getFullYear()}?`,
      a: `${brand} prices start from ${rmLoan(cheap.from)} (${cheap.name} ${cheap.cheapestVariant}) and go up to ${rmLoan(top.to)} (${top.name}). These are the official Peninsular Malaysia prices, on the road without insurance, across ${nVar} ${nVar === 1 ? "variant" : "variants"}.` },
    { q: `Which ${brand} models are on sale in Malaysia?`,
      a: `${models.length} ${brand} ${models.length === 1 ? "model is" : "models are"} listed on Drevo: ${list(models)}.` },
    { q: `What is the cheapest ${brand}?`,
      a: `The ${cheap.name} ${cheap.cheapestVariant} at ${rmLoan(cheap.from)}.` },
    { q: `What is the most expensive ${brand}?`,
      a: `The ${top.name}, up to ${rmLoan(top.to)} for its top variant.` },
  ];
  const ev = models.filter((m) => m.fuels.some(isEv));
  const hyb = models.filter((m) => m.fuels.some(isHybrid));
  if (ev.length || hyb.length) {
    const bits = [ev.length ? `electric: ${list(ev)}` : null, hyb.length ? `hybrid: ${list(hyb)}` : null].filter(Boolean).join("; ");
    faqs.push({ q: `Does ${brand} have hybrid or electric cars in Malaysia?`, a: `Yes. ${bits[0].toUpperCase()}${bits.slice(1)}.` });
  }
  const seven = models.filter((m) => m.seats && m.seats >= 7);
  if (seven.length) faqs.push({ q: `Is there a 7-seater ${brand}?`, a: `Yes: ${list(seven)}.` });
  if (mo) faqs.push({ q: `What is the monthly instalment for a ${brand}?`,
    a: `For the ${cheap.name} ${cheap.cheapestVariant} (${rmLoan(cheap.from)}) with a 10% deposit over 9 years at ${rate}% EIR, about ${rmLoan(mo)} a month. It is an estimate: the bank sets the rate and approval. Work out any ${brand} variant on the ${brand} loan calculator.` });
  faqs.push({ q: `Do ${brand} prices include insurance?`,
    a: `No. They are on the road without insurance, for Peninsular Malaysia. Sabah, Sarawak, Labuan and Langkawi have their own prices, shown on each model page.` });
  faqs.push({ q: `How do I buy a new ${brand} through Drevo?`,
    a: `Open a model, compare the sales advisors who list it, and message one directly. The price is the brand's, so the advisor is what differs: how fast they reply and what they arrange for you.` });
  return faqs;
}

export function hubCopy(brand, models, today = new Date()) {
  const year = today.getFullYear();
  const n = models.length;
  const cheap = models[0];
  const top = models.slice().sort((a, b) => b.to - a.to)[0];
  const names = models.slice(0, 4).map((m) => m.name).join(", ");
  const rate = loanRate(brand);
  const alias = models.some((m) => aliasOf(brand, m.model));
  const malayHead = `Harga ${brand} ${year} Malaysia`;
  return {
    title: `${brand} Price List Malaysia ${year} | ${n} New ${n === 1 ? "Model" : "Models"} | Drevo`,
    h1: `New ${brand} price in Malaysia ${year}`,
    description: `${n} new ${brand} ${n === 1 ? "model" : "models"} from ${rmLoan(cheap.from)} to ${rmLoan(top.to)} (Peninsular, on the road without insurance): ${names}${n > 4 ? " and more" : ""}. Compare variants and message an advisor.`,
    intro: `${brand} sets one official price for every showroom in your region, so on Drevo you compare models and then the advisor who sells it. ${n} ${brand} ${n === 1 ? "model is" : "models are"} listed, from ${rmLoan(cheap.from)} (${cheap.name}) to ${rmLoan(top.to)} (${top.name}), on the road without insurance for Peninsular Malaysia.${alias ? " Omoda and Jaecoo are sold together in Malaysia (Omoda | Jaecoo)." : ""}`,
    malay: {
      h2: malayHead,
      text: `Harga ${brand} bermula dari ${rmLoan(cheap.from)} (${cheap.name} ${cheap.cheapestVariant}) hingga ${rmLoan(top.to)} (${top.name}), harga rasmi Semenanjung Malaysia atas jalan tanpa insurans. Senarai model: ${list(models)}. Untuk anggaran ansuran bulanan (EIR ${rate}%), guna kalkulator loan ${brand}.`,
      loanLabel: `Kalkulator loan ${brand}`,
      loanHref: loanPath(brand),
    },
  };
}

// schema.org: an ItemList of the models (name, url, image, lowest price) + the FAQ + breadcrumbs.
export function hubJsonLd(brand, models, faqs, siteUrl) {
  const url = `${siteUrl}${hubPath(brand)}`;
  return [
    {
      "@context": "https://schema.org", "@type": "ItemList", name: `New ${brand} models in Malaysia`, url,
      itemListElement: models.map((m, i) => ({
        "@type": "ListItem", position: i + 1, url: `${siteUrl}${m.path}`, name: m.name,
        ...(m.photo ? { image: m.photo } : {}),
      })),
    },
    faqs.length ? {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faqs.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    } : null,
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Drevo", item: siteUrl },
        { "@type": "ListItem", position: 2, name: `New ${brand}`, item: url },
      ],
    },
  ].filter(Boolean);
}

// The keyword set behind a brand page (docs/BRAND_SEO_KEYWORDS.md). Patterns are the ones the
// Google Malaysia results for each brand were built on; each is answered by a section or FAQ above.
export function brandKeywords(brand, models, year = new Date().getFullYear()) {
  const b = brand.toLowerCase();
  const k = new Set([
    `${b} price malaysia`, `${b} price malaysia ${year}`, `${b} price list`, `${b} price list ${year}`,
    `${b} cars price malaysia`, `${b} models malaysia`, `new ${b} malaysia`, `new ${b} price`, `${b} car price`,
    `${b} otr price`, `${b} on the road price`, `${b} loan calculator`, `${b} car loan`, `${b} monthly instalment`,
    `${b} down payment`, `${b} cheapest model`, `${b} all models`,
    `harga kereta ${b}`, `harga kereta ${b} ${year}`, `senarai harga ${b}`, `harga ${b} baru`, `kereta ${b} baru`,
    `kalkulator loan ${b}`, `ansuran bulanan ${b}`,
  ]);
  for (const g of hubGroups(brand, models)) {
    if (g.key === "hybrid") { k.add(`${b} hybrid`); k.add(`${b} hybrid price malaysia`); }
    else if (g.key === "electric") { k.add(`${b} ev`); k.add(`${b} electric car malaysia`); k.add(`${b} ev price malaysia`); }
    else if (g.key === "seven-seater") { k.add(`${b} 7 seater`); k.add(`${b} mpv`); }
    else if (g.key.startsWith("body-")) { k.add(`${b} ${g.key.slice(5)}`); k.add(`${b} ${g.key.slice(5)} price malaysia`); }
    else if (g.key.startsWith("under-")) { k.add(`${b} under ${rmK(Number(g.key.slice(6)))}`); k.add(`${b} car below rm${Number(g.key.slice(6)) / 1000}k`); }
  }
  for (const m of models) {
    const n = m.name.toLowerCase();
    [`${n} price malaysia`, `${n} price ${year}`, `${n} variants`, `${n} specs`, `${n} review`, `harga ${n}`,
     `${n} loan`, `${n} instalment`, `${n} vs`].forEach((x) => k.add(x));
  }
  return [...k];
}
