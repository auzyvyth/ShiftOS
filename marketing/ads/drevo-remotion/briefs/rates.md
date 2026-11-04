# Daily post 1: "Bank sebut 6.44%. SA sebut 3.5%. Siapa betul?"

Plan doc: https://claude.ai/artifact/ExWtGsWYvwHH7c2JvNAupS (open loop: answer ~10 s before the end).
30 s, one topic, so one chapter card only: the drumroll before the answer.

| Time | Beat | Picture (real presenter, harness/rates.cjs) |
| --- | --- | --- |
| 0-3 | Hook | Question over the presenter, blurred so no number shows |
| 3-7 | Stakes | Two real monthlies for the same car, RM 2,188 vs RM 2,413 (rate hidden) |
| 7-11 | Clue 1 | 3.5% typed on EIR, ring on "3.5% EIR", ring on the app's "looks like a flat rate" warning |
| 11-15 | Clue 2 | Fresh hook "Tapi itu bukan jawapannya", what flat and EIR mean |
| 15-19.25 | Clue 3 | Adjust > Financing on flat, ring on "7 thn 6.44%" |
| 19.25-20 | Card | "Jadi, siapa betul?" |
| 20-26 | Answer | 3.5% flat and 6.44% EIR, both RM 2,413 |
| 26-30 | CTA | "Komen SETUP", free setup, 10 minutes |

Facts: `flatToEir(3.5, 84)` = 6.442 (`src/utils/financing.js`). RM 225 = 2,413 - 2,188, both app output for
the sample GR86 (RM175k, 10% deposit, 7 years). Law: Hire-Purchase (Amendment) Act 2026 in force 1 June 2026
(motorist.my, NST). "Contoh kadar" on screen: 6.44% is an example bank rate.
