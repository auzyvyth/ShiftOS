import { supabase } from '../supabaseClient';
import { loanTotals, DEFAULT_EIR, RATE_BASIS } from './financing';

// Default hire-purchase assumptions when no custom financing is provided:
// 10% down, 7 years, DEFAULT_EIR (reducing balance, HP (Amendment) Act 2026).
// This used to be 2.45% FLAT — a new-car rate, and a different default from
// every other calculator in the app.
const DEFAULT_DP_PCT = 10;
const DEFAULT_TENURE_YEARS = 7;

function randomToken() {
  // deal_token is a uuid column — use a real UUID to match the dealer-side generator
  return crypto.randomUUID();
}

export function computeFinancing(price, { dpPct = DEFAULT_DP_PCT, tenureYears = DEFAULT_TENURE_YEARS, eir = DEFAULT_EIR } = {}) {
  const p = Number(price) || 0;
  if (p <= 0) return null;
  const loanAmount = Math.round(p * (1 - dpPct / 100));
  const t = loanTotals(loanAmount, eir, tenureYears * 12);
  const monthlyInstall = Math.round(t.monthly);
  const totalRepayment = monthlyInstall * tenureYears * 12;
  const totalInterest = totalRepayment - loanAmount;
  return {
    dp_pct: dpPct,
    loan_amount: loanAmount,
    tenure_years: tenureYears,
    interest_rate: eir,
    rate_basis: RATE_BASIS,
    monthly_install: monthlyInstall,
    total_interest: totalInterest,
    total_repayment: totalRepayment,
  };
}

/**
 * Build a deal-sheet snapshot and persist it on the lead row, returning a shareable URL.
 * Shape matches what src/pages/DealPage.jsx reads.
 *
 * @param {object} args
 * @param {object} args.lead        lead row (needs id)
 * @param {object} args.car         car_listings row
 * @param {object} args.dealer      dealer profile (branding)
 * @param {object} [args.salesman]  salesman profile (name + whatsapp shown as contact)
 * @param {Array}  [args.addons]    [{ name, category, price }]
 * @param {object} [args.financing] override financing assumptions
 * @param {number} [args.expiryMins] link lifetime in minutes (default 1440 = 24h)
 */
export async function generateDealSheet({ lead, car, dealer, salesman = null, addons = [], financing = {}, fees: rawFees = {}, note = null, expiryMins = 1440 }) {
  if (!lead?.id) throw new Error('Missing lead');
  if (!car) throw new Error('Missing car');

  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMins * 60 * 1000).toISOString();

  const carPrice = Number(car.selling_price) || 0;
  const addonsList = (addons || []).map(a => ({
    name: a.name || a.dealer_products?.name || '',
    category: a.category || a.dealer_products?.category || 'other',
    price: Number(a.price ?? a.sold_price ?? 0),
  }));
  const addonsTotal = addonsList.reduce((s, a) => s + a.price, 0);
  const fees = {
    road_tax: Number(rawFees.road_tax) || 0,
    insurance: Number(rawFees.insurance) || 0,
    puspakom: Number(rawFees.puspakom) || 0,
  };
  const feesTotal = fees.road_tax + fees.insurance + fees.puspakom;

  const snapshot = {
    car: {
      year: car.year, brand: car.brand, model: car.model, variant: car.variant,
      selling_price: carPrice,
      colour: car.colour, mileage: car.mileage, transmission: car.transmission,
      fuel_type: car.fuel_type, engine_cc: car.engine_cc || null,
      images: car.images || [],
      included_services: car.included_services || [],
    },
    dealer: {
      name: dealer?.site_name || dealer?.dealership || 'Dealership',
      brand_color: dealer?.brand_color || '#dc2626',
      whatsapp: dealer?.whatsapp_number || null,
      logo_url: dealer?.site_logo_url || null,
      disclaimer: dealer?.deal_disclaimer || null,
    },
    salesman: salesman ? {
      name: salesman.full_name || salesman.dealership || null,
      whatsapp: salesman.whatsapp_number || null,
    } : null,
    buyer_name: lead.buyer_name || null,
    note: note || null,
    addons: addonsList,
    financing_calc: computeFinancing(carPrice, {
      dpPct: financing.dpPct, tenureYears: financing.tenureYears, eir: financing.eir,
    }),
    fees,
    car_price: carPrice,
    addons_total: addonsTotal,
    fees_total: feesTotal,
    grand_total: carPrice + addonsTotal + feesTotal,
    generated_at: now.toISOString(),
    expires_at: expiresAt,
  };

  const { error } = await supabase
    .from('leads')
    .update({ deal_token: token, deal_token_expires_at: expiresAt, deal_snapshot: snapshot })
    .eq('id', lead.id);

  if (error) throw error;

  return { url: `${window.location.origin}/deal/${token}`, token, expiresAt };
}
