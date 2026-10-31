// What a used/recon listing needs before it can be submitted. One copy, read
// by CarForm and CarFormFast, so the two add-car forms cannot drift.

export const MIN_LISTING_PHOTOS = 5;

// A new listing needs the full minimum. An edit of a car listed before the
// rule keeps working at the count it already has (a 1-photo car can still
// change its price), but can never go below that count or below 1.
export function minPhotosFor(existingCount = null) {
  if (existingCount == null) return MIN_LISTING_PHOTOS;
  return Math.min(MIN_LISTING_PHOTOS, Math.max(1, existingCount));
}

export const photosMissingLabel = (have, min) =>
  have >= min ? null : `at least ${min} photos (${have} added)`;
