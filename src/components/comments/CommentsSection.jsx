import React, { useState, useEffect, useCallback } from 'react';
import { LogIn, Trash2, Send, MessageSquare, CornerDownRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { markBuyerIntent } from '../../lib/buyerAuth';

// CDP-COMMENTS: public Q&A on a listing. Reading is open to everyone; posting
// requires sign-in (authenticated-only, so there is no anonymous spam surface
// and no CAPTCHA is needed yet). A reply from the listing's dealer account gets
// a "Seller" badge, derived from the author id — not a client-set flag, so it
// can't be spoofed. Empty state is honest, never a fabricated placeholder.

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

export default function CommentsSection({ dealerId, listingId, sellerName = 'the seller', th }) {
  const [session, setSession] = useState(null);
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fetchComments = useCallback(async () => {
    if (!listingId) return;
    const { data } = await supabase
      .from('listing_comments')
      .select('id, author_id, author_name, body, parent_id, created_at')
      .eq('listing_id', listingId)
      .eq('status', 'visible')
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoaded(true);
  }, [listingId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const uid = session?.user?.id || null;
  const defaultName = () => {
    const meta = session?.user?.user_metadata || {};
    return meta.full_name || meta.name || (session?.user?.email || '').split('@')[0] || '';
  };

  const questions = comments.filter(c => !c.parent_id);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] = acc[c.parent_id] || []).push(c);
    return acc;
  }, {});

  const signIn = async () => {
    sessionStorage.setItem('post_auth_return', window.location.href);
    markBuyerIntent();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
  };

  const postQuestion = async () => {
    if (!uid || !body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('listing_comments').insert({
      listing_id: listingId,
      author_id: uid,
      author_name: (name.trim() || defaultName() || 'Buyer'),
      body: body.trim(),
    });
    setSaving(false);
    if (!error) { setBody(''); setAsking(false); fetchComments(); }
  };

  const postReply = async (questionId) => {
    if (!uid || !replyBody.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('listing_comments').insert({
      listing_id: listingId,
      author_id: uid,
      author_name: (defaultName() || 'User'),
      body: replyBody.trim(),
      parent_id: questionId,
    });
    setSaving(false);
    if (!error) { setReplyBody(''); setReplyTo(null); fetchComments(); }
  };

  const remove = async (id) => {
    await supabase.from('listing_comments').delete().eq('id', id);
    fetchComments();
  };

  if (!listingId) return null;

  const accent = '#dc2626';
  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
    border: 'none', fontFamily: 'system-ui,sans-serif',
  };
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: th.inputBg, border: `1px solid ${th.border}`,
    borderRadius: 9, color: th.text, fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'system-ui,sans-serif',
  };

  const SellerBadge = () => (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: accent, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 4, padding: '1px 5px' }}>Seller</span>
  );

  const CommentBody = ({ c, isReply }) => {
    const isSeller = dealerId && c.author_id === dealerId;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {isReply && <CornerDownRight size={13} style={{ color: th.textMuted, flexShrink: 0 }} />}
            <span style={{ fontSize: 13, fontWeight: 700, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isSeller ? sellerName : (c.author_name || 'User')}</span>
            {isSeller && <SellerBadge />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: th.textMuted }}>{fmtDate(c.created_at)}</span>
            {uid === c.author_id && (
              <button onClick={() => remove(c.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 2 }}><Trash2 size={13} /></button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 13, color: th.textSec, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{c.body}</p>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 32, paddingTop: 28, borderTop: `1px solid ${th.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, margin: 0 }}>
          Questions &amp; Answers{questions.length > 0 ? ` (${questions.length})` : ''}
        </p>
      </div>

      {/* Ask area */}
      {!asking ? (
        !uid ? (
          <button onClick={signIn} style={{ ...btnStyle, background: 'rgba(220,38,38,0.1)', color: accent, border: '1px solid rgba(220,38,38,0.25)' }}>
            <LogIn size={14} /> Sign in to ask a question
          </button>
        ) : (
          <button onClick={() => { setName(defaultName()); setAsking(true); }} style={{ ...btnStyle, background: accent, color: '#fff' }}>
            <MessageSquare size={14} /> Ask a question
          </button>
        )
      ) : (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: 12, padding: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ ...inputStyle, marginBottom: 10 }} />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            placeholder={`Ask ${sellerName} about this car — e.g. is the price negotiable, any accident history?`}
            style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAsking(false); setBody(''); }} style={{ ...btnStyle, background: 'none', color: th.textSec, border: `1px solid ${th.border}` }}>Cancel</button>
            <button onClick={postQuestion} disabled={!body.trim() || saving} style={{ ...btnStyle, background: body.trim() ? accent : 'rgba(148,163,184,0.3)', color: '#fff', cursor: body.trim() && !saving ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
              <Send size={13} /> {saving ? 'Posting…' : 'Post question'}
            </button>
          </div>
        </div>
      )}

      {/* Thread */}
      {loaded && questions.length === 0 && !asking && (
        <p style={{ fontSize: 13, color: th.textMuted, margin: '14px 0 0' }}>No questions yet. Be the first to ask {sellerName} about this car.</p>
      )}
      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
          {questions.map(q => (
            <div key={q.id} style={{ borderTop: `1px solid ${th.borderSec || th.border}`, paddingTop: 16 }}>
              <CommentBody c={q} isReply={false} />

              {/* Replies */}
              {(repliesByParent[q.id] || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, paddingLeft: 16 }}>
                  {repliesByParent[q.id].map(r => <CommentBody key={r.id} c={r} isReply />)}
                </div>
              )}

              {/* Reply action / editor */}
              <div style={{ marginTop: 10, paddingLeft: 16 }}>
                {replyTo === q.id ? (
                  <div>
                    <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={2}
                      placeholder="Write a reply…" style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setReplyTo(null); setReplyBody(''); }} style={{ ...btnStyle, padding: '7px 12px', fontSize: 12, background: 'none', color: th.textSec, border: `1px solid ${th.border}` }}>Cancel</button>
                      <button onClick={() => postReply(q.id)} disabled={!replyBody.trim() || saving} style={{ ...btnStyle, padding: '7px 12px', fontSize: 12, background: replyBody.trim() ? accent : 'rgba(148,163,184,0.3)', color: '#fff', cursor: replyBody.trim() && !saving ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
                        <Send size={12} /> {saving ? 'Posting…' : 'Reply'}
                      </button>
                    </div>
                  </div>
                ) : uid ? (
                  <button onClick={() => { setReplyTo(q.id); setReplyBody(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: th.textMuted, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'system-ui,sans-serif' }}>
                    <CornerDownRight size={12} /> Reply
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
