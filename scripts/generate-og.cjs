// One-time script: node scripts/generate-og.js
// Generates public/og-default.jpg (1200x630)

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1200;
const H = 630;
const STRIPE = 6;

// Build SVG — sharp renders SVG natively via librsvg
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f0f"/>
      <stop offset="100%" stop-color="#080808"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Subtle grid lines -->
  <g stroke="#1a1a1a" stroke-width="1" opacity="0.6">
    <line x1="0" y1="210" x2="${W}" y2="210"/>
    <line x1="0" y1="420" x2="${W}" y2="420"/>
    <line x1="400" y1="0" x2="400" y2="${H}"/>
    <line x1="800" y1="0" x2="800" y2="${H}"/>
  </g>

  <!-- Red left border stripe -->
  <rect x="0" y="0" width="${STRIPE}" height="${H}" fill="#dc2626"/>

  <!-- Red accent dot on stripe top -->
  <circle cx="${STRIPE / 2}" cy="60" r="3" fill="#fff" opacity="0.6"/>

  <!-- Faint red glow behind wordmark -->
  <ellipse cx="350" cy="295" rx="280" ry="110" fill="#dc2626" opacity="0.04"/>

  <!-- "ShiftOS" wordmark -->
  <text
    x="80" y="340"
    font-family="Arial Black, Arial, sans-serif"
    font-size="128"
    font-weight="900"
    letter-spacing="-2"
    fill="#ffffff"
  >ShiftOS</text>

  <!-- Red underline accent under wordmark -->
  <rect x="80" y="356" width="420" height="5" fill="#dc2626" rx="2"/>

  <!-- Subtitle -->
  <text
    x="80" y="420"
    font-family="Arial, sans-serif"
    font-size="26"
    font-weight="400"
    letter-spacing="0.5"
    fill="#a0a0a0"
  >The operating system for Malaysian car dealers</text>

  <!-- Bottom domain label -->
  <text
    x="80" y="580"
    font-family="Arial, sans-serif"
    font-size="16"
    font-weight="700"
    letter-spacing="4"
    fill="#dc2626"
  >XDRIVE.MY</text>

  <!-- Top-right faint brand mark -->
  <text
    x="${W - 60}" y="56"
    font-family="Arial Black, Arial, sans-serif"
    font-size="14"
    font-weight="900"
    letter-spacing="2"
    text-anchor="end"
    fill="#ffffff"
    opacity="0.08"
  >SHIFTOS</text>
</svg>`;

const outPath = path.join(__dirname, '..', 'public', 'og-default.jpg');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

sharp(Buffer.from(svg))
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(outPath)
  .then(info => console.log(`✓ Saved ${outPath} (${info.width}×${info.height}, ${(info.size / 1024).toFixed(1)} KB)`))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
