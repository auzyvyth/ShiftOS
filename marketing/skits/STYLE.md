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
- Cars: a toon-filtered photo (`tools/toon.py`). Test photos may be a maker's press shot; anything
  POSTED uses a photo we own or a seller's with their OK. Drawn cars carry no maker badge.
- Captions: Outfit 700, 74px, white, 14px ink stroke, the punch word red (`<b>`), top 1400px,
  2-5 words, pop in over 5 frames. Never over the faces.
- Camera: slow push-in (+4-5%); on a hit: zoom punch, shake, white flash 4 frames.
- Jokes: about situations every buyer knows (smoke, "tak pernah accident", hidden costs). Never a real
  brand, dealer or person as the butt of the joke without the owner's call + a legal check.

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

## Process (each step waits for the owner)
1. Joke + script lines in BM. 2. Stills of the key beats. 3. A 5-6 s test. 4. The full skit.
Send every render with SendUserFile and stills of the beats; check frames yourself before sending.
