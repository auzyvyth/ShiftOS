// Which versions of each dealer-site section exist, with the name and one line the
// dashboard's layout editor shows (STOREFRONT-2). Plain data, so the editor reads it without
// loading any section code. index.jsx maps each letter to its component; a letter listed
// here but missing there falls back to "a" on the page (HomePage.jsx), so the two can never
// break the site, only hide a version. Max 3 per section (VARIANTS, storefrontLayout.js).
export const VERSION_INFO = {
  hero: {
    a: { name: "Slides", note: "Your hero slides from Storefront > Hero Carousel." },
    b: { name: "Split", note: "Your name and a search box beside your newest car's photo." },
    c: { name: "Showroom wall", note: "Your name over a wall of your three newest cars." },
  },
  cars: {
    a: { name: "Grid", note: "Your newest cars in rows." },
    b: { name: "Rail", note: "One row buyers swipe through. Keeps the page short." },
    c: { name: "Spotlight", note: "Your newest car shown large, the rest in rows below." },
  },
};

const ONLY_A = ["strip", "video", "hot_deals", "about", "reviews", "why", "stats", "how", "testimonials", "calculator", "contact"];

export const AVAILABLE_VERSIONS = {
  ...Object.fromEntries(ONLY_A.map((id) => [id, ["a"]])),
  ...Object.fromEntries(Object.entries(VERSION_INFO).map(([id, v]) => [id, Object.keys(v)])),
};
