# Higgsfield direction script: the free Live calculator ad (hook V3-A)

How to turn the approved stills into moving scenes in Higgsfield. Script and rules: `briefs/live-newcar.md`.
Frames: `final/live-frames/ms/` and `final/live-frames/en/` (1080x1920). Contact sheets: `final/live-stills-ms.jpg`, `-en.jpg`.

## Read this first
- **Every app screen in these frames is the real presenter** (free plan, Proton line-up at the platform's
  official prices). The numbers are the app's own maths: 44,990 -> RM591 (7 years) -> RM480 (9 years) ->
  RM462 with RM1,000 rebate and 45% NCD. A video model redraws every pixel, so it CAN change a digit. A
  changed digit is a false price on an ad. So each scene is given a START frame and an END frame (both
  real), and after generating you must check the numbers on the last frame against the END still. If one
  differs, do not use the clip.
- **Test scene 1 first** before spending credits on the rest (100 credits on the account; the connector
  does not show the cost per clip). If small text smears, stop: the same six scenes render from
  `src/live/Live.jsx` in Remotion with every number exact, and Higgsfield is kept for the DMS video's
  showroom footage instead.
- **Do not generate the three red chapter cards or the CTA.** They are text only; AI text warps. They come
  from Remotion as they are (`03-card-rebate`, `04-card-lead`, `05-card-premium`, `06-cta`).
- The car photo is a placeholder ("FOTO ANDA"). Swap in the owner's own photo and re-export before generating.
- No voice, no generated audio: the house score is added at the end.

## Settings for every clip
| Setting | Value |
|---|---|
| Model | Seedance 2.0 (`seedance_2_0`), mode `std` |
| Inputs | `start_image` = the scene's `-start.jpg`, `end_image` = its `-end.jpg` |
| Aspect | 9:16 |
| Resolution | 1080p |
| Duration | 4 s (the shortest), trimmed to the scene length in the edit |
| Audio | `generate_audio` off |
| Genre | auto |
Fallback if Seedance bends the text: Cinema Studio Video 3.0 (`cinematic_studio_3_0`), same two frames, 1080p, audio off.

Put this line at the end of EVERY prompt:
> Locked-off camera, no zoom, no camera shake. All text, numbers and logos stay exactly as in the frames: sharp, unchanged, no new text, no extra objects, no people, no hands. Flat clean motion-graphics look, white background, red floor.

## Scene by scene
| # | Time | Start -> end frame | What moves | Prompt (add the locked line after it) |
|---|---|---|---|---|
| 1 | 0-2.5 s | `01-hook-start` -> `01-hook-end` | The notification card drops in under the calculator | "A white notification card slides down from above and settles softly below the calculator card with a small bounce. The calculator card stays still." |
| 2 | 2.5-5 s | `02-free-start` -> `02-free-end` | Cursor taps the 9-year tile, the big monthly changes 591 -> 480, the black pill rises | "A small black cursor arrow moves to the left tile and taps it. The large red number rolls quickly to its new value. A black pill label rises into place under the card." |
| 3 | 5.75-9.5 s | `03-rebate-start` -> `03-rebate-end` | A red ring draws round the Rebate row, its value appears; then a ring on the NCD pill | "A thin red outline draws itself around the third row of the table. Then a second red outline draws around one pill in the bottom bar, which turns red." |
| 4 | 10.25-14 s | `04-lead-start` -> `04-lead-end` | Three white chips pop in left to right, then the notification card drops in | "Three small white pill labels pop in one after another from left to right. Then a white notification card slides down and settles below them." |
| 5 | 14.75-18.5 s | `05-viewer-start` -> `05-viewer-end` | The answer card rises in under the salary box, then the black pill | "A dark card with a car and a large price rises up from below and settles under the top card. Then a black pill label rises into place beneath it." |

## Edit order (22.5 s)
1 hook · 2 free · card "Rebat & NCD" (0.75 s) · 3 · card "Lead" (0.75 s) · 4 · card "Premium" (0.75 s) · 5 · CTA (4 s).
Hard cuts only, no fades (STYLE.md). Timing source: `src/live/timeline.json`.

## Check before using any clip
- [ ] Freeze the last frame: every number equals the END still (591 / 480 / 462, 44,990, 872, 1,000, 4,399, 40,463, 868)
- [ ] "Drevo" and both headline lines are spelled exactly as in the still
- [ ] No hand, face, extra phone, brand logo or TikTok / Excel screen appeared
- [ ] Nothing a viewer must read drifted outside x 60-900, y 220-1440
