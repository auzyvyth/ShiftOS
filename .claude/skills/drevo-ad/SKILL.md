---
name: drevo-ad
description: Make or change a Drevo marketing video (TikTok / Reels / Shorts ad, promo, feature explainer) in the house style - portrait 1080x1920 Remotion, 60% white / 30% red / 10% black, red chapter card at every topic change, real app footage only, original synth music, BM + EN cuts. Also covers the ad's script, stills, captions, re-renders and the feature research and legal checks that come before a script. Use whenever the user asks for an ad, a promo video, a reel, a video about a feature, ad captions, or to change, fix or re-render an existing ad. Not for in-app motion (use animate / review-animations).
---

# Drevo ads

You are making a short vertical ad for car salespeople (SAs) in Malaysia. The owner is direct, wants
pushback before work starts, and judges the result frame by frame. Two ads exist and are the template:
`marketing/ads/drevo-remotion/` (Premium features tour, renewals reminder).

## Read first, every time (they are short)
1. `marketing/ads/drevo-remotion/STYLE.md`: the owner's rules on one page
2. `marketing/ads/drevo-remotion/LESSONS.md`: what went wrong before
3. `marketing/ads/drevo-remotion/DESIGN.md`: colour, type, layout bands, safe area, components, real-product rules
4. `marketing/ads/drevo-remotion/AnimationStyle.md`: springs, timings, cuts, sound
5. `marketing/ads/drevo-remotion/README.md`: commands

Do not restate these files in your replies or copy their rules into new files: link to them.
If you learn a new rule, write it into the right one of them.

## The non-negotiables (from the owner)
- **Real product only.** Record or screenshot the real component (harness), or import it. Never redraw an app screen.
- **60 / 30 / 10** white / red / black. Measure it with `tools/palette.py`, do not eyeball it.
- **Hard cut to a red chapter card at every topic change.** No fades between topics.
- **The first 5 s carry the whole sale.** Retention is about 10%.
- **BM and EN**, both checked at full size.
- **Say Drevo, never XDrive.** No invented numbers. Prices match `src/utils/planConfig.js` today.
- **Music and effects only**, original (`score.py`). No voice-over, no licensed music.
- **Do exactly the step asked.** A script request gets a script, not a render.

## The process: each step waits for the owner's OK
1. **Dig into the feature** (before any script). Read the code (`src/`, `supabase/functions/`), and the
   live data with read-only SQL. Ask: does it work for the sellers who would see this ad? Who gets it
   (Lite / Premium)? Does it actually fire? Fix or flag anything the ad would promise but the product
   does not do. App fixes go through staging like any other change (CLAUDE.md deploy rules).
2. **Legal and privacy check.** Any money, finance, insurance or data claim: web-search the real law
   first (CLAUDE.md "Legal subjects"). Real buyer data never appears on screen; use sample buyers.
3. **Script in words**: a scene table (time, picture, headline BM / EN), the hook fact with its source,
   and pushback on the brief if it is too long or tries to say too much. Save it in `briefs/<ad>.md`.
4. **Stills**: one per scene at the settled moment, both languages, as contact sheets in `final/`.
   Run the palette check and look at every frame yourself before sending.
5. **First 5 s with sound** (`--frames=0-149`).
6. **Full render** in the background, the ffmpeg finish, then the checks below. Send both cuts.

The owner may skip a gate ("they look right, render it"). Skipping is their call, never yours.

## Building a new ad (copy the renewals ad's shape)
- `src/<ad>/timeline.json`: `{ card, scenes: [[name, start, length, card?]], dur }`, the ONE timing source.
- `src/<ad>/<Ad>.jsx`: `COPY` for ms + en, one component per scene, `Card` and `Cta` reused,
  `<Audio>` for `audio/<ad>-<lang>.wav`. Register `<Ad>-ms` / `<Ad>-en` in `src/Root.jsx`.
- Footage: a harness page (`harness/<name>.html/.jsx`, add it to `vite.config.mjs`) mounting the real
  component on sample data, and a capture script that saves screenshots AND element positions in one run.
- `make-audio-<ad>.cjs`: cues from the same timing file (word pops per language, card hits, taps).
- When a second ad needs a component that lives in one ad's folder, move it to `src/ui.jsx`.

## Check before sending (every render)
- [ ] Length matches the timing file; `ffmpeg -af ebur128` reads about -14 LUFS; `blackdetect` finds 0
- [ ] A frame from every scene in BOTH languages, looked at: no wrapped headline, nothing clipped
- [ ] Everything readable sits in the safe box (x 60-900, y 220-1440); taps and rings left of x 900
- [ ] Every number is the app's output or sourced in the fine print; sample data is labelled
- [ ] Price line matches `planConfig.js`; "Drevo" everywhere; no third-party app UI or logo drawn
- [ ] Committed and pushed (finished MP4s and stills sheets in `final/`; generated footage stays gitignored)

## After it ships
- Add the ad's lessons to `LESSONS.md` (what went right, what nearly went wrong).
- Offer post captions (BM + EN) and add them to `final/captions.md`.
- Update `marketing/ads/drevo-remotion/HANDOFF.md` if the session is ending.

## Tools and paths
- Harness server: `node_modules/.bin/vite --config harness/vite.config.mjs &` (port 5199).
- Stills: `node tools/stills.cjs <Comp> <lang> <outDir> <sec...>`; colour: `python3 tools/palette.py <dir>`.
- Browser: Playwright's preinstalled Chromium. Never `playwright install`. Screenshot contexts use
  `--lang=en-GB` + `LANG=en_GB.UTF-8` so dates print Malaysian-style.
- Root `npm ci` fails (xlsx CDN): install only in `marketing/ads/drevo-remotion/`.
- Files the owner should open go in the repo or the scratchpad, sent with `SendUserFile`.
