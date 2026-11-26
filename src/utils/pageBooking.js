// "Book a visit" on a Premium page (PAGE-SITE 3): which days and times a buyer may pick.
// The seller's hours are their ONE availability setting (Settings > Availability,
// get_booking_slots), the same the car page's calendar uses, never a second list on the page.
// Days and times are Malaysian, whatever the buyer's phone is set to.
// rule = { weekdays: [0..6] (0 = Sunday), startHour, endHour, slotMinutes }.

const DAY_MS = 86400000;
export const BOOK_DAYS_AHEAD = 21; // = BookingCalendar's DAYS_AHEAD
export const OPEN_RULE = { weekdays: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 18, slotMinutes: 60 };

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekday = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const hm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
// The moment a Malaysian day + time happens.
export const slotMs = (ymd, time) => Date.parse(`${ymd}T${time}:00+08:00`);

// The times of one day: start to end in slot steps, minus the past and the already booked.
export function daySlots(rule, ymd, booked = new Set(), nowMs = Date.now()) {
  const r = rule || OPEN_RULE;
  const step = Math.max(15, Number(r.slotMinutes) || 60);
  const out = [];
  for (let m = (Number(r.startHour) || 0) * 60; m + step <= (Number(r.endHour) || 24) * 60; m += step) {
    const t = hm(m);
    const ms = slotMs(ymd, t);
    if (ms > nowMs && !booked.has(ms)) out.push(t);
  }
  return out;
}

// The days the seller works in the next three weeks that still have a free time.
export function bookDays(rule, today, booked = new Set(), nowMs = Date.now()) {
  const r = rule || OPEN_RULE;
  const days = [];
  for (let i = 0; i < BOOK_DAYS_AHEAD; i += 1) {
    const d = addDays(today, i);
    if ((r.weekdays || []).includes(weekday(d)) && daySlots(r, d, booked, nowMs).length) days.push(d);
  }
  return days;
}
