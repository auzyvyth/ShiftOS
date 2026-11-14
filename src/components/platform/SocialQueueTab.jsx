// Console > Work > Social (SOCIAL-1, 2026-11-13). Cars the SELLER agreed to share (asked after they submit
// the form) and the owner has approved, waiting to go on Drevo's Facebook Page and TikTok. The owner posts
// each one: TikTok needs a person to preview and consent to every post, so this is a queue + a button,
// never an automation. The queue is `get_social_queue()` (superadmin only); a post stamps the car as
// posted from the edge function, so it leaves the queue by itself.
import React, { useCallback, useEffect, useState } from 'react';
import { platformClient } from '../../lib/platformClient';
import { callZernioPost, explain } from '../autopost/zernioApi';
import { carTitle, money } from '../../../supabase/functions/_shared/postCaption.js';
import { cdnImg } from '../../utils/img';

const PostToSocialsSheet = React.lazy(() => import('../autopost/PostToSocialsSheet'));
const RecentPosts = React.lazy(() => import('../autopost/PostToSocialsSheet').then((m) => ({ default: m.RecentPosts })));

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 };
const btn = (primary) => ({
  height: 38, padding: '0 16px', borderRadius: 999, border: primary ? 'none' : '1px solid #e5e7eb', cursor: 'pointer',
  background: primary ? '#dc2626' : '#fff', color: primary ? '#fff' : '#111827', fontSize: 13.5, fontWeight: 600,
});
const ghost = { height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

export default function SocialQueueTab() {
  const [tab, setTab] = useState('queue'); // queue | posted
  const [rows, setRows] = useState(null);
  const [accounts, setAccounts] = useState(null); // null = loading, [] = none connected
  const [err, setErr] = useState('');
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const [q, st] = await Promise.all([
      platformClient.rpc('get_social_queue'),
      callZernioPost({ action: 'status' }, platformClient),
    ]);
    if (q.error) {
      setErr(q.error.code === 'PGRST202' || /get_social_queue/.test(q.error.message || '')
        ? 'The social queue is not set up in the database yet (migration 20261114b is waiting for tonight\'s release window).'
        : `Could not load the queue: ${q.error.message}`);
      setRows((r) => r || []);
    } else setRows(q.data || []);
    if (st.err) { setErr((e) => e || explain(st.err)); setAccounts([]); }
    else setAccounts(st.data?.allowed ? (st.data.accounts || []) : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const skip = async (row) => {
    if (!window.confirm('Skip this car? It leaves the queue and is not posted.')) return;
    setBusy(row.id);
    const { error } = await platformClient.rpc('skip_social_listing', { p_listing: row.id });
    setBusy('');
    if (error) { setErr(error.message); return; }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  const queue = (rows || []).filter((r) => r.kind === 'queue');
  const withdrawn = (rows || []).filter((r) => r.kind === 'withdrawn');
  const noAccounts = accounts !== null && accounts.length === 0;

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#6b7280' }}>
        Cars the seller agreed to share, after you approved them. You post each one to Drevo&apos;s Facebook Page and TikTok.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button style={{ ...ghost, ...(tab === 'queue' ? { background: '#111827', color: '#fff', borderColor: '#111827' } : {}) }} onClick={() => setTab('queue')}>
          Queue{queue.length ? ` (${queue.length})` : ''}
        </button>
        <button style={{ ...ghost, ...(tab === 'posted' ? { background: '#111827', color: '#fff', borderColor: '#111827' } : {}) }} onClick={() => setTab('posted')}>Posted</button>
      </div>

      {err && <div role="alert" style={{ ...card, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2', fontSize: 13.5 }}>{err}</div>}
      {noAccounts && !err && <div style={{ ...card, fontSize: 13.5, color: '#6b7280' }}>No Facebook Page or TikTok is connected in Zernio yet.</div>}

      {tab === 'queue' && (
        <>
          {rows === null && <p style={{ color: '#6b7280', fontSize: 14 }}>Loading...</p>}
          {rows && withdrawn.map((r) => (
            <div key={r.id} style={{ ...card, borderColor: '#fecaca' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{carTitle(r)}</div>
              <div style={{ fontSize: 13, color: '#b91c1c', margin: '4px 0 8px' }}>
                {r.seller_name || 'The seller'} withdrew permission after this was posted. Take it down in Posted (Facebook can be removed; TikTok only in the TikTok app).
              </div>
              <button style={ghost} onClick={() => setTab('posted')}>Open Posted</button>
            </div>
          ))}
          {rows && queue.length === 0 && !err && (
            <p style={{ color: '#6b7280', fontSize: 14 }}>Nothing waiting. A car shows here once you approve it and the seller said yes.</p>
          )}
          {queue.map((r) => {
            const img = Array.isArray(r.images) && r.images[0] ? cdnImg(r.images[0], 160, 70) : null;
            return (
              <div key={r.id} style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {img && <img src={img} alt="" width="64" height="64" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', background: '#f3f4f6', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{carTitle(r)}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {money(r.selling_price) || 'No price'} · {(() => { const n = Array.isArray(r.images) ? Math.min(8, r.images.length) : 0; return `${n} photo${n === 1 ? '' : 's'}`; })()} · {r.seller_name || 'Seller'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Seller agreed {r.social_consent_at ? new Date(r.social_consent_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btn(false)} disabled={busy === r.id} onClick={() => skip(r)}>Skip</button>
                  <button style={btn(true)} disabled={noAccounts || accounts === null} onClick={() => setActive(r)}>Post</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === 'posted' && (
        <React.Suspense fallback={<p style={{ color: '#6b7280', fontSize: 14 }}>Loading...</p>}>
          <div style={{ background: '#111318', color: '#fff', borderRadius: 12, padding: 14 }}>
            <RecentPosts font="inherit" ghost={{ ...ghost, background: '#181b21', color: '#fff', border: 'none' }} client={platformClient} />
          </div>
        </React.Suspense>
      )}

      {active && (
        <React.Suspense fallback={null}>
          <PostToSocialsSheet
            car={active}
            seller={{ slug: active.seller_slug, name: active.seller_name }}
            access={{ allowed: true, accounts: accounts || [], ready: true }}
            client={platformClient}
            onClose={() => { setActive(null); load(); }}
          />
        </React.Suspense>
      )}
    </div>
  );
}
