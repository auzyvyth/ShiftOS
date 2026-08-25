import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Prepaid service packages + the visits burned against them, owned in ONE place.
//
// The dealer Customers tab and the Salesman Premium one each carried their own
// near-identical copy of add-package / log-visit. A visit is a dated row now
// (service_visits) rather than an integer someone increments, so duplicating
// that logic a second time was not an option — both pages use this hook.
//
// used_visits still exists on service_packages as a cached count, kept in step
// by the DB trigger trg_sync_package_used_visits. Read it freely; never write it
// from the client, or it will drift from the rows that are the real record.

export function useServicePackages(dealerId, customerIds) {
  const [packages, setPackages] = useState({}); // customer_id -> [package]
  const [visits, setVisits] = useState({});     // package_id  -> [visit] (newest first)
  const [products, setProducts] = useState([]); // the dealer's catalogue
  const [loading, setLoading] = useState(false);

  const key = (customerIds || []).join(',');

  const load = useCallback(async () => {
    const ids = (customerIds || []).filter(Boolean);
    if (!dealerId || ids.length === 0) { setPackages({}); setVisits({}); return; }
    setLoading(true);

    const [{ data: pkgs }, { data: prods }] = await Promise.all([
      supabase.from('service_packages').select('*').in('customer_id', ids)
        .order('created_at', { ascending: false }),
      // The catalogue a package is picked FROM. Same table the deal add-on
      // picker reads, so a package and an add-on mean the same thing.
      supabase.from('dealer_products').select('id, name, category, selling_price, is_active')
        .eq('dealer_id', dealerId).eq('is_active', true).order('name'),
    ]);

    const pm = {};
    for (const p of pkgs || []) (pm[p.customer_id] = pm[p.customer_id] || []).push(p);
    setPackages(pm);
    setProducts(prods || []);

    const pkgIds = (pkgs || []).map((p) => p.id);
    if (pkgIds.length > 0) {
      const { data: vs } = await supabase.from('service_visits').select('*')
        .in('package_id', pkgIds).order('visited_on', { ascending: false });
      const vm = {};
      for (const v of vs || []) (vm[v.package_id] = vm[v.package_id] || []).push(v);
      setVisits(vm);
    } else {
      setVisits({});
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId, key]);

  useEffect(() => { load(); }, [load]);

  const addPackage = useCallback(async (customer, form) => {
    const product = (form.product_id || '').startsWith('custom') ? null : form.product_id || null;
    const row = {
      dealer_id: dealerId,
      customer_id: customer.id,
      lead_id: customer.lead_id || null,
      listing_id: customer.listing_id || null,
      product_id: product,
      // A snapshot: the catalogue entry can be renamed or deactivated later and
      // the sold package should still say what was actually sold.
      package_name: form.package_name,
      total_visits: Number(form.total_visits) || 3,
      valid_months: Number(form.valid_months) || 12,
      sold_price: form.sold_price === '' || form.sold_price == null ? null : Number(form.sold_price),
      sold_at: new Date().toISOString().slice(0, 10),
    };
    const { data, error } = await supabase.from('service_packages').insert(row).select().single();
    if (error || !data) return { error };
    setPackages((p) => ({ ...p, [customer.id]: [data, ...(p[customer.id] || [])] }));
    return { data };
  }, [dealerId]);

  // A visit is a row: it has a date, it can carry a note, and it can be undone.
  const logVisit = useCallback(async (pkg, { visited_on, notes } = {}) => {
    if (pkg.used_visits >= pkg.total_visits) return { error: 'Package fully used' };
    const row = {
      dealer_id: pkg.dealer_id,
      package_id: pkg.id,
      customer_id: pkg.customer_id,
      visited_on: visited_on || new Date().toISOString().slice(0, 10),
      notes: notes || null,
    };
    const { data, error } = await supabase.from('service_visits').insert(row).select().single();
    if (error || !data) return { error };
    setVisits((v) => ({ ...v, [pkg.id]: [data, ...(v[pkg.id] || [])] }));
    // The trigger recomputes used_visits server-side; mirror it locally so the
    // bar moves without a refetch.
    setPackages((p) => ({
      ...p,
      [pkg.customer_id]: (p[pkg.customer_id] || []).map((x) =>
        x.id === pkg.id ? { ...x, used_visits: x.used_visits + 1 } : x),
    }));
    return { data };
  }, []);

  const undoVisit = useCallback(async (visit) => {
    const { error } = await supabase.from('service_visits').delete().eq('id', visit.id);
    if (error) return { error };
    setVisits((v) => ({ ...v, [visit.package_id]: (v[visit.package_id] || []).filter((x) => x.id !== visit.id) }));
    setPackages((p) => ({
      ...p,
      [visit.customer_id]: (p[visit.customer_id] || []).map((x) =>
        x.id === visit.package_id ? { ...x, used_visits: Math.max(0, x.used_visits - 1) } : x),
    }));
    return {};
  }, []);

  return { packages, visits, products, loading, reload: load, addPackage, logVisit, undoVisit };
}

// Shared status read, so the dealer tab, the salesman tab and the "This week"
// call list all agree on what "expiring" means.
export function packageStatus(pkg, now = new Date()) {
  const left = Math.max(0, (pkg.total_visits || 0) - (pkg.used_visits || 0));
  const days = pkg.expires_at ? Math.round((new Date(pkg.expires_at) - now) / 86400000) : null;
  if (left === 0) return { key: 'used', label: 'Fully used', left, days };
  if (days !== null && days < 0) return { key: 'expired', label: `Expired · ${left} unused`, left, days };
  if (days !== null && days <= 60) return { key: 'expiring', label: `${days}d left · ${left} unused`, left, days };
  return { key: 'active', label: `${left} visit${left === 1 ? '' : 's'} left`, left, days };
}
