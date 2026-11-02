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

// The WhatsApp message for "Offer another car" (SOLD-1). The only numbers in it
// are the new car's own asking price and link, read from the listing: nothing
// invented (no instalment, discount or approval). A person presses send.
export function offerAnotherCarMessage({ buyer, seller, soldCar, newCar, price, link, lang = 'en' }) {
  const who = (buyer || '').trim().split(/\s+/)[0] || (lang === 'ms' ? 'tuan/puan' : 'there');
  const me = (seller || '').trim().split(/\s+/)[0];
  const rm = Number(price) > 0 ? `RM ${Number(price).toLocaleString('en-MY')}` : null;
  if (lang === 'ms') {
    return [
      `Hi ${who}${me ? `, ${me} di sini` : ''}.`,
      soldCar ? `Maaf, ${soldCar} yang anda tanya tu dah terjual.` : 'Maaf, kereta yang anda tanya tu dah terjual.',
      `Saya ada ${newCar}${rm ? ` pada ${rm}` : ''} yang mungkin sesuai dengan anda${link ? `: ${link}` : '.'}`,
      'Nak saya hantar gambar lagi atau set masa untuk tengok?',
    ].join(' ');
  }
  return [
    `Hi ${who}${me ? `, ${me} here` : ''}.`,
    soldCar ? `Sorry, the ${soldCar} you asked about has been sold.` : 'Sorry, the car you asked about has been sold.',
    `I have a ${newCar}${rm ? ` at ${rm}` : ''} that could suit you${link ? `: ${link}` : '.'}`,
    'Want me to send more photos or set a time to view it?',
  ].join(' ');
}
