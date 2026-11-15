// Run: npm run test:brokercredit
// Guards BROKER-1 (src/utils/brokerCredit.js): who the dealer's screens say owns a broker's lead.
import { creditForLead, leadPhone } from '../src/utils/brokerCredit.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (JSON.stringify(a) === JSON.stringify(e)) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };

const NOW = new Date('2026-11-16T00:00:00Z').getTime();
const brokers = [{ broker_id: 'bA', name: 'Aiman' }, { broker_id: 'bB', name: 'Nurul' }];
const reg = (over) => ({ buyer_phone: '60123456789', broker_id: 'bA', broker_name: 'Aiman', status: 'registered', registered_at: '2026-11-09T06:00:00Z', hold_until: '2026-11-23T06:00:00Z', ...over });

eq(leadPhone({ phone: '012-345 6789' }), '60123456789', 'local number');
eq(leadPhone({ phone_norm: '60123456789' }), '60123456789', 'normalised number');
eq(leadPhone({}), '', 'no number');

eq(creditForLead({ salesman_id: 'bA', phone: '0111111111' }, { brokers, now: NOW })?.owner, { brokerId: 'bA', name: 'Aiman', via: 'page' }, 'page link credits the broker');
eq(creditForLead({ salesman_id: 'tm1', salesman_profile: { full_name: 'Sam' } }, { brokers, now: NOW }), null, 'a team salesman is not a broker');
eq(creditForLead({ salesman_id: null, assigned_to: null }, { brokers, now: NOW }), null, 'unassigned stays unassigned');
eq(creditForLead({ salesman_id: 'zzz' }, { brokers: [], now: NOW })?.owner, { brokerId: 'zzz', name: null, via: 'page' }, 'unknown outside seller (manager view)');

eq(creditForLead({ salesman_id: null, phone: '012-345 6789' }, { brokers, regs: [reg()], now: NOW })?.owner, { brokerId: 'bA', name: 'Aiman', via: 'registration' }, 'registered buyer, no page link');
eq(creditForLead({ salesman_id: null, phone: '0123456789' }, { brokers, regs: [reg({ hold_until: '2026-11-10T00:00:00Z' })], now: NOW }), null, 'an expired hold is no claim');
eq(creditForLead({ salesman_id: null, phone: '0123456789' }, { brokers, regs: [reg({ hold_until: '2026-11-10T00:00:00Z', status: 'sold' })], now: NOW })?.owner?.brokerId, 'bA', 'a sold registration stays a claim');

const clash = creditForLead({ salesman_id: 'bB', phone: '0123456789' }, { brokers, regs: [reg()], now: NOW });
eq(clash.conflict, true, 'two brokers: conflict');
eq(clash.owner, { brokerId: 'bA', name: 'Aiman', via: 'registration' }, 'registration beats the page link');
eq(clash.page.brokerId, 'bB', 'the page broker is still named');
eq(creditForLead({ salesman_id: 'bA', phone: '0123456789' }, { brokers, regs: [reg()], now: NOW }).conflict, false, 'same broker both ways is no conflict');

const two = creditForLead({ salesman_id: null, phone: '0123456789' }, { brokers, regs: [reg({ broker_id: 'bB', broker_name: 'Nurul', registered_at: '2026-11-12T00:00:00Z' }), reg()], now: NOW });
eq(two.owner.brokerId, 'bA', 'the earliest registration holds');

if (fails.length) { console.error(fails.join('\n')); console.error(`FAILED ${fails.length}, passed ${pass}`); process.exit(1); }
console.log(`brokerCredit: ${pass} passed`);
