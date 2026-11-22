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
    // neat side-part quiff: follows the skull, sideburns stop at the ear
    hair: (o) => `<path d="M114 244 L114 205 C110 118 170 72 252 70 C334 70 394 116 388 205 L388 244 L368 244
        C366 206 354 180 334 166 C300 146 246 154 212 136 C192 152 158 172 140 206 L136 244 Z" fill="#1b1d22" ${o}/>
      <path d="M212 136 C204 118 196 104 186 92" fill="none" stroke="#3b4049" stroke-width="7" stroke-linecap="round"/>
      <path d="M226 92 C262 82 304 88 334 108" fill="none" stroke="#3b4049" stroke-width="8" stroke-linecap="round"/>`,
    extra: () => `<path d="M215 330 C235 322 265 322 285 330" fill="none" stroke="#14161a" stroke-width="9" stroke-linecap="round"/>`, // moustache
    torsoDetail: () => `
      <path d="M215 400 L250 445 L285 400" fill="none" stroke="${C.white}" stroke-width="7" stroke-linejoin="round"/>
      <line x1="250" y1="445" x2="250" y2="495" stroke="${C.redDark}" stroke-width="5"/>
      ${logo(150, 520, 92, C.white)}
      <path d="M205 402 C215 470 235 520 250 560 C265 520 285 470 295 402" fill="none" stroke="${C.ink}" stroke-width="5"/>
      <rect x="232" y="560" width="36" height="50" rx="5" fill="${C.white}" ${OL.replace('6', '4')}/>
      <rect x="240" y="572" width="20" height="5" rx="2" fill="${C.red}"/>`,
  },
  tauke: {
    name: 'Tauke Lan', skin: '#b97e4f', skinDark: '#9a6538',
    shirt: '#f2b705', shirtDark: '#c98f00', pants: '#8b7b58', shoe: '#5a3b22',
    // slicked-back hair, thick and shiny, no part
    hair: (o) => `<path d="M114 236 L114 200 C112 112 176 70 252 70 C330 70 392 112 388 200 L388 236 L368 236
        C366 190 350 160 320 150 C280 136 220 138 184 150 C152 162 138 190 136 236 Z" fill="#121317" ${o}/>
      <path d="M170 104 C220 84 290 84 340 112 M180 128 C230 110 290 110 336 134" fill="none" stroke="#3b4049" stroke-width="6" stroke-linecap="round"/>`,
    // thick moustache + goatee
    extra: () => `<path d="M206 336 C226 318 274 318 294 336 C276 332 262 334 250 342 C238 334 224 332 206 336 Z" fill="#121317" stroke="#121317" stroke-width="6" stroke-linejoin="round"/>
      <path d="M238 402 Q250 418 262 402 Z" fill="#121317" stroke="#121317" stroke-width="5" stroke-linejoin="round"/>`,
    // loud flowery shirt, open collar, gold chain
    torsoDetail: () => `<path d="M208 400 L250 470 L292 400 Z" fill="#b97e4f" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M222 412 Q250 470 278 412" fill="none" stroke="#e8c14a" stroke-width="7" stroke-linecap="round"/>
      ${[[175, 500], [310, 520], [205, 600], [300, 615], [250, 545], [160, 640], [340, 450]].map(([x, y]) =>
        `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-13" rx="8" ry="13" fill="#e5484d" transform="rotate(${a})"/>`).join('')}<circle r="6" fill="#fff"/></g>`).join('')}`,
  },
  buyer: {
    name: 'Faiz', skin: '#d9a273', skinDark: '#bb8456',
    shirt: '#f7f7f8', shirtDark: '#d8dbe0', pants: '#33415a', shoe: '#f2f2f2',
    // front-facing cap: dome on the skull, curved brim, short sideburns under it
    hair: (o) => `<path d="M116 240 L116 186 L142 186 L140 240 Z M384 240 L384 186 L358 186 L360 240 Z" fill="#1b1d22" ${o}/>
      <path d="M110 182 C110 104 174 64 250 64 C326 64 390 104 390 182 Z" fill="#262a32" ${o}/>
      <path d="M250 66 L250 180 M180 80 C166 110 160 146 162 180 M320 80 C334 110 340 146 338 180" fill="none" stroke="#3b4049" stroke-width="5"/>
      <circle cx="250" cy="66" r="10" fill="#262a32" ${o}/>
      <rect x="226" y="120" width="48" height="34" rx="8" fill="${C.red}" ${o.replace('6', '4')}/>
      <path d="M102 182 Q250 160 398 182 Q392 202 250 200 Q108 202 102 182 Z" fill="${C.ink}" ${o}/>`,
    extra: () => '',
    torsoDetail: () => `<path d="M212 402 C225 430 275 430 288 402" fill="none" stroke="${C.ink}" stroke-width="5"/>
      <path d="M330 420 L175 640" stroke="#4b3a2a" stroke-width="12" stroke-linecap="round"/>
      <rect x="150" y="610" width="70" height="55" rx="14" fill="#5a4634" ${OL}/>`,
  },
};

function arm(p, side, angle, point = false) {
  const sx = side === 'L' ? 152 : 348;
  return `<g transform="translate(${sx} 425) rotate(${angle})">
    ${point ? `<rect x="-9" y="236" width="18" height="62" rx="9" fill="${p.skin}" ${OL}/>` : ''}
    <rect x="-27" y="-10" width="54" height="225" rx="27" fill="${p.skin}" ${OL}/>
    <path d="M-36 -18 Q-40 60 -32 85 L32 85 Q40 60 36 -18 Q0 -38 -36 -18 Z" fill="${p.shirt}" ${OL}/>
    <circle cx="0" cy="228" r="31" fill="${p.skin}" ${OL}/>
  </g>`;
}

function leg(p, hx, angle, dir, lift = 0) {
  const shoe = dir > 0 ? 'M-34 333 L-34 298 L14 298 Q58 300 60 333 Z' : 'M34 333 L34 298 L-14 298 Q-58 300 -60 333 Z';
  return `<g transform="translate(${hx} ${650 - lift}) rotate(${angle})">
    <rect x="-35" y="-10" width="70" height="320" rx="30" fill="${p.pants}" ${OL}/>
    <path d="${shoe}" fill="${p.shoe}" ${OL}/>
  </g>`;
}

function eyes(kind) {
  const K = C.ink;
  if (kind === 'blink') return `<path d="M178 262 Q200 272 222 262 M278 262 Q300 272 322 262" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M176 215 Q200 205 224 214 M276 214 Q300 205 324 215" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'up') return `<ellipse cx="200" cy="258" rx="24" ry="29" fill="#fff" ${OL}/><ellipse cx="300" cy="258" rx="24" ry="29" fill="#fff" ${OL}/>
    <circle cx="206" cy="242" r="11" fill="${K}"/><circle cx="306" cy="242" r="11" fill="${K}"/>
    <path d="M176 208 Q200 196 224 206 M276 206 Q300 196 324 208" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'suspicious') return `<path d="M176 262 L224 262 M276 262 L324 262" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="210" cy="270" r="9" fill="${K}"/><circle cx="310" cy="270" r="9" fill="${K}"/>
    <path d="M172 238 L228 246 M272 222 Q300 200 330 214" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round"/>`;
  if (kind === 'angry') return `<ellipse cx="200" cy="262" rx="24" ry="20" fill="#fff" stroke="${K}" stroke-width="6"/><ellipse cx="300" cy="262" rx="24" ry="20" fill="#fff" stroke="${K}" stroke-width="6"/>
    <circle cx="200" cy="266" r="7" fill="${K}"/><circle cx="300" cy="266" r="7" fill="${K}"/>
    <path d="M168 220 L232 248 M268 248 L332 220" stroke="${K}" stroke-width="12" stroke-linecap="round"/>`;
  if (kind === 'cry') return `<path d="M176 256 L222 266 L176 276 M324 256 L278 266 L324 276" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M172 222 Q200 236 226 228 M274 228 Q300 236 328 222" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'dizzy') return [200, 300].map((x) => `<path d="M${x} 258 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -17 0 a14 14 0 1 1 27 0 a19 19 0 1 1 -37 0" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`).join('');
  if (kind === 'stars') return [200, 300].map((x) => `<path d="M${x} 228 L${x + 9} 250 L${x + 32} 252 L${x + 14} 267 L${x + 20} 290 L${x} 277 L${x - 20} 290 L${x - 14} 267 L${x - 32} 252 L${x - 9} 250 Z" fill="#ffcf33" stroke="${K}" stroke-width="5" stroke-linejoin="round"/>`).join('');
  if (kind === 'wink') return `<ellipse cx="200" cy="258" rx="24" ry="29" fill="#fff" stroke="${K}" stroke-width="6"/><circle cx="204" cy="262" r="11" fill="${K}"/>
    <path d="M278 262 Q300 276 322 262" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
    <path d="M176 215 Q200 205 224 214 M276 230 Q300 214 324 226" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'nervous') return `<ellipse cx="200" cy="258" rx="26" ry="30" fill="#fff" stroke="${K}" stroke-width="6"/><ellipse cx="300" cy="258" rx="26" ry="30" fill="#fff" stroke="${K}" stroke-width="6"/>
    <circle cx="188" cy="252" r="8" fill="${K}"/><circle cx="288" cy="252" r="8" fill="${K}"/>
    <path d="M172 214 Q198 196 226 212 M274 212 Q302 196 328 214" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
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
  const K = C.ink;
  if (kind === 'frown') return `<path d="M215 378 Q250 352 285 378" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'wavy') return `<path d="M205 368 q11 -12 22 0 t22 0 t22 0 t22 0" fill="none" stroke="${K}" stroke-width="7" stroke-linecap="round"/>`;
  if (kind === 'scream') return `<path d="M200 340 Q250 330 300 340 Q300 420 250 425 Q200 420 200 340 Z" fill="#5b1414" stroke="${K}" stroke-width="6"/><path d="M212 344 L288 344 L284 358 L216 358 Z" fill="#fff"/><path d="M225 405 Q250 388 275 405 Q262 420 250 420 Q238 420 225 405 Z" fill="#e0606a"/>`;
  if (kind === 'smirk') return `<path d="M220 368 Q262 378 292 350" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'wail') return `<path d="M210 395 Q250 330 290 395 Z" fill="#5b1414" stroke="${K}" stroke-width="6" stroke-linejoin="round"/>`;
  if (kind === 'talk') return `<path d="M215 345 Q250 340 285 345 Q280 395 250 398 Q220 395 215 345 Z" fill="#5b1414" ${OL}/><path d="M228 382 Q250 370 272 382 Q262 396 250 396 Q238 396 228 382 Z" fill="#e0606a"/>`;
  if (kind === 'o') return `<ellipse cx="250" cy="370" rx="20" ry="26" fill="#5b1414" ${OL}/>`;
  if (kind === 'grin') return `<path d="M200 345 Q250 352 300 345 Q295 392 250 395 Q205 392 200 345 Z" fill="#fff" ${OL}/><line x1="203" y1="365" x2="297" y2="365" stroke="${C.ink}" stroke-width="4"/>`;
  return `<path d="M215 360 Q250 382 285 360" fill="none" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>`;
}

// pose = { armL, armR, eyes, mouth, sweat }
export function character(who, pose = {}) {
  const p = PEOPLE[who];
  const { armL = 10, armR = -10, eyes: e = 'neutral', mouth: m = 'closed', sweat = false, blush = false, vein = false, tears = false, tint = false,
    shades = false, legL = 0, legR = 0, liftL = 0, liftR = 0, stride = false, facing = 'front', pointL = false, pointR = false } = pose;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 1000" width="500" height="1000">
  <ellipse cx="250" cy="978" rx="150" ry="16" fill="#000" opacity="0.12"/>
  <g id="legs">${stride
    // walking: both legs swing from one point under the body, like the reference skits
    ? leg(p, 250, legR, facing === 'left' ? -1 : 1, 0) + leg(p, 250, legL, facing === 'left' ? -1 : 1, 0)
    : leg(p, 207, legL, facing === 'right' ? 1 : -1, liftL) + leg(p, 293, legR, facing === 'left' ? -1 : 1, liftR)}</g>
  <g id="arm-back">${arm(p, 'L', armL, pointL)}</g>
  <g id="torso">
    <path d="M145 410 Q250 370 355 410 L368 670 Q250 692 132 670 Z" fill="${p.shirt}" ${OL}/>
    <path d="M300 420 L355 410 L368 670 Q330 680 300 682 Z" fill="${p.shirtDark}" opacity="0.55"/>
    ${p.torsoDetail()}
  </g>
  <g id="arm-front">${arm(p, 'R', armR, pointR)}</g>
  <g id="head">
    <rect x="222" y="360" width="56" height="50" fill="${p.skinDark}" ${OL}/>
    <circle cx="118" cy="265" r="30" fill="${p.skin}" ${OL}/><circle cx="382" cy="265" r="30" fill="${p.skin}" ${OL}/>
    <ellipse cx="250" cy="250" rx="135" ry="150" fill="${p.skin}" ${OL}/>
    <path d="M330 140 Q395 230 345 380 Q380 300 365 200 Z" fill="${p.skinDark}" opacity="0.35"/>
    ${tint ? `<ellipse cx="250" cy="250" rx="135" ry="150" fill="${tint === 'green' ? '#7bc96f' : '#e5484d'}" opacity="${tint === 'green' ? 0.45 : 0.35}"/>` : ''}
    ${p.hair(OL)}
    <g id="eyes">${eyes(e)}</g>
    <path d="M245 280 Q236 312 252 318" fill="none" stroke="${p.skinDark}" stroke-width="7" stroke-linecap="round"/>
    ${p.extra()}
    <g id="mouth">${mouth(m)}</g>
    ${shades ? `<path d="M160 236 L240 236 Q240 290 200 290 Q160 290 160 236 Z M260 236 L340 236 Q340 290 300 290 Q260 290 260 236 Z" fill="#111" ${OL}/>
      <path d="M240 244 L260 244 M160 238 L118 230 M340 238 L382 230" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>
      <path d="M178 250 L196 266 M278 250 L296 266" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>` : ''}
    ${blush ? `<ellipse cx="165" cy="315" rx="26" ry="14" fill="#ff7a8a" opacity="0.6"/><ellipse cx="335" cy="315" rx="26" ry="14" fill="#ff7a8a" opacity="0.6"/>` : ''}
    ${vein ? `<path d="M318 150 l16 16 m-4 -22 l-6 28 m24 -14 l-28 6 m22 12 l-16 -16" stroke="#c0161d" stroke-width="8" stroke-linecap="round"/>` : ''}
    ${tears ? `<path d="M182 278 Q170 340 178 420 L200 420 Q196 340 204 280 Z M318 278 Q330 340 322 420 L300 420 Q304 340 296 280 Z" fill="#7cc7ff" stroke="${C.ink}" stroke-width="4" opacity="0.9"/>` : ''}
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

// The reference skits lay a fine dot grid over every drawn background. Put it LAST inside the <svg>.
export const dots = (op = 0.07) => `<defs><pattern id="dotgrid" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.2" fill="#000"/></pattern></defs>
  <rect width="1080" height="1920" fill="url(#dotgrid)" opacity="${op}"/>`;

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
  ${dots()}
</svg>`;
}
