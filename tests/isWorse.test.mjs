// Run: npm run test:isworse. When a dealer number turns red on Overview and Revenue.
import { isWorse } from '../src/utils/isWorse.js';

const cases = [
  [-5, null, true, 'below zero is red with nothing to compare'],
  [-5, -10, true, 'below zero is red even if it was worse before'],
  [0, 0, false, 'zero after zero is not a fall'],
  [100, 200, true, 'lower than the period before'],
  [200, 100, false, 'higher than the period before'],
  [100, 100, false, 'same as before'],
  [100, null, false, 'nothing to compare'],
  [100, 0, false, 'before was zero: no fall'],
  [0, 50, true, 'nothing this period after something before'],
  [null, 50, false, 'still loading is never red'],
  ['', 50, false, 'empty is never red'],
  ['x', 5, false, 'not a number is never red'],
];
let pass = 0;
const fails = [];
for (const [v, b, want, label] of cases) (isWorse(v, b) === want ? pass++ : fails.push(`${label}: isWorse(${v}, ${b}) gave ${!want}`));
console.log(`isWorse: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
