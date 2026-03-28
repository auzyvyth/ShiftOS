import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Calendar, Trash2, AlertTriangle, ExternalLink, User, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import LeadSourceBadge from './LeadSourceBadge';
import StagePill from './StagePill';
import LeadActivityLog from './LeadActivityLog';
import { useLeadActivities } from '../../hooks/useLeadActivities';
import {
  formatWhatsAppURL, calcInstalment, getLeadAgeDays,
  ageTextColor, INCOME_OPTIONS, EMPLOYMENT_OPTIONS, STAGE_CONFIG,
} from '../../lib/leadsHelpers';

const iCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 transition-all";
const sCls = iCls + " appearance-none";

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</h4>
      {children}
    </div>
  );
}

function InfoRow({ label, value, className = '' }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-right ${className || 'text-gray-200'}`}>{value}</span>
    </div>
  );
}

export default function LeadDrawer({ lead: initialLead, onClose, onUpdate, onDelete, teamMembers = [] }) {
  const [lead, setLead] = useState(initialLead);
  const [stageChanging, setStageChanging] = useState(false);
  const [followupDate, setFollowupDate] = useState(initialLead?.followup_date || '');
  const [assignedTo, setAssignedTo] = useState(initialLead?.assigned_to || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lostConfirm, setLostConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { activities, loading: actLoading, addActivity } = useLeadActivities(lead?.id);

  // Sync if parent passes new lead data
  useEffect(() => {
    setLead(initialLead);
    setFollowupDate(initialLead?.followup_date || '');
    setAssignedTo(initialLead?.assigned_to || '');
  }, [initialLead]);

  if (!lead) return null;

  const days = getLeadAgeDays(lead.created_at);
  const ageCls = ageTextColor(days);
  const car = lead.car_listing;
  const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const instalment = car?.selling_price ? calcInstalment(car.selling_price) : null;
  const carThumb = car?.images?.[0] || null;

  async function handleStageChange(newStage) {
    if (newStage === lead.stage) return;
    setStageChanging(true);
    const oldStage = lead.stage;
    setLead(p => ({ ...p, stage: newStage }));
    try {
      const updated = await onUpdate(lead.id, { stage: newStage });
      if (updated) setLead(updated);
      await addActivity({ activity_type: 'stage_changed', from_stage: oldStage, to_stage: newStage });
      toast.success('Stage updated');
    } catch {
      setLead(p => ({ ...p, stage: oldStage }));
      toast.error('Error saving — please try again');
    } finally {
      setStageChanging(false);
    }
  }

  async function handleFollowupSave(date) {
    setFollowupDate(date);
    try {
      const updated = await onUpdate(lead.id, { followup_date: date || null });
      if (updated) setLead(updated);
      toast.success('Follow-up reminder saved');
    } catch {
      toast.error('Error saving — please try again');
    }
  }

  async function handleAssign(uid) {
    setAssignedTo(uid);
    try {
      const updated = await onUpdate(lead.id, { assigned_to: uid || null });
      if (updated) setLead(updated);
      const name = teamMembers.find(m => m.id === uid)?.full_name || 'Unassigned';
      await addActivity({ activity_type: 'assigned', note: `Assigned to ${name}` });
      toast.success('Salesperson assigned');
    } catch {
      toast.error('Error saving — please try again');
    }
  }

  async function handleMarkLost() {
    setLostConfirm(false);
    try {
      const updated = await onUpdate(lead.id, { stage: 'closed_lost' });
      if (updated) setLead(updated);
      await addActivity({ activity_type: 'stage_changed', from_stage: lead.stage, to_stage: 'closed_lost', note: 'Marked as lost' });
      toast.success('Marked as lost');
    } catch {
      toast.error('Error saving — please try again');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(lead.id);
      toast.success('Lead deleted');
      onClose();
    } catch {
      toast.error('Error deleting — please try again');
      setDeleting(false);
    }
  }

  async function handleAddNote(text) {
    await addActivity({ activity_type: 'note_added', note: text });
    toast.success('Note saved');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        style={{ backdropFilter: 'blur(2px)' }}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: 'min(420px, 100vw)',
          background: 'linear-gradient(155deg,#111118 0%,#0a0a0e 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '-16px 0 48px rgba(0,0,0,0.65)',
          animation: 'slideInRight 0.25s ease',
        }}
      >
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(220,38,38,0.45) 40%,rgba(56,189,248,0.28) 70%,transparent)' }} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-lg font-bold text-white leading-tight truncate">{lead.buyer_name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <LeadSourceBadge source={lead.lead_source} />
              <span className={`text-xs ${ageCls}`}>{days === 0 ? 'Today' : `${days}d ago`}</span>
            </div>
            <div className="mt-2">
              <StagePill stage={lead.stage} onChange={handleStageChange} disabled={stageChanging} />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 transition-colors flex-shrink-0 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Buyer info */}
          <Section title="Buyer Info">
            <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{lead.phone}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Phone number</p>
                </div>
                <a
                  href={formatWhatsAppURL(lead.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Chat on WhatsApp"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 transition-all hover:opacity-80"
                  style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>
              <InfoRow label="Employment" value={lead.employment_type} />
              <InfoRow label="Monthly Income" value={lead.income_bracket} className="text-white font-medium" />
              {instalment && (
                <InfoRow
                  label="Est. Monthly"
                  value={`RM ${instalment.toLocaleString()}/mo`}
                  className="text-amber-400 font-semibold"
                />
              )}
            </div>
          </Section>

          {/* Car interest */}
          {car && (
            <Section title="Car of Interest">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                {carThumb && (
                  <img src={carThumb} alt={carLabel} className="w-full h-28 object-cover" style={{ filter: 'brightness(0.85)' }} />
                )}
                <div className="p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <p className="text-sm font-semibold text-white">{carLabel}</p>
                  {car.selling_price && <p className="text-base font-black text-red-400">RM {car.selling_price.toLocaleString()}</p>}
                  {car.year && <p className="text-xs text-gray-500">{car.year}</p>}
                </div>
              </div>
            </Section>
          )}

          {/* Follow-up */}
          <Section title="Follow-Up Reminder">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                <input
                  type="date"
                  value={followupDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => handleFollowupSave(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm text-white rounded-xl bg-white/[0.04] border border-white/10 focus:outline-none focus:border-red-600/40 transition-all"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              {followupDate && (
                <button onClick={() => handleFollowupSave('')} className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2">Clear</button>
              )}
            </div>
          </Section>

          {/* Assign */}
          {teamMembers.length > 0 && (
            <Section title="Assigned Salesperson">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                <select
                  value={assignedTo}
                  onChange={e => handleAssign(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm text-white rounded-xl bg-white/[0.04] border border-white/10 focus:outline-none focus:border-red-600/40 appearance-none transition-all"
                >
                  <option value="">— Unassigned —</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
            </Section>
          )}

          {/* Activity log */}
          <Section title="">
            <LeadActivityLog
              activities={activities}
              loading={actLoading}
              onAddNote={handleAddNote}
            />
          </Section>

          {/* Danger zone */}
          <div className="rounded-xl p-4 space-y-2.5" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)' }}>
            <p className="text-xs font-semibold text-red-400/70 uppercase tracking-widest">Danger Zone</p>

            {lead.stage !== 'closed_lost' && (
              <>
                {lostConfirm ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Mark this lead as lost?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setLostConfirm(false)} className="flex-1 text-xs py-1.5 rounded-lg text-gray-400 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
                      <button onClick={handleMarkLost} className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium transition-colors" style={{ background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.3)' }}>Confirm</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setLostConfirm(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 transition-all hover:bg-red-500/10">
                    <AlertTriangle className="w-3.5 h-3.5" />Mark as Lost
                  </button>
                )}
              </>
            )}

            {deleteConfirm ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Permanently delete this lead?</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(false)} className="flex-1 text-xs py-1.5 rounded-lg text-gray-400 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium transition-colors disabled:opacity-50" style={{ background: 'rgba(220,38,38,0.25)', border: '1px solid rgba(220,38,38,0.4)' }}>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-500 transition-all hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5" />Delete Lead
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
