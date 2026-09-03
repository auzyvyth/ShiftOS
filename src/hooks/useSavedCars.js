import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

const LS_KEY = 'xdrive_saved_cars';
const CARD_COLS = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,condition,images,status,created_at,dealer_id,seller_role,dealer_is_verified,seller_sold_count,auction_grade,interior_grade,is_recon,financing_type,engine_cc,previous_owners';

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

async function fetchSavedIds() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id ?? null;

  if (!uid) return { userId: null, ids: readLocalIds() };

  const localIds = readLocalIds();
  if (localIds.length > 0) {
    const rows = localIds.map((listing_id) => ({ user_id: uid, listing_id }));
    await supabase.from('saved_cars').upsert(rows, { ignoreDuplicates: true });
    localStorage.removeItem(LS_KEY);
  }

  const { data: rows } = await supabase.from('saved_cars').select('listing_id').eq('user_id', uid);
  return { userId: uid, ids: (rows || []).map((r) => r.listing_id) };
}

// Shared across every consumer (AccountPage, SavedCarsPanel, SavedCarsPage) via
// the react-query cache, so opening the panel after the page already loaded
// the same ids is instant instead of re-running getSession + saved_cars + the
// car detail fetch from scratch each time.
export function useSavedCars() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['saved-car-ids'],
    queryFn: fetchSavedIds,
    staleTime: 60 * 1000,
  });

  const userId = data?.userId ?? null;
  const savedIds = new Set(data?.ids ?? []);

  const isSaved = useCallback((listingId) => savedIds.has(listingId), [savedIds]);

  const toggleSave = useCallback(
    async (listingId) => {
      const already = savedIds.has(listingId);
      const nextIds = already
        ? [...savedIds].filter((id) => id !== listingId)
        : [...savedIds, listingId];

      queryClient.setQueryData(['saved-car-ids'], (prev) => ({
        userId: prev?.userId ?? null,
        ids: nextIds,
      }));

      if (userId) {
        if (already) {
          await supabase.from('saved_cars').delete().eq('user_id', userId).eq('listing_id', listingId);
        } else {
          await supabase.from('saved_cars').insert({ user_id: userId, listing_id: listingId });
        }
      } else {
        writeLocalIds(nextIds);
      }
    },
    [savedIds, userId, queryClient],
  );

  return { savedIds, isSaved, toggleSave, ready: !isLoading };
}

// Full car objects for a set of saved ids, in saved order — cached by id set so
// AccountPage / SavedCarsPanel / SavedCarsPage share one fetch instead of three.
export function useSavedCarsDetails(savedIds, ready) {
  const ids = [...savedIds].sort();
  const { data, isLoading } = useQuery({
    queryKey: ['saved-cars-details', ids.join(',')],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await supabase.from('public_car_listings').select(CARD_COLS).in('id', ids);
      const map = Object.fromEntries((data || []).map((c) => [c.id, c]));
      return ids.map((id) => map[id]).filter(Boolean);
    },
    enabled: ready,
    staleTime: 2 * 60 * 1000,
  });

  return { cars: data ?? [], loading: ready && isLoading };
}
