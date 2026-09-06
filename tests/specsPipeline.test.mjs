// The spec collection pipeline. These rows come from a language model's
// memory, so the validator is the only thing standing between a unit slip and
// a published listing - a person pasting JSON is moving text, not checking
// torque figures. Each case here is a mistake that has actually got through
// somewhere, or one whose shape makes it likely.
import { validateRows, toCarSpecsRow, OPEN_ENDED } from '../tools/specs/lib/validate.mjs';

let pass = 0;
const fails = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('ok  ', name); }
  else { fails.push(name); console.log('FAIL', name); }
}
function eq(name, got, want) {
  const good = got === want;
  if (!good) console.log(`     got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  ok(name, good);
}

const base = {
  make: 'Toyota', model: 'Hilux', year_from: 2016, year_to: 2020,
  body_type: 'Pickup', doors: 4, seats: 5, engine_cc: 2755, cylinders: 4,
  horsepower: 177, torque_nm: 450, transmission: 'Auto', drivetrain: '4WD',
  fuel_type: 'Diesel', fuel_consumption: 11, confidence: 'medium',
  primary_variant: '2.8G', variants: [{ name: '2.8G' }],
};
const row = (over) => ({ ...base, ...over });
const errsFor = (over) => validateRows([row(over)]).errors;
const rejects = (over) => errsFor(over).length > 0;

// ── a good row passes, or every other assertion here is meaningless ─────────
ok('a well-formed row passes', validateRows([row()]).ok);

// ── the conversion carSpecs.js actually needs ───────────────────────────────
// yearTo null is the silent one: lookupFullSpec tests `y <= yearTo`, and
// `2024 <= null` is false, so the row drops out of the year match entirely and
// only survives via the newest-generation fallback.
eq('open-ended year becomes 2099', toCarSpecsRow(row({ year_to: null })).yearTo, OPEN_ENDED);
eq('a closed year is kept', toCarSpecsRow(row({ year_to: 2020 })).yearTo, 2020);
eq('year_from becomes yearFrom', toCarSpecsRow(row()).yearFrom, 2016);
ok('the nine extra fields are dropped', (() => {
  const out = toCarSpecsRow(row({ generation: 'AN120', market: 'CBU', chassis_codes: ['GUN125'], source_note: 'x' }));
  return !('generation' in out) && !('market' in out) && !('chassis_codes' in out)
      && !('variants' in out) && !('confidence' in out) && !('source_note' in out)
      && !('torque_nm' in out) && !('drivetrain' in out) && !('primary_variant' in out);
})());
eq('a carSpecs row has exactly 13 fields', Object.keys(toCarSpecsRow(row())).length, 13);
eq('a missing figure becomes null, not undefined', toCarSpecsRow(row({ horsepower: undefined })).horsepower, null);

// ── overlapping generations: invisible at runtime, arbitrary in effect ──────
// rows.find() returns whichever row sits first in the array, so which specs a
// seller gets depends on file order. Nothing errors.
ok('overlapping generations are rejected', validateRows([
  row({ year_from: 2015, year_to: 2022 }),
  row({ year_from: 2022, year_to: null }),
]).errors.length > 0);
ok('touching but not overlapping is fine', validateRows([
  row({ year_from: 2015, year_to: 2022 }),
  row({ year_from: 2023, year_to: null }),
]).ok);
ok('two rows starting the same year are rejected', validateRows([
  row({ year_from: 2016 }), row({ year_from: 2016, horsepower: 150 }),
]).errors.length > 0);
ok('an open-ended row still blocks a later overlap', validateRows([
  row({ year_from: 2015, year_to: null }),
  row({ year_from: 2020, year_to: null }),
]).errors.length > 0);
ok('the same year range on a DIFFERENT model is fine', validateRows([
  row({ year_from: 2015, year_to: 2022 }),
  row({ model: 'Fortuner', year_from: 2015, year_to: 2022 }),
]).ok);

// ── the other overlap: a collected row against the HAND-CURATED table ───────
// Hand rows win at lookup because they sit earlier in SPECS, so a collected row
// whose years overlap one is dead on arrival - it lands in the generated block
// and rows.find() stops at the curated row before it. This shipped: a batch
// re-collecting already-curated models emitted Honda City 2008-2013 and two
// Vios rows on top of curated rows covering the same years, and the run
// reported success.
const curated = [
  { make: 'Toyota', model: 'Hilux', yearFrom: 2005, yearTo: 2015 },
  { make: 'Toyota', model: 'Hilux', yearFrom: 2016, yearTo: 2099 },
];
ok('a collected row overlapping a curated row is rejected',
   validateRows([row({ year_from: 2010, year_to: 2014 })], curated).errors.length > 0);
ok('the error names the curated row it collides with',
   validateRows([row({ year_from: 2010, year_to: 2014 })], curated).errors[0].includes('2005-2015'));
ok('an open-ended curated row blocks a later collected row',
   validateRows([row({ year_from: 2021, year_to: null })], curated).errors.length > 0);

// An exact yearFrom match is generate.mjs dropping the row, which is the
// designed way a batch may revisit a curated model. Failing there would reject
// every honest batch that happens to re-collect one.
ok('an exact yearFrom match is a skip, not an error',
   validateRows([row({ year_from: 2016, year_to: 2020 })], curated).ok);
ok('an exact match still passes when its range spans another curated row',
   validateRows([row({ year_from: 2016, year_to: null })], curated).ok);

ok('a curated row for a DIFFERENT model does not interfere',
   validateRows([row({ model: 'Fortuner', year_from: 2010, year_to: 2014 })], curated).ok);
ok('a gap between curated rows is fine',
   validateRows([row({ year_from: 2003, year_to: 2004 })],
                [{ make: 'Toyota', model: 'Hilux', yearFrom: 2005, yearTo: 2015 }]).ok);
ok('curated matching ignores case and dashes, like lookupFullSpec',
   validateRows([row({ make: 'Mazda', model: 'CX-5', year_from: 2014, year_to: 2018 })],
                [{ make: 'mazda', model: 'cx 5', yearFrom: 2013, yearTo: 2016 }]).errors.length > 0);
ok('no curated list behaves exactly as before',
   validateRows([row({ year_from: 2010, year_to: 2014 })]).ok);

// Several curated rows already overlap each other (Perodua Myvi 2005-2011 and
// 2011-2017 both cover 2011). That is a pre-existing condition, and failing
// every build on it would help nobody.
ok('curated rows are never checked against each other', validateRows([], [
  { make: 'Perodua', model: 'Myvi', yearFrom: 2005, yearTo: 2011 },
  { make: 'Perodua', model: 'Myvi', yearFrom: 2011, yearTo: 2017 },
]).ok);

// ── unit slips: the mistakes that look like real numbers ────────────────────
ok('kW written into horsepower is rejected', rejects({ horsepower: 8 }));
ok('L/100km written into km/L is rejected', rejects({ fuel_consumption: 2 }));
ok('an absurd economy figure is rejected', rejects({ fuel_consumption: 95 }));
ok('kgm written into torque_nm is rejected', rejects({ torque_nm: 45 }));
ok('cc written as litres is rejected', rejects({ engine_cc: 2.8 }));
ok('a plausible economy figure passes', validateRows([row({ fuel_consumption: 11 })]).ok);

// ── values the form and the DB simply cannot store ─────────────────────────
ok('an out-of-enum body_type is rejected', rejects({ body_type: 'Van' }));
ok('an out-of-enum transmission is rejected', rejects({ transmission: 'CVT' }));
ok('an out-of-enum fuel_type is rejected', rejects({ fuel_type: 'PHEV' }));
ok('an out-of-enum market is rejected', rejects({ market: 'Recon' }));
ok('a missing required field is rejected', rejects({ body_type: undefined }));
ok('7 doors is rejected', rejects({ doors: 7 }));

// ── internal contradictions ────────────────────────────────────────────────
ok('an EV with an engine is rejected', rejects({ fuel_type: 'Electric', engine_cc: 1998 }));
ok('an EV with cylinders is rejected', rejects({ fuel_type: 'Electric', engine_cc: null, cylinders: 4 }));
ok('a real EV passes', validateRows([row({ fuel_type: 'Electric', engine_cc: null, cylinders: null })]).ok);
ok('year_to before year_from is rejected', rejects({ year_from: 2020, year_to: 2015 }));
ok('a future year_to is rejected', rejects({ year_to: 2200 }));

// ── SCHEMA.md rules that keep the flat block meaningful ────────────────────
// The flat block IS one of the variants. If it names a variant that is not
// there, nobody can tell which car the autofill figures describe.
ok('primary_variant absent from variants[] is rejected',
   rejects({ primary_variant: '2.8G', variants: [{ name: '2.4E' }] }));
ok('primary_variant present in variants[] passes',
   validateRows([row({ primary_variant: '2.4E', variants: [{ name: '2.4E' }] })]).ok);

// ── a chassis code is a code, not a code plus a serial ─────────────────────
ok('a serial suffix on a chassis code is rejected', rejects({ chassis_codes: ['AGH30W-0123456'] }));
ok('a lowercase chassis code is rejected', rejects({ chassis_codes: ['agh30'] }));
ok('a clean chassis code passes', validateRows([row({ chassis_codes: ['GUN125', 'GUN126'] })]).ok);

// ── project-wide: no invented money, anywhere ──────────────────────────────
ok('a price in source_note is rejected', rejects({ source_note: 'Sold around RM 120,000 used.' }));
ok('a valuation word in source_note is rejected', rejects({ source_note: 'Holds its resale value well.' }));
ok('depreciation talk is rejected', rejects({ source_note: 'Depreciates slowly in Malaysia.' }));
ok('an ordinary source_note passes', validateRows([row({ source_note: 'Double-cab is the volume body here.' })]).ok);

// ── warnings inform, they do not block ─────────────────────────────────────
{
  const r = validateRows([row({ confidence: 'low' })]);
  ok('low confidence warns but passes', r.ok && r.warnings.length > 0);
}
{
  const r = validateRows([row({ engine_cc: null })]);
  ok('a missing engine_cc warns but passes', r.ok && r.warnings.length > 0);
}

console.log('');
if (fails.length) {
  console.log(`specsPipeline: ${pass} passed, ${fails.length} FAILED`);
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`specsPipeline: ${pass} passed`);
