# Drevo Skits: the style bible (owner-approved, 2026-11-22)

Short cartoon skits (salesman + buyer) for marketing, education and fun, in Malay. Modelled on the
owner's reference: the "Brutal truth about McLaren" style (flat 2D paper-doll characters, word captions).
This is NOT the product-ad format: `marketing/ads/drevo-remotion/STYLE.md` (real app footage, 60/30/10,
red chapter cards, no voice) does not apply here. Commands are in `README.md`.

## Cast (code: `tools/rig.mjs`, `PEOPLE`)
| | Abang Jo, the salesman | Faiz, the buyer |
|---|---|---|
| Skin | `#c68b59` | `#d9a273` |
| Top | Drevo red polo `#dc2626`, white Drevo wordmark, lanyard + ID card | white tee, brown sling bag |
| Hair | neat side-part quiff, follows the skull, sideburns stop at the ear | front-facing black cap, red patch, thin brim, short sideburns |
| Face | thin moustache | clean |
| Legs | black trousers, black shoes | navy jeans, white shoes |

- **Tauke Lan** (the villain, `tauke`): flowery mustard shirt, gold chain, slicked-back hair, thick moustache,
  khaki trousers, optional sunglasses (`shades: true`). **The Drevo shirt is never the con man**: a dodgy seller
  is Tauke Lan, on his own lot (`lot()` in `tools/ep1.mjs`, no Drevo branding), never in the Drevo showroom.
- Style: thick ink outline (`#16181d`, 6px), flat colour + one shadow tone, round head on a short body.
- **Never mirror a character** (scaleX -1): the shirt logo reads backwards. Point with the other arm.
- Hair and caps are drawn to the head oval (centre 250,250, rx 135, ry 150). Never a loose shape on top.
- New characters reuse the same body, outline and proportions; change skin, clothes, hair only.

## Faces (pose params: `eyes`, `mouth` + extras)
Eyes: `neutral`, `happy`, `shock`, `sly`, `suspicious`, `angry`, `cry`, `dizzy`, `stars`, `wink`, `nervous`, `up`.
Mouths: `closed`, `talk`, `o`, `grin`, `frown`, `wavy`, `scream`, `smirk`, `wail`.
Extras: `sweat`, `blush`, `vein`, `tears`, `tint` (red face; `tint: 'green'` = smelling something), `shades`. The brim must never hide the eyebrows.
Talking = mouth flaps between `talk` and the resting mouth every 3 frames.

## Moves
- **Walk = the reference walk** (owner, 2026-11-22, after two rejected versions): `stride: true`,
  both legs swing from ONE point under the body like a compass (+-24 deg), arms nearly still (+-4),
  NO bob, NO sway, steady glide with a short ease-out. Leg swing is tied to distance walked (no
  sliding), each walk ends legs together, both shoes point the way they walk (`facing`).
  Rejected: legs from two hips crossing (knock-kneed), lifting feet + body sway (looked weirder).
- Point: `pointR` / `pointL` adds a finger; point up at `armR: -155` (straighter hides it by the head).
- Panic: `armL: 118, armR: -118`, shock/scream, small jitter, a jump on the hit.
- Arms: 0 = down, +-90 = out to the side, +-160 = raised. Right arm is negative.

## Scene
- 1080x1920, 30 fps. Background `showroom()`: white wall, red band with the Drevo logo, spotlights.
- Cars: a POSTER-filtered photo (`tools/toon.py`): smooth flat colour bands, bright and saturated, NO ink
  lines inside the car, one thin outline round it (owner, 2026-11-22: the ink-line toon "looks burnt").
- Every drawn background ends with `dots()` (rig.mjs): the reference's fine dot grid, 7% black.
- Close-ups of real things (carpet, headlight) use REAL photos run through the same poster filter, never
  a drawing (owner, 2026-11-22: the drawn carpet/fish/lamp did not read). Test photos may be a maker's press shot; anything
  POSTED uses a photo we own or a seller's with their OK. Drawn cars carry no maker badge.
- Captions: Outfit 700, 74px, white, 14px ink stroke, the punch word red (`<b>`), top 1400px,
  2-5 words, pop in over 5 frames. Never over the faces.
- Camera: slow push-in (+4-5%); on a hit: zoom punch, shake, white flash 4 frames.
- Jokes: about situations every buyer knows (smoke, "tak pernah accident", hidden costs). Never a real
  brand, dealer or person as the butt of the joke without the owner's call + a legal check.

## Pacing (measured from the owner's reference skit, 2026-11-22; test: `tools/pacing-test.mjs`)
- **Talk never stops**: gaps between lines 0.6 s at most. Something changes on screen every ~0.8 s;
  a hard cut every ~6 s. No shot holds still for more than a second.
- **The background pans slowly sideways the whole shot** (`#bgl` translateX ~0.6-0.8 px/frame, scaled
  1.12 so the edges never show); characters stay put. That constant drift is why it never feels frozen.
- **Two shot types, alternated**: WIDE (everyone, full body) and CLOSE (one character from the thighs
  up, 900px wide, over the SAME background scaled 1.55 and blurred 7px). Punchlines and reactions = CLOSE.
  A silent reaction close-up (1-1.5 s) after a big line is normal.
- **Arms SNAP between key poses on the stressed words** (every 0.3-0.6 s), no in-betweens: down,
  out to the side, pointing, raised, both up. Keys live in a `KEYS` table per character.
- Listeners blink (`eyes: 'blink'`, 3 frames every ~2.5 s) and otherwise hold still.
- Characters walk in WHILE talking, arm already up (the compass walk).
- **Captions: 2-4 words, ~1 s each, 60px, fade in/out over 3 frames**; above the heads on wide shots,
  on the chest (top 1600) on close-ups.
- Inserts of real things are real photos (poster filter), e.g. a finger pressing a real door button.

## Lessons from the side-by-side study (2026-11-22, private copy kept out of the repo)
- Their close-up is a MID shot: waist up, the head in the top third, the body filling the frame. Ours
  filled the screen with a big face, which reads louder and cheaper. Frame close-ups waist-up.
- Their people are tall with small heads (~1/7 of the body); ours are chibi (big head). Changing the
  body is an owner call (it changes every asset).
- Every "thing" shot (door, interior, screen) is a REAL photo in the poster filter with a simple drawn
  hand or heads on top. Drawn stand-ins (our interior, our door) read as noise.
- Their caption is small (about 54px at 1080 wide) and sits on the chest, never on the face.

## Episodes
- Each episode = `tools/epN.mjs` + `briefs/epN-*.md` (script with start/end per line for the voice recording).
- Captions sit ABOVE the heads on wide shots (top 1000 lot / 880 showroom), low (1400) on close-ups.
- Tip cards: white, ink border, red number circle, top 250, slide down; one per lesson.
- Close-ups are drawn full-screen SVGs (carpet, lamp); actors render above them.

## Sound
- **Always mix onto a silent base track the full length of the video.** An audio stream that starts
  late makes phones show nothing until it begins (the first test "didn't play").
- Effects: pop per caption, a footstep per step, boom/crash on hits. Voice: not decided yet
  (owner records, or an AI Malay voice). Encode with `-movflags +faststart`, `-g 30`.

## Process (owner, 2026-11-22: "script, get the images, then animate")
1. **Script** in BM, already ACTED: every line carries acting tags on its words (below).
2. **Images**: real photos for every "thing" shot (car, interior, door, screen, carpet...), poster-filtered.
   No photo = no shot; never stand in with drawn shapes (the drawn interior was "a bunch of shapes").
3. **Voice** recorded (or the timing sheet), then **animate**: mouths from the voice, faces from the tags.
Each step waits for the owner's OK.

## Acting on every word (`tools/perform.mjs`)
- Tags in braces sit right before the word they land on; they hold until the next tag or line end:
  `'{squint}{grimace}Ugggh... {side}{closed}{leftOut}probably just...'`
- Eyes: neutral happy shock sly suspicious angry cry dizzy stars wink nervous up side squint blink.
  Mouths (resting): closed grin frown wavy scream smirk wail grimace o. Arms: armDown armOut armUp
  point pointUp bothUp shrug leftOut headHands. Flags: sweat tears blush vein shades (noSweat...), red, green.
- A word's time = the line's window split by characters (`actAt`). Change something on most stressed
  words: a face OR an arm, roughly every 2-4 words. A line with no tag is a flat line.
- **Lip-sync from the voice** (`loudness` + `lipMouth`): quiet = the tagged resting mouth, speaking =
  open, loud = wide. Never a timer flap once a voice track exists.
- The listener reacts too (blink, a face change on the punch word), never frozen.
Send every render with SendUserFile and stills of the beats; check frames yourself before sending.
