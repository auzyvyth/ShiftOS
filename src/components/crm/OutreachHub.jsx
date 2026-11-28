import React, { useState, useEffect, useMemo } from 'react';
import { useModalHistory } from '../../hooks/useModalHistory';
import { usePersistentState } from '../../hooks/usePersistentState';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Users, Flame, Snowflake, CheckCircle2, TrendingUp, Clipboard, RefreshCw,
  MessageCircle, Megaphone, Send, ArrowRight, Sparkles, CalendarClock, Car,
} from 'lucide-react';
import { premiumDark as PD, premiumLight as PL } from '../../theme/tokens';
import { supabase } from '../../supabaseClient';
import { callClaude } from '../../lib/callClaude';
import { useNudges, NUDGE_PRESETS } from '../../hooks/useNudges';
import NudgeQueue from './NudgeQueue';
import { AI_FEATURES_ENABLED } from '../../utils/aiFeatureFlag';
import { useTranslation } from 'react-i18next';

// Unified Outreach — reads the SAME `leads` record the Pipeline and Bookings
// tabs use (single source of truth), so contacting / editing here reflects
// everywhere. It is the "liveliness" lens: who is hot, who's gone cold, and
// whose road tax / insurance is expiring (from the customers table).
//
// Active stages only — closed deals drop out of outreach. 'enquiry' is the
// pre-pipeline stage (raw WhatsApp enquiries that haven't been qualified yet);
// contacting one promotes it to 'contacted' so it enters the pipeline.
const ACTIVE_STAGES = ['enquiry', 'new', 'contacted', 'viewing_booked', 'test_drive', 'negotiating', 'deposit_taken'];

// Outreach sits on two surfaces: the LIGHT dealer dashboard (CRM tab) and the
// DARK salesman panel (Premium / dealer-linked). It was hardcoded light, so on
// Premium the whole tab rendered as a white slab on a #080a12 page. One palette
// per theme and one lookup below — never a second copy of the component.
const PALETTES = {
  light: {
    surface:'#fff', surfaceAlt:'#f9fafb', fill:'#f3f4f6', imgFill:'#eef2f7', ring:'#e5e7eb',
    border:'#e5e7eb', text:'#111827', textSec:'#374151', textMuted:'#6b7280', textDim:'#9ca3af',
    inkBtn:'#111827', inkBtnText:'#fff',
    okBg:'#f0fdf4', okBorder:'#86efac', okText:'#15803d', okTick:'#16a34a',
    infoBg:'#EFF6FF', infoBorder:'#93c5fd', infoText:'#2563eb',
    violetBorder:'#ddd6fe', violetText:'#6d28d9', violetStrong:'#7c3aed',
    dangerBorder:'#fecaca', dangerText:'#dc2626',
  },
  dark: {
    surface:'#0d1117', surfaceAlt:'rgba(255,255,255,0.04)', fill:'rgba(255,255,255,0.06)',
    imgFill:'rgba(255,255,255,0.06)', ring:'rgba(255,255,255,0.10)',
    border:'rgba(255,255,255,0.07)', text:'#f1f5f9', textSec:'#94a3b8', textMuted:'#94a3b8', textDim:'#64748b',
    inkBtn:'#dc2626', inkBtnText:'#fff',
    okBg:'rgba(34,197,94,0.10)', okBorder:'rgba(34,197,94,0.28)', okText:'#4ade80', okTick:'#4ade80',
    infoBg:'rgba(59,130,246,0.12)', infoBorder:'rgba(59,130,246,0.35)', infoText:'#60a5fa',
    violetBorder:'rgba(167,139,250,0.35)', violetText:'#c4b5fd', violetStrong:'#a78bfa',
    dangerBorder:'rgba(239,68,68,0.35)', dangerText:'#f87171',
  },
  // Salesman Premium (SIMPLE-2): depth by tone, no borders, red for fills,
  // mint the only green; info / violet / warn hues fold into neutral tones.
  premium: {
    surface:PD.card, surfaceAlt:PD.raised, fill:PD.hover, imgFill:PD.raised, ring:PD.hover,
    border:'transparent', text:PD.text, textSec:PD.textSec, textMuted:PD.textSec, textDim:PD.textMuted,
    inkBtn:PD.accent, inkBtnText:PD.onAccent,
    okBg:PD.raised, okBorder:'transparent', okText:PD.up, okTick:PD.up,
    infoBg:PD.hover, infoBorder:'transparent', infoText:PD.text,
    violetBorder:'transparent', violetText:PD.text, violetStrong:PD.accent,
    dangerBorder:'transparent', dangerText:PD.accentText,
  },
  // Dealer dashboard (premiumLight): same rules on the light surface. White cards
  // float on a shadow, grey rows inside, no borders, no tints; red only for fills.
  plight: {
    surface:PL.card, surfaceAlt:PL.raised, fill:PL.hover, imgFill:PL.raised, ring:PL.hover,
    border:'transparent', text:PL.text, textSec:PL.textSec, textMuted:PL.textSec, textDim:PL.textMuted,
    inkBtn:PL.text, inkBtnText:PL.onAccent,
    okBg:PL.raised, okBorder:'transparent', okText:PL.up, okTick:PL.up,
    infoBg:PL.hover, infoBorder:'transparent', infoText:PL.text,
    violetBorder:'transparent', violetText:PL.text, violetStrong:PL.text,
    dangerBorder:'transparent', dangerText:PL.accentText,
  },
};

// salesmanId (optional): when set, the hub is scoped to that salesman's own
// leads only — secure + attributable. Omit it for the dealer-wide view.
export default function OutreachHub({ dealerId, salesmanId = null, theme = 'light' }) {
  const { t } = useTranslation();
  const P = PALETTES[theme] || PALETTES.light;
  // Premium also drops what this screen repeated (the four count tiles, the
  // time-since-contact "score" ring, the footer count) and its extra hues.
  const prem = theme === 'premium';
  const plight = theme === 'plight';
  const K = prem ? PD : plight ? PL : null;
  const slim = !!K;
  const FONT = slim ? 'inherit' : "system-ui,sans-serif";
  // The WhatsApp button: one red fill in Premium, the green gradient elsewhere.
  const WA_BTN = slim
    ? { background:K.accent, boxShadow:'none', color:K.onAccent }
    : { background:'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow:'0 4px 20px rgba(34,197,94,0.3)', color:'white' };
  // Painted from the device's last copy, refreshed behind it (PERF-LOAD). The
  // select carries no IC or address, so nothing needs redacting.
  const [leadsData, setLeadsData, leadsCached] = usePersistentState(
    dealerId ? `outreach:${salesmanId || 'all'}:${dealerId}` : null, [],
  );
  const [loading, setLoading]     = useState(!leadsCached);
  const [segment, setSegment]     = useState('hot');
  const [selectedId, setSelectedId] = useState(null);
  const [template, setTemplate]   = useState('followup');
  const [refreshKey, setRefreshKey] = useState(0);
  const [campaignIds, setCampaignIds] = useState(null); // ordered lead ids, null = inactive
  useModalHistory(!!campaignIds, () => setCampaignIds(null));
  const [campaignIdx, setCampaignIdx] = useState(0);
  const [pushing, setPushing]     = useState(false);
  const [draft, setDraft]         = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiIsDraft, setAiIsDraft] = useState(false); // current draft came from the AI
  const [scheduleOpen, setScheduleOpen] = useState(false);
  useModalHistory(scheduleOpen, () => setScheduleOpen(false));
  const [customWhen, setCustomWhen]     = useState('');

  // RAPTOR-1/4 — follow-up nudges are per-salesman, so they only exist in the
  // salesman-scoped view. The dealer-wide hub (no salesmanId) skips them.
  const { due, scheduled, createNudge, closeNudge, snoozeNudge } = useNudges(salesmanId, dealerId);

  useEffect(() => {
    if (!dealerId) return;
    // Outreach works UNFINISHED leads only (active pipeline stages). Finished
    // leads — and their road tax / insurance expiry — live in the Customers tab.
    let q = supabase
      .from('leads')
      .select('id, buyer_name, phone, stage, created_at, last_contacted_at, car_listing_id, car_listing:car_listing_id(brand, model, year, selling_price, images, vin_number, engine_cc, colour, mileage, transmission, fuel_type)')
      .eq('dealer_id', dealerId)
      .eq('is_deleted', false)
      .in('stage', ACTIVE_STAGES);
    // Salesman context: only their own leads (secure + attributable by name).
    if (salesmanId) q = q.eq('salesman_id', salesmanId);
    q.order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => { if (!error) setLeadsData(data || []); setLoading(false); });
  }, [dealerId, salesmanId, refreshKey]);

  const now = Date.now();
  const DAY = 86400000;

  // Liveliness = time since last touch (last_contacted_at, else created_at).
  const scored = useMemo(() => (leadsData || []).map(l => {
    const last = l.last_contacted_at || l.created_at;
    const ageDays  = (now - new Date(last).getTime()) / DAY;
    const ageHours = ageDays * 24;
    let score, urgency;
    if (ageHours < 1)       { score = 98; urgency = 'critical'; }
    else if (ageHours < 6)  { score = 90; urgency = 'high';     }
    else if (ageHours < 24) { score = 74; urgency = 'medium';   }
    else if (ageDays < 3)   { score = 54; urgency = 'low';      }
    else if (ageDays < 7)   { score = 34; urgency = 'warm';     }
    else                    { score = 14; urgency = 'cold';     }
    return { ...l, ageDays, ageHours, score, urgency };
  }), [leadsData]); // eslint-disable-line react-hooks/exhaustive-deps

  const SEGS = {
    hot:  { label: t("outreach.hot"),  color: slim ? K.text : '#ef4444', Icon: Flame,      filter: e => e.ageDays < 1 },
    warm: { label: t("outreach.warm"), color: slim ? K.text : '#f97316', Icon: TrendingUp, filter: e => e.ageDays >= 1 && e.ageDays < 7 },
    cold: { label: t("outreach.cold"), color: slim ? K.text : '#60a5fa', Icon: Snowflake,  filter: e => e.ageDays >= 7 },
    all:  { label: t("outreach.all"),  color: slim ? K.text : '#94a3b8', Icon: Clipboard,  filter: () => true },
  };

  const visibleLeads = useMemo(() =>
    scored.filter(SEGS[segment].filter).sort((a, b) => a.ageDays - b.ageDays)
  , [scored, segment]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = scored.find(e => e.id === selectedId) || null;

  const TEMPLATES = {
    followup: { label: t("outreach.followUp"),
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 👋\n\nJust following up on your interest in the ${e.car_listing?.year || ''} ${e.car_listing?.brand || ''} ${e.car_listing?.model || ''}${e.car_listing?.selling_price ? ` (RM ${e.car_listing.selling_price.toLocaleString()})` : ''}.\n\nAre you still looking? I'd love to help you arrange a viewing 🚗\n\nReply anytime!` },
    viewing: { label: t("outreach.bookViewing"),
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 📅\n\nThe ${e.car_listing?.brand || ''} ${e.car_listing?.model || ''} is available for a test drive this week.\n\nWhich day works for you? Morning or afternoon 🔑` },
    price_drop: { label: t("outreach.priceAlert"),
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! 🎉\n\nGreat news — the ${e.car_listing?.brand || ''} ${e.car_listing?.model || ''} you were interested in has just been repriced!\n\n💰 Current Price: RM ${e.car_listing?.selling_price?.toLocaleString() || '—'}\n\nShall I reserve it for you? Reply YES ✅` },
    last_chance: { label: t("outreach.lastChance"),
      gen: e => `Hi ${(e.buyer_name || 'there').split(' ')[0]}! ⏰\n\nQuick heads-up: the ${e.car_listing?.brand || ''} ${e.car_listing?.model || ''} is getting a lot of interest.\n\nStill considering it? I can hold it 24h with a small deposit 🚗` },
  };

  useEffect(() => {
    if (selected) setDraft(TEMPLATES[template]?.gen(selected) || '');
    else setDraft('');
    setAiIsDraft(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, template]);

  // Overlay rule 2 — lock body scroll while the schedule sheet is open.
  useEffect(() => {
    if (!scheduleOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [scheduleOpen]);

  // Premium: only a lead that has gone quiet a week or more is red (it needs
  // you); everything else is neutral. Elsewhere, the old six-hue scale.
  const urgencyColor = slim
    ? { critical:K.textSec, high:K.textSec, medium:K.textSec, low:K.textSec, warm:K.textSec, cold:K.accentText }
    : { critical:'#ef4444', high:'#f97316', medium:'#fbbf24', low:'#a3e635', warm:'#60a5fa', cold:'#94a3b8' };

  const fmtAge = e => {
    if (e.ageHours < 1)  return `${Math.round(e.ageHours * 60)}m`;
    if (e.ageHours < 24) return `${Math.round(e.ageHours)}h`;
    return `${Math.round(e.ageDays)}d`;
  };
  const fmtContacted = ts => {
    if (!ts) return null;
    const mins = (now - new Date(ts).getTime()) / 60000;
    if (mins < 1) return 'just now';
    if (mins < 60) return `${Math.round(mins)}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  // Stamp contact on the shared leads row — reflects in Pipeline/Bookings. An
  // enquiry-stage lead is promoted to 'contacted' (enters the pipeline) on first
  // outreach. Optimistic local update first.
  const markContacted = (lead) => {
    const ts = new Date().toISOString();
    const patch = { last_contacted_at: ts };
    if (lead.stage === 'enquiry') patch.stage = 'contacted';
    setLeadsData(prev => prev.map(l => l.id === lead.id ? { ...l, ...patch } : l));
    supabase.from('leads').update(patch).eq('id', lead.id).then(({ error }) => { if (error) console.error(error); });
  };

  const openWA = (lead, msg) => {
    const raw = (lead.phone || '').replace(/\D/g, '');
    if (!raw) { toast.error(t("outreach.noPhoneNumber")); return null; }
    const phone = raw.startsWith('6') ? raw : '6' + raw;
    const win = window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    markContacted(lead);
    toast.success(t("outreach.waOpenedFor", { name: lead.buyer_name || t("outreach.leadFallback") }), { duration: 1800 });
    return win;
  };

  // --- RAPTOR-1: AI drafting + timed nudges -------------------------------
  // The AI writes the message; a human always reads it and sends it. There is
  // deliberately no path here that messages a buyer on its own.

  // Reuses the existing 'wa_reply' AI feature key (50/day) rather than adding a
  // new one — salesman_ai_quota_ok() returns false for any key it doesn't know,
  // so an invented key would silently disable the button for everyone.
  const aiDraft = async () => {
    if (!selected || aiLoading) return;
    setAiLoading(true);
    try {
      const { data: quotaOk } = await supabase.rpc('salesman_ai_quota_ok', { p_feature: 'wa_reply' });
      if (quotaOk === false) {
        toast.error(t("outreach.aiDraftingIsAPremium"));
        return;
      }
      const car = selected.car_listing;
      const carName = car ? [car.year, car.brand, car.model].filter(Boolean).join(' ') : 'the car they enquired about';
      const days = Math.round(selected.ageDays);
      const prompt = `Write a short WhatsApp follow-up from a Malaysian used-car salesman to a buyer.
Buyer: ${selected.buyer_name || 'the buyer'}
Car they enquired about: ${carName}
Pipeline stage: ${selected.stage}
Days since last contact: ${days}
Casual Bahasa Malaysia mixed with English. Max 3 sentences. Warm, not pushy. End with one easy next step (a question they can answer in a few words).
Hard rules: do NOT state, invent, change or imply any price, discount, deposit, instalment figure, trade-in value, loan rate or financing approval. Do not promise availability or a delivery date. If a number is needed, ask the buyer to confirm with the salesman instead.`;
      const text = await callClaude(
        prompt,
        'You are a friendly Malaysian car salesman. Reply with the WhatsApp message text only, no labels or quotes.',
        'wa_reply',
      );
      setDraft(text);
      setAiIsDraft(true);
      await supabase.rpc('increment_ai_usage', { p_feature: 'wa_reply' }).then(null, () => {});
    } catch (err) {
      console.error('aiDraft:', err);
      toast.error(t("outreach.couldNotDraftAMessage"));
    } finally {
      setAiLoading(false);
    }
  };

  // Queue the message currently in the composer as a reminder for later.
  const scheduleNudge = async (when) => {
    if (!selected || !when || Number.isNaN(when.getTime())) return;
    if (when.getTime() <= Date.now()) { toast.error(t("outreach.pickATimeInThe")); return; }
    const body = draft || TEMPLATES[template].gen(selected);
    const res = await createNudge({
      leadId: selected.id,
      message: body,
      when,
      reason: `${Math.round(selected.ageDays)}d since last touch`,
      aiDrafted: aiIsDraft,
    });
    if (res.duplicate) { toast.error(t("outreach.thisLeadAlreadyHasA")); return; }
    if (!res.ok) { toast.error(t("outreach.couldNotScheduleTheFollow")); return; }
    setScheduleOpen(false);
    setCustomWhen('');
    toast.success(t("outreach.followUpQueued", { when: when.toLocaleString('en-MY', { weekday:'short', hour:'numeric', minute:'2-digit', hour12:true }) }));
  };

  // A due nudge: open the chat with the (possibly edited) draft, then retire it.
  const sendNudge = (nudge, message) => {
    const lead = scored.find(l => l.id === nudge.lead_id)
      || { id: nudge.lead_id, phone: nudge.lead?.phone, buyer_name: nudge.lead?.buyer_name, stage: nudge.lead?.stage };
    if (!lead.phone) { toast.error(t("outreach.noPhoneNumberOnThis")); return; }
    openWA(lead, message);
    closeNudge(nudge.id, 'sent');
  };

  // Manual guided campaign. Opening many tabs at once gets popup-blocked and the
  // browser can't tell which were actually sent, so instead we queue the segment
  // and open ONE chat per click (a real user gesture → never blocked). The dealer
  // sends in WhatsApp, comes back, clicks the next — counter ticks down.
  const launchCampaign = () => {
    if (!visibleLeads.length) { toast.error(t("outreach.noLeadsInThisSegment")); return; }
    setCampaignIds(visibleLeads.map(l => l.id));
    setCampaignIdx(0);
  };
  const campaignCurrent = campaignIds ? scored.find(e => e.id === campaignIds[campaignIdx]) : null;
  const campaignDone = campaignIds && campaignIdx >= campaignIds.length;
  const contactCurrent = () => {
    if (!campaignCurrent) { setCampaignIdx(i => i + 1); return; }
    openWA(campaignCurrent, TEMPLATES[template].gen(campaignCurrent));
    setCampaignIdx(i => i + 1);
  };
  const endCampaign = () => { setCampaignIds(null); setCampaignIdx(0); };

  // Promote a raw enquiry into the visible pipeline (stage 'new').
  const promoteToPipeline = async (lead) => {
    if (!lead || pushing) return;
    setPushing(true);
    const { error } = await supabase.from('leads').update({ stage: 'new' }).eq('id', lead.id);
    if (error) { toast.error(t("outreach.couldNotAddToPipeline")); setPushing(false); return; }
    setLeadsData(prev => prev.map(l => l.id === lead.id ? { ...l, stage: 'new' } : l));
    toast.success(t("outreach.addedToPipeline"));
    setPushing(false);
  };

  const hotCount   = scored.filter(e => e.ageDays < 1).length;
  const staleCount = scored.filter(e => e.ageDays >= 7).length;
  const critCount  = scored.filter(e => e.urgency === 'critical').length;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sentToday  = scored.filter(e => e.last_contacted_at && new Date(e.last_contacted_at) >= todayStart).length;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:320, color:P.textSec, fontSize:13, gap:10 }}>
      <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} /> {t("outreach.loadingContacts")}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const STATS = [
    { label:t("outreach.activeContacts"), val: scored.length, sub:t("outreach.inPlayNow"),     color:'#60a5fa', Icon: Users,        pulse:false },
    { label:t("outreach.hotRightNow"),   val: hotCount,      sub:t("outreach.touched24h"),   color:'#ef4444', Icon: Flame,        pulse: critCount > 0 },
    { label:t("outreach.goneCold"),       val: staleCount,    sub:t("outreach.silent7Days"),  color:'#a78bfa', Icon: Snowflake,    pulse:false },
    { label:t("outreach.contactedToday"), val: sentToday,     sub:t("outreach.persisted"),       color:'#34d399', Icon: CheckCircle2, pulse:false },
  ];

  return (
    <div style={{ fontFamily:FONT }}>
      {/* Pulse bar. Premium: three of the four counts are the Hot / Cold / All
          switch below, so only "contacted today" stays, as a line. */}
      {slim ? (
        <p style={{ margin:'0 0 14px', fontSize:13, color:P.textSec }}>
          <b style={{ color:P.text, fontVariantNumeric:'tabular-nums' }}>{sentToday}</b> {t("outreach.contactedToday2")}
        </p>
      ) : (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:20 }}>
        {STATS.map(({ label, val, sub, color, Icon, pulse }) => (
          <div key={label} style={{ background:`${color}0d`, border:`1px solid ${color}20`, borderRadius:14, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
            {pulse && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color},transparent)`, animation:'hotpulse 2s ease-in-out infinite' }} />}
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
              <Icon size={14} color={color} />
              <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.12em', color:P.textSec, fontWeight:700 }}>{label}</p>
            </div>
            <p style={{ fontSize:26, fontWeight:800, color, lineHeight:1, marginBottom:3 }}>{val}</p>
            <p style={{ fontSize:11, color:P.textSec }}>{sub}</p>
          </div>
        ))}
      </div>
      )}

      {salesmanId && (
        <NudgeQueue due={due} scheduled={scheduled}
          onSend={sendNudge}
          onSnooze={snoozeNudge}
          onDismiss={(id) => closeNudge(id, 'dismissed')} theme={theme} />
      )}

      <style>{`.oh-body{display:grid;grid-template-columns:340px minmax(0,1fr);gap:14px;margin-bottom:14px}.oh-body>*{min-width:0}.oh-empty{min-height:300px}@media(max-width:768px){.oh-body{grid-template-columns:minmax(0,1fr)}.oh-slim .oh-empty{min-height:0;padding:8px 0}}`}</style>
      <div className={slim ? 'oh-body oh-slim' : 'oh-body'}>
        {/* LEFT — Lead list */}
        <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius: slim ? K.radius.card : 16, boxShadow: plight ? PL.shadow : undefined, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div data-tour-id="oh-segments" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderBottom:`1px solid ${slim ? K.line : P.border}` }}>
            {Object.entries(SEGS).map(([key, seg]) => {
              const count = scored.filter(seg.filter).length;
              const active = segment === key;
              return (
                <button key={key} onClick={() => setSegment(key)}
                  style={{ padding:'10px 6px 12px', background:'none', border:'none', borderBottom: active ? `2px solid ${slim ? K.accent : seg.color}` : '2px solid transparent', color: active ? seg.color : P.textSec, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, marginBottom:-1, fontFamily:FONT }}>
                  <seg.Icon size={14} />
                  <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{seg.label}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background: active ? (slim ? K.hover : `${seg.color}18`) : P.fill, color: active ? seg.color : P.textSec }}>{count}</span>
                </button>
              );
            })}
          </div>
          {/* Premium: the cap follows the screen's HEIGHT; 55vw left a phone about
              three rows inside a 200px box. */}
          <div style={{ overflowY:'auto', flex:1, maxHeight: slim ? 'min(520px, 60vh)' : 'min(440px, 55vw)', padding:8 }}>
            {visibleLeads.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center', color:P.textSec, fontSize:13 }}>
                {React.createElement(SEGS[segment].Icon, { size: 28, style: { marginBottom: 8, color: slim ? K.textMuted : SEGS[segment].color } })}
                <p>No {SEGS[segment].label.toLowerCase()} leads</p>
              </div>
            ) : visibleLeads.map(lead => {
              const isActive = selectedId === lead.id;
              const uc = urgencyColor[lead.urgency] || '#94a3b8';
              const circ = 2 * Math.PI * 14;
              const dash = (lead.score / 100) * circ;
              return (
                <button key={lead.id} onClick={() => setSelectedId(isActive ? null : lead.id)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, background: isActive ? (slim ? K.raised : 'rgba(59,130,246,0.1)') : 'transparent', border: isActive && !slim ? '1px solid rgba(59,130,246,0.28)' : '1px solid transparent', cursor:'pointer', textAlign:'left', marginBottom:3, fontFamily:FONT }}>
                  {/* The ring's 0-100 "score" is only time since last contact,
                      which the age chip already says; Premium shows the chip alone. */}
                  {!slim && <div style={{ flexShrink:0, position:'relative', width:34, height:34 }}>
                    <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="17" cy="17" r="14" fill="none" stroke={P.ring} strokeWidth="3" />
                      <circle cx="17" cy="17" r="14" fill="none" stroke={uc} strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                    </svg>
                    <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:uc }}>{lead.score}</span>
                  </div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:P.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                        {lead.buyer_name || t("outreach.unknown")}
                        {lead.last_contacted_at && <CheckCircle2 size={12} style={{ color:P.okTick, flexShrink:0 }} />}
                      </span>
                      <span style={{ fontSize: slim ? 11 : 9, fontWeight:700, color:uc, flexShrink:0, padding: slim ? '1px 7px' : '1px 6px', background: slim ? K.raised : `${uc}14`, borderRadius: slim ? 999 : 4 }}>{fmtAge(lead)}</span>
                    </div>
                    <span style={{ fontSize:11, color:P.textSec, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                      {lead.car_listing ? `${lead.car_listing.brand} ${lead.car_listing.model}` : t("outreach.carEnquiry")}
                      {lead.stage === 'enquiry' && <span style={{ marginLeft:6, fontSize:9, fontWeight:700, color: slim ? K.onAccent : '#a78bfa', background: slim ? K.accent : 'rgba(167,139,250,0.12)', padding:'1px 5px', borderRadius:4 }}>{t("outreach.new")}</span>}
                    </span>
                    {lead.last_contacted_at && (
                      <span style={{ fontSize:10, color:P.okTick, fontWeight:600, display:'block', marginTop:1 }}>
                        {t("outreach.contacted")} {fmtContacted(lead.last_contacted_at)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ borderTop:`1px solid ${slim ? K.line : P.border}`, padding:'8px 12px', display:'flex', alignItems:'center', justifyContent: slim ? 'flex-end' : 'space-between' }}>
            {!slim && <span style={{ fontSize:11, color:P.textSec }}>{scored.length} {t("outreach.activeContacts2")}</span>}
            <button onClick={() => setRefreshKey(k => k + 1)} style={{ background:'none', border:'none', color:P.textSec, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:FONT }}>
              <RefreshCw size={11} /> {t("outreach.refresh")}
            </button>
          </div>
        </div>

        {/* RIGHT — Message studio */}
        <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius: slim ? K.radius.card : 16, boxShadow: plight ? PL.shadow : undefined, padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          {!selected ? (
            <div className="oh-empty" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, color:P.textSec }}>
              <div style={{ width:56, height:56, borderRadius:16, background: slim ? K.raised : 'rgba(59,130,246,0.07)', border: slim ? 'none' : '1px solid rgba(59,130,246,0.14)', display:'flex', alignItems:'center', justifyContent:'center' }}><MessageCircle size={24} color={slim ? K.textSec : '#60a5fa'} /></div>
              <p style={{ fontSize:13, color:P.textMuted, textAlign:'center', lineHeight:1.6 }}>{t("outreach.selectAContactToMessage")}<br/>{t("outreach.orLaunchABulkCampaign")}</p>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding: slim ? 0 : '12px 16px', background: slim ? 'transparent' : 'rgba(59,130,246,0.07)', border: slim ? 'none' : '1px solid rgba(59,130,246,0.18)', borderRadius:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background: slim ? K.raised : 'linear-gradient(135deg,rgba(59,130,246,0.8),rgba(99,102,241,0.8))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, color: slim ? K.textSec : 'white', flexShrink:0 }}>
                  {(selected.buyer_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:P.text, marginBottom:2 }}>{selected.buyer_name || t("outreach.unknown")}</p>
                  <p style={{ fontSize:11, color:P.textMuted }}>{selected.phone} · {selected.last_contacted_at ? t("outreach.contactedAgo", { when: fmtContacted(selected.last_contacted_at) }) : t("outreach.enquiredAgo", { age: fmtAge(selected) })}</p>
                </div>
                {/* Premium: the car card right below names the car and its price. */}
                {selected.car_listing && !slim && (
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:11, color:'#60a5fa', marginBottom:1 }}>{selected.car_listing.brand} {selected.car_listing.model}</p>
                    {selected.car_listing.selling_price && <p style={{ fontSize:13, fontWeight:700, color:P.text }}>RM {selected.car_listing.selling_price.toLocaleString()}</p>}
                  </div>
                )}
              </div>

              {/* Car of interest — image + key specs so the dealer can speak to it */}
              {selected.car_listing && (
                <div style={{ display:'flex', gap:12, padding:'12px', background:P.surfaceAlt, border:`1px solid ${P.border}`, borderRadius:12 }}>
                  {selected.car_listing.images?.[0]
                    ? <img src={selected.car_listing.images[0]} alt="" style={{ width:96, height:72, borderRadius:9, objectFit:'cover', flexShrink:0, border:`1px solid ${P.border}` }} />
                    : <div style={{ width:96, height:72, borderRadius:9, background:P.imgFill, border:`1px solid ${P.border}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}><Car size={22} color={P.textDim} /></div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:P.text, margin:'0 0 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {selected.car_listing.year || ''} {selected.car_listing.brand} {selected.car_listing.model}
                      {slim && selected.car_listing.selling_price ? <span style={{ fontWeight:600, color:P.textSec }}> · RM {selected.car_listing.selling_price.toLocaleString()}</span> : null}
                    </p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px' }}>
                      {[
                        ['Year', slim ? null : selected.car_listing.year], // Premium: the title above says the year
                        ['Engine', selected.car_listing.engine_cc ? `${selected.car_listing.engine_cc} cc` : null],
                        ['Colour', selected.car_listing.colour],
                        ['VIN', selected.car_listing.vin_number],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ minWidth:0 }}>
                          <span style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:P.textDim, fontWeight:700 }}>{k}</span>
                          <p style={{ fontSize:11.5, color:P.textSec, fontWeight:600, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={String(v)}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:P.textSec, fontWeight:700, marginBottom:8 }}>{t("outreach.messageTemplate")}</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {Object.entries(TEMPLATES).map(([key, tpl]) => (
                    <button key={key} onClick={() => setTemplate(key)}
                      style={{ padding:'9px 12px', borderRadius:9, background: template===key ? P.infoBg : P.surfaceAlt, border: template===key ? `1px solid ${P.infoBorder}` : `1px solid ${P.border}`, color: template===key ? P.infoText : P.textMuted, fontSize:12, fontWeight: template===key ? 600 : 400, cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:6, textAlign:'left' }}>
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                  <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.14em', color:P.textSec, fontWeight:700, margin:0 }}>
                    {t("outreach.previewEditable")}{aiIsDraft ? t("outreach.aiDraft") : ''}
                  </p>
                  {salesmanId && (
                    AI_FEATURES_ENABLED ? (
                      <button onClick={aiDraft} disabled={aiLoading}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8, background: slim ? K.raised : P.surface, border:`1px solid ${P.violetBorder}`, color:P.violetText, fontSize:11, fontWeight:600, cursor: aiLoading ? 'wait' : 'pointer', fontFamily:FONT, opacity: aiLoading ? 0.6 : 1 }}>
                        <Sparkles size={11} /> {aiLoading ? t("outreach.writing") : t("outreach.aiDraft2")}
                      </button>
                    ) : (
                      <span title={t("outreach.noAnthropicApiCreditsLoaded")}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8, background:'transparent', border:`1px solid ${P.border}`, color:P.textSec, fontSize:11, fontWeight:600, fontFamily:FONT, opacity:0.7 }}>
                        <Sparkles size={11} /> {t("outreach.aiDraftComingSoon")}
                      </span>
                    )
                  )}
                </div>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6}
                  style={{ width:'100%', boxSizing:'border-box', background:P.surfaceAlt, border:`1px solid ${P.border}`, borderRadius:10, padding:'14px 16px', minHeight:120, maxHeight:240, fontSize:13, color:P.text, lineHeight:1.75, fontFamily:FONT, resize:'vertical', outline:'none' }} />
              </div>

              <button onClick={() => openWA(selected, draft || TEMPLATES[template].gen(selected))}
                style={{ width:'100%', padding:'14px', borderRadius: slim ? 999 : 12, ...WA_BTN, border:'none', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <MessageCircle size={16} /> {t("outreach.openWhatsapp")} {(selected.buyer_name || 'Lead').split(' ')[0]}
              </button>

              {/* Not a scheduled SEND — it queues a reminder with this message
                  ready, and you send it yourself when it comes due. */}
              {salesmanId && (
                <button onClick={() => setScheduleOpen(true)}
                  style={{ width:'100%', padding:'11px', borderRadius: slim ? 999 : 12, background: slim ? K.raised : P.surface, border:`1px solid ${P.border}`, color: slim ? K.text : P.textSec, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                  <CalendarClock size={14} /> {t("outreach.remindMeToSendThis")}
                </button>
              )}

              {selected.stage === 'enquiry' ? (
                <button onClick={() => promoteToPipeline(selected)} disabled={pushing}
                  style={{ width:'100%', padding:'11px', borderRadius: slim ? 999 : 12, background: slim ? K.raised : P.surface, border:`1px solid ${P.infoBorder}`, color:P.infoText, fontSize:13, fontWeight:600, cursor: pushing ? 'wait' : 'pointer', fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity: pushing ? 0.6 : 1 }}>
                  <ArrowRight size={14} /> {pushing ? t("outreach.adding") : t("outreach.addToPipeline")}
                </button>
              ) : (
                <div style={{ width:'100%', padding:'10px', borderRadius:12, background:P.okBg, border:`1px solid ${P.okBorder}`, color:P.okText, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                  <CheckCircle2 size={14} /> {t("outreach.inPipeline")} {selected.stage.replace('_', ' ')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk campaign */}
      <div style={{ boxShadow: plight ? PL.shadow : undefined, background: slim ? K.card : 'rgba(167,139,250,0.06)', border: slim ? 'none' : '1px solid rgba(167,139,250,0.18)', borderRadius: slim ? K.radius.card : 14, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <Megaphone size={18} style={{ color: slim ? K.textSec : '#a78bfa', flexShrink:0 }} />
        <div style={{ flex:1, minWidth:200 }}>
          <p style={{ fontSize:13, fontWeight:700, color:P.text, marginBottom:2 }}>{t("outreach.bulkCampaign")} {SEGS[segment].label} {t("outreach.leads")}</p>
          <p style={{ fontSize:11, color:P.textMuted, lineHeight:1.5 }}>
            {t("outreach.guidedSendTo")} <span style={{ color: slim ? K.text : '#a78bfa', fontWeight:600 }}>{visibleLeads.length} {t("outreach.contactsWord")}</span> {t("outreach.oneChatPerClickYou")}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <select value={template} onChange={e => setTemplate(e.target.value)}
            style={{ padding:'9px 12px', background: slim ? K.raised : P.surface, border:`1px solid ${P.border}`, borderRadius: slim ? 999 : 9, color: slim ? K.text : P.textSec, colorScheme: prem ? 'dark' : undefined, fontSize:12, fontFamily:FONT, cursor:'pointer', outline:'none' }}>
            {Object.entries(TEMPLATES).map(([k, tpl]) => <option key={k} value={k}>{tpl.label}</option>)}
          </select>
          <button data-tour-id="oh-campaign" onClick={launchCampaign}
            style={{ padding:'9px 20px', borderRadius: slim ? 999 : 9, background: plight ? PL.text : slim ? K.accent : 'rgba(167,139,250,0.18)', border: slim ? 'none' : '1px solid rgba(167,139,250,0.35)', color: slim ? K.onAccent : P.violetText, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}>
            <Send size={13} /> {t("outreach.contactAll")}{visibleLeads.length})
          </button>
        </div>
      </div>

      {/* Guided campaign — one contact per click, counter ticks down */}
      {campaignIds && createPortal(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:16 }}>
          <div style={{ background:P.surface, borderRadius:16, maxWidth:420, width:'100%', padding:24, fontFamily:FONT, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            {campaignDone ? (
              <div style={{ textAlign:'center', padding:'12px 4px' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:P.okBg, border:`1px solid ${P.okBorder}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                  <CheckCircle2 size={28} style={{ color:P.okTick }} />
                </div>
                <h3 style={{ fontSize:17, fontWeight:700, color:P.text, margin:'0 0 6px' }}>{t("outreach.campaignComplete")}</h3>
                <p style={{ fontSize:13, color:P.textMuted, margin:'0 0 20px' }}>{t("outreach.youContacted")} {campaignIds.length} {campaignIds.length === 1 ? t("outreach.leadSing") : t("outreach.leadPl")}.</p>
                <button onClick={endCampaign}
                  style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:P.inkBtn, color:P.inkBtnText, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FONT }}>
                  {t("outreach.done")}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <Megaphone size={18} style={{ color: slim ? K.textSec : P.violetStrong }} />
                    <h3 style={{ fontSize:15, fontWeight:700, color:P.text, margin:0 }}>{t("outreach.guidedCampaign")}</h3>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color: slim ? K.text : P.violetStrong, background: slim ? K.raised : 'rgba(167,139,250,0.12)', borderRadius:20, padding:'3px 11px' }}>
                    {campaignIds.length - campaignIdx} left
                  </span>
                </div>
                {/* progress */}
                <div style={{ height:6, background:P.fill, borderRadius:3, overflow:'hidden', marginBottom:16 }}>
                  <div style={{ height:'100%', width:`${(campaignIdx / campaignIds.length) * 100}%`, background:P.violetStrong, borderRadius:3, transition:'width 0.3s' }} />
                </div>
                <p style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:P.textDim, fontWeight:700, margin:'0 0 6px' }}>
                  {t("outreach.leadOf", { i: campaignIdx + 1, n: campaignIds.length })}
                </p>
                <div style={{ background:P.surfaceAlt, border:`1px solid ${P.border}`, borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                  <p style={{ fontSize:15, fontWeight:700, color:P.text, margin:'0 0 2px' }}>{campaignCurrent?.buyer_name || t("outreach.unknown")}</p>
                  <p style={{ fontSize:12, color:P.textMuted, margin:0 }}>
                    {campaignCurrent?.phone || t("outreach.noPhone")}{campaignCurrent?.car_listing ? ` · ${campaignCurrent.car_listing.brand} ${campaignCurrent.car_listing.model}` : ''}
                  </p>
                </div>
                <p style={{ fontSize:12, color:P.textDim, lineHeight:1.5, margin:'0 0 16px', textAlign:'center' }}>
                  {t("outreach.tapToOpenWhatsappSend")}
                </p>
                <button onClick={contactCurrent}
                  style={{ width:'100%', padding:'14px', borderRadius: slim ? 999 : 12, ...WA_BTN, ...(slim ? {} : { color:P.surface }), border:'none', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}>
                  <MessageCircle size={16} /> {t("outreach.openWhatsapp")} {(campaignCurrent?.buyer_name || 'Lead').split(' ')[0]}
                </button>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setCampaignIdx(i => i + 1)}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${P.border}`, background:P.surface, color:P.textMuted, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>
                    {t("outreach.skip")}
                  </button>
                  <button onClick={endCampaign}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${P.dangerBorder}`, background:P.surface, color:P.dangerText, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>
                    {t("outreach.endCampaign")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>, document.body)}

      {/* Schedule sheet. Portalled + body-scroll-locked per the overlay rules.
          The back gesture closes it too (useModalHistory). */}
      {scheduleOpen && selected && createPortal(
        <div onClick={() => setScheduleOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:P.surface, borderRadius:16, maxWidth:400, width:'100%', padding:22, fontFamily:FONT, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
              <CalendarClock size={17} style={{ color:P.textSec }} />
              <h3 style={{ fontSize:15, fontWeight:700, color:P.text, margin:0 }}>{t("outreach.remindMeLater")}</h3>
            </div>
            <p style={{ fontSize:12, color:P.textMuted, lineHeight:1.6, margin:'0 0 16px' }}>
              {t("outreach.weLlNotifyYouAt")} {(selected.buyer_name || 'the buyer').split(' ')[0]} {t("outreach.automaticallyYouAlwaysPressSend")}
            </p>

            <div style={{ display:'grid', gap:7, marginBottom:14 }}>
              {NUDGE_PRESETS.map(preset => (
                <button key={preset.key} onClick={() => scheduleNudge(preset.at())}
                  style={{ width:'100%', padding:'11px 14px', borderRadius:10, background:P.surfaceAlt, border:`1px solid ${P.border}`, color:P.text, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FONT, textAlign:'left' }}>
                  {preset.label}
                </button>
              ))}
            </div>

            <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', color:P.textDim, fontWeight:700, margin:'0 0 6px' }}>{t("outreach.orPickATime")}</p>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <input type="datetime-local" value={customWhen} onChange={e => setCustomWhen(e.target.value)}
                style={{ flex:1, minWidth:0, boxSizing:'border-box', padding:'10px 12px', borderRadius:10, border:`1px solid ${P.border}`, background:P.surface, color:P.text, fontSize:13, fontFamily:FONT, outline:'none' }} />
              <button onClick={() => scheduleNudge(new Date(customWhen))} disabled={!customWhen}
                style={{ padding:'10px 16px', borderRadius:10, border:'none', background: customWhen ? P.inkBtn : P.fill, color: customWhen ? P.inkBtnText : P.textDim, fontSize:13, fontWeight:700, cursor: customWhen ? 'pointer' : 'not-allowed', fontFamily:FONT }}>
                {t("outreach.set")}
              </button>
            </div>

            <button onClick={() => setScheduleOpen(false)}
              style={{ width:'100%', padding:'10px', borderRadius:10, border:`1px solid ${P.border}`, background:P.surface, color:P.textMuted, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>
              {t("outreach.cancel")}
            </button>
          </div>
        </div>, document.body)}
    </div>
  );
}
