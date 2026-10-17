# Week View Capped Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the week view's seven independently scrolling columns with columns that show up to 5 highlight cards plus an all-day row and a "+N more" link into the existing day sheet, so the page is the only scroll surface.

**Architecture:** A new pure module `src/lib/highlights.js` decides which of a day's events become cards (saved first, then a round-robin across morning/afternoon/evening with a 2-per-category cap, then the same round-robin uncapped). `CalendarView` in `src/calendar.jsx` renders its output; the all-day row and footer call the `pickDay` handler `app.jsx` already passes to the Month view, which opens the existing `DayModal`. CSS drops the fixed column height and inner scroll.

**Tech Stack:** React 18 + Vite, plain CSS in `src/style.css`, Node's built-in `node:test` runner (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-10-17-week-columns-design.md`

## Global Constraints

- No new npm dependencies. Tests use `node:test` and `node:assert/strict`.
- Highlight count is 5; per-category cap is 2.
- Buckets: morning `start < '12:00'`, afternoon `'12:00' <= start < '17:00'`, evening `start >= '17:00'`.
- All-day means `start === '00:00' && end === '23:59'` (existing `isAllDay` definition, unchanged).
- Only the week view changes. Month, Weekend, Map, Index, the `.evt` card markup, and the data layer stay as they are.
- Code must pass `npx eslint .` and `npx prettier --check .` (CI runs both). Prettier: single quotes, `printWidth: 100`, `arrowParens: "avoid"`.
- Copy: `All day · 6 listings →` (singular `listing` for 1) and `+23 more →`.

## Review Focus

1. **A day that is almost entirely `community` events** (63% of real listings): the reader expects cards spread across the day, not the five earliest. Pinned by "a single-category day still spreads across the day" in Task 1.
2. **A midnight event that is not all-day** (`00:00`–`02:00`): it must be a card in the morning bucket, not folded into the all-day row. Pinned by "midnight start that is not all-day stays a timed card" in Task 1.
3. **More than 5 saved events on one day**: the reader's own saved events fill every slot and the footer counts the rest. Pinned by "more saved events than slots" in Task 1.
4. **Filters that leave a day with only all-day events**: the all-day row shows, no footer, no empty-state text. Pinned by "all-day-only day" in Task 1 plus the filter check in Task 2 Step 7.
5. **Mobile (≤800px) single-column layout**, which had its own `max-height: 540px` inner scroll: the reader expects no inner scrollbar there either. Pinned by the mobile check in Task 2 Step 7.

---

### Task 1: Highlight selection module

**Files:**
- Create: `src/lib/highlights.js`
- Create: `src/lib/highlights.test.js`
- Modify: `src/calendar.jsx:351-353` (move `isAllDay` out, import and re-export it)
- Modify: `package.json` (add `test` script)
- Modify: `.github/workflows/ci.yml` (add test step)

**Interfaces:**
- Consumes: nothing from other tasks. Event objects shaped like `public/events.json` entries: `{ id: string, start: 'HH:MM', end: 'HH:MM', category: string, ... }`.
- Produces:
  - `HIGHLIGHT_COUNT` (number, `5`)
  - `isAllDay(ev) → boolean`
  - `pickHighlights(dayEvents: Event[], savedIds: string[] = [], n = HIGHLIGHT_COUNT) → { allDay: Event[], picks: Event[], hiddenCount: number }`. `allDay` and `picks` are sorted by start then id. `hiddenCount` counts timed events not in `picks`. Input is never mutated.
  - `calendar.jsx` and `views.jsx` keep importing `isAllDay` from `./calendar.jsx`; that still works through the re-export.

- [ ] **Step 1: Add the test script**

In `package.json`, add a `test` entry to `scripts` after `scrape`:

```json
    "scrape": "node scripts/build-events.mjs",
    "test": "node --test"
```

With no file arguments, `node --test` finds `**/*.test.js` and skips `node_modules`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/highlights.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHighlights, isAllDay } from './highlights.js';

const ev = (id, start, category = 'community', end = '23:00') => ({ id, start, end, category });
const allDay = id => ({ id, start: '00:00', end: '23:59', category: 'community' });
const ids = list => list.map(e => e.id);

test('isAllDay matches only 00:00–23:59', () => {
  assert.equal(isAllDay(allDay('a')), true);
  assert.equal(isAllDay(ev('b', '00:00', 'art', '02:00')), false);
  assert.equal(isAllDay(ev('c', '09:00')), false);
});

test('empty day', () => {
  assert.deepEqual(pickHighlights([]), { allDay: [], picks: [], hiddenCount: 0 });
});

test('all-day-only day has no picks and nothing hidden', () => {
  const r = pickHighlights([allDay('a'), allDay('b')]);
  assert.deepEqual(ids(r.allDay), ['a', 'b']);
  assert.deepEqual(r.picks, []);
  assert.equal(r.hiddenCount, 0);
});

test('all-day events are split out and never take a slot', () => {
  const r = pickHighlights([allDay('a'), ev('b', '09:00', 'art'), ev('c', '19:00', 'nightlife')]);
  assert.deepEqual(ids(r.allDay), ['a']);
  assert.deepEqual(ids(r.picks), ['b', 'c']);
  assert.equal(r.hiddenCount, 0);
});

test('midnight start that is not all-day stays a timed card', () => {
  const r = pickHighlights([ev('late', '00:00', 'nightlife', '02:00'), allDay('fair')]);
  assert.deepEqual(ids(r.picks), ['late']);
  assert.deepEqual(ids(r.allDay), ['fair']);
});

test('day with n or fewer timed events shows them all', () => {
  const r = pickHighlights([ev('a', '08:00'), ev('b', '09:00'), ev('c', '10:00')]);
  assert.deepEqual(ids(r.picks), ['a', 'b', 'c']);
  assert.equal(r.hiddenCount, 0);
});

const spreadDay = [
  ev('m1', '08:00', 'art'),
  ev('m2', '09:00', 'market'),
  ev('m3', '10:00', 'outdoor'),
  ev('m4', '11:00', 'food'),
  ev('a1', '13:00', 'performance'),
  ev('e1', '18:00', 'nightlife'),
  ev('e2', '20:00', 'community'),
];

test('picks spread across morning, afternoon and evening', () => {
  const r = pickHighlights(spreadDay);
  assert.deepEqual(ids(r.picks), ['m1', 'm2', 'a1', 'e1', 'e2']);
  assert.equal(r.hiddenCount, 2);
});

test('saved events go in first', () => {
  const r = pickHighlights(spreadDay, ['m4', 'm3']);
  assert.deepEqual(ids(r.picks), ['m1', 'm3', 'm4', 'a1', 'e1']);
  assert.equal(r.hiddenCount, 2);
});

test('more saved events than slots: earliest saved fill every slot', () => {
  const r = pickHighlights(spreadDay, ids(spreadDay));
  assert.deepEqual(ids(r.picks), ['m1', 'm2', 'm3', 'm4', 'a1']);
  assert.equal(r.hiddenCount, 2);
});

test('category cap of 2, then relaxed to fill', () => {
  const r = pickHighlights([
    ev('c1', '08:00'),
    ev('c2', '09:00'),
    ev('c3', '10:00'),
    ev('x1', '11:00', 'art'),
    ev('c4', '13:00'),
    ev('c5', '18:00'),
    ev('y1', '19:00', 'nightlife'),
  ]);
  assert.deepEqual(ids(r.picks), ['c1', 'c2', 'x1', 'c4', 'y1']);
  assert.equal(r.hiddenCount, 2);
});

test('a single-category day still spreads across the day', () => {
  const r = pickHighlights([
    ev('a', '08:00'),
    ev('b', '09:00'),
    ev('c', '10:00'),
    ev('d', '13:00'),
    ev('e', '14:00'),
    ev('f', '18:00'),
    ev('g', '19:00'),
  ]);
  assert.deepEqual(ids(r.picks), ['a', 'b', 'd', 'e', 'f']);
  assert.equal(r.hiddenCount, 2);
});

test('bucket boundaries: 12:00 is afternoon, 17:00 is evening', () => {
  const r = pickHighlights(
    [
      ev('m', '11:59', 'art'),
      ev('a1', '12:00', 'market'),
      ev('a2', '16:59', 'food'),
      ev('e', '17:00', 'outdoor'),
    ],
    [],
    3,
  );
  assert.deepEqual(ids(r.picks), ['m', 'a1', 'e']);
  assert.equal(r.hiddenCount, 1);
});

test('equal start times break ties by id, whatever the input order', () => {
  const x = ev('b', '19:00');
  const y = ev('a', '19:00');
  assert.deepEqual(ids(pickHighlights([x, y], [], 1).picks), ['a']);
  assert.deepEqual(ids(pickHighlights([y, x], [], 1).picks), ['a']);
});

test('does not mutate its input', () => {
  const input = Object.freeze([...spreadDay].reverse());
  assert.doesNotThrow(() => pickHighlights(input, ['m1']));
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` / `ERR_MODULE_NOT_FOUND` for `./highlights.js`.

- [ ] **Step 4: Write the module**

Create `src/lib/highlights.js`:

```js
// Which of a day's events the week grid shows as cards. Everything else sits
// behind the column's "+N more" link, which opens the full day sheet.

export const HIGHLIGHT_COUNT = 5;
const PER_CATEGORY = 2;

export function isAllDay(ev) {
  return ev && ev.start === '00:00' && ev.end === '23:59';
}

const byStart = (a, b) => a.start.localeCompare(b.start) || String(a.id).localeCompare(String(b.id));

// 0 = morning, 1 = afternoon, 2 = evening.
const bucketOf = ev => (ev.start < '12:00' ? 0 : ev.start < '17:00' ? 1 : 2);

// Take turns across the buckets, earliest first, skipping any category already
// at `cap`, until `picks` holds `n` or no bucket can give one more.
function roundRobin(buckets, picks, perCat, n, cap) {
  let progressed = true;
  while (picks.length < n && progressed) {
    progressed = false;
    for (const bucket of buckets) {
      if (picks.length >= n) break;
      const i = bucket.findIndex(ev => (perCat[ev.category] || 0) < cap);
      if (i === -1) continue;
      const [ev] = bucket.splice(i, 1);
      picks.push(ev);
      perCat[ev.category] = (perCat[ev.category] || 0) + 1;
      progressed = true;
    }
  }
}

export function pickHighlights(dayEvents, savedIds = [], n = HIGHLIGHT_COUNT) {
  const allDay = dayEvents.filter(isAllDay).sort(byStart);
  const timed = dayEvents.filter(ev => !isAllDay(ev)).sort(byStart);
  const saved = new Set(savedIds);

  const picks = timed.filter(ev => saved.has(ev.id)).slice(0, n);
  const perCat = {};
  picks.forEach(ev => (perCat[ev.category] = (perCat[ev.category] || 0) + 1));

  const taken = new Set(picks);
  const buckets = [[], [], []];
  timed.forEach(ev => {
    if (!taken.has(ev)) buckets[bucketOf(ev)].push(ev);
  });

  roundRobin(buckets, picks, perCat, n, PER_CATEGORY);
  // Still short means the day leans on one category — spread it anyway.
  roundRobin(buckets, picks, perCat, n, Infinity);

  picks.sort(byStart);
  return { allDay, picks, hiddenCount: timed.length - picks.length };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 14 tests, 0 failures.

- [ ] **Step 6: Point `calendar.jsx` at the new `isAllDay`**

In `src/calendar.jsx`, delete the existing definition (lines 351–353):

```js
export function isAllDay(ev) {
  return ev && ev.start === '00:00' && ev.end === '23:59';
}
```

Add this below the existing imports at the top of the file:

```js
import { isAllDay, pickHighlights } from './lib/highlights.js';

// Re-exported so views.jsx and other callers keep importing it from here.
export { isAllDay };
```

(`pickHighlights` is used in Task 2. Until then ESLint will flag it as unused. That's expected, and Task 2 clears it.)

- [ ] **Step 7: Add the test step to CI**

In `.github/workflows/ci.yml`, insert after the `Lint` step:

```yaml
      - name: Test
        run: npm test
```

- [ ] **Step 8: Format, build, commit**

Run: `npx prettier --write src/lib/highlights.js src/lib/highlights.test.js src/calendar.jsx package.json .github/workflows/ci.yml && npm test && npm run build`
Expected: tests pass and the build succeeds. `npx eslint .` reports only `'pickHighlights' is defined but never used` in `src/calendar.jsx`.

```bash
git add src/lib/highlights.js src/lib/highlights.test.js src/calendar.jsx package.json .github/workflows/ci.yml
git commit -m "feat: add pickHighlights for capped week columns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Render capped columns in the week view

**Files:**
- Modify: `src/calendar.jsx` (`CalendarView` props and the per-day column body, ~lines 52–223)
- Modify: `src/app.jsx:816-826` (pass `onPickDay` to `CalendarView`)
- Modify: `src/style.css:403-410` (`.cal-col`), `464-479` (`.cal-events` and its scrollbar rules), `1477` (mobile `max-height`), plus new `.cal-allday` / `.cal-more` rules

**Interfaces:**
- Consumes: `pickHighlights(dayEvents, saved)` → `{ allDay, picks, hiddenCount }` from Task 1 (already imported into `calendar.jsx`). `pickDay(d)` in `app.jsx` (line 584) opens `DayModal` for day offset `d`, captures focus for return, and is already reflected in the URL as `?day=`.
- Produces: `CalendarView` accepts a new `onPickDay: (d: number) => void` prop. DOM hooks used for verification: `.cal-allday` and `.cal-more` buttons inside each `.cal-col`.

- [ ] **Step 1: Pass `onPickDay` from `app.jsx`**

In `src/app.jsx`, inside the `view === 'calendar'` block, add the prop after `onOpen={viewEvent}`:

```jsx
              <CalendarView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={viewEvent}
                onPickDay={pickDay}
```

- [ ] **Step 2: Accept the prop in `CalendarView`**

In `src/calendar.jsx`, add `onPickDay` to the destructured props:

```jsx
export function CalendarView({
  events,
  saved,
  onOpen,
  onPickDay,
  weekOffset,
```

- [ ] **Step 3: Pick highlights per day**

In the `days.map(d => { ... })` body, directly after `const dayEvents = eventsByDay[d] || [];`, add:

```jsx
          const { allDay, picks, hiddenCount } = pickHighlights(dayEvents, saved);
          const seeAllLabel = `See all ${dayEvents.length} events on ${date.weekday}, ${date.month} ${date.date}`;
```

- [ ] **Step 4: Render the all-day row, the capped cards, and the footer**

Still in that body, change the opening of the card loop from:

```jsx
                {dayEvents.map((ev, i) => {
```

to:

```jsx
                {allDay.length > 0 && (
                  <button
                    type="button"
                    className="cal-allday"
                    onClick={() => onPickDay(d)}
                    aria-label={seeAllLabel}
                  >
                    All day · {allDay.length} {allDay.length === 1 ? 'listing' : 'listings'} →
                  </button>
                )}
                {picks.map((ev, i) => {
```

Leave the `<article className="evt" ...>` markup inside the loop exactly as it is.

Then find the `</div>` that closes `<div className="cal-events">` (just before the `</div>` that closes `.cal-col`) and add the footer right after it, so the column ends like this:

```jsx
                })}
              </div>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="cal-more"
                  onClick={() => onPickDay(d)}
                  aria-label={seeAllLabel}
                >
                  +{hiddenCount} more →
                </button>
              )}
            </div>
          );
        })}
```

The empty-state block (`dayEvents.length === 0`) stays unchanged.

- [ ] **Step 5: Remove the fixed height and inner scroll; style the new controls**

In `src/style.css`, replace the `.cal-col` rule (lines 403–410) with:

```css
.cal-col {
  border-right: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
```

Replace the `.cal-events` rule and the three `.cal-events::-webkit-scrollbar*` rules (lines 464–479) with:

```css
.cal-events {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.cal-allday,
.cal-more {
  appearance: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.cal-allday {
  border: 1px dashed var(--rule);
  padding: 6px 10px;
  color: var(--ink-2);
}
.cal-allday:hover {
  border-color: var(--ink);
  color: var(--ink);
}
.cal-more {
  border: 0;
  border-top: 1px solid var(--rule-soft);
  padding: 9px 13px 10px;
  color: var(--press-red);
}
.cal-more:hover { background: var(--paper); }
```

In the `@media (max-width: 800px)` block, delete this line (around line 1477):

```css
  .cal-col { height: auto; max-height: 540px; }
```

Grid items stretch by default, so every column in a row matches the tallest one. `.cal-events` takes up the leftover space (`flex: 1`), which keeps each `.cal-more` at the bottom of its column and lines them up across the row.

- [ ] **Step 6: Lint, format, test, build**

Run: `npx prettier --write src/calendar.jsx src/app.jsx src/style.css && npx eslint . && npx prettier --check . && npm test && npm run build`
Expected: no lint errors (the unused-`pickHighlights` warning from Task 1 is gone), formatting clean, 14 tests pass, build succeeds.

- [ ] **Step 7: Verify in the browser against real data**

Start the dev server (`npm run dev`, or add a `.claude/launch.json` entry `{ "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }` and use `preview_start`). Open `http://localhost:5173/` in the Week view.

At desktop width, run this in the page:

```js
[...document.querySelectorAll('.cal-col')].map(c => {
  const list = c.querySelector('.cal-events');
  return {
    day: c.querySelector('.cal-day-num')?.textContent,
    cards: c.querySelectorAll('.evt').length,
    allDay: c.querySelector('.cal-allday')?.textContent ?? null,
    more: c.querySelector('.cal-more')?.textContent ?? null,
    innerScroll: list.scrollHeight > list.clientHeight + 1,
    moreBottom: Math.round(c.querySelector('.cal-more')?.getBoundingClientRect().bottom ?? -1),
  };
});
```

Expected: every `cards` ≤ 5, every `innerScroll` is `false`, and busy days show a `more` such as `+23 more →`. All non-`-1` `moreBottom` values are equal.

Then check:
- Click a `+N more` footer. The day modal opens for that date, and its listing count equals `cards` + N + the all-day count. Escape closes it and focus returns to the footer button.
- Click an all-day row. The same modal opens.
- Turn on a category filter (e.g. only Nightlife). Cards and counts update, and a day left with only all-day events shows the row with no footer and no "Filtered out" text.
- Save an event that isn't currently a card (star it in the day modal). After closing, it's one of that day's cards.
- Resize to 1100px (4 columns) and to mobile (375×812), then rerun the snippet. `innerScroll` is `false` everywhere, and in 4-column mode `moreBottom` is equal within each row.
- Keyboard: Tab reaches the all-day row and footer, which show the red focus outline, and Enter opens the modal.

Reset the viewport to desktop when done.

- [ ] **Step 8: Commit**

```bash
git add src/calendar.jsx src/app.jsx src/style.css
git commit -m "feat: cap week columns at five highlights with a +N more link

Columns no longer scroll on their own; the page is the only scroll surface.
All-day listings fold into one row, and both it and the footer open the
existing day sheet.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
