import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { X, ArrowLeft, MapPin, Wallet, Users, Clock, Lock } from 'lucide-react';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import ChatSheet from '../components/chat/ChatSheet';
import { supabase } from '../supabaseClient';
import { CAR_DATA } from '../data/carData';
import { MY_STATES } from '../utils/locations';
import { YEARS } from '../config/marketplaceConfig';
import { setPostAuthReturn } from '../lib/buyerAuth';
import { FIND_ME_COPY } from '../config/findMeCopy';
import {
  postTitle, postBudget, postPlace, postAge, postDaysLeft, findMeError,
  MAX_SELLERS_PER_POST, NOTE_MAX,
} from '../utils/findMe';

// "Find me" posts (FINDME-1). A buyer posts the car they want; approved
// dealers and agents answer "I have it", which opens a chat. /find-me is the
// board, /find-me/:id one post. Every rule (who may post, 5 sellers per post,
// the buyer staying anonymous until they reply) lives in the find_me_* DB
// functions — this page only renders their answers.

const INK = '#111827', MUTED = '#6b7280', LINE = '#e5e7eb', RED = '#dc2626';
const GUTTER = 'clamp(20px, 4vw, 48px)';
const FONT = "'Outfit', system-ui, sans-serif";
const SHADOW = '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.05)';
const SELLER_ROLES = ['dealer', 'owner', 'salesman'];

const btn = (primary) => ({
  flex: 1, minHeight: 42, padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
  fontFamily: FONT, cursor: 'pointer', textAlign: 'center', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  background: primary ? RED : '#fff', color: primary ? '#fff' : INK,
  border: primary ? `1px solid ${RED}` : `1px solid ${LINE}`,
});
const field = {
  width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '10px 12px', borderRadius: 10,
  border: `1px solid ${LINE}`, background: '#fff', color: INK, fontSize: 15, fontFamily: FONT,
};
const label = { display: 'block', fontSize: 13, fontWeight: 600, color: INK, margin: '0 0 6px' };

// Who is looking: drives which buttons a card shows.
function useViewer() {
  const [v, setV] = useState({ ready: false });
  useEffect(() => {
    let alive = true;
    const load = async (session) => {
      const user = session?.user;
      if (!user) { if (alive) setV({ ready: true }); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!alive) return;
      const isAnon = !!user.is_anonymous;
      setV({
        ready: true, user, isAnon,
        isBuyer: !isAnon && p?.role === 'buyer',
        isSeller: !isAnon && SELLER_ROLES.includes(p?.role),
      });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') load(session);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return v;
}

function Sheet({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,17,21,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}
        style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 20px 28px', boxSizing: 'border-box', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK, flex: 1 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#F0EEE8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={INK} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function PostForm({ onClose, onPosted }) {
  const [f, setF] = useState({ brand: '', model: '', minYear: '', maxYear: '', budget: '', state: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, ...(k === 'brand' ? { model: '' } : {}) }));
  const models = f.brand ? CAR_DATA[f.brand] || [] : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!f.brand) { setErr('Pick a brand.'); return; }
    if (f.minYear && f.maxYear && Number(f.minYear) > Number(f.maxYear)) { setErr('"From" year is after "to" year.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('create_find_me_post', {
      p_brand: f.brand, p_model: f.model || null,
      p_min_year: f.minYear ? Number(f.minYear) : null, p_max_year: f.maxYear ? Number(f.maxYear) : null,
      p_max_budget: f.budget ? Number(f.budget) : null, p_state: f.state || null, p_note: f.note.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(findMeError(error)); return; }
    onPosted(data);
  };

  return (
    <Sheet title="What car do you want?" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <label style={label} htmlFor="fm-brand">Brand</label>
            <select id="fm-brand" style={field} value={f.brand} onChange={set('brand')}>
              <option value="">Choose</option>
              {Object.keys(CAR_DATA).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={label} htmlFor="fm-model">Model</label>
            <select id="fm-model" style={field} value={f.model} onChange={set('model')} disabled={!f.brand}>
              <option value="">Any model</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={label} htmlFor="fm-y1">Year from</label>
            <select id="fm-y1" style={field} value={f.minYear} onChange={set('minYear')}>
              <option value="">Any</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={label} htmlFor="fm-y2">Year to</label>
            <select id="fm-y2" style={field} value={f.maxYear} onChange={set('maxYear')}>
              <option value="">Any</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={label} htmlFor="fm-budget">Max budget (RM)</label>
            <input id="fm-budget" style={field} inputMode="numeric" placeholder="e.g. 80000"
              value={f.budget} onChange={(e) => setF((s) => ({ ...s, budget: e.target.value.replace(/\D/g, '').slice(0, 8) }))} />
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={label} htmlFor="fm-state">Where</label>
            <select id="fm-state" style={field} value={f.state} onChange={set('state')}>
              <option value="">Anywhere</option>
              {MY_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={label} htmlFor="fm-note">Anything else? <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span></label>
          <textarea id="fm-note" rows={3} maxLength={NOTE_MAX} style={{ ...field, resize: 'vertical' }}
            placeholder="Colour, mileage, must-haves..." value={f.note} onChange={set('note')} />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED, textAlign: 'right' }}>{f.note.length}/{NOTE_MAX}</p>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.5, display: 'flex', gap: 8 }}>
          <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          Sellers see the car you want, not who you are. Your name reaches a seller only when you reply to them. Phone numbers typed in the note are hidden.
        </p>
        {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#b91c1c' }}>{err}</p>}
        <button type="submit" disabled={busy} style={{ ...btn(true), opacity: busy ? 0.7 : 1 }}>{busy ? 'Posting...' : 'Post'}</button>
      </form>
    </Sheet>
  );
}

// Guests and logged-out visitors: posting needs a real buyer account, because
// sellers' replies have to reach somebody after the tab closes.
function SignInPrompt({ viewer, onClose }) {
  const go = (to) => { setPostAuthReturn(`${window.location.origin}/find-me?post=1`); window.location.href = to; };
  return (
    <Sheet title="Sign in to post" onClose={onClose}>
      <p style={{ margin: '0 0 16px', fontSize: 15, color: '#4b5563', lineHeight: 1.6 }}>
        Posts need a free buyer account, so sellers' replies can reach you after you close this page.
      </p>
      {viewer.isAnon && (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          You are chatting as a guest on this device. Guest chats do not move to the account you sign in with.
        </p>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        <button style={btn(true)} onClick={() => go('/buyer-signup')}>Create a buyer account</button>
        <button style={btn(false)} onClick={() => go('/login?as=buyer')}>I have an account</button>
      </div>
    </Sheet>
  );
}

function SellerJoinPrompt({ viewer, onClose }) {
  return (
    <Sheet title="Have this car?" onClose={onClose}>
      <p style={{ margin: '0 0 16px', fontSize: 15, color: '#4b5563', lineHeight: 1.6 }}>
        Only approved dealers and agents on XDrive can answer posts.
        {viewer.isBuyer ? ' You are signed in as a buyer; seller accounts are separate.' : ''}
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <Link style={btn(true)} to="/for-salesmen">Join as an agent</Link>
        <Link style={btn(false)} to="/shiftos">Join as a dealer</Link>
        {!viewer.user && <Link style={btn(false)} to="/login">Seller sign in</Link>}
      </div>
    </Sheet>
  );
}

function ReplySheet({ post, onClose, onOpened }) {
  const [msg, setMsg] = useState(`Hi, I have a car that matches your post for a ${postTitle(post)}. Would you like the details?`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('find_me_reply', { p_post_id: post.id, p_message: msg.trim() });
    setBusy(false);
    if (error) { setErr(findMeError(error)); return; }
    onOpened(data);
  };
  return (
    <Sheet title="Message the buyer" onClose={onClose}>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
        This opens a chat with the buyer. You will see their name when they reply.
      </p>
      <textarea rows={4} maxLength={2000} style={{ ...field, resize: 'vertical' }} value={msg} onChange={(e) => setMsg(e.target.value)} />
      {err && <p role="alert" style={{ margin: '10px 0 0', fontSize: 14, color: '#b91c1c' }}>{err}</p>}
      <button onClick={send} disabled={busy || !msg.trim()} style={{ ...btn(true), width: '100%', marginTop: 14, opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Sending...' : 'Send'}
      </button>
    </Sheet>
  );
}

function Meta({ Icon, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4b5563', minWidth: 0 }}>
      <Icon size={14} color={MUTED} style={{ flexShrink: 0 }} /> {children}
    </span>
  );
}

function PostCard({ post, detail = false, actions }) {
  return (
    <article style={{ flex: detail ? 'none' : '1 1 280px', maxWidth: detail ? 'none' : 400, minWidth: 0, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, boxShadow: SHADOW, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>
        <span>Wanted</span>
        {post.is_mine && <span style={{ background: '#ECEAE4', color: INK, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em' }}>Your post</span>}
        <span style={{ marginLeft: 'auto', letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>{postAge(post.created_at)}</span>
      </div>
      <h3 style={{ margin: 0, fontSize: detail ? 24 : 18, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{postTitle(post)}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        <Meta Icon={Wallet}>{postBudget(post)}</Meta>
        <Meta Icon={MapPin}>{postPlace(post)}</Meta>
      </div>
      {post.note && (
        <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.55, whiteSpace: 'pre-wrap', ...(detail ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
          {post.note}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        <Meta Icon={Users}>{post.reply_count} of {MAX_SELLERS_PER_POST} sellers answered</Meta>
        {detail && post.status === 'open' && <Meta Icon={Clock}>{postDaysLeft(post.expires_at)} days left</Meta>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 4 }}>{actions}</div>
    </article>
  );
}

const STATUS_TEXT = { found: 'Found it', closed: 'Closed', expired: 'Expired' };

export default function FindMePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const viewer = useViewer();
  const [posts, setPosts] = useState(null);     // board
  const [mine, setMine] = useState([]);         // buyer's own, any status
  const [one, setOne] = useState(undefined);    // detail: undefined loading, null missing
  const [sheet, setSheet] = useState(null);     // { kind, post }
  const [chat, setChat] = useState(null);       // { threadId, post }
  const [loadErr, setLoadErr] = useState('');

  const load = useCallback(async () => {
    setLoadErr('');
    if (id) {
      const { data, error } = await supabase.rpc('get_find_me_post', { p_id: id });
      if (error) { setLoadErr('Could not load this post.'); setOne(null); return; }
      setOne(data?.[0] || null);
      return;
    }
    const { data, error } = await supabase.rpc('list_find_me_posts', { p_limit: 60, p_offset: 0 });
    if (error) { setLoadErr('Could not load posts.'); setPosts([]); return; }
    setPosts(data || []);
  }, [id]);

  useEffect(() => { if (viewer.ready) load(); }, [viewer.ready, viewer.user?.id, load]);

  // The buyer's own posts, including found / closed / expired ones the board
  // hides. RLS on find_me_posts is own-rows-only.
  const loadMine = useCallback(async () => {
    if (!viewer.isBuyer || id) { setMine([]); return; }
    const { data } = await supabase.from('find_me_posts')
      .select('id, brand, model, min_year, max_year, max_budget, state, note, status, reply_count, created_at, expires_at')
      .eq('buyer_id', viewer.user.id).order('created_at', { ascending: false }).limit(10);
    setMine((data || []).map((p) => ({
      ...p, is_mine: true,
      status: p.status === 'open' && new Date(p.expires_at) <= new Date() ? 'expired' : p.status,
    })));
  }, [viewer.isBuyer, viewer.user?.id, id]);
  useEffect(() => { loadMine(); }, [loadMine]);

  useEffect(() => {
    document.title = id ? 'Wanted car | XDrive' : FIND_ME_COPY.title;
  }, [id]);

  const startPost = useCallback(() => {
    if (!viewer.ready) return;
    if (viewer.isSeller) { setSheet({ kind: 'seller-cant-post' }); return; }
    setSheet({ kind: viewer.isBuyer ? 'post' : 'signin' });
  }, [viewer]);

  // Back from sign-in with ?post=1: open the form they were trying to reach.
  useEffect(() => {
    if (!viewer.ready || params.get('post') !== '1') return;
    setParams((p) => { p.delete('post'); return p; }, { replace: true });
    startPost();
  }, [viewer.ready, params, setParams, startPost]);

  const haveIt = async (post) => {
    if (!viewer.isSeller) { setSheet({ kind: 'join', post }); return; }
    if (post.i_replied) {
      // Already answered: find_me_reply hands back the existing chat.
      const { data, error } = await supabase.rpc('find_me_reply', { p_post_id: post.id, p_message: '' });
      if (error) { setSheet({ kind: 'error', text: findMeError(error) }); return; }
      setChat({ threadId: data, post });
      return;
    }
    setSheet({ kind: 'reply', post });
  };

  const closePost = async (post, found) => {
    const { error } = await supabase.rpc('close_find_me_post', { p_id: post.id, p_found: found });
    if (error) { setSheet({ kind: 'error', text: findMeError(error) }); return; }
    load(); loadMine();
  };

  const actionsFor = (post, detail) => {
    if (post.is_mine) {
      if (post.status !== 'open') {
        return <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>{STATUS_TEXT[post.status] || post.status}</span>;
      }
      return (
        <>
          {detail
            ? <button style={btn(false)} onClick={() => closePost(post, false)}>Close post</button>
            : <Link style={btn(false)} to={`/find-me/${post.id}`}>See details</Link>}
          <button style={btn(true)} onClick={() => closePost(post, true)}>Found it</button>
        </>
      );
    }
    const full = post.is_full && !post.i_replied;
    return (
      <>
        {!detail && <Link style={btn(false)} to={`/find-me/${post.id}`}>See details</Link>}
        <button style={{ ...btn(true), opacity: full ? 0.5 : 1 }} disabled={full} onClick={() => haveIt(post)}>
          {post.i_replied ? 'Open chat' : full ? 'Full' : 'I have it'}
        </button>
      </>
    );
  };

  const onPosted = (newId) => { setSheet(null); navigate(`/find-me/${newId}`); };
  const openMine = mine.filter((p) => p.status === 'open');
  const boardPosts = (posts || []).filter((p) => !(viewer.isBuyer && p.is_mine));

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      {id && <Helmet><meta name="robots" content="noindex, follow" /></Helmet>}
      <MarketplaceHeader />

      <main style={{ flex: 1, width: '100%', maxWidth: 1360, margin: '0 auto', padding: `28px ${GUTTER} 72px`, boxSizing: 'border-box' }}>
        {id ? (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <Link to="/find-me" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none', marginBottom: 16 }}>
              <ArrowLeft size={16} /> All posts
            </Link>
            {one === undefined ? (
              <div style={{ height: 260, borderRadius: 16, background: 'rgba(0,0,0,0.04)' }} />
            ) : one === null ? (
              <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: INK }}>{loadErr || 'This post is no longer open'}</p>
                <p style={{ margin: 0, fontSize: 14, color: MUTED }}>The buyer found their car, or the post expired after 30 days.</p>
              </div>
            ) : (
              <PostCard post={one} detail actions={actionsFor(one, true)} />
            )}
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{FIND_ME_COPY.eyebrow}</p>
            <h1 style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(34px, 6vw, 56px)', lineHeight: 0.95, letterSpacing: '0.02em', color: '#0f1115' }}>
              {FIND_ME_COPY.h1}
            </h1>
            <p style={{ margin: '12px 0 20px', maxWidth: 600, fontSize: 15, color: '#4b5563', lineHeight: 1.6 }}>
              {FIND_ME_COPY.intro(MAX_SELLERS_PER_POST)}
            </p>
            <button onClick={startPost} style={{ ...btn(true), flex: 'none', padding: '12px 24px' }}>Post what you want</button>

            {mine.length > 0 && (
              <section style={{ marginTop: 40 }}>
                <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: INK }}>
                  Your posts {openMine.length > 0 && <span style={{ color: MUTED, fontWeight: 500 }}>· {openMine.length} open</span>}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {mine.map((p) => <PostCard key={p.id} post={p} actions={actionsFor(p, false)} />)}
                </div>
              </section>
            )}

            <section style={{ marginTop: 40 }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: INK }}>Buyers are looking for</h2>
              {posts === null ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {[1, 2, 3].map((i) => <div key={i} style={{ flex: '1 1 280px', maxWidth: 400, height: 220, borderRadius: 16, background: 'rgba(0,0,0,0.04)' }} />)}
                </div>
              ) : boardPosts.length === 0 ? (
                <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center', maxWidth: 480 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: INK }}>{loadErr || 'No posts yet'}</p>
                  <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Be the first: post the car you want and let sellers come to you.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {boardPosts.map((p) => <PostCard key={p.id} post={p} actions={actionsFor(p, false)} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <MarketplaceFooter />

      {sheet?.kind === 'post' && <PostForm onClose={() => setSheet(null)} onPosted={onPosted} />}
      {sheet?.kind === 'signin' && <SignInPrompt viewer={viewer} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'join' && <SellerJoinPrompt viewer={viewer} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'reply' && (
        <ReplySheet post={sheet.post} onClose={() => setSheet(null)}
          onOpened={(threadId) => { const post = sheet.post; setSheet(null); setChat({ threadId, post }); load(); }} />
      )}
      {sheet?.kind === 'seller-cant-post' && (
        <Sheet title="Posts are for buyers" onClose={() => setSheet(null)}>
          <p style={{ margin: 0, fontSize: 15, color: '#4b5563', lineHeight: 1.6 }}>
            You are signed in as a seller. Answer buyers' posts below with "I have it".
          </p>
        </Sheet>
      )}
      {sheet?.kind === 'error' && (
        <Sheet title="Could not do that" onClose={() => setSheet(null)}>
          <p style={{ margin: 0, fontSize: 15, color: '#4b5563', lineHeight: 1.6 }}>{sheet.text}</p>
        </Sheet>
      )}
      {chat && (
        <ChatSheet threadId={chat.threadId} buyerName={`Buyer in ${chat.post.state || 'Malaysia'}`}
          carLabel={postTitle(chat.post)} onClose={() => setChat(null)} />
      )}
    </div>
  );
}
