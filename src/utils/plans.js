import { PLAN_CONFIG, OPS_WHATSAPP } from './planConfig.js';
import { LITE_POSTERS_PER_MONTH } from './loanPoster.js';

/*
 * The seller plan catalogue, in ONE place.
 *
 * Price, listing cap and seat cap are NOT typed here. They are read out of
 * PLAN_CONFIG (src/utils/planConfig.js), which mirrors the `plan_config` table
 * that the listing-cap triggers actually enforce on. PlanPickerModal used to
 * hardcode its own copy of all three, so the pricing shown to a seller and the
 * caps enforced on them were two independent strings that could disagree — and
 * a price we display but do not charge is the worst kind of drift.
 *
 * What lives here is only what PLAN_CONFIG has no business holding: which
 * onboarding route a plan starts, the feature bullets, the trial line, and
 * which card is flagged most popular.
 *
 * There is deliberately NO buyer entry. Buying a car is not a plan — it has no
 * price and no cap — and putting a free "Buyer" card next to RM1,199 Dealer Pro
 * reframes browsing as a tier and gives every visitor a reason to click the
 * cheapest thing and leave. Buyers get in through the marketplace and are asked
 * to sign in only when they need something kept (see useSavedCars).
 */

// Salesman Premium's feature list, the ONE copy. The /for-salesmen landing
// page (salesmanLandingCopy.js), the Premium signup screen
// (SalesmanOnboarding.jsx) and the plan cards below all read it. Every line
// must be something the Premium panel actually does today: "priority
// marketplace placement" and a "custom profile subdomain" were advertised on
// all three for months and neither existed (nothing ranks by plan; no
// standalone salesman has a subdomain). A paid feature we describe but do not
// ship is a false claim to the person paying for it.
// Each line carries its Bahasa Melayu twin so the Malay-first /for-salesmen
// page reads the SAME list (SALESMAN_PREMIUM_FEATURES_MS) instead of a
// hand-kept translation that drifts. Lite is "get found, get the lead";
// working the lead is Premium (owner, 2026-10-13), which is why follow-up
// reminders, call logging, bulk WhatsApp, Telegram booking reminders, the
// services catalogue and page customisation are listed here and not on Lite.
// Live presentation: a BASIC version is on Lite (owner, 2026-10-18, cut down
// 2026-11-01, LIVE-BASIC); the full one (Budget, Viewer, Docs, rebates,
// insurance) is the first Premium line.
// No AI line (owner, 2026-10-28: "we don't have that yet"). Do not list an AI
// feature here until it ships for sellers.
const SALESMAN_PREMIUM_FEATURE_LINES = [
  { group: 'live', en: 'Full Live presentation: Budget + Viewer, Docs, totals, salary guide', ms: 'Live presentation penuh: Bajet + Penonton, Dokumen, jumlah bayaran, panduan gaji' },
  { group: 'dash', en: '"This week" call list + drafted follow-ups', ms: 'Senarai call "Minggu ini" + mesej follow up siap ditulis' },
  { group: 'dash', en: 'Follow-up reminders + call log', ms: 'Reminder follow up + log panggilan' },
  { group: 'leads', en: 'WhatsApp all your quiet leads in one go', ms: 'WhatsApp semua lead yang senyap sekali gus' },
  { group: 'calc', en: 'Loan desk: affordability check + bank comparison', ms: 'Loan desk: semak kemampuan + banding bank' },
  { group: 'leads', en: 'Handover checklist + customer list', ms: 'Senarai semak handover + senarai customer' },
  { group: 'more', en: 'TikTok poster studio for every car', ms: 'Studio poster TikTok untuk setiap kereta' },
  { group: 'dash', en: 'Commission tracking', ms: 'Jejak komisen' },
  { group: 'dash', en: 'Performance: close rate + where deals are lost', ms: 'Performance: close rate + di mana deal terlepas' },
  { group: 'more', en: 'Telegram booking reminders', ms: 'Reminder booking di Telegram' },
  { group: 'more', en: 'Services and add-ons catalogue', ms: 'Katalog servis dan add-on' },
  { group: 'more', en: 'Customise your page: bio + social links', ms: 'Ubah suai page anda: bio + link media sosial' },
];
export const SALESMAN_PREMIUM_FEATURES = SALESMAN_PREMIUM_FEATURE_LINES.map((l) => l.en);
export const SALESMAN_PREMIUM_FEATURES_MS = SALESMAN_PREMIUM_FEATURE_LINES.map((l) => l.ms);
const PRESENTATION = {
  salesman_lite: {
    tier: 'lite', route: '/salesman-onboarding/lite',
    // Lite = get found, get the lead (owner, 2026-10-13). The listing cap is
    // added by buildCard from PLAN_CONFIG, never typed here.
    features: [
      'Your own page at drevo.my/s/yourname',
      'Cars listed on the Drevo marketplace',
      'Buyers reach you by WhatsApp, chat + booking',
      'Live loan calculator for TikTok / FB lives: deposit, rebate, insurance + NCD',
      'Alerts on new leads',
      'Simple lead list with stages',
      'Views + WhatsApp taps for each car',
      'No credit card required',
    ],
  },
  salesman_full: {
    tier: 'premium', route: '/salesman-onboarding/premium',
    features: SALESMAN_PREMIUM_FEATURES,
  },
  dealer_starter: {
    tier: 'starter', route: '/dealer-onboarding/starter', trial: '14-day free trial',
    features: [
      'Full dealer dashboard',
      'Lead CRM + pipeline',
      'Analytics & reports',
      'Custom subdomain',
    ],
  },
  dealer_growth: {
    tier: 'growth', route: '/dealer-onboarding/growth', trial: '14-day free trial',
    popular: true,
    features: [
      'Everything in Starter',
      'Priority WhatsApp support',
      'Assisted onboarding & stock import',
    ],
  },
  dealer_pro: {
    tier: 'pro', route: '/dealer-onboarding/pro', trial: '14-day free trial',
    features: [
      'Everything in Growth',
      'AI Sales Manager chat',
      'Dedicated account manager',
      'SLA-backed uptime',
    ],
  },
};

function buildCard(planKey) {
  const cfg = PLAN_CONFIG[planKey];
  const pres = PRESENTATION[planKey];
  const caps = [];
  if (cfg.listingCap) caps.push(`Up to ${cfg.listingCap} listings`);
  if (cfg.seatCap) caps.push(cfg.seatCap === 1 ? '1 user' : `Team of ${cfg.seatCap}`);
  return {
    ...pres,
    planKey,
    label: cfg.label,
    price: cfg.price > 0 ? `RM ${cfg.price.toLocaleString('en-MY')}` : 'FREE',
    priceSub: cfg.price > 0 ? '/month' : 'forever',
    caps,
  };
}

const PF = PLAN_CONFIG.salesman_full;

export const SALESMAN_PLANS = ['salesman_lite', 'salesman_full'].map(buildCard);
export const DEALER_PLANS = ['dealer_starter', 'dealer_growth', 'dealer_pro'].map(buildCard);

// The three seller pricing cards (owner, 2026-11-03: "too cheap looking and too big").
// ONE copy of their words, EN + BM, read by /plans and /for-salesmen through
// PricingCards. Five short lines a card: the full feature list lives in the
// sections above the cards, not in them. Prices and caps come from PLAN_CONFIG.
const LITE = PLAN_CONFIG.salesman_lite;
const CARD_WORDS = {
  en: {
    per: '/month', free: 'Free', foundingBadge: 'Founding price', self: 'Or sign up yourself',
    lite: { name: 'Salesman Lite', desc: 'Get found and get the lead. Free, no card.', cta: 'Start free on WhatsApp',
      wa: "Hi, I'm a car salesman and want to start on Drevo Lite (free). Can you set it up for me?",
      features: ['Live loan calculator: rebate + insurance', `Up to ${LITE.listingCap} cars on your page`, 'Buyers reach you by WhatsApp, chat, booking', 'Alerts and a simple lead list', `${LITE_POSTERS_PER_MONTH} loan posters a month`] },
    premium: { name: 'Salesman Premium', desc: 'Work every lead until the deal closes.', cta: `Try ${PF.trialDays} days free on WhatsApp`,
      wa: `Hi, I'm a car salesman and want to try Drevo Premium free for ${PF.trialDays} days. Can you set it up for me?`,
      notes: [`Or RM${PF.yearlyPrice} a year, paid once (about 2 months free).`, `Founding price for the first ${PF.foundingSpots} sellers, yours while you stay. Then RM${PF.listPrice}.`],
      features: ['Everything in Lite', 'Full Live presentation: Budget, Viewer, Docs', '"This week" call list + drafted follow-ups', 'Loan desk + unlimited loan posters', `Up to ${PF.listingCap} cars`] },
    dfy: { name: 'Done for you', desc: 'Premium, set up for you by our team.', cta: 'WhatsApp us',
      wa: `Hi, I want Drevo Done for you (RM${PF.doneForYouPrice}/month).`,
      features: ['Everything in Premium', 'Your page set up for you', `Your first ${PF.doneForYouCars} cars uploaded from your photos`, 'Loan posters made for those cars', 'WhatsApp help when you get stuck'] },
  },
  ms: {
    per: '/bulan', free: 'Percuma', foundingBadge: 'Harga pengasas', self: 'Atau daftar sendiri',
    lite: { name: 'Salesman Lite', desc: 'Senang dijumpai, dapat lead. Percuma, tak perlu kad.', cta: 'Mula percuma di WhatsApp',
      wa: 'Hi, saya salesman kereta dan nak mula guna Drevo Lite (percuma). Boleh tolong setupkan?',
      features: ['Kalkulator loan live: rebat + insurans', `Sampai ${LITE.listingCap} kereta di page anda`, 'Pembeli hubungi melalui WhatsApp, chat, booking', 'Alert dan senarai lead ringkas', `${LITE_POSTERS_PER_MONTH} poster loan sebulan`] },
    premium: { name: 'Salesman Premium', desc: 'Follow up setiap lead sampai deal tutup.', cta: `Cuba ${PF.trialDays} hari percuma di WhatsApp`,
      wa: `Hi, saya salesman kereta dan nak cuba Drevo Premium percuma ${PF.trialDays} hari. Boleh tolong setupkan?`,
      notes: [`Atau RM${PF.yearlyPrice} setahun, bayar sekali (lebih kurang 2 bulan percuma).`, `Harga pengasas untuk ${PF.foundingSpots} seller pertama, kekal selagi melanggan. Lepas tu RM${PF.listPrice}.`],
      features: ['Semua dalam Lite', 'Live presentation penuh: Bajet, Penonton, Dokumen', 'Senarai call "Minggu ini" + mesej follow up', 'Loan desk + poster loan tanpa had', `Sampai ${PF.listingCap} kereta`] },
    dfy: { name: 'Kami setkan untuk anda', desc: 'Premium, disetkan oleh team kami.', cta: 'WhatsApp kami',
      wa: `Hi, saya nak Drevo Kami setkan untuk anda (RM${PF.doneForYouPrice}/bulan).`,
      features: ['Semua dalam Premium', 'Page anda disetkan untuk anda', `${PF.doneForYouCars} kereta pertama dimuat naik dari gambar anda`, 'Poster loan untuk kereta itu', 'Bantuan WhatsApp bila tersekat'] },
  },
};

export const PRICING_FEATURES_LABEL = { en: 'Features', ms: 'Ciri-ciri' };

// Every card's button opens WhatsApp for now (owner, 2026-11-05): at a handful
// of visitors a day the owner sets each account up by hand. The signup page is
// still one tap away as the small "sign up yourself" link (`selfTo`).
export const waLink = (text) => `https://wa.me/${OPS_WHATSAPP}?text=${encodeURIComponent(text)}`;

export function salesmanPricingCards(lang = 'en') {
  const w = CARD_WORDS[lang] || CARD_WORDS.en;
  return [
    { key: 'lite', ...w.lite, price: w.free, per: '', href: waLink(w.lite.wa), selfTo: PRESENTATION.salesman_lite.route, selfLabel: w.self },
    { key: 'premium', ...w.premium, price: `RM${PF.price}`, per: w.per, featured: true, badge: w.foundingBadge, href: waLink(w.premium.wa), selfTo: PRESENTATION.salesman_full.route, selfLabel: w.self },
    { key: 'dfy', ...w.dfy, price: `RM${PF.doneForYouPrice}`, per: w.per,
      href: waLink(w.dfy.wa) },
  ];
}
