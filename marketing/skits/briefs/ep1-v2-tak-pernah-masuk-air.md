# Episode 1 (v2): Tak Pernah Masuk Air (about 27 s)

Series: buyers' tricks, exposed by Abang Jo. Rewritten 2026-11-22 for the new cast (Bos Zack replaces
Tauke Lan; Mak Som added). Replaces `ep1-kereta-banjir.md` once the owner approves it.

**The trick:** a flood-damaged car sold as "never been in water".
**The lesson (3 checks anyone can do):** 1) a damp, musty smell inside, 2) mud or silt under the carpet,
3) mist or a water line inside the headlamps. Common signs only, not a full inspection.
**Ending rule:** never say or hint that Drevo checks cars (it does not). The ending is "check first" + follow.

## Cast in this episode
- **Faiz**: buyer, over-excited. **Mak Som**: his mum, says two words and wins. **Abang Jo**: Faiz's friend, the
  Drevo salesman, came along to help. **Bos Zack**: sells the car on his own lot (no Drevo branding anywhere on it).

## Set
Bos Zack's used-car lot (`lot()` in `tools/sets.mjs`): bunting, a hand-painted price board, the red Myvi.

## Script
Tags go right before the word they land on (`tools/perform.mjs`): eyes, mouth, arms, extras.
Shots: WIDE = everyone, full body. CLOSE = one character, waist up. PHOTO = a real photo, poster filter.

| # | Time | Shot | Who | Line (BM, with acting tags) | English | Caption |
|---|---|---|---|---|---|---|
| 1 | 0.0-2.2 | WIDE | Faiz | `{stars}{grin}{bothUp}Mak! Myvi ni {point}RM19 ribu je!` | Mum! This Myvi is only RM19k! | Mak! **RM19 ribu** je! |
| 2 | 2.4-5.0 | CLOSE Zack | Bos Zack | `{sly}{grin}{armOut}Tip-top, bang. {wink}{smirk}Tak pernah masuk air. {neutral}Sumpah.` | Tip-top, bro. Never been in water. I swear. | Tak pernah **masuk air** |
| 3 | 5.0-6.0 | CLOSE Mak | Mak Som | (silent) `{squint}{frown}` slow look at Zack | (silent stare) | |
| 4 | 6.2-8.4 | WIDE | Abang Jo | `{suspicious}{closed}{armOut}Jap. {point}Bagi saya check {pointUp}tiga benda.` | Hold on. Let me check three things. | Check **tiga benda** |
| 5 | 8.6-9.8 | CLOSE Zack | Bos Zack | `{side}{wavy}{sweat}Eh... check apa lagi, bos...` | Eh... what's there to check, boss... | |
| 6 | 10.0-12.0 | PHOTO interior + Faiz head | Faiz | `{squint}{grimace}{green}Ueekk... bau hapak!` | Eww... it smells musty! | Bau **hapak** |
| 7 | 12.0-13.6 | PHOTO interior | Abang Jo (voice) | `{neutral}{talk}Satu. {point}Bau lembap.` | One. A damp smell. | **1** Bau lembap |
| 8 | 13.8-15.8 | PHOTO carpet lifted | Abang Jo (voice) | `{point}Dua. Selak karpet... {shock}ada lumpur.` | Two. Lift the carpet... there's mud. | **2** Lumpur bawah karpet |
| 9 | 15.8-16.8 | CLOSE Faiz | Faiz | `{shock}{scream}{headHands}LUMPUR?!` | MUD?! | **LUMPUR?!** |
| 10 | 17.0-19.4 | PHOTO headlamp | Abang Jo (voice) | `{pointUp}Tiga. Lampu berembun, {point}ada garis air.` | Three. Misty lamps, a water line inside. | **3** Garis air dalam lampu |
| 11 | 19.6-21.0 | CLOSE Zack | Bos Zack | `{nervous}{wavy}{sweat}{shrug}Itu... embun pagi.` | That's... morning dew. | Itu... **embun pagi** |
| 12 | 21.2-22.8 | CLOSE Mak | Mak Som | `{angry}{closed}{armOut}Faiz. {neutral}Balik.` | Faiz. We're leaving. | Faiz. **Balik.** |
| 13 | 22.8-23.6 | WIDE | (all) | Faiz drops his arms, walks off after Mak; Zack `{cry}{wail}` reaches out | (silent) | |
| 14 | 23.8-27.0 | CLOSE Jo | Abang Jo | `{happy}{grin}Beli kereta terpakai, {point}check dulu. {wink}{smirk}Follow untuk tip lagi!` | Buying used? Check first. Follow for more tips! | **Check dulu.** |

Pacing check (STYLE.md): no gap over 0.6 s between lines; a cut about every 2-3 s; the background pans slowly
all the time; listeners blink. Punchlines (9, 11, 12) are CLOSE shots.

## Real photos needed (no photo = no shot)
All must be ours or a seller's with their OK (never a maker's press photo in a posted video).
1. **The car, outside**: a red Myvi, side view, on an open lot or roadside (the hero car; the owner's own if possible).
2. **Interior from the open driver's door**: seats + floor carpet visible.
3. **Carpet lifted**: the floor mat / carpet pulled back with dirt or dried mud underneath (can be staged with soil).
4. **Headlamp close-up**: mist or droplets inside the lens (a lamp with condensation; can be staged).
5. Optional: **rusty seat rail bolts** (a 4th sign for a longer cut).

## Voice
Owner records all four voices or friends do one each. Read each line inside its time window, a bit fast.
Mak Som's two words are the punchline: slow, flat, no shouting.

## After approval
1. Photos in (list above), poster filter (`tools/toon.py`). 2. Voice recorded. 3. Animate (`tools/ep1.mjs` updated to
v2: new cast, these timings, lip-sync from the voice).
