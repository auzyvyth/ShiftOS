// LOAN-SEO (2026-11-22): /kalkulator-loan/:brand, one page per new-car brand.
// Searches like "kalkulator loan perodua", "kira loan myvi", "perodua loan
// calculator excel" land on third-party pages that still quote FLAT rates; this
// page answers with every variant's official price (new_car_models) and the
// monthly on the reducing balance (EIR), as the Hire-Purchase (Amendment) Act
// 2026 requires for new agreements from 1 June 2026.
//
// Shared by the SPA page (BrandLoanPage.jsx), the crawler render (api/og.js) and
// the sitemap. Every number comes from the rows or from financing.js; nothing
// here invents a price, a rebate or an approval.

import { monthlyPayment, flatToEir, DEFAULT_EIR } from "./financing.js";
import { LOCAL_NEW_EIR, isLocalNew, variantExtras, salaryGuide, SALARY_SHARE } from "./liveMaths.js";
import { calcRoadTaxEst, calcInsuranceAnnual, estAnnualFuel } from "./ownership.js";
import { LIVE_COPY } from "../components/live/liveCopy.js";
import { NEW_CAR_BRANDS, slugPart, newModelPath } from "./newCars.js";

export const LOAN_BASE = "/kalkulator-loan";
export const LOAN_TENURES = [5, 7, 9];
export const LOAN_DEPOSIT_PCT = 10;
export const LOAN_DEPOSITS = [0, 10, 20];
// The flat rate other pages quote, shown converted so a buyer can compare.
export const COMPARE_FLAT = 3;

export const loanPath = (brand) => `${LOAN_BASE}/${slugPart(brand)}`;
export const loanBrandFromSlug = (s) =>
  NEW_CAR_BRANDS.find((b) => slugPart(b) === String(s || "").toLowerCase()) || null;

// Same rate the model page and the Live presenter use for a new car.
export const loanRate = (brand) => (isLocalNew({ condition: "new", brand }) ? LOCAL_NEW_EIR : DEFAULT_EIR);

export function loanMonthly(price, { depositPct = LOAN_DEPOSIT_PCT, years = 7, rate } = {}) {
  const p = Number(price) || 0;
  if (p <= 0) return null;
  const loan = p * (1 - (Number(depositPct) || 0) / 100);
  if (loan <= 0) return 0;
  return Math.round(monthlyPayment(loan, rate, years * 12));
}

export const rmLoan = (n) => (n == null ? "-" : "RM " + Number(n).toLocaleString("en-MY", { maximumFractionDigits: 0 }));

// Rows (one brand, active) in; models sorted by cheapest variant out. Only
// Peninsular prices are quoted: other zones differ and say so on the page.
export function loanModels(brand, rows) {
  const by = new Map();
  for (const r of rows || []) {
    if (r.is_active === false || r.brand !== brand) continue;
    const price = Number(r.price_peninsular);
    if (!(price > 0)) continue;
    if (!by.has(r.model)) by.set(r.model, []);
    by.get(r.model).push({ id: r.id, model_id: r.id, variant: r.variant, price, specs: r.specs || null });
  }
  return [...by.entries()]
    .map(([model, variants]) => ({
      model,
      path: newModelPath(brand, model),
      variants: variants.sort((a, b) => a.price - b.price),
      from: Math.min(...variants.map((v) => v.price)),
    }))
    .sort((a, b) => a.from - b.from);
}

// Every word on the page that carries a number. Malay first (that is what is
// searched), English terms inside so "perodua loan calculator" matches too.
export function loanCopy(brand, models, today = new Date()) {
  const rate = loanRate(brand);
  const year = today.getFullYear();
  const names = models.slice(0, 4).map((m) => m.model).join(", ");
  const cheap = models[0];
  const cheapV = cheap?.variants[0];
  const cheapMo = cheapV ? loanMonthly(cheapV.price, { years: 9, rate }) : null;
  const flatEir9 = Math.round(flatToEir(COMPARE_FLAT, 108) * 100) / 100;
  const flatMo = cheapV ? Math.round((cheapV.price * 0.9 * (1 + (COMPARE_FLAT / 100) * 9)) / 108) : null;
  const nVariants = models.reduce((s, m) => s + m.variants.length, 0);

  const faqs = [];
  if (cheapV) {
    faqs.push({
      q: `Berapa ansuran bulanan ${brand} ${cheap.model} paling murah?`,
      a: `${brand} ${cheap.model} ${cheapV.variant} berharga ${rmLoan(cheapV.price)} (harga rasmi Semenanjung, atas jalan tanpa insurans). Dengan deposit 10% dan pinjaman 9 tahun pada ${rate}% EIR, ansurannya lebih kurang ${rmLoan(cheapMo)} sebulan. Bank yang menentukan kadar sebenar dan sama ada pinjaman lulus.`,
    });
  }
  faqs.push({
    q: "Kenapa kalkulator ini guna EIR, bukan kadar flat?",
    a: `Akta Sewa Beli (Pindaan) 2026 berkuat kuasa 1 Jun 2026: perjanjian sewa beli baru dikira atas baki berkurangan, dalam EIR. Banyak kalkulator lain masih guna kadar flat. ${COMPARE_FLAT}% flat selama 9 tahun sama dengan lebih kurang ${flatEir9}% EIR, jadi bandingkan dalam EIR sebelum memilih bank.`,
  });
  if (cheapV) {
    faqs.push({
      q: `Kenapa angka saya lain dengan kalkulator ${brand} yang lain?`,
      a: `Biasanya sebab kadar flat. Contoh ${brand} ${cheap.model} ${cheapV.variant}: pada ${COMPARE_FLAT}% flat, 9 tahun, deposit 10%, ansurannya ${rmLoan(flatMo)} sebulan; pada ${rate}% EIR ia ${rmLoan(cheapMo)}. Kadar yang bank tawarkan kepada anda yang menentukan, jadi taip kadar itu dalam kalkulator di atas.`,
    });
  }
  for (const m of models.slice(0, 3)) {
    const g = modelGuide(brand, m, rate);
    if (g.picks.length < 2) continue;
    faqs.push({
      q: `Varian ${brand} ${m.model} mana patut saya pilih?`,
      a: g.picks.map((p) => `${p.labels.join(" dan ")}: ${p.variant} (${rmLoan(p.price)}), ${p.why[0]}`).join(" "),
    });
  }
  if (cheapV) {
    const sal = salaryGuide(cheapMo);
    faqs.push({
      q: `Gaji berapa untuk ambil ${brand} ${cheap.model}?`,
      a: `Untuk ${brand} ${cheap.model} ${cheapV.variant} dengan ansuran ${rmLoan(cheapMo)} sebulan (deposit 10%, 9 tahun), panduan ${Math.round(SALARY_SHARE * 100)}% gaji bersih memberi gaji bersih sekitar ${rmLoan(sal)} ke atas. Komitmen lain, CCRIS dan CTOS juga dikira. Bank yang memutuskan.`,
    });
  }
  faqs.push({
    q: "Ada template Excel untuk kira loan kereta?",
    a: "Ada, percuma. Artikel Cara Kira Loan Kereta Guna Excel menerangkan formula PMT, cara tukar kadar flat ke EIR dan ada template Excel untuk dimuat turun. Halaman ini pula sudah kira setiap varian, jadi tak perlu Excel untuk semak cepat.",
  });
  faqs.push({
    q: "Harga ini termasuk insurans dan cukai jalan?",
    a: `Tidak. Harga ialah harga rasmi ${brand} untuk Semenanjung, atas jalan tanpa insurans. Sabah, Sarawak, Labuan dan Langkawi ada harga lain. Insurans boleh dimasukkan dalam pinjaman, jadi ansuran sebenar biasanya sedikit lebih tinggi.`,
  });
  faqs.push({
    q: `Saya sales advisor ${brand}. Boleh guna kalkulator ini masa live TikTok?`,
    a: "Boleh. Live presentation Drevo tunjuk harga, deposit dan ansuran 5, 7 dan 9 tahun untuk setiap kereta anda, besar dan jelas untuk kamera. Versi asas percuma.",
  });

  return {
    rate,
    title: `Kalkulator Loan ${brand} ${year}: Ansuran Bulanan ${names} (EIR) | Drevo`,
    h1: `Kalkulator Loan ${brand} ${year}`,
    description: `Ansuran bulanan setiap varian ${brand} (${nVariants} varian): ${names}. Harga rasmi, deposit 10%, 5, 7 dan 9 tahun, dikira dalam EIR ikut Akta Sewa Beli 2026. ${brand} loan calculator Malaysia.`,
    intro: cheapV
      ? `Ansuran ${brand} bermula lebih kurang ${rmLoan(cheapMo)} sebulan (${cheap.model} ${cheapV.variant}, deposit 10%, 9 tahun, ${rate}% EIR). Pilih model dan varian di bawah, tukar deposit, tempoh dan kadar, atau lihat jadual semua varian.`
      : `Pilih model dan varian ${brand} di bawah untuk kira ansuran bulanan.`,
    faqs,
  };
}

export function loanFaqLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

// ── Long-form guide (2026-11-22, owner: "make them longer", like stereng.com's
// "premium pick / budget pick"). Every sentence is built from new_car_models
// (price + specs, sourced per row) or the app's own formulas. The picks are
// RULES over the spec sheet, never taste: cheapest, cheapest with AEB, most
// added items per RM1,000, most complete. Additions only (variantExtras):
// spec sheets leave things out, so "loses X" would be a false claim.

const AEB = /autonomous emergency braking/i;
const ms = LIVE_COPY.ms;

const fuelOf = (specs) => {
  const kml = Number(specs?.fuel_kml);
  if (!(kml > 0)) return null;
  return estAnnualFuel({ fuel_type: "petrol", fuel_consumption: 100 / kml })?.rm ?? null;
};

// One plain line of facts for a model, from its cheapest variant's specs.
export function modelFactLine(specs) {
  const s = specs || {};
  const bits = [
    s.engine ? `enjin ${s.engine}${s.power_ps ? ` (${s.power_ps} PS)` : ""}` : null,
    s.range_km ? `jarak ${s.range_km} km sekali cas` : null,
    s.seats ? `${s.seats} tempat duduk` : null,
    s.boot_l ? `but ${s.boot_l} liter` : null,
    s.fuel_kml ? `${s.fuel_kml} km/liter (angka pengeluar)` : null,
    s.ncap || null,
    s.warranty ? `waranti ${s.warranty}` : null,
  ].filter(Boolean);
  const line = bits.join(", ");
  return line ? `${line[0].toUpperCase()}${line.slice(1)}.` : "";
}

// What the spec list cannot say: gearbox (only in the variant NAME, e.g.
// "1.0 G Manual" -> "1.0 G Auto"), a bigger engine, more airbags.
function stepBasics(below, v) {
  const out = [];
  if (/manual/i.test(below.variant) && !/manual/i.test(v.variant)) out.push("gear automatik");
  const e1 = below.specs?.engine, e2 = v.specs?.engine;
  if (e1 && e2 && e1 !== e2) out.push(`enjin ${e2}${v.specs.power_ps ? ` (${v.specs.power_ps} PS)` : ""}`);
  const a1 = Number(below.specs?.airbags), a2 = Number(v.specs?.airbags);
  if (a1 && a2 && a2 > a1) out.push(`${a2} airbags`);
  return out;
}

const moDiff = (a, b, rate) => (loanMonthly(a, { years: 9, rate }) || 0) - (loanMonthly(b, { years: 9, rate }) || 0);

// Picks + step-ups + yearly costs for one model. Pure; both renderers use it.
export function modelGuide(brand, m, rate) {
  const vs = m.variants;
  const name = `${brand} ${m.model}`;
  const steps = vs.slice(1).map((v) => {
    const below = vs[vs.indexOf(v) - 1];
    const ex = variantExtras(vs, v, 6);
    return { variant: v.variant, over: below.variant, plus: v.price - below.price, plusMo: moDiff(v.price, below.price, rate), items: [...stepBasics(below, v), ...ex.items].slice(0, 7), seats: ex.seats };
  });
  const first = vs[0];
  const firstItems = variantExtras(vs, first, 4).items;
  const picks = [];
  const add = (label, v, why) => {
    const hit = picks.find((p) => p.variant === v.variant);
    if (hit) { hit.labels.push(label); hit.why.push(why); } else picks.push({ variant: v.variant, price: v.price, labels: [label], why: [why] });
  };
  add("Paling jimat", first, `harga paling rendah, ${rmLoan(loanMonthly(first.price, { years: 9, rate }))} sebulan untuk 9 tahun${firstItems.length ? `; sudah ada ${firstItems.join(", ")}` : ""}.`);
  if (vs.some((v) => v.specs)) {
    const safe = vs.find((v) => (v.specs?.safety || []).some((x) => AEB.test(x)));
    if (safe && safe !== first) {
      add("Pilihan keselamatan", safe, `varian termurah dengan brek kecemasan automatik (AEB), tambah ${rmLoan(safe.price - first.price)} atau lebih kurang ${rmLoan(moDiff(safe.price, first.price, rate))} sebulan berbanding ${first.variant}.`);
    } else if (safe === first) {
      add("Pilihan keselamatan", first, "semua varian sudah ada brek kecemasan automatik (AEB).");
    }
    const value = steps.filter((x) => x.items.length >= 2 && x.plus > 0)
      .map((x) => ({ ...x, score: x.items.length / (x.plus / 1000) }))
      .sort((a, b) => b.score - a.score)[0];
    if (value && vs.length > 2) {
      const v = vs.find((x) => x.variant === value.variant);
      add("Paling banyak ciri bagi setiap ringgit", v, `berbanding ${value.over}, tambah ${value.items.length} ciri (${value.items.join(", ")}) untuk ${rmLoan(value.plus)} lagi, kira-kira ${rmLoan(value.plusMo)} sebulan.`);
    }
  }
  const top = vs[vs.length - 1];
  if (vs.length > 1) add("Paling lengkap", top, `varian tertinggi, ${rmLoan(top.price)} atau ${rmLoan(loanMonthly(top.price, { years: 9, rate }))} sebulan untuk 9 tahun.`);

  const cc = first.specs?.engine_cc;
  const fuel = fuelOf(first.specs);
  const mo9 = loanMonthly(first.price, { years: 9, rate });
  const costs = {
    roadTax: cc ? calcRoadTaxEst(cc) : null,
    insurance: cc ? calcInsuranceAnnual(first.price, cc) : null,
    fuel,
    salary: salaryGuide(mo9),
    mo9,
  };
  return { name, facts: modelFactLine(first.specs), picks, steps, costs, source: first.specs?.spec_source || null };
}

// Brand-wide reading, after the tables: how the sum works, deposit, salary,
// documents, how to buy safely. Sections of { h, p: [..], list?: [..] }.
export function loanSections(brand, models, rate) {
  const cheap = models[0]?.variants[0];
  const out = [];
  if (cheap) {
    const loan = Math.round(cheap.price * 0.9);
    const mo = loanMonthly(cheap.price, { years: 9, rate });
    out.push({
      h: `Cara kira loan ${brand} (formula)`,
      p: [
        `Ansuran bulanan = pinjaman x r x (1 + r)^n / ((1 + r)^n - 1), dengan r = kadar EIR setahun / 12 dan n = bilangan bulan. Ini cara baki berkurangan: faedah dikira atas baki yang masih tinggal, jadi bahagian faedah mengecil setiap bulan.`,
        `Contoh ${brand} ${models[0].model} ${cheap.variant}: harga ${rmLoan(cheap.price)}, deposit 10% (${rmLoan(cheap.price - loan)}), pinjaman ${rmLoan(loan)}. Pada ${rate}% EIR selama 108 bulan, ansurannya ${rmLoan(mo)} sebulan. Dalam Excel atau Google Sheets: =PMT(${rate}%/12, 108, -${loan}).`,
      ],
    });
    const rows = [0, 10, 20, 30].map((d) => `Deposit ${d}% (${rmLoan(Math.round(cheap.price * d / 100))}): ${rmLoan(loanMonthly(cheap.price, { depositPct: d, years: 9, rate }))} sebulan untuk 9 tahun, ${rmLoan(loanMonthly(cheap.price, { depositPct: d, years: 7, rate }))} untuk 7 tahun.`);
    out.push({
      h: "Deposit berapa yang patut?",
      p: [`Setiap RM1,000 deposit menurunkan ansuran dan jumlah faedah. Untuk ${brand} ${models[0].model} ${cheap.variant}:`],
      list: rows,
    });
  }
  out.push({
    h: "Tempoh 5, 7 atau 9 tahun?",
    p: [
      "Tempoh panjang menurunkan ansuran bulanan tetapi menaikkan jumlah faedah yang dibayar. Tempoh pendek pula ansurannya tinggi tetapi jumlah faedah jauh lebih rendah.",
      cheap ? `Contoh ${rmLoan(Math.round(cheap.price * 0.9))} pinjaman pada ${rate}% EIR: ${LOAN_TENURES.map((y) => `${y} tahun, faedah ${rmLoan(Math.round(loanMonthly(cheap.price, { years: y, rate }) * y * 12 - cheap.price * 0.9))}`).join("; ")}.` : "",
    ].filter(Boolean),
  });
  out.push({
    h: "Gaji berapa untuk ambil kereta ini?",
    p: [
      `Panduan biasa: ansuran kereta tidak lebih ${Math.round(SALARY_SHARE * 100)}% daripada gaji bersih. Gaji bersih minimum di jadual setiap model di atas dikira begitu. Bank juga melihat komitmen lain anda (DSR: jumlah semua hutang bulanan dibahagi gaji), rekod CCRIS dan CTOS. Panduan ini bukan kelulusan; bank yang memutuskan.`,
    ],
  });
  out.push({
    h: "Kadar flat vs EIR",
    p: [
      `Mulai 1 Jun 2026, Akta Sewa Beli (Pindaan) 2026 mewajibkan perjanjian sewa beli baru dikira atas baki berkurangan dan dinyatakan dalam EIR. Bank diberi tempoh peralihan hingga 31 Mac 2027, jadi sebut harga kadar flat masih ada.`,
      `Kadar flat nampak lebih rendah tetapi bukan perbandingan yang sama: ${COMPARE_FLAT}% flat bersamaan lebih kurang ${Math.round(flatToEir(COMPARE_FLAT, 60) * 100) / 100}% EIR untuk 5 tahun, ${Math.round(flatToEir(COMPARE_FLAT, 84) * 100) / 100}% untuk 7 tahun dan ${Math.round(flatToEir(COMPARE_FLAT, 108) * 100) / 100}% untuk 9 tahun. Minta bank nyatakan EIR sebelum anda bandingkan.`,
    ],
  });
  out.push({
    h: "Dokumen untuk mohon loan",
    p: [`Makan gaji: ${ms.docsList.employee.join(", ")}.`, `Berniaga sendiri: ${ms.docsList.self.join(", ")}.`, `${ms.docsNote} ${ms.docsPrivacy}`],
  });
  out.push({
    h: `Cara beli ${brand} baru dengan selamat`,
    p: [
      `Bayar yuran tempahan atau deposit hanya ke akaun rasmi syarikat ${brand} atau di kaunter bilik pameran, jangan sekali-kali ke akaun peribadi advisor.`,
      "Harga di halaman ini ialah harga rasmi atas jalan tanpa insurans untuk Semenanjung. Sabah, Sarawak, Labuan dan Langkawi ada harga lain. Rebat dan promosi bertukar setiap bulan, jadi tanya advisor apa yang berjalan bulan ini.",
    ],
  });
  return out;
}
