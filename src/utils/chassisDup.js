// One live car per chassis per dealer (DMS-ID-1, 2026-11-27).
// The database enforces it with the unique index `car_listings_one_live_chassis`
// (migration 20261127a). This file is the screen side: the same "same chassis" rule,
// and the words for the error the index raises. The rule is NOT global: a car sold by
// one dealer can be listed by the next one, and a seller's archived copy never counts.
//
// Same chassis = capital letters and digits only, so "ase30-0011130", "ASE30 0011130"
// and "ASE300011130" are one car. Mirrors the SQL expression in the index.
export const LIVE_CHASSIS_STATUSES_EXCLUDED = ['archived', 'sold', 'rejected'];

export function normChassis(v) {
  return String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function isChassisDupError(err) {
  const text = `${err?.message || ''} ${err?.details || ''}`;
  return err?.code === '23505' && text.includes('car_listings_one_live_chassis');
}

// The index's detail line ends "=(<dealer uuid>, ASE300011130) already exists."
function chassisFromDetail(err) {
  const m = String(err?.details || '').match(/,\s*([A-Z0-9]+)\)\s*already exists/i);
  return m ? m[1] : '';
}

export function chassisDupMessage(err) {
  const c = chassisFromDetail(err);
  return `You already have a live car with chassis ${c || 'this number'}. Open that car instead, or archive it first.`;
}
