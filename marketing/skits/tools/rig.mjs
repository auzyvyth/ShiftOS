// Drevo Skits: every drawn asset, as SVG strings, built from parts so the same
// pieces can be animated later (arm angle, eyes, mouth are parameters).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOGO_D = readFileSync(`${ROOT}public/drevo-logo.svg`, 'utf8').match(/ d="([^"]+)"/)[1];

export const C = {
  red: '#dc2626', redDark: '#a91d1d', ink: '#16181d', white: '#ffffff',
  wall: '#f4f5f7', floor: '#e9ebef', grey: '#c9cdd4', glass: '#2a3340',
};
const OL = `stroke="${C.ink}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

// Drevo wordmark at a given box (logo is 688x120).
export const logo = (x, y, w, fill = '#F40000') =>
  `<g transform="translate(${x} ${y}) scale(${w / 688})"><path fill="${fill}" fill-rule="evenodd" d="${LOGO_D}"/></g>`;

// ---------- characters ----------
// Viewbox 500x1000, feet on y=975. Arm angles: 0 = straight down, -90 = out to the right side
// for the right arm (+90 for the left), -160 = raised.
const PEOPLE = {
  salesman: {
    name: 'Abang Jo', skin: '#c68b59', skinDark: '#a86f42',
    shirt: C.red, shirtDark: C.redDark, pants: '#22252b', shoe: '#0c0d10',
    hair: (o) => `<path d="M118 205 C110 95 205 62 280 70 C350 78 398 120 392 200 C380 165 352 140 300 138 C250 136 190 150 150 175 C135 186 124 196 118 205 Z" fill="#14161a" ${o}/>
      <path d="M200 92 C240 50 330 55 345 100 C320 80 260 80 230 105 Z" fill="#2b2f36"/>`,
    extra: () => `<path d="M215 330 C235 322 265 322 285 330" fill="none" stroke="#14161a" stroke-width="9" stroke-linecap="round"/>`, // moustache
    torsoDetail: () => `
      <path d="M215 400 L250 445 L285 400" fill="none" stroke="${C.white}" stroke-width="7" stroke-linejoin="round"/>
      <line x1="250" y1="445" x2="250" y2="495" stroke="${C.redDark}" stroke-width="5"/>
      ${logo(150, 520, 92, C.white)}
      <path d="M205 402 C215 470 235 520 250 560 C265 520 285 470 295 402" fill="none" stroke="${C.ink}" stroke-width="5"/>
      <rect x="232" y="560" width="36" height="50" rx="5" fill="${C.white}" ${OL.replace('6', '4')}/>
      <rect x="240" y="572" width="20" height="5" rx="2" fill="${C.red}"/>`,
  },
  buyer: {
    name: 'Faiz', skin: '#d9a273', skinDark: '#bb8456',
    shirt: '#f7f7f8', shirtDark: '#d8dbe0', pants: '#33415a', shoe: '#f2f2f2',
    hair: (o) => `<path d="M120 200 C115 110 190 70 260 72 C335 74 390 115 385 195 C330 150 230 140 120 200 Z" fill="#1d1f24" ${o}/>
      <path d="M115 175 C140 95 360 90 388 170 L392 192 C300 150 200 150 110 195 Z" fill="${C.ink}"/>
      <path d="M100 190 C70 195 55 205 60 215 C110 205 160 195 200 188" fill="${C.ink}"/>`,
    extra: () => '',
    torsoDetail: () => `<path d="M212 402 C225 430 275 430 288 402" fill="none" stroke="${C.ink}" stroke-width="5"/>
      <path d="M330 420 L175 640" stroke="#4b3a2a" stroke-width="12" stroke-linecap="round"/>
      <rect x="150" y="610" width="70" height="55" rx="14" fill="#5a4634" ${OL}/>`,
  },
};

function arm(p, side, angle) {
  const sx = side === 'L' ? 152 : 348;
  return `<g transform="translate(${sx} 425) rotate(${angle})">
    <rect x="-27" y="-10" width="54" height="225" rx="27" fill="${p.skin}" ${OL}/>
    <path d="M-36 -18 Q-40 60 -32 85 L32 85 Q40 60 36 -18 Q0 -38 -36 -18 Z" fill="${p.shirt}" ${OL}/>
    <circle cx="0" cy="228" r="31" fill="${p.skin}" ${OL}/>
  </g>`;
}

function eyes(kind) {
  if (kind === 'happy') return `<path d="M180 262 Q200 238 220 262 M280 262 Q300 238 320 262" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>`;
  if (kind === 'shock') return `<ellipse cx="200" cy="255" rx="30" ry="36" fill="#fff" ${OL}/><ellipse cx="300" cy="255" rx="30" ry="36" fill="#fff" ${OL}/>
    <circle cx="200" cy="258" r="7" fill="${C.ink}"/><circle cx="300" cy="258" r="7" fill="${C.ink}"/>
    <path d="M168 200 Q195 182 225 196 M275 196 Q305 182 332 200" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>`;
  if (kind === 'sly') return `<ellipse cx="200" cy="260" rx="24" ry="20" fill="#fff" ${OL}/><ellipse cx="300" cy="260" rx="24" ry="20" fill="#fff" ${OL}/>
    <circle cx="210" cy="262" r="10" fill="${C.ink}"/><circle cx="310" cy="262" r="10" fill="${C.ink}"/>
    <path d="M172 240 L228 250 M272 250 L328 240" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>`;
  // neutral
  return `<ellipse cx="200" cy="258" rx="24" ry="29" fill="#fff" ${OL}/><ellipse cx="300" cy="258" rx="24" ry="29" fill="#fff" ${OL}/>
    <circle cx="204" cy="262" r="11" fill="${C.ink}"/><circle cx="304" cy="262" r="11" fill="${C.ink}"/>
    <path d="M176 215 Q200 205 224 214 M276 214 Q300 205 324 215" fill="none" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>`;
}

function mouth(kind) {
  if (kind === 'talk') return `<path d="M215 345 Q250 340 285 345 Q280 395 250 398 Q220 395 215 345 Z" fill="#5b1414" ${OL}/><path d="M228 382 Q250 370 272 382 Q262 396 250 396 Q238 396 228 382 Z" fill="#e0606a"/>`;
  if (kind === 'o') return `<ellipse cx="250" cy="370" rx="20" ry="26" fill="#5b1414" ${OL}/>`;
  if (kind === 'grin') return `<path d="M200 345 Q250 352 300 345 Q295 392 250 395 Q205 392 200 345 Z" fill="#fff" ${OL}/><line x1="203" y1="365" x2="297" y2="365" stroke="${C.ink}" stroke-width="4"/>`;
  return `<path d="M215 360 Q250 382 285 360" fill="none" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>`;
}

// pose = { armL, armR, eyes, mouth, sweat }
export function character(who, pose = {}) {
  const p = PEOPLE[who];
  const { armL = 10, armR = -10, eyes: e = 'neutral', mouth: m = 'closed', sweat = false } = pose;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 1000" width="500" height="1000">
  <ellipse cx="250" cy="978" rx="150" ry="16" fill="#000" opacity="0.12"/>
  <g id="legs">
    <rect x="172" y="640" width="70" height="320" rx="30" fill="${p.pants}" ${OL}/>
    <rect x="258" y="640" width="70" height="320" rx="30" fill="${p.pants}" ${OL}/>
    <path d="M150 975 Q150 940 200 938 L245 938 L245 975 Z" fill="${p.shoe}" ${OL}/>
    <path d="M350 975 Q350 940 300 938 L255 938 L255 975 Z" fill="${p.shoe}" ${OL}/>
  </g>
  <g id="arm-back">${arm(p, 'L', armL)}</g>
  <g id="torso">
    <path d="M145 410 Q250 370 355 410 L368 670 Q250 692 132 670 Z" fill="${p.shirt}" ${OL}/>
    <path d="M300 420 L355 410 L368 670 Q330 680 300 682 Z" fill="${p.shirtDark}" opacity="0.55"/>
    ${p.torsoDetail()}
  </g>
  <g id="arm-front">${arm(p, 'R', armR)}</g>
  <g id="head">
    <rect x="222" y="360" width="56" height="50" fill="${p.skinDark}" ${OL}/>
    <circle cx="118" cy="265" r="30" fill="${p.skin}" ${OL}/><circle cx="382" cy="265" r="30" fill="${p.skin}" ${OL}/>
    <ellipse cx="250" cy="250" rx="135" ry="150" fill="${p.skin}" ${OL}/>
    <path d="M330 140 Q395 230 345 380 Q380 300 365 200 Z" fill="${p.skinDark}" opacity="0.35"/>
    ${p.hair(OL)}
    <g id="eyes">${eyes(e)}</g>
    <path d="M245 280 Q236 312 252 318" fill="none" stroke="${p.skinDark}" stroke-width="7" stroke-linecap="round"/>
    ${p.extra()}
    <g id="mouth">${mouth(m)}</g>
    ${sweat ? `<path d="M380 170 Q398 205 380 222 Q362 205 380 170 Z" fill="#7cc7ff" ${OL.replace('6', '4')}/>` : ''}
  </g>
</svg>`;
}

// ---------- the car: Myvi-style compact hatch, side view, facing right ----------
// Short nose, steep screen, tall roof, short rear: the Myvi silhouette. No maker badge.
export function myvi(color = C.red, dark = C.redDark) {
  const wheel = (cx) => `<g>
    <circle cx="${cx}" cy="330" r="80" fill="#17191d" ${OL}/>
    <circle cx="${cx}" cy="330" r="52" fill="#d9dde3" ${OL.replace('6', '4')}/>
    ${[0, 72, 144, 216, 288].map((a) => `<rect x="${cx - 7}" y="281" width="14" height="48" rx="6" fill="#8d939c" transform="rotate(${a} ${cx} 330)"/>`).join('')}
    <circle cx="${cx}" cy="330" r="12" fill="#4a4f57"/>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 830 440" width="830" height="440">
  <ellipse cx="415" cy="418" rx="400" ry="20" fill="#000" opacity="0.16"/>
  <path d="M50 300 L46 190 Q48 120 92 92 Q250 60 420 66 Q470 70 500 96 L590 182 Q690 196 742 222 Q780 242 786 282 L789 318 Q786 340 756 345 L60 345 Q48 335 50 300 Z" fill="${color}" ${OL}/>
  <path d="M52 262 L787 262 L789 318 Q786 340 756 345 L60 345 Q48 335 52 262 Z" fill="${dark}" opacity="0.45"/>
  <path d="M118 102 Q260 78 412 82 Q450 84 478 106 L552 184 L128 190 Z" fill="${C.glass}" ${OL.replace('6', '5')}/>
  <path d="M410 82 L432 186" stroke="${C.ink}" stroke-width="14"/>
  <path d="M262 80 L270 188" stroke="${C.ink}" stroke-width="12"/>
  <path d="M140 104 L215 96 L192 178 L140 182 Z" fill="#fff" opacity="0.16"/>
  <path d="M48 190 Q50 140 86 106 L92 196 Z" fill="#7a0f12" ${OL.replace('6', '4')}/>
  <path d="M700 214 Q756 228 776 264 L730 260 Q706 240 688 222 Z" fill="#f4f6f9" ${OL.replace('6', '4')}/>
  <path d="M778 294 L787 294 L788 318 L764 318 Z" fill="${C.ink}"/>
  <path d="M535 182 L560 164 L582 180 L560 200 Z" fill="${C.ink}"/>
  <line x1="282" y1="194" x2="288" y2="330" stroke="${C.ink}" stroke-width="4" opacity="0.6"/>
  <line x1="462" y1="194" x2="476" y2="330" stroke="${C.ink}" stroke-width="4" opacity="0.6"/>
  <rect x="350" y="214" width="44" height="10" rx="5" fill="${C.ink}" opacity="0.8"/>
  <rect x="520" y="214" width="44" height="10" rx="5" fill="${C.ink}" opacity="0.8"/>
  <path d="M52 328 L788 328 L786 345 Q740 352 60 348 Z" fill="#1d2025"/>
  <path d="M112 330 Q112 226 192 226 Q272 226 272 330 Z" fill="#1d2025" ${OL}/>
  <path d="M568 330 Q568 226 648 226 Q728 226 728 330 Z" fill="#1d2025" ${OL}/>
  ${wheel(192)}${wheel(648)}
</svg>`;
}

// ---------- background: a Drevo showroom, 1080x1920 ----------
export function showroom() {
  const lights = [180, 540, 900].map((x) => `
    <rect x="${x - 70}" y="0" width="140" height="22" rx="8" fill="${C.ink}"/>
    <path d="M${x - 60} 22 L${x - 230} 1160 L${x + 230} 1160 L${x + 60} 22 Z" fill="url(#beam)"/>`).join('');
  const tiles = Array.from({ length: 12 }, (_, i) => {
    const x = -600 + i * 210;
    return `<line x1="${540 + (x - 540) * 0.45}" y1="1160" x2="${x}" y2="1920" stroke="#d6d9df" stroke-width="3"/>`;
  }).join('') + [1260, 1400, 1600, 1860].map((y) => `<line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="#d6d9df" stroke-width="3"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7e9ed"/><stop offset="1" stop-color="${C.wall}"/></linearGradient>
  </defs>
  <rect width="1080" height="1160" fill="url(#wall)"/>
  <rect x="0" y="380" width="1080" height="210" fill="${C.red}"/>
  ${logo(300, 432, 480, C.white)}
  <rect x="70" y="700" width="300" height="340" rx="10" fill="#cfe8f7" stroke="${C.ink}" stroke-width="8"/>
  <path d="M70 960 Q150 900 230 940 Q300 905 370 950 L370 1040 L70 1040 Z" fill="#7fbf7a"/>
  <path d="M130 960 L150 790 M150 790 Q110 770 90 800 M150 790 Q190 765 215 790 M150 790 Q140 750 160 735" stroke="#3f7a3c" stroke-width="10" fill="none" stroke-linecap="round"/>
  <line x1="220" y1="700" x2="220" y2="1040" stroke="${C.ink}" stroke-width="8"/>
  <rect x="770" y="720" width="220" height="150" rx="10" fill="${C.ink}"/>
  <rect x="784" y="734" width="192" height="122" rx="4" fill="#fff"/>
  <rect x="806" y="820" width="30" height="20" fill="${C.grey}"/><rect x="852" y="790" width="30" height="50" fill="${C.grey}"/>
  <rect x="898" y="760" width="30" height="80" fill="${C.red}"/><rect x="806" y="750" width="70" height="12" rx="6" fill="${C.ink}"/>
  <rect x="1060" y="0" width="20" height="1160" fill="#dcdfe4"/>
  <rect x="0" y="1130" width="1080" height="30" fill="${C.ink}"/>
  ${lights}
  <rect y="1160" width="1080" height="760" fill="${C.floor}"/>
  ${tiles}
  <rect y="1160" width="1080" height="760" fill="url(#beam)" opacity="0.35"/>
</svg>`;
}
