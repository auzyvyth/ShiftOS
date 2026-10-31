// Every word the car coach says (COACH-1), in both languages. A new line goes
// here in BOTH, never inline in a panel. Plain, short, no invented numbers:
// views are only what we counted.
const car = (c) => [c?.year, c?.brand, c?.model].filter(Boolean).join(' ') || 'this car';

const COPY = {
  en: {
    line: {
      question: (s) => (s.count > 1 ? `${s.count} buyers asked about this car. Answer them.` : 'A buyer asked about this car. Answer them.'),
      photos: (s) => `Add ${s.need} more photo${s.need === 1 ? '' : 's'}. Buyers scroll past cars with few photos.`,
      price: () => 'Add a price. Buyers skip cars without one.',
      silent: (s) => `No views in ${s.capped ? 'over 7' : s.days} days. Share it on your social media.`,
      fresh: () => 'New car. Share it today while it is fresh.',
      no_taps: (s) => `${s.views} views but nobody messaged. Check the price and the first photo.`,
      saved: (s) => `${s.count} buyers saved this car. Share it again or show it on your next Live.`,
      low: (s) => (s.views === 0 ? 'No views this week. Share it to get it seen.' : `Only ${s.views} view${s.views === 1 ? '' : 's'} this week. Share it to get more.`),
      working: (s) => `Buyers are messaging about this car (${s.count}). Reply fast.`,
    },
    btn: { answer: 'Answer', edit: 'Edit', share: 'Share', tour: 'Show me how' },
    card: {
      title: (c, s) => `${car(c)}: no views in ${s.capped ? 'over 7' : s.days} days`,
      more: (n) => (n > 1 ? ` (and ${n - 1} more car${n - 1 === 1 ? '' : 's'})` : ''),
      body: 'Buyers cannot message a car they never see. Post its link on your WhatsApp status, Facebook or TikTok bio. We will show you how.',
      btn: 'Show me how',
    },
    tour: {
      step1Share: 'Tap Share to send this car to your WhatsApp status, Facebook or Instagram.',
      step1Copy: 'Tap Link to copy this car\'s link.',
      step2: 'Now post it where your buyers are: your WhatsApp status, Facebook, or your TikTok bio. Paste the link if it was copied.',
      done: 'Done',
      skip: 'Skip',
    },
  },
  ms: {
    line: {
      question: (s) => (s.count > 1 ? `${s.count} pembeli bertanya tentang kereta ini. Jawab mereka.` : 'Seorang pembeli bertanya tentang kereta ini. Jawab mereka.'),
      photos: (s) => `Tambah ${s.need} lagi gambar. Pembeli lepas pandang kereta yang kurang gambar.`,
      price: () => 'Letak harga. Pembeli abaikan kereta tanpa harga.',
      silent: (s) => `Tiada tontonan dalam ${s.capped ? 'lebih 7' : s.days} hari. Kongsi di media sosial anda.`,
      fresh: () => 'Kereta baru. Kongsi hari ini selagi masih baru.',
      no_taps: (s) => `${s.views} tontonan tapi tiada yang mesej. Semak harga dan gambar pertama.`,
      saved: (s) => `${s.count} pembeli simpan kereta ini. Kongsi semula atau tunjuk dalam Live seterusnya.`,
      low: (s) => (s.views === 0 ? 'Tiada tontonan minggu ini. Kongsi supaya orang nampak.' : `Hanya ${s.views} tontonan minggu ini. Kongsi untuk lebih ramai.`),
      working: (s) => `Pembeli sedang mesej tentang kereta ini (${s.count}). Balas cepat.`,
    },
    btn: { answer: 'Jawab', edit: 'Edit', share: 'Kongsi', tour: 'Tunjuk caranya' },
    card: {
      title: (c, s) => `${car(c)}: tiada tontonan dalam ${s.capped ? 'lebih 7' : s.days} hari`,
      more: (n) => (n > 1 ? ` (dan ${n - 1} lagi kereta)` : ''),
      body: 'Pembeli tak boleh mesej kereta yang mereka tak nampak. Letak pautannya di status WhatsApp, Facebook atau bio TikTok anda. Kami tunjukkan caranya.',
      btn: 'Tunjuk caranya',
    },
    tour: {
      step1Share: 'Tekan Kongsi untuk hantar kereta ini ke status WhatsApp, Facebook atau Instagram anda.',
      step1Copy: 'Tekan Link untuk salin pautan kereta ini.',
      step2: 'Sekarang siarkan di tempat pembeli anda: status WhatsApp, Facebook atau bio TikTok. Tampal pautan jika ia disalin.',
      done: 'Siap',
      skip: 'Langkau',
    },
  },
};

export const coachCopy = (lang) => (String(lang || '').startsWith('ms') ? COPY.ms : COPY.en);
