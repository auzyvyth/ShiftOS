// Every word of the usage-count question, in both languages (a new line goes in BOTH).
// Rules the words keep: say what is counted, say what is never read, say who sees it, say how to
// change the answer. Nothing here promises a reward for saying yes.
const COPY = {
  en: {
    title: 'Can we count which features you use?',
    lead: 'We are deciding what to improve and what to remove. It helps us to know which features sellers use.',
    points: [
      'We only count, for example "used Live this month". Not what you typed or showed.',
      'We never read your buyers\' names, numbers or chats for this.',
      'Only the Drevo team sees the totals, to decide what to build or remove.',
    ],
    change: ['Change your mind any time:', 'message us', 'and we stop counting you.'],
    changeMsg: 'Please stop counting my feature use on Drevo.',
    yes: 'Yes, that is fine', no: 'No thanks', saving: 'Saving...',
    error: 'Could not save your answer. Please try again.',
    thanksBold: 'Thank you.', thanks: 'It helps us build what sellers actually use.',
  },
  ms: {
    title: 'Boleh kami kira ciri mana yang anda guna?',
    lead: 'Kami sedang memutuskan apa yang perlu dipertingkat dan apa yang perlu dibuang. Ia membantu kami tahu ciri mana yang digunakan penjual.',
    points: [
      'Kami hanya mengira, contohnya "guna Live bulan ini". Bukan apa yang anda taip atau tunjuk.',
      'Kami tidak membaca nama, nombor atau sembang pembeli anda untuk tujuan ini.',
      'Hanya pasukan Drevo melihat jumlahnya, untuk memutuskan apa yang dibina atau dibuang.',
    ],
    change: ['Tukar fikiran bila-bila masa:', 'mesej kami', 'dan kami berhenti mengira anda.'],
    changeMsg: 'Sila berhenti mengira penggunaan ciri saya di Drevo.',
    yes: 'Ya, boleh', no: 'Tidak, terima kasih', saving: 'Menyimpan...',
    error: 'Tidak dapat simpan jawapan anda. Sila cuba lagi.',
    thanksBold: 'Terima kasih.', thanks: 'Ia membantu kami membina apa yang penjual benar-benar guna.',
  },
};
export const usageConsentCopy = (lang) => COPY[lang] || COPY.en;
