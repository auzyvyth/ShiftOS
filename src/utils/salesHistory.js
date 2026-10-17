// Sales history (Salesman Premium): every car the seller has sold, grouped by
// month, with what each car drew while it was listed. Pure functions so the
// sheet and the download say exactly the same thing.
//
// Commission is `commission_amount` — the same number the goal gauge reads.
// For a solo seller the DB keeps it equal to selling - base
// (trg_solo_commission_is_margin), so do not recompute it here: a second
// formula is how the gauge and the car card came to disagree.

const DAY_MS = 86400000;

export function soldCars(listings) {
  return (listings || [])
    .filter((c) => c.status === "sold" && c.sold_at)
    .sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));
}

export function daysToSell(car) {
  if (!car.created_at || !car.sold_at) return null;
  const d = Math.round((new Date(car.sold_at) - new Date(car.created_at)) / DAY_MS);
  return d >= 0 ? d : null;
}

export const carName = (c) => [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ");

// Newest month first. Months with no sale are left out: a page of empty
// months is noise, and the gap between two headers already says it.
export function groupByMonth(cars) {
  const months = [];
  const byKey = new Map();
  for (const car of cars) {
    const d = new Date(car.sold_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let m = byKey.get(key);
    if (!m) {
      m = { key, date: new Date(d.getFullYear(), d.getMonth(), 1), cars: [], commission: 0 };
      byKey.set(key, m);
      months.push(m);
    }
    m.cars.push(car);
    m.commission += Number(car.commission_amount) || 0;
  }
  return months;
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// One row per sold car. `stats` is keyed by car id: { views, whatsapp, calls, bookings }.
// Leading BOM so Excel opens it as UTF-8.
export function salesCsv(cars, stats, headers) {
  const rows = cars.map((c) => {
    const s = stats[c.id] || {};
    return [
      String(c.sold_at).slice(0, 10),
      carName(c),
      c.plate_number || "",
      Number(c.selling_price) || 0,
      Number(c.base_price) || "",
      Number(c.commission_amount) || 0,
      daysToSell(c) ?? "",
      s.views || 0,
      s.whatsapp || 0,
      s.calls || 0,
      s.bookings || 0,
    ];
  });
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
