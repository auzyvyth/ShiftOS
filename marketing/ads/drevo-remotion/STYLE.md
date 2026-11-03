# Drevo ad style (owner-approved, 2026-11-03)

The rules every Drevo marketing video follows. A new ad starts from these and from
`LESSONS.md` (what went wrong the first time). The working example is this folder:
`src/ui.jsx` (theme), `src/scenes/Card.jsx` (chapter card), `src/timeline.json` (timing).

## Colour: 60% white, 30% red, 10% black (owner's rule, always)
| Share | Colour | Where |
|---|---|---|
| 60% | white `#FFFFFF` | the room (background), cards, chips |
| 30% | Drevo red `#dc2626` | the floor the devices stand on (from y=1260), the second headline line, chapter cards |
| 10% | black `#0B0C0F` | headline text, device frames, the offer pill, pressed buttons |

- Tokens live in `src/ui.jsx` (`WHITE`, `RED`, `INK`, `MUTED`, `ON_RED`, `FLOOR`). Never type a colour into a scene.
- Anything we DRAW uses only these three. No blue, purple, amber or green accents (the app's per-stage
  lead colours stay in the app; in the ad every stage is red).
- Real things keep their real colours: app recordings, posters, the seller's mini page.
- Text on the red floor is white; a button on the red floor is black, never red.
- Check it, do not eyeball it: render stills (`npx remotion still`, or a loop) and run
  `python3 tools/palette.py <dir>`. Frames between cards should land near 55 / 30 / 7, with about
  10% for photos and app screens. Chapter cards are full red by design (the colour change is the cut).

## Type
- Outfit 700 for everything (files in `public/fonts`), loaded before frame 0.
- Headline: two lines, ~104 px, letter-spacing -4, centred near the top. Line 1 black, line 2 red
  (`*red*` markup in COPY). Words spring in one by one.
- Short. A headline is 2-5 words. BM and EN always both, all copy in `src/lib.js` COPY.

## Structure
- Portrait 1080x1920, 30 fps, 40-50 s, a BM and an EN cut.
- The first 5 s carry the whole sale: retention is ~10%, most people never see second 6.
- **Every topic change is a hard cut to a red chapter card** (owner, 2026-11-03): full red,
  chapter number big behind, "Sekarang:" / "Now:" + the topic, 0.75 s, a hit sound and a music dip.
  No fades between topics. The hook into the first feature is one continuous move (no card).
- After a card the next scene is already on screen: its clock starts under the card (`pre` in
  `src/timeline.json`), so there is never an empty frame after a cut.
- Picture and sound read ONE timing file, `src/timeline.json`. Never put scene times anywhere else.

## Motion and look
- One element at a time. Big type. Soft shadows, shapes, slow moving light (the reference videos).
- Springs for things landing; slow, large moves only (phones and TikTok compression smear fast ones).
- Devices (monitor, phone, laptop) stand on the red floor with a contact shadow.

## Real product, real data
- Show the real app: record it with `harness/record.cjs` (scripted taps on the real component).
  Never redraw a screen in code. The first ad did, and it was the worst part.
- Real seller data and photos only with the seller's OK (premiummotors is the owner's own account).
- Loan figures come from the app's own maths, labelled as estimates ("bank decides").
- Say "Drevo", never "XDrive". No invented numbers.

## Sound
- Original score from `score.py` (no licensed music), effects cued from the same timeline and the
  recorded taps (`make-audio.cjs`). Final mix -14 LUFS. Music only, no voice-over.

## Process (from LESSONS.md)
Script in words -> owner OK -> references -> one still per scene -> owner OK -> first 5 s with
sound -> owner OK -> full render. Look at a still of every scene before sending anything.
