#!/usr/bin/env node
// Fetches the next ~14 days of NEPA events from a registry of public Tribe
// Events Calendar REST APIs (DiscoverNEPA + others) and writes events.json
// in the shape the app expects.
//
// Usage: node scripts/build-events.mjs
// Output: ./public/events.json (events array, anchorDate, generatedAt)

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BBOX, HORIZON_DAYS } from '../src/lib/constants.js';
import { COMMUNITY_SOURCES as SOURCES, COLLEGE_SOURCES } from '../src/data/sources.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// Identify the bot honestly so site owners can contact / allow-list / block us.
// If you fork this, update the URL to point at your own repo.
const UA = 'Northeast-Almanac/1.0 (+https://github.com/mattwren88/northeast-almanac; non-commercial regional event aggregator; contact via GitHub Issues)';

// Source registry (endpoints, feed types, robots.txt review notes) lives in
// src/data/sources.js — shared with the footer/About/drawer attribution UI.
// Each community source must expose a Tribe Events Calendar REST endpoint with
// the standard shape: { events: [...], total, total_pages }.

const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const PER_PAGE = 50;

// Single weather point for the region (Scranton). Editorial-level forecast — close enough.
const WX_LAT = 41.41;
const WX_LNG = -75.66;

// Map DiscoverNEPA category names (case-insensitive substrings) to our 7 categories
const CATEGORY_RULES = [
  [/farmer|market|vendor|fair|flea|antique/i, 'market'],
  [/food|drink|wine|beer|brew|tasting|dinner|cocktail|distill/i, 'food'],
  [/hike|hiking|trail|outdoor|nature|park|bike|cycl|kayak|paddle|fish|bird|garden/i, 'outdoor'],
  [/art|gallery|exhibit|paint|draw|craft|studio/i, 'art'],
  [/theater|theatre|concert|symphony|opera|music|comedy|stand-?up|reading|poetry|dance|perform|show/i, 'performance'],
  [/bar|pub|nightlife|dj|trivia|karaoke|open mic|club/i, 'nightlife'],
];
const DEFAULT_CATEGORY = 'community';

// Outdoor heuristic — overrides indoor=true default
const OUTDOOR_RULES = /outdoor|hike|trail|park|garden|festival|fair|market|cruise|bike|cycl|kayak|paddle|bird|farmer/i;

// City normalization — DiscoverNEPA sometimes has variants
const TOWN_FIX = {
  'wilkes barre': 'Wilkes-Barre',
  'wilkesbarre': 'Wilkes-Barre',
  'wilkes-barre': 'Wilkes-Barre',
};

// Centroid fallback for sources whose Tribe venues lack geo_lat/geo_lng.
// Keys are lowercase town names; coords are approximate town centers.
// Towns outside the BBOX above are intentionally omitted (would be filtered anyway).
const TOWN_COORDS = {
  // Lackawanna County
  'scranton':         [41.4090, -75.6624],
  'dunmore':          [41.4234, -75.6322],
  'carbondale':       [41.5740, -75.5005],
  'old forge':        [41.3712, -75.7405],
  'taylor':           [41.3956, -75.7188],
  'moosic':           [41.3534, -75.7383],
  'throop':           [41.4517, -75.6066],
  'olyphant':         [41.4673, -75.6005],
  'archbald':         [41.5006, -75.5374],
  'jessup':           [41.4734, -75.5605],
  'jermyn':           [41.5290, -75.5444],
  'mayfield':         [41.5409, -75.5377],
  'clarks summit':    [41.4912, -75.7224],
  'south abington township': [41.4756, -75.7060],
  // Luzerne County
  'wilkes-barre':     [41.2459, -75.8813],
  'kingston':         [41.2670, -75.8966],
  'plains':           [41.2787, -75.8480],
  'pittston':         [41.3262, -75.7896],
  'west pittston':    [41.3287, -75.7918],
  'hazleton':         [40.9584, -75.9747],
  'nanticoke':        [41.2009, -76.0001],
  'mountain top':     [41.1450, -75.8888],
  'dallas':           [41.3404, -75.9646],
  'shavertown':       [41.3206, -75.9529],
  // Wayne County
  'honesdale':        [41.5762, -75.2549],
  'hawley':           [41.4762, -75.1819],
  // Carbon County
  'jim thorpe':       [40.8718, -75.7327],
  'lehighton':        [40.8345, -75.7113],
  // Monroe County
  'stroudsburg':      [40.9865, -75.1945],
  'east stroudsburg': [41.0023, -75.1791],
  'mount pocono':     [41.1212, -75.3613],
  // Wyoming County
  'tunkhannock':      [41.5384, -75.9474],
};

function townCoords(town) {
  if (!town) return null;
  const key = town.trim().toLowerCase();
  return TOWN_COORDS[key] || null;
}

function decodeEntities(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"');
}

function stripHtml(s = '') {
  // Decode first so RSS-style encoded markup (&lt;br/&gt;, &amp;nbsp;) is
  // recognized as tags/whitespace by the strip pass below.
  return decodeEntities(decodeEntities(s)).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function fmtTime(isoLocal) {
  // "2026-04-25 08:00:00" → "08:00"
  const m = isoLocal.match(/(\d{2}):(\d{2}):\d{2}/);
  return m ? `${m[1]}:${m[2]}` : '00:00';
}

function dayOffset(isoLocal, anchorYmd) {
  const d = new Date(isoLocal.replace(' ', 'T'));
  const a = new Date(anchorYmd + 'T00:00:00');
  return Math.floor((d - a) / 86400000);
}

function inferCategory(ev) {
  const haystack = [
    ev.title,
    ...(ev.categories || []).map(c => c.name),
    ...(ev.tags || []).map(t => t.name),
  ].join(' | ');
  for (const [rx, cat] of CATEGORY_RULES) {
    if (rx.test(haystack)) return cat;
  }
  return DEFAULT_CATEGORY;
}

function projectCoords(lat, lng) {
  // Map (lat, lng) → normalized (x, y) in 0..1, matching the canvas in views.jsx.
  // The SVG bbox we want is roughly latMin..latMax (S→N), lngMin..lngMax (W→E).
  // East = right (x↑), North = up (y↓ in screen space).
  const x = (lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin);
  const y = 1 - (lat - BBOX.latMin) / (BBOX.latMax - BBOX.latMin);
  return { x: Math.max(0.02, Math.min(0.98, x)), y: Math.max(0.02, Math.min(0.98, y)) };
}

function inBbox(lat, lng) {
  return lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;
}

function fixTown(t) {
  if (!t) return '';
  const k = t.trim().toLowerCase();
  return TOWN_FIX[k] || t.trim();
}

// WMO weather codes → our { cond, icon }
// https://open-meteo.com/en/docs (codes table)
function wxFromCode(code) {
  if (code === 0) return { cond: 'sun',    icon: '☀' };
  if (code <= 2)  return { cond: 'partly', icon: '⛅' };
  if (code === 3) return { cond: 'cloud',  icon: '☁' };
  if (code <= 48) return { cond: 'fog',    icon: '🌫' };
  if (code <= 67) return { cond: 'rain',   icon: '☂' };
  if (code <= 77) return { cond: 'snow',   icon: '❄' };
  if (code <= 82) return { cond: 'rain',   icon: '☂' };
  if (code <= 86) return { cond: 'snow',   icon: '❄' };
  return { cond: 'storm', icon: '⛈' };
}

async function fetchWeather() {
  const params = new URLSearchParams({
    latitude:         String(WX_LAT),
    longitude:        String(WX_LNG),
    daily:            'temperature_2m_max,temperature_2m_min,weather_code',
    temperature_unit: 'fahrenheit',
    timezone:         'America/New_York',
    forecast_days:    String(HORIZON_DAYS),
  });
  const res = await fetch(`${WEATHER_API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return j.daily.time.map((date, i) => {
    const wx = wxFromCode(j.daily.weather_code[i]);
    const dt = new Date(date + 'T00:00:00');
    return {
      day:   i,
      label: dayLabels[dt.getDay()],
      cond:  wx.cond,
      icon:  wx.icon,
      high:  Math.round(j.daily.temperature_2m_max[i]),
      low:   Math.round(j.daily.temperature_2m_min[i]),
    };
  });
}

async function fetchPage(source, page, startYmd, endYmd, ifModifiedSince) {
  const url = `${source.api}?per_page=${PER_PAGE}&page=${page}&start_date=${startYmd}&end_date=${endYmd}`;
  const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
  if (ifModifiedSince && page === 1) headers['If-Modified-Since'] = ifModifiedSince;
  const res = await fetch(url, { headers });
  if (res.status === 304) return { notModified: true };
  if (res.status === 404) return { events: [], total: 0 };
  if (!res.ok) throw new Error(`${source.name} ${res.status} on page ${page}`);
  return res.json();
}

async function fetchSource(source, startYmd, endYmd, ifModifiedSince) {
  const all = [];
  for (let page = 1; page <= 30; page++) {
    const j = await fetchPage(source, page, startYmd, endYmd, ifModifiedSince);
    if (j.notModified) return { notModified: true };
    if (!j.events || j.events.length === 0) break;
    all.push(...j.events);
    if (j.events.length < PER_PAGE) break;
  }
  return { events: all };
}

function ymd(d) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function normalize(raw, anchorYmd, source) {
  const day = dayOffset(raw.start_date, anchorYmd);
  if (day < 0 || day >= HORIZON_DAYS) return null;

  const town = fixTown(raw.venue?.city || '');
  let lat = parseFloat(raw.venue?.geo_lat);
  let lng = parseFloat(raw.venue?.geo_lng);
  if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
    const fallback = townCoords(town);
    if (fallback) [lat, lng] = fallback;
  }
  if (!(Number.isFinite(lat) && Number.isFinite(lng) && inBbox(lat, lng))) return null;

  const title = stripHtml(raw.title);
  const blurb = stripHtml(raw.excerpt || raw.description || '').slice(0, 320);
  const venueName = stripHtml(raw.venue?.venue || '');
  const category = inferCategory(raw);
  const indoor = !OUTDOOR_RULES.test([title, ...(raw.categories || []).map(c => c.name)].join(' '));
  const cost = stripHtml(raw.cost) || 'See site';
  const recurring = raw.start_date_details && raw.recurring ? 'Recurring' : null;

  return {
    id: `${source.id}-${raw.id}`,
    title,
    venue: venueName || 'TBA',
    town: town || 'NEPA',
    day,
    start: fmtTime(raw.start_date),
    end: fmtTime(raw.end_date),
    category,
    price: cost,
    indoor,
    featured: !!raw.featured,
    hidden: false,
    blurb,
    tags: [...(raw.tags || []).map(t => stripHtml(t.name))].filter(Boolean).slice(0, 5),
    coords: projectCoords(lat, lng),
    lat,
    lng,
    url: raw.url,
    recurring,
    source: source.id,
    audience: 'community',
  };
}

function dedupe(events) {
  const seen = new Map();
  for (const e of events) {
    const key = `${e.title.toLowerCase()}|${e.day}|${e.start}|${e.town.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

function autoCluster(events) {
  // Group same-day, same-town clusters when ≥3 events overlap. Mutates `cluster`.
  const groups = {};
  for (const e of events) {
    const key = `${e.day}-${e.town.toLowerCase()}`;
    (groups[key] ||= []).push(e);
  }
  for (const [key, evs] of Object.entries(groups)) {
    if (evs.length >= 3) for (const e of evs) e.cluster = key;
  }
}

async function loadCurated() {
  try {
    const raw = await readFile(resolve(ROOT, 'curated.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { featured: [], hidden: [] };
  }
}

async function previousEventCount() {
  try {
    const raw = await readFile(resolve(ROOT, 'public/events.json'), 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.events) ? j.events.length : 0;
  } catch {
    return 0;
  }
}

async function loadPreviousJson() {
  try {
    const raw = await readFile(resolve(ROOT, 'public/events.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isValidEvent(e) {
  return (
    e &&
    typeof e.id === 'string' && e.id.length > 0 &&
    typeof e.title === 'string' && e.title.length > 0 &&
    typeof e.start === 'string' && /^\d{2}:\d{2}$/.test(e.start) &&
    Number.isInteger(e.day) && e.day >= 0 && e.day < HORIZON_DAYS &&
    Number.isFinite(e?.coords?.x) && e.coords.x >= 0 && e.coords.x <= 1 &&
    Number.isFinite(e?.coords?.y) && e.coords.y >= 0 && e.coords.y <= 1 &&
    typeof e.category === 'string' &&
    typeof e.town === 'string' && e.town.length > 0
  );
}

// Sanity guards. Each returns a string (failure reason) or null (pass).
function guardHardFloor(events, MIN = 10) {
  return events.length < MIN
    ? `only ${events.length} valid events; hard floor is ${MIN}`
    : null;
}

function guardSharpDrop(newCount, prevCount, ratio = 0.5, prevMin = 20) {
  if (prevCount < prevMin) return null;
  if (newCount >= prevCount * ratio) return null;
  return `event count fell from ${prevCount} → ${newCount} (>${Math.round((1 - ratio) * 100)}% drop)`;
}

function guardSchema(prevalidatedCount, validCount, dropMax = 0.2) {
  if (prevalidatedCount === 0) return null;
  const dropped = prevalidatedCount - validCount;
  const rate = dropped / prevalidatedCount;
  if (rate <= dropMax) return null;
  return `${dropped}/${prevalidatedCount} events failed schema validation (${Math.round(rate * 100)}% > ${Math.round(dropMax * 100)}%)`;
}

function applyCurated(events, curated) {
  const featSet = new Set(curated.featured || []);
  const hideSet = new Set(curated.hidden || []);
  for (const e of events) {
    // curated overrides go by URL or id
    if (featSet.has(e.url) || featSet.has(e.id)) e.featured = true;
    if (hideSet.has(e.url) || hideSet.has(e.id)) e.hidden = true;
  }
}

// ============ COLLEGE SOURCES ============

// Format an absolute Date in America/New_York → { ymd: 'YYYY-MM-DD', hm: 'HH:MM' }.
// Run-environment timezone-independent (works in CI on UTC).
function dateToETParts(d) {
  if (!d || isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

// Tiny RSS parser — returns array of plain objects from <item>…</item> blocks.
function parseRssItems(xml) {
  const out = [];
  const itemRx = /<item[\s\S]*?<\/item>/g;
  const items = xml.match(itemRx) || [];
  const cdata = (s) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  const pluck = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? cdata(m[1]).trim() : '';
  };
  for (const block of items) {
    out.push({
      title:       pluck(block, 'title'),
      link:        pluck(block, 'link'),
      description: pluck(block, 'description'),
      pubDate:     pluck(block, 'pubDate'),
      category:    pluck(block, 'category'),
      guid:        pluck(block, 'guid'),
    });
  }
  return out;
}

function normalizeCollegeEvent({ source, raw, anchorYmd, startD, endD, title, blurb, url, allDay }) {
  if (!startD || isNaN(startD.getTime())) return null;
  const sp = dateToETParts(startD);
  if (!sp) return null;
  const day = dayOffset(`${sp.ymd} 00:00:00`, anchorYmd);
  if (day < 0 || day >= HORIZON_DAYS) return null;

  let start, end;
  if (allDay) {
    start = '00:00'; end = '23:59';
  } else {
    start = sp.hm;
    const ep = endD ? dateToETParts(endD) : null;
    // Same-day end only; otherwise default to start + 90 minutes.
    if (ep && ep.ymd === sp.ymd) {
      end = ep.hm;
    } else {
      const [h, m] = start.split(':').map(Number);
      const total = h * 60 + m + 90;
      const eh = Math.min(23, Math.floor(total / 60));
      const em = total % 60;
      end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }
  }

  const [lat, lng] = source.coords;
  if (!inBbox(lat, lng)) return null;

  const fakeRaw = {
    title,
    categories: [{ name: 'college' }, { name: source.name }],
    tags: [],
  };
  const category = inferCategory(fakeRaw);
  const indoor = !OUTDOOR_RULES.test(title);
  const id = `${source.id}-${(raw && (raw.id || raw.guid || raw.link)) || randomUUID().slice(0, 8)}`
    .replace(/[^a-z0-9-]/gi, '_').slice(0, 80);

  return {
    id,
    title,
    venue: source.name,
    town: source.town,
    day,
    start,
    end,
    category,
    price: 'See site',
    indoor,
    featured: false,
    hidden: false,
    blurb: (blurb || '').slice(0, 320),
    tags: [],
    coords: projectCoords(lat, lng),
    lat,
    lng,
    url: url || '',
    recurring: null,
    source: source.id,
    audience: 'college',
  };
}

async function fetchUofSJson(source, anchorYmd) {
  const res = await fetch(source.api, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`${source.name} ${res.status}`);
  const j = await res.json();
  const events = Array.isArray(j.events) ? j.events : [];
  return events.map(raw => {
    const startD = raw.startDate ? new Date(raw.startDate) : null;
    const endD = raw.endDate ? new Date(raw.endDate) : null;
    const allDay = String(raw.allDay).toLowerCase() === 'true';
    return normalizeCollegeEvent({
      source, raw, anchorYmd,
      startD, endD,
      title: stripHtml(raw.title),
      blurb: stripHtml(raw.description),
      url: raw.url,
      allDay,
    });
  }).filter(Boolean);
}

async function fetchRssCollege(source, anchorYmd) {
  const res = await fetch(source.api, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${source.name} ${res.status}`);
  const xml = await res.text();
  const items = parseRssItems(xml);
  return items.map(raw => {
    const startD = raw.pubDate ? new Date(raw.pubDate) : null;
    if (!startD) return null;
    const sp = dateToETParts(startD);
    // Trumba/25Live academic feeds often have no real time → 04:00 GMT = 00:00 ET = all-day.
    const allDay = sp && sp.hm === '00:00';
    return normalizeCollegeEvent({
      source, raw, anchorYmd,
      startD, endD: null,
      title: stripHtml(raw.title),
      blurb: stripHtml(raw.description).slice(0, 320),
      url: raw.link,
      allDay,
    });
  }).filter(Boolean);
}

async function fetchCollegeSource(source, anchorYmd) {
  if (source.type === 'uos-json') return fetchUofSJson(source, anchorYmd);
  return fetchRssCollege(source, anchorYmd);
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + (HORIZON_DAYS - 1) * 86400000);
  const anchorYmd = ymd(today);
  const endYmd = ymd(end);

  console.log(`Fetching events ${anchorYmd} → ${endYmd} from ${SOURCES.length} community + ${COLLEGE_SOURCES.length} college sources…`);

  // If-Modified-Since: send last run's timestamp; if a source returns 304, reuse
  // the events we already have for that source from the previous events.json.
  const previousJson = await loadPreviousJson();
  const ifModifiedSince = previousJson?.generatedAt
    ? new Date(previousJson.generatedAt).toUTCString()
    : null;
  const previousBySource = {};
  if (previousJson?.events && previousJson.anchorDate === anchorYmd) {
    for (const e of previousJson.events) {
      const m = (e.id || '').match(/^([a-z]+)-/);
      if (m) (previousBySource[m[1]] ||= []).push(e);
    }
  }

  const sourceFetches = SOURCES.map(async (source) => {
    try {
      // Only attempt 304 reuse if the previous run shares the same anchor date
      // (otherwise day offsets would be wrong).
      const canReuse = previousJson && previousJson.anchorDate === anchorYmd;
      const result = await fetchSource(source, anchorYmd, endYmd, canReuse ? ifModifiedSince : null);
      if (result.notModified) {
        const cached = previousBySource[source.id] || [];
        console.log(`  [${source.id}] ${source.name}: 304 Not Modified — reusing ${cached.length} cached events`);
        return cached;
      }
      const raw = result.events;
      const normalized = raw.map(r => normalize(r, anchorYmd, source)).filter(Boolean);
      console.log(`  [${source.id}] ${source.name}: ${raw.length} raw, ${normalized.length} kept after window+bbox`);
      return normalized;
    } catch (err) {
      console.warn(`  [${source.id}] ${source.name} failed: ${err.message} — skipping`);
      return [];
    }
  });

  const collegeFetches = COLLEGE_SOURCES.map(async (source) => {
    try {
      const events = await fetchCollegeSource(source, anchorYmd);
      console.log(`  [${source.id}] ${source.name} (college): ${events.length} kept after window+bbox`);
      return events;
    } catch (err) {
      console.warn(`  [${source.id}] ${source.name} (college) failed: ${err.message} — skipping`);
      return [];
    }
  });

  const [perSource, perCollege, weather] = await Promise.all([
    Promise.all(sourceFetches),
    Promise.all(collegeFetches),
    fetchWeather().catch(err => {
      console.warn('  weather fetch failed:', err.message);
      return null;
    }),
  ]);

  const normalized = [...perSource.flat(), ...perCollege.flat()];
  console.log(`  ${normalized.length} total normalized events; weather: ${weather ? `${weather.length} days` : 'unavailable'}`);

  const deduped = dedupe(normalized);
  console.log(`  ${deduped.length} after dedupe`);

  const curated = await loadCurated();
  applyCurated(deduped, curated);

  autoCluster(deduped);

  // Schema validation — drop malformed events, then fail loudly if too many were bad.
  const prevalidatedCount = deduped.length;
  const valid = deduped.filter(isValidEvent);
  const dropped = prevalidatedCount - valid.length;
  if (dropped > 0) console.log(`  ${dropped} events dropped by schema validation`);

  // Sanity guards — fail the job (don't write events.json) if any trip.
  const prevCount = await previousEventCount();
  const failures = [
    guardSchema(prevalidatedCount, valid.length),
    guardHardFloor(valid),
    guardSharpDrop(valid.length, prevCount),
  ].filter(Boolean);

  if (failures.length) {
    console.error('REFUSING TO WRITE events.json — sanity checks failed:');
    for (const f of failures) console.error(`  · ${f}`);
    console.error(`(previous count: ${prevCount}, new count: ${valid.length})`);
    process.exit(1);
  }

  valid.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  const out = {
    generatedAt: new Date().toISOString(),
    anchorDate: anchorYmd,
    horizonDays: HORIZON_DAYS,
    source: `${SOURCES.map(s => s.name).join(' + ')} + ${COLLEGE_SOURCES.map(s => s.name).join(' + ')} + open-meteo`,
    weather,
    events: valid,
  };

  await writeFile(resolve(ROOT, 'public/events.json'), JSON.stringify(out, null, 2));
  console.log(`Wrote public/events.json (${valid.length} events, anchor ${anchorYmd}; previous: ${prevCount}).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
