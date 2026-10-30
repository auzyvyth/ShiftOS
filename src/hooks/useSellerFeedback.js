import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { usePersistentState } from './usePersistentState';

// What buyers said about a seller and their cars: questions on the car pages,
// reviews of the seller, and how many buyers saved each car (FEEDBACK-1).
// One instance per page (Lite, Premium): the page reads `unanswered` for the
// nav badge and hands the same object to SellerFeedbackTab.
//
// Questions + reviews are publicly readable (status = 'visible'), so they are
// plain reads. Likes come from get_my_car_likes(): saved_cars is owner-only
// RLS, and the seller gets COUNTS, never who saved a car.
const EMPTY = { questions: [], reviews: [], likes: [] };

export function useSellerFeedback(userId, listingIds) {
  const idsKey = useMemo(() => [...(listingIds || [])].sort().join(','), [listingIds]);
  const [data, setData, cached] = usePersistentState(userId ? `feedback:${userId}` : null, EMPTY);
  const [fetching, setFetching] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setFetching(true);
    const ids = idsKey ? idsKey.split(',') : [];
    const [q, r, l] = await Promise.all([
      ids.length
        ? supabase.from('listing_comments')
            .select('id, listing_id, author_id, author_name, body, parent_id, created_at')
            .in('listing_id', ids).eq('status', 'visible')
            .order('created_at', { ascending: false }).limit(300)
        : Promise.resolve({ data: [] }),
      supabase.from('reviews')
        .select('id, listing_id, reviewer_name, rating, body, created_at')
        .eq('dealer_id', userId).eq('status', 'visible')
        .order('created_at', { ascending: false }).limit(200),
      supabase.rpc('get_my_car_likes'),
    ]);
    // A failed read keeps what the device already showed (never paint [] over it).
    setData((prev) => ({
      questions: q.error ? prev.questions : (q.data || []),
      reviews: r.error ? prev.reviews : (r.data || []),
      likes: l.error ? prev.likes : (l.data || []),
    }));
    setFetching(false);
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
    loading: fetching && !cached, refresh, reply,
  };
}
