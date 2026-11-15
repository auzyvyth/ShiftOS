import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { premiumLight as PL } from '../../theme/tokens';
import { formatMyPhone } from '../../lib/phone';
import * as api from '../../lib/brokerApi';

// BROKER-1: the dealer's side. Dealer dashboard > Team > Brokers, premiumLight look (white
// blocks on a soft shadow, grey rows inside, one red action, green only as a word).
// A dealer / owner decides who may sell their cars, what each earns, and confirms every
// sale: a broker can register a buyer but never close a deal on a dealer's car. Marking a
// commission paid is a record only; Drevo does not move money. The database refuses anyone
// who is not the dealer / owner, so a manager who opens this sees an empty page, not data.

const WORD = { active: ['Active', PL.up], paused: ['Paused', PL.textSec], revoked: ['Ended', PL.accentText] };

const card = { background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 };
const row = { background: PL.raised, borderRadius: PL.radius.row, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 };
const redKey = { minHeight: 44, padding: '0 20px', border: 0, borderRadius: 12, background: PL.accent, color: PL.onAccent, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const greyKey = { minHeight: 44, padding: '0 18px', border: 0, borderRadius: 12, background: PL.hover, color: PL.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
const inkKey = { ...redKey, background: PL.text };
const input = { height: 44, border: 0, borderRadius: 12, background: PL.raised, color: PL.text, fontSize: 16, padding: '0 14px', fontFamily: 'inherit', boxSizing: 'border-box' };
const word = (color) => ({ fontSize: 12, fontWeight: 600, color, background: PL.hover, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' });
// A broker's sale claim the dealer has not answered yet (BROKER-2).
const claimed = (r) => (r.status === 'registered' && r.sale_claimed_at ? 1 : 0);
const digits = (v) => String(v).replace(/\D/g, '').slice(0, 6);

// Wraps the existing Team screen: Salespeople (children) | Brokers. Only a dealer / owner gets the switch.
export default function TeamBrokersSwitch({ canManage, dealerId, children }) {
  // Overview's "broker sales to approve" and its Brokers tiles open this screen with ?sub=brokers.
  const [view, setView] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sub') === 'brokers' ? 'brokers' : 'people'));
  if (!canManage) return children;
  const pill = (on) => ({ minHeight: 44, padding: '0 18px', border: 0, borderRadius: 22, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', background: on ? PL.text : PL.hover, color: on ? PL.card : PL.text });
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" style={pill(view === 'people')} onClick={() => setView('people')}>Salespeople</button>
        <button type="button" style={pill(view === 'brokers')} onClick={() => setView('brokers')}>Brokers</button>
      </div>
      {view === 'people' ? children : <DealerBrokers dealerId={dealerId} />}
    </div>
  );
}

export function DealerBrokers({ dealerId }) {
  const [brokers, setBrokers] = useState(null);
  const [regs, setRegs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [inviteComm, setInviteComm] = useState('800');
  const [commDraft, setCommDraft] = useState({}); // broker_id -> typed commission (approve / change)
  const [editing, setEditing] = useState(null);   // broker_id whose commission is being changed
  const [confirm, setConfirm] = useState(null);   // broker_id being revoked
  const [soldDraft, setSoldDraft] = useState({}); // reg id -> typed commission while marking sold
  const [soldOpen, setSoldOpen] = useState(null);
  const [menu, setMenu] = useState(null);       // broker_id whose More menu is open
  const [showAll, setShowAll] = useState({});    // broker_id -> show every buyer, not the first 5

  const load = useCallback(async () => {
    const [b, r] = await Promise.all([api.dealerBrokers(), api.dealerRegistrations()]);
    if (b.error || r.error) setError('Could not load your brokers. Try again.');
    else setError('');
    if (!b.error) setBrokers(b.rows); else setBrokers((p) => p ?? []);
    if (!r.error) setRegs(r.rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const act = (brokerId, action, commission = null) => run(async () => {
    const res = await api.setBrokerStatus(dealerId, brokerId, action, commission);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    setConfirm(null);
    setEditing(null);
    await load();
  });

  const invite = () => run(async () => {
    const res = await api.inviteBroker(slug.trim(), Number(inviteComm) || 0);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    toast.success('Invitation sent.');
    setSlug('');
    setInviteOpen(false);
    await load();
  });

  const sold = (reg) => run(async () => {
    const typed = soldDraft[reg.id];
    const res = await api.markSold(reg.id, typed === undefined || typed === '' ? null : Number(typed));
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    setSoldOpen(null);
    await load();
  });

  // A broker said "sold": approve = commission owed at the amount agreed when the buyer was registered.
  const approve = (reg) => run(async () => {
    const res = await api.markSold(reg.id, null);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    toast.success('Sale approved. Commission is now owed.');
    await load();
  });

  const dispute = (reg) => run(async () => {
    const res = await api.disputeClaim(reg.id);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    toast('Marked as not sold. The broker was told.');
    await load();
  });

  const paid = (reg) => run(async () => {
    const res = await api.markPaid(reg.id);
    if (!res.ok) { toast.error(api.brokerError(res.reason)); return; }
    await load();
  });

  const list = brokers || [];
  const requests = list.filter((b) => b.status === 'requested');
  const team = list.filter((b) => b.status !== 'requested' && b.status !== 'declined');
  const connected = team.filter((b) => b.status !== 'revoked').length;
  const owed = useMemo(() => list.reduce((t, b) => t + Number(b.owed || 0), 0), [list]);
  const waiting = requests.filter((b) => b.requested_by === 'broker').length;
  const toApprove = regs.filter(claimed).length;

  if (brokers === null) return <div style={{ padding: 24, color: PL.textSec, fontSize: 14 }}>Loading brokers...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: PL.text, fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 15, color: PL.textSec }}>
          {connected} {connected === 1 ? 'broker' : 'brokers'} connected
          {waiting ? ` · ${waiting} ${waiting === 1 ? 'request' : 'requests'} waiting` : ''}
          {toApprove ? ` · ${toApprove} ${toApprove === 1 ? 'sale' : 'sales'} to approve` : ''}
          {' · '}{api.money(owed)} commission owed
        </p>
        <button type="button" style={greyKey} onClick={() => setInviteOpen((v) => !v)}>Invite a broker</button>
      </div>

      {error && (
        <div style={{ ...card, fontSize: 13, color: PL.accentText, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {error} <button type="button" style={greyKey} onClick={load}>Try again</button>
        </div>
      )}

      {inviteOpen && (
        <section style={card}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Invite a broker</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec, flex: '1 1 200px' }}>
              Their page name or link (like premiummotors or drevo.my/s/premiummotors)
              <input style={input} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={40} autoCapitalize="none" autoCorrect="off" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec }}>
              Commission per car (RM)
              <input style={{ ...input, width: 150 }} inputMode="numeric" value={inviteComm} onChange={(e) => setInviteComm(digits(e.target.value))} />
            </label>
            <button type="button" style={{ ...redKey, opacity: busy || slug.trim().length < 2 ? 0.4 : 1 }} disabled={busy || slug.trim().length < 2} onClick={invite}>Send invite</button>
          </div>
          <div style={{ fontSize: 12, color: PL.textMuted }}>They see your open cars only after they accept, and only while they have Premium.</div>
        </section>
      )}

      {requests.map((b) => (
        <section key={b.broker_id} style={{ ...card, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{b.name}</span>
              <span style={word(PL.accentText)}>{b.requested_by === 'broker' ? 'Wants to join' : 'Invited'}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 14, color: PL.textSec, lineHeight: 1.5 }}>
              {b.requested_by === 'broker'
                ? 'Once you approve, they see your open cars and the commission you set.'
                : `Waiting for them to accept. ${api.money(b.commission_default)} per car.`}
            </div>
          </div>
          {b.requested_by === 'broker' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec }}>
                Commission per car (RM)
                <input style={{ ...input, width: 150 }} inputMode="numeric" aria-label="Commission per car in RM"
                  value={commDraft[b.broker_id] ?? '800'} onChange={(e) => setCommDraft((d) => ({ ...d, [b.broker_id]: digits(e.target.value) }))} />
              </label>
              <button type="button" style={greyKey} disabled={busy} onClick={() => act(b.broker_id, 'decline')}>Decline</button>
              <button type="button" style={redKey} disabled={busy} onClick={() => act(b.broker_id, 'approve', Number(commDraft[b.broker_id] ?? 800) || 0)}>Approve</button>
            </div>
          ) : (
            <button type="button" style={greyKey} disabled={busy} onClick={() => act(b.broker_id, 'decline')}>Cancel invite</button>
          )}
        </section>
      ))}

      {/* One COLUMN per broker (owner, 2026-11-15: the page was too long). Each column holds the broker's
          numbers, a short menu and THEIR buyers, so nothing is repeated in a second list. Columns are a
          fixed width and scroll sideways, so three brokers do not stretch across a wide screen. */}
      {!team.length && <div style={{ ...card, fontSize: 14, color: PL.textSec, lineHeight: 1.55 }}>No brokers yet. Invite one by their page name, or wait for a request.</div>}
      {team.length > 0 && (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', alignItems: 'flex-start', scrollSnapType: 'x proximity', padding: '2px 2px 14px', margin: '0 -2px', WebkitOverflowScrolling: 'touch' }}>
          {team.map((b) => {
            const [label, color] = WORD[b.status] || [b.status, PL.textSec];
            const live = b.status === 'active' || b.status === 'paused';
            const mine = regs
              .filter((r) => r.broker_id === b.broker_id)
              .sort((x, y) => (claimed(y) - claimed(x)) || (new Date(y.registered_at) - new Date(x.registered_at)));
            const shown = showAll[b.broker_id] ? mine : mine.slice(0, 5);
            const waitingHere = mine.filter(claimed).length;
            return (
              <section key={b.broker_id} style={{ ...card, flex: '0 0 min(340px, 86vw)', scrollSnapAlign: 'start', padding: 16, gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    <span style={word(color)}>{label}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 13, color: PL.textSec }}>
                    {api.money(b.commission_default)} per car · since {api.shortDate(b.since)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: PL.raised, borderRadius: PL.radius.row, padding: '10px 12px', textAlign: 'center' }}>
                  {[['Cars', b.cars_on_page], ['Buyers', b.buyers], ['Sold', b.sold], ['Owed', api.money(b.owed)]].map(([k, v]) => (
                    <div key={k} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: PL.textSec }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {live && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={{ ...greyKey, flex: 1 }} disabled={busy} onClick={() => act(b.broker_id, b.status === 'paused' ? 'resume' : 'pause')}>{b.status === 'paused' ? 'Resume' : 'Pause'}</button>
                    <button type="button" style={{ ...greyKey, flex: 1 }} onClick={() => setMenu(menu === b.broker_id ? null : b.broker_id)}>{menu === b.broker_id ? 'Close' : 'More'}</button>
                  </div>
                )}

                {menu === b.broker_id && (
                  <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {editing === b.broker_id ? (
                      <>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec }}>
                          New commission per car (RM). Buyers registered from now on.
                          <input style={{ ...input, background: PL.card }} inputMode="numeric" value={commDraft[b.broker_id] ?? ''} onChange={(e) => setCommDraft((d) => ({ ...d, [b.broker_id]: digits(e.target.value) }))} />
                        </label>
                        <button type="button" style={inkKey} disabled={busy} onClick={() => act(b.broker_id, 'set_commission', Number(commDraft[b.broker_id]) || 0)}>Save</button>
                      </>
                    ) : confirm === b.broker_id ? (
                      <>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                          Revoke {b.name}? Your cars leave their page now. Buyers they registered stay theirs until the {api.HOLD_DAYS} days run out, and commission owed stays owed.
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" style={{ ...greyKey, flex: 1 }} onClick={() => setConfirm(null)}>Keep</button>
                          <button type="button" style={{ ...inkKey, flex: 1 }} disabled={busy} onClick={() => act(b.broker_id, 'revoke')}>Revoke</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <button type="button" style={{ ...greyKey, background: PL.card }} onClick={() => { setEditing(b.broker_id); setCommDraft((d) => ({ ...d, [b.broker_id]: String(Math.round(Number(b.commission_default) || 0)) })); }}>Change commission</button>
                        <button type="button" style={{ ...greyKey, background: PL.card, color: PL.accentText }} onClick={() => setConfirm(b.broker_id)}>Revoke</button>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: PL.textSec }}>
                    Buyers{waitingHere ? <span style={{ color: PL.accentText }}> · {waitingHere} to approve</span> : ''}
                  </div>
                  {!mine.length && <div style={{ fontSize: 13, color: PL.textSec, lineHeight: 1.5 }}>None yet. A buyer this broker registers on your cars shows here.</div>}
                  {shown.map((r) => {
                    const holding = r.status === 'registered' && new Date(r.hold_until) > new Date();
                    const isClaim = claimed(r) === 1;
                    let st = ['Hold ended', PL.textSec];
                    if (r.status === 'sold') st = r.paid_at ? ['Paid', PL.up] : ['Owed', PL.accentText];
                    else if (isClaim) st = ['Says sold', PL.accentText];
                    else if (holding) st = ['Holding', PL.up];
                    const agreed = r.commission_agreed ?? b.commission_default;
                    const days = isClaim ? Math.floor((Date.now() - new Date(r.sale_claimed_at).getTime()) / 86400000) : 0;
                    return (
                      <div key={r.id} style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.buyer_name}</div>
                            <div style={{ fontSize: 12.5, color: PL.textSec, lineHeight: 1.45 }}>{r.car_label}<br />{formatMyPhone(r.buyer_phone)}</div>
                          </div>
                          <span style={word(st[1])}>{st[0]}</span>
                        </div>
                        <div style={{ fontSize: 12, color: PL.textSec }}>
                          {isClaim
                            ? `Marked sold by the broker${days > 0 ? ` ${days}d ago` : ' today'}. Nothing is owed until you approve.`
                            : r.status === 'registered' ? `Registered ${api.shortDate(r.registered_at)} · until ${api.shortDate(r.hold_until)}${r.source === 'page' ? ' · came through their page' : ''}` : `Registered ${api.shortDate(r.registered_at)}`}
                        </div>
                        {r.refused_count > 0 && (
                          <div style={{ fontSize: 12, color: PL.textSec }}>{r.refused_count === 1 ? '1 other broker' : `${r.refused_count} other tries`} refused. Not told who holds them.</div>
                        )}
                        {isClaim && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" style={{ ...greyKey, flex: '0 0 auto', padding: '0 14px', minHeight: 40 }} disabled={busy} onClick={() => dispute(r)}>Not sold</button>
                            <button type="button" style={{ ...redKey, flex: 1, padding: '0 10px', minHeight: 40, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => approve(r)}>Approve {api.money(agreed)}</button>
                          </div>
                        )}
                        {r.status === 'registered' && !isClaim && (
                          soldOpen === r.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec }}>
                                Commission (RM). Can go up from {api.money(agreed)}, not down.
                                <input style={{ ...input, background: PL.card }} inputMode="numeric"
                                  value={soldDraft[r.id] ?? String(Math.round(Number(agreed) || 0))}
                                  onChange={(e) => setSoldDraft((d) => ({ ...d, [r.id]: digits(e.target.value) }))} />
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" style={{ ...greyKey, flex: 1, minHeight: 40 }} onClick={() => setSoldOpen(null)}>Cancel</button>
                                <button type="button" style={{ ...redKey, flex: 2, minHeight: 40 }} disabled={busy} onClick={() => sold(r)}>Confirm sale</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" style={{ ...greyKey, background: PL.card, minHeight: 40 }} onClick={() => setSoldOpen(r.id)}>This buyer bought the car</button>
                          )
                        )}
                        {r.status === 'sold' && !r.paid_at && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 13 }}>Commission {api.money(r.commission_amount)}</span>
                            <button type="button" style={{ ...redKey, minHeight: 40 }} disabled={busy} onClick={() => paid(r)}>Mark paid</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {mine.length > 5 && (
                    <button type="button" style={{ ...greyKey, minHeight: 40 }} onClick={() => setShowAll((m) => ({ ...m, [b.broker_id]: !m[b.broker_id] }))}>
                      {showAll[b.broker_id] ? 'Show fewer' : `Show all ${mine.length}`}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p style={{ margin: 0, maxWidth: 640, fontSize: 13, color: PL.textSec, lineHeight: 1.5 }}>
        Commission is a record only; Drevo does not move money. The system stamps each registration and nobody can edit it. The first broker to register a buyer holds them on your cars for {api.HOLD_DAYS} days. A broker marking a buyer won only sends the sale to you: it counts when you approve it. Close the sale itself in Sold as you do today.
      </p>
    </div>
  );
}
