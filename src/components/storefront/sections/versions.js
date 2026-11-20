// Which versions of each dealer-site section exist (STOREFRONT-2). Plain data, so the
// dashboard's layout editor can read it without loading any section code. index.jsx maps
// each letter to its component; a letter listed here but missing there falls back to "a"
// on the page (HomePage.jsx), so the two can never break the site, only hide a version.
// Max 3 per section (VARIANTS in src/utils/storefrontLayout.js).
export const AVAILABLE_VERSIONS = {
  hero: ["a"],
  strip: ["a"],
  video: ["a"],
  hot_deals: ["a"],
  cars: ["a"],
  about: ["a"],
  reviews: ["a"],
  why: ["a"],
  stats: ["a"],
  how: ["a"],
  testimonials: ["a"],
  calculator: ["a"],
  contact: ["a"],
};
