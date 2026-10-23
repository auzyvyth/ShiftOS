import { useMemo, useSyncExternalStore } from 'react';
import { progressSnapshot, subscribeProgress } from '../utils/viewProgress';

// Every car the buyer has opened on this device, newest first, plus a lookup
// by id. One shared parse for every card on the page (src/utils/viewProgress.js).
export function useViewProgress() {
  const list = useSyncExternalStore(subscribeProgress, progressSnapshot, () => []);
  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
  return { list, byId };
}
