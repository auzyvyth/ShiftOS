import React, { useEffect, useState, useRef } from "react";
import { useModalHistory } from "../../hooks/useModalHistory";
import { cdnImg } from "../../utils/img";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { logActivity } from "../../utils/activityLog";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { usePermissions } from "../../hooks/usePermissions";
import { Sparkline } from "./widgets";
import MarkSoldModal from "./MarkSoldModal";
import PhoneInput from "../../components/ui/PhoneInput";
import AppraisalChecklist from "../../components/AppraisalChecklist";
import { color, border, font, premiumLight } from "../../theme/tokens";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useCarMoney } from "../../hooks/useCarMoney";
import { plPill } from "../../theme/plStatus";
import { StatusPills, InvTile, AddCarButton, NeedsAttentionMenu, INV_CARD, INV_INPUT, INV_GHOST_BTN } from "../../components/inventory/InventoryUi";
import { Car, Trash2, X, TrendingUp, Clock, ChevronRight, CheckCircle2, Phone, Search, Save, Lock, Facebook, AlertTriangle, Banknote, Wrench, Upload } from "lucide-react";
import { loadBrokerCommission, brokerAmount } from "../../lib/brokerCommission";
import { carPnl, daysHeld, AGEING_DAYS } from "../../utils/carPnl";
const CarForm = React.lazy(() => import("../../components/CarForm"));

function bucketGPByMonth(units, months = 6) {
  const result = Array(months).fill(0);
  const now = new Date();
  units.forEach(u => {
    // stock_units use sold_date (there is no sold_at on stock_units)
    if (!u.sold_date || !u.sold_price) return;
    const d = new Date(u.sold_date);
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < months) {
      const gp = (u.sold_price || 0) - (u.purchase_price || 0) - (u.recon_cost || 0);
      result[months - 1 - monthsAgo] += gp;
    }
  });
  return result;
}

const STOCK_FILTER_CHIPS = [
  { key: 'missing_b7',  label: 'Missing B7' },
  { key: 'missing_b5',  label: 'Missing B5' },
  { key: 'no_plate',    label: 'No plate' },
  { key: 'no_vin',      label: 'No VIN' },
  { key: 'unpublished', label: 'Unpublished' },
  { key: 'under_hp',    label: 'Under HP' },
  { key: 'enc_unknown', label: 'Enc. unknown' },
  { key: 'aging',       label: 'Aging 60d+' },
  { key: 'loss',        label: 'In loss' },
];
const STOCK_SORT_OPTIONS = [
  { value: 'recent',      label: 'Newest' },
  { value: 'price_desc',  label: 'Price high→low' },
  { value: 'price_asc',   label: 'Price low→high' },
  { value: 'year_desc',   label: 'Year newest' },
  { value: 'year_asc',    label: 'Year oldest' },
  { value: 'profit_desc', label: 'Profit high→low' },
  { value: 'profit_asc',  label: 'Profit low→high' },
  { value: 'days_desc',   label: 'Longest in stock' },
];

// Shared stock P&L math — used by StockTab.netProfit AND the compact stats strip on
// the Listings tab, so both show the same figure as the per-unit P&L modal.
function stockCostBasis(u) {
  if (Number(u.purchase_price) > 0) return Number(u.purchase_price);
  return Number(u.car_listings?.base_price) || 0;
}
// Split version — returns the vehicle-only front gross and the F&I add-on net
// (back gross) separately, so callers that need to show them as distinct
// figures (e.g. "Car GP" vs "Add-on GP") don't have to duplicate this math.
// stockNetProfit() below is just front + addonNet for callers that only want
// one combined number (row badges, loss filter).
function stockNetProfitParts(u, ctx = {}) {
  const { ads = {}, handover = {}, addRev = {}, addCost = {}, broker = {} } = ctx;
  // `cfg` is null until dealer_cost_settings answers, and the cars paint first from the
  // device copy, so a default of {} (undefined only) was not enough: Stock crashed on reopen.
  const cfg = ctx.cfg || {};
  const cost = stockCostBasis(u);
  const c = u.car_listings || {};
  const isSold = u.status === 'sold';
  const revenue = isSold ? (Number(u.sold_price) || 0) : (Number(u.asking_price) || Number(c.selling_price) || 0);
  if (revenue === 0 && cost === 0) return null;
  if (isSold && !u.sold_price && cost === 0) return null;
  // The ONE profit engine (src/utils/carPnl.js); recon jobs are not loaded per row, so the
  // estimate stands in (effectiveRecon never goes below it).
  const p = carPnl({
    purchase: cost, reconEstimate: u.recon_cost, servicesCost: c.included_services_cost,
    commission: c.commission_amount, brokerCommission: broker[u.listing_id] || 0, adSpend: ads[u.id] || 0,
    handoverCost: handover[u.listing_id] ?? null,
    asking: Number(u.asking_price) || Number(c.selling_price) || 0, soldPrice: u.sold_price, isSold,
    startDate: u.purchase_date || u.created_at, soldDate: u.sold_date,
    engineCc: u.engine_cc || c.engine_cc, warrantyMonths: c.warranty_months, cfg,
  });
  const front = p.front;
  const aR = addRev[u.listing_id] || 0;
  const aC = addCost[u.listing_id] || 0;
  return { front, addonRevenue: aR, addonCost: aC, addonNet: aR - aC };
}
function stockNetProfit(u, ctx = {}) {
  const parts = stockNetProfitParts(u, ctx);
  return parts == null ? null : parts.front + parts.addonNet;
}

// The four tiles over Stock & costs. Every figure is the SAME sum Overview and Revenue show
// (useCarMoney -> ownerMoney -> carPnl): "Profit this month" used to be its own sum over
// stock_units, which counted a sold car with no buy price as pure profit and went by the stock
// record's sold date, and the day counts read the stale stored days_in_stock (wrong for most cars).
export function StockStatsStrip({ dealerId, canSeeProfit = true }) {
  const { money: m } = useCarMoney(dealerId);
  const rm = (n) => 'RM ' + Math.round(Number(n || 0)).toLocaleString('en-MY');
  const mo = m?.month;
  const items = m ? [
    { label: 'Stock value', val: rm(m.stock.asking), sub: 'Asking prices, unsold cars' },
    { label: 'Avg days in stock', val: m.stock.avgDays == null ? '-' : String(m.stock.avgDays) },
    { label: 'Over 60 days', val: String(m.stock.over60), tone: m.stock.over60 > 0 ? 'bad' : undefined, sub: m.stock.over60 > 0 ? 'Cut the price or push them' : 'None ageing' },
    { label: 'Profit this month', val: rm(mo.gross), tone: mo.gross < 0 ? 'bad' : undefined,
      sub: mo.leftOut > 0 ? `${mo.leftOut} sold car${mo.leftOut === 1 ? '' : 's'} left out, no buy price`
        : mo.addonsGross ? `Cars ${rm(mo.carsGross)} · add-ons ${rm(mo.addonsGross)}` : undefined },
  ].filter((it) => canSeeProfit || it.label !== 'Profit this month') : Array.from({ length: canSeeProfit ? 4 : 3 }, () => ({}));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
      {items.map((it, i) => <InvTile key={i} label={it.label || ''} value={it.val} sub={it.sub} tone={it.tone} />)}
    </div>
  );
}
const StockTab = React.memo(function StockTab({ userId, listings, profile, salesmen = [], onPublishComplete, autoTool, onToolHandled, hideSummary = false, onAdd, onOpenListing }) {
  const navigate = useNavigate();
  const { can } = usePermissions(profile);
  // Persisted so the stock table paints last-known units instantly (no IC or
  // buyer data on stock_units). "loading" = nothing to show yet.
  const [units, setUnits, unitsCached] = usePersistentState(userId ? `stock:${userId}` : null, []);
  const [unitsFetching, setLoading] = useState(true);
  const loading = unitsFetching && !unitsCached;
  const [soldTarget, setSoldTarget] = useState(null);
  const [soldSaving, setSoldSaving] = useState(false);
  const [stockView, setStockView] = useState('available');
  const [visibleCount, setVisibleCount] = useState(30);
  const [historyUnit, setHistoryUnit] = useState(null);
  useModalHistory(!!historyUnit, () => setHistoryUnit(null));
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pnlUnit, setPnlUnit] = useState(null);
  useModalHistory(!!pnlUnit, () => setPnlUnit(null));
  const [pnlData, setPnlData] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [reconUnit, setReconUnit] = useState(null);
  useModalHistory(!!reconUnit, () => setReconUnit(null));
  const [reconJobs, setReconJobs] = useState([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconForm, setReconForm] = useState({ title: '', category: 'other', vendor: '', cost: '', eta_date: '', notes: '' });
  const [reconSaving, setReconSaving] = useState(false);
  const [showReconAdd, setShowReconAdd] = useState(false);
  // Advertising spend per unit (DMS-6)
  const [adUnit, setAdUnit] = useState(null);
  useModalHistory(!!adUnit, () => setAdUnit(null));
  const [adEntries, setAdEntries] = useState([]);
  const [adLoading, setAdLoading] = useState(false);
  const [adForm, setAdForm] = useState({ channel: 'mudah', amount: '', spent_at: new Date().toISOString().slice(0, 10), notes: '' });
  const [adSaving, setAdSaving] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  useModalHistory(showCsvImport, () => setShowCsvImport(false));
  const [showVendors, setShowVendors] = useState(false);
  useModalHistory(showVendors, () => setShowVendors(false));
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', category: 'workshop', contact: '', phone: '', address: '', notes: '' });
  const [vendorSaving, setVendorSaving] = useState(false);
  const [showVendorAdd, setShowVendorAdd] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [csvSaving, setCsvSaving] = useState(false);
  const csvInputRef = useRef(null);

  // ENT-8: inline price editing
  const [editPriceUnit, setEditPriceUnit] = useState(null);
  useModalHistory(!!editPriceUnit, () => setEditPriceUnit(null));
  const [editPriceForm, setEditPriceForm] = useState({ purchase_price: '', recon_cost: '' });
  const [editPriceSaving, setEditPriceSaving] = useState(false);

  const [publishingStockId, setPublishingStockId] = useState(null);
  const [detailUnit, setDetailUnit] = useState(null);
  useModalHistory(!!detailUnit, () => setDetailUnit(null));
  const [stockPublishListing, setStockPublishListing] = useState(null);
  useModalHistory(!!stockPublishListing, () => setStockPublishListing(null));
  // T2-3: condition appraisal draft for the detail drawer (edit-in-place).
  const [apprDraft, setApprDraft] = useState(null);
  const [apprSaving, setApprSaving] = useState(false);
  useEffect(() => { setApprDraft(detailUnit?.appraisal || null); }, [detailUnit]);
  // Search + filter + sort for the stock list
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilters, setStockFilters] = useState(() => new Set());
  const [stockSort, setStockSort] = useState('recent');
  const toggleStockFilter = (k) => setStockFilters(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  // Lock body scroll while detail drawer or publish form is open
  useEffect(() => {
    if (!detailUnit && !stockPublishListing) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [detailUnit, stockPublishListing]);

  const handlePublishFromStock = async (u) => {
    if (publishingStockId) return;
    setPublishingStockId(u.id);
    try {
      let listing = null;
      if (!u.listing_id) {
        // No listing yet — create a minimal unpublished one from stock unit data
        const { data: newListing, error } = await supabase.from('car_listings').insert({
          dealer_id: userId,
          brand: u.brand || '',
          model: u.model || '',
          year: u.year || null,
          plate_number: u.registration_number || null,
          selling_price: u.asking_price || null,
          status: 'unpublished',
        }).select().single();
        if (error) {
          if (error.message?.includes('listing_cap_exceeded')) toast.error('Listing cap reached. Upgrade your plan to publish more cars.');
          else toast.error('Could not create listing: ' + error.message);
          return;
        }
        await supabase.from('stock_units').update({ listing_id: newListing.id }).eq('id', u.id).eq('dealer_id', userId);
        listing = newListing;
      } else {
        // Fetch the full listing row (joined car_listings select doesn't include id)
        const { data, error } = await supabase.from('car_listings').select('*').eq('id', u.listing_id).single();
        if (error || !data) { toast.error('Could not load listing details.'); return; }
        listing = data;
      }
      // Open CarForm so user can add photos, location, and other details before publishing
      setStockPublishListing(listing);
    } catch (e) {
      console.error('[handlePublishFromStock]', e);
      toast.error('Something went wrong.');
    } finally {
      setPublishingStockId(null);
    }
  };

  // Called by CarForm after saving details in the stock-publish flow
  const handleStockPublishSave = async (savedListing) => {
    const { error } = await supabase
      .from('car_listings')
      .update({ status: 'available' })
      .eq('id', savedListing.id);
    if (error) { toast.error('Could not publish: ' + error.message); return; }
    setStockPublishListing(null);
    setDetailUnit(null);
    fetchUnits();
    onPublishComplete?.({ ...savedListing, status: 'available' });
    logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: savedListing.id, action: 'published', summary: `Published from stock — ${savedListing.brand || ''} ${savedListing.model || ''} ${savedListing.year || ''}`.trim() });
    toast.success('Published to marketplace');
  };

  // Reset pagination when switching views or changing search/filters/sort
  useEffect(() => { setVisibleCount(30); }, [stockView, stockSearch, stockFilters, stockSort]);

  const fetchUnits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_units')
      .select('*, car_listings(brand, model, variant, year, plate_number, base_price, selling_price, purchase_price, recon_cost, gross_profit, days_in_stock, sold_price, sold_date, status, images, mileage, transmission, fuel_type, body_type, colour, engine_cc, condition, vin_number, registration_date, previous_owners, road_tax_expiry, warranty_months, is_recon, auction_grade, interior_grade, import_country, commission_amount, included_services_cost)')
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false });
    if (error) console.error('[StockTab] fetchUnits error:', error.message, error);
    setUnits(data || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchUnits(); }, [userId]);

  // Open the tool requested from the Listings "Tools" dropdown, then clear the signal.
  useEffect(() => {
    if (!autoTool) return;
    if (autoTool === 'csv') { setShowCsvImport(true); setCsvRows([]); setCsvError(''); }
    else if (autoTool === 'vendors') { setShowVendors(true); fetchVendors(); }
    onToolHandled?.();
  }, [autoTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dealer cost-floor settings → holding cost in P&L (DMS-4)
  const [costCfg, setCostCfg] = useState(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from('dealer_cost_settings').select('*').eq('dealer_id', userId).maybeSingle()
      .then(({ data }) => setCostCfg(data || {}));
  }, [userId]);

  // Extra cost components so the list-level net P&L (loss flag + row badge) matches
  // the full per-unit P&L modal: ad spend (per stock unit), handover processing
  // (per listing), and F&I back-end (per listing). Without these the inline gross
  // was rosy — a 0-margin car with recon/ads/holding never tripped the loss filter.
  const [costExtras, setCostExtras] = useState({ ads: {}, handover: {}, addRev: {}, addCost: {}, broker: {} });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [ads, tasks, dp, bc] = await Promise.all([
        supabase.from('ad_spend').select('stock_unit_id, amount').eq('dealer_id', userId),
        supabase.from('post_sale_tasks').select('listing_id, status, cost').eq('dealer_id', userId),
        supabase.from('deal_products').select('listing_id, sold_price, dealer_products(cost_price)').eq('dealer_id', userId),
        loadBrokerCommission(userId).catch(() => null), // BROKER-2: part of the one commission line
      ]);
      if (cancelled) return;
      const bk = {}; Object.entries(bc?.byCar || {}).forEach(([id, v]) => { bk[id] = v.amount; });
      const a = {}; (ads.data || []).forEach(r => { if (r.stock_unit_id) a[r.stock_unit_id] = (a[r.stock_unit_id] || 0) + (Number(r.amount) || 0); });
      const h = {}; (tasks.data || []).forEach(t => { if (t.status !== 'na' && t.listing_id) h[t.listing_id] = (h[t.listing_id] || 0) + (Number(t.cost) || 0); });
      const ar = {}; const ac = {};
      (dp.data || []).forEach(d => { if (d.listing_id) { ar[d.listing_id] = (ar[d.listing_id] || 0) + (Number(d.sold_price) || 0); ac[d.listing_id] = (ac[d.listing_id] || 0) + (Number(d.dealer_products?.cost_price) || 0); } });
      setCostExtras({ ads: a, handover: h, addRev: ar, addCost: ac, broker: bk });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // carPnl's one clock (daysHeld): from the purchase date, else the day the stock record was
  // made, else the listing; stops on the sale. The stored days_in_stock was stale for most cars.
  const daysInStock = (u) => {
    const d = daysHeld(u.purchase_date || u.created_at || u.car_listings?.created_at, u.status === 'sold' ? u.sold_date : null);
    return d == null ? '—' : d;
  };

  const costBasis = (u) => {
    if (Number(u.purchase_price) > 0) return Number(u.purchase_price);
    return Number(u.car_listings?.base_price) || 0;
  };

  // True net P&L for the list view — mirrors the per-unit P&L modal (recon, included
  // services, commission, handover, holding, ad spend, F&I back-end). Drives the
  // "In loss" filter, the row Net badge and the Listings stats strip via one shared
  // helper so all three agree.
  // A role without "View gross profit" gets no profit anywhere in this tab: every row badge,
  // the "In loss" filter, the profit sorts and the P&L button read null (only a tile was hidden).
  const netProfit = (u) => (can('view_gross') ? stockNetProfit(u, {
    cfg: costCfg || {}, ads: costExtras.ads, handover: costExtras.handover,
    addRev: costExtras.addRev, addCost: costExtras.addCost, broker: costExtras.broker,
  }) : null);

  // Predicates for the quick-filter chips (each returns true = unit matches the filter)
  const stockFilterFns = {
    missing_b7:  u => !u.puspakom_b7_date,
    missing_b5:  u => !u.puspakom_b5_date,
    no_plate:    u => !(u.car_listings?.plate_number || u.registration_number),
    no_vin:      u => !(u.car_listings?.vin_number),
    unpublished: u => !u.listing_id || u.car_listings?.status === 'unpublished',
    under_hp:    u => (u.encumbrance_status || 'unknown') === 'under_hp',
    enc_unknown: u => (u.encumbrance_status || 'unknown') === 'unknown',
    aging:       u => u.status === 'in_stock' && typeof daysInStock(u) === 'number' && daysInStock(u) > AGEING_DAYS,
    loss:        u => { const g = netProfit(u); return g != null && g < 0; },
  };
  // Apply text search + active chip filters + sort to a list of units
  const applyStockFilters = (list) => {
    let out = list;
    const q = stockSearch.trim().toLowerCase();
    if (q) {
      out = out.filter(u => {
        const c = u.car_listings || {};
        const hay = [c.brand, c.model, c.variant, c.plate_number || u.registration_number, c.vin_number, u.brand, u.model]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (stockFilters.size) {
      out = out.filter(u => [...stockFilters].every(k => stockFilterFns[k]?.(u)));
    }
    if (stockSort !== 'recent') {
      const priceOf = u => stockView === 'sold' ? (Number(u.sold_price) || 0) : (Number(u.asking_price) || Number(u.car_listings?.selling_price) || 0);
      const yearOf  = u => Number(u.car_listings?.year || u.year) || 0;
      const daysOf  = u => { const d = daysInStock(u); return typeof d === 'number' ? d : 0; };
      const sorters = {
        price_desc:  (a, b) => priceOf(b) - priceOf(a),
        price_asc:   (a, b) => priceOf(a) - priceOf(b),
        year_desc:   (a, b) => yearOf(b) - yearOf(a),
        year_asc:    (a, b) => yearOf(a) - yearOf(b),
        profit_desc: (a, b) => (netProfit(b) || 0) - (netProfit(a) || 0),
        profit_asc:  (a, b) => (netProfit(a) || 0) - (netProfit(b) || 0),
        days_desc:   (a, b) => daysOf(b) - daysOf(a),
      };
      if (sorters[stockSort]) out = [...out].sort(sorters[stockSort]);
    }
    return out;
  };

  const now = new Date();
  const activeUnits = units.filter(u => u.status !== 'sold');
  const soldUnits = units.filter(u => u.status === 'sold');

  const thisMonth = soldUnits.filter(u => {
    if (!u.sold_date) return false;
    const d = new Date(u.sold_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalGP = thisMonth.reduce((s, u) => s + (netProfit(u) || 0), 0);
  // Sale price source of truth is car_listings.selling_price (edited via the
  // detail-drawer Adjust Price modal or CarForm); asking_price is a legacy
  // per-unit fallback only.
  const totalValue = activeUnits.reduce((s, u) => s + (Number(u.car_listings?.selling_price) || Number(u.asking_price) || 0), 0);
  // Revenue = realised sale price across all sold units (fall back to listing
  // price, then asking, if a pipeline-close didn't stamp a sold_price).
  const soldRevenue = soldUnits.reduce((s, u) => s + (Number(u.sold_price) || Number(u.car_listings?.selling_price) || Number(u.asking_price) || 0), 0);
  const unitsWithDays = activeUnits.filter(u => typeof daysInStock(u) === 'number');
  const avgDays = unitsWithDays.length
    ? Math.round(unitsWithDays.reduce((s, u) => s + daysInStock(u), 0) / unitsWithDays.length)
    : 0;
  const agingUnits = activeUnits.filter(u => {
    const days = daysInStock(u);
    return typeof days === 'number' && days > AGEING_DAYS;
  });
  const gpSparkData = bucketGPByMonth(units);

  // Same popup as the listings grid (MarkSoldModal). The stock_units write is
  // the sale: trg_sync_stock_sold_to_listing flips the car to sold with this
  // price + date, so no second car_listings status write here. Closer and
  // commission live on the car, so they are written first.
  const handleMarkSold = async ({ soldBy = null, soldPrice = null, commission = null, soldDate = null } = {}) => {
    setSoldSaving(true);
    const listingId = soldTarget.listing_id || null;
    if (listingId) {
      const carPatch = {};
      if (soldBy) carPatch.assigned_to = soldBy;
      if (commission != null) carPatch.commission_amount = commission;
      if (Object.keys(carPatch).length) {
        const { error: carErr } = await supabase.from('car_listings').update(carPatch).eq('id', listingId);
        if (carErr) {
          toast.error('Could not save the salesman or commission: ' + carErr.message);
          setSoldSaving(false);
          return;
        }
      }
    }
    const payload = {
      status: 'sold',
      sold_date: soldDate || new Date().toISOString().slice(0, 10),
      sold_price: soldPrice ?? 0,
    };
    const { error } = await supabase
      .from('stock_units')
      .update(payload)
      .eq('id', soldTarget.id)
      .eq('dealer_id', userId);
    if (error) {
      toast.error('Failed to mark as sold: ' + error.message);
      setSoldSaving(false);
      return;
    }
    const car = soldTarget.car_listings || {};
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: soldTarget.id, action: 'marked_sold', summary: `Stock unit sold${car.brand ? ` — ${car.brand} ${car.model} ${car.year}` : ''} · RM ${(payload.sold_price||0).toLocaleString()}` });
    if (listingId) {
      onPublishComplete?.({ id: listingId, status: 'sold', sold_price: payload.sold_price, sold_date: payload.sold_date,
        ...(soldBy ? { assigned_to: soldBy } : {}), ...(commission != null ? { commission_amount: commission } : {}) });
    }
    // Refetch — server-side triggers recompute days_in_stock/gross_profit/recon_cost etc.
    await fetchUnits();
    setSoldTarget(null);
    setSoldSaving(false);
  };

  // HP-3: PUSPAKOM B7 (hire-purchase inspection) — valid 30 days from inspection.
  // Show the inspection date WITH YEAR so a 2024/2025 cert is obviously stale, and
  // flag expired (red) / expiring (amber) loudly rather than a silent number.
  const puspakomStatus = (date) => {
    if (!date) return { label: 'B7 missing', color: '#6b7280', urgent: false };
    const issued = new Date(date);
    const d = issued.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
    const expires = new Date(issued); expires.setDate(expires.getDate() + 30);
    const daysLeft = Math.floor((expires - Date.now()) / 86400000);
    if (daysLeft < 0)  return { label: `B7 expired · ${d}`, color: '#ef4444', urgent: true };
    if (daysLeft <= 7) return { label: `B7 expires in ${daysLeft}d · ${d}`, color: '#f59e0b', urgent: true };
    return { label: `B7 valid ${daysLeft}d · ${d}`, color: '#22c55e', urgent: false };
  };
  const handleUpdatePuspakom = async (unit) => {
    const current = unit.puspakom_b7_date || '';
    const next = window.prompt('PUSPAKOM B7 inspection date (YYYY-MM-DD). Leave blank to clear.', current);
    if (next === null) return;
    const value = next.trim() || null;
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))) {
      toast.error('Enter a valid date as YYYY-MM-DD (e.g. 2026-03-15)');
      return;
    }
    const { error } = await supabase.from('stock_units').update({ puspakom_b7_date: value }).eq('id', unit.id).eq('dealer_id', userId);
    if (error) { toast.error('Update failed'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'b7_updated', summary: `Puspakom B7 date set to ${value || 'cleared'}`, fieldChanges: { puspakom_b7_date: { from: unit.puspakom_b7_date, to: value } } });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, puspakom_b7_date: value } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, puspakom_b7_date: value } : prev);
    toast.success('PUSPAKOM B7 updated');
  };

  // ENT-1: PUSPAKOM B5 (ownership-transfer inspection) — no hard expiry, but a cert
  // older than ~12 months usually needs re-inspection before JPJ transfer, so show
  // the full date WITH YEAR and flag a stale one (amber) instead of a bare "done".
  const b5Status = (date) => {
    if (!date) return { label: 'B5 missing', color: '#6b7280' };
    const dt = new Date(date);
    const d = dt.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
    const months = Math.floor((Date.now() - dt) / (30 * 86400000));
    if (months >= 12) return { label: `B5 ${d} · stale`, color: '#f59e0b' };
    return { label: `B5 ${d}`, color: '#22c55e' };
  };
  const handleUpdateB5 = async (unit) => {
    const current = unit.puspakom_b5_date || '';
    const next = window.prompt('PUSPAKOM B5 inspection date (YYYY-MM-DD). Leave blank to clear.', current);
    if (next === null) return;
    const value = next.trim() || null;
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))) {
      toast.error('Enter a valid date as YYYY-MM-DD (e.g. 2026-03-15)');
      return;
    }
    const { error } = await supabase.from('stock_units').update({ puspakom_b5_date: value }).eq('id', unit.id).eq('dealer_id', userId);
    if (error) { toast.error('Update failed'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'b5_updated', summary: `Puspakom B5 date set to ${value || 'cleared'}`, fieldChanges: { puspakom_b5_date: { from: unit.puspakom_b5_date, to: value } } });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, puspakom_b5_date: value } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, puspakom_b5_date: value } : prev);
    toast.success('PUSPAKOM B5 updated');
  };

  // ENT-1: Encumbrance status helpers
  const ENCUMBRANCE_CFG = {
    clear:    { label: 'Clear title',  color: '#22c55e' },
    under_hp: { label: 'Under HP',     color: '#ef4444' },
    unknown:  { label: 'Enc. unknown', color: '#f59e0b' },
  };
  const handleUpdateEncumbrance = async (unit) => {
    const options = ['clear', 'under_hp', 'unknown'];
    const current = unit.encumbrance_status || 'unknown';
    const next = options[(options.indexOf(current) + 1) % options.length];
    const { error } = await supabase.from('stock_units').update({ encumbrance_status: next }).eq('id', unit.id).eq('dealer_id', userId);
    if (error) { toast.error('Update failed'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'encumbrance_updated', summary: `Encumbrance status ${unit.encumbrance_status || 'unknown'} → ${next}`, fieldChanges: { encumbrance_status: { from: unit.encumbrance_status, to: next } } });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, encumbrance_status: next } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, encumbrance_status: next } : prev);
  };

  // T2-3: persist the condition appraisal from the detail drawer.
  const handleSaveAppraisal = async (unit) => {
    setApprSaving(true);
    const payload = apprDraft
      ? { ...apprDraft, appraised_at: new Date().toISOString(), appraised_by: userId }
      : null;
    const { error } = await supabase.from('stock_units').update({ appraisal: payload }).eq('id', unit.id).eq('dealer_id', userId);
    setApprSaving(false);
    if (error) { toast.error('Could not save appraisal'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'appraisal_updated', summary: payload ? `Condition appraisal saved — Grade ${payload.overall}` : 'Condition appraisal cleared' });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, appraisal: payload } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, appraisal: payload } : prev);
    toast.success('Appraisal saved');
  };

  const fetchPnl = async (unit) => {
    setPnlUnit(unit);
    setPnlData(null);
    setPnlLoading(true);
    const listingId = unit.listing_id || unit.car_listings?.id;
    let addons = [];
    let handoverTasks = [];
    let reconJobsList = [];
    let adSpendList = [];
    const [{ data: rj }, { data: ads }] = await Promise.all([
      supabase.from('recon_jobs').select('cost, status').eq('stock_unit_id', unit.id),
      supabase.from('ad_spend').select('amount').eq('stock_unit_id', unit.id),
    ]);
    reconJobsList = rj || [];
    adSpendList = ads || [];
    // BROKER-2: what an approved broker sale on this car owes the broker (one commission line).
    let pnlBroker = 0;
    try { pnlBroker = brokerAmount((await loadBrokerCommission(userId)).byCar, listingId); } catch { /* keep 0, the read failed */ }
    if (listingId) {
      const [{ data: dp }, { data: pst }] = await Promise.all([
        supabase
          .from('deal_products')
          .select('sold_price, dealer_products(name, cost_price)')
          .eq('listing_id', listingId)
          .eq('dealer_id', userId),
        supabase
          .from('post_sale_tasks')
          .select('step_key, status, cost')
          .eq('listing_id', listingId)
          .eq('dealer_id', userId),
      ]);
      addons = dp || [];
      handoverTasks = pst || [];
    }
    // The ONE profit engine (src/utils/carPnl.js): same numbers as the car pop-up's Owner button.
    const cl = unit.car_listings || {};
    const e = carPnl({
      purchase: unit.purchase_price, reconEstimate: unit.recon_cost, reconJobs: reconJobsList,
      servicesCost: cl.included_services_cost, commission: cl.commission_amount,
      brokerCommission: pnlBroker,
      handoverCost: handoverTasks.length ? handoverTasks.filter((t) => t.status !== 'na').reduce((s, t) => s + (Number(t.cost) || 0), 0) : null,
      adSpend: adSpendList.reduce((s, a) => s + (Number(a.amount) || 0), 0),
      addonRevenue: addons.reduce((s, a) => s + (Number(a.sold_price) || 0), 0),
      addonCost: addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0),
      asking: Number(unit.asking_price) || Number(cl.selling_price) || 0, soldPrice: unit.sold_price,
      isSold: unit.status === 'sold', startDate: unit.purchase_date || unit.created_at, soldDate: unit.sold_date,
      engineCc: unit.engine_cc || cl.engine_cc, warrantyMonths: cl.warranty_months, cfg: costCfg || {},
    });
    const line = (k) => e.lines.find((l) => l.key === k)?.val || 0;
    setPnlData({
      purchasePrice: line('purchase'), reconCost: line('recon'),
      reconEst: Number(unit.recon_cost) || 0, reconActual: reconJobsList.reduce((s, j) => s + (Number(j.cost) || 0), 0),
      servicesCost: line('services'), commission: line('commission'),
      // Shown as one "Handover processing" line here: transfer (estimated until the deal), admin, warranty reserve.
      handoverCost: line('transfer') + line('admin') + line('warranty'),
      holdingCost: e.holding, holdingDays: e.days || 0, dailyHold: e.perDay.total, adSpend: line('ads'),
      addonRevenue: addons.reduce((s, a) => s + (Number(a.sold_price) || 0), 0), addonCost: addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0),
      revenue: e.revenue, frontGross: e.front, backGross: e.back, totalCosts: e.costTotal + addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0),
      netPnl: e.net, addons, isSold: e.isSold,
    });
    setPnlLoading(false);
  };

  const RECON_CATS = [
    { value: 'wash',        label: 'Wash & Detail' },
    { value: 'polish',      label: 'Polish / Paint' },
    { value: 'engine',      label: 'Engine / Mechanical' },
    { value: 'tyres',       label: 'Tyres' },
    { value: 'upholstery',  label: 'Upholstery / Interior' },
    { value: 'bodywork',    label: 'Bodywork / Dents' },
    { value: 'inspection',  label: 'Inspection' },
    { value: 'electrical',  label: 'Electrical' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'other',       label: 'Other' },
  ];

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvError('File must have a header row and at least one data row.'); setCsvRows([]); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
        const col = (alts) => headers.findIndex(h => alts.some(a => h.includes(a)));
        const iB  = col(['brand','make']);
        const iM  = col(['model']);
        const iY  = col(['year']);
        const iP  = col(['plate','reg']);
        const iCost = col(['purchase','cost','buying']);
        const iRecon = col(['recon']);
        const iAsk  = col(['asking','sell','price']);
        const rows = lines.slice(1).map((line, i) => {
          const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            _row: i + 2,
            brand:          iB  >= 0 ? cells[iB]  || '' : '',
            model:          iM  >= 0 ? cells[iM]  || '' : '',
            year:           iY  >= 0 ? cells[iY]  || '' : '',
            plate_number:   iP  >= 0 ? cells[iP]  || '' : '',
            purchase_price: iCost  >= 0 ? Number(cells[iCost])  || 0 : 0,
            recon_cost:     iRecon >= 0 ? Number(cells[iRecon]) || 0 : 0,
            asking_price:   iAsk   >= 0 ? Number(cells[iAsk])  || 0 : 0,
          };
        }).filter(r => r.brand || r.model);
        if (rows.length === 0) { setCsvError('No valid rows found. Ensure columns: brand/make, model, year.'); setCsvRows([]); return; }
        // Every car needs its buy price (a "purchase" / "cost" column). Rows without one are named,
        // and nothing imports until the file is fixed: a half-imported list is worse than none.
        const noCost = rows.filter(r => !(r.purchase_price > 0)).map(r => r._row);
        if (noCost.length) {
          setCsvError(iCost < 0
            ? 'Add a buy price column (named "purchase" or "cost") and upload again.'
            : `No buy price on row${noCost.length === 1 ? '' : 's'} ${noCost.slice(0, 12).join(', ')}${noCost.length > 12 ? '…' : ''}. Fill ${noCost.length === 1 ? 'it' : 'them'} in and upload again.`);
          setCsvRows([]); return;
        }
        setCsvError('');
        setCsvRows(rows);
      } catch { setCsvError('Failed to parse CSV. Please check the file format.'); setCsvRows([]); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvImport = async () => {
    if (!csvRows.length) return;
    setCsvSaving(true);
    const payload = csvRows.map(r => ({
      dealer_id: userId, status: 'in_stock',
      brand: r.brand || null, model: r.model || null, year: r.year ? Number(r.year) : null,
      registration_number: r.plate_number || null,
      purchase_price: r.purchase_price || 0,
      recon_cost: r.recon_cost || 0,
      asking_price: r.asking_price || 0,
      encumbrance_status: 'unknown',
    }));
    const { error } = await supabase.from('stock_units').insert(payload);
    if (error) { toast.error('Import failed: ' + error.message); }
    else {
      toast.success(`${payload.length} units imported`);
      setShowCsvImport(false);
      setCsvRows([]);
      fetchUnits();
    }
    setCsvSaving(false);
  };

  const VENDOR_CATS = [
    { value: 'workshop',    label: 'Workshop / Mechanic' },
    { value: 'tint',        label: 'Window Tint' },
    { value: 'bodywork',    label: 'Bodywork / Panel' },
    { value: 'upholstery',  label: 'Upholstery' },
    { value: 'electrical',  label: 'Electrical' },
    { value: 'inspection',  label: 'Inspection (PUSPAKOM)' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'insurance',   label: 'Insurance' },
    { value: 'other',       label: 'Other' },
  ];

  const fetchVendors = async () => {
    setVendorsLoading(true);
    const { data } = await supabase.from('vendors').select('*').eq('dealer_id', userId).order('name', { ascending: true });
    setVendors(data || []);
    setVendorsLoading(false);
  };

  const handleAddVendor = async () => {
    if (!vendorForm.name.trim()) { toast.error('Enter vendor name'); return; }
    setVendorSaving(true);
    const { data, error } = await supabase.from('vendors').insert({
      dealer_id: userId, name: vendorForm.name.trim(), category: vendorForm.category,
      contact: vendorForm.contact.trim() || null, phone: vendorForm.phone.trim() || null,
      address: vendorForm.address.trim() || null, notes: vendorForm.notes.trim() || null,
    }).select().single();
    if (error) { toast.error('Failed to add vendor'); }
    else {
      logActivity({ dealerId: userId, actor: profile, tableName: 'vendors', recordId: data.id, action: 'created', summary: `Vendor added — ${data.name} (${data.category})` });
      setVendors(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowVendorAdd(false);
      setVendorForm({ name: '', category: 'workshop', contact: '', phone: '', address: '', notes: '' });
      toast.success('Vendor added');
    }
    setVendorSaving(false);
  };

  const handleToggleVendor = async (id, is_active) => {
    const { error } = await supabase.from('vendors').update({ is_active }).eq('id', id);
    if (!error) setVendors(p => p.map(v => v.id === id ? { ...v, is_active } : v));
  };

  const fetchReconJobs = async (unit) => {
    setReconUnit(unit);
    setReconJobs([]);
    setReconLoading(true);
    setShowReconAdd(false);
    setReconForm({ title: '', category: 'other', vendor: '', cost: '', eta_date: '', notes: '' });
    const { data } = await supabase
      .from('recon_jobs')
      .select('*')
      .eq('stock_unit_id', unit.id)
      .order('created_at', { ascending: true });
    setReconJobs(data || []);
    setReconLoading(false);
  };

  const openAdSpend = async (unit) => {
    setAdUnit(unit);
    setAdEntries([]);
    setAdLoading(true);
    setAdForm({ channel: 'mudah', amount: '', spent_at: new Date().toISOString().slice(0, 10), notes: '' });
    const { data } = await supabase.from('ad_spend').select('*').eq('stock_unit_id', unit.id).order('spent_at', { ascending: false });
    setAdEntries(data || []);
    setAdLoading(false);
  };
  const handleAddAdSpend = async () => {
    if (!adForm.amount || Number(adForm.amount) <= 0) { toast.error('Enter an amount'); return; }
    setAdSaving(true);
    const { data, error } = await supabase.from('ad_spend').insert({
      dealer_id: userId,
      stock_unit_id: adUnit.id,
      listing_id: adUnit.listing_id || null,
      channel: adForm.channel,
      amount: Number(adForm.amount),
      spent_at: adForm.spent_at || null,
      notes: adForm.notes.trim() || null,
    }).select().single();
    if (error) { toast.error('Failed to add spend'); }
    else {
      setAdEntries(p => [data, ...p]);
      setAdForm({ channel: 'mudah', amount: '', spent_at: new Date().toISOString().slice(0, 10), notes: '' });
    }
    setAdSaving(false);
  };
  const handleDeleteAdSpend = async (id) => {
    const { error } = await supabase.from('ad_spend').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setAdEntries(p => p.filter(e => e.id !== id));
  };

  const handleAddReconJob = async () => {
    if (!reconForm.title.trim()) { toast.error('Enter a job title'); return; }
    setReconSaving(true);
    const { data, error } = await supabase.from('recon_jobs').insert({
      dealer_id: userId,
      stock_unit_id: reconUnit.id,
      title: reconForm.title.trim(),
      category: reconForm.category,
      vendor: reconForm.vendor.trim() || null,
      cost: reconForm.cost ? Number(reconForm.cost) : null,
      eta_date: reconForm.eta_date || null,
      notes: reconForm.notes.trim() || null,
      status: 'pending',
    }).select().single();
    if (error) { toast.error('Failed to add job'); }
    else {
      logActivity({ dealerId: userId, actor: profile, tableName: 'recon_jobs', recordId: data.id, action: 'created', summary: `Recon job — ${data.title}${data.cost ? ` · RM ${Number(data.cost).toLocaleString()}` : ''}${data.vendor ? ` · ${data.vendor}` : ''}` });
      setReconJobs(p => [...p, data]); setShowReconAdd(false); setReconForm({ title: '', category: 'other', vendor: '', cost: '', eta_date: '', notes: '' });
    }
    setReconSaving(false);
  };

  const handleReconStatus = async (jobId, newStatus) => {
    const patch = { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null };
    const { error } = await supabase.from('recon_jobs').update(patch).eq('id', jobId);
    if (!error) setReconJobs(p => p.map(j => j.id === jobId ? { ...j, ...patch } : j));
  };

  const fetchHistory = async (unit) => {
    setHistoryUnit(unit);
    setHistoryLogs([]);
    setHistoryLoading(true);
    // A car's history is split across two record ids: the stock_unit (cost, sold,
    // compliance) and the linked car_listing (creation, price, status). Pull both
    // so the timeline is the full story, not half of it.
    const { data } = await supabase
      .from('activity_log')
      .select('actor_name, actor_role, action, summary, created_at')
      .eq('dealer_id', userId)
      .in('record_id', [unit.id, unit.listing_id].filter(Boolean))
      .order('created_at', { ascending: false })
      .limit(50);
    setHistoryLogs(data || []);
    setHistoryLoading(false);
  };

  const handleSavePrices = async () => {
    if (!editPriceUnit) return;
    if (!(Number(editPriceForm.purchase_price) > 0)) { toast.error('Enter the buy price. It cannot be empty or 0.'); return; }
    setEditPriceSaving(true);
    const patch = {
      purchase_price: Number(editPriceForm.purchase_price) || 0,
      recon_cost:     Number(editPriceForm.recon_cost)     || 0,
    };
    const { error } = await supabase.from('stock_units').update(patch).eq('id', editPriceUnit.id).eq('dealer_id', userId);
    if (!error) {
      const changes = [];
      const fc = {};
      if (patch.purchase_price !== (Number(editPriceUnit.purchase_price)||0)) { changes.push(`purchase RM ${(Number(editPriceUnit.purchase_price)||0).toLocaleString()} → RM ${patch.purchase_price.toLocaleString()}`); fc.purchase_price = { from: Number(editPriceUnit.purchase_price)||0, to: patch.purchase_price }; }
      if (patch.recon_cost     !== (Number(editPriceUnit.recon_cost)||0))     { changes.push(`recon RM ${(Number(editPriceUnit.recon_cost)||0).toLocaleString()} → RM ${patch.recon_cost.toLocaleString()}`); fc.recon_cost = { from: Number(editPriceUnit.recon_cost)||0, to: patch.recon_cost }; }
      if (changes.length) {
        logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: editPriceUnit.id, action: 'costs_updated', summary: `Costs updated — ${changes.join('; ')}`, fieldChanges: fc });
      }
      setUnits(u => u.map(x => x.id === editPriceUnit.id ? { ...x, ...patch } : x));
      setDetailUnit(prev => (prev && prev.id === editPriceUnit.id) ? { ...prev, ...patch } : prev);
      toast.success('Costs updated');
      setEditPriceUnit(null);
    } else {
      toast.error('Failed to save costs');
    }
    setEditPriceSaving(false);
  };

  const statusBadge = (s) => {
    const map = { in_stock: '#047857', sold: '#6b7280', reserved: '#4b5563' };
    const color = map[s] || '#6b7280';
    return <span style={{ fontSize: 10, fontWeight: 700, color, background: '#f5f6f8', borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s?.replace('_',' ') || '—'}</span>;
  };

  const summaryCards = [
    { label: 'Revenue (sold)',       val: `RM ${soldRevenue.toLocaleString()}`, Icon: Banknote,     grad: ''                          },
    { label: 'Stock Value',          val: `RM ${totalValue.toLocaleString()}`,  Icon: Banknote,      grad: ''                                                           },
    { label: 'Avg Days in Stock',    val: avgDays,                              Icon: Clock,         grad: avgDays > 60 ? 'text-red-700' : '' },
    { label: 'Gross Profit (month)', val: `RM ${totalGP.toLocaleString()}`,     Icon: TrendingUp,    grad: '', spark: gpSparkData, sparkColor: '#111827' },
    { label: 'Sold This Month',      val: thisMonth.length,                     Icon: CheckCircle2,  grad: ''                                                         },
    { label: 'Aging Stock (60d+)',   val: agingUnits.length,                    Icon: AlertTriangle, grad: agingUnits.length > 0 ? 'text-red-700' : ''              },
  ];

  return (
    <>
    <div className="space-y-6">
      {!hideSummary && <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {summaryCards.map(({ label, val, Icon: Ic, grad, spark, sparkColor }) => (
          <div key={label} className="stat-card card-top rounded-2xl overflow-hidden glass" style={{ position: 'relative' }}>
            {spark && (
              <div className="px-3.5 pt-3">
                <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
              </div>
            )}
            <div className={spark ? 'p-3 sm:p-4 pt-2' : 'p-3 sm:p-4'}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center pl-well"><Ic className="w-4 h-4" /></div>
              </div>
              <p className={`text-xl sm:text-2xl font-black leading-none tabular-nums ${grad || 'text-gray-900'}`}>{val}</p>
            </div>
          </div>
        ))}
      </div>}

      <div style={{ ...INV_CARD, overflow: 'hidden' }}>
        <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvFile} />
        {/* One card: search + sort + Needs attention + Add car, then the status
            pills, then the cars. Import CSV / AI import live in the Add car sheet. */}
        <div style={{ padding: '16px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
            <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: premiumLight.textMuted, pointerEvents: 'none' }} />
            <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Search brand, model, plate, VIN"
              style={{ ...INV_INPUT, padding: '9px 30px 9px 32px' }} />
            {stockSearch && (
              <button onClick={() => setStockSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: premiumLight.textMuted, cursor: 'pointer', display: 'flex', padding: 0 }}><X style={{ width: 14, height: 14 }} /></button>
            )}
          </div>
          {onAdd && <AddCarButton onClick={onAdd} className="inv-add-last" />}
          <NeedsAttentionMenu
            checks={STOCK_FILTER_CHIPS.map(c => ({ ...c, count: (stockView === 'available' ? activeUnits : soldUnits).filter(u => stockFilterFns[c.key]?.(u)).length }))}
            active={stockFilters}
            onToggle={toggleStockFilter}
            onClear={() => setStockFilters(new Set())}
          />
          <select value={stockSort} onChange={e => setStockSort(e.target.value)} aria-label="Sort"
            style={{ ...INV_GHOST_BTN, width: 'auto', minWidth: 0, maxWidth: 160, flex: '1 1 90px', padding: '9px 10px', appearance: 'auto' }}>
            {STOCK_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

        </div>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <StatusPills
            active={stockView}
            onChange={setStockView}
            items={[
              { key: 'available', label: 'In stock', count: activeUnits.length },
              // Sold moves to the Sold tab once it exists (owner, 2026-11-09).
              { key: 'sold',      label: 'Sold',     count: soldUnits.length },
            ]}
          />
          <button onClick={() => { setShowVendors(true); fetchVendors(); }} style={{ ...INV_GHOST_BTN, background: 'transparent', padding: '7px 8px', color: premiumLight.textSec }}>
            <Wrench style={{ width: 14, height: 14 }} /> Vendors
          </button>
        </div>
        <div style={{ height: 1, background: premiumLight.line }} />
        <div>
          {loading ? (
            <p style={{ color: '#9ca3af', fontSize: 13, padding: '24px 20px' }}>Loading…</p>
          ) : units.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 13, padding: '24px 20px' }}>No stock units yet.</p>
          ) : (() => {
            const baseUnits = stockView === 'available' ? activeUnits : soldUnits;
            const displayUnits = applyStockFilters(baseUnits);
            const visibleUnits = displayUnits.slice(0, visibleCount);
            const hasMore = displayUnits.length > visibleCount;
            const currentYear = new Date().getFullYear();
            const filtersActive = stockFilters.size > 0 || stockSearch.trim();
            return (
              <>
                {filtersActive && displayUnits.length > 0 && (
                  <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, padding: '8px 16px 0' }}>
                    {displayUnits.length} of {baseUnits.length} {baseUnits.length === 1 ? 'unit' : 'units'}
                  </p>
                )}
                {displayUnits.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: 13, padding: '24px 20px' }}>{filtersActive ? 'No units match your search or filters.' : 'No units in this view.'}</p>
                ) : visibleUnits.map(u => {
                  const car = u.car_listings || { brand: u.brand, model: u.model, year: u.year, plate_number: u.registration_number };
                  const thumb = u.car_listings?.images?.[0] || null;
                  const gp = netProfit(u);
                  const days = daysInStock(u);
                  const daysNum = typeof days === 'number' ? days : 0;
                  const isAging = u.status === 'in_stock' && daysNum > AGEING_DAYS;
                  const carYear = car?.year ? Number(car.year) : null;
                  const carAge = carYear ? currentYear - carYear : null;
                  const plate = car.plate_number || u.registration_number;
                  const ps = puspakomStatus(u.puspakom_b7_date);
                  const b5 = b5Status(u.puspakom_b5_date);
                  const enc = ENCUMBRANCE_CFG[u.encumbrance_status || 'unknown'];
                  const isUnpublished = !u.listing_id || u.car_listings?.status === 'unpublished';
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        // A stock car with a listing opens the SAME pop-up as Inventory (Owner button first);
                        // only a stock car with no listing keeps this older stock pop-up.
                        const l = u.listing_id && onOpenListing ? listings.find(x => x.id === u.listing_id) : null;
                        if (l) onOpenListing(l); else setDetailUnit(u);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                        borderBottom: `1px solid ${premiumLight.line}`, cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = premiumLight.raised}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: 68, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {thumb ? (
                          <img src={cdnImg(thumb, 160, 70)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { if (!e.target.dataset.fb) { e.target.dataset.fb = '1'; e.target.src = thumb; } else { e.target.style.display = 'none'; } }} />
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                            <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
                          </svg>
                        )}
                      </div>

                      {/* Info: name, one quiet line, price + days. The checks (B7, B5,
                          loan, published), grade and net profit open on tap in the car's
                          record (owner, 2026-11-09: "too crowded, details on click").
                          One red "N to sort" says there is something waiting there. */}
                      {(() => {
                        const toSort = u.status === 'in_stock'
                          ? [ps.color !== '#22c55e', b5.color !== '#22c55e', (u.encumbrance_status || 'unknown') === 'unknown', isUnpublished].filter(Boolean).length
                          : 0;
                        const meta = [carAge != null ? `${carAge}yr` : null, plate ? plate.toUpperCase() : null].filter(Boolean).join(' · ');
                        return (
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: premiumLight.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {car.brand} {car.model}
                              </p>
                              <p style={{ fontSize: 12, color: premiumLight.textMuted, margin: '3px 0 0', display: 'flex', gap: 6, minWidth: 0 }}>
                                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta || 'No plate yet'}</span>
                                {toSort > 0 && <span style={{ flexShrink: 0, whiteSpace: 'nowrap', color: premiumLight.accentText, fontWeight: 600 }}>{toSort} to sort</span>}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: premiumLight.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                                RM {(stockView === 'available'
                                  ? (Number(u.asking_price) || Number(u.car_listings?.selling_price) || 0)
                                  : (Number(u.sold_price) || 0)).toLocaleString()}
                              </p>
                              <p style={{ fontSize: 12, margin: '3px 0 0', color: isAging ? premiumLight.accentText : premiumLight.textMuted, fontWeight: isAging ? 600 : 400 }}>
                                {stockView === 'available'
                                  ? (days !== '—' ? `${days} days` : '—')
                                  : (u.sold_date ? new Date(u.sold_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : '—')}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                      <ChevronRight style={{ width: 16, height: 16, color: premiumLight.textMuted, flexShrink: 0 }} />
                    </div>
                  );
                })}
                {hasMore && (
                  <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid rgba(17,24,39,0.06)' }}>
                    <button
                      onClick={() => setVisibleCount(c => c + 30)}
                      style={{ ...INV_GHOST_BTN }}
                    >
                      Load {Math.min(30, displayUnits.length - visibleCount)} more
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Stock Unit Detail Drawer ── */}
      {detailUnit && createPortal((() => {
        const u = detailUnit;
        const car = u.car_listings || { brand: u.brand, model: u.model, year: u.year, plate_number: u.registration_number };
        const thumb = u.car_listings?.images?.[0] || null;
        const plate = car.plate_number || u.registration_number;
        const gp = netProfit(u);
        const days = daysInStock(u);
        const daysNum = typeof days === 'number' ? days : 0;
        const isAging = u.status === 'in_stock' && daysNum > AGEING_DAYS;
        const ps  = puspakomStatus(u.puspakom_b7_date);
        const b5  = b5Status(u.puspakom_b5_date);
        const enc = ENCUMBRANCE_CFG[u.encumbrance_status || 'unknown'];
        const isUnpublished = !u.listing_id || u.car_listings?.status === 'unpublished';
        const currentYear = new Date().getFullYear();
        const carYear = car?.year ? Number(car.year) : null;
        const carAge = carYear ? currentYear - carYear : null;

        // premiumLight (owner, 2026-11-09): every action is the same grey row with
        // ink words. Only the main action ('primary') is red. No per-row colours.
        const ACTION_BTN = (label, desc, kind, _bg, _border, onClick) => {
          const primary = kind === 'primary';
          return (
            <button onClick={onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: primary ? premiumLight.accent : premiumLight.raised, border: 'none', borderRadius: premiumLight.radius.row, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "system-ui,sans-serif", transition: 'background 0.15s' }}
              onMouseEnter={e => { if (!primary) e.currentTarget.style.background = premiumLight.hover; }} onMouseLeave={e => { if (!primary) e.currentTarget.style.background = premiumLight.raised; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: primary ? '#fff' : premiumLight.text, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: primary ? 'rgba(255,255,255,0.85)' : premiumLight.textMuted, margin: '2px 0 0' }}>{desc}</p>
              </div>
              <ChevronRight style={{ width: 15, height: 15, color: primary ? '#fff' : premiumLight.textMuted, flexShrink: 0 }} />
            </button>
          );
        };

        // Only show spec rows that have values
        const SPEC_ROWS = [
          { label: 'Variant',        val: car.variant || null },
          { label: 'Mileage',        val: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null },
          { label: 'Transmission',   val: car.transmission || null },
          { label: 'Fuel Type',      val: car.fuel_type || null },
          { label: 'Body Type',      val: car.body_type || null },
          { label: 'Colour',         val: car.colour || null },
          { label: 'Engine',         val: car.engine_cc ? `${car.engine_cc} cc` : null },
          { label: 'Condition',      val: car.condition || null },
          { label: 'VIN',            val: car.vin_number || null },
          { label: 'Reg Date',       val: car.registration_date ? new Date(car.registration_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
          { label: 'Prev. Owners',   val: car.previous_owners != null ? String(car.previous_owners) : null },
          { label: 'Road Tax Exp.',  val: car.road_tax_expiry ? new Date(car.road_tax_expiry).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
          { label: 'Warranty',       val: car.warranty_months ? `${car.warranty_months} months` : null },
          { label: 'Auction Grade',  val: car.is_recon && car.auction_grade ? car.auction_grade : null },
          { label: 'Interior Grade', val: car.is_recon && car.interior_grade ? car.interior_grade : null },
          { label: 'Import',         val: car.import_country || null },
        ].filter(s => s.val);

        return (
          <div
            onClick={() => setDetailUnit(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 12 : 24, overscrollBehavior: 'contain' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: premiumLight.radius.card, width: '100%', maxWidth: isMobile ? 540 : 880,
                maxHeight: isMobile ? '88vh' : '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
                fontFamily: "system-ui,sans-serif",
              }}
            >
              {/* Drag handle pill — mobile only */}
              {isMobile && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
                </div>
              )}

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 14px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                <div style={{ width: 72, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {thumb ? (
                    <img src={cdnImg(thumb, 160, 70)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { if (!e.target.dataset.fb) { e.target.dataset.fb = '1'; e.target.src = thumb; } else { e.target.style.display = 'none'; } }} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {car.brand} {car.model}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                    {car.year && <span style={{ fontSize: 12, color: '#6b7280' }}>{car.year}</span>}
                    {carAge != null && <span style={{ fontSize: 12, color: premiumLight.textMuted }}>· {carAge}yr</span>}
                    {plate ? (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: premiumLight.textSec, background: premiumLight.raised, borderRadius: 6, padding: '2px 7px' }}>{plate.toUpperCase()}</span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#9ca3af', border: '1px dashed #d1d5db', borderRadius: 4, padding: '1px 6px' }}>no plate</span>
                    )}
                    {isAging && <span style={{ fontSize: 11, fontWeight: 700, color: premiumLight.accentText }}>{daysNum}d in stock</span>}
                  </div>
                </div>
                <button onClick={() => setDetailUnit(null)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Financial stats strip */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[1, can('view_cost') ? 1 : 0, can('view_gross') ? 1 : 0].reduce((a, b) => a + b)}, 1fr)`, gap: 1, background: '#f3f4f6', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                {[
                  { label: 'Asking',   val: (Number(u.asking_price) || Number(u.car_listings?.selling_price)) ? `RM ${(Number(u.asking_price) || Number(u.car_listings?.selling_price)).toLocaleString()}` : '—', color: '#111827' },
                  can('view_cost')  ? { label: 'Cost',    val: costBasis(u) > 0 ? `RM ${costBasis(u).toLocaleString()}` : '—', color: '#374151' } : null,
                  can('view_gross') ? { label: 'Net P&L', val: gp != null ? `${gp >= 0 ? '+' : '−'}RM ${Math.abs(gp).toLocaleString()}` : '—', color: gp == null ? premiumLight.textMuted : gp >= 0 ? premiumLight.up : premiumLight.accentText } : null,
                ].filter(Boolean).map((s, i) => (
                  <div key={i} style={{ background: '#fff', padding: '10px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 2px' }}>{s.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Body — single column on mobile, two columns on desktop (wide, minimal scroll) */}
              <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? undefined : '1fr 1fr', alignItems: 'start' }}>
              {/* LEFT column: Car details spec grid — all fields from car_listings */}
              <div style={{ borderRight: isMobile ? 'none' : '1px solid #f3f4f6' }}>
              {SPEC_ROWS.length > 0 && (
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 10px' }}>Car Details</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px' }}>
                    {SPEC_ROWS.map((s, i) => (
                      <div key={i}>
                        <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 12, color: '#111827', fontWeight: 500, margin: 0 }}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              </div>{/* /LEFT column */}
              {/* RIGHT column: certifications + actions */}
              <div>
              {/* Certifications & status — clickable to update inline */}
              {u.status === 'in_stock' && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 8px' }}>Certifications &amp; Status</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button onClick={() => handleUpdatePuspakom(u)} title="PUSPAKOM B7 — hire-purchase inspection, valid 30 days. Tap to update." style={plPill(ps.color)}>B7 · {ps.label.replace('B7 ', '')}</button>
                    <button onClick={() => handleUpdateB5(u)} title="PUSPAKOM B5 — ownership-transfer inspection. Tap to update." style={plPill(b5.color)}>B5 · {b5.label.replace('B5 ', '')}</button>
                    <button onClick={() => handleUpdateEncumbrance(u)} title="Tap to cycle: clear → under HP → unknown" style={plPill(enc.color)}>{enc.label}</button>
                    {isUnpublished && (
                      <button onClick={() => handlePublishFromStock(u)} disabled={publishingStockId === u.id}
                        style={{ ...plPill('#dc2626'), fontWeight: 700, cursor: publishingStockId === u.id ? 'default' : 'pointer', opacity: publishingStockId === u.id ? 0.6 : 1 }}>
                        {publishingStockId === u.id ? 'Publishing…' : 'Not published — tap to publish'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Actions — child modals open ON TOP of this drawer (z-10000 > z-9999) */}
              <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 2px' }}>Actions</p>
                {u.status === 'in_stock' && ACTION_BTN('Mark as Sold', 'Record the final sale price and close out this unit', 'primary', null, null, () => setSoldTarget(u))}
                {can('view_gross') && ACTION_BTN('View P&L',         'Full profit breakdown — cost, recon, commission, holding, add-ons', null, null, null, () => fetchPnl(u))}
                {ACTION_BTN('Recon Jobs',        'Log and track all reconditioning work and costs', null, null, null, () => fetchReconJobs(u))}
                {can('view_cost') && ACTION_BTN('Ad Spend',   'Track advertising spend (Mudah, Carsome, Facebook, etc.)', null, null, null, () => openAdSpend(u))}
                {can('view_cost') && ACTION_BTN('Edit Costs','Update purchase price and recon cost (sale price is set on the listing)', null, null, null, () => { setEditPriceUnit(u); setEditPriceForm({ purchase_price: String(u.purchase_price||''), recon_cost: String(u.recon_cost||'') }); })}
                {ACTION_BTN('Activity History',  'See all edits, updates, and status changes for this unit', null, null, null, () => fetchHistory(u))}
              </div>
              </div>{/* /RIGHT column */}
              </div>{/* /body grid */}

              {/* T2-3: editable condition appraisal (full width) */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(17,24,39,0.06)' }}>
                <AppraisalChecklist value={apprDraft} onChange={setApprDraft} />
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => handleSaveAppraisal(u)} disabled={apprSaving}
                    style={{ fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: premiumLight.radius.row, cursor: apprSaving ? 'default' : 'pointer', color: '#fff', background: premiumLight.text, border: 'none', opacity: apprSaving ? 0.6 : 1 }}>
                    {apprSaving ? 'Saving…' : 'Save appraisal'}
                  </button>
                </div>
              </div>

              <div style={{ height: 16 }} />
            </div>
          </div>
        );
      })(), document.body)}

      {/* Mark Sold — the shared popup; the unit's own cost drives a margin rule */}
      {soldTarget && createPortal(
        <div style={{ position: 'relative', zIndex: 10000 }}>
          <MarkSoldModal
            listing={{
              ...(soldTarget.car_listings || {}),
              ...(listings.find(l => l.id === soldTarget.listing_id) || {}),
              id: soldTarget.listing_id || null,
              selling_price: soldTarget.asking_price ?? soldTarget.car_listings?.selling_price ?? null,
            }}
            salesmen={salesmen}
            showDate
            cost={(Number(soldTarget.purchase_price) || 0) + (Number(soldTarget.recon_cost) || 0) || null}
            onClose={() => setSoldTarget(null)}
            onConfirm={handleMarkSold}
            loading={soldSaving}
          />
        </div>
      , document.body)}

      {/* Stock Movement History Modal */}
      {historyUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-gray-900">Movement History</h3>
                <p className="text-xs text-gray-500 mt-0.5">{historyUnit.car_listings?.brand} {historyUnit.car_listings?.model} {historyUnit.car_listings?.year}</p>
              </div>
              <button onClick={() => setHistoryUnit(null)} className="text-gray-500 hover:text-gray-900 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {historyLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No history recorded for this unit.</p>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((log, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: '#111827', fontWeight: 500, margin: 0 }}>{log.summary}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>
                          {log.actor_name}{log.actor_role ? ` · ${log.actor_role}` : ''}{' · '}
                          {new Date(log.created_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Edit Costs Modal */}
      {editPriceUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-2xl w-full max-w-sm" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Edit Costs</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{editPriceUnit.car_listings?.brand} {editPriceUnit.car_listings?.model} {editPriceUnit.car_listings?.year}</p>
              </div>
              <button onClick={() => setEditPriceUnit(null)} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {[['Purchase Price', 'purchase_price'], ['Recon Cost', 'recon_cost']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">RM</span>
                    <input type="number" value={editPriceForm[key]} onChange={e => setEditPriceForm(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400" />
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditPriceUnit(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button onClick={handleSavePrices} disabled={editPriceSaving}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: '#111827', opacity: editPriceSaving ? 0.6 : 1 }}>
                  {editPriceSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* P&L Modal */}
      {pnlUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '80vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Unit P&L</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {pnlUnit.car_listings?.brand} {pnlUnit.car_listings?.model} {pnlUnit.car_listings?.year}
                  {pnlUnit.car_listings?.plate_number || pnlUnit.registration_number ? ` · ${pnlUnit.car_listings?.plate_number || pnlUnit.registration_number}` : ''}
                </p>
              </div>
              <button onClick={() => { setPnlUnit(null); setPnlData(null); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {pnlLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : pnlData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Plain-English verdict — tells the dealer what the number means and why */}
                  {(() => {
                    const v = pnlData;
                    const marginPct = v.revenue > 0 ? (v.netPnl / v.revenue) * 100 : 0;
                    const spread = v.revenue - v.purchasePrice;
                    const spreadPct = v.purchasePrice > 0 ? (spread / v.purchasePrice) * 100 : 0;
                    const loss = v.netPnl < 0;
                    const thin = !loss && marginPct < 5;
                    const reasons = [];
                    if (v.holdingCost > 0 && (v.holdingDays > 60 || v.holdingCost >= Math.abs(v.netPnl) * 0.4))
                      reasons.push(`RM ${v.holdingCost.toLocaleString()} carrying cost from ${v.holdingDays} days on the floor`);
                    if (spread <= v.purchasePrice * 0.03)
                      reasons.push(`only RM ${spread.toLocaleString()} markup over buy price (${spreadPct.toFixed(1)}%)`);
                    if (v.reconEst > 0 && v.reconActual > v.reconEst)
                      reasons.push(`recon overran the estimate by RM ${(v.reconActual - v.reconEst).toLocaleString()}`);
                    if (v.commission > 0 && v.commission >= Math.abs(v.netPnl) * 0.5)
                      reasons.push(`RM ${v.commission.toLocaleString()} sales commission`);
                    if (v.adSpend > 0 && v.adSpend >= Math.abs(v.netPnl) * 0.4)
                      reasons.push(`RM ${v.adSpend.toLocaleString()} ad spend`);
                    // premiumLight: one grey block; only the headline word carries the verdict.
                    const word = loss || thin ? premiumLight.accentText : premiumLight.up;
                    const tone = { bg: premiumLight.raised, bd: 'transparent', tx: premiumLight.textSec, ic: word, head: word };
                    const headline = loss
                      ? `Losing RM ${Math.abs(v.netPnl).toLocaleString()} on this unit`
                      : thin
                        ? `Slim RM ${v.netPnl.toLocaleString()} profit · ${marginPct.toFixed(1)}% margin`
                        : `Healthy RM ${v.netPnl.toLocaleString()} profit · ${marginPct.toFixed(1)}% margin`;
                    const body = reasons.length
                      ? (loss ? 'Driven by ' : 'Watch: ') + reasons.join('; ') + '.'
                      : loss
                        ? 'Costs have eaten through the asking price — reprice up or trim reconditioning.'
                        : `RM ${spread.toLocaleString()} spread over buy price survives all costs.`;
                    const aging = v.holdingDays > 60 && !v.isSold && v.dailyHold > 0;
                    return (
                      <div style={{ background: tone.bg, borderRadius: premiumLight.radius.row, padding: '12px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {loss ? <AlertTriangle style={{ width: 16, height: 16, color: tone.ic, flexShrink: 0 }} />
                                : <TrendingUp style={{ width: 16, height: 16, color: tone.ic, flexShrink: 0 }} />}
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: tone.head }}>{headline}</span>
                        </div>
                        <p style={{ fontSize: 12, color: tone.tx, opacity: 0.92, margin: '6px 0 0', lineHeight: 1.45 }}>{body}</p>
                        {aging && <p style={{ fontSize: 11, color: tone.tx, opacity: 0.82, margin: '5px 0 0', lineHeight: 1.4 }}>Aged {v.holdingDays} days — every extra day adds RM {Math.round(v.dailyHold).toLocaleString()}. Repricing to move it stops the bleed.</p>}
                        {!v.isSold && <p style={{ fontSize: 10.5, color: '#9ca3af', margin: '6px 0 0' }}>Projection based on the current asking price.</p>}
                      </div>
                    );
                  })()}
                  {/* Front end */}
                  <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Front End (Vehicle)</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#374151' }}>{pnlData.isSold ? 'Sale price' : 'Asking price'}</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>RM {pnlData.revenue.toLocaleString()}</span>
                    </div>
                    {[
                      ['Purchase price', pnlData.purchasePrice],
                      ['Recon cost', pnlData.reconCost],
                      ['Included services', pnlData.servicesCost],
                      ['Commission paid', pnlData.commission],
                      ['Handover processing', pnlData.handoverCost],
                      ['Advertising', pnlData.adSpend],
                      [`Holding (${pnlData.holdingDays}d)`, pnlData.holdingCost],
                    ].filter(([, v]) => v > 0).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{ color: premiumLight.textSec }}>− RM {Number(val).toLocaleString()}</span>
                      </div>
                    ))}
                    {/* Recon estimate vs actual reconciliation (DMS-5) — only when an estimate was booked */}
                    {pnlData.reconActual > 0 && pnlData.reconEst > 0 && pnlData.reconActual !== pnlData.reconEst && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2, marginBottom: 3, paddingLeft: 8 }}>
                        <span style={{ color: '#9ca3af' }}>↳ vs RM {pnlData.reconEst.toLocaleString()} estimate</span>
                        <span style={{ color: pnlData.reconActual > pnlData.reconEst ? premiumLight.accentText : premiumLight.up }}>
                          {pnlData.reconActual > pnlData.reconEst ? `+${(pnlData.reconActual - pnlData.reconEst).toLocaleString()} over` : `${(pnlData.reconEst - pnlData.reconActual).toLocaleString()} under`}
                        </span>
                      </div>
                    )}
                    {pnlData.holdingCost > 0 && (
                      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 1, marginBottom: 2, paddingLeft: 8 }}>
                        ↳ RM {Math.round(pnlData.dailyHold).toLocaleString()}/day carrying cost
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
                      <span style={{ color: '#374151' }}>Front gross</span>
                      <span style={{ color: pnlData.frontGross >= 0 ? premiumLight.up : premiumLight.accentText }}>
                        {pnlData.frontGross < 0 ? '− ' : ''}RM {Math.abs(pnlData.frontGross).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Back end */}
                  {(pnlData.addonRevenue > 0 || pnlData.addonCost > 0) && (
                    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Back End (F&I / Add-ons)</p>
                      {pnlData.addonRevenue > 0 && (
                        <>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Sold with ({pnlData.addons.length})</p>
                          {pnlData.addons.map((a, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: '#374151' }}>{a.dealer_products?.name || 'Add-on'}</span>
                              <span style={{ color: '#111827', fontWeight: 600 }}>RM {(Number(a.sold_price) || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {pnlData.addonCost > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#6b7280' }}>Add-on cost</span>
                          <span style={{ color: premiumLight.textSec }}>− RM {pnlData.addonCost.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
                        <span style={{ color: '#374151' }}>Back gross</span>
                        <span style={{ color: pnlData.backGross >= 0 ? premiumLight.up : premiumLight.accentText }}>
                          {pnlData.backGross < 0 ? '− ' : ''}RM {Math.abs(pnlData.backGross).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Net */}
                  <div style={{ padding: '14px 0 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Total Gross</span>
                      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pnlData.netPnl >= 0 ? premiumLight.up : premiumLight.accentText }}>
                        {pnlData.netPnl < 0 ? '− ' : ''}RM {Math.abs(pnlData.netPnl).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Advertising Spend Modal (DMS-6) */}
      {adUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Advertising Spend</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {adUnit.car_listings?.brand || adUnit.brand} {adUnit.car_listings?.model || adUnit.model} {adUnit.car_listings?.year || adUnit.year}
                  {adUnit.car_listings?.plate_number || adUnit.registration_number ? ` · ${adUnit.car_listings?.plate_number || adUnit.registration_number}` : ''}
                </p>
              </div>
              <button onClick={() => { setAdUnit(null); setAdEntries([]); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {/* Add form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <select value={adForm.channel} onChange={e => setAdForm(f => ({ ...f, channel: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', appearance: 'none' }}>
                  {['mudah', 'carlist', 'facebook', 'tiktok', 'instagram', 'other'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <input type="number" value={adForm.amount} onChange={e => setAdForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount (RM)" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                <input type="date" value={adForm.spent_at} onChange={e => setAdForm(f => ({ ...f, spent_at: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none', colorScheme: 'light' }} />
                <input value={adForm.notes} onChange={e => setAdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                <button onClick={handleAddAdSpend} disabled={adSaving} style={{ gridColumn: '1/-1', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 600, cursor: adSaving ? 'default' : 'pointer' }}>{adSaving ? 'Adding…' : 'Add spend'}</button>
              </div>
              {/* List */}
              {adLoading ? (
                <p className="text-gray-500 text-sm text-center py-6">Loading…</p>
              ) : adEntries.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No advertising logged for this car yet.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 10, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>{adEntries.length} entr{adEntries.length === 1 ? 'y' : 'ies'}</span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>Total: RM {adEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}</span>
                  </div>
                  {adEntries.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #f3f4f6', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{e.channel}</span>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{e.spent_at ? new Date(e.spent_at).toLocaleDateString('en-MY') : ''}</span>
                        {e.notes && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{e.notes}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>RM {Number(e.amount).toLocaleString()}</span>
                        <button onClick={() => handleDeleteAdSpend(e.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Recon Job Card Modal */}
      {reconUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Recon Job Card</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {reconUnit.car_listings?.brand} {reconUnit.car_listings?.model} {reconUnit.car_listings?.year}
                  {reconUnit.car_listings?.plate_number || reconUnit.registration_number ? ` · ${reconUnit.car_listings?.plate_number || reconUnit.registration_number}` : ''}
                </p>
              </div>
              <button onClick={() => { setReconUnit(null); setReconJobs([]); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {reconLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : (
                <>
                  {/* Job list */}
                  {reconJobs.length === 0 && !showReconAdd && (
                    <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No recon jobs yet.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {reconJobs.map(job => {
                      const statusColor = job.status === 'done' ? '#34d399' : job.status === 'in_progress' ? '#f59e0b' : '#9ca3af';
                      const cat = RECON_CATS.find(c => c.value === job.category)?.label || job.category;
                      return (
                        <div key={job.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{job.title}</p>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#6b7280' }}>{cat}</span>
                                {job.vendor && <span style={{ fontSize: 10, color: '#6b7280' }}>· {job.vendor}</span>}
                                {job.cost != null && <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>RM {Number(job.cost).toLocaleString()}</span>}
                                {job.eta_date && <span style={{ fontSize: 10, color: '#9ca3af' }}>ETA {new Date(job.eta_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                            </div>
                            <select value={job.status} onChange={e => handleReconStatus(job.id, e.target.value)}
                              style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: '#eceef1', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', appearance: 'none', outline: 'none' }}>
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  {reconJobs.length > 0 && (() => {
                    const totalCost = reconJobs.reduce((s, j) => s + (Number(j.cost) || 0), 0);
                    const done = reconJobs.filter(j => j.status === 'done').length;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                        <span style={{ color: '#6b7280' }}>{done}/{reconJobs.length} jobs done</span>
                        {totalCost > 0 && <span style={{ fontWeight: 600, color: '#111827' }}>Total: RM {totalCost.toLocaleString()}</span>}
                      </div>
                    );
                  })()}

                  {/* Add job form */}
                  {showReconAdd ? (
                    <div style={{ background: premiumLight.raised, borderRadius: premiumLight.radius.row, padding: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: premiumLight.textSec, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New Recon Job</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input value={reconForm.title} onChange={e => setReconForm(f => ({ ...f, title: e.target.value }))} placeholder="Job title *" style={{ gridColumn: '1/-1', ...{ width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' } }} />
                        <select value={reconForm.category} onChange={e => setReconForm(f => ({ ...f, category: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', appearance: 'none' }}>
                          {RECON_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <input value={reconForm.vendor} onChange={e => setReconForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor / workshop" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                        <input type="number" value={reconForm.cost} onChange={e => setReconForm(f => ({ ...f, cost: e.target.value }))} placeholder="Cost (RM)" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                        <input type="date" value={reconForm.eta_date} onChange={e => setReconForm(f => ({ ...f, eta_date: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none', colorScheme: 'light' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => setShowReconAdd(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleAddReconJob} disabled={reconSaving} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: reconSaving ? 0.6 : 1 }}>
                          {reconSaving ? 'Saving…' : 'Add Job'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowReconAdd(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px', borderRadius: premiumLight.radius.row, background: premiumLight.raised, border: 'none', color: premiumLight.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Add Recon Job
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Import Stock from CSV</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Columns: brand/make, model, year, plate/reg, purchase_price, recon_cost, asking_price</p>
              </div>
              <button onClick={() => { setShowCsvImport(false); setCsvRows([]); setCsvError(''); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {csvRows.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                  <button onClick={() => csvInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: premiumLight.raised, border: '2px dashed #d1d5db', borderRadius: premiumLight.radius.row, color: premiumLight.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Upload style={{ width: 16, height: 16 }} />Choose CSV File
                  </button>
                  {csvError && <p style={{ fontSize: 12, color: '#dc2626', textAlign: 'center' }}>{csvError}</p>}
                  <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', maxWidth: 360 }}>
                    First row must be a header. Recognised columns: brand, make, model, year, plate, reg, purchase_price, cost, recon_cost, asking_price, selling_price.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{csvRows.length} units to import</span>
                    <button onClick={() => { setCsvRows([]); setCsvError(''); csvInputRef.current?.click(); }} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Change file</button>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                          {['Brand','Model','Year','Plate','Buy Price','Recon','Asking'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 20).map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                            {[r.brand, r.model, r.year, r.plate_number,
                              r.purchase_price ? `RM ${r.purchase_price.toLocaleString()}` : '—',
                              r.recon_cost ? `RM ${r.recon_cost.toLocaleString()}` : '—',
                              r.asking_price ? `RM ${r.asking_price.toLocaleString()}` : '—',
                            ].map((v, j) => (
                              <td key={j} style={{ padding: '7px 12px', color: v && v !== '—' ? '#111827' : '#9ca3af' }}>{v || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvRows.length > 20 && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Showing first 20 of {csvRows.length} rows.</p>}
                </>
              )}
            </div>
            {csvRows.length > 0 && (
              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button onClick={() => { setShowCsvImport(false); setCsvRows([]); }} style={{ flex: 1, padding: '9px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCsvImport} disabled={csvSaving} style={{ flex: 2, padding: '9px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: csvSaving ? 0.6 : 1 }}>
                  {csvSaving ? 'Importing…' : `Import ${csvRows.length} Units`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendors Modal */}
      {showVendors && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Vendor / Supplier Directory</h3>
              <button onClick={() => { setShowVendors(false); setShowVendorAdd(false); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {vendorsLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : (
                <>
                  {vendors.length === 0 && !showVendorAdd && (
                    <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No vendors yet.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {vendors.map(v => {
                      const cat = VENDOR_CATS.find(c => c.value === v.category)?.label || v.category;
                      return (
                        <div key={v.id} style={{ background: v.is_active ? '#f9fafb' : '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', opacity: v.is_active ? 1 : 0.6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 3px' }}>{v.name}</p>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
                                <span>{cat}</span>
                                {v.phone && <a href={`tel:${v.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{v.phone}</a>}
                                {v.contact && <span>{v.contact}</span>}
                              </div>
                              {v.notes && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{v.notes}</p>}
                            </div>
                            <button onClick={() => handleToggleVendor(v.id, !v.is_active)} style={{ fontSize: 10, fontWeight: 600, color: v.is_active ? premiumLight.up : premiumLight.textMuted, background: premiumLight.raised, border: 'none', borderRadius: 999, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                              {v.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {showVendorAdd ? (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New Vendor</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} placeholder="Vendor name *" style={{ gridColumn: '1/-1', ...{ width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' } }} />
                        <select value={vendorForm.category} onChange={e => setVendorForm(f => ({ ...f, category: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', appearance: 'none' }}>
                          {VENDOR_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <PhoneInput value={vendorForm.phone} onChange={v => setVendorForm(f => ({ ...f, phone: v }))} placeholder="Phone" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }} prefixStyle={{ padding: '0 4px 0 12px', color: '#6b7280' }} inputStyle={{ padding: '8px 12px 8px 0' }} />
                        <input value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} placeholder="Contact person" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                        <input value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" style={{ gridColumn: '1/-1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => setShowVendorAdd(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleAddVendor} disabled={vendorSaving} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#0369a1', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: vendorSaving ? 0.6 : 1 }}>
                          {vendorSaving ? 'Saving…' : 'Add Vendor'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowVendorAdd(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px', borderRadius: 8, background: '#f0f9ff', border: '1px dashed #7dd3fc', color: '#0369a1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Add Vendor
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Stock Publish — CarForm overlay (z-11000, above detail drawer z-9999 + child modals z-10000) */}
      {stockPublishListing && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 920, background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', minHeight: 'min-content', marginBottom: 20 }}>
            <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setStockPublishListing(null)} style={{ padding: '6px 10px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Complete listing — {stockPublishListing.brand} {stockPublishListing.model} {stockPublishListing.year}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Add photos, location, and details. Saving will publish this car to your marketplace.</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px 24px' }}>
              <React.Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading form…</div>}>
                <CarForm
                  listing={stockPublishListing}
                  defaultValues={{ state: profile?.state || '', city: profile?.city || '' }}
                  onBack={() => setStockPublishListing(null)}
                  onUpdate={handleStockPublishSave}
                />
              </React.Suspense>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
});

export default StockTab;
