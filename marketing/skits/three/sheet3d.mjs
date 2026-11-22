// 3D cast design sheet: every character rendered in three.js, front + turned, several faces each.
// Run: THREE_DIR=<.../node_modules/three/build> NODE_PATH=$(npm root -g) node marketing/skits/three/sheet3d.mjs
// -> preview/cast3d-sheet-desktop.png + -phone.png
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PEOPLE } from '../tools/rig.mjs';
import { faceSvg } from './faces.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const SKITS = fileURLToPath(new URL('../', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const THREE_DIR = process.env.THREE_DIR;
if (!THREE_DIR) throw new Error('set THREE_DIR');
const PREV = `${SKITS}preview/`; await mkdir(PREV, { recursive: true });
const font = readFileSync(`${ROOT}api/_fonts/outfit-latin-700-normal.woff`).toString('base64');
const LOGO = readFileSync(`${ROOT}public/drevo-logo.svg`, 'utf8').match(/ d="([^"]+)"/)[1];

// Same cast and faces as the 2D sheet (tools/cast-sheet.mjs)
const CAST = [
  ['salesman', 'Abang Jo', 'Drevo salesman. The hero.', { Neutral: {}, Explaining: { mouth: 'talk', armR: -95, pointR: true }, Happy: { eyes: 'happy', mouth: 'grin', armR: -160 }, Wink: { eyes: 'wink', mouth: 'smirk' }, Shocked: { eyes: 'shock', mouth: 'o', sweat: true, armL: 150, armR: -150 } }],
  ['buyer', 'Faiz', 'First-time buyer.', { Neutral: {}, Starstruck: { eyes: 'stars', mouth: 'grin', blush: true }, Nervous: { eyes: 'nervous', mouth: 'wavy', sweat: true, armR: -165 }, Suspicious: { eyes: 'suspicious', mouth: 'frown' }, Crying: { eyes: 'cry', mouth: 'wail', tears: true } }],
  ['rival', 'Bos Zack', 'Rival seller who cuts corners.', { Neutral: { mouth: 'smirk' }, Selling: { eyes: 'sly', mouth: 'grin', armL: 95 }, Caught: { eyes: 'shock', mouth: 'wavy', sweat: true }, Angry: { eyes: 'angry', mouth: 'scream', tint: true, vein: true, armL: 60, armR: -60 } }],
  ['mak', 'Mak Som', "Faiz's mum. The real boss.", { Neutral: {}, 'Not buying it': { eyes: 'suspicious', mouth: 'frown' }, Stern: { eyes: 'angry', mouth: 'closed', armL: 40, armR: -40 }, Pleased: { eyes: 'happy', mouth: 'grin' } }],
  ['lim', 'Uncle Lim', 'Walk-on: the mechanic.', { Neutral: {}, Inspecting: { eyes: 'squint', mouth: 'closed', armR: -95, pointR: true }, 'Found it': { eyes: 'side', mouth: 'grimace' }, Explaining: { mouth: 'talk', armR: -75 } }],
  ['priya', 'Priya', 'Walk-on: the bank loan officer.', { Neutral: {}, Explaining: { mouth: 'talk', armR: -95 }, Happy: { eyes: 'happy', mouth: 'grin' }, Doubtful: { eyes: 'suspicious', mouth: 'frown' } }],
];

const tiles = [];
for (const [key, , , poses] of CAST) {
  tiles.push({ id: `line-${key}`, key, q: {} }, { id: `turn-${key}`, key, q: { turn: 0.65 } });
  for (const [label, q] of Object.entries(poses)) tiles.push({ id: `${key}-${label}`, key, q });
}
const DATA = {
  people: Object.fromEntries(CAST.map(([k]) => [k, (({ skin, skinDark, shirt, shirtDark, pants, shoe, longSleeve }) => ({ skin, skinDark, shirt, shirtDark, pants, shoe, longSleeve }))(PEOPLE[k])])),
  tiles: tiles.map((t) => ({ ...t, face: `data:image/svg+xml;base64,${Buffer.from(faceSvg(t.key, t.q)).toString('base64')}` })),
  logo: LOGO,
};

const img = (id, cap) => `<figure><img data-id="${id}"><figcaption>${cap}</figcaption></figure>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name=viewport content="width=device-width">
<script type="importmap">{"imports":{"three":"/three/three.module.js"}}</script><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
body{margin:0;background:#fff;color:#16181d;font-family:Outfit,system-ui;padding:32px}
h1{font-size:46px;margin:0} .sub{color:#6b7280;font-size:16px;margin:6px 0 24px;max-width:900px;line-height:1.4}
h2{margin:0;font-size:30px;color:#dc2626} .head{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap} .head span{font-size:18px}
section{background:#f4f5f7;border-radius:20px;padding:20px;margin-bottom:18px}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px} figure{margin:0;background:#fff;border-radius:14px;padding:6px 6px 6px;text-align:center}
figure img{height:300px;width:169px;display:block;object-fit:contain} figcaption{font-size:13px;color:#6b7280}
.line{background:#fff;border:2px dashed #d1d5db} .line figure{background:none} .line img{height:330px;width:186px}
@media(max-width:600px){body{padding:14px} h1{font-size:32px} figure img{height:170px;width:96px} .line img{height:180px;width:101px}}
</style></head><body>
<h1>Drevo Skits: the cast in 3D</h1>
<div class=sub>Same cast, built in three.js: toon light bands and an ink outline so it stays a flat cartoon, but the characters can turn
and the camera can move round them. Faces use the same eyes and mouths as the 2D rig.</div>
<section class=line><h2>Line-up</h2><div class=row>${CAST.map(([k, n]) => img(`line-${k}`, n)).join('')}</div>
<div class=row>${CAST.map(([k, n]) => img(`turn-${k}`, `${n}, turned`)).join('')}</div></section>
${CAST.map(([k, n, role, poses]) => `<section><div class=head><h2>${n}</h2><span>${role}</span></div>
<div class=row>${Object.keys(poses).map((l) => img(`${k}-${l}`, l)).join('')}${img(`turn-${k}`, 'Turned')}</div></section>`).join('')}
<script type="module">
import * as THREE from 'three';
import { buildCharacter, pose } from '/cast3d.js';
const D = window.DATA;
const W = 338, H = 600;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(2); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0, 0);
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(-3, 5, 6); scene.add(sun);
const cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 50); cam.position.set(0, 1.8, 9.6); cam.lookAt(0, 1.62, 0);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.12 }));
shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.35, 1); scene.add(shadow);
const built = {};
const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
const out = {};
for (const t of D.tiles) {
  const ch = built[t.key] ||= buildCharacter(t.key, D.people[t.key], { logo: D.logo });
  for (const c of Object.values(built)) c.visible = c === ch;
  if (!ch.parent) scene.add(ch);
  pose(ch, t.q, await load(t.face));
  renderer.render(scene, cam);
  out[t.id] = renderer.domElement.toDataURL('image/png');
}
document.querySelectorAll('img[data-id]').forEach((el) => { el.src = out[el.dataset.id]; });
window.done = true;
</script></body></html>`;

const MAP = { '/three/': `${THREE_DIR}/`, '/cast3d.js': `${SKITS}three/cast3d.js` };
const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
  const prefix = Object.keys(MAP).find((p) => url.startsWith(p));
  try {
    const file = MAP[prefix].endsWith('/') ? MAP[prefix] + url.slice(prefix.length) : MAP[prefix];
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);

const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, vp, scale] of [['cast3d-sheet-desktop.png', { width: 1500, height: 900 }, 1], ['cast3d-sheet-phone.png', { width: 375, height: 800 }, 2]]) {
  const pg = await br.newPage({ viewport: vp, deviceScaleFactor: scale });
  pg.on('pageerror', (e) => console.error('page:', e.message));
  await pg.addInitScript((d) => { window.DATA = d; }, DATA);
  await pg.goto(`http://localhost:${server.address().port}/`);
  await pg.waitForFunction(() => window.done, null, { timeout: 120000 });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: PREV + name, fullPage: true }); await pg.close();
}
await br.close(); server.close();
console.log('wrote 3D cast sheets');
