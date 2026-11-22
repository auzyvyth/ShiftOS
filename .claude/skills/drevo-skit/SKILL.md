---
name: drevo-skit
description: Make or change a Drevo comedy skit video - the cartoon salesman (Abang Jo) and buyer (Faiz) in the Drevo showroom, Malay captions, for marketing, education and entertainment (the "Brutal truth about..." cartoon format). Covers characters, expressions, walk/point/panic moves, toon-filtered car photos, scenes, captions, sound and renders. Use whenever the user asks for a skit, a cartoon, the salesman/buyer characters, a funny or educational video, or to change a skit asset. Not for product ads with real app footage (use drevo-ad).
---

# Drevo skits

Everything lives in `marketing/skits/`. Read these first, every time:
1. `marketing/skits/STYLE.md`: the cast, faces, moves, captions, sound, and the mistakes already made
2. `marketing/skits/README.md`: commands

Do not copy their rules into replies or new files: link to them. A new rule the owner gives goes into
STYLE.md in the same commit.

## How the code is built
- `tools/rig.mjs` is the ONE source of every drawn asset. Characters are rigs: `character(who, pose)`,
  pose = arms, legs, eyes, mouth, extras. Never draw a character by hand in a scene file.
- A scene is `tools/sceneN.mjs`: a `frame(f)` timeline -> poses + positions, rendered with Playwright
  frame by frame, then ffmpeg with a silent base track. Copy `scene2.mjs` for a new one.
- `tools/build.mjs` rewrites `assets/*.svg` and the asset sheet after any rig change.
- Renders go to `preview/` (not committed). Run with `NODE_PATH=$(npm root -g)`.

## Before you send anything
- Pull stills of the key beats (ffmpeg select + tile) and look at them yourself.
- `ffprobe`: video and audio both start at 0 and run the full length.
- Send the MP4 + stills with SendUserFile.
