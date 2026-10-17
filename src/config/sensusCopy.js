// SENSUS-1: copy for the /sensus-ai landing page. Shared by the SPA page
// (src/pages/SensusAiPage.jsx) and the crawler render (api/og.js), so the text
// a dealer reads and the text Google indexes can never drift.
//
// Sensus AI is a SEPARATE company's product (Sensus DWC LLC); the owner presents
// it as an associate. Nothing here may say or imply it is an XDrive / Drevo
// product. Every figure below is Sensus's own (their deck, approved by Sensus for
// public use, 2026-10-16) and is labelled as Sensus's projection, never as a
// guaranteed result. No price is stated: it is quoted in the demo (owner's call).

import { SITE_URL } from "./site.js";

export const PATH = "/sensus-ai";
export const CANON = `${SITE_URL}${PATH}`;

// The presenter. Empty fields hide their button; fill these in, nothing else.
// whatsapp: digits only with country code, e.g. "60123456789".
export const CONTACT = {
  name: "",
  title: "Sensus AI Sales Associate, Malaysia",
  whatsapp: "",
  linkedin: "",
};

export const SEO_TITLE = "AI for Car Dealerships in Malaysia | Sensus AI Sales & Service Agent";
// Link previews (WhatsApp, LinkedIn, Facebook) show og:title + og:image, not the
// Google title: a short result-first headline and the page's own image, so a
// shared link does not preview as the marketplace (public/og-sensus.jpg).
export const OG_TITLE = "Wake up to test drives already booked | Sensus AI";
export const OG_IMAGE = `${SITE_URL}/og-sensus.jpg`;
export const OG_SITE = "Sensus AI";

export const SEO_DESC =
  "Sensus AI answers every car buyer and service enquiry 24/7 on WhatsApp, web, email and phone, qualifies them, books test drives and service, and follows up automatically. Book a free 20-minute demo for your dealership.";

// Lead with the result the dealer gets, not the product (owner's brief,
// 2026-10-17). Every claim must stay true: "in minutes" matches Sensus's own
// "median first response under 5 minutes" in IMPACT, not a promise of seconds.
export const HERO = {
  eyebrow: "AI for Malaysian car dealerships",
  h1: "Wake up to test drives already booked",
  sub: "The buyer who messaged at 11pm got an answer in minutes and a slot in your diary. Sensus AI replies on WhatsApp, your website, email and phone, qualifies every enquiry, books the test drive or service, and keeps following up, so your sales team spends its day closing.",
  cta: "Book a free 20-minute demo",
  ctaNote: "A live walk-through on the kind of enquiries you get. No commitment.",
};

// Before -> after, the change a dealer would notice in their own showroom.
export const BEFORE_AFTER = {
  title: "What changes in your showroom",
  rows: [
    { before: "Weekend and late-night enquiries wait until someone is back at the desk", after: "Answered in minutes, any hour, with the keen buyers already booked in" },
    { before: "Follow-up stops after the second try because the team is busy", after: "Every lead is followed up until it books a visit or says no" },
    { before: "Service and insurance reminders depend on someone remembering", after: "Reminders go out on time and bookings land in the service diary" },
  ],
};

export const BRANDS = ["Volvo", "Volkswagen", "GM", "BMW", "Nissan", "Honda", "Audi", "Stellantis", "Chery", "Jetour", "Lucid", "BAIC"];
export const TRUST_LINE = "Sensus technology runs in dealerships for brands including";
export const COMPANY_LINE = "Automotive technology company founded in 2013, live across Asia Pacific, Japan, the Middle East, Africa, Europe and the Americas.";

export const PROBLEMS = {
  title: "Where a dealership quietly loses money",
  items: [
    { stat: "40%", title: "The response gap", body: "of leads are lost to a slow reply or an enquiry that came in after hours." },
    { stat: "80%", title: "The follow-up void", body: "of sales happen after the 5th contact, but most consultants stop after the 2nd." },
    { stat: "79%", title: "Buyers shop after work", body: "of people look for a car online outside working hours, when nobody is at the desk." },
  ],
  source: "Figures: Sensus.",
};

export const HOW = {
  title: "How it works",
  steps: [
    { k: "Inbound AI", title: "Answers every enquiry, any hour", body: "A buyer asks about a car, financing or a trade-in at 11pm. The AI answers on the channel they used, in their language, and asks the questions your best salesperson would." },
    { k: "Qualify and book", title: "Turns a chat into an appointment", body: "It books the test drive or service slot, writes the lead into one record, and chases a no-show automatically." },
    { k: "Hand-over", title: "Your salesperson closes", body: "The warm, qualified buyer is handed to your team for price, trade-in and finance. The AI does not replace salespeople." },
    { k: "Outbound AI", title: "Keeps every customer coming back", body: "Service-interval and insurance renewal reminders, declined-repair follow-ups, satisfaction checks, and re-engaging cold leads when a new model launches." },
  ],
};

// The Customer Circle (Sensus, Rev2): 11 stages, who starts each contact.
export const CIRCLE = {
  title: "One record for the whole customer life",
  lead: "Sensus works across sales and aftersales: 8 of 11 stages have an AI step, and the 3 that matter face to face stay with your people.",
  legend: { inbound: "Inbound AI: the customer starts", outbound: "Outbound AI: Sensus starts", human: "Your team, face to face" },
  stages: [
    { n: 1, title: "Research & discovery", body: "Website AI agent answers spec, stock and service questions, any hour", dir: ["inbound"] },
    { n: 2, title: "Enquiry & qualification", body: "Instant reply, structured questions, lead created", dir: ["inbound"] },
    { n: 3, title: "Test drive booking", body: "AI books the slot and chases no-shows", dir: ["inbound", "outbound"] },
    { n: 4, title: "Negotiation & close", body: "Warm lead handed to the salesperson", dir: ["human"] },
    { n: 5, title: "Handover & delivery", body: "Post-handover satisfaction follow-up", dir: ["outbound"] },
    { n: 6, title: "Service & ownership", body: "Bookings in, service and insurance reminders out", dir: ["inbound", "outbound"] },
    { n: 7, title: "Service reception", body: "Advisor greets the customer; the record is already there", dir: ["human"] },
    { n: 8, title: "Vehicle health check", body: "Declined repair work is followed up", dir: ["outbound"] },
    { n: 9, title: "Vehicle return", body: "Advisor hands back the car and explains the invoice", dir: ["human"] },
    { n: 10, title: "Post-service follow-up", body: "Satisfaction check, next service booked", dir: ["outbound"] },
    { n: 11, title: "Retention & repurchase", body: "Cold leads and launches bring the customer back to stage 1", dir: ["outbound"] },
  ],
};

export const CHANNELS = ["WhatsApp", "Website chat", "Email", "Voice calls", "SMS", "Facebook / Meta"];

export const IMPACT = {
  title: "What Sensus projects for a dealership",
  note: "Projected benchmarks published by Sensus, not a guarantee. Your results depend on your lead volume, your team and how the AI is set up.",
  groups: [
    { title: "Sales", rows: [
      ["Median first response", "under 5 minutes"],
      ["Missed inbound calls", "down 25%"],
      ["Cost per qualified lead", "down 20%"],
      ["Test-drive no-show rate", "down 30-40%"],
      ["Sales gross profit", "up 20-25%"],
      ["Extra units sold (dealer at 15 a month)", "+3-5 a month"],
    ] },
    { title: "Aftersales", rows: [
      ["Missed inbound service calls", "down 30-40%"],
      ["Contact to booking conversion", "up 30-50%"],
      ["Service show-up rate", "up 30%"],
      ["Average repair order value", "up 10-15%"],
      ["Lost-customer reactivation", "up 25-40%"],
    ] },
  ],
};

export const FIT = {
  title: "Built for",
  items: [
    "Franchise and 3S dealerships (sales, service and parts)",
    "Multi-branch used and recond car groups",
    "Service centres that want more bookings and fewer no-shows",
  ],
};

// The other half of FIT (owner, 2026-10-17, Hormozi-style soft filter): say
// plainly who it is NOT for, so the wrong dealer leaves before taking a slot.
export const NOT_FIT = {
  title: "Probably too early if",
  items: [
    "You get fewer than about 100 enquiries a month",
    "You sell on your own rather than run a dealership or service centre",
    "You are looking for a free chatbot rather than a sales and service system",
  ],
};

// Step 1 of the form. A "below the line" answer is still saved, it just gets a
// different screen and an "Early" tag in the console (isSensusFit below).
export const DEALER_TYPES = [
  { id: "franchise", label: "Franchise or 3S dealership" },
  { id: "group", label: "Used or recond group, 2+ branches" },
  { id: "single", label: "Single used or recond showroom" },
  { id: "service", label: "Service centre or workshop" },
  { id: "agent", label: "Independent agent or salesperson" },
];
export const isSensusFit = (dealerType, enquiries) => dealerType !== "agent" && enquiries !== "lt100";

export const ENQUIRY_OPTIONS = [
  { id: "lt100", label: "Under 100" },
  { id: "100_300", label: "100 to 300" },
  { id: "300_1000", label: "300 to 1,000" },
  { id: "gt1000", label: "Over 1,000" },
  { id: "unsure", label: "Not sure" },
];

export const FORM = {
  title: "Book your dealership demo",
  step1: "First, two quick questions so I can prepare the right demo.",
  next: "Continue",
  back: "Back",
  earlyTitle: "Sensus may be early for you",
  earlyBody: "It pays off most once a showroom handles 100+ enquiries a month. Leave your number anyway and I'll send a short overview, and we can talk when the volume is there.",
  earlySubmit: "Send me the overview",
  earlyDone: "Thanks. I'll WhatsApp you a short overview.",
  lead: "20 minutes, online or at your showroom. I will show the AI answering the kind of enquiries you get every day.",
  submit: "Request my demo",
  sending: "Sending...",
  consent: "I agree to be contacted on WhatsApp or phone about this request. My details are used only for that.",
  doneTitle: "Request received",
  doneBody: "I will WhatsApp you within one working day to fix a time.",
};

export const FAQ = [
  { q: "Does the AI replace my salespeople?", a: "No. It answers, qualifies, books and follows up. Price, trade-in and finance negotiation stay with your salesperson, who receives a warm lead instead of a cold one." },
  { q: "Which channels does it work on?", a: "WhatsApp, your website, email, voice calls and SMS, with every conversation written to one customer record." },
  { q: "Can it speak Bahasa Malaysia, English and Chinese?", a: "The agent is multilingual and can reply in the language the customer writes in. We will confirm the languages you need during the demo." },
  { q: "Is it only for sales?", a: "No. It also books service, runs service-interval and insurance renewal reminders, follows up declined repair work and checks satisfaction after a visit." },
  { q: "How much does it cost?", a: "There is a one-off setup and a monthly plan sized to your conversation volume. Because volumes differ a lot between dealerships, pricing is quoted in the demo." },
  { q: "What about customer data and PDPA?", a: "Data handling and consent are part of the setup. Bring your questions to the demo and we will walk through them for your dealership." },
];

export const FOOTER = {
  disclaimer: "Sensus and Sensus AI are products of Sensus DWC LLC. This page is run by an independent Sensus sales associate in Malaysia.",
};

export const SERVICE_LD = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Sensus AI for car dealerships",
  serviceType: "AI sales and aftersales agent for automotive dealerships",
  description: SEO_DESC,
  areaServed: { "@type": "Country", name: "Malaysia" },
  provider: { "@type": "Organization", name: "Sensus DWC LLC", foundingDate: "2013" },
  url: CANON,
};

export const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export const waUrl = (text) =>
  CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}` : null;

export const SENSUS_ERRORS = {
  sensus_bad_name: "Please enter your name.",
  sensus_bad_dealership: "Please enter your dealership name.",
  sensus_bad_phone: "Please enter a valid WhatsApp number.",
  sensus_rate_limited: "We already have your request. I will be in touch shortly.",
};
