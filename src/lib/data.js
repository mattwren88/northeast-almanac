// NEPA Events — populated at runtime from events.json (built by scripts/build-events.mjs).
// Day 0 = the anchorDate from events.json (the day the scraper ran).
//
// The mock dataset is the original design-bundle data. It's used as a fallback
// when events.json is missing (e.g., before the first scrape) so the app still renders.

// Mock events are lazy-loaded from mock-events.json on the fallback path.
let _mockEventsCache = null;
async function loadMockEvents() {
  if (_mockEventsCache) return _mockEventsCache;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}mock-events.json`, { cache: 'force-cache' });
    if (!r.ok) throw new Error(`mock-events.json ${r.status}`);
    _mockEventsCache = await r.json();
  } catch (err) {
    console.warn('mock-events.json unreachable; falling back to empty list.', err);
    _mockEventsCache = [];
  }
  return _mockEventsCache;
}

// Weather forecast for the 14-day window — replaced in place with the live
// forecast when events.json loads, so keep reads lazy (WEATHER[d] at render time).
export const WEATHER = [
  { day: 0, label: 'Sat', cond: 'sun', high: 68, low: 49, icon: '☀' },
  { day: 1, label: 'Sun', cond: 'partly', high: 71, low: 52, icon: '⛅' },
  { day: 2, label: 'Mon', cond: 'rain', high: 58, low: 46, icon: '☂' },
  { day: 3, label: 'Tue', cond: 'rain', high: 55, low: 44, icon: '☂' },
  { day: 4, label: 'Wed', cond: 'partly', high: 64, low: 47, icon: '⛅' },
  { day: 5, label: 'Thu', cond: 'sun', high: 72, low: 51, icon: '☀' },
  { day: 6, label: 'Fri', cond: 'sun', high: 75, low: 54, icon: '☀' },
  { day: 7, label: 'Sat', cond: 'sun', high: 77, low: 56, icon: '☀' },
  { day: 8, label: 'Sun', cond: 'partly', high: 73, low: 55, icon: '⛅' },
  { day: 9, label: 'Mon', cond: 'partly', high: 69, low: 52, icon: '⛅' },
  { day: 10, label: 'Tue', cond: 'sun', high: 74, low: 53, icon: '☀' },
  { day: 11, label: 'Wed', cond: 'rain', high: 60, low: 48, icon: '☂' },
  { day: 12, label: 'Thu', cond: 'partly', high: 65, low: 50, icon: '⛅' },
  { day: 13, label: 'Fri', cond: 'sun', high: 71, low: 54, icon: '☀' },
];

// Anchor date (YYYY-MM-DD) — set when events.json loads; null until then.
let anchorDate = null;

// Pretty date strings — anchored to the loaded anchor date, or today if
// events haven't loaded yet.
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function dateForDay(d) {
  const anchor = anchorDate
    ? new Date(anchorDate + 'T00:00:00')
    : (() => { const t = new Date(); t.setHours(0,0,0,0); return t; })();
  const dt = new Date(anchor.getTime() + d * 86400000);
  return {
    weekday: DAYS[dt.getDay()],
    month: MONTHS[dt.getMonth()],
    date: dt.getDate(),
    iso: dt.toISOString().slice(0, 10),
  };
}

// Day offset (relative to anchor) for "today" — events.json's anchorDate
// can lag actual today by a day or two depending on cron run, so the calendar
// "today" highlight needs to reflect real today, not day=0 (anchor).
export function todayDayOffset() {
  if (!anchorDate) return 0;
  const anchor = new Date(anchorDate + 'T00:00:00');
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - anchor.getTime()) / 86400000);
}

// Returns day offsets covering the upcoming Fri/Sat/Sun cluster, starting
// from today (not the anchor). If today is mid-weekend, only the remaining
// weekend days are returned. Always at most 3 days.
export function thisWeekendDays() {
  const startToday = todayDayOffset();
  const out = [];
  let started = false;
  for (let d = startToday; d < 14 && out.length < 3; d++) {
    if (d < 0) continue;
    const wd = dateForDay(d).weekday;
    const isWE = wd === 'Fri' || wd === 'Sat' || wd === 'Sun';
    if (isWE) { out.push(d); started = true; }
    else if (started) break;
  }
  return out;
}

export async function loadEvents() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}events.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`events.json ${res.status}`);
    const j = await res.json();
    anchorDate = j.anchorDate;
    if (Array.isArray(j.weather) && j.weather.length) {
      // Replace WEATHER contents in place so existing `WEATHER[d]` reads pick up the live forecast.
      WEATHER.length = 0;
      WEATHER.push(...j.weather);
    }
    // Backfill audience for older events.json (pre-college-sources).
    const events = (j.events || []).map(e => e.audience ? e : { ...e, audience: 'community' });
    return { events, source: 'live', generatedAt: j.generatedAt };
  } catch (err) {
    console.warn('Live events.json unavailable; falling back to mock data.', err);
    const events = await loadMockEvents();
    return { events, source: 'mock' };
  }
}

export const AUDIENCES = {
  community: { label: 'Community', description: 'Public events from regional venues and publishers' },
  college:   { label: 'Colleges',  description: 'University of Scranton, Marywood, Keystone (lots of academic dates)' },
};
export const ALL_AUDIENCES = Object.keys(AUDIENCES);

export const CATEGORIES = {
  market:      { label: 'Markets',         color: '#E07A1F', icon: '🛍' },
  food:        { label: 'Food & Drink',    color: '#D63838', icon: '🍴' },
  outdoor:     { label: 'Outdoors',        color: '#2F8F4E', icon: '🌲' },
  art:         { label: 'Art',             color: '#7A3FBF', icon: '🎨' },
  performance: { label: 'Theater & Music', color: '#D6248A', icon: '🎭' },
  nightlife:   { label: 'Nightlife',       color: '#1F5FCC', icon: '🌙' },
  community:   { label: 'Community',       color: '#C9A227', icon: '👥' },
};
