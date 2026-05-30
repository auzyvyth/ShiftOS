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
  const [stageChanging, setStageChanging] = useState(false);
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
        .select('brand, model, year, selling_price, images, city, state, mileage, transmission, fuel_type, included_services')
        .eq('id', car.id)
        .maybeSingle();

      const addonsTotal = dealAddons.reduce((s, a) => s + Number(a.sold_price), 0);
      const carPrice = Number(fullCar?.selling_price || car.selling_price || 0);
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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
        car_price: carPrice,
        addons_total: addonsTotal,
        grand_total: carPrice + addonsTotal,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
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

  // ── Stage change ─────────────────────────────────────────────────────────────
  async function handleStageChange(newStage) {
    if (newStage === lead.stage) return;
    if (newStage === 'lost') {
      setPendingStage('lost');
      setShowLossPanel(true);
      return;
    }
    setStageChanging(true);
    const oldStage = lead.stage;
    setLead(p => ({ ...p, stage: newStage }));
    try {
      const updated = await onUpdate(lead.id, { stage: newStage });
      if (updated) setLead(updated);
      await addActivity({ activity_type: 'stage_changed', from_stage: oldStage, to_stage: newStage });
      if (newStage === 'won') toast.success('Lead marked as Won!');
      else toast.success('Stage updated');
    } catch {
      setLead(p => ({ ...p, stage: oldStage }));
      toast.error('Error saving — please try again');
    } finally { setStageChanging(false); }
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
    setCarSearching(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCarSearching(false); return; }
    const { data } = await supabase
      .from('car_listings')
      .select('id, brand, model, year, selling_price, images, city, state, slug')
      .eq('dealer_id', user.id)
      .neq('status', 'sold')
      .ilike('model', `%${q}%`)
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50,
          width: 'min(480px, 100vw)',
          background: 'linear-gradient(155deg, #0d0d14 0%, #0a0a0f 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: "'DM Sans', sans-serif",
          animation: 'ldSlide 0.22s ease',
        }}
      >
        <style>{`
          @keyframes ldSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
          .ld-inp:focus { border-color: rgba(220,38,38,0.4) !important; }
          .ld-stage-pill:hover { opacity: 1 !important; }
        `}</style>

        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(220,38,38,0.5) 40%,rgba(56,189,248,0.3) 70%,transparent)', zIndex: 1 }} />

        {/* ── HEADER ── */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Avatar */}
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {initials}
            </div>

            {/* Name + phone */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {editingField === 'name' ? (
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null); }}
                    style={{ ...inp, padding: '4px 8px', fontSize: 16, fontWeight: 500, flex: 1 }}
                    className="ld-inp"
                  />
                ) : (
                  <>
                    <h2 style={{ fontSize: 17, fontWeight: 600, color: 'white', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.buyer_name}</h2>
                    <button onClick={() => startEdit('name')} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#4b5563', flexShrink: 0 }}>
                      <Pencil style={{ width: 12, height: 12 }} />
                    </button>
                  </>
                )}
              </div>

              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {editingField === 'phone' ? (
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null); }}
                    style={{ ...inp, padding: '3px 8px', fontSize: 13, flex: 1 }}
                    className="ld-inp"
                  />
                ) : (
                  <>
                    <a href={`tel:${lead.phone}`} style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none' }}>{lead.phone}</a>
                    <button onClick={() => startEdit('phone')} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#4b5563', flexShrink: 0 }}>
                      <Pencil style={{ width: 11, height: 11 }} />
                    </button>
                  </>
                )}
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <LeadSourceBadge source={lead.lead_source} />
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: stageCfg.bg, border: `1px solid ${stageCfg.border}` }} className={stageCfg.color}>
                  {stageCfg.icon && <stageCfg.icon size={11} style={{ flexShrink: 0 }} />} {stageCfg.label}
                </span>
                <span style={{ fontSize: 11 }} className={ageCls}>{days === 0 ? 'Today' : `${days}d ago`}</span>
              </div>
            </div>

            {/* Close */}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }}>
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <a
              href={formatWhatsAppURL(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', color: '#34d399', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
            >
              <MessageCircle style={{ width: 13, height: 13 }} />WhatsApp
            </a>
            <a
              href={`tel:${lead.phone}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
            >
              <Phone style={{ width: 13, height: 13 }} />Call
            </a>
            {nextStage && !isTerminal && (
              <button
                onClick={() => handleStageChange(nextStage)}
                disabled={stageChanging}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#f87171', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                <ChevronRight style={{ width: 13, height: 13 }} />
                {STAGE_CONFIG[nextStage]?.label || nextStage}
              </button>
            )}
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '20px' }}>

          {/* ── Car of Interest ── */}
          <SLabel>Interested In</SLabel>
          {car ? (
            <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
              {carThumb && (
                <img src={carThumb} alt={carLabel} loading="lazy" decoding="async" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', filter: 'brightness(0.85)' }} />
              )}
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: '0 0 2px' }}>{carLabel}</p>
                  {car.selling_price && <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', margin: 0 }}>RM {car.selling_price.toLocaleString()}</p>}
                  {instalment && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Est. RM {instalment.toLocaleString()}/mo</p>}
                </div>
                {car.slug && (
                  <a href={`/cars/${car.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', flexShrink: 0 }}>
                    <ExternalLink style={{ width: 14, height: 14 }} />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 6 }}>
              <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 8 }}>No car linked.</p>
              {!showCarSearch ? (
                <button
                  onClick={() => setShowCarSearch(true)}
                  style={{ fontSize: 12, color: '#ef4444', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                >
                  + Link a car
                </button>
              ) : (
                <div>
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#4b5563', pointerEvents: 'none' }} />
                    <input
                      autoFocus
                      value={carSearch}
                      onChange={e => { setCarSearch(e.target.value); if (e.target.value.length > 1) searchCars(e.target.value); }}
                      placeholder="Search brand or model…"
                      style={{ ...inp, paddingLeft: 32 }}
                      className="ld-inp"
                    />
                  </div>
                  {carSearching && <p style={{ fontSize: 11, color: '#6b7280' }}>Searching…</p>}
                  {carResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => linkCar(c.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', marginBottom: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 12, color: '#e5e5e5' }}>{c.year} {c.brand} {c.model}</span>
                      {c.selling_price && <span style={{ fontSize: 11, color: '#ef4444' }}>RM {c.selling_price.toLocaleString()}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Divider />

          {/* ── Follow-up ── */}
          <SLabel>Follow-up</SLabel>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <input
                type="datetime-local"
                value={followUpDate ? followUpDate.slice(0, 16) : ''}
                onChange={e => setFollowUpDate(e.target.value)}
                style={{ ...inp, colorScheme: 'dark' }}
                className="ld-inp"
              />
            </div>
            <button
              onClick={() => saveFollowUp(followUpDate)}
              disabled={savingFollowUp}
              style={{ padding: '9px 14px', borderRadius: 6, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: savingFollowUp ? 0.6 : 1 }}
            >
              {savingFollowUp ? '…' : 'Save'}
            </button>
            {followUpDate && (
              <button onClick={() => saveFollowUp('')} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>Clear</button>
            )}
          </div>
          {fuOverdueDays > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', marginBottom: 4 }}>
              <AlertTriangle style={{ width: 12, height: 12, color: '#f87171' }} />
              <span style={{ fontSize: 11, color: '#f87171' }}>Overdue by {fuOverdueDays} day{fuOverdueDays !== 1 ? 's' : ''}</span>
            </div>
          )}

          <Divider />

          {/* ── Stage Pipeline ── */}
          <SLabel>Pipeline Stage</SLabel>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
            {STAGE_ORDER.map(s => {
              const cfg = STAGE_CONFIG[s];
              const active = s === lead.stage;
              return (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={stageChanging}
                  className="ld-stage-pill"
                  style={{
                    padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: active ? cfg.bg : 'rgba(255,255,255,0.04)',
                    border: active ? `1px solid ${cfg.border}` : '1px solid rgba(255,255,255,0.07)',
                    color: active ? (cfg.headerBorder) : '#6b7280',
                    cursor: stageChanging ? 'not-allowed' : 'pointer',
                    opacity: active ? 1 : 0.65,
                    transition: 'all 0.15s',
                  }}
                >
                  {cfg.icon && <cfg.icon size={11} />} {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Loss reason inline panel */}
          {showLossPanel && (
            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 12 }}>Why was this lead lost?</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {LOST_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedLossReason(r)}
                    style={{
                      padding: '7px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
                      background: selectedLossReason === r ? 'rgba(220,38,38,0.18)' : 'rgba(255,255,255,0.04)',
                      border: selectedLossReason === r ? '1px solid rgba(220,38,38,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      color: selectedLossReason === r ? '#f87171' : '#9ca3af',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Optional notes…"
                value={lossNotes}
                onChange={e => setLossNotes(e.target.value)}
                rows={2}
                style={{ ...inp, resize: 'none', marginBottom: 10 }}
                className="ld-inp"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowLossPanel(false); setPendingStage(null); setSelectedLossReason(''); }} style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmLoss} disabled={savingLoss || !selectedLossReason} style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !selectedLossReason ? 0.5 : 1 }}>
                  {savingLoss ? 'Saving…' : 'Confirm Loss'}
                </button>
              </div>
            </div>
          )}

          <Divider />

          {/* ── Assigned Salesman ── */}
          <SLabel>Assigned To</SLabel>
          {teamMembers.length > 0 ? (
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#4b5563', pointerEvents: 'none' }} />
              <select
                value={assignedTo}
                onChange={e => handleAssign(e.target.value)}
                style={{ ...inp, paddingLeft: 32, appearance: 'none', cursor: 'pointer' }}
                className="ld-inp"
              >
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#4b5563' }}>No team members set up.</p>
          )}

          <Divider />

          {/* ── WhatsApp Templates ── */}
          <SLabel>Quick Messages</SLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {WHATSAPP_TEMPLATES.map((tpl, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6 }}
              >
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{tpl.label}</span>
                <button
                  onClick={() => openTemplate(tpl)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 5, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  <MessageCircle style={{ width: 11, height: 11 }} />Send
                </button>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── Notes ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SLabel>Notes</SLabel>
            {notesSaved && (
              <span style={{ fontSize: 10, color: '#34d399', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Check style={{ width: 10, height: 10 }} />Saved
              </span>
            )}
          </div>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Add notes about this lead…"
            rows={4}
            style={{ ...inp, resize: 'vertical', minHeight: 80 }}
            className="ld-inp"
          />

          <Divider />

          {/* ── Add-ons / Services (collapsible) ── */}
          <button
            onClick={() => setAddonsOpen(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', marginBottom: addonsOpen ? 0 : 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package style={{ width: 13, height: 13, color: '#6b7280' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: addonsOpen ? '#e5e7eb' : '#9ca3af' }}>
                Add-ons {!addonsLoading && `(${dealAddons.length})`}
              </span>
              {!addonsLoading && dealAddons.length > 0 && (
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                  · RM {dealAddons.reduce((s, a) => s + Number(a.sold_price), 0).toLocaleString()}
                </span>
              )}
            </div>
            {addonsOpen
              ? <ChevronUp style={{ width: 13, height: 13, color: '#4b5563' }} />
              : <ChevronDown style={{ width: 13, height: 13, color: '#4b5563' }} />}
          </button>

          {addonsOpen && (
            <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px', marginBottom: 0 }}>
              {addonsLoading ? (
                <p style={{ fontSize: 12, color: '#4b5563' }}>Loading…</p>
              ) : (
                <>
                  {/* Attached list */}
                  {dealAddons.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {dealAddons.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', marginBottom: 3, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
                          <span style={{ fontSize: 12, color: '#e5e7eb', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.dealer_products?.name || '—'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', flexShrink: 0 }}>RM {Number(a.sold_price).toLocaleString()}</span>
                          <button onClick={() => handleRemoveAddon(a.id)} style={{ color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, display: 'flex' }}>
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                          Total add-ons: RM {dealAddons.reduce((s, a) => s + Number(a.sold_price), 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Attach button */}
                  {!showAttach && (
                    <button
                      onClick={() => { setShowAttach(true); setAddonForm({ product_id: '', sold_price: '', notes: '' }); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ef4444', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                    >
                      <Plus style={{ width: 12, height: 12 }} />Attach Add-on
                    </button>
                  )}

                  {/* Inline attach form */}
                  {showAttach && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
                      {catalogueProducts.length === 0 ? (
                        <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 8 }}>No active products configured. Add them in Services & Add-ons.</p>
                      ) : (
                        <>
                          <select
                            value={addonForm.product_id}
                            onChange={e => {
                              const sel = catalogueProducts.find(p => p.id === e.target.value);
                              setAddonForm(f => ({ ...f, product_id: e.target.value, sold_price: sel ? String(sel.selling_price) : f.sold_price }));
                            }}
                            style={{ ...inp, marginBottom: 6, appearance: 'none' }}
                            className="ld-inp"
                          >
                            <option value="">— Select product —</option>
                            {catalogueProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} — RM {Number(p.selling_price).toLocaleString()}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={addonForm.sold_price}
                            onChange={e => setAddonForm(f => ({ ...f, sold_price: e.target.value }))}
                            placeholder="Sold price (RM)"
                            style={{ ...inp, marginBottom: 6 }}
                            className="ld-inp"
                            min="0"
                          />
                          <input
                            value={addonForm.notes}
                            onChange={e => setAddonForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Notes (optional)"
                            style={{ ...inp, marginBottom: 8 }}
                            className="ld-inp"
                          />
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowAttach(false)} style={{ flex: 1, padding: '7px', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        {catalogueProducts.length > 0 && (
                          <button
                            onClick={handleAttachAddon}
                            disabled={attachSaving || !addonForm.product_id || !addonForm.sold_price}
                            style={{ flex: 1, padding: '7px', borderRadius: 6, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!addonForm.product_id || !addonForm.sold_price || attachSaving) ? 0.5 : 1 }}
                          >
                            {attachSaving ? 'Adding…' : 'Add'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Deal Sheet ── */}
          {car && (
            <div style={{ marginTop: 8 }}>
              {!dealLink ? (
                <button
                  onClick={handleGenerateDealLink}
                  disabled={generatingLink}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer', justifyContent: 'center', opacity: generatingLink ? 0.6 : 1 }}
                >
                  <Presentation style={{ width: 13, height: 13 }} />
                  {generatingLink ? 'Generating…' : 'Generate Deal Sheet'}
                </button>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Presentation style={{ width: 12, height: 12, color: '#818cf8' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Deal Sheet</span>
                    </div>
                    {minsLeft !== null && (
                      <span style={{ fontSize: 10, color: minsLeft < 10 ? '#ef4444' : '#6b7280' }}>
                        {minsLeft > 0 ? `Expires in ${minsLeft}m` : 'Expired'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button
                      onClick={() => { navigator.clipboard.writeText(dealLink); setDealLinkCopied(true); setTimeout(() => setDealLinkCopied(false), 2000); }}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: dealLinkCopied ? '#34d399' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <Copy style={{ width: 11, height: 11 }} />
                      {dealLinkCopied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => window.open(dealLink, '_blank')}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <ExternalLink style={{ width: 11, height: 11 }} />
                      Open Fullscreen
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateDealLink}
                    disabled={generatingLink}
                    style={{ width: '100%', padding: '7px', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#4b5563', fontSize: 11, cursor: 'pointer', opacity: generatingLink ? 0.5 : 1 }}
                  >
                    {generatingLink ? 'Regenerating…' : 'Regenerate (resets 1h timer)'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── HP / Financing ── */}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setHpOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: hpOpen ? '8px 8px 0 0' : 8, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CreditCard style={{ width: 13, height: 13, color: '#6b7280' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: hpOpen ? '#e5e7eb' : '#9ca3af' }}>
                  HP / Financing {hpRows.length > 0 ? `(${hpRows.length})` : ''}
                </span>
                {hpRows.some(r => r.status === 'pending') && (
                  <span style={{ fontSize: 10, color: '#f59e0b' }}>{hpRows.filter(r => r.status === 'pending').length} pending</span>
                )}
              </div>
              {hpOpen ? <ChevronUp style={{ width: 13, height: 13, color: '#4b5563' }} /> : <ChevronDown style={{ width: 13, height: 13, color: '#4b5563' }} />}
            </button>

            {hpOpen && (
              <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 12, marginBottom: 0 }}>
                {/* Existing submissions */}
                {hpRows.map(row => {
                  const cfg = HP_STATUS_CFG[row.status] || HP_STATUS_CFG.pending;
                  return (
                    <div key={row.id} style={{ marginBottom: 8, padding: '9px 10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{row.bank_name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, borderRadius: 4, padding: '2px 7px' }}>{cfg.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                        <span>RM {Number(row.loan_amount).toLocaleString()}</span>
                        <span>{row.tenure_months}mo</span>
                        <span>{row.annual_rate_pct}% p.a.</span>
                        {row.monthly_install && <span style={{ color: '#c084fc', fontWeight: 600 }}>RM {Number(row.monthly_install).toLocaleString()}/mo</span>}
                      </div>
                      {row.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 5 }}>
                          {['approved','rejected'].map(s => (
                            <button key={s} onClick={() => handleUpdateHPStatus(row.id, s)} style={{ flex: 1, fontSize: 10, padding: '4px', borderRadius: 5, cursor: 'pointer', background: s === 'approved' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${s === 'approved' ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`, color: s === 'approved' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                              {s === 'approved' ? 'Approve' : 'Reject'}
                            </button>
                          ))}
                        </div>
                      )}
                      {row.status === 'approved' && (
                        <button onClick={() => handleUpdateHPStatus(row.id, 'disbursed')} style={{ width: '100%', fontSize: 10, padding: '4px', borderRadius: 5, cursor: 'pointer', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', fontWeight: 600 }}>
                          Mark Disbursed
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add submission form */}
                {!showAddHP ? (
                  <button
                    onClick={() => setShowAddHP(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#a78bfa', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                  >
                    <Plus style={{ width: 12, height: 12 }} />Add HP Submission
                  </button>
                ) : (
                  <div style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 8, padding: 12, marginTop: 4 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New HP Submission</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <select value={hpForm.bank} onChange={e => setHpForm(f => ({ ...f, bank: e.target.value }))} style={{ ...inp, gridColumn: '1/-1', appearance: 'none' }} className="ld-inp">
                        <option value="">— Select bank —</option>
                        {MY_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <input value={hpForm.amount} onChange={e => setHpForm(f => ({ ...f, amount: e.target.value }))} placeholder="Loan amount (RM)" type="number" style={inp} className="ld-inp" />
                      <select value={hpForm.tenure} onChange={e => setHpForm(f => ({ ...f, tenure: Number(e.target.value) }))} style={{ ...inp, appearance: 'none' }} className="ld-inp">
                        {TENURES.map(t => <option key={t} value={t}>{t}mo ({(t/12).toFixed(0)}yr)</option>)}
                      </select>
                      <input value={hpForm.rate} onChange={e => setHpForm(f => ({ ...f, rate: Number(e.target.value) }))} placeholder="Rate % p.a." type="number" step="0.1" style={inp} className="ld-inp" />
                    </div>
                    {hpInstalment > 0 && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 6, padding: '6px 10px', background: 'rgba(167,139,250,0.06)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: '#c084fc' }}>EIR: <strong>RM {Math.round(hpInstalment).toLocaleString()}/mo</strong></span>
                        {lead?.car_listing?.selling_price && hpForm.amount && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>Margin: {((Number(hpForm.amount) / lead.car_listing.selling_price) * 100).toFixed(1)}%</span>
                        )}
                      </div>
                    )}
                    <input value={hpForm.notes} onChange={e => setHpForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ ...inp, marginBottom: 8 }} className="ld-inp" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setShowAddHP(false)} style={{ flex: 1, padding: '7px', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handleAddHP} disabled={hpSaving || !hpForm.bank || !hpForm.amount} style={{ flex: 1, padding: '7px', borderRadius: 6, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (hpSaving || !hpForm.bank || !hpForm.amount) ? 0.5 : 1 }}>
                        {hpSaving ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Divider />

          {/* ── Activity Timeline ── */}
          <SLabel>Activity</SLabel>
          {actLoading ? (
            <p style={{ fontSize: 12, color: '#4b5563', paddingBottom: 8 }}>Loading…</p>
          ) : activities.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4b5563', paddingBottom: 8 }}>No activity yet.</p>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {[...activities].reverse().map((a, idx) => {
                const cfg = ACT_CFG[a.activity_type] || ACT_CFG.note_added;
                let desc = a.note || '';
                if (a.activity_type === 'stage_changed') {
                  const from = STAGE_CONFIG[a.from_stage]?.label || a.from_stage;
                  const to   = STAGE_CONFIG[a.to_stage]?.label   || a.to_stage;
                  desc = `Moved from ${from} → ${to}${a.note ? ` · ${a.note}` : ''}`;
                }
                if (a.activity_type === 'created' && !desc) desc = 'Lead created';
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, marginTop: 3, flexShrink: 0 }} />
                      {idx < activities.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.05)', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                        <span style={{ fontSize: 10, color: '#4b5563', flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                      </div>
                      {desc && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{desc}</p>}
                      {a.creator?.full_name && <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0' }}>by {a.creator.full_name}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual log */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Log Activity</p>
            <select
              value={logType}
              onChange={e => setLogType(e.target.value)}
              style={{ ...inp, appearance: 'none', marginBottom: 8 }}
              className="ld-inp"
            >
              {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <textarea
              value={logNote}
              onChange={e => setLogNote(e.target.value)}
              placeholder="What happened?…"
              rows={2}
              style={{ ...inp, resize: 'none', marginBottom: 8 }}
              className="ld-inp"
            />
            <button
              onClick={handleLog}
              disabled={logging || !logNote.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!logNote.trim() || logging) ? 0.5 : 1 }}
            >
              <FileText style={{ width: 12, height: 12 }} />
              {logging ? 'Logging…' : 'Log Activity'}
            </button>
          </div>

          <Divider />

          {/* ── Danger Zone ── */}
          <div style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.1)', borderRadius: 8, padding: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(248,113,113,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Danger Zone</p>
            {deleteConfirm ? (
              <div>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>Permanently delete this lead?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
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
    </>
  );
}
