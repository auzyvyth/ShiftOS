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
export const REVIEWED_ISO = "2026-10-30";
// XDrive's own example Salesman Premium page, linked so agents and crawlers can
// see the product rather than a mock-up. Must stay an active account with cars.
export const EXAMPLE_PAGE = { url: "https://xdrive.my/s/premiummotors", path: "/s/premiummotors", label: "xdrive.my/s/premiummotors" };
export const SEO_KEYWORDS = [
  "kalkulator loan kereta", "kira loan kereta", "kira loan kereta excel", "formula excel loan kereta",
  "kira ansuran kereta", "kalkulator ansuran bulanan kereta", "kira ansuran kereta live",
  "CRM salesman kereta", "rekod prospek pelanggan", "template prospek excel", "cara follow up customer kereta",
  "app salesman kereta Malaysia", "jual kereta TikTok live", "salesman kereta live",
  "car loan calculator Malaysia", "car salesman CRM Malaysia", "TikTok live car salesman",
  // Independent agents' tool searches (owner, 2026-10-30). Kept word for word,
  // typo included ("untk"): the FAQ answers carry the readable versions.
  "create free car catalog link", "web page untk ejen kereta", "used car dms free Malaysia",
  "aplikasi urus stok kereta secondhand", "cara buat digital showroom recon car",
  "free online inventory tracker for car salesmen", "cheaper alternative to Mudah for car agents",
  "free vehicle listing page for solo agents", "how to share car stock without listing fees",
  "ad-free personal car showroom link", "share car stock directly to WhatsApp status",
].join(", ");

// ─── English ────────────────────────────────────────────────────────────────
const EN = {
  htmlLang: "en",
  inLanguage: "en-MY",
  switchTo: "ms",
  switchLabel: "Tukar ke Bahasa Melayu",

  // Search terms (2026-10-28): "car loan calculator", "Excel", "CRM / lead"
  // for car salesmen. No Malaysian page answered the Excel loan and prospect
  // tracker searches; those are the gap this page and its FAQ go after.
  seoTitle: "Car Loan Calculator & Lead CRM for Car Salesmen | XDrive",
  seoDesc:
    "For Malaysian car salesmen: work out car loan instalments on your live, keep every lead in one CRM, follow up until the deal closes. Replaces Excel. Start free.",

  heroEyebrow: "For car salesmen who sell on TikTok, Facebook and WhatsApp",
  heroH1Lines: ["Car loan calculator and lead CRM", "for car salesmen"],
  heroIntro:
    "One app in three parts. A car loan calculator for your lives: the monthly over 9, 7 and 5 years for every car, deposit changed in one tap. A dashboard that says who to call today. And a lead CRM where every buyer from WhatsApp, chat and bookings lands with a stage. It replaces the Excel loan sheet and the prospect list.",
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
        alt: "Lite lead list: buyers with their car, price and stage, and a WhatsApp button on each",
        title: "Every buyer in a stage, not lost in a chat.",
        line: "An alert on your phone when a new buyer comes in.",
      },
      dashboard: {
        tab: "Dashboard",
        alt: "Premium dashboard: leads waiting for follow-up, today's bookings, and counts of leads, WhatsApp taps, page visits and cars sold this month",
        title: "Open the app. Know who needs you today.",
        line: "Follow-ups that are due and today's bookings, right at the top.",
      },
      listings: {
        tab: "My Listings",
        alt: "Listings tab: a car card with photo, price, status, views and enquiries, and Caption and Edit buttons",
        title: "Every car on one card.",
        line: "Status, views, enquiries and what to fix next, per car.",
      },
      chat: {
        tab: "Chat",
        alt: "Chat tab: buyer conversations, each with the car they asked about and an unread count",
        title: "Buyers message you inside the app.",
        line: "Each chat shows the car it is about, and joins your lead list.",
      },
      premiumLeads: {
        tab: "Leads",
        alt: "Lead pipeline with stage filters and buyer cards flagged not contacted, with how many days they waited",
        title: "Every buyer in a stage, not lost in a chat.",
        line: "Buyers nobody replied to are flagged, with how long they waited.",
      },
      inbox: {
        tab: "Inbox",
        alt: "Inbox tab: a booking waiting for confirmation and a week calendar of test drives and viewings",
        title: "Every test drive in one calendar.",
        line: "Confirm a booking or move it in one tap.",
      },
      sold: {
        tab: "Sold",
        alt: "Sold tab: a won deal in handover with its progress and the next step, JPJ ownership transfer",
        title: "Won is not done. The handover, step by step.",
        line: "A won deal gets its 8-step handover checklist.",
      },
      analytics: {
        tab: "Analytics",
        alt: "Analytics tab: commission and cars sold, the step where most deals stop, and the close rate",
        title: "Find out where you are losing deals.",
        line: "Close rate, commission and the step where deals stop.",
      },
      loans: {
        tab: "Loans",
        alt: "Loans tab: a loan check that needs fixing and two bank applications, one pending and one approved",
        title: "Check the loan before the bank says no.",
        line: "What to fix first, then every bank application in one list.",
      },
      outreach: {
        tab: "Outreach",
        alt: "Outreach tab: hot, warm and cold leads, contacted today, and a button to message all hot leads",
        title: "Quiet leads? Message them all at once.",
        line: "The message is written for you. You press send.",
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
    plansTitle: "One price. Paid month by month.",
    // Hero (owner, 2026-10-28): laid out like a product-box ad. Two leads
    // asked "is it monthly?" and took the product for a calculator, so the
    // hero names the three parts with a real screen of each, the price, and
    // how billing works. The screens are the real app on sample data.
    offer: {
      tag: "Ready to use",
      h1a: "3 in 1",
      h1b: "sales app",
      sub: "For car salesmen",
      line: "A car loan calculator for your lives, a dashboard, and a CRM for every lead. Follow up until the deal closes. One app, no more Excel.",
      parts: [
        { title: "Live calculator", line: "Monthly, deposit and tenure, worked out in front of your viewers.", alt: "Live presentation: a car numbered #1 with its monthly instalment over 9, 7 and 5 years and deposit buttons" },
        { title: "Dashboard", line: "Who to call today, page visits and WhatsApp taps.", alt: "Premium dashboard: leads waiting for follow-up, today's bookings, lead and WhatsApp tap counts" },
        { title: "Leads", line: "Every buyer has a stage, never lost in your chats.", alt: "Lead pipeline: buyers sorted by stage, each with the car, price and a WhatsApp button" },
      ],
      shotsNote: "Real app screens, sample data.",
      badges: ["No credit card", "No contract", "Nothing charged automatically", `Up to ${PREMIUM_CAP} cars`],
      priceKicker: "Premium",
      price: `RM${PREMIUM_PRICE}`,
      per: "/month",
      priceNote: `First ${TRIAL_DAYS} days free`,
      billing: `Paid month by month. ${TRIAL_DAYS} days free, then RM${PREMIUM_PRICE} a month (about RM${PER_DAY} a day) if you keep it.`,
      cta: `Start ${TRIAL_DAYS} days free`,
      liteLink: "Or start free on Lite",
      tryKicker: "Try it",
      tryTitle: "Tap a deposit. Watch the monthly change.",
    },
    // Plan cards (owner, 2026-10-28): the hero's three parts on both cards,
    // so Lite vs Premium reads part by part, then how paying works in three
    // steps, because two leads could not tell whether Premium is monthly.
    planCards: {
      premium: {
        badge: `${TRIAL_DAYS} days free`,
        billing: "Paid month by month · DuitNow QR",
        groups: [
          { h: "Live calculator", items: ["Live presentation for TikTok / FB lives", "Unlimited loan posters", ...P_EN.calc] },
          { h: "Dashboard", items: P_EN.dash },
          { h: "Leads", items: [`Up to ${PREMIUM_CAP} cars on your page and the marketplace`, "Buyers reach you by WhatsApp, chat and booking", ...P_EN.leads] },
        ],
        moreLabel: "Also in Premium",
        more: P_EN.more,
      },
      lite: {
        billing: "Free forever · no card",
        groups: [
          { h: "Live calculator", items: ["Live presentation for TikTok / FB lives", `Loan posters for ${LITE_POSTERS} cars a month`] },
          { h: "Dashboard", items: ["Alerts on new leads", "Views + WhatsApp taps for each car"] },
          { h: "Leads", items: [`Up to ${LITE_CAP} cars on your page and the marketplace`, "Buyers reach you by WhatsApp, chat and booking", "A simple lead list with stages"] },
        ],
      },
      payKicker: "How paying works",
      paySteps: [
        { when: `Day 1 to ${TRIAL_DAYS}`, title: "Free", line: "All of Premium. No card asked." },
        { when: `Day ${TRIAL_DAYS + 1}`, title: `Pay RM${PREMIUM_PRICE}`, line: "Scan the DuitNow QR in the app and WhatsApp us. Premium runs another month." },
        { when: "Every month after", title: "Pay again, or stop", line: "Not paid? You go back to free Lite. Your page, cars and leads stay." },
      ],
    },
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
      { q: "Can I work out a car loan in Excel?",
        a: "Yes. The monthly is =PMT(rate/12, years*12, -loan amount), with the rate as an EIR (interest on the reducing balance). Since the Hire-Purchase (Amendment) Act 2026 took effect on 1 June 2026, new hire-purchase agreements are on EIR, so a flat rate has to be converted first or the sheet shows a monthly that is too low. A sheet also has to be retyped for every car and every deposit. Live presentation does this for every car you list: flat rates are converted to EIR, and deposit and tenure change with one tap. Figures are estimates; the bank decides." },
      { q: "How do I keep track of prospects and leads?",
        a: "Most salesmen use an Excel sheet or a notebook: name, number, the car they want, where they came from, stage and the next follow-up date. A sheet never reminds you to follow up, and every lead from WhatsApp, chat or a booking has to be typed in by hand. Here every buyer who contacts you lands in your lead list by themselves, with a stage and an alert on your phone, free on Lite. Premium adds follow-up reminders, a call log and a \"This week\" list of who to call." },
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
        a: `Salesman Premium (RM35/month, first 7 days free) raises your cap to ${PREMIUM_CAP} listings and adds a sorted "This week" call list with follow-up messages already drafted, follow-up reminders and call logging, WhatsApp to all your quiet leads in one go, a loan desk that checks affordability and compares banks, the post-sale handover checklist and customer list, commission tracking, Telegram booking reminders, a services and add-ons catalogue, a page you can customise with your bio and social links, and a Performance view that shows your close rate and where your deals are lost. Your Lite page and cars carry straight over: upgrade any time from your panel.` },
      { q: "Is there an example page I can see?",
        a: "Yes. xdrive.my/s/premiummotors is XDrive's example Salesman Premium page: stock, prices and a contact button on every car, exactly what a buyer sees when you share your link." },
      { q: "How long does setup take?",
        a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel. You're asked for your IC number when you add your first car, and each car goes public once we've checked it." },
      // Independent agents' tool searches (owner, 2026-10-30): each question is
      // the searcher's own words, so Google snippets and AI answers can match it.
      // New copy says Drevo (BRAND-1). No claims about Mudah's prices.
      { q: "What is the best free inventory app for independent car dealers in Malaysia?",
        a: `For a solo agent or a small independent dealer, Drevo Salesman Lite is a free online inventory tracker for car salesmen. Add up to ${LITE_CAP} cars with photos, price and specs, mark each one available, reserved or sold, and every car shows on your own page and the Drevo marketplace. It costs RM0 with no time limit. Premium raises the cap to ${PREMIUM_CAP} cars.` },
      { q: "Is there a free used car dealer management system with no trial limit?",
        a: `Yes, for solo agents. Drevo Salesman Lite is a free used car DMS for Malaysia with no trial and no end date, up to ${LITE_CAP} cars: your stock, a page that shows it, and a lead list for every buyer who contacts you. It is not a full dealership system with stock costing and team accounts; dealerships have their own plans.` },
      { q: "How do I create a custom landing page for my used car inventory?",
        a: "Sign up for Drevo Salesman Lite and add your cars. You get a ready page with a link ending in /s/yourname: every car with photos, price and a contact button. That is your free car catalog link for your TikTok or Instagram bio, WhatsApp and Facebook groups. It is an ad-free personal car showroom link: only your cars, no ads and no other agents' cars. It works the same as a digital showroom for recon cars. No website, hosting or design work." },
      { q: "How do I share car stock without listing fees?",
        a: `Drevo charges no fee per listing. Salesman Lite is a free vehicle listing page for solo agents: up to ${LITE_CAP} cars on your own page, and each car also appears on the Drevo marketplace. Share one link and buyers see all your stock.` },
      { q: "Is there a cheaper alternative to Mudah for car agents?",
        a: `Drevo Salesman Lite costs RM0: up to ${LITE_CAP} cars, your own page and no fee per listing. We don't compare prices with other platforms, so check their current rates. Many agents use both: keep your Mudah ads and share your Drevo link with buyers who want to see all your stock in one place.` },
      { q: "Can I share car stock directly to WhatsApp status?",
        a: `Yes. Each car can be turned into a loan poster: one image with the photo, price and monthly instalments over 9, 7 and 5 years, saved to your phone to post on WhatsApp Status, TikTok or Facebook. Lite includes posters for ${LITE_POSTERS} cars a month; Premium has no limit. You can also share your page link straight into a WhatsApp chat or Status.` },
      { q: "How can a solo car salesman track leads and WhatsApp clicks?",
        a: "On Drevo, every buyer who taps WhatsApp, sends a chat or books a viewing lands in your lead list with a stage, and you get an alert. Each car shows its views and WhatsApp taps, so you can see which cars pull buyers. Free on Lite. Premium adds follow-up reminders, a call log and a Performance view that shows where deals are lost." },
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

  seoTitle: "Kalkulator Loan Kereta & CRM Lead untuk Salesman | XDrive",
  seoDesc:
    "Untuk salesman kereta: kira loan kereta dan ansuran bulanan masa live, rekod semua lead dalam satu CRM, follow up sampai deal. Ganti Excel. Mula percuma.",

  heroEyebrow: "Untuk salesman kereta yang jual di TikTok, Facebook dan WhatsApp",
  heroH1Lines: ["Kalkulator loan kereta dan CRM lead", "untuk salesman kereta"],
  heroIntro:
    "Satu app, tiga bahagian. Kalkulator loan kereta untuk live: monthly 9, 7 dan 5 tahun untuk setiap kereta, tukar deposit dengan satu tap. Dashboard yang tunjuk siapa perlu di-call hari ni. Dan CRM lead: setiap pembeli dari WhatsApp, chat dan booking masuk dengan stage. Ganti sheet Excel kira loan dan senarai prospek anda.",
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
        tab: "Lead",
        alt: "Senarai lead Lite: pembeli dengan kereta, harga dan stage, dan butang WhatsApp pada setiap satu",
        title: "Setiap pembeli ada stage, tak hilang dalam chat.",
        line: "Alert di telefon bila pembeli baru masuk.",
      },
      dashboard: {
        tab: "Dashboard",
        alt: "Dashboard Premium: lead yang tunggu follow-up, booking hari ini, dan bilangan lead, tap WhatsApp, lawatan page dan kereta terjual bulan ini",
        title: "Buka app. Terus tahu siapa perlukan anda hari ni.",
        line: "Follow up yang dah sampai masa dan booking hari ini, paling atas.",
      },
      listings: {
        tab: "Listing Saya",
        alt: "Tab listing: kad kereta dengan gambar, harga, status, views dan pertanyaan, serta butang Caption dan Edit",
        title: "Setiap kereta dalam satu kad.",
        line: "Status, views, pertanyaan dan apa nak dibaiki, untuk setiap kereta.",
      },
      chat: {
        tab: "Chat",
        alt: "Tab chat: perbualan pembeli, setiap satu dengan kereta yang ditanya dan bilangan mesej belum dibaca",
        title: "Pembeli chat terus dalam app.",
        line: "Setiap chat tunjuk kereta yang ditanya, dan masuk senarai lead anda.",
      },
      premiumLeads: {
        tab: "Lead",
        alt: "Pipeline lead dengan filter stage dan kad pembeli ditanda belum dihubungi berserta berapa hari dia tunggu",
        title: "Setiap pembeli ada stage, tak hilang dalam chat.",
        line: "Pembeli yang belum dibalas ditanda, dengan berapa hari dia tunggu.",
      },
      inbox: {
        tab: "Peti Masuk",
        alt: "Tab peti masuk: booking yang tunggu pengesahan dan kalendar seminggu untuk test drive dan viewing",
        title: "Semua test drive dalam satu kalendar.",
        line: "Sahkan booking atau tukar masa dengan satu tap.",
      },
      sold: {
        tab: "Terjual",
        alt: "Tab terjual: deal yang dah won dalam handover dengan kemajuan dan langkah seterusnya, pindah milik JPJ",
        title: "Won belum bermakna selesai. Handover, langkah demi langkah.",
        line: "Deal won terus dapat senarai semak handover 8 langkah.",
      },
      analytics: {
        tab: "Analitik",
        alt: "Tab analitik: komisen dan kereta terjual, langkah di mana paling banyak deal berhenti, dan kadar closing",
        title: "Cari di mana anda terlepas deal.",
        line: "Kadar closing, komisen dan langkah di mana deal berhenti.",
      },
      loans: {
        tab: "Pinjaman",
        alt: "Tab pinjaman: semakan loan yang perlu dibaiki dan dua permohonan bank, satu dalam proses dan satu lulus",
        title: "Semak loan dulu, sebelum bank tolak.",
        line: "Apa nak dibaiki dulu, lepas tu setiap permohonan bank dalam satu senarai.",
      },
      outreach: {
        tab: "Outreach",
        alt: "Tab outreach: lead panas, suam dan sejuk, yang dihubungi hari ini, dan butang untuk mesej semua lead panas",
        title: "Lead senyap? Mesej semua sekali gus.",
        line: "Mesej dah siap ditulis. Anda tekan hantar.",
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
    plansTitle: "Satu harga. Bayar bulan ke bulan.",
    offer: {
      tag: "App siap guna",
      h1a: "3 dalam 1",
      h1b: "app jualan",
      sub: "Untuk salesman kereta",
      line: "Kalkulator loan kereta untuk live, dashboard, dan CRM untuk semua lead. Follow up sampai deal. Satu app, tak perlu Excel lagi.",
      parts: [
        { title: "Kalkulator Live", line: "Monthly, deposit dan tempoh, dikira terus depan penonton.", alt: "Live presentation: kereta bernombor #1 dengan ansuran bulanan 9, 7 dan 5 tahun serta butang deposit" },
        { title: "Dashboard", line: "Siapa perlu di-call hari ni, lawatan page dan tap WhatsApp.", alt: "Dashboard Premium: lead yang tunggu follow-up, booking hari ini, bilangan lead dan tap WhatsApp" },
        { title: "Leads", line: "Setiap pembeli ada stage, tak hilang dalam chat.", alt: "Pipeline lead: pembeli disusun ikut stage, setiap satu dengan kereta, harga dan butang WhatsApp" },
      ],
      shotsNote: "Skrin app sebenar, data contoh.",
      badges: ["Tak perlu kad kredit", "Tiada kontrak", "Tiada caj automatik", `Sampai ${PREMIUM_CAP} kereta`],
      priceKicker: "Premium",
      price: `RM${PREMIUM_PRICE}`,
      per: "/bulan",
      priceNote: `${TRIAL_DAYS} hari pertama percuma`,
      billing: `Bayar bulan ke bulan. ${TRIAL_DAYS} hari percuma, lepas tu RM${PREMIUM_PRICE} sebulan (lebih kurang RM${PER_DAY} sehari) kalau nak teruskan.`,
      cta: `Mula ${TRIAL_DAYS} hari percuma`,
      liteLink: "Atau mula percuma dengan Lite",
      tryKicker: "Cuba sendiri",
      tryTitle: "Tap deposit. Tengok monthly berubah.",
    },
    planCards: {
      premium: {
        badge: `${TRIAL_DAYS} hari percuma`,
        billing: "Bayar bulan ke bulan · DuitNow QR",
        groups: [
          { h: "Kalkulator Live", items: ["Live presentation untuk TikTok / FB live", "Poster loan tanpa had", ...P_MS.calc] },
          { h: "Dashboard", items: P_MS.dash },
          { h: "Leads", items: [`Sampai ${PREMIUM_CAP} kereta di page anda dan marketplace`, "Pembeli hubungi anda melalui WhatsApp, chat dan booking", ...P_MS.leads] },
        ],
        moreLabel: "Juga dalam Premium",
        more: P_MS.more,
      },
      lite: {
        billing: "Percuma selamanya · tak perlu kad",
        groups: [
          { h: "Kalkulator Live", items: ["Live presentation untuk TikTok / FB live", `Poster loan untuk ${LITE_POSTERS} kereta sebulan`] },
          { h: "Dashboard", items: ["Alert untuk lead baru", "Views + tap WhatsApp untuk setiap kereta"] },
          { h: "Leads", items: [`Sampai ${LITE_CAP} kereta di page anda dan marketplace`, "Pembeli hubungi anda melalui WhatsApp, chat dan booking", "Senarai lead ringkas dengan stage"] },
        ],
      },
      payKicker: "Cara bayaran",
      paySteps: [
        { when: `Hari 1 hingga ${TRIAL_DAYS}`, title: "Percuma", line: "Semua Premium. Tak minta kad." },
        { when: `Hari ${TRIAL_DAYS + 1}`, title: `Bayar RM${PREMIUM_PRICE}`, line: "Scan DuitNow QR dalam app dan WhatsApp kami. Premium aktif sebulan lagi." },
        { when: "Setiap bulan lepas tu", title: "Bayar lagi, atau berhenti", line: "Tak bayar? Akaun balik ke Lite yang percuma. Page, kereta dan lead kekal." },
      ],
    },
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
      { q: "Boleh ke kira loan kereta guna Excel?",
        a: "Boleh. Monthly ialah =PMT(kadar/12, tahun*12, -jumlah pinjaman), dengan kadar dalam EIR (faedah atas baki berkurangan). Sejak Akta Sewa Beli (Pindaan) 2026 berkuat kuasa pada 1 Jun 2026, perjanjian sewa beli baru guna EIR, jadi kadar flat kena ditukar dulu, kalau tak sheet anda tunjuk monthly yang terlalu rendah. Sheet Excel juga kena taip semula untuk setiap kereta dan setiap deposit. Live presentation buat semua ni untuk setiap kereta yang anda listing: kadar flat ditukar ke EIR, deposit dan tempoh bertukar dengan satu tap. Anggaran sahaja; keputusan di tangan bank." },
      { q: "Macam mana nak rekod prospek dan lead pelanggan?",
        a: "Ramai salesman guna Excel atau buku nota: nama, nombor, kereta yang diminati, dari mana dia datang, stage dan tarikh follow up. Sheet tak pernah ingatkan anda bila nak follow up, dan setiap lead dari WhatsApp, chat atau booking kena taip sendiri. Di sini setiap pembeli yang hubungi anda masuk sendiri ke senarai lead, dengan stage dan alert di telefon, percuma dengan Lite. Premium tambah reminder follow up, log panggilan dan senarai \"Minggu ini\" siapa perlu di-call." },
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
        a: `Salesman Premium (RM35 sebulan, 7 hari pertama percuma) naikkan had anda ke ${PREMIUM_CAP} listing dan tambah senarai call "Minggu ini" yang tersusun dengan mesej follow up siap ditulis, reminder follow up dan log panggilan, WhatsApp semua lead yang senyap sekali gus, loan desk yang semak kemampuan dan banding bank, senarai semak handover dan senarai customer, jejak komisen, reminder booking di Telegram, katalog servis dan add-on, page yang boleh diubah suai dengan bio dan link media sosial, serta Performance yang tunjuk close rate dan di mana deal anda terlepas. Page dan kereta Lite anda terus dibawa: upgrade bila-bila masa dari panel anda.` },
      { q: "Ada contoh page yang saya boleh tengok?",
        a: "Ada. xdrive.my/s/premiummotors ialah contoh page Salesman Premium dari XDrive: stok, harga dan butang contact di setiap kereta, sama macam yang pembeli nampak bila anda share link anda." },
      { q: "Berapa lama nak setup?",
        a: "Beberapa minit sahaja. Daftar dengan email atau Google, masukkan nombor telefon dan nama link, dan anda terus masuk panel. Nombor IC diminta bila anda masukkan kereta pertama, dan setiap kereta keluar untuk umum selepas kami semak." },
      // Same seven questions as the English list, in the searcher's own BM.
      { q: "Apa aplikasi urus stok kereta secondhand percuma untuk ejen bebas?",
        a: `Untuk ejen solo atau dealer kecil, Drevo Salesman Lite ialah aplikasi urus stok kereta secondhand yang percuma. Masukkan sampai ${LITE_CAP} kereta dengan gambar, harga dan spec, tanda setiap satu available, reserved atau sold, dan setiap kereta keluar di page anda sendiri dan marketplace Drevo. RM0, tiada had masa. Premium naikkan had ke ${PREMIUM_CAP} kereta.` },
      { q: "Ada sistem DMS kereta terpakai percuma tanpa had trial?",
        a: `Ada, untuk ejen solo. Drevo Salesman Lite ialah DMS kereta terpakai percuma di Malaysia, tiada trial dan tiada tarikh tamat, sampai ${LITE_CAP} kereta: stok anda, page yang tunjuk stok tu, dan senarai lead untuk setiap pembeli yang hubungi anda. Ia bukan sistem penuh untuk dealership (tiada kos stok atau akaun team); dealership ada pelan sendiri.` },
      { q: "Cara buat digital showroom recon car atau web page untuk ejen kereta?",
        a: "Daftar Drevo Salesman Lite dan masukkan kereta anda. Anda terus dapat page siap dengan link yang berakhir /s/namaanda: setiap kereta dengan gambar, harga dan butang contact. Itulah digital showroom anda, untuk recon car atau kereta terpakai, dan link katalog kereta percuma untuk bio TikTok, Instagram, WhatsApp dan group Facebook. Page ni hanya ada kereta anda: tiada iklan dan tiada kereta ejen lain. Tak perlu website, hosting atau design." },
      { q: "Macam mana nak share stok kereta tanpa bayar listing?",
        a: `Drevo tak caj untuk setiap listing. Salesman Lite ialah page listing kereta percuma untuk ejen solo: sampai ${LITE_CAP} kereta di page anda sendiri, dan setiap kereta keluar juga di marketplace Drevo. Share satu link, pembeli nampak semua stok anda.` },
      { q: "Ada alternatif lebih murah daripada Mudah untuk ejen kereta?",
        a: `Drevo Salesman Lite RM0: sampai ${LITE_CAP} kereta, page sendiri dan tiada caj setiap listing. Kami tak banding harga dengan platform lain, jadi semak kadar semasa mereka. Ramai ejen guna dua-dua: teruskan iklan Mudah anda dan share link Drevo kepada pembeli yang nak tengok semua stok di satu tempat.` },
      { q: "Bagaimana cara ejen kereta promosi stok guna WhatsApp?",
        a: `Setiap kereta boleh jadi poster loan: satu gambar dengan foto, harga dan ansuran bulanan 9, 7 dan 5 tahun, disimpan ke telefon untuk post di WhatsApp Status, TikTok atau Facebook. Lite dapat poster untuk ${LITE_POSTERS} kereta sebulan; Premium tiada had. Anda juga boleh share link page terus ke chat atau Status WhatsApp, dan pembeli yang tap WhatsApp masuk terus ke senarai lead anda.` },
      { q: "Macam mana salesman solo nak jejak lead dan klik WhatsApp?",
        a: "Di Drevo, setiap pembeli yang tap WhatsApp, hantar chat atau buat booking masuk ke senarai lead anda dengan stage, dan anda dapat alert. Setiap kereta tunjuk jumlah view dan tap WhatsApp, jadi anda nampak kereta mana yang tarik pembeli. Percuma dengan Lite. Premium tambah reminder follow up, log panggilan dan Performance yang tunjuk di mana deal terlepas." },
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
// The crawler page prints both lists (BM, then English), so its FAQPage holds
// both. One FAQPage per page: never send FAQ_LD and FAQ_LD_EN side by side.
export const FAQ_LD_BOTH = faqLd([...FAQS_MS, ...FAQS_EN]);

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
  screenshot: "https://xdrive.my/for-salesmen/tour-dashboard-ms.webp",
  featureList: [
    "Live presentation: car instalment calculator for TikTok and Facebook lives",
    "Own car listing page at xdrive.my/s/yourname",
    `Up to ${LITE_CAP} listings free, ${PREMIUM_CAP} on Premium`,
    "Buyer enquiries by WhatsApp, in-app chat and booking requests",
    "Alerts on new leads and a simple lead list with stages",
    "Free online inventory tracker and car catalog link for independent agents",
    "Per-car views and WhatsApp taps",
    "Loan poster images for WhatsApp Status, TikTok and Facebook",
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
