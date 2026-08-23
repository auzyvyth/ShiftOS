import React, { useState } from 'react';
import { MessageSquare, ArrowLeft, UserCircle2, BadgeCheck } from 'lucide-react';
import { useChatThreads } from '../../hooks/useChat';
import ChatThread from './ChatThread';

// Seller-side inbox. Light surface to match the rest of the panel.
//
// A guest buyer shows as "Guest 4F2A" — deliberately anonymous until they
// choose to register. A registered buyer shows their own name with a verified
// mark, which is the difference the seller can actually act on.

const fmtAgo = (iso) => {
  if (!iso) return '';
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return 'now';
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
};

export default function SellerInbox({ salesmanId = null, dealerId = null }) {
  const { threads, loading, totalUnread } = useChatThreads({ salesmanId, dealerId });
  const [openId, setOpenId] = useState(null);

  const open = threads.find(t => t.id === openId) || null;
  const carOf = (t) => t.listing ? [t.listing.year, t.listing.brand, t.listing.model].filter(Boolean).join(' ') : 'Car enquiry';

  if (loading) {
    return <p style={{ fontSize:13, color:'#6b7280', padding:'32px 0', textAlign:'center' }}>Loading messages…</p>;
  }

  if (!threads.length) {
    return (
      <div style={{ textAlign:'center', padding:'48px 20px', color:'#6b7280' }}>
        <MessageSquare size={30} style={{ color:'#d1d5db', marginBottom:10 }} />
        <p style={{ fontSize:14, fontWeight:600, color:'#111827', margin:'0 0 4px' }}>No conversations yet</p>
        <p style={{ fontSize:12.5, margin:0, lineHeight:1.6 }}>
          When a buyer starts a chat from one of your listings, it lands here.
        </p>
      </div>
    );
  }

  const list = (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderBottom:'1px solid #e5e7eb' }}>
        <MessageSquare size={15} style={{ color:'#dc2626' }} />
        <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#111827', flex:1 }}>Messages</p>
        {totalUnread > 0 && (
          <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'#dc2626', borderRadius:20, padding:'1px 8px' }}>{totalUnread}</span>
        )}
      </div>
      <div style={{ maxHeight:'min(520px, 60vh)', overflowY:'auto' }}>
        {threads.map(t => {
          const active = t.id === openId;
          const unread = t.seller_unread || 0;
          return (
            <button key={t.id} onClick={() => setOpenId(t.id)}
              style={{ width:'100%', display:'flex', gap:10, alignItems:'center', padding:'11px 14px', background: active ? 'rgba(220,38,38,0.05)' : 'transparent', border:'none', borderBottom:'1px solid #f3f4f6', cursor:'pointer', textAlign:'left', fontFamily:"system-ui,sans-serif" }}>
              {t.listing?.images?.[0]
                ? <img src={t.listing.images[0]} alt="" style={{ width:42, height:42, borderRadius:9, objectFit:'cover', flexShrink:0, border:'1px solid #e5e7eb' }} />
                : <div style={{ width:42, height:42, borderRadius:9, background:'#f3f4f6', flexShrink:0 }} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:1 }}>
                  {t.buyer_is_anon
                    ? <UserCircle2 size={12} style={{ color:'#9ca3af', flexShrink:0 }} />
                    : <BadgeCheck size={12} style={{ color:'#16a34a', flexShrink:0 }} />}
                  <span style={{ fontSize:13, fontWeight: unread ? 700 : 600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.buyer_label}
                  </span>
                  <span style={{ fontSize:10.5, color:'#9ca3af', marginLeft:'auto', flexShrink:0 }}>{fmtAgo(t.last_message_at)}</span>
                </div>
                <p style={{ margin:0, fontSize:11.5, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {carOf(t)}
                </p>
              </div>
              {unread > 0 && (
                <span style={{ flexShrink:0, minWidth:19, height:19, borderRadius:10, background:'#dc2626', color:'#fff', fontSize:10.5, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <style>{`
        .chat-inbox{display:grid;grid-template-columns:320px 1fr;gap:14px;align-items:start}
        .chat-inbox .ci-thread{display:block}
        @media(max-width:820px){
          .chat-inbox{grid-template-columns:1fr}
          .chat-inbox.has-open .ci-list{display:none}
          .chat-inbox:not(.has-open) .ci-thread{display:none}
        }
      `}</style>
      <div className={`chat-inbox${open ? ' has-open' : ''}`}>
        <div className="ci-list">{list}</div>
        <div className="ci-thread">
          {open ? (
            <ChatThread
              threadId={open.id}
              role="seller"
              theme="light"
              height={540}
              aiAssist
              headerName={open.buyer_label}
              headerSub={carOf(open)}
              headerRight={
                <button onClick={() => setOpenId(null)} aria-label="Back to all messages"
                  style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'5px 10px', fontSize:11.5, color:'#6b7280', cursor:'pointer', fontFamily:"system-ui,sans-serif" }}>
                  <ArrowLeft size={12} /> All
                </button>
              }
            />
          ) : (
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'60px 20px', textAlign:'center', color:'#6b7280', fontSize:13 }}>
              Pick a conversation to reply.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
