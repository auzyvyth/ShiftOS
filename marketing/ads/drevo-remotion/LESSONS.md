# Lessons from the first Drevo ad (2026-11-02/03)

Read this before making the next ad. The owner was not happy with the result. These are the
mistakes, so the next one starts from them instead of repeating them.

## What went wrong
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

## Process for the next ad
1. Script or storyboard only, in words. Owner approves.
2. References in hand. List what to copy from them.
3. One still per scene (render a single frame: `npx remotion still`). Owner approves the look.
4. Hook clip only (first 5 s), with sound. Owner approves.
5. Full render. Look at every scene's still before sending. Then loudness + black-frame checks.
