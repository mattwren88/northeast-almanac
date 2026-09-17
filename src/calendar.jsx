// Calendar view — week grid with editorial styling

import { useState, useMemo, useEffect, useRef } from 'react';
import { WEATHER, CATEGORIES, DAYS, dateForDay, todayDayOffset } from './lib/data.js';
import { HORIZON_DAYS, MAX_WEEK } from './lib/constants.js';

// True only while the card-settle animation should actually be running.
// The settle uses animation-fill-mode: both so staggered cards stay hidden
// through their delay — but a *filling* animation keeps overriding normal
// declarations after it ends, which silently kills `.evt:hover` (the lift)
// and `.evt-dim` (rain dimming). So the animation is attached for its
// duration only, then removed to hand styling back to the cascade.
export function useFilterSettle(filterTick) {
  const [settling, setSettling] = useState(false);
  const prevTick = useRef(filterTick);
  useEffect(() => {
    if (prevTick.current === filterTick) return;
    prevTick.current = filterTick;
    setSettling(true);
    // 300ms duration + the longest stagger (35ms × 8) + a frame of slack.
    const id = setTimeout(() => setSettling(false), 620);
    return () => clearTimeout(id);
  }, [filterTick]);
  return settling;
}

export function useIsMobile() {
  const [m, set] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const h = e => set(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return m;
}

// Events grouped by day offset, each day sorted by start time.
export function useEventsByDay(events) {
  return useMemo(() => {
    const m = {};
    events.forEach(e => {
      (m[e.day] ||= []).push(e);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  }, [events]);
}

export function CalendarView({
  events,
  saved,
  onOpen,
  weekOffset,
  setWeekOffset,
  weatherAware,
  filterCount = 0,
  filterTick = 0,
}) {
  const isMobile = useIsMobile();
  const todayD = todayDayOffset();
  const settling = useFilterSettle(filterTick);
  // Week-navigation slide: `dir` is which way we last moved, `navTick` flips
  // between two identical keyframe sets so consecutive same-direction moves
  // re-trigger the animation (setting the same animation-name twice is a no-op).
  const [dir, setDir] = useState(1);
  const [navTick, setNavTick] = useState(0);
  const goPrev = () => {
    setDir(-1);
    setNavTick(t => t + 1);
    setWeekOffset(Math.max(0, weekOffset - 1));
  };
  const goNext = () => {
    setDir(1);
    setNavTick(t => t + 1);
    setWeekOffset(Math.min(MAX_WEEK, weekOffset + 1));
  };
  const navAnim =
    dir === 1 ? (navTick % 2 === 0 ? 'naInR1' : 'naInR2') : navTick % 2 === 0 ? 'naInL1' : 'naInL2';
  // On mobile we anchor the week to today (clamped within the 14-day horizon)
  // and ignore weekOffset — Prev/Next is hidden.
  const startDay = isMobile ? Math.max(0, Math.min(todayD, HORIZON_DAYS - 7)) : weekOffset * 7;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);
  const dates = useMemo(() => {
    const out = {};
    for (let d = 0; d < HORIZON_DAYS; d++) out[d] = dateForDay(d);
    return out;
  }, []);
  const eventsByDay = useEventsByDay(events);
  const startDate = dates[startDay];
  const endDate = dates[startDay + 6];

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <div className="cal-nav">
          {!isMobile && (
            <button className="cal-nav-btn" onClick={goPrev} disabled={weekOffset === 0}>
              ‹ Prev
            </button>
          )}
          <div className="cal-week-label">
            <span className="cal-week-em">{isMobile ? 'Next 7 days from' : 'Week of'}</span>{' '}
            {startDate.month} {startDate.date}
            {' — '}
            {endDate.month} {endDate.date}
          </div>
          {!isMobile && (
            <button className="cal-nav-btn" onClick={goNext} disabled={weekOffset === MAX_WEEK}>
              Next ›
            </button>
          )}
        </div>
      </div>

      <div
        className="cal-grid cal-grid-anim"
        style={navTick > 0 ? { animationName: navAnim } : undefined}
      >
        {days.map(d => {
          const date = dates[d];
          const wx = WEATHER[d];
          const dayEvents = eventsByDay[d] || [];
          const isWeekend = date.weekday === 'Sat' || date.weekday === 'Sun';
          const isToday = d === todayD;
          // "Loud" days — today, or (weekend emphasis, hardcoded on) a Sat/Sun.
          const isLoud = isToday || isWeekend;
          const cardAnim = filterTick % 2 === 0 ? 'naCard1' : 'naCard2';

          return (
            <div
              key={d}
              className={`cal-col ${isLoud ? 'is-loud' : ''} ${isToday ? 'is-today' : ''}`}
            >
              <div className="cal-col-head">
                <div className="cal-head-row1">
                  <span className="cal-day-name">{date.weekday}</span>
                  {isToday && <span className="cal-today-dot">today</span>}
                  {wx && (
                    <span className="cal-wx" title={`${wx.cond} · ${wx.high}°/${wx.low}°`}>
                      <span className="cal-wx-glyph">{wx.icon}</span>
                      <span className="cal-wx-temp">
                        {wx.high}°/{wx.low}°
                      </span>
                    </span>
                  )}
                </div>
                <div className="cal-day-num">{date.date}</div>
              </div>

              <div className="cal-events">
                {dayEvents.length === 0 && (
                  <div className="cal-empty">
                    {filterCount > 0 ? '— Filtered out —' : '— Nothing yet —'}
                  </div>
                )}
                {dayEvents.map((ev, i) => {
                  const cat = CATEGORIES[ev.category];
                  const isSaved = saved.includes(ev.id);
                  const dimmed = weatherAware && wx?.cond === 'rain' && !ev.indoor;
                  return (
                    <article
                      key={ev.id}
                      className={`evt ${settling ? 'evt-anim' : ''} ${dimmed ? 'evt-dim' : ''} ${ev.featured ? 'evt-featured' : ''}`}
                      style={
                        settling
                          ? {
                              animationName: cardAnim,
                              animationDelay: `${35 * Math.min(i, 8)}ms`,
                            }
                          : undefined
                      }
                      onClick={() => onOpen(ev.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpen(ev.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${ev.title} at ${ev.venue}, ${ev.town}`}
                    >
                      <div className="evt-bar" style={{ background: cat.color }} />
                      <div className="evt-body">
                        <span className={`evt-time ${isAllDay(ev) ? 'is-allday' : ''}`}>
                          {fmtEventTime(ev)}
                        </span>
                        <h3 className="evt-title">{ev.title}</h3>
                        <div className="evt-where">
                          <span className="evt-venue">{ev.venue}</span>
                          <span className="evt-sep">·</span>
                          <span className="evt-town">{ev.town}</span>
                        </div>
                        {ev.blurb && <p className="evt-blurb">{ev.blurb}</p>}
                        <div className="evt-foot">
                          <span className="evt-cat" style={{ color: cat.color }}>
                            {cat.label.toUpperCase()}
                          </span>
                          {ev.featured && <span className="evt-pick">Pick</span>}
                          {isSaved && (
                            <span className="evt-star" aria-hidden="true">
                              ★
                            </span>
                          )}
                        </div>
                        {dimmed && <div className="evt-warn">Outdoor · rain forecast</div>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ MONTH VIEW ============
// Rolling five-week grid (Sun–Sat rows) starting the Sunday on/before the
// anchor date. Days before the anchor have no data and render greyed.
const MONTH_WEEKS = 5;
const MONTH_MAX_LINES = 3;

export function MonthView({ events, saved, onOpen, onPickDay, filterTick = 0 }) {
  const todayD = todayDayOffset();
  const settling = useFilterSettle(filterTick);
  const eventsByDay = useEventsByDay(events);
  const gridStart = -DAYS.indexOf(dateForDay(0).weekday);
  const cells = Array.from({ length: MONTH_WEEKS * 7 }, (_, i) => gridStart + i);
  const first = dateForDay(cells[0]);
  const last = dateForDay(cells[cells.length - 1]);
  const lineAnim = filterTick % 2 === 0 ? 'naCard1' : 'naCard2';

  return (
    <div className="cal-wrap mo-wrap">
      <div className="cal-header">
        <div className="cal-nav">
          <div className="cal-week-label">
            <span className="cal-week-em">Five weeks</span> {first.month} {first.date}
            {' — '}
            {last.month} {last.date}
          </div>
        </div>
      </div>

      <div className="mo-dow" aria-hidden="true">
        {DAYS.map(d => (
          <span key={d} className="mo-dow-name">
            {d}
          </span>
        ))}
      </div>

      <div className="mo-grid">
        {cells.map(d => {
          const date = dateForDay(d);
          const past = d < 0 || d >= HORIZON_DAYS;
          const wx = WEATHER[d];
          const dayEvents = past ? [] : eventsByDay[d] || [];
          const shown = dayEvents.slice(0, MONTH_MAX_LINES);
          const more = dayEvents.length - shown.length;
          const isWeekend = date.weekday === 'Sat' || date.weekday === 'Sun';
          const isToday = d === todayD;
          const pick = () => !past && onPickDay(d);
          return (
            <div
              key={d}
              className={`mo-cell ${past ? 'is-past' : ''} ${isWeekend ? 'is-loud' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={pick}
              onKeyDown={e => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pick();
                }
              }}
              role={past ? undefined : 'button'}
              tabIndex={past ? -1 : 0}
              aria-label={
                past
                  ? undefined
                  : `${date.weekday} ${date.month} ${date.date}, ${dayEvents.length} events — open week`
              }
            >
              <div className="mo-cell-head">
                <span className="mo-day-num" data-wd={date.weekday}>
                  {date.date === 1 || d === cells[0] ? `${date.month} ` : ''}
                  {date.date}
                </span>
                {isToday && <span className="cal-today-dot">today</span>}
                {wx && (
                  <span className="mo-wx" title={`${wx.cond} · ${wx.high}°/${wx.low}°`}>
                    {wx.icon}
                  </span>
                )}
              </div>
              <div className="mo-lines">
                {shown.map((ev, i) => {
                  const cat = CATEGORIES[ev.category];
                  return (
                    <button
                      type="button"
                      key={ev.id}
                      className={`mo-evt ${settling ? 'evt-anim' : ''}`}
                      style={{
                        '--cat-color': cat.color,
                        ...(settling
                          ? { animationName: lineAnim, animationDelay: `${35 * i}ms` }
                          : null),
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        onOpen(ev.id);
                      }}
                      title={`${ev.title} · ${ev.venue}, ${ev.town}`}
                    >
                      <span className="mo-evt-time">{isAllDay(ev) ? 'all day' : fmtTime(ev.start)}</span>
                      <span className="mo-evt-title">
                        {saved.includes(ev.id) && (
                          <span className="evt-star" aria-hidden="true">
                            ★{' '}
                          </span>
                        )}
                        {ev.title}
                      </span>
                    </button>
                  );
                })}
                {more > 0 && <span className="mo-more">+{more} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${ampm}` : `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function isAllDay(ev) {
  return ev && ev.start === '00:00' && ev.end === '23:59';
}

export function fmtEventTime(ev, { range = false } = {}) {
  if (isAllDay(ev)) return 'All day';
  if (!range) return fmtTime(ev.start);
  return `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function eventIcsDates(ev) {
  const iso = dateForDay(ev.day).iso;
  const ymd = iso.replace(/-/g, '');
  if (isAllDay(ev)) {
    const next = new Date(iso + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    const endYmd = `${next.getFullYear()}${pad2(next.getMonth() + 1)}${pad2(next.getDate())}`;
    return { dtstart: `;VALUE=DATE:${ymd}`, dtend: `;VALUE=DATE:${endYmd}`, allDay: true };
  }
  const stamp = t => {
    const [h, m] = t.split(':').map(Number);
    return `${ymd}T${pad2(h)}${pad2(m)}00`;
  };
  return { dtstart: `:${stamp(ev.start)}`, dtend: `:${stamp(ev.end)}`, allDay: false };
}

function icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function icsStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

function eventToVevent(ev) {
  const { dtstart, dtend } = eventIcsDates(ev);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ev.id}@nepa-almanac`,
    `DTSTAMP:${icsStamp()}`,
    `DTSTART${dtstart}`,
    `DTEND${dtend}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `LOCATION:${icsEscape(`${ev.venue}, ${ev.town}, PA`)}`,
  ];
  if (ev.blurb) lines.push(`DESCRIPTION:${icsEscape(ev.blurb)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function eventToIcs(ev) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northeast Almanac//EN',
    'CALSCALE:GREGORIAN',
    eventToVevent(ev),
    'END:VCALENDAR',
  ].join('\r\n');
}

export function eventsToIcs(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northeast Almanac//EN',
    'CALSCALE:GREGORIAN',
    ...events.map(eventToVevent),
    'END:VCALENDAR',
  ].join('\r\n');
}

export function eventToGcalUrl(ev) {
  const iso = dateForDay(ev.day).iso;
  const ymd = iso.replace(/-/g, '');
  let dates;
  if (isAllDay(ev)) {
    const next = new Date(iso + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    const endYmd = `${next.getFullYear()}${pad2(next.getMonth() + 1)}${pad2(next.getDate())}`;
    dates = `${ymd}/${endYmd}`;
  } else {
    const stamp = t => {
      const [h, m] = t.split(':').map(Number);
      return `${ymd}T${pad2(h)}${pad2(m)}00`;
    };
    dates = `${stamp(ev.start)}/${stamp(ev.end)}`;
  }
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates,
    location: `${ev.venue}, ${ev.town}, PA`,
    details: [ev.blurb, ev.url].filter(Boolean).join('\n\n'),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function eventToOutlookUrl(ev) {
  const iso = dateForDay(ev.day).iso;
  const allDay = isAllDay(ev);
  let startdt, enddt;
  if (allDay) {
    startdt = iso;
    const next = new Date(iso + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    enddt = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
  } else {
    const stamp = t => {
      const [h, m] = t.split(':').map(Number);
      return `${iso}T${pad2(h)}:${pad2(m)}:00`;
    };
    startdt = stamp(ev.start);
    enddt = stamp(ev.end);
  }
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    startdt,
    enddt,
    location: `${ev.venue}, ${ev.town}, PA`,
    body: [ev.blurb, ev.url].filter(Boolean).join('\n\n'),
    allday: allDay ? 'true' : 'false',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

export function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'event'
  );
}

export function downloadIcs(filename, ics) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
