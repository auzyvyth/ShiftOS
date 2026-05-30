import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, MessageCircle, Phone, Calendar, Trash2, ExternalLink, User,
  Pencil, Check, ChevronRight, ChevronDown, ChevronUp, Send, Search,
  AlertTriangle, FileText, Plus, Package, Link, Copy, Presentation, CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabaseClient';
import LeadSourceBadge from './LeadSourceBadge';
import { useLeadActivities } from '../../hooks/useLeadActivities';
import {
  formatWhatsAppURL, calcInstalment, getLeadAgeDays, ageTextColor,
  STAGE_ORDER, STAGE_CONFIG, LOST_REASONS, WHATSAPP_TEMPLATES,
  getInitials, avatarGradient,
} from '../../lib/leadsHelpers';

// ─── Shared input style ────────────────────────────────────────────────────────
const inp = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 6, padding: '9px 13px', color: 'white', fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
};
const focusRed = { borderColor: 'rgba(220,38,38,0.4)' };

// ─── HP / Financing constants ──────────────────────────────────────────────────
const MY_BANKS = ['Maybank','CIMB','Public Bank','RHB','Hong Leong','AmBank','Alliance','Affin','BSN','Bank Rakyat','MBSB','Al Rajhi'];
const TENURES  = [12,24,36,48,60,72,84,96];
const HP_STATUS_CFG = {
  pending:   { label: 'Pending',   color: '#f59e0b' },
  approved:  { label: 'Approved',  color: '#34d399' },
  rejected:  { label: 'Rejected',  color: '#f87171' },
  disbursed: { label: 'Disbursed', color: '#60a5fa' },
};
const calcEIR = (principal, annualRate, months) => {
  if (!principal || !months) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r / (1 - Math.pow(1 + r, -months));
};

// ─── Section label ─────────────────────────────────────────────────────────────
function SLabel({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 10px' }}>
      {children}
    </p>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '20px 0' }} />;
}

// ─── Activity types for manual logging ────────────────────────────────────────
const ACTIVITY_TYPES = [
  { value: 'called',           label: 'Called' },
  { value: 'whatsapp_sent',    label: 'WhatsApp Sent' },
  { value: 'visited_showroom', label: 'Visited Showroom' },
  { value: 'made_offer',       label: 'Made Offer' },
  { value: 'sent_quote',       label: 'Sent Quote' },
  { value: 'note_added',       label: 'Note / Other' },
];

const ACT_CFG = {
  created:          { color: '#34d399', label: 'Lead Created' },
  stage_changed:    { color: '#60a5fa', label: 'Stage Changed' },
  note_added:       { color: '#9ca3af', label: 'Note' },
  assigned:         { color: '#a78bfa', label: 'Assigned' },
  whatsapp_sent:    { color: '#34d399', label: 'WhatsApp Sent' },
  called:           { color: '#60a5fa', label: 'Called' },
  visited_showroom: { color: '#fbbf24', label: 'Showroom Visit' },
  made_offer:       { color: '#fb923c', label: 'Made Offer' },
  sent_quote:       { color: '#c084fc', label: 'Quote Sent' },
};

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60)    return 'just now';
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ─── Road tax estimate (JPJ, private, Peninsular saloon) ─────────────────────
function calcRoadTaxEst(cc) {
  const c = parseFloat(cc);
  if (!c || c <= 0) return 0;
  if (c <= 1000) return 20;
  if (c <= 1200) return 55;
  if (c <= 1400) return 70;
  if (c <= 1600) return 90;
  if (c <= 1800) return Math.round(200 + (c - 1600) * 0.40);
  if (c <= 2000) return Math.round(280 + (c - 1800) * 1.00);
  if (c <= 2500) return Math.round(480 + (c - 2000) * 2.00);
  if (c <= 3000) return Math.round(1480 + (c - 2500) * 3.00);
  return Math.round(2980 + (c - 3000) * 4.00);
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export default function LeadDrawer({ lead: initialLead, onClose, onUpdate, onDelete, teamMembers = [] }) {
  const [lead, setLead]               = useState(initialLead);
  const [editingField, setEditingField] = useState(null); // 'name' | 'phone'
  const [editVal, setEditVal]         = useState('');
  const [followUpDate, setFollowUpDate] = useState(initialLead?.follow_up_at || '');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [assignedTo, setAssignedTo]   = useState(initialLead?.assigned_to || '');
  const [notes, setNotes]             = useState(initialLead?.notes || '');
  const [notesSaved, setNotesSaved]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const [showLossPanel, setShowLossPanel] = useState(false);
  const [selectedLossReason, setSelectedLossReason] = useState('');
  const [lossNotes, setLossNotes]     = useState('');
  const [savingLoss, setSavingLoss]   = useState(false);
  const [pendingStage, setPendingStage] = useState(null);
  const [carSearch, setCarSearch]     = useState('');
  const [carResults, setCarResults]   = useState([]);
  const [carSearching, setCarSearching] = useState(false);
  const [showCarSearch, setShowCarSearch] = useState(false);
  const [logType, setLogType]         = useState('note_added');
  const [logNote, setLogNote]         = useState('');
  const [logging, setLogging]         = useState(false);
  const [focusedInp, setFocusedInp]   = useState(null);

  // Add-ons state
  const [dealAddons, setDealAddons]         = useState([]);
  const [catalogueProducts, setCatalogueProducts] = useState([]);
  const [addonsLoading, setAddonsLoading]   = useState(false);
  const [addonsOpen, setAddonsOpen]         = useState(false);
  const [showAttach, setShowAttach]         = useState(false);
  const [addonForm, setAddonForm]           = useState({ product_id: '', sold_price: '', notes: '' });
  const [attachSaving, setAttachSaving]     = useState(false);

  // Deal sheet state
  const [dealLink, setDealLink]             = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [dealLinkCopied, setDealLinkCopied] = useState(false);
  const [minsLeft, setMinsLeft]             = useState(null);
  const [dealFees, setDealFees]             = useState({ road_tax: '', insurance: '', puspakom: '150' });

  // HP / Financing state
  const [hpRows, setHpRows]     = useState([]);
  const [hpOpen, setHpOpen]     = useState(false);
  const [showAddHP, setShowAddHP] = useState(false);
  const [hpForm, setHpForm]     = useState({ bank: '', amount: '', tenure: 84, rate: 3.5, notes: '' });
  const [hpSaving, setHpSaving] = useState(false);

  const notesDebounce = useRef(null);
  const { activities, loading: actLoading, addActivity } = useLeadActivities(lead?.id, lead?.dealer_id);

  useEffect(() => {
    if (!minsLeft) return;
    const id = setInterval(() => setMinsLeft(m => (m > 0 ? m - 1 : 0)), 60000);
    return () => clearInterval(id);
  }, [!!minsLeft]);

  // Sync when parent updates
  useEffect(() => {
    setLead(initialLead);
    setFollowUpDate(initialLead?.follow_up_at || '');
    setAssignedTo(initialLead?.assigned_to || '');
    setNotes(initialLead?.notes || '');
  }, [initialLead]);

  // ESC to close
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Fetch catalogue, attached add-ons, and HP submissions
  useEffect(() => {
    if (!lead?.id || !lead?.dealer_id) return;
    const fetch = async () => {
      setAddonsLoading(true);
      const [catRes, dealRes, hpRes] = await Promise.all([
        supabase.from('dealer_products').select('id, name, category, selling_price').eq('dealer_id', lead.dealer_id).eq('is_active', true).order('name'),
        supabase.from('deal_products').select('id, sold_price, notes, product_id, dealer_products(name, category)').eq('lead_id', lead.id),
        supabase.from('deal_financing').select('*').eq('lead_id', lead.id).order('submitted_at', { ascending: false }),
      ]);
      setCatalogueProducts(catRes.data || []);
      setDealAddons(dealRes.data || []);
      setHpRows(hpRes.data || []);
      setAddonsLoading(false);
    };
    fetch();
  }, [lead?.id, lead?.dealer_id]);

  const handleAttachAddon = async () => {
    if (!addonForm.product_id || !addonForm.sold_price) { return; }
    setAttachSaving(true);
    try {
      const { data, error } = await supabase.from('deal_products').insert({
        dealer_id:  lead.dealer_id,
        lead_id:    lead.id,
        listing_id: lead.car_listing_id || null,
        product_id: addonForm.product_id,
        sold_price: Number(addonForm.sold_price),
        notes:      addonForm.notes.trim() || null,
      }).select('id, sold_price, notes, product_id, dealer_products(name, category)').single();
      if (error) throw error;
      if (data) setDealAddons(p => [...p, data]);
      setAddonForm({ product_id: '', sold_price: '', notes: '' });
      setShowAttach(false);
      toast.success('Add-on attached');
    } catch (err) {
      if (err?.message?.includes('Out of stock')) {
        toast.error('This product is out of stock');
      } else {
        toast.error('Failed to attach add-on');
      }
    }
    setAttachSaving(false);
  };

  const handleRemoveAddon = async (id) => {
    await supabase.from('deal_products').delete().eq('id', id);
    setDealAddons(p => p.filter(a => a.id !== id));
    toast.success('Removed');
  };

  const hpInstalment = useMemo(() => calcEIR(Number(hpForm.amount), hpForm.rate, hpForm.tenure), [hpForm.amount, hpForm.rate, hpForm.tenure]);

  const handleAddHP = async () => {
    if (!hpForm.bank || !hpForm.amount || Number(hpForm.amount) <= 0) { toast.error('Bank and loan amount required'); return; }
    setHpSaving(true);
    const car = lead?.car_listing;
    const { data, error } = await supabase.from('deal_financing').insert({
      dealer_id: lead.dealer_id, lead_id: lead.id, listing_id: lead.car_listing_id || null,
      bank_name: hpForm.bank, loan_amount: Number(hpForm.amount), tenure_months: hpForm.tenure,
      annual_rate_pct: hpForm.rate, monthly_install: Math.round(hpInstalment),
      margin_pct: car?.selling_price ? Number(((Number(hpForm.amount) / car.selling_price) * 100).toFixed(1)) : null,
      notes: hpForm.notes.trim() || null, submitted_at: new Date().toISOString(),
    }).select().single();
    if (error) { toast.error('Failed to add HP submission'); } else {
      setHpRows(p => [data, ...p]);
      setShowAddHP(false);
      setHpForm({ bank: '', amount: '', tenure: 84, rate: 3.5, notes: '' });
      toast.success('HP submission added');
    }
    setHpSaving(false);
  };

  const handleUpdateHPStatus = async (id, status) => {
    const patch = { status };
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    if (status === 'disbursed') patch.disbursed_at = new Date().toISOString();
    const { error } = await supabase.from('deal_financing').update(patch).eq('id', id);
    if (!error) setHpRows(p => p.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const handleGenerateDealLink = async () => {
    if (!car || !lead?.dealer_id) return;
    setGeneratingLink(true);
    try {
      const { data: dealerProfile } = await supabase
        .from('profiles')
        .select('site_name, brand_color, whatsapp_number')
        .eq('id', lead.dealer_id)
        .maybeSingle();

      const { data: fullCar } = await supabase
        .from('car_listings')
        .select('brand, model, year, selling_price, images, city, state, mileage, transmission, fuel_type, included_services, engine_cc')
        .eq('id', car.id)
        .maybeSingle();

      // Auto-fill road tax from engine CC if not yet set
      let fees = { ...dealFees };
      if (!fees.road_tax && fullCar?.engine_cc) {
        const rt = calcRoadTaxEst(fullCar.engine_cc);
        if (rt > 0) {
          fees = { ...fees, road_tax: String(rt) };
          setDealFees(fees);
        }
      }

      const addonsTotal = dealAddons.reduce((s, a) => s + Number(a.sold_price), 0);
      const feesTotal = Number(fees.road_tax || 0) + Number(fees.insurance || 0) + Number(fees.puspakom || 0);
      const carPrice = Number(fullCar?.selling_price || car.selling_price || 0);
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Best HP row: disbursed > approved > pending > first
      const bestHp = hpRows.find(r => r.status === 'disbursed')
        || hpRows.find(r => r.status === 'approved')
        || hpRows[0] || null;

      const snapshot = {
        car: {
          brand: fullCar?.brand || car.brand,
          model: fullCar?.model || car.model,
          year:  fullCar?.year  || car.year,
          selling_price: carPrice,
          images: fullCar?.images || car.images || [],
          city:   fullCar?.city  || car.city,
          state:  fullCar?.state || car.state,
          mileage: fullCar?.mileage,
          transmission: fullCar?.transmission,
          fuel_type: fullCar?.fuel_type,
          included_services: fullCar?.included_services || [],
          engine_cc: fullCar?.engine_cc || null,
        },
        dealer: {
          name: dealerProfile?.site_name || 'Dealership',
          brand_color: dealerProfile?.brand_color || '#dc2626',
          whatsapp: dealerProfile?.whatsapp_number || null,
        },
        addons: dealAddons.map(a => ({
          name:     a.dealer_products?.name || '',
          category: a.dealer_products?.category || 'other',
          price:    Number(a.sold_price),
        })),
        fees: {
          road_tax:  Number(fees.road_tax  || 0),
          insurance: Number(fees.insurance || 0),
          puspakom:  Number(fees.puspakom  || 0),
        },
        financing: bestHp ? {
          bank:           bestHp.bank_name,
          loan_amount:    bestHp.loan_amount,
          tenure_months:  bestHp.tenure_months,
          annual_rate_pct: bestHp.annual_rate_pct,
          monthly_install: bestHp.monthly_install,
          status:         bestHp.status,
        } : null,
        car_price:    carPrice,
        addons_total: addonsTotal,
        fees_total:   feesTotal,
        grand_total:  carPrice + addonsTotal + feesTotal,
        generated_at: new Date().toISOString(),
        expires_at:   expiresAt,
      };

      const { error } = await supabase
        .from('leads')
        .update({ deal_token: token, deal_token_expires_at: expiresAt, deal_snapshot: snapshot })
        .eq('id', lead.id);

      if (error) { toast.error('Failed to generate link'); return; }

      const url = `${window.location.origin}/deal/${token}`;
      setDealLink(url);
      setMinsLeft(60);
      toast.success('Deal sheet ready');
    } finally {
      setGeneratingLink(false);
    }
  };

  if (!lead) return null;

  const days     = getLeadAgeDays(lead.created_at);
  const ageCls   = ageTextColor(days);
  const car      = lead.car_listing;
  const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const instalment = car?.selling_price ? calcInstalment(car.selling_price) : null;
  const carThumb   = car?.images?.[0] || null;
  const initials   = getInitials(lead.buyer_name);
  const avatarBg   = avatarGradient(lead.lead_source);
  const stageCfg   = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.new;
  const currentStageIdx = STAGE_ORDER.indexOf(lead.stage);
  const nextStage  = currentStageIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentStageIdx + 1] : null;
  const isTerminal = lead.stage === 'won' || lead.stage === 'lost' || lead.stage === 'closed_won' || lead.stage === 'closed_lost';

  // ── Inline edit ──────────────────────────────────────────────────────────────
  function startEdit(field) {
    setEditingField(field);
    setEditVal(field === 'name' ? lead.buyer_name : lead.phone);
  }

  async function saveEdit() {
    if (!editVal.trim() || editingField === null) { setEditingField(null); return; }
    const field = editingField;
    const payload = field === 'name' ? { buyer_name: editVal.trim() } : { phone: editVal.trim() };
    setEditingField(null);
    try {
      const updated = await onUpdate(lead.id, payload);
      setLead(p => ({ ...p, ...payload, ...(updated || {}) }));
    } catch { toast.error('Failed to save'); }
  }

  // ── Stage change — optimistic, fire-and-forget ───────────────────────────────
  function handleStageChange(newStage) {
    if (newStage === lead.stage) return;
    if (newStage === 'lost') {
      setPendingStage('lost');
      setShowLossPanel(true);
      return;
    }
    const oldStage = lead.stage;
    setLead(p => ({ ...p, stage: newStage })); // instant
    onUpdate(lead.id, { stage: newStage })
      .then(updated => {
        if (updated) setLead(updated);
        addActivity({ activity_type: 'stage_changed', from_stage: oldStage, to_stage: newStage }).catch(() => {});
        if (newStage === 'won') toast.success('Lead marked as Won!');
      })
      .catch(() => {
        setLead(p => ({ ...p, stage: oldStage }));
        toast.error('Error saving — please try again');
      });
  }

  async function confirmLoss() {
    if (!selectedLossReason) { toast.error('Please select a reason'); return; }
    setSavingLoss(true);
    const oldStage = lead.stage;
    try {
      const updated = await onUpdate(lead.id, { stage: 'lost', loss_reason: selectedLossReason, loss_notes: lossNotes || null });
      setLead(p => ({ ...p, stage: 'lost', ...(updated || {}) }));
      await addActivity({ activity_type: 'stage_changed', from_stage: oldStage, to_stage: 'lost', note: `Lost: ${selectedLossReason}` });
      setShowLossPanel(false);
      toast.success('Lead marked as lost');
    } catch { toast.error('Error saving'); }
    finally { setSavingLoss(false); }
  }

  // ── Follow-up ────────────────────────────────────────────────────────────────
  async function saveFollowUp(val) {
    setFollowUpDate(val);
    setSavingFollowUp(true);
    try {
      const updated = await onUpdate(lead.id, { follow_up_at: val || null });
      if (updated) setLead(updated);
      toast.success('Follow-up saved');
    } catch { toast.error('Error saving'); }
    finally { setSavingFollowUp(false); }
  }

  // ── Assign salesman ──────────────────────────────────────────────────────────
  async function handleAssign(uid) {
    setAssignedTo(uid);
    try {
      const updated = await onUpdate(lead.id, { assigned_to: uid || null });
      if (updated) setLead(updated);
      const name = teamMembers.find(m => m.id === uid)?.full_name || 'nobody';
      await addActivity({ activity_type: 'assigned', note: `Assigned to ${name}` });
      toast.success('Assigned');
    } catch { toast.error('Error saving'); }
  }

  // ── Notes auto-save ──────────────────────────────────────────────────────────
  function handleNotesChange(val) {
    setNotes(val);
    setNotesSaved(false);
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      try {
        await onUpdate(lead.id, { notes: val });
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 1500);
      } catch { /* silent */ }
    }, 800);
  }

  // ── Car search & link ────────────────────────────────────────────────────────
  async function searchCars(q) {
    if (!lead?.dealer_id) return;
    setCarSearching(true);
    const { data } = await supabase
      .from('car_listings')
      .select('id, brand, model, year, selling_price, images, city, state, slug')
      .eq('dealer_id', lead.dealer_id)
      .neq('status', 'sold')
      .or(`brand.ilike.%${q}%,model.ilike.%${q}%`)
      .limit(8);
    setCarResults(data || []);
    setCarSearching(false);
  }

  async function linkCar(carId) {
    try {
      const updated = await onUpdate(lead.id, { car_listing_id: carId });
      if (updated) setLead(updated);
      else {
        // Fetch the car to display it
        const { data } = await supabase.from('car_listings').select('id,brand,model,year,selling_price,images,city,state,slug').eq('id', carId).maybeSingle();
        setLead(p => ({ ...p, car_listing_id: carId, car_listing: data }));
      }
      setShowCarSearch(false);
      setCarSearch('');
      toast.success('Car linked');
    } catch { toast.error('Error linking car'); }
  }

  // ── Manual activity log ──────────────────────────────────────────────────────
  async function handleLog() {
    if (!logNote.trim()) { toast.error('Enter a note'); return; }
    setLogging(true);
    try {
      await addActivity({ activity_type: logType, note: logNote.trim() });
      setLogNote('');
      toast.success('Activity logged');
    } catch { toast.error('Error logging'); }
    finally { setLogging(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(lead.id);
      toast.success('Lead deleted');
      onClose();
    } catch {
      toast.error('Error deleting');
      setDeleting(false);
    }
  }

  // ── WhatsApp template open ────────────────────────────────────────────────────
  function openTemplate(tpl) {
    const msg = tpl.message(lead, car);
    window.open(`https://wa.me/${formatWhatsAppURL(lead.phone).replace('https://wa.me/', '')}?text=${encodeURIComponent(msg)}`, '_blank');
    addActivity({ activity_type: 'whatsapp_sent', note: `Sent: ${tpl.label}` }).catch(() => {});
  }

  // ── Follow-up overdue calc ────────────────────────────────────────────────────
  let fuOverdueDays = 0;
  if (followUpDate) {
    const today = new Date(); today.setHours(0,0,0,0);
    const fd    = new Date(followUpDate); fd.setHours(0,0,0,0);
    fuOverdueDays = Math.round((today - fd) / 86400000);
  }

  // ── White modal styles ──────────────────────────────────────────────────────
  const w = {
    inp: { width: '100%', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 13px', color: '#111827', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' },
    label: { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 8px', display: 'block' },
    section: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 12 },
    divider: { height: 1, background: '#f1f3f5', margin: '16px 0' },
  };

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose} />

      {/* Centered modal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div style={{ width: '100%', maxWidth: 700, maxHeight: '92vh', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif", animation: 'ldPop 0.16s ease', pointerEvents: 'auto' }}>
          <style>{`
            @keyframes ldPop { from { transform: scale(0.97); opacity:0; } to { transform:scale(1); opacity:1; } }
            .ld-inp:focus { border-color: #dc2626 !important; outline: none; }
          `}</style>

          {/* ── HEADER ── */}
          <div style={{ padding: '20px 20px 0', background: '#fff', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              {/* Avatar */}
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0, letterSpacing: '-0.5px' }}>
                {initials}
              </div>

              {/* Name + phone + badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  {editingField === 'name' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null); }}
                      style={{ ...w.inp, padding: '3px 8px', fontSize: 17, fontWeight: 600, flex: 1 }} className="ld-inp" />
                  ) : (
                    <>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{lead.buyer_name}</h2>
                      <button onClick={() => startEdit('name')} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#d1d5db', flexShrink: 0 }}>
                        <Pencil style={{ width: 12, height: 12 }} />
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {editingField === 'phone' ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null); }}
                      style={{ ...w.inp, padding: '2px 8px', fontSize: 13, width: 180 }} className="ld-inp" />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <a href={`tel:${lead.phone}`} style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>{lead.phone || '—'}</a>
                      <button onClick={() => startEdit('phone')} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#d1d5db' }}>
                        <Pencil style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  )}
                  <LeadSourceBadge source={lead.lead_source} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{days === 0 ? 'Today' : `${days}d ago`}</span>
                </div>
              </div>

              {/* Close */}
              <button onClick={onClose} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <a href={formatWhatsAppURL(lead.phone)} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                <MessageCircle style={{ width: 13, height: 13 }} />WhatsApp
              </a>
              <a href={`tel:${lead.phone}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                <Phone style={{ width: 13, height: 13 }} />Call
              </a>
              {nextStage && !isTerminal && (
                <button onClick={() => handleStageChange(nextStage)}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <ChevronRight style={{ width: 13, height: 13 }} />Move to {STAGE_CONFIG[nextStage]?.label}
                </button>
              )}
            </div>

            {/* Stage progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0 16px', borderTop: '1px solid #f1f3f5', overflowX: 'auto', gap: 0, scrollbarWidth: 'none' }}>
              {STAGE_ORDER.filter(s => s !== 'lost').map((s, i, arr) => {
                const cfg = STAGE_CONFIG[s];
                const active = s === lead.stage;
                const past = STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(lead.stage) && lead.stage !== 'lost';
                const isLast = i === arr.length - 1;
                return (
                  <React.Fragment key={s}>
                    <button onClick={() => handleStageChange(s)} title={cfg.label}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${active ? cfg.headerBorder : past ? '#d1d5db' : '#e5e7eb'}`, background: active ? cfg.headerBorder : past ? '#f3f4f6' : '#fff', transition: 'all 0.15s' }}>
                        {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                        {past && <Check style={{ width: 11, height: 11, color: '#9ca3af' }} />}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? cfg.headerBorder : '#9ca3af', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{cfg.label}</span>
                    </button>
                    {!isLast && <div style={{ flex: 1, height: 1, background: past ? '#d1d5db' : '#e5e7eb', minWidth: 8, marginBottom: 18 }} />}
                  </React.Fragment>
                );
              })}
              {/* Lost pill */}
              <button onClick={() => handleStageChange('lost')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 48, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${lead.stage === 'lost' ? '#dc2626' : '#fee2e2'}`, background: lead.stage === 'lost' ? '#dc2626' : '#fff' }}>
                  {lead.stage === 'lost' && <X style={{ width: 10, height: 10, color: '#fff' }} />}
                </div>
                <span style={{ fontSize: 9, fontWeight: lead.stage === 'lost' ? 700 : 500, color: lead.stage === 'lost' ? '#dc2626' : '#fca5a5', whiteSpace: 'nowrap' }}>Lost</span>
              </button>
            </div>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 20px 24px', background: '#f9fafb' }}>

            {/* Loss reason panel */}
            {showLossPanel && (
              <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>Why was this lead lost?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {LOST_REASONS.map(r => (
                    <button key={r} onClick={() => setSelectedLossReason(r)}
                      style={{ padding: '7px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, textAlign: 'left', cursor: 'pointer', background: selectedLossReason === r ? '#fef2f2' : '#f9fafb', border: selectedLossReason === r ? '1px solid #fca5a5' : '1px solid #e5e7eb', color: selectedLossReason === r ? '#dc2626' : '#374151' }}>
                      {r}
                    </button>
                  ))}
                </div>
                <textarea placeholder="Optional notes…" value={lossNotes} onChange={e => setLossNotes(e.target.value)} rows={2} style={{ ...w.inp, resize: 'none', marginBottom: 10 }} className="ld-inp" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowLossPanel(false); setPendingStage(null); setSelectedLossReason(''); }} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={confirmLoss} disabled={savingLoss || !selectedLossReason} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#dc2626', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !selectedLossReason ? 0.5 : 1 }}>
                    {savingLoss ? 'Saving…' : 'Confirm Loss'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Info strip: Assign + Follow-up ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {teamMembers.length > 0 && (
                <div style={{ flex: 1 }}>
                  <p style={w.label}>Assigned To</p>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} />
                    <select value={assignedTo} onChange={e => handleAssign(e.target.value)} style={{ ...w.inp, paddingLeft: 30, appearance: 'none', cursor: 'pointer' }} className="ld-inp">
                      <option value="">— Unassigned —</option>
                      {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={w.label}>Follow-up</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="datetime-local" value={followUpDate ? followUpDate.slice(0, 16) : ''} onChange={e => setFollowUpDate(e.target.value)}
                    style={{ ...w.inp, flex: 1, colorScheme: 'light' }} className="ld-inp" />
                  <button onClick={() => saveFollowUp(followUpDate)} disabled={savingFollowUp}
                    style={{ padding: '9px 12px', borderRadius: 8, background: '#dc2626', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: savingFollowUp ? 0.6 : 1 }}>
                    {savingFollowUp ? '…' : 'Set'}
                  </button>
                  {followUpDate && <button onClick={() => saveFollowUp('')} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>}
                </div>
                {fuOverdueDays > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, padding: '5px 9px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <AlertTriangle style={{ width: 11, height: 11, color: '#dc2626' }} />
                    <span style={{ fontSize: 11, color: '#dc2626' }}>Overdue by {fuOverdueDays}d</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Car of Interest ── */}
            <div style={w.section}>
              <p style={w.label}>Car of Interest</p>
              {car ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {carThumb && <img src={carThumb} alt={carLabel} loading="lazy" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{carLabel}</p>
                    {car.selling_price && <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: 0 }}>RM {Number(car.selling_price).toLocaleString()}</p>}
                    {instalment && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Est. RM {instalment.toLocaleString()}/mo</p>}
                  </div>
                  {car.slug && <a href={`/cars/${car.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', flexShrink: 0 }}><ExternalLink style={{ width: 14, height: 14 }} /></a>}
                </div>
              ) : (
                <>
                  {!showCarSearch ? (
                    <button onClick={() => setShowCarSearch(true)} style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>
                      + Link a car
                    </button>
                  ) : (
                    <div>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#9ca3af', pointerEvents: 'none' }} />
                        <input autoFocus value={carSearch} onChange={e => { setCarSearch(e.target.value); if (e.target.value.length > 0) searchCars(e.target.value); }}
                          placeholder="Search brand or model…" style={{ ...w.inp, paddingLeft: 32 }} className="ld-inp" />
                      </div>
                      {carSearching && <p style={{ fontSize: 11, color: '#9ca3af' }}>Searching…</p>}
                      {carResults.map(c => (
                        <button key={c.id} onClick={() => linkCar(c.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', marginBottom: 4, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ fontSize: 12, color: '#111827' }}>{c.year} {c.brand} {c.model}</span>
                          {c.selling_price && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>RM {c.selling_price.toLocaleString()}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Notes ── */}
            <div style={w.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ ...w.label, margin: 0 }}>Notes</p>
                {notesSaved && <span style={{ fontSize: 10, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}><Check style={{ width: 10, height: 10 }} />Saved</span>}
              </div>
              <textarea value={notes} onChange={e => handleNotesChange(e.target.value)} placeholder="Add notes about this lead…" rows={3}
                style={{ ...w.inp, resize: 'vertical', minHeight: 72 }} className="ld-inp" />
            </div>

            {/* ── HP / Financing ── */}
            <div style={w.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ ...w.label, margin: 0 }}>HP / Financing</p>
                {hpRows.some(r => r.status === 'pending') && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 7px' }}>
                    {hpRows.filter(r => r.status === 'pending').length} pending
                  </span>
                )}
              </div>
              {addonsLoading ? <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</p> : (
                <>
                  {hpRows.map(row => {
                    const cfg = HP_STATUS_CFG[row.status] || HP_STATUS_CFG.pending;
                    return (
                      <div key={row.id} style={{ marginBottom: 8, padding: '10px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{row.bank_name}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}35`, borderRadius: 4, padding: '2px 8px' }}>{cfg.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6b7280', marginBottom: row.status === 'pending' || row.status === 'approved' ? 8 : 0 }}>
                          <span>RM {Number(row.loan_amount).toLocaleString()}</span>
                          <span>{row.tenure_months}mo</span>
                          <span>{row.annual_rate_pct}% p.a.</span>
                          {row.monthly_install && <span style={{ color: '#7c3aed', fontWeight: 600 }}>RM {Number(row.monthly_install).toLocaleString()}/mo EIR</span>}
                        </div>
                        {row.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {['approved','rejected'].map(s => (
                              <button key={s} onClick={() => handleUpdateHPStatus(row.id, s)} style={{ flex: 1, fontSize: 11, padding: '5px', borderRadius: 6, cursor: 'pointer', background: s === 'approved' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${s === 'approved' ? '#bbf7d0' : '#fecaca'}`, color: s === 'approved' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                {s === 'approved' ? 'Approve' : 'Reject'}
                              </button>
                            ))}
                          </div>
                        )}
                        {row.status === 'approved' && (
                          <button onClick={() => handleUpdateHPStatus(row.id, 'disbursed')} style={{ width: '100%', fontSize: 11, padding: '5px', borderRadius: 6, cursor: 'pointer', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontWeight: 600 }}>
                            Mark Disbursed
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!showAddHP ? (
                    <button onClick={() => setShowAddHP(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 7, padding: '7px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center', fontWeight: 600 }}>
                      <Plus style={{ width: 12, height: 12 }} />Add HP Submission
                    </button>
                  ) : (
                    <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New HP Submission</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                        <select value={hpForm.bank} onChange={e => setHpForm(f => ({ ...f, bank: e.target.value }))} style={{ ...w.inp, gridColumn: '1/-1', appearance: 'none' }} className="ld-inp">
                          <option value="">— Select bank —</option>
                          {MY_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <input value={hpForm.amount} onChange={e => setHpForm(f => ({ ...f, amount: e.target.value }))} placeholder="Loan amount (RM)" type="number" style={w.inp} className="ld-inp" />
                        <select value={hpForm.tenure} onChange={e => setHpForm(f => ({ ...f, tenure: Number(e.target.value) }))} style={{ ...w.inp, appearance: 'none' }} className="ld-inp">
                          {TENURES.map(t => <option key={t} value={t}>{t}mo ({(t/12).toFixed(0)}yr)</option>)}
                        </select>
                        <input value={hpForm.rate} onChange={e => setHpForm(f => ({ ...f, rate: Number(e.target.value) }))} placeholder="Rate % p.a." type="number" step="0.1" style={w.inp} className="ld-inp" />
                      </div>
                      {hpInstalment > 0 && (
                        <div style={{ display: 'flex', gap: 16, marginBottom: 8, padding: '7px 10px', background: '#faf5ff', borderRadius: 6 }}>
                          <span style={{ fontSize: 12, color: '#7c3aed' }}>EIR: <strong>RM {Math.round(hpInstalment).toLocaleString()}/mo</strong></span>
                          {lead?.car_listing?.selling_price && hpForm.amount && (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>Margin: {((Number(hpForm.amount) / lead.car_listing.selling_price) * 100).toFixed(1)}%</span>
                          )}
                        </div>
                      )}
                      <input value={hpForm.notes} onChange={e => setHpForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ ...w.inp, marginBottom: 8 }} className="ld-inp" />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowAddHP(false)} style={{ flex: 1, padding: '8px', borderRadius: 7, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleAddHP} disabled={hpSaving || !hpForm.bank || !hpForm.amount} style={{ flex: 1, padding: '8px', borderRadius: 7, background: '#7c3aed', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (hpSaving || !hpForm.bank || !hpForm.amount) ? 0.5 : 1 }}>
                          {hpSaving ? 'Submitting…' : 'Submit'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Add-ons & Deal Sheet ── */}
            <div style={w.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ ...w.label, margin: 0 }}>Add-ons & Deal</p>
                {!addonsLoading && dealAddons.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>RM {dealAddons.reduce((s, a) => s + Number(a.sold_price), 0).toLocaleString()}</span>
                )}
              </div>
              {addonsLoading ? <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</p> : (
                <>
                  {dealAddons.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', marginBottom: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 7 }}>
                      <span style={{ fontSize: 13, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.dealer_products?.name || '—'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', flexShrink: 0 }}>RM {Number(a.sold_price).toLocaleString()}</span>
                      <button onClick={() => handleRemoveAddon(a.id)} style={{ color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, display: 'flex' }}>
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  ))}
                  {!showAttach ? (
                    <button onClick={() => { setShowAttach(true); setAddonForm({ product_id: '', sold_price: '', notes: '' }); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '7px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center', fontWeight: 600, marginBottom: car ? 8 : 0 }}>
                      <Plus style={{ width: 12, height: 12 }} />Add Add-on
                    </button>
                  ) : (
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: car ? 8 : 0 }}>
                      {catalogueProducts.length === 0 ? (
                        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>No active products configured. Add them in Services & Add-ons.</p>
                      ) : (
                        <>
                          <select value={addonForm.product_id} onChange={e => { const sel = catalogueProducts.find(p => p.id === e.target.value); setAddonForm(f => ({ ...f, product_id: e.target.value, sold_price: sel ? String(sel.selling_price) : f.sold_price })); }}
                            style={{ ...w.inp, marginBottom: 6, appearance: 'none' }} className="ld-inp">
                            <option value="">— Select product —</option>
                            {catalogueProducts.map(p => <option key={p.id} value={p.id}>{p.name} — RM {Number(p.selling_price).toLocaleString()}</option>)}
                          </select>
                          <input type="number" value={addonForm.sold_price} onChange={e => setAddonForm(f => ({ ...f, sold_price: e.target.value }))}
                            placeholder="Sold price (RM)" style={{ ...w.inp, marginBottom: 6 }} className="ld-inp" min="0" />
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowAttach(false)} style={{ flex: 1, padding: '7px', borderRadius: 7, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        {catalogueProducts.length > 0 && (
                          <button onClick={handleAttachAddon} disabled={attachSaving || !addonForm.product_id || !addonForm.sold_price}
                            style={{ flex: 1, padding: '7px', borderRadius: 7, background: '#dc2626', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!addonForm.product_id || !addonForm.sold_price || attachSaving) ? 0.5 : 1 }}>
                            {attachSaving ? 'Adding…' : 'Add'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {/* ── Fees for deal sheet ── */}
                  {car && (
                    <div style={{ margin: '8px 0', padding: '12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Fees (deal sheet)</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                        {[{ key: 'road_tax', label: 'Road Tax' }, { key: 'insurance', label: 'Insurance' }, { key: 'puspakom', label: 'Puspakom' }].map(({ key, label }) => (
                          <div key={key}>
                            <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>{label}</p>
                            <input type="number" placeholder="RM 0" value={dealFees[key]}
                              onChange={e => setDealFees(f => ({ ...f, [key]: e.target.value }))}
                              style={{ ...w.inp, padding: '7px 10px', fontSize: 12 }} className="ld-inp" />
                          </div>
                        ))}
                      </div>
                      {(Number(dealFees.road_tax) + Number(dealFees.insurance) + Number(dealFees.puspakom)) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #f1f3f5' }}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>Fees subtotal</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>
                            RM {(Number(dealFees.road_tax || 0) + Number(dealFees.insurance || 0) + Number(dealFees.puspakom || 0)).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {car && (
                    !dealLink ? (
                      <button onClick={handleGenerateDealLink} disabled={generatingLink}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '9px 14px', borderRadius: 8, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', fontSize: 12, fontWeight: 600, cursor: 'pointer', justifyContent: 'center', opacity: generatingLink ? 0.6 : 1 }}>
                        <Presentation style={{ width: 13, height: 13 }} />{generatingLink ? 'Generating…' : 'Generate Deal Sheet'}
                      </button>
                    ) : (
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Presentation style={{ width: 12, height: 12, color: '#4338ca' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Deal Sheet ready</span>
                          </div>
                          {minsLeft !== null && <span style={{ fontSize: 10, color: minsLeft < 10 ? '#dc2626' : '#9ca3af' }}>{minsLeft > 0 ? `${minsLeft}m left` : 'Expired'}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { navigator.clipboard.writeText(dealLink); setDealLinkCopied(true); setTimeout(() => setDealLinkCopied(false), 2000); }}
                            style={{ flex: 1, padding: '7px', borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', color: dealLinkCopied ? '#16a34a' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <Copy style={{ width: 11, height: 11 }} />{dealLinkCopied ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button onClick={() => window.open(dealLink, '_blank')}
                            style={{ flex: 1, padding: '7px', borderRadius: 6, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <ExternalLink style={{ width: 11, height: 11 }} />Open
                          </button>
                          <button onClick={handleGenerateDealLink} disabled={generatingLink}
                            style={{ padding: '7px 10px', borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af', fontSize: 11, cursor: 'pointer', opacity: generatingLink ? 0.5 : 1 }}>
                            Regenerate
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            {/* ── Quick Messages ── */}
            <div style={w.section}>
              <p style={w.label}>Quick Messages</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WHATSAPP_TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => openTemplate(tpl)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    <MessageCircle style={{ width: 11, height: 11 }} />{tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Activity ── */}
            <div style={w.section}>
              <p style={w.label}>Activity</p>
              {actLoading ? <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</p> : activities.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>No activity yet.</p>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {[...activities].reverse().map((a, idx) => {
                    const cfg = ACT_CFG[a.activity_type] || ACT_CFG.note_added;
                    let desc = a.note || '';
                    if (a.activity_type === 'stage_changed') {
                      const from = STAGE_CONFIG[a.from_stage]?.label || a.from_stage;
                      const to   = STAGE_CONFIG[a.to_stage]?.label   || a.to_stage;
                      desc = `${from} → ${to}${a.note ? ` · ${a.note}` : ''}`;
                    }
                    if (a.activity_type === 'created' && !desc) desc = 'Lead created';
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, marginTop: 4, flexShrink: 0 }} />
                          {idx < activities.length - 1 && <div style={{ width: 1, flex: 1, background: '#e5e7eb', marginTop: 4 }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                            <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                          </div>
                          {desc && <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{desc}</p>}
                          {a.creator?.full_name && <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>by {a.creator.full_name}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Log form */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <p style={{ ...w.label, marginBottom: 8 }}>Log Activity</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <select value={logType} onChange={e => setLogType(e.target.value)} style={{ ...w.inp, appearance: 'none', flex: 1 }} className="ld-inp">
                    {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <textarea value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="What happened?…" rows={2} style={{ ...w.inp, resize: 'none', marginBottom: 8 }} className="ld-inp" />
                <button onClick={handleLog} disabled={logging || !logNote.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: '#111827', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!logNote.trim() || logging) ? 0.4 : 1 }}>
                  <FileText style={{ width: 12, height: 12 }} />{logging ? 'Logging…' : 'Log Activity'}
                </button>
              </div>
            </div>

            <div style={w.divider} />

          {/* ── Danger Zone ── */}
          <div style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.1)', borderRadius: 8, padding: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(248,113,113,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Danger Zone</p>
            {deleteConfirm ? (
              <div>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>Permanently delete this lead?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.35)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                    {deleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', borderRadius: 6, background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />Delete Lead
              </button>
            )}
          </div>

          {/* Bottom spacer */}
          <div style={{ height: 24 }} />
        </div>
      </div>
      </div>
    </>
  );
}
