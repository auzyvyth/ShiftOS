import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import {
  Users,
  Flame,
  TrendingUp,
  Snowflake,
  Clipboard,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  Send,
  Megaphone,
} from "lucide-react";

function OutreachHub({ dealerId, listings }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [segment, setSegment]     = useState('hot');
  const [selectedId, setSelectedId] = useState(null);
  const [template, setTemplate]   = useState('followup');
  const [sentToday, setSentToday] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!dealerId) return;
    setLoading(true);
    supabase
      .from('whatsapp_enquiries')
      .select('id, buyer_name, buyer_phone, created_at, source, listing:listing_id(brand, model, selling_price, year, slug)')
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false })
      .limit(400)
      .then(({ data }) => { setEnquiries(data || []); setLoading(false); });
  }, [dealerId, refreshKey]);

  const now  = Date.now();
  const DAY  = 86400000;

  // Dedupe by normalised phone — keep the newest per buyer
  const deduped = useMemo(() => {
    const seen = new Map();
    (enquiries || []).forEach(e => {
      const key = (e.buyer_phone || e.id).replace(/\D/g, '');
      if (!seen.has(key)) seen.set(key, e);
    });
    return Array.from(seen.values());
  }, [enquiries]);

  // Attach score + urgency
  const scored = useMemo(() => deduped.map(e => {
    const ageDays  = (now - new Date(e.created_at).getTime()) / DAY;
    const ageHours = ageDays * 24;
    let score, urgency;
    if (ageHours < 1)       { score = 98; urgency = 'critical'; }
    else if (ageHours < 6)  { score = 90; urgency = 'high';     }
    else if (ageHours < 24) { score = 74; urgency = 'medium';   }
    else if (ageDays < 3)   { score = 54; urgency = 'low';      }
    else if (ageDays < 7)   { score = 34; urgency = 'warm';     }
    else                    { score = 14; urgency = 'cold';      }
    return { ...e, ageDays, ageHours, score, urgency };
  }), [deduped]);

  const SEGS = {
    hot:  { label: 'Hot',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   Icon: Flame,      filter: e => e.ageDays < 1 },
    warm: { label: 'Warm',  color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)',  Icon: TrendingUp, filter: e => e.ageDays >= 1 && e.ageDays < 7 },
    cold: { label: 'Cold',  color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)',  Icon: Snowflake,  filter: e => e.ageDays >= 7 },
    all:  { label: 'All',   color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', Icon: Clipboard,  filter: () => true },
  };

  const visibleLeads = useMemo(() =>
    scored.filter(SEGS[segment].filter).sort((a, b) => a.ageDays - b.ageDays)
  , [scored, segment]);

  const selected = scored.find(e => e.id === selectedId) || null;

  const TEMPLATES = {
    followup: {
      label: 'Follow-Up',  icon: '👋',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 👋\n\nJust following up on your enquiry about the ${e.listing?.year || ''} ${e.listing?.brand || ''} ${e.listing?.model || ''}${e.listing?.selling_price ? ` (RM ${e.listing.selling_price.toLocaleString()})` : ''}.\n\nAre you still looking? I'd love to help you arrange a viewing at your convenience 🚗\n\nReply anytime — happy to help!`,
    },
    viewing: {
      label: 'Book Viewing', icon: '📅',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 📅\n\nThe ${e.listing?.brand || ''} ${e.listing?.model || ''} is available for a test drive this week.\n\nWhich day works for you? We can arrange morning or afternoon. Looking forward to having you in! 🔑`,
    },
    price_drop: {
      label: 'Price Alert',  icon: '📉',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 🎉\n\nGreat news — the ${e.listing?.brand || ''} ${e.listing?.model || ''} you enquired about has just been repriced!\n\n💰 Current Price: RM ${e.listing?.selling_price?.toLocaleString() || '—'}\n\nThis is a limited opportunity. Shall I reserve it for you? Just reply YES and I'll hold it! ✅`,
    },
    last_chance: {
      label: 'Last Chance',  icon: '⏰',
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! ⏰\n\nQuick heads-up: the ${e.listing?.brand || ''} ${e.listing?.model || ''} is getting a lot of interest lately.\n\nIf you're still considering it, now's the time! I can hold it for 24h with a small deposit.\n\nLet me know! 🚗`,
    },
  };

  const urgencyColor = { critical:'#ef4444', high:'#f97316', medium:'#fbbf24', low:'#a3e635', warm:'#60a5fa', cold:'#94a3b8' };

  const fmtAge = e => {
    if (e.ageHours < 1)  return `${Math.round(e.ageHours * 60)}m ago`;
    if (e.ageHours < 24) return `${Math.round(e.ageHours)}h ago`;
    return `${Math.round(e.ageDays)}d ago`;
  };

  const openWA = (lead, msg) => {
    const raw = (lead.buyer_phone || '').replace(/\D/g, '');
    if (!raw) { toast.error('No phone number'); return; }
    const phone = raw.startsWith('6') ? raw : '6' + raw;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setSentToday(p => p + 1);
    toast.success(`WhatsApp opened for ${lead.buyer_name || 'lead'}`, { duration: 1800 });
  };

  const launchCampaign = () => {
    if (!visibleLeads.length) { toast.error('No leads in this segment'); return; }
    const batch = visibleLeads.slice(0, 10);
    batch.forEach((lead, i) => setTimeout(() => openWA(lead, TEMPLATES[template].gen(lead)), i * 750));
    toast.success(`Launching ${batch.length} WhatsApp chats…`);
  };

  // Pulse numbers
  const hotCount  = scored.filter(e => e.ageDays < 1).length;
  const staleCount = scored.filter(e => e.ageDays >= 7).length;
  const critCount = scored.filter(e => e.urgency === 'critical').length;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:320, color:'#4b5563', fontSize:13, gap:10 }}>
      <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} /> Loading contacts…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", animation:'slideUp 0.3s ease' }}>

      {/* ── Top pulse bar ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Contacts',  val: scored.length,  sub:'Unique enquiries', color:'#60a5fa', Icon: Users,       pulse:false },
          { label:'Hot Right Now',   val: hotCount,        sub:'Enquired < 24h',   color:'#ef4444', Icon: Flame,        pulse: critCount > 0 },
          { label:'Need Re-engage',  val: staleCount,      sub:'Silent 7+ days',   color:'#a78bfa', Icon: Snowflake,    pulse:false },
          { label:'Sent Today',      val: sentToday,       sub:'This session',      color:'#34d399', Icon: CheckCircle2, pulse:false },
        ].map(({ label, val, sub, color, Icon, pulse }) => (
          <div key={label} className="card-top" style={{ background:`${color}0d`, border:`1px solid ${color}20`, borderRadius:14, padding:'16px 18px', position:'relative', overflow:'hidden' }}>
            {pulse && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color},transparent)`, animation:'hotpulse 2s ease-in-out infinite' }} />}
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
              <Icon size={15} color={color} />
              <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.15em', color:'#374151', fontWeight:700 }}>{label}</p>
            </div>
            <p style={{ fontSize:30, fontWeight:800, color, lineHeight:1, marginBottom:3 }}>{val}</p>
            <p style={{ fontSize:11, color:'#4b5563' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:14, marginBottom:14 }}>

        {/* LEFT — Lead list */}
        <div style={{ background:'rgba(255,255,255,0.018)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Segment tabs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {Object.entries(SEGS).map(([key, seg]) => {
              const count = scored.filter(seg.filter).length;
              const active = segment === key;
              return (
                <button key={key} onClick={() => setSegment(key)}
                  style={{ padding:'10px 6px 12px', background:'none', border:'none', borderBottom: active ? `2px solid ${seg.color}` : '2px solid transparent', color: active ? seg.color : '#374151', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, marginBottom:-1, transition:'all 0.15s' }}>
                  <seg.Icon size={14} />
                  <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{seg.label}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background: active ? `${seg.color}18` : 'rgba(255,255,255,0.04)', color: active ? seg.color : '#374151' }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Lead scroll */}
          <div style={{ overflowY:'auto', flex:1, maxHeight:440, padding:8 }}>
            {visibleLeads.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center', color:'#374151', fontSize:13 }}>
                {React.createElement(SEGS[segment].Icon, { size: 28, style: { marginBottom: 8, color: SEGS[segment].color } })}
                <p>No {SEGS[segment].label.toLowerCase()} leads</p>
                <p style={{ fontSize:11, marginTop:4, color:'#1e293b' }}>Enquiries appear here as they come in</p>
              </div>
            ) : visibleLeads.map(lead => {
              const isActive = selectedId === lead.id;
              const uc = urgencyColor[lead.urgency] || '#94a3b8';
              const circumference = 2 * Math.PI * 14;
              const dash = (lead.score / 100) * circumference;
              return (
                <button key={lead.id} onClick={() => setSelectedId(isActive ? null : lead.id)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent', border: isActive ? '1px solid rgba(59,130,246,0.28)' : '1px solid transparent', cursor:'pointer', textAlign:'left', transition:'all 0.15s', marginBottom:3 }}>
                  {/* SVG score ring */}
                  <div style={{ flexShrink:0, position:'relative', width:34, height:34 }}>
                    <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                      <circle cx="17" cy="17" r="14" fill="none" stroke={uc} strokeWidth="3" strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
                    </svg>
                    <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:uc }}>{lead.score}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#f9fafb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.buyer_name || 'Unknown'}</span>
                      <span style={{ fontSize:9, fontWeight:700, color:uc, flexShrink:0, padding:'1px 6px', background:`${uc}14`, borderRadius:4 }}>{fmtAge(lead)}</span>
                    </div>
                    <span style={{ fontSize:11, color:'#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                      {lead.listing ? `${lead.listing.brand} ${lead.listing.model}` : 'Car enquiry'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Refresh footer */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:'#1e293b' }}>{scored.length} unique contacts</span>
            <button onClick={() => { setLoading(true); setRefreshKey(k => k + 1); }} style={{ background:'none', border:'none', color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:"'DM Sans',sans-serif", padding:'2px 6px', borderRadius:6, transition:'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#94a3b8'} onMouseLeave={e => e.currentTarget.style.color='#374151'}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        {/* RIGHT — Message Studio */}
        <div style={{ background:'rgba(255,255,255,0.018)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          {!selected ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, minHeight:340, gap:14, color:'#374151' }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>💬</div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:14, fontWeight:600, color:'#6b7280', marginBottom:6 }}>Select a contact</p>
                <p style={{ fontSize:12, color:'#374151', lineHeight:1.7 }}>Choose a lead from the list,<br/>pick a message template,<br/>and open WhatsApp with one click.</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:260 }}>
                {[
                  { icon:'🔥', text:'Hot leads need replies within 30 min' },
                  { icon:'⚡', text:'Personalized messages per buyer & car' },
                  { icon:'📈', text:'Campaign blast up to 10 contacts at once' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:14 }}>{icon}</span>
                    <span style={{ fontSize:11, color:'#4b5563' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Contact header */}
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,rgba(59,130,246,0.8),rgba(99,102,241,0.8))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, color:'white', flexShrink:0 }}>
                  {(selected.buyer_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:'white', marginBottom:2 }}>{selected.buyer_name || 'Unknown'}</p>
                  <p style={{ fontSize:11, color:'#6b7280' }}>{selected.buyer_phone} · {fmtAge(selected)}</p>
                </div>
                {selected.listing && (
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:11, color:'#60a5fa', marginBottom:1 }}>{selected.listing.brand} {selected.listing.model}</p>
                    {selected.listing.selling_price && <p style={{ fontSize:13, fontWeight:700, color:'white' }}>RM {selected.listing.selling_price.toLocaleString()}</p>}
                  </div>
                )}
              </div>

              {/* Intent score bar */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:'#374151', fontWeight:700, flexShrink:0 }}>Intent Score</p>
                <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${selected.score}%`, background:`linear-gradient(90deg, ${urgencyColor[selected.urgency]}, ${urgencyColor[selected.urgency]}cc)`, borderRadius:3, transition:'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:urgencyColor[selected.urgency], flexShrink:0 }}>{selected.score}/100</span>
              </div>

              {/* Template picker */}
              <div>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:'#374151', fontWeight:700, marginBottom:8 }}>Message Template</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {Object.entries(TEMPLATES).map(([key, t]) => (
                    <button key={key} onClick={() => setTemplate(key)}
                      style={{ padding:'9px 12px', borderRadius:9, background: template===key ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)', border: template===key ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.07)', color: template===key ? '#93c5fd' : '#6b7280', fontSize:12, fontWeight: template===key ? 600 : 400, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6, transition:'all 0.15s', textAlign:'left' }}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message preview */}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:'#374151', fontWeight:700 }}>Preview</p>
                  <span style={{ fontSize:10, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:5, padding:'2px 8px', color:'#4ade80', fontWeight:600 }}>WhatsApp</span>
                </div>
                <div style={{ background:'#0c1018', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px', minHeight:120, maxHeight:200, overflowY:'auto' }}>
                  <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.75, whiteSpace:'pre-wrap' }}>{TEMPLATES[template]?.gen(selected)}</p>
                </div>
              </div>

              {/* Send */}
              <button onClick={() => openWA(selected, TEMPLATES[template].gen(selected))} className="btn-shimmer"
                style={{ width:'100%', padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', boxShadow:'0 4px 20px rgba(34,197,94,0.3)', color:'white', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <MessageCircle size={16} /> Open WhatsApp — {(selected.buyer_name || 'Lead').split(' ')[0]}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Bulk Campaign strip ── */}
      <div style={{ background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.18)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.4),transparent)' }} />
        <Megaphone size={18} style={{ color:'#a78bfa', flexShrink:0 }} />
        <div style={{ flex:1, minWidth:200 }}>
          <p style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:2, display:'flex', alignItems:'center', gap:5 }}>Bulk Campaign · {React.createElement(SEGS[segment].Icon, { size: 13 })} {SEGS[segment].label} Leads</p>
          <p style={{ fontSize:11, color:'#6b7280', lineHeight:1.5 }}>
            Send the selected template to all {SEGS[segment].label.toLowerCase()} leads.
            {' '}<span style={{ color:'#a78bfa', fontWeight:600 }}>{Math.min(visibleLeads.length, 10)} WhatsApp chats</span> will open one by one (browser must allow popups).
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {/* Template quick-pick in campaign */}
          <select value={template} onChange={e => setTemplate(e.target.value)}
            style={{ padding:'9px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:9, color:'#d1d5db', fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:'pointer', outline:'none' }}>
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k} style={{ background:'#111118' }}>{t.icon} {t.label}</option>)}
          </select>
          <button onClick={launchCampaign}
            style={{ padding:'9px 20px', borderRadius:9, background:'rgba(167,139,250,0.18)', border:'1px solid rgba(167,139,250,0.35)', color:'#c4b5fd', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.28)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.18)'; }}>
            <Send size={13} /> Launch ({Math.min(visibleLeads.length, 10)})
          </button>
        </div>
      </div>

      {/* Tips bar */}
      <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          { icon:'⚡', tip:'Leads contacted within 5 minutes convert 8× more' },
          { icon:'🔁', tip:'Re-engage cold leads every 2 weeks with a new angle' },
          { icon:'📊', tip:'Price drop alerts have the highest open rate of any template' },
        ].map(({ icon, tip }) => (
          <div key={tip} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, flex:'1 1 auto' }}>
            <span style={{ fontSize:13, flexShrink:0 }}>{icon}</span>
            <span style={{ fontSize:11, color:'#374151', lineHeight:1.4 }}>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OutreachHub;
