// Episode 1, "Tak Pernah Masuk Air", in 3D (script: briefs/ep1-final-tak-pernah-masuk-air.md).
// Run: THREE_DIR=<.../node_modules/three/build> NODE_PATH=$(npm root -g) node marketing/skits/three/ep1.mjs [--stills]
// Photos are read from preview/ep1-photos/ (car.png, interior.png, carpet.png, lamp.png; poster-filtered by tools/toon.py).
// They are NOT in the repo: the test set is third-party; a posted cut uses the owner's own photos.
// No voice yet: mouths flap on a timer and the lines run as subtitles. -> preview/ep1-3d.mp4
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PEOPLE } from '../tools/rig.mjs';
import { lot } from '../tools/sets.mjs';
import { faceSvg } from './faces.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const SKITS = fileURLToPath(new URL('../', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const THREE_DIR = process.env.THREE_DIR; if (!THREE_DIR) throw new Error('set THREE_DIR');
const PH = `${SKITS}preview/ep1-photos/`;
for (const n of ['car', 'interior', 'carpet', 'lamp']) if (!existsSync(`${PH}${n}.png`)) throw new Error(`missing ${PH}${n}.png`);
const FPS = 30, N = 29 * FPS, s = (t) => Math.round(t * FPS);
const STILLS = process.argv.includes('--stills');

// ---------- the script: [start s, end s, who, text, shot, acting] ----------
// shot: wide | close:<who> | photo:<name>:<who in the corner>
const LINES = [
  [0.0, 2.8, 'buyer', 'Mak! Myvi ni RM19 ribu je!', 'wide', { eyes: 'stars', mouth: 'grin', armL: 100, pointL: true, blush: true }],
  [3.0, 4.9, 'rival', 'Tip-top, bang! Tak pernah masuk air. Confirm!', 'close:rival', { eyes: 'sly', mouth: 'grin', armR: -70, hand: 'thumbR', at: [[0.55, { eyes: 'wink', mouth: 'smirk' }]] }],
  [5.0, 6.0, null, '', 'close:mak', {}],
  [6.0, 7.9, 'salesman', 'Sekejap. Saya nak check tiga benda.', 'wide', { eyes: 'suspicious', mouth: 'closed', armR: -165, hand: 'threeR' }],
  [8.0, 8.9, 'rival', 'Hah? Check lagi ke, bos?', 'close:rival', { eyes: 'side', mouth: 'wavy', sweat: true }],
  [9.0, 10.9, 'buyer', 'Eeee! Kenapa bau hapak ni?!', 'photo:interior:buyer', { eyes: 'squint', mouth: 'grimace', tint: 'green', armR: -150 }],
  [11.0, 12.9, 'salesman', 'Satu. Bau lembap. Hati-hati.', 'photo:interior:salesman', { eyes: 'neutral', mouth: 'closed', armL: 100, pointL: true }],
  [13.0, 14.9, 'salesman', 'Dua. Selak karpet... tengok ni. Lumpur!', 'photo:carpet:salesman', { eyes: 'neutral', mouth: 'closed', armL: 60, pointL: true, at: [[0.75, { eyes: 'shock', mouth: 'o' }]] }],
  [15.0, 16.0, 'buyer', 'LUMPUR?! Dalam kereta?!', 'close:buyer', { eyes: 'shock', mouth: 'scream', armL: 168, armR: -168, sweat: true }],
  [16.1, 18.9, 'salesman', 'Tiga. Lampu depan berembun. Ada kesan air.', 'photo:lamp:salesman', { eyes: 'neutral', mouth: 'closed', armL: 140, pointL: true }],
  [19.0, 20.9, 'rival', 'Itu... itu... embun pagi, bos!', 'close:rival', { eyes: 'side', mouth: 'wavy', sweat: true, armL: 60, armR: -60, at: [[0.6, { eyes: 'nervous', mouth: 'grin' }]] }],
  [21.0, 22.9, 'mak', 'Faiz. Kita balik.', 'close:mak', { eyes: 'angry', mouth: 'closed', at: [[0.5, { eyes: 'neutral' }]] }],
  [23.0, 25.0, null, '', 'wide', {}],
  [25.1, 29.0, 'salesman', 'Nak beli kereta terpakai? Check dulu. Follow untuk tip seterusnya!', 'close:salesman', { eyes: 'happy', mouth: 'grin', armR: -40, armRx: -70, pointR: true, at: [[0.62, { eyes: 'wink', mouth: 'smirk' }]] }],
];
// the script's big on-screen captions (top card)
const TIPS = [[0.0, 3.0, 'MYVI RM19,000?!'], [3.0, 5.0, '"TAK PERNAH MASUK AIR!"'], [9.0, 13.0, '1. BAU HAPAK'], [13.0, 16.0, '2. LUMPUR BAWAH KARPET'],
  [16.0, 19.0, '3. LAMPU BEREMBUN'], [19.0, 21.0, '"EMBUN PAGI..."'], [21.0, 23.0, 'MAK SOM: "BALIK."'], [25.0, 29.0, 'CHECK DULU SEBELUM BELI!']];

// where everyone stands on the lot (x), and which way they face (turn: + = toward screen right)
const HOME = { mak: [-1.05, 0.35], buyer: [0.05, 0.45], rival: [1.35, -0.45], salesman: [-2.15, 0.35] };
const lineAt = (t) => LINES.find(([a, b]) => t >= a && t < b + 0.1);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const lerp = (a, b, k) => a + (b - a) * k;

function charState(who, t, f) {
  let [x, turn] = HOME[who]; let legs = 0, visible = true;
  if (who === 'salesman') { // walks in from the left while Mak stares (5.2 -> 6.2 s)
    if (t < 5.2) visible = false;
    const k = ease((t - 5.2) / 1.0); x = lerp(-3.9, HOME.salesman[0], k);
    if (k < 1) { turn = Math.PI / 2; legs = Math.sin((x + 3.9) * 2.6) * 24; }
  }
  if ((who === 'mak' || who === 'buyer') && t >= 23.0) { // walk off to the left, Mak first
    const k = Math.max(0, (t - (who === 'mak' ? 23.0 : 23.35)) / 1.6);
    x = HOME[who][0] - k * 3.2; turn = -Math.PI / 2; legs = k > 0 ? Math.sin(k * 3.2 * 2.6) * 24 : 0;
  }
  if (who === 'mak' && t >= 21.0 && t < 23.0) turn = lerp(0.35, -Math.PI / 2, ease((t - 22.3) / 0.35)); // turns her back at once
  if (who === 'mak' && t >= 5.0 && t < 6.0) turn = lerp(0.35, 0.75, ease((t - 5.0) / 0.4)); // slow turn to Zack
  // face + arms: the speaker acts; everyone else listens and blinks
  const L = lineAt(t); let q = { eyes: 'neutral', mouth: 'closed' };
  if (who === 'mak' && t >= 5.0 && t < 6.0) q = { eyes: 'squint', mouth: 'frown' };
  if (who === 'rival' && t >= 9 && t < 21) q = { eyes: 'side', mouth: 'wavy', sweat: true };
  if (who === 'rival' && t >= 23) q = { eyes: 'cry', mouth: 'wail', tears: true, armR: -95 };
  if (who === 'buyer' && t >= 23) q = { eyes: 'neutral', mouth: 'frown' };
  if (L && L[2] === who) {
    const [a, b, , text, , act] = L; const k = (t - a) / (b - a);
    const { at = [], ...base } = act; q = { ...base };
    for (const [from, over] of at) if (k >= from) q = { ...q, ...over };
    const talking = text && t < b && k < 0.97;
    if (talking && Math.floor(f / 3) % 2) q.mouth = ['scream', 'o'].includes(q.mouth) ? q.mouth : 'talk';
  } else if (q.eyes === 'neutral' && (f + who.length * 23) % 80 < 3) q.eyes = 'blink';
  return { x, turn, legs, visible, q };
}

function frameState(f) {
  const t = f / FPS, L = lineAt(t) || LINES[LINES.length - 1];
  const shot = L[4];
  const chars = Object.fromEntries(Object.keys(HOME).map((w) => [w, charState(w, t, f)]));
  // subtitles: 2-4 words at a time, spread over the line
  let sub = '';
  if (L[3] && t <= L[1]) {
    const words = L[3].split(' '), n = Math.ceil(words.length / 3), i = Math.min(n - 1, Math.floor(((t - L[0]) / (L[1] - L[0])) * n));
    sub = words.slice(Math.round((i * words.length) / n), Math.round(((i + 1) * words.length) / n)).join(' ');
  }
  const tip = (TIPS.find(([a, b]) => t >= a && t < b) || [])[2] || '';
  const hit = t >= 15.0 && t < 15.15; // LUMPUR
  return { t, shot, focus: shot.split(':')[1], chars, sub, tip, flash: hit, shake: t >= 15.0 && t < 15.5 ? Math.sin(f * 2.3) * 14 * (1 - (t - 15) / 0.5) : 0 };
}

const STATES = Array.from({ length: N }, (_, f) => frameState(f));
const keyOf = (who, q) => `${who}|${q.eyes}|${q.mouth}|${q.sweat ? 1 : 0}${q.blush ? 1 : 0}${q.tears ? 1 : 0}${q.vein ? 1 : 0}${q.tint || ''}`;
const FACES = {};
for (const st of STATES) for (const [w, c] of Object.entries(st.chars)) {
  const k = keyOf(w, c.q); c.face = k;
  FACES[k] ||= `data:image/svg+xml;base64,${Buffer.from(faceSvg(w, c.q)).toString('base64')}`;
}
const pick = ({ skin, skinDark, shirt, shirtDark, pants, shoe, longSleeve }) => ({ skin, skinDark, shirt, shirtDark, pants, shoe, longSleeve });
const img64 = (p, type = 'png') => `data:image/${type};base64,${readFileSync(p).toString('base64')}`;
const DATA = {
  people: Object.fromEntries(Object.keys(HOME).map((k) => [k, pick(PEOPLE[k])])), states: STATES, faces: FACES, home: HOME,
  logo: readFileSync(`${ROOT}public/drevo-logo.svg`, 'utf8').match(/ d="([^"]+)"/)[1],
  bg: `data:image/svg+xml;base64,${Buffer.from(lot()).toString('base64')}`,
  photos: Object.fromEntries(['car', 'interior', 'carpet', 'lamp'].map((n) => [n, img64(`${PH}${n}.png`)])),
};
const font = readFileSync(`${ROOT}api/_fonts/outfit-latin-700-normal.woff`).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/three.module.js"}}</script><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
html,body{margin:0;background:#000} #stage{position:relative;width:1080px;height:1920px;overflow:hidden;background:#f4f5f7}
#bg{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:50% 60%}
#card{position:absolute;left:40px;width:1000px;border:8px solid #16181d;border-radius:28px;overflow:hidden;background:#000;box-shadow:0 18px 0 rgba(0,0,0,.18);display:none}
#card img{display:block;width:100%;transform-origin:50% 50%}
#mist{position:absolute;inset:0;width:100%;height:100%;display:none}
canvas{position:absolute;left:0;top:0}
#tip{position:absolute;left:0;right:0;top:110px;text-align:center}
#tip span{display:inline-block;background:#fff;border:6px solid #16181d;border-radius:22px;padding:14px 30px;font:700 58px Outfit;color:#16181d;box-shadow:0 10px 0 #dc2626}
#sub{position:absolute;left:60px;right:60px;text-align:center;font:700 64px Outfit;color:#fff;-webkit-text-stroke:13px #16181d;paint-order:stroke fill;line-height:1.1}
#flash{position:absolute;inset:0;background:#fff;opacity:0}
#tag{position:absolute;right:26px;bottom:24px;font:700 26px Outfit;color:rgba(0,0,0,.35)}
</style></head><body><div id=stage>
<img id=bg><div id=card><img id=ph><svg id=mist viewBox="0 0 1000 750" preserveAspectRatio="none">
 <defs><radialGradient id=h><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <clipPath id=lens><ellipse cx="420" cy="250" rx="380" ry="190" transform="rotate(14 420 250)"/></clipPath></defs>
 <g clip-path="url(#lens)"><rect width="1000" height="750" fill="url(#h)"/>
 <path d="M60 330 Q200 300 340 334 T620 330 T900 350 L900 600 L60 600 Z" fill="#8fb4c9" opacity=".45"/>
 <path d="M60 330 Q200 300 340 334 T620 330 T900 350" fill="none" stroke="#e9f4fa" stroke-width="7"/>
 ${Array.from({ length: 26 }, (_, i) => `<ellipse cx="${80 + ((i * 137) % 700)}" cy="${120 + ((i * 89) % 200)}" rx="${7 + (i % 4) * 3}" ry="${9 + (i % 3) * 4}" fill="#fff" opacity=".75" stroke="#9fb9c8" stroke-width="2"/>`).join('')}</g></svg></div>
<div id=tip></div><div id=sub></div><div id=flash></div><div id=tag>PREVIEW: test photos, no voice</div></div>
<script type="module">
import * as THREE from 'three';
import { buildCharacter, pose } from '/cast3d.js';
const D = window.DATA, W = 1080, H = 1920;
const stage = document.getElementById('stage'), bg = document.getElementById('bg'), card = document.getElementById('card'), ph = document.getElementById('ph');
const mist = document.getElementById('mist'), tip = document.getElementById('tip'), sub = document.getElementById('sub'), flash = document.getElementById('flash');
bg.src = D.bg;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0, 0);
stage.insertBefore(renderer.domElement, document.getElementById('tip'));
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(-3, 5, 6); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
// the car: the poster-filtered photo as a flat card behind the cast
const carTex = await new THREE.TextureLoader().loadAsync(D.photos.car); carTex.colorSpace = THREE.SRGBColorSpace;
const CW = 5.6, CH = CW * carTex.image.height / carTex.image.width;
const car = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ map: carTex, transparent: true, alphaTest: 0.05 }));
car.position.set(1.4, CH / 2 - 0.05, -3.2); scene.add(car);
const sh = (w, x, z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.13 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, w * 0.25, 1); m.position.set(x, 0.01, z); scene.add(m); return m; };
sh(CW * 0.48, 1.4, -3.1);
const cast = {}, shadows = {};
for (const w of Object.keys(D.home)) { cast[w] = buildCharacter(w, D.people[w], { logo: D.logo }); scene.add(cast[w]); shadows[w] = sh(0.55, 0, 0); }
const faceImg = {};
await Promise.all(Object.entries(D.faces).map(([k, src]) => new Promise((r) => { const i = new Image(); i.onload = () => { faceImg[k] = i; r(); }; i.src = src; })));
const photoImg = {};
await Promise.all(['interior', 'carpet', 'lamp'].map((n) => new Promise((r) => { const i = new Image(); i.onload = () => { photoImg[n] = i; r(); }; i.src = D.photos[n]; })));
const shotStart = {}; D.states.forEach((s, f) => { if (!(s.shot in shotStart) || D.states[f - 1]?.shot !== s.shot) shotStart[f] = s.shot; });
let lastShot = '', since = 0;
window.frame = (f) => {
  const S = D.states[f];
  if (S.shot !== lastShot) { lastShot = S.shot; since = f; }
  const k = (f - since) / 30; // seconds into this shot
  const [kind, a, b] = S.shot.split(':');
  for (const [w, c] of Object.entries(S.chars)) {
    const ch = cast[w];
    ch.visible = c.visible && (kind !== 'photo' || w === b);
    ch.position.set(c.x, 0, 0); shadows[w].position.x = c.x; shadows[w].visible = ch.visible && kind !== 'photo';
    pose(ch, { ...c.q, turn: c.turn, legL: c.legs, legR: -c.legs }, faceImg[c.face]);
  }
  car.visible = kind !== 'photo';
  // background: slow sideways pan the whole time; blurred and bigger behind close-ups and photos
  const pan = -((f * 0.7) % 120) + 60;
  bg.style.transform = (kind === 'wide' ? 'scale(1.12)' : 'scale(1.55)') + ' translateX(' + pan + 'px)';
  bg.style.filter = kind === 'wide' ? 'none' : 'blur(7px)';
  // camera
  if (kind === 'wide') { const push = 13.4 - k * 0.25; cam.position.set(-0.4 + k * 0.05, 2.9, push); cam.lookAt(-0.4 + k * 0.05, 2.45, 0); }
  else if (kind === 'close') { const x = S.chars[a].x; cam.position.set(x, 2.4, 6.6 - k * 0.15); cam.lookAt(x, 2.05, 0); }
  else { const x = S.chars[b].x; cam.position.set(x + 0.9, 2.4, 6.2); cam.lookAt(x + 0.9, 3.3, 0); }
  // photo card
  if (kind === 'photo') {
    card.style.display = 'block'; if (ph.dataset.n !== a) { ph.src = D.photos[a]; ph.dataset.n = a; }
    card.style.top = (a === 'carpet' ? 300 : 340) + 'px';
    ph.style.transform = 'scale(' + (1.02 + k * 0.03) + ')';
    mist.style.display = a === 'lamp' ? 'block' : 'none'; mist.style.opacity = Math.min(1, k * 1.5);
  } else card.style.display = 'none';
  const shake = S.shake;
  stage.style.transform = shake ? 'translate(' + shake + 'px,' + (shake * 0.6) + 'px)' : '';
  tip.innerHTML = S.tip ? '<span>' + S.tip + '</span>' : '';
  sub.textContent = S.sub; sub.style.top = (kind === 'close' ? 1620 : kind === 'photo' ? 1700 : 1660) + 'px';
  flash.style.opacity = S.flash ? 0.85 : 0;
  renderer.render(scene, cam);
};
window.ready = true;
</script></body></html>`;

const MAP = { '/three/': `${THREE_DIR}/`, '/cast3d.js': `${SKITS}three/cast3d.js` };
const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
  const prefix = Object.keys(MAP).find((p) => url.startsWith(p));
  try { const file = MAP[prefix].endsWith('/') ? MAP[prefix] + url.slice(prefix.length) : MAP[prefix];
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
}).listen(0);

const FR = `${SKITS}preview/ep1-3d-frames/`; await rm(FR, { recursive: true, force: true }); await mkdir(FR, { recursive: true });
const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
pg.on('pageerror', (e) => console.error('page:', e.message));
await pg.addInitScript((d) => { window.DATA = d; }, DATA);
await pg.goto(`http://localhost:${server.address().port}/`);
await pg.waitForFunction(() => window.ready, null, { timeout: 120000 });
const el = await pg.$('#stage');
const frames = STILLS ? [s(1.5), s(4), s(5.5), s(7), s(8.5), s(10), s(12), s(14.5), s(15.05), s(17.5), s(20), s(22.6), s(24), s(27)] : [...Array(N).keys()];
for (const f of frames) { await pg.evaluate((n) => window.frame(n), f); await el.screenshot({ path: `${FR}${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 }); }
await br.close(); server.close();
if (STILLS) {
  execFileSync('python3', ['-I', '-c', `import glob\nfrom PIL import Image\nfs=sorted(glob.glob('${FR}*.jpg'))\nims=[Image.open(f).resize((300,533)) for f in fs]\nc=Image.new('RGB',(300*7,533*2),'black')\nfor i,im in enumerate(ims): c.paste(im,((i%7)*300,(i//7)*533))\nc.save('${SKITS}preview/ep1-3d-stills.jpg')`]);
  console.log('stills ->', `${SKITS}preview/ep1-3d-stills.jpg`); process.exit(0);
}

// sound on a silent base: a pop per line, whoosh on photo cuts, carpet sting, LUMPUR hit, footsteps, end ding
const ms = (f) => Math.round((f / FPS) * 1000);
const cues = [
  ...LINES.filter((l) => l[2]).map(([a], i) => [`sine=f=${700 + (i % 5) * 80}:d=0.07,volume=0.22`, s(a)]),
  ...[9.0, 13.0, 16.1].map((a) => ['anoisesrc=c=white:d=0.25:a=0.35,bandpass=f=2500,afade=t=out:st=0.05:d=0.2', s(a)]),
  ['sine=f=220:d=0.6,volume=0.3,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.3', s(13.2)],
  ['anoisesrc=c=brown:d=0.6:a=0.9,lowpass=f=700,afade=t=out:st=0.05:d=0.55', s(15.0)],
  ['sine=f=140:d=0.5,volume=0.35,afade=t=out:st=0.1:d=0.4', s(15.0)],
  ...[5.25, 5.5, 5.75, 6.0, 23.1, 23.35, 23.6, 23.85, 24.1, 24.35, 24.6].map((a) => ['anoisesrc=c=pink:d=0.05:a=0.5,highpass=f=900,lowpass=f=3000', s(a)]),
  ['sine=f=1320:d=0.35,volume=0.2,afade=t=out:st=0.05:d=0.3', s(27.6)], ['sine=f=1760:d=0.45,volume=0.16,afade=t=out:st=0.1:d=0.35', s(27.75)],
];
const filter = `${cues.map(([src, f], i) => `${src},adelay=${ms(f)}|${ms(f)}[x${i}]`).join(';')};[1:a]atrim=0:${N / FPS}[base];[base]${cues.map((_, i) => `[x${i}]`).join('')}amix=inputs=${cues.length + 1}:normalize=0:duration=first,asetpts=PTS-STARTPTS[a]`;
const OUT = `${SKITS}preview/ep1-3d.mp4`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FR}%04d.jpg`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-g', '30', '-profile:v', 'main',
  '-movflags', '+faststart', '-c:a', 'aac', '-ar', '44100', '-t', String(N / FPS), OUT]);
console.log('ok', OUT);
