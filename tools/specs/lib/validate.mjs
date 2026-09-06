// Validation for collected spec rows. This is the safeguard that replaces a
// human reading the numbers - a person pasting JSON is moving text, not
// checking torque figures, so the check has to be machine-made or it is not
// happening at all.
//
// Every rule here is either a form/DB constraint (a value the app cannot
// store) or a plausibility bound (a value that is almost certainly a unit
// mistake). Nothing here can tell you a real-looking figure is wrong; it
// catches the mistakes that have a shape.

export const ENUMS = {
  transmission: ['Auto', 'Manual'],
  fuel_type:    ['Petrol', 'Diesel', 'Hybrid', 'Electric'],
  body_type:    ['Sedan', 'SUV', 'MPV', 'Hatchback', 'Coupe', 'Pickup'],
  drivetrain:   ['FWD', 'RWD', 'AWD', '4WD'],
  market:       ['JDM', 'CBU', 'CKD'],
  confidence:   ['high', 'medium', 'low'],
};

// [min, max] inclusive. A value outside these is a unit slip far more often
// than a real car: kW written into a horsepower field, L/100km into km/L,
// kgm into Nm.
export const RANGES = {
  year_from:        [1980, new Date().getFullYear() + 1],
  engine_cc:        [600, 8000],
  cylinders:        [2, 12],
  horsepower:       [30, 1200],
  torque_nm:        [50, 1500],
  doors:            [2, 5],
  seats:            [2, 9],
  fuel_consumption: [3, 40],   // km/L, matches the car_specs CHECK
};

const REQUIRED = ['make', 'model', 'year_from', 'body_type', 'confidence'];

// Money must never appear in collected data - the source has no price and any
// figure would be invented. Same rule as the AI drafts.
const MONEY = /\b(rm\s*\d|price|priced|worth|valuation|deposit|instalment|installment|resale value|depreciat)/i;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkRow(row, path, errors, warnings) {
  const at = (m) => errors.push(`${path}: ${m}`);
  const warn = (m) => warnings.push(`${path}: ${m}`);

  for (const k of REQUIRED) {
    if (row[k] === undefined || row[k] === null || row[k] === '') at(`missing required field "${k}"`);
  }

  for (const [field, allowed] of Object.entries(ENUMS)) {
    const v = row[field];
    if (v === undefined || v === null) continue;
    if (!allowed.includes(v)) at(`${field} "${v}" is not one of ${allowed.join(', ')}`);
  }

  for (const [field, [lo, hi]] of Object.entries(RANGES)) {
    const v = row[field];
    if (v === undefined || v === null) continue;
    if (!isNum(v)) { at(`${field} must be a number or null, got ${JSON.stringify(v)}`); continue; }
    if (v < lo || v > hi) at(`${field} ${v} is outside ${lo}-${hi} - check the units`);
  }

  // year_to null means "still current". A closed range must actually close.
  if (row.year_to !== null && row.year_to !== undefined) {
    if (!isNum(row.year_to)) at('year_to must be a number or null');
    else if (row.year_to < row.year_from) at(`year_to ${row.year_to} is before year_from ${row.year_from}`);
    else if (row.year_to > RANGES.year_from[1]) at(`year_to ${row.year_to} is in the future`);
  }

  // An electric car has no engine or cylinders; a combustion one must have both.
  if (row.fuel_type === 'Electric') {
    if (isNum(row.engine_cc) && row.engine_cc > 0) at('fuel_type Electric with a non-zero engine_cc');
    if (isNum(row.cylinders) && row.cylinders > 0) at('fuel_type Electric with cylinders');
  } else if (row.fuel_type && !isNum(row.engine_cc)) {
    warn('no engine_cc - the form will leave that field blank');
  }

  // A chassis code is a code, not a code plus the car's serial.
  for (const c of row.chassis_codes || []) {
    if (typeof c !== 'string') { at(`chassis_codes contains a non-string`); continue; }
    if (c !== c.toUpperCase()) at(`chassis code "${c}" must be uppercase`);
    if (/[-_ ]/.test(c)) at(`chassis code "${c}" still carries a serial suffix - strip it`);
  }

  // SCHEMA.md: the flat block IS one of the variants, named.
  const variants = row.variants || [];
  if (row.primary_variant && variants.length) {
    const names = variants.map((v) => v && v.name);
    if (!names.includes(row.primary_variant)) {
      at(`primary_variant "${row.primary_variant}" is not in variants[] (${names.join(', ')})`);
    }
  }

  if (row.source_note && MONEY.test(row.source_note)) {
    at('source_note mentions money - no price, valuation or depreciation anywhere');
  }

  if (row.confidence === 'low') warn('low confidence - treat as a draft');
}

// Two rows for the same model whose year ranges overlap make lookupFullSpec
// arbitrary: rows.find() returns whichever happens to sit first in the array.
// That is the failure this whole check exists for - it is invisible at runtime.
function checkOverlaps(rows, errors) {
  const byModel = new Map();
  for (const r of rows) {
    if (!r.make || !r.model || !isNum(r.year_from)) continue;
    const key = `${String(r.make).toLowerCase()}|${String(r.model).toLowerCase()}`;
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key).push(r);
  }
  for (const [key, list] of byModel) {
    const sorted = [...list].sort((a, b) => a.year_from - b.year_from);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.year_from === cur.year_from) {
        errors.push(`${key}: two rows both start at ${cur.year_from}`);
        continue;
      }
      const prevEnd = prev.year_to === null || prev.year_to === undefined ? Infinity : prev.year_to;
      if (cur.year_from <= prevEnd) {
        errors.push(
          `${key}: generations overlap - ${prev.year_from}-${prev.year_to ?? 'current'} ` +
          `and ${cur.year_from}-${cur.year_to ?? 'current'} both cover ${cur.year_from}`,
        );
      }
    }
  }
}

// rows: every collected row across every batch file, each carrying _file.
export function validateRows(rows) {
  const errors = [];
  const warnings = [];
  rows.forEach((row, i) => {
    const path = `${row._file || 'input'}[${row._index ?? i}] ${row.make || '?'} ${row.model || '?'} ${row.year_from || '?'}`;
    checkRow(row, path, errors, warnings);
  });
  checkOverlaps(rows, errors);
  return { errors, warnings, ok: errors.length === 0 };
}

// One collected row -> one carSpecs.js row. The only two conversions are the
// key names and the open-ended year: carSpecs uses 2099, never null, because
// lookupFullSpec tests `y <= yearTo` and `y <= null` is false for every year,
// which silently drops the row out of the year match.
export const OPEN_ENDED = 2099;

export function toCarSpecsRow(row) {
  return {
    make: row.make,
    model: row.model,
    yearFrom: row.year_from,
    yearTo: row.year_to === null || row.year_to === undefined ? OPEN_ENDED : row.year_to,
    engine_cc: row.engine_cc ?? null,
    cylinders: row.cylinders ?? null,
    transmission: row.transmission ?? null,
    fuel_type: row.fuel_type ?? null,
    body_type: row.body_type ?? null,
    horsepower: row.horsepower ?? null,
    doors: row.doors ?? null,
    seats: row.seats ?? null,
    fuel_consumption: row.fuel_consumption ?? null,
  };
}
