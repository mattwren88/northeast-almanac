import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './style.css';
import { createRoot } from 'react-dom/client';
import { App } from './app.jsx';

createRoot(document.getElementById('root')).render(<App />);
