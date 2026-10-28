import { PLAN_CONFIG } from './planConfig.js';

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
// Live presentation moved to Lite (owner, 2026-10-18): it is on the Lite
// card below, never here.
// PremiumUpgradeCard drops every line matching /\bAI\b/ (English side), so
// keep "AI" spelled out in the AI lines.
const SALESMAN_PREMIUM_FEATURE_LINES = [
  { group: 'crm', en: '"This week" call list + drafted follow-ups', ms: 'Senarai call "Minggu ini" + mesej follow up siap ditulis' },
  { group: 'crm', en: 'Follow-up reminders + call log', ms: 'Reminder follow up + log panggilan' },
  { group: 'crm', en: 'WhatsApp all your quiet leads in one go', ms: 'WhatsApp semua lead yang senyap sekali gus' },
  { group: 'tools', en: 'Loan desk: affordability check + bank comparison', ms: 'Loan desk: semak kemampuan + banding bank' },
  { group: 'crm', en: 'Handover checklist + customer list', ms: 'Senarai semak handover + senarai customer' },
  { group: 'tools', en: 'AI listing captions + AI chat reply drafts', ms: 'Caption iklan AI + draf balasan chat AI' },
  { group: 'tools', en: 'TikTok poster studio for every car', ms: 'Studio poster TikTok untuk setiap kereta' },
  { group: 'crm', en: 'Commission tracking', ms: 'Jejak komisen' },
  { group: 'crm', en: 'Performance: close rate + where deals are lost', ms: 'Performance: close rate + di mana deal terlepas' },
  { group: 'crm', en: 'Telegram booking reminders', ms: 'Reminder booking di Telegram' },
  { group: 'crm', en: 'Services and add-ons catalogue', ms: 'Katalog servis dan add-on' },
  { group: 'page', en: 'Customise your page: bio + social links', ms: 'Ubah suai page anda: bio + link media sosial' },
];
export const SALESMAN_PREMIUM_FEATURES = SALESMAN_PREMIUM_FEATURE_LINES.map((l) => l.en);
export const SALESMAN_PREMIUM_FEATURES_MS = SALESMAN_PREMIUM_FEATURE_LINES.map((l) => l.ms);
// The same lines sorted into the three things a seller gets (page / live +
// loan tools / CRM dashboard), for the /for-salesmen offer and plan cards.
// Two leads read the old flat list as "a calculator" and missed the dashboard
// (owner, 2026-10-28), so the cards name the three parts.
export function salesmanPremiumFeaturesByGroup(lang = 'en') {
  const by = { page: [], tools: [], crm: [] };
  for (const l of SALESMAN_PREMIUM_FEATURE_LINES) by[l.group].push(lang === 'ms' ? l.ms : l.en);
  return by;
}

const PRESENTATION = {
  salesman_lite: {
    tier: 'lite', route: '/salesman-onboarding/lite',
    // Lite = get found, get the lead (owner, 2026-10-13). The listing cap is
    // added by buildCard from PLAN_CONFIG, never typed here.
    features: [
      'Your own page at xdrive.my/s/yourname',
      'Cars listed on the XDrive marketplace',
      'Buyers reach you by WhatsApp, chat + booking',
      'Live presentation for TikTok / FB lives',
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

export const SALESMAN_PLANS = ['salesman_lite', 'salesman_full'].map(buildCard);
export const DEALER_PLANS = ['dealer_starter', 'dealer_growth', 'dealer_pro'].map(buildCard);
