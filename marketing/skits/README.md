# Drevo Skits (mockup, 2026-11-22)

Cartoon skit format (salesman + buyer, BM voice, word captions). Separate from the product ads in
`marketing/ads/` (their STYLE.md rules: real app footage, no voice) until the owner decides otherwise.

- `tools/rig.mjs` - every asset drawn from parts: `character(who, pose)` (arms, eyes, mouth, sweat),
  `myvi()`, `showroom()`. Parts are parameters so Remotion can animate the same code.
- `tools/build.mjs` - writes `assets/*.svg` and `preview/*.png`.
  Run: `NODE_PATH=$(npm root -g) node marketing/skits/tools/build.mjs`
- Never mirror (scaleX -1) the salesman: his shirt logo reads backwards. Point with the other arm.
- No real maker badges or logos on cars; the Myvi is a drawn silhouette, not Perodua's photo.
- `tools/toon.py` - toon filter for a car photo (cut-out, flat colours, ink lines):
  `python3 -I tools/toon.py source/myvi-photo.webp assets/car-myvi-toon.png`
- Rules for the look and moves: `STYLE.md`. Renders in `preview/` are not committed (re-render in ~15 s).
- `tools/scene1.mjs` - the 5 s test scene, frames in the browser + ffmpeg -> `preview/scene1-test.mp4`.
  Faces: neutral, talk, sly, suspicious, nervous, shock, angry, cry, dizzy, starstruck, wink, happy.
- `source/myvi-photo.webp` is a maker press photo: fine for tests, swap for our own photo before posting.
- `tools/scene2.mjs` - walk right (legs + arm swing + bob, footsteps), point up (`pointR`), panic arms spread.
  Rig extras: `legL`/`legR` (hip angle), `facing: 'right'` (shoes), `pointL`/`pointR` (finger), `eyes: 'up'`.
- `three/` - three.js TEST (2026-11-22): Abang Jo as a toon-shaded 3D puppet (flat light bands + ink outline),
  face painted on a canvas, the Myvi poster photo as a flat card in the 3D set. Not adopted; the 2D rig is still the format.
  Run: `npm i three` anywhere, then `THREE_DIR=<that>/node_modules/three/build NODE_PATH=$(npm root -g) node marketing/skits/three/render.mjs`
- `three/cast3d.js` + `three/sheet3d.mjs` - the cast in 3D (toon shading + ink outline), faces = the 2D rig's eyes/mouths
  painted on the head. Run: `THREE_DIR=<that>/node_modules/three/build NODE_PATH=$(npm root -g) node marketing/skits/three/sheet3d.mjs`
