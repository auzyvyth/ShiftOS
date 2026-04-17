import React, { useRef, useState, useEffect, useCallback } from 'react';

const STATUS = { done: '#22c55e', wip: '#eab308', stub: '#6b7280' };

const NODES = {
  root: { id: 'root', label: 'ShiftOS', desc: 'Multi-tenant car dealership SaaS', x: 0, y: 0, status: 'done', type: 'root' },

  // Branch headers
  pages:      { id: 'pages',      label: 'Pages',      desc: '21 route-level page components', x: -580, y: -260, status: 'done', type: 'branch' },
  components: { id: 'components', label: 'Components',  desc: '32 reusable UI components',      x: -580, y: 200,  status: 'done', type: 'branch' },
  hooks:      { id: 'hooks',      label: 'Hooks',       desc: '10 custom React hooks',          x: 580,  y: -260, status: 'done', type: 'branch' },
  dbtables:   { id: 'dbtables',   label: 'DB Tables',   desc: 'Supabase PostgreSQL schema',     x: 580,  y: 200,  status: 'done', type: 'branch' },
  roles:      { id: 'roles',      label: 'Roles',       desc: 'Role-based access system',       x: 0,    y: 400,  status: 'done', type: 'branch' },

  // Pages
  p_home:        { id: 'p_home',        label: 'HomePage',        desc: 'XDrive public marketplace hero',          x: -900, y: -520, status: 'wip',  type: 'leaf' },
  p_cars:        { id: 'p_cars',        label: 'CarsPage',        desc: 'Filtered car listings browse',            x: -900, y: -440, status: 'wip',  type: 'leaf' },
  p_cardetail:   { id: 'p_cardetail',   label: 'CarDetailPage',   desc: 'Single listing with gallery + calc',      x: -900, y: -360, status: 'wip',  type: 'leaf' },
  p_calculator:  { id: 'p_calculator',  label: 'CalculatorPage',  desc: 'Financing calculator, pre-fill params',   x: -900, y: -280, status: 'done', type: 'leaf' },
  p_login:       { id: 'p_login',       label: 'LoginPage',       desc: 'Auth with IC/phone formatting',           x: -900, y: -200, status: 'done', type: 'leaf' },
  p_register:    { id: 'p_register',    label: 'RegisterPage',    desc: 'Multi-step email→verify→form flow',       x: -900, y: -120, status: 'done', type: 'leaf' },
  p_onboarding:  { id: 'p_onboarding',  label: 'OnboardingPage',  desc: '4-step dealer onboarding wizard',         x: -900, y: -40,  status: 'done', type: 'leaf' },
  p_dashboard:   { id: 'p_dashboard',   label: 'DashboardPage',   desc: 'Owner/dealer 13-tab main dashboard',      x: -900, y: 40,   status: 'done', type: 'leaf' },
  p_salesman:    { id: 'p_salesman',    label: 'SalesmanPanel',   desc: 'Salesman appointments, leads, analytics', x: -900, y: 120,  status: 'wip',  type: 'leaf' },
  p_manager:     { id: 'p_manager',     label: 'ManagerPanel',    desc: 'Team stats, listings, kanban leads',      x: -900, y: 200,  status: 'done', type: 'leaf' },
  p_admin:       { id: 'p_admin',       label: 'AdminPanel',      desc: 'Admin listings, analytics, team',         x: -900, y: 280,  status: 'done', type: 'leaf' },
  p_platform:    { id: 'p_platform',    label: 'AdminPage',       desc: 'Superadmin platform-wide view',           x: -900, y: 360,  status: 'wip',  type: 'leaf' },
  p_accountant:  { id: 'p_accountant',  label: 'AccountantPanel', desc: 'Financial tracking & reporting',          x: -700, y: 460,  status: 'wip',  type: 'leaf' },
  p_fi:          { id: 'p_fi',          label: 'FIPanel',         desc: 'Finance & insurance officer panel',       x: -700, y: 540,  status: 'wip',  type: 'leaf' },
  p_accounts:    { id: 'p_accounts',    label: 'AccountsPanel',   desc: 'Accounts — coming soon stub',             x: -700, y: 620,  status: 'stub', type: 'leaf' },
  p_leads:       { id: 'p_leads',       label: 'LeadsPage',       desc: 'Kanban lead board with drag-drop',        x: -700, y: 700,  status: 'done', type: 'leaf' },
  p_revops:      { id: 'p_revops',      label: 'RevOpsPage',      desc: 'Revenue ops KPIs + stock health',         x: -500, y: 700,  status: 'done', type: 'leaf' },
  p_services:    { id: 'p_services',    label: 'ServicesPage',    desc: 'Add-on services catalog + stats',         x: -500, y: 780,  status: 'wip',  type: 'leaf' },
  p_shiftos:     { id: 'p_shiftos',     label: 'ShiftOSPage',     desc: 'Marketing page features + pricing',       x: -500, y: 860,  status: 'done', type: 'leaf' },
  p_heroslides:  { id: 'p_heroslides',  label: 'HeroSlidesPage',  desc: 'Drag-drop hero carousel manager',         x: -500, y: 940,  status: 'done', type: 'leaf' },
  p_authconfirm: { id: 'p_authconfirm', label: 'AuthConfirmPage', desc: 'Email OTP redirect handler',              x: -500, y: 1020, status: 'done', type: 'leaf' },

  // Components
  c_carcard:     { id: 'c_carcard',     label: 'CarCard',          desc: 'Listing card — image, price, details',   x: -900, y: -80,  status: 'done', type: 'leaf' },
  c_carform:     { id: 'c_carform',     label: 'CarForm',          desc: '8-step listing creation form',           x: -900, y: 0,    status: 'done', type: 'leaf' },
  c_cargallery:  { id: 'c_cargallery',  label: 'CarGallery',       desc: 'Photo gallery viewer',                   x: -900, y: 80,   status: 'done', type: 'leaf' },
  c_herocar:     { id: 'c_herocar',     label: 'HeroCarousel',     desc: 'Homepage featured cars carousel',        x: -900, y: 160,  status: 'done', type: 'leaf' },
  c_fincalc:     { id: 'c_fincalc',     label: 'FinancingCalc',    desc: 'Monthly payment calculator widget',      x: -900, y: 240,  status: 'done', type: 'leaf' },
  c_amort:       { id: 'c_amort',       label: 'AmortizationSch',  desc: 'Loan amortization schedule table',       x: -900, y: 320,  status: 'done', type: 'leaf' },
  c_tiktok:      { id: 'c_tiktok',      label: 'TikTokStudioV3',   desc: 'AI slide deck builder, 5786 lines',      x: -900, y: 400,  status: 'done', type: 'leaf' },
  c_layercanvas: { id: 'c_layercanvas', label: 'LayerCanvas',      desc: 'Canvas design editor with layers',       x: -900, y: 480,  status: 'done', type: 'leaf' },
  c_leadcard:    { id: 'c_leadcard',    label: 'LeadCard',         desc: 'Individual lead kanban card',            x: -700, y: 160,  status: 'done', type: 'leaf' },
  c_leaddrawer:  { id: 'c_leaddrawer',  label: 'LeadDrawer',       desc: 'Side panel lead detail + add-ons',       x: -700, y: 240,  status: 'done', type: 'leaf' },
  c_leadcol:     { id: 'c_leadcol',     label: 'LeadColumn',       desc: 'Kanban stage column',                    x: -700, y: 320,  status: 'done', type: 'leaf' },
  c_addlead:     { id: 'c_addlead',     label: 'AddLeadModal',     desc: 'New lead creation modal form',           x: -700, y: 400,  status: 'done', type: 'leaf' },
  c_header:      { id: 'c_header',      label: 'Header',           desc: 'Top nav with user menu + logout',        x: -700, y: 480,  status: 'done', type: 'leaf' },
  c_damagemap:   { id: 'c_damagemap',   label: 'DamageMap',        desc: 'Interactive car damage mapping UI',      x: -700, y: 560,  status: 'done', type: 'leaf' },
  c_gradebadge:  { id: 'c_gradebadge',  label: 'GradeBadge',       desc: 'Visual condition grade indicator',       x: -700, y: 640,  status: 'done', type: 'leaf' },
  c_wabutton:    { id: 'c_wabutton',    label: 'StickyWhatsApp',   desc: 'Fixed WhatsApp CTA button',              x: -700, y: 720,  status: 'done', type: 'leaf' },

  // Hooks
  h_roleredir:   { id: 'h_roleredir',   label: 'useRoleRedirect',  desc: 'Auth guard, redirects by role',          x: 820,  y: -540, status: 'done', type: 'leaf' },
  h_profile:     { id: 'h_profile',     label: 'useProfile',       desc: 'Own profile row + getDealerIdFromProfile', x: 820, y: -460, status: 'done', type: 'leaf' },
  h_tenant:      { id: 'h_tenant',      label: 'useTenant',        desc: 'Subdomain detection for multi-tenancy',  x: 820,  y: -380, status: 'done', type: 'leaf' },
  h_siteprofile: { id: 'h_siteprofile', label: 'useSiteProfile',   desc: 'Dealer profile context for site',        x: 820,  y: -300, status: 'done', type: 'leaf' },
  h_leads:       { id: 'h_leads',       label: 'useLeads',         desc: 'Lead data fetching & management',        x: 820,  y: -220, status: 'done', type: 'leaf' },
  h_leadact:     { id: 'h_leadact',     label: 'useLeadActivities',desc: 'Lead activity log fetching',             x: 820,  y: -140, status: 'done', type: 'leaf' },
  h_sub:         { id: 'h_sub',         label: 'useSubscription',  desc: 'Dealer subscription status',             x: 820,  y: -60,  status: 'done', type: 'leaf' },
  h_cta:         { id: 'h_cta',         label: 'useCTAContext',    desc: 'WhatsApp CTA context provider',          x: 820,  y: 20,   status: 'done', type: 'leaf' },
  h_layeredit:   { id: 'h_layeredit',   label: 'useLayerEditor',   desc: 'Canvas layer editor state machine',      x: 820,  y: 100,  status: 'done', type: 'leaf' },
  h_toast:       { id: 'h_toast',       label: 'use-toast',        desc: 'Shadcn toast notification hook',         x: 820,  y: 180,  status: 'done', type: 'leaf' },

  // DB Tables
  db_car:        { id: 'db_car',        label: 'car_listings',     desc: 'Listings with included_services JSONB',  x: 820,  y: -80,  status: 'done', type: 'leaf' },
  db_stock:      { id: 'db_stock',      label: 'stock_units',      desc: 'Dealer stock, purchase & recon costs',   x: 820,  y: 0,    status: 'done', type: 'leaf' },
  db_profiles:   { id: 'db_profiles',   label: 'profiles',         desc: 'Users: role, slug, dealership, brand',   x: 820,  y: 80,   status: 'done', type: 'leaf' },
  db_appts:      { id: 'db_appts',      label: 'appointments',     desc: 'Salesman-car-dealer appointment rows',   x: 820,  y: 160,  status: 'done', type: 'leaf' },
  db_analytics:  { id: 'db_analytics',  label: 'analytics_events', desc: 'Per-dealer event tracking rows',         x: 820,  y: 240,  status: 'done', type: 'leaf' },
  db_leads:      { id: 'db_leads',      label: 'leads',            desc: 'CRM leads by dealer, stage, source',     x: 820,  y: 320,  status: 'done', type: 'leaf' },
  db_dealerprod: { id: 'db_dealerprod', label: 'dealer_products',  desc: 'Add-on product catalogue per dealer',    x: 820,  y: 400,  status: 'done', type: 'leaf' },
  db_dealprod:   { id: 'db_dealprod',   label: 'deal_products',    desc: 'Products sold per deal/lead',            x: 820,  y: 480,  status: 'done', type: 'leaf' },

  // Roles
  r_owner:       { id: 'r_owner',       label: 'owner / dealer',   desc: '→ /dashboard — full access',             x: -200, y: 580,  status: 'done', type: 'leaf' },
  r_superadmin:  { id: 'r_superadmin',  label: 'superadmin',       desc: '→ /platform — platform-wide view',       x: -60,  y: 620,  status: 'done', type: 'leaf' },
  r_salesman:    { id: 'r_salesman',    label: 'salesman',         desc: '→ /salesman — appointments & leads',     x: 80,   y: 580,  status: 'done', type: 'leaf' },
  r_manager:     { id: 'r_manager',     label: 'manager',          desc: '→ /manager — team & listing oversight',  x: 200,  y: 620,  status: 'done', type: 'leaf' },
  r_accountant:  { id: 'r_accountant',  label: 'accountant',       desc: '→ /accountant — financials',             x: -200, y: 700,  status: 'done', type: 'leaf' },
  r_fi:          { id: 'r_fi',          label: 'fi_officer',       desc: '→ /fi — finance & insurance',            x: -60,  y: 740,  status: 'done', type: 'leaf' },
  r_admin:       { id: 'r_admin',       label: 'admin',            desc: '→ /admin — dealer admin panel',          x: 80,   y: 700,  status: 'done', type: 'leaf' },
};

const EDGES = [
  // root → branches
  ['root', 'pages'], ['root', 'components'], ['root', 'hooks'], ['root', 'dbtables'], ['root', 'roles'],
  // pages
  ['pages', 'p_home'], ['pages', 'p_cars'], ['pages', 'p_cardetail'], ['pages', 'p_calculator'],
  ['pages', 'p_login'], ['pages', 'p_register'], ['pages', 'p_onboarding'], ['pages', 'p_dashboard'],
  ['pages', 'p_salesman'], ['pages', 'p_manager'], ['pages', 'p_admin'], ['pages', 'p_platform'],
  ['pages', 'p_accountant'], ['pages', 'p_fi'], ['pages', 'p_accounts'], ['pages', 'p_leads'],
  ['pages', 'p_revops'], ['pages', 'p_services'], ['pages', 'p_shiftos'], ['pages', 'p_heroslides'],
  ['pages', 'p_authconfirm'],
  // components
  ['components', 'c_carcard'], ['components', 'c_carform'], ['components', 'c_cargallery'],
  ['components', 'c_herocar'], ['components', 'c_fincalc'], ['components', 'c_amort'],
  ['components', 'c_tiktok'], ['components', 'c_layercanvas'], ['components', 'c_leadcard'],
  ['components', 'c_leaddrawer'], ['components', 'c_leadcol'], ['components', 'c_addlead'],
  ['components', 'c_header'], ['components', 'c_damagemap'], ['components', 'c_gradebadge'],
  ['components', 'c_wabutton'],
  // hooks
  ['hooks', 'h_roleredir'], ['hooks', 'h_profile'], ['hooks', 'h_tenant'], ['hooks', 'h_siteprofile'],
  ['hooks', 'h_leads'], ['hooks', 'h_leadact'], ['hooks', 'h_sub'], ['hooks', 'h_cta'],
  ['hooks', 'h_layeredit'], ['hooks', 'h_toast'],
  // db
  ['dbtables', 'db_car'], ['dbtables', 'db_stock'], ['dbtables', 'db_profiles'], ['dbtables', 'db_appts'],
  ['dbtables', 'db_analytics'], ['dbtables', 'db_leads'], ['dbtables', 'db_dealerprod'], ['dbtables', 'db_dealprod'],
  // roles
  ['roles', 'r_owner'], ['roles', 'r_superadmin'], ['roles', 'r_salesman'], ['roles', 'r_manager'],
  ['roles', 'r_accountant'], ['roles', 'r_fi'], ['roles', 'r_admin'],
];

const NODE_W = { root: 140, branch: 130, leaf: 160 };
const NODE_H = { root: 56,  branch: 44,  leaf: 38  };

function nodeRect(n) {
  const w = NODE_W[n.type]; const h = NODE_H[n.type];
  return { x: n.x - w / 2, y: n.y - h / 2, w, h };
}

// Convert screen coords to SVG world coords
function toWorld(cx, cy, tf) {
  return { wx: (cx - tf.x) / tf.scale, wy: (cy - tf.y) / tf.scale };
}

export default function MindMapPage() {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.72 });
  const [tooltip, setTooltip] = useState(null);
  // Mutable node positions keyed by id
  const [positions, setPositions] = useState(() =>
    Object.fromEntries(Object.values(NODES).map(n => [n.id, { x: n.x, y: n.y }]))
  );
  const drag = useRef(null); // { type:'canvas'|'node', ... }
  const positionsRef = useRef(null);

  // Keep positionsRef in sync so drag handlers read latest without stale closures
  positionsRef.current = positions;

  // Centre on mount
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (el) setTransform(t => ({ ...t, x: el.clientWidth / 2, y: el.clientHeight / 2 - 60 }));
  }, []);

  const onWheel = useCallback(e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setTransform(t => ({
      scale: Math.min(2.5, Math.max(0.2, t.scale * factor)),
      x: t.x, y: t.y,
    }));
  }, []);

  // Canvas pan starts here (node drag stops propagation)
  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    drag.current = { type: 'canvas', sx: e.clientX - transform.x, sy: e.clientY - transform.y };
  }, [transform]);

  const onNodeMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setTooltip(null);
    const { wx, wy } = toWorld(e.clientX, e.clientY, transform);
    const { x: origX, y: origY } = positionsRef.current[id];
    drag.current = { type: 'node', id, _tf: transform, startWx: wx, startWy: wy, origX, origY };
  }, [transform]);

  const onMouseMove = useCallback(e => {
    const d = drag.current;
    if (!d) return;
    if (d.type === 'canvas') {
      const { sx, sy } = d;
      setTransform(t => ({ ...t, x: e.clientX - sx, y: e.clientY - sy }));
    } else if (d.type === 'node') {
      const { wx, wy } = toWorld(e.clientX, e.clientY, d._tf);
      const dx = wx - d.startWx;
      const dy = wy - d.startWy;
      const { id, origX, origY } = d;
      setPositions(p => ({ ...p, [id]: { x: origX + dx, y: origY + dy } }));
    }
  }, []);

  const onMouseUp = useCallback(() => { drag.current = null; }, []);

  const nodesArr = Object.values(NODES);

  return (
    <div
      style={{ width: '100vw', height: '100vh', background: '#080C14', overflow: 'hidden', cursor: 'grab', userSelect: 'none', fontFamily: "'DM Sans', sans-serif", position: 'relative' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* Header */}
      <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 20, pointerEvents: 'none' }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#dc2626', letterSpacing: 2 }}>ShiftOS</span>
        <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 10 }}>Mind Map — scroll to zoom · drag to pan</span>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 20, display: 'flex', gap: 16, alignItems: 'center', background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 14px', pointerEvents: 'none' }}>
        {[['done', '#22c55e', 'Done'], ['wip', '#eab308', 'WIP'], ['stub', '#6b7280', 'Stub']].map(([, color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges — read live positions */}
          {EDGES.map(([a, b]) => {
            const na = NODES[a]; const nb = NODES[b];
            if (!na || !nb) return null;
            const pa = positions[a]; const pb = positions[b];
            const isBranch = na.type === 'root' || na.type === 'branch';
            return (
              <line
                key={`${a}-${b}`}
                x1={pa.x} y1={pa.y}
                x2={pb.x} y2={pb.y}
                stroke={isBranch ? '#374151' : '#1f2937'}
                strokeWidth={isBranch ? 1.5 : 1}
                strokeOpacity={isBranch ? 0.9 : 0.6}
              />
            );
          })}

          {/* Nodes */}
          {nodesArr.map(n => {
            const pos = positions[n.id];
            const live = { ...n, x: pos.x, y: pos.y };
            const r = nodeRect(live);
            const isRoot   = n.type === 'root';
            const isBranch = n.type === 'branch';
            const bg       = isRoot ? '#1a0505' : '#111827';
            const border   = isRoot ? '#dc2626' : isBranch ? '#374151' : '#1f2937';
            const textColor= isRoot ? '#f87171' : isBranch ? '#e5e7eb' : '#d1d5db';
            const fontSize = isRoot ? 16 : isBranch ? 13 : 11;
            const radius   = isRoot ? 10 : 6;

            return (
              <g
                key={n.id}
                style={{ cursor: 'grab' }}
                onMouseDown={e => onNodeMouseDown(e, n.id)}
                onMouseEnter={e => setTooltip({ n: live, ex: e.clientX, ey: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
              >
                <rect
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  rx={radius} ry={radius}
                  fill={bg}
                  stroke={border}
                  strokeWidth={isRoot ? 2 : 1}
                />
                {!isRoot && (
                  <circle
                    cx={r.x + r.w - 10} cy={r.y + 10}
                    r={4}
                    fill={STATUS[n.status]}
                  />
                )}
                <text
                  x={pos.x} y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={textColor}
                  fontSize={fontSize}
                  fontWeight={isBranch || isRoot ? 600 : 400}
                  style={{ fontFamily: isRoot ? "'Bebas Neue', sans-serif" : "'DM Sans', sans-serif", letterSpacing: isRoot ? 1 : 0, pointerEvents: 'none' }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.ex + 14,
            top: tooltip.ey - 10,
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 8,
            padding: '8px 12px',
            zIndex: 100,
            pointerEvents: 'none',
            maxWidth: 260,
          }}
        >
          <div style={{ color: '#f9fafb', fontSize: 13, fontWeight: 600 }}>{tooltip.n.label}</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 3 }}>{tooltip.n.desc}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS[tooltip.n.status] }} />
            <span style={{ color: '#6b7280', fontSize: 11 }}>
              {{ done: 'Complete', wip: 'Work in progress', stub: 'Stub / placeholder' }[tooltip.n.status]}
            </span>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 20 }}>
        {[['＋', 1.2], ['－', 0.83]].map(([label, factor]) => (
          <button
            key={label}
            onClick={() => setTransform(t => ({ ...t, scale: Math.min(2.5, Math.max(0.2, t.scale * factor)) }))}
            style={{ width: 36, height: 36, borderRadius: 6, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setTransform({ x: svgRef.current?.parentElement?.clientWidth / 2 ?? 600, y: svgRef.current?.parentElement?.clientHeight / 2 - 60 ?? 350, scale: 0.72 })}
          style={{ width: 36, height: 36, borderRadius: 6, background: '#1f2937', border: '1px solid #374151', color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}
          title="Reset"
        >⌂</button>
      </div>
    </div>
  );
}
