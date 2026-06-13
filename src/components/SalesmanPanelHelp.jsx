import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid, Car, User, MessageSquare, BarChart2, Banknote,
  ClipboardCheck, FileText, Settings, ChevronDown, ChevronUp,
  CheckCircle2, BookOpen, Coins,
} from 'lucide-react';

// ─── Shared styles ────────────────────────────────────────────────────────────
const CARD = {
  background: '#0d1117',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  overflow: 'hidden',
};

const SECTIONS = [
  { key: 'overview',   icon: BookOpen,       en: 'Overview',       ms: 'Gambaran Keseluruhan' },
  { key: 'dashboard',  icon: LayoutGrid,     en: 'Dashboard',      ms: 'Papan Pemuka' },
  { key: 'listings',   icon: Car,            en: 'Listings',       ms: 'Listing' },
  { key: 'leads',      icon: User,           en: 'Leads',          ms: 'Lead' },
  { key: 'dealsheet',  icon: FileText,       en: 'Deal Sheet',     ms: 'Helaian Deal' },
  { key: 'enquiries',  icon: MessageSquare,  en: 'Enquiries',      ms: 'Pertanyaan' },
  { key: 'loans',      icon: Banknote,       en: 'Loans',          ms: 'Pinjaman' },
  { key: 'handover',   icon: ClipboardCheck, en: 'Handover',       ms: 'Serahan' },
  { key: 'analytics',  icon: BarChart2,      en: 'Analytics',      ms: 'Analisis' },
  { key: 'commission', icon: Coins,          en: 'Commission',     ms: 'Komisen' },
  { key: 'settings',   icon: Settings,       en: 'Settings',       ms: 'Tetapan' },
  { key: 'faq',        icon: CheckCircle2,   en: 'FAQ',            ms: 'Soal Jawab' },
];

// ─── Content ──────────────────────────────────────────────────────────────────
const CONTENT = {
  en: {
    overview: {
      title: 'What is the Salesman Panel?',
      body: 'The Salesman Panel is your workspace as part of a dealership on ShiftOS. Unlike the standalone Salesman Lite, this panel is connected live to your dealer — the cars you sell, the leads you work, and the deals you close all feed straight into the dealer dashboard. Your owner and managers can see your pipeline; you can see the dealer\'s stock, your assigned cars, and the commission set for each one.',
      items: [
        { label: 'Connected to your dealer', desc: 'A banner at the top of your Dashboard shows your dealership and a "Synced" badge. Every booking, enquiry, lead and sale you log is shared with the dealer\'s system in real time — no separate reporting needed.' },
        { label: 'Dealer stock access', desc: 'In the Listings tab you can browse the dealer\'s Available Inventory and feature any car on your own listings to sell it. Featuring a car does NOT create a fake lead — your pipeline stays clean for real buyers only.' },
        { label: 'Commission set by the dealer', desc: 'The dealer sets your commission per car — either a fixed RM amount or a percentage of the sale. You see exactly what you will earn on every car, before and after the sale.' },
        { label: 'Full sales toolkit', desc: 'Lead pipeline, deal sheet generator, HP loan calculator, WhatsApp enquiry inbox, appointment scheduling, post-sale handover checklist, and performance analytics — all in one place.' },
        { label: 'Premium AI features', desc: 'If your dealer puts you on the Premium plan, you unlock AI follow-up suggestions, AI WhatsApp reply drafting, AI social captions, and automatic lead scoring.' },
        { label: 'Permissions', desc: 'Some features are turned on or off by your dealer: viewing commission figures (view_commission) and seeing the whole team\'s leads instead of just your own (view_all_leads). If a feature is hidden, ask your manager.' },
      ],
    },
    dashboard: {
      title: 'Dashboard',
      body: 'The Dashboard is your home screen. It shows your numbers for the month, what needs attention today, and a live feed of recent activity.',
      items: [
        { label: 'Dealer connection banner', desc: 'At the very top — your dealership name, logo, and a green "Synced" badge confirming your account is live with the dealer\'s system.' },
        { label: 'What to do today (Premium)', desc: 'AI-generated follow-up suggestions ranked by priority. Each suggestion has a WA button to message the buyer instantly and a Done button to clear it once actioned. Tap Generate or Refresh to pull a fresh set.' },
        { label: 'KPI cards', desc: 'Enquiries (with a 7-day mini chart), Active Listings (with how many are available), Commission earned (only if you have view_commission), and Active Leads (flags how many are stale).' },
        { label: 'Monthly target', desc: 'A progress bar tracking cars sold this month against the target your dealer set for you. A "Target hit!" badge appears when you reach it.' },
        { label: 'Upcoming appointments', desc: 'Your booked viewings and test drives. Each card shows date, buyer, car, phone and notes, with buttons to WhatsApp the buyer, Reschedule, Cancel, or set a Reminder (pings you one hour before).' },
        { label: 'Manager notes', desc: 'Read-only notes left for you by your dealer or manager appear here with the date.' },
        { label: 'Recent activity', desc: 'A chronological feed of your latest bookings, enquiries, lead stage changes, and sales so you can see at a glance what just happened.' },
      ],
    },
    listings: {
      title: 'Listings',
      body: 'The Listings tab has two views, toggled at the top: "My Listings" (cars you are selling) and "Available Inventory" (the dealer\'s stock you can pick up).',
      items: [
        { label: 'My Listings vs Available Inventory', desc: 'My Listings = cars assigned to you by the dealer plus any you have featured. Available Inventory = the dealer\'s available stock you can browse and add to your listings.' },
        { label: 'Add to my listings', desc: 'In Available Inventory, tap "Add to my listings" on any car to start selling it. This features the car on your profile and your listings without creating a pipeline lead — leads are reserved for real buyers only.' },
        { label: 'Status filters', desc: 'Filter My Listings by All, Available, Reserved, Pending, or Sold. "All" shows your active cars (not sold); the Sold filter shows your closed cars with the commission you earned and the sale date.' },
        { label: 'Commission badge', desc: 'Every active car shows an amber "Earn RM X" badge so you always know what each sale is worth to you. Sold cars show a green "Earned RM X" badge plus the date. The figure respects the dealer\'s rule (fixed amount or percentage).' },
        { label: 'CVR heatmap', desc: 'Each card has a conversion bar — enquiries divided by views. A "Hot" tag (red) means strong interest; a "Stale" tag (grey) means lots of views but no enquiries, a sign the price or photos need work. Hover for the exact numbers.' },
        { label: 'Sharing buttons', desc: 'Copy Link copies a direct link to the car. WA Caption copies a ready-formatted WhatsApp message (specs, price, link) to paste into chats. Broadcast sends the car to multiple eligible leads at once (up to 10).' },
        { label: 'AI Caption (Premium)', desc: 'Generates a social-media caption for WhatsApp, TikTok, Instagram or Facebook with the right tone and emojis. Copy or regenerate as needed.' },
        { label: 'Approval status', desc: 'If you added a car that needs manager sign-off, it shows "Awaiting approval". If the manager rejects it, the reason appears in red on the card.' },
      ],
    },
    leads: {
      title: 'Leads',
      body: 'A lead is a real buyer you are working. The Leads tab is your pipeline — a board of stages from first contact to a closed deal. On desktop it is a kanban board; on mobile it is a filterable list.',
      items: [
        { label: 'Adding a lead', desc: 'Tap "Add Lead" (or the + button on mobile). Enter buyer name and phone; optionally link a car, and add IC, email and address. Leads you add are tagged to you and shared with the dealer.' },
        { label: 'Stages', desc: 'New → Contacted → Viewing Booked → Test Drive → Negotiating → Deposit Taken → Won. Won and Lost leads drop out of the active board into archives. Use the "→ next stage" button on each card to advance.' },
        { label: 'Test drive confirmation', desc: 'When you advance a lead past Test Drive, a confirmation asks if the test drive actually happened. This stops deals being marked further along by accident. Confirm only when it has truly taken place.' },
        { label: 'Card buttons', desc: 'Each card has: → next stage (advance), a phone icon (tap to call), WA (opens a pre-written WhatsApp message you can edit), and ··· (opens the full lead drawer). If a lead has no phone and no car, a "Link Car" button shows instead of WA.' },
        { label: 'Heat & AI score', desc: 'A heat pill (hot/warm/cold) reflects stage and how long since last contact. On Premium, an AI score badge (HOT/WARM/COLD) rates buying intent; tap Re-score in the drawer to refresh it.' },
        { label: 'Lead drawer', desc: 'Tap ··· to open the side drawer: buyer details, an editable notes log, Log Call, Set Reminder, Scripts, History, Link/Change Car, the Deal Sheet generator, and (Premium) an AI WhatsApp reply drafter.' },
        { label: 'Log call', desc: 'Record the outcome of a call — Answered, No Answer, Callback Requested, or Voicemail — with an optional note. The outcome shows as a badge on the lead card.' },
        { label: 'Follow-up reminders', desc: 'Set a follow-up date (Tomorrow, in 2/3 days, next week, or a custom date). Overdue follow-ups turn the card orange and appear on your Dashboard so nothing slips.' },
        { label: 'Objection scripts', desc: 'The Scripts button gives proven Malaysian sales responses for common objections — price too high, high mileage, not ready, need to think. Copy any line straight into WhatsApp.' },
        { label: 'Link / Change Car', desc: 'Open the drawer and tap Link Car (or Change Car) to attach a car from your listings via a searchable picker. The car then appears on the card and is pulled into any deal sheet you generate.' },
        { label: 'Stale leads', desc: 'Leads with no activity for 48+ hours are flagged stale. The "X stale" button in the header opens a batch WhatsApp tool to re-engage them one after another.' },
        { label: 'Mark as lost / delete', desc: 'In the drawer you can mark a lead lost (choose a reason: Price, Timing, Competitor, Ghost) or delete it. Lost leads collapse into a "Lost" accordion at the bottom of the board.' },
      ],
    },
    dealsheet: {
      title: 'Deal Sheet',
      body: 'A deal sheet is a clean, branded one-page summary you send to a buyer — car, pricing, instalment estimate, fees, and your contact. It is generated from inside the lead drawer and lives on a shareable link valid for 24 hours.',
      items: [
        { label: 'Where to find it', desc: 'Open any lead with a car linked, then in the drawer tap "Customise & Generate" under Deal Sheet. If no car is linked the button reads "Link a car first" — link one to continue.' },
        { label: 'Customise: HP financing', desc: 'Set the down payment %, the loan tenure (3, 5, 7 or 9 years), and the flat interest rate. The sheet calculates the estimated monthly instalment, total interest and total repayment for the buyer.' },
        { label: 'Customise: fees & registration', desc: 'Optionally add road tax, insurance and Puspakom amounts. Anything you enter is added into the on-road total shown on the sheet. Leave blank to omit.' },
        { label: 'Note to buyer', desc: 'Add a short personal note — e.g. "Offer valid this weekend only" or "Free first service included". It renders as a highlighted block on the sheet the buyer sees.' },
        { label: 'Branding', desc: 'The sheet automatically carries your dealer\'s name, logo, brand colour and disclaimer, with your name and WhatsApp as the contact. It looks identical in quality to a dealer-generated sheet.' },
        { label: 'Add-ons', desc: 'Any F&I add-on products already attached to the deal are listed automatically with their prices and included in the total.' },
        { label: 'Sharing', desc: 'After generating, you get a link with Copy, Preview (opens the sheet in a new tab), and Send via WA (opens WhatsApp to the buyer with the link). Tap New to regenerate with different settings.' },
        { label: 'Expiry', desc: 'Each link is valid for 24 hours. If a buyer opens an expired link they see a friendly "ask for a fresh link" message — just generate a new one.' },
      ],
    },
    enquiries: {
      title: 'Enquiries',
      body: 'The Enquiries tab collects buyers who reached out through XDrive, plus appointment requests. The red badge on the tab shows new enquiries plus pending bookings.',
      items: [
        { label: 'Enquiries', desc: 'When a buyer taps WhatsApp on one of your XDrive listings, it is captured here with their name, phone, the car, and their message. Status shows new or replied.' },
        { label: 'Quick reply templates', desc: 'One-tap templates — "Interested? Let\'s chat", "Book a test drive", "Price negotiation", "Deposit to reserve" — copy the text and open WhatsApp to the buyer.' },
        { label: 'AI reply (Premium)', desc: 'Generate a tailored response to the buyer\'s specific question, then copy or send it via WhatsApp.' },
        { label: 'Appointments / bookings', desc: 'Test drive and viewing requests from XDrive appear here. Confirm, Reschedule or Cancel from the card. A WA button sends a confirmation message, and a Reminder button pings you an hour before. Confirmed bookings also show on your Dashboard.' },
      ],
    },
    loans: {
      title: 'Loans',
      body: 'The Loans tab is a hire-purchase toolkit: compare bank rates for a buyer, then submit and track loan applications.',
      items: [
        { label: 'Bank comparison calculator', desc: 'Enter the car price, down payment, tenure and (optionally) the buyer\'s monthly income. A table compares the major Malaysian banks side by side — rate, monthly payment, total interest and total payable — and highlights the cheapest monthly option.' },
        { label: 'Select a bank', desc: 'Tap Select on any bank row to carry its rate and terms straight into the application form below.' },
        { label: 'Application form', desc: 'Capture the buyer (name, phone, IC, employment type, income), the car (model, price, down payment), and the loan (bank, amount, rate, tenure). The monthly payment is calculated automatically. Add notes if needed, then Submit Application.' },
        { label: 'My applications', desc: 'A table of every loan you have submitted with buyer, car, bank, amount, monthly, status and date. Edit a row to update its status (Submitted, Pending, Approved, Declined) or delete it.' },
      ],
    },
    handover: {
      title: 'Handover',
      body: 'The Handover tab is the post-sale checklist for cars you have closed. When a deal is won, the full Malaysian transfer checklist is created automatically so the car actually gets into the buyer\'s hands legally and on time.',
      items: [
        { label: 'Why it exists', desc: 'Selling the car is only half the job — the ownership transfer, inspections and paperwork still have to happen. This board tracks every step so nothing is forgotten and the buyer is not left waiting.' },
        { label: 'The steps', desc: 'Settle outstanding loan → buyer insurance → Puspakom B5 (RM30) → Puspakom B7 (RM60, financed cars only) → JPJ ownership transfer / pindah milik (RM100, biometric, buyer within 7 days) → road tax renewal → collect new geran → vehicle handover. Fees are official rates and editable.' },
        { label: 'Owners & status', desc: 'Each step shows who is responsible (you, a runner, the dealer, or the customer) and a status — Pending, In progress, Done, or N/A. Steps that don\'t apply (e.g. B7 on a cash car) are auto-marked N/A.' },
        { label: 'Due dates & overdue alerts', desc: 'Each step has a target date. If a step goes overdue, you get a reminder first (it is primarily your job); if it stays overdue, the dealer is alerted too. Connect your Telegram in Settings to get these pings instantly.' },
        { label: 'Your view vs dealer view', desc: 'You see the handover checklists for your own won deals. The dealer dashboard shows every salesman\'s handovers, so the owner has full visibility across the team.' },
      ],
    },
    analytics: {
      title: 'Analytics',
      body: 'The Analytics tab shows how your listings and pipeline are performing so you know what to fix and where to push.',
      items: [
        { label: 'KPI cards', desc: 'Listing Views, WhatsApp Taps, CVR (conversion rate, colour-coded), Enquiries, cars sold This Month, and Commission earned (if you have view_commission) — most with a 7-day trend.' },
        { label: 'This month strip', desc: 'Leads added, appointments booked, enquiries received, and cars sold this month at a glance.' },
        { label: 'Monthly target progress', desc: 'The same target bar as the Dashboard, repeated here for context alongside the numbers.' },
        { label: 'Top listings by views', desc: 'Your three most-viewed cars with proportional bars — a quick read on what is pulling attention.' },
        { label: 'Listing performance table', desc: 'Every car with its views, enquiries and CVR. CVR is colour-coded: green is healthy, amber is okay, red needs attention (better photos, price, or description).' },
        { label: 'Commission breakdown (gated)', desc: 'If you have view_commission, your last few sold cars are listed with the commission you earned on each.' },
      ],
    },
    commission: {
      title: 'Commission & Earnings',
      body: 'Your commission is set by the dealer, per car. You can see it in several places so there are no surprises about what a sale is worth.',
      items: [
        { label: 'How it is set', desc: 'The dealer assigns either a fixed RM amount on a specific car, or a default rule that applies to all cars — a flat amount or a percentage of the sale price. Gross-margin-based rules need cost data you are not shown, so those display as "set by dealer".' },
        { label: 'On listing cards', desc: 'Active cars show an amber "Earn RM X" badge. Once sold, the card flips to a green "Earned RM X" badge with the sale date.' },
        { label: 'On lead cards', desc: 'When a car is linked to a lead, the commission for that car shows on the pipeline card so you know the value of the deal you are working.' },
        { label: 'Dashboard & Analytics', desc: 'If your dealer has granted view_commission, a Commission KPI shows your total earned, and Analytics lists a breakdown of recent sold cars. If you don\'t see these, the permission is off — ask your manager.' },
        { label: 'Visibility', desc: 'Commission figures are only ever visible to you and your dealer/managers — never to buyers or on public pages.' },
      ],
    },
    settings: {
      title: 'Settings',
      body: 'Manage your profile, contact details, public-page content, and notifications.',
      items: [
        { label: 'Identity', desc: 'Your full name and job title (e.g. "Senior Sales Consultant"), shown on your public profile and deal sheets.' },
        { label: 'WhatsApp number', desc: 'The number buyers use to reach you from listings and deal sheets. Enter digits only — the +60 country code is handled for you.' },
        { label: 'Telegram Chat ID', desc: 'Connect Telegram to get instant pings for appointment reminders and overdue handover steps. Open Telegram, search @userinfobot, send /start, and copy the Id number into this field. A green "Connected" badge confirms it is set.' },
        { label: 'City & State', desc: 'Shown on your public profile so buyers know where you are based.' },
        { label: 'Public profile content', desc: 'An About line, a longer Bio, your typical Response Time (e.g. "Usually replies within 1 hour"), and Specializations tags — all displayed on your public salesman page.' },
        { label: 'Saving', desc: 'Tap Save Changes. A green "Saved" confirmation appears briefly; an error message shows if something went wrong.' },
      ],
    },
    faq: [
      { q: 'How is the Salesman Panel different from Salesman Lite?', a: 'Salesman Lite is a free standalone account with no dealer behind it. The Salesman Panel is for salesmen who work under a dealer on ShiftOS — it is connected live to the dealer\'s stock, leads, commission rules, handover board and team features. If you joined a dealership with an invite code, you are on the Panel.' },
      { q: 'I sold a car but I can\'t see it — where did it go?', a: 'Sold cars are hidden from the default Listings view. In the Listings tab, switch the status filter to "Sold" to see all your closed cars along with the commission you earned and the sale date.' },
      { q: 'How do I know how much commission I\'ll get on a car?', a: 'Every active listing card and every linked lead card shows the commission as an amber "Earn RM X" badge. The dealer sets this — either a fixed amount or a percentage. If a card shows no figure, the dealer uses a margin-based rule that isn\'t exposed; ask your manager for the number.' },
      { q: 'A lead won\'t move past Test Drive — is it broken?', a: 'No — advancing past Test Drive shows a confirmation asking whether the test drive actually happened. Tap "Yes, test drive done" to continue. This is a safeguard so deals aren\'t pushed forward by accident.' },
      { q: 'How do I attach a car to a lead?', a: 'Open the lead (tap ···), then tap "Link Car" (or "Change Car" if one is already attached). Search your listings and tap the car to link it. It then appears on the lead card and is pulled into any deal sheet you generate.' },
      { q: 'Can I customise the deal sheet like the dealer can?', a: 'Yes. In the lead drawer, "Customise & Generate" lets you set the down payment %, loan tenure, interest rate, optional road tax / insurance / Puspakom fees, and a personal note to the buyer before generating. The sheet carries your dealer\'s branding automatically.' },
      { q: 'Do my leads and sales show up in the dealer dashboard?', a: 'Yes — everything you do is synced live. Your owner and managers see your pipeline, bookings and sales. If you sell a car and earn commission, it appears in the dealer\'s reports too.' },
      { q: 'Why can\'t I see commission figures or other salesmen\'s leads?', a: 'Those are controlled by permissions your dealer sets: view_commission and view_all_leads. If they are off, the figures and the wider pipeline are hidden from you. Ask your manager to enable them if you need them.' },
      { q: 'What is the Handover tab for?', a: 'It is the post-sale checklist that gets the car legally transferred to the buyer — loan settlement, insurance, Puspakom, JPJ pindah milik, road tax, geran and handover. It is created automatically when a deal is won. Overdue steps ping you first, then your dealer.' },
      { q: 'How do I get Telegram reminders?', a: 'In Settings, add your Telegram Chat ID (search @userinfobot in Telegram, send /start, copy the Id). Once connected you get appointment reminders and overdue-handover pings instantly.' },
      { q: 'What does "featuring" a car mean?', a: 'In Listings → Available Inventory, "Add to my listings" features a dealer car on your profile so you can sell it. It does NOT create a lead — your pipeline stays for real buyers only. The car appears under My Listings immediately.' },
      { q: 'I need help or found a bug', a: 'WhatsApp our support line at +60174155191 or email support@xdrive.my. Please include a screenshot and your account email.' },
    ],
  },

  ms: {
    overview: {
      title: 'Apa itu Panel Jurujual?',
      body: 'Panel Jurujual adalah ruang kerja anda sebagai sebahagian daripada sebuah pusat kereta di ShiftOS. Berbeza daripada akaun Salesman Lite yang berdiri sendiri, panel ini disambungkan secara langsung kepada dealer anda — kereta yang anda jual, lead yang anda uruskan, dan deal yang anda tutup semuanya mengalir terus ke dalam papan pemuka dealer. Pemilik dan pengurus anda boleh melihat pipeline anda; anda boleh melihat stok dealer, kereta yang ditugaskan kepada anda, dan komisyen yang ditetapkan untuk setiap satu.',
      items: [
        { label: 'Disambungkan kepada dealer anda', desc: 'Sepanduk di bahagian atas Papan Pemuka anda menunjukkan nama pusat kereta dan lencana "Synced". Setiap tempahan, pertanyaan, lead dan jualan yang anda log dikongsi dengan sistem dealer secara masa nyata — tiada laporan berasingan diperlukan.' },
        { label: 'Akses stok dealer', desc: 'Dalam tab Listing anda boleh melayari Inventori Tersedia dealer dan menampilkan mana-mana kereta dalam listing anda sendiri untuk dijual. Menampilkan sebuah kereta TIDAK mencipta lead palsu — pipeline anda kekal bersih untuk pembeli sebenar sahaja.' },
        { label: 'Komisyen ditetapkan oleh dealer', desc: 'Dealer menetapkan komisyen anda setiap kereta — sama ada amaun RM tetap atau peratusan daripada jualan. Anda melihat tepat berapa yang akan anda perolehi pada setiap kereta, sebelum dan selepas jualan.' },
        { label: 'Set alat jualan lengkap', desc: 'Pipeline lead, penjana helaian deal, kalkulator pinjaman HP, peti masuk pertanyaan WhatsApp, penjadualan temujanji, senarai semak serahan pasca-jualan, dan analisis prestasi — semua di satu tempat.' },
        { label: 'Ciri AI Premium', desc: 'Jika dealer anda memasukkan anda ke dalam pelan Premium, anda membuka kunci cadangan susulan AI, draf balasan WhatsApp AI, kapsyen sosial AI, dan pemarkahan lead automatik.' },
        { label: 'Kebenaran', desc: 'Sesetengah ciri dihidupkan atau dimatikan oleh dealer anda: melihat angka komisyen (view_commission) dan melihat lead seluruh pasukan dan bukan hanya milik anda (view_all_leads). Jika sesuatu ciri tersembunyi, tanya pengurus anda.' },
      ],
    },
    dashboard: {
      title: 'Papan Pemuka',
      body: 'Papan Pemuka adalah skrin utama anda. Ia menunjukkan angka anda untuk bulan ini, apa yang perlu diberi perhatian hari ini, dan suapan langsung aktiviti terkini.',
      items: [
        { label: 'Sepanduk sambungan dealer', desc: 'Di bahagian paling atas — nama pusat kereta anda, logo, dan lencana hijau "Synced" yang mengesahkan akaun anda aktif dengan sistem dealer.' },
        { label: 'Apa yang perlu dilakukan hari ini (Premium)', desc: 'Cadangan susulan yang dijana oleh AI dan disusun mengikut keutamaan. Setiap cadangan mempunyai butang WA untuk menghantar mesej kepada pembeli dengan segera dan butang Done untuk membersihkannya setelah diambil tindakan. Ketik Generate atau Refresh untuk mendapatkan set baharu.' },
        { label: 'Kad KPI', desc: 'Pertanyaan (dengan carta mini 7 hari), Listing Aktif (dengan berapa banyak yang tersedia), Komisyen yang diperoleh (hanya jika anda mempunyai view_commission), dan Lead Aktif (menandakan berapa banyak yang sudah lapuk).' },
        { label: 'Sasaran bulanan', desc: 'Bar kemajuan yang menjejak kereta dijual bulan ini berbanding sasaran yang ditetapkan dealer untuk anda. Lencana "Target hit!" muncul apabila anda mencapainya.' },
        { label: 'Temujanji akan datang', desc: 'Tontonan dan ujian pandu yang telah ditempah. Setiap kad menunjukkan tarikh, pembeli, kereta, telefon dan nota, dengan butang untuk WhatsApp pembeli, Jadualkan Semula, Batal, atau tetapkan Peringatan (pings anda satu jam sebelumnya).' },
        { label: 'Nota pengurus', desc: 'Nota baca-sahaja yang ditinggalkan untuk anda oleh dealer atau pengurus anda muncul di sini dengan tarikhnya.' },
        { label: 'Aktiviti terkini', desc: 'Suapan kronologi tempahan terkini, pertanyaan, perubahan peringkat lead, dan jualan anda supaya anda boleh melihat dengan sekilas apa yang baru berlaku.' },
      ],
    },
    listings: {
      title: 'Listing',
      body: 'Tab Listing mempunyai dua paparan, ditukar di bahagian atas: "My Listings" (kereta yang anda jual) dan "Available Inventory" (stok dealer yang boleh anda ambil).',
      items: [
        { label: 'My Listings vs Available Inventory', desc: 'My Listings = kereta yang ditugaskan kepada anda oleh dealer ditambah dengan mana-mana yang anda telah tampilkan. Available Inventory = stok tersedia dealer yang boleh anda layari dan tambah ke listing anda.' },
        { label: 'Tambah ke listing saya', desc: 'Dalam Available Inventory, ketik "Add to my listings" pada mana-mana kereta untuk mula menjualnya. Ini menampilkan kereta pada profil anda dan listing anda tanpa mencipta lead pipeline — lead dikhaskan untuk pembeli sebenar sahaja.' },
        { label: 'Penapis status', desc: 'Tapis My Listings mengikut Semua, Tersedia, Ditempah, Belum Selesai, atau Dijual. "Semua" menunjukkan kereta aktif anda (bukan yang dijual); penapis Dijual menunjukkan kereta yang telah ditutup dengan komisyen yang anda perolehi dan tarikh jualan.' },
        { label: 'Lencana komisyen', desc: 'Setiap kereta aktif menunjukkan lencana amber "Earn RM X" supaya anda sentiasa tahu nilai setiap jualan kepada anda. Kereta yang dijual menunjukkan lencana hijau "Earned RM X" beserta tarikh. Angka ini mengikut peraturan dealer (amaun tetap atau peratusan).' },
        { label: 'Heatmap CVR', desc: 'Setiap kad mempunyai bar penukaran — pertanyaan dibahagi dengan paparan. Tag "Hot" (merah) bermakna minat yang tinggi; tag "Stale" (kelabu) bermakna banyak paparan tetapi tiada pertanyaan, petanda harga atau foto perlu diperbaiki. Layangkan tetikus untuk nombor tepat.' },
        { label: 'Butang perkongsian', desc: 'Copy Link menyalin pautan terus ke kereta. WA Caption menyalin mesej WhatsApp berformat siap (spesifikasi, harga, pautan) untuk ditampal ke dalam chat. Broadcast menghantar kereta kepada beberapa lead yang layak sekaligus (sehingga 10).' },
        { label: 'Kapsyen AI (Premium)', desc: 'Menjana kapsyen media sosial untuk WhatsApp, TikTok, Instagram atau Facebook dengan nada dan emoji yang betul. Salin atau jana semula mengikut keperluan.' },
        { label: 'Status kelulusan', desc: 'Jika anda menambah kereta yang memerlukan kelulusan pengurus, ia menunjukkan "Awaiting approval". Jika pengurus menolaknya, sebabnya muncul dalam warna merah pada kad.' },
      ],
    },
    leads: {
      title: 'Lead',
      body: 'Lead adalah pembeli sebenar yang sedang anda uruskan. Tab Lead adalah pipeline anda — papan peringkat dari kenalan pertama hingga deal tertutup. Di desktop ia adalah papan kanban; di mudah alih ia adalah senarai yang boleh ditapis.',
      items: [
        { label: 'Menambah lead', desc: 'Ketik "Add Lead" (atau butang + di mudah alih). Masukkan nama dan nombor telefon pembeli; pilihan untuk memautkan kereta, dan tambah IC, e-mel dan alamat. Lead yang anda tambah ditag kepada anda dan dikongsi dengan dealer.' },
        { label: 'Peringkat', desc: 'Baharu → Dihubungi → Tontonan Ditempah → Ujian Pandu → Berunding → Deposit Diambil → Menang. Lead yang Menang dan Kalah keluar dari papan aktif ke arkib. Gunakan butang "→ peringkat seterusnya" pada setiap kad untuk maju.' },
        { label: 'Pengesahan ujian pandu', desc: 'Apabila anda memajukan lead melepasi Ujian Pandu, pengesahan bertanya sama ada ujian pandu benar-benar berlaku. Ini mencegah deal ditanda lebih jauh secara tidak sengaja. Sahkan hanya apabila ia benar-benar berlaku.' },
        { label: 'Butang kad', desc: 'Setiap kad mempunyai: → peringkat seterusnya (maju), ikon telefon (ketik untuk menghubungi), WA (membuka mesej WhatsApp yang telah ditulis yang boleh anda edit), dan ··· (membuka laci lead penuh). Jika lead tidak mempunyai telefon dan kereta, butang "Link Car" muncul dan bukan WA.' },
        { label: 'Skor haba & AI', desc: 'Pil haba (panas/suam/sejuk) mencerminkan peringkat dan berapa lama sejak kenalan terakhir. Di Premium, lencana skor AI (HOT/WARM/COLD) menilai niat membeli; ketik Re-score dalam laci untuk menyegarkan semula.' },
        { label: 'Laci lead', desc: 'Ketik ··· untuk membuka laci sisi: butiran pembeli, log nota yang boleh diedit, Log Panggilan, Tetapkan Peringatan, Skrip, Sejarah, Pautkan/Tukar Kereta, penjana Helaian Deal, dan (Premium) penyusun balasan WhatsApp AI.' },
        { label: 'Log panggilan', desc: 'Rekod hasil panggilan — Dijawab, Tiada Jawapan, Mintak Balik, atau Mel Suara — dengan nota pilihan. Hasilnya muncul sebagai lencana pada kad lead.' },
        { label: 'Peringatan susulan', desc: 'Tetapkan tarikh susulan (Esok, dalam 2/3 hari, minggu depan, atau tarikh khas). Susulan yang tertangguh menukar kad menjadi oren dan muncul di Papan Pemuka anda supaya tiada yang terlepas.' },
        { label: 'Skrip bantahan', desc: 'Butang Skrip memberikan respons jualan Malaysia yang terbukti untuk bantahan biasa — harga terlalu tinggi, jarak tempuh tinggi, belum bersedia, perlu fikir. Salin mana-mana baris terus ke WhatsApp.' },
        { label: 'Pautkan / Tukar Kereta', desc: 'Buka laci dan ketik Link Car (atau Change Car jika sudah ada yang dilampirkan). Cari listing anda dan ketik kereta untuk memautkannya. Ia kemudian muncul pada kad lead dan dimasukkan ke dalam mana-mana helaian deal yang anda jana.' },
        { label: 'Lead lapuk', desc: 'Lead yang tiada aktiviti selama 48+ jam ditandai lapuk. Butang "X lapuk" dalam pengepala membuka alat batch WhatsApp untuk melibatkan semula mereka satu per satu.' },
        { label: 'Tandakan sebagai kalah / padam', desc: 'Dalam laci anda boleh menandakan lead sebagai kalah (pilih sebab: Harga, Masa, Pesaing, Ghost) atau memadamnya. Lead yang Kalah dipaparkan dalam akordion "Kalah" di bahagian bawah papan.' },
      ],
    },
    dealsheet: {
      title: 'Helaian Deal',
      body: 'Helaian deal adalah ringkasan satu halaman yang bersih dan berjenama yang anda hantar kepada pembeli — kereta, harga, anggaran ansuran, yuran, dan kenalan anda. Ia dijana dari dalam laci lead dan berada pada pautan yang boleh dikongsi yang sah selama 24 jam.',
      items: [
        { label: 'Cara menemuinya', desc: 'Buka mana-mana lead yang mempunyai kereta yang dipautkan, kemudian dalam laci ketik "Customise & Generate" di bawah Deal Sheet. Jika tiada kereta dipautkan butang berbunyi "Link a car first" — pautkan satu untuk meneruskan.' },
        { label: 'Sesuaikan: Pembiayaan HP', desc: 'Tetapkan peratusan bayaran pendahuluan, tempoh pinjaman (3, 5, 7 atau 9 tahun), dan kadar faedah rata. Helaian mengira anggaran ansuran bulanan, jumlah faedah dan jumlah bayaran balik untuk pembeli.' },
        { label: 'Sesuaikan: yuran & pendaftaran', desc: 'Pilihan untuk menambah amaun cukai jalan, insurans dan Puspakom. Apa yang anda masukkan ditambah ke dalam jumlah di jalan yang ditunjukkan pada helaian. Biarkan kosong untuk mengecualikan.' },
        { label: 'Nota kepada pembeli', desc: 'Tambah nota peribadi yang ringkas — cth. "Tawaran sah hujung minggu ini sahaja" atau "Servis pertama percuma termasuk". Ia dirender sebagai blok yang diserlahkan pada helaian yang pembeli lihat.' },
        { label: 'Penjenamaan', desc: 'Helaian secara automatik membawa nama dealer anda, logo, warna jenama dan penafian, dengan nama anda dan WhatsApp sebagai kenalan. Kualitinya serupa dengan helaian yang dijana oleh dealer.' },
        { label: 'Tambahan', desc: 'Sebarang produk tambahan F&I yang sudah dilampirkan pada deal disenaraikan secara automatik dengan harga dan dimasukkan ke dalam jumlah.' },
        { label: 'Perkongsian', desc: 'Selepas menjana, anda mendapat pautan dengan Salin, Pratonton (membuka helaian dalam tab baharu), dan Hantar melalui WA (membuka WhatsApp kepada pembeli dengan pautan). Ketik Baharu untuk menjana semula dengan tetapan yang berbeza.' },
        { label: 'Tamat tempoh', desc: 'Setiap pautan sah selama 24 jam. Jika pembeli membuka pautan yang tamat tempoh mereka melihat mesej mesra "minta pautan baharu" — hanya jana pautan baharu.' },
      ],
    },
    enquiries: {
      title: 'Pertanyaan',
      body: 'Tab Pertanyaan mengumpul pembeli yang menghubungi melalui XDrive, ditambah permintaan temujanji. Lencana merah pada tab menunjukkan pertanyaan baharu ditambah tempahan yang menunggu.',
      items: [
        { label: 'Pertanyaan', desc: 'Apabila pembeli mengetik WhatsApp pada salah satu listing XDrive anda, ia ditangkap di sini dengan nama, nombor telefon, kereta, dan mesej mereka. Status menunjukkan baharu atau dijawab.' },
        { label: 'Templat balasan pantas', desc: 'Templat satu ketik — "Berminat? Jom berbual", "Tempah ujian pandu", "Rundingan harga", "Deposit untuk menempah" — salin teks dan buka WhatsApp kepada pembeli.' },
        { label: 'Balasan AI (Premium)', desc: 'Jana respons yang disesuaikan kepada soalan khusus pembeli, kemudian salin atau hantarnya melalui WhatsApp.' },
        { label: 'Temujanji / tempahan', desc: 'Permintaan ujian pandu dan tontonan dari XDrive muncul di sini. Sahkan, Jadualkan Semula atau Batalkan dari kad. Butang WA menghantar mesej pengesahan, dan butang Peringatan membunyikan anda satu jam sebelum. Tempahan yang disahkan juga muncul di Papan Pemuka anda.' },
      ],
    },
    loans: {
      title: 'Pinjaman',
      body: 'Tab Pinjaman adalah alat set sewa-beli: bandingkan kadar bank untuk pembeli, kemudian hantar dan jejak permohonan pinjaman.',
      items: [
        { label: 'Kalkulator perbandingan bank', desc: 'Masukkan harga kereta, bayaran pendahuluan, tempoh dan (pilihan) pendapatan bulanan pembeli. Jadual membandingkan bank-bank utama Malaysia secara sebelah-menyebelah — kadar, bayaran bulanan, jumlah faedah dan jumlah yang perlu dibayar — dan menyerlahkan pilihan bulanan yang paling murah.' },
        { label: 'Pilih bank', desc: 'Ketik Pilih pada mana-mana baris bank untuk membawa kadar dan syaratnya terus ke dalam borang permohonan di bawah.' },
        { label: 'Borang permohonan', desc: 'Tangkap pembeli (nama, telefon, IC, jenis pekerjaan, pendapatan), kereta (model, harga, bayaran pendahuluan), dan pinjaman (bank, amaun, kadar, tempoh). Bayaran bulanan dikira secara automatik. Tambah nota jika perlu, kemudian Hantar Permohonan.' },
        { label: 'Permohonan saya', desc: 'Jadual setiap pinjaman yang telah anda hantar dengan pembeli, kereta, bank, amaun, bulanan, status dan tarikh. Edit baris untuk mengemas kini statusnya (Dihantar, Belum Selesai, Diluluskan, Ditolak) atau padamkannya.' },
      ],
    },
    handover: {
      title: 'Serahan',
      body: 'Tab Serahan adalah senarai semak pasca-jualan untuk kereta yang telah anda tutup. Apabila deal menang, senarai semak pemindahan Malaysia yang lengkap dicipta secara automatik supaya kereta benar-benar berpindah tangan kepada pembeli secara sah dan tepat pada masanya.',
      items: [
        { label: 'Mengapa ia wujud', desc: 'Menjual kereta hanyalah separuh kerja — pemindahan pemilikan, pemeriksaan dan urusan dokumen masih perlu dilakukan. Papan ini menjejak setiap langkah supaya tiada yang terlupakan dan pembeli tidak tertangguh.' },
        { label: 'Langkah-langkah', desc: 'Selesaikan pinjaman tertunggak → insurans pembeli → Puspakom B5 (RM30) → Puspakom B7 (RM60, kereta berfinans sahaja) → JPJ pemindahan pemilikan / pindah milik (RM100, biometrik, pembeli dalam 7 hari) → pembaharuan cukai jalan → kutip geran baharu → serahan kenderaan. Yuran adalah kadar rasmi dan boleh diedit.' },
        { label: 'Pemilik & status', desc: 'Setiap langkah menunjukkan siapa yang bertanggungjawab (anda, penghantar, dealer, atau pelanggan) dan status — Belum Selesai, Sedang Berjalan, Selesai, atau T/B. Langkah yang tidak berkenaan (cth. B7 pada kereta tunai) ditanda T/B secara automatik.' },
        { label: 'Tarikh akhir & amaran lewat', desc: 'Setiap langkah mempunyai tarikh sasaran. Jika langkah melepasi tarikh, anda mendapat peringatan dahulu (ini terutamanya kerja anda); jika ia kekal lewat, dealer juga diberitahu. Sambungkan Telegram anda dalam Tetapan untuk mendapat pings ini dengan segera.' },
        { label: 'Paparan anda vs paparan dealer', desc: 'Anda melihat senarai semak serahan untuk deal menang anda sendiri. Papan pemuka dealer menunjukkan serahan semua jurujual, supaya pemilik mempunyai keterlihatan penuh merentasi pasukan.' },
      ],
    },
    analytics: {
      title: 'Analisis',
      body: 'Tab Analisis menunjukkan prestasi listing dan pipeline anda supaya anda tahu apa yang perlu diperbaiki dan di mana perlu ditolak.',
      items: [
        { label: 'Kad KPI', desc: 'Paparan Listing, Ketik WhatsApp, CVR (kadar penukaran, berwarna), Pertanyaan, kereta dijual Bulan Ini, dan Komisyen yang diperoleh (jika anda mempunyai view_commission) — kebanyakannya dengan trend 7 hari.' },
        { label: 'Strip bulan ini', desc: 'Lead yang ditambah, temujanji yang ditempah, pertanyaan yang diterima, dan kereta yang dijual bulan ini secara sekilas pandang.' },
        { label: 'Kemajuan sasaran bulanan', desc: 'Bar sasaran yang sama seperti Papan Pemuka, diulang di sini untuk konteks bersama dengan angka-angka.' },
        { label: 'Listing teratas mengikut paparan', desc: 'Tiga kereta anda yang paling banyak dilihat dengan bar perkadaran — bacaan pantas tentang apa yang menarik perhatian.' },
        { label: 'Jadual prestasi listing', desc: 'Setiap kereta dengan paparan, pertanyaan dan CVR-nya. CVR berwarna: hijau sihat, amber okay, merah perlukan perhatian (foto, harga, atau penerangan yang lebih baik).' },
        { label: 'Pecahan komisyen (terhad)', desc: 'Jika anda mempunyai view_commission, beberapa kereta yang telah dijual disenaraikan dengan komisyen yang anda perolehi pada setiap satu.' },
      ],
    },
    commission: {
      title: 'Komisyen & Pendapatan',
      body: 'Komisyen anda ditetapkan oleh dealer, setiap kereta. Anda boleh melihatnya di beberapa tempat supaya tiada kejutan tentang nilai sebuah jualan.',
      items: [
        { label: 'Cara ia ditetapkan', desc: 'Dealer menetapkan sama ada amaun RM tetap pada kereta tertentu, atau peraturan lalai yang terpakai pada semua kereta — amaun rata atau peratusan daripada harga jualan. Peraturan berasaskan margin kasar memerlukan data kos yang tidak ditunjukkan kepada anda, jadi ia dipaparkan sebagai "ditetapkan oleh dealer".' },
        { label: 'Pada kad listing', desc: 'Kereta aktif menunjukkan lencana amber "Earn RM X". Setelah dijual, kad bertukar kepada lencana hijau "Earned RM X" dengan tarikh jualan.' },
        { label: 'Pada kad lead', desc: 'Apabila kereta dipautkan kepada lead, komisyen untuk kereta itu muncul pada kad pipeline supaya anda tahu nilai deal yang sedang anda kerjakan.' },
        { label: 'Papan Pemuka & Analisis', desc: 'Jika dealer anda telah memberikan kebenaran view_commission, KPI Komisyen menunjukkan jumlah yang diperoleh, dan Analisis menyenaraikan pecahan kereta terjual terkini. Jika anda tidak melihatnya, kebenaran dimatikan — tanya pengurus anda.' },
        { label: 'Keterlihatan', desc: 'Angka komisyen hanya boleh dilihat oleh anda dan dealer/pengurus anda — tidak pernah kepada pembeli atau pada halaman awam.' },
      ],
    },
    settings: {
      title: 'Tetapan',
      body: 'Urus profil, butiran kenalan, kandungan halaman awam, dan notifikasi anda.',
      items: [
        { label: 'Identiti', desc: 'Nama penuh dan jawatan anda (cth. "Perunding Jualan Kanan"), ditunjukkan pada profil awam dan helaian deal anda.' },
        { label: 'Nombor WhatsApp', desc: 'Nombor yang pembeli gunakan untuk menghubungi anda dari listing dan helaian deal. Masukkan digit sahaja — kod negara +60 diuruskan untuk anda.' },
        { label: 'ID Chat Telegram', desc: 'Sambungkan Telegram untuk mendapat pings segera bagi peringatan temujanji dan langkah serahan yang tertunggak. Buka Telegram, cari @userinfobot, hantar /start, dan salin nombor Id ke dalam medan ini. Lencana hijau "Connected" mengesahkan ia telah ditetapkan.' },
        { label: 'Bandar & Negeri', desc: 'Ditunjukkan pada profil awam anda supaya pembeli tahu di mana anda berada.' },
        { label: 'Kandungan profil awam', desc: 'Baris Tentang, Bio yang lebih panjang, Masa Respons biasa anda (cth. "Biasanya membalas dalam 1 jam"), dan tag Pengkhususan — semua dipaparkan pada halaman jurujual awam anda.' },
        { label: 'Sasaran jualan bulanan', desc: 'Tetapkan bilangan kereta yang anda ingin jual setiap bulan. Papan Pemuka dan Analisis memaparkan kemajuan anda berbanding sasaran ini.' },
        { label: 'Menyimpan', desc: 'Ketik Simpan Perubahan. Pengesahan hijau "Disimpan" muncul sebentar; mesej ralat muncul jika ada yang tidak kena.' },
      ],
    },
    faq: [
      { q: 'Apa perbezaan Panel Jurujual dengan Salesman Lite?', a: 'Salesman Lite adalah akaun percuma berdiri sendiri tanpa dealer di belakangnya. Panel Jurujual adalah untuk jurujual yang bekerja di bawah dealer di ShiftOS — ia disambungkan secara langsung kepada stok dealer, lead, peraturan komisyen, papan serahan dan ciri pasukan. Jika anda menyertai pusat kereta dengan kod jemputan, anda berada di Panel.' },
      { q: 'Saya telah menjual kereta tetapi tidak dapat melihatnya — di mana ia pergi?', a: 'Kereta yang telah dijual disembunyikan dari paparan Listing lalai. Dalam tab Listing, tukar penapis status kepada "Sold" untuk melihat semua kereta yang telah ditutup bersama komisyen yang anda perolehi dan tarikh jualan.' },
      { q: 'Bagaimana saya tahu berapa komisyen yang akan saya dapat pada sebuah kereta?', a: 'Setiap kad listing aktif dan setiap kad lead yang dipautkan menunjukkan komisyen sebagai lencana amber "Earn RM X". Dealer menetapkan ini — sama ada amaun tetap atau peratusan. Jika kad tidak menunjukkan angka, dealer menggunakan peraturan berasaskan margin yang tidak dedahkan; tanya pengurus anda untuk angka tersebut.' },
      { q: 'Lead tidak boleh bergerak melepasi Ujian Pandu — adakah ia rosak?', a: 'Tidak — memajukan melepasi Ujian Pandu menunjukkan pengesahan yang bertanya sama ada ujian pandu benar-benar berlaku. Ketik "Yes, test drive done" untuk meneruskan. Ini adalah perlindungan supaya deal tidak ditolak ke hadapan secara tidak sengaja.' },
      { q: 'Bagaimana saya melampirkan kereta kepada lead?', a: 'Buka lead (ketik ···), kemudian ketik "Link Car" (atau "Change Car" jika sudah ada yang dilampirkan). Cari listing anda dan ketik kereta untuk memautkannya. Ia kemudian muncul pada kad lead dan dimasukkan ke dalam mana-mana helaian deal yang anda jana.' },
      { q: 'Bolehkah saya menyesuaikan helaian deal seperti dealer boleh?', a: 'Ya. Dalam laci lead, "Customise & Generate" membolehkan anda menetapkan peratusan bayaran pendahuluan, tempoh pinjaman, kadar faedah, cukai jalan / insurans / yuran Puspakom pilihan, dan nota peribadi kepada pembeli sebelum menjana. Helaian membawa penjenamaan dealer anda secara automatik.' },
      { q: 'Adakah lead dan jualan saya muncul dalam papan pemuka dealer?', a: 'Ya — semua yang anda lakukan disegerakkan secara langsung. Pemilik dan pengurus anda melihat pipeline, tempahan dan jualan anda. Jika anda menjual kereta dan memperoleh komisyen, ia muncul dalam laporan dealer juga.' },
      { q: 'Mengapa saya tidak dapat melihat angka komisyen atau lead jurujual lain?', a: 'Ia dikawal oleh kebenaran yang ditetapkan dealer anda: view_commission dan view_all_leads. Jika ia dimatikan, angka dan pipeline yang lebih luas disembunyikan dari anda. Tanya pengurus anda untuk mengaktifkannya jika anda memerlukannya.' },
      { q: 'Apakah fungsi tab Serahan?', a: 'Ia adalah senarai semak pasca-jualan yang memindahkan kereta secara sah kepada pembeli — penyelesaian pinjaman, insurans, Puspakom, JPJ pindah milik, cukai jalan, geran dan serahan. Ia dicipta secara automatik apabila deal menang. Langkah yang tertunggak memberi pings kepada anda dahulu, kemudian dealer anda.' },
      { q: 'Bagaimana saya mendapatkan peringatan Telegram?', a: 'Dalam Tetapan, tambah ID Chat Telegram anda (cari @userinfobot dalam Telegram, hantar /start, salin Id). Setelah disambungkan anda mendapat peringatan temujanji dan pings serahan tertunggak dengan segera.' },
      { q: 'Apakah maksud "menampilkan" sebuah kereta?', a: 'Dalam Listing → Available Inventory, "Add to my listings" menampilkan kereta dealer pada profil anda supaya anda boleh menjualnya. Ia TIDAK mencipta lead — pipeline anda adalah untuk pembeli sebenar sahaja. Kereta muncul di bawah My Listings dengan segera.' },
      { q: 'Saya memerlukan bantuan atau menemui pepijat', a: 'WhatsApp talian sokongan kami di +60174155191 atau e-mel support@xdrive.my. Sila sertakan tangkapan skrin dan e-mel akaun anda.' },
    ],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionContent({ data, isFaq }) {
  const [openIdx, setOpenIdx] = useState(null);
  if (isFaq) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((item, i) => (
          <div
            key={i}
            style={{ ...CARD, border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1, lineHeight: 1.4 }}>{item.q}</p>
              {openIdx === i
                ? <ChevronUp size={16} color="#6b7280" style={{ flexShrink: 0 }} />
                : <ChevronDown size={16} color="#6b7280" style={{ flexShrink: 0 }} />}
            </div>
            {openIdx === i && (
              <div style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.items.map((item, i) => (
        <div key={i} style={{ ...CARD, padding: '14px 18px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{item.label}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SalesmanPanelHelp() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('ms') ? 'ms' : 'en';
  const [active, setActive] = useState('overview');

  // Per-section fallback to English while the Bahasa Malaysia pass is in progress.
  const sectionData = CONTENT[lang]?.[active] ?? CONTENT.en[active];
  const section = SECTIONS.find(s => s.key === active);
  const sectionLabel = lang === 'ms' ? section.ms : section.en;
  const isFaq = active === 'faq';

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar nav (desktop) ── */}
      <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 20, display: 'none' }} className="sph-sidebar">
        <style>{`
          @media (min-width: 768px) { .sph-sidebar { display: block !important; } .sph-topnav { display: none !important; } }
        `}</style>
        <div style={{ ...CARD, padding: '8px' }}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const label = lang === 'ms' ? s.ms : s.en;
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(220,38,38,0.12)' : 'transparent',
                  color: isActive ? '#f87171' : '#6b7280',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  textAlign: 'left', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Top scrollable nav (mobile) */}
        <div
          className="sph-topnav"
          style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 16,
            scrollbarWidth: 'none',
          }}
        >
          {SECTIONS.map(s => {
            const label = lang === 'ms' ? s.ms : s.en;
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 99, border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 400, fontFamily: 'inherit',
                  background: isActive ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#f87171' : '#6b7280',
                  border: `1px solid ${isActive ? 'rgba(220,38,38,0.35)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Section header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
            {isFaq ? sectionLabel : sectionData.title}
          </h2>
          {!isFaq && (
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.65, maxWidth: 640 }}>
              {sectionData.body}
            </p>
          )}
        </div>

        {/* Section body */}
        <SectionContent data={sectionData} isFaq={isFaq} />

        {/* Support footer */}
        <div style={{ marginTop: 32, padding: '16px 18px', ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
              {lang === 'ms' ? 'Masih perlukan bantuan?' : 'Still need help?'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
              {lang === 'ms' ? 'WhatsApp sokongan kami terus.' : 'WhatsApp our support team directly.'}
            </p>
          </div>
          <a
            href="https://wa.me/60174155191?text=Hi%2C%20I%20need%20help%20with%20the%20ShiftOS%20Salesman%20Panel"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0, padding: '8px 18px', borderRadius: 9, background: '#16a34a',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            {lang === 'ms' ? 'WhatsApp Kami' : 'WhatsApp Us'}
          </a>
        </div>
      </div>
    </div>
  );
}
