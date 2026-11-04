# Drevo ads (Remotion)

The working template for every Drevo marketing video. Read in this order:
1. `STYLE.md`: the owner's rules on one page
2. `LESSONS.md`: what went wrong before, and the approval steps
3. `DESIGN.md`: how an ad looks (colour, type, layout, safe area, components, real-product rules)
4. `AnimationStyle.md`: how an ad moves and sounds
5. This file: how to build and render

The Claude skill `.claude/skills/drevo-ad/SKILL.md` walks a session through all of it.

## The ads in this folder

| Ad | Compositions | Length | Timing file | Words | Sound script | Finished files |
|---|---|---|---|---|---|---|
| Premium (features tour) | `DrevoAd-ms`, `DrevoAd-en` | 49.8 s | `src/timeline.json` | `COPY` in `src/lib.js` | `make-audio.cjs` | `final/drevo-premium-<lang>.mp4` |
| Renewals (insurance + road tax) | `Renewals-ms`, `Renewals-en` | 22.8 s | `src/renewals/timeline.json` | `COPY` in `src/renewals/Renewals.jsx` | `make-audio-renewals.cjs` | `final/drevo-renewals-<lang>.mp4` |

Briefs (script in words, data checks, what was fixed first): `briefs/`. Post captions: `final/captions.md`.

## Where the product footage comes from

Everything shown from the product is the product's own output, never a redrawing:
- **Screen recordings** of a real component with scripted taps: `harness/record.cjs` (Live presenter).
  Each take writes `*.clicks.json` with the time and place of every tap.
- **Screenshots** of real components on sample data: `harness/sold.cjs` (Sold tab, renewals ad). It
  also writes `src/renewals/rects.json`, the position of every element the ad points at.
- **The app's own renderers**: `harness/tools.cjs` (loan poster, moving poster, background cut-out).
- **Real components imported straight into Remotion**: the coach scene (`src/scenes/Features.jsx`).

The harness (`harness/`, Vite on port 5199) mounts app components with no network: `stubSupabase.js`
answers from `fixture.js` and `globalThis.__STUB_TABLES`.

## Build from a fresh container

```sh
npm install                          # in this folder only; root `npm ci` fails (xlsx CDN)
cp ../drevo-premium/*.woff harness/ && cp harness/*.woff public/fonts/
node_modules/.bin/vite --config harness/vite.config.mjs &     # harness on :5199

# product footage (gitignored, so regenerate it)
node harness/record.cjs calc ms public/takes      # + calc en, budget ms, budget en
cp public/takes/*.clicks.json src/
node harness/tools.cjs                            # public/real/: posters + cut-out
node harness/sold.cjs                             # public/real/sold-*.png + src/renewals/rects.json

# sound
node make-audio.cjs                               # public/audio/mix-<lang>.wav
node make-audio-renewals.cjs                      # public/audio/renewals-<lang>.wav
```

The browser is Playwright's Chromium (`remotion.config.js` points at it). Never run `playwright install`.

## Work in this order (the approval steps)

1. **Stills**, one per scene, at the moment it has settled:
   ```sh
   node tools/stills.cjs Renewals ms out/stills 3.5 6.5 10.5 14.5 18.5 22.2
   python3 tools/palette.py out/stills            # 60/30/10 check
   ```
2. **First 5 s with sound**: `npx remotion render src/index.js Renewals-ms out/hook.mp4 --frames=0-149`
3. **Full render** (a few minutes per 20 s, run it in the background):
   ```sh
   npx remotion render src/index.js Renewals-ms out/raw-renewals-ms.mp4
   ffmpeg -i out/raw-renewals-ms.mp4 -vf "noise=alls=2:allf=t" -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
     -c:v libx264 -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart final/drevo-renewals-ms.mp4
   ```
4. **Check before sending**: length, loudness (-14 LUFS, `ffmpeg -af ebur128`), black frames
   (`blackdetect`), and one frame from every scene in BOTH languages, looked at.

`npm run studio` opens Remotion Studio to scrub and edit in the browser.

## Folder map

| Path | What |
|---|---|
| `src/ui.jsx` | Colour tokens and shared components (`Ambient`, `Headline`, `glass`, `Device`, `Cursor`, `Fine`) |
| `src/lib.js` | Timing helpers, springs, easing, Premium ad copy |
| `src/scenes/` | Premium ad scenes; `Card.jsx` and `Cta` are shared by every ad |
| `src/renewals/` | Renewals ad: scenes, timing, element positions |
| `src/Ad.jsx`, `src/Root.jsx` | Premium ad assembly; every composition is registered in `Root.jsx` |
| `harness/` | Vite pages that mount real app components for recording and screenshots |
| `score.py` | The music and sound-effect synth |
| `tools/stills.cjs`, `tools/palette.py` | Stills and the colour check |
| `public/` | Fonts, photos; `takes/`, `real/`, `audio/` are generated and gitignored |
| `final/` | Finished videos, stills sheets, captions |
