// The decode -> spec chain. Guards the half of the Decode button that used to
// do nothing: a chassis code filled a brand and a model and stopped, because
// the spec autofill needs a year and a chassis code deliberately never supplies
// one. These are the two helpers that let it fill anyway, plus the coverage
// number so filling the backlog is visible in a diff.
import { decodeChassis, specVariantDiffers, specProbeYear } from '../src/utils/chassisDecode.js';
import { lookupFullSpec, lookupCarSpec } from '../src/utils/carSpecs.js';

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

// What the form actually does, in one place, so the test can't drift from it.
function fillFor(raw) {
  const hit = decodeChassis(raw);
  if (!hit) return { hit: null, spec: null, skipped: false };
  if (specVariantDiffers(hit)) return { hit, spec: null, skipped: true };
  return { hit, spec: lookupFullSpec(hit.brand, hit.model, specProbeYear(hit)), skipped: false };
}

// ── the whole point: a recon code fills real specs ──────────────────────────
{
  const { hit, spec } = fillFor('AGH30W-0123456');
  eq('AGH30 is an Alphard', `${hit.brand} ${hit.model}`, 'Toyota Alphard');
  ok('AGH30 fills specs', !!spec);
  ok('AGH30 fills an MPV with 7 seats', spec.body_type === 'MPV' && spec.seats === 7);
  ok('AGH30 fills cc and bhp', spec.engine_cc > 0 && spec.horsepower > 0);
}
{
  const { spec } = fillFor('ZSU60W-0012345');
  ok('ZSU60 Harrier fills an SUV', spec && spec.body_type === 'SUV');
}

// ── the probe year lands inside the right generation, not the one before ────
// Japan gets a generation before Malaysia, so the two tables' boundaries are a
// year or two apart. Probing at `from` picked the previous row.
eq('open-ended generation steps in', specProbeYear({ from: 2021, to: null }), 2023);
eq('closed generation takes the middle', specProbeYear({ from: 2015, to: 2023 }), 2019);
eq('no from means no probe', specProbeYear({ from: null, to: null }), null);
eq('undefined hit is safe', specProbeYear(undefined), null);
{
  const { spec } = fillFor('FE1-0001234');   // 11th-gen Civic, from 2021
  ok('FE1 gets the 2022+ Civic row, not 2016-2021', spec && spec.yearFrom >= 2022);
  const older = fillFor('FK7-0001234');      // 10th-gen Civic, 2015-2021
  ok('FK7 still gets the 2016-2021 row', older.spec && older.spec.yearTo <= 2021);
  ok('the two generations do not fill the same bhp',
     spec.horsepower !== older.spec.horsepower);
}

// ── a variant whose mechanicals differ must fill NOTHING ────────────────────
// Wrong numbers are worse than the blank they replace: a blank is visibly a
// blank, a wrong bhp gets published.
ok('Type R is skipped',        specVariantDiffers({ alt: 'Type R' }));
ok('hybrid is skipped',        specVariantDiffers({ alt: 'Vellfire (hybrid)' }));
ok('450h is skipped',          specVariantDiffers({ alt: '450h' }));
ok('Nismo is skipped',         specVariantDiffers({ alt: 'Nismo' }));
ok('badge-twin is NOT skipped', !specVariantDiffers({ alt: 'Vellfire' }));
ok('no alt is NOT skipped',     !specVariantDiffers({}));
ok('undefined is NOT skipped',  !specVariantDiffers(undefined));
ok('FL5 Type R fills nothing',  fillFor('FL5-1234567').skipped);
ok('AYH30 hybrid Alphard fills nothing', fillFor('AYH30-0012345').skipped);
ok('AGH30 petrol Alphard is not skipped', !fillFor('AGH30W-0123456').skipped);

// ── an uncovered model degrades to a blank, not a wrong guess ───────────────
{
  const { hit, spec } = fillFor('ZRR80-1112223');
  ok('ZRR80 still decodes to a Voxy', hit && hit.model === 'Voxy');
  ok('ZRR80 has no spec row yet, and fills nothing', spec === null);
}

// ── coverage, so filling the backlog shows up in a diff ─────────────────────
// tools/specs/ is the pipeline for raising this number. If it drops, a
// carSpecs row was removed or renamed out from under the chassis table.
{
  const SAMPLE = [
    'AGH30', 'ZSU60', 'FE1', 'ZRR80', 'GYL20', 'MXUA80',
    'ZVW30', 'NHP10', 'RU1', 'ACR50',
  ];
  const seen = new Set();
  let covered = 0;
  for (const raw of SAMPLE) {
    const hit = decodeChassis(raw);
    if (!hit) continue;
    const key = `${hit.brand}|${hit.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (lookupCarSpec(hit.brand, hit.model)) covered++;
  }
  console.log(`     coverage on this sample: ${covered}/${seen.size} models have a spec row`);
  ok('every sampled chassis code still decodes', seen.size >= 8);
  ok('at least the volume recon models have specs', covered >= 3);
}

// ── European generation codes fill THEIR generation, not the newest ─────────
// chassisCodes.js carried no years into the decode, so every code probed with
// no year and got the newest row: an E71 X6 filled the G06's specs.
{
  const e71 = fillFor('E71');
  eq('E71 carries its generation years', `${e71.hit.from}-${e71.hit.to}`, '2008-2014');
  eq('E71 fills the E71 row', e71.spec && e71.spec.yearFrom, 2008);
  const g06 = fillFor('G06');
  eq('G06 fills the G06 row', g06.spec && g06.spec.yearFrom, 2020);
}
{
  const { hit, spec } = fillFor('W463');
  eq('W463 hands back the picker spelling', hit.brand, 'Mercedes-Benz');
  eq('W463 fills the 1990-2018 G-Class', spec && spec.yearFrom, 1990);
}

// ── a year no generation covers is a miss, not the newest generation ────────
eq('V37 Skyline has no row: no R34 specs', fillFor('V37').spec, null);
eq('C25 Serena has no row: no 2018 specs', fillFor('C25').spec, null);
eq('a year far outside every row returns null', lookupFullSpec('Suzuki', 'Baleno', 2005), null);
eq('one year off takes the neighbour', lookupFullSpec('Honda', 'Legend', 2013)?.yearFrom, 2005);
eq('no year still means newest', lookupFullSpec('Honda', 'Legend')?.yearFrom, 2015);

// ── "Mazda 3" in the picker and "3" in the table are one model ──────────────
ok('picker name "Mazda 3" finds the curated "3" rows', !!lookupFullSpec('Mazda', 'Mazda 3', 2016));
ok('bare "2" finds a "Mazda 2" row', !!lookupFullSpec('Mazda', '2', 2010));
ok('BM5FS (Mazda 3) now fills specs', !!fillFor('BM5FS').spec);

console.log('');
if (fails.length) {
  console.log(`chassisSpec: ${pass} passed, ${fails.length} FAILED`);
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`chassisSpec: ${pass} passed`);
