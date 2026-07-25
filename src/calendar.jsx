// Calendar view — week grid with editorial styling

import { useState, useMemo, useEffect } from 'react';
import { WEATHER, CATEGORIES, dateForDay, todayDayOffset } from './lib/data.js';

export function useIsMobile() {
  const [m, set] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const h = (e) => set(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return m;
}

export function CalendarView({ events, saved, onSave, onOpen, weekOffset, setWeekOffset, weatherAware, filterCount = 0, onResetFilters }) {
  const isMobile = useIsMobile();
  const todayD = todayDayOffset();
  // On mobile we anchor the week to today (clamped within the 14-day horizon)
  // and ignore weekOffset — Prev/Next is hidden.
  const startDay = isMobile
    ? Math.max(0, Math.min(todayD, 14 - 7))
    : weekOffset * 7;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);
  const dates = useMemo(() => {
    const out = {};
    for (let d = 0; d < 14; d++) out[d] = dateForDay(d);
    return out;
  }, []);
  const eventsByDay = useMemo(() => {
    const m = {};
    events.forEach(e => { (m[e.day] ||= []).push(e); });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  }, [events]);
  const startDate = dates[startDay];
  const endDate = dates[startDay + 6];

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <div className="cal-nav">
          {!isMobile && (
            <button
              className="cal-nav-btn"
              onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
              disabled={weekOffset === 0}
            >‹ Prev</button>
          )}
          <div className="cal-week-label">
            <span className="cal-week-em">{isMobile ? 'Next 7 days from' : 'Week of'}</span>{' '}
            {startDate.month} {startDate.date}
            {' — '}
            {endDate.month} {endDate.date}
          </div>
          {!isMobile && (
            <button
              className="cal-nav-btn"
              onClick={() => setWeekOffset(Math.min(1, weekOffset + 1))}
              disabled={weekOffset === 1}
            >Next ›</button>
          )}
        </div>
      </div>

      <div className="cal-grid">
        {days.map(d => {
          const date = dates[d];
          const wx = WEATHER[d];
          const dayEvents = eventsByDay[d] || [];
          const isWeekend = date.weekday === 'Sat' || date.weekday === 'Sun';
          const isToday = d === todayD;

          return (
            <div
              key={d}
              className={`cal-col ${isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}`}
            >
              <div className="cal-col-head">
                <div className="cal-day-name">
                  {date.weekday}
                  {isToday && <span className="cal-today-dot">today</span>}
                </div>
                <div className="cal-day-num">{date.date}</div>
                <div className="cal-day-meta">
                  <span className="cal-wx" title={wx.cond}>{wx.icon} {wx.high}°/{wx.low}°</span>
                  <span className="cal-count">{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</span>
                </div>
              </div>

              <div className="cal-events">
                {dayEvents.length === 0 && (
                  <div className="cal-empty">{filterCount > 0 ? '— Filtered out —' : '— Nothing yet —'}</div>
                )}
                {dayEvents.map(ev => {
                  const cat = CATEGORIES[ev.category];
                  const isSaved = saved.includes(ev.id);
                  const dimmed = weatherAware && wx.cond === 'rain' && !ev.indoor;
                  return (
                    <article
                      key={ev.id}
                      className={`evt ${dimmed ? 'evt-dim' : ''} ${ev.featured ? 'evt-featured' : ''}`}
                      onClick={() => onOpen(ev.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(ev.id); } }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${ev.title} at ${ev.venue}, ${ev.town}`}
                    >
                      <div className="evt-bar" style={{ background: cat.color }} />
                      <div className="evt-body">
                        <div className="evt-meta-row">
                          <span className={`evt-time ${isAllDay(ev) ? 'is-allday' : ''}`}>{fmtEventTime(ev)}</span>
                          {ev.featured && <span className="evt-pick">Editor's pick</span>}
                          {ev.hidden && <span className="evt-hidden">Hidden gem</span>}
                          {ev.recurring && <span className="evt-recur">↻</span>}
                        </div>
                        <h3 className="evt-title">{ev.title}</h3>
                        <div className="evt-where">
                          <span className="evt-venue">{ev.venue}</span>
                          <span className="evt-sep">·</span>
                          <span className="evt-town">{ev.town}</span>
                        </div>
                        <div className="evt-foot">
                          <span className="evt-cat" style={{ color: cat.color }}>
                            {cat.label.toUpperCase()}
                          </span>
                          <span className="evt-price">{ev.price}</span>
                          <button
                            className={`evt-save ${isSaved ? 'is-saved' : ''}`}
                            onClick={(e) => { e.stopPropagation(); onSave(ev.id); }}
                            aria-label={isSaved ? 'Remove from plan' : 'Save to plan'}
                            aria-pressed={isSaved}
                            title={isSaved ? 'Remove from plan' : 'Save to plan'}
                          >
                            {isSaved ? '★' : '☆'}
                          </button>
                        </div>
                        {dimmed && (
                          <div className="evt-warn">Outdoor · rain forecast</div>
                        )}
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

function pad2(n) { return String(n).padStart(2, '0'); }

function eventIcsDates(ev) {
  const iso = dateForDay(ev.day).iso;
  const ymd = iso.replace(/-/g, '');
  if (isAllDay(ev)) {
    const next = new Date(iso + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    const endYmd = `${next.getFullYear()}${pad2(next.getMonth() + 1)}${pad2(next.getDate())}`;
    return { dtstart: `;VALUE=DATE:${ymd}`, dtend: `;VALUE=DATE:${endYmd}`, allDay: true };
  }
  const stamp = (t) => {
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
    const stamp = (t) => {
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
    const stamp = (t) => {
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
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event';
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

