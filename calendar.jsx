// Calendar view — week grid with editorial styling

const { useState, useMemo } = React;

function CalendarView({ events, saved, onSave, onOpen, weekOffset, setWeekOffset, weatherAware }) {
  const startDay = weekOffset * 7;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <div className="cal-nav">
          <button
            className="cal-nav-btn"
            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
          >‹ Prev</button>
          <div className="cal-week-label">
            <span className="cal-week-em">Week of</span>{' '}
            {dateForDay(startDay).month} {dateForDay(startDay).date}
            {' — '}
            {dateForDay(startDay + 6).month} {dateForDay(startDay + 6).date}
          </div>
          <button
            className="cal-nav-btn"
            onClick={() => setWeekOffset(Math.min(1, weekOffset + 1))}
            disabled={weekOffset === 1}
          >Next ›</button>
        </div>
      </div>

      <div className="cal-grid">
        {days.map(d => {
          const date = dateForDay(d);
          const wx = WEATHER[d];
          const dayEvents = events
            .filter(e => e.day === d)
            .sort((a, b) => a.start.localeCompare(b.start));
          const isWeekend = date.weekday === 'Sat' || date.weekday === 'Sun';
          const isToday = d === 0;

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
                  <div className="cal-empty">— Nothing yet —</div>
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
                            aria-label={isSaved ? 'Unsave' : 'Save'}
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

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${ampm}` : `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function isAllDay(ev) {
  return ev && ev.start === '00:00' && ev.end === '23:59';
}

function fmtEventTime(ev, { range = false } = {}) {
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

function eventToIcs(ev) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northeast Almanac//EN',
    'CALSCALE:GREGORIAN',
    eventToVevent(ev),
    'END:VCALENDAR',
  ].join('\r\n');
}

function eventsToIcs(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northeast Almanac//EN',
    'CALSCALE:GREGORIAN',
    ...events.map(eventToVevent),
    'END:VCALENDAR',
  ].join('\r\n');
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event';
}

function downloadIcs(filename, ics) {
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

Object.assign(window, { CalendarView, fmtTime, isAllDay, fmtEventTime, eventToIcs, eventsToIcs, downloadIcs, slugify });
