import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { readCache, writeCache } from '../utils/panelCache';
import { isRealBuyer, sendBuyerToSignIn } from '../lib/buyerAuth';
import { isSubdomain } from './useTenant';

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
  // A guest's anonymous session is not an account: their saves stay on the
  // device until they really sign in, then merge below.
  const user = data.session?.user;
  const uid = isRealBuyer(user) ? user.id : null;

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

      // Saving needs an account on the marketplace (owner, 2026-10-14, the
      // Mudah model). The id is parked in the device list first, and
      // fetchSavedIds merges that list into saved_cars on the first load after
      // sign-in, so the car is saved by the time the buyer is back. Removing
      // never needs an account. A dealer subdomain keeps device-only saves:
      // sign-in lives on xdrive.my and its session cannot reach <sub>.xdrive.my.
      // userId is null until the first load lands, so a tap before then reads
      // the session live rather than sending a signed-in buyer to sign in.
      let uid = userId;
      if (!uid) {
        const { data: s } = await supabase.auth.getSession();
        if (isRealBuyer(s.session?.user)) uid = s.session.user.id;
      }
      if (!uid && !already && !isSubdomain()) {
        writeLocalIds(nextIds);
        sendBuyerToSignIn();
        return;
      }

      if (uid) {
        if (already) {
          await supabase.from('saved_cars').delete().eq('user_id', uid).eq('listing_id', listingId);
        } else {
          await supabase.from('saved_cars').insert({ user_id: uid, listing_id: listingId });
        }
      } else {
        writeLocalIds(nextIds);
      }
    },
    [savedIds, userId, queryClient],
  );

  return { savedIds, isSaved, toggleSave, ready: !isLoading };
}

// Saved-car rows survive a cold start in localStorage as well as in react-query.
// react-query's cache is in-memory only (no persister is wired up), so a buyer
// who reopened the PWA got an empty Saved list and a spinner every single time,
// even though the ids were already on the device. `sig` pins the cache to the
// exact id set it was fetched for, so a save/unsave can never paint a stale grid.
const DETAILS_CACHE_KEY = 'savedcars:details';
const DETAILS_TTL = 24 * 60 * 60 * 1000;

function readDetailsCache(sig) {
  const hit = readCache(DETAILS_CACHE_KEY, DETAILS_TTL);
  return hit && hit.sig === sig ? hit.cars : null;
}

// Full car objects for a set of saved ids, in saved order — cached by id set so
// AccountPage / SavedCarsPanel / SavedCarsPage share one fetch instead of three.
export function useSavedCarsDetails(savedIds, ready) {
  const ids = [...savedIds].sort();
  const sig = ids.join(',');
  const { data, isLoading } = useQuery({
    queryKey: ['saved-cars-details', sig],
    queryFn: async () => {
      if (!ids.length) {
        writeCache(DETAILS_CACHE_KEY, { sig, cars: [] });
        return [];
      }
      const { data } = await supabase.from('public_car_listings').select(CARD_COLS).in('id', ids);
      const map = Object.fromEntries((data || []).map((c) => [c.id, c]));
      const cars = ids.map((id) => map[id]).filter(Boolean);
      writeCache(DETAILS_CACHE_KEY, { sig, cars });
      return cars;
    },
    enabled: ready,
    staleTime: 2 * 60 * 1000,
    // Paints last visit's rows on the first frame while the fetch above runs.
    // placeholderData (not initialData) so react-query still treats the query as
    // needing a fetch — the grid is never left showing only cached rows.
    placeholderData: () => readDetailsCache(sig) ?? undefined,
  });

  return { cars: data ?? [], loading: ready && isLoading && !data };
}
