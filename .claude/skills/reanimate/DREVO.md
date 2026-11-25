# Using reanimate in this repo (added 2026-11-25)

Third-party skill (MIT, github.com/NiazMorshed2007/reanimate, commit 3f7a55a), copied in unchanged except:
- `scripts/capture.ts` and `scripts/sheet.ts` launch Chromium from `$CHROME` when set. In cloud sessions run
  `export CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` first. Never run `playwright install`
  (setup.sh would): the preinstalled browser is the one that works here.
- Install script deps with `cd .claude/skills/reanimate/scripts && bun install` (bun: `npm i -g bun`).

How the owner uses it: they send a video of an animation style they like but cannot name; we study it
frame by frame (frames.ts + sheet.ts + the motion spec) and rebuild the STYLE in our Remotion ads
(`marketing/ads/drevo-remotion/`) with Drevo's own content, words and real app footage. Motion-faithful
by default: timing, easing, order and sound hits match; their brand, copy, fonts and images never come over.
Evidence goes in `.reanimate/<name>/` (gitignored).
