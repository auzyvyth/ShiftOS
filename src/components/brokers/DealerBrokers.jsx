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
const digits = (v) => String(v).replace(/\D/g, '').slice(0, 6);

// Wraps the existing Team screen: Salespeople (children) | Brokers. Only a dealer / owner gets the switch.
export default function TeamBrokersSwitch({ canManage, dealerId, children }) {
  const [view, setView] = useState('people');
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
  const byBroker = useMemo(() => Object.fromEntries(list.map((b) => [b.broker_id, b])), [list]);

  if (brokers === null) return <div style={{ padding: 24, color: PL.textSec, fontSize: 14 }}>Loading brokers...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: PL.text, fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 15, color: PL.textSec }}>
          {connected} {connected === 1 ? 'broker' : 'brokers'} connected
          {waiting ? ` · ${waiting} ${waiting === 1 ? 'request' : 'requests'} waiting` : ''}
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
              Their page name (the end of drevo.my/s/...)
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

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Your brokers</h2>
        {!team.length && <div style={{ fontSize: 14, color: PL.textSec, lineHeight: 1.55 }}>No brokers yet. Invite one by their page name, or wait for a request.</div>}
        {team.map((b) => {
          const [label, color] = WORD[b.status] || [b.status, PL.textSec];
          const live = b.status === 'active' || b.status === 'paused';
          return (
            <div key={b.broker_id} style={row}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'center' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{b.name}</span>
                    <span style={word(color)}>{label}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 13, color: PL.textSec }}>
                    {b.plan === 'salesman_full' ? 'Premium seller' : 'Seller'} · {api.money(b.commission_default)} per car · since {api.shortDate(b.since)}
                  </div>
                </div>
                <div style={{ flex: '2 1 260px', minWidth: 0, fontSize: 14, color: PL.textSec }}>
                  {b.cars_on_page} cars on their page · {b.buyers} buyers registered · {b.sold} sold
                </div>
                <div style={{ flex: '0 0 auto', minWidth: 110 }}>
                  <div style={{ fontSize: 12, color: PL.textSec }}>Commission owed</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{api.money(b.owed)}</div>
                </div>
              </div>

              {live && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" style={greyKey} disabled={busy} onClick={() => act(b.broker_id, b.status === 'paused' ? 'resume' : 'pause')}>{b.status === 'paused' ? 'Resume' : 'Pause'}</button>
                  <button type="button" style={greyKey} disabled={busy} onClick={() => { setEditing(editing === b.broker_id ? null : b.broker_id); setCommDraft((d) => ({ ...d, [b.broker_id]: String(Math.round(Number(b.commission_default) || 0)) })); }}>Change commission</button>
                  <button type="button" style={{ ...greyKey, color: PL.accentText }} disabled={busy} onClick={() => setConfirm(b.broker_id)}>Revoke</button>
                </div>
              )}

              {editing === b.broker_id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec }}>
                    New commission per car (RM). Applies to buyers registered from now on.
                    <input style={{ ...input, width: 150 }} inputMode="numeric" value={commDraft[b.broker_id] ?? ''} onChange={(e) => setCommDraft((d) => ({ ...d, [b.broker_id]: digits(e.target.value) }))} />
                  </label>
                  <button type="button" style={inkKey} disabled={busy} onClick={() => act(b.broker_id, 'set_commission', Number(commDraft[b.broker_id]) || 0)}>Save</button>
                </div>
              )}

              {confirm === b.broker_id && (
                <div style={{ background: PL.card, borderRadius: PL.radius.row, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: PL.shadow }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Revoke {b.name}? Your cars leave their page straight away. Buyers they already registered stay theirs until the {api.HOLD_DAYS} days run out, and commission owed stays owed.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={greyKey} onClick={() => setConfirm(null)}>Keep them</button>
                    <button type="button" style={inkKey} disabled={busy} onClick={() => act(b.broker_id, 'revoke')}>Revoke</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <p style={{ margin: 0, maxWidth: 640, fontSize: 13, color: PL.textSec, lineHeight: 1.5 }}>
          Commission is a record only. Drevo does not move money between you and a broker.
        </p>
      </section>

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Buyers brokers registered</h2>
        {!regs.length && <div style={{ fontSize: 14, color: PL.textSec, lineHeight: 1.55 }}>Nothing yet. When a broker registers a buyer on one of your cars it shows here, and you get a notification.</div>}
        {regs.map((r) => {
          const holding = r.status === 'registered' && new Date(r.hold_until) > new Date();
          let status = ['Hold ended', PL.textSec];
          if (r.status === 'sold') status = r.paid_at ? ['Paid', PL.up] : ['Sold, owed', PL.accentText];
          else if (holding) status = ['Holding', PL.up];
          const brokerCommission = byBroker[r.broker_id]?.commission_default;
          return (
            <div key={r.id} style={{ ...row, gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'center' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{r.buyer_name}</div>
                  <div style={{ fontSize: 13, color: PL.textSec }}>{r.car_label} · {formatMyPhone(r.buyer_phone)}</div>
                </div>
                <div style={{ flex: '1 1 180px', fontSize: 13, color: PL.textSec, lineHeight: 1.5 }}>
                  {r.broker_name}<br />Registered {api.shortDate(r.registered_at)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <span style={word(status[1])}>{status[0]}</span>
                  <span style={{ fontSize: 12, color: PL.textSec }}>Until {api.shortDate(r.hold_until)}</span>
                </div>
              </div>
              {r.refused_count > 0 && (
                <div style={{ fontSize: 13, color: PL.textSec, lineHeight: 1.5 }}>
                  {r.refused_count === 1 ? 'Another broker tried' : `Other brokers tried ${r.refused_count} times`} to register this buyer and {r.refused_count === 1 ? 'was' : 'were'} refused. They were not told who holds them.
                </div>
              )}
              {r.status === 'registered' && (
                soldOpen === r.id ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PL.textSec }}>
                      Commission for this sale (RM)
                      <input style={{ ...input, width: 150 }} inputMode="numeric"
                        value={soldDraft[r.id] ?? String(Math.round(Number(brokerCommission) || 0))}
                        onChange={(e) => setSoldDraft((d) => ({ ...d, [r.id]: digits(e.target.value) }))} />
                    </label>
                    <button type="button" style={greyKey} onClick={() => setSoldOpen(null)}>Cancel</button>
                    <button type="button" style={redKey} disabled={busy} onClick={() => sold(r)}>Confirm sale</button>
                  </div>
                ) : (
                  <div><button type="button" style={greyKey} onClick={() => setSoldOpen(r.id)}>This buyer bought the car</button></div>
                )
              )}
              {r.status === 'sold' && !r.paid_at && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>Commission {api.money(r.commission_amount)}</span>
                  <button type="button" style={redKey} disabled={busy} onClick={() => paid(r)}>Mark paid</button>
                </div>
              )}
            </div>
          );
        })}
        <p style={{ margin: 0, maxWidth: 640, fontSize: 13, color: PL.textSec, lineHeight: 1.5 }}>
          The system stamps each registration. Nobody can edit or delete one, including you. The first broker to register a buyer holds them on your cars; a second broker is refused. Marking a buyer as bought does not change the car: close the sale in Sold as you do today.
        </p>
      </section>
    </div>
  );
}
