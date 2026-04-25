#!/usr/bin/env node
// Fetches the next ~14 days of NEPA events from DiscoverNEPA's public Tribe
// Events Calendar REST API and writes events.json in the shape the app expects.
//
// Usage: node scripts/build-events.mjs
// Output: ./events.json (events array, anchorDate, generatedAt)

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const API = 'https://discovernepa.com/wp-json/tribe/events/v1/events';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const HORIZON_DAYS = 14;
const PER_PAGE = 50;

// NEPA bounding box — drop events outside it from the map view
const BBOX = { latMin: 40.80, latMax: 41.70, lngMin: -76.05, lngMax: -75.05 };

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
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
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

async function fetchPage(page, startYmd, endYmd) {
  const url = `${API}?per_page=${PER_PAGE}&page=${page}&start_date=${startYmd}&end_date=${endYmd}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (res.status === 404) return { events: [], total: 0 };
  if (!res.ok) throw new Error(`DiscoverNEPA ${res.status} on page ${page}`);
  return res.json();
}

async function fetchAllEvents(startYmd, endYmd) {
  const all = [];
  for (let page = 1; page <= 30; page++) {
    const j = await fetchPage(page, startYmd, endYmd);
    if (!j.events || j.events.length === 0) break;
    all.push(...j.events);
    if (j.events.length < PER_PAGE) break;
  }
  return all;
}

function ymd(d) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function normalize(raw, anchorYmd) {
  const lat = parseFloat(raw.venue?.geo_lat);
  const lng = parseFloat(raw.venue?.geo_lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && inBbox(lat, lng);
  const day = dayOffset(raw.start_date, anchorYmd);
  if (day < 0 || day >= HORIZON_DAYS) return null;
  if (!hasCoords) return null;

  const title = stripHtml(raw.title);
  const blurb = stripHtml(raw.excerpt || raw.description || '').slice(0, 320);
  const venueName = stripHtml(raw.venue?.venue || '');
  const town = fixTown(raw.venue?.city || '');
  const category = inferCategory(raw);
  const indoor = !OUTDOOR_RULES.test([title, ...(raw.categories || []).map(c => c.name)].join(' '));
  const cost = stripHtml(raw.cost) || 'See site';
  const recurring = raw.start_date_details && raw.recurring ? 'Recurring' : null;

  return {
    id: `dn-${raw.id}`,
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
    url: raw.url,
    recurring,
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

function applyCurated(events, curated) {
  const featSet = new Set(curated.featured || []);
  const hideSet = new Set(curated.hidden || []);
  for (const e of events) {
    // curated overrides go by URL or id
    if (featSet.has(e.url) || featSet.has(e.id)) e.featured = true;
    if (hideSet.has(e.url) || hideSet.has(e.id)) e.hidden = true;
  }
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + (HORIZON_DAYS - 1) * 86400000);
  const anchorYmd = ymd(today);
  const endYmd = ymd(end);

  console.log(`Fetching DiscoverNEPA events ${anchorYmd} → ${endYmd}…`);
  const [raw, weather] = await Promise.all([
    fetchAllEvents(anchorYmd, endYmd),
    fetchWeather().catch(err => {
      console.warn('  weather fetch failed:', err.message);
      return null;
    }),
  ]);
  console.log(`  ${raw.length} raw events, weather: ${weather ? `${weather.length} days` : 'unavailable'}`);

  const normalized = raw.map(r => normalize(r, anchorYmd)).filter(Boolean);
  console.log(`  ${normalized.length} after normalization (date window + bbox)`);

  const deduped = dedupe(normalized);
  console.log(`  ${deduped.length} after dedupe`);

  const curated = await loadCurated();
  applyCurated(deduped, curated);

  autoCluster(deduped);

  deduped.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  const out = {
    generatedAt: new Date().toISOString(),
    anchorDate: anchorYmd,
    horizonDays: HORIZON_DAYS,
    source: 'discovernepa.com (Tribe Events REST) + open-meteo',
    weather,
    events: deduped,
  };

  await writeFile(resolve(ROOT, 'events.json'), JSON.stringify(out, null, 2));
  console.log(`Wrote events.json (${deduped.length} events, anchor ${anchorYmd}).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
