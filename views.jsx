// Map view + List view + Event detail drawer + Weekend plan share

const { useState: useStateMV, useMemo: useMemoMV, useEffect: useEffectMV, useRef: useRefMV } = React;

const MAP_BBOX = { latMin: 40.80, latMax: 41.70, lngMin: -76.05, lngMax: -75.05 };
function eventLatLng(ev) {
  if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) return [ev.lat, ev.lng];
  if (ev.coords && Number.isFinite(ev.coords.x) && Number.isFinite(ev.coords.y)) {
    const lat = MAP_BBOX.latMax - ev.coords.y * (MAP_BBOX.latMax - MAP_BBOX.latMin);
    const lng = MAP_BBOX.lngMin + ev.coords.x * (MAP_BBOX.lngMax - MAP_BBOX.lngMin);
    return [lat, lng];
  }
  return null;
}

// ============ MAP VIEW ============
function MapView({ events, saved, onSave, onOpen }) {
  const today = todayDayOffset();
  // Anchor the strip to today: show 7 days starting today, clamped so we
  // always emit 7 valid offsets within the 14-day horizon.
  const startDay = Math.max(0, Math.min(today, 14 - 7));
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);
  const initialDay = days.includes(today) ? today : startDay;
  const [activeDay, setActiveDay] = useStateMV(initialDay);
  const dayEvents = events.filter(e => e.day === activeDay);

  const mapElRef = useRefMV(null);
  const mapRef = useRefMV(null);
  const layerRef = useRefMV(null);

  useEffectMV(() => {
    if (!mapElRef.current || !window.L || mapRef.current) return;
    const map = window.L.map(mapElRef.current, {
      center: [41.25, -75.55],
      zoom: 9,
      minZoom: 8,
      maxZoom: 15,
      maxBounds: [[40.55, -76.5], [41.95, -74.6]],
      maxBoundsViscosity: 0.8,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffectMV(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    const layer = window.L.markerClusterGroup
      ? window.L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 45,
          disableClusteringAtZoom: 13,
        })
      : window.L.layerGroup();
    dayEvents.forEach(ev => {
      const ll = eventLatLng(ev);
      if (!ll) return;
      const cat = CATEGORIES[ev.category] || { color: '#666', label: ev.category };
      const isSaved = saved.includes(ev.id);
      const marker = window.L.circleMarker(ll, {
        radius: ev.featured ? 9 : 7,
        color: '#1a1a1a',
        weight: isSaved ? 2.5 : 1,
        fillColor: cat.color,
        fillOpacity: 0.92,
      });
      const label = `<strong>${ev.title.replace(/</g, '&lt;')}</strong><br><span style="opacity:0.7">${fmtEventTime(ev)} · ${ev.venue.replace(/</g, '&lt;')}</span>`;
      marker.bindTooltip(label, { direction: 'top', offset: [0, -6] });
      marker.on('click', () => onOpen(ev.id));
      layer.addLayer(marker);
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => { layer.remove(); };
  }, [events, activeDay, saved]);

  return (
    <div className="map-wrap">
      <div className="map-day-strip">
        {days.map(d => {
          const date = dateForDay(d);
          const count = events.filter(e => e.day === d).length;
          const isToday = d === today;
          return (
            <button
              key={d}
              className={`map-day-pill ${activeDay === d ? 'is-active' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => setActiveDay(d)}
            >
              <span className="map-day-pill-wd">{date.weekday}{isToday && <span className="map-today-dot">·</span>}</span>
              <span className="map-day-pill-num">{date.date}</span>
              <span className="map-day-pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="map-canvas-wrap">
        <div className="map-canvas">
          <div className="leaflet-canvas" ref={mapElRef} />
          <div className="map-legend" aria-label="Category key">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <div key={key} className="map-legend-row">
                <span className="map-legend-dot" style={{ background: cat.color }} />
                <span className="map-legend-label">{cat.icon} {cat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="map-side">
          <div className="map-side-head">
            <div className="map-side-date">{dateForDay(activeDay).weekday}, {dateForDay(activeDay).month} {dateForDay(activeDay).date}</div>
            <div className="map-side-sub">{dayEvents.length} events</div>
          </div>
          <div className="map-side-list">
            {dayEvents.sort((a,b) => a.start.localeCompare(b.start)).map(ev => {
              const cat = CATEGORIES[ev.category];
              return (
                <button key={ev.id} className="map-side-item" onClick={() => onOpen(ev.id)}>
                  <span className="map-side-dot" style={{ background: cat.color }} />
                  <span className="map-side-time">{fmtEventTime(ev)}</span>
                  <span className="map-side-title">{ev.title}</span>
                  <span className="map-side-town">{ev.town}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ WEEKEND VIEW ============
function WeekendView({ events, saved, onSave, onOpen }) {
  const days = thisWeekendDays();
  if (days.length === 0) {
    return (
      <div className="weekend-wrap">
        <div className="weekend-empty">— No weekend in the visible horizon —</div>
      </div>
    );
  }
  const first = dateForDay(days[0]);
  const last = dateForDay(days[days.length - 1]);
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
          const dayEvents = events
            .filter(e => e.day === d)
            .sort((a, b) => a.start.localeCompare(b.start));
          const isToday = d === todayDayOffset();
          return (
            <div key={d} className={`weekend-col ${isToday ? 'is-today' : ''}`}>
              <div className="weekend-col-head">
                <div className="weekend-col-wd">
                  {date.weekday}
                  {isToday && <span className="cal-today-dot">today</span>}
                </div>
                <div className="weekend-col-num">{date.date}</div>
                <div className="weekend-col-meta">
                  <span className="cal-wx" title={wx.cond}>{wx.icon} {wx.high}°/{wx.low}°</span>
                  <span className="cal-count">{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</span>
                </div>
              </div>
              <div className="weekend-events">
                {dayEvents.length === 0 && (
                  <div className="cal-empty">— Nothing yet —</div>
                )}
                {dayEvents.map(ev => {
                  const cat = CATEGORIES[ev.category];
                  const isSaved = saved.includes(ev.id);
                  return (
                    <article
                      key={ev.id}
                      className={`evt ${ev.featured ? 'evt-featured' : ''}`}
                      onClick={() => onOpen(ev.id)}
                    >
                      <div className="evt-bar" style={{ background: cat.color }} />
                      <div className="evt-body">
                        <div className="evt-meta-row">
                          <span className={`evt-time ${isAllDay(ev) ? 'is-allday' : ''}`}>{fmtEventTime(ev)}</span>
                          {ev.featured && <span className="evt-pick">Editor's pick</span>}
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

// ============ LIST VIEW ============
const HORIZON_DAYS = 14;
function ListView({ events, saved, onSave, onOpen, weekOffset }) {
  const [query, setQuery] = useStateMV('');
  const minIso = useMemoMV(() => dateForDay(0).iso, []);
  const maxIso = useMemoMV(() => dateForDay(HORIZON_DAYS - 1).iso, []);
  const todayIso = useMemoMV(() => dateForDay(Math.max(0, todayDayOffset())).iso, []);
  const [fromIso, setFromIso] = useStateMV(todayIso);
  const [toIso, setToIso] = useStateMV(maxIso);

  const fuse = useMemoMV(() => {
    if (!window.Fuse) return null;
    return new window.Fuse(events, {
      keys: ['title', 'venue', 'town', 'blurb', 'tags', 'category'],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [events]);

  const searched = useMemoMV(() => {
    const q = query.trim();
    if (!q) return events;
    if (!fuse) {
      const ql = q.toLowerCase();
      return events.filter(e =>
        e.title.toLowerCase().includes(ql) ||
        e.venue.toLowerCase().includes(ql) ||
        e.town.toLowerCase().includes(ql) ||
        (e.blurb || '').toLowerCase().includes(ql)
      );
    }
    return fuse.search(q).map(r => r.item);
  }, [events, query, fuse]);

  const dayInRange = (d) => {
    const iso = dateForDay(d).iso;
    return iso >= fromIso && iso <= toIso;
  };

  const visibleDays = [];
  for (let d = 0; d < HORIZON_DAYS; d++) if (dayInRange(d)) visibleDays.push(d);

  const clearRange = () => { setFromIso(todayIso); setToIso(maxIso); };
  const totalShown = searched.filter(e => dayInRange(e.day)).length;

  return (
    <div className="list-wrap">
      <div className="list-controls">
        <input
          type="search"
          className="list-search"
          placeholder="Search events, venues, towns…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="list-range">
          <label className="list-range-label">From</label>
          <input
            type="date"
            className="list-date"
            value={fromIso}
            min={minIso}
            max={maxIso}
            onChange={(e) => setFromIso(e.target.value || minIso)}
          />
          <label className="list-range-label">to</label>
          <input
            type="date"
            className="list-date"
            value={toIso}
            min={minIso}
            max={maxIso}
            onChange={(e) => setToIso(e.target.value || maxIso)}
          />
          <button className="list-clear" onClick={clearRange}>Reset</button>
        </div>
        <div className="list-count">{totalShown} {totalShown === 1 ? 'event' : 'events'}</div>
      </div>
      {visibleDays.length === 0 && (
        <div className="list-empty">No events in this range.</div>
      )}
      {visibleDays.map(d => {
        const date = dateForDay(d);
        const wx = WEATHER[d];
        const dayEvents = searched.filter(e => e.day === d).sort((a, b) => a.start.localeCompare(b.start));
        if (dayEvents.length === 0) return null;
        const isToday = d === todayDayOffset();
        return (
          <section key={d} className={`list-day ${isToday ? 'is-today' : ''}`}>
            <header className="list-day-head">
              <div className="list-day-num">{date.date}</div>
              <div className="list-day-info">
                <div className="list-day-wd">{date.weekday}{isToday && <span className="list-today-dot">today</span>}</div>
                <div className="list-day-month">{date.month}</div>
              </div>
              <div className="list-day-rule" />
              <div className="list-day-wx">{wx.icon} {wx.high}° / {wx.low}°</div>
              <div className="list-day-count">{dayEvents.length} events</div>
            </header>
            <div className="list-day-items">
              {dayEvents.map(ev => {
                const cat = CATEGORIES[ev.category];
                const isSaved = saved.includes(ev.id);
                return (
                  <article key={ev.id} className="list-item" onClick={() => onOpen(ev.id)}>
                    <div className="list-item-time">
                      {isAllDay(ev) ? (
                        <span className="list-item-start is-allday">All day</span>
                      ) : (
                        <>
                          <span className="list-item-start">{fmtTime(ev.start)}</span>
                          <span className="list-item-end">to {fmtTime(ev.end)}</span>
                        </>
                      )}
                    </div>
                    <div className="list-item-body">
                      <div className="list-item-meta">
                        <span className="list-item-cat" style={{ color: cat.color }}>{cat.label}</span>
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
                      onClick={(e) => { e.stopPropagation(); onSave(ev.id); }}
                    >
                      {isSaved ? '★ Saved' : '☆ Save'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ============ EVENT DETAIL DRAWER ============
const EVENT_SOURCES = {
  dn:  { label: 'DiscoverNEPA',                home: 'https://discovernepa.com/events/' },
  hm:  { label: 'Happenings Magazine',         home: 'https://www.happeningsmagazinepa.com/events/' },
  lcl: { label: 'Lackawanna County Libraries', home: 'https://lclshome.org/events/' },
  scr: { label: 'City of Scranton',            home: 'https://scrantonpa.gov/events/' },
};
function eventSource(ev) {
  if (ev.source && EVENT_SOURCES[ev.source]) return EVENT_SOURCES[ev.source];
  const match = /^([a-z]+)-/.exec(ev.id || '');
  return match ? EVENT_SOURCES[match[1]] : null;
}

function EventDrawer({ event, isSaved, onSave, onClose }) {
  if (!event) return null;
  const cat = CATEGORIES[event.category];
  const date = dateForDay(event.day);
  const wx = WEATHER[event.day];
  const src = eventSource(event);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}>×</button>
        <div className="drawer-rail" style={{ background: cat.color }} />
        <div className="drawer-body">
          <div className="drawer-cat" style={{ color: cat.color }}>
            {cat.label.toUpperCase()}
            {event.featured && <span className="drawer-tag pick">· Editor's pick</span>}
            {event.hidden && <span className="drawer-tag hidden">· Hidden gem</span>}
          </div>
          <h2 className="drawer-title">{event.title}</h2>
          <div className="drawer-when">
            {date.weekday}, {date.month} {date.date} &nbsp;·&nbsp; {isAllDay(event) ? 'All day' : `${fmtTime(event.start)} – ${fmtTime(event.end)}`}
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
              <div className="drawer-stat-v">{wx.icon} {wx.high}° / {wx.low}°</div>
            </div>
            {event.recurring && (
              <div className="drawer-stat">
                <div className="drawer-stat-k">Cadence</div>
                <div className="drawer-stat-v">{event.recurring}</div>
              </div>
            )}
          </div>

          <div className="drawer-tags">
            {event.tags.map(t => <span key={t} className="drawer-chip">#{t}</span>)}
          </div>

          {src && (
            <div className="drawer-source">
              <span className="drawer-source-k">Listing via</span>
              <a className="drawer-source-v" href={src.home} target="_blank" rel="noopener noreferrer">
                {src.label} ↗
              </a>
            </div>
          )}

          <div className="drawer-actions">
            <button
              className={`drawer-btn primary ${isSaved ? 'is-saved' : ''}`}
              onClick={() => onSave(event.id)}
            >
              {isSaved ? '★ Saved to weekend' : '☆ Add to weekend'}
            </button>
            <button
              className="drawer-btn ghost"
              onClick={() => downloadIcs(`${slugify(event.title)}.ics`, eventToIcs(event))}
            >
              ↓ Add to calendar
            </button>
            {event.url && (
              <a className="drawer-btn ghost" href={event.url} target="_blank" rel="noopener noreferrer">↗ Event page</a>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ============ WEEKEND PLAN SIDEBAR ============
function WeekendPlan({ events, saved, onRemove, onClose, onShare }) {
  const items = saved.map(id => events.find(e => e.id === id)).filter(Boolean)
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  // Group by day
  const byDay = {};
  items.forEach(e => {
    if (!byDay[e.day]) byDay[e.day] = [];
    byDay[e.day].push(e);
  });

  return (
    <div className="plan-backdrop" onClick={onClose}>
      <aside className="plan" onClick={e => e.stopPropagation()}>
        <header className="plan-head">
          <div className="plan-eyebrow">YOUR PLAN</div>
          <h2 className="plan-title">The Weekend, Curated</h2>
          <button className="plan-close" onClick={onClose}>×</button>
        </header>
        {items.length === 0 ? (
          <div className="plan-empty">
            <div className="plan-empty-mark">☆</div>
            <p>Tap the star on any event to start building a weekend plan.</p>
          </div>
        ) : (
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
                      const cat = CATEGORIES[ev.category];
                      return (
                        <div key={ev.id} className="plan-item">
                          <div className="plan-item-time">{fmtEventTime(ev)}</div>
                          <div className="plan-item-body">
                            <div className="plan-item-title">{ev.title}</div>
                            <div className="plan-item-where">{ev.venue} · {ev.town}</div>
                          </div>
                          <button className="plan-item-x" onClick={() => onRemove(ev.id)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <footer className="plan-foot">
              <button
                className="plan-share"
                onClick={() => downloadIcs('northeast-almanac-weekend.ics', eventsToIcs(items))}
              >
                ↓ Download .ics
              </button>
              <button className="plan-share" onClick={onShare}>↗ Share this weekend</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

Object.assign(window, { MapView, ListView, EventDrawer, WeekendPlan, WeekendView });
