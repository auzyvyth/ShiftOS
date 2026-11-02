// Drevo Premium seller ad. Every frame is render(t), deterministic.
// Numbers: the presenter's own maths (financing.js monthlyPayment, motorInsurance.js,
// liveMaths.js), precomputed in node. Listing counts: premiummotors, read 2026-11-02.
(() => {
const Q = new URLSearchParams(location.search);
const LANG = Q.get('lang') === 'en' ? 'en' : 'ms';
const DUR = 47.5;
window.DUR = DUR;

// ---------- copy ----------
const COPY = {
  ms: {
    heads: [
      [0, 3.7, 'Untuk SA Proton', 'SA Proton, *buang Excel* anda.'],
      [4.05, 7.85, '01 · Kalkulator Live', 'Kira Proton dalam *satu tap.*'],
      [8.0, 11.85, '02 · Bajet & DSR', 'Gaji RM5k? *Layak kereta apa?*'],
      [12.25, 14.35, '03 · Lead', 'Setiap lead, *setiap peringkat.*'],
      [14.45, 17.4, '03 · Lead', 'Reminder & call log. *Tak terlepas.*'],
      [17.5, 19.9, '03 · Lead', 'Dari Baru sampai *Menang.*'],
      [20.05, 22.9, '04 · Listing', 'Nampak siapa tengok, *siapa WhatsApp.*'],
      [23.05, 30.85, '05 · TikTok Studio', 'Buang latar, backdrop, templat. *Siap.*'],
      [31.0, 34.85, '06 · Poster', 'Poster loan + *video MP4.*'],
      [35.0, 40.85, '07 · Mini page', 'Page anda *sendiri.*'],
      [41.0, 42.6, 'Di mana-mana', 'Telefon & *laptop.*'],
    ],
    pill: 'Cuba Premium <b>7 hari percuma</b> · drevo.my',
    excel: 'EXCEL', drevo: 'DREVO', done: '1 tap · siap',
    xl: { file: 'S70_KALKULATOR_FINAL(2).xlsx - Excel', rib: ['Fail', 'Laman Utama', 'Sisip', 'Formula', 'Data', 'Paparan'],
      rows: ['BODY PRICE', 'REBATE', 'DOWNPAYMENT', 'LOAN AMOUNT', 'INTEREST (FLAT)', '9 YEARS', '7 YEARS'] },
    live: 'Live presentation', tabs: ['Kereta', 'Bajet', 'Dokumen'], cmt: 'Komen #3, deposit & tempoh anda',
    mo: '/bulan', yrs: (y) => `${y} tahun`, deposit: 'Deposit', none: 'Tiada',
    price: 'Harga', ins: 'Insurans (anggaran)', reb: 'Rebat', loan: 'Pinjaman', rate: (y) => `4.8% EIR · ${y} tahun`,
    fineCalc: 'Anggaran 4.8% EIR. Bank yang tentukan.',
    bset: 'Tanpa deposit · 7 tahun · 4.8% EIR', mMonthly: 'Bulanan', mPay: 'Gaji bersih',
    inMonthly: 'Bajet bulanan', inPay: 'Gaji bersih', inCommit: 'Komitmen',
    hFit: 'Sesuai', hNear: 'Hampir · Lebih bajet', hComfy: 'Selesa', hTight: 'Ketat',
    stFit: 'Sesuai', stNear: 'Hampir', stOver: 'Lebih bajet', dsr: (p) => `${p}% gaji`,
    fineBud: 'Selesa = komitmen 35% gaji bersih atau kurang. Setiap bank menentukan sendiri.',
    leadT: 'Lead', all: 'Semua',
    stages: ['Baru', 'Dihubungi', 'Viewing ditempah', 'Test drive', 'Berunding', 'Deposit diterima', 'Menang'],
    ago: (h) => `${h}j lalu`, from: 'Dari WhatsApp', wa: 'WhatsApp', logCall: 'Rekod call', remind: 'Reminder',
    activity: 'Aktiviti', actWa: 'Mesej WhatsApp', actCall: 'Panggilan direkod', actRem: 'Follow up esok, 10:00 pagi', justNow: 'baru tadi',
    modalT: 'Set reminder follow-up', modalS: 'Ingatkan saya pada', mChips: ['Esok', 'Dalam 3 hari', 'Minggu depan'], setRem: 'Set reminder',
    toastCall: 'Panggilan direkod', toastRem: 'Reminder follow-up diset', won: 'Menang',
    avail: 'Dijual', views: 'tontonan', taps: 'WhatsApp',
    tools: ['Templates', 'Remove BG', 'Backdrop', 'Text'], bds: ['Studio', 'Spotlight', 'Stripes', 'Brand', 'Dusk', 'Light'],
    tpls: ['Monthly Deal', 'Luxury', 'Hero Price'], export: 'Export', saved: 'Disimpan',
    tplFrom: 'Bulanan dari', tplDep: 'Deposit 20% · 7 tahun',
    lpWork: '− rebat 7,000 − deposit 16,560', lpFine: 'Anggaran 4.8% EIR. Bank yang tentukan.',
    mpDep: 'Deposit', mpTake: 'Gaji bersih sekitar',
    bio: 'Selling Recon Toyota Alphard, Vellfire and Lexus RXs!', role: 'Junior sales advisor · PremiumMotors',
    carsN: '23 kereta dijual', verified: 'Disahkan', myCars: 'Kereta saya',
    ctaEb: 'Untuk SA kereta', cta1: 'Cuba Premium', cta2: '7 hari percuma.', cta3: 'Lepas tu RM35 sebulan. Tak perlu kad kredit.',
    tag: 'Tag kawan SA anda', recap: ['Kalkulator Live', 'Bajet & DSR', 'Lead + reminder', 'TikTok Studio', 'Poster MP4', 'Mini page'],
    foots: { calc: 'Anggaran 4.8% EIR. Bank yang tentukan.', demo: 'Ilustrasi · data contoh', real: 'Data sebenar premiummotors' },
  },
  en: {
    heads: [
      [0, 3.7, 'For Proton SAs', 'Proton SAs, *ditch your Excel.*'],
      [4.05, 7.85, '01 · Live calculator', 'Proton maths in *one tap.*'],
      [8.0, 11.85, '02 · Budget & DSR', 'RM5k salary? *What car fits?*'],
      [12.25, 14.35, '03 · Leads', 'Every lead, *every stage.*'],
      [14.45, 17.4, '03 · Leads', 'Reminders & call log. *Never miss one.*'],
      [17.5, 19.9, '03 · Leads', 'From New all the way to *Won.*'],
      [20.05, 22.9, '04 · Listings', 'See who viewed, *who WhatsApped.*'],
      [23.05, 30.85, '05 · TikTok Studio', 'Remove BG, backdrop, template. *Done.*'],
      [31.0, 34.85, '06 · Posters', 'Loan poster + *MP4 video.*'],
      [35.0, 40.85, '07 · Mini page', 'Your *own* page.'],
      [41.0, 42.6, 'Anywhere', 'Phone & *laptop.*'],
    ],
    pill: 'Try Premium <b>free for 7 days</b> · drevo.my',
    excel: 'EXCEL', drevo: 'DREVO', done: '1 tap · done',
    xl: { file: 'S70_CALCULATOR_FINAL(2).xlsx - Excel', rib: ['File', 'Home', 'Insert', 'Formulas', 'Data', 'View'],
      rows: ['BODY PRICE', 'REBATE', 'DOWNPAYMENT', 'LOAN AMOUNT', 'INTEREST (FLAT)', '9 YEARS', '7 YEARS'] },
    live: 'Live presentation', tabs: ['Cars', 'Budget', 'Docs'], cmt: 'Comment #3, your deposit & years',
    mo: '/month', yrs: (y) => `${y} years`, deposit: 'Deposit', none: 'None',
    price: 'Price', ins: 'Insurance (est.)', reb: 'Rebate', loan: 'Loan', rate: (y) => `4.8% EIR · ${y} years`,
    fineCalc: 'Estimate at 4.8% EIR. The bank decides.',
    bset: 'No deposit · 7 years · 4.8% EIR', mMonthly: 'Monthly', mPay: 'Take-home',
    inMonthly: 'Monthly budget', inPay: 'Take-home pay', inCommit: 'Commitments',
    hFit: 'Fits', hNear: 'Close · Over budget', hComfy: 'Comfortable', hTight: 'Tight',
    stFit: 'Fits', stNear: 'Close', stOver: 'Over', dsr: (p) => `${p}% of pay`,
    fineBud: 'Comfortable = commitments 35% of take-home pay or less. Each bank decides.',
    leadT: 'Leads', all: 'All',
    stages: ['New', 'Contacted', 'Viewing booked', 'Test drive', 'Negotiating', 'Deposit taken', 'Won'],
    ago: (h) => `${h}h ago`, from: 'From WhatsApp', wa: 'WhatsApp', logCall: 'Log call', remind: 'Reminder',
    activity: 'Activity', actWa: 'WhatsApp message', actCall: 'Call logged', actRem: 'Follow up tomorrow, 10:00 am', justNow: 'just now',
    modalT: 'Set a follow-up reminder', modalS: 'Remind me on', mChips: ['Tomorrow', 'In 3 days', 'Next week'], setRem: 'Set reminder',
    toastCall: 'Call logged', toastRem: 'Follow-up reminder set', won: 'Won',
    avail: 'Available', views: 'views', taps: 'WhatsApp',
    tools: ['Templates', 'Remove BG', 'Backdrop', 'Text'], bds: ['Studio', 'Spotlight', 'Stripes', 'Brand', 'Dusk', 'Light'],
    tpls: ['Monthly Deal', 'Luxury', 'Hero Price'], export: 'Export', saved: 'Saved',
    tplFrom: 'Monthly from', tplDep: '20% deposit · 7 years',
    lpWork: '− rebate 7,000 − deposit 16,560', lpFine: 'Estimate at 4.8% EIR. The bank decides.',
    mpDep: 'Deposit', mpTake: 'Take-home pay about',
    bio: 'Selling Recon Toyota Alphard, Vellfire and Lexus RXs!', role: 'Junior sales advisor · PremiumMotors',
    carsN: '23 cars for sale', verified: 'Verified', myCars: 'My cars',
    ctaEb: 'For car salesmen', cta1: 'Try Premium', cta2: 'free for 7 days.', cta3: 'Then RM35 a month. No credit card needed.',
    tag: 'Tag an SA friend', recap: ['Live calculator', 'Budget & DSR', 'Leads + reminders', 'TikTok Studio', 'MP4 posters', 'Mini page'],
    foots: { calc: 'Estimate at 4.8% EIR. The bank decides.', demo: 'Illustration · sample data', real: 'Real premiummotors data' },
  },
}[LANG];

// ---------- maths of motion ----------
const C = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, d) => C((t - a) / d);
const eo = (x) => 1 - Math.pow(1 - C(x), 3);
const eio = (x) => { x = C(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const ei = (x) => Math.pow(C(x), 3);
const back = (x) => { x = C(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const spr = (x) => { x = C(x); return 1 - Math.exp(-6.5 * x) * Math.cos(9.5 * x); };
const L = (a, b, x) => a + (b - a) * x;
function kf(t, keys, ease = eio) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t < t1) { const x = ease((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((v, j) => L(v, v1[j], x)) : L(v0, v1, x); }
  }
  return keys[keys.length - 1][1];
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const RM = (n) => 'RM ' + fmt(n);
const $ = (id) => document.getElementById(id);
function el(parent, cls, html = '', style = {}, tag = 'div') {
  const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html;
  Object.assign(e.style, style); parent.appendChild(e); return e;
}
const px = (n) => n + 'px';
function show(e, o) { e.style.opacity = o; e.style.visibility = o <= 0.001 ? 'hidden' : 'visible'; }
function tf(e, x = 0, y = 0, s = 1, r = 0) { e.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`; }

// rolling number between timed values
function roll(t, keys, dur = 0.45) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t >= keys[i][0]) { const x = eo((t - keys[i][0]) / dur); v = L(keys[i - 1][1], keys[i][1], x); }
  }
  return v;
}
const at = (t, keys) => { let v = keys[0][1]; for (const [k, val] of keys) if (t >= k) v = val; return v; };

// ---------- events for the mixer ----------
const EV = [];
const ev = (t, type, extra = {}) => EV.push({ t: +t.toFixed(3), type, ...extra });
window.EV = EV;

// ---------- car drawings ----------
const BODY = {
  sedan: 'M18 112C18 97 28 90 50 86L110 78C140 52 172 40 216 39C262 38 294 52 320 74L364 82C384 86 392 97 392 112V124H18Z',
  mpv: 'M20 120V70C20 50 34 38 62 36L300 32C332 32 354 46 370 70L386 94C391 102 392 110 392 120V126H20Z',
  suv: 'M20 116C20 100 28 92 48 88L92 82C112 56 138 44 182 42L278 42C308 42 328 54 346 78L372 84C386 88 392 98 392 112V124H20Z',
  coupe: 'M18 114C18 102 26 96 46 92L120 84C150 60 182 52 222 52C262 52 292 64 318 82L366 90C384 94 392 102 392 114V124H18Z',
};
const GLASS = {
  sedan: 'M130 78C154 58 180 49 216 48C252 48 278 58 300 76Z',
  mpv: 'M64 48L292 44C320 44 338 56 350 74L64 76Z',
  suv: 'M106 80C124 60 144 52 182 51L274 51C298 51 314 60 328 78Z',
  coupe: 'M140 84C162 66 186 60 222 60C254 60 278 68 298 82Z',
};
function car(type = 'sedan', color = '#C9CDD4', w = 300, shadow = true) {
  const h = w * 0.42;
  return `<svg width="${w}" height="${h}" viewBox="0 0 410 172">
  ${shadow ? '<ellipse cx="205" cy="150" rx="190" ry="12" fill="rgba(0,0,0,.18)"/>' : ''}
  <path d="${BODY[type]}" fill="${color}"/>
  <path d="${BODY[type]}" fill="url(#none)" stroke="rgba(0,0,0,.12)" stroke-width="2"/>
  <path d="${GLASS[type]}" fill="#1B2130"/>
  <path d="M40 100H380" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
  <circle cx="104" cy="126" r="27" fill="#14161B"/><circle cx="104" cy="126" r="13" fill="#9AA0AA"/>
  <circle cx="312" cy="126" r="27" fill="#14161B"/><circle cx="312" cy="126" r="13" fill="#9AA0AA"/>
  <rect x="370" y="90" width="18" height="8" rx="3" fill="#EF4444"/>
  <rect x="22" y="92" width="18" height="8" rx="3" fill="#F8FAFC"/></svg>`;
}

const W = $('world');
const STATES = {"H0":{"price":89800,"ins":2840,"dep":0,"depPct":0,"loan":85640,"yrs":7,"ncd":0,"m":{"5":1608,"7":1202,"9":978}},"H1":{"price":89800,"ins":2840,"dep":16560,"depPct":20,"loan":69080,"yrs":7,"ncd":0,"m":{"5":1297,"7":970,"9":789}},"H2":{"price":89800,"ins":2840,"dep":16560,"depPct":20,"loan":69080,"yrs":9,"ncd":0,"m":{"5":1297,"7":970,"9":789}},"C1":{"price":89800,"ins":1283,"dep":16560,"depPct":20,"loan":67523,"yrs":9,"ncd":55,"m":{"5":1268,"7":948,"9":771}},"C2":{"price":79800,"ins":1157,"dep":14560,"depPct":20,"loan":59397,"yrs":9,"ncd":55,"m":{"5":1115,"7":834,"9":678}},"C3":{"price":79800,"ins":1157,"dep":14560,"depPct":20,"loan":59397,"yrs":7,"ncd":55,"m":{"5":1115,"7":834,"9":678}}};
const STATE_T = [[0, 'H0'], [1.0, 'H1'], [2.0, 'H2'], [4.85, 'C1'], [5.85, 'C2'], [6.75, 'C3']];

// =====================================================================
// SCENE A: hook split (Excel window). The Drevo half is the presenter window itself.
// =====================================================================
const xl = el(W, 'win a', '', { left: '60px', top: '512px', width: '960px', height: '432px' }); xl.id = 'xl';
el(xl, 'bar', `<span style="width:22px;height:22px;border-radius:5px;background:#fff;color:#1D6F42;font:700 16px O;display:flex;align-items:center;justify-content:center">X</span>${COPY.xl.file}`);
el(xl, 'rib', COPY.xl.rib.map((r, i) => `<span style="${i === 1 ? 'color:#1D6F42;font-weight:700;border-bottom:3px solid #1D6F42;padding-bottom:6px' : ''}">${r}</span>`).join(''), { height: '44px' });
el(xl, 'colh', '<div style="width:46px"></div><div style="width:514px">B</div><div style="flex:1">C</div>');
el(xl, '', '', {}).id = 'xlTitle';
$('xlTitle').textContent = 'PROTON S70 1.5TD FLAGSHIP';
const xrows = COPY.xl.rows.map((r) => { const row = el(xl, 'xr', `<div class="l">${r}</div><div class="v"></div>`); return row.querySelector('.v'); });
const xlCursor = el(xl, 'a', `<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2l15 11-7 1-3 7z" fill="#fff" stroke="#000" stroke-width="1.4"/></svg>`, { left: 0, top: 0, zIndex: 4 });
const xlStrike = el(xl, 'a', '', { left: '-20px', top: '210px', width: '1000px', height: '12px', background: '#DC2626', borderRadius: '6px', transformOrigin: '0 50%', zIndex: 6, boxShadow: '0 4px 14px rgba(220,38,38,.4)' });
const labX = el(W, 'lab a', `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/></svg><span>EXCEL · 0:00</span>`, { left: '84px', top: '488px', background: '#0B0C0F', color: '#fff' });
const labD = el(W, 'lab a', `<span>DREVO</span>`, { left: '84px', top: '934px', background: '#DC2626', color: '#fff' });

// =====================================================================
// SCENE B: presenter window (calc + budget)
// =====================================================================
const dv = el(W, 'win a', '', { left: '40px', top: '500px', width: '1000px', height: '950px' }); dv.id = 'dv';
el(dv, 'bar', `<i class="dot" style="background:#FF5F57"></i><i class="dot" style="background:#FEBC2E"></i><i class="dot" style="background:#28C840"></i><span style="margin-left:16px;font:700 22px O;color:#4B4F58">${COPY.live}</span><span style="margin-left:auto;font:700 18px O;color:#fff;background:#DC2626;padding:6px 14px;border-radius:999px">LIVE</span>`);
const dvIn = el(dv, 'a', '', { left: 0, top: '56px', width: '1000px', height: '894px', transformOrigin: '500px 447px' });
const pt = el(dvIn, 'pt', `<div class="tabs">${COPY.tabs.map((x, i) => `<div class="tab ${i === 0 ? 'on' : ''}">${x}</div>`).join('')}</div><div class="cmt">${COPY.cmt}</div>`);
const tabEls = [...pt.querySelectorAll('.tab')];
const calcC = el(dvIn, 'a', '', { left: 0, top: '76px', width: '1000px', height: '818px' });
el(calcC, 'ttl', `<div class="no">#3</div><h3>2026 Proton S70</h3>`);
const vrow = el(calcC, 'vrow', ['Executive', 'Premium', 'Flagship', 'Flagship X'].map((v) => `<div class="vc">${v}</div>`).join(''));
const vEls = [...vrow.children];
const big = el(calcC, 'big', `<b>RM 1,202</b><span>${COPY.mo}</span>`);
const bigN = big.querySelector('b');
const ten = el(calcC, 'ten', [5, 7, 9].map((y) => `<div class="tt"><small>${COPY.yrs(y)}</small><b></b></div>`).join(''));
const tEls = [...ten.children];
const dep = el(calcC, 'dep', `<span class="lb">${COPY.deposit}</span><div class="dc">RM ✎</div><div class="dc">${COPY.none}</div><div class="dc">10%</div><div class="dc">20%</div><div class="dc">30%</div>`);
const dEls = [...dep.querySelectorAll('.dc')];
const low = el(calcC, 'low', `<div class="photo">${car('sedan', '#C3C8D0', 360)}</div><div class="wk"></div>`);
const wk = low.querySelector('.wk');
const wPrice = el(wk, 'wr', `<span>${COPY.price}</span><b></b>`).querySelector('b');
const wIns = el(wk, 'wr', `<span>${COPY.ins}</span><b></b>`).querySelector('b');
const wReb = el(wk, 'wr g', `<span>${COPY.reb}</span><b>− 7,000</b>`).querySelector('b');
const wDep = el(wk, 'wr', `<span>${COPY.deposit}</span><b></b>`).querySelector('b');
const wLoan = el(wk, 'wr loan', `<span>${COPY.loan}</span><b></b>`).querySelector('b');
const wRate = el(wk, 'wr', `<span></span>`).querySelector('span');
const ncd = el(wk, 'ncd', `<span style="font:700 19px O;color:#6B6F78;align-self:center;margin-right:4px">NCD</span>` + ['0%', '25%', '30%', '38⅓%', '45%', '55%'].map((n) => `<div class="nc">${n}</div>`).join(''));
const nEls = [...ncd.querySelectorAll('.nc')];
el(calcC, 'fine', COPY.fineCalc);

// budget
const bud = el(dvIn, '', '', {}); bud.id = 'bud';
const bset = el(bud, 'bset', `<div class="mode"><div class="md on">${COPY.mMonthly}</div><div class="md">${COPY.mPay}</div></div>
  <div class="inp on" id="inA"><small>${COPY.inMonthly}</small><span>RM </span></div>
  <div class="inp" id="inB"><small>${COPY.inCommit}</small><span>RM </span></div>`);
const mdEls = [...bset.querySelectorAll('.md')];
el(bud, '', COPY.bset, { position: 'absolute', left: '28px', top: '84px', font: '500 21px O', color: '#6B6F78' });
const bcols = el(bud, 'bcols');
const hL = el(bcols, 'bh', '', { left: 0 }); const hR = el(bcols, 'bh', '', { left: '486px' });
el(bud, 'fine', COPY.fineBud);
const CARS = [
  ['S70', '1.5TD Executive', 1070, 37], ['S70', '1.5 Prime', 911, 34], ['Persona', '1.6 Premium', 846, 33], ['Saga', '1.5 Premium', 726, 31],
  ['S70', '1.5TD Flagship', 1301, 42], ['X50', '1.5TD Executive', 1301, 42], ['X50', '1.5TD Premium', 1474, 45],
];
// slot = [column, index], status for each mode
const SLOT_A = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2]];
const ST_A = ['fit', 'fit', 'fit', 'fit', 'near', 'near', 'over'];
const SLOT_B = [[1, 0], [0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [1, 3]];
const ST_B = ['near', 'fit', 'fit', 'fit', 'near', 'near', 'near'];
const DOT = { fit: '#16A34A', near: '#D97706', over: '#DC2626' };
const bRows = CARS.map(([m, v, mo]) => {
  const r = el(bcols, 'br', `<div class="th">${car(m.startsWith('X') ? 'suv' : 'sedan', '#BFC5CE', 110, false)}</div><div class="nm">Proton ${m}<small>${v}</small></div><div class="mo">${RM(mo)}<small></small></div>`);
  return r;
});
const slotXY = ([c, i]) => [c * 486, 52 + i * 110];

// =====================================================================
// SCENE C: leads board (premiumDark)
// =====================================================================
const ld = el(W, 'win a dk', '', { left: '40px', top: '500px', width: '1000px', height: '950px' }); ld.id = 'ld';
el(ld, 'bar', `<i class="dot" style="background:#3a3f48"></i><i class="dot" style="background:#3a3f48"></i><i class="dot" style="background:#3a3f48"></i><span style="margin-left:16px;font:700 22px O;color:#a3a9b5">Premium</span>`);
el(ld, 'a', `<span style="font:700 40px O">${COPY.leadT}</span><span style="margin-left:18px;font:700 20px O;background:#181b21;color:#a3a9b5;padding:8px 16px;border-radius:999px">${COPY.all} · 10</span>`, { left: '28px', top: '78px', display: 'flex', alignItems: 'center' });
const board = el(ld, '', '', {}); board.id = 'board';
const HUES = ['#3b82f6', '#eab308', '#a78bfa', '#34d399', '#fb923c', '#22c55e', '#16a34a'];
const COLW = 330, GAP = 20, BX = 28;
const colX = (i) => BX + i * (COLW + GAP);
const DEMO = [
  [['Aiman', 'Proton X50 1.5TD Premium', 'RM 101,800', 1], ['Farah', 'Proton Saga 1.5 Premium', 'RM 49,990', 3]],
  [['Ravi', 'Proton X70 1.5TD Premium', 'RM 119,800', 5]],
  [['Nurul', 'Proton Persona 1.6', 'RM 58,300', 8]],
  [['Zul', 'Proton X90 1.5TD Prime', 'RM 116,800', 20]],
  [['Mei Ling', 'Proton e.MAS 7 Premium', 'RM 119,800', 26]],
  [['Daniel', 'Proton S70 1.5 Prime', 'RM 62,800', 30]],
  [['Siti', 'Proton Saga 1.5 Standard', 'RM 38,990', 48]],
];
const colCount = [];
COPY.stages.forEach((s, i) => {
  const c = el(board, 'col', `<div class="colhd"><i style="background:${HUES[i]}"></i>${s}<span>${DEMO[i].length}</span></div>`, { left: px(colX(i)) });
  colCount.push(c.querySelector('span'));
  DEMO[i].forEach(([n, carN, pr, h], j) => el(c, 'lc', `<b>${n}</b><small>${carN}</small><span class="ago">${COPY.ago(h)}</span><span class="pr">${pr}</span>`, { top: px(56 + j * 148) }));
});
board.style.width = px(colX(7));
const hero = el(board, 'lc a', `<b>Hafiz</b><small>Proton S70 1.5TD Flagship</small><span class="ago">${COPY.justNow}</span><span class="pr">RM 89,800</span><span class="a" id="heroBadge" style="right:14px;bottom:12px;font:700 17px O;color:#08090c;background:#6ee7b7;padding:4px 12px;border-radius:999px">${COPY.won}</span>`, {}); hero.id = 'hero';
const drawer = el(ld, '', '', {}); drawer.id = 'drawer';
drawer.innerHTML = `<div style="display:flex;align-items:center;gap:18px"><div style="width:84px;height:84px;border-radius:50%;background:#2a2e36;display:flex;align-items:center;justify-content:center;font:700 36px O">H</div>
 <div><div style="font:700 40px O">Hafiz</div><div style="font:500 21px O;color:#a3a9b5">Proton S70 1.5TD Flagship · RM 89,800</div></div></div>
 <div style="display:flex;gap:10px;margin-top:20px"><span style="font:700 19px O;padding:8px 16px;border-radius:999px;background:rgba(167,139,250,.14);color:#c084fc">${COPY.stages[2]}</span><span style="font:700 19px O;padding:8px 16px;border-radius:999px;background:#181b21;color:#a3a9b5">${COPY.from}</span></div>
 <div style="display:flex;gap:12px;margin-top:26px"><div class="dbtn red" id="bWa">${COPY.wa}</div><div class="dbtn" id="bCall">${COPY.logCall}</div><div class="dbtn" id="bRem">${COPY.remind}</div></div>
 <div style="font:700 22px O;color:#848b98;margin-top:34px;letter-spacing:1px;text-transform:uppercase">${COPY.activity}</div>
 <div id="acts"><div class="act" id="actRem"><i style="background:#fbbf24"></i><b>${COPY.actRem}</b></div><div class="act" id="actCall"><i></i><b>${COPY.actCall}</b><span style="margin-left:auto">${COPY.justNow}</span></div><div class="act"><i style="background:#848b98"></i><b>${COPY.actWa}</b><span style="margin-left:auto">${COPY.ago(2)}</span></div></div>
 <div id="modal"><div style="font:700 30px O">${COPY.modalT}</div><div style="font:500 21px O;color:#a3a9b5;margin-top:6px">${COPY.modalS}</div>
 <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">${COPY.mChips.map((m, i) => `<div class="mc" id="mc${i}">${m}</div>`).join('')}</div>
 <div class="dbtn red" style="margin-top:20px;flex:none" id="bSet">${COPY.setRem}</div></div>`;
const toast1 = el(ld, 'toast', `<i></i>${COPY.toastCall}`); const toast2 = el(ld, 'toast', `<i></i>${COPY.toastRem}`);

// =====================================================================
// SCENE D: listing cards (real premiummotors counts)
// =====================================================================
const LISTS = [
  ['suv', '#E5E7EB', '2023 Lexus RX', '350 2.4L (T) F-Sport', 'RM 310,000', 131, 13],
  ['mpv', '#111827', '2025 Toyota Vellfire', '2.4L Turbo Z Premium', 'RM 340,000', 106, 6],
  ['mpv', '#F8FAFC', '2025 Toyota Alphard', '2.5L Z', 'RM 295,000', 93, 10],
];
const EYE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a3a9b5" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const WAI = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="2"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/></svg>';
const lcards = LISTS.map(([ty, col, n, v, pr], i) => {
  const c = el(W, 'lcard', `<div class="ph">${car(ty, col, 280)}<span class="pill">${COPY.avail}</span></div><div style="flex:1;min-width:0"><h4>${n}</h4><div class="var">${v}</div><div class="px">${pr}</div>
   <div class="stats"><div class="stat">${EYE}<b>0</b>${COPY.views}</div><div class="stat wa">${WAI}<b>0</b>${COPY.taps}</div></div></div>`, { top: px(540 + i * 292) });
  return c;
});

// =====================================================================
// SCENE E: TikTok Studio
// =====================================================================
const stu = el(W, 'win a dk', '', { left: '40px', top: '500px', width: '1000px', height: '950px' }); stu.id = 'stu';
el(stu, 'bar', `<i class="dot" style="background:#3a3f48"></i><i class="dot" style="background:#3a3f48"></i><i class="dot" style="background:#3a3f48"></i><span style="margin-left:16px;font:700 22px O;color:#a3a9b5">TikTok Studio</span><span style="margin-left:auto;font:700 18px O;color:#a3a9b5">9:16</span>`);
const stuIn = el(stu, 'a', '', { left: 0, top: 0, width: '1000px', height: '950px' });
el(stuIn, 'rail', '<div></div><div></div><div></div><div></div><div></div>');
const cv = el(stuIn, '', '', {}); cv.id = 'canvasA';
const photo = el(cv, 'a', `<svg width="450" height="800" viewBox="0 0 450 800"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9DB4CC"/><stop offset="1" stop-color="#E7EDF3"/></linearGradient><linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6B7076"/><stop offset="1" stop-color="#3D4146"/></linearGradient></defs>
 <rect width="450" height="800" fill="url(#sky)"/><rect x="-10" y="250" width="130" height="300" fill="#B7BEC7"/><rect x="100" y="200" width="110" height="350" fill="#A3ABB5"/><rect x="200" y="280" width="150" height="270" fill="#C4CAD2"/><rect x="330" y="230" width="140" height="320" fill="#ADB4BE"/>
 ${[...Array(18)].map((_, i) => `<rect x="${12 + (i % 6) * 72}" y="${300 + Math.floor(i / 6) * 60}" width="28" height="30" fill="rgba(255,255,255,.35)"/>`).join('')}
 <rect y="540" width="450" height="260" fill="url(#road)"/><path d="M0 680H450" stroke="#E5E7EB" stroke-width="6" stroke-dasharray="40 30"/>
 <path d="M40 560l14 46h-28z" fill="#F97316"/><path d="M400 570l14 46h-28z" fill="#F97316"/><circle cx="70" cy="230" r="36" fill="#7BA05B"/><rect x="66" y="230" width="8" height="320" fill="#6B5B45"/></svg>`, { left: 0, top: 0 });
const checker = el(cv, 'a', '', { inset: 0, backgroundColor: '#fff', backgroundImage: 'linear-gradient(45deg,#E5E7EB 25%,transparent 25%,transparent 75%,#E5E7EB 75%),linear-gradient(45deg,#E5E7EB 25%,transparent 25%,transparent 75%,#E5E7EB 75%)', backgroundSize: '40px 40px', backgroundPosition: '0 0,20px 20px' });
const bdSpot = el(cv, 'a', '', { inset: 0, background: 'radial-gradient(ellipse 60% 45% at 50% 62%,#3a3f4a,#0b0c10 70%)' });
el(bdSpot, 'a', '', { left: '75px', top: '-40px', width: '300px', height: '700px', background: 'linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0))', clipPath: 'polygon(40% 0,60% 0,100% 100%,0 100%)' });
const bdDusk = el(cv, 'a', '', { inset: 0, background: 'linear-gradient(180deg,#2B1B4A 0%,#B4436C 48%,#F59E58 64%,#3A2A3E 64.2%,#1B1424 100%)' });
const bdStudio = el(cv, 'a', '', { inset: 0, background: 'linear-gradient(180deg,#F5F5F4 0%,#E7E5E4 58%,#D6D3D1 62%,#F5F5F4 100%)' });
const carShadow = el(cv, 'a', '', { left: '35px', top: '520px', width: '380px', height: '40px', borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(0,0,0,.45),transparent)' });
const carS = el(cv, 'a', car('sedan', '#C9CED6', 420, false), { left: '15px', top: '390px' });
const scan = el(cv, 'a', '', { left: 0, width: '450px', height: '6px', background: '#fff', boxShadow: '0 0 24px 8px rgba(220,38,38,.6)', zIndex: 5 });
const tpl = el(cv, 'a', '', { inset: 0, zIndex: 6 });
const tplTop = el(tpl, 'a', `<div style="display:inline-block;background:#DC2626;color:#fff;font:700 20px O;padding:6px 14px;border-radius:8px">PROTON S70</div><div style="font:700 40px/1.05 O;color:#0B0C0F;margin-top:12px;letter-spacing:-1px">1.5TD Flagship</div>`, { left: '28px', top: '36px' });
const tplBox = el(tpl, 'a', `<div style="font:500 20px O;color:#6B6F78">${COPY.tplFrom}</div><div style="font:700 84px/1 O;color:#DC2626;letter-spacing:-3px">RM 970</div><div style="font:700 20px O;color:#0B0C0F;margin-top:6px">${COPY.tplDep}</div>`, { left: '24px', right: '24px', top: '600px', background: '#fff', borderRadius: '22px', padding: '18px 22px', boxShadow: '0 12px 30px rgba(0,0,0,.15)' });
const tplFoot = el(tpl, 'a', `Auzyvyth · PremiumMotors`, { left: 0, right: 0, top: '756px', textAlign: 'center', font: '700 18px O', color: '#57534E' });
const TOOLY = [96, 200, 304, 408];
const ICONS = ['<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 20L20 4M8 4h12v12"/></svg>',
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>',
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M5 5h14M12 5v14"/></svg>'];
const toolEls = COPY.tools.map((n, i) => el(stuIn, 'tool', `<i>${ICONS[i]}</i>${n}`, { top: px(TOOLY[i]) }));
const BDC = ['linear-gradient(180deg,#F5F5F4,#D6D3D1)', 'radial-gradient(#3a3f4a,#0b0c10)', 'repeating-linear-gradient(135deg,#1f2937 0 12px,#111827 12px 24px)', 'linear-gradient(135deg,#DC2626,#7F1D1D)', 'linear-gradient(180deg,#2B1B4A,#B4436C,#F59E58)', 'linear-gradient(180deg,#FFFFFF,#E5E7EB)'];
const bdBox = el(stuIn, 'a', '', { left: '642px', top: '520px', width: '330px', height: '260px' });
const bdEls = COPY.bds.map((n, i) => el(bdBox, 'bd', `<div style="position:absolute;inset:4px;border-radius:11px;background:${BDC[i]}"></div><div style="position:absolute;left:0;right:0;top:100px;text-align:center;font:500 16px O;color:#a3a9b5">${n}</div>`, { left: px((i % 3) * 117), top: px(Math.floor(i / 3) * 134) }));
const tpBox = el(stuIn, 'a', '', { left: '642px', top: '520px', width: '330px', height: '280px' });
const tpEls = COPY.tpls.map((n, i) => el(tpBox, 'tool', `<i style="background:${['#DC2626', '#1f2937', '#78350f'][i]}"></i>${n}`, { right: 'auto', left: 0, top: px(i * 100), width: '330px' }));
const expB = el(stuIn, 'tool', `<i style="background:rgba(255,255,255,.18)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg></i><span>${COPY.export}</span>`, { top: '820px', background: 'linear-gradient(180deg,#ef4444,#dc2626)' });
const expLabel = expB.querySelector('span');

// =====================================================================
// SCENE F: posters
// =====================================================================
const lp = el(W, 'a win', '', { left: '60px', top: '600px', width: '470px', height: '600px' }); lp.id = 'lp';
lp.innerHTML = `<div style="position:relative;height:262px;background:linear-gradient(160deg,#30363F,#0F1218);display:flex;align-items:center;justify-content:center">${car('sedan', '#C9CED6', 380)}
 <div style="position:absolute;left:22px;bottom:16px"><div style="font:700 30px O">2026 Proton S70</div><div style="font:500 20px O;color:#D1D5DB">1.5TD Flagship</div></div></div>
 <div style="padding:16px 22px 10px;display:flex;align-items:baseline;gap:12px"><span style="font:700 34px O">RM 89,800</span><span style="font:500 17px O;color:#9CA3AF">${COPY.lpWork}</span></div>
 ${[[9, 789], [7, 970], [5, 1297]].map(([y, m]) => `<div class="lpT"><small>${COPY.yrs(y)}</small><span>${RM(m)}${COPY.mo}</span></div>`).join('')}
 <div style="display:flex;align-items:center;gap:12px;padding:6px 22px"><span style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#4338CA);display:flex;align-items:center;justify-content:center;font:700 18px O">A</span><span style="font:700 19px O">Auzyvyth · PremiumMotors</span></div>`;
const lpBadge = el(W, 'a chip', 'JPEG', { left: '60px', top: '548px', height: '40px', padding: '0 18px', background: '#0B0C0F', color: '#fff', fontSize: '20px' });
const mph = el(W, 'phone', '', { left: '580px', top: '540px', width: '420px', height: '820px' });
const mps = el(mph, 'scr', '', { background: '#080C14', color: '#fff' });
mps.innerHTML = `<div style="padding:40px 26px 0"><div style="font:700 20px O;color:#F87171;letter-spacing:2px">KIRAAN LOAN</div><div style="font:700 34px/1.1 O;margin-top:8px">Proton S70<br>1.5TD Flagship</div></div>
 <div style="margin:22px 0 0;height:210px;background:linear-gradient(160deg,#30363F,#0F1218);display:flex;align-items:center;justify-content:center;overflow:hidden" id="mpPh">${car('sedan', '#C9CED6', 340)}</div>
 <div style="padding:22px 26px 0"><div style="display:flex;justify-content:space-between;font:700 20px O;color:#9CA3AF"><span>${COPY.mpDep}</span><span id="mpDepV">0%</span></div>
 <div style="height:14px;border-radius:7px;background:#1F2937;margin-top:10px;overflow:hidden"><div id="mpBar" style="height:100%;width:0;background:#DC2626;border-radius:7px"></div></div>
 <div style="font:700 74px/1 O;letter-spacing:-3px;margin-top:22px;white-space:nowrap" id="mpMo">RM 1,202</div><div style="font:500 22px O;color:#9CA3AF">${COPY.mo.replace('/', '')} · ${COPY.yrs(7)}</div>
 <div style="font:500 18px O;color:#6B7280;margin-top:14px" id="mpTake"></div></div>
 <div style="position:absolute;left:26px;right:26px;bottom:26px;height:6px;border-radius:3px;background:#1F2937"><div id="mpProg" style="height:100%;width:0;background:#fff;border-radius:3px"></div></div>`;
const mpBadge = el(W, 'a chip', '▶ MP4', { left: '600px', top: '488px', height: '40px', padding: '0 18px', background: '#DC2626', color: '#fff', fontSize: '20px' });

// =====================================================================
// SCENE G: mini page phone (premiummotors)
// =====================================================================
const mp = el(W, 'phone', '', { left: '260px', top: '505px', width: '560px', height: '940px', transformOrigin: '280px 60px' });
const mpScr = el(mp, 'scr', '', { background: '#EEF2FD' });
const urlB = el(mpScr, 'url', `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#33363d" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span id="urlT"></span><span id="caret" style="width:3px;height:30px;background:#2563EB"></span>`);
const mpc = el(mpScr, 'a', '', { left: 0, top: '86px', width: '528px' });
const MCARS = [['suv', '#E5E7EB', '2023 Lexus RX', '350 2.4L (T) F-Sport', 'RM 310,000'], ['mpv', '#111827', '2025 Toyota Vellfire', '2.4L Turbo Z Premium', 'RM 340,000'],
  ['mpv', '#F8FAFC', '2025 Toyota Alphard', '2.5L Z', 'RM 295,000'], ['suv', '#4B5320', '2020 Land Rover Defender', '110 S', 'RM 305,000'],
  ['coupe', '#B91C1C', '2025 Toyota GR86', '2.4L RZ', 'RM 175,000'], ['coupe', '#1E3A8A', '2023 BMW Z4', 'sDrive20i M Sport', 'RM 225,000'],
  ['sedan', '#F1F5F9', '2025 Honda Civic', 'FL5 Type R 2.0L', 'RM 250,000'], ['coupe', '#0F766E', '2022 MINI Cooper', 'Works 3-door', 'RM 170,000']];
mpc.innerHTML = `<div style="height:210px;background:linear-gradient(120deg,#2563EB,#4338CA);position:relative;overflow:hidden"><div style="position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(255,255,255,.28),transparent 45%)"></div><div style="position:absolute;left:0;right:0;bottom:0;height:80px;background:linear-gradient(transparent,rgba(238,242,253,.6))"></div></div>
 <div style="position:absolute;left:28px;top:140px;width:132px;height:132px;border-radius:50%;padding:6px;background:linear-gradient(135deg,#2563EB,#4338CA)"><div style="width:100%;height:100%;border-radius:50%;border:5px solid #EEF2FD;background:linear-gradient(135deg,#1E293B,#334155);display:flex;align-items:center;justify-content:center;font:700 52px O;color:#fff">A</div></div>
 <div style="padding:76px 28px 0"><div style="display:flex;align-items:center;gap:10px;font:700 40px O;color:#0B0C0F">Auzyvyth<svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2563EB"/><path d="M7 12.5l3 3 7-7" stroke="#fff" stroke-width="2.6" fill="none"/></svg></div>
 <div style="font:500 21px O;color:#4B5563;margin-top:4px">${COPY.role}</div><div style="font:500 20px O;color:#6B7280;margin-top:2px">Kuala Lumpur</div>
 <div style="font:500 21px/1.35 O;color:#1F2937;margin-top:14px">${COPY.bio}</div>
 <div style="display:flex;gap:10px;margin-top:16px"><span style="font:700 18px O;background:#fff;padding:8px 14px;border-radius:999px;color:#1E3A8A">${COPY.carsN}</span><span style="font:700 18px O;background:#fff;padding:8px 14px;border-radius:999px;color:#1E3A8A">${COPY.verified}</span></div>
 <div style="display:flex;gap:12px;margin-top:18px"><div style="flex:1;height:68px;border-radius:18px;background:linear-gradient(180deg,#3B82F6,#2563EB);box-shadow:0 2px 0 #1E40AF,0 10px 24px rgba(37,99,235,.35);color:#fff;font:700 24px O;display:flex;align-items:center;justify-content:center;gap:10px">${WAI.replace('#6ee7b7', '#fff')}WhatsApp</div><div style="width:68px;height:68px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E3A8A" stroke-width="2.2"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/></svg></div></div>
 <div style="font:700 26px O;color:#0B0C0F;margin-top:28px">${COPY.myCars}</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">${MCARS.map(([ty, col, n, v, pr]) => `<div class="car2"><div class="im">${car(ty, col, 210)}</div><div class="tx">${n}<small>${v}</small><em>${pr}</em></div></div>`).join('')}</div></div>`;
const URL = 'drevo.my/s/premiummotors';

// laptop for the devices shot
const lap = el(W, 'a', '', { left: '40px', top: '720px', width: '640px', height: '440px' });
lap.innerHTML = `<div style="position:absolute;left:30px;right:30px;top:0;height:390px;border-radius:22px 22px 6px 6px;background:#0B0C0F;padding:14px"><div style="width:100%;height:100%;border-radius:10px;background:#fff;overflow:hidden;padding:20px 22px;--acc:#DC2626">
 <div style="display:flex;gap:6px"><span class="tab on" style="font-size:15px;padding:6px 14px">${COPY.tabs[0]}</span><span class="tab" style="font-size:15px;padding:6px 14px">${COPY.tabs[1]}</span></div>
 <div style="display:flex;align-items:center;gap:10px;margin-top:12px"><span class="no" style="font-size:20px;padding:3px 10px">#3</span><b style="font:700 22px O">2026 Proton S70</b></div>
 <div style="font:700 74px/1 O;color:#DC2626;letter-spacing:-3px;margin-top:10px">RM 834<span style="font-size:20px;color:#6B6F78;letter-spacing:0"> ${COPY.mo}</span></div>
 <div style="display:flex;gap:8px;margin-top:12px">${[[5, 1115], [7, 834], [9, 678]].map(([y, m]) => `<div class="tt ${y === 7 ? 'on' : ''}" style="padding:8px 10px;border-radius:12px"><small style="font-size:13px">${COPY.yrs(y)}</small><b style="font-size:19px">${RM(m)}</b></div>`).join('')}</div>
 <div style="display:flex;gap:6px;margin-top:12px">${[COPY.none, '10%', '20%', '30%'].map((d, i) => `<span class="dc ${i === 2 ? 'on' : ''}" style="font-size:15px;padding:6px 12px">${d}</span>`).join('')}</div></div></div>
 <div style="position:absolute;left:0;right:0;top:388px;height:30px;border-radius:4px 4px 22px 22px;background:linear-gradient(180deg,#D4D4D8,#A1A1AA)"></div>`;

// =====================================================================
// SCENE H: CTA
// =====================================================================
const cta = el(W, '', '', {}); cta.id = 'cta';
const ctaEb = el(cta, 'a', `<span style="display:inline-flex;align-items:center;gap:14px"><i style="width:12px;height:12px;border-radius:50%;background:#DC2626;display:inline-block"></i>${COPY.ctaEb}</span>`, { left: 0, right: 0, top: '470px', textAlign: 'center', font: '700 30px O', letterSpacing: '4px', color: '#DC2626', textTransform: 'uppercase' });
const cta1 = el(cta, 'a', COPY.cta1, { left: 0, right: 0, top: '540px', textAlign: 'center', font: '700 128px/1 O', letterSpacing: '-5px' });
const cta2 = el(cta, 'a', `<span style="background-image:linear-gradient(rgba(220,38,38,.22),rgba(220,38,38,.22));background-repeat:no-repeat;background-position:0 86%;background-size:100% 26%" id="cta2u">${COPY.cta2}</span>`, { left: 0, right: 0, top: '676px', textAlign: 'center', font: '700 112px/1 O', letterSpacing: '-4px', color: '#DC2626' });
const cta3 = el(cta, 'a', COPY.cta3, { left: '80px', right: '80px', top: '840px', textAlign: 'center', font: '500 36px/1.35 O', color: '#4B4F58' });
const ctaBtn = el(cta, 'btn', `drevo.my <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`, { top: '960px' });
const tagEl = el(cta, 'a', `<span style="width:52px;height:52px;border-radius:50%;background:#0B0C0F;color:#fff;display:inline-flex;align-items:center;justify-content:center;font:700 28px O">@</span>${COPY.tag}`, { left: 0, right: 0, top: '1140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', font: '700 36px O' });
const recapBox = el(cta, 'a', '', { left: '60px', right: '60px', top: '1250px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' });
const recapEls = COPY.recap.map((r) => el(recapBox, 'chip', r, { height: '54px', padding: '0 22px', background: '#fff', border: '2px solid rgba(11,12,15,.08)', fontSize: '23px' }));

// =====================================================================
// HEADLINES
// =====================================================================
const HEADS = COPY.heads.map(([t0, t1, eb, txt], i) => {
  const words = []; let red = false;
  txt.split(' ').forEach((w) => {
    let r = red; if (w.startsWith('*')) { r = true; w = w.slice(1); }
    let end = false; if (w.endsWith('*')) { end = true; w = w.slice(0, -1); } else if (w.includes('*')) { end = true; w = w.replace('*', ''); }
    words.push({ w, r }); red = r && !end;
  });
  return { t0, t1, eb, words, instant: i === 0 };
});
HEADS.forEach((h) => h.words.forEach((w, i) => { if (!h.instant) ev(h.t0 + i * 0.07, 'pop', { g: w.r ? 1 : 0.55 }); else if (w.r) ev(0.3 + i * 0.06, 'pop', { g: 1 }); }));
let curHead = -1;
function renderHead(t) {
  const idx = HEADS.findIndex((h) => t >= h.t0 - 0.001 && t < h.t1 + 0.25);
  const h1 = $('h1'), eb = $('eyebrow');
  if (idx !== curHead) {
    curHead = idx;
    if (idx < 0) { h1.innerHTML = ''; eb.innerHTML = ''; }
    else { const h = HEADS[idx]; eb.innerHTML = `<i></i>${h.eb}`; h1.innerHTML = h.words.map((w) => `<span class="w${w.r ? ' r' : ''}">${w.w}</span>`).join(''); }
  }
  if (idx < 0) return;
  const h = HEADS[idx];
  const out = eo(P(t, h.t1, 0.22));
  const ebIn = h.instant ? 1 : eo(P(t, h.t0, 0.25));
  eb.style.opacity = ebIn * (1 - out); eb.style.transform = `translateY(${(1 - ebIn) * 16 - out * 30}px)`;
  [...h1.children].forEach((s, i) => {
    const w = h.words[i];
    let p = h.instant ? 1 : back(P(t, h.t0 + (h.instant ? 0.3 : 0) + i * 0.07, 0.42));
    const o = h.instant ? 1 : C(P(t, h.t0 + (h.instant ? 0.3 : 0) + i * 0.07, 0.12));
    const y = (1 - p) * 70 - out * (60 + i * 6);
    s.style.opacity = o * (1 - out);
    const pulse = h.instant && w.r ? 1 + 0.08 * Math.sin(P(t, 0.3 + i * 0.06, 0.35) * Math.PI) : 1;
    s.style.transform = `translateY(${y}px) scale(${(0.86 + 0.14 * C(p, 0, 1.2)) * pulse})`;
    if (w.r) { const u = eo(P(t, h.t0 + (h.instant ? 0.2 : 0.35) + i * 0.07, 0.4)); s.style.backgroundSize = `${u * 100}% 26%`; }
  });
}

// =====================================================================
// CURSOR + CLICKS (measured from the live DOM every frame)
// =====================================================================
const CLICKS = [];
const click = (t, get, kind = 'click') => { CLICKS.push({ t, get }); ev(t, kind); };
const cursor = $('cursor'), tap = $('tap');
function rectC(e) { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
const CURSOR_ON = [[0.4, 3.4], [4.2, 11.8], [13.3, 17.6], [23.4, 29.8]];

// ---------- schedule ----------
click(1.0, () => dEls[3]); click(2.0, () => tEls[2]);
click(4.85, () => nEls[5]); click(5.85, () => vEls[1]); click(6.75, () => tEls[1]); click(7.8, () => tabEls[1]);
click(9.95, () => mdEls[1]);
click(14.15, () => hero); click(15.0, () => $('bCall')); click(15.75, () => $('bRem')); click(16.3, () => $('mc0')); click(16.7, () => $('bSet'));
click(23.85, () => toolEls[1]); click(25.4, () => toolEls[2]); click(25.85, () => bdEls[1]); click(26.35, () => bdEls[4]); click(26.85, () => bdEls[0]);
click(27.5, () => toolEls[0]); click(27.95, () => tpEls[0]); click(29.1, () => expB, 'shutter');
// typing
[8.25, 8.36, 8.47, 8.58, 8.69].forEach((t) => ev(t, 'key'));
[10.1, 10.2, 10.3, 10.4, 10.5, 10.62, 10.72, 10.82].forEach((t) => ev(t, 'key'));
[...URL].forEach((_, i) => ev(35.15 + i * 0.05, 'key', { g: 0.6 }));
[1.05, 1.4, 1.75, 2.1, 2.45].forEach((t) => ev(t, 'key', { g: 0.8, pan: -0.4 }));
// transitions and accents
[[3.45, 'crumple'], [3.95, 'whoosh'], [7.9, 'swish'], [11.95, 'whoosh'], [14.3, 'swish'], [17.4, 'swish'], [19.95, 'whoosh'], [22.85, 'swish'], [23.0, 'whoosh'], [30.9, 'whoosh'], [31.6, 'swish'], [34.85, 'whoosh'], [36.9, 'swish'], [40.95, 'whoosh']].forEach(([t, k]) => ev(t, k));
[[2.55, 'ding'], [15.1, 'chime'], [16.85, 'chime'], [19.3, 'win'], [43.0, 'impact'], [4.0, 'impact', { g: 0.6 }], [28.0, 'sparkle'], [24.05, 'scan']].forEach(([t, k, x]) => ev(t, k, x || {}));
[1.0, 2.0, 4.85, 5.85, 6.75, 20.4, 20.55, 20.7, 32.4].forEach((t) => ev(t, 'tick'));
[12.3, 12.8, 13.4, 17.8, 18.3, 18.8, 19.3].forEach((t, i) => ev(t, 'hop', { n: i }));
[20.05, 20.2, 20.35, 31.0, 31.6, 41.2, 41.4].forEach((t) => ev(t, 'pop', { g: 0.7 }));
recapEls.forEach((_, i) => ev(44.6 + i * 0.12, 'pop', { g: 0.5 }));
ev(3.0, 'strike'); ev(42.55, 'drop');

// =====================================================================
// RENDER
// =====================================================================
function render(t) {
  // ---------- background drift ----------
  $('dots').style.transform = `translate(${Math.sin(t * 0.25) * 18}px,${-t * 6 % 36}px)`;
  $('glow').style.transform = `translate(${Math.sin(t * 0.4) * 120}px,${Math.cos(t * 0.3) * 80}px)`;

  renderHead(t);

  // ---------- hook: Excel ----------
  const xOut = P(t, 3.35, 0.55);
  if (t < 3.95) {
    show(xl, 1 - ei(xOut));
    const crumple = eio(xOut);
    xl.style.transform = `translate(${-crumple * 300}px,${-crumple * 260}px) scale(${1 - 0.65 * crumple}) rotate(${-crumple * 24}deg)`;
    xl.style.filter = `blur(${crumple * 6}px)`;
    xl.style.borderRadius = `${28 + crumple * 160}px`;
  } else show(xl, 0);
  const xIn = spr(P(t, 0, 0.5));
  if (t < 0.5) xl.style.transform = `translateY(${(1 - xIn) * -40}px)`;
  // excel typing + cursor
  const typed = ['', '1', '16', '162', '1,620', '16,200'][Math.min(5, [1.05, 1.4, 1.75, 2.1, 2.45].filter((k) => t >= k).length)];
  xrows[0].textContent = 'RM 89,800.00'; xrows[1].textContent = '- RM 7,000.00';
  xrows[2].textContent = typed ? typed + (t < 2.7 ? '|' : '.00') : ''; xrows[2].parentElement.classList.toggle('xsel', t > 0.95);
  const okX = t >= 2.75;
  xrows[3].textContent = okX ? 'RM 69,400.00' : '#VALUE!';
  xrows[4].textContent = '2.30%';
  xrows[5].textContent = okX ? 'RM 775.63' : '#VALUE!';
  xrows[6].textContent = okX ? 'RM 959.21' : '#VALUE!';
  [3, 5, 6].forEach((i) => { xrows[i].style.color = okX ? '#111' : '#B91C1C'; });
  const cxk = [[0, [180, 380]], [0.35, [660, 150]], [0.6, [420, 300]], [0.9, [700, 250]], [3.3, [720, 262]]];
  const cp = kf(t, cxk); xlCursor.style.transform = `translate(${cp[0]}px,${cp[1]}px)`;
  xlStrike.style.transform = `rotate(-8deg) scaleX(${eo(P(t, 3.0, 0.3))})`;
  // labels
  const secs = Math.floor(C(t, 0, 3.3) * 9);
  labX.querySelector('span').textContent = `${COPY.excel} · 0:${String(secs).padStart(2, '0')}`;
  show(labX, (t < 0.2 ? eo(P(t, 0, 0.2)) : 1) * (1 - eo(P(t, 3.3, 0.25))));
  labD.querySelector('span').textContent = t >= 2.5 ? `${COPY.drevo} · ${COPY.done}` : COPY.drevo;
  
  show(labD, (1 - eo(P(t, 3.5, 0.25))));
  labD.style.transform = `scale(${t >= 2.5 ? 1 + 0.12 * Math.sin(P(t, 2.5, 0.35) * Math.PI) : 1})`;

  // ---------- presenter window ----------
  const grow = eio(P(t, 3.55, 0.75));
  const dvOn = t < 12.4;
  show(dv, dvOn ? 1 : 0);
  if (dvOn) {
    const topY = L(958 - 56, 500, grow);
    const botClip = L(950 - 56 - 500, 0, grow), topClip = L(56, 0, grow);
    dv.style.top = px(topY);
    dv.style.clipPath = `inset(${topClip}px 0 ${botClip}px 0 round 28px)`;
    // whip out to the leads board
    const wOut = eio(P(t, 11.9, 0.45));
    let camO = [500, 447], camS = 1;
    if (t > 4.2 && t < 8) {
      const k = kf(t, [[4.2, [500, 447, 1]], [4.6, [500, 700, 1.05]], [5.35, [500, 700, 1.05]], [5.6, [30, 200, 1.2]], [6.25, [30, 200, 1.2]], [6.45, [30, 330, 1.16]], [7.3, [30, 330, 1.16]], [7.6, [200, 30, 1.1]], [7.95, [500, 447, 1]]]);
      camO = [k[0], k[1]]; camS = k[2];
    } else if (t >= 8) { camS = 1 + 0.04 * eio(P(t, 8.5, 3)); }
    dvIn.style.transformOrigin = `${camO[0]}px ${camO[1]}px`;
    dvIn.style.transform = `scale(${camS})`;
    dv.style.transform = `translateX(${-wOut * 1250}px) rotate(${-wOut * 4}deg)`;
    dv.style.filter = `blur(${Math.sin(wOut * Math.PI) * 8}px)`;
    // state
    const sk = at(t, STATE_T); const S = STATES[sk];
    const keysFor = (f) => STATE_T.map(([k, s]) => [k, f(STATES[s])]);
    bigN.textContent = RM(roll(t, keysFor((s) => s.m[s.yrs])));
    tEls.forEach((e, i) => { const y = [5, 7, 9][i]; e.querySelector('b').textContent = RM(roll(t, keysFor((s) => s.m[y]))); e.classList.toggle('on', S.yrs === y); });
    const dsel = { 0: 1, 10: 2, 20: 3, 30: 4 }[S.depPct];
    dEls.forEach((e, i) => e.classList.toggle('on', i === dsel));
    vEls.forEach((e, i) => e.classList.toggle('on', i === (S.price === 89800 ? 2 : 1)));
    nEls.forEach((e, i) => e.classList.toggle('on', i === (S.ncd === 55 ? 5 : 0)));
    wPrice.textContent = fmt(roll(t, keysFor((s) => s.price)));
    wIns.textContent = '+ ' + fmt(roll(t, keysFor((s) => s.ins)));
    wDep.textContent = '− ' + fmt(roll(t, keysFor((s) => s.dep)));
    wLoan.textContent = RM(roll(t, keysFor((s) => s.loan)));
    wRate.textContent = COPY.rate(S.yrs);
    // pop the thing just tapped
    for (const c of CLICKS) { const d = t - c.t; if (d >= 0 && d < 0.3) { const e = c.get(); if (e && dv.contains(e)) e.style.transform = `scale(${1 - 0.1 * Math.sin(d / 0.3 * Math.PI)})`; } }
    [...dEls, ...tEls, ...vEls, ...nEls, ...mdEls, ...tabEls].forEach((e) => { if (!CLICKS.some((c) => t - c.t >= 0 && t - c.t < 0.3 && c.get() === e)) e.style.transform = ''; });
    // budget switch
    const bIn = eio(P(t, 7.9, 0.4));
    tabEls.forEach((e, i) => e.classList.toggle('on', i === (t >= 7.85 ? 1 : 0)));
    calcC.style.transform = `translateX(${-bIn * 260}px)`; show(calcC, 1 - bIn);
    bud.style.transform = `translateX(${(1 - bIn) * 260}px)`; show(bud, bIn);
    if (t > 7.8) renderBudget(t);
  }

  // ---------- leads ----------
  const ldIn = eio(P(t, 11.95, 0.45)), ldOut = eio(P(t, 19.9, 0.35));
  show(ld, t > 11.9 && t < 20.3 ? 1 : 0);
  if (t > 11.9 && t < 20.3) {
    ld.style.transform = `translateX(${(1 - ldIn) * 1200}px) rotate(${(1 - ldIn) * 4}deg) translateY(${-ldOut * 120}px) scale(${1 - 0.08 * ldOut})`;
    ld.style.filter = `blur(${Math.sin(ldIn * Math.PI) * 8 + ldOut * 8}px)`;
    show(ld, t < 19.9 ? 1 : 1 - ldOut);
    renderLeads(t);
  }

  // ---------- listings ----------
  lcards.forEach((c, i) => {
    const tin = 20.05 + i * 0.15, tout = 22.85 + i * 0.06;
    const pin = spr(P(t, tin, 0.6)), pout = eio(P(t, tout, 0.3));
    const vis = t > tin - 0.01 && t < tout + 0.35;
    show(c, vis ? C(P(t, tin, 0.15)) * (1 - pout) : 0);
    if (!vis) return;
    c.style.transform = `translateX(${(1 - pin) * 420 - pout * 700}px) rotate(${(1 - C(pin)) * 3}deg)`;
    const [, , , , , v, w] = LISTS[i];
    const k = eo(P(t, 20.4 + i * 0.15, 1.3));
    const st = c.querySelectorAll('.stat b'); st[0].textContent = Math.round(v * k); st[1].textContent = Math.round(w * k);
    const glow = Math.sin(P(t, 21.9 + i * 0.1, 0.6) * Math.PI);
    c.querySelector('.stat.wa').style.boxShadow = `0 0 0 ${glow * 5}px rgba(110,231,183,${0.35 * glow})`;
  });

  // ---------- studio ----------
  const sIn = spr(P(t, 23.0, 0.6)), sOut = eio(P(t, 30.9, 0.4));
  const sVis = t > 22.99 && t < 31.35;
  show(stu, sVis ? C(P(t, 23.0, 0.2)) * (1 - sOut) : 0);
  if (sVis) {
    stu.style.transform = `translateY(${(1 - C(sIn)) * 140 - sOut * 200}px) scale(${0.92 + 0.08 * C(sIn, 0, 1.1) - 0.1 * sOut})`;
    const k = kf(t, [[23.3, [300, 500, 1]], [23.75, [300, 500, 1]], [24.1, [380, 480, 1.08]], [25.1, [380, 480, 1.08]], [25.4, [500, 475, 1]], [27.9, [500, 475, 1]], [28.4, [380, 500, 1.12]], [30.8, [380, 500, 1.16]]]);
    stuIn.style.transformOrigin = `${k[0]}px ${k[1]}px`; stuIn.style.transform = `scale(${k[2]})`;
    renderStudio(t);
  }

  // ---------- posters ----------
  const lpIn = spr(P(t, 31.0, 0.6)), mIn = spr(P(t, 31.6, 0.6)), pOut = eio(P(t, 34.85, 0.35));
  const pVis = t > 30.99 && t < 35.3;
  show(lp, pVis ? C(P(t, 31, 0.15)) * (1 - pOut) : 0); show(lpBadge, pVis ? C(P(t, 31.2, 0.2)) * (1 - pOut) : 0);
  show(mph, pVis && t > 31.59 ? C(P(t, 31.6, 0.15)) * (1 - pOut) : 0); show(mpBadge, pVis ? C(P(t, 31.8, 0.2)) * (1 - pOut) : 0);
  if (pVis) {
    lp.style.transform = `translateX(${(1 - lpIn) * -500}px) rotate(${-3 + (1 - C(lpIn)) * -6}deg) translateY(${pOut * 300}px)`;
    lpBadge.style.transform = lp.style.transform;
    mph.style.transform = `translateX(${(1 - mIn) * 520}px) rotate(${3 + (1 - C(mIn)) * 6}deg) translateY(${pOut * 300}px)`;
    mpBadge.style.transform = mph.style.transform;
    const d = eio(P(t, 32.3, 1.6));
    $('mpBar').style.width = (d * 30 / 30 * 100) + '%';
    $('mpDepV').textContent = Math.round(d * 30) + '%';
    $('mpMo').textContent = RM(L(1202, 854, d));
    $('mpTake').textContent = `${COPY.mpTake} ${RM(L(3500, 2500, d))} (35%)`;
    $('mpProg').style.width = (C((t - 31.6) / 3.3) * 100) + '%';
    $('mpPh').firstElementChild.style.transform = `scale(${1 + 0.06 * C((t - 31.6) / 3)})`;
  }

  // ---------- mini page ----------
  const mVis = t > 34.99 && t < 43.2;
  const mIn2 = spr(P(t, 35.0, 0.6));
  show(mp, mVis ? C(P(t, 35, 0.15)) * (1 - eio(P(t, 42.55, 0.4))) : 0);
  if (mVis) {
    const n = Math.floor(C((t - 35.15) / 0.05, 0, URL.length));
    const s = URL.slice(0, n);
    $('urlT').innerHTML = s.length > 11 ? `${s.slice(0, 11)}<b>${s.slice(11)}</b>` : s;
    $('caret').style.opacity = t < 36.6 ? (Math.floor(t * 4) % 2 ? 1 : 0.15) : 0;
    urlB.style.boxShadow = `0 0 0 ${Math.sin(P(t, 36.5, 0.5) * Math.PI) * 6}px rgba(37,99,235,.35)`;
    const z = kf(t, [[35.0, 1.85], [36.85, 1.85], [37.6, 1], [40.9, 1]]);
    const dev = eio(P(t, 41.0, 0.6));
    const ox = L(0, 345, dev), oy = L((1 - C(mIn2)) * 200, 140, dev), sc = L(1, 0.62, dev) * (1 - 0.15 * eio(P(t, 42.55, 0.4)));
    mp.style.transform = `translate(${ox}px,${oy - eio(P(t, 42.55, 0.4)) * 160}px) scale(${z * sc})`;
    mpc.style.transform = `translateY(${-eio(P(t, 38.3, 1.9)) * 640}px)`;
  }
  const lapIn = eo(P(t, 41.05, 0.6)), lapOut = eio(P(t, 42.55, 0.4));
  show(lap, t > 41 && t < 43.2 ? C(P(t, 41.05, 0.25)) * (1 - lapOut) : 0);
  lap.style.transform = `translate(${(1 - lapIn) * -400}px,${-lapOut * 160}px) scale(${1 - 0.15 * lapOut})`;

  // ---------- CTA ----------
  const cOn = t > 42.95;
  show(cta, cOn ? 1 : 0);
  if (cOn) {
    const a = (d, s, dur = 0.5) => back(P(t, d, dur));
    [[ctaEb, 43.0], [cta1, 43.05], [cta2, 43.25], [cta3, 43.8], [ctaBtn, 44.1], [tagEl, 44.35]].forEach(([e, d]) => {
      const p = a(d); show(e, C(P(t, d, 0.12))); e.style.transform = `translateY(${(1 - p) * 70}px) scale(${0.9 + 0.1 * C(p, 0, 1.1)})`;
    });
    $('cta2u').style.backgroundSize = `${eo(P(t, 43.6, 0.45)) * 100}% 26%`;
    const pulse = t > 45 ? 1 + 0.03 * Math.sin((t - 45) * Math.PI * 2) : 1;
    ctaBtn.style.transform += ` scale(${pulse})`;
    recapEls.forEach((e, i) => { const p = back(P(t, 44.6 + i * 0.12, 0.45)); show(e, C(P(t, 44.6 + i * 0.12, 0.1))); e.style.transform = `translateY(${(1 - p) * 40}px) scale(${0.85 + 0.15 * C(p, 0, 1.1)})`; });
  }

  // ---------- pill + foot ----------
  const pillOn = t > 4.3 && t < 42.6 && !(t > 35.05 && t < 40.9);
  const pp = back(P(t, 4.3, 0.5)) * (1 - eio(P(t, 42.45, 0.3)));
  show($('pill'), pillOn ? C(P(t, 4.3, 0.15)) * (1 - eio(P(t, 42.45, 0.3))) * C(P(t, 40.9, 0.25) + (t < 35 ? 1 : 0)) : 0);
  $('pill').style.transform = `translateY(${(1 - C(pp, 0, 1.1)) * 50}px)`;
  $('pill').innerHTML = COPY.pill;
  const foot = t < 12 ? COPY.foots.calc : t < 20 ? COPY.foots.demo : t < 23 ? COPY.foots.real : t < 35 ? COPY.foots.demo : t < 42.5 ? COPY.foots.real : '';
  $('foot').textContent = foot;
  show($('foot'), t > 4.3 && t < 42.5 && !(t > 35.05 && t < 40.9) ? 1 : 0);

  // ---------- flash on the CTA impact ----------
  $('flash').style.opacity = 0.7 * (1 - eo(P(t, 43.0, 0.35))) * (t >= 43 ? 1 : 0);

  // ---------- cursor ----------
  renderCursor(t);
}

function renderBudget(t) {
  const payMode = t >= 9.95;
  mdEls.forEach((e, i) => e.classList.toggle('on', i === (payMode ? 1 : 0)));
  const inA = $('inA'), inB = $('inB');
  const typeIn = (s, t0, step) => s.slice(0, Math.max(0, Math.min(s.length, Math.floor((t - t0) / step) + 1)));
  if (!payMode) {
    inA.querySelector('small').textContent = COPY.inMonthly;
    inA.querySelector('span').textContent = 'RM ' + (t >= 8.25 ? typeIn('1,100', 8.25, 0.11) : '');
    show(inB, 0);
  } else {
    inA.querySelector('small').textContent = COPY.inPay;
    inA.querySelector('span').textContent = 'RM ' + (t >= 10.1 ? typeIn('5,000', 10.1, 0.1) : '');
    show(inB, eo(P(t, 9.95, 0.25)));
    inB.querySelector('span').textContent = 'RM ' + (t >= 10.62 ? typeIn('800', 10.62, 0.1) : '');
    inB.classList.toggle('on', t >= 10.6); inA.classList.toggle('on', t < 10.6);
  }
  const sorted = t >= 10.9;
  hL.innerHTML = `<i style="background:${DOT.fit}"></i>${sorted ? COPY.hComfy : COPY.hFit}`;
  hR.innerHTML = `<i style="background:${DOT.near}"></i>${sorted ? COPY.hTight : COPY.hNear}`;
  bRows.forEach((r, i) => {
    const tin = 8.75 + i * 0.06;
    const pin = back(P(t, tin, 0.45));
    const m = eio(P(t, 10.9 + i * 0.045, 0.5));
    const [ax, ay] = slotXY(SLOT_A[i]), [bx, by] = slotXY(SLOT_B[i]);
    const x = L(ax, bx, m), y = L(ay, by, m) - Math.sin(m * Math.PI) * 30;
    show(r, C(P(t, tin, 0.12)));
    r.style.left = px(x); r.style.top = px(y);
    r.style.transform = `translateY(${(1 - pin) * 60}px) scale(${(0.9 + 0.1 * C(pin, 0, 1.1)) * (1 + Math.sin(m * Math.PI) * 0.04)})`;
    const stt = sorted ? ST_B[i] : ST_A[i];
    const sm = r.querySelector('.mo small');
    sm.textContent = sorted ? COPY.dsr(CARS[i][3]) : { fit: COPY.stFit, near: COPY.stNear, over: COPY.stOver }[stt];
    sm.style.color = DOT[stt];
    r.style.zIndex = Math.sin(m * Math.PI) > 0.1 ? 3 : 1;
  });
}

function renderLeads(t) {
  // hero hops between stage columns on beats
  const hops = [[12.3, 0], [12.8, 1], [13.4, 2], [17.8, 3], [18.3, 4], [18.8, 5], [19.3, 6]];
  let pos = 0, lift = 0;
  for (let i = 0; i < hops.length; i++) {
    if (t >= hops[i][0]) {
      const x = eio(P(t, hops[i][0], 0.38)); const from = i ? hops[i - 1][1] : 0;
      pos = L(from, hops[i][1], x); lift = Math.sin(x * Math.PI);
    }
  }
  const hx = colX(pos) + 16, hy = (pos < 0.5 ? 352 : 204);
  const hin = back(P(t, 12.3, 0.4));
  hero.style.left = px(hx); hero.style.top = px(L(352, 204, C(pos)) - lift * 40 + 56 * 0);
  hero.style.transform = `scale(${(0.6 + 0.4 * C(hin, 0, 1.1)) * (1 + lift * 0.06)}) rotate(${lift * -3}deg)`;
  show(hero, C(P(t, 12.3, 0.1)));
  const isWon = t >= 19.5;
  hero.style.boxShadow = isWon ? `0 0 0 ${3 + 3 * Math.sin(P(t, 19.5, 0.6) * Math.PI)}px rgba(110,231,183,.6),0 24px 50px rgba(0,0,0,.5)` : '';
  show($('heroBadge'), eo(P(t, 19.5, 0.25)));
  // column counts
  const nowCol = Math.round(pos);
  colCount.forEach((c, i) => { c.textContent = DEMO[i].length + (t >= 12.3 && nowCol === i ? 1 : 0); });
  // camera follows the hero (board pans)
  const camX = C(-(colX(pos) - 335), -(colX(7) - 1000 + BX), 0);
  board.style.transform = `translateX(${camX}px)`;
  // drawer
  const dIn = eio(P(t, 14.3, 0.35)), dOut = eio(P(t, 17.35, 0.3));
  const dp = dIn * (1 - dOut);
  show(drawer, dp > 0.001 ? 1 : 0);
  drawer.style.left = px(1000 - 620 * dp);
  show($('actCall'), eo(P(t, 15.1, 0.3))); $('actCall').style.transform = `translateY(${(1 - eo(P(t, 15.1, 0.3))) * -20}px)`;
  show($('actRem'), eo(P(t, 16.85, 0.3))); $('actRem').style.transform = `translateY(${(1 - eo(P(t, 16.85, 0.3))) * -20}px)`;
  $('actCall').style.display = t >= 15.1 ? 'flex' : 'none';
  $('actRem').style.display = t >= 16.85 ? 'flex' : 'none';
  const mIn = eio(P(t, 15.85, 0.3)), mOut = eio(P(t, 16.8, 0.25));
  const mm = $('modal');
  show(mm, mIn * (1 - mOut) > 0.001 ? 1 : 0);
  mm.style.transform = `translateY(${(1 - mIn + mOut) * 420}px)`;
  $('mc0').classList.toggle('on', t >= 16.3);
  const tst = (e, t0) => { const a = eo(P(t, t0, 0.25)), b = eio(P(t, t0 + 0.75, 0.25)); show(e, a * (1 - b)); e.style.transform = `translateX(-50%) translateY(${(1 - a) * -30}px)`; };
  tst(toast1, 15.1); tst(toast2, 16.85);
  for (const c of CLICKS) { const d = t - c.t; const e = c.get && d > -0.01 && d < 0.3 ? c.get() : null; if (e && ld.contains(e) && e !== hero) e.style.transform = `scale(${1 - 0.08 * Math.sin(d / 0.3 * Math.PI)})`; }
}

function renderStudio(t) {
  // remove background: the photo is clipped away from the top as the scan passes
  const sc = eio(P(t, 24.05, 0.95));
  photo.style.clipPath = `inset(${sc * 100}% 0 0 0)`;
  show(scan, t > 24.0 && t < 25.05 ? 1 : 0); scan.style.top = px(sc * 800 - 3);
  show(checker, t > 24.0 ? 1 : 0);
  const bdA = (t0, t1) => C(P(t, t0, 0.2)) * (1 - C(P(t, t1, 0.2)));
  show(bdSpot, bdA(25.9, 26.4)); show(bdDusk, bdA(26.4, 26.9)); show(bdStudio, C(P(t, 26.9, 0.2)));
  show(carShadow, C(P(t, 25.9, 0.3)));
  carS.style.transform = `translateY(${-Math.sin(P(t, 24.95, 0.4) * Math.PI) * 14}px)`;
  toolEls.forEach((e, i) => e.classList.toggle('on', (i === 1 && t >= 23.85 && t < 25.4) || (i === 2 && t >= 25.4 && t < 27.5) || (i === 0 && t >= 27.5)));
  show(bdBox, C(P(t, 25.45, 0.2)) * (1 - C(P(t, 27.5, 0.15))));
  bdEls.forEach((e, i) => { e.classList.toggle('on', (i === 1 && t >= 25.85 && t < 26.35) || (i === 4 && t >= 26.35 && t < 26.85) || (i === 0 && t >= 26.85)); const p = back(P(t, 25.45 + i * 0.04, 0.35)); e.style.transform = `scale(${0.7 + 0.3 * C(p, 0, 1.1)})`; });
  show(tpBox, C(P(t, 27.55, 0.2)));
  tpEls.forEach((e, i) => { e.classList.toggle('on', i === 0 && t >= 27.95); const p = back(P(t, 27.55 + i * 0.05, 0.35)); e.style.transform = `translateX(${(1 - C(p)) * 60}px)`; });
  // template layers fly in
  const L1 = back(P(t, 28.0, 0.45)), L2 = back(P(t, 28.15, 0.5)), L3 = back(P(t, 28.35, 0.45));
  show(tplTop, C(P(t, 28.0, 0.1))); tplTop.style.transform = `translateY(${(1 - L1) * -60}px)`;
  show(tplBox, C(P(t, 28.15, 0.1))); tplBox.style.transform = `translateY(${(1 - L2) * 120}px) scale(${0.9 + 0.1 * C(L2, 0, 1.1)})`;
  show(tplFoot, C(P(t, 28.35, 0.2))); tplFoot.style.transform = `translateY(${(1 - L3) * 20}px)`;
  expLabel.textContent = t >= 29.15 ? '✓ ' + COPY.saved : COPY.export;
  cv.style.boxShadow = `0 0 0 ${Math.sin(P(t, 29.15, 0.4) * Math.PI) * 10}px rgba(255,255,255,.5)`;
}

function renderCursor(t) {
  const on = CURSOR_ON.some(([a, b]) => t >= a && t <= b);
  show(cursor, on ? 1 : 0);
  if (!on) { show(tap, 0); return; }
  // previous and next click targets, measured now
  let prev = null, next = null;
  for (const c of CLICKS) { if (c.t <= t) prev = c; else { next = c; break; } }
  const pPos = prev ? rectC(prev.get()) : (next ? rectC(next.get()).map((v, i) => v + (i ? 180 : 120)) : [540, 1200]);
  let pos = pPos;
  if (next) {
    const nPos = rectC(next.get());
    const start = prev ? Math.max(prev.t + 0.12, next.t - 0.75) : next.t - 0.75;
    const x = eio(P(t, start, next.t - 0.06 - start));
    pos = [L(pPos[0], nPos[0], x), L(pPos[1], nPos[1], x) - Math.sin(x * Math.PI) * 40];
  }
  const press = prev && t - prev.t < 0.12 ? 0.85 : 1;
  cursor.style.transform = `translate(${pos[0] - 6}px,${pos[1] - 4}px) scale(${press})`;
  if (prev && t - prev.t < 0.45) {
    const d = (t - prev.t) / 0.45; show(tap, 1 - d);
    tap.style.transform = `translate(${pos[0] - 55}px,${pos[1] - 55}px) scale(${0.4 + d * 0.9})`;
  } else show(tap, 0);
}

window.render = render;
window.READY = false;
document.fonts.ready.then(() => { render(0); window.READY = true; });
if (!Q.has('static')) { const t0 = performance.now(); (function loop() { render(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); })(); }
})();
