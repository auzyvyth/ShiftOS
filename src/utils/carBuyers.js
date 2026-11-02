// Other buyers on a car that has just been sold (SOLD-1, 2026-11-02).
//
// A car can have several leads. When one wins, the won trigger marks the car
// sold and leaves the other leads untouched; 21 open leads sat on sold cars on
// the day this landed, with nothing telling the seller. They are NOT lost:
// they wanted that car and can often be offered another one. So the lead keeps
// its stage and gets one line + two actions (offer another car / mark lost
// with CAR_SOLD_REASON). No new stage: that would ripple through the pipeline
// columns, the Performance funnel and the stage CHECK.
// Pure, no imports: Premium, Lite and thisWeek.js all read it.

export const CAR_SOLD_REASON = 'CarSold';

const CLOSED = new Set(['won', 'closed_won', 'lost', 'closed_lost']);

export function isOpenLead(lead) {
  return !!lead && !lead.is_deleted && !CLOSED.has(lead.stage);
}

// The status of the lead's car: the seller's own listings first (they update
// the moment a win or a status change lands), else the row embedded in the lead.
function carStatus(lead, carsById) {
  return carsById?.[lead?.car_listing_id]?.status ?? lead?.car_listings?.status ?? null;
}

// True when this open lead is on a car that is already sold (to someone else:
// a lead that won it is closed, so it never matches).
export function carSoldToOther(lead, carsById = null) {
  if (!isOpenLead(lead) || !lead.car_listing_id) return false;
  return carStatus(lead, carsById) === 'sold';
}

// Open leads on one car, optionally leaving one out (the buyer who is winning).
export function openLeadsOnCar(leads, carId, exceptId = null) {
  if (!carId) return [];
  return (leads || []).filter((l) => l.car_listing_id === carId && l.id !== exceptId && isOpenLead(l));
}
