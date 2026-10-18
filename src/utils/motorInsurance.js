// Comprehensive motor insurance ESTIMATE for a private car, from the former
// PIAM motor tariff (Jadual Tarif Motor). The tariff was liberalised on
// 1 July 2017 (Bank Negara Malaysia) and insurers now price above and below
// it, so this is a baseline every Malaysian seller still quotes from, never a
// quote. Anything that shows it must say "estimate".
//
// Premium = rate for the first RM1,000 (by engine cc and region)
//         + RM26 (Peninsular) / RM20.30 (Sabah, Sarawak, Labuan) for each
//           further RM1,000 or part of it,
//         - NCD, then + 8% SST + RM10 stamp duty.
// Checked against a seller's live Excel (owner, 2026-10-18): Proton X50 1.5T,
// RM89,800, 0% NCD -> RM2,839 here vs RM2,869 on the sheet.
//
// The tariff priced by engine cc; an EV has none, so it returns null and the
// seller types the figure instead. Never guess a cc.

export const NCD_TIERS = [0, 25, 30, 38.33, 45, 55];

// [max cc, Peninsular first RM1,000, East first RM1,000]
const BANDS = [
  [1400, 273.8, 196.2],
  [1650, 305.5, 220.0],
  [2200, 339.1, 243.9],
  [3050, 372.6, 266.5],
  [4100, 404.3, 290.4],
  [4250, 436.0, 314.2],
  [4400, 469.6, 338.1],
  [Infinity, 501.3, 361.9],
];
const PER_THOUSAND = { west: 26, east: 20.3 };
const SST = 0.08;
const STAMP_DUTY = 10;

// Sabah, Sarawak and Labuan are on the East Malaysia schedule; everything
// else (Langkawi included) is Peninsular.
export function insuranceRegion(state) {
  return /sabah|sarawak|labuan/i.test(String(state || '')) ? 'east' : 'west';
}

// sumInsured: the car's value (we use the price on screen). cc: engine cc.
// Returns { gross, ncdOff, sst, stampDuty, total } in whole ringgit, or null
// when there is nothing honest to show.
export function motorPremium({ sumInsured, cc, ncd = 0, region = 'west' }) {
  const sum = Number(sumInsured) || 0;
  const c = Number(cc) || 0;
  if (sum <= 0 || c <= 0) return null;
  const band = BANDS.find(([max]) => c <= max);
  const first = region === 'east' ? band[2] : band[1];
  const further = Math.ceil(Math.max(0, sum - 1000) / 1000);
  const gross = first + further * PER_THOUSAND[region === 'east' ? 'east' : 'west'];
  const pct = NCD_TIERS.includes(Number(ncd)) ? Number(ncd) : 0;
  const net = gross * (1 - pct / 100);
  const sst = net * SST;
  return {
    gross: Math.round(gross),
    ncdOff: Math.round(gross - net),
    sst: Math.round(sst),
    stampDuty: STAMP_DUTY,
    total: Math.round(net + sst + STAMP_DUTY),
  };
}

// "38.33" reads as noise on a stream; the industry writes it 38 1/3.
export const ncdLabel = (n) => (Number(n) === 38.33 ? '38⅓%' : `${n}%`);
