// Scene 2 test (5 s): both walk in to the right -> salesman points up -> lamp falls -> panic, arms spread.
// NODE_PATH=$(npm root -g) node tools/scene2.mjs   (from marketing/skits)
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { character, showroom } from './rig.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = fileURLToPath(new URL('../', import.meta.url));
const FR = `${DIR}preview/frames2/`;
rmSync(FR, { recursive: true, force: true }); mkdirSync(FR, { recursive: true });
const FPS = 30, N = 150;
const WALK_END = 64, POINT = 72, DROP = 100, CRASH = 112;

const LINES = [
  [4, 40, 'S', 'Jom, saya tunjuk <b>Myvi</b>!'],
  [POINT, 98, 'S', 'Tengok atas, bos!'],
  [102, CRASH, 'B', 'Eh?'],
  [CRASH + 2, N, 'X', '<b>LARIII!!!</b>'],
];
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const shake = (f, from, len, amp) => (f >= from && f < from + len ? Math.sin(f * 7.3) * amp * (1 - (f - from) / len) : 0);
const STEPS = [];

function frame(f) {
  const walking = f < WALK_END;
  const ph = f * 0.45, sw = walking ? Math.sin(ph) : 0;
  if (walking && f > 0 && Math.sign(Math.sin(ph)) !== Math.sign(Math.sin((f - 1) * 0.45))) STEPS.push(f);
  const walkPose = { legL: sw * 24, legR: -sw * 24, armL: 10 + sw * 22, armR: -10 + sw * 22, facing: 'right' };
  const t = ease(f / WALK_END);
  const x = { s: lerp(-420, 610, t), b: lerp(-860, 40, t) };
  const y = { s: walking ? -Math.abs(Math.sin(ph)) * 14 : 0, b: walking ? -Math.abs(Math.sin(ph + 1)) * 14 : 0 };
  let b, s;
  if (walking) { b = { ...walkPose, eyes: 'neutral', mouth: 'closed' }; s = { ...walkPose, eyes: 'happy', mouth: 'grin' }; }
  else if (f < POINT) { b = { eyes: 'neutral' }; s = { eyes: 'sly', mouth: 'grin' }; }
  else if (f < CRASH) {
    s = { eyes: 'up', mouth: 'grin', armR: -155, pointR: true };
    b = { eyes: f >= 86 ? 'up' : 'suspicious', mouth: f >= DROP ? 'o' : 'closed' };
  } else {
    const panic = { eyes: 'shock', mouth: 'scream', sweat: true, armL: 118, armR: -118, legL: 8, legR: -8 };
    b = { ...panic }; s = { ...panic, tears: f > CRASH + 14, eyes: f > CRASH + 14 ? 'cry' : 'shock', mouth: f > CRASH + 14 ? 'wail' : 'scream' };
    const j = f - CRASH;
    x.b += Math.sin(f * 2.7) * 7; x.s += Math.cos(f * 3.1) * 7;
    if (j < 12) { const h = -Math.sin((j / 12) * Math.PI) * 90; y.b += h; y.s += h * 0.85; }
  }
  const line = LINES.find(([a, z]) => f >= a && f < z);
  if (line && line[2] !== 'X' && Math.floor(f / 3) % 2 === 0) (line[2] === 'S' ? s : b).mouth = 'talk';
  // the lamp: wobbles, drops, lands on the floor between them
  let lampY = 0, lampR = 0, cord = 160;
  if (f >= 84 && f < DROP) lampR = Math.sin(f * 1.3) * 6;
  if (f >= DROP) { const k = Math.min((f - DROP) / (CRASH - DROP), 1); lampY = k * k * 1010; cord = 60; lampR = k * 25; }
  return { b, s, x, y, line, lampY, lampR, cord };
}

const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const font = readFileSync(`${DIR}../../api/_fonts/outfit-latin-700-normal.woff`).toString('base64');
const car = `data:image/png;base64,${readFileSync(`${DIR}assets/car-myvi-toon.png`).toString('base64')}`;
const lamp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -10 220 140" width="220" height="140">
  <path d="M-40 0 L40 0 L100 90 L-100 90 Z" fill="#dc2626" stroke="#16181d" stroke-width="7" stroke-linejoin="round"/>
  <ellipse cx="0" cy="96" rx="40" ry="24" fill="#fff6c9" stroke="#16181d" stroke-width="6"/></svg>`;

const html = `<!doctype html><html><head><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
body{margin:0;background:#000} #stage{position:relative;width:1080px;height:1920px;overflow:hidden}
#world{position:absolute;inset:0;transform-origin:540px 1150px} .l{position:absolute}
#cap{position:absolute;left:0;right:0;top:1400px;text-align:center;font:700 74px Outfit;color:#fff;
 -webkit-text-stroke:14px #16181d;paint-order:stroke fill;line-height:1.1;padding:0 60px;transform-origin:540px 1440px}
#cap b{color:#ff3b3b} #flash{position:absolute;inset:0;background:#fff;opacity:0}
</style></head><body><div id=stage><div id=world>
<img class=l src="${b64(showroom())}" style="left:0;top:0;width:1080px">
<img class=l src="${car}" style="left:130px;top:700px;width:820px">
<div id=cord class=l style="left:536px;top:0;width:8px;background:#16181d"></div>
<img id=lamp class=l src="${b64(lamp)}" style="left:430px;top:150px;width:220px;transform-origin:110px 10px">
<img id=buyer class=l style="top:1060px;width:370px">
<img id=sales class=l style="top:1060px;width:370px">
</div><div id=cap></div><div id=flash></div></div></body></html>`;

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.setContent(html);
await pg.evaluate(() => document.fonts.ready);
const cache = new Map();
const svgUrl = (who, p) => { const k = who + JSON.stringify(p); if (!cache.has(k)) cache.set(k, b64(character(who, p))); return cache.get(k); };

for (let f = 0; f < N; f++) {
  const st = frame(f);
  const camX = shake(f, CRASH, 18, 24), camY = shake(f + 3, CRASH, 18, 18);
  const zoom = 1 + 0.04 * ease(f / N) + (f >= CRASH && f < CRASH + 16 ? 0.08 * (1 - (f - CRASH) / 16) : 0);
  const line = st.line;
  const capScale = line ? 0.6 + 0.4 * ease((f - line[0]) / 5) + (f - line[0] < 7 ? 0.08 * Math.sin(((f - line[0]) / 7) * Math.PI) : 0) : 1;
  await pg.evaluate((v) => {
    const $ = (id) => document.getElementById(id);
    $('world').style.transform = `translate(${v.camX}px,${v.camY}px) scale(${v.zoom})`;
    $('buyer').src = v.b; $('sales').src = v.s;
    $('buyer').style.left = `${v.xb}px`; $('buyer').style.transform = `translateY(${v.yb}px)`;
    $('sales').style.left = `${v.xs}px`; $('sales').style.transform = `translateY(${v.ys}px)`;
    $('cord').style.height = `${v.cord}px`;
    $('lamp').style.transform = `translateY(${v.lampY}px) rotate(${v.lampR}deg)`;
    $('cap').innerHTML = v.cap; $('cap').style.transform = `scale(${v.capScale})`;
    $('flash').style.opacity = v.flash;
  }, { b: svgUrl('buyer', st.b), s: svgUrl('salesman', st.s), xb: st.x.b, yb: st.y.b, xs: st.x.s, ys: st.y.s,
    cord: st.cord, lampY: st.lampY, lampR: st.lampR, camX, camY, zoom, cap: line ? line[3] : '', capScale,
    flash: f >= CRASH && f < CRASH + 4 ? 0.7 * (1 - (f - CRASH) / 4) : 0 });
  await pg.screenshot({ path: `${FR}${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
}
await br.close();

// sound on a silent 5 s base: footsteps, caption pops, the crash
const ms = (f) => Math.round((f / FPS) * 1000);
const parts = [
  ...STEPS.map((f, i) => `anoisesrc=c=pink:d=0.05:a=0.5,highpass=f=900,lowpass=f=3000,adelay=${ms(f)}|${ms(f)}[s${i}]`),
  ...LINES.map(([a], i) => `sine=f=${700 + i * 90}:d=0.07,volume=0.25,adelay=${ms(a)}|${ms(a)}[p${i}]`),
  `sine=f=1400:d=0.5,volume=0.08,vibrato=f=9:d=0.5,adelay=${ms(84)}|${ms(84)}[cr]`,
  `anoisesrc=c=white:d=0.9:a=0.8,lowpass=f=2500,afade=t=out:st=0.02:d=0.85,adelay=${ms(CRASH)}|${ms(CRASH)}[bm]`,
];
const labels = [...STEPS.map((_, i) => `[s${i}]`), ...LINES.map((_, i) => `[p${i}]`), '[cr]', '[bm]'];
const filter = `${parts.join(';')};[1:a]atrim=0:${N / FPS}[base];[base]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first,asetpts=PTS-STARTPTS[a]`;
const OUT = `${DIR}preview/scene2-walk-point-panic.mp4`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FR}%04d.jpg`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-g', '30', '-profile:v', 'main',
  '-movflags', '+faststart', '-c:a', 'aac', '-ar', '44100', '-t', String(N / FPS), OUT]);
console.log('ok', OUT, 'steps', STEPS.length);
