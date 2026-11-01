// /poster-lab — prototype of the moving loan poster (IDEA-29). Not linked from
// any nav. Picks a live car from the marketplace (its real photos), a template,
// and plays the animation. No download yet: recording to MP4 is the next step.
import { useEffect, useMemo, useRef, useState } from 'react';
import { publicClient } from '../supabaseClient';
import { fetchDataUrl, loadImg } from '../utils/posterImage';
import { cdnImg } from '../utils/img';
import { defaultDeposit, fmtRM, loanPosterNumbers, POSTER_COPY, POSTER_ERRORS, posterTitle } from '../utils/loanPoster';
import { DEFAULT_EIR } from '../utils/financing';
import { drawMotionFrame, MOTION_H, MOTION_LEN, MOTION_TEMPLATES, MOTION_W } from '../components/poster/motionPoster';

const FIELDS = 'id,brand,model,variant,year,condition,selling_price,images,is_model_card';

const input = 'w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-red-600';
const label = 'block text-xs text-gray-400 mb-1';

export default function PosterLabPage() {
  const [cars, setCars] = useState([]);
  const [carId, setCarId] = useState(null);
  const [template, setTemplate] = useState('slide');
  const [lang, setLang] = useState('ms');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [rate, setRate] = useState(String(DEFAULT_EIR));
  const [headline, setHeadline] = useState(POSTER_COPY.ms.kicker);
  const [offer, setOffer] = useState('Free tinted + 1 year warranty');
  const [seller, setSeller] = useState('Your name · Sales advisor');
  const [imgs, setImgs] = useState([]);
  const [loadingImgs, setLoadingImgs] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [startAt, setStartAt] = useState(() => performance.now());
  const canvasRef = useRef(null);

  // Live cars with at least one photo (never a new-car model card).
  useEffect(() => {
    publicClient.from('public_car_listings').select(FIELDS)
      .eq('is_model_card', false).gt('selling_price', 0)
      .order('created_at', { ascending: false }).limit(15)
      .then(({ data, error }) => {
        if (error) { setLoadErr('Could not load cars. Try again.'); return; }
        const rows = (data || []).filter((c) => Array.isArray(c.images) && c.images.length);
        setCars(rows);
        if (rows[0]) setCarId(rows[0].id);
      });
  }, []);

  const car = useMemo(() => cars.find((c) => c.id === carId) || null, [cars, carId]);

  // New car: refill price + deposit and load its first 3 photos.
  useEffect(() => {
    if (!car) return;
    setPrice(String(Math.round(Number(car.selling_price) || 0)));
    setDeposit(String(defaultDeposit(car.selling_price)));
    let off = false;
    setLoadingImgs(true);
    Promise.all(car.images.slice(0, 3).map((u) => fetchDataUrl(u).then(loadImg)))
      .then((list) => { if (!off) { setImgs(list); setLoadingImgs(false); setStartAt(performance.now()); } });
    return () => { off = true; };
  }, [car]);

  // Language switch moves the default headline with it, unless it was edited.
  const switchLang = (next) => {
    if (headline === POSTER_COPY[lang].kicker) setHeadline(POSTER_COPY[next].kicker);
    setLang(next);
  };

  const numbers = useMemo(() => loanPosterNumbers({ price, deposit, rate, basis: 'eir' }), [price, deposit, rate]);
  const c = POSTER_COPY[lang];
  const frame = useMemo(() => ({
    lang, headline, offer: offer.trim(), seller: seller.trim(),
    title: car ? `${car.year || ''} ${posterTitle(car)}`.trim() : '',
    price: numbers.price,
    working: `${c.deposit} RM ${fmtRM(numbers.deposit)} · ${numbers.rate}% EIR`,
    rows: numbers.ok ? numbers.rows : [],
  }), [lang, headline, offer, seller, car, numbers, c]);

  // Fonts first, or the first frames draw in a fallback face.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    Promise.all([document.fonts.load("400 100px 'Bebas Neue'"), document.fonts.load("700 50px 'Outfit'")])
      .catch(() => {}).finally(() => setFontsReady(true));
  }, []);

  // Play loop: the poster runs MOTION_LEN seconds, then restarts.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !fontsReady) return;
    let raf;
    const tick = (now) => {
      const t = ((now - startAt) / 1000) % (MOTION_LEN + 1);
      drawMotionFrame(ctx, Math.min(t, MOTION_LEN), template, frame, imgs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [template, frame, imgs, startAt, fontsReady]);

  const pickTemplate = (key) => { setTemplate(key); setStartAt(performance.now()); };

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: 'var(--xd-font-body)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-3xl tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Moving poster</h1>
        <p className="text-sm text-gray-400 mb-5">Prototype. Real cars from the marketplace, three simple templates. Saving as a video comes next.</p>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-[360px] shrink-0 mx-auto md:mx-0" style={{ width: 'min(100%, 360px)' }}>
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-black" style={{ aspectRatio: `${MOTION_W} / ${MOTION_H}` }}>
              <canvas ref={canvasRef} width={MOTION_W} height={MOTION_H} className="w-full h-full block" />
              {loadingImgs && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-gray-300">Loading photos...</div>
              )}
            </div>
            <button type="button" onClick={() => setStartAt(performance.now())}
              className="mt-3 w-full rounded-lg bg-gray-900 border border-gray-800 py-2 text-sm hover:border-gray-600">
              Play again
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
              <span className={label}>Template</span>
              <div className="flex flex-wrap gap-2">
                {MOTION_TEMPLATES.map((tp) => (
                  <button key={tp.key} type="button" onClick={() => pickTemplate(tp.key)}
                    className={`rounded-full px-4 py-1.5 text-sm border ${template === tp.key ? 'bg-red-600 border-red-600' : 'border-gray-700 text-gray-300'}`}>
                    {tp.label}
                  </button>
                ))}
                <div className="ml-auto flex gap-1">
                  {['ms', 'en'].map((l) => (
                    <button key={l} type="button" onClick={() => switchLang(l)}
                      className={`rounded-full px-3 py-1.5 text-xs border ${lang === l ? 'border-white text-white' : 'border-gray-700 text-gray-400'}`}>
                      {l === 'ms' ? 'BM' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
              <label className={label} htmlFor="pl-car">Car</label>
              {loadErr ? <p className="text-sm text-red-400">{loadErr}</p> : (
                <select id="pl-car" className={input} value={carId || ''} onChange={(e) => setCarId(e.target.value)}>
                  {cars.map((cr) => (
                    <option key={cr.id} value={cr.id}>{cr.year} {posterTitle(cr)} · RM {fmtRM(cr.selling_price)}</option>
                  ))}
                </select>
              )}
              {car && (
                <div className="flex gap-2 mt-3">
                  {car.images.slice(0, 3).map((u) => (
                    <img key={u} src={cdnImg(u, 200, 60)} alt="" className="w-16 h-12 rounded-md object-cover border border-gray-800" />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 grid grid-cols-3 gap-3">
              <div><label className={label} htmlFor="pl-price">Price (RM)</label>
                <input id="pl-price" className={input} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div><label className={label} htmlFor="pl-dep">Deposit (RM)</label>
                <input id="pl-dep" className={input} inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
              <div><label className={label} htmlFor="pl-rate">Rate (EIR %)</label>
                <input id="pl-rate" className={input} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              {!numbers.ok && <p className="col-span-3 text-sm text-red-400">{POSTER_ERRORS[numbers.error]}</p>}
            </section>

            <section className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
              <div><label className={label} htmlFor="pl-head">Headline</label>
                <input id="pl-head" className={input} maxLength={40} value={headline} onChange={(e) => setHeadline(e.target.value)} /></div>
              <div><label className={label} htmlFor="pl-offer">Offer (leave empty to hide)</label>
                <input id="pl-offer" className={input} maxLength={40} value={offer} onChange={(e) => setOffer(e.target.value)} /></div>
              <div><label className={label} htmlFor="pl-seller">Your name</label>
                <input id="pl-seller" className={input} maxLength={40} value={seller} onChange={(e) => setSeller(e.target.value)} /></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
