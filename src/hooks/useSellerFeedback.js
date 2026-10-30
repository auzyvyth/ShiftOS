import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { usePersistentState } from './usePersistentState';
import { withTimeout } from '../config/marketplaceConfig';

// What buyers said about a seller and their cars: questions on the car pages,
// reviews of the seller, and how many buyers saved each car (FEEDBACK-1).
// One instance per page (Lite, Premium): the page reads `unanswered` for the
// nav badge and hands the same object to SellerFeedbackTab.
//
// Questions + reviews are publicly readable (status = 'visible'), so they are
// plain reads. Likes come from get_my_car_likes(): saved_cars is owner-only
// RLS, and the seller gets COUNTS, never who saved a car.
const EMPTY = { questions: [], reviews: [], likes: [] };
// A stalled API hangs a request rather than failing it (36-45s seen on
// 2026-10-30), so each read gives up after this and the tab shows what it has.
const READ_TIMEOUT = 10000;

export function useSellerFeedback(userId, listingIds) {
  const idsKey = useMemo(() => [...(listingIds || [])].sort().join(','), [listingIds]);
  const [data, setData, cached] = usePersistentState(userId ? `feedback:${userId}` : null, EMPTY);
  // Which sections have had an answer (or given up) at least once. Each section
  // paints the moment its OWN read lands: waiting on all three made the tab as
  // slow as the slowest request, and the likes call is the slow one.
  const [settled, setSettled] = useState({ questions: false, reviews: false, likes: false });

  const refresh = useCallback(async () => {
    if (!userId) return;
    const ids = idsKey ? idsKey.split(',') : [];
    const load = async (part, query) => {
      try {
        const { data: rows, error } = await withTimeout(query, READ_TIMEOUT);
        // A failed read keeps what the device already showed (never paint [] over it).
        if (!error) setData((prev) => ({ ...prev, [part]: rows || [] }));
      } catch { /* timed out: keep the saved copy */ }
      setSettled((prev) => (prev[part] ? prev : { ...prev, [part]: true }));
    };
    await Promise.all([
      ids.length
        ? load('questions', supabase.from('listing_comments')
            .select('id, listing_id, author_id, author_name, body, parent_id, created_at')
            .in('listing_id', ids).eq('status', 'visible')
            .order('created_at', { ascending: false }).limit(300))
        : load('questions', Promise.resolve({ data: [] })),
      load('reviews', supabase.from('reviews')
        .select('id, listing_id, reviewer_name, rating, body, created_at')
        .eq('dealer_id', userId).eq('status', 'visible')
        .order('created_at', { ascending: false }).limit(200)),
      load('likes', supabase.rpc('get_my_car_likes')),
    ]);
  }, [userId, idsKey, setData]);

  useEffect(() => { refresh(); }, [refresh]);

  // Top-level questions from buyers, each with its replies. "Answered" means
  // the seller has replied under it; a buyer replying to themselves is not it.
  const threads = useMemo(() => {
    const replies = {};
    for (const c of data.questions) if (c.parent_id) (replies[c.parent_id] = replies[c.parent_id] || []).push(c);
    return data.questions
      .filter((c) => !c.parent_id && c.author_id !== userId)
      .map((c) => {
        const rs = (replies[c.id] || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return { ...c, replies: rs, answered: rs.some((x) => x.author_id === userId) };
      });
  }, [data.questions, userId]);

  const unanswered = threads.filter((t) => !t.answered).length;

  const reply = useCallback(async (question, body, authorName) => {
    const text = body.trim();
    if (!text || !userId) return { error: 'empty' };
    const { error } = await supabase.from('listing_comments').insert({
      listing_id: question.listing_id, author_id: userId,
      author_name: authorName || 'Seller', body: text, parent_id: question.id,
    });
    if (!error) await refresh();
    return { error };
  }, [userId, refresh]);

  return {
    threads, reviews: data.reviews, likes: data.likes, unanswered,
    // Per section: only while it has never answered AND the device has no copy.
    loading: {
      questions: !cached && !settled.questions,
      reviews: !cached && !settled.reviews,
      likes: !cached && !settled.likes,
    },
    refresh, reply,
  };
}
