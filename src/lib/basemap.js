// Map basemap: OpenFreeMap vector tiles drawn by MapLibre under Leaflet.
// Free and keyless. (CARTO's keyless raster tiles started returning an
// "API key required" placeholder in Oct 2026.)
//
// MapLibre is ~0.5 MB, so it's imported on demand when the Map view mounts
// rather than in the main bundle. Its web worker normally sits next to its own
// module file, which doesn't exist once Vite bundles it, so the worker is
// built by Vite (`?worker&url`) and registered with setWorkerUrl.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> ' +
  '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

// Resolves to a Leaflet layer factory; callers add it to their map.
export async function loadBasemap() {
  const [{ setWorkerUrl }, { maplibreGL }, { default: workerUrl }] = await Promise.all([
    import('maplibre-gl'),
    import('@maplibre/maplibre-gl-leaflet'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ]);
  setWorkerUrl(workerUrl);
  return () => maplibreGL({ style: STYLE_URL, attribution: ATTRIBUTION });
}
