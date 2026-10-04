// Copy for the /for-salesmen landing page, shared by the SPA
// (src/pages/SalesmanLiteLanding.jsx) and the crawler prerender (api/og.js).
// Googlebot and every AI crawler are routed to api/og.js by vercel.json and
// never run the SPA, so this file IS what search engines and AI answers read.
// Keep it plain data (no JSX, no icons) — api/og.js runs on the edge.
// Every claim here must be something the product does today; the Premium
// feature list is NOT typed here, it comes from src/utils/plans.js.

import { SALESMAN_PREMIUM_FEATURES } from "../utils/plans.js";

export const CANON = "https://xdrive.my/for-salesmen";
// Bump when the copy changes: it feeds dateModified (WEBPAGE_LD) and the
// "last reviewed" line, a freshness signal search and AI answers both read.
export const REVIEWED_ISO = "2026-10-04";
export const REVIEWED_LABEL = "October 2026";
// A real, live Salesman Premium page, linked so buyers and crawlers can see
// the product rather than a mock-up. Must stay an active account with cars.
export const EXAMPLE_PAGE = { url: "https://xdrive.my/s/premiummotors", path: "/s/premiummotors", label: "xdrive.my/s/premiummotors" };
export const SEO_TITLE = "Free Car Salesman Page & CRM for Malaysian Agents | XDrive";
export const SEO_DESC =
  "Free car page and lead pipeline for Malaysian salesmen: 10 cars on xdrive.my, buyers WhatsApp you direct. Premium adds a TikTok Live instalment calculator.";
export const SEO_KEYWORDS = [
  "salesman kereta online", "app salesman kereta Malaysia", "akaun jual kereta percuma",
  "free car listing Malaysia", "senarai kereta percuma", "car agent page Malaysia",
  "jual kereta online percuma", "profil salesman kereta", "listing kereta percuma Malaysia",
  "car salesman website Malaysia", "WhatsApp car enquiries", "XDrive salesman lite",
  "CRM salesman kereta", "jual kereta TikTok live", "kira ansuran kereta live",
  "kalkulator ansuran bulanan kereta", "car loan instalment calculator Malaysia", "salesman premium XDrive",
].join(", ");

export const FAQS = [
  { q: "Is Salesman Lite really free?",
    a: "Yes. Salesman Lite costs RM0 — no credit card, no contract, no trial that quietly bills you later. You get up to 10 active car listings, your own page on the XDrive marketplace, a lead pipeline to track enquiries, and direct WhatsApp enquiries at no cost. Premium (RM35/month) is there for when you outgrow it — but plenty of agents never need to." },
  { q: "Do I need to build a website?",
    a: "No. The moment you sign up you get a ready-made page at xdrive.my/s/yourname with all your cars on it. No hosting, no domain, no design work — just add your cars and share the link." },
  { q: "How do buyers contact me?",
    a: "Every listing has a WhatsApp button that opens a chat straight to you. No shared inbox, no platform sitting in the middle, no lead sold to three other agents. The enquiry is yours." },
  { q: "Can I still use Mudah and Carlist?",
    a: "Absolutely. Salesman Lite works alongside them. The difference is this page is yours, it lives on Malaysia's XDrive marketplace, and it doesn't charge you per listing." },
  { q: "What happens when I have more than 10 cars?",
    a: "Salesman Premium (RM35/month) triples your cap to 30 listings and adds a live presentation for TikTok and Facebook lives, a sorted \"This week\" call list with follow-up messages already drafted, a loan desk that checks affordability and compares banks, the post-sale handover checklist and customer list, AI listing captions and chat reply drafts, commission tracking, and a Performance view that shows where your deals are lost. Your Lite page and cars carry straight over — upgrade any time from your panel." },
  { q: "Can XDrive work out monthly instalments for my TikTok Live?",
    a: "Yes, on Salesman Premium. Live presentation shows one car per screen with a number (#1, #2, #3) for viewers to comment, the price, deposit, loan and rate, and the monthly instalment over 9, 7 and 5 years. Change the deposit or type the bank's flat rate and every figure updates; budget mode lists which of your cars fit a viewer's salary or monthly budget. Figures are estimates on the reducing balance (EIR) and subject to bank approval. Your contact details only appear when you tap to show them." },
  { q: "Is there an example of a real salesman page?",
    a: "Yes. xdrive.my/s/premiummotors is a live Salesman Premium page: the seller's stock, prices and a contact button on every car, exactly what a buyer sees when you share your link." },
  { q: "How long does setup take?",
    a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel — add your first car with a few photos to go live. IC verification can wait until just before your listings appear on the marketplace, so nothing holds up getting started." },
  { q: "Apa itu Salesman Lite?",
    a: "Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, senaraikan sehingga 10 kereta, dan terima enquiry pembeli terus di WhatsApp — tanpa sebarang kos atau kad kredit." },
  { q: "Boleh kira ansuran bulanan kereta masa live TikTok?",
    a: "Boleh, dengan Salesman Premium (RM35 sebulan). Live presentation tunjuk satu kereta satu skrin dengan nombor (#1, #2, #3) untuk penonton komen, harga, deposit, jumlah loan, kadar faedah dan ansuran bulanan untuk 9, 7 dan 5 tahun. Tukar deposit atau masukkan kadar flat bank, semua angka dikira semula. Anggaran sahaja atas baki berkurangan (EIR), tertakluk kepada kelulusan bank." },
];

export const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "XDrive for Salesmen (Salesman Lite and Premium)",
  alternateName: ["XDrive Salesman Lite", "XDrive Salesman Premium"],
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Car sales CRM",
  operatingSystem: "Web, Android, iOS (browser)",
  url: CANON,
  description: SEO_DESC,
  screenshot: "https://xdrive.my/for-salesmen/premium-dashboard.png",
  featureList: [
    "Own car listing page at xdrive.my/s/yourname",
    "Up to 10 listings free, 30 on Premium",
    "Buyer enquiries direct to WhatsApp and in-app chat",
    "Lead pipeline with follow-up reminders",
    ...SALESMAN_PREMIUM_FEATURES,
  ],
  offers: [
    { "@type": "Offer", name: "Salesman Lite", price: "0", priceCurrency: "MYR", url: "https://xdrive.my/salesman-onboarding/lite" },
    { "@type": "Offer", name: "Salesman Premium", price: "35", priceCurrency: "MYR", url: "https://xdrive.my/salesman-onboarding/premium",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "35", priceCurrency: "MYR", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } },
  ],
  audience: { "@type": "BusinessAudience", audienceType: "Car salesmen and car agents in Malaysia" },
  areaServed: "MY",
  inLanguage: ["en-MY", "ms-MY"],
  publisher: { "@type": "Organization", name: "XDrive", url: "https://xdrive.my" },
};
export const WEBPAGE_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: SEO_TITLE,
  url: CANON,
  description: SEO_DESC,
  inLanguage: "en-MY",
  dateModified: REVIEWED_ISO,
  isPartOf: { "@type": "WebSite", name: "XDrive", url: "https://xdrive.my" },
  about: { "@type": "SoftwareApplication", name: "XDrive for Salesmen", url: CANON },
  breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "XDrive", item: "https://xdrive.my" },
    { "@type": "ListItem", position: 2, name: "For salesmen", item: CANON },
  ] },
};
export const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const HERO_H1 = "One link. All your cars. Zero ringgit.";
export const HERO_INTRO =
  "Salesman Lite is a free page on XDrive built for Malaysian car agents. List your stock, share one link, and let buyers WhatsApp you directly — no website to build, nothing to pay, no lead sold out from under you.";

export const COMPARE_ROWS = [
  { label: "Cost", old: "Free to list, but you pay per bump to actually get seen — and bumps aren't cheap", lite: "RM0. No bumps, no paying to be seen" },
  { label: "Who gets the lead", old: "Platform sits in between", lite: "Straight to your WhatsApp" },
  { label: "Your own page", old: "No — one listing in a feed", lite: "Yes — xdrive.my/s/yourname" },
  { label: "Follow-up / CRM", old: "None — just chat threads", lite: "Built-in lead pipeline" },
];

export const STEPS = [
  { n: "01", title: "Sign up free", body: "Email or Google, your phone, and a name for your link. No card, no catch — IC verification can wait until you publish." },
  { n: "02", title: "Add your cars", body: "Upload photos and set your price. Each car goes live on XDrive the moment you publish." },
  { n: "03", title: "Share & sell", body: "Send your one link. Buyers browse your stock and WhatsApp you straight away." },
];

// Order matches FEATURE_ICONS in SalesmanLiteLanding.jsx.
export const FEATURE_COPY = [
  { title: "A page that's actually yours", body: "A clean profile at xdrive.my/s/yourname with every car you're selling. Send it once — buyers see your whole stock, your name, your number." },
  { title: "List up to 10 cars, free", body: "Photos, price and specs, published straight onto Malaysia's XDrive marketplace. No per-listing fee, no bidding for placement." },
  { title: "Leads land in your WhatsApp", body: "Every car has a WhatsApp button that messages you directly. No shared inbox, no lead resold to three other agents." },
  { title: "A pipeline, not a lost chat", body: "Every enquiry becomes a tracked lead — drag through stages, set follow-up reminders, log calls, send ready-made WhatsApp replies. The CRM other apps charge for, free on Lite." },
  { title: "See which cars pull", body: "Basic analytics show views and WhatsApp taps per listing — so you know what buyers actually want, and reprice what's gone cold." },
  { title: "One link for everything", body: "Drop it in your WhatsApp status, Instagram bio, or under your Mudah ad. Every buyer, one tap from your entire stock." },
  { title: "Free, and it stays free", body: "RM0 forever on Lite. No credit card to start, no trial timer. Upgrade to Premium only when your business asks for it." },
];

export const LITE_BULLETS = ["Up to 10 active listings", "Your page on the XDrive marketplace", "Direct WhatsApp enquiries", "Lead pipeline + follow-up reminders", "Basic performance analytics", "No credit card required"];
export const PREMIUM_BULLETS = ["Everything in Lite", "Up to 30 active listings", ...SALESMAN_PREMIUM_FEATURES];

// Premium "Live selling" section (LiveSellingSection.jsx) — the live
// presentation mode (src/components/live/LivePresenter.jsx), sold to agents
// who already hold a calculation poster up on TikTok / FB lives.
export const LIVE_SELLING = {
  kicker: "Premium · Live selling",
  title: "Selling on TikTok Live? Your calculation poster, done for you.",
  lead:
    "Agents on live hold up a spreadsheet of monthly instalments, one car at a time, retyped for every unit. Premium builds that poster for every car you list. Open Live presentation, film your screen, and answer \"monthly berapa?\" with one tap.",
  points: [
    "Every car numbered #1, #2, #3, so viewers comment the number they want",
    "Price, deposit, loan and rate worked out, then 9, 7 and 5 year monthly instalments",
    "Change the deposit or type the bank's flat rate and every number updates",
    "Budget mode: type a viewer's salary or monthly budget, see which of your cars fit",
    "Your contact box shows only when you tap it, so you decide what goes on stream",
    "The car on screen is pinned on your page as \"Live now\" for viewers who tap your bio",
  ],
  note: "Estimates on the reducing balance (EIR). Subject to bank approval.",
};
