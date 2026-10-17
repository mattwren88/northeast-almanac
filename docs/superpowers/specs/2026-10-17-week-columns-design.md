# Week view: capped columns instead of independent scrolling

## Problem

The week view (`CalendarView` in `src/calendar.jsx`) renders seven columns, each a
fixed 620px box whose `.cal-events` list scrolls on its own. Real data averages 28
events per day (max 47); at ~100px per card that's ~2,800px of content per column,
so each column shows about a fifth of its day. The result is seven scroll traps,
no read on how busy a day is, and no way to see the week at once.

## Goal

The week view's job is **scanning the whole week**: get a feel for all seven days,
then dig into one. Each day shows a handful of highlights; the rest is one click
away. The page is the only scroll surface.

Out of scope: Month, Weekend, Map and Index views; the card design itself; the
data model and scraper.

## Design

### Column layout

- Remove `height: 620px` from `.cal-col` and `overflow-y`, the scrollbar styling,
  and the fade `mask-image` from `.cal-events`.
- Grid rows stretch, so every column in a row is as tall as the tallest one. The
  column footer sits at the bottom (`margin-top: auto`) so "+N more" links align
  across the week.
- Column contents, top to bottom:
  1. Header (unchanged).
  2. **All-day row**, if the day has any all-day events: `All day · 6 listings →`.
     It does not consume a highlight slot. Singular form for one listing.
  3. Up to **5 highlight cards**, existing `.evt` markup, shown in start-time order.
  4. **Footer** `+23 more →` when timed events were left out; hidden otherwise.
  5. Existing empty state when the day has no events at all.
- The all-day row and the footer are both `<button>`s that call `onPickDay(d)`,
  opening the existing day sheet (`openDay` in `app.jsx`, already used by the
  Month view, already deep-linked via `?day=` and handled by Escape/back).
- `app.jsx` passes `onPickDay={pickDay}` to `CalendarView`.
- Same cap at every breakpoint: 7 columns, 4 columns (≤1100px), 1 column (≤800px).

### Highlight selection

New pure module `src/lib/highlights.js` exporting
`pickHighlights(dayEvents, savedIds, n = 5)` → `{ allDay, picks, hiddenCount }`.

`isAllDay` moves from `calendar.jsx` into this module; `calendar.jsx` imports and
re-exports it so existing imports keep working.

Algorithm, over the day's (already filtered) events:

1. Split all-day events (`start === '00:00' && end === '23:59'`) into `allDay`.
2. Of the timed events, take saved ones first, earliest first, up to `n`.
3. Bucket the remaining timed events: morning (`start < 12:00`), afternoon
   (`12:00 ≤ start < 17:00`), evening (`start ≥ 17:00`), each sorted by start.
4. Round-robin morning → afternoon → evening, taking the earliest event in each
   bucket whose category has fewer than 2 picks so far, until `n` picks or no
   bucket yields one.
5. If slots remain, fill them in start order from what's left, ignoring the
   category cap.
6. Sort `picks` by start; `hiddenCount` = timed events not picked.

Ties on start time break by `id` so the selection is stable across renders.

Because it runs on filtered events, picks and counts follow active filters.

## Testing

- Add `"test": "node --test"` to `package.json` (no new dependencies) and
  `src/lib/highlights.test.js` covering: saved events first; spread across
  morning/afternoon/evening; the 2-per-category cap and its relaxation; days with
  ≤5 timed events (no footer, `hiddenCount` 0); all-day-only days; empty days;
  stable output for equal start times.
- Manual check in the browser pane against the real `public/events.json` at
  desktop, 1100px and mobile widths: no inner scrollbars, footers aligned, all-day
  row and footer open the right day sheet, filters change picks and counts.
