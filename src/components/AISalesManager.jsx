import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { callClaudeChat } from '../lib/callClaude';

const ROLE_LABELS = {
  salesman: 'Salesman',
  manager: 'Manager',
  admin: 'Admin',
  accountant: 'Accountant',
  fi_officer: 'F&I Officer',
  superadmin: 'Super-admin',
};

function buildSystemPrompt(snapshot, dealerName) {
  const team = snapshot.teamActivity || [];
  const teamLines = team.length
    ? team
        .map(t => {
          const label = ROLE_LABELS[t.role] || t.role;
          const detail = t.highlights.length ? ` — ${t.highlights.join('; ')}` : '';
          return `${t.name} (${label}): ${t.count} action${t.count === 1 ? '' : 's'}${detail}`;
        })
        .join('\n')
    : 'No team activity logged in the last 24h.';

  return `You are the AI Sales Manager for ${dealerName}, a Malaysian used car dealership on ShiftOS.

Personality: Direct, sharp, no fluff. Speak like a senior sales manager. Occasionally use casual Malay terms (boss, confirm, lah). Never say "I am an AI". You ARE the Sales Manager.

Live dealership data:
- Active listings: ${snapshot.activeListings} cars${snapshot.avgDaysOnLot != null ? `, avg ${snapshot.avgDaysOnLot} days on lot` : ''}
- Ageing stock (over 60 days): ${snapshot.staleCars.map(c => `${c.model} (${c.days}d, RM${c.price?.toLocaleString()})`).join(', ') || 'None'}
- Enquiries: ${snapshot.enquiries.new} new, ${snapshot.coldEnquiries} gone cold (48h+), ${snapshot.enquiries.qualified} qualified, ${snapshot.enquiries.converted} converted
- Appointments today: ${snapshot.appointmentsToday}
${snapshot.soldThisMonth != null ? `- Sold this month: ${snapshot.soldThisMonth} cars${snapshot.totalGPThisMonth != null ? `, gross profit RM${snapshot.totalGPThisMonth.toLocaleString()} (every cost counted${snapshot.gpLeftOut ? `; ${snapshot.gpLeftOut} sold car(s) left out because they have no buy price` : ''})` : ''}\n` : ''}${snapshot.totalStockValue != null ? `- Money tied up in stock (buy + recon): RM${snapshot.totalStockValue.toLocaleString()}\n` : ''}- WhatsApp clicks (7d): ${snapshot.topEvents}

Team activity in the last 24 hours (one line per person — name, role, action count, and what they actually did):
${teamLines}

Rules:
1. Morning briefing = two parts:
   a) Max 4 bullet points on dealership numbers, each actionable
   b) A short "Team" section — one line per person who was active, naming them, their role, and what they did (use the team activity data above verbatim, don't invent actions). If someone on the team did nothing, you can mention that too.
2. Always reference real numbers from the data above
3. Call out specific problem areas — stale stock by name, cold leads count, or a team member who's gone quiet
4. Suggest specific RM figures for price drops based on days on lot
5. Under 160 words unless asked for a full report
6. Never give generic advice, never invent activity that isn't in the data above`;
}

const QUICK_PROMPTS = [
  'Morning briefing',
  'What did my team do yesterday?',
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

  // Fires once, 600ms after the snapshot settles. `triggered` is set INSIDE the timer: set before
  // it, a second snapshot within 600ms cleared the timer and nothing ever re-armed it.
  useEffect(() => {
    if (triggered.current || !snapshot) return undefined;
    const id = setTimeout(() => { triggered.current = true; sendMessage('Give me my morning briefing.'); }, 600);
    return () => clearTimeout(id);
  }, [snapshot]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const reply = await callClaudeChat(next, buildSystemPrompt(snapshot, dealerName), 'sales_manager');
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
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#e5e7eb', background: '#0B1016', border: '1px solid #1c232e', borderRadius: 16, padding: 'clamp(14px, 3vw, 22px)' }}>
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
            fontFamily: 'system-ui, sans-serif',
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
