// Episode 1 "Tak Pernah Masuk Air" (32 s): flood car, 3 checks. Script: briefs/ep1-kereta-banjir.md
// NODE_PATH=$(npm root -g) node tools/ep1.mjs   (from marketing/skits)
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { character, showroom, logo, C } from './rig.mjs';
import { lot } from './sets.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = fileURLToPath(new URL('../', import.meta.url));
const FR = `${DIR}preview/frames-ep1/`;
rmSync(FR, { recursive: true, force: true }); mkdirSync(FR, { recursive: true });
const FPS = 30, N = 960;

// [from, to, speaker B=Faiz J=Abang Jo T=Tauke Lan, caption]. The voice is recorded to these windows.
export const LINES = [
  [6, 72, 'B', 'Myvi ni <b>murah gila!</b>'],
  [78, 146, 'T', 'Tak pernah masuk air, bro. <b>Sumpah.</b>'],
  [176, 214, 'J', 'Jap! Check <b>tiga benda</b> dulu.'],
  [224, 318, 'B', 'Ueekk... <b>bau hapak!</b>'],
  [336, 388, 'J', 'Satu. Bau lembap.'],
  [432, 470, 'B', '<b>IKAN?!</b>'],
  [514, 566, 'T', 'Itu... <b>bonus.</b>'],
  [574, 626, 'J', 'Dua. Selak karpet.'],
  [638, 716, 'J', 'Tiga. Lampu berembun, ada <b>garis air.</b>'],
  [730, 800, 'B', '<b>WOI! Tauke!</b>'],
  [818, 880, 'J', 'Beli kereta terpakai, <b>check dulu.</b>'],
  [882, 930, 'J', 'Follow untuk <b>tip lagi!</b>'],
];
const CARDS = [[334, 392, 1, 'Bau hapak / lembap', '= tanda banjir'], [572, 630, 2, 'Lumpur bawah karpet', '= tanda banjir'],
  [636, 718, 3, 'Lampu berembun', 'ada garis air']];
const SHOT = (f) => (f < 390 ? 'lot' : f < 470 ? 'carpet' : f < 630 ? 'lot' : f < 720 ? 'lamp' : f < 810 ? 'lot' : 'show');
const END = 930;

const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const lerp = (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1);
const shake = (f, from, len, amp) => (f >= from && f < from + len ? Math.sin(f * 7.3) * amp * (1 - (f - from) / len) : 0);
const stride = (dist, k = 100) => { const a = Math.sin((dist / k) * Math.PI) * 26; return { stride: true, legL: Math.round(a), legR: -Math.round(a), armL: 8, armR: -8, facing: 'right' }; };

const fish = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})">
  <path d="M-60 0 Q-20 -40 40 0 Q-20 40 -60 0 Z" fill="#7cc7ff" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M38 0 L80 -30 L76 30 Z" fill="#5aa9e6" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="-34" cy="-6" r="7" fill="${C.ink}"/><path d="M-10 -22 Q0 0 -10 22" fill="none" stroke="${C.ink}" stroke-width="4"/></g>`;

function carpet(f) {
  const lift = ease((f - 396) / 26), t = f - 428;
  const jump = t >= 0 ? (() => { const k = Math.min(t / 40, 1); return { x: 540 + k * 260, y: 1060 - Math.sin(k * Math.PI) * 620 + k * 300, r: k * 540 }; })() : null;
  const drops = t >= 0 && t < 22 ? Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI - Math.PI; const d = t * 14; return `<circle cx="${540 + Math.cos(a) * d}" cy="${1040 + Math.sin(a) * d * 0.7 + t * t * 0.6}" r="12" fill="#8a6a45"/>`; }).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <rect width="1080" height="1920" fill="#2b2e35"/>
  <path d="M80 640 L1000 640 L1060 1560 L20 1560 Z" fill="#3a3e46" stroke="${C.ink}" stroke-width="8"/>
  <path d="M220 760 Q540 690 860 760 L900 1380 Q540 1460 180 1380 Z" fill="#6b4a2b" stroke="${C.ink}" stroke-width="7"/>
  <ellipse cx="420" cy="1060" rx="150" ry="50" fill="#8fb0c4" stroke="${C.ink}" stroke-width="5"/><ellipse cx="690" cy="1220" rx="110" ry="36" fill="#8fb0c4" stroke="${C.ink}" stroke-width="5"/>
  ${[[330, 900], [720, 940], [560, 1300], [300, 1250], [780, 1120]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="16" ry="11" fill="#4a3320"/>`).join('')}
  <g transform="translate(0 760) scale(1 ${1 - lift * 1.35}) translate(0 -760)">
    <path d="M200 760 L880 760 L910 1400 L170 1400 Z" fill="#26282d" stroke="${C.ink}" stroke-width="8"/>
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${240 + i * 75}" y1="790" x2="${225 + i * 78}" y2="1370" stroke="#33363d" stroke-width="10"/>`).join('')}
  </g>
  ${drops}${jump ? fish(jump.x, jump.y, jump.r) : ''}
</svg>`;
}

function lamp(f) {
  const t = f / FPS, wave = (x) => 1150 + Math.sin(x / 70 + t * 3) * 16;
  let water = `M150 ${wave(150)}`; for (let x = 170; x <= 930; x += 20) water += ` L${x} ${wave(x)}`;
  water += ' L930 1500 L150 1500 Z';
  const ring = ease((f - 668) / 20);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs><clipPath id="lens"><path d="M120 820 Q540 600 960 860 Q1000 1280 820 1440 Q480 1520 170 1400 Q90 1100 120 820 Z"/></clipPath></defs>
  <rect width="1080" height="1920" fill="${C.red}"/><rect y="0" width="1080" height="1920" fill="#000" opacity="0.18"/>
  <path d="M120 820 Q540 600 960 860 Q1000 1280 820 1440 Q480 1520 170 1400 Q90 1100 120 820 Z" fill="#dfe6ee" stroke="${C.ink}" stroke-width="12"/>
  <g clip-path="url(#lens)">
    <circle cx="380" cy="1080" r="170" fill="#c7d0da" stroke="#8d939c" stroke-width="10"/><circle cx="380" cy="1080" r="70" fill="#fffbe6" stroke="#8d939c" stroke-width="8"/>
    <circle cx="720" cy="1060" r="130" fill="#c7d0da" stroke="#8d939c" stroke-width="10"/><circle cx="720" cy="1060" r="52" fill="#fffbe6" stroke="#8d939c" stroke-width="8"/>
    ${Array.from({ length: 34 }, (_, i) => `<circle cx="${160 + ((i * 137) % 780)}" cy="${760 + ((i * 89) % 330)}" r="${7 + (i % 4) * 3}" fill="#fff" opacity="0.75" stroke="#9aa6b2" stroke-width="2"/>`).join('')}
    <path d="${water}" fill="#6f9fc4" opacity="0.75"/>
    <path d="${water.split(' L930 1500')[0]}" fill="none" stroke="#2f5f86" stroke-width="8"/>
  </g>
  ${ring > 0 ? `<ellipse cx="540" cy="1150" rx="${470 * ring}" ry="${90 * ring}" fill="none" stroke="#fff" stroke-width="12" stroke-dasharray="40 18"/>` : ''}
</svg>`;
}

function stink(f) {
  if (f < 222 || f > 470) return '';
  const fade = f < 390 ? 1 : 0.35;
  return [440, 540, 640].map((x, i) => {
    const o = ((f * 4 + i * 60) % 200);
    return `<path d="M${x} ${1060 - o} q-26 -34 0 -68 q26 -34 0 -68 q-26 -34 0 -68" fill="none" stroke="#6fbf4a" stroke-width="16" stroke-linecap="round" opacity="${fade * (1 - o / 220)}"/>`;
  }).join('');
}

// ---------- who does what, frame by frame ----------
function actors(f) {
  const shot = SHOT(f), a = [];
  const line = LINES.find(([s, e]) => f >= s && f < e);
  const talk = (who, pose) => {
    if (line && line[2] === who && Math.floor(f / 3) % 2 === 0 && !['scream', 'wail'].includes(pose.mouth)) pose.mouth = 'talk';
    return pose;
  };
  if (shot === 'carpet') {
    a.push({ who: 'buyer', x: -80, y: 1340, w: 560, pose: talk('B', f < 428 ? { eyes: 'suspicious', mouth: 'frown' } : { eyes: 'shock', mouth: 'scream', sweat: true }) });
    return a;
  }
  if (shot === 'lamp') return a;
  if (shot === 'show') {
    const s = f - 810;
    a.push({ who: 'buyer', x: 40, y: 1060, w: 370, pose: talk('B', { eyes: 'happy', mouth: 'grin', armR: s > 70 ? -150 : -10 }) });
    a.push({ who: 'salesman', x: 680, y: 1060, w: 370, pose: talk('J', { eyes: s > 70 ? 'wink' : 'happy', mouth: 'grin', armR: s > 70 ? -155 : -10, pointR: s > 70 }) });
    return a;
  }
  // the lot: Faiz left, Abang Jo middle (walks in at 150), Tauke Lan right
  let b, t, j = null, tx = 730;
  if (f < 150) { b = { eyes: f < 110 ? 'stars' : 'happy', mouth: 'grin', blush: true }; t = { shades: true, mouth: 'smirk', armR: f >= 96 && f < 146 ? -165 : -10 }; }
  else if (f < 222) { b = { eyes: 'neutral' }; t = { shades: true, mouth: 'smirk' }; }
  else if (f < 336) { b = { eyes: 'dizzy', mouth: 'wavy', tint: 'green', armR: -150 }; t = { shades: true, mouth: 'wavy', sweat: true }; }
  else if (f < 390) { b = { eyes: 'suspicious', mouth: 'frown' }; t = { shades: true, mouth: 'wavy', sweat: true }; }
  else if (f < 514) { b = { eyes: 'shock', mouth: 'scream', sweat: true, armL: 118, armR: -118 }; t = { eyes: 'shock', mouth: 'o', sweat: true }; }
  else if (f < 720) { b = { eyes: 'suspicious', mouth: 'frown', armL: 30, armR: -30 }; t = { eyes: 'nervous', mouth: 'wavy', sweat: true, blush: f < 574 }; }
  else {
    b = { eyes: 'angry', mouth: 'scream', tint: true, vein: true, armR: -95, pointR: true };
    const k = (f - 726) / 72; tx = lerp(730, 1400, k);
    t = f < 726 ? { eyes: 'shock', mouth: 'o', sweat: true } : { ...stride(tx - 730, 70), eyes: 'nervous', mouth: 'scream', sweat: true };
  }
  if (f >= 150) {
    const k = ease((f - 150) / 45), jx = lerp(-360, 375, k);
    const walking = f < 195;
    j = walking ? { ...stride(jx + 360), eyes: 'neutral', mouth: 'closed' }
      : f < 222 ? { eyes: 'neutral', mouth: 'closed', armR: -165, pointR: true }
      : f < 336 ? { eyes: 'sly', mouth: 'smirk' }
      : f < 390 ? { eyes: 'neutral', armR: -165, pointR: true }
      : f < 574 ? { eyes: 'shock', mouth: 'o' }
      : f < 630 ? { eyes: 'neutral', armR: -165, pointR: true }
      : { eyes: 'sly', mouth: 'smirk', armL: 20, armR: -20 };
    a.push({ who: 'salesman', x: jx, y: 1150, w: 330, pose: talk('J', j) });
  }
  if (f >= 470 && f < 514) b.armL = 118;
  a.unshift({ who: 'buyer', x: 20, y: 1150 + (f >= 470 && f < 484 ? -Math.sin(((f - 470) / 14) * Math.PI) * 80 : 0), w: 330, pose: talk('B', b) });
  a.push({ who: 'tauke', x: tx, y: 1150, w: 330, pose: talk('T', t) });
  return a;
}

const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const font = readFileSync(`${DIR}../../api/_fonts/outfit-latin-700-normal.woff`).toString('base64');
const car = `data:image/png;base64,${readFileSync(`${DIR}assets/car-myvi-toon.png`).toString('base64')}`;
const html = `<!doctype html><html><head><style>
@font-face{font-family:Outfit;font-weight:700;src:url(data:font/woff;base64,${font})}
body{margin:0;background:#000;font-family:Outfit} #stage{position:relative;width:1080px;height:1920px;overflow:hidden}
#world{position:absolute;inset:0;transform-origin:540px 1150px} .l{position:absolute}
#sign{position:absolute;left:220px;top:598px;width:640px;text-align:center;color:#16181d;font:700 66px Outfit;letter-spacing:-1px;line-height:1.05}
#sign i{display:block;font-style:normal;color:#dc2626;font-size:52px;transform:rotate(-3deg);margin-top:10px}
#close{position:absolute;inset:0;display:none}
#cap{position:absolute;left:0;right:0;top:1400px;text-align:center;font:700 72px Outfit;color:#fff;
 -webkit-text-stroke:14px #16181d;paint-order:stroke fill;line-height:1.1;padding:0 60px;transform-origin:50% 50%}
#cap b{color:#ff3b3b}
#card{position:absolute;left:90px;right:90px;top:250px;background:#fff;border-radius:28px;padding:26px 30px;display:none;
 box-shadow:0 14px 0 #16181d;border:6px solid #16181d;align-items:center;gap:26px}
#card .n{flex:none;width:96px;height:96px;border-radius:50%;background:#dc2626;color:#fff;font:700 64px Outfit;display:flex;align-items:center;justify-content:center;border:5px solid #16181d}
#card .t{font:700 52px Outfit;color:#16181d;line-height:1.05} #card .t span{display:block;color:#dc2626;font-size:40px}
#end{position:absolute;inset:0;background:#dc2626;display:none;flex-direction:column;align-items:center;justify-content:center;gap:40px;color:#fff;font:700 64px Outfit}
</style></head><body><div id=stage><div id=world>
<img id=bgLot class=l src="${b64(lot())}" style="left:0;top:0;width:1080px">
<img id=bgShow class=l src="${b64(showroom())}" style="left:0;top:0;width:1080px;display:none">
<div id=sign>TAUKE LAN AUTO<i>MURAH!! TIP TOP!!</i></div>
<img id=car class=l src="${car}" style="left:160px;top:770px;width:760px">
<div id=close></div>
<svg id=fx class=l viewBox="0 0 1080 1920" style="left:0;top:0;width:1080px;height:1920px"></svg>
<img id=a0 class=l><img id=a1 class=l><img id=a2 class=l>
</div><div id=card><div class=n></div><div class=t></div></div><div id=cap></div>
<div id=end><svg viewBox="0 0 688 120" width="560">${logo(0, 0, 688, '#fff')}</svg><div>Follow untuk tip lagi</div></div></div></body></html>`;

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.setContent(html);
await pg.evaluate(() => document.fonts.ready);
const cache = new Map();
const svgUrl = (who, p) => { const k = who + JSON.stringify(p); if (!cache.has(k)) cache.set(k, b64(character(who, p))); return cache.get(k); };

for (let f = 0; f < N; f++) {
  const shot = SHOT(f), acts = actors(f);
  const line = LINES.find(([s, e]) => f >= s && f < e);
  const card = CARDS.find(([s, e]) => f >= s && f < e);
  const shotStart = { lot: 0, carpet: 390, show: 810, lamp: 630 }[shot];
  const zoom = shot === 'lot' || shot === 'show' ? 1 + 0.03 * ease((f - shotStart) / 150) : 1;
  const camX = shake(f, 428, 16, 18) + shake(f, 470, 12, 14), camY = shake(f + 3, 428, 16, 14);
  // the fish on the ground after it jumps out, flopping
  let fx = shot === 'lot' ? stink(f) : '';
  if (shot === 'lot' && f >= 470) fx += fish(250, 1810 - Math.abs(Math.sin(f / 4)) * (f < 600 ? 40 : 12), Math.sin(f / 3) * 25);
  const capScale = line ? 0.6 + 0.4 * ease((f - line[0]) / 5) + (f - line[0] < 7 ? 0.08 * Math.sin(((f - line[0]) / 7) * Math.PI) : 0) : 1;
  const cardIn = card ? ease((f - card[0]) / 8) : 0;
  await pg.evaluate(async (v) => {
    const $ = (id) => document.getElementById(id);
    $('world').style.transform = `translate(${v.camX}px,${v.camY}px) scale(${v.zoom})`;
    $('bgLot').style.display = v.shot === 'lot' ? '' : 'none';
    $('sign').style.display = v.shot === 'lot' ? '' : 'none';
    $('car').style.display = v.shot === 'lot' ? '' : 'none';
    $('bgShow').style.display = v.shot === 'show' ? '' : 'none';
    $('fx').innerHTML = v.fx;
    $('close').style.display = v.close ? 'block' : 'none'; if (v.close) $('close').innerHTML = v.close;
    const imgs = [];
    for (let i = 0; i < 3; i++) {
      const el = $('a' + i), a = v.acts[i];
      if (!a) { el.style.display = 'none'; continue; }
      el.style.display = ''; if (el.src !== a.src) { el.src = a.src; imgs.push(el); }
      el.style.left = `${a.x}px`; el.style.top = `${a.y}px`; el.style.width = `${a.w}px`;
    }
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    $('cap').style.top = `${v.capTop}px`; $('cap').innerHTML = v.cap; $('cap').style.transform = `scale(${v.capScale})`; $('cap').style.display = v.end ? 'none' : '';
    $('card').style.display = v.card ? 'flex' : 'none';
    if (v.card) { $('card').querySelector('.n').textContent = v.card[2]; $('card').querySelector('.t').innerHTML = `${v.card[3]}<span>${v.card[4]}</span>`;
      $('card').style.transform = `translateY(${(1 - v.cardIn) * -260}px)`; }
    $('end').style.display = v.end ? 'flex' : 'none';
  }, { shot, camX, camY, zoom, fx, cap: line ? line[3] : '', capScale, capTop: shot === 'lot' ? 1000 : shot === 'show' ? 880 : 1400, card, cardIn, end: f >= END,
    close: shot === 'carpet' ? carpet(f) : shot === 'lamp' ? lamp(f) : '',
    acts: acts.map((a) => ({ src: svgUrl(a.who, a.pose), x: a.x, y: a.y, w: a.w })) });
  await pg.screenshot({ path: `${FR}${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
}
await br.close();

// sound on a silent base: caption pops, stink, carpet whoosh, splash, fish flops, card whooshes, running, end ding
const ms = (f) => Math.round((f / FPS) * 1000);
const at = (src, f, i) => `${src},adelay=${ms(f)}|${ms(f)}[x${i}]`;
const cues = [
  ...LINES.map(([s], i) => [`sine=f=${700 + (i % 5) * 80}:d=0.07,volume=0.22`, s]),
  ['sine=f=140:d=0.5,volume=0.35,afade=t=out:st=0.1:d=0.4', 222],
  ['anoisesrc=c=pink:d=0.35:a=0.5,highpass=f=1200,afade=t=out:st=0.05:d=0.3', 396],
  ['anoisesrc=c=brown:d=0.6:a=0.9,lowpass=f=900,afade=t=out:st=0.05:d=0.55', 428],
  ...[440, 452, 466, 476, 490, 506, 528].map((f) => ['sine=f=320:d=0.06,volume=0.3', f]),
  ...CARDS.map(([s]) => ['anoisesrc=c=white:d=0.18:a=0.35,bandpass=f=2500,afade=t=out:st=0.03:d=0.15', s]),
  ...Array.from({ length: 11 }, (_, i) => ['anoisesrc=c=pink:d=0.05:a=0.5,highpass=f=900,lowpass=f=3000', 728 + i * 5]),
  ['anoisesrc=c=white:d=0.9:a=0.6,lowpass=f=2500,afade=t=out:st=0.02:d=0.85', 470],
  ['sine=f=1320:d=0.35,volume=0.2,afade=t=out:st=0.05:d=0.3', END], ['sine=f=1760:d=0.45,volume=0.16,afade=t=out:st=0.1:d=0.35', END + 4],
];
const filter = `${cues.map(([src, f], i) => at(src, f, i)).join(';')};[1:a]atrim=0:${N / FPS}[base];[base]${cues.map((_, i) => `[x${i}]`).join('')}amix=inputs=${cues.length + 1}:normalize=0:duration=first,asetpts=PTS-STARTPTS[a]`;
const OUT = `${DIR}preview/ep1-tak-pernah-masuk-air.mp4`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FR}%04d.jpg`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-g', '30', '-profile:v', 'main',
  '-movflags', '+faststart', '-c:a', 'aac', '-ar', '44100', '-t', String(N / FPS), OUT]);
console.log('ok', OUT);
