import React, { useState, useMemo, useEffect } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, closestCenter,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { Plus, Search, X, Inbox, Filter, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useLeads } from '../hooks/useLeads';
import LeadColumn from '../components/leads/LeadColumn';
import LeadCard from '../components/leads/LeadCard';
import LeadDrawer from '../components/leads/LeadDrawer';
import AddLeadModal from '../components/leads/AddLeadModal';
import LeadSourceBadge from '../components/leads/LeadSourceBadge';
import {
  STAGE_ORDER, STAGE_CONFIG, SOURCE_CONFIG,
  getLeadAgeDays, ageTextColor, ageDotColor, avatarGradient, getInitials,
  formatWhatsAppURL,
} from '../lib/leadsHelpers';

const T = {
  btnRed: { background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 10px rgba(220,38,38,0.28)' },
};

// ─── Mobile list row ───────────────────────────────────────────────────────────
function MobileLeadRow({ lead, onOpen }) {
  const days = getLeadAgeDays(lead.created_at);
  const dotCls = ageDotColor(days);
  const txtCls = ageTextColor(days);
  const car = lead.car_listing;
  const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const cfg = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.new;

  return (
    <button
      onClick={() => onOpen(lead)}
      className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors hover:bg-white/[0.025]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
        style={{ background: avatarGradient(lead.lead_source) }}
      >
        {getInitials(lead.buyer_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white truncate">{lead.buyer_name}</p>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}
            style={{ background: cfg.bg }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {carLabel && <p className="text-xs text-gray-500 truncate flex-1">{carLabel}</p>}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
            <span className={`text-xs ${txtCls}`}>{days === 0 ? 'Today' : `${days}d`}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.12)' }}>
        <Inbox className="w-7 h-7 text-red-500/40" />
      </div>
      <h3 className="text-white font-bold text-lg mb-2">No leads yet</h3>
      <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-6">
        Add your first lead manually or share your Drevo listing to start capturing enquiries.
      </p>
      <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>
        <Plus className="w-4 h-4" />Add Your First Lead
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { leads, setLeads, loading, addLead, updateLeadStage, updateLead, deleteLead, optimisticStageChange, revertStageChange } = useLeads();

  const [activeLeadId, setActiveLeadId] = useState(null); // drag overlay
  const [openLead, setOpenLead]         = useState(null);  // drawer
  const [showAdd, setShowAdd]           = useState(false);
  const [search, setSearch]             = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [teamMembers, setTeamMembers]   = useState([]);

  // Load team members for filter + assigning
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Get current dealer's dealership name first
      const { data: profile } = await supabase
        .from('profiles')
        .select('dealership')
        .eq('id', user.id)
        .single();
      if (!profile?.dealership) return;
      // Fetch salespeople in the same dealership
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'salesman')
        .eq('dealership', profile.dealership);
      setTeamMembers(data || []);
    }
    load();
  }, []);

  // ── Filtered leads ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.buyer_name?.toLowerCase().includes(q) ||
        l.car_listing?.brand?.toLowerCase().includes(q) ||
        l.car_listing?.model?.toLowerCase().includes(q)
      );
    }
    if (filterSource) result = result.filter(l => l.lead_source === filterSource);
    if (filterAssigned) result = result.filter(l => l.assigned_to === filterAssigned);
    return result;
  }, [leads, search, filterSource, filterAssigned]);

  // ── Group by stage ──────────────────────────────────────────────────────────
  const byStage = useMemo(() => {
    const map = {};
    STAGE_ORDER.forEach(s => { map[s] = []; });
    filtered.forEach(l => { if (map[l.stage]) map[l.stage].push(l); });
    return map;
  }, [filtered]);

  // ── DnD ─────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart({ active }) {
    setActiveLeadId(active.id);
  }

  async function handleDragEnd({ active, over }) {
    setActiveLeadId(null);
    if (!over) return;
    const lead = active.data.current?.lead;
    const newStage = over.id;
    if (!lead || lead.stage === newStage) return;

    const originalStage = lead.stage;
    optimisticStageChange(lead.id, newStage);

    // Also log activity
    try {
      await updateLeadStage(lead.id, newStage);
      // Log stage change activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'stage_changed',
        from_stage: originalStage,
        to_stage: newStage,
        created_by: user?.id,
      });
      toast.success('Stage updated');
    } catch {
      revertStageChange(lead.id, originalStage);
      toast.error('Error saving — please try again');
    }
  }

  async function handleMoveNext(lead) {
    const idx = STAGE_ORDER.indexOf(lead.stage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) return;
    const newStage = STAGE_ORDER[idx + 1];
    const originalStage = lead.stage;
    optimisticStageChange(lead.id, newStage);
    try {
      await updateLeadStage(lead.id, newStage);
      toast.success('Stage updated');
    } catch {
      revertStageChange(lead.id, originalStage);
      toast.error('Error saving — please try again');
    }
  }

  async function handleAddLead(payload) {
    const lead = await addLead(payload);
    // Log "created" activity
    if (lead) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'created',
        created_by: user?.id,
      });
    }
    toast.success('Lead added successfully');
    return lead;
  }

  async function handleUpdateLead(id, patch) {
    const updated = await updateLead(id, patch);
    // Sync drawer lead state
    if (openLead?.id === id && updated) setOpenLead(updated);
    return updated;
  }

  async function handleDeleteLead(id) {
    await deleteLead(id);
    if (openLead?.id === id) setOpenLead(null);
  }

  // ── Drag overlay card ───────────────────────────────────────────────────────
  const activeLead = activeLeadId ? leads.find(l => l.id === activeLeadId) : null;

  const hasFilters = search || filterSource || filterAssigned;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 className="text-base font-bold text-white">Leads Pipeline</h1>
          <p className="text-xs text-gray-600">{leads.length} lead{leads.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white font-semibold flex-shrink-0"
          style={T.btnRed}
        >
          <Plus className="w-4 h-4" />Add Lead
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search buyer or car…"
            className="w-full pl-9 pr-8 py-1.5 text-sm text-white placeholder-gray-600 rounded-lg focus:outline-none focus:border-red-500/40 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"><X className="w-3 h-3" /></button>}
        </div>

        {/* Source filter */}
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="text-xs text-gray-400 py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <option value="">All Sources</option>
          {Object.entries(SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Salesperson filter */}
        {teamMembers.length > 0 && (
          <select
            value={filterAssigned}
            onChange={e => setFilterAssigned(e.target.value)}
            className="text-xs text-gray-400 py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <option value="">All Salespeople</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        )}

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterSource(''); setFilterAssigned(''); }}
            className="text-xs text-red-400 hover:text-red-300 flex-shrink-0 flex items-center gap-1 px-2">
            <X className="w-3 h-3" />Clear
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Loading leads…</p>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <>
          {/* ── Desktop Kanban ── */}
          <div className="hidden md:flex flex-1 min-h-0 overflow-x-auto px-4 py-4 gap-3 pb-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {STAGE_ORDER.map(stage => (
                <LeadColumn
                  key={stage}
                  stage={stage}
                  leads={byStage[stage] || []}
                  onOpenLead={setOpenLead}
                  onMoveNext={handleMoveNext}
                />
              ))}

              <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {activeLead ? (
                  <div style={{ rotate: '2deg', opacity: 0.92 }}>
                    <LeadCard lead={activeLead} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* ── Mobile list ── */}
          <div className="md:hidden flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-12">No leads match your filters.</p>
            ) : (
              filtered
                .slice()
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(lead => (
                  <MobileLeadRow key={lead.id} lead={lead} onOpen={setOpenLead} />
                ))
            )}
          </div>
        </>
      )}

      {/* ── Lead Drawer ── */}
      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenLead(null)}
          onUpdate={handleUpdateLead}
          onDelete={handleDeleteLead}
          teamMembers={teamMembers}
        />
      )}

      {/* ── Add Lead Modal ── */}
      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAddLead}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}
