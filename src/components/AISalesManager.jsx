import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { callClaudeChat } from '../lib/callClaude';
import { premiumLight as PL } from '../theme/tokens';

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

  return `You are the AI Sales Manager for ${dealerName}, a Malaysian used car dealership on DrevoOS.

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
    const id = setTimeout(() => { triggered.current = true; sendMessage('Give me my morning briefing.', { hidden: true }); }, 600);
    return () => clearTimeout(id);
  }, [snapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage(text, { hidden = false } = {}) {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content, hidden }; // hidden = the automatic first ask, not typed
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const reply = await callClaudeChat(next.map(({ role, content: c }) => ({ role, content: c })), buildSystemPrompt(snapshot, dealerName), 'sales_manager');
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

  // Light (premiumLight) and borderless: it renders INSIDE the Overview card (AiManagerCard),
  // which owns the white surface and the shadow. No gradients, no tints (owner, 2026-11-16).
  const bubble = (mine) => ({
    maxWidth: '85%', marginLeft: mine ? 'auto' : undefined,
    background: mine ? PL.text : PL.raised, color: mine ? '#fff' : PL.text,
    borderRadius: 14, padding: '10px 14px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
  });
  return (
    <div style={{ fontFamily: 'inherit', color: PL.text }}>
      {/* Facts the briefing is built on: one grey row, the number carries it */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { label: 'cars for sale', val: snapshot.activeListings },
          { label: 'leads gone cold', val: snapshot.coldEnquiries },
          { label: 'viewings today', val: snapshot.appointmentsToday },
        ].map(p => (
          <div key={p.label} style={{ background: PL.raised, borderRadius: PL.radius.pill, padding: '5px 12px', fontSize: 12, color: PL.textMuted }}>
            <span style={{ color: PL.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.val}</span> {p.label}
          </div>
        ))}
      </div>

      <div ref={chatRef} style={{ maxHeight: 380, minHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {messages.map((m, i) => m.hidden ? null : (
          <div key={i} style={bubble(m.role === 'user')}>{m.content}</div>
        ))}
        {(loading || messages.length === 0) && (
          <div style={{ ...bubble(false), color: PL.textMuted }}>
            {messages.every(m => m.hidden) ? 'Writing your briefing...' : 'Thinking...'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 10, marginRight: -16, paddingRight: 16 }}>
        {QUICK_PROMPTS.map(q => (
          <button key={q} type="button" className="pl-btn-grey" onClick={() => sendMessage(q)} disabled={loading}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', borderRadius: PL.radius.pill, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: PL.text, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask your sales manager"
          rows={1}
          style={{ flex: 1, minWidth: 0, background: PL.raised, border: 'none', borderRadius: PL.radius.row, padding: '11px 14px', fontSize: 16, color: PL.text, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
        />
        <button type="button" aria-label="Send" onClick={() => sendMessage()} disabled={loading || !input.trim()}
          style={{ width: 42, height: 42, borderRadius: '50%', background: PL.accent, opacity: loading || !input.trim() ? 0.35 : 1, border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send style={{ width: 17, height: 17, color: '#fff' }} />
        </button>
      </div>
    </div>
  );
}
