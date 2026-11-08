# Handoff: Drevo seller ad (2026-11-03)

Read first, in this order: `STYLE.md` (the owner's design rules), `LESSONS.md` (what went wrong and
the approval steps), `README.md` (how to rebuild and render). Repo-wide rules: `/CLAUDE.md`.

## 1. Deploy status (checked 2026-11-03 08:35 UTC)
- **Nothing went to production or staging this session.** No PR, no staging push, no DB change,
  no edge function. App code is untouched.
- Branch `ccr-b7b37fd0-l5oo8c` is synced with origin, 14 commits ahead of `origin/main`
  (`5b2ba0d`, #573). All 14 are ad work under `marketing/ads/` plus one 5-line section in `CLAUDE.md`
  ("Marketing videos (ads)"). Latest: `96289b3`.
- Whether this branch should ever merge to `main` is an owner call: it adds ~77 files, including
  MP4s of about 11 MB each, to a PUBLIC repo. Do not open a PR unless the owner asks.

## 2. What was made this session
- **Chapter cards** (`src/scenes/Card.jsx`, `51fe637`): a hard cut to full red at every topic change.
  "Sekarang:" / "Now:" + the topic, chapter number big behind, 0.75 s, a hit sound and a music dip.
  Why: owner said scene changes were too abrupt; viewers could not tell the topic had changed.
  Scenes start under their card (`pre` in `src/timeline.json`) so no empty frame follows a cut.
- **One timing file** (`src/timeline.json`): `src/lib.js` and `make-audio.cjs` both build the
  timeline from it, so picture and sound cannot drift. Length 49.75 s.
- **White theme, 60% white / 30% red / 10% black** (`src/ui.jsx` tokens, `0e92c9a`): white room, a red
  floor (from y=1260) the devices stand on, black text and device frames, black offer pill.
  Drawn accents are red/black only; real app screens, posters and the mini page keep real colours.
  `tools/palette.py <dir of stills>` measures it: frames between cards = 53 / 30 / 7 (+10% photos).
- **Stats says the value** (owner): "Views, clicks, saves. Know what to fix." with three real numbers
  (premiummotors' 2023 Lexus RX 350 2.4L Turbo F-Sport: 89 views, 10 WhatsApp, 1 saved). The other RX
  (131 views) has 0 saves, which is why the car changed. Saves are at most 1 on any premiummotors car.
- **Sales coach scene, chapter 05** (`Coach` in `src/scenes/Features.jsx`): renders the app's own
  `carNextStep` rules + `CarNextStep` component (imported from `src/`, react aliased in
  `remotion.config.js`) on premiummotors' real numbers read 2026-11-03 (`COACH_CARS`). Re-read them
  from the DB before re-using this scene later: the lines change as the cars get views.
- **Written rules so the next session makes the same design**: `STYLE.md`, `LESSONS.md`, and the
  pointer in `/CLAUDE.md` (`96289b3`, `f8ced66`).

## 3. Open items for the next agent
1. **Done: the final videos in `final/` are the white theme with chapter cards, the value-led stats
   scene and the sales coach scene** (rendered 2026-11-03 15:48/15:57 UTC, 49.8 s, -13.6 LUFS, no black frames, every scene checked in both
   languages) and were sent to the owner. The dark preview clip was deleted. To render again after a
   change: `node make-audio.cjs`, then `npx remotion render src/index.js DrevoAd-<lang> out/raw-<lang>.mp4`
   (~10 min each, background), then the finish:
   ```
   ffmpeg -i out/raw-ms.mp4 -vf "noise=alls=2:allf=t" -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
     -c:v libx264 -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart final/drevo-premium-ms.mp4
   ```
2. **Waiting on the owner's feedback** on the white theme once they see the full render.
3. Gitignored, so a fresh container must regenerate them (README steps): `public/takes/` (screen
   recordings of the real LivePresenter via `harness/record.cjs` + the Vite harness on port 5199),
   `public/real/` (`harness/tools.cjs`: loan poster, stretch moving poster, AI cut-out), `public/audio/`
   (`node make-audio.cjs`), fonts. Root `npm ci` fails (xlsx from cdn.sheetjs.com, 403): install only
   this folder's deps. Browser: `/opt/pw-browsers/chromium_headless_shell-1243/...` (remotion.config.js).
   Recorded take timings may differ by a few ms; copy the new `*.clicks.json` into `src/`.
4. Offered, owner has NOT decided:
   - App bug: the moving poster prints "Gr86 / 2.4l Rz" (`titleCase` in
     `src/components/poster/MotionPosterSheet.jsx`) for every seller. Separate change, staging first.
   - Delete the first drafts: `marketing/ads/ad.html` + `drevo-seller-ad-*.mp4` (`b993a4e`) and the HTML
     version `marketing/ads/drevo-premium/`.
   - premiummotors data: Civic Type R saved as 1,498 cc (should be 1,996, insurance estimate low);
     MINI has no cc. The stats scene (Lexus RX, 131 views / 13 WhatsApp) has no photo.
   - Run the ads only after the drevo.my switch night (the site still says XDrive until then).
5. GitHub reports 21 Dependabot alerts on `main` (1 critical, 3 high). Not looked at.
6. `TODO.md` pending items were not worked on this session: follow the session-start protocol.

## 4. Rule set (condensed; full text in /CLAUDE.md)
- **Security / tenancy**: every query scoped by dealer via RLS + `getDealerIdFromProfile(profile)`;
  never `user.id`. SECURITY DEFINER functions derive the subject from `auth.uid()`. Seller phone
  numbers never ship to public pages (`sellerWaUrl` -> `/api/wa`). AI drafts, a human sends.
  Verify anything legal against the real law before building (Sambung Bayar lesson).
- **Deploy**: local -> `staging` (fetch + check `HEAD..origin/staging` before force-push) -> owner
  tests -> prod only on "push to prod", via temp branch + PR + squash. Prod releases and DB
  migrations after midnight MYT and only when nobody is live (`seller_live_state`). Vercel builds
  only `main` and `staging`. Repo stays public while on Vercel Hobby.
- **Brand**: write "Drevo", never "XDrive"; no domain hardcoded (`src/config/site.js`).
- **Design**: marketplace public = DESIGN.md; dashboards = DASHBOARD_DESIGN.md; Salesman Premium is
  `premiumDark`; mobile first (375 px); overlays portal + scroll lock + `useModalHistory`; no
  coloured side bars; one accent per card. Ads = `STYLE.md` (60/30/10, chapter cards).
- **Talk to the owner**: plain English, file:line for every claim, challenge a request before
  building it, no emojis.
- **Pricing**: Lite free (10 live cars, basic page and Live, 4 loan posters a month). Premium RM35 a
  month, 7-day free trial (`plan_expires_at`), payments logged by `record_subscription_payment`;
  lapses back to Lite with extra cars locked.
