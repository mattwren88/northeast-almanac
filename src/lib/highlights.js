// Which of a day's events the week grid shows as cards. Everything else sits
// behind the column's "+N more" link, which opens the full day sheet.

export const HIGHLIGHT_COUNT = 5;
const PER_CATEGORY = 2;

export function isAllDay(ev) {
  return ev && ev.start === '00:00' && ev.end === '23:59';
}

const byStart = (a, b) =>
  a.start.localeCompare(b.start) || String(a.id).localeCompare(String(b.id));

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
