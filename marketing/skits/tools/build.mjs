// node marketing/skits/tools/build.mjs  -> writes assets/*.svg + renders PNG previews
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { character, myvi, showroom } from './rig.mjs';

const OUT = fileURLToPath(new URL('../assets/', import.meta.url));
const PREV = fileURLToPath(new URL('../preview/', import.meta.url));
mkdirSync(OUT, { recursive: true }); mkdirSync(PREV, { recursive: true });
const font = readFileSync(fileURLToPath(new URL('../../../api/_fonts/outfit-latin-700-normal.woff', import.meta.url))).toString('base64');
const FONT = `<style>@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}body{margin:0;font-family:Outfit}</style>`;

const POSES = {
  neutral: {},
  talk: { mouth: 'talk', armR: -75 },
  shock: { eyes: 'shock', mouth: 'o', sweat: true, armL: 150, armR: -150 },
  happy: { eyes: 'happy', mouth: 'grin', armR: -160 },
  sly: { eyes: 'sly', mouth: 'grin', armR: -95 },
  suspicious: { eyes: 'suspicious', mouth: 'frown' },
  nervous: { eyes: 'nervous', mouth: 'wavy', sweat: true, armR: -165 },
  angry: { eyes: 'angry', mouth: 'scream', tint: true, vein: true, armL: 60, armR: -60 },
  cry: { eyes: 'cry', mouth: 'wail', tears: true },
  dizzy: { eyes: 'dizzy', mouth: 'wavy' },
  starstruck: { eyes: 'stars', mouth: 'grin', blush: true },
  wink: { eyes: 'wink', mouth: 'smirk', armR: -95 },
};
const files = { 'background-showroom.svg': showroom(), 'car-myvi-red.svg': myvi() };
for (const who of ['salesman', 'buyer']) for (const [k, p] of Object.entries(POSES)) files[`${who}-${k}.svg`] = character(who, p);
for (const [n, s] of Object.entries(files)) writeFileSync(OUT + n, s);

const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const card = (n, h) => `<figure><img src="${b64(files[n])}" style="height:${h}px"><figcaption>${n}</figcaption></figure>`;
const sheet = `<!doctype html><html><head><meta name=viewport content="width=device-width">${FONT}<style>
 body{background:#fff;color:#16181d;padding:28px} h1{font-size:44px;margin:0 0 4px} h2{font-size:22px;margin:30px 0 10px;color:#dc2626}
 p{margin:0;color:#6b7280;font-size:15px} .row{display:flex;flex-wrap:wrap;gap:14px}
 figure{margin:0;background:#f4f5f7;border-radius:16px;padding:14px;display:flex;flex-direction:column;align-items:center;max-width:100%}
 img{max-width:100%} figcaption{font-size:12px;color:#6b7280;margin-top:6px}</style></head><body>
 <h1>Drevo Skits: assets</h1><p>Mockup. Every piece is its own file; characters are rigs (arms, eyes, mouth swap).</p>
 <h2>Abang Jo, the salesman</h2><div class=row>${Object.keys(POSES).map((k) => card(`salesman-${k}.svg`, 300)).join('')}</div>
 <h2>Faiz, the buyer</h2><div class=row>${Object.keys(POSES).map((k) => card(`buyer-${k}.svg`, 300)).join('')}</div>
 <h2>The car</h2><div class=row>${card('car-myvi-red.svg', 200)}<figure><img src="data:image/png;base64,${readFileSync(OUT + 'car-myvi-toon.png').toString('base64')}" style="height:200px"><figcaption>car-myvi-toon.png (your photo, toon filter)</figcaption></figure></div>
 <h2>Background</h2><div class=row>${card('background-showroom.svg', 520)}</div></body></html>`;

const svgIn = (s, x, y, w, flip = false) => `<img src="${b64(s)}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;${flip ? 'transform:scaleX(-1)' : ''}">`;
const scene = (left, right, caption) => `<!doctype html><html><head>${FONT}<style>
 .c{position:absolute;left:0;right:0;top:1250px;text-align:center;font-size:62px;color:#fff;-webkit-text-stroke:12px #16181d;paint-order:stroke fill;padding:0 70px;line-height:1.15}
 </style></head><body><div style="position:relative;width:1080px;height:1920px;overflow:hidden">
 ${svgIn(files['background-showroom.svg'], 0, 0, 1080)}
 ${svgIn(files['car-myvi-red.svg'], 190, 880, 700)}
 ${svgIn(character('buyer', left), 40, 1060, 360)}
 ${svgIn(character('salesman', right), 680, 1060, 360)}
 <div class=c>${caption}</div></div></body></html>`;

const br = await chromium.launch();
const shot = async (html, name, vp, full = true, scale = 1) => {
  const pg = await br.newPage({ viewport: vp, deviceScaleFactor: scale });
  await pg.setContent(html); await pg.waitForTimeout(300);
  await pg.screenshot({ path: PREV + name, fullPage: full }); await pg.close();
};
await shot(sheet, 'asset-sheet-desktop.png', { width: 1400, height: 900 }, true, 1);
await shot(sheet, 'asset-sheet-phone.png', { width: 375, height: 800 }, true, 2);
await shot(scene({ armL: 10, armR: -10 }, { mouth: 'talk', eyes: 'sly', armL: 95 }, 'Myvi ni tak pernah<br>accident, bos.'), 'scene-1.png', { width: 1080, height: 1920 }, false);
await shot(scene({ eyes: 'shock', mouth: 'o', sweat: true, armL: 150, armR: -150 }, { eyes: 'happy', mouth: 'grin', armL: 150 }, 'Habis kenapa<br>bonet lain warna?!'), 'scene-2.png', { width: 1080, height: 1920 }, false);
await br.close();
console.log('ok', Object.keys(files).length, 'svg files');
