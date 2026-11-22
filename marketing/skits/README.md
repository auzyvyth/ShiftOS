# Drevo Skits (mockup, 2026-11-22)

Cartoon skit format (salesman + buyer, BM voice, word captions). Separate from the product ads in
`marketing/ads/` (their STYLE.md rules: real app footage, no voice) until the owner decides otherwise.

- `tools/rig.mjs` - every asset drawn from parts: `character(who, pose)` (arms, eyes, mouth, sweat),
  `myvi()`, `showroom()`. Parts are parameters so Remotion can animate the same code.
- `tools/build.mjs` - writes `assets/*.svg` and `preview/*.png`.
  Run: `NODE_PATH=$(npm root -g) node marketing/skits/tools/build.mjs`
- Never mirror (scaleX -1) the salesman: his shirt logo reads backwards. Point with the other arm.
- No real maker badges or logos on cars; the Myvi is a drawn silhouette, not Perodua's photo.
