import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Search, X, Inbox } from 'lucide-react';
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

// ─── Stage section header (All view) ──────────────────────────────────────────
function StageSectionHeader({ stage, count }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '10px 20px 6px',
      background: '#f9fafb',
      borderBottom: '1px solid #f1f3f5',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.headerBorder, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: cfg.headerBorder }}>
        {cfg.label}
      </span>
      <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>{count}</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { leads, loading, addLead, updateLeadStage, updateLead, deleteLead, optimisticStageChange, revertStageChange } = useLeads();

  const [openLead, setOpenLead]             = useState(null);
  const [showAdd, setShowAdd]               = useState(false);
  const [search, setSearch]                 = useState('');
  const [filterSource, setFilterSource]     = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [activeStage, setActiveStage]       = useState('all');
  const [teamMembers, setTeamMembers]       = useState([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles').select('id, role, dealer_id').eq('id', user.id).single();
      if (!profile) return;
      const dealerId = ['manager', 'admin'].includes(profile.role) ? profile.dealer_id : profile.id;
      if (!dealerId) return;
      const { data } = await supabase
        .from('profiles').select('id, full_name')
        .eq('role', 'salesman').eq('dealer_id', dealerId);
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

  const stageTabCounts = useMemo(() => {
    const counts = { all: filtered.length };
    STAGE_ORDER.forEach(s => { counts[s] = byStage[s]?.length || 0; });
    return counts;
  }, [filtered, byStage]);

  const visibleLeads = useMemo(() => {
    if (activeStage === 'all') return filtered;
    return byStage[activeStage] || [];
  }, [activeStage, filtered, byStage]);

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

  const hasFilters = search || filterSource || filterAssigned;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 className="text-base font-bold text-white">Pipeline</h1>
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

      {/* ── Filter + Stage bar ── */}
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
        {/* Search + dropdowns */}
        <div className="flex items-center gap-2 px-4 pt-2.5 pb-2">
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#6b7280' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search buyer or car…"
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {teamMembers.length > 0 && (
            <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
              <option value="">All Salespeople</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterSource(''); setFilterAssigned(''); }}
              style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
              <X className="w-3 h-3" />Clear
            </button>
          )}
        </div>

        {/* Stage tabs */}
        <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveStage('all')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s',
            background: activeStage === 'all' ? '#dc2626' : 'rgba(255,255,255,0.05)',
            border: activeStage === 'all' ? '1px solid #dc2626' : '1px solid rgba(255,255,255,0.08)',
            color: activeStage === 'all' ? '#fff' : '#9ca3af',
          }}>
            All <span style={{ fontSize: 10, opacity: 0.8 }}>{stageTabCounts.all}</span>
          </button>
          {STAGE_ORDER.map(stage => {
            const cfg = STAGE_CONFIG[stage];
            const active = activeStage === stage;
            return (
              <button key={stage} onClick={() => setActiveStage(stage)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s',
                background: active ? cfg.headerBorder : 'rgba(255,255,255,0.05)',
                border: active ? `1px solid ${cfg.headerBorder}` : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#fff' : '#9ca3af',
              }}>
                {cfg.label} <span style={{ fontSize: 10, opacity: 0.8 }}>{stageTabCounts[stage]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center" style={{ background: '#f3f4f6' }}>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading leads…</p>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ background: '#f3f4f6' }}>
          <div style={{ margin: '12px', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
            {activeStage === 'all' ? (
              STAGE_ORDER.map(stage => {
                const stageLeads = byStage[stage] || [];
                if (stageLeads.length === 0) return null;
                return (
                  <div key={stage}>
                    <StageSectionHeader stage={stage} count={stageLeads.length} />
                    {stageLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} onOpen={setOpenLead} />
                    ))}
                  </div>
                );
              })
            ) : (
              visibleLeads.length === 0 ? (
                <div style={{ background: '#fff', padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>No leads in this stage.</p>
                </div>
              ) : (
                visibleLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onOpen={setOpenLead} />
                ))
              )
            )}
          </div>
        </div>
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
