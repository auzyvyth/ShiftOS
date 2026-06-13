import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Search, X, Inbox } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useLeads } from '../hooks/useLeads';
import LeadGridCard from '../components/leads/LeadGridCard';
import LeadDrawer from '../components/leads/LeadDrawer';
import AddLeadModal from '../components/leads/AddLeadModal';
import { useModalHistory } from '../hooks/useModalHistory';
import {
  STAGE_ORDER, STAGE_CONFIG, SOURCE_CONFIG, canonicalStage,
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

// Pipeline stages shown as grid columns (legacy test_drive added only if populated).
const GRID_STAGES = ['new', 'contacted', 'viewing_booked', 'negotiating', 'deposit_taken', 'won', 'lost'];

// ─── Stage column header (shared by trigger card + modal) ─────────────────────
function StageColumnHeader({ cfg, count, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '9px 12px', flexShrink: 0,
      background: '#fff', borderBottom: `2px solid ${cfg.headerBorder}`,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.headerBorder, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg.headerBorder }}>
        {cfg.label}
      </span>
      <span style={{
        marginLeft: onClose ? 8 : 'auto', fontSize: 11, fontWeight: 700, color: '#6b7280',
        background: '#f3f4f6', borderRadius: 20, padding: '1px 8px', minWidth: 22, textAlign: 'center',
      }}>
        {count}
      </span>
      {onClose && (
        <button onClick={onClose} aria-label="Close" style={{
          marginLeft: 'auto', background: '#f3f4f6', border: 'none', borderRadius: '50%',
          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#6b7280', flexShrink: 0,
        }}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Stage trigger card — compact preview; click opens the scrollable popup ────
function StageColumn({ stage, leads, onClick }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new;
  const preview = leads.slice(0, 3);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%', textAlign: 'left',
        background: '#f4f5f7', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
        cursor: 'pointer', padding: 0, font: 'inherit', touchAction: 'manipulation',
      }}
    >
      <StageColumnHeader cfg={cfg} count={leads.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
        {leads.length === 0 ? (
          <div style={{ padding: '16px 8px', textAlign: 'center', color: '#b0b6bf', fontSize: 11.5 }}>
            No leads here
          </div>
        ) : (
          <>
            {preview.map(lead => (
              <div key={lead.id} style={{
                fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px',
              }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>{lead.buyer_name || 'Unknown buyer'}</span>
                {lead.car_listing && <span style={{ color: '#6b7280' }}> · {lead.car_listing.brand} {lead.car_listing.model}</span>}
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 2 }}>
              {leads.length > preview.length ? `+${leads.length - preview.length} more — tap to view all` : 'Tap to view'}
            </div>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Stage panel — full inline scrollable list (used for the single-stage tab view) ──
function StagePanel({ stage, leads, onOpen }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minWidth: 0,
      background: '#f4f5f7', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
    }}>
      <StageColumnHeader cfg={cfg} count={leads.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
        {leads.length === 0 ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: '#b0b6bf', fontSize: 11.5 }}>
            No leads here
          </div>
        ) : (
          leads.map(lead => <LeadGridCard key={lead.id} lead={lead} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

// ─── Stage popup — only this list scrolls; click outside or × to close ─────────
function StageModal({ stage, leads, onOpen, onClose }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      className="sm:items-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl"
        style={{
          background: '#fff', border: '1px solid #e5e7eb',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <StageColumnHeader cfg={cfg} count={leads.length} onClose={onClose} />
        <div className="lp-col-body" style={{
          display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
          overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
        }}>
          {leads.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: '#b0b6bf', fontSize: 11.5 }}>
              No leads here
            </div>
          ) : (
            leads.map(lead => <LeadGridCard key={lead.id} lead={lead} onOpen={onOpen} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { leads, loading, addLead, updateLeadStage, updateLead, deleteLead, optimisticStageChange, revertStageChange } = useLeads();

  const [openLead, setOpenLead]             = useState(null);
  const [openStage, setOpenStage]           = useState(null);
  const [showAdd, setShowAdd]               = useState(false);
  const [search, setSearch]                 = useState('');
  const [filterSource, setFilterSource]     = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [activeStage, setActiveStage]       = useState('all');
  const [teamMembers, setTeamMembers]       = useState([]);

  // Back gesture / swipe-left closes the open drawer or modal instead of leaving the page
  useModalHistory(!!openLead, () => setOpenLead(null));
  useModalHistory(showAdd,    () => setShowAdd(false));
  // NOTE: openStage deliberately excluded — its history.back() cleanup fires popstate and
  // immediately closes the LeadDrawer that was just opened when transitioning from the
  // stage popup to a lead detail.

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
    filtered.forEach(l => { const s = canonicalStage(l.stage); if (map[s]) map[s].push(l); });
    return map;
  }, [filtered]);

  const stageTabCounts = useMemo(() => {
    const counts = { all: filtered.length };
    STAGE_ORDER.forEach(s => { counts[s] = byStage[s]?.length || 0; });
    return counts;
  }, [filtered, byStage]);

  // Columns to render in the grid: core pipeline stages always, plus any legacy
  // stage (e.g. test_drive) that still has leads so none silently disappear.
  const gridStages = useMemo(() => {
    const legacy = STAGE_ORDER.filter(s => !GRID_STAGES.includes(s) && (byStage[s]?.length > 0));
    return STAGE_ORDER.filter(s => GRID_STAGES.includes(s) || legacy.includes(s));
  }, [byStage]);

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
    <div className="flex flex-col" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        .lp-filter-bar::-webkit-scrollbar { display: none; }
        .lp-stage-tabs::-webkit-scrollbar { display: none; }
        .lp-col-body::-webkit-scrollbar { width: 6px; }
        .lp-col-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .lp-col-body::-webkit-scrollbar-track { background: transparent; }
        .lp-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 640px)  { .lp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1024px) { .lp-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 480px) {
          .lp-src-select { display: none !important; }
          .lp-assigned-select { display: none !important; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Pipeline</h1>
          <p className="text-xs text-gray-400">{filtered.length}{filtered.length !== leads.length ? `/${leads.length}` : ''} lead{leads.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-white font-semibold flex-shrink-0"
          style={T.btnRed}
        >
          <Plus className="w-4 h-4" />Add Lead
        </button>
      </div>

      {/* ── Filter + Stage bar ── */}
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        {/* Search + dropdowns */}
        <div className="lp-filter-bar flex items-center gap-2 px-3 pt-2 pb-1.5 overflow-x-auto">
          <div className="relative flex-1" style={{ minWidth: 120 }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: '#9ca3af' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search buyer or car…"
              aria-label="Search leads"
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg focus:outline-none"
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#111827' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
            aria-label="Filter by source"
            className="lp-src-select text-xs py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
            style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151' }}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {teamMembers.length > 0 && (
            <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}
              aria-label="Filter by salesperson"
              className="lp-assigned-select text-xs py-1.5 px-2.5 rounded-lg appearance-none flex-shrink-0"
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151' }}>
              <option value="">All Salespeople</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterSource(''); setFilterAssigned(''); }}
              style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, touchAction: 'manipulation' }}>
              <X className="w-3 h-3" />Clear
            </button>
          )}
        </div>

        {/* Stage tabs */}
        <div className="lp-stage-tabs flex items-center gap-1 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveStage('all')} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
            fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s',
            background: activeStage === 'all' ? '#dc2626' : '#f9fafb',
            border: activeStage === 'all' ? '1px solid #dc2626' : '1px solid #e5e7eb',
            color: activeStage === 'all' ? '#fff' : '#374151',
            touchAction: 'manipulation',
          }}>
            All <span style={{ opacity: 0.8 }}>{stageTabCounts.all}</span>
          </button>
          {STAGE_ORDER.filter(s => stageTabCounts[s] > 0 || activeStage === s).map(stage => {
            const cfg = STAGE_CONFIG[stage];
            const active = activeStage === stage;
            return (
              <button key={stage} onClick={() => setActiveStage(stage)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
                fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s',
                background: active ? cfg.headerBorder : '#f9fafb',
                border: active ? `1px solid ${cfg.headerBorder}` : '1px solid #e5e7eb',
                color: active ? '#fff' : '#374151',
                touchAction: 'manipulation',
              }}>
                {cfg.label} <span style={{ opacity: 0.8 }}>{stageTabCounts[stage]}</span>
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
        <div className="flex-1" style={{ background: '#f3f4f6' }}>
          <div className="lp-grid" style={{ padding: 12, paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
            {activeStage === 'all' ? (
              gridStages.map(stage => (
                <StageColumn key={stage} stage={stage} leads={byStage[stage] || []} onClick={() => setOpenStage(stage)} />
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1' }}>
                <StagePanel stage={activeStage} leads={byStage[activeStage] || []} onOpen={setOpenLead} />
              </div>
            )}
          </div>
        </div>
      )}

      {openStage && (
        <StageModal
          stage={openStage}
          leads={byStage[openStage] || []}
          onOpen={lead => { setOpenStage(null); setOpenLead(lead); }}
          onClose={() => setOpenStage(null)}
        />
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
