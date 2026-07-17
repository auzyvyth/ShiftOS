# DESIGN.md — Public Marketplace Design Language

Scope: the public XDrive surfaces — `MarketplacePage`, `MarketplaceHeader`,
`CarListingPage` (showroom), `CarDetailPage` (xdrive light theme), `CarCard`,
homepage/marketing. The **dealer dashboard** has its own light theme documented
in `CLAUDE.md` (Theme section) — do not apply this file to dashboard panels.

Read this before touching any public-facing UI. It exists to stop generic
"AI-slop" drift: every value below is already in the codebase — match it, don't
invent a new one.

## Anti-slop rules (non-negotiable)
- **No decorative filler.** Banned: pulsing/glowing dots as ornament, gradient
  "glow blob" backdrops added for vibe, glassmorphism pills, emoji in UI, faux
  badges that carry no data. Decoration must encode real information.
- **Use the scales below.** No arbitrary one-off paddings/sizes. If a value
  isn't on a scale, you're guessing — pick the nearest scale step.
- **One headline system.** Display = Bebas Neue, everything else = Outfit (or
  system-ui on car detail/card). Never introduce a third UI font.
- **Color by role, exact hex.** No washed-out light-on-light. Pick the token
  for the surface you're on (light vs dark) — see Color.
- **Restrained elevation.** Two shadow levels only (resting + hover). No unique
  shadow per component.
- **Search-forward, not image-forward.** The hero's job is headline + obvious
  search/filter. Imagery and effects are secondary.

## Type
- **Display / headlines:** `'Bebas Neue', sans-serif` — uppercase, tight
  line-height (0.92–1.0), letter-spacing ~0.02em. Hero h1 `clamp(38px,10vw,96px)`.
  Section h2 `clamp(22px,3vw,44px)`.
- **Body / UI:** `'Outfit', sans-serif`. Card/detail bodies may use
  `system-ui, sans-serif` (CarCard, CarDetailPage) — keep per-surface consistency.
- **Roles:** eyebrow 10–11px / 700 / uppercase / letter-spacing 0.12–0.18em;
  body 13–15px / 400–500; label 13px / 600; price (card) 20px / 800.

## Color
Light surfaces (marketplace pages, car detail on xdrive):
- Page bg `#F7F6F2`; alt section bg `#F2F0EC` / `#EDEAE3` / `#EDE9E3`
- Card `#ffffff`; card-2 `#F0EEE8`
- Text: primary `#111827`, secondary `#4b5563`, muted `#6b7280`, faint `#9ca3af`
- Border: `rgba(0,0,0,0.06)` hairline → `rgba(0,0,0,0.12)` input
- Price-band text on light: below `#15803d`, fair `#1d4ed8`, above `#b45309`
  (the light/saturated `#4ade80`/`#93c5fd`/`#fbbf24` are DARK-theme only — they
  read as near-white on light. This bit twice.)

Dark surfaces (hero block, lightbox, dark car detail on subdomains):
- Bg `#08090f` / `#0d1117`; text `#ffffff`, secondary `rgba(255,255,255,0.45)`,
  muted `rgba(255,255,255,0.35)`; border `rgba(255,255,255,0.07)`→`0.12`

Accent (both): `#dc2626`, hover `#b91c1c`; soft fills `rgba(220,38,38,0.06–0.12)`.

## Spacing
Use this scale (px): **4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 72**.
Section vertical rhythm ~72px desktop / ~48px mobile.

## Layout / grid
- **Container:** `max-width: 1360px; margin: 0 auto`.
- **Horizontal gutter (one token everywhere):** `clamp(20px, 4vw, 48px)`.
  Header, hero, trust strip, brand strip, body-type strip, and the cars wrap all
  share it so every section's left/right edge lines up. Do not reintroduce
  per-section gutters (20/24/36/60) — that misalignment is the "clanky" look.
- **Card grid:** flex-wrap + `justify-content: center`; each card
  `flex: 1 1 280px; max-width: 340px`. Cards fill full rows but center on sparse
  rows / few results. Never use `repeat(auto-fill, minmax(…,1fr))` for cards — it
  reserves empty columns and cards hug the left.

## Elevation / radius
- Resting card shadow `0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.05)`
- Hover `0 12px 32px rgba(15,23,42,0.14)`, lift `translateY(-3px)`
- Radius: cards 16, buttons/inputs 9–10, pills/badges 20–50

## Motion
- Transitions 0.15–0.25s ease. Hover = subtle lift + shadow + accent border.
- No looping ambient animation as decoration.

## Breakpoints
480 / 520 (card compact) / 600 / 640 / 720 (header mobile) / 768 / 900 (hero
two-col) / 1024 (filter sidebar). Touch targets ≥ 40px. Verify at 375px.

## Nav state
Active nav underline (`#dc2626`) shows ONLY on the exact route — e.g. Showroom
is active on `/showroom`, not on `/marketplace`. Don't broaden the active match.
