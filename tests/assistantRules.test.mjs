// Run: npm run test:assistant
//
// Guards the Assistant feed's rules (src/components/assistant/assistantRules.js): what lands in
// "Needs you" vs "Worth a look" vs "Done", and that Keep / Snooze are remembered, expire, and undo.
import {
  buildAssistantCards, quietCar, unquietCar, cleanStore, readStore, writeStore, isQuiet, KEEP_DAYS, SNOOZE_DAYS, NEEDS_MAX,
} from '../src/components/assistant/assistantRules.js';

let pass = 0;
const fails = [];
const eq = (a, b, label) => (JSON.stringify(a) === JSON.stringify(b) ? pass++ : fails.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`));

const now = new Date('2026-11-28T03:00:00Z'); // 11:00 in Malaysia
const DAY = 86400000;
const at = (h) => new Date(now.getTime() + h * 3600000).toISOString();
const appt = (o = {}) => ({ id: 'a1', status: 'pending', buyer_name: 'Aisyah', buyer_phone: '0123456789', appointment_date: at(24), car_listings: { brand: 'Honda', model: 'City' }, ...o });
const notif = (o = {}) => ({ id: 'n1', type: 'new_enquiry', is_read: false, created_at: at(-1), title: 'New enquiry', ...o });
const silent = (id = 'c1', count = 1) => ({ car: { id, model: 'Myvi' }, step: { kind: 'silent', days: 3 }, count });
const base = { appointments: [], notifications: [], silentPick: null, store: { quiet: {}, done: [] }, leadsToChase: 0, now };

// Needs you
eq(buildAssistantCards(base).needs, [], 'empty feed has nothing');
eq(buildAssistantCards(base).badge, 0, 'empty badge is 0');
eq(buildAssistantCards({ ...base, appointments: [appt()] }).needs.map((c) => c.kind), ['booking'], 'a pending booking needs you');
eq(buildAssistantCards({ ...base, appointments: [appt({ status: 'confirmed' })] }).needs, [], 'a confirmed booking does not');
eq(buildAssistantCards({ ...base, appointments: [appt({ appointment_date: at(-30) })] }).needs, [], 'a booking long past does not');
eq(buildAssistantCards({ ...base, appointments: [appt({ appointment_date: at(-1) })] }).needs.length, 1, 'a booking an hour ago still shows');
eq(buildAssistantCards({ ...base, notifications: [notif()] }).needs.map((c) => c.kind), ['enquiry'], 'unread enquiry needs you');
eq(buildAssistantCards({ ...base, notifications: [notif({ is_read: true })] }).needs, [], 'a read enquiry does not');
eq(buildAssistantCards({ ...base, notifications: [notif({ type: 'listing_approved' })] }).needs, [], 'other types never land here');
eq(buildAssistantCards({ ...base, notifications: [notif({ type: 'new_booking' })] }).needs, [], 'booking pings come from the booking, not the notice');
eq(buildAssistantCards({ ...base, notifications: [notif({ created_at: new Date(now - 9 * DAY).toISOString() })] }).needs, [], 'a 9-day-old enquiry is dropped');
eq(buildAssistantCards({ ...base, appointments: [appt()], notifications: [notif()] }).needs.map((c) => c.kind), ['booking', 'enquiry'], 'booking before buyers');

const many = Array.from({ length: NEEDS_MAX + 3 }, (_, i) => notif({ id: `n${i}`, created_at: at(-i - 1) }));
const capped = buildAssistantCards({ ...base, notifications: many });
eq(capped.needs.length, NEEDS_MAX, 'capped at the limit');
eq(capped.moreNeeds, 3, 'the rest is counted, not lost');
eq(capped.badge, NEEDS_MAX + 3, 'badge counts everything waiting');

// Worth a look
const w1 = buildAssistantCards({ ...base, silentPick: silent() });
eq(w1.worth.map((c) => c.kind), ['silent', 'brief'], 'silent car + a brief that names it');
eq(w1.worth[1].rows, [{ key: 'silent', n: 1 }], 'brief row for the silent car only');
eq(buildAssistantCards(base).worth, [], 'nothing to say = no brief');
const w2 = buildAssistantCards({ ...base, appointments: [appt({ appointment_date: at(2) })], leadsToChase: 3 });
eq(w2.worth[0].rows, [{ key: 'viewings', n: 1 }, { key: 'leads', n: 3 }], 'brief counts today viewings + leads');
eq(buildAssistantCards({ ...base, appointments: [appt({ status: 'cancelled', appointment_date: at(2) })] }).worth, [], 'a cancelled viewing is not today');
eq(buildAssistantCards({ ...base, appointments: [appt({ appointment_date: at(40) })] }).worth, [], 'tomorrow is not today');

// Keep / Snooze, on this device only
let s = quietCar({ quiet: {}, done: [] }, { carId: 'c1', kind: 'keep', label: 'Myvi' }, now);
eq(isQuiet(s, 'c1', now), true, 'kept car is quiet');
eq(buildAssistantCards({ ...base, store: s, silentPick: silent() }).worth, [{ id: 'brief:2026-11-28', kind: 'brief', rows: [{ key: 'silent', n: 1 }] }], 'a kept car is not offered again');
eq(buildAssistantCards({ ...base, store: s }).done.map((d) => d.kind), ['keep'], 'keeping leaves a Done row');
eq(isQuiet(s, 'c1', new Date(now.getTime() + (KEEP_DAYS - 1) * DAY)), true, 'still quiet on day 13');
eq(isQuiet(s, 'c1', new Date(now.getTime() + (KEEP_DAYS + 1) * DAY)), false, 'speaks again after 14 days');
const sn = quietCar({ quiet: {}, done: [] }, { carId: 'c2', kind: 'snooze', label: 'Vios' }, now);
eq(isQuiet(sn, 'c2', new Date(now.getTime() + (SNOOZE_DAYS + 0.1) * DAY)), false, 'snooze ends after 3 days');
s = unquietCar(s, 'c1', now);
eq(isQuiet(s, 'c1', now), false, 'undo brings the car back');
eq(s.done.length, 0, 'undo removes its Done row');

// Storage: survives garbage and expiry
eq(cleanStore('nonsense', now), { quiet: {}, done: [] }, 'garbage store becomes empty');
eq(cleanStore({ quiet: { c1: { until: now.getTime() - 1, kind: 'keep' } }, done: [{ id: 'x', kind: 'keep', label: 'y', at: now.getTime() - 8 * DAY }] }, now), { quiet: {}, done: [] }, 'expired entries are dropped');
const mem = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; })();
writeStore('u1', sn, mem);
eq(readStore('u1', now, mem).quiet.c2.kind, 'snooze', 'round-trips through storage');
eq(readStore('u2', now, mem), { quiet: {}, done: [] }, 'one account never reads another');
eq(readStore('', now, mem), { quiet: {}, done: [] }, 'no user id = empty');

if (fails.length) { console.error(`FAIL ${fails.length}\n` + fails.join('\n')); process.exit(1); }
console.log(`assistant rules: ${pass} checks passed`);
