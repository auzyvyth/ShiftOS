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
export const CAPABILITIES = [
  {
    key: 'view_commission',
    label: 'View commission amounts',
    description: 'Show the commission strip, breakdown and per-deal commission figures.',
    roles: ['salesman'],
    default: true,
    enforced: true,
  },
  {
    key: 'view_all_leads',
    label: 'View all team leads',
    description: 'See every lead in the dealership, not only leads assigned to them.',
    roles: ['salesman'],
    default: false,
    enforced: true,
  },
  {
    key: 'view_cost',
    label: 'View stock cost & purchase price',
    description: 'Show purchase price, recon cost, and cost basis columns in the Stock tab.',
    roles: ['manager', 'admin'],
    default: true,
    enforced: true,
  },
  {
    key: 'view_gross',
    label: 'View gross profit figures',
    description: 'Show gross profit column in Stock tab and P&L breakdown.',
    roles: ['manager', 'admin'],
    default: true,
    enforced: true,
  },
  {
    key: 'export_data',
    label: 'Export CSV / download reports',
    description: 'Access the Export CSV button on the Analytics tab.',
    roles: ['manager', 'admin'],
    default: true,
    enforced: true,
  },
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
