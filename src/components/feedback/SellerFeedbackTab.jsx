import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Heart, MessageSquare, ExternalLink } from 'lucide-react';
import { panel, premiumDark as PD } from '../../theme/tokens';
import { cdnImg } from '../../utils/img';

// The seller's Feedback tab (FEEDBACK-1): buyer questions on the car pages,
// reviews of the seller, and how many buyers saved each car. Rendered by
// Salesman Lite (theme "dark", the panel palette) and Salesman Premium
// (theme "premium", premiumDark). Data comes from useSellerFeedback, which the
// page owns so the nav badge and this tab read one copy.
//
// Questions are the one thing here a seller must act on, so they come first
// and unanswered ones float to the top with the reply box already open.
// Likes are counts only: who saved a car is never shown (PDPA, they never
// agreed to be contacted).

const THEMES = {
  premium: {
    card: PD.card, row: PD.raised, line: PD.line, text: PD.text, sec: PD.textSec, muted: PD.textMuted,
    accent: PD.accent, accentText: PD.accentText, onAccent: PD.onAccent, up: PD.up,
    radius: PD.radius.card, rowRadius: PD.radius.row, border: 'none', input: PD.raised,
  },
  dark: {
    card: panel.surface, row: panel.fill, line: panel.line, text: panel.text, sec: panel.textSec, muted: panel.textMuted,
    accent: panel.accent, accentText: panel.dangerText, onAccent: panel.onAccent, up: panel.successText,
    radius: 14, rowRadius: 10, border: `1px solid ${panel.border}`, input: panel.fillStrong,
  },
};

const carName = (c) => (c ? [c.year, c.brand, c.model].filter(Boolean).join(' ') : '');

function ago(iso, t) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return t('feedback.ago.min', { n: Math.max(1, Math.round(s / 60)) });
  if (s < 86400) return t('feedback.ago.hour', { n: Math.round(s / 3600) });
  return t('feedback.ago.day', { n: Math.round(s / 86400) });
}

function Thumb({ car, size = 44, th }) {
  const src = car?.images?.[0];
  return (
    <div style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', background: th.row, flexShrink: 0 }}>
      {src && <img src={cdnImg(src, 120, 60)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  );
}

function Stars({ n, th, size = 13 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} aria-label={`${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= n ? th.text : 'none'} color={i <= n ? th.text : th.muted} />
      ))}
    </span>
  );
}

function QuestionCard({ q, car, th, t, onReply, sellerName }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);
  // An answered question keeps its box folded: the job there is done.
  const [open, setOpen] = useState(!q.answered);
  const send = async () => {
    setSaving(true); setErr(false);
    const { error } = await onReply(q, text, sellerName);
    setSaving(false);
    if (error) setErr(true); else setText('');
  };
  return (
    <div style={{ background: th.card, border: th.border, borderRadius: th.radius, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <Thumb car={car} th={th} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {carName(car) || t('feedback.removedCar')}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: th.muted }}>
            {q.author_name || t('feedback.buyer')} · {ago(q.created_at, t)}
            {!q.answered && <span style={{ color: th.accentText, fontWeight: 600 }}> · {t('feedback.notAnswered')}</span>}
          </p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: th.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{q.body}</p>
      {q.replies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.replies.map((r) => (
            <div key={r.id} style={{ background: th.row, borderRadius: th.rowRadius, padding: '10px 12px' }}>
              <p style={{ margin: 0, fontSize: 12, color: th.muted }}>{r.author_name} · {ago(r.created_at, t)}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.5, color: th.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</p>
            </div>
          ))}
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: th.sec, fontFamily: 'inherit' }}>
          {t('feedback.replyMore')}
        </button>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          placeholder={t('feedback.replyPlaceholder')}
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical', background: th.input, color: th.text,
            border: 'none', borderRadius: th.rowRadius, padding: '10px 12px', fontSize: 16, lineHeight: 1.4,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: err ? th.accentText : th.muted }}>
            {err ? t('feedback.replyFailed') : t('feedback.replyPublic')}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {car?.slug && (
              <a href={`/showroom/${car.slug}`} target="_blank" rel="noreferrer"
                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: th.sec, textDecoration: 'none', padding: '9px 12px', borderRadius: th.rowRadius, background: th.row }}>
                <ExternalLink size={14} /> {t('feedback.viewCar')}
              </a>
            )}
            <button
              onClick={send}
              disabled={saving || !text.trim()}
              style={{
                fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: th.rowRadius, border: 'none',
                background: th.accent, color: th.onAccent, cursor: saving || !text.trim() ? 'default' : 'pointer',
                opacity: saving || !text.trim() ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              {saving ? t('feedback.sending') : t('feedback.send')}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default function SellerFeedbackTab({ feedback, listings = [], sellerName, theme = 'dark' }) {
  const { t } = useTranslation();
  const th = THEMES[theme] || THEMES.dark;
  const [view, setView] = useState('questions');
  const carById = useMemo(() => Object.fromEntries(listings.map((c) => [c.id, c])), [listings]);
  const { threads, reviews, likes, unanswered, loading, reply } = feedback;
  // Only the section on screen waits for its own read; the others may still be loading.
  const busy = !!loading?.[view];

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => (a.answered - b.answered) || (new Date(b.created_at) - new Date(a.created_at))),
    [threads],
  );
  const likeRows = useMemo(
    () => likes.filter((l) => carById[l.listing_id]).sort((a, b) => b.likes - a.likes),
    [likes, carById],
  );
  const totalLikes = likeRows.reduce((s, l) => s + l.likes, 0);
  const weekLikes = likeRows.reduce((s, l) => s + l.likes_7d, 0);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const pills = [
    { key: 'questions', label: t('feedback.tabs.questions'), count: unanswered || null, hot: unanswered > 0 },
    { key: 'reviews', label: t('feedback.tabs.reviews'), count: reviews.length || null },
    { key: 'likes', label: t('feedback.tabs.likes'), count: totalLikes || null },
  ];

  const empty = (icon, title, body) => (
    <div style={{ background: th.card, border: th.border, borderRadius: th.radius, padding: '32px 20px', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', color: th.muted, marginBottom: 10 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: th.text }}>{title}</p>
      <p style={{ margin: '6px auto 0', fontSize: 13, color: th.sec, maxWidth: 380, lineHeight: 1.5 }}>{body}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
      <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {pills.map((p) => {
          const on = view === p.key;
          return (
            <button
              key={p.key} role="tab" aria-selected={on} onClick={() => setView(p.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontFamily: 'inherit',
                padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: on ? th.text : th.row, color: on ? th.card : th.sec,
              }}
            >
              {p.label}
              {p.count != null && (
                <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: p.hot ? th.accentText : (on ? th.card : th.muted), fontWeight: 700 }}>
                  {p.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {busy && <p style={{ margin: 0, fontSize: 13, color: th.muted }}>{t('feedback.loading')}</p>}

      {!busy && view === 'questions' && (sortedThreads.length === 0
        ? empty(<MessageSquare size={22} />, t('feedback.empty.questionsTitle'), t('feedback.empty.questionsBody'))
        : sortedThreads.map((q) => (
          <QuestionCard key={q.id} q={q} car={carById[q.listing_id]} th={th} t={t} onReply={reply} sellerName={sellerName} />
        )))}

      {!busy && view === 'reviews' && (reviews.length === 0
        ? empty(<Star size={22} />, t('feedback.empty.reviewsTitle'), t('feedback.empty.reviewsBody'))
        : (
          <>
            <div style={{ background: th.card, border: th.border, borderRadius: th.radius, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: th.text, fontVariantNumeric: 'tabular-nums' }}>
                {reviews.length >= 3 ? avg.toFixed(1) : reviews.length}
              </span>
              <div>
                {reviews.length >= 3 && <Stars n={Math.round(avg)} th={th} size={15} />}
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: th.sec }}>
                  {reviews.length >= 3 ? t('feedback.reviewCount', { count: reviews.length }) : t('feedback.reviewFew', { count: reviews.length })}
                </p>
              </div>
            </div>
            {reviews.map((r) => (
              <div key={r.id} style={{ background: th.card, border: th.border, borderRadius: th.radius, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <Stars n={r.rating} th={th} />
                  <span style={{ fontSize: 12, color: th.muted }}>{r.reviewer_name || t('feedback.buyer')} · {ago(r.created_at, t)}</span>
                </div>
                {r.body && <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: th.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</p>}
                {carById[r.listing_id] && <p style={{ margin: '8px 0 0', fontSize: 12, color: th.muted }}>{carName(carById[r.listing_id])}</p>}
              </div>
            ))}
          </>
        ))}

      {!busy && view === 'likes' && (likeRows.length === 0
        ? empty(<Heart size={22} />, t('feedback.empty.likesTitle'), t('feedback.empty.likesBody'))
        : (
          <>
            <div style={{ background: th.card, border: th.border, borderRadius: th.radius, padding: 16 }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: th.text, fontVariantNumeric: 'tabular-nums' }}>{totalLikes}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: th.sec }}>
                {t('feedback.likesTotal', { count: totalLikes })}
                {weekLikes > 0 && <span style={{ color: th.up }}> · {t('feedback.likesWeek', { count: weekLikes })}</span>}
              </p>
            </div>
            <div style={{ background: th.card, border: th.border, borderRadius: th.radius, padding: 8 }}>
              {likeRows.map((l, i) => {
                const car = carById[l.listing_id];
                return (
                  <div key={l.listing_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderTop: i ? `1px solid ${th.line}` : 'none' }}>
                    <Thumb car={car} size={40} th={th} />
                    <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{carName(car)}</p>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: th.text, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Heart size={13} /> {l.likes}
                      </p>
                      {l.likes_7d > 0 && <p style={{ margin: 0, fontSize: 11.5, color: th.up }}>{t('feedback.likesWeekShort', { count: l.likes_7d })}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: th.muted, lineHeight: 1.5 }}>{t('feedback.likesNote')}</p>
          </>
        ))}
    </div>
  );
}
