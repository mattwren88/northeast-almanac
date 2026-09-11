# Handoff: Northeast Almanac — Week grid, Weekend, Drawer, Filters

## Overview

A polish pass on the Almanac's four core desktop views: the week grid, the weekend
view, the event drawer, and the filters panel. The goal was hierarchy and motion —
make today and the weekend read louder than filler days, make each event card
scannable time-first, cut visible furniture, and add motion to the four
interactions that currently snap.

Nothing about the data model, scraper, source registry, or routing changes. This is
a presentation-layer pass: `src/calendar.jsx`, `src/views.jsx`, `src/app.jsx`, and
`src/style.css`.

## About the Design Files

The two files in this bundle are **design references created in HTML** — prototypes
showing intended look and behavior, not production code to copy. They are
single-file Design Components with inline styles and their own small runtime, which
is nothing like the real app's structure.

The task is to **recreate these designs in the existing React + Vite codebase**,
using its established patterns: components in `src/*.jsx`, styling as BEM-ish
classes in `src/style.css`, tokens as the existing OKLCH custom properties. Do not
port inline styles, do not introduce a CSS-in-JS library, and do not restructure
the component tree. Every value below already has a home in `style.css`.

## Fidelity

**High-fidelity.** Colors, type, spacing, and motion values are final and are
transcribed below. The numbers come from the existing `src/style.css` token set
wherever one existed; new values are called out as new. Recreate pixel-for-pixel.

## Reference files

| File | What it is |
| --- | --- |
| `Almanac Current.dc.html` | Faithful recreation of the app as it stands today — the before picture. Built from `src/app.jsx`, `src/calendar.jsx`, `src/views.jsx`, `src/style.css`. |
| `Almanac Redesign.dc.html` | The target. Same four views with the changes below. |
| `almanac-data.js` | Fixture data for both files — events verbatim from `public/mock-events.json`, categories and weather verbatim from `src/lib/data.js`. Reference only; the real app has its own data layer. |

Both files have a theme toggle in the masthead (the ☾/☀ button, left of My Plan) and
carry light and dark. Day 0 is anchored to Sat 18 April 2026 so the weekday rhythm
matches the fixture set.

Two things in the reference files are **not** part of the work: the Map and Index
view tiles render a "not in this pass" stub, and My Plan is a non-functional button.
Leave the real implementations alone.

---

## Change 1 — Editor's Picks rail removed from the grid views

**Current:** `showPicks` renders a four-across rail of featured events above the
grid in every view except Map. Each card is № 01–04, category label, 22px display
title, blurb, and a dotted-rule footer with when/where.

**Target:** the rail does not render in the week grid or the weekend view. It was
cut entirely rather than relocated — the featured events are already in the grid,
marked with a "Pick" chip on the card, so the rail was duplicating them directly
above themselves.

The `featured` flag on an event keeps its meaning and still drives the card chip.
If the rail is wanted on a future view, the markup is intact in
`Almanac Current.dc.html`.

## Change 2 — Weather advisory reduced to a hairline

**Current:** a rounded blue box — `--na-wx-bg` ground, `--na-wx-border` 1px border,
6px radius, 10px/14px padding, 12px mono in `--na-wx-ink`, a 16px ☂ glyph. It is
the only element in the app using the `--na-wx-*` ramp, and the only blue and the
only 6px radius on a page whose entire vocabulary is hairline rules and hard edges.

**Target:** the same sentence as furniture.

- Container: `margin: 18px 0 0`, `padding: 8px 0`, `border-top` and `border-bottom`
  `1px solid var(--na-rule-soft)`, no background, no radius
- Layout: flex, `align-items: center`, `gap: 10px`
- Glyph: ☂ at 13px, `line-height: 1`, `color: var(--na-press-red)`
- Text: `var(--na-mono)` 10.5px, `letter-spacing: 0.1em`, `text-transform: uppercase`,
  `color: var(--na-ink-3)`

Copy and trigger logic are unchanged: renders when the visible week has at least one
rainy day AND at least one dimmed outdoor event, week grid only. Text reads
`"{n} rainy days ahead — {m} outdoor events are dimmed in this view"`, singularized
on both counts.

The `--na-wx-*` variables become unused by this change. Decide whether to keep them
for the drawer forecast stat or drop them.

## Change 3 — Day headers cut to essentials

**Current header, per column:** weekday in mono, a "today" chip, a 42px numeral,
then a row with `☀ 68°/49°` on the left and `6 events` on the right. Border-bottom
is `1px dotted var(--na-rule)`.

**Target:** two rows.

Row 1 — flex, `align-items: baseline`, `gap: 7px`:
- Weekday: `var(--na-mono)` 10px, `letter-spacing: 0.16em`, uppercase, color per
  emphasis (Change 4)
- "today" chip, when applicable: `background: var(--na-press-red)`,
  `color: var(--na-paper)`, mono 9px, `padding: 1px 6px`, `letter-spacing: 0.08em`
- Weather, `margin-left: auto`: flex, `align-items: baseline`, `gap: 4px`,
  `color: var(--na-ink-3)` — condition glyph at 11px `line-height: 1`, then
  high/low as `var(--na-mono)` 10px `letter-spacing: 0.02em` reading `68°/49°`.
  The wrapper carries `title="{cond} · {high}°/{low}°"`

Row 2 — the date numeral: `var(--na-display)`, size and color per emphasis,
`line-height: 1`, `margin-top: 2px`, `letter-spacing: -0.02em`

Header padding `13px 13px 11px`; border-bottom changes from `1px dotted var(--na-rule)`
to `1px solid var(--na-rule-soft)`.

**What came off:** the event count, and the temperature's separate row. The count
was the clearest cut — the events are right there to be counted, and the number
competed with the numeral two lines above it. Temps were first removed entirely and
then restored on request, folded into row 1 beside the glyph.

Weekend view uses the same structure at larger sizes: padding `18px 20px 14px`,
weekday 11px at `0.2em`, glyph 13px, temps 11px, numeral 72px with
`letter-spacing: -0.03em` and `margin-top: 4px`.

## Change 4 — Today and the weekend read louder

A day is "loud" if it is today or (when weekend emphasis is on) a Saturday or
Sunday. Three properties move together:

| | Loud day | Quiet day |
| --- | --- | --- |
| Column background | `var(--na-paper-3)` | `transparent` |
| Numeral size (week grid) | 46px | 34px |
| Numeral color | `var(--na-ink)` | `var(--na-ink-3)` |
| Weekday label color | `var(--na-ink-2)` | `var(--na-ink-3)` |

Today additionally overrides the numeral to `var(--na-press-red)` and keeps the
existing `3px solid var(--na-press-red)` top rule with `margin-top: -3px`. Quiet
days carry a transparent 3px top rule so the baseline does not shift.

**Current behavior for comparison:** all seven numerals are 42px in `--na-ink`, and
only Sat/Sun get the `--na-paper-3` tint. The grid reads as seven equal columns.

Weekend emphasis is exposed as a switch in the reference file (`emphasizeWeekend`)
so the difference is easy to see; in the real app it can be hardcoded on.

## Change 5 — Event cards are time-first

**Current card:** a 3px category spine, then a wrapping mono meta row carrying
time + "Editor's pick" + "Hidden gem" + a ↻ recurrence glyph, then a 16px title,
venue · town, then a footer row with category label, price, and a ☆/★ button. Six
rows of roughly equal weight; the time is one chip among four in the top row.

**Target card:** same 3px spine, `grid-template-columns: 3px minmax(0, 1fr)`,
`background: var(--na-paper-3)`, `border: 1px solid var(--na-rule-soft)`, content
padding `8px 10px 9px`, `min-width: 0`.

Rows, in order:

1. **Time** — `var(--na-mono)` 12px, `font-weight: 500`, `letter-spacing: 0.02em`,
   `color: var(--na-ink)`. Alone on its line. Start time only, formatted by the
   existing `fmtTime`; an all-day event (`00:00`–`23:59`) reads `All day`.
2. **Title** — `var(--na-display)` 17px, weight 400, `line-height: 1.08`,
   `margin: 3px 0 4px`, `letter-spacing: -0.005em`, `text-wrap: pretty`
3. **Venue · town** — 11.5px, `line-height: 1.3`. Venue italic in `var(--na-ink-2)`;
   `·` separator with `margin: 0 4px` in `var(--na-ink-3)`; town in `var(--na-ink-3)`
4. **Blurb** — two lines, clipped. `margin: 5px 0 0`, 12px, `line-height: 1.35`,
   `color: var(--na-ink-3)`, `text-wrap: pretty`, clamped with
   `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden`
5. **Footer** — `margin-top: 7px`, flex, `align-items: center`, `gap: 6px`, mono
   9.5px at `0.06em`: category label in the category color at weight 500; then a
   "Pick" chip for featured events (`color` and `1px solid` in `var(--na-press-red)`,
   `padding: 0 4px`); then, `margin-left: auto`, a ★ at 12px in `var(--na-gold)`
   when the event is saved
6. **Rain note**, outdoor events on rainy days only — `margin-top: 6px`, mono 9px,
   `color: var(--na-press-red)`, `letter-spacing: 0.06em`, reading
   `Outdoor · rain forecast`. The card itself also drops to `opacity: 0.55`

**What came off the card:** price, the ☆/★ save button, the "Hidden gem" chip, and
the ↻ recurrence glyph. Price and cadence live in the drawer's stat grid; the hidden
flag stays in the data and is still surfaced in the drawer tagline. Blurb is new on
the card — it was drawer-only before.

## Change 6 — Saving moves into the drawer

**Current:** every card in both grid views carries a ☆/★ button in its footer that
toggles the event in My Plan, `stopPropagation`'d so it does not open the drawer.

**Target:** no save control in the grid. Saving happens in the drawer, via the
existing full-width button — `☆ Add to plan` / `★ Saved to plan`, `var(--na-ink)`
ground going `var(--na-press-red)` when saved.

A saved event is still legible in the grid: the small gold ★ in the card footer
(Change 5, row 5). It is an indicator, not a control.

This is a real tradeoff — saving goes from one click to two. It was chosen
deliberately: the ☆ was the only interactive control inside a card that is itself a
button, it sat in the footer where the eye lands last, and removing it is what let
the footer collapse to a single quiet line. If bulk-saving from the grid turns out
to matter, the honest fix is a hover-only ★ in the card's top-right, not restoring
the footer button.

## Change 7 — Motion on four interactions

One curve throughout: `cubic-bezier(0.2, 0.8, 0.2, 1)`.

**Drawer open and close.** Currently opens on `naSlideIn` (20px from the right,
250ms) and closes by unmounting instantly. Target: `naDrawerIn` — 34px from the
right with opacity, 280ms — and a real exit, `naDrawerOut` — 34px out, 200ms
`ease-in`, `forwards`. The scrim fades out over the same 200ms. Implementation is a
`closing` flag: set it, wait 200ms, then clear `openId`. Guard against re-entry
while closing.

**Week navigation.** The grid slides in from the direction of travel — `naInR*` on
next, `naInL*` on prev, 28px with opacity, 340ms. Because consecutive navigations in
the same direction need to re-trigger the same animation, alternate between two
identical keyframe sets (`naInR1`/`naInR2`) on a tick counter.

**Filter changes.** Cards re-settle rather than snapping: `naCard*`, 6px up with
opacity, 300ms, `animation-fill-mode: both`, staggered `35ms × min(index, 8)` down
each column. Same two-keyframe alternation, on a `filterTick` that increments on
every category toggle, town pick, and reset.

**Card hover.** Currently `transform: translateX(1px)` with a border-color change.
Target: `translateY(-2px)`, `border-color: var(--na-ink)`,
`background: var(--na-paper)`, and `box-shadow: 0 3px 0 var(--na-rule-soft)` — a
hard offset shadow rather than a blur, consistent with the map legend's existing
2px offset ink shadow. Transition `transform .2s` on the shared curve, plus
`border-color .2s, background .2s, box-shadow .2s`.

All four should be gated behind `prefers-reduced-motion`, matching the rest of the
app.

---

## State

No new persistent state. The redesign adds four transient values, all local to the
view components:

| State | Purpose |
| --- | --- |
| `closing` | Drawer is playing its exit animation; clears `openId` after 200ms |
| `dir` | `1` or `-1` — which way the last week navigation went |
| `navTick` | Increments per navigation, to alternate keyframe sets |
| `filterTick` | Increments per filter change, same reason |

`saved` continues to hold event ids and is unchanged in shape — only the controls
that mutate it moved.

## Design tokens

Every value below is an existing custom property in `src/style.css`. No new tokens.

**Color** — `--na-paper`, `--na-paper-2`, `--na-paper-3`, `--na-ink`, `--na-ink-2`,
`--na-ink-3`, `--na-rule`, `--na-rule-soft`, `--na-press-red`, `--na-gold`,
`--na-scrim`. Category colors stay as the seven values in `src/lib/data.js`:
markets `#E07A1F`, food `#D63838`, outdoors `#2F8F4E`, art `#7A3FBF`,
performance `#D6248A`, nightlife `#1F5FCC`, community `#C9A227`.

Both themes are already defined and both were designed against. `--na-wx-*` becomes
unused (Change 2).

**Type** — `--na-display` (Instrument Serif) for numerals and titles;
`--na-serif` (Newsreader) for body, venue, blurb; `--na-mono` (JetBrains Mono) for
all furniture. Sizes introduced or changed: numerals 72/46/34px, card title 17px,
card time 12px, blurb 12px, venue 11.5px, day weekday 10–11px, card footer 9.5px,
advisory 10.5px, rain note 9px.

**Space** — card padding `8px 10px 9px`; week header `13px 13px 11px`; weekend
header `18px 20px 14px`; card gaps 6px (week) and 8px (weekend); advisory
`18px 0 0` / `8px 0`.

**Radius** — none. Unchanged: the Almanac has no radii, and Change 2 removes the
one exception.

**Shadow** — `0 3px 0 var(--na-rule-soft)` on hovered cards. The drawer keeps
`-8px 0 24px oklch(0.2 0.012 60 / 0.15)`.

**Motion** — curve `cubic-bezier(0.2, 0.8, 0.2, 1)`; durations 200ms (drawer out,
hover), 280ms (drawer in), 300ms (card settle), 340ms (grid slide); stagger 35ms,
capped at 8 cards.

## Assets

None added. The reference files use the design system's font stacks and the
category emoji already in `src/lib/data.js`. No images, no icons, no SVG — the
four glyphs used (☀ ⛅ ☂ ★) are characters, consistent with the app's existing
icon vocabulary.

## Out of scope

Map view, Index view, My Plan, and the About modal were not touched. The masthead,
view-tile toolbar, and colophon are recreated faithfully in both files but are
unchanged between them — the one exception being that the colophon's source list in
the reference files is spelled out from `src/data/sources.js`, which is how the real
footer already builds it.
