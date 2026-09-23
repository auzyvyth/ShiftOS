// Run: npm run test:modelkey
//
// The "live strings" block is copied verbatim from car_listings on
// 2026-09-05. They are the reason this resolver exists: 12 rows say
// "ALPHARD 2.5L" and 5 say "Alphard", and the marketplace model filter
// (CarListingPage.jsx:518, .ilike exact) shows a buyer only one group.
import { canonicalModel, keyOf, modelFilter, norm, resolveBrand } from '../src/utils/modelKey.js';

let pass = 0;
const fails = [];
function eq(actual, expected, label) {
  if (actual === expected) pass++;
  else fails.push(`${label}\n    expected: ${expected}\n    actual:   ${actual}`);
}
function key(brand, model) {
  const r = canonicalModel(brand, model);
  return r.matched ? r.key : 'MISS';
}

// --- the fragmentation this exists to fix -------------------------------
eq(key('Toyota', 'ALPHARD 2.5L'), 'toyota:alphard', 'trim suffix stripped');
eq(key('Toyota', 'Alphard'), 'toyota:alphard', 'bare name');
eq(key('Toyota', 'alphard 2.5'), 'toyota:alphard', 'lowercase + suffix');
eq(key('Toyota', 'ALPHARD 2.5L'), key('Toyota', 'Alphard'),
   'the two live Alphard spellings collapse to one key');

// --- live car_listings strings, verbatim --------------------------------
eq(key('Toyota', 'HARRIER 2.0L'), 'toyota:harrier', 'live: Harrier');
eq(key('Honda', 'CIVIC 2.0L(T) HATCHBACK'), 'honda:civic', 'live: bracketed turbo');
eq(key('Honda', 'Civic'), 'honda:civic', 'live: bare Civic');
eq(key('Toyota', 'Vellfire'), 'toyota:vellfire', 'live: Vellfire');
eq(key('Lexus', 'NX250 2.5L'), 'lexus:nx', 'live: trim glued to model');
eq(key('Lexus', 'NX250'), 'lexus:nx', 'live: glued, no suffix');
eq(key('Lexus', 'IS300 2.0L(T)'), 'lexus:is', 'live: two-letter model, glued');
eq(key('Lexus', 'IS'), 'lexus:is', 'live: bare two-letter model');
eq(key('Lexus', 'Rx350'), 'lexus:rx', 'live: mixed case glued');
eq(key('Lexus', 'RX350 2.4L(T)'), 'lexus:rx', 'live: glued + bracketed');
eq(key('Land Rover', ' Defender'), 'land-rover:defender', 'live: leading space');
eq(key('Toyota', 'vios'), 'toyota:vios', 'live: all lowercase');
eq(key('Toyota', 'GR Yaris'), 'toyota:yaris', 'live: prefixed performance badge');
eq(key('Subaru', 'BRZ'), 'subaru:brz', 'live: BRZ');
eq(key('Ferrari', '812'), 'ferrari:812', 'live: numeric model name');
eq(key('Ferrari', 'F8'), 'ferrari:f8', 'live: F8');
eq(key('Ferrari', 'Roma'), 'ferrari:roma', 'live: Roma');
eq(key('BMW', 'M4'), 'bmw:m4', 'live: M4');
eq(key('Chery', 'Tiggo 8'), 'chery:tiggo-8', 'live: two-word model');
eq(key('Lamborghini', 'Urus'), 'lamborghini:urus', 'live: Urus');
eq(key('Rolls Royce', 'Cullinan'), 'rolls-royce:cullinan', 'live: two-word brand');
eq(key('Mercedes-Benz', 'G63'), 'mercedes-benz:g-class', 'live: Mercedes-Benz alias + AMG badge');
eq(key('Alfa Romeo', 'Giulia'), 'alfa-romeo:giulia', 'Alfa Romeo (1 live listing)');

// --- generation codes fall through to chassisCodes.js -------------------
eq(key('Porsche', '992 GT3'), 'porsche:911', 'live: 992 is a 911');
eq(canonicalModel('Porsche', '992 GT3').via, 'chassis', 'resolved via the chassis table');
eq(canonicalModel('Toyota', 'Alphard').via, 'catalogue', 'resolved via the catalogue');

// --- JPJ-shaped strings (manufacturer-declared) -------------------------
eq(key('HONDA', 'CITY 1.5 S i-VTEC'), 'honda:city', 'jpj: variant tail');
eq(key('PERODUA', 'MYVI 1.5 AV'), 'perodua:myvi', 'jpj: Myvi');
eq(key('PROTON', 'SAGA 1.3 PREMIUM AT'), 'proton:saga', 'jpj: Saga');
eq(key('TOYOTA', 'HILUX 2.8 ROGUE'), 'toyota:hilux', 'jpj: Hilux');
eq(key('HONDA', 'CR-V 1.5 TC-P'), 'honda:cr-v', 'jpj: hyphenated model');
eq(key('HONDA', 'CRV 1.5'), 'honda:cr-v', 'jpj: hyphen dropped still matches');
eq(key('PROTON', 'GEN-2 1.6'), 'proton:gen-2', 'jpj: dead nameplate, hyphenated');
eq(key('PERODUA', 'KANCIL 850 EX'), 'perodua:kancil', 'jpj: dead nameplate');
eq(key('', 'HONDA CITY 1.5 S i-VTEC'), 'honda:city', 'jpj: brand glued into model column');
eq(key('Honda', 'HONDA CITY'), 'honda:city', 'brand repeated in both columns');

// --- must NOT match ------------------------------------------------------
eq(key('Toyota', 'Corolla Cross'), 'toyota:corolla', 'longest-first is scoped to the catalogue');
eq(key('Nonsense', 'Whatever'), 'MISS', 'unknown brand and model');
eq(key('Toyota', ''), 'MISS', 'empty model');
eq(key('Toyota', 'ZZZZZ 1.5'), 'MISS', 'unknown model on a known brand');
eq(canonicalModel('Toyota', 'ZZZZZ').brand, 'Toyota', 'a miss still reports the resolved brand');
eq(canonicalModel(null, null).matched, false, 'nulls do not throw');
eq(canonicalModel(undefined, undefined).key, null, 'undefined gives a null key');

// A two-letter model must not match mid-word.
eq(key('Lexus', 'PRISM'), 'MISS', 'IS does not match inside PRISM');
eq(key('Toyota', 'SUPRAX'), 'MISS', 'Supra does not match inside SUPRAX');

// --- catalogue gaps found by running this over live listings, now closed --
// Every one of these had real rows in car_listings and resolved to nothing.
eq(key('Toyota', 'CROWN SPORT'), 'toyota:crown', 'Toyota Crown (4 live listings)');
eq(key('Daihatsu', 'MOVE CANBUS'), 'daihatsu:move-canbus', 'Daihatsu Move Canbus (8 live listings)');
eq(key('Daihatsu', 'MOVE'), 'daihatsu:move', 'Move alone is not Move Canbus');
eq(key('Daihatsu', 'TANTO'), 'daihatsu:tanto', 'Daihatsu kei import');
eq(key('Toyota', 'CROWN'), 'toyota:crown', 'bare Crown');

// --- modelFilter: what the marketplace query actually sends --------------
// Counts verified against live car_listings on 2026-09-05: filtering
// Alphard returned 5 of 17, Civic 5 of 7, Lexus IS 1 of 3, and Lexus RX
// returned NOTHING at all because no row is stored as exactly "RX".
const mf = (b, m) => modelFilter(b, m);
eq(JSON.stringify(mf('Toyota', 'Alphard').like), '["Alphard%"]', 'Alphard prefix');
eq(mf('Toyota', 'ALPHARD 2.5L').model, 'Alphard', 'a stored spelling resolves to the canonical model');
eq(JSON.stringify(mf('Lexus', 'RX').like), '["RX%"]', 'RX matches RX350');
eq(JSON.stringify(mf('Honda', 'CR-V').like), '["CR-V%","CRV%"]', 'hyphen-dropped spelling included');
eq(JSON.stringify(mf('Daihatsu', 'Move').notLike), '["Move Canbus%"]',
   'Move excludes its longer sibling');
eq(JSON.stringify(mf('Daihatsu', 'Move Canbus').notLike), '[]',
   'the longer sibling excludes nothing');
eq(mf('Land Rover', 'Range Rover').notLike.length, 3, 'Range Rover excludes Sport/Velar/Evoque');
eq(mf('Nope', 'Zzz'), null, 'an unresolvable model returns null so the caller falls back');
eq(mf('Toyota', ''), null, 'empty model returns null');
eq(mf(null, null), null, 'nulls return null rather than throwing');
// A filter string is built from these, so a comma would break out of the
// PostgREST or() tree.
eq([...mf('Land Rover', 'Range Rover').like, ...mf('Land Rover', 'Range Rover').notLike]
     .some((p) => /[,()]/.test(p)), false, 'no filter-breaking characters in any pattern');

// --- helpers -------------------------------------------------------------
eq(norm('CIVIC 2.0L(T)'), 'CIVIC 2 0L T', 'norm collapses punctuation');
eq(norm('  CR-V  '), 'CR V', 'norm trims and collapses');
eq(norm(null), '', 'norm handles null');
eq(resolveBrand('mercedes benz'), 'Mercedes-Benz', 'brand alias');
eq(resolveBrand('merc'), 'Mercedes-Benz', 'short brand alias');
eq(resolveBrand('  toyota '), 'Toyota', 'brand is trimmed and case-insensitive');
eq(resolveBrand('Nope'), null, 'unknown brand is null');
eq(keyOf('Land Rover', 'Range Rover Sport'), 'land-rover:range-rover-sport', 'key slug shape');

if (fails.length) {
  console.error(`\n${fails.length} FAILED (${pass} passed)\n`);
  for (const f of fails) console.error('  x ' + f + '\n');
  process.exit(1);
}
console.log(`all passed (${pass} assertions)`);
