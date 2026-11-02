import { interpolate, spring, Easing } from 'remotion';

export const FPS = 30;
export const W = 1080;
export const H = 1920;

// One timeline (seconds) for picture AND sound: score.py reads the same numbers (timeline.json).
export const TL = {
  hook: [0, 4.6],
  calc: [4.6, 9.8],
  budget: [9.8, 15.4],
  leads: [15.4, 21.0],
  stats: [21.0, 24.4],
  studio: [24.4, 30.4],
  posters: [30.4, 35.0],
  page: [35.0, 40.6],
  devices: [40.6, 42.7],
  cta: [42.7, 47.5],
};
export const DUR = 47.5;
// These scenes start OV seconds before their slot, so they enter while the previous one leaves
// (no empty beat between scenes). Their own clocks run OV ahead of TL; make-audio.cjs knows.
export const OV = 0.3;
export const OVERLAP = ['leads', 'stats', 'studio', 'posters', 'page', 'devices'];

export const COPY = {
  ms: {
    hook: ['SA kereta,', '*buang Excel* anda.'],
    calc: ['Kira dalam', '*satu tap.*'],
    budget: ['Gaji RM10k?', '*Layak kereta apa?*'],
    leads: ['Setiap lead,', '*setiap peringkat.*'],
    stats: ['Siapa tengok,', '*siapa WhatsApp.*'],
    studio: ['Buang latar.', '*Satu tap.*'],
    posters: ['Poster loan', '+ *video MP4.*'],
    page: ['Page anda', '*sendiri.*'],
    devices: ['Telefon &', '*laptop.*'],
    eb: { hook: 'Untuk SA kereta', calc: '01 · Kalkulator Live', budget: '02 · Bajet & DSR', leads: '03 · Lead', stats: '04 · Listing', studio: '05 · TikTok Studio', posters: '06 · Poster', page: '07 · Mini page', devices: 'Di mana-mana' },
    excel: 'Excel', drevo: 'Drevo', done: 'siap',
    stages: ['Baru', 'Dihubungi', 'Viewing ditempah', 'Test drive', 'Berunding', 'Deposit diterima', 'Menang'],
    remind: 'Ingatkan saya', tomorrow: 'Esok, 10:00 pagi', callLogged: 'Panggilan direkod', reminderSet: 'Reminder diset',
    views: 'tontonan', taps: 'WhatsApp', statCar: '2023 Lexus RX 350 F-Sport',
    removeBg: 'Remove BG', backdrop: 'Backdrop',
    jpeg: 'Poster loan · JPEG', mp4: 'Poster bergerak · MP4',
    role: 'Junior sales advisor · PremiumMotors', bio: 'Selling Recon Toyota Alphard, Vellfire and Lexus RXs!', carsN: '23 kereta dijual', verified: 'Disahkan', myCars: 'Kereta saya',
    cta1: 'Cuba Premium', cta2: '7 hari percuma.', cta3: 'Lepas tu RM35 sebulan. Tak perlu kad kredit.', tag: 'Tag kawan SA anda',
    pill: 'Cuba Premium 7 hari percuma · drevo.my',
    fine: { calc: 'Rakaman sebenar Drevo Live. Anggaran 6.5% EIR, bank yang tentukan.', leads: 'Ilustrasi · data contoh', real: 'Data & gambar sebenar premiummotors' },
  },
  en: {
    hook: ['Car SAs,', '*ditch your Excel.*'],
    calc: ['Every number in', '*one tap.*'],
    budget: ['RM10k salary?', '*What car fits?*'],
    leads: ['Every lead,', '*every stage.*'],
    stats: ['Who viewed,', '*who WhatsApped.*'],
    studio: ['Remove the background.', '*One tap.*'],
    posters: ['Loan poster', '+ *MP4 video.*'],
    page: ['Your', '*own page.*'],
    devices: ['Phone &', '*laptop.*'],
    eb: { hook: 'For car SAs', calc: '01 · Live calculator', budget: '02 · Budget & DSR', leads: '03 · Leads', stats: '04 · Listings', studio: '05 · TikTok Studio', posters: '06 · Posters', page: '07 · Mini page', devices: 'Anywhere' },
    excel: 'Excel', drevo: 'Drevo', done: 'done',
    stages: ['New', 'Contacted', 'Viewing booked', 'Test drive', 'Negotiating', 'Deposit taken', 'Won'],
    remind: 'Remind me', tomorrow: 'Tomorrow, 10:00 am', callLogged: 'Call logged', reminderSet: 'Reminder set',
    views: 'views', taps: 'WhatsApp', statCar: '2023 Lexus RX 350 F-Sport',
    removeBg: 'Remove BG', backdrop: 'Backdrop',
    jpeg: 'Loan poster · JPEG', mp4: 'Moving poster · MP4',
    role: 'Junior sales advisor · PremiumMotors', bio: 'Selling Recon Toyota Alphard, Vellfire and Lexus RXs!', carsN: '23 cars for sale', verified: 'Verified', myCars: 'My cars',
    cta1: 'Try Premium', cta2: 'free for 7 days.', cta3: 'Then RM35 a month. No credit card needed.', tag: 'Tag an SA friend',
    pill: 'Try Premium free for 7 days · drevo.my',
    fine: { calc: 'Real Drevo Live recording. Estimate at 6.5% EIR, the bank decides.', leads: 'Illustration · sample data', real: 'Real premiummotors data & photos' },
  },
};

// premiummotors listings shown on the page and in the stats (counts read 2026-11-02).
export const CARS = [
  { img: 'photos/gr86-2025.jpg', name: '2025 Toyota GR86', v: '2.4L RZ', price: 'RM 175,000' },
  { img: 'photos/civic-fl5-2025.jpg', name: '2025 Honda Civic', v: 'FL5 Type R 2.0L', price: 'RM 250,000' },
  { img: 'photos/gr-yaris-2024.png', name: '2024 Toyota GR Yaris', v: 'GR RZ High', price: 'RM 240,000' },
  { img: 'photos/mx5-2024.jpg', name: '2024 Mazda MX-5', v: 'Roadster S', price: 'RM 173,000' },
  { img: 'photos/mini-jcw-2022.jpg', name: '2022 MINI Cooper', v: 'Works 3-door', price: 'RM 170,000' },
  { img: 'photos/defender-90-2023.jpg', name: '2023 Land Rover Defender', v: '90', price: 'RM 270,000' },
];

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
export const ease = Easing.bezier(0.22, 1, 0.36, 1);      // out-expo-ish
export const easeIO = Easing.bezier(0.65, 0, 0.35, 1);
export const lerp = (f, a, b, from, to, e = ease) => interpolate(f, [a, b], [from, to], { ...clamp, easing: e });
export const sec = (s) => Math.round(s * FPS);
export const pop = (frame, at, fps = FPS, cfg = { damping: 13, stiffness: 140, mass: 0.7 }) => spring({ frame: frame - sec(at), fps, config: cfg });

// Words: '*red*' marks the accent run.
export function parseLine(line) {
  const out = []; let red = false;
  for (let w of line.split(' ')) {
    let r = red;
    if (w.startsWith('*')) { r = true; w = w.slice(1); }
    let end = false;
    if (w.endsWith('*')) { end = true; w = w.slice(0, -1); } else if (w.includes('*')) { end = true; w = w.replace('*', ''); }
    out.push({ w, r }); red = r && !end;
  }
  return out;
}
