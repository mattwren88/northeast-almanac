// Main app — masthead, sidebar, view switching, filters

const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp } = React;

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

function parseHash() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const p = new URLSearchParams(raw);
  const view = p.get('view');
  const w = parseInt(p.get('w') || '', 10);
  const cats = p.get('cats');
  return {
    view: ALL_VIEWS.includes(view) ? view : null,
    weekOffset: Number.isInteger(w) && w >= 0 && w <= 1 ? w : null,
    activeCats: cats ? cats.split(',').filter(c => ALL_CATS.includes(c)) : null,
    openEventId: p.get('ev') || null,
    planOpen: p.get('plan') === '1',
  };
}

function writeHash(state) {
  const p = new URLSearchParams();
  if (state.view && state.view !== 'calendar') p.set('view', state.view);
  if (state.weekOffset) p.set('w', String(state.weekOffset));
  if (state.activeCats && state.activeCats.length !== ALL_CATS.length) {
    p.set('cats', state.activeCats.join(','));
  }
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
  const [activeTowns, setActiveTowns] = useStateApp(null); // null = all
  const [openEventId, setOpenEventId] = useStateApp(initial.openEventId);
  const [saved, setSaved] = useStateApp([]);
  const [planOpen, setPlanOpen] = useStateApp(initial.planOpen);
  const [aboutOpen, setAboutOpen] = useStateApp(false);
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

  // Restore saved
  useEffectApp(() => {
    try {
      const s = JSON.parse(localStorage.getItem('nepa-saved') || '[]');
      setSaved(s);
    } catch {}
  }, []);
  useEffectApp(() => {
    localStorage.setItem('nepa-saved', JSON.stringify(saved));
  }, [saved]);

  // Write URL hash whenever shareable state changes
  useEffectApp(() => {
    writeHash({ view, weekOffset, activeCats, openEventId, planOpen });
  }, [view, weekOffset, activeCats, openEventId, planOpen]);

  // Read hash on browser back/forward
  useEffectApp(() => {
    const onHash = () => {
      const h = parseHash();
      setView(h.view || 'calendar');
      setWeekOffset(h.weekOffset ?? 0);
      setActiveCats(h.activeCats || ALL_CATS);
      setOpenEventId(h.openEventId);
      setPlanOpen(h.planOpen);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const filtered = useMemoApp(() => {
    return events.filter(e => activeCats.includes(e.category));
  }, [events, activeCats]);

  const featuredThisWeek = useMemoApp(() => {
    const start = weekOffset * 7;
    return events.filter(e => e.featured && e.day >= start && e.day < start + 7);
  }, [events, weekOffset]);

  const openEvent = openEventId ? events.find(e => e.id === openEventId) : null;

  const toggleSave = (id) => {
    setSaved(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const toggleCat = (cat) => {
    setActiveCats(cs =>
      cs.includes(cat) ? cs.filter(c => c !== cat) : [...cs, cat]
    );
  };

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
            <span className="mast-plan-text">My Weekend</span>
            {saved.length > 0 && <span className="mast-plan-count">{saved.length}</span>}
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
          <span className="toolbar-label">View</span>
          {['calendar', 'weekend', 'map', 'list'].map(v => (
            <button
              key={v}
              className={`toolbar-tab ${view === v ? 'is-active' : ''}`}
              onClick={() => setLayout(v)}
            >
              {v === 'calendar' ? 'Week' : v === 'weekend' ? 'Weekend' : v === 'map' ? 'Map' : 'Index'}
            </button>
          ))}
        </div>
        <div className="toolbar-section toolbar-cats">
          <span className="toolbar-label">Filter</span>
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <button
              key={k}
              className={`toolbar-cat ${activeCats.includes(k) ? 'is-active' : ''}`}
              onClick={() => toggleCat(k)}
              style={{ '--cat-color': c.color }}
            >
              <span className="toolbar-cat-dot" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

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

      {/* MAIN VIEW */}
      <main className="main">
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
          onShare={() => alert('Share link copied — friends will see your saved events.')}
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
          <ul>
            <li><a href="https://discovernepa.com/events/" target="_blank" rel="noopener noreferrer">DiscoverNEPA</a> — regional tourism calendar</li>
            <li><a href="https://www.happeningsmagazinepa.com/events/" target="_blank" rel="noopener noreferrer">Happenings Magazine</a> — local culture and lifestyle</li>
            <li><a href="https://lclshome.org/events/" target="_blank" rel="noopener noreferrer">Lackawanna County Library System</a> — talks, kids' programs, classes</li>
            <li><a href="https://scrantonpa.gov/events/" target="_blank" rel="noopener noreferrer">City of Scranton</a> — municipal events</li>
            <li><a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a> — 14-day weather forecast</li>
          </ul>
          <p className="about-fine">
            All four event sources publish public Tribe Events Calendar
            REST feeds. We fetch only excerpts and titles, link back
            to each original page, and identify ourselves with a
            named User-Agent so site owners can reach us.
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
