// Map view — Leaflet + marker clustering over the OpenFreeMap basemap.
// Its own module so Leaflet (and its CSS) load only when someone opens the
// Map tab; app.jsx imports it with React.lazy.

import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { CATEGORIES, dateForDay, todayDayOffset } from './lib/data.js';
import { fmtEventTime } from './calendar.jsx';
import { BBOX, HORIZON_DAYS } from './lib/constants.js';
import { loadBasemap } from './lib/basemap.js';

export function eventLatLng(ev) {
  if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) return [ev.lat, ev.lng];
  if (ev.coords && Number.isFinite(ev.coords.x) && Number.isFinite(ev.coords.y)) {
    const lat = BBOX.latMax - ev.coords.y * (BBOX.latMax - BBOX.latMin);
    const lng = BBOX.lngMin + ev.coords.x * (BBOX.lngMax - BBOX.lngMin);
    return [lat, lng];
  }
  return null;
}

// ============ MAP VIEW ============
export default function MapView({ events, saved, onOpen }) {
  const today = todayDayOffset();
  // Anchor the strip to today: show 7 days starting today, clamped so we
  // always emit 7 valid offsets within the horizon.
  const startDay = Math.max(0, Math.min(today, HORIZON_DAYS - 7));
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => startDay + i);
  const initialDay = days.includes(today) ? today : startDay;
  const [activeDay, setActiveDay] = useState(initialDay);
  const dayEvents = events.filter(e => e.day === activeDay);

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapElRef.current || !L || mapRef.current) return;
    const map = L.map(mapElRef.current, {
      center: [41.25, -75.55],
      zoom: 9,
      minZoom: 8,
      maxZoom: 15,
      maxBounds: [
        [40.55, -76.5],
        [41.95, -74.6],
      ],
      maxBoundsViscosity: 0.8,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    // The basemap loads async; markers draw immediately on top of an empty map.
    let unmounted = false;
    loadBasemap()
      .then(makeLayer => {
        if (!unmounted) makeLayer().addTo(map);
      })
      .catch(err => console.warn('Basemap failed to load', err));
    mapRef.current = map;
    return () => {
      unmounted = true;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Build the marker layer when events or activeDay change. Stash the event id
  // on each marker so the saved-state effect can restyle without rebuilding.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    const layer = L.markerClusterGroup
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 45,
          disableClusteringAtZoom: 13,
        })
      : L.layerGroup();
    dayEvents.forEach(ev => {
      const ll = eventLatLng(ev);
      if (!ll) return;
      const cat = CATEGORIES[ev.category] || { color: '#666', label: ev.category };
      const marker = L.circleMarker(ll, {
        radius: ev.featured ? 9 : 7,
        color: '#1a1a1a',
        weight: 1,
        fillColor: cat.color,
        fillOpacity: 0.92,
      });
      marker._evId = ev.id;
      const label = `<strong>${ev.title.replace(/</g, '&lt;')}</strong><br><span style="opacity:0.7">${fmtEventTime(ev)} · ${ev.venue.replace(/</g, '&lt;')}</span>`;
      marker.bindTooltip(label, { direction: 'top', offset: [0, -6] });
      marker.on('click', () => onOpen(ev.id));
      layer.addLayer(marker);
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
    };
  }, [events, activeDay]);

  // Update only the saved-stroke weight on existing markers when `saved` changes.
  // Avoids destroying + re-clustering all markers on every star toggle.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const savedSet = new Set(saved);
    layer.eachLayer(m => {
      if (m._evId == null || typeof m.setStyle !== 'function') return;
      m.setStyle({ weight: savedSet.has(m._evId) ? 2.5 : 1 });
    });
  }, [saved]);

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
              <span className="map-day-pill-wd">
                {date.weekday}
                {isToday && <span className="map-today-dot">·</span>}
              </span>
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
                <span className="map-legend-label">
                  {cat.icon} {cat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="map-side">
          <div className="map-side-head">
            <div className="map-side-date">
              {dateForDay(activeDay).weekday}, {dateForDay(activeDay).month}{' '}
              {dateForDay(activeDay).date}
            </div>
            <div className="map-side-sub">{dayEvents.length} events</div>
          </div>
          <div className="map-side-list">
            {dayEvents
              .sort((a, b) => a.start.localeCompare(b.start))
              .map(ev => {
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
