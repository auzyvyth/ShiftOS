// Scene 1 test (5 s): "Myvi ni tip top, bos!" -> smoke -> "TIP TOP?!"
// NODE_PATH=$(npm root -g) node tools/scene1.mjs   (from marketing/skits)
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { character, showroom } from './rig.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = fileURLToPath(new URL('../', import.meta.url));
const FR = `${DIR}preview/frames/`;
rmSync(FR, { recursive: true, force: true }); mkdirSync(FR, { recursive: true });
const FPS = 30, N = 150;

// ---- timeline: [from, to, who speaks, caption] and poses per window ----
const LINES = [
  [4, 36, 'S', 'Myvi ni <b>tip top</b>, bos!'],
  [40, 62, 'B', 'Betul ke?'],
  [64, 78, 'S', 'Sumpah!'],
  [96, 120, 'B', '<b>TIP TOP?!</b>'],
  [124, 150, 'S', 'Asap tu... <b>bonus!</b>'],
];
const BOOM = 80;
function poses(f) {
  let b, s;
  if (f < 36) { b = f < 12 ? {} : { eyes: 'stars', mouth: 'grin', blush: true }; s = { eyes: f > 26 ? 'wink' : 'sly', mouth: 'grin', armL: 95 }; }
  else if (f < 62) { b = { eyes: 'suspicious', mouth: 'frown', armR: -95 }; s = { eyes: 'sly', mouth: 'smirk' }; }
  else if (f < BOOM) { b = { eyes: 'suspicious', mouth: 'frown' }; s = { eyes: 'nervous', mouth: 'wavy', sweat: true, armR: -165 }; }
  else if (f < 96) { b = { eyes: 'shock', mouth: 'scream', sweat: true, armL: 150, armR: -150 }; s = { eyes: 'shock', mouth: 'scream', sweat: true, armL: 150, armR: -150 }; }
  else if (f < 122) { b = { eyes: 'angry', mouth: 'scream', tint: true, vein: true, armL: 60, armR: -60 }; s = { eyes: 'cry', mouth: 'wail', tears: true }; }
  else { b = { eyes: 'dizzy', mouth: 'wavy', armL: 4, armR: -4 }; s = { eyes: 'nervous', mouth: 'grin', sweat: true, blush: true, armL: 95 }; }
  // mouth flaps while a line is spoken
  const line = LINES.find(([a, z]) => f >= a && f < z);
  if (line) {
    const who = line[2] === 'S' ? s : b, open = Math.floor(f / 3) % 2 === 0;
    if (open) who.mouth = who.mouth === 'scream' || who.mouth === 'wail' ? who.mouth : 'talk';
  }
  return { b, s, line };
}

const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const shake = (f, from, len, amp) => (f >= from && f < from + len ? (Math.sin(f * 7.3) * amp * (1 - (f - from) / len)) : 0);

const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const font = readFileSync(`${DIR}../../api/_fonts/outfit-latin-700-normal.woff`).toString('base64');
const car = `data:image/png;base64,${readFileSync(`${DIR}assets/car-myvi-toon.png`).toString('base64')}`;
const puff = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#9aa0a8" stroke="#16181d" stroke-width="6"/>`;

const html = `<!doctype html><html><head><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
body{margin:0;background:#000} #stage{position:relative;width:1080px;height:1920px;overflow:hidden}
#world{position:absolute;inset:0;transform-origin:540px 1150px}
.l{position:absolute} #cap{position:absolute;left:0;right:0;top:1400px;text-align:center;font:700 74px Outfit;color:#fff;
 -webkit-text-stroke:14px #16181d;paint-order:stroke fill;line-height:1.1;padding:0 60px;transform-origin:540px 1440px}
#cap b{color:#ff3b3b} #boom{position:absolute;inset:0;background:#fff;opacity:0}
</style></head><body><div id=stage><div id=world>
<img class=l src="${b64(showroom())}" style="left:0;top:0;width:1080px">
<img id=car class=l src="${car}" style="left:130px;top:700px;width:820px">
<svg id=smoke class=l viewBox="0 0 1080 1920" style="left:0;top:0;width:1080px;height:1920px"></svg>
<img id=buyer class=l style="left:30px;top:1060px;width:370px">
<img id=sales class=l style="left:680px;top:1060px;width:370px">
</div><div id=cap></div><div id=boom></div></div></body></html>`;

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.setContent(html);
await pg.evaluate(() => document.fonts.ready);
const cache = new Map();
const svgUrl = (who, p) => { const k = who + JSON.stringify(p); if (!cache.has(k)) cache.set(k, b64(character(who, p))); return cache.get(k); };

for (let f = 0; f < N; f++) {
  const { b, s, line } = poses(f);
  const zoom = 1 + 0.05 * ease(f / N) + (f >= BOOM && f < BOOM + 16 ? 0.08 * (1 - (f - BOOM) / 16) : 0);
  const camX = shake(f, BOOM, 18, 22), camY = shake(f + 3, BOOM, 18, 16);
  const bob = (o) => Math.sin((f + o) / 7) * 5;
  const jump = (f >= BOOM && f < BOOM + 12) ? -Math.sin(((f - BOOM) / 12) * Math.PI) * 70 : 0;
  const carShake = f >= BOOM - 2 ? shake(f, BOOM - 2, 40, 10) : 0;
  let smoke = '';
  if (f >= BOOM - 2) {
    const t = (f - BOOM + 2) / 30;
    for (let i = 0; i < 9; i++) {
      const age = t - i * 0.12; if (age <= 0) continue;
      smoke += puff(760 + Math.sin(i * 2.1) * 60 + age * 30, 960 - age * 260 - i * 18, Math.min(30 + age * 70, 95));
    }
  }
  const cap = line ? line[3] : '';
  const capScale = line ? 0.6 + 0.4 * ease((f - line[0]) / 5) + (f - line[0] < 7 ? 0.08 * Math.sin(((f - line[0]) / 7) * Math.PI) : 0) : 1;
  await pg.evaluate((st) => {
    const $ = (id) => document.getElementById(id);
    $('world').style.transform = `translate(${st.camX}px,${st.camY}px) scale(${st.zoom})`;
    $('buyer').src = st.b; $('sales').src = st.s;
    $('buyer').style.transform = `translateY(${st.bb + st.jump}px)`;
    $('sales').style.transform = `translateY(${st.sb + st.jump}px)`;
    $('car').style.transform = `translate(${st.carShake}px,${-Math.abs(st.carShake) * 0.6}px)`;
    $('smoke').innerHTML = st.smoke;
    $('cap').innerHTML = st.cap; $('cap').style.transform = `scale(${st.capScale})`;
    $('boom').style.opacity = st.flash;
  }, { b: svgUrl('buyer', b), s: svgUrl('salesman', s), bb: bob(0), sb: bob(11), jump, camX, camY, zoom, carShake, smoke, cap, capScale,
    flash: f >= BOOM && f < BOOM + 4 ? 0.7 * (1 - (f - BOOM) / 4) : 0 });
  await pg.screenshot({ path: `${FR}${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
}
await br.close();

// sound: a low boom at the smoke + short pops on each caption
const t = (f) => (f / FPS).toFixed(3);
const pops = LINES.map(([a], i) => `sine=f=${700 + i * 90}:d=0.07,volume=0.25,adelay=${Math.round((a / FPS) * 1000)}|${Math.round((a / FPS) * 1000)}[p${i}]`).join(';');
const filter = `anoisesrc=c=brown:d=1.4:a=0.9,lowpass=f=180,afade=t=out:st=0.05:d=1.3,adelay=${Math.round(t(BOOM) * 1000)}|${Math.round(t(BOOM) * 1000)}[bm];${pops};[bm]${LINES.map((_, i) => `[p${i}]`).join('')}amix=inputs=${LINES.length + 1}:normalize=0,apad,atrim=0:${N / FPS}[a]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FR}%04d.jpg`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-shortest',
  `${DIR}preview/scene1-test.mp4`]);
console.log('ok', `${DIR}preview/scene1-test.mp4`);
