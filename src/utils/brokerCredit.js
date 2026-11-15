// BROKER-1: who owns a lead, when an outside broker is involved. ONE rule, used by every dealer
// lead screen (cards, the kanban, the drawer), so two screens can never name two different owners.
//
// A lead can reach a broker two ways:
//   page          the buyer arrived through the broker's own page (?ref=), so the database credited
//                 leads.salesman_id to that broker (resolve_lead_salesman)
//   registration  the broker registered this buyer's number on the dealer's cars (the 14-day hold,
//                 broker_registrations); the buyer's phone matches the lead's
// When both exist and name different brokers, the REGISTRATION wins: it is the explicit, time-stamped
// claim the broker made with the buyer's consent, and the first one holds. The page link is only where
// the buyer happened to land. The dealer sees the clash and the reason; nobody has to argue it.

export function leadPhone(lead) {
  const raw = lead?.phone_norm || lead?.phone || '';
  let d = String(raw).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('60')) return d;
  if (d.startsWith('0')) return '60' + d.slice(1);
  return '60' + d;
}

// brokers: rows of dealer_my_brokers() ({broker_id, name}); regs: rows of dealer_broker_regs()
export function creditForLead(lead, { brokers = [], regs = [], now = Date.now() } = {}) {
  if (!lead) return null;
  const byId = new Map((brokers || []).map((b) => [b.broker_id, b]));

  let page = null;
  if (lead.salesman_id) {
    const b = byId.get(lead.salesman_id);
    if (b) page = { brokerId: b.broker_id, name: b.name };
    // A manager cannot read the broker list; a lead credited to someone who is not on the team and
    // has no profile we can read is still an outside seller's, so say that instead of "Unassigned".
    else if (!lead.salesman_profile && !lead.assigned_profile && lead.assigned_to == null) {
      page = { brokerId: lead.salesman_id, name: null };
    }
  }

  const phone = leadPhone(lead);
  let reg = null;
  if (phone) {
    const live = (regs || [])
      .filter((r) => r.buyer_phone === phone && (r.status === 'sold' || new Date(r.hold_until).getTime() > now))
      .sort((a, b) => new Date(a.registered_at) - new Date(b.registered_at));
    if (live[0]) {
      reg = { brokerId: live[0].broker_id, name: live[0].broker_name, at: live[0].registered_at, until: live[0].hold_until, status: live[0].status };
    }
  }

  if (!page && !reg) return null;
  const owner = reg ? { brokerId: reg.brokerId, name: reg.name, via: 'registration' } : { brokerId: page.brokerId, name: page.name, via: 'page' };
  const conflict = !!(reg && page && reg.brokerId !== page.brokerId);
  return { owner, page, registration: reg, conflict };
}
