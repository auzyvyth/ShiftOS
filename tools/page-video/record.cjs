// Records a seller page scrolling from the top to the footer, at DESKTOP size, for the
// /for-salesmen "scroll through a real Premium page" video (PageVideo.jsx).
// Usage:
//   npm run build && npx vite preview --port 4173      (the local build reads the LIVE database)
//   [HERO=card:perodua] [EXAMPLE=1] node tools/page-video/record.cjs <emptyDir> frames [speed px/s] [path]
//     default path: /s/premiummotors?brand=perodua  (probe = 5 stills instead of frames)
//   ffmpeg -framerate 30 -i <dir>/f%05d.png -vf "scale=1280:-2,format=yuv420p" -c:v libx264 -crf 26 -movflags +faststart out.mp4
// Save as public/for-salesmen/premium-page-scroll-vN.mp4 (+ .jpg still) with a NEW N and update PageVideo.jsx.
// Real data only: the page, its cars and photos come from the live database and storage, so the
// environment must allow drevo's Supabase host + wsrv.nl. Uses the session proxy when one is set.
const { chromium } = require('playwright');
const OUT = process.argv[2]; const MODE = process.argv[3] || 'frames';
const SPEED = Number(process.argv[4] || 420);
const PATH = process.argv[5] || '/s/premiummotors?brand=perodua';
(async () => {
  const px = process.env.HTTPS_PROXY || process.env.https_proxy;
  const proxy = px ? (() => { const u = new URL(px); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password), bypass: 'localhost,127.0.0.1' }; })() : undefined;
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  // No cookie banner, no analytics: this is a recording, not a visit.
  await ctx.addInitScript(() => { try { localStorage.setItem('xdrive_cookie_consent', JSON.stringify({ v: 1, analytics: false, preferences: false, ts: Date.now() })); } catch (e) {} });
  // HERO=card[:brand] records the hero as the business card (Settings > Your photo), with that brand's
  // cut-outs on the turning ring. It rewrites only this recording's copy of the seller's hero setting
  // (`hl` / `hb` on the hero link from get_agent_hero); the live page is not touched.
  const HERO = process.env.HERO || '';
  if (HERO.startsWith('card')) {
    const brand = HERO.split(':')[1] || '';
    await ctx.route('**/rest/v1/rpc/get_agent_hero', async (route) => {
      const res = await route.fetch(); let url = await res.json();
      if (typeof url === 'string') { const u = new URL(url); u.searchParams.set('hl', 'card'); if (brand) u.searchParams.set('hb', brand); url = u.toString(); }
      await route.fulfill({ response: res, body: JSON.stringify(url) });
    });
  }
  // EXAMPLE=1 (owner, 2026-11-28: "just fake em, stamp a big EXAMPLE across the section"): fills the
  // sections the seller has not written yet (how to buy, handover day + photos, FAQ, promos, delivery,
  // recently sold) with SAMPLE content for this recording only, and stamps "EXAMPLE" across each of them.
  // Never written to the database. Handover "photos" are the page's own Perodua car photos, no people.
  const EXAMPLE = process.env.EXAMPLE === '1';
  const STAMP_IDS = ['ap-steps', 'ap-handover', 'ap-faq', 'ap-promos', 'ap-delivery', 'ap-track'];
  if (EXAMPLE) {
    const key = (require('fs').readFileSync(require('path').resolve(process.env.REPO || require('path').resolve(__dirname, '../..'), 'src/supabaseClient.js'), 'utf8').match(/(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_publishable_[\w-]+)/) || [])[1];
    const api = 'https://lemdkdizdlcirhbzqlos.supabase.co/rest/v1/';
    const hdr = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const slug = (PATH.match(/\/s\/([^/?#]+)/) || [])[1];
    const prof = await (await ctx.request.post(api + 'rpc/get_salesman_by_slug', { headers: hdr, data: { p_slug: slug } })).json();
    const sellerId = (Array.isArray(prof) ? prof[0] : prof)?.id;
    const cars = await (await ctx.request.get(`${api}public_car_listings?select=brand,model,images&dealer_id=eq.${sellerId}&brand=ilike.perodua`, { headers: hdr })).json();
    const months = ['2026-11-01', '2026-10-01', '2026-10-01', '2026-09-01', '2026-08-01', '2026-07-01'];
    const photos = cars.filter((c) => c.images?.[0]).slice(0, 6).map((c, i) => ({ id: `ex-${i}`, car_name: `Perodua ${c.model}`, delivered_month: months[i], photo_url: c.images[0], caption: i === 0 ? 'First car for the family' : '' }));
    const site = {
      v: 1, order: ['promos', 'models', 'cars', 'calculator', 'delivery', 'handover', 'steps', 'book', 'faq'], off: [],
      promos: [{ model: 'Perodua Bezza', text: 'Year-end offer: free tint and floor mats', until: '2026-12-31' }, { model: 'Perodua Alza', text: 'Free first-year service', until: '2026-12-31' }],
      notes: [], delivery: { base: 'Kuala Lumpur', items: [{ town: 'Petaling Jaya', km: 15, min: 25 }, { town: 'Shah Alam', km: 30, min: 40 }, { town: 'Seremban', km: 70, min: 70 }, { town: 'Ipoh', km: 205, min: 150 }] },
      handover: [{ t: 'We check the car together', d: 'Body, paint, tyres and papers, before the keys are yours.' }, { t: 'Every feature, one by one', d: 'Infotainment, drive modes and the safety features.' }, { t: 'Your phone connected', d: 'Apple CarPlay or Android Auto, where the car has it.' }, { t: 'Service and warranty', d: 'When the first service is due and what the warranty covers.' }, { t: 'A handover photo', d: 'For you to keep and share with family.' }],
      steps: [{ t: 'Test drive', d: 'Try the car at the showroom, or ask if I can bring it to you.' }, { t: 'Price and quote', d: 'The full price, what is included and the monthly, in writing.' }, { t: 'Loan application', d: 'I send your documents to the bank. The bank decides.' }, { t: 'Booking', d: 'Booking fee and the car is held for you.' }, { t: 'Insurance and registration', d: 'Insurance, road tax and the number plate, done for you.' }, { t: 'Handover', d: 'Checked together, explained, keys handed over.' }],
      faq: [{ q: 'How long does a new Perodua take to arrive?', a: 'It depends on the model and colour. I tell you the waiting time for your pick before you book.' }, { q: 'Can I apply for a loan with no payslip?', a: 'Yes, with bank statements or business papers. I tell you what your bank asks for.' }, { q: 'Do you take trade-ins?', a: 'Yes. Bring your car and I get you a valuation.' }, { q: 'Can the car be delivered to my town?', a: 'Yes, see the delivery list above for times.' }],
      ranks: [], rankTitle: '', best: '',
    };
    const sales = [['2026-11-01', 'Bezza', '1.3 AV'], ['2026-10-01', 'Myvi', '1.5 AV'], ['2026-10-01', 'Axia', '1.0 SE'], ['2026-09-01', 'Alza', 'AV'], ['2026-08-01', 'Ativa', '1.0 Turbo AV']].map(([m, model, variant]) => ({ year: 2026, brand: 'Perodua', model, variant, sold_month: m }));
    const fake = { get_agent_site: site, get_agent_handover_photos: photos, get_agent_recent_sales: sales };
    await ctx.route(/\/rest\/v1\/rpc\/(get_agent_site|get_agent_handover_photos|get_agent_recent_sales)(\?|$)/, (route) => {
      const fn = route.request().url().match(/rpc\/([a-z_]+)/)[1];
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fake[fn]) });
    });
    console.log('example content:', photos.length, 'photos,', sales.length, 'sales');
  }
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:4173' + PATH, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} html{scrollbar-width:none}' });
  if (EXAMPLE) await p.addStyleTag({ content: STAMP_IDS.map((id) => `#${id}`).join(',') + `{position:relative!important}`
    + STAMP_IDS.map((id) => `#${id}::after`).join(',') + `{content:'EXAMPLE';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;`
    + `font:400 clamp(72px,11vw,150px)/1 'Bebas Neue',sans-serif;letter-spacing:.12em;color:rgba(220,38,38,.55);transform:rotate(-12deg);`
    + `pointer-events:none;z-index:5;-webkit-text-stroke:2px rgba(220,38,38,.8)}` });
  // Load every lazy section and photo once, then back to the top.
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(250); }
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(1500); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
  const total = await p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  console.log('page height', H, 'scroll distance', total);
  if (MODE === 'probe') { for (const [i, y] of [0, 0.25, 0.5, 0.75, 1].entries()) { await p.evaluate((yy) => window.scrollTo(0, yy), Math.round(total * y)); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/probe-${i}.png` }); } await b.close(); return; }
  const FPS = 30, HOLD = 1.5;
  const move = Math.ceil((total / SPEED) * FPS), hold = Math.round(HOLD * FPS);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // soft start and stop
  let n = 0; const shot = async () => { await p.screenshot({ path: `${OUT}/f${String(n++).padStart(5, '0')}.png` }); };
  for (let i = 0; i < hold; i++) await shot();
  for (let i = 1; i <= move; i++) {
    const t = i / move; const y = total * (0.85 * t + 0.15 * ease(t)); // mostly constant speed, eased ends
    await p.evaluate((yy) => window.scrollTo(0, yy), Math.round(y)); await shot();
  }
  for (let i = 0; i < hold; i++) await shot();
  console.log('frames', n, 'seconds', (n / FPS).toFixed(1));
  await b.close();
})();
