// Copy for the /for-salesmen landing page, shared by the SPA
// (src/pages/SalesmanLiteLanding.jsx) and the crawler prerender (api/og.js).
// Googlebot and every AI crawler are routed to api/og.js by vercel.json and
// never run the SPA, so this file IS what search engines and AI answers read.
// Keep it plain data (no JSX, no icons) — api/og.js runs on the edge.
// Every claim here must be something the product does today; the Premium
// feature list is NOT typed here, it comes from src/utils/plans.js.
//
// Audience (owner, 2026-10-06): salesmen who work out instalments on TikTok /
// Facebook lives. The headline sells Live presentation (Premium); Lite is the
// free way in. Facts the copy leans on, so nobody "simplifies" them away:
//  - Every salesman car is checked before it is public (CarForm.jsx
//    needsApproval -> 'pending_approval'). Never promise "live the moment you
//    publish" or "same day".
//  - Public pages never print the seller's number (CDP-3); WhatsApp opens after
//    the buyer leaves a name (ContactGate). Never promise "your number on it".
//  - Premium's first month is free and nothing auto-bills
//    (trg_zz_premium_free_month); unpaid, the account routes back to Lite
//    (routeForProfile) and existing cars stay.
//  - No claims about named competitors.

import { SALESMAN_PREMIUM_FEATURES } from "../utils/plans.js";

export const CANON = "https://xdrive.my/for-salesmen";
// Bump when the copy changes: it feeds dateModified (WEBPAGE_LD) and the
// "last reviewed" line, a freshness signal search and AI answers both read.
export const REVIEWED_ISO = "2026-10-06";
export const REVIEWED_LABEL = "October 2026";
// XDrive's own example Salesman Premium page, linked so agents and crawlers can
// see the product rather than a mock-up. Must stay an active account with cars.
export const EXAMPLE_PAGE = { url: "https://xdrive.my/s/premiummotors", path: "/s/premiummotors", label: "xdrive.my/s/premiummotors" };
export const SEO_TITLE = "Car Instalment Calculator for TikTok Live Salesmen | XDrive";
export const SEO_DESC =
  "For Malaysian car salesmen selling on TikTok and Facebook Live: every car numbered, 9, 7 and 5-year monthlies, deposit changes in one tap. First month free.";
export const SEO_KEYWORDS = [
  "kira ansuran kereta live", "kalkulator ansuran bulanan kereta", "jual kereta TikTok live",
  "car loan instalment calculator Malaysia", "TikTok live car salesman", "salesman kereta live",
  "poster ansuran kereta", "monthly berapa kereta", "salesman premium XDrive",
  "salesman kereta online", "app salesman kereta Malaysia", "CRM salesman kereta",
  "free car listing Malaysia", "car agent page Malaysia", "XDrive salesman lite",
].join(", ");

export const HERO_EYEBROW = "For agents who sell on TikTok and Facebook Live";
export const HERO_H1 = "Monthly berapa? One tap. Every car.";
export const HERO_INTRO =
  "Live presentation builds the instalment poster for every car you list: price, deposit, loan, and the monthly over 9, 7 and 5 years. A viewer asks for a different deposit, you tap once and every number updates. Part of Salesman Premium, RM35 a month, first month free.";
export const HERO_TRUST = ["First month free", "No credit card", "Your number hidden until you tap"];
export const PREMIUM_CTA = "Try it free for 30 days";
export const LITE_CTA = "Start free on Lite";

export const FAQS = [
  { q: "Can XDrive work out monthly instalments for my TikTok Live?",
    a: "Yes, on Salesman Premium. Live presentation shows one car per screen with a number (#1, #2, #3) for viewers to comment, the price, deposit, loan and rate, and the monthly instalment over 9, 7 and 5 years. Change the deposit or type the bank's flat rate and every figure updates; budget mode lists which of your cars fit a viewer's salary or monthly budget. Figures are estimates on the reducing balance (EIR) and subject to bank approval. Your contact details only appear when you tap to show them." },
  { q: "Boleh kira ansuran bulanan kereta masa live TikTok?",
    a: "Boleh, dengan Salesman Premium (RM35 sebulan, bulan pertama percuma). Live presentation tunjuk satu kereta satu skrin dengan nombor (#1, #2, #3) untuk penonton komen, harga, deposit, jumlah loan, kadar faedah dan ansuran bulanan untuk 9, 7 dan 5 tahun. Tukar deposit atau masukkan kadar flat bank, semua angka dikira semula. Anggaran sahaja atas baki berkurangan (EIR), tertakluk kepada kelulusan bank." },
  { q: "What happens after the free month?",
    a: "Nothing is charged automatically, and we never ask for a card. Pay RM35 to keep Premium for another month. If you don't, your account goes back to free Salesman Lite: your page, cars and leads stay, and Live presentation switches off until you renew." },
  { q: "Which cars appear in my live presentation?",
    a: "The cars on your XDrive page. We check every car before it goes public, so a car you have just added joins your page and your presentation once it is approved." },
  { q: "Is Salesman Lite really free?",
    a: "Yes. Salesman Lite costs RM0, with no credit card, no contract and no trial that quietly bills you later. You get up to 10 active car listings, your own page on the XDrive marketplace, a lead pipeline to track enquiries, and direct WhatsApp enquiries at no cost. Live presentation is on Premium." },
  { q: "Do I need to build a website?",
    a: "No. You get a ready-made page at xdrive.my/s/yourname with all your cars on it. No hosting, no domain, no design work: add your cars and share the link." },
  { q: "How do buyers contact me?",
    a: "Every listing has a WhatsApp button. The buyer types their name, then WhatsApp opens a chat with you and the enquiry lands in your pipeline. Your number is not printed on the page, so it cannot be copied off it. No shared inbox and no lead sold to other agents: the enquiry is yours." },
  { q: "Can I still use Mudah and Carlist?",
    a: "Yes. XDrive works alongside them. The difference is this page is yours, it lives on the XDrive marketplace, and it doesn't charge you per listing." },
  { q: "What happens when I have more than 10 cars?",
    a: "Salesman Premium (RM35/month) triples your cap to 30 listings and adds a live presentation for TikTok and Facebook lives, a sorted \"This week\" call list with follow-up messages already drafted, a loan desk that checks affordability and compares banks, the post-sale handover checklist and customer list, AI listing captions and chat reply drafts, commission tracking, and a Performance view that shows where your deals are lost. Your Lite page and cars carry straight over: upgrade any time from your panel." },
  { q: "Is there an example page I can see?",
    a: "Yes. xdrive.my/s/premiummotors is XDrive's example Salesman Premium page: stock, prices and a contact button on every car, exactly what a buyer sees when you share your link." },
  { q: "How long does setup take?",
    a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel. You're asked for your IC number when you add your first car, and each car goes public once we've checked it." },
  { q: "Apa itu Salesman Lite?",
    a: "Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, senaraikan sehingga 10 kereta, dan terima enquiry pembeli terus di WhatsApp, tanpa sebarang kos atau kad kredit." },
];

export const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "XDrive for Salesmen (Salesman Lite and Premium)",
  alternateName: ["XDrive Live presentation", "XDrive Salesman Lite", "XDrive Salesman Premium"],
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Car sales CRM",
  operatingSystem: "Web, Android, iOS (browser)",
  url: CANON,
  description: SEO_DESC,
  screenshot: "https://xdrive.my/for-salesmen/premium-dashboard.png",
  featureList: [
    "Live presentation: car instalment calculator for TikTok and Facebook lives",
    "Own car listing page at xdrive.my/s/yourname",
    "Up to 10 listings free, 30 on Premium",
    "Buyer enquiries by WhatsApp and in-app chat",
    "Lead pipeline with follow-up reminders",
    ...SALESMAN_PREMIUM_FEATURES,
  ],
  offers: [
    { "@type": "Offer", name: "Salesman Lite", price: "0", priceCurrency: "MYR", url: "https://xdrive.my/salesman-onboarding/lite" },
    { "@type": "Offer", name: "Salesman Premium", price: "35", priceCurrency: "MYR", url: "https://xdrive.my/salesman-onboarding/premium",
      description: "First month free.",
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

// "Sound familiar?" — the poster by hand vs Live presentation. Owner's call
// 2026-10-06: compare against the agent's own routine, never a named platform.
export const COMPARE_OLD_LABEL = "By hand";
export const COMPARE_NEW_LABEL = "Live presentation";
export const COMPARE_ROWS = [
  { label: "Every car", old: "Retype the spreadsheet poster for each unit", now: "Built from the cars you list, numbered #1, #2, #3" },
  { label: "Viewer asks for a lower deposit", old: "Redo the maths on a calculator while the live waits", now: "Tap the deposit, every monthly updates" },
  { label: "Bank quotes a flat rate", old: "Work out the conversion yourself", now: "Type the flat rate, it is converted to EIR for you" },
  { label: "Your phone number", old: "Printed on the poster for the whole live", now: "Hidden until you tap to show it" },
];

export const STEPS = [
  { n: "01", title: "Sign up", body: "Email or Google, your phone and a name for your link. Premium's first month is free, no card needed." },
  { n: "02", title: "Add your cars", body: "Photos, price and specs. We check each car, then it's on your page, on the marketplace and in your presentation." },
  { n: "03", title: "Go live", body: "Open Live presentation, film your screen and answer \"monthly berapa?\" with one tap." },
];

// Free on Lite. Order matches FEATURE_ICONS in SalesmanLiteLanding.jsx.
export const FEATURE_COPY = [
  { title: "A page that's actually yours", body: "A clean profile at xdrive.my/s/yourname with every car you're selling. Send it once and buyers see your whole stock with your name on it." },
  { title: "List up to 10 cars, free", body: "Photos, price and specs on the XDrive marketplace once we've checked them. No per-listing fee, no paying to be seen." },
  { title: "Leads come to you", body: "Every car has a WhatsApp button. The buyer leaves a name, then the chat opens with you. No shared inbox, no lead resold to other agents." },
  { title: "A pipeline, not a lost chat", body: "Every enquiry becomes a tracked lead: move it through stages, set follow-up reminders, log calls and send ready-made WhatsApp replies. Free on Lite." },
  { title: "See which cars pull", body: "Views and WhatsApp taps per listing, so you know what buyers want and reprice what's gone cold." },
  { title: "One link for everything", body: "Drop it in your WhatsApp status, Instagram or TikTok bio. Every buyer, one tap from your entire stock." },
  { title: "Free, and it stays free", body: "RM0 forever on Lite. No credit card, no trial timer. Upgrade to Premium only when your business asks for it." },
];

export const LITE_BULLETS = ["Up to 10 active listings", "Your page on the XDrive marketplace", "WhatsApp enquiries to you", "Lead pipeline + follow-up reminders", "Views and WhatsApp taps per car", "No credit card required"];
export const PREMIUM_BULLETS = ["Everything in Lite", "Up to 30 active listings", ...SALESMAN_PREMIUM_FEATURES];

// Premium "Live selling" detail section (LiveSellingSection.jsx) — what Live
// presentation (src/components/live/LivePresenter.jsx) does, point by point.
// The hero shows the real presenter with real cars (LiveDemo.jsx).
export const LIVE_SELLING = {
  kicker: "Live presentation",
  title: "Built for the questions viewers actually ask.",
  lead:
    "Agents on live hold up a spreadsheet of monthly instalments, one car at a time, retyped for every unit. Premium builds that poster for every car you list. Open Live presentation, film your screen, and answer from the screen.",
  points: [
    "Every car numbered #1, #2, #3, so viewers comment the number they want",
    "Price, deposit, loan and rate worked out, then 9, 7 and 5 year monthly instalments",
    "Change the deposit or type the bank's flat rate and every number updates",
    "Budget mode: type a viewer's salary or monthly budget, see which of your cars fit",
    "A rebate for this live only, taken off the price without touching your listing",
    "Docs screen: what the bank asks a buyer for, employee or own business",
    "Your contact box shows only when you tap it, so you decide what goes on stream",
    "The car on screen is pinned on your page as \"Live now\" for viewers who tap your bio",
  ],
  note: "Estimates on the reducing balance (EIR). Subject to bank approval.",
};

// Hero demo (LiveDemo.jsx): the real Live presentation with a real seller's cars.
export const LIVE_DEMO = {
  label: "Live presentation, working demo with real cars",
  caption: "Real cars from an XDrive seller. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
  sampleCaption: "Sample car. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
};
