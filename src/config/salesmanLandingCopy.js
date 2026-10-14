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
// Facebook lives. The headline sells Live presentation (Premium); Lite is the
// free way in. Lite = "get found, get the lead"; working the lead (follow-up
// reminders, call log, Performance) is Premium (owner, 2026-10-13). Facts the
// copy leans on, so nobody "simplifies" them away:
//  - Every salesman car is checked before it is public (CarForm.jsx
//    needsApproval -> 'pending_approval'). Never promise "live the moment you
//    publish" or "same day".
//  - Public pages never print the seller's number (CDP-3); WhatsApp opens after
//    the buyer leaves a name (ContactGate). Never promise "your number on it".
//  - Premium's first month is free and nothing auto-bills
//    (trg_zz_premium_free_month); unpaid, the account routes back to Lite
//    (routeForProfile) and existing cars stay.
//  - No claims about named competitors.

import { SALESMAN_PREMIUM_FEATURES, SALESMAN_PREMIUM_FEATURES_MS } from "../utils/plans.js";
import { PLAN_CONFIG } from "../utils/planConfig.js";

const LITE_CAP = PLAN_CONFIG.salesman_lite.listingCap;
const PREMIUM_CAP = PLAN_CONFIG.salesman_full.listingCap;

export const DEFAULT_LANG = "ms";
// Per-device memory of the visitor's choice on THIS page only.
export const LANG_KEY = "xd_for_salesmen_lang";

export const CANON = "https://xdrive.my/for-salesmen";
// Bump when the copy changes: it feeds dateModified (webpageLd) and the
// "last reviewed" line, a freshness signal search and AI answers both read.
export const REVIEWED_ISO = "2026-10-13";
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
    "For Malaysian car salesmen selling on TikTok and Facebook Live: every car numbered, 9, 7 and 5-year monthlies, deposit changes in one tap. First month free.",

  heroEyebrow: "For agents who sell on TikTok and Facebook Live",
  heroH1Lines: ["Monthly berapa?", "One tap.", "Every car."],
  heroIntro:
    "Live presentation builds the instalment poster for every car you list: price, deposit, loan, and the monthly over 9, 7 and 5 years. A viewer asks for a different deposit, you tap once and every number updates. Part of Salesman Premium, RM35 a month, first month free.",
  heroTrust: ["First month free", "No credit card", "Your number hidden until you tap"],
  premiumCta: "Try it free for 30 days",
  liteCta: "Start free on Lite",
  band: { before: "Every car you list also goes on the ", strong: "xdrive.my", after: " marketplace" },

  demo: {
    label: "Live presentation, working demo with real cars",
    caption: "Real cars from an XDrive seller. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
    sampleCaption: "Sample car. Tap Budget or Docs, change the deposit. Estimates only, the bank decides.",
  },

  // Premium "Live selling" detail section (LiveSellingSection.jsx) — what Live
  // presentation (src/components/live/LivePresenter.jsx) does, point by point.
  live: {
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
    exampleLink: "See an example page",
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
    fix: "Live presentation fixes all four.",
  },

  // "What you get with each plan" (PlanTour.jsx). Text only; images and order
  // live in PlanTour. Copy rule: no invented numbers, no income figure.
  tour: {
    kicker: "Inside the app",
    title: "What you get with each plan",
    toggleAria: "Choose a plan",
    plus: "Everything in Lite, plus more on every tab.",
    seeLite: "See Lite",
    problemLabel: "The problem",
    momentLabel: "When you'd use it",
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
        pain: "A buyer asks about a car at 11pm. You mean to reply in the morning. By then they have bought from the agent who answered first.",
        moment: "A buyer messages you about the Vellfire from the marketplace. Your phone alerts you, and they land in your lead list with the car and price attached, flagged \"Never contacted\" until you reply.",
        points: [
          "Buyers from WhatsApp, chat and bookings, all in one list",
          "Stages from New through Contacted, Viewing and Test drive to Won",
          "Flags buyers nobody has replied to, and how long they have waited",
          "An alert on your phone when a new buyer comes in",
        ],
        pays: "Most lost deals are not lost on price. They are lost because the other agent replied first.",
      },
      dashboard: {
        tab: "Dashboard",
        alt: "Salesman Premium dashboard showing 4 overdue follow-ups, 30-day views, page visits and WhatsApp taps, and a 7-day traffic chart",
        title: "Open the app. Know who needs you today.",
        pain: "Buyers are spread across forty WhatsApp chats. The one who was ready to book a viewing goes cold while you answer someone else, and you notice two weeks later.",
        moment: "8am, before you reach the lot. The first line says 4 leads are waiting on a follow-up. Below it: how many people opened your page this week, and your link ready to copy into today's WhatsApp status.",
        points: [
          "Overdue follow-ups counted for you, right at the top",
          "Views, page visits and WhatsApp taps for the last 30 days",
          "Your page link: copy, share or open it in one tap",
          "Where visitors came from: Instagram, Facebook or direct",
        ],
        pays: "The buyer you remember to call back is the deal you close.",
      },
      carPerformance: {
        tab: "Dashboard",
        alt: "Per-car performance list showing views, WhatsApp taps and conversion rate, with one car tagged Rising",
        title: "See which car pulls buyers, and which one is stuck.",
        pain: "You post every car the same way and hope. The car that has sat for a month gets as much of your time as the one buyers keep asking about.",
        moment: "Friday, deciding what to push on your status this weekend. The Lexus RX has buyers tapping WhatsApp and is marked Rising, so it goes first. The Vellfire has 16 views and no taps, so it needs a new price or better photos.",
        points: [
          "Views, WhatsApp taps and conversion rate for every car",
          "A Rising tag on the cars buyers are warming to",
          "Views with no taps point to a price or photo problem",
          "A 30-day window, so you see what works right now",
        ],
        pays: "Put your effort behind the cars buyers already want, and fix the stuck ones before they cost you the month.",
      },
      premiumLeads: {
        tab: "Leads",
        alt: "Lead pipeline with stage filters and buyer cards flagged Never contacted with the number of days waiting",
        title: "Every buyer in a stage, not lost in a chat.",
        pain: "A buyer asks about a car at 11pm. You mean to reply in the morning. By then they have bought from the agent who answered first.",
        moment: "A buyer messages you about the Vellfire from the marketplace. They land in your pipeline with the car and price attached, and a flag says \"Never contacted · 9d\" until somebody replies.",
        points: [
          "Stages from New through Contacted, Viewing and Test drive to Won",
          "Flags buyers nobody has replied to, and how long they have waited",
          "Move the deal forward or open the chat from the card",
          "Queue a follow-up reminder with the message already drafted",
        ],
        pays: "Most lost deals are not lost on price. They are lost because nobody followed up.",
      },
      sold: {
        tab: "Sold",
        alt: "8-step handover checklist for a won deal, with loan settlement and insurance done and Puspakom inspection next",
        title: "Won is not done. The handover, step by step.",
        pain: "After the deal comes loan settlement, insurance, Puspakom, the JPJ transfer and road tax. Miss one and the buyer calls you angry instead of recommending you.",
        moment: "You mark a deal Won. An 8-step handover checklist appears in the right order with the official fees filled in. Tick insurance done and next year's renewal date is saved.",
        points: [
          "An 8-step checklist created the moment a deal is won",
          "Puspakom, JPJ transfer and road tax in the right order",
          "The buyer saved as a customer with their car and price",
          "Insurance and road tax dates kept for the renewal reminder",
        ],
        pays: "A smooth handover is how one sale turns into the buyer's brother, cousin and colleague.",
      },
      analytics: {
        tab: "Analytics",
        alt: "Close rate funnel showing where deals stop, with Contacted marked as the weakest step, plus median reply speed",
        title: "Find out where you are losing deals.",
        pain: "You know you closed three this month. You do not know whether you lost the rest at the first reply, the viewing or the test drive.",
        moment: "End of the month. The funnel shows most of your lost buyers dropped after booking a viewing. That is what you fix next month, not your ads.",
        points: [
          "The stage each lost deal actually died at",
          "Close rate with a 30-day trend",
          "How fast you reply, and why deals were lost",
          "Which lead sources turn into sales",
        ],
        pays: "Fix the one step where you lose the most people and every lead you already get is worth more.",
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
      { title: "Free, and it stays free", body: "RM0 forever on Lite. No credit card, no trial timer. Want follow-up reminders, call logs and Live presentation? That's Premium, when you're ready." },
    ],
  },

  showcase: {
    kicker: "Your page does the selling",
    title: "Send one link. They see everything.",
    lead: "No more forwarding photos car by car. Your XDrive page shows your whole stock, your prices and a WhatsApp button on every listing, open on any phone, ready to share the second a buyer asks.",
    list: ["Your name at the top, every car below", "Every car with photos, price and specs", "Tap-to-WhatsApp on each listing"],
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
      { n: "01", title: "Sign up", body: "Email or Google, your phone and a name for your link. Premium's first month is free, no card needed." },
      { n: "02", title: "Add your cars", body: "Photos, price and specs. We check each car, then it's on your page, on the marketplace and in your presentation." },
      { n: "03", title: "Go live", body: "Open Live presentation, film your screen and answer \"monthly berapa?\" with one tap." },
    ],
  },

  // Order matches WHY_ICONS in SalesmanLiteLanding.jsx.
  why: {
    kicker: "Built for how you actually sell",
    title: "Made for agents, not office desks.",
    items: [
      { title: "Built for your phone", body: "Add a car and snap photos from the phone that's already in your hand at the lot." },
      { title: "Set up in minutes", body: "No website, no designer. Sign up, add your cars, and each one goes public once we've checked it." },
      { title: "You look established", body: "A proper page beats a folder of screenshots. Buyers trust an agent with a real presence." },
      { title: "Yours to keep", body: "Your page, your link, your leads. Move between Lite and Premium and everything comes with you." },
    ],
  },

  midcta: {
    title: "Ready for your next live?",
    body: "The first month of Premium is free. No card, nothing billed automatically.",
  },

  plans: {
    kicker: "Pick your plan",
    title: "Premium for live selling. Lite to start free.",
    premiumName: "Salesman Premium",
    premiumPer: "/month",
    premiumNote: "First month free",
    liteName: "Salesman Lite",
    litePer: "/forever",
    premiumBullets: ["Everything in Lite", `Up to ${PREMIUM_CAP} active listings`, ...SALESMAN_PREMIUM_FEATURES],
    liteBullets: [
      `Up to ${LITE_CAP} active listings`,
      "Your own page at xdrive.my/s/yourname",
      "Your cars on the XDrive marketplace",
      "Buyers reach you by WhatsApp, chat and booking requests",
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
      { q: "Can XDrive work out monthly instalments for my TikTok Live?",
        a: "Yes, on Salesman Premium. Live presentation shows one car per screen with a number (#1, #2, #3) for viewers to comment, the price, deposit, loan and rate, and the monthly instalment over 9, 7 and 5 years. Change the deposit or type the bank's flat rate and every figure updates; budget mode lists which of your cars fit a viewer's salary or monthly budget. Figures are estimates on the reducing balance (EIR) and subject to bank approval. Your contact details only appear when you tap to show them." },
      { q: "What happens after the free month?",
        a: "Nothing is charged automatically, and we never ask for a card. Pay RM35 to keep Premium for another month. If you don't, your account goes back to free Salesman Lite: your page, cars and leads stay, and the Premium tools (Live presentation, follow-up reminders and the rest) switch off until you renew." },
      { q: "Which cars appear in my live presentation?",
        a: "The cars on your XDrive page. We check every car before it goes public, so a car you have just added joins your page and your presentation once it is approved." },
      { q: "Is Salesman Lite really free?",
        a: `Yes. Salesman Lite costs RM0, with no credit card, no contract and no trial that quietly bills you later. You get up to ${LITE_CAP} active car listings, a basic page of your own at xdrive.my/s/yourname, your cars on the XDrive marketplace, buyer enquiries by WhatsApp, in-app chat and booking requests, an alert for new leads, and a simple lead list with stages. Follow-up reminders, call logging and Live presentation are on Premium.` },
      { q: "What is Salesman Lite?",
        a: `Salesman Lite is the free XDrive account for car salesmen and agents in Malaysia. You get a page of your own on xdrive.my, list up to ${LITE_CAP} cars, and buyers reach you by WhatsApp, in-app chat or a booking request, at no cost and with no credit card.` },
      { q: "Do I need to build a website?",
        a: "No. You get a ready-made page at xdrive.my/s/yourname with all your cars on it. No hosting, no domain, no design work: add your cars and share the link." },
      { q: "How do buyers contact me?",
        a: "Three ways: WhatsApp, in-app chat, or a booking request to view the car. For WhatsApp the buyer types their name, then a chat opens with you. Every enquiry lands in your lead list and you get an alert. Your number is not printed on the page, so it cannot be copied off it. No shared inbox and no lead sold to other agents: the enquiry is yours." },
      { q: "Can I still use Mudah and Carlist?",
        a: "Yes. XDrive works alongside them. The difference is this page is yours, it lives on the XDrive marketplace, and it doesn't charge you per listing." },
      { q: `What happens when I have more than ${LITE_CAP} cars?`,
        a: `Salesman Premium (RM35/month, first month free) raises your cap to ${PREMIUM_CAP} listings and adds a live presentation for TikTok and Facebook lives, a sorted "This week" call list with follow-up messages already drafted, follow-up reminders and call logging, WhatsApp to all your quiet leads in one go, a loan desk that checks affordability and compares banks, the post-sale handover checklist and customer list, AI listing captions and chat reply drafts, commission tracking, Telegram booking reminders, a services and add-ons catalogue, a page you can customise with your bio and social links, and a Performance view that shows your close rate and where your deals are lost. Your Lite page and cars carry straight over: upgrade any time from your panel.` },
      { q: "Is there an example page I can see?",
        a: "Yes. xdrive.my/s/premiummotors is XDrive's example Salesman Premium page: stock, prices and a contact button on every car, exactly what a buyer sees when you share your link." },
      { q: "How long does setup take?",
        a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel. You're asked for your IC number when you add your first car, and each car goes public once we've checked it." },
    ],
  },

  final: {
    titleLines: ["Your next live,", "already worked out."],
    body: "Every car you list becomes a screen with its monthlies ready.",
    liteLink: "Or start free on Lite",
    trust: ["First month free", "Number hidden until you tap", "One link for your bio"],
  },

  // Crawler-only headings (api/og.js).
  crawler: {
    pricing: "Pricing",
    premiumPrice: "Salesman Premium: RM35/month, first month free",
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
    "Untuk salesman kereta di Malaysia yang jual di TikTok dan Facebook Live: setiap kereta bernombor, monthly 9, 7 dan 5 tahun, tukar deposit dengan satu tap. Bulan pertama percuma.",

  heroEyebrow: "Untuk salesman yang jual kereta di TikTok dan Facebook Live",
  heroH1Lines: ["Monthly berapa?", "Satu tap.", "Semua kereta."],
  heroIntro:
    "Live presentation siapkan poster ansuran untuk setiap kereta yang anda listing: harga, deposit, loan, dan monthly untuk 9, 7 dan 5 tahun. Penonton minta deposit lain, anda tap sekali dan semua nombor terus berubah. Sebahagian daripada Salesman Premium, RM35 sebulan, bulan pertama percuma.",
  heroTrust: ["Bulan pertama percuma", "Tak perlu kad kredit", "Nombor anda tersembunyi sampai anda tap"],
  premiumCta: "Cuba percuma 30 hari",
  liteCta: "Mula percuma dengan Lite",
  band: { before: "Setiap kereta yang anda listing juga masuk marketplace ", strong: "xdrive.my", after: "" },

  demo: {
    label: "Live presentation, demo sebenar dengan kereta sebenar",
    caption: "Kereta sebenar dari seller XDrive. Tap Bajet atau Dokumen, tukar deposit. Anggaran sahaja, bank yang putuskan.",
    sampleCaption: "Contoh kereta. Tap Bajet atau Dokumen, tukar deposit. Anggaran sahaja, bank yang putuskan.",
  },

  live: {
    kicker: "Live presentation",
    title: "Dibina untuk soalan yang penonton betul-betul tanya.",
    lead:
      "Ramai salesman masa live angkat spreadsheet ansuran bulanan, satu kereta satu masa, taip semula untuk setiap unit. Premium siapkan poster tu untuk setiap kereta yang anda listing. Buka Live presentation, rakam skrin anda, dan jawab terus dari skrin.",
    points: [
      "Setiap kereta bernombor #1, #2, #3, jadi penonton komen nombor kereta yang dia nak",
      "Harga, deposit, loan dan kadar faedah dah dikira, terus keluar monthly 9, 7 dan 5 tahun",
      "Tukar deposit atau masukkan kadar flat bank, semua nombor terus dikira semula",
      "Budget mode: masukkan gaji atau bajet bulanan penonton, terus nampak kereta mana yang muat",
      "Rebate khas untuk live ni sahaja, ditolak dari harga tanpa ubah listing anda",
      "Skrin Dokumen: apa yang bank minta dari pembeli, makan gaji atau buat bisnes sendiri",
      "Kotak contact anda hanya keluar bila anda tap, jadi anda yang tentukan apa masuk dalam stream",
      "Kereta yang tengah di skrin di-pin di page anda sebagai \"Live now\" untuk penonton yang tap link bio anda",
    ],
    note: "Anggaran atas baki berkurangan (EIR). Tertakluk kepada kelulusan bank.",
    exampleLink: "Tengok contoh page",
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
    fix: "Live presentation selesaikan keempat-empat masalah ni.",
  },

  tour: {
    kicker: "Dalam app",
    title: "Apa anda dapat dengan setiap pelan",
    toggleAria: "Pilih pelan",
    plus: "Semua yang ada dalam Lite, dan lebih lagi di setiap tab.",
    seeLite: "Tengok Lite",
    problemLabel: "Masalahnya",
    momentLabel: "Bila anda guna",
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
        pain: "Pembeli tanya pasal kereta pukul 11 malam. Anda niat nak balas pagi esok. Bila pagi, dia dah beli dari salesman yang balas dulu.",
        moment: "Seorang pembeli mesej anda pasal Vellfire dari marketplace. Telefon anda dapat alert, dan dia masuk senarai lead anda siap dengan kereta dan harga, ditanda \"Never contacted\" sampai anda balas.",
        points: [
          "Pembeli dari WhatsApp, chat dan booking, semua dalam satu senarai",
          "Stage dari New, Contacted, Viewing dan Test drive sampai Won",
          "Tanda pembeli yang belum dibalas, dan berapa lama dia dah tunggu",
          "Alert di telefon anda bila ada pembeli baru masuk",
        ],
        pays: "Kebanyakan deal terlepas bukan sebab harga. Terlepas sebab salesman lain balas dulu.",
      },
      dashboard: {
        tab: "Dashboard",
        alt: "Dashboard Salesman Premium yang tunjuk 4 follow-up tertunggak, views 30 hari, lawatan page dan tap WhatsApp, serta carta trafik 7 hari",
        title: "Buka app. Terus tahu siapa perlukan anda hari ni.",
        pain: "Pembeli bersepah dalam empat puluh chat WhatsApp. Yang dah sedia nak book viewing jadi sejuk masa anda layan orang lain, dan anda cuma perasan dua minggu kemudian.",
        moment: "Pukul 8 pagi, sebelum sampai lot. Baris pertama cakap 4 lead sedang tunggu follow up. Di bawahnya: berapa ramai buka page anda minggu ni, dan link anda sedia untuk copy ke status WhatsApp hari ni.",
        points: [
          "Follow up yang tertunggak dikira untuk anda, terus di atas",
          "Views, lawatan page dan tap WhatsApp untuk 30 hari lepas",
          "Link page anda: copy, share atau buka dengan satu tap",
          "Dari mana pelawat datang: Instagram, Facebook atau terus",
        ],
        pays: "Pembeli yang anda ingat untuk call balik, itulah deal yang anda close.",
      },
      carPerformance: {
        tab: "Dashboard",
        alt: "Senarai prestasi setiap kereta yang tunjuk views, tap WhatsApp dan kadar conversion, dengan satu kereta ditanda Rising",
        title: "Tengok kereta mana yang tarik pembeli, dan mana yang tersangkut.",
        pain: "Anda post semua kereta dengan cara sama dan berharap. Kereta yang dah sebulan duduk dapat masa anda sama banyak dengan kereta yang pembeli asyik tanya.",
        moment: "Hari Jumaat, tengah fikir kereta mana nak tolak di status hujung minggu ni. Lexus RX ramai pembeli tap WhatsApp dan ditanda Rising, jadi itu dulu. Vellfire ada 16 views tapi tiada tap, jadi perlu harga baru atau gambar yang lebih cantik.",
        points: [
          "Views, tap WhatsApp dan kadar conversion untuk setiap kereta",
          "Tag Rising untuk kereta yang pembeli mula minat",
          "Ada views tapi tiada tap, tandanya masalah harga atau gambar",
          "Tempoh 30 hari, jadi anda nampak apa yang jalan sekarang",
        ],
        pays: "Fokus pada kereta yang pembeli memang nak, dan betulkan yang tersangkut sebelum ia makan sebulan anda.",
      },
      premiumLeads: {
        tab: "Leads",
        alt: "Pipeline lead dengan filter stage dan kad pembeli ditanda Never contacted berserta bilangan hari menunggu",
        title: "Setiap pembeli ada stage, tak hilang dalam chat.",
        pain: "Pembeli tanya pasal kereta pukul 11 malam. Anda niat nak balas pagi esok. Bila pagi, dia dah beli dari salesman yang balas dulu.",
        moment: "Seorang pembeli mesej anda pasal Vellfire dari marketplace. Dia masuk pipeline anda siap dengan kereta dan harga, dan ada tanda \"Never contacted · 9d\" sampai ada orang balas.",
        points: [
          "Stage dari New, Contacted, Viewing dan Test drive sampai Won",
          "Tanda pembeli yang belum dibalas, dan berapa lama dia dah tunggu",
          "Gerakkan deal ke depan atau buka chat terus dari kad",
          "Set reminder follow up dengan mesej yang dah siap ditulis",
        ],
        pays: "Kebanyakan deal terlepas bukan sebab harga. Terlepas sebab tiada siapa follow up.",
      },
      sold: {
        tab: "Sold",
        alt: "Senarai semak handover 8 langkah untuk deal yang dah Won, dengan loan settlement dan insurans selesai dan pemeriksaan Puspakom seterusnya",
        title: "Won belum bermakna selesai. Handover, langkah demi langkah.",
        pain: "Lepas deal ada loan settlement, insurans, Puspakom, tukar nama JPJ dan road tax. Tertinggal satu, pembeli call anda dengan marah, bukan recommend anda.",
        moment: "Anda tanda deal sebagai Won. Senarai semak handover 8 langkah keluar ikut susunan yang betul dengan yuran rasmi dah diisi. Tick insurans selesai, dan tarikh renew tahun depan terus disimpan.",
        points: [
          "Senarai semak 8 langkah dibuat sebaik deal Won",
          "Puspakom, tukar nama JPJ dan road tax ikut susunan yang betul",
          "Pembeli disimpan sebagai customer dengan kereta dan harga",
          "Tarikh insurans dan road tax disimpan untuk reminder renew",
        ],
        pays: "Handover yang lancar, itulah cara satu jualan jadi abang, sepupu dan kawan sepejabat pembeli.",
      },
      analytics: {
        tab: "Analytics",
        alt: "Funnel close rate yang tunjuk di mana deal berhenti, dengan Contacted ditanda sebagai langkah paling lemah, serta median kelajuan balas",
        title: "Cari di mana anda terlepas deal.",
        pain: "Anda tahu bulan ni close tiga. Tapi anda tak tahu yang lain terlepas masa balasan pertama, masa viewing atau masa test drive.",
        moment: "Hujung bulan. Funnel tunjuk kebanyakan pembeli yang terlepas hilang lepas book viewing. Itu yang anda betulkan bulan depan, bukan iklan anda.",
        points: [
          "Stage sebenar di mana setiap deal terlepas",
          "Close rate dengan trend 30 hari",
          "Berapa cepat anda balas, dan kenapa deal terlepas",
          "Sumber lead mana yang jadi jualan",
        ],
        pays: "Betulkan satu langkah di mana anda paling ramai terlepas pembeli, dan setiap lead yang anda dah dapat jadi lebih bernilai.",
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
      { title: "Percuma, dan kekal percuma", body: "RM0 selamanya dengan Lite. Tiada kad kredit, tiada tempoh trial. Nak reminder follow up, log panggilan dan Live presentation? Itu Premium, bila anda dah sedia." },
    ],
  },

  showcase: {
    kicker: "Page anda yang buat kerja jual",
    title: "Hantar satu link. Pembeli nampak semua.",
    lead: "Tak perlu lagi forward gambar kereta satu-satu. Page XDrive anda tunjuk semua stok, harga dan butang WhatsApp di setiap listing, boleh buka di mana-mana telefon, sedia untuk share sebaik pembeli tanya.",
    list: ["Nama anda di atas, semua kereta di bawah", "Setiap kereta dengan gambar, harga dan spec", "Tap terus ke WhatsApp di setiap listing"],
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
      { n: "01", title: "Daftar", body: "Guna email atau Google, nombor telefon dan nama untuk link anda. Bulan pertama Premium percuma, tak perlu kad." },
      { n: "02", title: "Masukkan kereta anda", body: "Gambar, harga dan spec. Kami semak setiap kereta, lepas tu ia keluar di page anda, di marketplace dan dalam presentation anda." },
      { n: "03", title: "Mula live", body: "Buka Live presentation, rakam skrin anda dan jawab \"monthly berapa?\" dengan satu tap." },
    ],
  },

  why: {
    kicker: "Ikut cara anda betul-betul jual",
    title: "Untuk salesman di lot, bukan orang pejabat.",
    items: [
      { title: "Dibina untuk telefon anda", body: "Masukkan kereta dan ambil gambar guna telefon yang memang dah ada di tangan anda di lot." },
      { title: "Siap dalam beberapa minit", body: "Tak perlu website, tak perlu designer. Daftar, masukkan kereta, dan setiap satu keluar untuk umum lepas kami semak." },
      { title: "Nampak lebih profesional", body: "Page yang proper lagi meyakinkan daripada folder screenshot. Pembeli lebih percaya salesman yang ada presence sebenar." },
      { title: "Kekal milik anda", body: "Page anda, link anda, lead anda. Tukar antara Lite dan Premium, semuanya ikut anda." },
    ],
  },

  midcta: {
    title: "Dah sedia untuk live seterusnya?",
    body: "Bulan pertama Premium percuma. Tak perlu kad, tiada caj automatik.",
  },

  plans: {
    kicker: "Pilih pelan anda",
    title: "Premium untuk jual masa live. Lite untuk mula percuma.",
    premiumName: "Salesman Premium",
    premiumPer: "/bulan",
    premiumNote: "Bulan pertama percuma",
    liteName: "Salesman Lite",
    litePer: "/selamanya",
    premiumBullets: ["Semua yang ada dalam Lite", `Sampai ${PREMIUM_CAP} listing aktif`, ...SALESMAN_PREMIUM_FEATURES_MS],
    liteBullets: [
      `Sampai ${LITE_CAP} listing aktif`,
      "Page sendiri di xdrive.my/s/namaanda",
      "Kereta anda di marketplace XDrive",
      "Pembeli hubungi anda melalui WhatsApp, chat dan booking",
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
      { q: "Boleh kira ansuran bulanan kereta masa live TikTok?",
        a: "Boleh, dengan Salesman Premium (RM35 sebulan, bulan pertama percuma). Live presentation tunjuk satu kereta satu skrin dengan nombor (#1, #2, #3) untuk penonton komen, harga, deposit, jumlah loan, kadar faedah dan ansuran bulanan untuk 9, 7 dan 5 tahun. Tukar deposit atau masukkan kadar flat bank, semua angka dikira semula. Budget mode pula senaraikan kereta anda yang muat dengan gaji atau bajet bulanan penonton. Semua angka ialah anggaran atas baki berkurangan (EIR) dan tertakluk kepada kelulusan bank. Maklumat contact anda hanya keluar bila anda tap untuk tunjuk." },
      { q: "Apa jadi lepas bulan percuma habis?",
        a: "Tiada caj automatik, dan kami tak pernah minta kad. Bayar RM35 untuk teruskan Premium sebulan lagi. Kalau tak bayar, akaun anda kembali ke Salesman Lite yang percuma: page, kereta dan lead anda kekal, dan tool Premium (Live presentation, reminder follow up dan lain-lain) ditutup sampai anda renew." },
      { q: "Kereta mana yang keluar dalam live presentation saya?",
        a: "Kereta yang ada di page XDrive anda. Kami semak setiap kereta sebelum ia keluar untuk umum, jadi kereta yang baru anda masukkan akan muncul di page dan presentation anda selepas diluluskan." },
      { q: "Salesman Lite betul-betul percuma ke?",
        a: `Ya. Salesman Lite RM0, tiada kad kredit, tiada kontrak dan tiada trial yang diam-diam caj anda kemudian. Anda dapat sampai ${LITE_CAP} listing kereta aktif, page asas anda sendiri di xdrive.my/s/namaanda, kereta anda di marketplace XDrive, enquiry pembeli melalui WhatsApp, chat dalam app dan booking, alert untuk lead baru, dan senarai lead ringkas dengan stage. Reminder follow up, log panggilan dan Live presentation ada dalam Premium.` },
      { q: "Apa itu Salesman Lite?",
        a: `Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, listing sampai ${LITE_CAP} kereta, dan pembeli boleh hubungi anda melalui WhatsApp, chat dalam app atau booking, tanpa sebarang kos atau kad kredit.` },
      { q: "Perlu buat website sendiri ke?",
        a: "Tak perlu. Anda dapat page siap di xdrive.my/s/namaanda dengan semua kereta anda. Tiada hosting, tiada domain, tiada kerja design: masukkan kereta dan share link." },
      { q: "Macam mana pembeli hubungi saya?",
        a: "Tiga cara: WhatsApp, chat dalam app, atau booking untuk datang tengok kereta. Untuk WhatsApp, pembeli taip nama dulu, lepas tu chat dengan anda terus terbuka. Setiap enquiry masuk senarai lead anda dan anda dapat alert. Nombor anda tak dipaparkan di page, jadi orang tak boleh copy. Tiada inbox kongsi dan lead tak dijual kepada ejen lain: enquiry tu milik anda." },
      { q: "Masih boleh guna Mudah dan Carlist?",
        a: "Boleh. XDrive boleh guna sekali dengan platform tu. Bezanya, page ni milik anda, ia ada di marketplace XDrive, dan tiada caj untuk setiap listing." },
      { q: `Kalau saya ada lebih dari ${LITE_CAP} kereta?`,
        a: `Salesman Premium (RM35 sebulan, bulan pertama percuma) naikkan had anda ke ${PREMIUM_CAP} listing dan tambah live presentation untuk live TikTok dan Facebook, senarai call "Minggu ini" yang tersusun dengan mesej follow up siap ditulis, reminder follow up dan log panggilan, WhatsApp semua lead yang senyap sekali gus, loan desk yang semak kemampuan dan banding bank, senarai semak handover dan senarai customer, caption AI dan draf balasan chat AI, jejak komisen, reminder booking di Telegram, katalog servis dan add-on, page yang boleh diubah suai dengan bio dan link media sosial, serta Performance yang tunjuk close rate dan di mana deal anda terlepas. Page dan kereta Lite anda terus dibawa: upgrade bila-bila masa dari panel anda.` },
      { q: "Ada contoh page yang saya boleh tengok?",
        a: "Ada. xdrive.my/s/premiummotors ialah contoh page Salesman Premium dari XDrive: stok, harga dan butang contact di setiap kereta, sama macam yang pembeli nampak bila anda share link anda." },
      { q: "Berapa lama nak setup?",
        a: "Beberapa minit sahaja. Daftar dengan email atau Google, masukkan nombor telefon dan nama link, dan anda terus masuk panel. Nombor IC diminta bila anda masukkan kereta pertama, dan setiap kereta keluar untuk umum selepas kami semak." },
    ],
  },

  final: {
    titleLines: ["Live anda yang seterusnya,", "semua dah siap dikira."],
    body: "Setiap kereta yang anda listing jadi satu skrin dengan monthly yang dah siap.",
    liteLink: "Atau mula percuma dengan Lite",
    trust: ["Bulan pertama percuma", "Nombor tersembunyi sampai anda tap", "Satu link untuk bio anda"],
  },

  crawler: {
    pricing: "Harga",
    premiumPrice: "Salesman Premium: RM35 sebulan, bulan pertama percuma",
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
      description: "First month free.",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "35", priceCurrency: "MYR", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } },
  ],
  audience: { "@type": "BusinessAudience", audienceType: "Car salesmen and car agents in Malaysia" },
  areaServed: "MY",
  inLanguage: ["ms-MY", "en-MY"],
  publisher: { "@type": "Organization", name: "XDrive", url: "https://xdrive.my" },
};
