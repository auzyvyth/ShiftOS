# Drevo ad animation style

How a Drevo ad MOVES and SOUNDS. How it looks is `DESIGN.md`. Rules in short: `STYLE.md`.
Every number below is from the code of the two finished ads, with the file to check it in.

---

## 1. Why it moves the way it does

- **People watch on a phone, through TikTok's compression.** Fast or small motion smears into mush.
  So moves are big, slow to settle, and one at a time.
- **Retention is about 10%.** Most viewers leave before second 6. The first 5 s must carry the whole
  sale (the problem, the payoff, the offer), and the motion must say "something is happening" at frame 0.
- **The reference videos the owner picked** (2026-11-02): shapes with soft shadows, slow ambient light,
  one element at a time, big type. That is the house style. Taste comes second to it.

## 2. Principles

1. **One thing moves at a time.** The headline lands, then the stage object, then the detail
   (ring, tap). Never two entrances on the same beat.
2. **Things land with a spring, they don't slide in on a line.** Overshoot is small and settles fast.
3. **Words come out of a blur.** Each word rises, unblurs and scales up into place. That is the
   signature move of the headline.
4. **The room is always alive.** The light pools drift for the whole ad, so even a still frame breathes.
5. **Topics change with a hard cut, never a fade.** A red chapter card fills the frame at once.
6. **Every visible beat has a sound, and nothing unseen makes one.** A tap clicks, a card hits, a
   notification dings. Cues that fall under a chapter card are dropped.
7. **Slow and large beats fast and small.** If in doubt, make it bigger and give it more time.

## 3. Timing

| Thing | Duration | Source |
|---|---|---|
| A scene | 3-5 s (the first feature after the hook up to 9 s) | `src/timeline.json` |
| Chapter card | 0.75 s | `timeline.json` `card` |
| Scene clock under its card (`pre`) | 0.2-0.6 s | Scene is already built when the card cuts away, so no empty frame |
| Exit past the cut | scene length + 0.4 s | The exit finishes under the next card, never on screen |
| Headline exit | 0.3 s, starts 0.4 s before the scene ends | `Headline out` |
| Silence before the CTA | 0.35 s | `make-audio*.cjs` `silence` |
| CTA end card | 3.5-3.75 s | Long enough to read the price line twice |

**One timing file per ad, read by picture AND sound** (`src/timeline.json`, `src/renewals/timeline.json`).
Never type a scene time anywhere else: the two drift, and a sound lands on the wrong frame.

## 4. Motion vocabulary

Easing curves (`src/lib.js`):
- `ease` = `cubic-bezier(0.22, 1, 0.36, 1)`, a strong ease-out. Use it for anything travelling to a stop.
- `easeIO` = `cubic-bezier(0.65, 0, 0.35, 1)`. Use it for camera-like moves that start and stop.
- `pop(frame, at, fps, cfg)` = a Remotion spring, default `damping 13, stiffness 140, mass 0.7`.

| Move | What it does | Values | Where |
|---|---|---|---|
| **Word pop** | Each headline word rises, unblurs, scales in | spring default, words staggered **0.065 s**, rise 70 px, blur 16 px to 0, scale 0.9 to 1, opacity x1.4 (full before the spring settles). Red words get a soft red glow | `Headline`, `src/ui.jsx:50` |
| **Word exit** | Words lift and blur away | 0.3 s, blur up to 18 px, rise 50 px + 6 px per word | `Headline` `out` |
| **Instant headline** | The hook's words are there at frame 0, red words pulse once (7%) | `instant` prop | `Presenter.jsx:84` |
| **Rise** | The stage object comes up into place | spring default, from 90 px down, scale 0.94 to 1 | `Rise`, `Renewals.jsx` |
| **Card slam** | Chapter topic drops in from big | spring `14 / 260 / 0.6`, scale 1.3 to 1. "Now:" fades in over 0.12 s and rises 24 px. The big number drifts from 1.08 to 1 over the whole 0.75 s | `src/scenes/Card.jsx` |
| **Notification drop** | A phone notification falls in from above | spring `15 / 170`, from -140 px, scale 0.92 to 1 | `Hook`, `Renewals.jsx` |
| **Ring** | Points at one real element | 0.35 s `ease`, scale 1.25 to 1, 5 px red line + red glow | `Ring`, `Renewals.jsx` |
| **Tap** | A cursor travels to a button and presses it | travel 0.65 s `ease` with a slight arc, press = scale 0.82 for 0.12 s, then a red ripple ring that grows 0.3 to 1.4 and fades over 0.5 s | `Cursor`, `src/ui.jsx:110`; `Tap`, `Renewals.jsx` |
| **Light pools** | The room's slow light | wall pool: sin/cos of t at 0.35 / 0.27, 260 px / 120 px travel; floor pool: sin(t x 0.3), 300 px | `Ambient`, `src/ui.jsx:27` |
| **Idle life** | A card that sits still a while sways a little | rotate sin(t x 1.4) x 0.6 deg | leads card, `Features.jsx:45` |
| **Scan** | The cut-out reveals top to bottom with a light line | white line with a red glow | Studio, `Features.jsx:183` |
| **CTA build** | End card lines come in one by one | at 0.05 / 0.25 / 0.8 / 1.1 / 1.5 s; a red flash from 55% to 0 over 0.35 s on the cut; the button pulses 3% once a second after 2.2 s | `Cta`, `Features.jsx:326` |
| **Scene exit** | The stage object fades and blurs as the scene ends | blur up to 10 px | most `Features.jsx` scenes |

Choosing a move:
- Something **arrives**: Rise (objects) or Word pop (text).
- Something **matters inside a screen**: Ring. Ring one thing per scene.
- The viewer should **see an action**: Tap, aimed at the real button's measured position, never a guess.
- The **topic changes**: Card. The same topic continuing (hook into the next beat): no card, a whoosh,
  and the next headline (renewals: "Your buyer's road tax..." into "They forgot. Drevo didn't.").

## 5. Cuts and chapter cards

- A **red chapter card at every topic change** (owner, 2026-11-03): full red, "Now:" / "Sekarang:" +
  the topic in 1-3 words, the chapter number big behind. Hard cut in, hard cut out.
- The next scene's clock starts **under the card** (`pre`), so the scene is already built when the card
  cuts away. A scene that fades in after a card looks empty for a beat.
- Card topics are nouns or short verb phrases: "Lead tracking", "Sales coach", "Dates fill themselves".
  A card may change "Now:" for a time word ("Next year:").
- Nothing fades between topics, ever.

## 6. Sound

All original, made by `score.py` (numpy synth, no licensed music, no voice-over). Cues are built from
the timing file and the measured taps by `make-audio.cjs` (Premium ad) and `make-audio-renewals.cjs`.

| What happens | Sound | Notes |
|---|---|---|
| A headline word lands | `pop`, gain 0.6, one per word, 0.065 s apart | Count the words per language: BM and EN differ |
| Stage object lands | `pop`, gain 0.7-0.8 | |
| Chapter card cut in | `strike` at -0.04 s, `impact` gain 0.55, `pop` gain 1 at +0.05 s | Music ducks to 45% under the card |
| Chapter card cut out | `swish` | |
| Tap | `click`, then `tick` 0.02 s later | Exactly on the recorded / measured tap time |
| Typing | `key`, gain 0.45-0.7, about 0.05-0.09 s apart | |
| Notification | `ding` | |
| A result appears (draft message, a win) | `chime` / `win` | |
| A ring appears | `tick` + soft `pop` | |
| Same-topic move | `whoosh` | |
| Into a big moment | `riser`, 1.2-1.65 s long, ending on the moment | Before cards and before the CTA |
| CTA | 0.35 s of silence, then `impact` on the cut | |

- Music: 120 BPM, kick + bass pulse with a sidechain pump. 16th-note arpeggios run under the busy
  feature scenes (`arps`). A "breath" halves the kick for a calmer stretch (`breath`).
- **Cues under a card are filtered out** (`hidden` in `make-audio*.cjs`): the scene keeps running under
  the card, but the viewer cannot see it, so they must not hear it.
- Final mix: loudness normalised to **-14 LUFS**, true peak -1.5 dB (`loudnorm` in the finish).

## 7. Don't

- Fast moves, small moves, or several moves at once.
- Fades or dissolves between topics.
- Loops, confetti, bouncing logos, spinning things.
- Blurring text the viewer is meant to read while it sits still (blur is for entrances and exits only).
- Motion or sound that does not match a real event in the product (a "tap" that taps nothing).
- A sound that plays while its picture is hidden under a card.
- Animating a real app screen's insides by hand. If it must move, record it.

## 8. Recipes

**Add a scene**
1. Add `[name, length, card?, pre]` to the ad's timing file.
2. Write the scene: `Headline` at `top={216}`, one stage object in `Rise`, at most one `Ring` or `Tap`.
3. Add its words to `COPY` in BM and EN, and the word counts plus cue times to the audio script.
4. Run the audio script, render a still at the moment everything has landed, and check both languages.

**Point at a real button**
1. Capture the screen with the harness and save the button's position in the same run (`rects.json`).
2. `Shot` the crop, then `Tap` or `Ring` with that rect. Never type coordinates by eye.
3. Cue `click` + `tick` at the tap time in the audio script.

**Check motion before a full render**
Render stills at the moment each scene has settled (`stills2.cjs`, see `README.md`), then the first
5 s with sound. Only then render the whole ad.
