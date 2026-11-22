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
const FPS = 30, N = 172;
const WALK_END = 86, POINT = 94, DROP = 122, CRASH = 134;

const LINES = [
  [6, 46, 'S', 'Jom, saya tunjuk <b>Myvi</b>!'],
  [POINT, 120, 'S', 'Tengok atas, bos!'],
  [124, CRASH, 'B', 'Eh?'],
  [CRASH + 2, N, 'X', '<b>LARIII!!!</b>'],
];
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const shake = (f, from, len, amp) => (f >= from && f < from + len ? Math.sin(f * 7.3) * amp * (1 - (f - from) / len) : 0);
const STEPS = [];
let lastHalf = -1;

function frame(f) {
  // reference walk: steady glide, legs scissor from one point, arms nearly still, no bob, no sway.
  // Leg swing is tied to distance covered (no sliding), and each walk ends with the legs together.
  const p = Math.min(f / WALK_END, 1);
  const u = p < 0.9 ? p / 0.95 : 0.9 / 0.95 + (p - 0.9) / 0.95 - ((p - 0.9) ** 2) / (0.95 * 0.2);
  const walking = f < WALK_END;
  const path = { s: [-280, 610], b: [-720, 40] };
  const x = { s: lerp(path.s[0], path.s[1], u), b: lerp(path.b[0], path.b[1], u) };
  const gait = (k) => {
    const dist = path[k][1] - path[k][0], steps = Math.round(dist / 100), d = (x[k] - path[k][0]) * (steps * Math.PI) / dist;
    const half = Math.floor(d / Math.PI);
    if (k === 's' && half !== lastHalf) { if (lastHalf >= 0) STEPS.push(f); lastHalf = half; }
    const a = Math.sin(d) * 24;
    return { stride: true, legL: Math.round(a), legR: -Math.round(a), armL: Math.round(8 + Math.sin(d) * 4), armR: Math.round(-8 + Math.sin(d) * 4), facing: 'right' };
  };
  const y = { s: 0, b: 0 }, sway = { s: 0, b: 0 };
  let b, s;
  if (walking) { b = { ...gait('b'), eyes: 'neutral', mouth: 'closed' }; s = { ...gait('s'), eyes: 'happy', mouth: 'grin' }; }
  else if (f < POINT) { b = { eyes: 'neutral' }; s = { eyes: 'sly', mouth: 'grin' }; }
  else if (f < CRASH) {
    s = { eyes: 'up', mouth: 'grin', armR: -155, pointR: true };
    b = { eyes: f >= POINT + 14 ? 'up' : 'suspicious', mouth: f >= DROP ? 'o' : 'closed' };
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
  if (f >= POINT + 12 && f < DROP) lampR = Math.sin(f * 1.3) * 6;
  if (f >= DROP) { const k = Math.min((f - DROP) / (CRASH - DROP), 1); lampY = k * k * 1010; cord = 60; lampR = k * 25; }
  return { b, s, x, y, sway, line, lampY, lampR, cord };
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
<img id=buyer class=l style="top:1060px;width:370px;transform-origin:50% 97%">
<img id=sales class=l style="top:1060px;width:370px;transform-origin:50% 97%">
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
    $('buyer').style.left = `${v.xb}px`; $('buyer').style.transform = `translateY(${v.yb}px) rotate(${v.rb}deg)`;
    $('sales').style.left = `${v.xs}px`; $('sales').style.transform = `translateY(${v.ys}px) rotate(${v.rs}deg)`;
    $('cord').style.height = `${v.cord}px`;
    $('lamp').style.transform = `translateY(${v.lampY}px) rotate(${v.lampR}deg)`;
    $('cap').innerHTML = v.cap; $('cap').style.transform = `scale(${v.capScale})`;
    $('flash').style.opacity = v.flash;
  }, { b: svgUrl('buyer', st.b), s: svgUrl('salesman', st.s), xb: st.x.b, yb: st.y.b, xs: st.x.s, ys: st.y.s, rb: st.sway.b, rs: st.sway.s,
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
  `sine=f=1400:d=0.5,volume=0.08,vibrato=f=9:d=0.5,adelay=${ms(POINT + 12)}|${ms(POINT + 12)}[cr]`,
  `anoisesrc=c=white:d=0.9:a=0.8,lowpass=f=2500,afade=t=out:st=0.02:d=0.85,adelay=${ms(CRASH)}|${ms(CRASH)}[bm]`,
];
const labels = [...STEPS.map((_, i) => `[s${i}]`), ...LINES.map((_, i) => `[p${i}]`), '[cr]', '[bm]'];
const filter = `${parts.join(';')};[1:a]atrim=0:${N / FPS}[base];[base]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first,asetpts=PTS-STARTPTS[a]`;
const OUT = `${DIR}preview/scene2-walk-point-panic.mp4`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FR}%04d.jpg`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-g', '30', '-profile:v', 'main',
  '-movflags', '+faststart', '-c:a', 'aac', '-ar', '44100', '-t', String(N / FPS), OUT]);
console.log('ok', OUT, 'steps', STEPS.length);
