// Copy for the /for-salesmen landing page, shared by the SPA
// (src/pages/SalesmanLiteLanding.jsx + src/components/salesmanLanding/*) and
// the crawler prerender (api/og.js). Googlebot and every AI crawler are routed
// to api/og.js by vercel.json and never run the SPA, so this file IS what
// search engines and AI answers read.
// Keep it plain data (no JSX, no icons) — api/og.js runs on the edge.
//
// MALAY FIRST (owner, 2026-10-13). The page opens in Bahasa Melayu and offers
// "Change to English"; the choice is remembered per device (LANG_KEY). Both
// languages live HERE, side by side, in LANDING_COPY.ms / LANDING_COPY.en —
// never type a string into the JSX. The crawler serves the Malay copy
// (lang="ms"), so FAQ_LD is the Malay FAQ. This page's language is its own
// switch, independent of the app-wide i18n language (a salesman can run the
// dashboard in English and still land here in BM).
// BM tone: how a Malaysian car salesman talks. "Anda", and the English words
// salesmen actually use (lead, follow up, page, booking, live, WhatsApp).
// Not stiff Dewan BM, no "bro". No emojis.
//
// Every claim here must be something the product does today; the Premium
// feature list is NOT typed here, it comes from src/utils/plans.js, and the
// listing caps come from PLAN_CONFIG (src/utils/planConfig.js).
//
// Audience (owner, 2026-10-06): salesmen who work out instalments on TikTok /
// Facebook lives. The headline sells Live presentation, which is FREE on Lite
// (owner, 2026-10-18: Live gets agents in, the lead tools make them pay), so
// the main buttons sign up to Lite. Lite = "get found, get the lead, go live";
// working the lead (follow-up reminders, call log, Performance) is Premium
// (owner, 2026-10-13). Facts the
// copy leans on, so nobody "simplifies" them away:
//  - Every salesman car is checked before it is public (CarForm.jsx
//    needsApproval -> 'pending_approval'). Never promise "live the moment you
//    publish" or "same day".
//  - Public pages never print the seller's number (CDP-3); WhatsApp opens after
//    the buyer leaves a name (ContactGate). Never promise "your number on it".
//  - Premium's first 7 days are free (owner, 2026-10-25; was a month) and nothing auto-bills
//    (trg_zz_premium_free_month); unpaid, the account routes back to Lite
//    (routeForProfile) and existing cars stay.
//  - No claims about named competitors.

import { SALESMAN_PREMIUM_FEATURES, SALESMAN_PREMIUM_FEATURES_MS, salesmanPremiumFeaturesByGroup } from "../utils/plans.js";
import { PLAN_CONFIG } from "../utils/planConfig.js";
import { LITE_POSTERS_PER_MONTH } from "../utils/loanPoster.js";

const LITE_CAP = PLAN_CONFIG.salesman_lite.listingCap;
const PREMIUM_CAP = PLAN_CONFIG.salesman_full.listingCap;
const LITE_POSTERS = LITE_POSTERS_PER_MONTH;
const PREMIUM_PRICE = PLAN_CONFIG.salesman_full.price;
const TRIAL_DAYS = PLAN_CONFIG.salesman_full.trialDays;
// "About RM1.20 a day": the price over a 30-day month, rounded to 10 sen.
const PER_DAY = (Math.round((PREMIUM_PRICE / 30) * 10) / 10).toFixed(2);
const P_EN = salesmanPremiumFeaturesByGroup("en");
const P_MS = salesmanPremiumFeaturesByGroup("ms");

export const DEFAULT_LANG = "ms";
// Per-device memory of the visitor's choice on THIS page only.
export const LANG_KEY = "xd_for_salesmen_lang";

export const CANON = "https://xdrive.my/for-salesmen";
// Bump when the copy changes: it feeds dateModified (webpageLd) and the
// "last reviewed" line, a freshness signal search and AI answers both read.
export const REVIEWED_ISO = "2026-10-28";
// XDrive's own example Salesman Premium page, linked so agents and crawlers can
// see the product rather than a mock-up. Must stay an active account with cars.
export const EXAMPLE_PAGE = { url: "https://xdrive.my/s/premiummotors", path: "/s/premiummotors", label: "xdrive.my/s/premiummotors" };
export const SEO_KEYWORDS = [
  "kira ansuran kereta live", "kalkulator ansuran bulanan kereta", "jual kereta TikTok live",
  "car loan instalment calculator Malaysia", "TikTok live car salesman", "salesman kereta live",
  "poster ansuran kereta", "monthly berapa kereta", "salesman premium XDrive",
  "salesman kereta online", "app salesman kereta Malaysia", "CRM salesman kereta",
  "free car listing Malaysia", "car agent page Malaysia", "XDrive salesman lite",
].join(", ");

// ─── English ────────────────────────────────────────────────────────────────
const EN = {
  htmlLang: "en",
  inLanguage: "en-MY",
  switchTo: "ms",
  switchLabel: "Tukar ke Bahasa Melayu",

  seoTitle: "Car Instalment Calculator for TikTok Live Salesmen | XDrive",
  seoDesc:
    "For Malaysian car salesmen selling on TikTok and Facebook Live: every car numbered, 9, 7 and 5-year monthlies, deposit changes in one tap. Free on Salesman Lite.",

  heroEyebrow: "For agents who sell on TikTok and Facebook Live",
  heroH1Lines: ["Monthly berapa?", "One tap.", "Every car."],
  heroIntro:
    "Live presentation builds the instalment poster for every car you list: price, deposit, loan, and the monthly over 9, 7 and 5 years. A viewer asks for a different deposit, you tap once and every number updates. Free on Salesman Lite.",
  heroTrust: ["No credit card", "Nothing charged automatically", "Your number hidden until you tap"],
  liveCta: "Go live free",
  premiumCta: "Try Premium free for 7 days",
  liteCta: "Start free on Lite",
  band: { before: "Every car you list also goes on the ", strong: "xdrive.my", after: " marketplace" },

  demo: {
    label: "Live presentation, working demo with real cars",
    caption: "Real cars, starting with a new Proton Saga: tap a variant and every number follows. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
    captionUsed: "Real cars from an XDrive seller. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
    sampleCaption: "Sample car. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
  },

  // "Live selling" detail section (LiveSellingSection.jsx) — what Live
  // presentation (src/components/live/LivePresenter.jsx) does, point by point.
  live: {
    kicker: "Live presentation",
    title: "Built for the questions viewers actually ask.",
    lead:
      "Agents on live hold up a spreadsheet of monthly instalments, one car at a time, retyped for every unit. We build that poster for every car you list, free on Lite. Open Live presentation, film your screen, and answer from the screen.",
    points: [
      "Every car numbered #1, #2, #3, so viewers comment the number they want",
      "Price, deposit, loan and rate worked out, then 9, 7 and 5 year monthly instalments",
      "Change the deposit or type the bank's flat rate and every number updates",
      "Budget mode: type a viewer's salary or monthly budget, see which of your cars fit",
      "A rebate for this live only, taken off the price without touching your listing",
      "Insurance in the loan if you quote it that way, with the viewer's NCD in one tap",
      "Docs screen: what the bank asks a buyer for, employee or own business",
      "Your contact box shows only when you tap it, so you decide what goes on stream",
      "The car on screen is pinned on your page as \"Live now\" for viewers who tap your bio",
    ],
    note: "Estimates on the reducing balance (EIR). Subject to bank approval.",
  },

  // "Sound familiar?" — the poster by hand vs Live presentation. Owner's call
  // 2026-10-06: compare against the agent's own routine, never a named platform.
  compare: {
    kicker: "Sound familiar?",
    title: "Selling on live shouldn't mean retyping a poster.",
    oldLabel: "By hand",
    newLabel: "Live presentation",
    rows: [
      { label: "Every car", old: "Retype the spreadsheet poster for each unit", now: "Built from the cars you list, numbered #1, #2, #3" },
      { label: "Viewer asks for a lower deposit", old: "Redo the maths on a calculator while the live waits", now: "Tap the deposit, every monthly updates" },
      { label: "Bank quotes a flat rate", old: "Work out the conversion yourself", now: "Type the flat rate, it is converted to EIR for you" },
      { label: "Your phone number", old: "Printed on the poster for the whole live", now: "Hidden until you tap to show it" },
    ],
  },

  // "What you get with each plan" (PlanTour.jsx). Text only; images and order
  // live in PlanTour. Copy rule: no invented numbers, no income figure.
  tour: {
    kicker: "Inside the app",
    title: "What you get with each plan",
    toggleAria: "Choose a plan",
    plus: "Everything in Lite, plus more on every tab.",
    seeLite: "See Lite",
    shotPending: "Screenshot coming",
    plans: {
      lite: { label: "Lite", price: "Free", cta: "Sign up free" },
      premium: { label: "Premium", price: "RM35/mo", cta: "Start Premium" },
    },
    sections: {
      liteLeads: {
        tab: "Leads",
        alt: "Lead list of 37 buyers with source breakdown, stage filters and buyer cards showing warm tags and a WhatsApp button",
        title: "Every buyer in a stage, not lost in a chat.",
        line: "An alert on your phone when a new buyer comes in.",
      },
      dashboard: {
        tab: "Dashboard",
        alt: "Salesman Premium dashboard showing 4 overdue follow-ups, 30-day views, page visits and WhatsApp taps, and a 7-day traffic chart",
        title: "Open the app. Know who needs you today.",
        line: "Overdue follow-ups counted for you, right at the top.",
      },
      carPerformance: {
        tab: "Dashboard",
        alt: "Per-car performance list showing views, WhatsApp taps and conversion rate, with one car tagged Rising",
        title: "See which car pulls buyers, and which one is stuck.",
        line: "Views and WhatsApp taps for every car, last 30 days.",
      },
      premiumLeads: {
        tab: "Leads",
        alt: "Lead pipeline with stage filters and buyer cards flagged Never contacted with the number of days waiting",
        title: "Every buyer in a stage, not lost in a chat.",
        line: "Buyers nobody replied to are flagged, with how long they waited.",
      },
      sold: {
        tab: "Sold",
        alt: "8-step handover checklist for a won deal, with loan settlement and insurance done and Puspakom inspection next",
        title: "Won is not done. The handover, step by step.",
        line: "A won deal gets its 8-step handover checklist.",
      },
      analytics: {
        tab: "Analytics",
        alt: "Close rate funnel showing where deals stop, with Contacted marked as the weakest step, plus median reply speed",
        title: "Find out where you are losing deals.",
        line: "Close rate, reply speed and why deals were lost.",
      },
    },
  },

  // Free on Lite. Order matches FEATURE_ICONS in SalesmanLiteLanding.jsx.
  features: {
    kicker: "Free on Lite",
    title: "Get found. Get the lead. Pay nothing.",
    items: [
      { title: "A page that's yours", body: "A basic page at xdrive.my/s/yourname with every car you're selling. Send it once and buyers see your whole stock with your name on it." },
      { title: `List up to ${LITE_CAP} cars, free`, body: "Photos, price and specs on the XDrive marketplace once we've checked them. No per-listing fee, no paying to be seen." },
      { title: "Buyers reach you three ways", body: "WhatsApp, in-app chat, or a booking request to come and view the car. Every enquiry comes straight to you. No shared inbox, no lead resold to other agents." },
      { title: "Know the moment a buyer asks", body: "An alert on your phone for new leads, so the buyer who messages at 11pm doesn't wait until tomorrow." },
      { title: "Every buyer in one list", body: "Each enquiry becomes a lead with a stage: New, Contacted, Viewing, Test drive, Won. You see at a glance who is where." },
      { title: "One link for everything", body: "Drop it in your WhatsApp status, Instagram or TikTok bio. Every buyer, one tap from your entire stock." },
      { title: "Free, and it stays free", body: "RM0 forever on Lite, Live presentation included. No credit card, no trial timer. Want follow-up reminders and call logs? That's Premium, when you're ready." },
    ],
  },

  showcase: {
    example: "See an example page:",
    phoneAria: "Sample agent page",
    phoneRole: "Car Agent",
    phoneArea: "Klang Valley",
    caption: "Sample page",
    cars: [
      { name: "2019 Honda Civic 1.5 TC-P", price: "RM 98,800", tag: "Low mileage" },
      { name: "2021 Perodua Ativa 1.0 AV", price: "RM 62,500", tag: "Under warranty" },
      { name: "2018 Toyota Vellfire 2.5", price: "RM 218,000", tag: "1 owner" },
    ],
  },

  how: {
    kicker: "How it works",
    title: "Live in three steps.",
    steps: [
      { n: "01", title: "Sign up", body: "Email or Google. Free, no card." },
      { n: "02", title: "Add your cars", body: "Photos, price, specs. We check each one first." },
      { n: "03", title: "Go live", body: "Open Live presentation. Answer \"monthly berapa?\" with one tap." },
    ],
  },

  // Order matches WHY_ICONS in SalesmanLiteLanding.jsx.
  // The visible page (owner, 2026-10-23, after SA Studio's page): one short
  // line per idea, a real picture beside it. The long sections above (live,
  // compare, features) are what the crawler render reads (api/og.js); the
  // SPA no longer prints them.
  short: {
    heroLine: "Every car you list gets its monthly instalments worked out. A viewer asks, you tap.",
    painKicker: "Sound familiar?",
    pains: [
      "Working out the loan by hand every time a buyer asks.",
      "Retyping the instalment poster for every car.",
      "A viewer wants a different deposit, and the live waits while you redo it.",
    ],
    painFix: "Now: one tap, every number ready.",
    getKicker: "What you get, free",
    poster: {
      title: "A loan poster in seconds.",
      line: "Price, deposit and the 9, 7 and 5 year monthly, with your name and number on it.",
      chips: [`Lite: ${LITE_POSTERS} cars a month`, "Premium: unlimited", "Flat rate converted to EIR"],
      caption: "Drawn live by the app from a real car. Sample seller, number hidden.",
      aria: "Sample loan poster",
    },
    page: {
      title: "One link. All your cars.",
      line: "Put it in your TikTok bio or WhatsApp status. Buyers tap a car and reach you.",
      chips: ["Your own page", "On the marketplace", "WhatsApp, chat, booking"],
    },
    plansKicker: "Pricing",
    plansTitle: "Start free. Upgrade when it pays.",
    // Hero offer (owner, 2026-10-28): two leads asked "is it monthly?" and took
    // the product for a calculator. The offer names the price, the billing and
    // the three parts (page, live + loan tools, CRM dashboard) above the fold.
    offer: {
      kicker: `Premium · first ${TRIAL_DAYS} days free`,
      title: "More than a calculator. Your whole sales desk.",
      price: `RM${PREMIUM_PRICE}`,
      per: "/month",
      perDay: `About RM${PER_DAY} a day`,
      parts: [
        { title: "Your sales page", line: `Up to ${PREMIUM_CAP} cars on one link, on the marketplace too` },
        { title: "Live + loan tools", line: "Live presentation, unlimited loan posters, loan desk" },
        { title: "Lead dashboard (CRM)", line: "Who to call today, follow-up reminders, commission, handover" },
      ],
      billing: "Paid month by month. No contract, no card, nothing charged automatically.",
      cta: `Start ${TRIAL_DAYS} days free`,
      liteLink: "Or start free on Lite",
    },
    // Plan cards: the same three parts on both cards, so Lite vs Premium is
    // read part by part, and the billing sentence sits under the price.
    planCards: {
      premium: {
        billing: `Billed monthly: pay RM${PREMIUM_PRICE} each month to keep it. No contract, nothing charged automatically. Stop paying and you go back to Lite; your cars and leads stay.`,
        groups: [
          { h: "Your sales page", items: [`Up to ${PREMIUM_CAP} cars on your page and the marketplace`, ...P_EN.page] },
          { h: "Live + loan tools", items: ["Live presentation for TikTok / FB lives", "Unlimited loan posters", ...P_EN.tools.slice(0, 2)] },
          { h: "Lead dashboard (CRM)", items: P_EN.crm.slice(0, 5) },
        ],
      },
      lite: {
        billing: "Free forever. No credit card, no trial that bills you later.",
        groups: [
          { h: "Your sales page", items: [`Up to ${LITE_CAP} cars on your page and the marketplace`, "Buyers reach you by WhatsApp, chat and booking"] },
          { h: "Live + loan tools", items: ["Live presentation for TikTok / FB lives", `Loan posters for ${LITE_POSTERS} cars a month`] },
          { h: "Lead dashboard", items: ["Alerts on new leads", "A simple lead list with stages", "Views + WhatsApp taps for each car"] },
        ],
      },
    },
    more: "And more",
  },
  plans: {
    kicker: "Pick your plan",
    title: "Go live free on Lite. Premium to follow up every lead.",
    premiumName: "Salesman Premium",
    premiumPer: "/month",
    premiumNote: "7 days free",
    liteName: "Salesman Lite",
    litePer: "/forever",
    premiumBullets: ["Everything in Lite", `Up to ${PREMIUM_CAP} active listings`, ...SALESMAN_PREMIUM_FEATURES],
    liteBullets: [
      `Up to ${LITE_CAP} active listings`,
      "Your own page at xdrive.my/s/yourname",
      "Your cars on the XDrive marketplace",
      "Buyers reach you by WhatsApp, chat and booking requests",
      "Live presentation for TikTok / FB lives",
      "Alerts on new leads",
      "A simple lead list with stages",
      "No credit card required",
    ],
  },

  faq: {
    kicker: "Questions",
    title: "Good to know.",
    reviewed: "Page last reviewed",
    reviewedLabel: "October 2026",
    items: [
      { q: "Is Premium a one-off payment or monthly?",
        a: `Monthly. Premium is RM${PREMIUM_PRICE} a month, and the first ${TRIAL_DAYS} days are free. There is no contract and we never take a card, so nothing is charged automatically: you pay for the next month when you want to keep it. If you stop, your account goes back to free Lite and your page, cars and leads stay.` },
      { q: "Do I only get the instalment calculator?",
        a: `No. The calculator (Live presentation and loan posters) is one of three parts. You also get your own sales page with your cars, listed on the marketplace, and a lead dashboard: every buyer who contacts you lands there with a stage. Premium adds the full CRM on top: who to call today, follow-up reminders and call log, WhatsApp to all your quiet leads, commission tracking and the handover checklist.` },
      { q: "Can XDrive work out monthly instalments for my TikTok Live?",
        a: "Yes, free on Salesman Lite. Live presentation shows one car per screen with a number (#1, #2, #3) for viewers to comment, the price, deposit, loan and rate, and the monthly instalment over 9, 7 and 5 years. Change the deposit or type the bank's flat rate and every figure updates; budget mode lists which of your cars fit a viewer's salary or monthly budget. Figures are estimates on the reducing balance (EIR) and subject to bank approval. Your contact details only appear when you tap to show them." },
      { q: "What happens after the 7 free days?",
        a: "Nothing is charged automatically, and we never ask for a card. Pay RM35 to keep Premium for another month. If you don't, your account goes back to free Salesman Lite: your page, cars and leads stay, and the Premium tools (follow-up reminders, call logging and the rest) switch off until you renew. Live presentation stays on: it is part of Lite." },
      { q: "Which cars appear in my live presentation?",
        a: "The cars on your XDrive page. We check every car before it goes public, so a car you have just added joins your page and your presentation once it is approved." },
      { q: "Is Salesman Lite really free?",
        a: `Yes. Salesman Lite costs RM0, with no credit card, no contract and no trial that quietly bills you later. You get up to ${LITE_CAP} active car listings, a basic page of your own at xdrive.my/s/yourname, your cars on the XDrive marketplace, buyer enquiries by WhatsApp, in-app chat and booking requests, an alert for new leads, a simple lead list with stages, and Live presentation for your TikTok and Facebook lives. Follow-up reminders and call logging are on Premium.` },
      { q: "What is Salesman Lite?",
        a: `Salesman Lite is the free XDrive account for car salesmen and agents in Malaysia. You get a page of your own on xdrive.my, list up to ${LITE_CAP} cars, and buyers reach you by WhatsApp, in-app chat or a booking request, at no cost and with no credit card.` },
      { q: "Do I need to build a website?",
        a: "No. You get a ready-made page at xdrive.my/s/yourname with all your cars on it. No hosting, no domain, no design work: add your cars and share the link." },
      { q: "How do buyers contact me?",
        a: "Three ways: WhatsApp, in-app chat, or a booking request to view the car. For WhatsApp the buyer types their name, then a chat opens with you. Every enquiry lands in your lead list and you get an alert. Your number is not printed on the page, so it cannot be copied off it. No shared inbox and no lead sold to other agents: the enquiry is yours." },
      { q: "Can I still use Mudah and Carlist?",
        a: "Yes. XDrive works alongside them. The difference is this page is yours, it lives on the XDrive marketplace, and it doesn't charge you per listing." },
      { q: `What happens when I have more than ${LITE_CAP} cars?`,
        a: `Salesman Premium (RM35/month, first 7 days free) raises your cap to ${PREMIUM_CAP} listings and adds a sorted "This week" call list with follow-up messages already drafted, follow-up reminders and call logging, WhatsApp to all your quiet leads in one go, a loan desk that checks affordability and compares banks, the post-sale handover checklist and customer list, AI listing captions and chat reply drafts, commission tracking, Telegram booking reminders, a services and add-ons catalogue, a page you can customise with your bio and social links, and a Performance view that shows your close rate and where your deals are lost. Your Lite page and cars carry straight over: upgrade any time from your panel.` },
      { q: "Is there an example page I can see?",
        a: "Yes. xdrive.my/s/premiummotors is XDrive's example Salesman Premium page: stock, prices and a contact button on every car, exactly what a buyer sees when you share your link." },
      { q: "How long does setup take?",
        a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel. You're asked for your IC number when you add your first car, and each car goes public once we've checked it." },
    ],
  },

  final: {
    titleLines: ["Your next live,", "already worked out."],
    body: "Every car you list becomes a screen with its monthlies ready.",
    liteLink: "Or try Premium free for 7 days",
    trust: ["Free on Lite", "Number hidden until you tap", "One link for your bio"],
  },

  // Crawler-only headings (api/og.js).
  crawler: {
    pricing: "Pricing",
    premiumPrice: "Salesman Premium: RM35/month, first 7 days free",
    litePrice: "Salesman Lite: RM0, free forever",
    faq: "FAQ",
    browse: "Browse cars on XDrive",
    dealers: "ShiftOS for dealers",
  },
};

// ─── Bahasa Melayu (default) ────────────────────────────────────────────────
const MS = {
  htmlLang: "ms",
  inLanguage: "ms-MY",
  switchTo: "en",
  switchLabel: "Change to English",

  seoTitle: "Kalkulator Ansuran Kereta untuk Salesman TikTok Live | XDrive",
  seoDesc:
    "Untuk salesman kereta di Malaysia yang jual di TikTok dan Facebook Live: setiap kereta bernombor, monthly 9, 7 dan 5 tahun, tukar deposit dengan satu tap. Percuma dengan Salesman Lite.",

  heroEyebrow: "Untuk salesman yang jual kereta di TikTok dan Facebook Live",
  heroH1Lines: ["Monthly berapa?", "Satu tap.", "Semua kereta."],
  heroIntro:
    "Live presentation siapkan poster ansuran untuk setiap kereta yang anda listing: harga, deposit, loan, dan monthly untuk 9, 7 dan 5 tahun. Penonton minta deposit lain, anda tap sekali dan semua nombor terus berubah. Percuma dengan Salesman Lite.",
  heroTrust: ["Tak perlu kad kredit", "Tiada caj automatik", "Nombor anda tersembunyi sampai anda tap"],
  liveCta: "Mula live percuma",
  premiumCta: "Cuba Premium percuma 7 hari",
  liteCta: "Mula percuma dengan Lite",
  band: { before: "Setiap kereta yang anda listing juga masuk marketplace ", strong: "xdrive.my", after: "" },

  demo: {
    label: "Live presentation, demo sebenar dengan kereta sebenar",
    caption: "Kereta sebenar, bermula dengan Proton Saga baru: tap varian dan semua nombor ikut. Tap Bajet atau Dokumen, tukar deposit. Anggaran sahaja, bank yang putuskan.",
    captionUsed: "Kereta sebenar dari seller XDrive. Tap Bajet atau Dokumen, tukar deposit. Anggaran sahaja, bank yang putuskan.",
    sampleCaption: "Contoh kereta. Tap Bajet atau Dokumen, tukar deposit. Anggaran sahaja, bank yang putuskan.",
  },

  live: {
    kicker: "Live presentation",
    title: "Dibina untuk soalan yang penonton betul-betul tanya.",
    lead:
      "Ramai salesman masa live angkat spreadsheet ansuran bulanan, satu kereta satu masa, taip semula untuk setiap unit. Kami siapkan poster tu untuk setiap kereta yang anda listing, percuma dengan Lite. Buka Live presentation, rakam skrin anda, dan jawab terus dari skrin.",
    points: [
      "Setiap kereta bernombor #1, #2, #3, jadi penonton komen nombor kereta yang dia nak",
      "Harga, deposit, loan dan kadar faedah dah dikira, terus keluar monthly 9, 7 dan 5 tahun",
      "Tukar deposit atau masukkan kadar flat bank, semua nombor terus dikira semula",
      "Budget mode: masukkan gaji atau bajet bulanan penonton, terus nampak kereta mana yang muat",
      "Rebate khas untuk live ni sahaja, ditolak dari harga tanpa ubah listing anda",
      "Insurans dalam loan kalau anda kira macam tu, dengan NCD penonton dalam satu tap",
      "Skrin Dokumen: apa yang bank minta dari pembeli, makan gaji atau buat bisnes sendiri",
      "Kotak contact anda hanya keluar bila anda tap, jadi anda yang tentukan apa masuk dalam stream",
      "Kereta yang tengah di skrin di-pin di page anda sebagai \"Live now\" untuk penonton yang tap link bio anda",
    ],
    note: "Anggaran atas baki berkurangan (EIR). Tertakluk kepada kelulusan bank.",
  },

  compare: {
    kicker: "Biasa jadi macam ni?",
    title: "Jual masa live tak sepatutnya kena taip semula poster.",
    oldLabel: "Cara manual",
    newLabel: "Live presentation",
    rows: [
      { label: "Setiap kereta", old: "Taip semula poster spreadsheet untuk setiap unit", now: "Siap dari kereta yang anda listing, bernombor #1, #2, #3" },
      { label: "Penonton minta deposit lebih rendah", old: "Kira semula guna kalkulator, live pula kena tunggu", now: "Tap deposit, semua monthly terus berubah" },
      { label: "Bank bagi kadar flat", old: "Kena convert sendiri", now: "Masukkan kadar flat, sistem tukar ke EIR untuk anda" },
      { label: "Nombor telefon anda", old: "Terpampang atas poster sepanjang live", now: "Tersembunyi sampai anda tap untuk tunjuk" },
    ],
  },

  tour: {
    kicker: "Dalam app",
    title: "Apa anda dapat dengan setiap pelan",
    toggleAria: "Pilih pelan",
    plus: "Semua yang ada dalam Lite, dan lebih lagi di setiap tab.",
    seeLite: "Tengok Lite",
    shotPending: "Screenshot akan datang",
    plans: {
      lite: { label: "Lite", price: "Percuma", cta: "Daftar percuma" },
      premium: { label: "Premium", price: "RM35/bln", cta: "Mula Premium" },
    },
    sections: {
      liteLeads: {
        tab: "Leads",
        alt: "Senarai 37 pembeli dengan pecahan sumber, filter stage dan kad pembeli yang tunjuk tag warm serta butang WhatsApp",
        title: "Setiap pembeli ada stage, tak hilang dalam chat.",
        line: "Alert di telefon bila pembeli baru masuk.",
      },
      dashboard: {
        tab: "Dashboard",
        alt: "Dashboard Salesman Premium yang tunjuk 4 follow-up tertunggak, views 30 hari, lawatan page dan tap WhatsApp, serta carta trafik 7 hari",
        title: "Buka app. Terus tahu siapa perlukan anda hari ni.",
        line: "Follow up yang tertunggak dikira untuk anda, paling atas.",
      },
      carPerformance: {
        tab: "Dashboard",
        alt: "Senarai prestasi setiap kereta yang tunjuk views, tap WhatsApp dan kadar conversion, dengan satu kereta ditanda Rising",
        title: "Tengok kereta mana yang tarik pembeli, dan mana yang tersangkut.",
        line: "Views dan tap WhatsApp untuk setiap kereta, 30 hari terakhir.",
      },
      premiumLeads: {
        tab: "Leads",
        alt: "Pipeline lead dengan filter stage dan kad pembeli ditanda Never contacted berserta bilangan hari menunggu",
        title: "Setiap pembeli ada stage, tak hilang dalam chat.",
        line: "Pembeli yang belum dibalas ditanda, dengan berapa hari dia tunggu.",
      },
      sold: {
        tab: "Sold",
        alt: "Senarai semak handover 8 langkah untuk deal yang dah Won, dengan loan settlement dan insurans selesai dan pemeriksaan Puspakom seterusnya",
        title: "Won belum bermakna selesai. Handover, langkah demi langkah.",
        line: "Deal won terus dapat senarai semak handover 8 langkah.",
      },
      analytics: {
        tab: "Analytics",
        alt: "Funnel close rate yang tunjuk di mana deal berhenti, dengan Contacted ditanda sebagai langkah paling lemah, serta median kelajuan balas",
        title: "Cari di mana anda terlepas deal.",
        line: "Close rate, kelajuan balas dan sebab deal terlepas.",
      },
    },
  },

  features: {
    kicker: "Percuma dengan Lite",
    title: "Senang dicari. Dapat lead. Tak perlu bayar.",
    items: [
      { title: "Page anda sendiri", body: "Page asas di xdrive.my/s/namaanda dengan semua kereta yang anda jual. Hantar sekali, pembeli nampak semua stok anda dengan nama anda di atas." },
      { title: `Listing sampai ${LITE_CAP} kereta, percuma`, body: "Gambar, harga dan spec masuk marketplace XDrive lepas kami semak. Tiada caj setiap listing, tak perlu bayar untuk dilihat." },
      { title: "Pembeli boleh hubungi anda tiga cara", body: "WhatsApp, chat dalam app, atau booking untuk datang tengok kereta. Setiap enquiry terus masuk kepada anda. Tiada inbox kongsi, lead tak dijual kepada ejen lain." },
      { title: "Terus tahu bila pembeli tanya", body: "Alert di telefon anda untuk lead baru, jadi pembeli yang mesej pukul 11 malam tak perlu tunggu sampai esok." },
      { title: "Semua pembeli dalam satu senarai", body: "Setiap enquiry jadi lead dengan stage: New, Contacted, Viewing, Test drive, Won. Sekali pandang, anda tahu siapa di tahap mana." },
      { title: "Satu link untuk semua", body: "Letak di status WhatsApp, bio Instagram atau TikTok anda. Setiap pembeli, satu tap saja dari semua stok anda." },
      { title: "Percuma, dan kekal percuma", body: "RM0 selamanya dengan Lite, termasuk Live presentation. Tiada kad kredit, tiada tempoh trial. Nak reminder follow up dan log panggilan? Itu Premium, bila anda dah sedia." },
    ],
  },

  showcase: {
    example: "Tengok contoh page:",
    phoneAria: "Contoh page ejen",
    phoneRole: "Ejen Kereta",
    phoneArea: "Lembah Klang",
    caption: "Contoh page",
    cars: [
      { name: "2019 Honda Civic 1.5 TC-P", price: "RM 98,800", tag: "Mileage rendah" },
      { name: "2021 Perodua Ativa 1.0 AV", price: "RM 62,500", tag: "Masih ada warranty" },
      { name: "2018 Toyota Vellfire 2.5", price: "RM 218,000", tag: "1 pemilik" },
    ],
  },

  how: {
    kicker: "Cara ia berfungsi",
    title: "Sedia live dalam tiga langkah.",
    steps: [
      { n: "01", title: "Daftar", body: "Email atau Google. Percuma, tak perlu kad." },
      { n: "02", title: "Masukkan kereta anda", body: "Gambar, harga, spec. Kami semak dulu setiap satu." },
      { n: "03", title: "Mula live", body: "Buka Live presentation. Jawab \"monthly berapa?\" dengan satu tap." },
    ],
  },

  short: {
    heroLine: "Setiap kereta yang anda listing dah siap kiraan ansuran. Penonton tanya, anda tap.",
    painKicker: "Bunyi macam anda?",
    pains: [
      "Kira loan manual setiap kali customer tanya.",
      "Taip semula poster ansuran untuk setiap kereta.",
      "Penonton minta deposit lain, live tunggu anda kira semula.",
    ],
    painFix: "Sekarang: satu tap, semua nombor siap.",
    getKicker: "Apa anda dapat, percuma",
    poster: {
      title: "Poster loan dalam beberapa saat.",
      line: "Harga, deposit dan monthly 9, 7 dan 5 tahun, dengan nama dan nombor anda.",
      chips: [`Lite: ${LITE_POSTERS} kereta sebulan`, "Premium: tanpa had", "Kadar flat ditukar ke EIR"],
      caption: "Dilukis terus oleh app dari kereta sebenar. Contoh seller, nombor disorok.",
      aria: "Contoh poster loan",
    },
    page: {
      title: "Satu link. Semua kereta anda.",
      line: "Letak di bio TikTok atau status WhatsApp. Pembeli tap kereta, terus sampai ke anda.",
      chips: ["Page anda sendiri", "Masuk marketplace", "WhatsApp, chat, booking"],
    },
    plansKicker: "Harga",
    plansTitle: "Mula percuma. Naik taraf bila dah untung.",
    offer: {
      kicker: `Premium · ${TRIAL_DAYS} hari pertama percuma`,
      title: "Bukan kalkulator saja. Ini app jualan penuh.",
      price: `RM${PREMIUM_PRICE}`,
      per: "/bulan",
      perDay: `Lebih kurang RM${PER_DAY} sehari`,
      parts: [
        { title: "Page jualan anda", line: `Sampai ${PREMIUM_CAP} kereta dalam satu link, masuk marketplace sekali` },
        { title: "Alat live + loan", line: "Live presentation, poster loan tanpa had, loan desk" },
        { title: "Dashboard lead (CRM)", line: "Siapa perlu di-call hari ni, reminder follow up, komisen, handover" },
      ],
      billing: "Bayar bulan ke bulan. Tiada kontrak, tiada kad, tiada caj automatik.",
      cta: `Mula ${TRIAL_DAYS} hari percuma`,
      liteLink: "Atau mula percuma dengan Lite",
    },
    planCards: {
      premium: {
        billing: `Bayaran bulanan: bayar RM${PREMIUM_PRICE} setiap bulan untuk teruskan. Tiada kontrak, tiada caj automatik. Berhenti bayar, akaun balik ke Lite; kereta dan lead anda kekal.`,
        groups: [
          { h: "Page jualan anda", items: [`Sampai ${PREMIUM_CAP} kereta di page anda dan marketplace`, ...P_MS.page] },
          { h: "Alat live + loan", items: ["Live presentation untuk TikTok / FB live", "Poster loan tanpa had", ...P_MS.tools.slice(0, 2)] },
          { h: "Dashboard lead (CRM)", items: P_MS.crm.slice(0, 5) },
        ],
      },
      lite: {
        billing: "Percuma selamanya. Tak perlu kad kredit, tiada trial yang caj kemudian.",
        groups: [
          { h: "Page jualan anda", items: [`Sampai ${LITE_CAP} kereta di page anda dan marketplace`, "Pembeli hubungi anda melalui WhatsApp, chat dan booking"] },
          { h: "Alat live + loan", items: ["Live presentation untuk TikTok / FB live", `Poster loan untuk ${LITE_POSTERS} kereta sebulan`] },
          { h: "Dashboard lead", items: ["Alert untuk lead baru", "Senarai lead ringkas dengan stage", "Views + tap WhatsApp untuk setiap kereta"] },
        ],
      },
    },
    more: "Dan banyak lagi",
  },
  plans: {
    kicker: "Pilih pelan anda",
    title: "Live percuma dengan Lite. Premium untuk follow up setiap lead.",
    premiumName: "Salesman Premium",
    premiumPer: "/bulan",
    premiumNote: "7 hari percuma",
    liteName: "Salesman Lite",
    litePer: "/selamanya",
    premiumBullets: ["Semua yang ada dalam Lite", `Sampai ${PREMIUM_CAP} listing aktif`, ...SALESMAN_PREMIUM_FEATURES_MS],
    liteBullets: [
      `Sampai ${LITE_CAP} listing aktif`,
      "Page sendiri di xdrive.my/s/namaanda",
      "Kereta anda di marketplace XDrive",
      "Pembeli hubungi anda melalui WhatsApp, chat dan booking",
      "Live presentation untuk live TikTok / FB",
      "Alert untuk lead baru",
      "Senarai lead ringkas dengan stage",
      "Tak perlu kad kredit",
    ],
  },

  faq: {
    kicker: "Soalan",
    title: "Perlu tahu.",
    reviewed: "Page ini kali terakhir disemak",
    reviewedLabel: "Oktober 2026",
    items: [
      { q: "Premium ni bayar sekali atau bulanan?",
        a: `Bulanan. Premium RM${PREMIUM_PRICE} sebulan, dan ${TRIAL_DAYS} hari pertama percuma. Tiada kontrak dan kami tak pernah ambil kad, jadi tiada caj automatik: anda bayar bulan seterusnya bila nak teruskan. Kalau berhenti, akaun balik ke Lite yang percuma dan page, kereta serta lead anda kekal.` },
      { q: "Saya dapat kalkulator ansuran saja ke?",
        a: `Tidak. Kalkulator (Live presentation dan poster loan) cuma satu daripada tiga bahagian. Anda juga dapat page jualan sendiri dengan kereta anda, masuk marketplace sekali, dan dashboard lead: setiap pembeli yang hubungi anda masuk ke situ dengan stage. Premium tambah CRM penuh: siapa perlu di-call hari ni, reminder follow up dan log panggilan, WhatsApp semua lead yang senyap, jejak komisen dan senarai semak handover.` },
      { q: "Boleh kira ansuran bulanan kereta masa live TikTok?",
        a: "Boleh, percuma dengan Salesman Lite. Live presentation tunjuk satu kereta satu skrin dengan nombor (#1, #2, #3) untuk penonton komen, harga, deposit, jumlah loan, kadar faedah dan ansuran bulanan untuk 9, 7 dan 5 tahun. Tukar deposit atau masukkan kadar flat bank, semua angka dikira semula. Budget mode pula senaraikan kereta anda yang muat dengan gaji atau bajet bulanan penonton. Semua angka ialah anggaran atas baki berkurangan (EIR) dan tertakluk kepada kelulusan bank. Maklumat contact anda hanya keluar bila anda tap untuk tunjuk." },
      { q: "Apa jadi lepas 7 hari percuma habis?",
        a: "Tiada caj automatik, dan kami tak pernah minta kad. Bayar RM35 untuk teruskan Premium sebulan lagi. Kalau tak bayar, akaun anda kembali ke Salesman Lite yang percuma: page, kereta dan lead anda kekal, dan tool Premium (reminder follow up, log panggilan dan lain-lain) ditutup sampai anda renew. Live presentation kekal: ia sebahagian daripada Lite." },
      { q: "Kereta mana yang keluar dalam live presentation saya?",
        a: "Kereta yang ada di page XDrive anda. Kami semak setiap kereta sebelum ia keluar untuk umum, jadi kereta yang baru anda masukkan akan muncul di page dan presentation anda selepas diluluskan." },
      { q: "Salesman Lite betul-betul percuma ke?",
        a: `Ya. Salesman Lite RM0, tiada kad kredit, tiada kontrak dan tiada trial yang diam-diam caj anda kemudian. Anda dapat sampai ${LITE_CAP} listing kereta aktif, page asas anda sendiri di xdrive.my/s/namaanda, kereta anda di marketplace XDrive, enquiry pembeli melalui WhatsApp, chat dalam app dan booking, alert untuk lead baru, senarai lead ringkas dengan stage, dan Live presentation untuk live TikTok dan Facebook anda. Reminder follow up dan log panggilan ada dalam Premium.` },
      { q: "Apa itu Salesman Lite?",
        a: `Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, listing sampai ${LITE_CAP} kereta, dan pembeli boleh hubungi anda melalui WhatsApp, chat dalam app atau booking, tanpa sebarang kos atau kad kredit.` },
      { q: "Perlu buat website sendiri ke?",
        a: "Tak perlu. Anda dapat page siap di xdrive.my/s/namaanda dengan semua kereta anda. Tiada hosting, tiada domain, tiada kerja design: masukkan kereta dan share link." },
      { q: "Macam mana pembeli hubungi saya?",
        a: "Tiga cara: WhatsApp, chat dalam app, atau booking untuk datang tengok kereta. Untuk WhatsApp, pembeli taip nama dulu, lepas tu chat dengan anda terus terbuka. Setiap enquiry masuk senarai lead anda dan anda dapat alert. Nombor anda tak dipaparkan di page, jadi orang tak boleh copy. Tiada inbox kongsi dan lead tak dijual kepada ejen lain: enquiry tu milik anda." },
      { q: "Masih boleh guna Mudah dan Carlist?",
        a: "Boleh. XDrive boleh guna sekali dengan platform tu. Bezanya, page ni milik anda, ia ada di marketplace XDrive, dan tiada caj untuk setiap listing." },
      { q: `Kalau saya ada lebih dari ${LITE_CAP} kereta?`,
        a: `Salesman Premium (RM35 sebulan, 7 hari pertama percuma) naikkan had anda ke ${PREMIUM_CAP} listing dan tambah senarai call "Minggu ini" yang tersusun dengan mesej follow up siap ditulis, reminder follow up dan log panggilan, WhatsApp semua lead yang senyap sekali gus, loan desk yang semak kemampuan dan banding bank, senarai semak handover dan senarai customer, caption AI dan draf balasan chat AI, jejak komisen, reminder booking di Telegram, katalog servis dan add-on, page yang boleh diubah suai dengan bio dan link media sosial, serta Performance yang tunjuk close rate dan di mana deal anda terlepas. Page dan kereta Lite anda terus dibawa: upgrade bila-bila masa dari panel anda.` },
      { q: "Ada contoh page yang saya boleh tengok?",
        a: "Ada. xdrive.my/s/premiummotors ialah contoh page Salesman Premium dari XDrive: stok, harga dan butang contact di setiap kereta, sama macam yang pembeli nampak bila anda share link anda." },
      { q: "Berapa lama nak setup?",
        a: "Beberapa minit sahaja. Daftar dengan email atau Google, masukkan nombor telefon dan nama link, dan anda terus masuk panel. Nombor IC diminta bila anda masukkan kereta pertama, dan setiap kereta keluar untuk umum selepas kami semak." },
    ],
  },

  final: {
    titleLines: ["Live anda yang seterusnya,", "semua dah siap dikira."],
    body: "Setiap kereta yang anda listing jadi satu skrin dengan monthly yang dah siap.",
    liteLink: "Atau cuba Premium percuma 7 hari",
    trust: ["Percuma dengan Lite", "Nombor tersembunyi sampai anda tap", "Satu link untuk bio anda"],
  },

  crawler: {
    pricing: "Harga",
    premiumPrice: "Salesman Premium: RM35 sebulan, 7 hari pertama percuma",
    litePrice: "Salesman Lite: RM0, percuma selamanya",
    faq: "Soalan lazim",
    browse: "Tengok kereta di XDrive",
    dealers: "ShiftOS untuk dealer",
  },
};

export const LANDING_COPY = { ms: MS, en: EN };

export function landingCopy(lang) {
  return LANDING_COPY[lang] || LANDING_COPY[DEFAULT_LANG];
}

// Kept for anything that wants the English FAQ on its own.
export const FAQS_EN = EN.faq.items;
export const FAQS_MS = MS.faq.items;

export function faqLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
// The crawler page is Malay, so the default FAQ JSON-LD is the Malay FAQ.
export const FAQ_LD = faqLd(FAQS_MS);
export const FAQ_LD_EN = faqLd(FAQS_EN);

export function webpageLd(lang = DEFAULT_LANG) {
  const c = landingCopy(lang);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: c.seoTitle,
    url: CANON,
    description: c.seoDesc,
    inLanguage: c.inLanguage,
    dateModified: REVIEWED_ISO,
    isPartOf: { "@type": "WebSite", name: "XDrive", url: "https://xdrive.my" },
    about: { "@type": "SoftwareApplication", name: "XDrive for Salesmen", url: CANON },
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "XDrive", item: "https://xdrive.my" },
      { "@type": "ListItem", position: 2, name: lang === "en" ? "For salesmen" : "Untuk salesman", item: CANON },
    ] },
  };
}

export const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "XDrive for Salesmen (Salesman Lite and Premium)",
  alternateName: ["XDrive Live presentation", "XDrive Salesman Lite", "XDrive Salesman Premium"],
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Car sales CRM",
  operatingSystem: "Web, Android, iOS (browser)",
  url: CANON,
  description: MS.seoDesc,
  screenshot: "https://xdrive.my/for-salesmen/premium-dashboard.png",
  featureList: [
    "Live presentation: car instalment calculator for TikTok and Facebook lives",
    "Own car listing page at xdrive.my/s/yourname",
    `Up to ${LITE_CAP} listings free, ${PREMIUM_CAP} on Premium`,
    "Buyer enquiries by WhatsApp, in-app chat and booking requests",
    "Alerts on new leads and a simple lead list with stages",
    ...SALESMAN_PREMIUM_FEATURES,
  ],
  offers: [
    { "@type": "Offer", name: "Salesman Lite", price: "0", priceCurrency: "MYR", url: "https://xdrive.my/salesman-onboarding/lite" },
    { "@type": "Offer", name: "Salesman Premium", price: "35", priceCurrency: "MYR", url: "https://xdrive.my/salesman-onboarding/premium",
      description: "First 7 days free.",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "35", priceCurrency: "MYR", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } },
  ],
  audience: { "@type": "BusinessAudience", audienceType: "Car salesmen and car agents in Malaysia" },
  areaServed: "MY",
  inLanguage: ["ms-MY", "en-MY"],
  publisher: { "@type": "Organization", name: "XDrive", url: "https://xdrive.my" },
};
