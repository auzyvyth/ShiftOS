// Guards for the VIN / chassis decode. The bugs these exist to catch are the
// ones that already shipped: a Decode button that was permanently disabled for
// every Japanese import, and a chassis table where a duplicated key silently
// dropped an earlier car (GP7 is both a Honda Shuttle and a Subaru XV — an
// object literal keeps only the last one, with no error anywhere).
// Run with: npm run test:chassis
import { readFileSync } from 'fs';
import { decodeChassis, isChassisCode, isMalaysianVin, generationYears } from '../src/utils/chassisDecode.js';
import { isLikelyVin } from '../src/utils/vinDecode.js';

let fail = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.log('FAIL', name, extra); fail++; } else console.log('ok  ', name);
};

// 1. No duplicate keys. A repeat is invisible at runtime, so read the source.
const src = readFileSync(new URL('../src/utils/chassisDecode.js', import.meta.url), 'utf8');
const keys = [...src.matchAll(/^ {2}([A-Z0-9]+):\s*\{ brand:/gm)].map((m) => m[1]);
const dups = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
check('no duplicate chassis keys', dups.length === 0, dups.join(', '));
check('table is populated', keys.length > 200, `${keys.length} entries`);

// 2. The recon codes a Malaysian dealer actually types, serial and all.
const cases = [
  ['FL5-1234567',     'Honda',      'Civic'],
  ['AGH30W-0123456',  'Toyota',     'Alphard'],
  ['ZVW30-1234567',   'Toyota',     'Prius'],
  ['RU3-1234567',     'Honda',      'Vezel'],
  ['GR3-1234567',     'Honda',      'Jazz'],
  ['C27-0123456',     'Nissan',     'Serena'],
  ['GDJ150W-0012345', 'Toyota',     'Prado'],
  ['AXUH80-0001234',  'Toyota',     'Harrier'],
  ['AGZ10-1000001',   'Lexus',      'NX'],
  ['CZ4A-0001234',    'Mitsubishi', 'Evo'],
  ['LA650S-0089301',  'Daihatsu',   'Tanto'],
  ['zn8-1234567',     'Toyota',     'GR86'],
];
for (const [code, brand, model] of cases) {
  const hit = decodeChassis(code);
  check(`decodes ${code}`, hit && hit.brand === brand && hit.model === model,
    hit ? `${hit.brand} ${hit.model}` : 'MISS');
}

// 3. A 17-char VIN must NEVER be taken for a chassis code, or it would skip the
//    NHTSA lookup that is the whole point of having one.
check('VIN is not a chassis code', !isChassisCode('WBAHF12090WW43378'));
check('VIN still passes isLikelyVin', isLikelyVin('WBAHF12090WW43378'));
check('chassis code is not a VIN', !isLikelyVin('FL5-1234567'));
check('chassis code recognised', isChassisCode('FL5-1234567') && isChassisCode('AGH30W-0123456'));
check('junk is neither', !isChassisCode('') && !isChassisCode('??') && !isLikelyVin('??'));

// 4. Malaysian-built VINs skip NHTSA (a US catalogue that has never held one).
check('Perodua VIN is Malaysian', isMalaysianVin('PM2M600S1L1234567'));
check('Proton VIN is Malaysian', isMalaysianVin('PL1BJ21A5KA123456'));
check('German VIN is not', !isMalaysianVin('WBAHF12090WW43378'));
check('Japanese VIN is not', !isMalaysianVin('JHMGE8850AS201234'));

// 5. European generation codes come from chassisCodes.js — one table, not two.
const g82 = decodeChassis('G82');
check('G82 resolves via chassisCodes', g82 && g82.brand === 'BMW' && g82.source === 'generation', JSON.stringify(g82));
const w205 = decodeChassis('W205');
check('W205 model is title-cased', w205 && w205.model === 'C-Class', w205 && w205.model);

// 6. Unknown input is a clean miss, never a wrong car.
check('unknown code misses', decodeChassis('QQQ999-1234567') === null);
check('empty misses', decodeChassis('') === null && decodeChassis(null) === null);

// 7. Every row is well formed, and no generation ends before it starts.
const rows = [...src.matchAll(/^ {2}[A-Z0-9]+:\s*\{ brand: '([^']+)', model: '([^']+)', from: (\d+), to: (null|\d+)/gm)];
check('every row parsed', rows.length === keys.length, `${rows.length}/${keys.length}`);
const badRange = rows.filter(([, , , f, t]) => t !== 'null' && Number(t) <= Number(f));
check('no inverted year ranges', badRange.length === 0, badRange.map((r) => r[2]).join(', '));
const badFrom = rows.filter(([, , , f]) => Number(f) < 1980 || Number(f) > new Date().getFullYear());
check('plausible start years', badFrom.length === 0, badFrom.map((r) => r[2]).join(', '));

// 8. The label under the field reads as a sentence, both shapes.
check('open-ended range', generationYears({ from: 2015, to: null }) === '2015 onwards');
check('closed range', generationYears({ from: 2013, to: 2020 }) === '2013-2020');
check('no range', generationYears({ from: null, to: null }) === '');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
