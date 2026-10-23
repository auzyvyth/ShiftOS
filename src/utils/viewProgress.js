// "How far down a car page did this buyer get" (REVISIT-1, 2026-10-23).
// YouTube's red bar under a half-watched video, for cars: every car card the
// buyer has opened shows a thin red line for how much of that car's page they
// read, and the marketplace hero offers "Continue looking" for them.
//
// DEVICE ONLY. Nothing here is sent anywhere: it is the buyer's own browsing,
// kept for the buyer's own screen. No sign-in needed. It sits under the cookie
// banner's "preferences" tier (remembering things on this device): switched
// off, nothing is recorded and setConsent wipes what was kept.
//
// Progress = scroll depth from the first screen to the top of the "You might
// also like" section (the end of the car's own content). Opening a car and
// leaving at once is 0, which still lists it; reading to the similar cars is 1.
// We keep the MAX ever reached, not the last position: the bar answers "how
// much of this car have you seen", and a quick second look must not shrink it.

import { hasConsent } from './consent.js';

export const PROGRESS_KEY = 'xd_view_progress';
export const PROGRESS_MAX = 40;                 // cars remembered
export const PROGRESS_TTL = 30 * 864e5;         // 30 days since last opened
export const PROGRESS_DONE = 0.95;              // the last few % reads as finished
export const PROGRESS_SLIVER = 0.04;            // a bounce still draws a visible line
const EVENT = 'xd-view-progress';

// ── Pure (unit-tested: npm run test:revisit) ────────────────────────────────

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

// scrollY: px scrolled. viewportH: window height. endTop: the end marker's top
// in DOCUMENT coordinates. A page whose end is already on the first screen is
// fully seen.
export function scrollProgress(scrollY, viewportH, endTop) {
  const span = endTop - viewportH;
  if (!(span > 0)) return 1;
  const p = clamp01(scrollY / span);
  return p >= PROGRESS_DONE ? 1 : p;
}

// Drop expired and malformed rows, newest first, capped.
export function liveEntries(list, now) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.id === 'string' && Number.isFinite(e.t) && now - e.t < PROGRESS_TTL)
    .sort((a, b) => b.t - a.t)
    .slice(0, PROGRESS_MAX);
}

// Record an open (p omitted) or a new depth. Moves the car to the front and
// never lowers its progress.
export function mergeProgress(list, id, p, now) {
  const rows = liveEntries(list, now);
  const prev = rows.find((e) => e.id === id);
  const next = { id, p: Math.max(prev?.p || 0, clamp01(p ?? 0)), t: now };
  return [next, ...rows.filter((e) => e.id !== id)].slice(0, PROGRESS_MAX);
}

// Width the bar draws at, or 0 for a car never opened.
export function barWidth(entry) {
  if (!entry) return 0;
  return Math.max(PROGRESS_SLIVER, clamp01(entry.p));
}

// ── Browser storage ─────────────────────────────────────────────────────────

let cache = null; // { raw, list } so every card shares one parse

function readList() {
  let raw = null;
  try { raw = localStorage.getItem(PROGRESS_KEY); } catch { /* private mode */ }
  if (cache && cache.raw === raw) return cache.list;
  let parsed = [];
  try { parsed = JSON.parse(raw || '[]'); } catch { /* corrupt: start over */ }
  cache = { raw, list: liveEntries(parsed, Date.now()) };
  return cache.list;
}

function writeList(list) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(list)); } catch { /* full or blocked */ }
  cache = null;
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* SSR */ }
}

export function recordCarProgress(id, p) {
  if (!id || !hasConsent('preferences')) return;
  writeList(mergeProgress(readList(), String(id), p, Date.now()));
}

export function clearCarProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch { /* blocked */ }
  cache = null;
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* SSR */ }
}

// For useSyncExternalStore: same array back until something changes.
export function progressSnapshot() { return readList(); }

export function subscribeProgress(cb) {
  const onStorage = (e) => { if (!e.key || e.key === PROGRESS_KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage); // another tab
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
