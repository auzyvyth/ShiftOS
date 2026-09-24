import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, LogIn, Trash2, Pencil, Send, CornerDownRight, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { markBuyerIntent } from '../../lib/buyerAuth';

// Reviews AND questions on one car page, in one section.
//
// They used to be two stacked sections (ReviewsSection + CommentsSection), each
// with its own heading, its own sign-in button, its own empty state and its own
// accent colour — roughly a screen and a half of chrome for what a shopper reads
// as one thing: what other people said about this seller and this car. This is
// that one thing.
//
// What is deliberately NOT merged: the data. A review is about the SELLER
// (reviews.dealer_id, one per buyer per seller) and a question is about THIS CAR
// (listing_comments.listing_id, threaded). Same feed, still two tables, and each
// row says which it is so the distinction never gets lost.
//
// Composer: you pick what you are posting first — Question or Review — and get
// only the fields that kind needs. One button, not two competing ones.
//
// Authorship is derived, never client-set: `Seller` is author_id === dealerId,
// so it cannot be spoofed by anyone posting.

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const STAR = '#f59e0b';
const ACCENT = '#dc2626';

const Stars = ({ value, size = 13 }) => (
  <span style={{ display: 'inline-flex', gap: 1 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star key={n} size={size} fill={n <= value ? STAR : 'none'}
        style={{ color: n <= value ? STAR : 'rgba(148,163,184,0.45)' }} strokeWidth={2} />
    ))}
  </span>
);

// Small neutral pills. Per the anti-slop rules: a tag, never a coloured bar down
// the side of the row, and only one saturated accent in play at a time.
const Pill = ({ children, tone = 'muted', th }) => {
  const tones = {
    review:   { fg: STAR,   bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.28)' },
    question: { fg: ACCENT, bg: 'rgba(220,38,38,0.09)',  bd: 'rgba(220,38,38,0.25)' },
    seller:   { fg: ACCENT, bg: 'rgba(220,38,38,0.09)',  bd: 'rgba(220,38,38,0.25)' },
    muted:    { fg: th.textMuted, bg: 'transparent',     bd: th.border },
  };
  const c = tones[tone] || tones.muted;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 4,
      padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0,
    }}>{children}</span>
  );
};

export default function SellerFeedback({ dealerId, listingId, sellerName = 'this seller', th, anchorId, onSummary }) {
  const [session, setSession] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');       // all | review | question
  const [composer, setComposer] = useState(null);    // null | 'review' | 'question'
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 5;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchAll = useCallback(async () => {
    const jobs = [];
    jobs.push(dealerId
      ? supabase.from('reviews')
          .select('id, buyer_id, reviewer_name, rating, body, created_at')
          .eq('dealer_id', dealerId).eq('status', 'visible')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }));
    jobs.push(listingId
      ? supabase.from('listing_comments')
          .select('id, author_id, author_name, body, parent_id, created_at')
          .eq('listing_id', listingId).eq('status', 'visible')
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }));
    const [r, c] = await Promise.all(jobs);
    setReviews(r.data || []);
    setComments(c.data || []);
    setLoaded(true);
  }, [dealerId, listingId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const uid = session?.user?.id || null;
  const myReview = uid ? reviews.find(r => r.buyer_id === uid) : null;
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  // Hand the tally up so the page can show it beside the seller's name, where
  // the decision is actually made, without a second query for the same rows.
  useEffect(() => { if (loaded && onSummary) onSummary({ count, avg }); }, [loaded, count, avg, onSummary]);

  const repliesByParent = useMemo(() => comments.reduce((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] = acc[c.parent_id] || []).push(c);
    return acc;
  }, {}), [comments]);

  // One feed, newest first, each entry tagged with what it is.
  const feed = useMemo(() => {
    const asReview = reviews.map(r => ({
      kind: 'review', id: r.id, authorId: r.buyer_id, authorName: r.reviewer_name,
      rating: r.rating, body: r.body, created_at: r.created_at,
    }));
    const asQuestion = comments.filter(c => !c.parent_id).map(c => ({
      kind: 'question', id: c.id, authorId: c.author_id, authorName: c.author_name,
      body: c.body, created_at: c.created_at,
    }));
    return [...asReview, ...asQuestion]
      .filter(e => filter === 'all' || e.kind === filter)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [reviews, comments, filter]);

  // Collapsed by default — a car page with 40 reviews stacked open turned this
  // section into most of the page's scroll length. Switching filters re-collapses
  // it so "Questions" doesn't inherit an expansion made while looking at reviews.
  useEffect(() => { setExpanded(false); }, [filter]);
  const visibleFeed = expanded ? feed : feed.slice(0, VISIBLE);

  const defaultName = () => {
    const meta = session?.user?.user_metadata || {};
    return meta.full_name || meta.name || (session?.user?.email || '').split('@')[0] || '';
  };

  const openComposer = (kind) => {
    setComposer(kind);
    setReplyTo(null);
    if (kind === 'review' && myReview) {
      setRating(myReview.rating); setName(myReview.reviewer_name || ''); setBody(myReview.body || '');
    } else {
      setRating(0); setName(defaultName()); setBody('');
    }
  };
  const closeComposer = () => { setComposer(null); setBody(''); setRating(0); };

  const signIn = async () => {
    sessionStorage.setItem('post_auth_return', window.location.href);
    markBuyerIntent();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
  };

  const submit = async () => {
    if (!uid) return;
    setSaving(true);
    let error;
    if (composer === 'review') {
      if (!rating) { setSaving(false); return; }
      ({ error } = await supabase.from('reviews').upsert({
        dealer_id: dealerId, listing_id: listingId || null, buyer_id: uid,
        reviewer_name: name.trim() || 'Buyer', rating, body: body.trim() || null,
      }, { onConflict: 'dealer_id,buyer_id' }));
    } else {
      if (!body.trim()) { setSaving(false); return; }
      ({ error } = await supabase.from('listing_comments').insert({
        listing_id: listingId, author_id: uid,
        author_name: name.trim() || defaultName() || 'Buyer', body: body.trim(),
      }));
    }
    setSaving(false);
    if (!error) { closeComposer(); fetchAll(); }
  };

  const postReply = async (questionId) => {
    if (!uid || !replyBody.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('listing_comments').insert({
      listing_id: listingId, author_id: uid, author_name: defaultName() || 'User',
      body: replyBody.trim(), parent_id: questionId,
    });
    setSaving(false);
    if (!error) { setReplyBody(''); setReplyTo(null); fetchAll(); }
  };

  const removeEntry = async (entry) => {
    const table = entry.kind === 'review' ? 'reviews' : 'listing_comments';
    await supabase.from(table).delete().eq('id', entry.id);
    fetchAll();
  };

  if (!dealerId && !listingId) return null;

  const btn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontSize: 13, fontWeight: 700, padding: '9px 14px', borderRadius: 10,
    cursor: 'pointer', border: 'none', fontFamily: 'system-ui,sans-serif',
  };
  const input = {
    width: '100%', boxSizing: 'border-box', background: th.inputBg,
    border: `1px solid ${th.border}`, borderRadius: 9, color: th.text,
    fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'system-ui,sans-serif',
  };

  const qCount = comments.filter(c => !c.parent_id).length;

  // Who wrote it. Derived from ids, so it cannot be spoofed by the poster.
  const roleOf = (authorId) => {
    if (dealerId && authorId === dealerId) return 'seller';
    return 'buyer';
  };

  const AuthorLine = ({ authorId, authorName, created_at, kind, ratingValue, onDelete, isReply }) => {
    const role = roleOf(authorId);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
          {isReply && <CornerDownRight size={13} style={{ color: th.textMuted, flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {role === 'seller' ? sellerName : (authorName || 'Buyer')}
          </span>
          <Pill tone={role === 'seller' ? 'seller' : 'muted'} th={th}>{role === 'seller' ? 'Seller' : 'Buyer'}</Pill>
          {kind && <Pill tone={kind} th={th}>{kind === 'review' ? 'Review' : 'Question'}</Pill>}
          {kind === 'review' && <Stars value={ratingValue} size={12} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: th.textMuted }}>{fmtDate(created_at)}</span>
          {onDelete && (
            <button onClick={onDelete} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 2 }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const FilterPill = ({ value, label, n }) => {
    const on = filter === value;
    return (
      <button onClick={() => setFilter(value)} style={{
        fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
        fontFamily: 'system-ui,sans-serif',
        background: on ? 'rgba(220,38,38,0.10)' : 'transparent',
        border: `1px solid ${on ? 'rgba(220,38,38,0.30)' : th.border}`,
        color: on ? ACCENT : th.textSec,
      }}>{label}{n != null ? ` ${n}` : ''}</button>
    );
  };

  return (
    <div id={anchorId} style={{ marginTop: 32, paddingTop: 28, borderTop: `1px solid ${th.border}` }}>
      {/* Header: one title, the rating tally, and the filters — the three
          separate headers this replaced are what made it long. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, margin: 0 }}>
            Reviews &amp; Questions
          </p>
          {count > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.35rem', color: th.text, lineHeight: 1 }}>{avg.toFixed(1)}</span>
              <Stars value={Math.round(avg)} size={14} />
              <span style={{ fontSize: 12, color: th.textMuted }}>({count})</span>
            </span>
          )}
        </div>
        {(count > 0 || qCount > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <FilterPill value="all" label="All" />
            <FilterPill value="review" label="Reviews" n={count} />
            <FilterPill value="question" label="Questions" n={qCount} />
          </div>
        )}
      </div>

      {/* Composer. Pick what you're posting first, then get only that kind's
          fields — instead of two buttons each opening a different form. */}
      {!composer ? (
        !uid ? (
          <button onClick={signIn} style={{ ...btn, background: 'rgba(220,38,38,0.10)', color: ACCENT, border: '1px solid rgba(220,38,38,0.25)' }}>
            <LogIn size={14} /> Sign in to review or ask
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => openComposer('question')} style={{ ...btn, background: ACCENT, color: '#fff' }}>
              Ask a question
            </button>
            <button onClick={() => openComposer('review')} style={{ ...btn, background: 'transparent', color: th.textSec, border: `1px solid ${th.border}` }}>
              <Star size={14} /> {myReview ? 'Edit your review' : 'Write a review'}
            </button>
          </div>
        )
      ) : (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['question', 'review'].map(k => (
                <button key={k} onClick={() => openComposer(k)} style={{
                  fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'system-ui,sans-serif',
                  background: composer === k ? 'rgba(220,38,38,0.10)' : 'transparent',
                  border: `1px solid ${composer === k ? 'rgba(220,38,38,0.30)' : th.border}`,
                  color: composer === k ? ACCENT : th.textSec,
                }}>{k === 'question' ? 'Question' : 'Review'}</button>
              ))}
            </div>
            <button onClick={closeComposer} aria-label="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: th.textMuted, display: 'flex', padding: 2 }}>
              <X size={15} />
            </button>
          </div>

          <p style={{ margin: '0 0 10px', fontSize: 11.5, color: th.textMuted, lineHeight: 1.5 }}>
            {composer === 'review'
              ? `Your rating of ${sellerName} as a seller. One review per seller — posting again updates yours.`
              : 'Asked publicly on this car. The seller can answer here for everyone to see.'}
          </p>

          {composer === 'review' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 11 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <Star size={24} fill={n <= (hoverRating || rating) ? STAR : 'none'}
                    style={{ color: n <= (hoverRating || rating) ? STAR : 'rgba(148,163,184,0.5)' }} strokeWidth={2} />
                </button>
              ))}
            </div>
          )}

          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ ...input, marginBottom: 9 }} />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            placeholder={composer === 'review'
              ? `Share your experience with ${sellerName}…`
              : `Ask ${sellerName} about this car — e.g. is the price negotiable, any accident history?`}
            style={{ ...input, marginBottom: 11, resize: 'vertical' }} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {composer === 'review' && myReview && (
              <button onClick={() => { removeEntry({ kind: 'review', id: myReview.id }); closeComposer(); }}
                style={{ ...btn, background: 'none', color: '#ef4444', border: `1px solid ${th.border}`, marginRight: 'auto' }}>
                <Trash2 size={13} /> Delete
              </button>
            )}
            <button onClick={closeComposer} style={{ ...btn, background: 'none', color: th.textSec, border: `1px solid ${th.border}` }}>Cancel</button>
            <button onClick={submit}
              disabled={saving || (composer === 'review' ? !rating : !body.trim())}
              style={{
                ...btn,
                background: (composer === 'review' ? rating : body.trim()) ? ACCENT : 'rgba(148,163,184,0.3)',
                color: '#fff',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}>
              <Send size={13} /> {saving ? 'Posting…' : composer === 'review' ? (myReview ? 'Update review' : 'Post review') : 'Post question'}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {loaded && feed.length === 0 && !composer && (
        <p style={{ fontSize: 13, color: th.textMuted, margin: '14px 0 0' }}>
          {filter === 'all'
            ? `Nothing yet. Be the first to review ${sellerName} or ask about this car.`
            : filter === 'review' ? 'No reviews yet.' : 'No questions yet.'}
        </p>
      )}

      {feed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
          {visibleFeed.map(e => (
            <div key={`${e.kind}-${e.id}`} style={{ borderTop: `1px solid ${th.borderSec || th.border}`, paddingTop: 13, paddingBottom: 13 }}>
              <AuthorLine
                authorId={e.authorId} authorName={e.authorName} created_at={e.created_at}
                kind={e.kind} ratingValue={e.rating}
                onDelete={uid === e.authorId ? () => removeEntry(e) : null}
              />
              {e.body && (
                <p style={{ fontSize: 13, color: th.textSec, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                  {e.body}
                </p>
              )}

              {/* Answers — questions only. A review is not a thread. */}
              {e.kind === 'question' && (
                <>
                  {(repliesByParent[e.id] || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, paddingLeft: 14 }}>
                      {repliesByParent[e.id].map(r => (
                        <div key={r.id}>
                          <AuthorLine
                            authorId={r.author_id} authorName={r.author_name} created_at={r.created_at}
                            isReply
                            onDelete={uid === r.author_id ? () => removeEntry({ kind: 'question', id: r.id }) : null}
                          />
                          <p style={{ fontSize: 13, color: th.textSec, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 9, paddingLeft: 14 }}>
                    {replyTo === e.id ? (
                      <div>
                        <textarea value={replyBody} onChange={ev => setReplyBody(ev.target.value)} rows={2}
                          placeholder="Write a reply…" style={{ ...input, marginBottom: 8, resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setReplyTo(null); setReplyBody(''); }}
                            style={{ ...btn, padding: '6px 11px', fontSize: 12, background: 'none', color: th.textSec, border: `1px solid ${th.border}` }}>Cancel</button>
                          <button onClick={() => postReply(e.id)} disabled={!replyBody.trim() || saving}
                            style={{ ...btn, padding: '6px 11px', fontSize: 12, background: replyBody.trim() ? ACCENT : 'rgba(148,163,184,0.3)', color: '#fff', cursor: replyBody.trim() && !saving ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
                            <Send size={12} /> {saving ? 'Posting…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    ) : uid ? (
                      <button onClick={() => { setReplyTo(e.id); setReplyBody(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: th.textMuted, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'system-ui,sans-serif' }}>
                        <CornerDownRight size={12} /> Reply
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ))}
          {!expanded && feed.length > VISIBLE && (
            <button onClick={() => setExpanded(true)} style={{
              alignSelf: 'center', marginTop: 14, background: 'none', cursor: 'pointer',
              border: `1px solid ${th.border}`, borderRadius: 8, padding: '8px 18px',
              fontSize: 12.5, fontWeight: 700, color: th.textSec, fontFamily: 'system-ui,sans-serif',
            }}>
              Show all {feed.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
