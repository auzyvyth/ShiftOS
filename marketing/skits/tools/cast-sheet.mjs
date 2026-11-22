// Cast design sheet: every character, a few expressions each, a height line-up and colour swatches.
// Run: NODE_PATH=$(npm root -g) node marketing/skits/tools/cast-sheet.mjs -> preview/cast-sheet-*.png
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { character } from './rig.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const PREV = fileURLToPath(new URL('../preview/', import.meta.url));
mkdirSync(PREV, { recursive: true });
const font = readFileSync(fileURLToPath(new URL('../../../api/_fonts/outfit-latin-700-normal.woff', import.meta.url))).toString('base64');

const CAST = [
  { key: 'salesman', name: 'Abang Jo', role: 'Drevo salesman. The hero.', note: 'Honest, warm, a bit of a show-off. Always explains the trick to the buyer.',
    colours: ['#c68b59', '#dc2626', '#22252b', '#1b1d22'],
    poses: { Neutral: {}, Explaining: { mouth: 'talk', armR: -95, pointR: true }, Happy: { eyes: 'happy', mouth: 'grin', armR: -160 }, Wink: { eyes: 'wink', mouth: 'smirk' }, Shocked: { eyes: 'shock', mouth: 'o', sweat: true, armL: 150, armR: -150 } } },
  { key: 'buyer', name: 'Faiz', role: 'First-time buyer.', note: 'Young, eager, believes everything. The viewer sees themselves in him.',
    colours: ['#d9a273', '#f7f7f8', '#33415a', '#dc2626'],
    poses: { Neutral: {}, Starstruck: { eyes: 'stars', mouth: 'grin', blush: true }, Nervous: { eyes: 'nervous', mouth: 'wavy', sweat: true, armR: -165 }, Suspicious: { eyes: 'suspicious', mouth: 'frown' }, Crying: { eyes: 'cry', mouth: 'wail', tears: true } } },
  { key: 'rival', name: 'Bos Zack', role: 'Rival seller who cuts corners.', note: 'Flashy, smooth talker. Dodgy by what he DOES (wiped engines, "tak pernah masuk air"), not by how he looks.',
    colours: ['#dba878', '#0f766e', '#f2c14e', '#5b6270'],
    poses: { Neutral: { mouth: 'smirk' }, Selling: { eyes: 'sly', mouth: 'grin', armL: 95 }, Caught: { eyes: 'shock', mouth: 'wavy', sweat: true }, Angry: { eyes: 'angry', mouth: 'scream', tint: true, vein: true, armL: 60, armR: -60 }, Wink: { eyes: 'wink', mouth: 'smirk', armR: -95 } } },
  { key: 'mak', name: 'Mak Som', role: "Faiz's mum. The real boss.", note: 'Says little, sees everything. One look ends the bad deal.',
    colours: ['#d39a6a', '#e7b7c2', '#3b7d6e', '#f2c14e'],
    poses: { Neutral: {}, 'Not buying it': { eyes: 'suspicious', mouth: 'frown' }, Stern: { eyes: 'angry', mouth: 'closed', armL: 40, armR: -40 }, Pleased: { eyes: 'happy', mouth: 'grin' }, Shocked: { eyes: 'shock', mouth: 'o' } } },
  { key: 'lim', name: 'Uncle Lim', role: 'Walk-on: the mechanic.', note: 'Calm expert. Lifts the carpet, finds the mud. Never jokes, which is the joke.',
    colours: ['#edc9a1', '#2f4a6d', '#3a3d44', '#dc2626'],
    poses: { Neutral: {}, Inspecting: { eyes: 'squint', mouth: 'closed', armR: -95, pointR: true }, 'Found it': { eyes: 'side', mouth: 'grimace' }, Explaining: { mouth: 'talk', armR: -75 } } },
  { key: 'priya', name: 'Priya', role: 'Walk-on: the bank loan officer.', note: 'Friendly and precise. Explains the real numbers (EIR, DSR) in one line.',
    colours: ['#9a6440', '#1e3a5f', '#ffffff', '#15161a'],
    poses: { Neutral: {}, Explaining: { mouth: 'talk', armR: -95 }, Happy: { eyes: 'happy', mouth: 'grin' }, Doubtful: { eyes: 'suspicious', mouth: 'frown' } } },
];

const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const row = (c) => `<section>
  <div class=head><h2>${c.name}</h2><span>${c.role}</span></div>
  <p>${c.note}</p>
  <div class=sw>${c.colours.map((h) => `<i style="background:${h}"></i><b>${h}</b>`).join('')}</div>
  <div class=poses>${Object.entries(c.poses).map(([k, p]) => `<figure><img src="${b64(character(c.key, p))}"><figcaption>${k}</figcaption></figure>`).join('')}</div>
</section>`;

const html = `<!doctype html><html><head><meta name=viewport content="width=device-width"><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
body{margin:0;background:#fff;color:#16181d;font-family:Outfit,system-ui;padding:32px}
h1{font-size:46px;margin:0} .sub{color:#6b7280;font-size:16px;margin:6px 0 24px;max-width:900px;line-height:1.4}
section{background:#f4f5f7;border-radius:20px;padding:20px;margin-bottom:18px}
.head{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap} h2{margin:0;font-size:30px;color:#dc2626} .head span{font-size:18px}
section p{margin:6px 0 10px;color:#4b5563;font-size:15px;line-height:1.4}
.sw{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px} .sw i{width:22px;height:22px;border-radius:6px;border:2px solid #16181d} .sw b{font-size:12px;color:#6b7280;margin-right:8px}
.poses{display:flex;gap:10px;flex-wrap:wrap} figure{margin:0;background:#fff;border-radius:14px;padding:8px 8px 6px;text-align:center}
figure img{height:260px;display:block} figcaption{font-size:13px;color:#6b7280}
.line{display:flex;align-items:flex-end;gap:4px;background:#fff;border:2px dashed #d1d5db;border-radius:20px;padding:16px;overflow:hidden;flex-wrap:wrap}
.line figure{background:none;padding:0} .line img{height:330px}
@media(max-width:600px){body{padding:14px} h1{font-size:32px} figure img{height:150px} .line img{height:170px}}
</style></head><body>
<h1>Drevo Skits: the cast</h1>
<div class=sub>Design sheet, first draft. Flat cartoon, thick ink outline, flat colour plus one shadow tone, big round head on a short body.
Malaysian mix on purpose: nobody's race is the joke, and characters differ by clothes and job, never by an accent or a gesture.</div>
<h2 style="margin:0 0 10px">Line-up</h2>
<div class=line>${CAST.map((c) => `<figure><img src="${b64(character(c.key, {}))}"><figcaption>${c.name}</figcaption></figure>`).join('')}</div>
<div style="height:18px"></div>
${CAST.map(row).join('')}
</body></html>`;

const br = await chromium.launch();
for (const [name, vp, scale] of [['cast-sheet-desktop.png', { width: 1500, height: 900 }, 1], ['cast-sheet-phone.png', { width: 375, height: 800 }, 2]]) {
  const pg = await br.newPage({ viewport: vp, deviceScaleFactor: scale });
  await pg.setContent(html); await pg.waitForTimeout(400);
  await pg.screenshot({ path: PREV + name, fullPage: true }); await pg.close();
}
await br.close();
console.log('wrote cast sheets');
