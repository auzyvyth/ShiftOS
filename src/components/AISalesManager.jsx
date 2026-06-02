import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

function buildSystemPrompt(snapshot, dealerName) {
  return `You are the AI Sales Manager for ${dealerName}, a Malaysian used car dealership on ShiftOS.

Personality: Direct, sharp, no fluff. Speak like a senior sales manager. Occasionally use casual Malay terms (boss, confirm, lah). Never say "I am an AI". You ARE the Sales Manager.

Live dealership data:
- Active listings: ${snapshot.activeListings} cars, avg ${snapshot.avgDaysOnLot} days on lot
- Stale stock (30d+): ${snapshot.staleCars.map(c => `${c.model} (${c.days}d, RM${c.price?.toLocaleString()})`).join(', ') || 'None'}
- Enquiries: ${snapshot.enquiries.new} new, ${snapshot.coldEnquiries} gone cold (48h+), ${snapshot.enquiries.qualified} qualified, ${snapshot.enquiries.converted} converted
- Appointments today: ${snapshot.appointmentsToday}
- Sold this month GP: RM${snapshot.totalGPThisMonth?.toLocaleString()}
- Stock value on hand: RM${snapshot.totalStockValue?.toLocaleString()}
- WhatsApp clicks (7d): ${snapshot.topEvents}

Rules:
1. Morning briefing = max 5 bullet points, each actionable
2. Always reference real numbers from the data above
3. Call out specific problem areas — stale stock by name, cold leads count
4. Suggest specific RM figures for price drops based on days on lot
5. Under 120 words unless asked for a full report
6. Never give generic advice`;
}

const QUICK_PROMPTS = [
  'Morning briefing',
  'Which cars to reprice?',
  "Why aren't leads converting?",
  'Roast my team',
];

export default function AISalesManager({ snapshot, dealerName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (!triggered.current && snapshot) {
      triggered.current = true;
      const id = setTimeout(() => sendMessage('Give me my morning briefing.'), 600);
      return () => clearTimeout(id);
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
      const AI_PROXY = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/ai/messages`;
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildSystemPrompt(snapshot, dealerName),
          messages: next,
        }),
      });
      const data = await res.json();
      const reply = data?.content?.[0]?.text || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#e5e7eb' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            SM
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 28,
                letterSpacing: 2,
                lineHeight: 1,
                color: '#f9fafb',
              }}
            >
              SALES MANAGER
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Always-on senior advisor
            </div>
          </div>
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Active', val: snapshot.activeListings },
            { label: 'Cold Leads', val: snapshot.coldEnquiries },
            { label: 'Appt Today', val: snapshot.appointmentsToday },
          ].map(p => (
            <div
              key={p.label}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '4px 14px',
                fontSize: 12,
                color: '#9ca3af',
              }}
            >
              <span style={{ color: '#f9fafb', fontWeight: 600 }}>{p.val}</span>{' '}
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div
        ref={chatRef}
        style={{
          height: 360,
          overflowY: 'auto',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4b5563',
              fontSize: 13,
            }}
          >
            Loading briefing…
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              animation: 'slideUp 0.25s ease both',
            }}
          >
            {m.role === 'assistant' && (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#dc2626,#7f1d1d)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                SM
              </div>
            )}
            <div
              style={{
                maxWidth: '80%',
                marginLeft: m.role === 'user' ? 'auto' : undefined,
                background:
                  m.role === 'user'
                    ? 'rgba(220,38,38,0.12)'
                    : 'rgba(255,255,255,0.04)',
                border:
                  m.role === 'user'
                    ? '1px solid rgba(220,38,38,0.2)'
                    : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                color: '#e5e7eb',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#dc2626,#7f1d1d)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              SM
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 12,
              color: '#9ca3af',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.target.style.background = 'rgba(255,255,255,0.09)';
                e.target.style.color = '#f9fafb';
              }
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(255,255,255,0.05)';
              e.target.style.color = '#9ca3af';
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask your Sales Manager anything…"
          rows={2}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            color: '#f9fafb',
            resize: 'none',
            outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: loading || !input.trim() ? 'rgba(220,38,38,0.3)' : '#dc2626',
            border: 'none',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            alignSelf: 'flex-end',
            transition: 'background 0.15s',
          }}
        >
          <Send style={{ width: 18, height: 18, color: '#fff' }} />
        </button>
      </div>
    </div>
  );
}
