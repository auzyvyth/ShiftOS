// Demo dealer for the DrevoOS preview picture: made-up cars, staff and leads (never real data).
const D = 'dealer-demo';
const day = 86400000, now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const models = [['Proton','X50',2023,109800],['Honda','City',2022,82800],['Toyota','Vios',2021,69800],['Perodua','Myvi',2022,49800],['Honda','Civic',2021,118800],['Mazda','CX-5',2020,99800],['Toyota','Corolla Cross',2022,119800],['Proton','Saga',2022,32800],['Perodua','Ativa',2023,64800],['Honda','HR-V',2023,129800],['Nissan','Almera',2021,59800],['Toyota','Hilux',2020,89800],['Proton','X70',2021,89800],['Perodua','Bezza',2022,38800],['Mazda','3',2021,99800],['Honda','Jazz',2019,52800],['Toyota','Yaris',2021,64800],['Proton','Persona',2022,39800]];
const reps = ['rep-1','rep-2','rep-3'];
const cars = [], units = [];
models.forEach(([brand, model, year, price], i) => {
  const id = 'car-' + i; const sold = i < 11;
  const soldAt = sold ? iso(now - (i * 2 + 1) * day) : null;
  const created = iso(now - (40 + i * 3) * day);
  cars.push({ id, brand, model, variant: null, year, status: sold ? 'sold' : 'available', assigned_to: reps[i % 3], selling_price: price, sold_price: sold ? price - 1000 : null, sold_at: soldAt, created_at: created, commission_amount: 800, included_services_cost: 300, engine_cc: 1500, warranty_months: 0, dealer_id: D });
  units.push({ id: 'u-' + i, listing_id: id, purchase_price: Math.round(price * 0.86), purchase_date: created.slice(0, 10), recon_cost: 1800, recon_actual: 1800, asking_price: price, sold_price: sold ? price - 1000 : null, sold_date: soldAt?.slice(0, 10) || null, status: sold ? 'sold' : 'in_stock', created_at: created, engine_cc: 1500, brand, model, year });
});
// a few sales last month too, so the comparison lines exist
for (let k = 0; k < 7; k++) { const [brand, model, year, price] = models[k]; const id = 'old-' + k; const soldAt = iso(now - (32 + k * 3) * day);
  cars.push({ id, brand, model, year, status: 'sold', assigned_to: reps[k % 3], selling_price: price, sold_price: price - 1500, sold_at: soldAt, created_at: iso(now - 80 * day), commission_amount: 800, included_services_cost: 300, engine_cc: 1500, dealer_id: D });
  units.push({ id: 'uo-' + k, listing_id: id, purchase_price: Math.round(price * 0.87), purchase_date: iso(now - 80 * day).slice(0, 10), recon_cost: 1800, recon_actual: 1800, asking_price: price, sold_price: price - 1500, sold_date: soldAt.slice(0, 10), status: 'sold', created_at: iso(now - 80 * day), brand, model, year }); }
const stages = ['new','contacted','test_drive','negotiating','deposit_taken','new','contacted','negotiating','won','lost'];
const sources = ['whatsapp','drevo_enquiry','walk_in','chat','referral'];
const leads = Array.from({ length: 46 }, (_, i) => ({ id: 'l-' + i, stage: stages[i % stages.length], lead_source: sources[i % 5], created_at: iso(now - (i % 20) * day - 3600000), updated_at: iso(now - (i % 4) * day), buyer_name: 'Buyer ' + i, salesman_id: reps[i % 3], first_response_at: iso(now - (i % 20) * day) }));
export const STUB = {
  car_listings: cars, stock_units: units, leads,
  profiles: [{ id: 'rep-1', full_name: 'Farid Zulkifli', role: 'salesman' }, { id: 'rep-2', full_name: 'Aina Sofea', role: 'salesman' }, { id: 'rep-3', full_name: 'Daniel Tan', role: 'salesman' }, { id: 'mgr', full_name: 'Siti Rahman', role: 'manager' }],
  appointments: [{ id: 'a1', appointment_date: iso(now + 3600000) }, { id: 'a2', appointment_date: iso(now + 7200000) }, { id: 'a3', appointment_date: iso(now + 10800000) }],
  lead_activities: [], deal_price_approvals: [], ad_spend: [], post_sale_tasks: [], deal_products: cars.filter((c) => c.status === 'sold').slice(0, 8).flatMap((c, k) => [{ listing_id: c.id, sold_price: 1800, dealer_products: { name: 'Tint', category: 'tint', cost_price: 650 } }, ...(k % 2 ? [{ listing_id: c.id, sold_price: 2200, dealer_products: { name: 'Warranty 1yr', category: 'warranty', cost_price: 900 } }] : [])]), dealer_cost_settings: [{ monthly_overhead: 18000 }],
  rpc: { get_team_activity: reps.map((r) => ({ user_id: r, last_active_at: iso(now - 3600000) })), gm_exception_alerts: {}, dealer_my_brokers: [] },
};
