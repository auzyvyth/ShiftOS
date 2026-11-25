# Premium tour ad (owner's brief, 2026-11-25): script, gate 2

JOINED as ONE shot (owner, 2026-11-25: "no cut offs"): `Tour-ms` / `Tour-en`, 54 s, src/tour. The Drevo logo, a map of the five
parts around it, then for each part: outline, glide in (the node IS the clip), play, glide back out. One music bed under
all of it (make-audio-tour.py), each clip's own effects laid in. Red chapter cards are gone: the outline does their job.
Not in it yet: scene 5 (views by social platform). End card has no price on purpose (founding-price wording).

Order from the owner: dashboard (done) -> dealer stock as a broker -> mini page -> live presentation ->
views from social media -> loan check sent to the buyer on WhatsApp -> the buyer's loan page.
Look: the dark 3D world of the dashboard pan (owner's reference). Every topic change = a hit on a downbeat
(112.5 bpm grid, one timing file per scene). Sample data, labelled. About 55 s.

| # | Time | Picture (real screen, harness) | BM headline | EN headline | Status |
|---|---|---|---|---|---|
| 1 | 0-10 s | Premium Dashboard in 3D, camera box to box | Berapa orang *tekan WhatsApp.* ... | How many *tapped WhatsApp.* ... | BUILT (DashPan) |
| 2 | 10-18 s | Premium "Dealer stock" tab: a dealer's cars on your page, register a buyer | Jual stok dealer, *dari page anda.* | Sell dealer stock *from your page.* | BUILT (BrokerScene). Sample dealer, example commissions RM 300-500; the tab is English in the app |
| 3 | 18-25 s | The Premium mini page /s/<slug> (banner, cars, budget finder) | Satu link, *semua kereta anda.* | One link, *all your cars.* | BUILT (MiniScene). The page is English in the app except a few lines |
| 4 | 25-33 s | Live presentation: #N, monthly rolling, deposit chips | Kira *depan penonton.* | Work it out *live.* | BUILT (LiveScene), takes re-recorded at 3x |
| 5 | 33-40 s | Analytics > by platform (TikTok / Facebook / WhatsApp / shared link) | Tahu pembeli datang *dari mana.* | Know where buyers *come from.* | NOT BUILT |
| 6 | 40-51 s | Loan check -> what to fix -> documents -> WhatsApp -> buyer opens their loan page | Semak dulu, *sebelum bank.* ... | Check first, *before the bank.* ... | BUILT FIRST (LoanScene) |
| 7 | 51-55 s | Logo, "Cuba Premium 7 hari percuma", RM35/bulan (founding price, planConfig.js) | Cuba Premium *7 hari percuma.* | Try Premium *free for 7 days.* | NOT BUILT |

## Flags for the owner (decide before scenes 2 and 6 ship)
A. **Brokers: settled (owner, 2026-11-25).** The owner's own dealer account holds 208 live cars with two brokers
   connected, so a seller who joins finds real stock. Open: rename the dealer from "XDRIVE"; never a fake "was" price.
B. **Scene 6 is two steps in the app, shown as one flow.** The loan check's own WhatsApp message is the
   document list (text, real). The LINK to the buyer's loan page is sent from the bank application that the
   loan check opens ("Start the bank application" -> "Share with buyer"). The scene shows both messages, so
   it promises nothing the app does not do.
C. **The buyer's loan page is English only** (src/pages/LoanSharePage.jsx is not translated). The BM cut shows
   it in English. Translate the page first if the BM ad should show BM.
D. **Dark world vs STYLE.md's 60% white.** Every scene so far follows the dark reference; STYLE.md says white
   room + red floor. Owner's call; switching later means re-grading every scene.
E. Loan wording: never approval, never a score. The scene says "the bank decides" (the app's own line).
