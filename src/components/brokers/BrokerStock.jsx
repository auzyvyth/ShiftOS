import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { panel, premiumDark as PD } from '../../theme/tokens';
import { cdnImg } from '../../utils/img';
import PhoneInput from '../ui/PhoneInput';
import { isValidMyPhone } from '../../lib/phone';
import { useModalHistory } from '../../hooks/useModalHistory';
import { PLAN_CONFIG } from '../../utils/planConfig';
import * as api from '../../lib/brokerApi';

// BROKER-1: the broker's "Dealer stock" tab, in Salesman Lite (theme "dark") and
// Salesman Premium (theme "premium"). A broker is a standalone seller connected to one or
// more dealers. What it shows, in order of how often it is used:
//   cars   the dealer's open cars with the commission the broker earns; "Add to my page"
//          puts one on the broker's public page, "Register a buyer" holds a buyer for 14 days
//   buyers the broker's own registrations (a person, a car, when the hold ends)
// Seeing a dealer's cars needs Premium (the database checks it, not this file): on Lite the
// tab is the pitch plus the connections the seller already has. The numbers (30 cars, 14 days)
// live in src/lib/brokerApi.js and must equal the SQL.

const THEMES = {
  premium: {
    card: PD.card, row: PD.raised, text: PD.text, sec: PD.textSec, muted: PD.textMuted,
    accent: PD.accent, onAccent: PD.onAccent, up: PD.up, accentText: PD.accentText,
    radius: PD.radius.card, rowRadius: PD.radius.row, input: PD.raised,
  },
  dark: {
    card: panel.surface, row: panel.surfaceRaised, text: panel.text, sec: panel.textSec, muted: panel.textMuted,
    accent: '#dc2626', onAccent: '#ffffff', up: '#6ee7b7', accentText: '#f87171',
    radius: 16, rowRadius: 12, input: panel.surfaceRaised,
  },
};

const STATUS_WORD = { active: 'Connected', paused: 'Paused', requested: 'Waiting', revoked: 'Ended' };

export default function BrokerStock({ userId, isPremium, theme = 'dark', onUpgrade }) {
  const T = THEMES[theme] || THEMES.dark;
  const [dealers, setDealers] = useState(null); // null = loading
  const [regs, setRegs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('cars');
  const [dealerId, setDealerId] = useState(null);
  const [stock, setStock] = useState(null);
  const [stockError, setStockError] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [sub, setSub] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetCar, setSheetCar] = useState(null);

  const loadBase = useCallback(async () => {
    const [d, r] = await Promise.all([api.myDealers(), api.myRegistrations()]);
    if (d.error || r.error) setLoadError('Could not load your dealers. Pull to refresh or try again.');
    else setLoadError('');
    // A failed read keeps what is already on screen.
    if (!d.error) setDealers(d.rows);
    else setDealers((prev) => prev ?? []);
    if (!r.error) setRegs(r.rows);
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  const active = useMemo(() => (dealers || []).filter((d) => d.status === 'active'), [dealers]);
  const invites = useMemo(() => (dealers || []).filter((d) => d.status === 'requested' && d.requested_by === 'dealer'), [dealers]);
  const waiting = useMemo(() => (dealers || []).filter((d) => d.status === 'requested' && d.requested_by === 'broker'), [dealers]);
  const paused = useMemo(() => (dealers || []).filter((d) => d.status === 'paused'), [dealers]);

  // Default to the first connected dealer; keep the pick if it is still connected.
  useEffect(() => {
    if (!active.length) { setDealerId(null); return; }
    setDealerId((cur) => (cur && active.some((d) => d.dealer_id === cur) ? cur : active[0].dealer_id));
  }, [active]);

  const loadStock = useCallback(async (id) => {
    setStock(null);
    setStockError('');
    const res = await api.dealerStock(id);
    if (res.error) { setStockError('Could not load this dealer\'s cars. Try again.'); setStock([]); return; }
    setStock(res.rows);
  }, []);

  useEffect(() => {
    if (isPremium && dealerId) loadStock(dealerId);
  }, [isPremium, dealerId, loadStock]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const join = () => run(async () => {
    const res = await api.requestDealer(sub.trim());
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    toast.success('Request sent. The dealer has to approve you.');
    setSub('');
    setJoinOpen(false);
    await loadBase();
  });

  const answerInvite = (d, action) => run(async () => {
    const res = await api.respondToInvite(d.dealer_id, userId, action);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    await loadBase();
  });

  const togglePage = (car) => run(async () => {
    const res = car.on_my_page ? await api.removeFromPage(car.id) : await api.addToPage(car.id);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    setStock((rows) => (rows || []).map((c) => (c.id === car.id ? { ...c, on_my_page: !c.on_my_page } : c)));
  });

  const onPageCount = (stock || []).filter((c) => c.on_my_page).length;

  const card = { background: T.card, borderRadius: T.radius, padding: 16 };
  const pill = (on) => ({
    flex: '0 0 auto', minHeight: 44, padding: '0 16px', border: 0, borderRadius: 999, cursor: 'pointer',
    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
    background: on ? T.text : T.row, color: on ? T.card : T.text,
  });
  const redKey = {
    minHeight: 44, padding: '0 18px', border: 0, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, background: T.accent, color: T.onAccent,
  };
  const greyKey = {
    minHeight: 44, padding: '0 18px', border: 0, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 500, background: T.row, color: T.text,
  };

  if (dealers === null) {
    return <div style={{ padding: 24, color: T.sec, fontSize: 14 }}>Loading your dealers...</div>;
  }

  const price = PLAN_CONFIG.salesman_full?.price;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 0 40px', display: 'flex', flexDirection: 'column', gap: 16, color: T.text }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>Dealer stock</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.sec, lineHeight: 1.5 }}>
          Cars from dealers you work with. The amount in green is what you earn if the car sells to your buyer.
        </p>
      </div>

      {loadError && (
        <div style={{ ...card, fontSize: 13, color: T.accentText }}>
          {loadError}{' '}
          <button type="button" onClick={loadBase} style={{ ...greyKey, minHeight: 36, marginLeft: 8 }}>Try again</button>
        </div>
      )}

      {!isPremium && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Sell dealers' cars</div>
          <p style={{ margin: 0, fontSize: 14, color: T.sec, lineHeight: 1.55 }}>
            See every car a dealer opens to brokers, put them on your own page, and register your buyers so
            the buyer is held for you on that dealer's cars for {api.HOLD_DAYS} days. This comes with Premium
            {price ? `, RM ${price} a month` : ''}.
          </p>
          <div>
            <button type="button" onClick={onUpgrade} style={redKey}>See Premium</button>
          </div>
        </div>
      )}

      {!isPremium && (dealers || []).length > 0 && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: T.muted }}>Your dealers</div>
          {dealers.map((d) => (
            <div key={d.dealer_id} style={{ background: T.row, borderRadius: T.rowRadius, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
              <span>{d.name}</span>
              <span style={{ color: T.sec }}>{STATUS_WORD[d.status] || d.status}</span>
            </div>
          ))}
        </div>
      )}

      {isPremium && (
        <>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {active.map((d) => (
              <button key={d.dealer_id} type="button" onClick={() => { setDealerId(d.dealer_id); setView('cars'); }} style={pill(view === 'cars' && dealerId === d.dealer_id)}>
                {d.name}
              </button>
            ))}
            <button type="button" onClick={() => setView('buyers')} style={pill(view === 'buyers')}>
              My buyers{regs.length ? ` (${regs.length})` : ''}
            </button>
            <button type="button" onClick={() => setJoinOpen((v) => !v)} style={pill(false)}>Join a dealer</button>
          </div>

          {joinOpen && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 13, color: T.sec }} htmlFor="broker-sub">The dealer's storefront name (the part before .drevo.my)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="broker-sub" type="text" value={sub} onChange={(e) => setSub(e.target.value)}
                  placeholder="bandarauto" autoCapitalize="none" autoCorrect="off" maxLength={40}
                  style={{ flex: '1 1 200px', minWidth: 0, height: 48, border: 0, borderRadius: 12, background: T.input, color: T.text, fontSize: 16, padding: '0 14px', fontFamily: 'inherit' }}
                />
                <button type="button" onClick={join} disabled={busy || sub.trim().length < 2} style={{ ...redKey, opacity: busy || sub.trim().length < 2 ? 0.4 : 1 }}>Send request</button>
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>The dealer has to approve you before you see their cars.</div>
            </div>
          )}

          {invites.map((d) => (
            <div key={d.dealer_id} style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{d.name} invited you</div>
                <div style={{ fontSize: 13, color: T.sec, marginTop: 2 }}>
                  {Number(d.commission_default) > 0 ? `${api.money(d.commission_default)} per car sold to your buyer.` : 'Commission is agreed with the dealer.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => answerInvite(d, 'decline')} style={greyKey}>Decline</button>
                <button type="button" disabled={busy} onClick={() => answerInvite(d, 'accept')} style={redKey}>Accept</button>
              </div>
            </div>
          ))}

          {waiting.map((d) => (
            <div key={d.dealer_id} style={{ ...card, fontSize: 14, color: T.sec, lineHeight: 1.5 }}>
              <strong style={{ color: T.text }}>Waiting for {d.name}.</strong> You will get a notification the moment they approve.
            </div>
          ))}

          {paused.map((d) => (
            <div key={d.dealer_id} style={{ ...card, fontSize: 14, color: T.sec, lineHeight: 1.5 }}>
              <strong style={{ color: T.text }}>{d.name} paused your access.</strong> Their cars are hidden until they resume it. Buyers you already registered stay yours.
            </div>
          ))}

          {view === 'cars' && !active.length && !invites.length && !waiting.length && !paused.length && (
            <div style={{ ...card, fontSize: 14, color: T.sec, lineHeight: 1.55 }}>
              You are not connected to a dealer yet. Tap Join a dealer and type their storefront name, or ask a dealer to invite you by your page name.
            </div>
          )}

          {view === 'cars' && dealerId && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.sec }}>
                <span>Dealer cars on your page</span>
                <span style={{ color: T.text, fontWeight: 500 }}>{onPageCount} of {api.BROKER_CAR_CAP}</span>
              </div>

              {stockError && <div style={{ ...card, fontSize: 13, color: T.accentText }}>{stockError}</div>}
              {stock === null && <div style={{ color: T.sec, fontSize: 14 }}>Loading cars...</div>}
              {stock && !stock.length && !stockError && (
                <div style={{ ...card, fontSize: 14, color: T.sec, lineHeight: 1.55 }}>
                  This dealer has no cars open to brokers right now.
                </div>
              )}

              {(stock || []).map((car) => {
                const title = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(' ');
                return (
                  <div key={car.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: '0 0 92px', height: 70, borderRadius: 10, background: T.row, overflow: 'hidden' }}>
                        {car.image && <img src={cdnImg(car.image, 240, 70)} alt="" width="92" height="70" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{title}</div>
                        <div style={{ fontSize: 12, color: T.sec, marginTop: 2 }}>
                          {[car.transmission, car.mileage ? `${Number(car.mileage).toLocaleString('en-MY')} km` : null].filter(Boolean).join(' · ')}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 16, fontWeight: 600 }}>{car.selling_price ? api.money(car.selling_price) : 'Ask'}</span>
                          {Number(car.commission) > 0 && (
                            <span style={{ fontSize: 13, fontWeight: 500, color: T.up }}>You earn {api.money(car.commission)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={busy} onClick={() => togglePage(car)} style={{ ...greyKey, flex: 1 }}>
                        {car.on_my_page ? 'On your page' : 'Add to my page'}
                      </button>
                      <button type="button" onClick={() => setSheetCar({ ...car, title })} style={{ ...redKey, flex: 1 }}>Register a buyer</button>
                    </div>
                  </div>
                );
              })}
              <p style={{ margin: 0, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                Cars the dealer has locked to one salesperson are not shown. If the dealer ends the connection, their cars leave your page straight away.
              </p>
            </>
          )}
        </>
      )}

      {isPremium && view === 'buyers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!regs.length && (
            <div style={{ ...card, fontSize: 14, color: T.sec, lineHeight: 1.55 }}>
              No buyers registered yet. Open a dealer's car and tap Register a buyer.
            </div>
          )}
          {regs.map((r) => {
            const holding = r.status === 'registered' && new Date(r.hold_until) > new Date();
            let state = `Hold ended ${api.shortDate(r.hold_until)}`;
            let stateColor = T.muted;
            if (r.status === 'sold') { state = r.paid_at ? 'Sold, commission paid' : 'Sold, commission owed'; stateColor = T.up; }
            else if (holding) { state = `Held until ${api.shortDate(r.hold_until)}`; stateColor = T.up; }
            return (
              <div key={r.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{r.buyer_name}</div>
                    <div style={{ fontSize: 13, color: T.sec }}>{r.car_label} · {r.dealer_name}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: stateColor }}>{state}</div>
                </div>
                {r.status === 'sold' && Number(r.commission_amount) > 0 && (
                  <div style={{ fontSize: 13, color: T.sec }}>Your commission: {api.money(r.commission_amount)}</div>
                )}
                <div>
                  <a
                    href={`https://wa.me/${r.buyer_phone}`} target="_blank" rel="noopener noreferrer"
                    style={{ ...greyKey, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                  >WhatsApp {r.buyer_name.split(' ')[0]}</a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sheetCar && (
        <RegisterSheet
          T={T} car={sheetCar} dealerName={(active.find((d) => d.dealer_id === dealerId) || {}).name || 'the dealer'}
          onClose={() => setSheetCar(null)}
          onDone={() => { setSheetCar(null); loadBase(); }}
        />
      )}
    </div>
  );
}

// The "Register a buyer" pop-up. Portalled with a scroll lock; Back closes it
// (CLAUDE.md overlay rules). Shows the result inside the sheet so a clash is read, not toasted away.
function RegisterSheet({ T, car, dealerName, onClose, onDone }) {
  useModalHistory(true, onClose);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const valid = name.trim().length > 1 && isValidMyPhone(phone, { mobileOnly: true }) && consent;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setMsg('');
    const res = await api.registerBuyer(car.id, name.trim(), phone, consent);
    setBusy(false);
    if (res.ok) { setDone(res); return; }
    if (res.reason === 'held') {
      setMsg(`This buyer is already held by another broker on this dealer's cars until ${api.shortDate(res.until)}. You cannot register them on these cars until then. We do not say who.`);
    } else if (res.reason === 'mine') {
      setMsg(`You already registered this buyer on this dealer's cars. Your hold runs until ${api.shortDate(res.until)}.`);
    } else {
      setMsg(api.brokerError(res.reason));
    }
  };

  const field = { height: 48, border: 0, borderRadius: 12, background: T.input, color: T.text, fontSize: 16, padding: '0 14px', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Register a buyer"
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', background: T.card, color: T.text, borderRadius: '20px 20px 0 0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'inherit' }}>
        {done ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 600 }}>Buyer registered</div>
            <p style={{ margin: 0, fontSize: 14, color: T.sec, lineHeight: 1.5 }}>
              {name.trim()} is held for you on {dealerName}'s cars until {api.shortDate(done.until)}. The time is recorded by the system.
            </p>
            <div style={{ background: T.row, borderRadius: T.rowRadius, padding: 14, fontSize: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: T.sec }}>Car</span><span style={{ textAlign: 'right' }}>{car.title}</span></div>
              {Number(car.commission) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: T.sec }}>If it sells</span><span style={{ color: T.up, fontWeight: 500 }}>You earn {api.money(car.commission)}</span></div>
              )}
            </div>
            <button type="button" onClick={onDone} style={{ minHeight: 52, border: 0, borderRadius: 14, background: T.accent, color: T.onAccent, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Register a buyer</div>
                <div style={{ fontSize: 13, color: T.sec, marginTop: 2 }}>{car.title}</div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" style={{ flex: '0 0 44px', height: 44, border: 0, borderRadius: 22, background: T.row, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: T.sec }}>
              Buyer name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="As on their IC" style={field} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: T.sec }}>
              Buyer phone
              <PhoneInput
                value={phone} onChange={setPhone} mobileOnly
                style={{ height: 48, borderRadius: 12, background: T.input, color: T.text, fontSize: 16 }}
                inputStyle={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: T.text, fontSize: 16, outline: 'none', fontFamily: 'inherit', padding: '0 14px 0 4px' }}
              />
            </label>

            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: T.sec, lineHeight: 1.45 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ flex: '0 0 22px', width: 22, height: 22, margin: 0, accentColor: T.accent }} />
              <span>The buyer knows I am giving their name and number to {dealerName} for this car.</span>
            </label>

            {msg && <div style={{ background: T.row, borderRadius: T.rowRadius, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>{msg}</div>}

            <button
              type="button" onClick={submit} disabled={!valid || busy}
              style={{ minHeight: 52, border: 0, borderRadius: 14, background: T.accent, color: T.onAccent, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !valid || busy ? 0.4 : 1 }}
            >{busy ? 'Registering...' : 'Register buyer'}</button>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              Registering holds this buyer for you on this dealer's cars for {api.HOLD_DAYS} days. The time is recorded by the system. Neither you nor the dealer can change it.
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
