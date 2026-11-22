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
import { LOCAL_NEW_EIR, isLocalNew } from "./liveMaths.js";
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
    by.get(r.model).push({ id: r.id, variant: r.variant, price });
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
