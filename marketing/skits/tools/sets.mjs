// Shared drawn sets for skit episodes.
import { C, dots } from './rig.mjs';

// ---------- the dodgy lot (no Drevo branding: the flood car is NOT ours) ----------
export function lot() {
  const bunt = Array.from({ length: 13 }, (_, i) => {
    const x = 20 + i * 82, y = 420 + Math.sin((x / 1080) * Math.PI) * 70;
    return `<path d="M${x} ${y} L${x + 60} ${y + 4} L${x + 30} ${y + 58} Z" fill="${['#dc2626', '#f2b705', '#2f80ed'][i % 3]}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>`;
  }).join('');
  const palm = (x) => `<path d="M${x} 1180 C${x + 8} 1000 ${x - 10} 900 ${x + 10} 760" fill="none" stroke="#6b4b2e" stroke-width="22" stroke-linecap="round"/>
    ${[[-120, -10], [-80, 50], [110, -20], [70, 55], [0, -70]].map(([dx, dy]) => `<path d="M${x + 10} 760 Q${x + 10 + dx / 2} ${760 + dy - 60} ${x + 10 + dx} ${760 + dy}" fill="none" stroke="#3f7a3c" stroke-width="18" stroke-linecap="round"/>`).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3f0"/><stop offset="1" stop-color="#e8f5fb"/></linearGradient></defs>
  <rect width="1080" height="1180" fill="url(#sky)"/>
  <ellipse cx="180" cy="230" rx="110" ry="40" fill="#fff" opacity="0.9"/><ellipse cx="860" cy="300" rx="140" ry="44" fill="#fff" opacity="0.9"/>
  ${[[0, 900, 160], [150, 860, 140], [300, 940, 130], [700, 880, 150], [860, 920, 220]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${1180 - y}" fill="#cfd6de"/>`).join('')}
  ${palm(90)}${palm(990)}
  <path d="M0 420 Q540 560 1080 420" fill="none" stroke="${C.ink}" stroke-width="4"/>${bunt}
  <rect x="290" y="600" width="20" height="580" fill="#4a4f57"/><rect x="770" y="600" width="20" height="580" fill="#4a4f57"/>
  <rect x="220" y="580" width="640" height="220" rx="14" fill="#fff8e1" stroke="${C.red}" stroke-width="14"/>
  <rect y="1180" width="1080" height="740" fill="#7a7f87"/>
  ${[160, 470, 780].map((x) => `<path d="M${x} 1180 L${x - 120} 1920" stroke="#e9ebef" stroke-width="10" opacity="0.7"/>`).join('')}
  <ellipse cx="300" cy="1700" rx="150" ry="22" fill="#9fb6c9" opacity="0.8"/><ellipse cx="840" cy="1560" rx="90" ry="14" fill="#9fb6c9" opacity="0.7"/>
  ${dots()}
</svg>`;
}

