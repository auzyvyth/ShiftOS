import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid, Car, User, MessageSquare, BarChart2, GitMerge,
  Settings, ChevronDown, ChevronUp, CheckCircle2, BookOpen,
} from 'lucide-react';

// ─── Shared styles ────────────────────────────────────────────────────────────
const CARD = {
  background: '#0d1117',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  overflow: 'hidden',
};

const SECTIONS = [
  { key: 'overview',     icon: BookOpen,      en: 'Overview',          ms: 'Gambaran Keseluruhan' },
  { key: 'dashboard',    icon: LayoutGrid,    en: 'Dashboard',         ms: 'Papan Pemuka' },
  { key: 'listings',     icon: Car,           en: 'Listings',          ms: 'Listing' },
  { key: 'leads',        icon: User,          en: 'Leads',             ms: 'Lead' },
  { key: 'inbox',        icon: MessageSquare, en: 'Inbox',             ms: 'Peti Masuk' },
  { key: 'performance',  icon: BarChart2,     en: 'Performance',       ms: 'Prestasi' },
  { key: 'merge',        icon: GitMerge,      en: 'Join Dealership',   ms: 'Sertai Pengedar' },
  { key: 'settings',     icon: Settings,      en: 'Settings',          ms: 'Tetapan' },
  { key: 'faq',          icon: CheckCircle2,  en: 'FAQ',               ms: 'Soal Jawab' },
];

// ─── Content ──────────────────────────────────────────────────────────────────
const CONTENT = {
  en: {
    overview: {
      title: 'What is Salesman Lite?',
      body: `Salesman Lite is a free personal CRM and marketplace tool built for independent car salesmen in Malaysia. It gives you a public profile on XDrive, a lead pipeline, and a listings manager — all in one place, at no cost.`,
      items: [
        { label: 'Your public storefront', desc: 'Every listing you publish appears on xdrive.my and on your personal profile link (xdrive.my/s/your-slug). Buyers can WhatsApp you directly from any listing.' },
        { label: 'Lead pipeline', desc: 'Track every buyer from first contact to won deal. Add notes, follow-up dates, appointments, and AI-generated objection scripts.' },
        { label: 'Inbox', desc: 'XDrive buyers who tap WhatsApp on your listing appear as Enquiries. Appointment requests show under Bookings.' },
        { label: 'Performance stats', desc: 'See your close rate, funnel drop-off, and weekly activity so you know where to focus.' },
        { label: 'Join a dealership', desc: 'If you work with a dealer on ShiftOS, enter their invite code to merge your account. Your listings and leads carry over.' },
      ],
    },
    dashboard: {
      title: 'Dashboard',
      body: 'The Dashboard is the first thing you see after logging in. It shows your key numbers at a glance and flags anything that needs attention today.',
      items: [
        { label: 'KPI cards', desc: 'Pipeline — active leads not yet won or lost. Live Listings — cars currently published as Available. Follow-ups — leads with a follow-up date set to today. Appointments — viewings/test drives scheduled for today. Closed — leads marked won or lost this month.' },
        { label: "Today's Agenda", desc: "Cards showing today's appointments, due follow-ups, and stale leads (no contact in 5+ days). Tap any item to open the lead directly." },
        { label: 'Monthly goal', desc: 'Set a unit or revenue target for the month. The progress bar updates as you close deals.' },
        { label: 'Performance snapshot', desc: 'Your top-performing listing by views and WhatsApp taps, plus overall conversion rate across all listings.' },
        { label: 'Get Started checklist', desc: 'Shown for new accounts until dismissed. Three steps: add your first listing, share the link, track your leads.' },
      ],
    },
    listings: {
      title: 'Listings',
      body: 'Your listings are the cars you publish to XDrive. Each published listing is live on the marketplace and on your profile link.',
      items: [
        { label: 'Adding a listing', desc: 'Tap "+ Add Listing" at the top of the Listings tab. The form walks you through brand, model, year, price, mileage, condition, photos, and extras. Photos are the most important thing — upload at least 3 clear shots.' },
        { label: 'Quick List', desc: 'For a fast publish, use Quick List. Fill in brand, model, year, and price — the listing goes live immediately as a draft you can complete later.' },
        { label: 'Status', desc: 'Available — visible on XDrive. Reserved — hidden from search, visible by direct link (use for deposit taken). Sold — archived from listings, marked as closed.' },
        { label: 'Sharing your listing', desc: 'Each listing has a Share button that copies a direct link. Paste it in WhatsApp groups, Facebook posts, or your TikTok bio to drive traffic.' },
        { label: 'Commission field', desc: 'You can record a commission amount per listing. This is private and only visible to you.' },
        { label: 'Boost (coming soon)', desc: 'Boost pins your listing to the top of XDrive search for 7 days. Join the waitlist from the listing card.' },
      ],
    },
    leads: {
      title: 'Leads',
      body: 'A lead is a real buyer you are actively working with. Every lead has a stage, a car linked to it, and a full activity log.',
      items: [
        { label: 'Adding a lead', desc: 'Tap "Add Lead" in the header or the + button on mobile. Enter the buyer\'s name and phone. You can optionally link a listing, add their IC, email, and address.' },
        { label: 'Lead stages', desc: 'New → Contacted → Viewing Booked → Test Drive → Negotiating → Deposit Taken → Won / Lost. Drag or tap a lead to update its stage. Won and Lost leads are archived from the active pipeline.' },
        { label: 'Lead drawer', desc: 'Tap any lead card to open the detail drawer. Inside: buyer details, notes log, follow-up date picker, appointment scheduler, AI objection scripts, and deal history.' },
        { label: 'AI Playbook', desc: 'In the lead drawer, tap the Playbook tab. Select the buyer\'s objection (price too high, high mileage, not ready, trust issues) and get proven response scripts you can adapt.' },
        { label: 'Follow-up dates', desc: 'Set a follow-up date on any lead. It appears in your Dashboard Agenda on the due day so you never forget a follow-up.' },
        { label: 'Stale leads alert', desc: 'Leads with no activity in 5 or more days are flagged as stale. They appear as a warning card on your Dashboard and in the Leads tab.' },
        { label: 'Linking a car', desc: 'Open the lead drawer and search for a listing to link. The car name then appears on the lead card and is included when generating a deal sheet.' },
      ],
    },
    inbox: {
      title: 'Inbox',
      body: 'Inbox has two sub-tabs: Enquiries and Bookings.',
      items: [
        { label: 'Enquiries', desc: 'When a buyer taps WhatsApp on your XDrive listing, their message is captured as an enquiry here. You can reply via WhatsApp or convert the enquiry to a lead with one tap.' },
        { label: 'Converting to lead', desc: 'Open any enquiry and tap "Add to Leads". The buyer\'s name, phone, and the linked car carry over automatically. You\'ll only need to set the stage.' },
        { label: 'Bookings', desc: 'Viewing and test drive appointment requests from XDrive appear here. Accept, reschedule, or cancel directly from the card. Accepted bookings also appear in your Dashboard Agenda.' },
        { label: 'Notification badge', desc: 'The red badge on the Inbox tab shows unread enquiries plus new booking requests. It resets when you open the relevant sub-tab.' },
      ],
    },
    performance: {
      title: 'Performance',
      body: 'The Performance tab shows your sales funnel and activity metrics so you can spot where deals are dropping off.',
      items: [
        { label: 'Close rate', desc: 'Won leads ÷ all closed leads (won + lost). A healthy close rate for car sales is 20–40%. Below 20% usually means follow-up cadence needs work.' },
        { label: 'Funnel breakdown', desc: 'Bar chart showing how many leads are at each stage. A large drop between Viewing and Test Drive usually means the car presentation needs work. A drop between Test Drive and Negotiating usually means a pricing or trust issue.' },
        { label: 'This month vs last month', desc: 'New leads, conversions, and activity compared to the previous 30 days so you can track momentum.' },
        { label: 'Weekly activity chart', desc: 'Taps, notes added, and stage changes over the past 7 days. Useful for identifying days when you\'re most productive.' },
      ],
    },
    merge: {
      title: 'Join a Dealership',
      body: 'If you work under a dealer who uses ShiftOS, merging your account connects you to their system. You get access to their stock, their lead pipeline, and their team features.',
      items: [
        { label: 'Getting an invite code', desc: 'Ask your dealer or manager for an invite code. It looks like DEALER-XXXX. Codes are generated from the dealer\'s Team tab.' },
        { label: 'Entering the code', desc: 'Go to the Join Dealership tab, paste the code, and tap Submit. Your account is linked immediately.' },
        { label: 'After merging', desc: 'You\'ll be redirected to the full Salesman Panel, which has access to the dealer\'s stock, leads assigned to you, and team commission reports. Your existing listings and leads carry over.' },
        { label: 'Note', desc: 'Merging is permanent per account. If you need to unlink, contact your dealer or ShiftOS support.' },
      ],
    },
    settings: {
      title: 'Settings',
      body: 'Manage your profile, photo, contact details, and language preference.',
      items: [
        { label: 'Profile photo', desc: 'Tap "Change photo" to upload a profile picture. This photo appears on your public profile page and on your listings.' },
        { label: 'WhatsApp number', desc: 'Your WhatsApp number is what buyers use to contact you from listings. Enter digits only — the Malaysia (+60) country code is added automatically.' },
        { label: 'Username / Slug', desc: 'Your slug is your public profile URL: xdrive.my/s/your-slug. It\'s set during onboarding. Contact support to change it.' },
        { label: 'State & City', desc: 'Shown on your profile page. Helps buyers know where you\'re based.' },
        { label: 'IC Number', desc: 'Required for account verification. It is never shown publicly and is only accessible to ShiftOS admins.' },
        { label: 'Language', desc: 'Toggle between English and Bahasa Malaysia. The entire dashboard switches language instantly.' },
        { label: 'Telegram notifications', desc: 'Connect your Telegram Chat ID to receive instant alerts for new enquiries and bookings. Instructions are in the Settings page.' },
      ],
    },
    faq: [
      { q: 'Is Salesman Lite really free?', a: 'Yes — forever. There is no credit card required, no trial period, and no hidden charges. We make money from dealer subscriptions, not from salesman accounts.' },
      { q: 'How do buyers find my listings?', a: 'Your listings are published on xdrive.my, which is publicly searchable. Buyers can also reach your listings through your personal profile link (xdrive.my/s/your-slug), which you share on WhatsApp, social media, or your TikTok bio.' },
      { q: 'What happens to my data if I join a dealership?', a: 'Your listings and leads carry over to the dealer\'s system. The dealer\'s owner and managers can see your leads and pipeline. Nothing is deleted — it just becomes shared within the team.' },
      { q: 'Can I have more than one account?', a: 'No — one account per email address. If you need to switch between a solo account and a dealership, use the Join Dealership flow.' },
      { q: 'How do I get my public profile link?', a: 'Your link is xdrive.my/s/[your-slug]. Your slug is shown in the Settings tab under "Username / Slug". Copy and share it anywhere.' },
      { q: 'How many listings can I have?', a: 'Up to 10 active (Available status) listings on Salesman Lite. Listings in Reserved or Sold status don\'t count towards the limit.' },
      { q: 'I got an enquiry — what do I do?', a: 'Go to Inbox → Enquiries. Open the enquiry, tap the WhatsApp button to reply to the buyer, then tap "Add to Leads" to track the deal in your pipeline.' },
      { q: 'What does stale lead mean?', a: 'A lead is stale if no activity (note, stage change, follow-up, appointment) has been logged in 5 or more days. It\'s a reminder that the buyer may be going cold. Follow up immediately.' },
      { q: 'Can buyers book test drives through XDrive?', a: 'Yes. Listings on XDrive have a booking button. Requests come into your Inbox → Bookings tab. You accept, reschedule, or cancel from there.' },
      { q: 'I need help or found a bug', a: 'WhatsApp our support line at +60174155191 or email support@xdrive.my. Please include a screenshot and your account email.' },
    ],
  },

  ms: {
    overview: {
      title: 'Apa itu Salesman Lite?',
      body: 'Salesman Lite adalah CRM peribadi dan alat marketplace percuma yang dibina khas untuk jurujual kereta bebas di Malaysia. Ia memberikan anda profil awam di XDrive, saluran lead, dan pengurus listing — semuanya dalam satu tempat, tanpa sebarang kos.',
      items: [
        { label: 'Halaman profil awam anda', desc: 'Setiap listing yang anda terbit akan muncul di xdrive.my dan pada pautan profil peribadi anda (xdrive.my/s/slug-anda). Pembeli boleh WhatsApp anda terus dari mana-mana listing.' },
        { label: 'Saluran lead', desc: 'Jejaki setiap pembeli dari hubungan pertama hingga deal menang. Tambah nota, tarikh susulan, temujanji, dan skrip bantahan yang dijana oleh AI.' },
        { label: 'Peti Masuk', desc: 'Pembeli XDrive yang mengetuk WhatsApp pada listing anda akan muncul sebagai Pertanyaan. Permintaan temujanji ditunjukkan di bawah Tempahan.' },
        { label: 'Statistik prestasi', desc: 'Lihat kadar tutup anda, kejatuhan corong, dan aktiviti mingguan supaya anda tahu di mana hendak fokus.' },
        { label: 'Sertai pengedar', desc: 'Jika anda bekerja dengan pengedar di ShiftOS, masukkan kod jemputan mereka untuk menggabungkan akaun anda. Listing dan lead anda akan dibawa bersama.' },
      ],
    },
    dashboard: {
      title: 'Papan Pemuka',
      body: 'Papan Pemuka adalah perkara pertama yang anda lihat selepas log masuk. Ia menunjukkan nombor utama anda secara sepintas lalu dan menanda apa sahaja yang memerlukan perhatian hari ini.',
      items: [
        { label: 'Kad KPI', desc: 'Pipeline — lead aktif yang belum menang atau kalah. Listing Aktif — kereta yang kini diterbitkan sebagai Tersedia. Follow-up — lead dengan tarikh susulan hari ini. Temujanji — lawatan/ujian pandu yang dijadualkan hari ini. Ditutup — lead yang ditanda menang atau kalah bulan ini.' },
        { label: 'Agenda Hari Ini', desc: 'Kad yang menunjukkan temujanji hari ini, susulan yang perlu dibuat, dan lead basi (tiada hubungan dalam 5+ hari). Ketik mana-mana item untuk membuka lead secara terus.' },
        { label: 'Sasaran bulanan', desc: 'Tetapkan sasaran unit atau pendapatan untuk bulan ini. Bar kemajuan dikemas kini apabila anda menutup deal.' },
        { label: 'Petikan prestasi', desc: 'Listing terbaik anda mengikut paparan dan ketukan WhatsApp, serta kadar penukaran keseluruhan untuk semua listing.' },
        { label: 'Senarai semak Mula', desc: 'Ditunjukkan untuk akaun baru sehingga ditolak. Tiga langkah: tambah listing pertama anda, kongsi pautan, jejaki lead anda.' },
      ],
    },
    listings: {
      title: 'Listing',
      body: 'Listing anda adalah kereta yang anda terbitkan ke XDrive. Setiap listing yang diterbitkan adalah langsung di marketplace dan pada pautan profil anda.',
      items: [
        { label: 'Menambah listing', desc: 'Ketik "+ Tambah Listing" di bahagian atas tab Listing. Borang akan membimbing anda melalui jenama, model, tahun, harga, perbatuan, keadaan, foto, dan tambahan. Foto adalah perkara terpenting — muat naik sekurang-kurangnya 3 gambar yang jelas.' },
        { label: 'Senarai Pantas', desc: 'Untuk penerbitan cepat, gunakan Senarai Pantas. Isi jenama, model, tahun, dan harga — listing akan langsung hidup sebagai draf yang boleh anda lengkapkan kemudian.' },
        { label: 'Status', desc: 'Tersedia — kelihatan di XDrive. Ditempah — tersembunyi dari carian, kelihatan melalui pautan terus (gunakan apabila deposit telah diambil). Dijual — diarkibkan dari listing, ditanda sebagai ditutup.' },
        { label: 'Berkongsi listing anda', desc: 'Setiap listing mempunyai butang Kongsi yang menyalin pautan terus. Tampalkannya dalam kumpulan WhatsApp, posting Facebook, atau bio TikTok anda untuk menarik trafik.' },
        { label: 'Medan komisen', desc: 'Anda boleh merekod jumlah komisen bagi setiap listing. Ini adalah peribadi dan hanya kelihatan kepada anda.' },
        { label: 'Boost (akan datang)', desc: 'Boost meletakkan listing anda di bahagian teratas carian XDrive selama 7 hari. Sertai senarai menunggu dari kad listing.' },
      ],
    },
    leads: {
      title: 'Lead',
      body: 'Lead adalah pembeli sebenar yang sedang anda uruskan secara aktif. Setiap lead mempunyai peringkat, kereta yang dikaitkan dengannya, dan log aktiviti penuh.',
      items: [
        { label: 'Menambah lead', desc: 'Ketik "Tambah Lead" di header atau butang + pada mudah alih. Masukkan nama dan nombor telefon pembeli. Anda boleh memilih untuk mengaitkan listing, menambah IC, e-mel, dan alamat mereka.' },
        { label: 'Peringkat lead', desc: 'Baru → Dihubungi → Lawatan Ditempah → Ujian Pandu → Berunding → Deposit Diambil → Menang / Kalah. Seret atau ketik lead untuk mengemas kini peringkatnya. Lead Menang dan Kalah diarkibkan dari saluran aktif.' },
        { label: 'Laci lead', desc: 'Ketik mana-mana kad lead untuk membuka laci butiran. Di dalamnya: butiran pembeli, log nota, pemilih tarikh susulan, penjadual temujanji, skrip bantahan AI, dan sejarah deal.' },
        { label: 'Buku Panduan AI', desc: 'Dalam laci lead, ketik tab Buku Panduan. Pilih bantahan pembeli (harga terlalu tinggi, perbatuan tinggi, belum bersedia, isu kepercayaan) dan dapatkan skrip respons yang terbukti yang boleh anda ubah suai.' },
        { label: 'Tarikh susulan', desc: 'Tetapkan tarikh susulan pada mana-mana lead. Ia akan muncul dalam Agenda Papan Pemuka anda pada hari yang sepatutnya supaya anda tidak pernah lupa susulan.' },
        { label: 'Amaran lead basi', desc: 'Lead tanpa sebarang aktiviti dalam 5 hari atau lebih akan ditanda sebagai basi. Ia muncul sebagai kad amaran pada Papan Pemuka anda dan dalam tab Lead.' },
        { label: 'Mengaitkan kereta', desc: 'Buka laci lead dan cari listing untuk dikaitkan. Nama kereta kemudiannya muncul pada kad lead dan disertakan apabila menjana helaian deal.' },
      ],
    },
    inbox: {
      title: 'Peti Masuk',
      body: 'Peti Masuk mempunyai dua sub-tab: Pertanyaan dan Tempahan.',
      items: [
        { label: 'Pertanyaan', desc: 'Apabila pembeli mengetuk WhatsApp pada listing XDrive anda, mesej mereka ditangkap sebagai pertanyaan di sini. Anda boleh membalas melalui WhatsApp atau menukar pertanyaan kepada lead dengan satu ketikan.' },
        { label: 'Menukar kepada lead', desc: 'Buka mana-mana pertanyaan dan ketik "Tambah ke Lead". Nama pembeli, nombor telefon, dan kereta yang dikaitkan dibawa bersama secara automatik. Anda hanya perlu menetapkan peringkat.' },
        { label: 'Tempahan', desc: 'Permintaan temujanji lawatan dan ujian pandu dari XDrive muncul di sini. Terima, jadual semula, atau batal terus dari kad. Tempahan yang diterima juga muncul dalam Agenda Papan Pemuka anda.' },
        { label: 'Lencana notifikasi', desc: 'Lencana merah pada tab Peti Masuk menunjukkan pertanyaan yang belum dibaca ditambah permintaan tempahan baru. Ia ditetapkan semula apabila anda membuka sub-tab yang berkaitan.' },
      ],
    },
    performance: {
      title: 'Prestasi',
      body: 'Tab Prestasi menunjukkan corong jualan anda dan metrik aktiviti supaya anda dapat mengesan di mana deal jatuh.',
      items: [
        { label: 'Kadar tutup', desc: 'Lead menang ÷ semua lead tertutup (menang + kalah). Kadar tutup yang sihat untuk jualan kereta adalah 20–40%. Di bawah 20% biasanya bermakna kadens susulan perlu dipertingkatkan.' },
        { label: 'Pecahan corong', desc: 'Carta bar yang menunjukkan berapa banyak lead berada di setiap peringkat. Kejatuhan besar antara Lawatan dan Ujian Pandu biasanya bermakna persembahan kereta perlu diperbaiki. Kejatuhan antara Ujian Pandu dan Rundingan biasanya bermakna isu harga atau kepercayaan.' },
        { label: 'Bulan ini vs bulan lepas', desc: 'Lead baru, penukaran, dan aktiviti berbanding 30 hari sebelumnya supaya anda dapat menjejaki momentum.' },
        { label: 'Carta aktiviti mingguan', desc: 'Ketukan, nota yang ditambah, dan perubahan peringkat dalam tempoh 7 hari yang lalu. Berguna untuk mengenal pasti hari apabila anda paling produktif.' },
      ],
    },
    merge: {
      title: 'Sertai Pengedar',
      body: 'Jika anda bekerja di bawah pengedar yang menggunakan ShiftOS, menggabungkan akaun anda menghubungkan anda ke sistem mereka. Anda mendapat akses kepada stok mereka, saluran lead mereka, dan ciri pasukan mereka.',
      items: [
        { label: 'Mendapatkan kod jemputan', desc: 'Minta kod jemputan daripada pengedar atau pengurus anda. Ia kelihatan seperti DEALER-XXXX. Kod dijana dari tab Pasukan pengedar.' },
        { label: 'Memasukkan kod', desc: 'Pergi ke tab Sertai Pengedar, tampal kod, dan ketik Hantar. Akaun anda dihubungkan dengan serta-merta.' },
        { label: 'Selepas bergabung', desc: 'Anda akan dihalakan ke Panel Jurujual penuh, yang mempunyai akses kepada stok pengedar, lead yang ditugaskan kepada anda, dan laporan komisen pasukan. Listing dan lead sedia ada anda dibawa bersama.' },
        { label: 'Nota', desc: 'Penggabungan adalah kekal bagi setiap akaun. Jika anda perlu memutuskan hubungan, hubungi pengedar anda atau sokongan ShiftOS.' },
      ],
    },
    settings: {
      title: 'Tetapan',
      body: 'Uruskan profil, foto, butiran hubungan, dan pilihan bahasa anda.',
      items: [
        { label: 'Foto profil', desc: 'Ketik "Tukar foto" untuk memuat naik gambar profil. Foto ini muncul pada halaman profil awam anda dan pada listing anda.' },
        { label: 'Nombor WhatsApp', desc: 'Nombor WhatsApp anda adalah cara pembeli menghubungi anda dari listing. Masukkan digit sahaja — kod negara Malaysia (+60) ditambah secara automatik.' },
        { label: 'Nama pengguna / Slug', desc: 'Slug anda adalah URL profil awam anda: xdrive.my/s/slug-anda. Ia ditetapkan semasa onboarding. Hubungi sokongan untuk menukarnya.' },
        { label: 'Negeri & Bandar', desc: 'Ditunjukkan pada halaman profil anda. Membantu pembeli mengetahui di mana anda berada.' },
        { label: 'Nombor IC', desc: 'Diperlukan untuk pengesahan akaun. Ia tidak pernah ditunjukkan kepada umum dan hanya boleh diakses oleh pentadbir ShiftOS.' },
        { label: 'Bahasa', desc: 'Togol antara Inggeris dan Bahasa Malaysia. Keseluruhan papan pemuka bertukar bahasa dengan serta-merta.' },
        { label: 'Notifikasi Telegram', desc: 'Hubungkan Chat ID Telegram anda untuk menerima makluman segera bagi pertanyaan dan tempahan baru. Arahan terdapat di halaman Tetapan.' },
      ],
    },
    faq: [
      { q: 'Adakah Salesman Lite benar-benar percuma?', a: 'Ya — selamanya. Tiada kad kredit diperlukan, tiada tempoh percubaan, dan tiada caj tersembunyi. Kami menjana wang daripada langganan pengedar, bukan daripada akaun jurujual.' },
      { q: 'Bagaimana pembeli menemui listing saya?', a: 'Listing anda diterbitkan di xdrive.my, yang boleh dicari secara terbuka. Pembeli juga boleh mencapai listing anda melalui pautan profil peribadi anda (xdrive.my/s/slug-anda), yang anda kongsi di WhatsApp, media sosial, atau bio TikTok anda.' },
      { q: 'Apa yang berlaku pada data saya jika saya menyertai pengedar?', a: 'Listing dan lead anda dibawa ke sistem pengedar. Pemilik dan pengurus pengedar boleh melihat lead dan saluran anda. Tiada yang dipadam — ia hanya menjadi dikongsi dalam pasukan.' },
      { q: 'Bolehkah saya mempunyai lebih dari satu akaun?', a: 'Tidak — satu akaun bagi setiap alamat e-mel. Jika anda perlu bertukar antara akaun solo dan pengedar, gunakan aliran Sertai Pengedar.' },
      { q: 'Bagaimana saya mendapatkan pautan profil awam saya?', a: 'Pautan anda adalah xdrive.my/s/[slug-anda]. Slug anda ditunjukkan dalam tab Tetapan di bawah "Nama Pengguna / Slug". Salin dan kongsi di mana sahaja.' },
      { q: 'Berapa banyak listing yang boleh saya ada?', a: 'Sehingga 10 listing aktif (status Tersedia) pada Salesman Lite. Listing dalam status Ditempah atau Dijual tidak dikira ke had.' },
      { q: 'Saya mendapat pertanyaan — apa yang perlu saya lakukan?', a: 'Pergi ke Peti Masuk → Pertanyaan. Buka pertanyaan, ketik butang WhatsApp untuk membalas pembeli, kemudian ketik "Tambah ke Lead" untuk menjejaki deal dalam saluran anda.' },
      { q: 'Apa maksud lead basi?', a: 'Lead adalah basi jika tiada aktiviti (nota, perubahan peringkat, susulan, temujanji) telah dilog dalam 5 hari atau lebih. Ia adalah peringatan bahawa pembeli mungkin semakin sejuk. Susulan dengan segera.' },
      { q: 'Bolehkah pembeli menempah ujian pandu melalui XDrive?', a: 'Ya. Listing di XDrive mempunyai butang tempahan. Permintaan masuk ke tab Peti Masuk → Tempahan anda. Anda terima, jadual semula, atau batal dari sana.' },
      { q: 'Saya memerlukan bantuan atau jumpa pepijat', a: 'WhatsApp talian sokongan kami di +60174155191 atau e-mel support@xdrive.my. Sila sertakan tangkapan skrin dan e-mel akaun anda.' },
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
export default function SalesmanLiteHelp() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('ms') ? 'ms' : 'en';
  const [active, setActive] = useState('overview');

  const content = CONTENT[lang];
  const section = SECTIONS.find(s => s.key === active);
  const sectionLabel = lang === 'ms' ? section.ms : section.en;
  const sectionData = content[active];
  const isFaq = active === 'faq';

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar nav (desktop) ── */}
      <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 20, display: 'none' }} className="slh-sidebar">
        <style>{`
          @media (min-width: 768px) { .slh-sidebar { display: block !important; } .slh-topnav { display: none !important; } }
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
          className="slh-topnav"
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
        <SectionContent data={isFaq ? sectionData : sectionData} isFaq={isFaq} />

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
            href="https://wa.me/60174155191?text=Hi%2C%20I%20need%20help%20with%20ShiftOS%20Salesman%20Lite"
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
