/* Drevo Lite promo: a deterministic timeline. render(t) paints the frame at
   time t (seconds); render.mjs steps it frame by frame and pipes to ffmpeg.
   No CSS animations anywhere: every value is a function of t. */
const SCRIPT_END = 46.5;
// Script time S (what every timing below is written in) -> video time. Each
// scene gets EXTRA seconds, played as a slight slow-down, not a freeze.
const KNOTS = [0, 3.6, 7.2, 11.8, 15.6, 18.6, 21.2, 26.0, 29.0, 32.6, 39.0, 42.6, 46.5];
const EXTRA = [0.3, 0.4, 0.6, 0.6, 0.5, 0.4, 0.6, 0.3, 0.6, 1.0, 0.8, 0.3];
const OUT = KNOTS.reduce((a, k, i) => (i === 0 ? [0] : [...a, a[i - 1] + (k - KNOTS[i - 1]) + EXTRA[i - 1]]), []);
function mapPiece(x, from, to) {
  for (let i = 1; i < from.length; i++) if (x <= from[i]) return to[i - 1] + ((x - from[i - 1]) / (from[i] - from[i - 1])) * (to[i] - to[i - 1]);
  return to[to.length - 1] + (x - from[from.length - 1]);
}
const toScript = (T) => mapPiece(T, OUT, KNOTS);
const toVideo = (s) => mapPiece(s, KNOTS, OUT);
const DURATION = OUT[OUT.length - 1];
const W = 1080, H = 1920;

// ---------- maths ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eo5 = (x) => 1 - Math.pow(1 - x, 5);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eb = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------- dom ----------
const $ = (s, r = document) => r.querySelector(s);
function mk(parent, html) { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstChild; parent.appendChild(el); return el; }
function tf(el, { x = 0, y = 0, s = 1, r = 0, rx = 0, ry = 0, o = 1, blur = 0, persp = 1800 } = {}) {
  el.style.transform = `perspective(${persp}px) translate3d(${x}px,${y}px,0) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${r}deg) scale(${s})`;
  el.style.opacity = o;
  el.style.filter = blur > 0.05 ? `blur(${blur}px)` : '';
}

const ICON = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="11" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.1 3.1 4 7 4c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.9 0 6.1 4.1 4.6 7.7C19.5 16.4 12 21 12 21z"/></svg>',
  cursor: '<svg viewBox="0 0 24 24"><path d="M4 2.5l15 8.2-6.6 1.6 3.9 7.4-2.7 1.4-3.9-7.4L4.9 18.6z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.2V8.5a1.5 1.5 0 0 1 3 0V10h.1V9a1.5 1.5 0 0 1 3 0v5.5c0 4-2.5 7-6.3 7-2.6 0-4.1-1.1-5.4-3.1L4 14.3a1.6 1.6 0 0 1 2.6-1.8L9 15z" fill="#fff" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};
const SCR = '../../../public/for-salesmen/';

// Car photo crops out of the real listing screenshot (760x1091; car at x25-735, y405-722).
function carBg(w) { const k = w / 710; return `background-size:${760 * k}px auto;background-position:${-25 * k}px ${-405 * k}px`; }
// Real car photos (fetch-assets.sh -> assets/). Without them, fall back to crops.
// Each photo is used only if its file loaded, so one missing file never blanks a card.
const AVAIL = new Set();
let PHOTOS = false;
const CARS = [
  { k: 'x50', name: 'Proton X50', price: '109,800' }, { k: 'myvi', name: 'Perodua Myvi', price: '52,800' },
  { k: 'saga', name: 'Proton Saga', price: '38,900' }, { k: 'x70', name: 'Proton X70', price: '128,800' },
  { k: 'axia', name: 'Perodua Axia', price: '29,500' }, { k: 'bezza', name: 'Perodua Bezza', price: '41,800' },
  { k: 'alza', name: 'Perodua Alza', price: '72,900' }, { k: 'persona', name: 'Proton Persona', price: '45,600' },
];
const MINI = { k: 'mini', name: 'MINI Cooper JCW', price: '170,000' };
const carList = () => { if (AVAIL.has('mini')) return [MINI]; const a = CARS.filter((c) => AVAIL.has(c.k)); return a.length >= 4 ? a : CARS.slice(0, 2); };
const carOf = (i) => carList()[i % carList().length];
function photo(k, w, pos = 'center') {
  if (AVAIL.has('mini')) { k = 'mini'; if (pos === 'center') pos = 'center 62%'; }
  if (AVAIL.has(k)) return `background:url('assets/${k}.jpg') ${pos}/cover no-repeat`;
  return k === 'myvi'
    ? `background-image:url('${SCR}tour-chat-ms.webp');background-repeat:no-repeat;${myviBg(w)}`
    : `background-image:url('${SCR}tour-listings-ms.webp');background-repeat:no-repeat;${carBg(w)}`;
}
// Red Myvi thumbnail out of the chat screenshot (760x1091; thumb at x56-140, y290-374).
function myviBg(w) { const k = w / 84; return `background-size:${760 * k}px auto;background-position:${-56 * k}px ${-290 * k}px`; }

// ---------- scene backgrounds ----------
function addBg(root, theme, seed) {
  mk(root, '<div class="bg"></div>');
  const ga = mk(root, '<div class="glow a"></div>');
  const gb = mk(root, '<div class="glow b"></div>');
  const r = rng(seed);
  const orbs = [];
  const n = theme === 'dark' ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const size = 30 + r() * 150, red = r() < 0.6;
    const a = theme === 'dark' ? (red ? 0.10 + r() * 0.16 : 0.04 + r() * 0.06) : (red ? 0.05 + r() * 0.07 : 0.5);
    const col = red ? `rgba(239,68,68,${a})` : theme === 'dark' ? `rgba(255,255,255,${a})` : `rgba(255,255,255,${a})`;
    const el = mk(root, `<div class="orb" style="width:${size}px;height:${size}px;background:${col};filter:blur(${8 + r() * 34}px)"></div>`);
    orbs.push({ el, x: r() * W, y: 300 + r() * 1600, ax: 20 + r() * 60, ay: 30 + r() * 80, sp: 0.15 + r() * 0.35, ph: r() * 6.28, size });
  }
  const vig = mk(root, '<div class="vig"></div>');
  vig.style.zIndex = 20;
  return (t) => {
    const br = 0.86 + 0.14 * Math.sin(t * 0.9 + seed);
    ga.style.opacity = br;
    ga.style.transform = `translate(${Math.sin(t * 0.3 + seed) * 60}px, ${Math.cos(t * 0.25) * 30}px)`;
    gb.style.transform = `translate(${Math.cos(t * 0.2 + seed) * 50}px, ${Math.sin(t * 0.22) * 40}px)`;
    for (const o of orbs) {
      o.el.style.transform = `translate(${o.x + Math.sin(t * o.sp + o.ph) * o.ax - o.size / 2}px, ${o.y + Math.cos(t * o.sp * 0.8 + o.ph) * o.ay - t * 6 - o.size / 2}px)`;
    }
  };
}

// ---------- reusable objects ----------
function floor(root, x, y, w, h) { return mk(root, `<div class="floor" style="left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px"></div>`); }
function phoneEl(root, inner, theme) {
  const el = mk(root, `<div class="phone ${theme === 'dark' ? 'sh-d' : 'sh-l'}" style="left:0;top:0"><div class="scr">${inner}<div class="sheen"></div></div></div>`);
  return el;
}
function sheen(el, t, speed = 0.12, off = 0) { const s = el.querySelector('.sheen'); if (s) s.style.backgroundPosition = `${100 - (((t * speed + off) % 1.6) / 1.6) * 260}% 0`; }
function chipEl(root, theme, icon, label, value, extra = '') {
  const d = theme === 'dark';
  return mk(root, `<div class="chip ${d ? 'sh-d' : 'sh-l'}" style="left:0;top:0;background:${d ? 'rgba(24,27,33,.92)' : '#fff'};color:${d ? '#fff' : '#0f1115'};border:1.5px solid ${d ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.04)'};${extra}">
    <div class="ico" style="background:${d ? 'rgba(239,68,68,.16)' : 'rgba(220,38,38,.10)'};color:#ef4444">${ICON[icon]}</div>
    <div><div class="lbl">${label}</div>${value !== null ? `<div class="big v" style="font-size:66px;line-height:1">${value}</div>` : ''}</div></div>`);
}

// ======================================================================
// Captions. w(text, time, kind, hold): kind H = hero slam, R = red word,
// U = red underline. '/' = line break.
// ======================================================================
const w = (text, t, kind = '', hold = 0.6) => ({ text, t, kind, hold });
const BR = { br: true };
const CAPS = [
  { s: 0.12, e: 3.5, theme: 'dark', words: [w('Kereta', .15), w('dah', .32), w('post.', .5), BR, w('Tapi', 1.25), w('siapa', 1.42), w('yang', 1.6), BR, w('berminat?', 1.95, 'H', .8)] },
  { s: 3.7, e: 7.15, theme: 'light', words: [w('Berapa', 3.8), w('orang', 3.98), w('tengok?', 4.16), BR, w('Berapa', 4.7), w('tekan', 4.88), w('WhatsApp?', 5.06), BR, w('Entah.', 5.75, 'H', .7)] },
  { s: 7.3, e: 11.75, theme: 'dark', words: [w('Dengan', 7.35), w('Drevo,', 7.55, 'R'), BR, w('setiap', 7.95), w('kereta', 8.12), w('tunjuk', 8.35), BR, w('views', 8.65, 'H', .55), w('dan', 9.75), w('tekan', 9.9), BR, w('WhatsApp.', 10.1, 'H', .6)] },
  { s: 11.9, e: 15.55, theme: 'light', words: [w('WhatsApp,', 11.95), w('chat,', 12.2), w('booking:', 12.45), BR, w('semua', 12.95, 'H', .6), w('masuk', 13.95), BR, w('satu', 14.12), w('senarai', 14.3, 'U'), w('lead.', 14.48, 'U')] },
  { s: 15.7, e: 18.55, theme: 'dark', words: [w('Lead', 15.75), w('baru', 15.92), w('masuk?', 16.1), BR, w('Phone', 16.65), w('anda', 16.82), w('terus', 17.0), BR, w('berbunyi.', 17.3, 'H', .55)] },
  { s: 18.7, e: 21.15, theme: 'light', words: [w('Live', 18.75, 'R'), w('TikTok.', 18.92), BR, w('Viewer', 19.35), w('tanya:', 19.52), BR, w('"Berapa', 19.78), w('sebulan?"', 20.05, 'H', .5)] },
  { s: 21.3, e: 25.95, theme: 'dark', words: [w('Live', 21.35, 'R'), w('presentation', 21.52, 'R'), BR, w('kira', 21.95), w('terus:', 22.12), w('deposit,', 22.55), BR, w('tahun,', 22.95), w('bulanan.', 23.4, 'H', .9)] },
  { s: 26.1, e: 28.95, theme: 'light', words: [w('Takde', 26.15), w('website', 26.33), BR, w('sendiri?', 26.7, 'H', .7)] },
  { s: 29.1, e: 32.55, theme: 'dark', words: [w('Dapat', 29.15), w('page sendiri.', 29.4, 'H', .7), BR, w('Kereta', 30.65), w('masuk', 30.82), BR, w('marketplace.', 31.0, 'U')] },
];
const M0 = 32.75, MD = 1.25;
const MONT = [
  (t) => [w('10', t, 'H', .35), w('poster', t + .55), w('loan', t + .65), BR, w('sebulan', t + .75)],
  (t) => [w('Soalan', t), w('&', t + .12), w('review', t + .25, 'H', .35), BR, w('buyer', t + .92)],
  (t) => [w('4', t, 'H', .35), w('kereta', t + .55), BR, w('private', t + .68)],
  (t) => [w('Kad', t), w('kereta', t + .13), BR, w('baru', t + .27, 'H', .35)],
  (t) => [w('Sampai', t), w('10', t + .14, 'H', .35), BR, w('kereta', t + .82), w('live', t + .94)],
];
MONT.forEach((f, i) => { const s = M0 + i * MD; CAPS.push({ s: s - 0.02, e: s + MD - 0.06, theme: 'dark', words: f(s) }); });
CAPS.push(
  { s: 39.1, e: 40.85, theme: 'dark', words: [w('Semua', 39.15), w('ni?', 39.35), BR, w('RM0.', 39.75, 'H', .8)] },
  { s: 40.95, e: 42.5, theme: 'dark', words: [w('Tak', 41.0), w('perlu', 41.15), BR, w('kad', 41.32), w('kredit.', 41.48, 'U')] },
  { s: 42.75, e: 99, theme: 'dark', words: [w('Daftar', 42.8), w('Lite', 43.05, 'H', .6), BR, w('sekarang.', 43.95)] },
);

const caps = [];
function buildCaps() {
  const host = $('#caps');
  for (const c of CAPS) {
    const el = mk(host, `<div class="cap ${c.theme}"></div>`);
    c.el = el;
    c.items = [];
    for (const wd of c.words) {
      if (wd.br) { el.appendChild(document.createElement('br')); continue; }
      const cls = wd.kind ? 'w grad' + (wd.kind === 'U' ? ' u' : '') : 'w';
      const sp = mk(el, `<span class="${cls}">${wd.text}</span>`);
      c.items.push({ ...wd, el: sp });
    }
    caps.push(c);
  }
}
function measureCaps() {
  const host = $('#caps');
  for (const c of caps) {
    const cr = c.el.getBoundingClientRect();
    c.cy = cr.top + cr.height / 2;
    for (const it of c.items) {
      if (it.kind !== 'H') continue;
      const r = it.el.getBoundingClientRect();
      const hero = mk(host, `<div class="hero ${c.theme}">${it.text}</div>`);
      const w0 = hero.offsetWidth, h0 = hero.offsetHeight;
      it.hero = hero; it.w0 = w0; it.h0 = h0;
      it.inC = [r.left + r.width / 2, r.top + r.height / 2];
      it.sIn = r.width / w0;
      it.sBig = Math.min(1, 980 / w0);
      it.bigC = [540, Math.max(c.cy, 330)];
      const R = rng(Math.round(it.t * 1000));
      it.sparks = [];
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + R() * 0.4;
        const sz = 6 + R() * 10;
        const sp = mk(host, `<div class="spark" style="width:${sz}px;height:${sz}px;background:${R() < 0.35 ? '#fff' : '#ef4444'};box-shadow:0 0 18px rgba(239,68,68,.9)"></div>`);
        it.sparks.push({ el: sp, ang, dist: 0.55 + R() * 0.35, sz, life: 0.5 + R() * 0.35 });
      }
      hero.style.opacity = 0;
    }
  }
}
function colorFor(theme, q) {
  // grey -> ink
  if (theme === 'dark') { const a = lerp(0.3, 1, q); return `rgba(255,255,255,${a})`; }
  const a = lerp(0.28, 1, q); return `rgba(15,17,21,${a})`;
}
function renderCaps(t) {
  for (const c of caps) {
    const on = t >= c.s - 0.05 && t <= c.e + 0.05;
    c.el.style.display = on ? '' : 'none';
    const heroes = c.items.filter((i) => i.kind === 'H');
    for (const h of heroes) {
      h.hero.style.opacity = 0;
      h.sparks.forEach((s) => (s.el.style.opacity = 0));
    }
    if (!on) continue;
    const out = seg(t, c.e - 0.22, c.e);
    c.el.style.opacity = 1 - out;
    c.el.style.transform = `translateY(${-34 * eo(out)}px)`;
    c.el.style.filter = out > 0 ? `blur(${out * 8}px)` : '';
    // dim while a hero is up
    let dim = 0;
    for (const h of heroes) {
      const a = h.t, c2 = h.t + h.hold;
      dim = Math.max(dim, Math.min(seg(t, a, a + 0.12), 1 - seg(t, c2, c2 + 0.3)));
    }
    for (const it of c.items) {
      const p = eo(seg(t, it.t, it.t + 0.2));
      const q = seg(t, it.t + 0.04, it.t + 0.24);
      let o = clamp(p * 1.7);
      if (it.kind === 'H') {
        o = t >= it.t + it.hold + 0.3 ? 1 : 0;
        it.el.style.opacity = o * (1 - out);
        it.el.style.transform = '';
        continue;
      }
      if (!it.kind) it.el.style.color = colorFor(c.theme, q);
      it.el.style.opacity = o * (1 - 0.9 * dim);
      it.el.style.transform = `translateY(${(1 - p) * 30}px)`;
      if (it.kind === 'U') it.el.style.setProperty('--ul', eo(seg(t, it.t + 0.15, it.t + 0.5)));
    }
    for (const h of heroes) renderHero(h, t, c.theme, out);
  }
}
function renderHero(h, t, theme, out) {
  const a = h.t, b = h.t + 0.16, c = h.t + h.hold, d = c + 0.3;
  if (t < a || t >= d) return;
  let cx, cy, s, o = 1, blur = 0;
  if (t < b) {
    const p = seg(t, a, b);
    [cx, cy] = h.bigC; s = h.sBig * lerp(1.35, 1, eo5(p)); o = clamp(p * 2.2); blur = (1 - p) * 16;
  } else if (t < c) {
    [cx, cy] = h.bigC; s = h.sBig * (1 + 0.035 * seg(t, b, c));
  } else {
    const q = eio(seg(t, c, d));
    cx = lerp(h.bigC[0], h.inC[0], q); cy = lerp(h.bigC[1], h.inC[1], q);
    s = lerp(h.sBig * 1.035, h.sIn, q);
  }
  const el = h.hero;
  el.style.opacity = o * (1 - out);
  el.style.transform = `translate(${cx - h.w0 / 2}px, ${cy - h.h0 / 2}px) scale(${s})`;
  el.style.backgroundPosition = `${lerp(100, 0, eio(seg(t, a + 0.03, c)))}% 0`;
  const glow = theme === 'dark' ? 'drop-shadow(0 0 46px rgba(239,68,68,.55)) drop-shadow(0 18px 30px rgba(0,0,0,.5))' : 'drop-shadow(0 22px 34px rgba(127,29,29,.28))';
  el.style.filter = (blur > 0.1 ? `blur(${blur}px) ` : '') + glow;
  // sparks fly off the landing
  for (const sp of h.sparks) {
    const p = seg(t, a + 0.04, a + 0.04 + sp.life);
    if (p <= 0 || p >= 1) { sp.el.style.opacity = 0; continue; }
    const R = (h.w0 * h.sBig) * sp.dist * eo(p) + 40;
    const x = h.bigC[0] + Math.cos(sp.ang) * R, y = h.bigC[1] + Math.sin(sp.ang) * R * 0.55;
    sp.el.style.opacity = (1 - p) * (theme === 'dark' ? 1 : 0.8);
    sp.el.style.transform = `translate(${x - sp.sz / 2}px, ${y - sp.sz / 2}px) scale(${1 - p * 0.6})`;
  }
}

// ======================================================================
// Scenes
// ======================================================================
const SCENES = [];
function scene(start, theme, build) { SCENES.push({ start, theme, build }); }

// S1 hook: a listing, nobody knows who cares
scene(0, 'dark', (root) => {
  const bg = addBg(root, 'dark', 1);
  const fl = floor(root, 540, 1640, 760, 90);
  const glow = mk(root, '<div class="redglow" style="left:240px;top:1200px;width:600px;height:400px"></div>');
  const card = mk(root, `<div class="card d sh-d" style="left:180px;top:640px;width:720px;padding:32px">
    <div style="width:656px;height:400px;border-radius:26px;${photo('mini', 656, 'center 62%')}"></div>
    <div style="margin-top:30px;font-size:46px;font-weight:700;letter-spacing:-.03em">2022 MINI Cooper</div>
    <div class="lbl" style="margin-top:6px">John Cooper Works 3-Door · 19,000 km · Recon</div>
    <div class="big" style="font-size:76px;margin-top:22px">RM 170,000</div>
    <div style="display:flex;gap:18px;margin-top:28px">
      <div class="q" style="flex:1;background:#1c2028;border-radius:24px;padding:22px 24px;display:flex;align-items:center;gap:14px;font-size:30px;font-weight:500;color:rgba(255,255,255,.55)"><span style="width:34px;height:34px;color:rgba(255,255,255,.5)">${ICON.eye}</span><span>Tontonan</span><b class="qm" style="margin-left:auto;font-size:40px;color:#fff">?</b></div>
      <div class="q" style="flex:1;background:#1c2028;border-radius:24px;padding:22px 24px;display:flex;align-items:center;gap:14px;font-size:30px;font-weight:500;color:rgba(255,255,255,.55)"><span style="width:34px;height:34px;color:rgba(255,255,255,.5)">${ICON.chat}</span><span>WhatsApp</span><b class="qm" style="margin-left:auto;font-size:40px;color:#fff">?</b></div>
    </div></div>`);
  card.querySelectorAll('svg').forEach((s) => { s.style.width = '34px'; s.style.height = '34px'; });
  const qs = [[120, 980, 1.25], [880, 860, 1.45], [860, 1480, 1.65], [150, 1520, 1.85]].map(([x, y, at]) => ({
    el: mk(root, `<div class="sh-d" style="position:absolute;left:0;top:0;width:110px;height:110px;border-radius:50%;background:rgba(30,33,41,.9);border:1.5px solid rgba(255,255,255,.1);display:grid;place-items:center;font-size:62px;font-weight:700;color:#ef4444">?</div>`), x, y, at,
  }));
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0, 0.8));
    const fy = Math.sin(t * 1.4) * 8;
    tf(card, { y: (1 - p) * 320 + fy, rx: lerp(28, 6, p) + Math.sin(t) * 1.5, ry: Math.sin(t * 0.7) * 4, o: clamp(p * 1.5), s: lerp(0.92, 1, p) });
    fl.style.opacity = p * 0.9; glow.style.opacity = p * (0.5 + 0.2 * Math.sin(t * 2));
    const pulse = seg(t, 1.95, 2.3);
    card.querySelectorAll('.qm').forEach((q) => (q.style.color = pulse > 0 ? '#ef4444' : '#fff'));
    for (const q of qs) {
      const k = seg(lt, q.at, q.at + 0.35);
      const bob = Math.sin(t * 2 + q.x) * 14;
      const pop = t > 1.95 ? 1 + 0.12 * Math.sin(seg(t, 1.95, 2.35) * Math.PI) : 1;
      tf(q.el, { x: q.x - 55, y: q.y - 55 + bob, s: eb(k) * pop, o: clamp(k * 2), r: Math.sin(t + q.y) * 8 });
    }
  };
});

// S2 pain: the numbers are a blank
scene(3.6, 'light', (root) => {
  const bg = addBg(root, 'light', 2);
  const fl = floor(root, 540, 1560, 760, 80);
  const row = (icon, label) => `<div style="display:flex;align-items:center;gap:22px;padding:30px 0;border-top:1.5px solid rgba(0,0,0,.06)">
      <div class="ico" style="background:rgba(15,17,21,.05);color:#6b7280">${ICON[icon]}</div>
      <div style="font-size:36px;font-weight:500;color:#374151">${label}</div>
      <div class="sk" style="margin-left:auto;width:150px;height:44px;border-radius:14px;background:linear-gradient(90deg,#eceae7 0%,#f7f6f4 50%,#eceae7 100%);background-size:200% 100%"></div>
      <div class="qm" style="font-size:52px;font-weight:700;color:#9ca3af;width:40px;text-align:right">?</div></div>`;
  const card = mk(root, `<div class="card l sh-l" style="left:140px;top:820px;width:800px;padding:40px 46px 18px">
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:26px"><div style="width:150px;height:96px;border-radius:18px;${photo('mini', 150, 'center 62%')}"></div>
    <div><div style="font-size:40px;font-weight:700;letter-spacing:-.03em">2022 MINI Cooper</div><div class="lbl">Dah 14 hari post</div></div></div>
    ${row('eye', 'Orang tengok')}${row('chat', 'Tekan WhatsApp')}${row('user', 'Siapa berminat')}</div>`);
  const cur = mk(root, `<div style="position:absolute;left:0;top:0;width:76px;height:76px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.25))">${ICON.cursor}</div>`);
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0, 0.7));
    const shake = t > 5.75 ? Math.sin((t - 5.75) * 60) * 22 * Math.exp(-(t - 5.75) * 7) : 0;
    tf(card, { y: (1 - p) * 260 + Math.sin(t * 1.3) * 6, x: shake, rx: lerp(20, 4, p), o: clamp(p * 1.5) });
    fl.style.opacity = p;
    card.querySelectorAll('.sk').forEach((s, i) => (s.style.backgroundPosition = `${(-(t * 1.6 + i * 0.3) % 2) * 100}% 0`));
    const flash = t > 5.75 && t < 6.6;
    card.querySelectorAll('.qm').forEach((q) => (q.style.color = flash ? '#dc2626' : '#9ca3af'));
    // cursor wanders, looking for numbers
    const k = seg(lt, 0.7, 2.6);
    const cx = 720 + Math.sin(k * 7) * 140 - k * 60, cy = 1150 + Math.cos(k * 5) * 170 + k * 120;
    tf(cur, { x: cx, y: cy, o: clamp(seg(lt, 0.6, 0.9)) * (1 - seg(lt, 2.9, 3.2)), s: 1 });
  };
});

// S3 benefit: views + WhatsApp taps per car (real listings screen)
scene(7.2, 'dark', (root) => {
  const bg = addBg(root, 'dark', 3);
  const fl = floor(root, 540, 1690, 700, 90);
  const glow = mk(root, '<div class="redglow" style="left:200px;top:1100px;width:680px;height:520px"></div>');
  const panel = mk(root, `<div class="panel sh-d" style="left:0;top:0;width:623px"><img src="${SCR}tour-listings-ms.webp"><div class="sheen"></div></div>`);
  const c1 = chipEl(root, 'dark', 'eye', 'Tontonan', '0');
  const c2 = chipEl(root, 'dark', 'chat', 'Tekan WhatsApp', '0');
  const g1 = mk(root, '<div class="redglow" style="left:0;top:0;width:360px;height:220px"></div>');
  const g2 = mk(root, '<div class="redglow" style="left:0;top:0;width:420px;height:220px"></div>');
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0.05, 0.85));
    tf(panel, { x: 228, y: 760 + (1 - p) * 340 + Math.sin(t * 1.2) * 7, rx: lerp(26, 7, p), ry: -6 + Math.sin(t * 0.6) * 3, o: clamp(p * 1.4) });
    sheen(panel, t, 0.25);
    fl.style.opacity = p; glow.style.opacity = p * 0.45;
    const k1 = seg(t, 8.65, 8.95), k2 = seg(t, 10.1, 10.4);
    tf(c1, { x: 50, y: 1130 + Math.sin(t * 1.7) * 10, s: eb(k1), o: clamp(k1 * 2), rx: 6 });
    tf(c2, { x: 520, y: 1400 + Math.cos(t * 1.5) * 10, s: eb(k2), o: clamp(k2 * 2), rx: 6 });
    c1.querySelector('.v').textContent = fmt(140 * eo(seg(t, 8.7, 9.7)));
    c2.querySelector('.v').textContent = fmt(39 * eo(seg(t, 10.15, 11.0)));
    tf(g1, { x: 40, y: 1120, o: k1 * (0.35 + 0.1 * Math.sin(t * 3)) });
    tf(g2, { x: 500, y: 1390, o: k2 * (0.35 + 0.1 * Math.sin(t * 3)) });
  };
});

// S4 benefit: every channel lands in one lead list (real Lite leads screen)
scene(11.8, 'light', (root) => {
  const bg = addBg(root, 'light', 4);
  const fl = floor(root, 540, 1720, 720, 80);
  const panel = mk(root, `<div class="panel sh-l" style="left:0;top:0;width:608px"><img src="${SCR}tour-lite-leads-ms.webp"><div class="sheen"></div></div>`);
  const src = [['chat', 'WhatsApp', 11.95, -200, 700], ['chat', 'Chat', 12.2, 1100, 760], ['cal', 'Booking', 12.45, -200, 860]].map(([ic, lb, at, fx, y]) => ({
    el: chipEl(root, 'light', ic, lb, null, 'font-size:40px;padding:18px 34px 18px 18px'), at, fx, y,
  }));
  const flash = mk(root, '<div class="redglow" style="left:240px;top:880px;width:600px;height:300px;background:rgba(239,68,68,.5)"></div>');
  const slots = [[90, 700], [560, 760], [130, 880]];
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0.1, 0.8));
    const pulse = Math.sin(seg(t, 13.0, 13.4) * Math.PI) * 0.03;
    tf(panel, { x: 236, y: 840 + (1 - p) * 300 + Math.sin(t * 1.1) * 6, rx: lerp(22, 6, p), ry: 5, s: 1 + pulse, o: clamp(p * 1.4) });
    sheen(panel, t, 0.3, 0.5);
    fl.style.opacity = p;
    src.forEach((c, i) => {
      const a = seg(t, c.at, c.at + 0.45), m = eio(seg(t, 12.95 + i * 0.05, 13.35 + i * 0.05));
      const [sx, sy] = slots[i];
      const x = lerp(lerp(c.fx, sx, eo(a)), 440, m), y = lerp(sy, 1000, m) + Math.sin(t * 2 + i) * 8;
      tf(c.el, { x, y, s: lerp(1, 0.4, m), o: clamp(a * 2) * (1 - seg(m, 0.75, 1)) });
    });
    flash.style.opacity = Math.sin(seg(t, 13.25, 13.8) * Math.PI) * 0.8;
  };
});

// S5 benefit: lead alerts (push) on the phone
scene(15.6, 'dark', (root) => {
  const bg = addBg(root, 'dark', 5);
  const fl = floor(root, 540, 1720, 600, 80);
  const rings = [0, 1, 2].map(() => mk(root, '<div class="ring" style="left:0;top:0;width:200px;height:200px"></div>'));
  const ph = phoneEl(root, `<div style="position:absolute;inset:0;background:radial-gradient(120% 80% at 30% 0%,#3a1214 0%,#120d12 50%,#0a0b10 100%)"></div>
    <div style="position:absolute;top:120px;width:100%;text-align:center;color:#fff"><div style="font-size:30px;font-weight:500;opacity:.7">Sabtu, 31 Oktober</div><div style="font-size:170px;font-weight:700;letter-spacing:-.05em;line-height:1">9:41</div></div>`, 'dark');
  const notif = (title, sub, who) => mk(root, `<div class="notif sh-d" style="top:0">
    <div class="ico" style="width:84px;height:84px;border-radius:24px;background:linear-gradient(140deg,#ef4444,#991b1b);color:#fff">${ICON.bell}</div>
    <div><div class="s" style="margin:0 0 4px;font-size:26px;letter-spacing:.04em;text-transform:uppercase">Drevo · ${who}</div><div class="t">${title}</div><div class="s">${sub}</div></div><div class="when">sekarang</div></div>`);
  const n1 = notif('Aiman Hakim tekan WhatsApp', '2023 Proton X50', 'Lead baru');
  const n2 = notif('Nurul Izzati: "Myvi ni ada lagi?"', '2022 Perodua Myvi', 'Chat baru');
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0, 0.7));
    const ringing = t > 17.3 && t < 18.1 ? Math.sin((t - 17.3) * 70) * 3 * (1 - seg(t, 17.3, 18.1)) : 0;
    tf(ph, { x: 240, y: 650 + (1 - p) * 300 + Math.sin(t * 1.2) * 6, rx: lerp(24, 8, p), r: ringing, s: 0.94, o: clamp(p * 1.5) });
    sheen(ph, t, 0.2);
    fl.style.opacity = p;
    const a1 = seg(t, 16.15, 16.6), a2 = seg(t, 17.55, 18.0);
    tf(n1, { y: lerp(560, 980, eb(a1)) + Math.sin(t * 1.6) * 6 - eo(a2) * 0, s: 1, o: clamp(a1 * 3) });
    tf(n2, { y: lerp(560, 1210, eb(a2)) + Math.sin(t * 1.6 + 1) * 6, o: clamp(a2 * 3) });
    rings.forEach((r, i) => {
      const k = seg(t, 17.3 + i * 0.18, 18.2 + i * 0.18);
      const s = lerp(0.5, 5.5, eo(k));
      tf(r, { x: 440, y: 900, s, o: (1 - k) * (k > 0 ? 0.9 : 0) });
    });
  };
});

// S6 pain: live viewers asking monthly
scene(18.6, 'light', (root) => {
  const bg = addBg(root, 'light', 6);
  const live = mk(root, `<div style="position:absolute;left:0;top:0;display:flex;align-items:center;gap:14px;padding:16px 30px;border-radius:20px;background:linear-gradient(180deg,#ef4444,#c81e1e);color:#fff;font-weight:700;font-size:40px;letter-spacing:.04em;box-shadow:0 24px 50px rgba(220,38,38,.35)"><span class="dot" style="width:18px;height:18px;border-radius:50%;background:#fff"></span>LIVE</div>`);
  const msgs = [['AF', '#6b7280', 'berapa sebulan bos?', 0.25], ['SL', '#9a3412', 'deposit berapa?', 0.75], ['MZ', '#374151', '7 tahun berapa sebulan?', 1.25], ['NR', '#7f1d1d', 'X50 tu bulan berapa?', 1.7]];
  const bubs = msgs.map(([i, c, txt, at]) => ({ el: mk(root, `<div class="bub sh-l" style="left:0;top:0;background:#fff;color:#0f1115"><div class="av" style="background:${c}">${i}</div>${txt}</div>`), at }));
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0.05, 0.4));
    tf(live, { x: 90, y: 760, s: eb(p), o: p });
    live.querySelector('.dot').style.opacity = 0.4 + 0.6 * (Math.sin(t * 8) > 0 ? 1 : 0);
    bubs.forEach((b, i) => {
      const k = seg(lt, b.at, b.at + 0.4);
      const later = msgs.slice(i + 1).reduce((acc, m) => acc + eo(seg(lt, m[3], m[3] + 0.4)), 0);
      const hot = t > 20.05 && i === 0 ? 1 + 0.06 * Math.sin(seg(t, 20.05, 20.45) * Math.PI) : 1;
      tf(b.el, { x: 90 + (i % 2) * 70, y: 1560 - later * 165 - (1 - eo(k)) * -120, s: lerp(0.85, 1, eb(k)) * hot, o: clamp(k * 2) * (1 - seg(later, 3.2, 3.8)), rx: 4 });
    });
  };
});

// S7 benefit: Live presentation answers on the spot (real calculator screen)
scene(21.2, 'dark', (root) => {
  const bg = addBg(root, 'dark', 7);
  const fl = floor(root, 540, 1760, 640, 90);
  const glow = mk(root, '<div class="redglow" style="left:180px;top:700px;width:720px;height:700px"></div>');
  const ph = phoneEl(root, `<img src="${SCR}hero-calc-ms.webp">`, 'dark');
  ph.style.transformOrigin = '186px 357px';
  const p1 = chipEl(root, 'dark', 'cal', 'Deposit', '10%');
  const p2 = chipEl(root, 'dark', 'cal', 'Tempoh', '7 tahun');
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0, 0.8));
    const z = eio(seg(t, 23.35, 24.0));
    const back = eio(seg(t, 25.0, 25.8));
    const zz = z * (1 - back);
    const s = 1 + 0.75 * zz;
    tf(ph, { x: 240 + 114 * zz, y: 650 + (1 - p) * 320 + Math.sin(t * 1.2) * 6 + 40 * zz, rx: lerp(24, 6, p) * (1 - zz), ry: -5 * (1 - zz), s, o: clamp(p * 1.5) });
    sheen(ph, t, 0.22);
    fl.style.opacity = p * (1 - zz);
    glow.style.opacity = p * (0.35 + 0.25 * zz);
    const k1 = seg(t, 22.55, 22.85), k2 = seg(t, 22.95, 23.25);
    const gone = seg(t, 23.3, 23.5);
    tf(p1, { x: 30, y: 1260 + Math.sin(t * 1.7) * 8, s: eb(k1), o: clamp(k1 * 2) * (1 - gone) });
    tf(p2, { x: 640, y: 1080 + Math.cos(t * 1.5) * 8, s: eb(k2), o: clamp(k2 * 2) * (1 - gone) });
  };
});

// S8 pain: no website of your own
scene(26.0, 'light', (root) => {
  const bg = addBg(root, 'light', 8);
  const fl = floor(root, 540, 1600, 800, 80);
  const br = mk(root, `<div class="card l sh-l" style="left:110px;top:800px;width:860px;height:700px;overflow:hidden">
    <div style="height:96px;background:#f3f2f0;display:flex;align-items:center;gap:14px;padding:0 30px;border-bottom:1.5px solid rgba(0,0,0,.05)">
      <i style="width:20px;height:20px;border-radius:50%;background:#e5e3df"></i><i style="width:20px;height:20px;border-radius:50%;background:#e5e3df"></i><i style="width:20px;height:20px;border-radius:50%;background:#e5e3df"></i>
      <div style="margin-left:20px;flex:1;height:52px;border-radius:16px;background:#fff;display:flex;align-items:center;padding:0 22px;font-size:28px;color:#9ca3af">https://<span class="caret" style="width:3px;height:30px;background:#0f1115;margin-left:2px"></span></div></div>
    <div style="padding:60px;display:grid;place-items:center;height:600px">
      <div style="width:100%;height:100%;border:3px dashed rgba(15,17,21,.12);border-radius:30px;display:grid;place-items:center;text-align:center">
        <div><div style="font-size:120px;font-weight:700;color:#d6d3cf;letter-spacing:-.05em">404</div><div style="font-size:34px;color:#9ca3af;font-weight:500">Page tak dijumpai</div></div></div></div></div>`);
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0, 0.7));
    const sag = eio(seg(t, 26.7, 27.3));
    tf(br, { y: (1 - p) * 280 + Math.sin(t * 1.2) * 6 + sag * 30, rx: lerp(20, 5, p), r: -2.5 * sag, o: clamp(p * 1.5) });
    fl.style.opacity = p;
    br.querySelector('.caret').style.opacity = Math.sin(t * 9) > 0 ? 1 : 0;
  };
});

// S9 benefit: own page + marketplace
scene(29.0, 'dark', (root) => {
  const bg = addBg(root, 'dark', 9);
  const plane = mk(root, '<div style="position:absolute;left:-200px;top:820px;width:1480px;height:1400px;transform-origin:50% 0"></div>');
  const tiles = [];
  for (let i = 0; i < 18; i++) {
    const col = i % 6, row = Math.floor(i / 6);
    const c = carOf(i + row);
    const el = mk(plane, `<div class="tile sh-d" style="left:${col * 245}px;top:${row * 300}px;width:225px;height:280px;background:#141720;border:1.5px solid rgba(255,255,255,.07)">
      <div style="width:225px;height:150px;${photo(c.k, c.k === 'myvi' ? 225 : 300)}"></div>
      <div style="padding:14px 16px;color:#fff"><div style="font-size:22px;font-weight:700">${c.name}</div><div style="font-size:26px;font-weight:700;margin-top:6px;color:#ef4444">RM ${c.price}</div></div></div>`);
    tiles.push({ el, i });
  }
  const fl = floor(root, 540, 1730, 620, 90);
  const card = (x, i) => { const c = i === 0 && AVAIL.has('mini') ? { k: 'mini', name: 'MINI Cooper JCW', price: '170,000' } : carOf(i); const yr = 2022;
    return `<div style="border-radius:20px;overflow:hidden;background:#181b21"><div style="height:150px;${photo(c.k, c.k === 'myvi' ? 250 : 320, c.k === 'mini' ? 'center 62%' : 'center')}"></div>
     <div style="padding:12px 14px"><div style="font-size:21px;font-weight:700">${yr} ${c.name}</div><div style="font-size:24px;font-weight:700;margin-top:4px">RM ${c.price}</div></div></div>`; };
  const ph = phoneEl(root, `<div style="height:300px;background:linear-gradient(135deg,#4a1416,#1a0d10 60%,#0e0f14)"></div>
    <div style="position:absolute;top:220px;left:40px;width:150px;height:150px;border-radius:50%;background:linear-gradient(140deg,#6b7280,#374151);border:6px solid #0b0d12;display:grid;place-items:center;color:#fff;font-weight:700;font-size:54px">AH</div>
    <div style="padding:90px 40px 0;color:#fff"><div style="font-size:50px;font-weight:700;letter-spacing:-.03em">Aiman Hakim</div><div style="font-size:28px;opacity:.6;font-weight:500;margin-top:4px">Ejen kereta · Shah Alam</div>
    <div style="display:flex;gap:14px;margin-top:26px"><div style="flex:1;height:76px;border-radius:22px;background:#dc2626;display:grid;place-items:center;font-size:28px;font-weight:700">WhatsApp</div><div style="flex:1;height:76px;border-radius:22px;background:#1c2028;display:grid;place-items:center;font-size:28px;font-weight:700">Chat</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px">${card(1, 0)}${card(0, 1)}${card(1, 2)}${card(0, 3)}</div></div>`, 'dark');
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0, 0.8));
    const m = eio(seg(t, 30.6, 31.4));
    tf(ph, { x: 240, y: 640 + (1 - p) * 320 + Math.sin(t * 1.2) * 6 + 60 * m, ry: lerp(-18, -6, p) + 10 * m, rx: 6, s: lerp(1, 0.86, m), o: clamp(p * 1.5) });
    sheen(ph, t, 0.2, 0.3);
    fl.style.opacity = p * (1 - m * 0.4);
    plane.style.transform = `perspective(1400px) rotateX(${58 - 6 * m}deg) translateY(${-60 * m - t * 8}px)`;
    tiles.forEach((ti) => {
      const k = seg(t, 30.6 + ti.i * 0.04, 31.1 + ti.i * 0.04);
      ti.el.style.opacity = eo(k) * 0.85;
      ti.el.style.transform = `translateY(${(1 - eo(k)) * 160}px)`;
    });
  };
});

// S10 montage: the rest of Lite
scene(32.6, 'dark', (root) => {
  const bg = addBg(root, 'dark', 10);
  const fl = floor(root, 540, 1560, 760, 100);
  const glow = mk(root, '<div class="redglow" style="left:200px;top:760px;width:680px;height:620px"></div>');
  const D = 'card d sh-d';
  const items = [
    mk(root, `<div class="${D}" style="left:230px;top:0;width:620px;overflow:hidden">
      <div style="height:330px;position:relative;${photo('mini', 620, 'center 60%')}"><div style="position:absolute;left:0;right:0;bottom:0;padding:80px 30px 20px;background:linear-gradient(transparent,rgba(0,0,0,.8));font-size:42px;font-weight:700">2022 MINI Cooper JCW</div></div>
      <div style="padding:28px 30px 34px"><div class="lbl">Harga · deposit 10% · 6.5% EIR</div><div class="big" style="font-size:64px">RM 170,000</div>
      ${[['9 tahun', '1,875'], ['7 tahun', '2,272'], ['5 tahun', '2,994']].map(([a, b], i) => `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:20px 24px;border-radius:20px;background:${i === 1 ? 'rgba(239,68,68,.16)' : '#1c2028'};font-size:34px;font-weight:700"><span style="font-weight:500;opacity:.75">${a}</span><span>RM ${b}<span style="font-size:24px;opacity:.6">/bln</span></span></div>`).join('')}
      <div style="display:flex;align-items:center;gap:14px;margin-top:26px"><div class="av" style="background:#4b5563">AH</div><div style="font-size:28px;font-weight:700">Aiman Hakim</div></div></div></div>`),
    mk(root, `<div class="${D}" style="left:150px;top:0;width:780px;padding:40px">
      <div style="display:flex;gap:18px;align-items:flex-start"><div class="av" style="background:#6b7280">FZ</div><div style="background:#1c2028;border-radius:30px;padding:24px 28px;font-size:36px;font-weight:500">Ada service record penuh?</div></div>
      <div style="display:flex;justify-content:flex-end;margin-top:22px"><div style="background:#dc2626;border-radius:30px;padding:24px 28px;font-size:36px;font-weight:500">Ada, semua di service center.</div></div>
      <div style="margin-top:36px;padding-top:30px;border-top:1.5px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;color:#fff">${Array(5).fill(`<span style="width:46px;height:46px;display:inline-block">${ICON.star}</span>`).join('')}
      <span style="margin-left:16px;font-size:32px;font-weight:500;opacity:.7">"Layan laju, jujur."</span></div></div>`),
    mk(root, `<div class="${D}" style="left:200px;top:0;width:680px;padding:30px;overflow:hidden">
      <div style="position:relative;border-radius:26px;overflow:hidden"><div style="height:300px;filter:blur(14px) brightness(.6);transform:scale(1.1);${photo('mini', 620, 'center 60%')}"></div>
      <div style="position:absolute;inset:0;display:grid;place-items:center"><div style="width:140px;height:140px;border-radius:50%;background:rgba(15,17,21,.75);border:2px solid rgba(255,255,255,.15);display:grid;place-items:center;color:#fff"><span style="width:64px;height:64px">${ICON.lock}</span></div></div></div>
      <div style="margin-top:26px;font-size:42px;font-weight:700">Private</div><div class="lbl" style="margin-top:6px">Hanya anda nampak. Kira kos dan untung dulu.</div></div>`),
    mk(root, `<div class="${D}" style="left:180px;top:0;width:720px;padding:40px">
      <div style="display:flex;align-items:center;gap:24px"><div style="width:120px;height:120px;border-radius:30px;background:#fff;display:grid;place-items:center"><img src="../../../public/brands/proton.png" style="width:90px"></div>
      <div><div class="lbl">Kereta baru</div><div class="big" style="font-size:56px">Proton X50</div></div></div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:34px">${['Standard', 'Executive', 'Premium', 'Flagship'].map((v, i) => `<div style="padding:18px 26px;border-radius:999px;font-size:30px;font-weight:700;background:${i === 3 ? '#dc2626' : '#1c2028'}">${v}</div>`).join('')}</div>
      <div class="lbl" style="margin-top:30px">Pilih model, kad siap.</div></div>`),
    mk(root, `<div class="${D}" style="left:140px;top:0;width:800px;padding:34px">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px">${Array.from({ length: 10 }, (_, i) => `<div class="tl" style="height:110px;border-radius:16px;${photo(carOf(i).k, carOf(i).k === 'myvi' ? 130 : 190)}"></div>`).join('')}</div>
      <div style="display:flex;align-items:baseline;gap:16px;margin-top:30px"><div class="big n" style="font-size:96px">0</div><div class="lbl" style="font-size:34px">/ 10 kereta live</div></div></div>`),
  ];
  items.forEach((el) => (el.style.opacity = 0));
  return (lt, t) => {
    bg(t);
    glow.style.opacity = 0.4 + 0.1 * Math.sin(t * 2);
    fl.style.opacity = clamp(lt * 3) * 0.9;
    items.forEach((el, i) => {
      const s0 = M0 + i * MD;
      const a = seg(t, s0 - 0.05, s0 + 0.35), b = i < items.length - 1 ? seg(t, s0 + MD - 0.12, s0 + MD + 0.25) : seg(t, 38.85, 39.2);
      if (a <= 0 || b >= 1) { el.style.opacity = 0; return; }
      const h = el.offsetHeight;
      tf(el, { y: 1040 - h / 2 + (1 - eo5(a)) * 220 - eio(b) * 260 + Math.sin(t * 1.5) * 6, s: 1.22 * lerp(0.8, 1, eb(a)) * lerp(1, 0.9, b), rx: lerp(25, 5, eo(a)), r: -5 * eio(b), o: clamp(a * 2) * (1 - b), blur: (1 - a) * 12 + b * 10 });
      if (i === 4) {
        el.querySelectorAll('.tl').forEach((tl, j) => (tl.style.opacity = seg(t, s0 + 0.15 + j * 0.07, s0 + 0.3 + j * 0.07) * 0.9 + 0.1));
        el.querySelector('.n').textContent = Math.round(10 * eo(seg(t, s0 + 0.15, s0 + 0.9)));
      }
    });
  };
});

// S11 offer: RM0 + everything in Lite
scene(39.0, 'dark', (root) => {
  const bg = addBg(root, 'dark', 11);
  const rays = mk(root, `<div class="rays">${Array.from({ length: 14 }, (_, i) => `<i style="transform:rotate(${i * (360 / 14)}deg)"></i>`).join('')}</div>`);
  const fl = floor(root, 540, 1780, 700, 90);
  const feats = ['Page anda sendiri', 'Kereta masuk marketplace', 'WhatsApp, chat dan booking', 'Live presentation', 'Alert setiap lead baru', 'Senarai lead ikut peringkat', 'Views + tekan WhatsApp setiap kereta', '10 poster loan sebulan', 'Soalan, review dan suka', 'Sampai 10 kereta live'];
  const card = mk(root, `<div class="card d sh-d" style="left:150px;top:0;width:780px;padding:44px 48px">
    <div style="display:flex;align-items:baseline;justify-content:space-between"><div class="big" style="font-size:64px">Lite</div><div class="big grad" style="font-size:64px">RM0</div></div>
    <div style="margin-top:14px">${feats.map((f) => `<div class="f" style="display:flex;align-items:center;gap:20px;padding:13px 0;font-size:34px;font-weight:500"><span style="width:44px;height:44px;border-radius:50%;background:rgba(239,68,68,.18);color:#ef4444;display:grid;place-items:center;flex:none"><span style="width:26px;height:26px;display:block">${ICON.check}</span></span>${f}</div>`).join('')}</div></div>`);
  card.querySelectorAll('svg').forEach((s) => { s.style.width = '26px'; s.style.height = '26px'; });
  return (lt, t) => {
    bg(t);
    rays.style.transform = `rotate(${t * 6}deg) scale(${1 + 0.4 * eo(seg(t, 39.75, 40.4))})`;
    rays.style.opacity = 0.35 + 0.65 * seg(t, 39.75, 40.0) * (1 - 0.6 * seg(t, 40.8, 41.4));
    const a = seg(t, 40.75, 41.35);
    const h = card.offsetHeight;
    tf(card, { y: 1240 - h / 2 + (1 - eo5(a)) * 300 + Math.sin(t * 1.2) * 6, rx: lerp(28, 5, eo(a)), s: lerp(0.9, 1, eo(a)), o: clamp(a * 2) });
    fl.style.opacity = a;
    card.querySelectorAll('.f').forEach((f, i) => {
      const k = seg(t, 41.0 + i * 0.1, 41.3 + i * 0.1);
      f.style.opacity = k; f.style.transform = `translateX(${(1 - eo(k)) * -40}px)`;
    });
  };
});

// S12 call to action
scene(42.6, 'dark', (root) => {
  const bg = addBg(root, 'dark', 12);
  const glow = mk(root, '<div class="redglow" style="left:190px;top:900px;width:700px;height:600px"></div>');
  const mark = mk(root, `<div style="position:absolute;left:0;top:0;display:flex;align-items:center;gap:30px;color:#fff;font-weight:700;font-size:150px;letter-spacing:-.05em">
    <span style="width:150px;height:150px;border-radius:44px;background:linear-gradient(140deg,#ef4444,#991b1b);position:relative;box-shadow:0 30px 80px rgba(220,38,38,.55),inset 0 3px 0 rgba(255,255,255,.35)"><span style="position:absolute;left:44px;top:38px;width:40px;height:74px;border:15px solid #fff;border-left:0;border-radius:0 48px 48px 0"></span></span>Drevo</div>`);
  const btn = mk(root, '<div class="btn" style="left:0;top:0;width:700px;height:150px;font-size:52px">Daftar Lite percuma</div>');
  const ripple = mk(root, '<div class="ring" style="left:0;top:0;width:120px;height:120px;border-color:rgba(255,255,255,.8)"></div>');
  const hand = mk(root, `<div style="position:absolute;left:0;top:0;width:130px;height:130px;filter:drop-shadow(0 16px 20px rgba(0,0,0,.5))">${ICON.hand}</div>`);
  const sub = mk(root, '<div style="position:absolute;left:0;top:0;width:1080px;text-align:center;color:rgba(255,255,255,.6);font-size:36px;font-weight:500">Tak perlu kad kredit</div>');
  return (lt, t) => {
    bg(t);
    const p = eo(seg(lt, 0.1, 0.9));
    const mw = mark.offsetWidth;
    tf(mark, { x: 540 - mw / 2, y: 830 + (1 - p) * 120, s: lerp(0.85, 1, p), o: p, blur: (1 - p) * 10 });
    glow.style.opacity = p * (0.45 + 0.1 * Math.sin(t * 2));
    const b = eo(seg(t, 43.6, 44.2));
    const press = Math.sin(seg(t, 44.55, 44.85) * Math.PI);
    tf(btn, { x: 190, y: 1180 + (1 - b) * 120, s: (1 - 0.06 * press) * lerp(0.9, 1, b), o: b });
    tf(sub, { y: 1370, o: eo(seg(t, 44.0, 44.5)) * 0.9 });
    const hk = seg(t, 44.05, 44.55);
    tf(hand, { x: lerp(820, 600, eo(hk)), y: lerp(1500, 1240, eo(hk)) + press * 14, o: clamp(hk * 3) * (1 - seg(t, 45.3, 45.7)) });
    const rk = seg(t, 44.6, 45.3);
    tf(ripple, { x: 600, y: 1195, s: lerp(0.3, 4, eo(rk)), o: rk > 0 ? (1 - rk) : 0 });
  };
});

// ---------- scene compositing ----------
const TR = 0.5; // wipe length
let edge;
function buildScenes() {
  const host = $('#scenes');
  SCENES.forEach((s, i) => {
    s.root = mk(host, `<div class="scene ${s.theme}"></div>`);
    s.root.style.zIndex = i + 1;
    s.update = s.build(s.root);
    s.end = i < SCENES.length - 1 ? SCENES[i + 1].start + TR : SCRIPT_END;
  });
  edge = mk($('#stage'), '<div style="position:absolute;left:0;width:1080px;height:6px;z-index:28;background:linear-gradient(90deg,transparent,#fff 30%,#fff 70%,transparent);box-shadow:0 0 30px 10px rgba(239,68,68,.75),0 0 90px 30px rgba(239,68,68,.35)"></div>');
}
function themeAt(t) { let th = SCENES[0].theme; for (const s of SCENES) if (t >= s.start + TR * 0.5) th = s.theme; return th; }

let grainCtx, grainImg;
function buildGrain() {
  const c = $('#grain');
  c.width = 1180; c.height = 2020; c.style.left = '-50px'; c.style.top = '-50px'; c.style.inset = 'auto';
  c.style.width = '1180px'; c.style.height = '2020px';
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(1180, 2020);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

function render(T) {
  const t = toScript(T);
  let edgeY = -100;
  for (const s of SCENES) {
    const vis = t >= s.start && t < s.end;
    s.root.style.display = vis ? '' : 'none';
    if (!vis) continue;
    const lt = t - s.start;
    const p = s.start === 0 ? 1 : eio(seg(lt, 0, TR));
    s.root.style.clipPath = p >= 1 ? '' : `inset(${(1 - p) * 100}% 0 0 0)`;
    if (p < 1) edgeY = (1 - p) * H;
    // outgoing scene sinks back a touch while the next one rises over it
    const next = SCENES[SCENES.indexOf(s) + 1];
    const out = next ? eio(seg(t, next.start, next.start + TR)) : 0;
    s.root.style.transform = out > 0 ? `scale(${1 - 0.05 * out})` : '';
    s.root.style.filter = out > 0 ? `brightness(${1 - 0.5 * out})` : '';
    s.update(lt, t);
  }
  edge.style.top = edgeY - 3 + 'px';
  edge.style.opacity = edgeY > 0 && edgeY < H ? 1 : 0;
  renderCaps(t);
  const th = themeAt(t);
  const logo = $('#logo');
  logo.style.background = th === 'dark' ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.8)';
  logo.style.color = th === 'dark' ? '#fff' : '#0f1115';
  logo.style.border = th === 'dark' ? '1.5px solid rgba(255,255,255,.10)' : '1.5px solid rgba(0,0,0,.05)';
  logo.style.boxShadow = th === 'dark' ? '0 10px 30px rgba(0,0,0,.4)' : '0 12px 30px rgba(80,30,25,.12)';
  logo.style.opacity = t > 42.6 ? 1 - seg(t, 42.6, 43.0) : 1;
  const sample = $('#sample');
  sample.style.color = th === 'dark' ? 'rgba(255,255,255,.3)' : 'rgba(15,17,21,.32)';
  sample.style.opacity = t >= 7.4 && t < 39.0 ? 1 : 0;
  const f = Math.floor(T * 30), r = rng(f * 7919 + 1);
  $('#grain').style.transform = `translate(${Math.floor(r() * 100) - 50}px, ${Math.floor(r() * 100) - 50}px)`;
  $('#grain').style.opacity = th === 'dark' ? 0.11 : 0.07;
}

window.EVENTS = () => ({
  duration: DURATION,
  heroes: CAPS.flatMap((c) => c.words.filter((x) => x.kind === 'H').map((x) => toVideo(x.t))),
  words: CAPS.flatMap((c) => c.words.filter((x) => x.text && x.kind !== 'H').map((x) => toVideo(x.t))),
  wipes: SCENES.slice(1).map((s) => toVideo(s.start)),
  dings: [16.15, 17.55].map(toVideo),
  tap: toVideo(44.6),
  cta: toVideo(42.7),
  beatEnd: toVideo(42.6),
});

window.READY = (async () => {
  await Promise.all(['mini', ...CARS.map((c) => c.k)].map((k) => new Promise((r) => { const im = new Image(); im.onload = () => { AVAIL.add(k); r(); }; im.onerror = r; im.src = `assets/${k}.jpg`; })));
  PHOTOS = AVAIL.size > 0;
  buildScenes();
  buildCaps();
  buildGrain();
  await document.fonts.ready;
  await Promise.all([SCR + 'tour-listings-ms.webp', SCR + 'tour-chat-ms.webp'].map((u) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = u; })));
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
  measureCaps();
  window.render = render;
  render(0);
  return true;
})();
