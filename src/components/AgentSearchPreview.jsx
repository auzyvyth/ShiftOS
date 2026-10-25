// "How you'll look on Google" — Salesman Premium settings only.
// Runs the SAME title/description code as the crawler render (agentSeo.js), on
// the agent's unsaved form values, so they see the effect while typing.
// The result card mimics Google's own (white, Arial), which is why it is light
// inside a dark panel: it is a picture of another surface. The frame is
// premiumDark (Premium is its only user); an issue's dot is red: it needs you.
import { ROOT_DOMAIN } from '../config/site';
import { premiumDark as PD } from '../theme/tokens';
import { agentPageTitle, agentPageDescription, agentSeoIssues, TITLE_LIMIT } from '../utils/agentSeo';

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s);

export default function AgentSearchPreview({ profile, slug, carCount = 0, cars }) {
  const title = cut(agentPageTitle({ ...profile, slug }, cars), TITLE_LIMIT);
  const description = agentPageDescription({ ...profile, slug }, carCount, cars);
  const issues = agentSeoIssues(profile);

  return (
    <div style={{ padding: 18, background: PD.card, borderRadius: PD.radius.card }}>
      <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: PD.text }}>How you look on Google</p>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: PD.textMuted }}>
        When a buyer searches your name, this is roughly what they see. It updates as you type; save to make it live.
      </p>

      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', fontFamily: 'arial, sans-serif', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f1f3f4', border: '1px solid #dadce0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>X</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#202124', lineHeight: 1.2 }}>XDrive</div>
            <div style={{ fontSize: 12, color: '#4d5156', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ROOT_DOMAIN} › s › {slug || 'yourname'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: '#1a0dab', lineHeight: 1.3, marginBottom: 4, overflowWrap: 'anywhere' }}>{title}</div>
        <div style={{ fontSize: 14, color: '#4d5156', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{description}</div>
      </div>

      {issues.length > 0 ? (
        <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issues.map((i) => (
            <li key={i.key} style={{ display: 'flex', gap: 8, fontSize: 12, color: PD.textSec, lineHeight: 1.5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: PD.accentText, marginTop: 6, flexShrink: 0 }} />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: PD.textSec }}>Looks good. Your name, area and bio are all in place.</p>
      )}
    </div>
  );
}
