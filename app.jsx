// Main app — masthead, sidebar, view switching, filters

const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp } = React;

function App() {
  const tweaks = useTweaks(window.TWEAK_DEFAULTS);
  const [view, setView] = useStateApp('calendar'); // calendar | map | list
  const [weekOffset, setWeekOffset] = useStateApp(0);
  const [activeCats, setActiveCats] = useStateApp(Object.keys(CATEGORIES));
  const [activeTowns, setActiveTowns] = useStateApp(null); // null = all
  const [openEventId, setOpenEventId] = useStateApp(null);
  const [saved, setSaved] = useStateApp([]);
  const [planOpen, setPlanOpen] = useStateApp(false);
  const [hiddenOnly, setHiddenOnly] = useStateApp(false);
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

  const filtered = useMemoApp(() => {
    return events.filter(e => activeCats.includes(e.category))
      .filter(e => !hiddenOnly || e.hidden);
  }, [events, activeCats, hiddenOnly]);

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
          <div className="mast-date">SATURDAY, APRIL 25, 2026 — TWO-WEEK ALMANAC</div>
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
          Lackawanna, Wyoming, and Pocono valleys — refreshed Friday at dawn.
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="toolbar">
        <div className="toolbar-section toolbar-views">
          <span className="toolbar-label">View</span>
          {['calendar', 'map', 'list'].map(v => (
            <button
              key={v}
              className={`toolbar-tab ${view === v ? 'is-active' : ''}`}
              onClick={() => setLayout(v)}
            >
              {v === 'calendar' ? 'Week' : v === 'map' ? 'Map' : 'Index'}
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
        <div className="toolbar-section toolbar-flags">
          <button
            className={`toolbar-flag ${hiddenOnly ? 'is-active' : ''}`}
            onClick={() => setHiddenOnly(h => !h)}
          >
            ◊ Hidden gems only
          </button>
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
                    <span className="pick-when">{date.weekday} {date.month} {date.date}, {fmtTime(ev.start)}</span>
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
            <div className="colophon-v">venue calendars · Facebook events · regional papers · tip line</div>
          </div>
          <div className="colophon-block">
            <div className="colophon-k">Coverage area</div>
            <div className="colophon-v">Lackawanna · Luzerne · Wayne · Monroe · Carbon counties</div>
          </div>
          <div className="colophon-block">
            <div className="colophon-k">Set in</div>
            <div className="colophon-v">Newsreader, Instrument Serif & JetBrains Mono</div>
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
