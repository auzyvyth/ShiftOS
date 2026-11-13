import { useCachedFetch } from './useCachedFetch';
import { supabase } from '../supabaseClient';

async function fetchSnapshot(userId) {
  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const [listingsRes, enquiriesRes, appointmentsRes, analyticsRes, activityRes] =
    await Promise.all([
      supabase
        .from('car_listings')
        .select('id, brand, model, year, selling_price, status, created_at')
        .eq('dealer_id', userId),
      supabase
        .from('whatsapp_enquiries')
        .select('id, status, created_at')
        .eq('dealer_id', userId),
      supabase
        .from('appointments')
        .select('id, appointment_date, status')
        .eq('dealer_id', userId),
      // Only the number the briefing uses (WhatsApp taps, last 7 days). It read every event the
      // dealer ever had, on every dashboard open, and stopped counting at the 1,000-row cap.
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', userId)
        .eq('event_type', 'whatsapp_click')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabase
        .from('activity_log')
        .select('actor_id, actor_name, actor_role, summary, action, table_name, created_at')
        .eq('dealer_id', userId)
        .gte('created_at', yesterdayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

  const listings = listingsRes.data || [];
  const enquiries = enquiriesRes.data || [];
  const appointments = appointmentsRes.data || [];
  const activity = activityRes.data || [];

  const teamActivityMap = new Map();
  for (const row of activity) {
    if (!row.actor_id || row.actor_role === 'dealer' || row.actor_role === 'owner') continue;
    const key = row.actor_id;
    if (!teamActivityMap.has(key)) {
      teamActivityMap.set(key, {
        name: row.actor_name || 'Unknown',
        role: row.actor_role || 'unknown',
        count: 0,
        highlights: [],
      });
    }
    const entry = teamActivityMap.get(key);
    entry.count++;
    if (row.summary && entry.highlights.length < 4 && !entry.highlights.includes(row.summary)) {
      entry.highlights.push(row.summary);
    }
  }
  const teamActivity = Array.from(teamActivityMap.values()).sort((a, b) => b.count - a.count);

  const now = Date.now();
  const active = listings.filter(c => c.status === 'available');

  const activeListings = active.length;

  const avgDaysOnLot = active.length
    ? Math.round(
        active.reduce((sum, c) => sum + (now - new Date(c.created_at)) / 86400000, 0) /
          active.length,
      )
    : 0;

  const staleCars = active
    .filter(c => (now - new Date(c.created_at)) / 86400000 > 30)
    .map(c => ({
      model: `${c.brand} ${c.model}`,
      days: Math.floor((now - new Date(c.created_at)) / 86400000),
      price: c.selling_price,
    }));

  const enquiryStats = { new: 0, responded: 0, qualified: 0, converted: 0 };
  for (const e of enquiries) {
    if (e.status in enquiryStats) enquiryStats[e.status]++;
  }

  const cutoff48h = now - 48 * 3600000;
  const coldEnquiries = enquiries.filter(
    e => e.status === 'new' && new Date(e.created_at) < cutoff48h,
  ).length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const appointmentsToday = appointments.filter(
    a => a.appointment_date && a.appointment_date.slice(0, 10) === todayStr,
  ).length;

  // WhatsApp taps in the last 7 days (counted in the database, see the query).
  const topEvents = analyticsRes.count ?? 0;

  return {
    activeListings,
    avgDaysOnLot,
    staleCars,
    enquiries: enquiryStats,
    coldEnquiries,
    appointmentsToday,
    topEvents,
    teamActivity,
  };
}

// Backed by useCachedFetch (localStorage) rather than react-query. react-query
// holds its cache in memory only — there is no persister wired up — so the
// snapshot died with the tab and every PWA cold start re-ran all six queries
// against an empty cache before the Overview tab could show a number.
//
// ttlMs: 0 makes this pure stale-while-revalidate: the cached snapshot paints
// immediately on every visit AND a fresh fetch always runs behind it. Anything
// higher would leave the dealer looking at this morning's numbers all day —
// useCachedFetch's default is a full day, which is right for a report and wrong
// for a dashboard.
//
// Money is NOT here: the AI tab adds it from useCarMoney (the one engine), because this hook's own
// "GP this month" picked cars by PURCHASE date and counted a car with no buy price as pure profit.
// `enabled`: the AI tab only. It used to run its reads on every dashboard open, on every tab.
export function useDealerSnapshot(userId, { enabled = true } = {}) {
  const { data: snapshot, loading } = useCachedFetch(
    userId ? `snapshot:v2:${userId}` : null,
    () => fetchSnapshot(userId),
    { enabled: !!userId && enabled, ttlMs: 0 },
  );

  return { snapshot: snapshot ?? null, loading };
}
