// Content for the /features/:slug pages, shared by the SPA
// (src/pages/FeaturePage.jsx) and the crawler prerender (api/og.js), so what
// Google and AI crawlers read is exactly what visitors see. Plain data only —
// icons are lucide names, mapped to components in FeaturePage.jsx (ICONS).

// ─────────────────────────────────────────────────────────────────────────────
// Content — one entry per feature page. Every capability and step below maps to
// a real function in the product (per-unit P&L / fetchPnl, stock_units, leads
// pipeline, RevOpsPage, dealer_products + HP board, post_sale_tasks handover
// sequence, expiry-reminders). Order also drives the "explore more" cross-links.
// ─────────────────────────────────────────────────────────────────────────────
export const FEATURES = {
  "smart-inventory": {
    icon: "Car",
    kicker: "Inventory & Stock",
    titleLead: "Every unit, real cost, real profit —",
    titleAccent: "before you price it",
    sub: "Track each car from purchase to sale with its true landed cost, ageing and per-unit P&L. Stop pricing off the asking figure and guessing your margin.",
    seo: "ShiftOS Smart Inventory — used car stock management for Malaysian dealers. Track purchase cost, recon, days-in-stock, holding cost and true per-unit profit.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "Stock lives in a WhatsApp group and three Excel sheets that never quite agree.",
      "You price off gut feel — recon, road tax and floor-plan interest are never in the number.",
      "Aged units quietly bleed interest; nobody notices a car's been sitting 120 days.",
      "Two salesmen chase the same car and you only find out at handover.",
    ],
    solutions: [
      "One live stock list — purchase price, recon and days-in-stock on every unit.",
      "A live cost floor built from your real overheads, so you never price below break-even.",
      "Per-unit P&L: front gross, back gross, holding cost and handover fees, auto-calculated.",
      "Assign a car to one rep and it locks out of everyone else's pool — no double-selling.",
    ],
    capabilities: [
      { icon: "Package", title: "Per-unit stock ledger", desc: "Purchase price, recon cost, encumbrance status (clear / under HP) and days-in-stock tracked on every unit." },
      { icon: "Wallet", title: "True per-unit P&L", desc: "Front gross (sale − cost − recon − services − commission − handover) plus back-end F&I gross, in one modal." },
      { icon: "Clock", title: "Holding-cost tracking", desc: "Floor-plan interest or overhead-per-day × days held, deducted automatically so ageing stock shows its real drag." },
      { icon: "Calculator", title: "Cost-floor pricing", desc: "Set your monthly overhead, fleet size and floor-plan rate once; every car shows the price you can't go below." },
      { icon: "Gauge", title: "Recon & ad-spend reconciliation", desc: "Booked recon estimate vs actual jobs, plus ad spend per unit (Mudah, Carlist, FB, TikTok), folded into gross." },
      { icon: "Globe", title: "Bulk import & instant storefront", desc: "Import a PDF or Excel stock list in one pass, and publish any unit to your own XDrive storefront with one toggle." },
    ],
  },

  "leads-crm": {
    icon: "Users",
    kicker: "Leads & CRM",
    titleLead: "Every enquiry, every channel,",
    titleAccent: "one pipeline",
    sub: "Capture leads from WhatsApp, walk-ins and the marketplace, then move them through a visual pipeline until they're won — with follow-ups and test drives that never slip.",
    seo: "ShiftOS Leads CRM — capture and manage car enquiries from WhatsApp, walk-in and the XDrive marketplace in one visual sales pipeline built for Malaysian dealers.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "Enquiries scatter across WhatsApp, Instagram DMs, Mudah chat and sticky notes.",
      "No follow-up system — hot buyers go cold because nobody circled back.",
      "You can't tell which source or which salesman actually closes.",
      "Test drives and deposits live in someone's head, not a system.",
    ],
    solutions: [
      "One inbox: WhatsApp, walk-in, referral and marketplace enquiries auto-captured as leads.",
      "A drag-and-drop pipeline from new → contacted → test drive → negotiation → won.",
      "Every lead tagged by source and salesman, so conversion is finally measurable.",
      "Test-drive bookings, deposits and loan status tracked right on the lead.",
    ],
    capabilities: [
      { icon: "Users", title: "Visual pipeline board", desc: "Drag a lead between stages; win it and the deal fans out to sold car, customer and handover automatically." },
      { icon: "MessageCircle", title: "Auto lead capture", desc: "WhatsApp and marketplace enquiries land as leads with buyer name, phone and the exact car they asked about." },
      { icon: "CalendarClock", title: "Test drives & appointments", desc: "Book a test drive against a car and a rep; every appointment stays in one calendar view." },
      { icon: "Banknote", title: "Deposit & loan tracking", desc: "Deposit taken, bank, loan amount and approval status carried on the lead — no separate notebook." },
      { icon: "Tag", title: "Source & rep attribution", desc: "Walk-in, WhatsApp, referral or marketplace — see which channel and which salesman actually convert." },
      { icon: "ClipboardCheck", title: "Won = done, automatically", desc: "Closing a lead marks the car sold, creates the customer record and seeds the handover checklist in one move." },
    ],
    steps: {
      title: "How a lead moves",
      sub: "One pipeline from first message to closed deal.",
      items: [
        { title: "New", desc: "Enquiry captured from WhatsApp, walk-in or the marketplace." },
        { title: "Contacted", desc: "First reply logged; the follow-up clock starts." },
        { title: "Test drive", desc: "Booked against the car and the assigned salesman." },
        { title: "Negotiation", desc: "Price, trade-in and financing worked through." },
        { title: "Deposit", desc: "Deposit taken and recorded on the lead." },
        { title: "Won", desc: "Car flips to sold, customer created, handover seeded." },
      ],
    },
  },

  "revenue-analytics": {
    icon: "LineChart",
    kicker: "Revenue & Profit",
    titleLead: "Your real profit —",
    titleAccent: "front and back, per unit",
    sub: "Not asking price. Not revenue. The actual gross you made this month — per car, per salesman, per source — computed from cost, recon, commission, holding and F&I add-ons.",
    seo: "ShiftOS Revenue Analytics — see true gross profit per unit, per salesman and month-over-month, with automatic commission and F&I back-end revenue.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "You know revenue, not profit — margin is a monthly guess.",
      "Commission is worked out by hand and argued over.",
      "No idea which salesman or which source is actually making money.",
      "Last month vs this month is a feeling, not a number.",
    ],
    solutions: [
      "Gross-profit month-to-date built from real parts — cost, recon, commission, holding, F&I.",
      "Commission calculated automatically on every closed deal.",
      "A per-salesman scoreboard: units, gross and conversion.",
      "This-month-vs-last, per unit and in total, on one dashboard.",
    ],
    capabilities: [
      { icon: "LineChart", title: "Gross-profit MTD", desc: "Front + back gross recomputed live from cost, recon, services, commission and handover — never a stale stored figure." },
      { icon: "Wallet", title: "Front & back gross split", desc: "See vehicle margin and F&I add-on margin separately, per unit and in aggregate." },
      { icon: "Users", title: "Per-salesman scores", desc: "Units closed, gross generated, response time and conversion rate for every rep." },
      { icon: "TrendingUp", title: "Month-over-month", desc: "MTD vs last-month-to-date on revenue, units and GP, with a daily gross-profit sparkline." },
      { icon: "Percent", title: "Commission, automatic", desc: "Flat, % of sale or % of margin — every closed deal's commission calculated by the rule you set." },
      { icon: "Receipt", title: "Add-on revenue", desc: "Back-end F&I revenue and average add-on per deal, so you see the money beyond the metal." },
    ],
  },

  "fi-documents": {
    icon: "Landmark",
    kicker: "F&I & Documents",
    titleLead: "Back-end profit and paperwork,",
    titleAccent: "done properly",
    sub: "Sell warranty, insurance, tint and coating as tracked products, run HP financing, and issue the sales agreement and receipts — all recorded against the deal.",
    seo: "ShiftOS F&I & Documents — sell and track F&I add-ons, manage HP financing, and generate sales agreements and receipts for Malaysian used-car deals.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "Add-ons sold on the side, never recorded, never counted as profit.",
      "Loan applications tracked on a whiteboard; LOUs expire unnoticed.",
      "Sales agreements and deposit receipts retyped in Word every single time.",
      "F&I is a black box — you can't see back-end contribution.",
    ],
    solutions: [
      "A product catalogue (warranty, insurance, tint, coating) sold per deal and counted as back gross.",
      "An HP board: loan status from submitted → approved, with LOU expiry tracking.",
      "Generate the sales agreement and deposit receipt, and email them to the buyer.",
      "Back-end revenue flows straight into per-unit and monthly P&L.",
    ],
    capabilities: [
      { icon: "Receipt", title: "F&I product catalogue", desc: "Define add-ons with cost and selling price; attach them to a deal and the margin books as back gross." },
      { icon: "Landmark", title: "HP financing board", desc: "Track each loan — bank, amount, status (submitted / pending / approved / declined) and LOU validity." },
      { icon: "FileSignature", title: "Document generation", desc: "Sales agreement, deposit receipt and more, generated from the deal's own data — no retyping." },
      { icon: "MessageCircle", title: "Email straight to the buyer", desc: "Issue a document to the buyer's inbox and keep a record of it against the deal." },
      { icon: "Calculator", title: "Insurance & loan estimates", desc: "Quick insurance premium and monthly-instalment estimates while you're closing." },
      { icon: "Users", title: "Dedicated F&I role", desc: "An F&I officer seat so financing and paperwork have a clear owner, scoped by role and permission." },
    ],
  },

  "post-sale-handover": {
    icon: "ClipboardCheck",
    kicker: "Post-Sale Handover",
    titleLead: "After “sold” comes the hard part —",
    titleAccent: "we run the checklist",
    sub: "The Malaysian ownership transfer — loan settlement, Puspakom, JPJ pindah milik, road tax, geran — as an automated 8-step checklist seeded the moment a deal is won.",
    seo: "ShiftOS Post-Sale Handover — automate the Malaysian car ownership transfer: loan settlement, Puspakom B5/B7, JPJ pindah milik, road tax and geran, as a per-sale checklist.",
    painTitle: "The old way",
    solutionTitle: "With ShiftOS",
    pains: [
      "“Sold” is where the real admin starts — and it lives on paper and WhatsApp.",
      "Puspakom B5/B7, JPJ pindah milik, road tax, geran — miss one and the buyer waits.",
      "Nobody's sure who owns which step: you, the runner, or the buyer.",
      "Handover costs are never deducted, so your “profit” is overstated.",
    ],
    solutions: [
      "An 8-step handover board auto-created the moment the lead is won.",
      "Every Malaysian step in order, with the official fee and who's responsible.",
      "B7 auto-marked N/A on cash deals, so nothing irrelevant clutters the list.",
      "Handover costs feed back into the unit's gross, so your profit stays honest.",
    ],
    capabilities: [
      { icon: "ClipboardCheck", title: "Auto-seeded checklist", desc: "Win a deal and the 8-step handover appears — no setup, idempotent, identical no matter who closed it." },
      { icon: "Landmark", title: "The Malaysian sequence", desc: "Loan settlement, buyer insurance, Puspakom B5 & B7, JPJ pindah milik, road tax, geran, then handover." },
      { icon: "Users", title: "An owner for every step", desc: "Each step shows who's responsible — you, a runner, the dealer or the customer — and its live status." },
      { icon: "Wallet", title: "Costs in your P&L", desc: "Puspakom, JPJ and other official fees sum into the unit's handover cost and reduce its gross." },
      { icon: "Receipt", title: "Customer records & packages", desc: "Every won deal becomes a customer with car, plate, price and contact — ready for prepaid service packages." },
      { icon: "BellRing", title: "Expiry reminders", desc: "Road tax and insurance expiring in 30 / 7 days, and overdue handover steps, trigger reminders automatically." },
    ],
    steps: {
      title: "The 8-step Malaysian handover",
      sub: "Seeded automatically when a deal is won — official fees are the standard rates and editable.",
      items: [
        { title: "Loan settlement", meta: "if under HP", desc: "Clear the previous owner's hire-purchase so the car can transfer." },
        { title: "Buyer insurance", desc: "New owner's policy in place before transfer." },
        { title: "Puspakom B5", meta: "RM30", desc: "Ownership-transfer inspection at Puspakom." },
        { title: "Puspakom B7", meta: "RM60 · financed only", desc: "Hire-purchase inspection — auto-marked N/A on cash deals." },
        { title: "JPJ pindah milik", meta: "RM100", desc: "Ownership transfer at JPJ — biometric for both parties, buyer within 7 days." },
        { title: "Road tax", desc: "Renewed under the new owner." },
        { title: "Geran collection", desc: "Collect the new registration card (geran)." },
        { title: "Handover", desc: "Keys and documents handed to the buyer — deal complete." },
      ],
    },
  },
};

export const ORDER = ["smart-inventory", "leads-crm", "revenue-analytics", "fi-documents", "post-sale-handover"];

// Page <title> text. Keeps the lead's trailing dash: stripping it ran the two
// halves together ("…the hard part we run the checklist").
export const featureTitle = (f) => `${f.titleLead} ${f.titleAccent}`;
