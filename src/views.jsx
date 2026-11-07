// Map view + List view + Event detail drawer + Weekend plan share

import { useState, useMemo, useEffect, useCallback } from 'react';
import { WEATHER, CATEGORIES, dateForDay, todayDayOffset, thisWeekendDays } from './lib/data.js';
import {
  useFilterSettle,
  fmtTime,
  fmtEventTime,
  isAllDay,
  eventToIcs,
  eventsToIcs,
  eventToGcalUrl,
  eventToOutlookUrl,
  downloadIcs,
  slugify,
  EventRows,
  timeGroups,
  useScrollGuard,
  WeatherChip,
} from './calendar.jsx';
import { HORIZON_DAYS } from './lib/constants.js';
import { SOURCES_BY_ID } from './data/sources.js';

export const onCardKey = handler => e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handler();
  }
};

// ============ WEEKEND VIEW ============
export function WeekendView({ events, saved, onOpen, filterTick = 0 }) {
  const settling = useFilterSettle(filterTick);
  useScrollGuard();
  const days = thisWeekendDays();
  const eventsByDay = useMemo(() => {
    const m = {};
    events.forEach(e => {
      (m[e.day] ||= []).push(e);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  }, [events]);
  if (days.length === 0) {
    return (
      <div className="weekend-wrap">
        <div className="weekend-empty">— No weekend in the visible horizon —</div>
      </div>
    );
  }
  const first = dateForDay(days[0]);
  const last = dateForDay(days[days.length - 1]);
  const todayD = todayDayOffset();
  return (
    <div className="weekend-wrap">
      <div className="weekend-header">
        <div className="weekend-eyebrow">FOCUSED · 3-DAY</div>
        <h2 className="weekend-title">This Weekend</h2>
        <div className="weekend-range">
          {first.weekday} {first.month} {first.date}
          {days.length > 1 ? ` – ${last.weekday} ${last.month} ${last.date}` : ''}
        </div>
      </div>
      <div className={`weekend-grid cols-${days.length}`}>
        {days.map(d => {
          const date = dateForDay(d);
          const wx = WEATHER[d];
          const dayEvents = eventsByDay[d] || [];
          const allDay = dayEvents.filter(isAllDay);
          const timed = dayEvents.filter(ev => !isAllDay(ev));
          const isToday = d === todayD;
          const cardAnim = filterTick % 2 === 0 ? 'naCard1' : 'naCard2';
          return (
            <div key={d} className={`weekend-col ${isToday ? 'is-today' : ''}`}>
              <div className="weekend-col-head">
                <div className="weekend-head-row1">
                  <span className="weekend-col-wd">{date.weekday}</span>
                  {isToday && <span className="cal-today-dot">today</span>}
                  {wx && <WeatherChip wx={wx} d={d} className="weekend-wx" />}
                </div>
                <div className="weekend-col-num">{date.date}</div>
              </div>
              <div className="weekend-events">
                {dayEvents.length === 0 && <div className="cal-empty">— Nothing yet —</div>}
                <EventRows
                  groups={[
                    ...(allDay.length ? [{ label: 'All day', events: allDay }] : []),
                    ...timeGroups(timed),
                  ]}
                  saved={saved}
                  onOpen={onOpen}
                  rainy={wx?.cond === 'rain'}
                  settling={settling}
                  cardAnim={cardAnim}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ LIST VIEW ============
// One day's block from the Index view — sticky date header plus item rows.
// Shared with the Month view's day modal.
export function DayListing({ d, events, saved, onSave, onOpen }) {
  const date = dateForDay(d);
  const wx = WEATHER[d];
  const dayEvents = events || [];
  const isToday = d === todayDayOffset();
  return (
    <section className={`list-day ${isToday ? 'is-today' : ''}`}>
      <header className="list-day-head">
        <h2 className="list-day-num" aria-label={`${date.weekday}, ${date.month} ${date.date}`}>
          {date.date}
        </h2>
        <div className="list-day-info">
          <div className="list-day-wd">
            {date.weekday}
            {isToday && <span className="list-today-dot">today</span>}
          </div>
          <div className="list-day-month">{date.month}</div>
        </div>
        <div className="list-day-rule" />
        {wx && (
          <div className="list-day-wx">
            {wx.icon} {wx.high}° / {wx.low}°
          </div>
        )}
        <div className="list-day-count">
          {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
        </div>
      </header>
      <div className="list-day-items">
        {dayEvents.map((ev, i) => {
          const cat = CATEGORIES[ev.category];
          const isSaved = saved.includes(ev.id);
          // Same start as the previous listing: print the time once per group.
          const sameSlot = i > 0 && dayEvents[i - 1].start === ev.start;
          return (
            <article
              key={ev.id}
              className={`list-item ${sameSlot ? 'is-same-slot' : ''}`}
              onClick={() => onOpen(ev.id)}
              onKeyDown={onCardKey(() => onOpen(ev.id))}
              role="button"
              tabIndex={0}
              aria-label={`${ev.title} at ${ev.venue}, ${ev.town}`}
            >
              <div className="list-item-time">
                {isAllDay(ev) ? (
                  !sameSlot && <span className="list-item-start is-allday">All day</span>
                ) : (
                  <>
                    {!sameSlot && <span className="list-item-start">{fmtTime(ev.start)}</span>}
                    <span className="list-item-end">to {fmtTime(ev.end)}</span>
                  </>
                )}
              </div>
              <div className="list-item-body">
                <div className="list-item-meta">
                  <span className="list-item-cat" style={{ color: cat.color }}>
                    {cat.label}
                  </span>
                  {ev.featured && <span className="list-item-tag pick">Editor's pick</span>}
                  {ev.hidden && <span className="list-item-tag hidden">Hidden gem</span>}
                  {ev.recurring && <span className="list-item-tag recur">{ev.recurring}</span>}
                </div>
                <h3 className="list-item-title">{ev.title}</h3>
                <p className="list-item-blurb">{ev.blurb}</p>
                <div className="list-item-foot">
                  <span>{ev.venue}</span>
                  <span className="list-sep">·</span>
                  <span>{ev.town}</span>
                  <span className="list-sep">·</span>
                  <span>{ev.price}</span>
                </div>
              </div>
              <button
                className={`list-item-save ${isSaved ? 'is-saved' : ''}`}
                onClick={e => {
                  e.stopPropagation();
                  onSave(ev.id);
                }}
                aria-label={isSaved ? 'Remove from plan' : 'Save to plan'}
                aria-pressed={isSaved}
                title={isSaved ? 'Remove from plan' : 'Save to plan'}
              >
                {isSaved ? '★ Saved' : '☆ Save'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Day modal — opened from a Month cell. Same layout as one Index day; clicking
// an item opens the event drawer above it.
export function DayModal({ d, events, saved, onSave, onOpen, onClose, onOpenWeek }) {
  const date = dateForDay(d);
  return (
    <div className="day-backdrop" onClick={onClose}>
      <aside
        className="day-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${date.weekday}, ${date.month} ${date.date}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="about-close" onClick={onClose} aria-label="Close" autoFocus>
          ×
        </button>
        {events.length > 0 ? (
          <DayListing d={d} events={events} saved={saved} onSave={onSave} onOpen={onOpen} />
        ) : (
          <>
            <DayListing d={d} events={[]} saved={saved} onSave={onSave} onOpen={onOpen} />
            <div className="list-empty">Nothing listed for this day.</div>
          </>
        )}
        {onOpenWeek && (
          <div className="day-modal-foot">
            <button type="button" className="day-modal-week" onClick={() => onOpenWeek(d)}>
              Open this week in the Week view →
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
export function ListView({ events, saved, onSave, onOpen, filterCount = 0, onResetFilters }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);
  const minIso = useMemo(() => dateForDay(0).iso, []);
  const maxIso = useMemo(() => dateForDay(HORIZON_DAYS - 1).iso, []);
  const todayIso = useMemo(() => dateForDay(Math.max(0, todayDayOffset())).iso, []);
  const [fromIso, setFromIso] = useState(todayIso);
  const [toIso, setToIso] = useState(maxIso);

  // Fuse (fuzzy search) loads on the first search rather than with the page;
  // until it arrives, the plain substring match below answers.
  const [FuseLib, setFuseLib] = useState(null);
  useEffect(() => {
    if (FuseLib || !debouncedQuery.trim()) return;
    import('fuse.js').then(m => setFuseLib(() => m.default));
  }, [debouncedQuery, FuseLib]);
  const fuse = useMemo(
    () =>
      FuseLib &&
      new FuseLib(events, {
        keys: ['title', 'venue', 'town', 'blurb', 'tags', 'category'],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [FuseLib, events],
  );

  const searched = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return events;
    if (!fuse) {
      const ql = q.toLowerCase();
      return events.filter(
        e =>
          e.title.toLowerCase().includes(ql) ||
          e.venue.toLowerCase().includes(ql) ||
          e.town.toLowerCase().includes(ql) ||
          (e.blurb || '').toLowerCase().includes(ql),
      );
    }
    return fuse.search(q).map(r => r.item);
  }, [events, debouncedQuery, fuse]);

  const dates = useMemo(() => {
    const out = {};
    for (let d = 0; d < HORIZON_DAYS; d++) out[d] = dateForDay(d);
    return out;
  }, []);

  const dayInRange = useCallback(
    d => {
      const iso = dates[d].iso;
      return iso >= fromIso && iso <= toIso;
    },
    [dates, fromIso, toIso],
  );

  const visibleDays = [];
  for (let d = 0; d < HORIZON_DAYS; d++) if (dayInRange(d)) visibleDays.push(d);

  const searchedByDay = useMemo(() => {
    const m = {};
    searched.forEach(e => {
      (m[e.day] ||= []).push(e);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  }, [searched]);

  const clearRange = () => {
    setFromIso(todayIso);
    setToIso(maxIso);
  };
  const totalShown = useMemo(
    () => searched.filter(e => dayInRange(e.day)).length,
    [searched, dayInRange],
  );

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <input
          type="search"
          className="list-search"
          placeholder="Search events, venues, towns…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="list-range">
          <label className="list-range-label">From</label>
          <input
            type="date"
            className="list-date"
            value={fromIso}
            min={minIso}
            max={maxIso}
            onChange={e => setFromIso(e.target.value || minIso)}
          />
          <label className="list-range-label">to</label>
          <input
            type="date"
            className="list-date"
            value={toIso}
            min={minIso}
            max={maxIso}
            onChange={e => setToIso(e.target.value || maxIso)}
          />
          <button className="list-clear" onClick={clearRange}>
            Reset
          </button>
        </div>
        <div className="list-count">
          {totalShown} {totalShown === 1 ? 'event' : 'events'}
        </div>
      </div>
      {totalShown === 0 && visibleDays.length > 0 && (
        <div className="list-empty">
          {debouncedQuery.trim() ? (
            <>
              No events match <strong>"{debouncedQuery.trim()}"</strong>.
            </>
          ) : filterCount > 0 ? (
            <>No events match your filters.</>
          ) : (
            <>No events in this range.</>
          )}
          {filterCount > 0 && onResetFilters && (
            <button className="list-empty-reset" onClick={onResetFilters}>
              Reset filters
            </button>
          )}
        </div>
      )}
      {visibleDays.length === 0 && <div className="list-empty">No events in this range.</div>}
      {visibleDays.map(d =>
        (searchedByDay[d] || []).length === 0 ? null : (
          <DayListing
            key={d}
            d={d}
            events={searchedByDay[d]}
            saved={saved}
            onSave={onSave}
            onOpen={onOpen}
          />
        ),
      )}
    </div>
  );
}

// ============ EVENT DETAIL DRAWER ============
function eventSource(ev) {
  if (ev.source && SOURCES_BY_ID[ev.source]) return SOURCES_BY_ID[ev.source];
  const match = /^([a-z]+)-/.exec(ev.id || '');
  return match ? SOURCES_BY_ID[match[1]] : null;
}

export function EventDrawer({ event, isSaved, onSave, onClose, closing = false }) {
  const gcalUrl = useMemo(() => (event ? eventToGcalUrl(event) : ''), [event]);
  const outlookUrl = useMemo(() => (event ? eventToOutlookUrl(event) : ''), [event]);
  if (!event) return null;
  const cat = CATEGORIES[event.category];
  const date = dateForDay(event.day);
  const wx = WEATHER[event.day];
  const src = eventSource(event);
  return (
    <div className={`drawer-backdrop ${closing ? 'is-closing' : ''}`} onClick={onClose}>
      <aside
        className={`drawer ${closing ? 'is-closing' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
      >
        <button
          className="drawer-close"
          onClick={onClose}
          aria-label="Close event details"
          autoFocus
        >
          ×
        </button>
        <div className="drawer-keyhint" aria-hidden="true">
          ← → to browse · Esc to close
        </div>
        <div className="drawer-rail" style={{ background: cat.color }} />
        <div className="drawer-body">
          <div className="drawer-cat" style={{ color: cat.color }}>
            {cat.label.toUpperCase()}
            {event.featured && <span className="drawer-tag pick">· Editor's pick</span>}
            {event.hidden && <span className="drawer-tag hidden">· Hidden gem</span>}
          </div>
          <h2 className="drawer-title">{event.title}</h2>
          <div className="drawer-when">
            {date.weekday}, {date.month} {date.date} &nbsp;·&nbsp;{' '}
            {isAllDay(event) ? 'All day' : `${fmtTime(event.start)} – ${fmtTime(event.end)}`}
          </div>
          <div className="drawer-where">
            <div className="drawer-venue">{event.venue}</div>
            <div className="drawer-town">{event.town}, PA</div>
          </div>
          <p className="drawer-blurb">{event.blurb}</p>

          <div className="drawer-stats">
            <div className="drawer-stat">
              <div className="drawer-stat-k">Price</div>
              <div className="drawer-stat-v">{event.price}</div>
            </div>
            <div className="drawer-stat">
              <div className="drawer-stat-k">Setting</div>
              <div className="drawer-stat-v">{event.indoor ? 'Indoor' : 'Outdoor'}</div>
            </div>
            <div className="drawer-stat">
              <div className="drawer-stat-k">Forecast</div>
              <div className="drawer-stat-v">
                {wx ? `${wx.icon} ${wx.high}° / ${wx.low}°` : 'Beyond forecast'}
              </div>
            </div>
            {event.recurring && (
              <div className="drawer-stat">
                <div className="drawer-stat-k">Cadence</div>
                <div className="drawer-stat-v">{event.recurring}</div>
              </div>
            )}
          </div>

          <div className="drawer-tags">
            {event.tags.map(t => (
              <span key={t} className="drawer-chip">
                #{t}
              </span>
            ))}
          </div>

          {src && (
            <div className="drawer-source">
              <span className="drawer-source-k">Listing via</span>
              <a
                className="drawer-source-v"
                href={src.home}
                target="_blank"
                rel="noopener noreferrer"
              >
                {src.name} ↗
              </a>
            </div>
          )}

          <div className="drawer-actions">
            <button
              className={`drawer-btn primary ${isSaved ? 'is-saved' : ''}`}
              onClick={() => onSave(event.id)}
            >
              {isSaved ? '★ Saved to plan' : '☆ Add to plan'}
            </button>
            <div className="drawer-cal-row">
              <div className="drawer-cal-label">Add to calendar</div>
              <div className="drawer-cal-btns">
                <a
                  className="drawer-cal-btn"
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google
                </a>
                <button
                  className="drawer-cal-btn"
                  onClick={() => downloadIcs(`${slugify(event.title)}.ics`, eventToIcs(event))}
                >
                  Apple (.ics)
                </button>
                <a
                  className="drawer-cal-btn"
                  href={outlookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Outlook
                </a>
              </div>
            </div>
            {event.url && (
              <div className="drawer-cal-row">
                <div className="drawer-cal-label">More info</div>
                <div className="drawer-cal-btns">
                  <a
                    className="drawer-cal-btn"
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View original listing ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ============ SAVED PLAN SIDEBAR ============
export function WeekendPlan({
  events,
  eventsById,
  saved,
  onRemove,
  onClose,
  onShare,
  onClearPast,
}) {
  const { upcoming, past, byDay } = useMemo(() => {
    const lookup = eventsById || new Map(events.map(e => [e.id, e]));
    const today = todayDayOffset();
    const all = saved
      .map(id => lookup.get(id))
      .filter(Boolean)
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    const upcoming = all.filter(e => e.day >= today);
    const past = all.filter(e => e.day < today);
    const byDay = {};
    upcoming.forEach(e => {
      (byDay[e.day] ||= []).push(e);
    });
    return { upcoming, past, byDay };
  }, [saved, events, eventsById]);

  const isEmpty = upcoming.length === 0 && past.length === 0;
  const onlyPast = upcoming.length === 0 && past.length > 0;

  return (
    <div className="plan-backdrop" onClick={onClose}>
      <aside
        className="plan"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Your plan"
      >
        <header className="plan-head">
          <div className="plan-eyebrow">YOUR PLAN</div>
          <h2 className="plan-title">Your Plan</h2>
          <button className="plan-close" onClick={onClose} aria-label="Close plan" autoFocus>
            ×
          </button>
        </header>
        {isEmpty && (
          <div className="plan-empty">
            <div className="plan-empty-mark">☆</div>
            <p>Tap the star on any event to start building a plan.</p>
          </div>
        )}
        {onlyPast && (
          <div className="plan-empty">
            <div className="plan-empty-mark">✓</div>
            <p>All your saved events have passed.</p>
            <button className="plan-clear-past" onClick={onClearPast}>
              Clear {past.length} past {past.length === 1 ? 'event' : 'events'}
            </button>
          </div>
        )}
        {upcoming.length > 0 && (
          <>
            <div className="plan-body">
              {Object.entries(byDay).map(([d, evs]) => {
                const date = dateForDay(parseInt(d));
                return (
                  <div key={d} className="plan-day">
                    <div className="plan-day-head">
                      {date.weekday}, {date.month} {date.date}
                    </div>
                    {evs.map(ev => {
                      return (
                        <div key={ev.id} className="plan-item">
                          <div className="plan-item-time">{fmtEventTime(ev)}</div>
                          <div className="plan-item-body">
                            <div className="plan-item-title">{ev.title}</div>
                            <div className="plan-item-where">
                              {ev.venue} · {ev.town}
                            </div>
                          </div>
                          <button className="plan-item-x" onClick={() => onRemove(ev.id)}>
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {past.length > 0 && (
                <div className="plan-past-row">
                  <button className="plan-clear-past" onClick={onClearPast}>
                    Clear {past.length} past {past.length === 1 ? 'event' : 'events'}
                  </button>
                </div>
              )}
            </div>
            <footer className="plan-foot">
              <button
                className="plan-share"
                onClick={() => downloadIcs('northeast-almanac-plan.ics', eventsToIcs(upcoming))}
              >
                ↓ Download for calendar app
              </button>
              <button className="plan-share" onClick={onShare}>
                ↗ Copy share link
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
