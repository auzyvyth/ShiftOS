// Private cars (PRIVATE-1, 2026-10-30): a seller keeps up to 4 cars only they
// can see, to work out cost and margin before (or without) publishing. A private
// car is car_listings.status = 'private'; every public surface whitelists
// statuses, so buyers never see it. The limit and the rules live in the DB
// (trg_private_car_rules, migration 20261030b); this file only mirrors them so
// the panels can explain a refusal before and after it happens.

export const PRIVATE_CAR_LIMIT = 4;

export const isPrivateLimitError = (err) => /private_car_limit/.test(err?.message || "");

// Publishing a private car sends it to review, like a new car (update_listing_status).
export const statusAfterWrite = (car, next) =>
  car?.status === "private" && (next === "available" || next === "reserved") ? "pending_approval" : next;

export const privateCount = (listings) => (listings || []).filter((c) => c.status === "private").length;
