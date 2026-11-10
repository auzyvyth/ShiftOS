# Higgsfield direction script: the Live ad, story cut

Frames to upload: `final/live-story-frames/ms/` and `/en/` (1080x1920). Sheets: `final/live-story-stills-ms.jpg`, `-en.jpg`.
Script and rules: `briefs/live-newcar.md` ("Story cut"). Scenes in code: `src/live/LiveStory.jsx`.

## Which beats go to Higgsfield, and which do not
| Beat | Frame | Higgsfield? | Why |
|---|---|---|---|
| 1 Live | `1-live.jpg` | Yes | An object (ring light) and three short comments. Little text, no prices. |
| 2 Excel | `2-excel.jpg` | Yes | A grid and one number (480). Check that number. |
| 3 Drevo | `3-lead.jpg` | Yes | A red beam and one card. |
| 4 Percuma | `4-free.jpg` | No, Remotion | The whole presenter: about 40 small numbers. A video model redraws them. |
| 5 Satu tap | `5-rebate.jpg` | No, Remotion | Same. |
| 6 Dapat apa? | `6-viewer.jpg` | No, Remotion | Same. |
| 7 End card | `7-cta.jpg` | Optional | Logo and price line must stay exact; safer from Remotion. |
A changed digit on an app screen is a false price in an ad, so beats 4-6 are rendered here, exact.
Test beat 1 first: 100 credits on the account and the connector does not show the cost of a clip.

## Settings for every clip
Model Seedance 2.0 (`seedance_2_0`), mode `std` · `start_image` = the beat's frame · 9:16 · 1080p · 4 s ·
`generate_audio` off. Fallback: Cinema Studio Video 3.0, same frame.
End every prompt with:
> Locked-off camera. Editorial paper-collage motion graphics, warm cream paper with film grain, black and one red only. All text and numbers stay exactly as in the frame: sharp, unchanged, no new text, no people, no hands, no logos.

## Prompts
**Beat 1, `1-live.jpg`**
> The ring light on its stand glows softly and brightens. The three white comment cards drop in one after another from above and settle with a small bounce, each slightly tilted. Slow push-in on the whole frame.

**Beat 2, `2-excel.jpg`**
> Dark spreadsheet grid drifts slowly towards the camera. The red-outlined cell pulses once. Faint dust and film grain move across the dark background.

**Beat 3, `3-lead.jpg`**
> A red spotlight beam sweeps in from the top right and lands as a red circle at the lower left. The white notification card slides onto the circle and settles, slightly tilted, with a soft shadow.

**Better with a real object (optional, text added afterwards in Remotion):** generate these with NO text in
the frame, then send me the clips and I lay the words over them.
> Beat 1 object: a real ring light on a tripod with a phone mounted in the middle, cut-out collage style on plain warm cream paper, hard studio shadow, slow 10-degree turn, film grain, black and one red accent, no text, no people.
> Beat 2 object: an old desktop calculator on a black background, one red key, slow drift into frame from the left, dramatic side light, film grain, no text, no brand names.

## Check before using any clip
- [ ] Words are spelled exactly as in the frame; "480" is still 480
- [ ] No hand, face, brand logo, TikTok or Excel screen appeared
- [ ] Only cream, black and one red
