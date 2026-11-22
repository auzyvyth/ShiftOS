// Pacing test (8 s): episode 1's opening rebuilt with the rules measured from the reference skit
// (STYLE.md "Pacing"). NODE_PATH=$(npm root -g) node tools/pacing-test.mjs   (from marketing/skits)
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { character } from './rig.mjs';
import { lot } from './sets.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = fileURLToPath(new URL('../', import.meta.url));
const FR = `${DIR}preview/frames-pace/`;
rmSync(FR, { recursive: true, force: true }); mkdirSync(FR, { recursive: true });
const FPS = 30, N = 240;

// shots: wide = everyone, background pans; close = one character big over a blurred background
const SHOTS = [[0, 60, 'wide'], [60, 128, 'close', 'tauke'], [128, 168, 'close', 'buyer'], [168, 240, 'wide']];
// caption chunks: 2-4 words, ~1 s, fade in/out. [from, to, speaker, text]
const CAPS = [[3, 26, 'buyer', 'Myvi ni...'], [27, 58, 'buyer', '<b>murah gila!</b>'],
  [62, 84, 'tauke', 'Tak pernah'], [85, 107, 'tauke', 'masuk air, bro.'], [108, 128, 'tauke', '<b>Sumpah.</b>'],
  [170, 188, 'salesman', '<b>Jap!</b>'], [189, 214, 'salesman', 'Check tiga benda'], [215, 238, 'salesman', 'dulu.']];
// key poses: SNAP on the stressed word, held until the next key (no in-betweens)
const KEYS = {
  buyer: [[0, { eyes: 'stars', mouth: 'grin', blush: true }], [6, { eyes: 'stars', mouth: 'grin', blush: true, armR: -95, pointR: true }],
    [28, { eyes: 'stars', mouth: 'grin', blush: true, armL: 150, armR: -165 }], [50, { eyes: 'happy', mouth: 'grin', blush: true }],
    [128, { eyes: 'stars', mouth: 'grin', blush: true }], [146, { eyes: 'stars', mouth: 'grin', blush: true, armL: 140, armR: -140 }],
    [168, { eyes: 'neutral' }], [176, { eyes: 'shock', mouth: 'o' }], [200, { eyes: 'neutral' }]],
  tauke: [[0, { shades: true, mouth: 'smirk' }], [64, { shades: true, mouth: 'smirk', armR: -90 }], [86, { shades: true, mouth: 'smirk', armL: 95 }],
    [108, { shades: true, mouth: 'smirk', armR: -168 }], [168, { shades: true, mouth: 'smirk' }], [174, { shades: true, mouth: 'o' }], [204, { shades: true, mouth: 'smirk', sweat: true }]],
  salesman: [[168, { eyes: 'neutral', armR: -165, pointR: true }], [214, { eyes: 'neutral', armR: -95, pointR: true }], [232, { eyes: 'sly', mouth: 'smirk' }]],
};
const BLINKABLE = ['neutral', 'happy', 'suspicious', 'sly', undefined];

const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const lerp = (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1);
const keyAt = (who, f) => { let p = {}; for (const [k, v] of KEYS[who]) if (f >= k) p = v; return { ...p }; };
function pose(who, f) {
  const p = keyAt(who, f), cap = CAPS.find(([a, b, w]) => w === who && f >= a && f < b);
  if (cap && Math.floor(f / 3) % 2 === 0 && p.mouth !== 'o') p.mouth = 'talk';
  if (!cap && !p.shades && BLINKABLE.includes(p.eyes) && (f + who.length * 17) % 75 < 3) p.eyes = 'blink';
  return p;
}
function frame(f) {
  const [s0, , type, star] = SHOTS.find(([a, b]) => f >= a && f < b);
  const t = f - s0, acts = [];
  if (type === 'close') {
    acts.push({ who: star, x: 90, y: 760, w: 900, pose: pose(star, f) });
    return { type, pan: -60 - t * 0.6, bgScale: 1.55, blur: 7, zoom: 1 + 0.035 * ease(t / 60), acts };
  }
  acts.push({ who: 'buyer', x: 20, y: 1150, w: 330, pose: pose('buyer', f) });
  if (f >= 168) {
    const k = (f - 168) / 32, jx = lerp(-360, 375, ease(k)), walking = k < 1;
    const p = pose('salesman', f);
    if (walking) { const a = Math.sin(((jx + 360) / 95) * Math.PI) * 24; Object.assign(p, { stride: true, legL: Math.round(a), legR: -Math.round(a), facing: 'right' }); }
    acts.push({ who: 'salesman', x: jx, y: 1150, w: 330, pose: p });
  }
  acts.push({ who: 'tauke', x: 730, y: 1150, w: 330, pose: pose('tauke', f) });
  return { type, pan: -40 - t * 0.8, bgScale: 1.12, blur: 0, zoom: 1 + 0.02 * ease(t / 70), acts };
}

const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const font = readFileSync(`${DIR}../../api/_fonts/outfit-latin-700-normal.woff`).toString('base64');
const car = `data:image/png;base64,${readFileSync(`${DIR}assets/car-myvi-toon.png`).toString('base64')}`;
const html = `<!doctype html><html><head><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
body{margin:0;background:#000} #stage{position:relative;width:1080px;height:1920px;overflow:hidden}
#world{position:absolute;inset:0;transform-origin:540px 1100px} .l{position:absolute}
#bgl{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:540px 1150px}
#sign{position:absolute;left:220px;top:598px;width:640px;text-align:center;color:#16181d;font:700 66px Outfit;letter-spacing:-1px;line-height:1.05}
#sign i{display:block;font-style:normal;color:#dc2626;font-size:52px;transform:rotate(-3deg);margin-top:10px}
#cap{position:absolute;left:0;right:0;text-align:center;font:700 60px Outfit;color:#fff;-webkit-text-stroke:12px #16181d;paint-order:stroke fill;padding:0 70px}
#cap b{color:#ff3b3b}
</style></head><body><div id=stage><div id=world>
<div id=bgl><img class=l src="${b64(lot())}" style="left:0;top:0;width:1080px"><div id=sign>TAUKE LAN AUTO<i>MURAH!! TIP TOP!!</i></div>
<img class=l src="${car}" style="left:160px;top:770px;width:760px"></div>
<img id=a0 class=l><img id=a1 class=l><img id=a2 class=l></div><div id=cap></div></div></body></html>`;

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.setContent(html);
await pg.evaluate(() => document.fonts.ready);
const cache = new Map();
const svgUrl = (who, p) => { const k = who + JSON.stringify(p); if (!cache.has(k)) cache.set(k, b64(character(who, p))); return cache.get(k); };
const steps = [];
let lastHalf = -1;
for (let f = 0; f < N; f++) {
  const st = frame(f);
  const cap = CAPS.find(([a, b]) => f >= a && f < b);
  const op = cap ? Math.min(1, (f - cap[0] + 1) / 3, (cap[1] - f) / 3) : 0;
  if (f >= 168 && f < 200) { const jx = lerp(-360, 375, ease((f - 168) / 32)), half = Math.floor((jx + 360) / 95); if (half !== lastHalf) { if (lastHalf >= 0) steps.push(f); lastHalf = half; } }
  await pg.evaluate(async (v) => {
    const $ = (id) => document.getElementById(id);
    $('world').style.transform = `scale(${v.zoom})`;
    $('bgl').style.transform = `translateX(${v.pan}px) scale(${v.bgScale})`; $('bgl').style.filter = v.blur ? `blur(${v.blur}px)` : 'none';
    const imgs = [];
    for (let i = 0; i < 3; i++) {
      const el = $('a' + i), a = v.acts[i];
      if (!a) { el.style.display = 'none'; continue; }
      el.style.display = ''; if (el.src !== a.src) { el.src = a.src; imgs.push(el); }
      el.style.left = `${a.x}px`; el.style.top = `${a.y}px`; el.style.width = `${a.w}px`;
    }
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    $('cap').innerHTML = v.cap; $('cap').style.opacity = v.op; $('cap').style.top = `${v.capTop}px`;
  }, { ...st, acts: st.acts.map((a) => ({ src: svgUrl(a.who, a.pose), x: a.x, y: a.y, w: a.w })), cap: cap ? cap[3] : '', op,
    capTop: st.type === 'close' ? 1600 : 1000 });
  await pg.screenshot({ path: `${FR}${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
}
await br.close();

const ms = (f) => Math.round((f / FPS) * 1000);
const cues = [...CAPS.map(([s], i) => [`sine=f=${760 + (i % 4) * 70}:d=0.05,volume=0.14`, s]),
  ...SHOTS.slice(1).map(([s]) => ['anoisesrc=c=white:d=0.12:a=0.25,bandpass=f=3000,afade=t=out:st=0.02:d=0.1', s]),
  ...steps.map((f) => ['anoisesrc=c=pink:d=0.05:a=0.45,highpass=f=900,lowpass=f=3000', f])];
const filter = `${cues.map(([src, f], i) => `${src},adelay=${ms(f)}|${ms(f)}[x${i}]`).join(';')};[1:a]atrim=0:${N / FPS}[base];[base]${cues.map((_, i) => `[x${i}]`).join('')}amix=inputs=${cues.length + 1}:normalize=0:duration=first,asetpts=PTS-STARTPTS[a]`;
const OUT = `${DIR}preview/pacing-test.mp4`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FR}%04d.jpg`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-g', '30', '-profile:v', 'main',
  '-movflags', '+faststart', '-c:a', 'aac', '-ar', '44100', '-t', String(N / FPS), OUT]);
console.log('ok', OUT);
