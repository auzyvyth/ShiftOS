// Malaysian road tax estimate (Peninsular Malaysia, private petrol saloon scale).
// Saloon = sedan / hatchback / coupe / wagon / convertible. Non-saloon (MPV/SUV/
// pickup) is taxed lower, so the saloon scale is a safe upper-estimate default.
// Source: JPJ private vehicle road tax structure.
// Returns RM (annual), rounded. Returns null if cc is missing/invalid.
export function estimateRoadTax(engineCc) {
  const cc = Number(engineCc);
  if (!cc || cc <= 0) return null;

  if (cc <= 1000) return 20;
  if (cc <= 1200) return 55;
  if (cc <= 1400) return 70;
  if (cc <= 1600) return 90;

  let base, threshold, perCc;
  if (cc <= 1800)      { base = 200;  threshold = 1600; perCc = 0.40; }
  else if (cc <= 2000) { base = 280;  threshold = 1800; perCc = 0.50; }
  else if (cc <= 2500) { base = 380;  threshold = 2000; perCc = 1.00; }
  else if (cc <= 3000) { base = 880;  threshold = 2500; perCc = 2.50; }
  else                 { base = 2130; threshold = 3000; perCc = 4.50; }

  return Math.round(base + (cc - threshold) * perCc);
}
