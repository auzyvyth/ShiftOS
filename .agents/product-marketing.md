# Product Marketing Context

**Document version:** v1 (draft, owner review pending)
**Last updated:** 2026-10-17

> Drafted from the live site copy (`src/config/salesmanLandingCopy.js`,
> `src/config/featurePagesCopy.js`, `src/utils/plans.js`, `src/utils/planConfig.js`),
> CLAUDE.md product rules and a read-only DB count on 2026-10-17.
> Lines marked **[OWNER]** are guesses or gaps only the owner can fill.

## Brand rules every skill must follow
- The brand is **Drevo** (domain `drevo.my`). Never write "XDrive" in new copy: it is being retired because it collides with BMW's xDrive.
- Don't write "ShiftOS" in new copy either. What the dealer software gets called is still an open owner call.
- Never hardcode a domain in code. Copy may say "drevo.my" only once switch day has happened. **[OWNER]: has it?**
- Don't use emojis.

## Product Overview
**One-liner:** A free page and lead list for Malaysian car salesmen, plus a live-selling tool that answers "monthly berapa?" in one tap.
**What it does:** A salesman lists their cars once. Each car goes on their own page (`/s/theirname`) and on the Drevo marketplace. Buyers reach them by WhatsApp, in-app chat or a viewing booking, and every enquiry becomes a lead with a stage. Premium adds the tools for working those leads and selling on TikTok or Facebook Live: an instalment screen for every car, follow-up reminders, a call log, a handover checklist and performance numbers.
**Product category:** How sellers search for it: "app salesman kereta", "kalkulator ansuran kereta live", "CRM salesman kereta". How buyers search for it: "used cars Malaysia", "kereta terpakai".
**Product type:** Two-sided. A buyer marketplace (free to buyers) plus SaaS seller tools.
**Business model:**
- Salesman Lite: RM0 forever, up to 10 live cars.
- Salesman Premium: RM35 a month, up to 30 cars. The first month is free with no card, and nothing bills automatically. Unpaid, the account drops back to Lite and keeps its cars and leads.
- Dealer plans: Starter RM299 (14-day trial), Growth RM599, Pro RM1,199, Group RM2,999 a month.
- Payment today is manual, logged by the owner. There is no payment gateway.

## Target Audience
**Primary (where the effort goes now):** Independent and freelance used-car salesmen/agents in Malaysia, especially those selling on TikTok and Facebook Live. Phone-first and Malay-first, working out instalments for viewers by hand.
**Secondary:** Brand new-car sales advisors (Proton, Perodua, Toyota) who sell at brand-set prices.
**Later:** Used-car dealerships (stock P&L, team CRM, handover). The owner said dealer work is "a later job".
**Buyers:** Malaysian used-car buyers browsing the marketplace. Buyers are free; they make the seller side worth paying for.
**Decision-maker:** The salesman themself. It's a one-person buying decision, paid out of their own pocket.
**Jobs to be done:**
- "Answer 'monthly berapa?' on a live without stopping to redo the maths."
- "Look established: one link with all my stock instead of forwarding photos car by car."
- "Don't lose the buyer who messaged at 11pm because I replied too late."
**Use cases:**
- Running a TikTok live with every car numbered #1, #2, #3 and the 9/7/5-year monthlies ready.
- Sharing one bio link in WhatsApp status, TikTok and Instagram.
- Working through a morning list of who to follow up with today.
- Taking a won deal through Puspakom, JPJ transfer and road tax without missing a step.

## Personas
B2C-shaped: the user, buyer and payer are one person.

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| Live-selling salesman | Closing on stream, looking pro | Retyping an instalment poster per car; redoing maths while the live waits | Every car is a ready screen; change the deposit with one tap |
| Lot/freelance agent (no live) | Being found, not losing leads | Leads scattered across 40 WhatsApp chats | One page, one lead list, an alert per buyer |
| New-car advisor | Showing the right zone price | Brochure prices, many variants | A card per variant, priced from the official list for their zone |

## Problems & Pain Points
**Core problem:** A salesman's selling happens in WhatsApp and on live streams, but none of it is organised. Instalments get worked out by hand per car, and buyers go cold in a chat list.
**Why alternatives fall short:**
- Carlist/Mudah: a listing is an ad, not the salesman's own page or lead list. **[OWNER]: confirm what they charge sellers today.** Earlier copy wrongly implied they charge per listing.
- Spreadsheet or Canva instalment posters: retyped for every car, wrong the moment a viewer asks for a different deposit, and often built on the flat rate the new HP law abolished.
- WhatsApp alone: no stages, no follow-up reminder, no record of who was never answered.
**What it costs them:** Deals lost to the agent who replied first, and dead air on a live while the maths gets redone.
**Emotional tension:** Looking amateur next to dealers. Worry about putting their phone number on a public stream (TikTok can strike a live for it).

## Competitive Landscape
**Direct:** Carlist, Mudah (car classifieds): good for reach, but the listing belongs to the platform and there's no CRM or live tool. **[OWNER]: the others you know of?**
**Secondary:** SA Studio X (an instalment-poster app for salesmen, IDEA-18). It answers the poster job only, with no page, leads or marketplace.
**Indirect:** A Canva poster plus a calculator plus WhatsApp. It's free and familiar, but slow, error-prone and leaves no record.
**Rule:** The landing page never names a competitor (owner, 2026-10-06). Compare against the salesman's own routine ("by hand").

## Differentiation
**Key differentiators:**
- Live presentation builds the instalment screen for every listed car: 9/7/5-year monthlies, deposit chips, budget mode, rebate for this live only, and a docs list.
- Instalments use the reducing balance (EIR), as required since the HP (Amendment) Act 2026. A flat rate the bank quotes is converted.
- Your number is hidden by default. Buyers reach you through a name step and you get the lead.
- Leads aren't resold or shared with other agents. The enquiry is yours.
- Lite is free and stays free.
**Why customers choose us:** **[OWNER]: what did the 5 current sellers actually say when they signed up?**

## Objections
| Objection | Response |
|---|---|
| "I already use Mudah/Carlist" | Keep them. Drevo works alongside them: your own page, plus the marketplace. |
| "RM35 every month?" | The first month is free with no card, and nothing bills automatically. Unpaid means back to Lite, and nothing is lost. |
| "Will my phone number be everywhere?" | No. It isn't printed on any public page, and on live it shows only when you tap. |
| "Why isn't my car live yet?" | Every salesman car is checked before it goes public. Never promise "live instantly". |

**Anti-persona:** Bulk importers wanting auto-posting everywhere. Anyone after Sambung Bayar or other loan-takeover deals (illegal under s.38 HP Act 1967). Sellers wanting AI to message buyers for them.

## Switching Dynamics
**Push:** Retyping posters, dead air on lives, buyers lost in WhatsApp.
**Pull:** One tap answers "monthly berapa?", a page that looks established, and it's free to start.
**Habit:** Canva templates and the calculator app they already know, plus WhatsApp as the CRM.
**Anxiety:** "Another app to learn", "will it bill me", "is my number safe", "is anyone actually browsing this marketplace".

## Customer Language
**How they describe the problem:**
- "Monthly berapa?" (the question viewers type)
- **[OWNER]: real phrases sellers have said to you, in BM or English, word for word**
**Words to use:** lead, follow up, page, booking, live, WhatsApp, monthly, deposit, loan, "Anda". These are the English words Malaysian salesmen use inside BM.
**Words to avoid:**
- Stiff Dewan BM, and "bro".
- "Verified" or "inspected" for anything a person didn't check.
- "Authorised" or "official agent" for new-car advisors.
- "Approval" when talking about affordability.
- Any income figure.
- "Live the moment you publish".
**Glossary:**

| Term | Meaning |
|---|---|
| Lite | Free salesman plan: get found, get the lead |
| Premium | RM35/mo: work the lead + Live presentation |
| Live presentation | The on-stream instalment screen, one car per screen |
| Mini page / agent page | `/s/<slug>`, the salesman's own page |
| EIR | Effective interest rate on the reducing balance, the legal basis since 2026 |
| Handover | The 8-step post-sale checklist (Puspakom, JPJ, road tax...) |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line (live copy) |
|---|---|---|---|
| Talks like a salesman | Their words, their moments (8am at the lot, 11pm message) | Slang, "bro" | "A buyer asks about a car at 11pm. You mean to reply in the morning." |
| Plain and concrete | Says what happens, in order | Hype, stock adjectives | "Tap the deposit, every monthly updates." |
| Honest about limits | States the rule and the catch | Hedging everything | "Estimates only, the bank decides." |
| Malay first | Opens in BM, English one tap away | Machine-translated BM | "Monthly berapa? Satu tap. Semua kereta." |

**Tone by context:** Sales: short and concrete, with one claim per line. Errors: say what happened and what to do. Never invent a number in an AI draft.
**Never use (and why):**
- "XDrive" (retiring, clashes with BMW).
- Invented RM figures, income claims, or promises of loan approval: consumer protection.
- "Verified" without a human check.

## Proof Points
**Metrics (live DB, 2026-10-17), internal only and too small to publish:** 5 standalone sellers (all on the free month), 2 dealers, 53 live cars, 147 leads, 20 won deals, 29 buyer chats, 0 logged subscription payments.
**Customers:** Example public page `/s/premiummotors` (the owner's own demo account).
**Testimonials:** None yet. **[OWNER]: can any of the 5 sellers give a quote?**
**Rule:** Don't publish user counts or "trusted by X sellers" until the numbers are worth saying.

## Goals
**Business goal:** First paying Premium sellers. Store/app work is paused until there is revenue.
**Conversion action:** Sign up for Premium's free month (or Lite) from `/for-salesmen`. Then list a first car and reply to a first lead.
**Current metrics:** 0 payments. Activation is the gap: 46 of 68 open leads were never contacted (TODO PREM-5).

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-13 | Lite = get found + get the lead; working the lead is Premium | Owner decision | Plans, landing, upgrade copy | active |
| 2026-10-13 | Landing opens in BM, English one tap away | Owner decision | All seller-facing copy | active |
| 2026-10-06 | Compare against the salesman's own routine, never a named platform | Owner decision | Landing, ads | active |
| 2026-10-06 | Lead the seller page with Live presentation (Premium); Lite is the free way in | Owner decision | /for-salesmen | active |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-10-17): Initial context, auto-drafted from site copy and a DB count; owner gaps marked [OWNER].
