// Every word the Assistant feed says (ASSIST-1), in both languages. A new line goes here in
// BOTH, never inline in the screen. Plain and short; only counts we hold, no invented numbers.
const carName = (c) => [c?.year, c?.brand, c?.model].filter(Boolean).join(' ') || 'the car';
const modelName = (c) => c?.model || carName(c);

export const COPY = {
  en: {
    title: 'Assistant', sub: 'Only you see this', open: 'Assistant', close: 'Close',
    sec: { needs: 'Needs you', worth: 'Worth a look', done: 'Done', doneSub: 'This week' },
    more: (n) => `${n} more in your notifications`,
    empty: { title: 'You are all caught up', body: 'When a buyer writes, a booking needs you, or a car goes quiet, it shows up here.' },
    kind: { booking: 'New booking', enquiry: 'New enquiry', chat: 'New message', question: 'New question', silent: 'Silent car', brief: 'Morning brief' },
    booking: {
      line: (c) => `${c.name || 'A buyer'} wants to view ${c.car ? `the ${carName(c.car)}` : 'a car'}.`,
      sub: (when) => `${when}. Waiting for you to confirm.`,
      confirm: 'Confirm', reschedule: 'Reschedule', whatsapp: 'WhatsApp',
      wa: (c, when) => `Hi ${c.name || ''}, thanks for booking to view ${c.car ? `the ${carName(c.car)}` : 'the car'} on ${when}. See you then.`.replace('Hi ,', 'Hi,'),
    },
    enquiry: { open: 'Open enquiry', sub: 'No reply yet.' },
    chat: { open: 'Open chat', sub: 'Waiting for your reply.' },
    question: { open: 'Answer', sub: 'Buyers see your answer on the car page.' },
    silent: {
      line: (c, s) => `Your ${modelName(c)} has had no views ${s.capped ? 'in over 7 days' : `in ${s.days} day${s.days === 1 ? '' : 's'}`}.`,
      meta: (c) => (c.created_at ? `Listed ${Math.max(0, Math.floor((Date.now() - new Date(c.created_at)) / 86400000))} days ago` : ''),
      share: 'Share it again', poster: 'Make a poster', keep: 'Keep it', snooze: 'Snooze 3 days', more: 'More',
      plus: (n) => (n > 1 ? `${n - 1} more car${n - 1 === 1 ? ' is' : 's are'} quiet too.` : ''),
    },
    brief: {
      line: 'Your day.',
      rows: { viewings: 'Viewings today', leads: 'Leads to chase', silent: 'Cars with no views' },
      open: 'Open This week',
    },
    done: {
      keep: (l) => `Kept. ${l}, quiet for 14 days`, snooze: (l) => `Snoozed. ${l}, back in 3 days`,
      confirmed: (l) => `Confirmed. ${l}`, undo: 'Undo',
    },
    toast: { confirmed: 'Booking confirmed' },
  },
  ms: {
    title: 'Pembantu', sub: 'Hanya anda nampak ini', open: 'Pembantu', close: 'Tutup',
    sec: { needs: 'Perlukan anda', worth: 'Patut tengok', done: 'Siap', doneSub: 'Minggu ini' },
    more: (n) => `${n} lagi di notifikasi anda`,
    empty: { title: 'Semua sudah selesai', body: 'Bila pembeli mesej, ada booking nak disahkan, atau kereta jadi senyap, ia muncul di sini.' },
    kind: { booking: 'Booking baru', enquiry: 'Pertanyaan baru', chat: 'Mesej baru', question: 'Soalan baru', silent: 'Kereta senyap', brief: 'Ringkasan pagi' },
    booking: {
      line: (c) => `${c.name || 'Seorang pembeli'} nak tengok ${c.car ? carName(c.car) : 'sebuah kereta'}.`,
      sub: (when) => `${when}. Menunggu anda sahkan.`,
      confirm: 'Sahkan', reschedule: 'Tukar masa', whatsapp: 'WhatsApp',
      wa: (c, when) => `Hi ${c.name || ''}, terima kasih sebab booking untuk tengok ${c.car ? carName(c.car) : 'kereta'} pada ${when}. Jumpa nanti.`.replace('Hi ,', 'Hi,'),
    },
    enquiry: { open: 'Buka pertanyaan', sub: 'Belum dibalas.' },
    chat: { open: 'Buka chat', sub: 'Menunggu balasan anda.' },
    question: { open: 'Jawab', sub: 'Pembeli nampak jawapan anda di page kereta.' },
    silent: {
      line: (c, s) => `${modelName(c)} anda tiada view ${s.capped ? 'lebih 7 hari' : `dalam ${s.days} hari`}.`,
      meta: (c) => (c.created_at ? `Disenaraikan ${Math.max(0, Math.floor((Date.now() - new Date(c.created_at)) / 86400000))} hari lepas` : ''),
      share: 'Kongsi semula', poster: 'Buat poster', keep: 'Biarkan', snooze: 'Tunda 3 hari', more: 'Lagi',
      plus: (n) => (n > 1 ? `${n - 1} kereta lagi pun senyap.` : ''),
    },
    brief: {
      line: 'Hari anda.',
      rows: { viewings: 'Viewing hari ini', leads: 'Lead nak di-follow up', silent: 'Kereta tiada view' },
      open: 'Buka Minggu ini',
    },
    done: {
      keep: (l) => `Dibiarkan. ${l}, senyap 14 hari`, snooze: (l) => `Ditunda. ${l}, kembali 3 hari`,
      confirmed: (l) => `Disahkan. ${l}`, undo: 'Batal',
    },
    toast: { confirmed: 'Booking disahkan' },
  },
};

export const copyFor = (lang) => (String(lang || '').startsWith('ms') ? COPY.ms : COPY.en);
export { carName };
