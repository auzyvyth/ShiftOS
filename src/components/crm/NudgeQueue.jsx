import React, { useState } from 'react';
import { BellRing, Clock, MessageCircle, MoreVertical, Sparkles, X } from 'lucide-react';

// RAPTOR-1 — the review queue for follow-up nudges that have come due.
//
// The whole point of this surface is that a HUMAN reads the draft and sends
// it. There is no send button here that talks to a buyer directly: "Open
// WhatsApp" hands the salesman a pre-filled chat and they press send in
// WhatsApp themselves. Do not add an auto-send path.
//
// Light surface (#fff / #111827) to match the rest of OutreachHub.

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const mins = (d.getTime() - Date.now()) / 60000;
  const abs = Math.abs(mins);
  const tail = abs < 60 ? `${Math.round(abs)}m`
    : abs < 1440 ? `${Math.round(abs / 60)}h`
    : `${Math.round(abs / 1440)}d`;
  return mins >= 0 ? `in ${tail}` : `${tail} overdue`;
};

const fmtDate = (iso) => new Date(iso).toLocaleString('en-MY', {
  weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
});

export default function NudgeQueue({ due, scheduled, onSend, onSnooze, onDismiss }) {
  const [openId, setOpenId]   = useState(null);   // expanded row (editable draft)
  const [menuId, setMenuId]   = useState(null);   // which row's overflow menu is open
  const [edits, setEdits]     = useState({});     // per-nudge edited draft text

  if (!due.length && !scheduled.length) return null;

  const draftOf = (n) => (edits[n.id] !== undefined ? edits[n.id] : n.draft_message);

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, marginBottom:20, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap', padding:'13px 16px', borderBottom: due.length ? '1px solid #e5e7eb' : 'none' }}>
        <BellRing size={15} style={{ color:'#dc2626', flexShrink:0 }} />
        <p style={{ fontSize:13, fontWeight:700, color:'#111827', margin:0, flex:1 }}>
          Follow-ups due
        </p>
        {due.length > 0 && (
          <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'rgba(220,38,38,0.08)', borderRadius:20, padding:'2px 10px' }}>
            {due.length} ready
          </span>
        )}
        {scheduled.length > 0 && (
          <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', background:'#f3f4f6', borderRadius:20, padding:'2px 10px' }}>
            {scheduled.length} scheduled
          </span>
        )}
      </div>

      {due.length === 0 ? (
        <p style={{ fontSize:12, color:'#6b7280', margin:0, padding:'12px 16px' }}>
          Nothing due right now. Next: {fmtDate(scheduled[0].scheduled_for)} · {scheduled[0].lead?.buyer_name || 'lead'}
        </p>
      ) : due.map((n, i) => {
        const lead = n.lead || {};
        const car  = lead.car_listing;
        const expanded = openId === n.id;
        // The buyer was contacted after this nudge was queued — the draft may
        // already be stale, so say so rather than letting them repeat themselves.
        const contactedSince = lead.last_contacted_at && n.created_at
          && new Date(lead.last_contacted_at) > new Date(n.created_at);

        return (
          <div key={n.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f3f4f6', padding:'12px 16px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:3 }}>
                  <span style={{ fontSize:13.5, fontWeight:600, color:'#111827' }}>{lead.buyer_name || 'Unknown'}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:'#b45309', background:'rgba(217,119,6,0.1)', borderRadius:5, padding:'1px 6px' }}>
                    {fmtWhen(n.scheduled_for)}
                  </span>
                  {n.ai_drafted && (
                    <span style={{ fontSize:10, fontWeight:700, color:'#6d28d9', background:'rgba(124,58,237,0.09)', borderRadius:5, padding:'1px 6px', display:'inline-flex', alignItems:'center', gap:3 }}>
                      <Sparkles size={9} /> AI draft
                    </span>
                  )}
                </div>
                <p style={{ fontSize:11.5, color:'#6b7280', margin:0 }}>
                  {car ? `${car.brand} ${car.model}` : 'Car enquiry'}{n.reason ? ` · ${n.reason}` : ''}
                </p>
                {contactedSince && (
                  <p style={{ fontSize:11, color:'#b45309', margin:'4px 0 0', fontWeight:600 }}>
                    You've contacted them since this was queued — check the draft still makes sense.
                  </p>
                )}
              </div>

              <div style={{ position:'relative', flexShrink:0 }}>
                <button onClick={() => setMenuId(menuId === n.id ? null : n.id)} aria-label="More actions"
                  style={{ background:'none', border:'none', padding:4, cursor:'pointer', color:'#9ca3af', display:'flex' }}>
                  <MoreVertical size={16} />
                </button>
                {menuId === n.id && (
                  <>
                    {/* click-catcher so the menu closes on an outside tap */}
                    <div onClick={() => setMenuId(null)} style={{ position:'fixed', inset:0, zIndex:20 }} />
                    <div style={{ position:'absolute', right:0, top:26, zIndex:21, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', overflow:'hidden', minWidth:150 }}>
                      {[
                        { label: 'Snooze 1 day',  days: 1 },
                        { label: 'Snooze 3 days', days: 3 },
                      ].map(opt => (
                        <button key={opt.label} onClick={() => {
                            const d = new Date(); d.setDate(d.getDate() + opt.days); d.setHours(9, 0, 0, 0);
                            setMenuId(null); onSnooze(n.id, d);
                          }}
                          style={{ display:'flex', alignItems:'center', gap:7, width:'100%', padding:'9px 12px', background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#374151', textAlign:'left', fontFamily:"system-ui,sans-serif" }}>
                          <Clock size={12} /> {opt.label}
                        </button>
                      ))}
                      <button onClick={() => { setMenuId(null); onDismiss(n.id); }}
                        style={{ display:'flex', alignItems:'center', gap:7, width:'100%', padding:'9px 12px', background:'none', border:'none', borderTop:'1px solid #f3f4f6', cursor:'pointer', fontSize:12, color:'#dc2626', textAlign:'left', fontFamily:"system-ui,sans-serif" }}>
                        <X size={12} /> Dismiss
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {expanded ? (
              <textarea value={draftOf(n)} onChange={e => setEdits(p => ({ ...p, [n.id]: e.target.value }))} rows={5}
                style={{ width:'100%', boxSizing:'border-box', margin:'9px 0 0', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:9, padding:'11px 13px', fontSize:12.5, color:'#1f2937', lineHeight:1.7, fontFamily:"system-ui,sans-serif", resize:'vertical', outline:'none' }} />
            ) : (
              <button onClick={() => setOpenId(n.id)}
                style={{ width:'100%', textAlign:'left', margin:'9px 0 0', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:9, padding:'9px 12px', fontSize:12, color:'#4b5563', lineHeight:1.6, cursor:'pointer', fontFamily:"system-ui,sans-serif", overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                {draftOf(n)}
              </button>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:9, flexWrap:'wrap' }}>
              <button onClick={() => onSend(n, draftOf(n))}
                style={{ flex:'1 1 200px', padding:'10px 14px', borderRadius:10, background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"system-ui,sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <MessageCircle size={14} /> Review &amp; send in WhatsApp
              </button>
              {expanded && (
                <button onClick={() => setOpenId(null)}
                  style={{ padding:'10px 14px', borderRadius:10, background:'#fff', border:'1px solid #e5e7eb', color:'#6b7280', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"system-ui,sans-serif" }}>
                  Collapse
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
