// ─── Granular role permissions (SEC-2) ────────────────────────────────────────
// Owner-controlled, per-role capability toggles stored in the `role_permissions`
// table (one JSONB row per dealer+role). Owner/dealer/superadmin always have
// every capability and are not configurable.

// Roles whose capabilities the owner can configure.
export const CONFIGURABLE_ROLES = [
  { value: 'salesman',   label: 'Salesman'   },
  { value: 'manager',    label: 'Manager'    },
  { value: 'admin',      label: 'Admin'      },
  { value: 'accountant', label: 'Accountant' },
  { value: 'fi_officer', label: 'F&I Officer' },
];

// ─── Grantable EXTRA features (dealer-dashboard features the owner can lend to a
// role's own panel) ────────────────────────────────────────────────────────────
// A role's NATIVE tabs are always present and are NOT listed here. These are the
// optional add-ons the owner can switch ON for a role — imported into that role's
// own panel, scoped to the staff member's id (e.g. own leads only) so it stays
// secure and attributable by name. Capability key = `feat_<id>`. Default OFF.
export const ROLE_EXTRAS = {
  salesman: [
    { id: 'outreach',  label: 'Outreach Hub', description: "Lead liveliness + guided WhatsApp campaign, scoped to the salesman's own leads." },
    { id: 'customers', label: 'Customers',    description: "Post-sale buyer records (road tax / insurance expiry, service plans) for the salesman's own won deals — shared with the dealer dashboard." },
  ],
  manager: [
    { id: 'outreach', label: 'Outreach Hub', description: 'Lead liveliness + guided WhatsApp campaign across the dealership.' },
  ],
};

export function roleExtras(role) {
  return ROLE_EXTRAS[role] || [];
}

// Extras default OFF — the owner must explicitly grant them.
export function defaultTabAccessForRole(role) {
  const map = {};
  for (const f of roleExtras(role)) map[`feat_${f.id}`] = false;
  return map;
}

// Has the owner granted a role this extra feature? Owners implicitly have all.
export function hasFeature(role, featureId, permissions) {
  if (isFullAccessRole(role)) return true;
  return permissions?.[`feat_${featureId}`] === true;
}

// Capability registry. Each capability declares which roles it applies to and
// its default value when no stored override exists.
// `enforced: true` means the app actively gates behaviour on this capability
// today (vs. reserved for future use).
export const CAPABILITIES_BASE = [
  {
    key: 'view_commission',
    label: 'View commission amounts',
    description: 'Show the commission strip, breakdown and per-deal commission figures.',
    roles: ['salesman'],
    group: 'money',
    default: true,
    enforced: true,
  },
  {
    key: 'view_all_leads',
    group: 'people',
    label: 'View all team leads',
    description: 'See every lead in the dealership, not only leads assigned to them.',
    roles: ['salesman'],
    default: false,
    enforced: true,
  },
  {
    key: 'view_cost',
    group: 'money',
    label: 'View stock cost & purchase price',
    description: 'Show purchase price, recon cost, and cost basis columns in the Stock tab.',
    roles: ['manager'],
    default: true,
    enforced: true,
  },
  // An admin (office staff) starts WITHOUT money; the owner can switch it on. With it on by
  // default, the database rule (dealer_can) would have handed the admin buy prices on day one.
  {
    key: 'view_cost',
    group: 'money',
    label: 'View stock cost & purchase price',
    description: 'Show purchase price, recon cost, and cost basis columns in the Stock tab.',
    roles: ['admin'],
    default: false,
    enforced: true,
  },
  {
    key: 'view_gross',
    group: 'money',
    label: 'View gross profit figures',
    description: 'Show gross profit column in Stock tab and P&L breakdown.',
    roles: ['manager'],
    default: true,
    enforced: true,
  },
  // An admin (office staff) starts WITHOUT money; the owner can switch it on. With it on by
  // default, the database rule (dealer_can) would have handed the admin buy prices on day one.
  {
    key: 'view_gross',
    group: 'money',
    label: 'View gross profit figures',
    description: 'Show gross profit column in Stock tab and P&L breakdown.',
    roles: ['admin'],
    default: false,
    enforced: true,
  },
  {
    key: 'export_data',
    group: 'money',
    label: 'Export CSV / download reports',
    description: 'Access the Export CSV button on the Analytics tab.',
    roles: ['manager', 'admin'],
    default: true,
    enforced: true,
  },
  // ── Manager authority (research 2026-11-12, docs/DEALER_ROLES_RESEARCH.md). Defaults are the
  // proposal; the dealer interviews may change them. `enforced: false` = the switch is saved but the
  // app does not check it yet: the matrix says so, and nothing may rely on it until it is wired AND
  // backed by a database rule (a hidden button protects nothing).
  { key: 'assign_leads',    group: 'people', label: 'Assign and reassign leads', description: 'Give a lead to a salesman or move it to another.', roles: ['manager'], default: true,  enforced: false },
  { key: 'assign_cars',     group: 'people', label: 'Lock a car to a salesman',  description: 'Make a car exclusive to one salesman.', roles: ['manager'], default: true,  enforced: false },
  // No 'invite_staff' switch: adding or removing staff is owner-only (OWNER_ONLY below). A manager who
  // can add staff can create an accountant and see every money table.
  { key: 'approve_listings',group: 'stock',  label: 'Approve listings',          description: "Publish a salesman's car to the marketplace.", roles: ['manager'], default: true,  enforced: false },
  { key: 'change_price',    group: 'stock',  label: 'Change asking price',       description: 'Within the discount limit set in Settings.', roles: ['manager'], default: true,  enforced: false },
  { key: 'delete_car',      group: 'stock',  label: 'Remove a car',              description: 'Take a car out of stock.', roles: ['manager'], default: false, enforced: false },
  { key: 'approve_deals',   group: 'deals',  label: 'Approve deals up to the discount limit', description: 'Above the limit it still goes to the owner.', roles: ['manager'], default: true, enforced: false },
  { key: 'edit_settings',   group: 'deals',  label: 'Change cost settings and commission rates', description: 'Holding costs, fees, commission. Usually owner only.', roles: ['manager'], default: false, enforced: false },
];

// ── Which dashboard tabs a manager or admin can open (owner, 2026-11-13: "the owner controls
// and gives access to the manager with anything"). Managers and admins use the OWNER'S dashboard;
// these switches pick its tabs. Overview is always there. A money tab also needs its money switch:
// Revenue needs view_gross, Stock & costs needs view_cost.
const tab = (key, label, description, managerDefault, adminDefault) => [
  { key, group: 'tabs', label, description, roles: ['manager'], default: managerDefault, enforced: true },
  { key, group: 'tabs', label, description, roles: ['admin'], default: adminDefault, enforced: true },
];
export const TAB_CAPABILITIES = [
  ...tab('tab_crm', 'Leads, bookings and outreach', 'Sales > Leads / CRM.', true, true),
  ...tab('tab_hp', 'HP Board', 'Loan submissions to banks.', true, true),
  ...tab('tab_inventory', 'Inventory', 'Listings and Market demand.', true, true),
  ...tab('tab_stock', 'Stock & costs', 'Buy prices and the profit of each car. Also needs "View stock cost".', true, false),
  ...tab('tab_sold', 'Sold', 'Handover, customers and documents (buyer IC and address).', true, true),
  ...tab('tab_revenue', 'Revenue', 'Sales and profit this month. Also needs "View gross profit".', true, false),
  ...tab('tab_performance', 'Performance', 'Team scores and website traffic.', true, false),
  ...tab('tab_reports_listings', 'Reports > Listings', 'Views and enquiries per car.', true, true),
  ...tab('tab_storefront', 'Storefront', 'The public page, hero and services catalogue.', false, false),
  ...tab('tab_ai_manager', 'AI Manager', 'The morning briefing (it quotes profit).', true, false),
  ...tab('tab_team', 'Team', 'The team list and activity trail.', true, false),
];

// Never switchable: only the owner (owner, 2026-11-13).
export const OWNER_ONLY = [
  'Billing and plan',
  'Adding or removing staff',
  'Changing these switches',
  'Deleting the dealership',
];

// The "Do you have a manager?" answer lives on the manager row of role_permissions as
// `role_enabled` (false = this dealership has no manager: the role is hidden everywhere).
export const ROLE_ENABLED_KEY = 'role_enabled';

// Which switch opens which dashboard tab. A tab not listed is open to every role that reaches
// the dashboard (Overview). `sub` = the analytics sub-page.
export function tabCapability(tabId, sub) {
  if (tabId === 'analytics') {
    return { revenue: 'tab_revenue', performance: 'tab_performance', listings: 'tab_reports_listings' }[sub || 'revenue'] || 'tab_revenue';
  }
  return {
    crm: 'tab_crm', leads: 'tab_crm', bookings: 'tab_crm', outreach: 'tab_crm',
    hp: 'tab_hp',
    listings: 'tab_inventory', market: 'tab_inventory', add: 'tab_inventory',
    stock: 'tab_stock',
    handover: 'tab_sold', customers: 'tab_sold', documents: 'tab_sold',
    storefront: 'tab_storefront', ai_manager: 'tab_ai_manager', team: 'tab_team',
  }[tabId] || null;
}

// Money a tab shows: the tab switch alone is not enough.
export const TAB_NEEDS_MONEY = { tab_stock: 'view_cost', tab_revenue: 'view_gross', tab_ai_manager: 'view_gross' };

// Every switch the matrix shows and the resolvers read.
export const CAPABILITIES = [...CAPABILITIES_BASE, ...TAB_CAPABILITIES];

// Matrix headings, in order (each capability has a `group`).
export const CAPABILITY_GROUPS = [
  { id: 'tabs',   label: 'Tabs they can open' },
  { id: 'money',  label: 'Money' },
  { id: 'people', label: 'People' },
  { id: 'stock',  label: 'Stock' },
  { id: 'deals',  label: 'Deals and settings' },
];

// Roles that implicitly have every capability (owners). Not configurable.
const FULL_ACCESS_ROLES = ['owner', 'dealer', 'superadmin'];

export function isFullAccessRole(role) {
  return FULL_ACCESS_ROLES.includes(role);
}

// Default capability map for a given role (used when no stored row exists or a
// key is missing from the stored row).
export function defaultPermissionsForRole(role) {
  const map = {};
  for (const cap of CAPABILITIES) {
    if (cap.roles.includes(role)) map[cap.key] = cap.default;
  }
  // Grantable extras default OFF.
  if (ROLE_EXTRAS[role]) Object.assign(map, defaultTabAccessForRole(role));
  return map;
}

// Merge a stored permissions object over the role defaults so missing keys fall
// back to their default rather than undefined.
export function resolvePermissions(role, stored) {
  const base = defaultPermissionsForRole(role);
  if (!stored || typeof stored !== 'object') return base;
  const out = { ...base };
  for (const cap of CAPABILITIES) {
    if (cap.roles.includes(role) && typeof stored[cap.key] === 'boolean') {
      out[cap.key] = stored[cap.key];
    }
  }
  // Honour stored feat_* overrides for this role's grantable extras.
  for (const f of roleExtras(role)) {
    const key = `feat_${f.id}`;
    if (typeof stored[key] === 'boolean') out[key] = stored[key];
  }
  return out;
}

// Capabilities applicable to a role (for rendering the matrix).
export function capabilitiesForRole(role) {
  return CAPABILITIES.filter((c) => c.roles.includes(role));
}
