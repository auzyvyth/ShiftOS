# Lessons from the Drevo ads

One section per ad, newest last. Add yours when an ad ships.

## Ad 1: Premium features tour (2026-11-02/03)

Read this before making the next ad. The owner was not happy with the result. These are the
mistakes, so the next one starts from them instead of repeating them.

### What went wrong
1. **Built when only a script was asked for.** Do exactly the step asked. A script ask means a script.
2. **Faked the product.** The first cut redrew the calculator in code, cropped and messy, beside a
   full Excel. The owner had said "use the real one". An ad for a real product must show the real
   product: record it (harness/record.cjs), never redraw it.
3. **Built before seeing the references.** The owner had reference videos. Get them first, name what
   they do (shapes, shadows, ambient light, one element at a time, big type), and match that. My own
   taste came second and lost.
4. **Ignored the named tool.** "Use Remotion" was said early; the first build was HTML.
5. **Two-hour feedback loop.** A full 47 s render took ~30 min per language, and the owner waited
   hours to see each change. Show stills of each scene first (seconds to make), then a 5-10 s clip,
   and render the full ad only after the owner signs off on the frames.
6. **The owner caught layout bugs I should have caught** (Studio price and labels misplaced, car
   bigger than its window). I checked loudness and black frames, not the picture. Before sending,
   look at a still from every scene as a viewer would.
7. **Changed approved copy on my own** ("SA Proton" -> "SA kereta"). I flagged it, but should have asked.
8. **Did not challenge the brief.** Retention is ~10%, so most viewers see 3-5 s. Nine features in
   47 s is a product tour, about 4 s each. I should have said so up front and proposed that the
   first 5 s carry the whole sale (problem, payoff, offer), with the tour as the tail for the few who stay.

## Process for every ad
1. Script or storyboard only, in words. Owner approves.
2. References in hand. List what to copy from them.
3. One still per scene (`node tools/stills.cjs`). Owner approves the look.
4. Hook clip only (first 5 s), with sound. Owner approves.
5. Full render. Look at every scene's still before sending. Then loudness + black-frame checks.
6. Add this ad's lessons below.

## Ad 2: Renewals (2026-11-03/04). What went right, and what nearly went wrong
1. **Dig into the feature before scripting it.** Reading the code and the live data turned up three
   bugs the ad would have promised: the renewal alert never showed in the seller's own list, it only
   fired on exactly day 30 / day 7, and the drafted message signed off "XDrive". They were fixed (on
   staging) before any frame was made. An ad must not sell a feature that does not work.
2. **Check the law before a money angle.** "SAs earn from renewals" would have told unregistered SAs to
   act as insurance agents (Financial Services Act 2013). The money angle became "a reason to reach out
   every year", which is true for everyone.
3. **Real buyer data never goes on screen.** Customer rows are personal data. Sample buyers, fake
   numbers, "Contoh data" on screen.
4. **Re-read prices on the day.** Pricing changed on `main` mid-session (#574, RM35 only for the first
   10 sellers). The renewals CTA says so; the Premium ad still needs a re-render.
5. **Measure element positions in the same run as the screenshot** (`rects.json`). The renewals list
   scrolls to the focused buyer, and by a different amount per language, so typed coordinates miss.
6. **The test browser prints US dates** unless launched with `--lang=en-GB` and `LANG=en_GB.UTF-8`.
   The still showed 11/03/2027 for 3 Nov 2027.
7. **A drawn black shape wrecks 60/30/10.** A black lock screen was 29% of its frame. Draw OS chrome white.
8. **Check every headline at full size in both languages.** "Reminded for a year." wrapped to three
   lines and covered the card; it became "We'll remind you."
9. **TikTok covers the bottom ~480 px.** Fine print at y 1530-1640 in both ads sits under the caption.
   Found only while writing `DESIGN.md`; fix in the next render (move it to about y 1380).
10. **An ad needs its own sound script.** The first full-render request found the renewals ad silent.
    Write the audio cues as soon as the timing is fixed, from the same timing file.
