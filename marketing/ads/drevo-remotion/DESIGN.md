# Drevo ad design system

How a Drevo ad LOOKS. How it MOVES and SOUNDS is `AnimationStyle.md`. The owner's short rule sheet is
`STYLE.md`, mistakes to avoid are in `LESSONS.md`, and how to build and render is in `README.md`.
The Claude skill that ties them together: `.claude/skills/drevo-ad/SKILL.md`.

(The repo-root `DESIGN.md` is the public marketplace's design system. This file is for ads only.)

Every value below is taken from the code that made the two finished ads. The file:line is given so you
can check it, or change the code and this file together.

---

## 1. Canvas

| | |
|---|---|
| Size | 1080 x 1920, portrait, 30 fps (`src/lib.js` `W`, `H`, `FPS`) |
| Length | 20-50 s. Premium ad 49.8 s, renewals ad 22.8 s |
| Languages | Every ad ships in BM and EN. All words live in one `COPY` object per ad |
| Output | H.264, CRF 21, AAC 192k, -14 LUFS, faststart (`README.md` finish command) |

## 2. Safe area: what TikTok covers

TikTok draws its own interface over the video. Anything under it is not seen. TikTok publishes exact
numbers only for ads, and tools disagree on the rest, so use the strictest common reading:

| Edge | Covered | What is there |
|---|---|---|
| Top | 0-220 px | "Following / For You" tabs, live badge |
| Bottom | 1440-1920 px (480 px), and up to 1260 px when the caption is long (660 px) | Caption, @name, sound credit |
| Right | x 900-1080, from y 840 to 1500 | Like, comment, save, share buttons, the avatar |
| Left | 0-60 px | Nothing fixed, but keep a 60 px gutter |

**Safe box for anything a viewer must read: x 60-900 (to 1020 above y 840), y 220-1440.**
Check a draft by uploading it as a private TikTok draft: the app shows its real overlay.

### Known breaks in the finished ads (fix in the next render)
- **Fine print sits at y 1530 (Premium ad) and 1640 (renewals ad)**, under the caption: the "estimate,
  the bank decides" and "sample data" lines are effectively hidden. Move `Fine` to about y 1380.
- The Premium ad's hook headline starts at y 78 (`src/scenes/Presenter.jsx:84`), under the tabs.
  The renewals ad's start at 150-170. New headlines start at **216**, as every other scene does.
- Renewals "Next" scene: the "Mesej / Message" button on the trade-up row sits at about x 960, y 945,
  under the like button. Crop or scale so the tapped thing sits left of x 900.

## 3. Colour: 60% white, 30% red, 10% black (owner's rule)

Tokens are in `src/ui.jsx:6-24`. Never type a colour into a scene.

| Token | Value | Share | Used for |
|---|---|---|---|
| `WHITE` | `#FFFFFF` | 60% | The room (background), cards, chips, the lock screen |
| `RED` | `#dc2626` | 30% | The floor, headline line 2, chapter cards, rings, the tap ripple, the CTA button |
| `RED2` | `#ef4444` | (with red) | Light end of red gradients, the pill dot |
| `INK` | `#0B0C0F` | 10% | Headline line 1, device frames, the offer pill, black buttons |
| `MUTED` | `rgba(11,12,15,0.55)` | | Secondary text on white |
| `ON_RED` | `#FFFFFF` | | Text on the red floor or a red card |

Rules:
- What we DRAW uses only these. No blue, green, amber or purple accents, not even for "success".
- **Real things keep their real colours**: app screens, posters, car photos, the seller's mini page.
  Salesman Premium is dark (`premiumDark`), so Premium screens push black up. Accept that, and keep
  every drawn object white or red.
- Text on the red floor is white. A button on the red floor is black, never red on red.
- A big drawn black shape breaks the rule fast: a black phone lock screen alone was 29% of the frame.
  Draw lock screens, cards and panels white with a light grey edge.
- **Measure, do not eyeball**: render stills, then `python3 tools/palette.py <dir>`. Targets for frames
  between cards: about 55 / 30 / 7, plus about 10% for photos and screens. Chapter cards are full red
  by design, so leave them out of the average. Measured: Premium ad 53/30/7, renewals ad 43/34/18
  (dark Premium screens).

### The room (`Ambient`, `src/ui.jsx:27`)
- White wall fading to `#F1F1F3` towards the horizon, with a faint red light pool (6%) drifting over it.
- Red floor from **y 1260** (`FLOOR`) to the bottom: `#ef4444` at the horizon, `#dc2626`, then
  `#a51b1b` towards the viewer. A white light pool slides across it, and a thin white highlight
  sits on the horizon line.
- Film grain is added at the finish (`ffmpeg noise=alls=2:allf=t`), never in the scene.

## 4. Type

One family: **Outfit**, 500 and 700 (`public/fonts`, loaded before frame 0). Nothing else.

| Role | Size / weight | Tracking | Colour | Where |
|---|---|---|---|---|
| Headline | 104 px / 700, line-height 1.02 | -4 | line 1 INK, line 2 RED | `Headline`, `src/ui.jsx:50` |
| Headline, long line | 86-98 px | -4 | same | `size` prop. Drop the size before letting it wrap to 3 lines |
| Chapter topic | 164 px / 700, line-height 0.98 | -6 | white + red shadow | `src/scenes/Card.jsx:24` |
| Chapter "Now:" | 76 px / 700 | -2 | white 88% | `Card.jsx:23` |
| Chapter number | 760 px / 700 | -40 | black 13% | `Card.jsx:19` |
| CTA line 1 / 2 | 132 / 116 px / 700 | -6 / -5 | INK / RED | `Cta`, `src/scenes/Features.jsx:333` |
| CTA price line | 38 px / 500, line-height 1.35 | 0 | MUTED | `Features.jsx:335` |
| CTA button | 64 px / 700 | 0 | white on red | `Features.jsx:337` |
| Body in drawn cards | 32-44 px / 500-700 | -1 on titles | INK, body at 72% | notification, draft message |
| Eyebrow / label | 24-28 px / 700, letter-spacing 3-5, uppercase | | RED or MUTED | `Headline eyebrow`, "DRAFT MESSAGE" |
| Fine print | 22 px / 500 | 0 | white 78% (on the floor) | `Fine`, `src/ui.jsx:136` |

Headline copy:
- **Two lines, 2-5 words each.** Line 2 is the payoff, marked red with `*...*` in `COPY`
  (`parseLine`, `src/lib.js`).
- A 104 px line holds about 18 characters. Check **both languages**: BM is usually longer.
  "Reminded for a year." wrapped to three lines and hid the card under it.
- Plain spaces break lines. Use ` ` to keep a phrase together ("Bajet & DSR").

## 5. Layout: the bands of the frame

Main ad and renewals ad use the same bands:

| y (px) | Band | What goes there |
|---|---|---|
| 0-216 | Clear | TikTok tabs. Nothing that must be read |
| 216-420 | Headline | Two-line headline, centred, 60 px side gutters |
| 430-1250 | Stage | The ONE thing this scene shows: a screen crop, a device, a card |
| 1260 | Horizon | The floor starts. Devices stand on it with a contact shadow |
| 1260-1440 | Floor, safe | The offer pill (y 1440, `OfferPill`), a second card, the CTA tag line (y 1300) |
| 1440-1920 | Floor, covered | Decoration only: device feet, light. Fine print does NOT go here (section 2) |

- One object on the stage at a time. A second object (the draft message under the buyer card) may
  appear only after the first has landed, and it overlaps the floor rather than squeezing the stage.
- Centre things. The only off-centre elements are the tap cursor and things recorded off-centre.

## 6. Components (reuse them, do not redraw them)

| Component | What it is | File |
|---|---|---|
| `Ambient` | The white room and red floor | `src/ui.jsx:27` |
| `Headline` | Two-line headline, word-by-word entrance, optional eyebrow | `src/ui.jsx:50` |
| `glass()` | White card: soft gradient, 1 px edge, long soft shadow, radius 36 | `src/ui.jsx:85` |
| `Device` | Black monitor/phone frame for a recording, with glow and floor shadow | `src/ui.jsx:94` |
| `Cursor` | Cursor that travels to each RECORDED tap (positions from `*.clicks.json`) | `src/ui.jsx:110` |
| `Fine` | Fine print line | `src/ui.jsx:136` |
| `Chip` | Pill chip | `src/ui.jsx:140` |
| `Card` | Red chapter card. Takes `now`, `topic`, `num` for any ad | `src/scenes/Card.jsx` |
| `Cta` | End card. Takes a `copy` override (price line) | `src/scenes/Features.jsx:326` |
| `OfferPill` | Black "Try Premium free for 7 days" pill (Premium ad) | `src/scenes/Features.jsx:351` |
| `Shot` | A crop of a real app screenshot, scaled up, with a rounded edge and shadow | `src/renewals/Renewals.jsx` |
| `Rise` | Wrapper that brings the stage object in | `src/renewals/Renewals.jsx` |
| `Ring` | Red ring around one real element in a `Shot` | `src/renewals/Renewals.jsx` |
| `Tap` | Cursor + ripple on one real element in a `Shot` | `src/renewals/Renewals.jsx` |
| Lock screen + notification | Phone OS drawn in white, notification in `glass` | `Renewals.jsx` `Hook` |

New components go in `src/ui.jsx` once a second ad needs them. `Shot`, `Ring`, `Tap` and `Rise` are
next in line to move there.

## 7. Showing the real product (owner's hard rule)

**Never redraw an app screen in code.** The first ad did, and it was the worst part. Use one of these:

| Way | When | How |
|---|---|---|
| Screen recording | Anything that moves: typing, taps, the Live presenter | `harness/record.cjs`: scripted taps on the real component in the Vite harness. Taps are saved to `*.clicks.json` so the cursor and sounds land on them |
| Screenshot crop | One state of a screen: a list, a card, a checklist | `harness/sold.cjs` pattern: real component + sample data, phone size at 3x, clock fixed, element positions saved in the SAME run (`src/renewals/rects.json`) |
| Real component in Remotion | A small component whose logic matters (the coach line) | Import from `src/`, React aliased in `remotion.config.js` (`Coach`, `Features.jsx:112`) |
| The app's own renderer | Posters, cut-outs | `harness/tools.cjs` calls `renderLoanPoster`, `drawMotionFrame`, `cutOutBackground` |

- **Readable on a phone**: app text is 10-13 px. Shown at 1:1 in a 1080 frame it is unreadable.
  Crop to the one card that matters and scale it about 2.3-2.75x so body text lands near 30 px.
  The coach rows use K = 2.75, the renewals crops 900-940 px wide from a 358 px card.
- **Drawn things allowed**: the phone OS (lock screen, notification banner, keyboard), arrows,
  rings, cursors, light. A notification must quote the app's REAL push text
  (`supabase/functions/expiry-reminders/index.ts` for renewals).
- **Third-party apps (WhatsApp)**: never draw their interface or logo. Show our button and a plain
  white "draft message" card with the app's real draft text.
- **Data**:
  - Public listing data and photos: only from the owner's own seller accounts (premiummotors) or with
    the seller's OK. Real numbers are labelled ("Real premiummotors data, 3 Nov").
  - Buyer data (names, phones, plates, IC): never real, it is personal data (PDPA). Use made-up buyers
    with fake numbers (`0100000001`) and label the scene "Sample data / Contoh data".
  - Loan figures come from the app's maths and carry "estimate, the bank decides".
- **Browser setup for screenshots**: launch with `--lang=en-GB` and `LANG=en_GB.UTF-8`, or date boxes
  print US dates (11/03/2027 instead of 03/11/2027).

## 8. Words on screen

- Say **Drevo**, never XDrive. The app still shows XDrive in places until switch night: hide or
  replace it in the recording (the harness swaps `.lp-brand`, `harness/main.jsx`).
- No invented numbers, promises or approvals. Every number on screen is either the app's output or a
  fact with a source in the fine print.
- **Prices must match `src/utils/planConfig.js` the day you render.** Pricing changed mid-session once
  (#574: RM35 only for the first 10 sellers, RM49 after).
- Money claims need a legal check first (CLAUDE.md "Legal subjects"). Example: "earn commission on
  renewals" would push SAs into acting as unregistered insurance agents (Financial Services Act 2013).
- CTA: "Cuba Premium 7 hari percuma" / "Try Premium free for 7 days" + drevo.my. Post only after the
  drevo.my switch.

## 9. Do / don't

| Do | Don't |
|---|---|
| One object on the stage | Two screens side by side |
| Crop and scale real screens | Shrink a whole phone screen into the frame |
| White drawn surfaces | Large drawn black or dark-grey shapes |
| Red for line 2, rings, the CTA | Red text on the red floor |
| Check both languages at full size | Approve EN and assume BM fits |
| Keep readable things in y 220-1440 | Fine print at the bottom of the frame |
| Label sample and real data | Real buyer names or numbers |
