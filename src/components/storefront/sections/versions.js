// Which versions of each dealer-site section exist, with the name and one line the
// dashboard's layout editor shows (STOREFRONT-2). Plain data, so the editor reads it without
// loading any section code. index.jsx maps each letter to its component; a letter listed
// here but missing there falls back to "a" on the page (HomePage.jsx), so the two can never
// break the site, only hide a version. Max 3 per section (VARIANTS, storefrontLayout.js).
export const VERSION_INFO = {
  hero: {
    a: { name: "Slides", note: "Your hero slides from Storefront > Hero Carousel." },
    b: { name: "Split", note: "Your name and a search box beside your newest car's photo." },
    c: { name: "Full screen", note: "Your name large over the whole first screen: one photo, or a wall of your newest cars." },
  },
  cars: {
    a: { name: "Grid", note: "Your newest cars in rows." },
    b: { name: "Rail", note: "One row buyers swipe through. Keeps the page short." },
    c: { name: "Spotlight", note: "Your newest car shown large, the rest in rows below." },
  },
  // Stage 4: every word in these is the dealer's own (Settings) or a count we hold.
  about: {
    a: { name: "Centred", note: "Your About text in the middle of the page." },
    b: { name: "Side by side", note: "Heading and your town on the left, your text on the right." },
    c: { name: "Opening line", note: "The first thing you wrote, set large, the rest below." },
  },
  why: {
    a: { name: "Cards", note: "Your reasons in cards, two across." },
    b: { name: "Side by side", note: "Your heading on the left, your reasons as a ticked list." },
    c: { name: "Numbered", note: "Your reasons in columns under large numbers." },
  },
  stats: {
    a: { name: "Tiles", note: "Your numbers in tiles that count up." },
    b: { name: "Big numbers", note: "Your numbers large in one row, no tiles." },
    c: { name: "Colour band", note: "Your numbers in white on a band of your brand colour." },
  },
  how: {
    a: { name: "Zigzag", note: "Your steps in cards, left and right." },
    b: { name: "Timeline", note: "Your steps down one line, numbered." },
    c: { name: "In a row", note: "Your steps side by side, numbered (stacked on phones)." },
  },
  calculator: {
    a: { name: "Link", note: "A card that sends buyers to the loan calculator page." },
    b: { name: "Inline", note: "The calculator on your page: price, deposit, years and rate give a monthly estimate." },
  },
  reviews: {
    a: { name: "Simple", note: "Buyer reviews in one column." },
    b: { name: "Side by side", note: "Heading on the left, buyer reviews on the right." },
    c: { name: "Framed", note: "Buyer reviews in one card under a centred heading." },
  },
};

// Choices inside one version (look options, storefrontLayout.js OPTIONS), shown under it in the
// editor: { section: { variant: { option, label, values: { value: name } } } }.
export const VERSION_OPTIONS = {
  hero: { c: { option: "heroBg", label: "Background", values: { photo: "Photo", cars: "Your cars" },
    notes: { photo: "Your first hero slide, else your newest car's photo, under a dark fade. Two buttons: WhatsApp and Browse cars.",
      cars: "Your three newest cars as a wall under your name." } } },
};

const ONLY_A = ["strip", "video", "hot_deals", "testimonials", "contact", "brands", "browse", "sold"];

export const AVAILABLE_VERSIONS = {
  ...Object.fromEntries(ONLY_A.map((id) => [id, ["a"]])),
  ...Object.fromEntries(Object.entries(VERSION_INFO).map(([id, v]) => [id, Object.keys(v)])),
};
