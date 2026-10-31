// COACH-1 (owner, 2026-10-31): every live car tells the seller ONE next step,
// on Lite and Premium alike. "The app communicates": what happened to this car,
// then the one thing to do, with a button that does it. Pure functions, no
// React, so `npm run test:coach` can pin every rule.
//
// Rules, first match wins (a live buyer beats a missing photo beats traffic):
//   question   a buyer asked about this car and nobody answered      -> Answer
//   photos     fewer photos than the listing minimum (5)              -> Edit
//   price      no price                                               -> Edit
//   silent     listed 2+ days and no views for 2+ days (owner's rule) -> Show me how (share tour)
//   fresh      listed under 2 days                                    -> Share
//   no_taps    20+ views in 30 days, nobody messaged                  -> Edit
//   saved      2+ buyers saved it, nobody messaged                    -> Share
//   low        under 10 views this week                               -> Share
//   working    buyers are messaging                                   -> nothing to press
// Numbers come only from what we counted (views need the buyer's analytics
// consent, so they undercount). Never invent a stat or a promise.
import { MIN_LISTING_PHOTOS } from './listingRules.js';

export const COACH = {
  SILENT_DAYS: 2,     // owner: "no viewers more than 2 days"
  NO_TAP_VIEWS: 20,   // enough looks that silence means something
  SAVED_MIN: 2,
  LOW_WEEK_VIEWS: 10,
};

const DAY = 86400000;
const LIVE = new Set(['available', 'active']);

const photoCount = (car) => (Array.isArray(car?.images) ? car.images.filter(Boolean).length : 0);
// A new-car model card carries the platform's stock photos: never ask for more.
const isModelCard = (car) => !!car?.new_car_model_id && !car?.new_car_unit;

// Days since the last counted view, from the 7 daily buckets (oldest first,
// the last one is today). null = no view in the last 7 days.
export function daysSinceLastView(daily) {
  if (!Array.isArray(daily) || daily.length === 0) return null;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    if (Number(daily[i]) > 0) return daily.length - 1 - i;
  }
  return null;
}

export function carNextStep(car, stats = {}, extra = {}, now = new Date()) {
  if (!car || !LIVE.has(car.status || 'available')) return null;
  const views = Number(stats.views) || 0;
  const taps = Number(stats.enquiries) || 0;
  const daily = Array.isArray(stats.daily) ? stats.daily : [];
  const week = daily.reduce((s, n) => s + (Number(n) || 0), 0);
  const ageDays = car.created_at ? Math.floor((now - new Date(car.created_at)) / DAY) : 99;
  const questions = Number(extra.unanswered) || 0;
  const likes = Number(extra.likes) || 0;

  if (questions > 0) return { kind: 'question', count: questions, action: 'answer' };
  if (!isModelCard(car)) {
    const have = photoCount(car);
    if (have < MIN_LISTING_PHOTOS) return { kind: 'photos', need: MIN_LISTING_PHOTOS - have, action: 'edit' };
    if (!Number(car.selling_price)) return { kind: 'price', action: 'edit' };
  }
  if (taps > 0) return { kind: 'working', count: taps, action: null };
  if (ageDays >= COACH.SILENT_DAYS) {
    const since = daysSinceLastView(daily);
    if (since === null || since >= COACH.SILENT_DAYS) {
      // No view this week: count from the day it was listed, capped at 7 so we
      // never claim more than the buckets can see.
      const days = since === null ? Math.min(ageDays, 7) : since;
      return { kind: 'silent', days, capped: since === null && ageDays > 7, action: 'tour' };
    }
  } else {
    return { kind: 'fresh', action: 'share' };
  }
  if (views >= COACH.NO_TAP_VIEWS) return { kind: 'no_taps', views, action: 'edit' };
  if (likes >= COACH.SAVED_MIN) return { kind: 'saved', count: likes, action: 'share' };
  if (week < COACH.LOW_WEEK_VIEWS) return { kind: 'low', views: week, action: 'share' };
  return null;
}

// The car the dashboard points at: the live car silent the longest.
export function pickSilentCar(cars, statsMap = {}, extraFor = () => ({}), now = new Date()) {
  let best = null;
  let count = 0;
  for (const car of cars || []) {
    const step = carNextStep(car, statsMap[car.id], extraFor(car), now);
    if (step?.kind !== 'silent') continue;
    count += 1;
    if (!best || step.days > best.step.days) best = { car, step };
  }
  return best ? { ...best, count } : null;
}

// Listing completeness, ONE copy for Lite and Premium (each had its own, and
// both still asked for 3 photos after the minimum went to 5). Returns keys, so
// each panel words them in its own language.
export function carListingScore(car) {
  const have = photoCount(car);
  const checks = [
    { pts: 25, ok: have >= MIN_LISTING_PHOTOS, key: 'photos', n: Math.max(0, MIN_LISTING_PHOTOS - have) },
    { pts: 15, ok: have >= 1, key: 'photo' },
    { pts: 15, ok: !!Number(car?.selling_price), key: 'price' },
    { pts: 10, ok: !!car?.mileage, key: 'mileage' },
    { pts: 10, ok: !!car?.colour, key: 'colour' },
    { pts: 10, ok: !!car?.variant, key: 'variant' },
    { pts: 10, ok: !!car?.state, key: 'location' },
    { pts: 5, ok: !!car?.condition, key: 'condition' },
  ];
  const earned = checks.reduce((s, c) => s + (c.ok ? c.pts : 0), 0);
  const total = checks.reduce((s, c) => s + c.pts, 0);
  return { pct: Math.round((earned / total) * 100), missing: checks.filter((c) => !c.ok) };
}
