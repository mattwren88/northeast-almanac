// Map view + List view + Event detail drawer + Weekend plan share

const { useState: useStateMV, useMemo: useMemoMV } = React;

// ============ MAP VIEW ============
function MapView({ events, saved, onSave, onOpen, weekOffset }) {
  const startDay = weekOffset * 7;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);
  const [activeDay, setActiveDay] = useStateMV(startDay);
  const dayEvents = events.filter(e => e.day === activeDay);

  // Cluster detection
  const clusters = {};
  dayEvents.forEach(e => {
    if (e.cluster) {
      if (!clusters[e.cluster]) clusters[e.cluster] = [];
      clusters[e.cluster].push(e);
    }
  });

  return (
    <div className="map-wrap">
      <div className="map-day-strip">
        {days.map(d => {
          const date = dateForDay(d);
          const count = events.filter(e => e.day === d).length;
          return (
            <button
              key={d}
              className={`map-day-pill ${activeDay === d ? 'is-active' : ''}`}
              onClick={() => setActiveDay(d)}
            >
              <span className="map-day-pill-wd">{date.weekday}</span>
              <span className="map-day-pill-num">{date.date}</span>
              <span className="map-day-pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="map-canvas-wrap">
        <div className="map-canvas">
          {/* NEPA regional map — coordinates derived from real lat/lon
              Bounding box: ~40.78°N–41.62°N, 75.95°W–75.05°W
              projected to 1000×700. North = up, East = right. */}
          <svg className="map-bg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="paper-grain" width="3" height="3" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="0.4" fill="oklch(0.85 0.01 60)" opacity="0.4"/>
              </pattern>
              <pattern id="forest-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.55 0.06 145)" strokeWidth="0.4" opacity="0.4"/>
              </pattern>
            </defs>
            <rect width="1000" height="700" fill="url(#paper-grain)" />

            {/* County outlines — soft dotted */}
            {/* Lackawanna County (Scranton) — north-central */}
            <path d="M 290 110 L 470 105 L 480 280 L 460 360 L 320 355 L 295 280 Z"
                  fill="oklch(0.96 0.012 80)" stroke="oklch(0.65 0.02 60)" strokeWidth="0.8"
                  strokeDasharray="3 3" opacity="0.7"/>
            {/* Luzerne County (Wilkes-Barre / Pittston) — center */}
            <path d="M 295 280 L 480 280 L 540 360 L 560 500 L 420 540 L 280 460 L 250 360 Z"
                  fill="oklch(0.96 0.012 80)" stroke="oklch(0.65 0.02 60)" strokeWidth="0.8"
                  strokeDasharray="3 3" opacity="0.7"/>
            {/* Wayne County (Honesdale / Hawley) — northeast */}
            <path d="M 470 105 L 720 95 L 820 180 L 800 320 L 580 310 L 480 280 Z"
                  fill="oklch(0.95 0.018 145)" stroke="oklch(0.55 0.04 145)" strokeWidth="0.8"
                  strokeDasharray="3 3" opacity="0.5"/>
            <rect x="480" y="100" width="340" height="220" fill="url(#forest-hatch)" opacity="0.35"
                  style={{clipPath: 'polygon(0% 5%, 71% 0%, 100% 38%, 94% 100%, 30% 95%, 0% 80%)'}}/>
            {/* Monroe County (Stroudsburg) — southeast */}
            <path d="M 560 500 L 800 460 L 900 580 L 850 680 L 600 670 L 540 590 Z"
                  fill="oklch(0.95 0.018 145)" stroke="oklch(0.55 0.04 145)" strokeWidth="0.8"
                  strokeDasharray="3 3" opacity="0.5"/>
            {/* Carbon County (Jim Thorpe) — southwest */}
            <path d="M 280 460 L 420 540 L 540 590 L 500 680 L 280 670 L 220 560 Z"
                  fill="oklch(0.95 0.018 145)" stroke="oklch(0.55 0.04 145)" strokeWidth="0.8"
                  strokeDasharray="3 3" opacity="0.5"/>

            {/* Pocono Mountains — hatched ridge in SE */}
            {Array.from({length: 14}, (_, i) => {
              const baseX = 600 + (i % 7) * 35;
              const baseY = 480 + Math.floor(i / 7) * 40;
              return (
                <g key={i} opacity="0.45">
                  <path d={`M ${baseX} ${baseY + 12} L ${baseX + 10} ${baseY} L ${baseX + 20} ${baseY + 12}`}
                        stroke="oklch(0.50 0.04 60)" strokeWidth="0.9" fill="none"/>
                </g>
              );
            })}

            {/* Susquehanna River — comes from NW, bends E through Pittston/WB, then south */}
            <path d="M 80 260 Q 180 285, 260 320 Q 330 360, 380 410 Q 420 450, 410 510 Q 400 580, 360 660"
                  stroke="oklch(0.72 0.06 230)" strokeWidth="5.5" fill="none" opacity="0.65"
                  strokeLinecap="round"/>
            {/* Lackawanna River — N→S, joins Susquehanna at Pittston (~380,410) */}
            <path d="M 405 90 Q 395 180, 388 250 Q 384 320, 380 410"
                  stroke="oklch(0.72 0.06 230)" strokeWidth="3" fill="none" opacity="0.55"
                  strokeLinecap="round"/>
            {/* Lehigh River — runs S through Jim Thorpe, separate watershed */}
            <path d="M 380 460 Q 360 530, 340 600 Q 325 650, 310 690"
                  stroke="oklch(0.72 0.06 230)" strokeWidth="3" fill="none" opacity="0.55"
                  strokeLinecap="round"/>
            {/* Lake Wallenpaupack — irregular blob in NE */}
            <path d="M 700 200 Q 720 195, 745 205 Q 760 215, 755 235 Q 745 250, 715 245 Q 695 240, 690 220 Z"
                  fill="oklch(0.78 0.06 230)" opacity="0.55" stroke="oklch(0.65 0.06 230)" strokeWidth="0.6"/>

            {/* Interstates — thin dashed */}
            {/* I-81 N/S corridor through Scranton & WB */}
            <path d="M 380 60 L 390 200 L 400 280 L 395 360 L 390 460 L 385 560 L 395 680"
                  stroke="oklch(0.55 0.04 60)" strokeWidth="1" fill="none"
                  strokeDasharray="6 4" opacity="0.45"/>
            {/* I-84 E from Scranton to Honesdale/Hawley */}
            <path d="M 400 220 L 500 215 L 620 220 L 750 230"
                  stroke="oklch(0.55 0.04 60)" strokeWidth="1" fill="none"
                  strokeDasharray="6 4" opacity="0.45"/>
            {/* I-380 SE to Stroudsburg */}
            <path d="M 410 290 L 500 380 L 600 480 L 680 560"
                  stroke="oklch(0.55 0.04 60)" strokeWidth="1" fill="none"
                  strokeDasharray="6 4" opacity="0.4"/>
            {/* Highway labels */}
            <g fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="oklch(0.50 0.04 60)" opacity="0.7">
              <text x="370" y="120">I-81</text>
              <text x="555" y="208">I-84</text>
              <text x="540" y="438">I-380</text>
            </g>

            {/* Town tick marks — small crosshairs at exact city locations */}
            {[
              { x: 392, y: 232, name: 'SCRANTON', size: 14, weight: 600, dy: -10 },
              { x: 372, y: 175, name: 'CLARKS SUMMIT', size: 9, weight: 400, dy: -8 },
              { x: 380, y: 410, name: 'PITTSTON', size: 10, weight: 500, dy: 14 },
              { x: 360, y: 470, name: 'WILKES-BARRE', size: 13, weight: 600, dy: 16 },
              { x: 668, y: 175, name: 'HONESDALE', size: 11, weight: 500, dy: -8 },
              { x: 738, y: 215, name: 'HAWLEY', size: 10, weight: 400, dy: 16 },
              { x: 690, y: 575, name: 'STROUDSBURG', size: 11, weight: 500, dy: 16 },
              { x: 350, y: 605, name: 'JIM THORPE', size: 11, weight: 500, dy: -10 },
            ].map(t => (
              <g key={t.name}>
                <line x1={t.x - 4} y1={t.y} x2={t.x + 4} y2={t.y} stroke="oklch(0.30 0.02 60)" strokeWidth="0.8"/>
                <line x1={t.x} y1={t.y - 4} x2={t.x} y2={t.y + 4} stroke="oklch(0.30 0.02 60)" strokeWidth="0.8"/>
                <text x={t.x + 7} y={t.y + t.dy}
                      fontFamily="'JetBrains Mono', monospace"
                      fontSize={t.size} fontWeight={t.weight}
                      fill="oklch(0.28 0.02 60)" opacity="0.85"
                      letterSpacing="1.5">{t.name}</text>
              </g>
            ))}

            {/* County labels — italic serif, low contrast */}
            <g fontFamily="'Instrument Serif', serif" fontStyle="italic" fontSize="13" fill="oklch(0.45 0.02 60)" opacity="0.55" textAnchor="middle">
              <text x="380" y="155">Lackawanna Co.</text>
              <text x="395" y="430">Luzerne Co.</text>
              <text x="650" y="135">Wayne Co.</text>
              <text x="720" y="630">Monroe Co.</text>
              <text x="380" y="650">Carbon Co.</text>
            </g>
            <g fontFamily="'Instrument Serif', serif" fontStyle="italic" fontSize="11" fill="oklch(0.55 0.06 230)" opacity="0.85">
              <text x="170" y="252" transform="rotate(-15 170 252)">Susquehanna R.</text>
              <text x="412" y="340" transform="rotate(85 412 340)">Lackawanna R.</text>
              <text x="358" y="555" transform="rotate(75 358 555)">Lehigh R.</text>
              <text x="708" y="265" textAnchor="middle">Wallenpaupack</text>
            </g>

            {/* Scale bar */}
            <g transform="translate(60, 660)" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="oklch(0.35 0.02 60)">
              <line x1="0" y1="0" x2="120" y2="0" stroke="oklch(0.35 0.02 60)" strokeWidth="1"/>
              <line x1="0" y1="-3" x2="0" y2="3" stroke="oklch(0.35 0.02 60)" strokeWidth="1"/>
              <line x1="60" y1="-3" x2="60" y2="3" stroke="oklch(0.35 0.02 60)" strokeWidth="1"/>
              <line x1="120" y1="-3" x2="120" y2="3" stroke="oklch(0.35 0.02 60)" strokeWidth="1"/>
              <text x="0" y="14">0</text>
              <text x="56" y="14">10</text>
              <text x="108" y="14">20 mi</text>
            </g>

            {/* Compass rose */}
            <g transform="translate(920, 70)">
              <circle r="24" fill="oklch(0.99 0.008 80)" stroke="oklch(0.30 0.02 60)" strokeWidth="0.8"/>
              <text y="-30" textAnchor="middle" fontFamily="'Instrument Serif', serif" fontSize="12" fill="oklch(0.30 0.02 60)" fontStyle="italic">N</text>
              <path d="M 0 -20 L -5 6 L 0 0 L 5 6 Z" fill="oklch(0.52 0.18 25)"/>
              <path d="M 0 20 L -5 -6 L 0 0 L 5 -6 Z" fill="oklch(0.30 0.02 60)"/>
              <circle r="1.5" fill="oklch(0.99 0.008 80)" stroke="oklch(0.30 0.02 60)" strokeWidth="0.5"/>
            </g>

            {/* Title cartouche */}
            <g transform="translate(60, 50)">
              <text fontFamily="'Instrument Serif', serif" fontStyle="italic" fontSize="22" fill="oklch(0.28 0.02 60)">A Map of the</text>
              <text y="26" fontFamily="'Instrument Serif', serif" fontSize="28" fill="oklch(0.28 0.02 60)" letterSpacing="-0.5">NORTHEAST PENNSYLVANIA REGION</text>
              <text y="46" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="oklch(0.45 0.02 60)" letterSpacing="2">SHOWING TOWNS · WATERWAYS · EVENTS THIS WEEK</text>
            </g>
          </svg>

          {/* Event pins */}
          {dayEvents.map(ev => {
            const cat = CATEGORIES[ev.category];
            const isSaved = saved.includes(ev.id);
            return (
              <button
                key={ev.id}
                className={`map-pin ${isSaved ? 'is-saved' : ''} ${ev.featured ? 'is-featured' : ''}`}
                style={{ left: `${ev.coords.x * 100}%`, top: `${ev.coords.y * 100}%` }}
                onClick={() => onOpen(ev.id)}
              >
                <span className="map-pin-dot" style={{ background: cat.color }} />
                <span className="map-pin-card">
                  <span className="map-pin-time">{fmtTime(ev.start)}</span>
                  <span className="map-pin-title">{ev.title}</span>
                  <span className="map-pin-venue">{ev.venue}</span>
                </span>
              </button>
            );
          })}

          {/* Cluster halos */}
          {Object.entries(clusters).filter(([k, v]) => v.length > 1).map(([k, evs]) => {
            const cx = evs.reduce((s, e) => s + e.coords.x, 0) / evs.length;
            const cy = evs.reduce((s, e) => s + e.coords.y, 0) / evs.length;
            return (
              <div
                key={k}
                className="map-cluster-halo"
                style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
              >
                <span className="map-cluster-label">
                  Cluster · {evs.length} events nearby
                </span>
              </div>
            );
          })}
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
                  <span className="map-side-time">{fmtTime(ev.start)}</span>
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

// ============ LIST VIEW ============
function ListView({ events, saved, onSave, onOpen, weekOffset }) {
  const startDay = weekOffset * 7;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);

  return (
    <div className="list-wrap">
      {days.map(d => {
        const date = dateForDay(d);
        const wx = WEATHER[d];
        const dayEvents = events.filter(e => e.day === d).sort((a, b) => a.start.localeCompare(b.start));
        if (dayEvents.length === 0) return null;
        return (
          <section key={d} className="list-day">
            <header className="list-day-head">
              <div className="list-day-num">{date.date}</div>
              <div className="list-day-info">
                <div className="list-day-wd">{date.weekday}</div>
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
                      <span className="list-item-start">{fmtTime(ev.start)}</span>
                      <span className="list-item-end">to {fmtTime(ev.end)}</span>
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
function EventDrawer({ event, isSaved, onSave, onClose }) {
  if (!event) return null;
  const cat = CATEGORIES[event.category];
  const date = dateForDay(event.day);
  const wx = WEATHER[event.day];
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
            {date.weekday}, {date.month} {date.date} &nbsp;·&nbsp; {fmtTime(event.start)} – {fmtTime(event.end)}
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

          <div className="drawer-actions">
            <button
              className={`drawer-btn primary ${isSaved ? 'is-saved' : ''}`}
              onClick={() => onSave(event.id)}
            >
              {isSaved ? '★ Saved to weekend' : '☆ Add to weekend'}
            </button>
            <button className="drawer-btn ghost">↗ Directions</button>
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
                          <div className="plan-item-time">{fmtTime(ev.start)}</div>
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
              <button className="plan-share" onClick={onShare}>↗ Share this weekend</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

Object.assign(window, { MapView, ListView, EventDrawer, WeekendPlan });
