// api/shell.js puts the newest cars into the page as a JSON data block
// (id="xd-seed"). Copy them into the device's saved live-cars slot before the
// app renders: MarketplacePage and CarListingPage already paint that slot on
// their first render, so a first visit shows cars instead of skeletons. Their
// own fetch still runs and replaces them, so nothing here decides what is true.
import { LIVE_CARS_CACHE_KEY } from '../config/marketplaceConfig.js';
import { writeCache } from './localCache.js';

export function adoptServerSeed() {
  try {
    const el = document.getElementById('xd-seed');
    if (!el) return;
    const seed = JSON.parse(el.textContent);
    el.remove();
    if (seed?.v !== 1 || !Array.isArray(seed.cars) || !seed.cars.length) return;
    writeCache(LIVE_CARS_CACHE_KEY, { cars: seed.cars, totalCount: seed.totalCount || seed.cars.length });
  } catch {
    // A malformed block just means no head start.
  }
}
