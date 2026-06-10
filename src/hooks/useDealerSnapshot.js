import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

async function fetchSnapshot(userId) {
  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const [listingsRes, enquiriesRes, appointmentsRes, stockRes, analyticsRes, activityRes] =
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
      supabase
        .from('stock_units')
        .select('id, purchase_price, recon_cost, sold_price, status, purchase_date')
        .eq('dealer_id', userId),
      supabase
        .from('analytics_events')
        .select('event_type, created_at')
        .eq('dealer_id', userId),
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
  const stock = stockRes.data || [];
  const events = analyticsRes.data || [];
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

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const soldUnits = stock.filter(u => u.status === 'sold');
  const totalSold = soldUnits.length;

  const totalGPThisMonth = soldUnits
    .filter(u => u.purchase_date && new Date(u.purchase_date) >= thisMonthStart)
    .reduce(
      (sum, u) =>
        sum + ((u.sold_price || 0) - (u.purchase_price || 0) - (u.recon_cost || 0)),
      0,
    );

  const totalStockValue = stock
    .filter(u => u.status !== 'sold')
    .reduce((sum, u) => sum + (u.purchase_price || 0), 0);

  const sevenDaysAgo = now - 7 * 86400000;
  const topEvents = events.filter(
    e => e.event_type === 'whatsapp_click' && new Date(e.created_at) >= sevenDaysAgo,
  ).length;

  return {
    activeListings,
    avgDaysOnLot,
    staleCars,
    enquiries: enquiryStats,
    coldEnquiries,
    appointmentsToday,
    totalSold,
    totalGPThisMonth,
    totalStockValue,
    topEvents,
    teamActivity,
  };
}

export function useDealerSnapshot(userId) {
  const { data: snapshot, isLoading: loading } = useQuery({
    queryKey: ['dealer-snapshot', userId],
    queryFn: () => fetchSnapshot(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return { snapshot: snapshot ?? null, loading };
}
