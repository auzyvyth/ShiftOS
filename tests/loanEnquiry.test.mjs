import assert from "node:assert/strict";
import { toLoanCar, carsThatFit, checkLoanEnquiry, loanResult, loanEnquiryNote, loanEnquiryWhatsApp, FLAG_COPY, OUTCOME_COPY } from "../src/utils/loanEnquiry.js";

const good = { earn: "salary", job: "gt12", confirmed: "confirmed", late: "none", ccris: "clean", history: "yes", pay: "RM 4,500", commit: "300", dep: 10, years: 7 };
const ok = checkLoanEnquiry(good);
assert.ok(ok.ok, JSON.stringify(ok.errors));
assert.equal(ok.answers.pay, 4500);
assert.equal(ok.answers.commit, 300);

// Unknown keys and junk values never reach the note.
const junk = checkLoanEnquiry({ ...good, earn: "<script>", extra: "hi", dep: 55, years: 30 });
assert.equal(junk.ok, false);
assert.equal(junk.errors.earn, "Pick one");
assert.equal(junk.answers.extra, undefined);
assert.equal(junk.answers.dep, 10, "unknown deposit falls back");
assert.equal(junk.answers.years, 7, "unknown term falls back");

// Probation is only asked of salaried buyers.
const biz = checkLoanEnquiry({ ...good, earn: "business", confirmed: undefined });
assert.ok(biz.ok, "business owner is not asked about probation");
assert.equal(checkLoanEnquiry({ ...good, confirmed: undefined }).errors.confirmed, "Pick one");

assert.ok(checkLoanEnquiry({ ...good, pay: "100" }).errors.pay, "pay floor");
assert.ok(checkLoanEnquiry({ ...good, pay: "" }).errors.pay, "pay required");
assert.equal(checkLoanEnquiry({ ...good, commit: "" }).answers.commit, 0, "commitments optional");

const car = { label: "2019 Perodua Myvi 1.5 AV", price: 45000, eir: 6.5 };
const clean = loanResult(ok.answers, car);
assert.equal(clean.outcome, "ready");
assert.ok(clean.monthly > 0);

const rough = checkLoanEnquiry({ ...good, late: "many", ccris: "notyet", pay: 2500, commit: 1400 }).answers;
const roughR = loanResult(rough, car);
assert.equal(roughR.outcome, "hold");
for (const f of roughR.flags) assert.ok(FLAG_COPY[f.key], `copy for ${f.key}`);

// No car: no instalment, so no pay-vs-loan flag.
const noCar = loanResult(rough, null);
assert.ok(noCar.flags.every((f) => !f.key.startsWith("dsr")));

const note = loanEnquiryNote(rough, car);
assert.match(note, /^Loan check: 2019 Perodua Myvi 1.5 AV \(RM 45,000\), 10% down, 7 years/);
assert.match(note, /Take-home RM 2,500, paying RM 1,400/);
assert.match(note, /To sort: Late 3\+ months/);
assert.ok(note.length < 4000, "fits buyer_message");
assert.match(loanEnquiryNote(ok.answers, null), /no car picked yet/);

// Never an approval, a score or a chance, anywhere the buyer reads.
const words = [
  ...Object.values(FLAG_COPY).flatMap((c) => [c.title({ pct: 70, deposit: 9000 }), c.fix({ pct: 70, deposit: 9000 })]),
  OUTCOME_COPY.ready, OUTCOME_COPY.fix(2), OUTCOME_COPY.hold,
  loanEnquiryWhatsApp(car, "Acme Motors"), loanEnquiryWhatsApp(null, ""),
].join(" ");
assert.ok(!/approved|pre-approv|guarantee|chance|score|eligible/i.test(words), "no approval words");
assert.ok(!/RM/.test(loanEnquiryWhatsApp(car, "Acme")), "no pay in the WhatsApp text");
assert.equal(loanEnquiryWhatsApp(car, "Acme Motors"), "Hi Acme Motors, I did the loan check on your site for the 2019 Perodua Myvi 1.5 AV. Can you help me with the next step?");
// Dealer rows: one helper prices them for sheet and server alike.
const rows = [
  { id: "a", year: 2019, brand: "Perodua", model: "Myvi", variant: "1.5 AV", selling_price: 45000 },
  { id: "b", year: 2021, brand: "Honda", model: "City", selling_price: 75000 },
  { id: "c", year: 2010, brand: "Toyota", model: "Vios", selling_price: 22000 },
  { id: "d", brand: "Proton", model: "X50", selling_price: 90000, is_model_card: true },
  { id: "e", brand: "Proton", model: "Saga", selling_price: 0 },
];
assert.equal(toLoanCar(rows[3]), null, "model card (a from price) is not a car to check");
assert.equal(toLoanCar(rows[4]), null, "no price");
const old = toLoanCar(rows[2], 2026);
assert.equal(old.maxYears, 1, "a 2010 car gets the short term banks give");
assert.match(loanEnquiryNote(ok.answers, old), /, 1 years$/m);
const fits = carsThatFit(rows, checkLoanEnquiry({ ...good, pay: 4000, commit: 300 }).answers, 4, 2026);
assert.deepEqual(fits.map((f) => f.car.id), ["b", "a"], "dearest first; the 2010 Vios on a 1-year term does not fit");
assert.equal(carsThatFit(rows, checkLoanEnquiry({ ...good, pay: 4000, commit: 300 }).answers, 1, 2026).length, 1, "max");
assert.deepEqual(carsThatFit(rows, { pay: 1000, commit: 900, dep: 10, years: 7 }), [], "commitments use the whole 35%");
console.log("loanEnquiry: all passed");
