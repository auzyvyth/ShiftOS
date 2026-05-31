// Mirrors plan_config table — single source of truth for UI labels/caps/prices
export const PLAN_CONFIG = {
  salesman_lite: {
    label: 'Salesman Lite',
    price: 0,
    listingCap: 15,
    seatCap: 1,
    isDealer: false,
  },
  salesman_full: {
    label: 'Salesman Premium',
    price: 99,
    listingCap: 30,
    seatCap: 1,
    isDealer: false,
  },
  dealer_starter: {
    label: 'Dealer Starter',
    price: 399,
    listingCap: 20,
    seatCap: 3,
    isDealer: true,
  },
  dealer_growth: {
    label: 'Dealer Growth',
    price: 799,
    listingCap: 60,
    seatCap: 8,
    isDealer: true,
  },
  dealer_pro: {
    label: 'Dealer Pro',
    price: 1499,
    listingCap: 150,
    seatCap: 15,
    isDealer: true,
  },
};

export function getPlanConfig(plan) {
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG.dealer_starter;
}

// Ordered upgrade path for dealer plans
export const DEALER_PLAN_ORDER = [
  'dealer_starter',
  'dealer_growth',
  'dealer_pro',
];

export function nextDealerPlan(currentPlan) {
  const idx = DEALER_PLAN_ORDER.indexOf(currentPlan);
  if (idx === -1 || idx === DEALER_PLAN_ORDER.length - 1) return null;
  return DEALER_PLAN_ORDER[idx + 1];
}
