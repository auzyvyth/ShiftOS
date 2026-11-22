// Builds the static link-preview pictures (og:image, 1200x630 JPEG) into public/:
//   og-marketplace.jpg  buyers: /, /showroom, hubs, articles... (also copied to og-default.jpg)
//   og-dealers.jpg      DrevoOS, the dealer software (/shiftos)
//   og-salesmen.jpg     seller CRM + Live calculator (/for-salesmen, /plans)
// Drevo ad colours: white room, red panel, black words. The pictures inside are the REAL app
// components rendered with demo data (shots/, made by harness/capture.cjs), never redrawn.
// Run: node tools/og/compose.mjs   (after re-capturing shots/ when the screens change)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import satori from 'satori';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../..');
const pub = (f) => path.join(repo, 'public', f);
const shot = (f) => path.join(here, 'shots', f);
const W = 1200, H = 630, RED = '#dc2626', INK = '#0B0C0F', MUTED = '#5b616e';
const PANEL_X = 700; // red panel from here to the right edge

const font = (f) => fs.readFileSync(path.join(repo, 'api/_fonts', f));
const FONTS = [
  { name: 'Outfit', data: font('outfit-latin-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'Outfit', data: font('outfit-latin-700-normal.woff'), weight: 700, style: 'normal' },
];
const el = (type, style, children) => ({ type, props: { style, children } });

// Left column: wordmark, label, two-line headline (black, then red), one line under it, address.
async function words({ label, line1, line2, sub, url }) {
  const logo = `data:image/png;base64,${fs.readFileSync(pub('drevo-logo-dark.png')).toString('base64')}`;
  const tree = el('div', { width: PANEL_X, height: H, display: 'flex', flexDirection: 'column', padding: '58px 0 52px 64px', fontFamily: 'Outfit', color: INK }, [
    { type: 'img', props: { src: logo, width: 172, height: 30, style: { width: 172, height: 30 } } },
    el('div', { display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto', width: 490 }, [
      el('div', { fontSize: 22, fontWeight: 700, color: RED, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }, label),
      el('div', { fontSize: 64, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.02 }, line1),
      el('div', { fontSize: 64, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.02, color: RED }, line2),
      el('div', { fontSize: 25, fontWeight: 500, color: MUTED, lineHeight: 1.35, marginTop: 22 }, sub),
    ]),
    el('div', { display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 700 }, [
      el('div', { width: 10, height: 10, borderRadius: 5, background: RED, marginRight: 12 }, ''),
      url,
    ]),
  ]);
  const svg = await satori(tree, { width: PANEL_X, height: H, fonts: FONTS });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const rounded = async (buf, w, r) => {
  const img = sharp(buf).resize({ width: w });
  const { height } = await img.clone().toBuffer({ resolveWithObject: true }).then((x) => x.info);
  const mask = Buffer.from(`<svg width="${w}" height="${height}"><rect width="${w}" height="${height}" rx="${r}" ry="${r}"/></svg>`);
  return { buf: await img.composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), w, h: height };
};
// A soft shadow under a rounded picture, drawn on the panel before the picture.
const shadow = (w, h, r) => sharp(Buffer.from(`<svg width="${w + 80}" height="${h + 80}"><rect x="40" y="52" width="${w}" height="${h}" rx="${r}" fill="rgba(60,0,0,0.38)"/></svg>`)).blur(18).png().toBuffer();

async function build(name, copy, place) {
  const base = sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } });
  const panel = Buffer.from(`<svg width="${W - PANEL_X}" height="${H}"><rect width="100%" height="100%" fill="${RED}"/></svg>`);
  const layers = [{ input: panel, left: PANEL_X, top: 0 }];
  for (const p of await place()) {
    layers.push({ input: await shadow(p.w, p.h, p.r), left: p.left - 40, top: p.top - 40 });
    layers.push({ input: p.buf, left: p.left, top: p.top });
  }
  layers.push({ input: await words(copy), left: 0, top: 0 });
  // Pictures may run past the canvas: crop each layer to it.
  const safe = [];
  for (const l of layers) {
    const meta = await sharp(l.input).metadata();
    const x0 = Math.max(0, l.left), y0 = Math.max(0, l.top);
    const x1 = Math.min(W, l.left + meta.width), y1 = Math.min(H, l.top + meta.height);
    if (x1 <= x0 || y1 <= y0) continue;
    const input = await sharp(l.input).extract({ left: x0 - l.left, top: y0 - l.top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
    safe.push({ input, left: x0, top: y0 });
  }
  const out = await base.composite(safe).jpeg({ quality: 86, progressive: true, mozjpeg: true }).toBuffer();
  fs.writeFileSync(pub(name), out);
  console.log(name, Math.round(out.length / 1024), 'kB');
}

// Buyers: three real marketplace cards, stepped down across the panel.
await build('og-marketplace.jpg', {
  label: 'Drevo marketplace', line1: 'Used, recon', line2: '& new cars.',
  sub: 'Asking prices, photos and the seller, in one place. Message them direct.', url: 'drevo.my',
}, async () => {
  const cards = [];
  const spots = [[612, 60], [820, 150], [1010, 240]];
  for (const [i, id] of ['c1', 'c2', 'c3'].entries()) {
    const c = await rounded(fs.readFileSync(shot(`card-${id}.png`)), 250, 16);
    cards.push({ ...c, r: 16, left: spots[i][0], top: spots[i][1] });
  }
  return cards;
});

// Dealers: the real Overview money cards (demo dealer), running off the right edge.
await build('og-dealers.jpg', {
  label: 'DrevoOS · dealer', line1: 'Software dealer', line2: 'kereta Malaysia.',
  sub: 'Stok, lead, untung setiap kereta dan pasukan jualan dalam satu dashboard.', url: 'drevo.my/shiftos',
}, async () => {
  const src = await sharp(shot('dms-overview.png')).extract({ left: 40, top: 20, width: 2160, height: 640 }).png().toBuffer();
  const c = await rounded(src, 1000, 22);
  return [{ ...c, r: 22, left: 612, top: 165 }];
});

// Salesmen: the real Premium dashboard and the Live loan calculator, as two phones.
await build('og-salesmen.jpg', {
  label: 'Untuk salesman kereta', line1: 'Kalkulator loan', line2: '& CRM lead.',
  sub: 'Kira monthly untuk live, dan tahu siapa perlu di-call hari ni.', url: 'drevo.my/for-salesmen',
}, async () => {
  const phone = async (f) => rounded(await sharp(pub(`for-salesmen/${f}`)).png().toBuffer(), 270, 30);
  const a = await phone('hero-calc-ms.webp');
  const b = await phone('hero-dash-ms.webp');
  return [{ ...b, r: 30, left: 905, top: 120 }, { ...a, r: 30, left: 650, top: 60 }];
});

fs.copyFileSync(pub('og-marketplace.jpg'), pub('og-default.jpg'));
