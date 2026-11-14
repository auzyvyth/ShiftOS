// Owner vs manager: what each sees first, in ONE place (owner, 2026-11-12: "build something we
// can easily change later"). Research + reasons: docs/DEALER_ROLES_RESEARCH.md. The answers from
// the dealer interviews change THIS file, nothing else:
//   - `sections`: the order of the blocks on Overview (drop a key to hide a block).
//   - `alerts`:   which "needs you" cards show, in that order.
//   - `kpis`:     the four headline numbers.
// A block, card or number that shows money also names the permission it needs (`needs`); a role
// without it never sees it, whatever the order says. Owners have every permission.

export const OVERVIEW_ROLES = {
  // "Is my money growing, and where is it stuck?"
  owner: {
    label: 'Owner',
    // 'finance' = the money-first block (src/components/overview/OwnerMoney.jsx, owner 2026-11-12).
    // It replaces 'kpis' + 'money' for the owner: the same figures, summed from every car.
    // Leads, bookings and Puspakom alerts are the manager's: the owner sees money alerts only.
    sections: ['alerts', 'finance', 'team'],
    // No 'loss' card: it uses price < buy + recon (gm_exception_alerts), while the money block's
    // "Losing at asking price" uses carPnl (all costs). Two answers on one screen: audit #9.
    alerts: ['price', 'hp', 'no_cost', 'stale'],
    kpis: ['gross_month', 'sold_month', 'money_tied', 'open_leads'],
  },
  // "What do we push today?"
  manager: {
    label: 'Manager',
    sections: ['alerts', 'kpis', 'pipeline', 'team', 'money'],
    alerts: ['unanswered', 'appt', 'price', 'cold', 'no_cost', 'stale', 'b7', 'hp', 'loss', 'anomaly'],
    kpis: ['open_leads', 'appts_today', 'sold_month', 'active_listings'],
  },
};

// Which permission a money item needs (lib/permissions.js CAPABILITIES keys).
export const NEEDS = {
  gross_month: 'view_gross',
  money_tied: 'view_cost',
  loss: 'view_cost',
  money: 'view_cost',
  no_cost: 'view_cost',
  finance: 'view_gross',
};

// Overview view for a signed-in role. Dealer / owner / superadmin = owner; manager and admin =
// manager (admin runs the office, closest to the floor view). Unknown = owner.
export function overviewRoleFor(role) {
  if (role === 'manager' || role === 'admin') return 'manager';
  return 'owner';
}

// How the dealership is set up (asked once when a dealer joins; not wired yet, waits for the
// interviews). "solo" hides the manager role and its settings; "with_manager" uses the defaults.
export const SETUP_PRESETS = [
  { id: 'solo', label: 'I run it myself', roles: ['salesman'] },
  { id: 'with_manager', label: 'I have a manager', roles: ['manager', 'salesman'] },
];
