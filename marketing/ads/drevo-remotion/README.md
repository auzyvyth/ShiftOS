# Drevo Premium ad (Remotion) — BM + EN, 47.5 s, 1080x1920, 30 fps

Everything the ad shows from the product is the product's own output:
- **Live presenter**: a screen recording of `src/components/live/LivePresenter.jsx`, mounted by the harness
  (`harness/`, no network: `stubSupabase.js` answers from `fixture.js` = premiummotors's real listings + photos)
  and tapped on a script (`harness/record.cjs`).
- **Loan poster / moving poster / background cut-out**: rendered by the app's own `renderLoanPoster`,
  `drawMotionFrame` and `cutOutBackground` (ISNet model) via `harness/tools.cjs`.
- Music + sound effects: original, synthesized (`score.py`), cued from the same timeline (`make-audio.cjs`).

## Build
```sh
npm install
cp ../drevo-premium/*.woff harness/ && cp harness/*.woff public/fonts/
node_modules/.bin/vite --config harness/vite.config.mjs &          # serves the harness on :5199
node harness/record.cjs calc ms public/takes   # + calc en, budget ms, budget en
cp public/takes/*.clicks.json src/
node harness/tools.cjs                          # public/real/: posters + cut-out
node make-audio.cjs                             # public/audio/mix-<lang>.wav
npm run render:ms && npm run render:en          # out/
```
Preview and edit in the browser with `npm run studio`. All words (BM + EN) are in `src/lib.js` (`COPY`).
Timeline (seconds) is `TL` in `src/lib.js`; `make-audio.cjs` refuses to run if its copy drifts.
