// Copy for the buyer guide pages (/guides, /guides/faq, /guides/buying), shared
// by the SPA (src/pages/GuidesPage.jsx) and the crawler prerender (api/og.js).
// Crawlers never run the SPA, so this file is what Google and AI answers read.

export const GUIDE_META = {
  how: {
    path: "/guides",
    title: "How It Works — XDrive Malaysia",
    description: "Learn how to buy a car on XDrive Malaysia. Browse verified listings, use the finance calculator, contact dealers directly, and drive away with confidence.",
    h1: "How to Buy a Car on XDrive",
    intro: "Six steps from browsing to driving — with verified dealers, transparent pricing, and no hidden fees.",
  },
  faq: {
    path: "/guides/faq",
    title: "FAQ — XDrive Malaysia",
    description: "Frequently asked questions about buying a car on XDrive Malaysia. Answers on pricing, dealers, financing, and more.",
    h1: "Frequently Asked Questions",
  },
  buying: {
    path: "/guides/buying",
    title: "Buyer's Guide — XDrive Malaysia",
    description: "Expert tips for buying a car in Malaysia. Budget planning, new vs recon comparison, financing advice, and what to check before signing.",
    h1: "Buyer's Guide",
  },
};

export const GUIDE_STEPS = [
  {
    step: '01',
    title: 'Browse Verified Listings',
    body: "Search by brand, budget, location, or body type. Every car on XDrive is listed by a certified dealer — no private sellers, no phantom listings. What you see is what's actually on the lot.",
    tips: ['Use the brand filter to narrow by make', 'Filter by state to find cars near you', 'Toggle "Recon" to see imported units'],
  },
  {
    step: '02',
    title: 'Check the Full Details',
    body: 'Each listing shows the full spec sheet: year, mileage, engine size, transmission, colour, and condition. Scroll down to see the "What\'s Included" section — warranty, tinting, insurance, and any dealer add-ons are all listed upfront.',
    tips: ['Look for the Verified badge on listings', 'Check "What\'s Included" for value-add items', 'View all photos in the gallery before deciding'],
  },
  {
    step: '03',
    title: 'Run the Finance Calculator',
    body: 'Before you call anyone, use our Finance Calculator to estimate your monthly installment, road tax, and insurance cost. Adjust the down payment, tenure, and interest rate until it fits your budget. You can even download a PDF quotation.',
    tips: ['Aim for monthly repayment ≤ 15% of take-home', 'Most banks offer 2.4–3.5% flat rate for new cars', 'Budget for road tax + insurance on top of installment'],
    cta: { label: 'Open Calculator', to: '/calculator' },
  },
  {
    step: '04',
    title: 'Contact the Dealer Directly',
    body: 'Hit the WhatsApp button on any listing to connect directly with the dealer\'s salesperson. No middlemen, no lead-selling — your number goes to one person. Discuss availability, negotiate, and book a test drive.',
    tips: ['Ask for the latest OTR price', 'Confirm the unit is still available before visiting', 'Request a physical inspection report if buying recon'],
  },
  {
    step: '05',
    title: 'Test Drive & Inspect',
    body: 'Visit the dealership for a test drive. For used and recon cars, request an independent inspection or ask the dealer for the Carfax / JPJ record. Check for accident history, service records, and ownership history.',
    tips: ['Bring a friend or mechanic if buying used', 'Test all electrical features (A/C, windows, infotainment)', 'Verify the chassis and engine numbers match the grant'],
  },
  {
    step: '06',
    title: 'Sign & Drive',
    body: "Once you've agreed on a price, the dealer handles the loan application, JPJ transfer, insurance, and road tax. XDrive dealers use a digital document system — no lost paperwork. You'll receive all documents in one package.",
    tips: ['Keep a copy of the sale & purchase agreement', 'Confirm the loan approval letter before paying deposit', 'Ensure road tax and insurance are valid before driving off'],
  },
];

export const GUIDE_FAQS = [
  {
    q: 'Are all listings on XDrive from certified dealers?',
    a: 'Yes. XDrive only allows verified, registered car dealers to list inventory. Private sellers are not permitted. Every dealer goes through a manual verification process before going live.',
  },
  {
    q: 'What does "Recon" mean?',
    a: '"Recon" (reconditioned) refers to vehicles originally manufactured for export markets (Japan, UK, etc.) that have been imported, converted to Malaysian road specifications, and registered locally. They typically offer more features at lower prices but may have higher road tax. Always confirm the conversion spec with the dealer.',
  },
  {
    q: 'Is the listed price the final price?',
    a: 'Listed prices are the asking prices set by the dealer. In Malaysia, car prices are generally negotiable within 2–5%. Use our Finance Calculator to plan your budget, then negotiate the OTR (on-the-road) price directly with the dealer.',
  },
  {
    q: 'What is OTR price?',
    a: 'OTR (On-The-Road) price is the total cost including road tax, insurance, and registration fees — the amount you actually pay before driving off. Our Finance Calculator estimates OTR including road tax and insurance.',
  },
  {
    q: 'How do I contact a dealer?',
    a: 'Each listing has a "WhatsApp Dealer" button that connects you directly to the dealer\'s salesperson. No middlemen or lead brokers — your contact goes straight to the person who can close the deal.',
  },
  {
    q: 'Can I compare multiple cars?',
    a: 'Yes. Click the compare icon on any listing to add it to your compare bar, then head to the Compare page to view specs side by side.',
  },
  {
    q: 'How accurate is the Finance Calculator?',
    a: 'The calculator uses current JPJ road tax tables and standard insurance tariff formulas. Financing figures are estimates based on flat interest rate inputs — actual bank rates vary by lender and credit profile. Use it for budgeting, then get a formal letter of offer from your bank.',
  },
  {
    q: 'What documents do I need to buy a car?',
    a: 'For new loans: IC copy, 3 months payslips, 3 months bank statements, EPF statement (optional). For civil servants: EA form or letter of employment. Self-employed: 6 months bank statements + business registration. The dealer will guide you through the paperwork.',
  },
  {
    q: 'Does XDrive charge buyers any fees?',
    a: 'No. XDrive is completely free for buyers. Dealers pay a subscription fee to list inventory — you pay nothing to browse, contact, or compare cars.',
  },
];

export const GUIDE_TIPS = [
  {
    category: 'Budget',
    items: [
      'Cap your monthly repayment at 15% of take-home pay.',
      'Add RM 3,000–6,000 for road tax + insurance on a typical RM 80k–120k car.',
      'Keep RM 2,000–3,000 in reserve for minor repairs in the first year.',
      'Down payment of 10% is standard; 20%+ reduces total interest significantly.',
    ],
  },
  {
    category: 'New vs Used vs Recon',
    items: [
      'New: manufacturer warranty, zero mileage, but highest depreciation in year 1–2.',
      'Used (local): lower price, known maintenance history if buying from a dealer.',
      'Recon: imported, usually more features per ringgit — check JPJ compliance and conversion spec.',
      'Always ask for the grant (vehicle ownership card) and verify engine/chassis numbers match.',
    ],
  },
  {
    category: 'Financing',
    items: [
      'Get pre-approved from 2–3 banks before visiting a dealer — use the best offer.',
      'Flat rate 2.4–3.5% = ~4.5–6.5% effective interest rate (EIR). Compare EIR, not flat rate.',
      'Avoid extending tenure beyond 7 years — total interest balloons.',
      'Islamic hire-purchase (HP) vs conventional: functionally similar, choose based on your bank\'s rate.',
    ],
  },
  {
    category: 'What to Check Before Signing',
    items: [
      'Confirm the car is not under a finance lien (check JPJ portal).',
      'Verify the accident history — ask for a PDRM report or inspection record.',
      'Read the sale & purchase agreement carefully before signing.',
      'Confirm all included accessories/services are written into the agreement.',
    ],
  },
];

export const GUIDE_FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: GUIDE_FAQS.map((f) => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
