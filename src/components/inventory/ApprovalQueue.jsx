// DRAFTS-1 (owner, 2026-11-14): cars a salesman drafted for the dealer, waiting for the owner, or a
// manager with "Approve listings". One card per car: who sent it, the asking price, the buy price
// (approval refuses without one, in the database: dealer_approve_listing), Approve or Send back.
// Renders nothing when nothing waits, or while the database does not have drafts yet (the
// submitted_by column arrives with migration 20261114d).
import { useCallback, useEffect, useState } from 'react';
import { Check, CornerUpLeft, Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { premiumLight as PL } from '../../theme/tokens';
import { cdnImg } from '../../utils/img';
import { INV_CARD, INV_INPUT, INV_GHOST_BTN, INV_MICRO } from './InventoryUi';
import '../../pages/salesmanLite/keys.css';

const RM = (n) => `RM ${Math.round(Number(n) || 0).toLocaleString('en-MY')}`;

// Exported for the tests: the database's refusal codes in plain words.
export function approvalError(err) {
  const m = String(err?.message || err || '');
  if (m.includes('needs_buy_price')) return 'Fill in the buy price first.';
  if (m.includes('needs_reason')) return 'Say why, so the salesman can fix it.';
  if (m.includes('not_pending')) return 'Someone already dealt with this car.';
  if (m.includes('not_allowed')) return 'You are not allowed to approve cars.';
  if (m.includes('not_found')) return 'This car is not in your dealership.';
  return 'Could not save. Try again.';
}

export function ago(iso, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins || 1} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export default function ApprovalQueue({ dealerId, canSeeCost, onChanged }) {
  const [cars, setCars] = useState([]);
  const [costs, setCosts] = useState({});

  const load = useCallback(async () => {
    if (!dealerId) return;
    const { data, error } = await supabase
      .from('car_listings')
      .select('id, year, brand, model, variant, selling_price, images, created_at, submitted_by, submitter:profiles!submitted_by(full_name)')
      .eq('dealer_id', dealerId)
      .eq('status', 'pending_approval')
      .not('submitted_by', 'is', null)
      .order('created_at', { ascending: true });
    if (error) { setCars([]); return; } // column not there yet, or a failed read: show nothing
    setCars(data || []);
    if (canSeeCost && data?.length) {
      const { data: units } = await supabase
        .from('stock_units').select('listing_id, purchase_price')
        .in('listing_id', data.map((c) => c.id));
      const map = {};
      for (const u of units || []) if (Number(u.purchase_price) > 0) map[u.listing_id] = String(u.purchase_price);
      setCosts(map);
    }
  }, [dealerId, canSeeCost]);

  useEffect(() => { load(); }, [load]);

  if (!cars.length) return null;

  const done = (id, status) => { setCars((c) => c.filter((x) => x.id !== id)); onChanged?.(id, status); };

  return (
    <div style={{ ...INV_CARD, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: PL.accent }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: PL.text }}>
          Waiting for approval <span style={{ color: PL.textMuted, fontWeight: 600 }}>{cars.length}</span>
        </p>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: PL.textSec }}>
        Your salesmen added these. They go live when you approve them.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {cars.map((car) => (
          <DraftCard key={car.id} car={car} canSeeCost={canSeeCost} savedCost={costs[car.id]} onDone={(status) => done(car.id, status)} />
        ))}
      </div>
    </div>
  );
}

function DraftCard({ car, canSeeCost, savedCost, onDone }) {
  const [buy, setBuy] = useState(savedCost || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => { if (savedCost) setBuy((b) => b || savedCost); }, [savedCost]);

  const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(' ') || 'Car';
  const photo = car.images?.[0];
  const buyNum = Number(String(buy).replace(/[^\d.]/g, ''));

  const approve = async () => {
    setErr('');
    if (canSeeCost && !(buyNum > 0)) { setErr('Fill in the buy price first.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('dealer_approve_listing', {
      p_listing_id: car.id,
      p_buy_price: canSeeCost && String(buyNum) !== savedCost ? buyNum : null,
    });
    setBusy(false);
    if (error) { setErr(approvalError(error)); return; }
    onDone('available');
  };

  const sendBack = async () => {
    setErr('');
    if (!reason.trim()) { setErr('Say why, so the salesman can fix it.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('dealer_reject_listing', { p_listing_id: car.id, p_reason: reason.trim() });
    setBusy(false);
    if (error) { setErr(approvalError(error)); return; }
    onDone('rejected');
  };

  return (
    <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 72, height: 52, borderRadius: 10, overflow: 'hidden', background: PL.hover, flexShrink: 0 }}>
          {photo && <img src={cdnImg(photo, 160, 70)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: PL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock style={{ width: 11, height: 11 }} />
            {car.submitter?.full_name || 'A salesman'} · {ago(car.created_at)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: PL.text, fontVariantNumeric: 'tabular-nums' }}>
            {car.selling_price ? `Asking ${RM(car.selling_price)}` : 'No asking price'}
          </p>
        </div>
      </div>

      {canSeeCost ? (
        <label style={{ display: 'block', marginTop: 10 }}>
          <span style={INV_MICRO}>Buy price (RM)</span>
          <input
            inputMode="numeric" value={buy} placeholder="What you paid"
            onChange={(e) => setBuy(e.target.value.replace(/[^\d]/g, ''))}
            style={{ ...INV_INPUT, background: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}
          />
        </label>
      ) : !savedCost && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: PL.textSec }}>The owner fills in the buy price before it can go live.</p>
      )}

      {sendingBack && (
        <input
          autoFocus value={reason} maxLength={300} placeholder="What should they fix?"
          onChange={(e) => setReason(e.target.value)}
          style={{ ...INV_INPUT, background: '#fff', marginTop: 10 }}
        />
      )}

      {err && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: PL.accentText }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {sendingBack ? (
          <>
            <button type="button" onClick={() => { setSendingBack(false); setErr(''); }} style={{ ...INV_GHOST_BTN, background: '#fff', flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button type="button" disabled={busy} onClick={sendBack} style={{ ...INV_GHOST_BTN, background: PL.text, color: '#fff', flex: 1, justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              <CornerUpLeft style={{ width: 14, height: 14 }} /> Send back
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setSendingBack(true)} style={{ ...INV_GHOST_BTN, background: '#fff', flex: 1, justifyContent: 'center' }}>
              <CornerUpLeft style={{ width: 14, height: 14 }} /> Send back
            </button>
            <button type="button" disabled={busy} onClick={approve} className="lk-red" style={{ ...INV_GHOST_BTN, background: undefined, color: '#fff', flex: 1, justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              <Check style={{ width: 14, height: 14 }} /> {busy ? 'Saving' : 'Approve'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
