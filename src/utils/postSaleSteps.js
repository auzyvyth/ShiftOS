// Malaysian used-car post-sale handover sequence. After a deal is "won", these
// are the legal/admin steps to actually transfer the car to the buyer.
// Fees are the official government rates (2025/26); dealers/runners often bundle
// and mark them up, so cost is an editable default, not a fixed charge.
//
// Sourced order: settle loan -> clear saman + valid road tax -> buyer insurance
// -> Puspakom B5 (+B7 if financed) -> JPJ pindah milik (biometric, buyer within
// 7 days) -> new geran + road tax -> handover. (Seller NCD transfer is seller-side.)

export const POST_SALE_STEPS = [
  {
    key: 'loan_settlement',
    label: 'Settle outstanding loan',
    owner: 'dealer',
    cost: null,
    optional: true,
    hint: 'Clear any existing hire-purchase on the car and obtain the bank’s release of ownership claim (tuntutan). Skip if the car is owned outright / paid cash.',
  },
  {
    key: 'insurance',
    label: 'Buyer insurance / cover note',
    owner: 'customer',
    cost: null,
    optional: false,
    hint: 'Buyer takes out a new motor policy in their own name — required before JPJ transfer and road tax. NCD stays with the seller, it does not pass to the buyer.',
  },
  {
    key: 'puspakom_b5',
    label: 'Puspakom B5 inspection',
    owner: 'runner',
    cost: 30,
    optional: false,
    hint: 'Mandatory transfer-of-ownership inspection. Checks engine/chassis numbers, undercarriage, tint. Official fee RM30.',
  },
  {
    key: 'puspakom_b7',
    label: 'Puspakom B7 (financed cars)',
    owner: 'runner',
    cost: 60,
    optional: true,
    hint: 'Additional inspection required only when the car is/was financed or the buyer is taking a loan. Official fee RM60.',
  },
  {
    key: 'jpj_transfer',
    label: 'JPJ ownership transfer (pindah milik)',
    owner: 'runner',
    cost: 100,
    optional: false,
    hint: 'Initiate on MySIKAP/MyJPJ. Both parties do biometric thumbprint; the buyer must verify within 7 days of the seller. Clear all saman first. Official fee RM100.',
  },
  {
    key: 'road_tax',
    label: 'Road tax renewal (buyer name)',
    owner: 'runner',
    cost: null,
    optional: false,
    hint: 'Renew in the buyer’s name after transfer (MyEG/MyJPJ). Requires an in-force insurance policy. Calculated by engine cc.',
  },
  {
    key: 'geran_collection',
    label: 'Collect new geran / VOC',
    owner: 'customer',
    cost: null,
    optional: false,
    hint: 'New owner collects the updated vehicle registration card from JPJ.',
  },
  {
    key: 'handover',
    label: 'Vehicle handover',
    owner: 'salesman',
    cost: null,
    optional: false,
    hint: 'Keys, spare key, geran, service records and accessories handed to the buyer. Deal complete.',
  },
];

export const OWNER_LABELS = {
  runner: 'Runner',
  salesman: 'Salesman',
  dealer: 'Dealer',
  customer: 'Customer',
};

export const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  in_progress: { label: 'In progress', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  done:        { label: 'Done',        color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  na:          { label: 'N/A',         color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};

// Build the default task rows for a freshly-won deal.
export function defaultTasksFor(lead) {
  const financed = !!(lead?.loan_bank || lead?.loan_amount || lead?.loan_status);
  return POST_SALE_STEPS.map((s, i) => ({
    step_key: s.key,
    status: s.key === 'puspakom_b7' && !financed ? 'na' : 'pending',
    owner_role: s.owner,
    cost: s.cost,
    sort_order: i,
  }));
}

// Progress = done / (total - na), so skipped steps don't drag the bar down.
export function computeProgress(tasks) {
  const counted = tasks.filter((t) => t.status !== 'na');
  if (counted.length === 0) return 0;
  const done = counted.filter((t) => t.status === 'done').length;
  return Math.round((done / counted.length) * 100);
}

// The next actionable step for a deal — the first non-done, non-na step in the
// official sequence. Returns { label, owner } or null if everything is done.
// Lets the handover board show what's blocking a deal without opening it.
const STEP_INDEX = Object.fromEntries(POST_SALE_STEPS.map((s, i) => [s.key, { ...s, order: i }]));
export function nextBlocker(tasks) {
  const open = (tasks || [])
    .filter((t) => t.status === 'pending' || t.status === 'in_progress')
    .map((t) => ({ ...t, meta: STEP_INDEX[t.step_key] }))
    .filter((t) => t.meta)
    .sort((a, b) => a.meta.order - b.meta.order);
  if (open.length === 0) return null;
  const t = open[0];
  return { label: t.meta.label, owner: OWNER_LABELS[t.owner_role] || t.meta.owner, status: t.status };
}
