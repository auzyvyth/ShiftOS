// Live presenter wording, English and Malay. The presenter has its OWN
// language switch, separate from the app's: the seller reads their dashboard
// in one language and may present to the live audience in the other.
// Numbers and maths never change with the language, only the words.

const en = {
  cars: 'Cars',
  budget: 'Budget',
  docs: 'Docs',
  colour: 'Colour',
  colourAny: 'Pick any colour',
  docsTitle: 'Documents for the loan',
  docsEmployee: 'Employee',
  docsSelf: 'Own business',
  docsList: {
    employee: ['MyKad (IC), front and back', 'Driving licence, front and back', 'Latest 3 months payslips', 'Latest EPF statement', 'Latest 3 months bank statements'],
    self: ['MyKad (IC), front and back', 'Driving licence, front and back', 'SSM business registration', 'Latest 6 months bank statements', 'Latest Borang B + tax receipt'],
  },
  docsAnyCar: 'Same list for new, used and recon cars.',
  docsNote: 'Each bank sets its own list and may ask for more.',
  docsPrivacy: 'Never post your IC or payslip in the comments.',
  liveEnded: 'Live ended',
  langLabel: 'Presenter language',
  showContact: 'Show contact',
  fullScreen: 'Full screen',
  exitFullScreen: 'Exit full screen',
  hideContact: 'Hide contact',
  contactMe: 'Contact me',
  variant: 'Variant',
  adjust: 'Adjust financing',
  exit: 'Exit live presentation',
  rateQuoted: 'How the rate is quoted',
  customDeposit: 'Deposit in RM',
  other: 'Other',
  adjFin: 'Financing',
  adjRebates: 'Rebates',
  adjLook: 'Look',
  rateLabel: 'Interest rate',
  rateLocal: 'New Proton & Perodua',
  rateOther: 'Other cars',
  carRateNote: (n, r) => `${n} is worked at ${r}.`,
  closeAdjust: 'Close settings',
  endTitle: 'End the live?',
  endBody: 'The presentation closes and your live report shows.',
  endYes: 'End live',
  endKeep: 'Keep presenting',
  rebateEdit: 'Set the rebate for this car',
  rebatesTitle: 'Rebates this month',
  rebatesHint: (d) => `Money off the price. Saved on this device until ${d}.`,
  rebatesHintDemo: 'Money off the price, per car.',
  savedUntil: (d) => `saved until ${d}`,
  clear: 'Clear',
  rebateModelNote: "A model card's rebate covers every variant. Viewers see it as a line under the price.",
  allVariants: 'New · every variant',
  used: 'Used',
  recon: 'Recon',
  rebate: 'Rebate',
  flatHint: (list) => `Type the bank's flat rate as quoted. Flat rates were abolished for new loans on 1 June 2026, so it is worked out as EIR: ${list}.`,
  yrsShort: (y) => `${y} yrs`,
  noPhoto: 'No photo',
  extrasOver: (v) => `Over ${v}`,
  extrasTop: 'Highlights',
  seatsN: (n) => `${n} seats`,
  newTag: 'New',
  newPriceNote: 'Official price, on the road without insurance.',
  prevPhoto: 'Previous photo',
  nextPhoto: 'Next photo',
  fullPhoto: 'Full view',
  closePhoto: 'Close photo',
  price: 'Price',
  onRequest: 'On request',
  deposit: 'Deposit',
  none: 'None',
  noDeposit: 'No deposit',
  loan: 'Loan',
  rate: 'Rate',
  rateInfoLabel: 'What is this rate?',
  rateInfo: (r, flat) => (flat
    ? `${r}% flat, as the bank quoted it. It is worked out as EIR for each tenure, so the monthly matches what the bank charges.`
    : `${r}% EIR: the effective rate, charged on what you still owe. Since 1 June 2026 banks quote EIR, not flat. A 3.5% flat rate over 7 years is about 6.4% EIR, the same monthly. Bank gave you a flat rate? Switch to Flat with the sliders button at the top.`),
  flat: 'flat',
  tenure: 'Tenure',
  years: (y) => `${y} years`,
  salary: (y) => `${y} years: take-home pay needed `,
  about: (rm) => `about ${rm}`,
  salaryRule: (pct) => `. Instalment at ${pct}% of take-home pay. The bank decides.`,
  reducing: 'Reducing balance',
  flatAsEir: (y, r) => `, flat rate worked out as EIR (${y} yrs ${r}%)`,
  highValue: 'Above RM300k banks decide case by case, often with a bigger deposit or shorter tenure, so treat this as a rough guide.',
  subjectBank: 'Subject to bank approval.',
  depositCovers: 'The deposit covers the price: no loan needed.',
  tenureCap: (y, age) => `Banks usually finance a used car until it is ${age} years old, so up to ${y} years here.`,
  tooOld: (age) => `Banks rarely give a car loan once a car is near ${age} years old.`,
  looksFlat: 'This looks like a flat (brochure) rate.',
  switchFlat: 'Switch to flat',
  aboveCap: (cap) => `Above the legal cap of ${cap}% EIR for this tenure.`,
  totalPay: 'Total you pay',
  totalPayHow: (m) => `deposit + ${m} months`,
  interest: 'Interest',
  interestHow: (r) => `at ${r}% EIR`,
  topUp: (rm) => `+${rm} deposit and it fits`,
  targetMonthly: 'Monthly budget (RM)',
  targetHint: 'Fills in the deposit this monthly needs.',
  cta: (n) => `Comment #${n}, your deposit & tenure`,
  ctaLabel: 'Comment line',
  bioLine: 'All my cars: link in bio',
  bioLabel: 'Link in bio line',
  bioOff: 'Off',
  bioOn: 'On',
  bioHint: 'Under the comment line. Viewers reach your page through the link in your TikTok bio.',
  insurance: 'Insurance',
  insuranceEst: 'Insurance (est.)',
  insuranceEdit: 'Set the insurance for this car',
  ncd: 'NCD',
  offer: 'Offer',
  offerLabel: 'Your offer (free extras)',
  offerHint: 'Shown on every car. Leave empty to hide.',
  ctaHint: '# becomes the car number. Empty = the standard line.',
  budgetIs: 'Budget is',
  budgetTitle: 'What fits your budget',
  budgetCta: 'Comment your budget',
  monthlyBudget: 'Monthly budget',
  takeHome: 'Take-home pay',
  takeHomeAria: 'Take-home pay a month',
  yearsAria: 'Years',
  upTo: 'up to ',
  perMonth: '/month',
  depositAmt: (rm) => `${rm} deposit`,
  yearsAt: (y, r) => `${y} years at ${r}`,
  budgetEmpty: 'Type the monthly amount a viewer can pay, or their take-home pay, and the cars that fit show here.',
  justAbove: 'Just above',
  budgetSetTitle: 'Budget settings',
  morePage: 'Show more cars',
  moreN: (n) => `+${n} more`,
  stFit: 'Fits',
  stNear: 'Close',
  stOver: 'Over budget',
  budgetNote: 'RM per month, reducing balance. Subject to bank approval.',
  budgetHigh: ' Above RM300k banks decide case by case, so treat those as a rough guide.',
  // DSR (Budget, take-home pay mode): commitments come off the same 35% rule.
  commitments: 'Monthly commitments',
  commitWord: 'commitments',
  commitShort: 'Commitments',
  comfortMonthly: 'Comfortable instalment',
  dsrSt: { fit: 'Comfortable', near: 'Tight', over: 'Heavy' },
  dsrLine: (pct) => `Commitments ${pct}% of pay`,
  fitIfYears: (y, pay) => (pay ? `Comfortable at ${y} years` : `Fits at ${y} years`),
  topUpComfort: (rm) => `+${rm} deposit to be comfortable`,
  dsrRule: (pct) => `Comfortable = all monthly commitments at ${pct}% of take-home pay or less. Most banks set their limit around 60-70%; each bank decides for itself.`,
  noRoom: (pct) => `Commitments already use the comfortable ${pct}%. Every car here is tight or heavy.`,
  changeSet: 'Change',
  yearsMax: (y) => `Up to ${y} years`,
  adding: 'Adding up your live...',
  yourLive: (m) => `Your live, ${m} min`,
  openedPage: 'opened your page',
  fromBio: 'of them came from TikTok or Instagram (your bio link).',
  noBioTitle: 'Nobody came from TikTok this live',
  noBioBody: 'Viewers reach your cars through the link in your TikTok bio. Copy it and paste it into Website on your profile.',
  bioCopy: 'Copy my page link',
  bioCopied: 'Copied',
  carTaps: 'car taps',
  waTaps: 'WhatsApp taps',
  newLeads: 'new leads in your pipeline',
  mostTapped: 'Most tapped',
  topTaps: (n) => `${n} taps. Lead with it next live.`,
  reportNote: 'Counted from the moment you opened the presentation. Page opens are everyone who opened your page in that time, not only your viewers, and visitors who turned analytics off are not counted, so the real number can be higher. Your new leads are waiting in your pipeline.',
  done: 'Done',
};

const ms = {
  cars: 'Kereta',
  budget: 'Bajet',
  docs: 'Dokumen',
  colour: 'Warna',
  colourAny: 'Pilih warna sendiri',
  docsTitle: 'Dokumen untuk pinjaman',
  docsEmployee: 'Makan gaji',
  docsSelf: 'Bisnes sendiri',
  docsList: {
    employee: ['MyKad depan dan belakang', 'Lesen memandu depan dan belakang', 'Slip gaji 3 bulan terkini', 'Penyata KWSP terkini', 'Penyata bank 3 bulan terkini'],
    self: ['MyKad depan dan belakang', 'Lesen memandu depan dan belakang', 'Pendaftaran perniagaan SSM', 'Penyata bank 6 bulan terkini', 'Borang B terkini dan resit cukai'],
  },
  docsAnyCar: 'Senarai sama untuk kereta baru, terpakai dan rekon.',
  docsNote: 'Setiap bank ada senarai sendiri dan mungkin minta lebih.',
  docsPrivacy: 'Jangan kongsi IC atau slip gaji di ruang komen.',
  liveEnded: 'Live tamat',
  langLabel: 'Bahasa paparan',
  showContact: 'Tunjuk hubungan',
  fullScreen: 'Skrin penuh',
  exitFullScreen: 'Keluar skrin penuh',
  hideContact: 'Sorok hubungan',
  contactMe: 'Hubungi saya',
  variant: 'Varian',
  adjust: 'Ubah pembiayaan',
  exit: 'Keluar dari paparan live',
  rateQuoted: 'Cara kadar disebut',
  customDeposit: 'Deposit dalam RM',
  other: 'Lain',
  adjFin: 'Pembiayaan',
  adjRebates: 'Rebat',
  adjLook: 'Rupa',
  rateLabel: 'Kadar faedah',
  rateLocal: 'Proton & Perodua baru',
  rateOther: 'Kereta lain',
  carRateNote: (n, r) => `${n} dikira pada ${r}.`,
  closeAdjust: 'Tutup tetapan',
  endTitle: 'Tamatkan live?',
  endBody: 'Paparan ditutup dan laporan live anda dipaparkan.',
  endYes: 'Tamat live',
  endKeep: 'Teruskan',
  rebateEdit: 'Tetapkan rebat kereta ini',
  rebatesTitle: 'Rebat bulan ini',
  rebatesHint: (d) => `Potongan harga. Disimpan pada peranti ini hingga ${d}.`,
  rebatesHintDemo: 'Potongan harga, setiap kereta.',
  savedUntil: (d) => `disimpan hingga ${d}`,
  clear: 'Padam',
  rebateModelNote: 'Rebat kad model meliputi semua varian. Penonton nampak sebagai satu baris di bawah harga.',
  allVariants: 'Baru · semua varian',
  used: 'Terpakai',
  recon: 'Rekon',
  rebate: 'Rebat',
  flatHint: (list) => `Taip kadar flat seperti yang bank sebut. Kadar flat dimansuhkan untuk pinjaman baharu mulai 1 Jun 2026, jadi ia dikira sebagai EIR: ${list}.`,
  yrsShort: (y) => `${y} thn`,
  noPhoto: 'Tiada gambar',
  extrasOver: (v) => `Berbanding ${v}`,
  extrasTop: 'Ciri utama',
  seatsN: (n) => `${n} tempat duduk`,
  newTag: 'Baru',
  newPriceNote: 'Harga rasmi, atas jalan tanpa insurans.',
  prevPhoto: 'Gambar sebelum',
  nextPhoto: 'Gambar seterusnya',
  fullPhoto: 'Paparan penuh',
  closePhoto: 'Tutup gambar',
  price: 'Harga',
  onRequest: 'Hubungi kami',
  deposit: 'Deposit',
  none: 'Tiada',
  noDeposit: 'Tanpa deposit',
  loan: 'Pinjaman',
  rate: 'Kadar',
  rateInfoLabel: 'Apa kadar ini?',
  rateInfo: (r, flat) => (flat
    ? `${r}% flat, seperti yang bank sebut. Ia dikira sebagai EIR untuk setiap tempoh, jadi bayaran bulanan sama dengan caj bank.`
    : `${r}% EIR: kadar efektif, dikenakan atas baki yang masih dihutang. Sejak 1 Jun 2026 bank menyebut EIR, bukan flat. Kadar flat 3.5% selama 7 tahun lebih kurang 6.4% EIR, bayaran bulanan yang sama. Bank beri kadar flat? Tukar ke Flat melalui butang pelaras di atas.`),
  flat: 'flat',
  tenure: 'Tempoh',
  years: (y) => `${y} tahun`,
  salary: (y) => `${y} tahun: gaji bersih diperlukan `,
  about: (rm) => `sekitar ${rm}`,
  salaryRule: (pct) => `. Ansuran ${pct}% daripada gaji bersih. Keputusan di tangan bank.`,
  reducing: 'Baki berkurangan',
  flatAsEir: (y, r) => `, kadar flat dikira sebagai EIR (${y} thn ${r}%)`,
  highValue: 'Melebihi RM300k, bank menilai setiap kes, selalunya dengan deposit lebih besar atau tempoh lebih pendek, jadi ini anggaran kasar sahaja.',
  subjectBank: 'Tertakluk kepada kelulusan bank.',
  depositCovers: 'Deposit menampung harga: tiada pinjaman diperlukan.',
  tenureCap: (y, age) => `Bank biasanya membiayai kereta terpakai sehingga umurnya ${age} tahun, jadi maksimum ${y} tahun di sini.`,
  tooOld: (age) => `Bank jarang memberi pinjaman kereta yang hampir berumur ${age} tahun.`,
  looksFlat: 'Kadar ini nampak seperti kadar flat (brosur).',
  switchFlat: 'Tukar ke flat',
  aboveCap: (cap) => `Melebihi had undang-undang ${cap}% EIR untuk tempoh ini.`,
  totalPay: 'Jumlah anda bayar',
  totalPayHow: (m) => `deposit + ${m} bulan`,
  interest: 'Faedah',
  interestHow: (r) => `pada ${r}% EIR`,
  topUp: (rm) => `+${rm} deposit, terus muat`,
  targetMonthly: 'Bajet bulanan (RM)',
  targetHint: 'Isi deposit yang diperlukan untuk bayaran bulanan ini.',
  cta: (n) => `Komen #${n}, deposit & tempoh anda`,
  ctaLabel: 'Ayat komen',
  bioLine: 'Semua kereta saya: link di bio',
  bioLabel: 'Ayat link di bio',
  bioOff: 'Tidak',
  bioOn: 'Ya',
  bioHint: 'Di bawah ayat komen. Penonton sampai ke page anda melalui link di bio TikTok anda.',
  insurance: 'Insurans',
  insuranceEst: 'Insurans (anggaran)',
  insuranceEdit: 'Tetapkan insurans kereta ini',
  ncd: 'NCD',
  offer: 'Tawaran',
  offerLabel: 'Tawaran anda (hadiah percuma)',
  offerHint: 'Ditunjuk pada setiap kereta. Biarkan kosong untuk sorok.',
  ctaHint: '# jadi nombor kereta. Kosong = ayat biasa.',
  budgetIs: 'Bajet ialah',
  budgetTitle: 'Kereta ikut bajet anda',
  budgetCta: 'Komen bajet anda',
  monthlyBudget: 'Bajet bulanan',
  takeHome: 'Gaji bersih',
  takeHomeAria: 'Gaji bersih sebulan',
  yearsAria: 'Tahun',
  upTo: 'sehingga ',
  perMonth: '/bulan',
  depositAmt: (rm) => `Deposit ${rm}`,
  yearsAt: (y, r) => `${y} tahun pada ${r}`,
  budgetEmpty: 'Taip jumlah bulanan yang penonton mampu, atau gaji bersih mereka, dan kereta yang sesuai akan tersenarai di sini.',
  justAbove: 'Sedikit melebihi',
  budgetSetTitle: 'Tetapan bajet',
  morePage: 'Tunjuk kereta lain',
  moreN: (n) => `+${n} lagi`,
  stFit: 'Sesuai',
  stNear: 'Hampir',
  stOver: 'Lebih bajet',
  budgetNote: 'RM sebulan, baki berkurangan. Tertakluk kepada kelulusan bank.',
  budgetHigh: ' Melebihi RM300k, bank menilai setiap kes, jadi itu anggaran kasar sahaja.',
  commitments: 'Komitmen bulanan',
  commitWord: 'komitmen',
  commitShort: 'Komitmen',
  comfortMonthly: 'Ansuran selesa',
  dsrSt: { fit: 'Selesa', near: 'Ketat', over: 'Membebankan' },
  dsrLine: (pct) => `Komitmen ${pct}% gaji`,
  fitIfYears: (y, pay) => (pay ? `Selesa jika pilih ${y} tahun` : `Sesuai jika pilih ${y} tahun`),
  topUpComfort: (rm) => `+Deposit ${rm} untuk selesa`,
  dsrRule: (pct) => `Selesa = jumlah komitmen bulanan ${pct}% gaji bersih atau kurang. Kebanyakan bank letak had sekitar 60-70%; setiap bank menentukan sendiri.`,
  noRoom: (pct) => `Komitmen sudah guna ${pct}% yang selesa. Semua kereta di sini ketat atau membebankan.`,
  changeSet: 'Ubah',
  yearsMax: (y) => `Maksimum ${y} tahun`,
  adding: 'Mengira live anda...',
  yourLive: (m) => `Live anda, ${m} minit`,
  openedPage: 'buka page anda',
  fromBio: 'daripadanya datang dari TikTok atau Instagram (link di bio anda).',
  noBioTitle: 'Tiada yang datang dari TikTok dalam live ini',
  noBioBody: 'Penonton sampai ke kereta anda melalui link di bio TikTok. Salin dan tampal di Website profil anda.',
  bioCopy: 'Salin link page saya',
  bioCopied: 'Disalin',
  carTaps: 'tekan kereta',
  waTaps: 'tekan WhatsApp',
  newLeads: 'lead baharu dalam pipeline',
  mostTapped: 'Paling banyak ditekan',
  topTaps: (n) => `${n} tekanan. Mulakan dengan kereta ini live akan datang.`,
  reportNote: 'Dikira sejak anda buka paparan ini. Buka page ialah semua orang yang buka page anda dalam masa itu, bukan penonton anda sahaja, dan pelawat yang mematikan analitik tidak dikira, jadi jumlah sebenar mungkin lebih tinggi. Lead baharu anda menunggu dalam pipeline.',
  done: 'Selesai',
};

export const LIVE_COPY = { en, ms };
export const LIVE_LANG_KEY = 'xd_live_lang';

// Start in the presenter's last-used language, else the app's.
export function initialLiveLang(appLang) {
  try {
    const saved = window.localStorage.getItem(LIVE_LANG_KEY);
    if (saved === 'en' || saved === 'ms') return saved;
  } catch { /* storage blocked */ }
  return String(appLang || '').startsWith('ms') ? 'ms' : 'en';
}

export function saveLiveLang(lang) {
  try { window.localStorage.setItem(LIVE_LANG_KEY, lang); } catch { /* storage blocked */ }
}

// The comment line under each car: the seller's own wording, remembered per
// device (owner, 2026-10-13). A lone "#" becomes this car's "#N", so one line
// works for every car. Empty = the default line in the presenter's language.
export const LIVE_CTA_KEY = 'xd_live_cta';
export const CTA_MAX = 80;

export function initialLiveCta() {
  try { return (window.localStorage.getItem(LIVE_CTA_KEY) || '').slice(0, CTA_MAX); } catch { return ''; }
}

export function saveLiveCta(text) {
  try {
    if (text.trim()) window.localStorage.setItem(LIVE_CTA_KEY, text);
    else window.localStorage.removeItem(LIVE_CTA_KEY);
  } catch { /* storage blocked */ }
}

// The seller's own offer (free tint, dashcam, merchandise), remembered per
// device like the comment line (owner, 2026-10-17). Their standing extras, so
// it stays between lives; empty hides it.
export const LIVE_OFFER_KEY = 'xd_live_offer';
export const OFFER_MAX = 120;

export function initialLiveOffer() {
  try { return (window.localStorage.getItem(LIVE_OFFER_KEY) || '').slice(0, OFFER_MAX); } catch { return ''; }
}

export function saveLiveOffer(text) {
  try {
    if (text.trim()) window.localStorage.setItem(LIVE_OFFER_KEY, text);
    else window.localStorage.removeItem(LIVE_OFFER_KEY);
  } catch { /* storage blocked */ }
}

// Rebates, every car (owner, 2026-10-22; it was new-car model cards only),
// remembered per device until the month ends (liveMaths.rebatesForMonth):
// the seller types this month's numbers once in Adjust > Rebates, not every
// live. Never saved to the listing, and never to the server.
export const LIVE_REBATES_KEY = 'xd_live_rebates';

export function initialLiveRebates(rebatesForMonth) {
  try { return rebatesForMonth(JSON.parse(window.localStorage.getItem(LIVE_REBATES_KEY) || 'null')); } catch { return {}; }
}

export function saveLiveRebates(rebates, month) {
  try {
    if (Object.keys(rebates).length) window.localStorage.setItem(LIVE_REBATES_KEY, JSON.stringify({ month, rebates }));
    else window.localStorage.removeItem(LIVE_REBATES_KEY);
  } catch { /* storage blocked */ }
}

// Insurance in the loan: on or off, remembered per device (owner, 2026-10-18).
// Some sellers always quote with it (Proton advisors), most used-car sellers
// never do, so it starts off and the seller's choice sticks between lives.
// "Link in bio" under the comment line (BIOLINK-1, 2026-10-23): ON unless the
// seller switched it off on this device. It names TikTok's own bio feature,
// never a URL or our name: TikTok LIVE rules bar QR codes and third-party
// links on screen, so the bio link is the one safe way from a live to the page.
export const LIVE_BIO_KEY = 'xd_live_bio';

export function initialLiveBio() {
  try { return window.localStorage.getItem(LIVE_BIO_KEY) !== '0'; } catch { return true; }
}

export function saveLiveBio(on) {
  try {
    if (on) window.localStorage.removeItem(LIVE_BIO_KEY);
    else window.localStorage.setItem(LIVE_BIO_KEY, '0');
  } catch { /* storage blocked */ }
}

// Insurance FIGURES the seller typed, per car (a model card per variant),
// remembered on this device until the seller changes them (owner, 2026-10-24:
// a Proton advisor quotes his insurer's number for every model and would not
// retype it each live). No month end, unlike rebates: a premium only moves at
// renewal-rate changes. Never saved to the listing or the server.
export const LIVE_INS_FIG_KEY = 'xd_live_insfig';

export function initialLiveInsFigures() {
  try {
    const m = JSON.parse(window.localStorage.getItem(LIVE_INS_FIG_KEY) || 'null');
    return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
  } catch { return {}; }
}

export function saveLiveInsFigures(figures) {
  try {
    if (Object.keys(figures).length) window.localStorage.setItem(LIVE_INS_FIG_KEY, JSON.stringify(figures));
    else window.localStorage.removeItem(LIVE_INS_FIG_KEY);
  } catch { /* storage blocked */ }
}

// The rate and how it was quoted (EIR | flat), remembered per device (owner,
// 2026-10-22). One rate covers every car; the seller sets it once and it is
// still there next live. Changing it in Adjust saves the new number.
// New Proton/Perodua keep their own rate (liveMaths isLocalNew), under its own key.
export const LIVE_RATE_KEY = 'xd_live_rate';
export const LIVE_RATE_LOCAL_KEY = 'xd_live_rate_local';

export function initialLiveRate(fallback, max, key = LIVE_RATE_KEY) {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || 'null');
    const n = Number(v?.eir);
    if (!(n > 0 && n <= max)) return { eir: String(fallback), basis: 'eir' };
    return { eir: String(n), basis: v.basis === 'flat' ? 'flat' : 'eir' };
  } catch { return { eir: String(fallback), basis: 'eir' }; }
}

export function saveLiveRate(eir, basis, key = LIVE_RATE_KEY) {
  // An empty or zero box is mid-typing, not a rate: keep the last good one.
  if (!(Number(eir) > 0)) return;
  try { window.localStorage.setItem(key, JSON.stringify({ eir: String(eir), basis })); } catch { /* storage blocked */ }
}

export function ctaLine(custom, n, fallback) {
  const text = String(custom || '').trim();
  if (!text) return fallback;
  return text.replace(/#(?!\d)/g, `#${n}`);
}
