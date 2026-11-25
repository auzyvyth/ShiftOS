# Drevo motion design (owner-approved, 2026-11-25)

How the Premium tour ad (`Tour-ms` / `Tour-en`, `src/tour/`) and its five scenes move, sound and look, and
every lesson that got them there. Use it for any new Drevo video. Older rules: `STYLE.md` (colour, safe
area), `AnimationStyle.md` (springs, timings). Where this file and those disagree, this file is newer.

## 1. The shape of the ad: one continuous shot, never a cut
Owner: "I don't like the cut off, make it seamless."
1. **Hook on frame 0.** Big, centred, a hit on the very first frame. It names the viewer and says what they
   get: "SA kereta, jangan scroll. / *5 tool, satu app.*". Not "you don't want to miss this" (promises, says nothing).
2. **The hook rises and becomes the title of a map.** Drevo in the middle, every part around it, joined by lines.
3. **Per part:** a red outline draws round it, its line lights red, the camera glides in until the part
   fills the frame, the clip plays, the camera glides back out to the map. Then the next part.
4. **The part on the map IS the clip**, frozen on the frame the clip opens on (`<Freeze>`). The zoom lands on
   exactly that frame, so there is no cut. After playing, the part keeps its last frame: you see what is done.
5. **End on the whole map**, logo grows, one offer line, the address.

## 2. The look
- **White world with a hint of red** (owner: "the black background doesn't really show the app"). White
  background, one soft red light that drifts slowly, white fog at the top and bottom of the frame.
- **The app stays as it is.** Dark phones, the dark dashboard: they are the real product, and dark on white
  is what makes them pop. Never recolour a real screen.
- **Captions:** two lines, Outfit 700, 84 px, letter-spacing -3.5, top 214. Line 1 ink, line 2 red. Words
  come in one by one (3 frames apart) from a blur and a small rise. Same component everywhere (`Caption`).
- **Fine print** under the caption at y 400, 24 px, ink at 50%: "Contoh data", "the bank decides".
- **Outlines** are the way to point: a red rounded rectangle that draws itself (stroke-dashoffset, 12 frames,
  expo-out) with a soft red glow. One thing outlined at a time.
- **Taps**: the button dims for a moment and a red ring opens from it. Drawn where the real recording tapped.

## 3. Real screens only, captured sharp
- **Every screen is the real component** on sample data, in a harness page (`harness/*.jsx`), captured by
  Playwright (`harness/*.cjs`) with every position measured in the same run (`src/<scene>/rects.json`).
  Never redraw an app screen. Sample sellers, dealers and buyers are made up (PDPA); photos are the owner's.
- **Capture at 3-4x.** A 1280 px page zoomed 3x pixelates.
  - Stills: `deviceScaleFactor: 4` (dashboard) or 3 (phones).
  - Recordings: the CDP screencast ignores `deviceScaleFactor` unless Chrome starts with
    `--force-device-scale-factor` (`harness/record-phone.cjs`). The first takes were 400 px wide.
  - In 3D, Chrome rasters a layer at its LAYOUT size: lay the page out K times bigger and divide the camera
    scale by K (`DashPan.jsx`, K = 4). A 2D zoom (the map) is fine as is.
- **Load before you shoot.** Scroll a long page top to bottom first (lazy images), hide fixed bars for the
  full-page shot and lay them back on in the video (`harness/minipage.cjs`).
- **Show what the app really does, in the order it does it.** If the ad joins two steps (loan check -> the
  bank application's link), show both messages so nothing is promised that the app does not do.
- **Example numbers stay modest and labelled.** Commissions RM 300-500, not RM 3,000 (owner). Never a
  struck-out "was" price, never an approval, never income.

## 4. The camera
- **Glide, never cut.** One easing for every move: `cubic-bezier(0.65, 0, 0.25, 1)` (slow out, long settle).
- **Zoom in log space**, so a 1x -> 6x zoom feels even all the way.
- **Pin the target under the camera.** Glide the TARGET's screen position to the centre and solve the camera
  centre from it (`Tour.jsx camAt`). Gliding the camera centre itself swung the shot across the map and
  crossed the logo at 3x.
- **Inside a scene the camera zooms to what matters** (1.3-1.6x) so the app's text is readable on a phone;
  keep the zoomed phone below the caption band (focus point at y 1120) or it runs into the words.
- **3D, gently:** a phone stands at 10-15 degrees and floats 1.5 degrees; a page lies at 40-70 degrees on
  the way in. Big tilts only while moving.
- **Pace:** a box every 2 beats felt right; one every 4 beats was "too slow" (owner).

## 5. Sound: every move has a sound, every sound is satisfying
Owner: "the whooshing is too repetitive and not a good sound, every sound must hit a satisfying sound."
- **One grid: 112.5 bpm = 16 frames a beat, 64 a bar.** Picture and sound read the SAME `timeline.json`.
  Arrivals, outlines and caption words land on beats; big moments on a bar's first beat.
- **One music bed under the whole ad** (`make-audio-tour.py`). Never restart music at a join. Quieter on
  the map, fuller inside a clip; it dips for a third of a second under every big hit.
- **No noise whooshes.** The kit (`make-audio-*.py`):
  - `thock` - a pitched body that drops into place + a click + a little sub. The landing.
  - `bell` - a glassy FM pluck. Outlines, "you earn", things locking in.
  - `swell` - a reversed bell that swells INTO a hit. Replaces the whoosh on every glide.
  - `bloop` - a tiny rising pop. One per caption word, one per message bubble.
  - a short press (`thock` an octave up) on every recorded tap; a soft tick per typed digit.
- **Notes rise.** Each part's sounds sit one step higher in the A minor pentatonic, so five parts build.
- **Sounds follow the recording**, not the grid, when they belong to a real tap (`clicks.json`).
- **Stems:** each scene writes its mix AND an effects-only `<scene>-fx.wav`; the tour lays those over its
  one music bed. Level every stem by ear and by numbers (the dashboard's ran 2 dB hot).
- **Finish:** loudnorm to -14 LUFS, true peak -2 dB. Check short-term loudness per second for jumps.

## 6. Studying a reference (the `reanimate` skill)
The owner sends a video of a style they like. Cut it into frames (`frames.ts`), lay them out (`sheet.ts`),
write down what moves when and how (`.reanimate/<name>/spec.md`), and map the music's beats against the
cuts (the reference's every scene change was on a bar). Copy the motion and the rhythm, never the words,
brand, fonts or colours: their lime became our red, their Indonesian line became our own Malay line.

## 7. Process that worked today
1. Build each part as its own composition first (`DashPan`, `Broker`, `Mini`, `Live`, `Loan`), BM + EN.
2. Send each one, take the owner's notes, then join them.
3. Before saying done: stills of every part in both languages at full size, a contact sheet at 1 per second,
   a close look at every transition at 10 fps, loudness per second, black-frame check.
4. Audit your own render and fix what you can before asking (the camera swing, the slow intro, mismatched
   captions were all found this way). Ask only about what is the owner's call.
5. Keep the scripts, harnesses and timing files in the repo; renders and recordings stay out (`.gitignore`).

## 8. Files
| Part | Picture | Footage | Sound |
|---|---|---|---|
| Whole ad | `src/tour/Tour.jsx`, `timeline.json` | the scenes | `make-audio-tour.py` |
| Dashboard | `src/dash/DashPan.jsx` | `harness/dash.cjs` | `make-audio-dash.py` |
| Dealer stock | `src/broker/BrokerScene.jsx` | `harness/broker.cjs` | `make-audio-broker.py` |
| Mini page | `src/mini/MiniScene.jsx` | `harness/minipage.cjs` | `make-audio-mini.py` |
| Live | `src/live/LiveScene.jsx` | `harness/record-phone.cjs` | `make-audio-live.py` |
| Loan check | `src/loan/LoanScene.jsx` (also exports Phone, Tap, Outline, Caption, camAt) | `harness/loan.cjs` | `make-audio-loan.py` |
Script and open decisions: `briefs/premium-tour.md`.
