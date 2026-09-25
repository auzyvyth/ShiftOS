// Copy for the /for-salesmen landing page, shared by the SPA
// (src/pages/SalesmanLiteLanding.jsx) and the crawler prerender (api/og.js).
// Googlebot and every AI crawler are routed to api/og.js by vercel.json and
// never run the SPA, so this file IS what search engines and AI answers read.
// Keep it plain data (no JSX, no icons) — api/og.js runs on the edge.

export const CANON = "https://xdrive.my/for-salesmen";
export const SEO_TITLE = "Salesman Lite — Free Car Listing Page for Malaysian Car Agents | XDrive";
export const SEO_DESC =
  "Salesman Lite is a free account for Malaysian car salesmen and agents. Get your own car listing page on xdrive.my, list up to 10 cars, and receive buyer enquiries straight on WhatsApp. Akaun jual kereta percuma untuk salesman — tiada kad kredit.";
export const SEO_KEYWORDS = [
  "salesman kereta online", "app salesman kereta Malaysia", "akaun jual kereta percuma",
  "free car listing Malaysia", "senarai kereta percuma", "car agent page Malaysia",
  "jual kereta online percuma", "profil salesman kereta", "listing kereta percuma Malaysia",
  "car salesman website Malaysia", "WhatsApp car enquiries", "XDrive salesman lite",
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
    a: "Salesman Premium (RM35/month) triples your cap to 30 listings and adds priority marketplace placement, commission tracking, advanced analytics and a custom subdomain. Your Lite page and cars carry straight over — upgrade any time from your panel." },
  { q: "How long does setup take?",
    a: "A few minutes. Sign up with email or Google, add your phone and a link name, and you're in your panel — add your first car with a few photos to go live. IC verification can wait until just before your listings appear on the marketplace, so nothing holds up getting started." },
  { q: "Apa itu Salesman Lite?",
    a: "Salesman Lite ialah akaun percuma untuk salesman dan ejen kereta di Malaysia. Anda dapat page sendiri di xdrive.my, senaraikan sehingga 10 kereta, dan terima enquiry pembeli terus di WhatsApp — tanpa sebarang kos atau kad kredit." },
];

export const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "XDrive Salesman Lite",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: CANON,
  description: SEO_DESC,
  offers: [
    { "@type": "Offer", name: "Salesman Lite", price: "0", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Salesman Premium", price: "35", priceCurrency: "MYR" },
  ],
  areaServed: "MY",
  inLanguage: ["en-MY", "ms-MY"],
  publisher: { "@type": "Organization", name: "XDrive", url: "https://xdrive.my" },
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
export const PREMIUM_BULLETS = ["Everything in Lite", "Up to 30 active listings", "Priority marketplace placement", "Advanced CRM automation", "Commission tracking", "Advanced analytics + custom subdomain"];
