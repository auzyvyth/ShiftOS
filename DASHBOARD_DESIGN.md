# Dashboard design language — "quiet terminal"

The look built for **Market Demand** (`src/components/MarketDemandTab.jsx`), to be
reused across every dealer and salesman dashboard surface: stat tiles, tables,
trends, analytics panels.

`DESIGN.md` covers the PUBLIC marketplace (dark, marketing, sells a car).
This file covers the LOGGED-IN dashboards (light, dense, reports a number).
They are different products and must not borrow each other's rules.

Reference implementation: `src/components/MarketDemandTab.jsx`. When something
here is ambiguous, that file is the tiebreak.

---

## 1. The idea in one line

**A trading terminal, on a light surface.** The density, the tabular figures, the
signed deltas and the sparklines are what make it read as a terminal — not a dark
background. Bloomberg's authority comes from information per square inch, not from
being black.

Two consequences, both non-negotiable:

- **Never darken a dashboard panel to make it feel "pro".** The dealer dashboard is
  light (`CLAUDE.md` > Theme). A dark card inside it reads as broken, not premium.
- **Never pad a dashboard like a marketing page.** Whitespace signals importance on
  a landing page and signals emptiness on a dashboard. Tight is trustworthy here.

---

## 2. Tokens

Declare these as module constants at the top of the file, not inline hex.
Source: `src/components/MarketDemandTab.jsx:38-42`.

```js
const UP    = '#059669';  // positive delta, rising sparkline
const DOWN  = '#dc2626';  // negative delta, falling sparkline (= the brand red)
const MUTED = '#6b7280';  // labels, secondary figures, the em dash
const INK   = '#111827';  // primary figures and text
const LINE  = '#e5e7eb';  // card borders, header rule
```

Two more, used inline because they appear once or twice each:

| Use | Value |
|---|---|
| Card / panel background | `#fff` |
| Table header band | `#f9fafb` |
| Row separator (lighter than `LINE`) | `#f3f4f6` |

**Green is `#059669`, not Tailwind `green-500`.** It is desaturated on purpose so a
column of deltas does not vibrate. Red doubles as the brand accent, which is why
there is no third accent colour anywhere on these surfaces — see §8.

---

## 3. Numbers

**Every figure that can change gets `fontVariantNumeric: 'tabular-nums'`.**
This is the single highest-leverage rule in the document. Without it, digits have
different widths, a column of numbers wobbles as it updates, and the whole surface
stops looking like an instrument. Applies to tile values, table cells, delta
percentages, axis labels, counts in chips.

Scale:

| Role | Size | Weight | Colour |
|---|---|---|---|
| Tile headline figure | 22 | 700 | `INK` |
| Table cell | 13 | 400 | `INK` |
| Delta (inline, small) | 11 | 600 | `UP` / `DOWN` |
| Delta (standalone) | 12 | 600 | `UP` / `DOWN` |
| Secondary figure / sub-label | 11 | 400 | `MUTED` |
| Micro-label (see §4) | 10 | 600 | `MUTED` |

Format large counts with `toLocaleString()`. Percentages get one decimal
(`value.toFixed(1)`) — two is false precision, zero hides real movement.

---

## 4. Micro-labels

Every label above a figure is uppercase, 10px, 600 weight, letter-spaced, `MUTED`.

```js
{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: MUTED, fontWeight: 600 }
```

`.08em` on tile labels (`MarketDemandTab.jsx:116`), `.07em` on table headers and
section headings (`:292`, `:528`) — the tighter value stops long column headers
from pushing a table wider than the viewport.

This is what carries the terminal feel in the typography. Sentence-case labels at
13px turn the same layout into a generic admin panel.

---

## 5. The delta

A signed, coloured, arrowed change figure. `Delta` at
`src/components/MarketDemandTab.jsx:63-85`.

Rules, in order of how often they get broken:

1. **Always show the sign on positive numbers** — `+9.7%`, never `9.7%`. An
   unsigned number reads as a level, not a change.
2. **Three states, three renderings.** A number renders coloured with an arrow.
   `Infinity` means growth from zero and renders the word **NEW** in green — not
   `+∞%`, not `+100%`. `null` means both sides are zero and there is nothing to
   say; it renders an em dash `—` in `MUTED`.
3. **Never render 0% growth from nothing as a real number.** The helper that
   produces this contract is `chg(cur, prev)` at `:57`; copy it rather than
   writing `((a-b)/b)*100` inline, which yields `NaN` or `Infinity` in the UI.
4. Percentage points use `pp`, not `%` (`pass pp`). An EV share moving 3.7 → 8.7
   rose 5.0**pp**, and calling that "+135%" is a different and more confusing fact.
5. Arrow is `TrendingUp` / `TrendingDown` from lucide, `strokeWidth={2.5}`, sized
   to the text (11 small / 12 standalone).

---

## 6. The sparkline

Hand-rolled inline SVG. `Spark` at `src/components/MarketDemandTab.jsx:88-107`.

**Do not reach for recharts for a per-row trend.** There is one of these per table
row; a chart library instance per row is a real cost for a shape that is nine lines
of SVG. recharts stays for full-size charts that need axes, tooltips and legends.

Spec:

- Default `92 × 26`. Roughly a golden-ish ratio at a size that survives a 13px row.
- `strokeWidth 1.5`, `strokeLinejoin`/`strokeLinecap` `round`, `opacity 0.9`.
- **Colour is direction, not brand**: `series[last] >= series[0] ? UP : DOWN`.
- **A dot terminates the line** at the latest value (`r=2`, same colour). The eye
  needs to know which end is now.
- Self-scaling to its own min/max with a 3px vertical inset (`h - 3`, `h - 6`), so
  a flat series does not divide by zero (`span = max - min || 1`) and a spike does
  not clip.
- `aria-hidden="true"`. The number beside it is the accessible content; a
  screen reader reading 13 coordinates is noise.
- Fewer than 2 points renders an empty `<svg>` of the same size, never `null` —
  otherwise the column width jumps as rows load.

---

## 7. Components

### Stat tile
`Tile` at `src/components/MarketDemandTab.jsx:109-134`.

`#fff`, `1px solid LINE`, `borderRadius 10`, padding `10px 12px`. Micro-label,
then the 22px figure, then a row holding the delta and an optional `MUTED`
sub-note. `minWidth: 0` so it can shrink inside a grid.

**A tile states one number.** If it needs two, it is two tiles.

### Quote strip
The row of tiles across the top:

```js
{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }
```
(`MarketDemandTab.jsx:331`)

`auto-fit` + `minmax` is the whole mobile story for tiles — 4 across on desktop,
2 on a phone, no breakpoints, no media queries. **Four tiles maximum.** Six is a
wall nobody reads.

### Data table
Header (`:291-296`) and cell (`:297-300`) styles.

- Header: micro-label style on `#f9fafb`, `position: sticky; top: 0; zIndex: 1`,
  bottom border `LINE`.
- Cell: `padding 8px 10px`, 13px, `INK`, tabular figures, bottom border `#f3f4f6`.
- **Numbers right-aligned, text left-aligned.** Right alignment is what lets the
  eye compare a column at a glance; it is not a preference.
- Sortable headers show the active column in `INK` against `MUTED` siblings, plus
  a `▾`. Sorting is client-side over already-loaded rows.
- `whiteSpace: 'nowrap'` on both. A table that wraps stops being scannable.

Scroll containment (`:406`):
```js
{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }
```
with `minWidth: 640` on the `<table>`. The table scrolls inside its own box; the
page never scrolls sideways. This is the mobile rule for tables — do not attempt
to reflow a dense table into cards on a phone.

### Bars
For a distribution inside a detail panel: a full-width `#f3f4f6` track with a
filled span, `height 6`, `borderRadius 3`, label left, tabular figure right.
No axis, no gridlines, no legend at this size.

---

## 8. Anti-patterns

Inherits every rule in `CLAUDE.md` > *Anti-slop UI rules*, plus:

- **No decorative left accent bar** on a row or card. Already banned project-wide;
  it is the single most common way a dense table gets ruined.
- **One accent per panel.** Green and red here are semantic (up and down), not
  decorative — that is why they are allowed to sit together. Adding amber, purple
  or blue on top turns a terminal into a dashboard template.
- **No gradient, no shadow, no glow** on a data surface. Borders separate; elevation
  does not.
- **No number without a period.** "80,030" is not a fact. "80,030 last month" is.
  Every figure states its window, in the label or the sub-note.
- **No invented number, ever.** Project-wide rule (`CLAUDE.md` > AI trust boundary).
  On these surfaces it also means: do not render an estimate, a projection or a
  computed valuation beside real figures in the same visual style. If the source
  cannot answer, say so in words — `MarketDemandTab.jsx` does this for models JPJ
  does not break out, rather than rendering a zero that reads as "no demand".
- **No empty state that looks like bad news.** Distinguish loading from empty from
  failed. A failed read renders a retry, never "no results" — a salesman who sees
  "no sold deals" believes their win vanished.
- **No icon-only control** in a dense row. At 13px there is no room for a tooltip
  to save it.

---

## 9. Checklist before shipping a dashboard surface

- [ ] `tabular-nums` on every changing figure
- [ ] Deltas signed, and `Infinity` / `null` handled as **NEW** / `—`
- [ ] Micro-labels uppercase 10px 600 `MUTED`
- [ ] Numbers right-aligned in tables, header sticky
- [ ] Wide content scrolls in its own box; page body does not scroll sideways
- [ ] Light surface, `INK` / `MUTED` text — nothing borrowed from the dark marketplace
- [ ] Four tiles or fewer in the quote strip
- [ ] Loading, empty and error are three distinct states
- [ ] Renders at 375px
