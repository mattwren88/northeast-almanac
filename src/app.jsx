// Main app — masthead, sidebar, view switching, filters

import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CATEGORIES,
  WEATHER,
  dateForDay,
  todayDayOffset,
  loadEvents,
} from './lib/data.js';
import { CalendarView, MonthView, fmtEventTime } from './calendar.jsx';
import { MapView, WeekendView, ListView, EventDrawer, WeekendPlan, DayModal } from './views.jsx';
import { SOURCES, COMMUNITY_SOURCES, COLLEGE_SOURCES, WEATHER_SOURCE } from './data/sources.js';
import { useTheme } from './theme.js';
import { HORIZON_DAYS, MAX_WEEK } from './lib/constants.js';

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
  // Reading the clock during render is impure by the letter of the rule, but this
  // stamp *is* "how long ago", and re-reading it on a re-render is the point.
  // eslint-disable-next-line react-hooks/purity
  const ageMs = Date.now() - refreshed.getTime();
  const ageDays = Math.floor(ageMs / 86400000);
  const ageHours = Math.floor(ageMs / 3600000);
  let level = 'fresh';
  if (ageDays >= 10) level = 'stale';
  else if (ageDays >= 3) level = 'aging';
  const human =
    ageHours < 1
      ? 'just now'
      : ageHours < 24
        ? `${ageHours} ${ageHours === 1 ? 'hour' : 'hours'} ago`
        : ageDays < 7
          ? `${ageDays} ${ageDays === 1 ? 'day' : 'days'} ago`
          : refreshed.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            });
  return <div className={`mast-refresh ${level}`}>Refreshed {human}</div>;
}

const ALL_VIEWS = ['calendar', 'month', 'weekend', 'map', 'list'];
const ALL_CATS = Object.keys(CATEGORIES);
const ALL_SOURCE_IDS = SOURCES.map(s => s.id); // everything on by default
const isAllSources = xs => xs.length === ALL_SOURCE_IDS.length;
// Isolate-pattern toggle shared by categories and sources: from "all on" a click
// shows only that item; from a partial set it adds/removes; removing the last
// one snaps back to all on.
function isolateToggle(list, item, all) {
  if (list.length === all.length) return [item];
  if (!list.includes(item)) return [...list, item];
  const next = list.filter(x => x !== item);
  return next.length ? next : all;
}

// Snapshot the currently-focused element so we can restore it after a
// modal closes. Call captureFocus() in the open-action handler (BEFORE
// setState), then call restoreFocus() in the close-action handler.
const focusReturn = {
  ref: { current: null },
  capture() {
    this.ref.current = document.activeElement;
  },
  restore() {
    const el = this.ref.current;
    this.ref.current = null;
    if (el && typeof el.focus === 'function') {
      // Defer so it runs after React unmounts the modal subtree.
      setTimeout(() => el.focus(), 0);
    }
  },
};

// Editorial monochrome glyphs for the View toolbar. 20×20, currentColor stroke,
// inheriting tile color so the inverted active state works automatically.
const WeekGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
    <line x1="2.5" y1="7.5" x2="17.5" y2="7.5" />
    {[5.5, 7.7, 9.9, 12.1, 14.3].map((x, i) => (
      <line key={i} x1={x} y1="7.5" x2={x} y2="16" />
    ))}
  </svg>
);
const MonthGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
    <line x1="2.5" y1="7.5" x2="17.5" y2="7.5" />
    <line x1="2.5" y1="11.5" x2="17.5" y2="11.5" />
    {[7.5, 12.5].map((x, i) => (
      <line key={i} x1={x} y1="7.5" x2={x} y2="16" />
    ))}
  </svg>
);
const WeekendGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="9" width="4.5" height="6.5" rx="0.8" />
    <rect x="7.75" y="6" width="4.5" height="9.5" rx="0.8" />
    <rect x="13.5" y="9" width="4.5" height="6.5" rx="0.8" />
  </svg>
);
const MapGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 3.5 C7 3.5 5 5.5 5 8 C5 11.5 10 16.5 10 16.5 C10 16.5 15 11.5 15 8 C15 5.5 13 3.5 10 3.5 Z" />
    <circle cx="10" cy="8" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);
const IndexGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <circle cx="4.5" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    <line x1="7.5" y1="5.5" x2="17" y2="5.5" />
    <line x1="7.5" y1="10" x2="17" y2="10" />
    <line x1="7.5" y1="14.5" x2="17" y2="14.5" />
  </svg>
);
const SunGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <circle cx="10" cy="10" r="3.6" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
      <line
        key={deg}
        x1={10 + 6 * Math.cos((deg * Math.PI) / 180)}
        y1={10 + 6 * Math.sin((deg * Math.PI) / 180)}
        x2={10 + 7.8 * Math.cos((deg * Math.PI) / 180)}
        y2={10 + 7.8 * Math.sin((deg * Math.PI) / 180)}
      />
    ))}
  </svg>
);
const MoonGlyph = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinejoin="round"
  >
    <path d="M15.5 12.4A6.4 6.4 0 0 1 7.6 4.5a6.4 6.4 0 1 0 7.9 7.9 Z" />
  </svg>
);

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      className="mast-theme"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={dark}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <SunGlyph /> : <MoonGlyph />}
    </button>
  );
}

const VIEW_TILES = [
  { key: 'calendar', label: 'Week', Glyph: WeekGlyph },
  { key: 'month', label: 'Month', Glyph: MonthGlyph },
  { key: 'weekend', label: 'Weekend', Glyph: WeekendGlyph },
  { key: 'map', label: 'Map', Glyph: MapGlyph },
  { key: 'list', label: 'Index', Glyph: IndexGlyph },
];

function parseHash() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const p = new URLSearchParams(raw);
  const view = p.get('view');
  const w = parseInt(p.get('w') || '', 10);
  const cats = p.get('cats');
  const src = p.get('src');
  const aud = p.get('aud'); // legacy links: aud=community|college → that group's sources
  let activeSources = null;
  if (src) activeSources = src.split(',').filter(id => ALL_SOURCE_IDS.includes(id));
  else if (aud) {
    const groups = aud.split(',');
    activeSources = SOURCES.filter(s => groups.includes(s.audience)).map(s => s.id);
  }
  if (activeSources && activeSources.length === 0) activeSources = null;
  const day = parseInt(p.get('day') || '', 10);
  return {
    openDay: Number.isInteger(day) && day >= 0 && day < HORIZON_DAYS ? day : null,
    view: ALL_VIEWS.includes(view) ? view : null,
    weekOffset: Number.isInteger(w) && w >= 0 && w <= MAX_WEEK ? w : null,
    activeCats: cats ? cats.split(',').filter(c => ALL_CATS.includes(c)) : null,
    activeSources,
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
  // Sources: emit only when narrowed.
  if (state.activeSources && !isAllSources(state.activeSources)) {
    p.set('src', ALL_SOURCE_IDS.filter(id => state.activeSources.includes(id)).join(','));
  }
  if (state.town) p.set('town', state.town);
  if (state.openEventId) p.set('ev', state.openEventId);
  if (state.planOpen) p.set('plan', '1');
  if (state.openDay != null) p.set('day', String(state.openDay));
  const next = p.toString();
  const target = next ? `#${next}` : '';
  if (window.location.hash !== target && !(window.location.hash === '' && target === '')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${target}`);
  }
}

// Seed the plan from localStorage, merging any ?share=… IDs from a friend's link.
// Runs as a lazy useState initializer so the plan is correct on the first paint.
function restoreSavedPlan(sharedIds) {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem('nepa-saved') || '[]');
  } catch {
    // Corrupt or unavailable storage — start from an empty plan.
  }
  const incoming = sharedIds || [];
  if (incoming.length === 0) return stored;
  const merged = [...stored];
  incoming.forEach(id => {
    if (!merged.includes(id)) merged.push(id);
  });
  return merged;
}

export function App() {
  const initial = parseHash();
  const [view, setView] = useState(initial.view || 'calendar'); // calendar | map | list
  const [weekOffset, setWeekOffset] = useState(initial.weekOffset ?? 0);
  const [activeCats, setActiveCats] = useState(initial.activeCats || ALL_CATS);
  const [activeSources, setActiveSources] = useState(initial.activeSources || ALL_SOURCE_IDS);
  const [activeTown, setActiveTown] = useState(initial.town || ''); // '' = all
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openEventId, setOpenEventId] = useState(initial.openEventId);
  const [drawerClosing, setDrawerClosing] = useState(false);
  // Bumped on every category toggle, town pick, and filter reset — drives the
  // card-settle animation in the grid views (alternates between two identical
  // keyframe sets so back-to-back changes still re-trigger it).
  const [filterTick, setFilterTick] = useState(0);
  const [saved, setSaved] = useState(() => restoreSavedPlan(initial.sharedIds));
  // A shared link lands with the plan open so the recipient sees what was sent.
  const [planOpen, setPlanOpen] = useState(
    initial.planOpen || (initial.sharedIds || []).length > 0,
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [openDay, setOpenDay] = useState(initial.openDay);
  const [toast, setToast] = useState(null); // { msg, undo? }
  const toastTimerRef = useRef(null);
  // Wrap state setters so opens capture focus and closes restore it.
  const viewEvent = id => {
    focusReturn.capture();
    setOpenEventId(id);
  };
  const closeEvent = useCallback(() => {
    if (drawerClosing) return; // guard re-entry while the exit animation plays
    setDrawerClosing(true);
    setTimeout(() => {
      setDrawerClosing(false);
      setOpenEventId(null);
      focusReturn.restore();
    }, 200);
  }, [drawerClosing]);
  const openPlan = () => {
    focusReturn.capture();
    setPlanOpen(true);
  };
  const closePlan = () => {
    setPlanOpen(false);
    focusReturn.restore();
  };
  const closeDay = () => {
    setOpenDay(null);
    focusReturn.restore();
  };
  const openAbout = () => {
    focusReturn.capture();
    setAboutOpen(true);
  };
  const closeAbout = () => {
    setAboutOpen(false);
    focusReturn.restore();
  };
  const toggleFilters = () => {
    if (filtersOpen) {
      setFiltersOpen(false);
      focusReturn.restore();
    } else {
      focusReturn.capture();
      setFiltersOpen(true);
    }
  };
  const showToast = (msg, undo) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, undo });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };
  const [events, setEvents] = useState([]);
  const [eventStatus, setEventStatus] = useState('loading'); // loading | live | mock | error
  const [generatedAt, setGeneratedAt] = useState(null);

  // Load events from events.json (or mock fallback)
  useEffect(() => {
    loadEvents()
      .then(({ events, source, generatedAt }) => {
        setEvents(events);
        setEventStatus(source);
        setGeneratedAt(generatedAt || null);
      })
      .catch(() => setEventStatus('error'));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('nepa-saved', JSON.stringify(saved));
    } catch {
      // Safari private mode throws on write; a throw here would unmount the tree.
      // The plan stays in memory for the session — losing persistence beats a blank page.
    }
  }, [saved]);

  // Write URL hash whenever shareable state changes
  useEffect(() => {
    writeHash({
      view,
      weekOffset,
      activeCats,
      activeSources,
      town: activeTown,
      openEventId,
      planOpen,
      openDay,
    });
  }, [view, weekOffset, activeCats, activeSources, activeTown, openEventId, planOpen, openDay]);

  // Read hash on browser back/forward
  useEffect(() => {
    const onHash = () => {
      const h = parseHash();
      setView(h.view || 'calendar');
      setWeekOffset(h.weekOffset ?? 0);
      setActiveCats(h.activeCats || ALL_CATS);
      setActiveSources(h.activeSources || ALL_SOURCE_IDS);
      setActiveTown(h.town || '');
      setOpenEventId(h.openEventId);
      setPlanOpen(h.planOpen);
      setOpenDay(h.openDay);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Keyboard nav while drawer is open: Esc closes, ←/→ cycle through filtered events
  const filteredSortedIds = useMemo(() => {
    if (!openEventId) return null;
    return [...events]
      .filter(
        e =>
          activeCats.includes(e.category) &&
          activeSources.includes(e.source) &&
          (!activeTown || e.town === activeTown),
      )
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
      .map(e => e.id);
  }, [events, activeCats, activeSources, activeTown, openEventId]);
  useEffect(() => {
    if (!openEventId && !planOpen && !aboutOpen && openDay == null) return;
    const onKey = e => {
      if (e.key === 'Escape') {
        // Close the topmost modal (last opened wins by precedence)
        if (aboutOpen) closeAbout();
        else if (openEventId) closeEvent();
        else if (openDay != null) closeDay();
        else if (planOpen) closePlan();
        return;
      }
      if (!openEventId || !filteredSortedIds) return;
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
  }, [openEventId, filteredSortedIds, planOpen, aboutOpen, openDay, closeEvent]);

  const allTowns = useMemo(() => {
    const set = new Set();
    events.forEach(e => {
      if (e.town) set.add(e.town);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter(
      e =>
        activeCats.includes(e.category) &&
        activeSources.includes(e.source) &&
        (!activeTown || e.town === activeTown),
    );
  }, [events, activeCats, activeSources, activeTown]);

  const featuredThisWeek = useMemo(() => {
    const start = weekOffset * 7;
    return events.filter(e => e.featured && e.day >= start && e.day < start + 7);
  }, [events, weekOffset]);

  const eventsById = useMemo(() => {
    const m = new Map();
    events.forEach(e => m.set(e.id, e));
    return m;
  }, [events]);

  const openEvent = openEventId ? eventsById.get(openEventId) || null : null;

  const toggleSave = id => {
    setSaved(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  };

  const upcomingSavedCount = useMemo(() => {
    if (events.length === 0) return saved.length;
    const today = todayDayOffset();
    return saved.filter(id => {
      const ev = eventsById.get(id);
      return ev && ev.day >= today;
    }).length;
  }, [saved, events, eventsById]);

  const clearPastSaved = () => {
    if (events.length === 0) return;
    const today = todayDayOffset();
    const prev = saved;
    const next = saved.filter(id => {
      const ev = eventsById.get(id);
      return ev && ev.day >= today;
    });
    const removed = prev.length - next.length;
    if (removed === 0) return;
    setSaved(next);
    showToast(`Cleared ${removed} past ${removed === 1 ? 'event' : 'events'}`, () =>
      setSaved(prev),
    );
  };

  const sharePlan = async () => {
    if (events.length === 0) return;
    const today = todayDayOffset();
    const ids = saved.filter(id => {
      const ev = eventsById.get(id);
      return ev && ev.day >= today;
    });
    if (ids.length === 0) return;
    const url = `${location.origin}${location.pathname}#share=${ids.join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
    }
    showToast('Share link copied to clipboard');
  };

  // Isolate pattern: from "all on", a click shows only that category; from a
  // partial set it adds/removes; removing the last one snaps back to all on.
  const toggleCat = cat => {
    setActiveCats(cs => isolateToggle(cs, cat, ALL_CATS));
    setFilterTick(t => t + 1);
  };

  const showAllCats = () => {
    setActiveCats(ALL_CATS);
    setFilterTick(t => t + 1);
  };

  const setActiveTownTicked = t => {
    setActiveTown(t);
    setFilterTick(n => n + 1);
  };

  const toggleSource = id => {
    setActiveSources(xs => isolateToggle(xs, id, ALL_SOURCE_IDS));
    setFilterTick(t => t + 1);
  };
  // Group-level all/none (audience = 'community' | 'college'). "none" on the
  // only remaining group would empty the set — snap back to all instead.
  const setSourceGroup = (audience, on) => {
    const ids = SOURCES.filter(s => s.audience === audience).map(s => s.id);
    setActiveSources(xs => {
      const rest = xs.filter(id => !ids.includes(id));
      const next = on ? [...rest, ...ids] : rest;
      return next.length ? next : ALL_SOURCE_IDS;
    });
    setFilterTick(t => t + 1);
  };
  const showAllSources = () => {
    setActiveSources(ALL_SOURCE_IDS);
    setFilterTick(t => t + 1);
  };

  const resetFilters = () => {
    if (filterCount === 0) return;
    const prev = { cats: activeCats, sources: activeSources, town: activeTown };
    setActiveCats(ALL_CATS);
    setActiveSources(ALL_SOURCE_IDS);
    setActiveTown('');
    setFilterTick(t => t + 1);
    showToast('Filters reset', () => {
      setActiveCats(prev.cats);
      setActiveSources(prev.sources);
      setActiveTown(prev.town);
      setFilterTick(t => t + 1);
    });
  };

  const filterCount =
    (activeCats.length !== ALL_CATS.length ? 1 : 0) +
    (isAllSources(activeSources) ? 0 : 1) +
    (activeTown ? 1 : 0);

  // Month cell click → day modal; its footer link jumps to that week in the Week view.
  const pickDay = d => {
    if (d < 0 || d >= HORIZON_DAYS) return;
    focusReturn.capture();
    setOpenDay(d);
  };
  const openWeekFor = d => {
    setOpenDay(null);
    setWeekOffset(Math.floor(d / 7));
    setView('calendar');
  };
  const openDayEvents = useMemo(
    () =>
      openDay == null
        ? []
        : filtered.filter(e => e.day === openDay).sort((a, b) => a.start.localeCompare(b.start)),
    [filtered, openDay],
  );

  const setLayout = v => {
    setView(v);
  };

  return (
    <div className="paper">
      {/* MASTHEAD */}
      <header className="mast">
        <div className="mast-top">
          <div className="mast-edition">VOL. III · NO. 17</div>
          <div className="mast-date">
            {(() => {
              const t = new Date();
              const wd = [
                'SUNDAY',
                'MONDAY',
                'TUESDAY',
                'WEDNESDAY',
                'THURSDAY',
                'FRIDAY',
                'SATURDAY',
              ][t.getDay()];
              const mo = [
                'JANUARY',
                'FEBRUARY',
                'MARCH',
                'APRIL',
                'MAY',
                'JUNE',
                'JULY',
                'AUGUST',
                'SEPTEMBER',
                'OCTOBER',
                'NOVEMBER',
                'DECEMBER',
              ][t.getMonth()];
              return `${wd}, ${mo} ${t.getDate()}, ${t.getFullYear()} — SIX-WEEK ALMANAC`;
            })()}
          </div>
          <div className="mast-price">FREE · PA</div>
        </div>
        <div className="mast-rule" />
        <div className="mast-title-row">
          <h1 className="mast-title">
            <span className="mast-the">The</span>
            <span className="mast-name">Northeast Almanac</span>
          </h1>
          <div className="mast-actions">
            <ThemeToggle />
            <button className="mast-plan" onClick={openPlan}>
              <span className="mast-plan-star">★</span>
              <span className="mast-plan-text">My Plan</span>
              {upcomingSavedCount > 0 && (
                <span className="mast-plan-count">{upcomingSavedCount}</span>
              )}
            </button>
          </div>
        </div>
        <div className="mast-rule thin" />
        <div className="mast-tagline">
          A standing chronicle of markets, gallery openings, hikes, dive bars, opera-house touring
          acts, and other goings-on across the Lackawanna, Wyoming, and Pocono valleys — refreshed
          daily at dawn.
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
              <span className="toolbar-view-tile-glyph">
                <t.Glyph />
              </span>
              <span className="toolbar-view-tile-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-section toolbar-filters-trigger">
          <button
            className={`filters-btn ${filtersOpen ? 'is-open' : ''} ${filterCount > 0 ? 'has-active' : ''}`}
            onClick={toggleFilters}
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
          showAllCats={showAllCats}
          activeSources={activeSources}
          toggleSource={toggleSource}
          setSourceGroup={setSourceGroup}
          showAllSources={showAllSources}
          allTowns={allTowns}
          activeTown={activeTown}
          setActiveTown={setActiveTownTicked}
          onReset={resetFilters}
          onClose={toggleFilters}
          filterCount={filterCount}
        />
      )}

      {/* EDITOR'S PICKS RAIL — cut from the week grid and weekend view; the
          featured events already appear there with a "Pick" chip on the card. */}
      {featuredThisWeek.length > 0 && view === 'list' && (
        <section className="picks">
          <div className="picks-head">
            <h2 className="picks-title">
              Editor's Picks <span className="picks-em">— coming up</span>
            </h2>
          </div>
          <div className="picks-rail">
            {featuredThisWeek.map((ev, i) => {
              const cat = CATEGORIES[ev.category];
              const date = dateForDay(ev.day);
              return (
                <article
                  key={ev.id}
                  className="pick"
                  onClick={() => viewEvent(ev.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      viewEvent(ev.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Editor's pick: ${ev.title}`}
                >
                  <div className="pick-num">№ {String(i + 1).padStart(2, '0')}</div>
                  <div className="pick-cat" style={{ color: cat.color }}>
                    {cat.label.toUpperCase()}
                  </div>
                  <h3 className="pick-title">{ev.title}</h3>
                  <p className="pick-blurb">{ev.blurb}</p>
                  <div className="pick-foot">
                    <span className="pick-when">
                      {date.weekday} {date.month} {date.date}, {fmtEventTime(ev)}
                    </span>
                    <span className="pick-where">
                      {ev.venue}, {ev.town}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* WEATHER ADVISORY (when current week has rainy days that affect outdoor events) */}
      {eventStatus !== 'loading' &&
        eventStatus !== 'error' &&
        view !== 'map' &&
        view !== 'month' &&
        (() => {
          const start = view === 'weekend' ? 0 : weekOffset * 7;
          const end = view === 'weekend' ? HORIZON_DAYS : start + 7;
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
                <strong>{rainyDays.length}</strong>{' '}
                {rainyDays.length === 1 ? 'rainy day' : 'rainy days'} ahead
                {' — '}
                <strong>{outdoorAtRisk}</strong> outdoor{' '}
                {outdoorAtRisk === 1 ? 'event is' : 'events are'} dimmed in this view
              </span>
            </div>
          );
        })()}

      {/* MAIN VIEW */}
      <main className="main">
        {eventStatus === 'loading' && <LoadingSkeleton />}
        {eventStatus === 'error' && (
          <div className="error-state">
            <div className="error-state-mark">⚠</div>
            <h2 className="error-state-title">Couldn't load events</h2>
            <p className="error-state-msg">
              The events feed is unreachable right now. Check your connection and try again.
            </p>
            <button className="error-state-btn" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        )}
        {eventStatus !== 'loading' && eventStatus !== 'error' && (
          <div key={view} className="view-fade">
            {view === 'calendar' && (
              <CalendarView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={viewEvent}
                weekOffset={weekOffset}
                setWeekOffset={setWeekOffset}
                weatherAware={true}
                filterCount={filterCount}
                filterTick={filterTick}
                onResetFilters={resetFilters}
              />
            )}
            {view === 'month' && (
              <MonthView
                events={filtered}
                saved={saved}
                onOpen={viewEvent}
                onPickDay={pickDay}
                filterTick={filterTick}
              />
            )}
            {view === 'weekend' && (
              <WeekendView
                events={filtered}
                saved={saved}
                onOpen={viewEvent}
                filterTick={filterTick}
              />
            )}
            {view === 'map' && (
              <MapView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={viewEvent}
                weekOffset={weekOffset}
              />
            )}
            {view === 'list' && (
              <ListView
                events={filtered}
                saved={saved}
                onSave={toggleSave}
                onOpen={viewEvent}
                weekOffset={weekOffset}
                filterCount={filterCount}
                onResetFilters={resetFilters}
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
              {SOURCES.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && ' · '}
                  <a href={s.home} target="_blank" rel="noopener noreferrer">
                    {s.name}
                  </a>
                </Fragment>
              ))}
              {'. Weather via '}
              <a href={WEATHER_SOURCE.home} target="_blank" rel="noopener noreferrer">
                {WEATHER_SOURCE.name}
              </a>
              .
            </div>
          </div>
          <div className="colophon-block">
            <div className="colophon-k">Coverage area</div>
            <div className="colophon-v">
              Lackawanna · Luzerne · Wayne · Monroe · Carbon counties
            </div>
          </div>
          <div className="colophon-block">
            <div className="colophon-k">About</div>
            <div className="colophon-v">
              <button className="colophon-link" onClick={openAbout}>
                How this almanac is made →
              </button>
            </div>
          </div>
        </div>
        <div className="colophon-fine">
          © {new Date().getFullYear()} Matt Wren · Code under the{' '}
          <a
            href="https://github.com/mattwren88/northeast-almanac/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT License
          </a>
          {' · '}
          <a
            href="https://github.com/mattwren88/northeast-almanac"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source on GitHub
          </a>
          {' · '}
          <a
            href="https://github.com/mattwren88/northeast-almanac/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Corrections
          </a>
          . Event data belongs to the venues that publish it.
        </div>
      </footer>

      {/* DRAWER + PLAN */}
      {openEvent && (
        <EventDrawer
          event={openEvent}
          isSaved={saved.includes(openEvent.id)}
          onSave={toggleSave}
          onClose={closeEvent}
          closing={drawerClosing}
        />
      )}
      {openDay != null && (
        <DayModal
          d={openDay}
          events={openDayEvents}
          saved={saved}
          onSave={toggleSave}
          onOpen={viewEvent}
          onClose={closeDay}
          onOpenWeek={openWeekFor}
        />
      )}
      {planOpen && (
        <WeekendPlan
          events={events}
          eventsById={eventsById}
          saved={saved}
          onRemove={toggleSave}
          onClose={closePlan}
          onShare={sharePlan}
          onClearPast={clearPastSaved}
        />
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-msg">{toast.msg}</span>
          {toast.undo && (
            <button
              className="toast-undo"
              onClick={() => {
                toast.undo();
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
          <button
            className="toast-dismiss"
            aria-label="Dismiss"
            onClick={() => {
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
              setToast(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      <BackToTop />

      {aboutOpen && <AboutModal onClose={closeAbout} generatedAt={generatedAt} />}
    </div>
  );
}

function AboutModal({ onClose, generatedAt }) {
  const refreshed = generatedAt
    ? new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    : '—';
  return (
    <div className="about-backdrop" onClick={onClose}>
      <aside className="about" onClick={e => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="Close" autoFocus>
          ×
        </button>
        <div className="about-eyebrow">COLOPHON · ABOUT THE ALMANAC</div>
        <h2 className="about-title">How this almanac is made</h2>

        <p className="about-lede">
          A weekend planner for Northeast Pennsylvania, kept by one person and refreshed each
          morning. Listings come from public calendars run by the venues themselves, and every entry
          links back to its source.
        </p>

        <section className="about-section">
          <h3>Sources</h3>
          <h4 className="about-subhead">Community</h4>
          <ul>
            {COMMUNITY_SOURCES.map(s => (
              <li key={s.id}>
                <a href={s.home} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
          <h4 className="about-subhead">Colleges</h4>
          <ul>
            {COLLEGE_SOURCES.map(s => (
              <li key={s.id}>
                <a href={s.home} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
          <h4 className="about-subhead">Weather</h4>
          <ul>
            <li>
              <a href={WEATHER_SOURCE.home} target="_blank" rel="noopener noreferrer">
                {WEATHER_SOURCE.name}
              </a>{' '}
              — 16-day forecast for Scranton
            </li>
          </ul>
          <p className="about-fine">
            Only titles and short excerpts are fetched, each linked back to its original page.
            Requests carry a named User-Agent so site owners can reach us. Colleges are on by
            default; uncheck them in Filters if the academic dates get noisy.
          </p>
        </section>

        <section className="about-section">
          <h3>Refresh</h3>
          <p>
            A GitHub Action runs the scraper daily at <strong>06:00 ET</strong>. When something has
            changed, a fresh <code>events.json</code>
            is committed and the page picks it up on next load.
          </p>
          <p className="about-fine">
            Last refreshed: <strong>{refreshed}</strong>
          </p>
        </section>

        <section className="about-section">
          <h3>Coverage</h3>
          <p>
            Lackawanna, Luzerne, Wayne, Monroe, and Carbon counties. Anything outside roughly
            40.80–41.70°N, 76.05–75.05°W is dropped before publication.
          </p>
        </section>

        <section className="about-section">
          <h3>Corrections & removals</h3>
          <p>
            If you run a venue or source above and want a listing pulled, the cadence changed, or
            your name spelled right — open an issue at{' '}
            <a
              href="https://github.com/mattwren88/northeast-almanac/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/mattwren88/northeast-almanac/issues
            </a>
            . Usually fixed within a day.
          </p>
        </section>

        <section className="about-section">
          <h3>What this isn't</h3>
          <ul>
            <li>Not commercial — no ads, no tracking, no email capture, no account to make.</li>
            <li>Not a republication — short excerpts only, every one linked back to its source.</li>
            <li>
              Not exhaustive — only events with a date, a location, and a public listing show up.
            </li>
          </ul>
        </section>

        <section className="about-section">
          <h3>Colophon</h3>
          <p className="about-fine">
            Set in Newsreader and Instrument Serif, with JetBrains Mono for the marginalia. Maps by{' '}
            <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">
              Leaflet
            </a>{' '}
            over{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap
            </a>{' '}
            tiles. Built with React, hosted on GitHub Pages, scraper in Node — no backend, no
            database, just a folder of static files.
          </p>
          <p className="about-fine">
            Code released under the{' '}
            <a
              href="https://github.com/mattwren88/northeast-almanac/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
            . Event data belongs to the venues that publish it; this site only points at it.
          </p>
        </section>

        <footer className="about-foot">
          <a
            href="https://github.com/mattwren88/northeast-almanac"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source code on GitHub →
          </a>
        </footer>
      </aside>
    </div>
  );
}

function TownDropdown({ towns, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Close on click outside or Esc
  useEffect(() => {
    if (!open) return;
    const onDocClick = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Opening resets the search; that's part of the open action, not a render effect.
  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
  };

  // Focus the search box once the popup has rendered.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? towns.filter(t => t.toLowerCase().includes(q)) : towns;
    return [{ value: '', label: 'All towns' }, ...filtered.map(t => ({ value: t, label: t }))];
  }, [towns, query]);

  const pick = v => {
    onChange(v);
    setOpen(false);
  };

  const onInputKey = e => {
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
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="town-dd-trigger-label">{buttonLabel}</span>
        <span className="town-dd-trigger-caret">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="town-dd-pop">
          <div className="town-dd-search">
            <input
              ref={inputRef}
              type="search"
              placeholder={`Search ${towns.length} towns…`}
              aria-label="Search towns"
              aria-controls="town-dd-listbox"
              aria-activedescendant={`town-dd-opt-${activeIdx}`}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={onInputKey}
            />
          </div>
          <div className="town-dd-list" id="town-dd-listbox" role="listbox" aria-label="Towns">
            {options.length === 1 && query && (
              <div className="town-dd-empty">No towns match "{query}"</div>
            )}
            {options.map((opt, i) => {
              const isSel = opt.value === value;
              const isActive = i === activeIdx;
              return (
                <button
                  key={opt.value || '__all'}
                  id={`town-dd-opt-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={`town-dd-row ${isSel ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${opt.value === '' ? 'is-all' : ''}`}
                  onClick={() => pick(opt.value)}
                  onMouseEnter={() => setActiveIdx(i)}
                  tabIndex={-1}
                >
                  <span className="town-dd-row-mark" aria-hidden="true">
                    {isSel ? '✓' : ''}
                  </span>
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

function SourceGroup({ label, sources, activeSources, toggleSource, setSourceGroup, audience }) {
  const onCount = sources.filter(s => activeSources.includes(s.id)).length;
  return (
    <div className="filters-srcgroup">
      <div className="filters-srcgroup-head">
        <span className="filters-srcgroup-k">{label}</span>
        <span className="filters-srcgroup-links">
          <button
            type="button"
            className="filters-hint-link"
            onClick={() => setSourceGroup(audience, true)}
            disabled={onCount === sources.length}
          >
            all
          </button>
          {' · '}
          <button
            type="button"
            className="filters-hint-link"
            onClick={() => setSourceGroup(audience, false)}
            disabled={onCount === 0}
          >
            none
          </button>
        </span>
      </div>
      <div className="filters-cats">
        {sources.map(s => (
          <label
            key={s.id}
            className={`filters-cat filters-src ${activeSources.includes(s.id) ? 'is-on' : ''}`}
            title={s.name}
          >
            <input
              type="checkbox"
              checked={activeSources.includes(s.id)}
              onChange={() => toggleSource(s.id)}
            />
            <span className="filters-cat-label">{s.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FiltersPanel({
  activeCats,
  toggleCat,
  showAllCats,
  activeSources,
  toggleSource,
  setSourceGroup,
  showAllSources,
  allTowns,
  activeTown,
  setActiveTown,
  onReset,
  onClose,
  filterCount,
}) {
  const allCatsOn = activeCats.length === ALL_CATS.length;
  const allSrcOn = activeSources.length === SOURCES.length;
  return (
    <div className="filters-panel" role="region" aria-label="Filters">
      <div className="filters-grid">
        {/* CATEGORY — full width */}
        <div className="filters-block filters-block-wide">
          <div className="filters-block-head">
            <span className="filters-block-k">Category</span>
            <span className="filters-block-hint">
              {allCatsOn ? (
                'all on · click one to show only it'
              ) : (
                <>
                  {activeCats.length} of {ALL_CATS.length} on ·{' '}
                  <button type="button" className="filters-hint-link" onClick={showAllCats}>
                    show all
                  </button>
                </>
              )}
            </span>
          </div>
          <div className="filters-cats">
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

        {/* SOURCE */}
        <div className="filters-block filters-block-sources">
          <div className="filters-block-head">
            <span className="filters-block-k">Source</span>
            <span className="filters-block-hint">
              {allSrcOn ? (
                'all on · click one to show only it'
              ) : (
                <>
                  {activeSources.length} of {SOURCES.length} on ·{' '}
                  <button type="button" className="filters-hint-link" onClick={showAllSources}>
                    show all
                  </button>
                </>
              )}
            </span>
          </div>
          <SourceGroup
            label="Community"
            audience="community"
            sources={COMMUNITY_SOURCES}
            activeSources={activeSources}
            toggleSource={toggleSource}
            setSourceGroup={setSourceGroup}
          />
          <SourceGroup
            label="Colleges"
            audience="college"
            sources={COLLEGE_SOURCES}
            activeSources={activeSources}
            toggleSource={toggleSource}
            setSourceGroup={setSourceGroup}
          />
        </div>

        {/* TOWN */}
        <div className="filters-block">
          <div className="filters-block-head">
            <span className="filters-block-k">Town</span>
            <span className="filters-block-hint">{allTowns.length} towns in this batch</span>
          </div>
          <div className="filters-block-rows">
            <TownDropdown towns={allTowns} value={activeTown} onChange={setActiveTown} />
          </div>
        </div>
      </div>

      <div className="filters-foot">
        <button className="filters-reset" onClick={onReset} disabled={filterCount === 0}>
          Reset all
        </button>
        <button className="filters-done" onClick={onClose}>
          Done
        </button>
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
  const [show, set] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        set(window.scrollY > 400);
        ticking = false;
      });
    };
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
