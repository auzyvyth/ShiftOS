import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const LS_KEY = 'xdrive_saved_cars';

function readLocalIds() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocalIds(ids) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
}

export function useSavedCars() {
  const [savedIds, setSavedIds] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        // Sync any guest saves to DB first
        const localIds = readLocalIds();
        if (localIds.length > 0) {
          const rows = localIds.map((listing_id) => ({ user_id: uid, listing_id }));
          await supabase.from('saved_cars').upsert(rows, { ignoreDuplicates: true });
          localStorage.removeItem(LS_KEY);
        }

        // Fetch all saved IDs from DB
        const { data: rows } = await supabase
          .from('saved_cars')
          .select('listing_id')
          .eq('user_id', uid);
        setSavedIds(new Set((rows || []).map((r) => r.listing_id)));
      } else {
        // Guest — read from localStorage
        setSavedIds(new Set(readLocalIds()));
      }

      setReady(true);
    });
  }, []);

  const isSaved = useCallback(
    (listingId) => savedIds.has(listingId),
    [savedIds],
  );

  const toggleSave = useCallback(
    async (listingId) => {
      const already = savedIds.has(listingId);

      // Optimistic update
      setSavedIds((prev) => {
        const next = new Set(prev);
        already ? next.delete(listingId) : next.add(listingId);
        return next;
      });

      if (userId) {
        if (already) {
          await supabase
            .from('saved_cars')
            .delete()
            .eq('user_id', userId)
            .eq('listing_id', listingId);
        } else {
          await supabase
            .from('saved_cars')
            .insert({ user_id: userId, listing_id: listingId });
        }
      } else {
        const ids = readLocalIds();
        const next = already
          ? ids.filter((id) => id !== listingId)
          : [...ids, listingId];
        writeLocalIds(next);
      }
    },
    [savedIds, userId],
  );

  return { savedIds, isSaved, toggleSave, ready };
}
