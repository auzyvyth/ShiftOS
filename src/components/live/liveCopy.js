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
  hideContact: 'Hide contact',
  contactMe: 'Contact me',
  variant: 'Variant',
  adjust: 'Adjust financing',
  exit: 'Exit live presentation',
  rateQuoted: 'How the rate is quoted',
  flatBrochure: 'Flat (brochure)',
  rateFlat: 'Rate (flat % a year)',
  rateEir: 'Rate (EIR % a year)',
  customDeposit: 'Custom deposit (RM)',
  rebateThisCar: 'Rebate on this car (RM)',
  rebate: 'Rebate',
  noDepositHint: '0 = no deposit',
  flatHint: (list) => `Type the bank's flat rate as quoted. Flat rates were abolished for new loans on 1 June 2026, so it is worked out as EIR: ${list}.`,
  yrsShort: (y) => `${y} yrs`,
  noPhoto: 'No photo',
  newTag: 'New',
  newPriceNote: 'Official price, on the road without insurance.',
  prevPhoto: 'Previous photo',
  nextPhoto: 'Next photo',
  price: 'Price',
  onRequest: 'On request',
  deposit: 'Deposit',
  none: 'None',
  noDeposit: 'No deposit',
  loan: 'Loan',
  rate: 'Rate',
  flat: 'flat',
  pctDown: (p) => `${p}% down`,
  tenure: 'Tenure',
  monthly: 'Monthly',
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
  total: (y, total, interest) => `Total repaid over ${y} years ${total}, of which interest ${interest}.`,
  topUp: (rm) => `+${rm} deposit and it fits`,
  targetMonthly: 'Target monthly (RM)',
  monthlyTip: 'Tip: tap the picked monthly and type a target. The deposit it needs fills in.',
  cta: (n) => `Comment #${n}, your deposit & tenure`,
  ctaLabel: 'Comment line',
  insurance: 'Insurance',
  insuranceEst: 'Insurance (est.)',
  insuranceLabel: 'Insurance',
  insOff: 'Off',
  insInLoan: 'In the loan',
  insuranceHint: 'Estimate from the old motor tariff, by engine cc and NCD. Pick the viewer\'s NCD under the car.',
  insuranceThisCar: 'Insurance on this car (RM)',
  insTap: 'Tap to type',
  ncd: 'NCD',
  offer: 'Offer',
  offerLabel: 'Your offer (free extras)',
  offerHint: 'Shown on every car, e.g. free tint, dashcam. Leave empty to hide.',
  ctaHint: 'Type # where the car number goes. Leave empty for the standard line.',
  budgetIs: 'Budget is',
  monthlyBudget: 'Monthly budget',
  takeHome: 'Take-home pay',
  takeHomeAria: 'Take-home pay a month',
  depositRm: 'Deposit (RM)',
  yearsAria: 'Years',
  upTo: 'up to ',
  perMonth: '/month',
  depositAmt: (rm) => `${rm} deposit`,
  yearsAt: (y, r) => `${y} years at ${r}`,
  rateFlatText: (r, e) => `${r}% flat (${e}% EIR)`,
  roughRule: (pct) => `Rough guide: instalment at ${pct}% of take-home pay. The bank decides.`,
  budgetEmpty: 'Type the monthly amount a viewer can pay, or their take-home pay, and the cars that fit show here.',
  fits: (n) => (n === 1 ? '1 car fits' : `${n} cars fit`),
  noneFit: 'None fit this budget yet',
  justAbove: 'Just above',
  budgetNote: 'RM per month, reducing balance. Subject to bank approval.',
  budgetHigh: ' Above RM300k banks decide case by case, so treat those as a rough guide.',
  adding: 'Adding up your live...',
  yourLive: (m) => `Your live, ${m} min`,
  openedPage: 'opened your page',
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
  hideContact: 'Sorok hubungan',
  contactMe: 'Hubungi saya',
  variant: 'Varian',
  adjust: 'Ubah pembiayaan',
  exit: 'Keluar dari paparan live',
  rateQuoted: 'Cara kadar disebut',
  flatBrochure: 'Flat (brosur)',
  rateFlat: 'Kadar (flat % setahun)',
  rateEir: 'Kadar (EIR % setahun)',
  customDeposit: 'Deposit sendiri (RM)',
  rebateThisCar: 'Rebat kereta ini (RM)',
  rebate: 'Rebat',
  noDepositHint: '0 = tanpa deposit',
  flatHint: (list) => `Taip kadar flat seperti yang bank sebut. Kadar flat dimansuhkan untuk pinjaman baharu mulai 1 Jun 2026, jadi ia dikira sebagai EIR: ${list}.`,
  yrsShort: (y) => `${y} thn`,
  noPhoto: 'Tiada gambar',
  newTag: 'Baru',
  newPriceNote: 'Harga rasmi, atas jalan tanpa insurans.',
  prevPhoto: 'Gambar sebelum',
  nextPhoto: 'Gambar seterusnya',
  price: 'Harga',
  onRequest: 'Hubungi kami',
  deposit: 'Deposit',
  none: 'Tiada',
  noDeposit: 'Tanpa deposit',
  loan: 'Pinjaman',
  rate: 'Kadar',
  flat: 'flat',
  pctDown: (p) => `Deposit ${p}%`,
  tenure: 'Tempoh',
  monthly: 'Bulanan',
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
  total: (y, total, interest) => `Jumlah bayaran ${y} tahun ${total}, termasuk faedah ${interest}.`,
  topUp: (rm) => `+${rm} deposit, terus muat`,
  targetMonthly: 'Sasaran bulanan (RM)',
  monthlyTip: 'Tip: tekan bayaran bulanan yang dipilih dan taip sasaran. Deposit yang diperlukan diisi sendiri.',
  cta: (n) => `Komen #${n}, deposit & tempoh anda`,
  ctaLabel: 'Ayat komen',
  insurance: 'Insurans',
  insuranceEst: 'Insurans (anggaran)',
  insuranceLabel: 'Insurans',
  insOff: 'Tidak',
  insInLoan: 'Dalam pinjaman',
  insuranceHint: 'Anggaran ikut tarif motor lama, ikut cc enjin dan NCD. Pilih NCD penonton di bawah kereta.',
  insuranceThisCar: 'Insurans kereta ini (RM)',
  insTap: 'Tekan untuk taip',
  ncd: 'NCD',
  offer: 'Tawaran',
  offerLabel: 'Tawaran anda (hadiah percuma)',
  offerHint: 'Ditunjuk pada setiap kereta, cth. tinted percuma, dashcam. Biarkan kosong untuk sorok.',
  ctaHint: 'Taip # di tempat nombor kereta. Biarkan kosong untuk ayat biasa.',
  budgetIs: 'Bajet ialah',
  monthlyBudget: 'Bajet bulanan',
  takeHome: 'Gaji bersih',
  takeHomeAria: 'Gaji bersih sebulan',
  depositRm: 'Deposit (RM)',
  yearsAria: 'Tahun',
  upTo: 'sehingga ',
  perMonth: '/bulan',
  depositAmt: (rm) => `Deposit ${rm}`,
  yearsAt: (y, r) => `${y} tahun pada ${r}`,
  rateFlatText: (r, e) => `${r}% flat (${e}% EIR)`,
  roughRule: (pct) => `Anggaran kasar: ansuran ${pct}% daripada gaji bersih. Keputusan di tangan bank.`,
  budgetEmpty: 'Taip jumlah bulanan yang penonton mampu, atau gaji bersih mereka, dan kereta yang sesuai akan tersenarai di sini.',
  fits: (n) => `${n} kereta sesuai`,
  noneFit: 'Belum ada yang sesuai dengan bajet ini',
  justAbove: 'Sedikit melebihi',
  budgetNote: 'RM sebulan, baki berkurangan. Tertakluk kepada kelulusan bank.',
  budgetHigh: ' Melebihi RM300k, bank menilai setiap kes, jadi itu anggaran kasar sahaja.',
  adding: 'Mengira live anda...',
  yourLive: (m) => `Live anda, ${m} minit`,
  openedPage: 'buka page anda',
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

// Insurance in the loan: on or off, remembered per device (owner, 2026-10-18).
// Some sellers always quote with it (Proton advisors), most used-car sellers
// never do, so it starts off and the seller's choice sticks between lives.
export const LIVE_INS_KEY = 'xd_live_ins';

export function initialLiveIns() {
  try { return window.localStorage.getItem(LIVE_INS_KEY) === '1'; } catch { return false; }
}

export function saveLiveIns(on) {
  try {
    if (on) window.localStorage.setItem(LIVE_INS_KEY, '1');
    else window.localStorage.removeItem(LIVE_INS_KEY);
  } catch { /* storage blocked */ }
}

export function ctaLine(custom, n, fallback) {
  const text = String(custom || '').trim();
  if (!text) return fallback;
  return text.replace(/#(?!\d)/g, `#${n}`);
}
