// Main app — masthead, sidebar, view switching, filters

const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp, useRef: useRefApp } = React;

function RefreshStamp({ generatedAt, eventStatus }) {
  if (eventStatus === 'mock') {
    return (
      <div className="mast-refresh stale" title="events.json not found — showing mock data">
        Mock data · run <code>node scripts/build-events.mjs</code> to fetch live
      </div>
    );
  }
  if (!generatedAt) return null;
  const refreshed = new Date(generatedAt);
  const ageMs = Date.now() - refreshed.getTime();
  const ageDays = Math.floor(ageMs / 86400000);
  const ageHours = Math.floor(ageMs / 3600000);
  let level = 'fresh';
  if (ageDays >= 10) level = 'stale';
  else if (ageDays >= 3) level = 'aging';
  const human = ageHours < 1 ? 'just now'
    : ageHours < 24 ? `${ageHours} ${ageHours === 1 ? 'hour' : 'hours'} ago`
    : ageDays < 7 ? `${ageDays} ${ageDays === 1 ? 'day' : 'days'} ago`
    : refreshed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className={`mast-refresh ${level}`}>
      Refreshed {human}
    </div>
  );
}

const ALL_VIEWS = ['calendar', 'weekend', 'map', 'list'];
const ALL_CATS = Object.keys(CATEGORIES);

// Editorial monochrome glyphs for the View toolbar. 20×20, currentColor stroke,
// inheriting tile color so the inverted active state works automatically.
const WeekGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
    <line x1="2.5" y1="7.5" x2="17.5" y2="7.5" />
    {[5.5, 7.7, 9.9, 12.1, 14.3].map((x, i) => (
      <line key={i} x1={x} y1="7.5" x2={x} y2="16" />
    ))}
  </svg>
);
const WeekendGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2"  y="9" width="4.5" height="6.5" rx="0.8" />
    <rect x="7.75" y="6" width="4.5" height="9.5" rx="0.8" />
    <rect x="13.5" y="9" width="4.5" height="6.5" rx="0.8" />
  </svg>
);
const MapGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3.5 C7 3.5 5 5.5 5 8 C5 11.5 10 16.5 10 16.5 C10 16.5 15 11.5 15 8 C15 5.5 13 3.5 10 3.5 Z" />
    <circle cx="10" cy="8" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);
const IndexGlyph = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="4.5" cy="5.5"  r="0.9" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="10"   r="0.9" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    <line x1="7.5" y1="5.5"  x2="17" y2="5.5" />
    <line x1="7.5" y1="10"   x2="17" y2="10" />
    <line x1="7.5" y1="14.5" x2="17" y2="14.5" />
  </svg>
);
const VIEW_TILES = [
  { key: 'calendar', label: 'Week',    Glyph: WeekGlyph },
  { key: 'weekend',  label: 'Weekend', Glyph: WeekendGlyph },
  { key: 'map',      label: 'Map',     Glyph: MapGlyph },
  { key: 'list',     label: 'Index',   Glyph: IndexGlyph },
];

function parseHash() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const p = new URLSearchParams(raw);
  const view = p.get('view');
  const w = parseInt(p.get('w') || '', 10);
  const cats = p.get('cats');
  const aud = p.get('aud');
  return {
    view: ALL_VIEWS.includes(view) ? view : null,
    weekOffset: Number.isInteger(w) && w >= 0 && w <= 1 ? w : null,
    activeCats: cats ? cats.split(',').filter(c => ALL_CATS.includes(c)) : null,
    activeAudiences: aud ? aud.split(',').filter(a => ALL_AUDIENCES.includes(a)) : null,
    town: p.get('town') || '',
    openEventId: p.get('ev') || null,
    planOpen: p.get('plan') === '1',
    sharedIds: (p.get('share') || '').split(',').filter(Boolean),
  };
}

function writeHash(state) {
  const p = new URLSearchParams();
  if (state.view && state.view !== 'calendar') p.set('view', state.view);
  if (state.weekOffset) p.set('w', String(state.weekOffset));
  if (state.activeCats && state.activeCats.length !== ALL_CATS.length) {
    p.set('cats', state.activeCats.join(','));
  }
  // Audiences: emit only when different from default (community-only).
  if (state.activeAudiences) {
    const sorted = [...state.activeAudiences].sort().join(',');
    if (sorted !== 'community') p.set('aud', sorted);
  }
  if (state.town) p.set('town', state.town);
  if (state.openEventId) p.set('ev', state.openEventId);
  if (state.planOpen) p.set('plan', '1');
  const next = p.toString();
  const target = next ? `#${next}` : '';
  if (window.location.hash !== target && !(window.location.hash === '' && target === '')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${target}`);
  }
}

function App() {
  const tweaks = useTweaks(window.TWEAK_DEFAULTS);
  const initial = parseHash();
  const [view, setView] = useStateApp(initial.view || 'calendar'); // calendar | map | list
  const [weekOffset, setWeekOffset] = useStateApp(initial.weekOffset ?? 0);
  const [activeCats, setActiveCats] = useStateApp(initial.activeCats || ALL_CATS);
  const [activeAudiences, setActiveAudiences] = useStateApp(initial.activeAudiences || ['community']); // colleges off by default
  const [activeTown, setActiveTown] = useStateApp(initial.town || ''); // '' = all
  const [filtersOpen, setFiltersOpen] = useStateApp(false);
  const [openEventId, setOpenEventId] = useStateApp(initial.openEventId);
  const [saved, setSaved] = useStateApp([]);
  const [planOpen, setPlanOpen] = useStateApp(initial.planOpen);
  const [aboutOpen, setAboutOpen] = useStateApp(false);
  const [shareCopied, setShareCopied] = useStateApp(false);
  const [events, setEvents] = useStateApp([]);
  const [eventStatus, setEventStatus] = useStateApp('loading'); // loading | live | mock | error
  const [generatedAt, setGeneratedAt] = useStateApp(null);

  // Load events from events.json (or mock fallback)
  useEffectApp(() => {
    loadEvents().then(({ events, source, generatedAt }) => {
      setEvents(events);
      setEventStatus(source);
      setGeneratedAt(generatedAt || null);
    }).catch(() => setEventStatus('error'));
  }, []);

  // Sync view with tweaks layout
  useEffectApp(() => {
    if (tweaks.values.layout && tweaks.values.layout !== view) {
      setView(tweaks.values.layout);
    }
  }, [tweaks.values.layout]);

  // Restore saved (and merge any ?share=… IDs from a friend's link)
  useEffectApp(() => {
    let s = [];
    try {
      s = JSON.parse(localStorage.getItem('nepa-saved') || '[]');
    } catch {}
    const incoming = initial.sharedIds || [];
    if (incoming.length > 0) {
      const merged = [...s];
      incoming.forEach(id => { if (!merged.includes(id)) merged.push(id); });
      setSaved(merged);
      setPlanOpen(true);
    } else {
      setSaved(s);
    }
  }, []);
  useEffectApp(() => {
    localStorage.setItem('nepa-saved', JSON.stringify(saved));
  }, [saved]);

  // Write URL hash whenever shareable state changes
  useEffectApp(() => {
    writeHash({ view, weekOffset, activeCats, activeAudiences, town: activeTown, openEventId, planOpen });
  }, [view, weekOffset, activeCats, activeAudiences, activeTown, openEventId, planOpen]);

  // Read hash on browser back/forward
  useEffectApp(() => {
    const onHash = () => {
      const h = parseHash();
      setView(h.view || 'calendar');
      setWeekOffset(h.weekOffset ?? 0);
      setActiveCats(h.activeCats || ALL_CATS);
      setActiveAudiences(h.activeAudiences || ['community']);
      setActiveTown(h.town || '');
      setOpenEventId(h.openEventId);
      setPlanOpen(h.planOpen);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Keyboard nav while drawer is open: Esc closes, ←/→ cycle through filtered events
  const filteredSortedIds = useMemoApp(() => {
    if (!openEventId) return null;
    return [...events]
      .filter(e =>
        activeCats.includes(e.category) &&
        activeAudiences.includes(e.audience || 'community') &&
        (!activeTown || e.town === activeTown)
      )
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
      .map(e => e.id);
  }, [events, activeCats, activeAudiences, activeTown, openEventId]);
  useEffectApp(() => {
    if (!openEventId || !filteredSortedIds) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpenEventId(null); return; }
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const idx = filteredSortedIds.indexOf(openEventId);
      if (idx === -1) return;
      if (e.key === 'ArrowRight' && idx < filteredSortedIds.length - 1) {
        e.preventDefault();
        setOpenEventId(filteredSortedIds[idx + 1]);
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        setOpenEventId(filteredSortedIds[idx - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openEventId, filteredSortedIds]);

  const allTowns = useMemoApp(() => {
    const set = new Set();
    events.forEach(e => { if (e.town) set.add(e.town); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filtered = useMemoApp(() => {
    return events.filter(e =>
      activeCats.includes(e.category) &&
      activeAudiences.includes(e.audience || 'community') &&
      (!activeTown || e.town === activeTown)
    );
  }, [events, activeCats, activeAudiences, activeTown]);

  const featuredThisWeek = useMemoApp(() => {
    const start = weekOffset * 7;
    return events.filter(e => e.featured && e.day >= start && e.day < start + 7);
  }, [events, weekOffset]);

  const openEvent = openEventId ? events.find(e => e.id === openEventId) : null;

  const toggleSave = (id) => {
    setSaved(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const upcomingSavedCount = useMemoApp(() => {
    if (events.length === 0) return saved.length;
    const today = todayDayOffset();
    return saved.filter(id => {
      const ev = events.find(e => e.id === id);
      return ev && ev.day >= today;
    }).length;
  }, [saved, events]);

  const clearPastSaved = () => {
    if (events.length === 0) return;
    const today = todayDayOffset();
    setSaved(s => s.filter(id => {
      const ev = events.find(e => e.id === id);
      return !ev || ev.day >= today;
    }));
  };

  const sharePlan = async () => {
    if (events.length === 0) return;
    const today = todayDayOffset();
    const ids = saved.filter(id => {
      const ev = events.find(e => e.id === id);
      return ev && ev.day >= today;
    });
    if (ids.length === 0) return;
    const url = `${location.origin}${location.pathname}#share=${ids.join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1800);
  };

  const toggleCat = (cat) => {
    setActiveCats(cs =>
      cs.includes(cat) ? cs.filter(c => c !== cat) : [...cs, cat]
    );
  };

  const toggleAudience = (a) => {
    setActiveAudiences(xs =>
      xs.includes(a) ? xs.filter(x => x !== a) : [...xs, a]
    );
  };

  const resetFilters = () => {
    setActiveCats(ALL_CATS);
    setActiveAudiences(['community']);
    setActiveTown('');
  };

  const filterCount = (
    (activeCats.length !== ALL_CATS.length ? 1 : 0) +
    (activeAudiences.length !== 1 || activeAudiences[0] !== 'community' ? 1 : 0) +
    (activeTown ? 1 : 0)
  );

  const setLayout = (v) => {
    setView(v);
    tweaks.set('layout', v);
  };

  return (
    <div className="paper">
      {/* MASTHEAD */}
      <header className="mast">
        <div className="mast-top">
          <div className="mast-edition">VOL. III · NO. 17</div>
          <div className="mast-date">{(() => {
            const t = new Date();
            const wd = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][t.getDay()];
            const mo = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][t.getMonth()];
            return `${wd}, ${mo} ${t.getDate()}, ${t.getFullYear()} — TWO-WEEK ALMANAC`;
          })()}</div>
          <div className="mast-price">FREE · PA</div>
        </div>
        <div className="mast-rule" />
        <div className="mast-title-row">
          <h1 className="mast-title">
            <span className="mast-the">The</span>
            <span className="mast-name">Northeast Almanac</span>
          </h1>
          <button className="mast-plan" onClick={() => setPlanOpen(true)}>
            <span className="mast-plan-star">★</span>
            <span className="mast-plan-text">My Plan</span>
            {upcomingSavedCount > 0 && <span className="mast-plan-count">{upcomingSavedCount}</span>}
          </button>
        </div>
        <div className="mast-rule thin" />
        <div className="mast-tagline">
          A standing chronicle of markets, gallery openings, hikes, dive bars,
          opera-house touring acts, and other goings-on across the
          Lackawanna, Wyoming, and Pocono valleys — refreshed daily at dawn.
        </div>
        <RefreshStamp generatedAt={generatedAt} eventStatus={eventStatus} />
      </header>

      {/* TOOLBAR */}
      <div className="toolbar">
        <div className="toolbar-section toolbar-views">
          {VIEW_TILES.map(t => (
            <button
              key={t.key}
              className={`toolbar-view-tile ${view === t.key ? 'is-active' : ''}`}
              onClick={() => setLayout(t.key)}
              aria-label={t.label}
              aria-pressed={view === t.key}
            >
              <span className="toolbar-view-tile-glyph"><t.Glyph /></span>
              <span className="toolbar-view-tile-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-section toolbar-filters-trigger">
          <button
            className={`filters-btn ${filtersOpen ? 'is-open' : ''} ${filterCount > 0 ? 'has-active' : ''}`}
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
          >
            <span className="filters-btn-icon">≡</span>
            <span className="filters-btn-label">Filters</span>
            {filterCount > 0 && <span className="filters-btn-badge">{filterCount}</span>}
            <span className="filters-btn-caret">{filtersOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {filtersOpen && (
        <FiltersPanel
          activeCats={activeCats}
          toggleCat={toggleCat}
          activeAudiences={activeAudiences}
          toggleAudience={toggleAudience}
          allTowns={allTowns}
          activeTown={activeTown}
          setActiveTown={setActiveTown}
          onReset={resetFilters}
          onClose={() => setFiltersOpen(false)}
          filterCount={filterCount}
        />
      )}

      {/* EDITOR'S PICKS RAIL */}
      {featuredThisWeek.length > 0 && view !== 'map' && (
        <section className="picks">
          <div className="picks-head">
            <h2 className="picks-title">Editor's Picks <span className="picks-em">— this fortnight</span></h2>
          </div>
          <div className="picks-rail">
            {featuredThisWeek.map((ev, i) => {
              const cat = CATEGORIES[ev.category];
              const date = dateForDay(ev.day);
              return (
                <article key={ev.id} className="pick" onClick={() => setOpenEventId(ev.id)}>
                  <div className="pick-num">№ {String(i + 1).padStart(2, '0')}</div>
                  <div className="pick-cat" style={{ color: cat.color }}>{cat.label.toUpperCase()}</div>
                  <h3 className="pick-title">{ev.title}</h3>
                  <p className="pick-blurb">{ev.blurb}</p>
                  <div className="pick-foot">
                    <span className="pick-when">{date.weekday} {date.month} {date.date}, {fmtEventTime(ev)}</span>
                    <span className="pick-where">{ev.venue}, {ev.town}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* WEATHER ADVISORY (when current week has rainy days that affect outdoor events) */}
      {eventStatus !== 'loading' && view !== 'map' && (() => {
        const start = view === 'weekend' ? 0 : weekOffset * 7;
        const end = view === 'weekend' ? 14 : start + 7;
        const rainyDays = [];
        for (let d = start; d < end; d++) {
          const wx = WEATHER[d];
          if (wx && wx.cond === 'rain') rainyDays.push(d);
        }
        if (rainyDays.length === 0) return null;
        const outdoorAtRisk = filtered.filter(e => rainyDays.includes(e.day) && !e.indoor).length;
        if (outdoorAtRisk === 0) return null;
        return (
          <div className="wx-advisory" role="note">
            <span className="wx-advisory-icon">☂</span>
            <span>
              <strong>{rainyDays.length}</strong> {rainyDays.length === 1 ? 'rainy day' : 'rainy days'} ahead
              {' — '}
              <strong>{outdoorAtRisk}</strong> outdoor {outdoorAtRisk === 1 ? 'event is' : 'events are'} dimmed in this view
            </span>
          </div>
        );
      })()}

      {/* MAIN VIEW */}
      <main className="main">
        {eventStatus === 'loading' && <LoadingSkeleton />}
        {eventStatus !== 'loading' && (
          <div key={view} className="view-fade">
            {view === 'calendar' && (
              <CalendarView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={setOpenEventId}
                weekOffset={weekOffset}
                setWeekOffset={setWeekOffset}
                weatherAware={true}
              />
            )}
            {view === 'weekend' && (
              <WeekendView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={setOpenEventId}
              />
            )}
            {view === 'map' && (
              <MapView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={setOpenEventId}
                weekOffset={weekOffset}
              />
            )}
            {view === 'list' && (
              <ListView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={setOpenEventId}
                weekOffset={weekOffset}
              />
            )}
          </div>
        )}
      </main>

      {/* COLOPHON */}
      <footer className="colophon">
        <div className="colophon-rule" />
        <div className="colophon-row">
          <div className="colophon-block">
            <div className="colophon-k">Compiled from</div>
            <div className="colophon-v">
              <a href="https://discovernepa.com/events/" target="_blank" rel="noopener noreferrer">DiscoverNEPA</a>
              {' · '}
              <a href="https://www.happeningsmagazinepa.com/events/" target="_blank" rel="noopener noreferrer">Happenings Magazine</a>
              {' · '}
              <a href="https://lclshome.org/events/" target="_blank" rel="noopener noreferrer">Lackawanna County Library System</a>
              {' · '}
              <a href="https://scrantonpa.gov/events/" target="_blank" rel="noopener noreferrer">City of Scranton</a>
              {' · '}
              <a href="https://events.scranton.edu/" target="_blank" rel="noopener noreferrer">University of Scranton</a>
              {' · '}
              <a href="https://www.marywood.edu/community/news-events" target="_blank" rel="noopener noreferrer">Marywood University</a>
              {' · '}
              <a href="https://www.keystone.edu/keystone-events/" target="_blank" rel="noopener noreferrer">Keystone College</a>
              {'. Weather via '}
              <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.
            </div>
          </div>
          <div className="colophon-block">
            <div className="colophon-k">Coverage area</div>
            <div className="colophon-v">Lackawanna · Luzerne · Wayne · Monroe · Carbon counties</div>
          </div>
          <div className="colophon-block">
            <div className="colophon-k">About</div>
            <div className="colophon-v">
              <button className="colophon-link" onClick={() => setAboutOpen(true)}>How this almanac is made →</button>
            </div>
          </div>
        </div>
      </footer>

      {/* DRAWER + PLAN */}
      {openEvent && (
        <EventDrawer
          event={openEvent}
          isSaved={saved.includes(openEvent.id)}
          onSave={toggleSave}
          onClose={() => setOpenEventId(null)}
        />
      )}
      {planOpen && (
        <WeekendPlan
          events={events}
          saved={saved}
          onRemove={toggleSave}
          onClose={() => setPlanOpen(false)}
          onShare={sharePlan}
          onClearPast={clearPastSaved}
          shareCopied={shareCopied}
        />
      )}

      <BackToTop />

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} generatedAt={generatedAt} />}

      {/* TWEAKS */}
      {tweaks.editing && (
        <TweaksPanel onClose={tweaks.dismiss} title="Tweaks">
          <TweakSection title="Layout">
            <TweakRadio
              label="Primary view"
              value={tweaks.values.layout}
              options={[
                { label: 'Calendar (week grid)', value: 'calendar' },
                { label: 'Map of the region', value: 'map' },
                { label: 'Index (list feed)', value: 'list' },
              ]}
              onChange={v => { setView(v); tweaks.set('layout', v); }}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

function AboutModal({ onClose, generatedAt }) {
  const refreshed = generatedAt ? new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : '—';
  return (
    <div className="about-backdrop" onClick={onClose}>
      <aside className="about" onClick={e => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="Close">×</button>
        <div className="about-eyebrow">COLOPHON · ABOUT THE ALMANAC</div>
        <h2 className="about-title">How this almanac is made</h2>

        <p className="about-lede">
          A non-commercial weekend planner for Northeast Pennsylvania.
          Events are pulled from public calendars run by the venues
          themselves, then organized by date, geography, and category.
          Every listing links back to its original source.
        </p>

        <section className="about-section">
          <h3>Sources</h3>
          <h4 className="about-subhead">Community calendars</h4>
          <ul>
            <li><a href="https://discovernepa.com/events/" target="_blank" rel="noopener noreferrer">DiscoverNEPA</a> — regional tourism calendar</li>
            <li><a href="https://www.happeningsmagazinepa.com/events/" target="_blank" rel="noopener noreferrer">Happenings Magazine</a> — local culture and lifestyle</li>
            <li><a href="https://lclshome.org/events/" target="_blank" rel="noopener noreferrer">Lackawanna County Library System</a> — talks, kids' programs, classes</li>
            <li><a href="https://scrantonpa.gov/events/" target="_blank" rel="noopener noreferrer">City of Scranton</a> — municipal events</li>
          </ul>
          <h4 className="about-subhead">College calendars (off by default)</h4>
          <ul>
            <li><a href="https://events.scranton.edu/" target="_blank" rel="noopener noreferrer">University of Scranton</a> — public events feed (JSON)</li>
            <li><a href="https://www.marywood.edu/community/news-events" target="_blank" rel="noopener noreferrer">Marywood University</a> — 25Live calendar (RSS)</li>
            <li><a href="https://www.keystone.edu/keystone-events/" target="_blank" rel="noopener noreferrer">Keystone College</a> — events feed (RSS)</li>
          </ul>
          <h4 className="about-subhead">Other</h4>
          <ul>
            <li><a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a> — 14-day weather forecast</li>
          </ul>
          <p className="about-fine">
            We fetch only excerpts and titles, link back to each
            original page, and identify ourselves with a named
            User-Agent so site owners can reach us. Colleges are
            hidden by default in the filter panel since their feeds
            include many academic dates that aren't public events.
          </p>
        </section>

        <section className="about-section">
          <h3>Refresh cadence</h3>
          <p>
            A GitHub Action runs the scraper daily at <strong>06:00 ET</strong>.
            If anything changed, the new <code>events.json</code> is
            committed back to the repo and the site picks it up on
            next page load.
          </p>
          <p className="about-fine">Last refreshed: <strong>{refreshed}</strong></p>
        </section>

        <section className="about-section">
          <h3>Coverage area</h3>
          <p>
            Lackawanna · Luzerne · Wayne · Monroe · Carbon counties.
            Events outside the bounding box (40.80–41.70°N, 76.05–75.05°W)
            are filtered out.
          </p>
        </section>

        <section className="about-section">
          <h3>Removal & corrections</h3>
          <p>
            If you run one of the venues or sources above and want a
            listing removed, the cadence changed, or your name spelled
            differently — open an issue at{' '}
            <a href="https://github.com/mattwren88/northeast-almanac/issues" target="_blank" rel="noopener noreferrer">
              github.com/mattwren88/northeast-almanac/issues
            </a>{' '}
            and it'll be handled within 24 hours.
          </p>
        </section>

        <section className="about-section">
          <h3>What this is not</h3>
          <ul>
            <li>Not a commercial product — no ads, no tracking, no email capture.</li>
            <li>Not a republication — listings are excerpts that link back to their source.</li>
            <li>Not exhaustive — only events with a date, location, and public listing show up.</li>
          </ul>
        </section>

        <footer className="about-foot">
          <a href="https://github.com/mattwren88/northeast-almanac" target="_blank" rel="noopener noreferrer">Source code on GitHub →</a>
        </footer>
      </aside>
    </div>
  );
}

function TownDropdown({ towns, value, onChange }) {
  const [open, setOpen] = useStateApp(false);
  const [query, setQuery] = useStateApp('');
  const [activeIdx, setActiveIdx] = useStateApp(0);
  const wrapRef = useRefApp(null);
  const inputRef = useRefApp(null);

  // Close on click outside or Esc
  useEffectApp(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus search when opening
  useEffectApp(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const options = useMemoApp(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? towns.filter(t => t.toLowerCase().includes(q)) : towns;
    return [{ value: '', label: 'All towns' }, ...filtered.map(t => ({ value: t, label: t }))];
  }, [towns, query]);

  const pick = (v) => { onChange(v); setOpen(false); };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt) pick(opt.value);
    }
  };

  const buttonLabel = value || 'All towns';

  return (
    <div className={`town-dd ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`town-dd-trigger ${value ? 'has-value' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="town-dd-trigger-label">{buttonLabel}</span>
        <span className="town-dd-trigger-caret">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="town-dd-pop" role="listbox">
          <div className="town-dd-search">
            <input
              ref={inputRef}
              type="search"
              placeholder={`Search ${towns.length} towns…`}
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={onInputKey}
            />
          </div>
          <div className="town-dd-list">
            {options.length === 1 && query && (
              <div className="town-dd-empty">No towns match "{query}"</div>
            )}
            {options.map((opt, i) => {
              const isSel = opt.value === value;
              const isActive = i === activeIdx;
              return (
                <button
                  key={opt.value || '__all'}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={`town-dd-row ${isSel ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${opt.value === '' ? 'is-all' : ''}`}
                  onClick={() => pick(opt.value)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <span className="town-dd-row-mark" aria-hidden="true">{isSel ? '✓' : ''}</span>
                  <span className="town-dd-row-label">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FiltersPanel({
  activeCats, toggleCat,
  activeAudiences, toggleAudience,
  allTowns, activeTown, setActiveTown,
  onReset, onClose, filterCount,
}) {
  return (
    <div className="filters-panel" role="region" aria-label="Filters">
      <div className="filters-grid">
        {/* SOURCE */}
        <div className="filters-block">
          <div className="filters-block-head">
            <span className="filters-block-k">Source</span>
            <span className="filters-block-hint">community by default · colleges add ~50 academic dates</span>
          </div>
          <div className="filters-block-rows">
            {Object.entries(AUDIENCES).map(([k, a]) => (
              <label key={k} className={`filters-check ${activeAudiences.includes(k) ? 'is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={activeAudiences.includes(k)}
                  onChange={() => toggleAudience(k)}
                />
                <span className="filters-check-mark" aria-hidden="true">{activeAudiences.includes(k) ? '✓' : ''}</span>
                <span className="filters-check-body">
                  <span className="filters-check-label">{a.label}</span>
                  <span className="filters-check-desc">{a.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* CATEGORY */}
        <div className="filters-block">
          <div className="filters-block-head">
            <span className="filters-block-k">Category</span>
            <span className="filters-block-hint">{activeCats.length} of {ALL_CATS.length} on</span>
          </div>
          <div className="filters-block-rows filters-cats">
            {Object.entries(CATEGORIES).map(([k, c]) => (
              <label
                key={k}
                className={`filters-cat ${activeCats.includes(k) ? 'is-on' : ''}`}
                style={{ '--cat-color': c.color }}
              >
                <input
                  type="checkbox"
                  checked={activeCats.includes(k)}
                  onChange={() => toggleCat(k)}
                />
                <span className="filters-cat-dot" />
                <span className="filters-cat-label">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* TOWN */}
        <div className="filters-block">
          <div className="filters-block-head">
            <span className="filters-block-k">Town</span>
            <span className="filters-block-hint">{allTowns.length} towns in this batch</span>
          </div>
          <div className="filters-block-rows">
            <TownDropdown
              towns={allTowns}
              value={activeTown}
              onChange={setActiveTown}
            />
          </div>
        </div>
      </div>

      <div className="filters-foot">
        <button className="filters-reset" onClick={onReset} disabled={filterCount === 0}>
          Reset all
        </button>
        <button className="filters-done" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="skel-wrap" role="status" aria-label="Loading events">
      <div className="skel-head">
        <div className="skel-eyebrow">SETTING TYPE · COMPILING THE WEEK</div>
        <div className="skel-title">Pulling tonight's edition…</div>
      </div>
      <div className="skel-grid">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skel-col">
            <div className="skel-day-num" />
            <div className="skel-line w70" />
            {[0, 1, 2].map(j => (
              <div key={j} className="skel-card">
                <div className="skel-bar" />
                <div className="skel-line w40" />
                <div className="skel-line w90" />
                <div className="skel-line w60" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BackToTop() {
  const [show, set] = useStateApp(false);
  useEffectApp(() => {
    const onScroll = () => set(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
    >
      ↑
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
