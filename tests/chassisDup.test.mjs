// Run: npm run test:chassisdup. The screen's "same chassis" rule must equal the SQL index's.
import fs from 'fs';
import { normChassis, isChassisDupError, chassisDupMessage } from '../src/utils/chassisDup.js';

const fails = [];
let pass = 0;
const eq = (a, e, label) => { if (a === e) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };

eq(normChassis('ase30-0011130'), 'ASE300011130', 'lower + hyphen');
eq(normChassis(' ASE30 0011130 '), 'ASE300011130', 'spaces');
eq(normChassis(null), '', 'null');
eq(normChassis('WVWZZZ1KZCW342943'), 'WVWZZZ1KZCW342943', '17-char VIN untouched');

const err = { code: '23505', message: 'duplicate key value violates unique constraint "car_listings_one_live_chassis"',
  details: 'Key (dealer_id, upper(regexp_replace(vin_number, \'[^A-Za-z0-9]\'::text, \'\'::text, \'g\'::text)))=(1e7bf24e-5b71-4c64-8d03-b60db5e59316, AGH400014223) already exists.' };
eq(isChassisDupError(err), true, 'detects the index');
eq(isChassisDupError({ code: '23505', message: 'car_listings_slug_key' }), false, 'other unique key ignored');
eq(chassisDupMessage(err).includes('AGH400014223'), true, 'names the chassis');
eq(chassisDupMessage({ code: '23505' }).includes('this number'), true, 'no detail still readable');

// The SQL index must use the same normalisation and leave out the same statuses.
const sql = fs.readFileSync(new URL('../supabase/migrations/20261127a_one_live_chassis.sql', import.meta.url), 'utf8');
eq(sql.includes("upper(regexp_replace(vin_number, '[^A-Za-z0-9]', '', 'g'))"), true, 'SQL normalisation');
eq(sql.includes("status not in ('archived', 'sold', 'rejected')"), true, 'SQL excluded statuses');

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`chassisDup: ${pass} passed`);
