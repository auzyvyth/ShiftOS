// Axia 1.0 AV numbers from the app's own maths (same inputs as the presenter).
import { monthlyPayment } from '../../../../src/utils/financing.js';
import { motorPremium } from '../../../../src/utils/motorInsurance.js';
const price = 49000, rebate = 0, eir = 4.8;
const net = price - rebate, ins = motorPremium({ sumInsured: net, cc: 998, ncd: 0, region: 'west' }).total;
const out = { price, ins };
for (const dep of [0, 4900]) {
  const loan = net + ins - dep;
  out[dep] = { loan, m: Object.fromEntries([9, 7, 5].map((y) => [y, Math.round(monthlyPayment(loan, eir, y * 12))])) };
}
console.log(JSON.stringify(out));
