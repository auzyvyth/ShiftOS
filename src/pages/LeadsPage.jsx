import React, { useState, useMemo, useEffect } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, closestCenter, useDroppable,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { Plus, Search, X, Inbox, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useLeads } from '../hooks/useLeads';
import LeadCard from '../components/leads/LeadCard';
import LeadDrawer from '../components/leads/LeadDrawer';
import AddLeadModal from '../components/leads/AddLeadModal';
import {
  STAGE_ORDER, STAGE_CONFIG, SOURCE_CONFIG,
  getLeadAgeDays, avatarGradient, getInitials,
} from '../lib/leadsHelpers';

const T = {
  btnRed: { background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 10px rgba(220,38,38,0.28)' },
};

const COLLAPSE_THRESHOLD = 5; // show "show more" only beyond this count

// ─── Stage section ────────────────────────────────────────────────────────────
function StageSection({ stage, leads, onOpen, onMoveNext, onMovePrev }) {
  const cfg = STAGE_CONFIG[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? leads : leads.slice(0, COLLAPSE_THRESHOLD);
  const hidden  = leads.length - COLLAPSE_THRESHOLD;

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? cfg.bg : 'rgba(255,255,255,0.016)',
        border: `1px solid ${isOver ? cfg.headerBorder : cfg.border}`,
        borderLeft: `3px solid ${cfg.headerBorder}`,
        borderRadius: 10,
        overflow: 'clip',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Stage header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 12px',
        borderBottom: leads.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        background: 'rgba(0,0,0,0.15)',
      }}>
        {cfg.icon && <cfg.icon size={14} />}
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.headerBorder, flex: 1 }}>
          {cfg.label}
        </span>
        {leads.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: cfg.headerBorder,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 99, padding: '1px 8px',
          }}>
            {leads.length}
          </span>
        )}
        {leads.length === 0 && (
          <span style={{ fontSize: 10, color: '#1f2937' }}>empty</span>
        )}
      </div>

      {/* Lead rows — responsive grid on desktop */}
      {leads.length > 0 && (
        <div style={{ padding: '8px 8px 4px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 6,
          }}>
            {visible.map(lead => (
              <LeadCard key={lead.id} lead={lead} onOpen={onOpen} onMoveNext={onMoveNext} onMovePrev={onMovePrev} />
            ))}
          </div>

          {/* Show more / less */}
          {leads.length > COLLAPSE_THRESHOLD && (
            <button
              type="button"
              onClick={() => setShowAll(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                margin: '6px 4px 4px', padding: '4px 8px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4b5563', fontSize: 11,
              }}
            >
              <ChevronDown size={11} style={{ transform: showAll ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              {showAll ? 'Show less' : `+${hidden} more`}
            </button>
          )}
        </div>
      )}
    </div>
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
        Add your first lead manually or share your XDrive listing to start capturing enquiries.
      </p>
      <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>
        <Plus className="w-4 h-4" />Add Your First Lead
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { leads, loading, addLead, updateLeadStage, updateLead, deleteLead, optimisticStageChange, revertStageChange } = useLeads();

  const [activeLeadId, setActiveLeadId] = useState(null);
  const [openLead, setOpenLead]         = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [search, setSearch]             = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [teamMembers, setTeamMembers]   = useState([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles').select('dealership').eq('id', user.id).single();
      if (!profile?.dealership) return;
      const { data } = await supabase
        .from('profiles').select('id, full_name')
        .eq('role', 'salesman').eq('dealership', profile.dealership);
      setTeamMembers(data || []);
    }
    load();
  }, []);

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
    if (filterSource)   result = result.filter(l => l.lead_source === filterSource);
    if (filterAssigned) result = result.filter(l => l.assigned_to === filterAssigned);
    return result;
  }, [leads, search, filterSource, filterAssigned]);

  const byStage = useMemo(() => {
    const map = {};
    STAGE_ORDER.forEach(s => { map[s] = []; });
    filtered.forEach(l => { if (map[l.stage]) map[l.stage].push(l); });
    return map;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart({ active }) { setActiveLeadId(active.id); }

  async function handleDragEnd({ active, over }) {
    setActiveLeadId(null);
    if (!over) return;
    const lead = active.data.current?.lead;
    const newStage = over.id;
    if (!lead || lead.stage === newStage) return;
    const originalStage = lead.stage;
    optimisticStageChange(lead.id, newStage);
    try {
      await updateLeadStage(lead.id, newStage);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('lead_activities').insert({
        lead_id: lead.id, dealer_id: lead.dealer_id,
        activity_type: 'stage_changed', from_stage: originalStage, to_stage: newStage,
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
    await moveToStage(lead, STAGE_ORDER[idx + 1]);
  }

  async function handleMovePrev(lead) {
    const idx = STAGE_ORDER.indexOf(lead.stage);
    if (idx <= 0) return;
    await moveToStage(lead, STAGE_ORDER[idx - 1]);
  }

  async function moveToStage(lead, newStage) {
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
    if (lead) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('lead_activities').insert({
        lead_id: lead.id, dealer_id: lead.dealer_id,
        activity_type: 'created', created_by: user?.id,
      });
    }
    toast.success('Lead added successfully');
    return lead;
  }

  async function handleUpdateLead(id, patch) {
    const updated = await updateLead(id, patch);
    if (openLead?.id === id && updated) setOpenLead(updated);
    return updated;
  }

  async function handleDeleteLead(id) {
    await deleteLead(id);
    if (openLead?.id === id) setOpenLead(null);
  }

  const activeLead = activeLeadId ? leads.find(l => l.id === activeLeadId) : null;
  const hasFilters = search || filterSource || filterAssigned;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3"
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
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search buyer or car…"
            className="w-full pl-9 pr-8 py-1.5 text-sm text-white placeholder-gray-600 rounded-lg focus:outline-none transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="text-xs text-gray-400 py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <option value="">All Sources</option>
          {Object.entries(SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {teamMembers.length > 0 && (
          <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}
            className="text-xs text-gray-400 py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
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

      {/* ── Pipeline body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Loading leads…</p>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {STAGE_ORDER.map(stage => (
              <StageSection
                key={stage}
                stage={stage}
                leads={byStage[stage] || []}
                onOpen={setOpenLead}
                onMoveNext={handleMoveNext}
                onMovePrev={handleMovePrev}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeLead ? (
              <div style={{ rotate: '2deg', opacity: 0.92 }}>
                <LeadCard lead={activeLead} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {openLead && (
        <LeadDrawer
          lead={openLead} onClose={() => setOpenLead(null)}
          onUpdate={handleUpdateLead} onDelete={handleDeleteLead}
          teamMembers={teamMembers}
        />
      )}

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
