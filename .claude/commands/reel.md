---
description: Make a Drevo reel (script, storyboard, animation) in the house style, with an approval at each gate
argument-hint: [idea number or a feature name]
---

Make a vertical Drevo reel for car salespeople in Malaysia. Topic: $ARGUMENTS

Load the `drevo-ad` skill first and follow it. It owns the style, the files and the checks.
This command only adds the order of work and the idea menu. Do not copy its rules here.

## 1. Pick the idea (stop here if no topic was given)
Show this menu, say which one you would pick and why, then wait.
Every idea must come from a feature that exists and works today. Check the code before you promise it.

| # | Type | Idea | Product behind it |
|---|---|---|---|
| 1 | Problem | A buyer messages and you answer hours late | In-app chat, push, "This week" |
| 2 | Problem | Leads go quiet and nobody calls them back | "This week" call list |
| 3 | Question | "Berapa bulanan?" answered on camera | Live presentation calculator |
| 4 | Question | "Gaji RM berapa, dapat kereta apa?" | Budget tab, Viewer view |
| 5 | Give-away | The loan poster in 30 seconds | Loan poster (Lite: 4 cars a month) |
| 6 | Give-away | Check the file before any bank sees it | Loan check (Premium) |
| 7 | After sale | Handover steps and JPJ, nothing forgotten | Handover checklist |
| 8 | After sale | Renewals reminder (ALREADY MADE) | `src/renewals` |
| 9 | Tour | Premium features (ALREADY MADE) | `src/Ad.jsx` |
| 10 | Page | One link per brand for your TikTok bio | Page by brand |

## 2. The gates (each waits for the owner's OK)
1. **Dig + legal**: skill steps 1 and 2. Flag what the product does not do yet.
2. **Script**: scene table, BM + EN, the hook fact with its source. Save to `briefs/<ad>.md`.
   Push back if it is too long. Then STOP.
3. **Storyboard**: one still per scene, both languages, as a contact sheet. Run `tools/palette.py`
   and look at every frame yourself. Then STOP.
4. **First 5 s with sound**, then STOP.
5. **Full render**: both cuts, then the skill's checklist. Send with `SendUserFile`.

## 3. Where the reel video differs from our rules (owner decides, never you)
- It uses a voice. Our STYLE.md says music and effects only, no voice-over. Keep it that way
  unless the owner says otherwise.
- Its captions follow each spoken word. Ours have no speech, so the words that pop in are the
  headline words, timed from `timeline.json`. Check each word lands on its sound cue.
- It checks its own frames. Always do this: a still of every scene in both languages before sending.

## 4. After it ships
Add the lessons to `LESSONS.md`, offer BM + EN post captions in `final/captions.md`.
