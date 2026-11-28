// Usage: npm run build && npx vite preview --port 4173, then
//   node tools/page-video/record.cjs <emptyDir> frames 300   (probe = 5 stills instead)
//   ffmpeg -framerate 30 -i <dir>/f%05d.png -vf "scale=600:-2,format=yuv420p" -c:v libx264 -crf 26 -movflags +faststart out.mp4
// Save as public/for-salesmen/premium-page-scroll-vN.mp4 (+ .jpg still) with a NEW N and update PageVideo.jsx.
// Records /s/premiummotors scrolling top -> footer. Real page code (vite preview), premiummotors' real public
// rows (read 2026-11-28), photos = the owner's own car photos in the repo. Only cars with a local photo are shown.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const REPO = path.resolve(__dirname, '../..');
const OUT = process.argv[2]; const MODE = process.argv[3] || 'frames';
const PH = REPO + '/marketing/ads/drevo-remotion/public/photos/';
const base = (o) => ({ state: 'Kuala Lumpur', status: 'available', dealer_id: 'f92eb826-e99e-4d43-bc26-8b5a1540b717', docs_verified: false, is_model_card: false, ...o });
const IMG = (k) => `https://lemdkdizdlcirhbzqlos.supabase.co/storage/v1/object/public/car-images/local/${k}.jpg`;
const CARS = [
  base({ id: 'f0370c43-6804-4208-b165-27f6b4a48513', slug: 'mazda-mx-5-2024-f037', year: 2024, brand: 'Mazda', model: 'MX-5', variant: 'S', colour: 'Red', mileage: 8500, transmission: 'Manual', condition: 'recon', engine_cc: 1998, selling_price: 173000, images: [IMG('mx5')], created_at: '2026-10-29T15:51:58Z' }),
  base({ id: '5676687b-0534-4953-bec3-08b8534d3354', slug: 'land-rover-defender-2023-5676', year: 2023, brand: 'Land Rover', model: 'Defender', variant: '90', colour: 'Black', mileage: 10000, transmission: 'Auto', condition: 'recon', engine_cc: 2000, selling_price: 270000, images: [IMG('defender')], created_at: '2026-10-29T15:55:28Z' }),
  base({ id: '95d8034d-bb11-4ca7-bc52-537deda90339', slug: 'honda-civic-2025-95d8', year: 2025, brand: 'Honda', model: 'Civic', variant: 'Type R', colour: 'White', mileage: 866, transmission: 'Auto', condition: 'recon', engine_cc: 1996, selling_price: 250000, images: [IMG('civic')], created_at: '2026-10-29T15:40:37Z' }),
  base({ id: '8345a867-d88e-4e5f-953e-ac556d6ca03f', slug: 'toyota-gr86-2025-8345', year: 2025, brand: 'Toyota', model: 'GR86', variant: 'RZ', colour: 'Red', mileage: 8752, transmission: 'Manual', condition: 'recon', engine_cc: 2400, selling_price: 175000, images: [IMG('gr86')], created_at: '2026-10-29T15:37:57Z' }),
  base({ id: '0bb78749-53a0-4f66-a378-9e508dc5e828', slug: 'toyota-yaris-2024-0bb7', year: 2024, brand: 'Toyota', model: 'GR Yaris', variant: 'RZ High Performance', colour: 'White', mileage: 12000, transmission: 'Auto', condition: 'recon', engine_cc: 1496, selling_price: 240000, images: [IMG('gryaris')], created_at: '2026-10-29T15:34:37Z' }),
];
const FILES = { mx5: 'mx5-2024.jpg', defender: 'defender-90-2023.jpg', civic: 'civic-fl5-2025.jpg', gr86: 'gr86-2025.jpg', gryaris: 'gr-yaris-2024.png' };
const PROFILE = { id: 'f92eb826-e99e-4d43-bc26-8b5a1540b717', bio: 'Selling Recon Toyota Alphard, vellfire and Lexus RXs!\nWhatsapp me for custom enquiries.', city: 'Jalan semarak', slug: 'premiummotors', state: 'Kuala Lumpur', tiktok: '@xdrive', website: null, facebook: null, location: 'Rasniaga Auto Jalan Semarak KL', cover_url: null, dealer_id: null, full_name: 'Auzyvyth', instagram: '@airyauzy_', job_title: 'Junior sales advisor', site_name: null, subdomain: null, about_text: null, avatar_url: null, dealership: 'PremiumMotors', page_basic: false, brand_color: '#7C3AED', is_verified: true, seller_type: 'broker', has_whatsapp: true, response_time: 'Within 30 minutes', specializations: ['Recon imports'], whatsapp_number: null };
const ABOUT = { languages: ['ms', 'en'], my_promise: 'Peace of mind comes first', areas_covered: 'Peninsular Malaysia', years_selling: 2 };
const RPC = { get_salesman_by_slug: PROFILE, get_agent_about: ABOUT, get_salesman_featured_listings: [], get_agent_pins: [], get_agent_car_order: [], get_agent_nickname: null, get_agent_hero: null, get_agent_site: null, get_agent_handover_photos: [], get_agent_recent_sales: [], get_agent_reply_time: null, get_salesman_live: null };
const FONT_CSS = ['Outfit:300:outfit-latin-500-normal', 'Outfit:400:outfit-latin-500-normal', 'Outfit:500:outfit-latin-500-normal', 'Outfit:600:outfit-latin-700-normal', 'Outfit:700:outfit-latin-700-normal', 'Outfit:800:outfit-latin-700-normal', 'Outfit:900:outfit-latin-700-normal', 'Bebas Neue:400:bebas-neue-latin-400-normal']
  .map((s) => { const [f, w, file] = s.split(':'); return `@font-face{font-family:'${f}';font-weight:${w};font-style:normal;font-display:block;src:url(https://fonts.gstatic.com/local/${file}.woff) format('woff')}`; }).join('\n');
const unknown = new Set();
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('xdrive_cookie_consent', JSON.stringify({ v: 1, analytics: false, preferences: false, ts: Date.now() })); } catch (e) {} });
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS });
    if (u.hostname === 'fonts.gstatic.com' && u.pathname.startsWith('/local/')) return route.fulfill({ status: 200, contentType: 'font/woff', body: fs.readFileSync(REPO + '/api/_fonts/' + path.basename(u.pathname)) });
    let img = null;
    if (u.hostname === 'wsrv.nl') img = decodeURIComponent(u.searchParams.get('url') || '');
    else if (u.pathname.includes('/storage/v1/object/')) img = u.pathname;
    if (img !== null) { const k = (img.match(/local\/([a-z0-9]+)\.jpg/) || [])[1]; return k ? route.fulfill({ status: 200, contentType: FILES[k].endsWith('png') ? 'image/png' : 'image/jpeg', body: fs.readFileSync(PH + FILES[k]) }) : route.fulfill({ status: 404, body: '' }); }
    if (u.hostname.endsWith('supabase.co')) {
      const accObj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const send = (data) => {
        if (accObj) return data == null || (Array.isArray(data) && !data.length) ? route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }) }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Array.isArray(data) ? data[0] : data) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      };
      const m = u.pathname.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
      if (m) { if (!(m[1] in RPC)) unknown.add('rpc ' + m[1]); return send(m[1] in RPC ? RPC[m[1]] : []); }
      const t = u.pathname.match(/\/rest\/v1\/([a-z_0-9]+)/);
      if (t) {
        if (t[1] === 'public_car_listings' && (u.searchParams.get('dealer_id') || '').startsWith('eq.')) return send(CARS);
        if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
        unknown.add('table ' + t[1] + ' ' + [...u.searchParams.keys()].join(','));
        return send([]);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.abort();
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:4173/s/premiummotors', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} html{scrollbar-width:none}' });
  // load every lazy section once, then back to the top
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 600) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(120); }
  await p.waitForTimeout(800); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
  const total = await p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  console.log('page height', H, 'scroll distance', total, 'unknown:', [...unknown].join(' | '));
  if (MODE === 'probe') { for (const [i, y] of [0, 0.25, 0.5, 0.75, 1].entries()) { await p.evaluate((yy) => window.scrollTo(0, yy), Math.round(total * y)); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/probe-${i}.png` }); } await b.close(); return; }
  const FPS = 30, SPEED = Number(process.argv[4] || 300), HOLD = 1.5; // css px per second
  const move = Math.ceil((total / SPEED) * FPS), hold = Math.round(HOLD * FPS);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // soft start and stop
  let n = 0; const shot = async () => { await p.screenshot({ path: `${OUT}/f${String(n++).padStart(5, '0')}.png` }); };
  for (let i = 0; i < hold; i++) await shot();
  for (let i = 1; i <= move; i++) {
    const t = i / move; const lin = t; const y = total * (0.85 * lin + 0.15 * ease(t)); // mostly constant speed, eased ends
    await p.evaluate((yy) => window.scrollTo(0, yy), Math.round(y)); await shot();
  }
  for (let i = 0; i < hold; i++) await shot();
  console.log('frames', n, 'seconds', (n / FPS).toFixed(1));
  await b.close();
})();
