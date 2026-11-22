// Face texture for the 3D cast: the 2D rig's eyes + nose + extras + mouth, in the head box
// (x 115..385, y 120..400) that cast3d.js wraps onto the front of the head.
import { PEOPLE, eyes, mouth } from '../tools/rig.mjs';

export function faceSvg(who, q) {
  const p = PEOPLE[who];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="115 120 270 280" width="540" height="560">
    ${q.tint ? `<ellipse cx="250" cy="260" rx="135" ry="150" fill="${q.tint === 'green' ? '#7bc96f' : '#e5484d'}" opacity="0.35"/>` : ''}
    ${eyes(q.eyes || 'neutral')}
    <path d="M245 280 Q236 312 252 318" fill="none" stroke="${p.skinDark}" stroke-width="7" stroke-linecap="round"/>
    ${p.extra()}${mouth(q.mouth || 'closed')}
    ${q.blush ? `<ellipse cx="165" cy="315" rx="26" ry="14" fill="#ff7a8a" opacity="0.6"/><ellipse cx="335" cy="315" rx="26" ry="14" fill="#ff7a8a" opacity="0.6"/>` : ''}
    ${q.vein ? `<path d="M318 150 l16 16 m-4 -22 l-6 28 m24 -14 l-28 6 m22 12 l-16 -16" stroke="#c0161d" stroke-width="8" stroke-linecap="round"/>` : ''}
    ${q.tears ? `<path d="M182 278 Q170 340 178 400 L200 400 Q196 340 204 280 Z M318 278 Q330 340 322 400 L300 400 Q304 340 296 280 Z" fill="#7cc7ff" stroke="#16181d" stroke-width="4" opacity="0.9"/>` : ''}
    ${q.sweat ? `<path d="M360 170 Q378 205 360 222 Q342 205 360 170 Z" fill="#7cc7ff" stroke="#16181d" stroke-width="4"/>` : ''}
  </svg>`;
}

