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

const PRESENTATION = {
  salesman_lite: {
    tier: 'lite', route: '/salesman-onboarding/lite',
    features: [
      'Auto-published to xdrive.my',
      'Direct WhatsApp enquiries',
      'Basic performance analytics',
      'No credit card required',
    ],
  },
  salesman_full: {
    tier: 'premium', route: '/salesman-onboarding/premium',
    features: [
      'Priority marketplace placement',
      'Advanced CRM automation',
      'Commission tracking',
      'Advanced analytics',
      'Custom profile subdomain',
    ],
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
