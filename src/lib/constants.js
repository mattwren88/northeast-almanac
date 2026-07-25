// Shared between the frontend and scripts/build-events.mjs — keep this file
// plain JS with no imports so Node can load it directly.

// NEPA bounding box — events outside it are dropped by the scraper, and the
// map view uses it to project legacy normalized coords back to lat/lng.
export const BBOX = { latMin: 40.80, latMax: 41.70, lngMin: -76.05, lngMax: -75.05 };

// Days of events the scraper fetches and the app displays.
export const HORIZON_DAYS = 14;
