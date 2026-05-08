import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Zap } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AI_PROXY = `${SUPABASE_URL}/functions/v1/ai-proxy`;

function buildSystemPrompt(snapshot, dealerName) {
  return `You are the AI Sales Manager for ${dealerName}, a Malaysian used car dealership on ShiftOS.

Personality: Direct, sharp, no fluff. Speak like a senior sales manager who's seen it all. Occasionally use casual Malay terms (boss, confirm, lah, boleh). Never say "I am an AI". You ARE the Sales Manager.

Live dealership data right now:
- Active listings: ${snapshot.activeListings} cars, avg ${snapshot.avgDaysOnLot} days on lot
- Stale stock (30d+): ${snapshot.staleCars.map(c => `${c.model} (${c.days}d, RM${c.price?.toLocaleString()})`).join(', ') || 'None'}
- Enquiries: ${snapshot.enquiries.new} new, ${snapshot.coldEnquiries} gone cold (48h+ no reply), ${snapshot.enquiries.qualified} qualified, ${snapshot.enquiries.converted} converted
- Appointments today: ${snapshot.appointmentsToday}
- GP sold this month: RM${snapshot.totalGPThisMonth?.toLocaleString()}
- Stock value on hand: RM${snapshot.totalStockValue?.toLocaleString()}
- WhatsApp clicks (7d): ${snapshot.topEvents}

Rules:
1. Morning briefing = max 5 bullet points, each actionable with a specific next step
2. Always reference real numbers from the data — never make up figures
3. Call out specific problem areas by name (stale stock model, cold lead count)
4. Suggest specific RM price drops based on days on lot (5% per 30d is a good rule)
5. Keep responses under 150 words unless asked for a full report
6. Never give generic advice — every answer must use the live data above`;
}

const QUICK_PROMPTS = [
  'Morning briefing',
  'Which cars to reprice?',
  "Why aren't leads converting?",
  'Roast my team',
  'Stock health check',
];

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: '#6b7280',
          animation: 'aiDot 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

export default function AISalesManager({ snapshot, dealerName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (!triggered.current && snapshot) {
      triggered.current = true;
      setTimeout(() => sendMessage('Give me my morning briefing.'), 600);
    }
  }, [snapshot]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage(text) {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          system: buildSystemPrompt(snapshot, dealerName),
          messages: next,
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.reply || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.message === 'AI not configured'
          ? 'AI not configured. Ask your admin to set the ANTHROPIC_API_KEY in Supabase Edge Function secrets.'
          : 'Connection error — check your internet and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#e5e7eb' }}>
      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes aiSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 0 20px rgba(220,38,38,0.35)',
          }}>
            <Bot size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, letterSpacing: 2, lineHeight: 1, color: '#f9fafb' }}>
              SALES MANAGER
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Online · Powered by Claude AI
            </div>
          </div>
        </div>

        {/* Live stat pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Active', val: snapshot.activeListings, color: '#60a5fa' },
            { label: 'Cold Leads', val: snapshot.coldEnquiries, color: snapshot.coldEnquiries > 0 ? '#f87171' : '#6b7280' },
            { label: 'Appt Today', val: snapshot.appointmentsToday, color: '#34d399' },
          ].map(p => (
            <div key={p.label} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#9ca3af',
            }}>
              <span style={{ color: p.color, fontWeight: 700 }}>{p.val}</span>{' '}{p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div ref={chatRef} style={{
        height: 380, overflowY: 'auto',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '16px 12px', marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 12,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
      }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 13 }}>
            Loading briefing…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            animation: 'aiSlideUp 0.2s ease both',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {m.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg,#dc2626,#7f1d1d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
              }}>
                <Bot size={13} color="#fff" />
              </div>
            )}
            <div style={{
              maxWidth: '80%',
              background: m.role === 'user' ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.04)',
              border: m.role === 'user' ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              padding: '10px 14px', fontSize: 13, lineHeight: 1.65,
              color: m.role === 'user' ? '#fca5a5' : '#e5e7eb',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: 'aiSlideUp 0.2s ease both' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg,#dc2626,#7f1d1d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Bot size={13} color="#fff" />
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px 12px 12px 4px', padding: '12px 16px',
            }}>
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
        {QUICK_PROMPTS.map(q => (
          <button key={q} onClick={() => sendMessage(q)} disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '5px 13px', fontSize: 12,
              color: loading ? '#4b5563' : '#9ca3af',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'; e.currentTarget.style.color = '#fca5a5'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            <Zap size={10} />
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask your Sales Manager anything…"
          rows={2}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, color: '#f9fafb',
            resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(220,38,38,0.4)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: loading || !input.trim() ? 'rgba(220,38,38,0.2)' : '#dc2626',
            border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, alignSelf: 'flex-end', transition: 'all 0.15s',
            boxShadow: !loading && input.trim() ? '0 0 14px rgba(220,38,38,0.4)' : 'none',
          }}
        >
          <Send style={{ width: 16, height: 16, color: '#fff' }} />
        </button>
      </div>
    </div>
  );
}
