import React, { useEffect, useMemo, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import PhoneInput from '../../ui/PhoneInput';
import { isValidMyPhone } from '../../../lib/phone';
import { apiUrl } from '../../../utils/apiUrl';
import { malaysiaDate } from '../../../utils/myDay';
import { carLabel } from '../../../utils/liveMaths';
import { slotLabel } from '../../../utils/pageSite';
import { bookDays, daySlots, OPEN_RULE } from '../../../utils/pageBooking';
import { prefetchBookingSlots } from '../../BookingCalendar';

// "Book a visit" (PAGE-SITE 3, owner 2026-11-26: the appointment pass of a Proton advisor's site,
// but a REAL booking). It goes through the one public booking route, /api/booking (rate-limited,
// server key, the same checks as a car page): it lands in the seller's Bookings tab as PENDING,
// pushes them, and they confirm it. The pass on the right is only a preview until the server says
// yes; it never claims "booked" before that. Days and times are the seller's ONE availability setting
// (Settings > Availability, get_booking_slots), the same as the car page: days off and taken slots are
// never offered (rules: src/utils/pageBooking.js).
export const PURPOSES = [
  { key: 'test_drive', label: 'Test drive' },
  { key: 'price', label: 'Price and financing' },
  { key: 'trade_in', label: 'Trade-in valuation' },
];
const dayParts = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  return {
    day: d.getUTCDate(),
    mon: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
    wd: d.toLocaleString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    yr: d.getUTCFullYear(),
  };
};

export default function BookBlock({ cars, firstName, slug, place, avatar }) {
  const today = malaysiaDate();
  const options = useMemo(() => (cars || [])
    .filter((c) => c.status === 'available' && c.dealer_id)
    .map((c) => ({ id: c.id, dealerId: c.dealer_id, label: c.is_model_card ? [c.brand, c.model].filter(Boolean).join(' ') : carLabel(c) })), [cars]);
  const [f, setF] = useState({ name: '', phone: '', date: '', carId: options[0]?.id || '', time: '', purpose: 'test_drive' });
  const [cal, setCal] = useState(null); // { rule, booked: Set<ms> } for the picked car's seller
  const carId = f.carId || options[0]?.id;
  useEffect(() => {
    if (!carId) return undefined;
    let alive = true;
    prefetchBookingSlots(carId, slug).then((res) => {
      if (alive) setCal({ rule: res?.rule?.has ? res.rule : OPEN_RULE, booked: new Set(res?.booked || []) });
    });
    return () => { alive = false; };
  }, [carId, slug]);
  const [ok, setOk] = useState({ come: false, wa: false });
  const [errs, setErrs] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | sent | failed
  const [failText, setFailText] = useState('');
  if (!options.length) return null;

  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErrs({}); if (state === 'failed') setState('idle'); };
  const car = options.find((o) => o.id === f.carId) || options[0];
  const purpose = PURPOSES.find((p) => p.key === f.purpose);
  const days = cal ? bookDays(cal.rule, today, cal.booked) : [];
  const day = days.includes(f.date) ? f.date : days[0] || '';
  const times = cal && day ? daySlots(cal.rule, day, cal.booked) : [];
  const dp = dayParts(day || today);

  const check = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Type your name.';
    if (!isValidMyPhone(f.phone)) e.phone = 'Type a Malaysian phone number.';
    if (!day) e.date = 'Pick a day.';
    if (!f.time || !times.includes(f.time)) e.time = 'Pick a time.';
    if (!ok.come || !ok.wa) e.consent = 'Tick both boxes to send it.';
    return e;
  };

  const send = async () => {
    if (state === 'sending') return;
    const e = check();
    if (Object.keys(e).length) { setErrs(e); return; }
    setState('sending');
    try {
      // The slot is Malaysian time, whatever the buyer's phone is set to.
      const at = new Date(`${day}T${f.time}:00+08:00`);
      const res = await fetch(apiUrl('/api/booking'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: car.id, dealerId: car.dealerId, name: f.name.trim(), phone: f.phone,
          appointmentDate: at.toISOString(),
          notes: `${purpose.label}. Booked from ${firstName}'s page.`,
          refSlug: slug || null,
        }),
      });
      if (res.ok) { setState('sent'); return; }
      const data = await res.json().catch(() => ({}));
      setFailText(res.status === 429 ? 'Too many bookings from here. Wait a minute and try again.'
        : data?.error === 'Invalid phone number' ? 'That phone number does not look right.'
          : data?.error === 'Invalid appointment date' ? 'That time has passed. Pick another.'
            : `Not sent. Check your connection and try again, or WhatsApp ${firstName}.`);
      setState('failed');
    } catch {
      setFailText(`Not sent. Check your connection and try again, or WhatsApp ${firstName}.`);
      setState('failed');
    }
  };

  const sent = state === 'sent';
  return (
    <section className="ps bk" id="ap-book" aria-label="Book a visit">
      <div className="ps-head">
        <div>
          <h2>Book <span>a visit</span></h2>
          <p>Pick a day, a time and what you want to do. {firstName} confirms it on WhatsApp.</p>
        </div>
      </div>
      <div className="bk-grid">
        {!sent && (
          <div className="bk-form">
            <label className="bk-f"><span>Your name</span>
              <input value={f.name} maxLength={100} autoComplete="name" placeholder="e.g. Hafiz" onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errs.name} />
              {errs.name && <em>{errs.name}</em>}
            </label>
            <label className="bk-f"><span>Phone</span>
              <PhoneInput value={f.phone} onChange={(v) => set({ phone: v })} className="bk-phone" inputStyle={{ fontSize: 16 }} aria-label="Phone number" />
              {errs.phone && <em>{errs.phone}</em>}
            </label>
            <div className="bk-two">
              <label className="bk-f"><span>Car</span>
                <select value={car.id} onChange={(e) => set({ carId: e.target.value, time: '' })}>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <div className="bk-f"><span id="bk-day-l">Day</span>
              {!cal ? <p className="bk-wait">Loading {firstName}'s free days...</p> : days.length === 0 ? (
                <p className="bk-wait">No free times in the next three weeks. WhatsApp {firstName} to arrange one.</p>
              ) : (
                <div className="bk-days" role="radiogroup" aria-labelledby="bk-day-l">
                  {days.map((d) => {
                    const x = dayParts(d);
                    return (
                      <button key={d} type="button" role="radio" aria-checked={d === day} onClick={() => set({ date: d, time: '' })}>
                        <small>{d === today ? 'Today' : x.wd.slice(0, 3)}</small><b>{x.day}</b><small>{x.mon}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              {errs.date && <em>{errs.date}</em>}
            </div>
            <div className="bk-f"><span id="bk-time-l">Time</span>
              <div className="bk-chips" role="radiogroup" aria-labelledby="bk-time-l">
                {times.map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={f.time === t} onClick={() => set({ time: t })}>{slotLabel(t)}</button>
                ))}
              </div>
              {errs.time && <em>{errs.time}</em>}
            </div>
            <div className="bk-f"><span id="bk-why-l">What for</span>
              <div className="bk-chips" role="radiogroup" aria-labelledby="bk-why-l">
                {PURPOSES.map((p) => <button key={p.key} type="button" role="radio" aria-checked={f.purpose === p.key} onClick={() => set({ purpose: p.key })}>{p.label}</button>)}
              </div>
            </div>
            <div className="bk-ok">
              <button type="button" role="checkbox" aria-checked={ok.come} onClick={() => { setOk((o) => ({ ...o, come: !o.come })); setErrs({}); }}>
                <i>{ok.come && <Check size={12} strokeWidth={3} />}</i>I will come at this time, or tell {firstName} if I cannot.
              </button>
              <button type="button" role="checkbox" aria-checked={ok.wa} onClick={() => { setOk((o) => ({ ...o, wa: !o.wa })); setErrs({}); }}>
                <i>{ok.wa && <Check size={12} strokeWidth={3} />}</i>{firstName} may send me a WhatsApp to confirm.
              </button>
              {errs.consent && <em>{errs.consent}</em>}
            </div>
          </div>
        )}
        <div className={`bk-pass${sent ? ' bk-pass--sent' : ''}`} aria-live="polite">
          <div className="bk-top">
            <div><b>Visit pass</b><small>{sent ? `Sent. Waiting for ${firstName} to confirm` : 'Preview'}</small></div>
            {avatar && <img src={avatar} alt="" />}
          </div>
          <div className="bk-when">
            <div className="bk-tile"><b>{dp.day}</b><small>{dp.mon}</small></div>
            <div><b>{dp.wd}</b><small>{f.time ? `${slotLabel(f.time)}, ${dp.yr}` : 'Pick a time'}</small></div>
          </div>
          <dl className="bk-rows">
            <div><dt>Name</dt><dd>{f.name.trim() || 'Your name'}</dd></div>
            <div><dt>Car</dt><dd>{car.label}</dd></div>
            <div><dt>For</dt><dd>{purpose.label}</dd></div>
            {place && <div><dt>Where</dt><dd><MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{place}</dd></div>}
          </dl>
          {!sent && (
            <button type="button" className="bk-send" onClick={send} disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending...' : `Send to ${firstName}`}
            </button>
          )}
          {state === 'failed' && <p className="bk-fail" role="alert">{failText}</p>}
          <p className="bk-fine">{sent ? `${firstName} will WhatsApp you to confirm the time. It is not fixed until then.` : 'The time is confirmed by WhatsApp.'}</p>
        </div>
      </div>
      <BookStyle />
    </section>
  );
}

function BookStyle() {
  return (
    <style>{`
      .bk-grid { display: grid; gap: 14px; }
      @media (min-width: 900px) { .bk-grid { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; } .bk-pass--sent { grid-column: 1 / -1; max-width: 520px; } }
      .bk-form { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--line, #e5e7eb); border-radius: var(--r-card, 16px); corner-shape: squircle; min-width: 0; }
      .bk-f { display: grid; gap: 6px; min-width: 0; }
      .bk-f > span { font-family: var(--wide, inherit); font-size: 10.5px; font-weight: 400; letter-spacing: .16em; text-transform: uppercase; color: var(--t3, #6b7280); }
      .bk-f em { font-style: normal; font-size: 12.5px; color: #b91c1c; }
      .bk-f input, .bk-f select, .bk-phone { box-sizing: border-box; width: 100%; min-width: 0; height: 48px; padding: 0 12px; border: 1px solid var(--line2, #d1d5db); border-radius: var(--r-chip, 10px);
        corner-shape: squircle; background: #fff; color: var(--t1, #0a0a0b); font-family: inherit; font-size: 16px; }
      .bk-phone { padding: 0; }
      .bk-phone input { border: none !important; height: 46px; background: transparent; }
      .bk-two { display: grid; gap: 14px; }
      .bk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .bk-chips button { min-height: 44px; padding: 0 14px; border: 1px solid var(--line2, #d1d5db); border-radius: var(--r-chip, 10px); corner-shape: squircle; background: transparent;
        color: var(--t1, #0a0a0b); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
      .bk-chips button[aria-checked="true"] { background: var(--ink, #dc2626); border-color: var(--ink, #dc2626); color: var(--on-ink, #fff); }
      .bk-days { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
      .bk-days::-webkit-scrollbar { display: none; }
      .bk-days button { flex: 0 0 64px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; border: 1px solid var(--line2, #d1d5db);
        border-radius: var(--r-chip, 10px); corner-shape: squircle; background: transparent; color: var(--t1, #0a0a0b); font-family: inherit; cursor: pointer; }
      .bk-days small { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--t3, #6b7280); }
      .bk-days b { font-family: var(--head, 'Bebas Neue'), sans-serif; font-weight: 400; font-size: 26px; line-height: 1; }
      .bk-days button[aria-checked="true"] { background: var(--ink, #dc2626); border-color: var(--ink, #dc2626); color: var(--on-ink, #fff); }
      .bk-days button[aria-checked="true"] small { color: rgba(255,255,255,.88); }
      .bk-wait { margin: 0; font-size: 13.5px; color: var(--t2, #4b5563); }
      .bk-ok { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line, #e5e7eb); }
      .bk-ok button { display: flex; gap: 10px; align-items: flex-start; padding: 4px 0; border: none; background: none; text-align: left; cursor: pointer; font-family: inherit; font-size: 13.5px; line-height: 1.45; color: var(--t2, #4b5563); }
      .bk-ok i { flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; border: 1.5px solid var(--line2, #9ca3af); display: flex; align-items: center; justify-content: center; }
      .bk-ok button[aria-checked="true"] i { background: var(--ink, #dc2626); border-color: var(--ink, #dc2626); color: #fff; }
      .bk-ok em { font-style: normal; font-size: 12.5px; color: #b91c1c; }
      .bk-pass { background: var(--ink, #dc2626); color: #fff; border-radius: var(--r-card, 16px); corner-shape: squircle; overflow: hidden; min-width: 0; }
      .bk-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 18px 0; color: #fff; }
      .bk-top b { display: block; font-family: var(--head, 'Bebas Neue'), sans-serif; font-weight: 400; font-size: 24px; letter-spacing: .03em; text-transform: uppercase; line-height: 1; }
      .bk-top small { display: block; margin-top: 4px; font-size: 12px; color: rgba(255,255,255,.88); }
      .bk-top img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
      .bk-when { display: flex; align-items: center; gap: 14px; padding: 18px; border-bottom: 1px dashed rgba(255,255,255,.45); }
      .bk-tile { width: 66px; height: 72px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; color: var(--ink-2, #b91c1c); border-radius: 10px; corner-shape: squircle; }
      .bk-tile b { font-family: var(--head, 'Bebas Neue'), sans-serif; font-weight: 400; font-size: 34px; line-height: .9; }
      .bk-tile small { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      .bk-when > div:last-child b { display: block; font-family: var(--head, 'Bebas Neue'), sans-serif; font-weight: 400; font-size: 26px; letter-spacing: .03em; text-transform: uppercase; line-height: 1; }
      .bk-when > div:last-child small { display: block; margin-top: 4px; font-size: 13px; color: rgba(255,255,255,.88); }
      .bk-rows { margin: 0; padding: 6px 18px; }
      .bk-rows div { display: flex; justify-content: space-between; gap: 14px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.28); font-size: 13.5px; }
      .bk-rows dt { color: rgba(255,255,255,.85); }
      .bk-rows dd { margin: 0; font-weight: 600; text-align: right; min-width: 0; overflow-wrap: anywhere; }
      .bk-send { display: block; width: calc(100% - 36px); margin: 14px 18px 0; height: 52px; border: none; border-radius: var(--r-btn, 12px); corner-shape: squircle; background: #fff; color: var(--ink-2, #b91c1c);
        font-family: var(--bold, inherit); font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
      .bk-send:disabled { opacity: .6; }
      .bk-fail { margin: 10px 18px 0; font-size: 13px; font-weight: 600; color: #fff; }
      .bk-fine { margin: 10px 18px 18px; font-size: 12px; color: rgba(255,255,255,.88); text-align: center; }
    `}</style>
  );
}
