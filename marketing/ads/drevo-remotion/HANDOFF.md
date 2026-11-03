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
- **Written rules so the next session makes the same design**: `STYLE.md`, `LESSONS.md`, and the
  pointer in `/CLAUDE.md` (`96289b3`, `f8ced66`).

## 3. Open items for the next agent
1. **The final videos in `final/` are OUT OF DATE (dark theme, no chapter cards).**
   `final/drevo-premium-{ms,en}.mp4` and `final/preview-cards-ms.mp4` are yesterday's dark version.
   A full render of the white version was running in the previous container when it ended; if the
   files are not newer than `96289b3`, render again:
   ```
   cd marketing/ads/drevo-remotion
   # rebuild the gitignored assets first if missing: see README.md (takes, real/, audio, fonts)
   node make-audio.cjs
   npx remotion render src/index.js DrevoAd-ms out/raw-ms.mp4     # ~30 min, run in background
   ffmpeg -i out/raw-ms.mp4 -vf "noise=alls=2:allf=t" -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
     -c:v libx264 -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart final/drevo-premium-ms.mp4
   # same for en; then look at a still of every scene before sending (LESSONS.md)
   ```
   Then commit both MP4s, push to the branch, send them to the owner, and delete
   `final/preview-cards-ms.mp4` (dark) or re-render it.
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
