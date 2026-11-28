// The Assistant feed's rules (ASSIST-1, owner 2026-11-28). Pure: no React, no network.
//
// The feed is a SECOND VIEW over things the Premium panel already loads (bookings, the
// notification rows, the coach's silent car, "This week"). It writes nothing to the database:
// "Keep it" and "Snooze" live on this device only (owner's call), so they reset on a new phone.
// Three groups, by importance and not by time: Needs you, Worth a look, Done.
import { COACH } from '../../utils/carCoach.js';

export const KEEP_DAYS = 14;
export const SNOOZE_DAYS = 3;
export const DONE_DAYS = 7;
export const DONE_MAX = 6;
export const NEEDS_MAX = 5;
const NEW_WINDOW_DAYS = 7;
const DAY = 86400000;
const TZ = 'Asia/Kuala_Lumpur';

export const storeKey = (uid) => `xd_assistant_${uid}`;
export const mytDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

const EMPTY = { quiet: {}, done: [] };

// Drop what has run out, and anything malformed, so a bad value never breaks the screen.
export function cleanStore(raw, now = new Date()) {
  const t = now.getTime();
  const quiet = {};
  const src = raw && typeof raw === 'object' && raw.quiet && typeof raw.quiet === 'object' ? raw.quiet : {};
  for (const [carId, q] of Object.entries(src)) {
    if (q && Number(q.until) > t && (q.kind === 'keep' || q.kind === 'snooze')) quiet[carId] = { until: Number(q.until), kind: q.kind };
  }
  const done = (Array.isArray(raw?.done) ? raw.done : [])
    .filter((d) => d && typeof d.id === 'string' && typeof d.kind === 'string' && Number(d.at) > t - DONE_DAYS * DAY)
    .map((d) => ({ id: d.id, kind: d.kind, label: String(d.label || '').slice(0, 80), at: Number(d.at), carId: d.carId || null }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 20);
  return { quiet, done };
}

export function readStore(uid, now = new Date(), storage = globalThis.localStorage) {
  if (!uid) return { ...EMPTY };
  try {
    return cleanStore(JSON.parse(storage?.getItem(storeKey(uid)) || 'null'), now);
  } catch { return { ...EMPTY }; }
}

export function writeStore(uid, store, storage = globalThis.localStorage) {
  if (!uid) return;
  try { storage?.setItem(storeKey(uid), JSON.stringify(store)); } catch { /* private mode / full: it just will not remember */ }
}

export const isQuiet = (store, carId, now = new Date()) => Number(store?.quiet?.[carId]?.until) > now.getTime();

export function addDone(store, entry, now = new Date()) {
  const done = [{ ...entry, at: now.getTime() }, ...(store.done || []).filter((d) => d.id !== entry.id)];
  return cleanStore({ ...store, done }, now);
}

// "Keep it" = stay quiet about this car for 14 days; "Snooze" = 3 days. Both add a Done row.
export function quietCar(store, { carId, kind, label }, now = new Date()) {
  const days = kind === 'keep' ? KEEP_DAYS : SNOOZE_DAYS;
  const quiet = { ...store.quiet, [carId]: { until: now.getTime() + days * DAY, kind } };
  return addDone({ ...store, quiet }, { id: `${kind}:${carId}`, kind, label, carId }, now);
}

export function unquietCar(store, carId, now = new Date()) {
  const quiet = { ...store.quiet };
  delete quiet[carId];
  return cleanStore({ ...store, quiet, done: (store.done || []).filter((d) => !(d.carId === carId && (d.kind === 'keep' || d.kind === 'snooze'))) }, now);
}

const NEEDS_TYPES = { new_enquiry: 'enquiry', chat_message: 'chat', new_question: 'question' };

export function buildAssistantCards({ appointments = [], notifications = [], silentPick = null, store = EMPTY, leadsToChase = 0, now = new Date() } = {}) {
  const t = now.getTime();
  const today = mytDay(now);

  // Needs you: a booking still waiting for a yes, and buyers who wrote and are unread.
  const bookings = (appointments || [])
    .filter((a) => a && a.status === 'pending' && a.appointment_date && new Date(a.appointment_date).getTime() >= t - 2 * 3600000)
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    .map((a) => ({ id: `appt:${a.id}`, kind: 'booking', apptId: a.id, name: a.buyer_name || '', phone: a.buyer_phone || '', car: a.car_listings || null, when: a.appointment_date }));

  const buyers = (notifications || [])
    .filter((n) => n && !n.is_read && NEEDS_TYPES[n.type] && t - new Date(n.created_at).getTime() < NEW_WINDOW_DAYS * DAY)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((n) => ({ id: `n:${n.id}`, kind: NEEDS_TYPES[n.type], notif: n, when: n.created_at }));

  const allNeeds = [...bookings, ...buyers];
  const needs = allNeeds.slice(0, NEEDS_MAX);

  // Worth a look: the silent car (unless it was kept or snoozed) and the morning brief.
  const worth = [];
  if (silentPick?.car && !isQuiet(store, silentPick.car.id, now)) {
    worth.push({ id: `silent:${silentPick.car.id}`, kind: 'silent', car: silentPick.car, step: silentPick.step, count: silentPick.count || 1 });
  }
  const viewings = (appointments || []).filter((a) => a && a.status !== 'cancelled' && a.appointment_date && mytDay(a.appointment_date) === today).length;
  const silentCount = silentPick?.count || 0;
  const rows = [
    { key: 'viewings', n: viewings },
    { key: 'leads', n: Math.max(0, Number(leadsToChase) || 0) },
    { key: 'silent', n: silentCount },
  ].filter((r) => r.n > 0);
  if (rows.length) worth.push({ id: `brief:${today}`, kind: 'brief', rows });

  const done = (store.done || []).slice(0, DONE_MAX);
  return { needs, moreNeeds: allNeeds.length - needs.length, worth, done, badge: allNeeds.length };
}

export { COACH };
