// ─── Granular role permissions (SEC-2) ────────────────────────────────────────
// Owner-controlled, per-role capability toggles stored in the `role_permissions`
// table (one JSONB row per dealer+role). Owner/dealer/superadmin always have
// every capability and are not configurable.

// Roles whose capabilities the owner can configure.
export const CONFIGURABLE_ROLES = [
  { value: 'salesman', label: 'Salesman' },
];

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
  return out;
}

// Capabilities applicable to a role (for rendering the matrix).
export function capabilitiesForRole(role) {
  return CAPABILITIES.filter((c) => c.roles.includes(role));
}
