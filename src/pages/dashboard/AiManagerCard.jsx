import React, { Suspense } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';

const AISalesManager = React.lazy(() => import('../../components/AISalesManager'));

// AI Sales Manager, as a card on Overview (it was its own tab until 2026-11-16, plan step 4b).
// Closed by default: opening it is what starts the briefing, so a plain Overview visit spends no
// AI call. The snapshot is built in DashboardPage and only loads while `open` (see `aiOpen`).
// Gate (Starter plan, the `tab_ai_manager` switch) is the caller's job: it renders nothing here.
export default function AiManagerCard({ open, onToggle, snapshot, dealerName }) {
  return (
    <section style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span className="pl-well" style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={17} color={PL.text} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: PL.text }}>AI Sales Manager</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: PL.textMuted }}>
            {open ? "Today's briefing from your numbers. Ask it anything." : "Tap for today's briefing: stock to reprice, cold leads, team activity"}
          </span>
        </span>
        <ChevronDown size={16} color={PL.textMuted} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${PL.line}`, paddingTop: 14 }}>
          {snapshot ? (
            <Suspense fallback={<p style={{ margin: 0, fontSize: 13, color: PL.textMuted }}>Loading...</p>}>
              <AISalesManager snapshot={snapshot} dealerName={dealerName} />
            </Suspense>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: PL.textMuted }}>Reading your numbers...</p>
          )}
        </div>
      )}
    </section>
  );
}
