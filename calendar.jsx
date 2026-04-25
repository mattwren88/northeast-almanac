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
                          <span className="evt-time">{fmtTime(ev.start)}</span>
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

Object.assign(window, { CalendarView, fmtTime });
