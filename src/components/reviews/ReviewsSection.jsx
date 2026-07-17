import React, { useState, useEffect, useCallback } from 'react';
import { Star, LogIn, Trash2, Pencil, Send } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { markBuyerIntent } from '../../lib/buyerAuth';

// Buyer reviews for a seller (dealer or independent agent = listing.dealer_id).
// Logged-in buyers only. Reviews are NOT purchase-verified, so nothing here
// claims "verified purchase" — they are plain buyer reviews. Empty state is
// honest ("No reviews yet") rather than a fabricated default rating.

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const Stars = ({ value, size = 14, color = '#f59e0b', emptyColor = 'rgba(148,163,184,0.4)' }) => (
  <span style={{ display: 'inline-flex', gap: 1 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star key={n} size={size} fill={n <= value ? color : 'none'} style={{ color: n <= value ? color : emptyColor }} strokeWidth={2} />
    ))}
  </span>
);

export default function ReviewsSection({ dealerId, listingId, sellerName = 'this seller', th, isXdrive }) {
  const [session, setSession] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchReviews = useCallback(async () => {
    if (!dealerId) return;
    const { data } = await supabase
      .from('reviews')
      .select('id, buyer_id, reviewer_name, rating, body, created_at')
      .eq('dealer_id', dealerId)
      .eq('status', 'visible')
      .order('created_at', { ascending: false });
    setReviews(data || []);
    setLoaded(true);
  }, [dealerId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const uid = session?.user?.id || null;
  const myReview = uid ? reviews.find(r => r.buyer_id === uid) : null;
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  // Prefill the form when opening it (edit existing or start fresh)
  useEffect(() => {
    if (!editing) return;
    if (myReview) { setRating(myReview.rating); setName(myReview.reviewer_name || ''); setBody(myReview.body || ''); }
    else {
      const meta = session?.user?.user_metadata || {};
      setRating(0);
      setName(meta.full_name || meta.name || (session?.user?.email || '').split('@')[0] || '');
      setBody('');
    }
  }, [editing, myReview, session]);

  const signIn = async () => {
    sessionStorage.setItem('post_auth_return', window.location.href);
    markBuyerIntent();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
  };

  const submit = async () => {
    if (!uid || !rating) return;
    setSaving(true);
    const { error } = await supabase.from('reviews').upsert({
      dealer_id: dealerId,
      listing_id: listingId || null,
      buyer_id: uid,
      reviewer_name: name.trim() || 'Buyer',
      rating,
      body: body.trim() || null,
    }, { onConflict: 'dealer_id,buyer_id' });
    setSaving(false);
    if (!error) { setEditing(false); fetchReviews(); }
  };

  const remove = async () => {
    if (!myReview) return;
    await supabase.from('reviews').delete().eq('id', myReview.id);
    setEditing(false);
    fetchReviews();
  };

  if (!dealerId) return null;

  const accent = '#f59e0b';
  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
    border: 'none', fontFamily: "'DM Sans',sans-serif",
  };

  return (
    <div style={{ marginTop: 32, paddingTop: 28, borderTop: `1px solid ${th.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, margin: 0 }}>Reviews</p>
        {count > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.5rem', color: th.text, lineHeight: 1 }}>{avg.toFixed(1)}</span>
            <Stars value={Math.round(avg)} size={15} color={accent} />
            <span style={{ fontSize: 12, color: th.textMuted }}>({count})</span>
          </div>
        )}
      </div>

      {/* Write / own-review area */}
      {!editing && (
        <div style={{ marginBottom: count > 0 ? 20 : 0 }}>
          {!uid ? (
            <button onClick={signIn} style={{ ...btnStyle, background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>
              <LogIn size={14} /> Sign in to write a review
            </button>
          ) : myReview ? (
            <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>Your review</span>
                  <Stars value={myReview.rating} size={13} color={accent} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditing(true)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: th.textSec, display: 'flex', padding: 4 }}><Pencil size={14} /></button>
                  <button onClick={remove} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              </div>
              {myReview.body && <p style={{ fontSize: 13, color: th.textSec, lineHeight: 1.7, margin: 0 }}>{myReview.body}</p>}
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{ ...btnStyle, background: accent, color: '#1a1206' }}>
              <Star size={14} fill="#1a1206" /> Write a review
            </button>
          )}
        </div>
      )}

      {/* Editor */}
      {editing && uid && (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                <Star size={26} fill={n <= (hoverRating || rating) ? accent : 'none'} style={{ color: n <= (hoverRating || rating) ? accent : 'rgba(148,163,184,0.5)' }} strokeWidth={2} />
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: '100%', boxSizing: 'border-box', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 9, color: th.text, fontSize: 13, padding: '9px 12px', marginBottom: 10, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`Share your experience with ${sellerName}…`}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: 9, color: th.text, fontSize: 13, padding: '9px 12px', marginBottom: 12, outline: 'none', resize: 'vertical', fontFamily: "'DM Sans',sans-serif" }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ ...btnStyle, background: 'none', color: th.textSec, border: `1px solid ${th.border}` }}>Cancel</button>
            <button onClick={submit} disabled={!rating || saving} style={{ ...btnStyle, background: rating ? accent : 'rgba(148,163,184,0.3)', color: '#1a1206', cursor: rating && !saving ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
              <Send size={13} /> {saving ? 'Posting…' : myReview ? 'Update review' : 'Post review'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loaded && count === 0 && !editing && (
        <p style={{ fontSize: 13, color: th.textMuted, margin: '4px 0 0' }}>No reviews yet. Be the first to review {sellerName}.</p>
      )}
      {count > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reviews.map(r => (
            <div key={r.id} style={{ borderTop: `1px solid ${th.borderSec || th.border}`, paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reviewer_name || 'Buyer'}</span>
                  <Stars value={r.rating} size={12} color={accent} />
                </div>
                <span style={{ fontSize: 11, color: th.textMuted, flexShrink: 0 }}>{fmtDate(r.created_at)}</span>
              </div>
              {r.body && <p style={{ fontSize: 13, color: th.textSec, lineHeight: 1.7, margin: 0 }}>{r.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
