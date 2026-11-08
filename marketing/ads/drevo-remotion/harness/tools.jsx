// Runs the app's REAL poster renderers and background cut-out on the seller's photo,
// so the ad shows their genuine output. Driven by harness/tools.cjs.
import './fonts.css';
import { renderLoanPoster, posterBlob } from '../../../../src/components/poster/renderLoanPoster.js';
import { drawMotionFrame, TEMPLATE_LEN } from '../../../../src/components/poster/motionPoster.js';
import { loanPosterNumbers, POSTER_COPY, posterTitle } from '../../../../src/utils/loanPoster.js';
import { fetchDataUrl, loadImg } from '../../../../src/utils/posterImage.js';
import { cutOutBackground } from '../../../../src/lib/cutout/index.js';
import { DEFAULT_EIR } from '../../../../src/utils/financing.js';
import { LISTINGS } from './fixture.js';

const blobToDataUrl = (b) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
const car = LISTINGS[0]; // 2025 Toyota GR86 2.4L RZ
const seller = { full_name: 'Auzyvyth', avatar_url: null };
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

window.loanPoster = async (lang = 'ms') => {
  await document.fonts.ready;
  const numbers = loanPosterNumbers({ price: car.selling_price, deposit: 17500, rate: DEFAULT_EIR, basis: 'eir' });
  const c = document.createElement('canvas');
  await renderLoanPoster(c, { car, seller, numbers, lang, pageUrl: 'drevo.my/s/premiummotors', preview: false, dpr: 1 });
  return blobToDataUrl(await posterBlob(c));
};

let frame = null, imgs = null, template = 'calc';
window.motionSetup = async (lang = 'ms', tpl = 'calc') => {
  await Promise.all([document.fonts.load("400 100px 'Bebas Neue'"), document.fonts.load("700 50px 'Outfit'")]).catch(() => {});
  template = tpl;
  const c = POSTER_COPY[lang];
  const P0 = car.selling_price, rate = DEFAULT_EIR, dep = 17500;
  const numbers = loanPosterNumbers({ price: P0, deposit: dep, rate, basis: 'eir' });
  const sweep = [0, 10, 20, 30].map((pct) => { const d = Math.round((P0 * pct) / 100 / 100) * 100; const r = loanPosterNumbers({ price: P0, deposit: d, rate, basis: 'eir' }); return { pct, deposit: d, rows: r.rows }; });
  sweep.push({ pct: (dep / P0) * 100, deposit: dep, rows: numbers.rows });
  frame = {
    lang, headline: c.kicker, offer: '', seller: seller.full_name,
    title: `${car.year} ${posterTitle(car)}`.trim(),
    // Model codes kept as listed: the sheet's titleCase turns GR86 into 'Gr86' (app bug, reported).
    name: [car.year, titleCase(car.brand), car.model].join(' '), variant: car.variant, tag: c.cond?.recon || '',
    year: car.year, make: posterTitle({ brand: car.brand }), model: posterTitle({ model: car.model, variant: car.variant }),
    price: numbers.price, deposit: numbers.deposit, working: `${c.deposit} RM ${numbers.deposit.toLocaleString('en-MY')} · ${numbers.rate}% EIR`,
    rows: numbers.rows, sweep, ownIdx: 4, features: [`${car.mileage.toLocaleString('en-MY')} km`, car.transmission, c.cond?.recon].filter(Boolean),
  };
  imgs = (await Promise.all(car.images.map((u) => fetchDataUrl(u).then(loadImg)))).filter(Boolean);
  return TEMPLATE_LEN[tpl];
};
window.motionFrame = (t) => {
  const ctx = document.getElementById('c').getContext('2d');
  drawMotionFrame(ctx, t, template, frame, imgs);
  return document.getElementById('c').toDataURL('image/jpeg', 0.92);
};

window.cutout = async (url = car.images[0]) => blobToDataUrl(await cutOutBackground(url));
window.TOOLS_READY = true;
