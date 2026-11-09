// The ONE recon rule (DMS-AUDIT batch 3). Mirror of SQL stock_recon_effective():
// the larger of the booked estimate and the logged recon jobs. A job never lowers the
// cost (one RM800 job used to replace a RM2,500 estimate and raise profit); if the real
// cost came in under the estimate, the owner lowers the estimate.
export function effectiveRecon(estimate, jobs = []) {
  const est = Number(estimate) || 0;
  const actual = (jobs || []).reduce((s, j) => s + (Number(j?.cost) || 0), 0);
  return Math.max(est, actual);
}
