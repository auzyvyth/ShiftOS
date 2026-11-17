import React, { Component } from "react";
import { Clock, Check } from "lucide-react";
import { premiumLight } from "../../theme/tokens";
import { getListingAge } from "./shared";
import { AGEING_DAYS } from "../../utils/carPnl";

// Small pieces shared by more than one dashboard tab.
// premiumLight (owner, 2026-11-09): one grey pill; the days turn red past AGEING_DAYS (60). Counts from the listing date, which is the stock date for a car made on the dashboard (auto_create_stock_unit).
export const AgeBadge = React.memo(function AgeBadge({ createdAt }) {
  const d = getListingAge(createdAt);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: premiumLight.raised, color: d > AGEING_DAYS ? premiumLight.accentText : premiumLight.textSec }}>
      <Clock style={{ width: 12, height: 12 }} />
      {d === 0 ? "Today" : `${d}d`}
    </span>
  );
});

// ─── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data = [], color = '#3b82f6', width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gradId})`} />
    </svg>
  );
}

// A tab that crashes shows this instead of blanking the dashboard; a stale chunk after a release reloads.
export class TabErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) {
        window.location.reload();
        return null;
      }
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <p className="text-red-400 text-sm font-medium">This tab ran into an error.</p>
          <p className="text-gray-500 text-xs">{this.state.error?.message || "Unknown error"}</p>
          <button onClick={() => this.setState({ error: null })} className="text-xs px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Horizontal sub-tab switcher used inside merged tabs (Analytics, Storefront).
export function SubTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 mb-3" style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '6px 11px', fontSize: 12.5, fontWeight: 500,
            borderBottom: active === t.id ? '2px solid #DC2626' : '2px solid transparent',
            color: active === t.id ? '#DC2626' : '#9AA1AD',
            background: 'none', border: 'none',
            cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Tick shown on a listing tile while picking cars for the bulk bar.
export function SelectTick({ on }) {
  return (
    <span style={{ position: 'absolute', top: 4, left: 4, zIndex: 1, width: 20, height: 20, borderRadius: 6, background: on ? premiumLight.text : '#fff', boxShadow: '0 0 0 1.5px ' + (on ? premiumLight.text : '#9ca3af'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <Check style={{ width: 13, height: 13, color: '#fff' }} />}
    </span>
  );
}

// Round photo or initial for a team member.
export function Avatar({ size = "md", profile }) {
  const sz = size === "lg" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
  if (profile?.avatar_url)
    return (
      <img
        src={profile.avatar_url}
        alt=""
        className={`${sz} rounded-full object-cover flex-shrink-0`}
      />
    );
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{
        background: "#374151",
      }}
    >
      {(profile?.full_name || profile?.email || "A")[0].toUpperCase()}
    </div>
  );
}
