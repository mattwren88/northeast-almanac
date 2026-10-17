// Weather shaping shared by the scraper (Open-Meteo response → events.json)
// and the UI (summary line and icons for the forecast card).

// Hourly forecasts past about a week aren't reliable, so later days keep the
// daily summary only. Slots are every 3 hours across the part of the day
// people plan around.
export const HOURLY_DAYS = 7;
const SLOT_HOURS = [6, 9, 12, 15, 18, 21];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Worst-first ordering, so "the worst sky this part of the day" is a max().
const RANK = { sun: 0, partly: 1, cloud: 2, fog: 3, rain: 4, snow: 5, storm: 6 };
const LABEL = {
  sun: 'Sunny',
  partly: 'Partly cloudy',
  cloud: 'Cloudy',
  fog: 'Foggy',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Storms',
};

// WMO weather codes → our { cond, icon }
// https://open-meteo.com/en/docs (codes table)
export function wxFromCode(code) {
  if (code === 0) return { cond: 'sun', icon: '☀' };
  if (code <= 2) return { cond: 'partly', icon: '⛅' };
  if (code === 3) return { cond: 'cloud', icon: '☁' };
  if (code <= 48) return { cond: 'fog', icon: '🌫' };
  if (code <= 67) return { cond: 'rain', icon: '☂' };
  if (code <= 77) return { cond: 'snow', icon: '❄' };
  if (code <= 82) return { cond: 'rain', icon: '☂' };
  if (code <= 86) return { cond: 'snow', icon: '❄' };
  return { cond: 'storm', icon: '⛈' };
}

const hhmm = iso => (iso ? iso.slice(11, 16) : undefined);

// Open-Meteo `daily` (+ optional `hourly`) → the `weather` array in events.json.
export function shapeForecast(j) {
  const { daily, hourly } = j;
  const hourIndex = new Map((hourly?.time || []).map((t, i) => [t, i]));
  return daily.time.map((date, i) => {
    const wx = wxFromCode(daily.weather_code[i]);
    const dt = new Date(date + 'T00:00:00');
    const out = {
      day: i,
      label: DAY_LABELS[dt.getDay()],
      cond: wx.cond,
      icon: wx.icon,
      high: Math.round(daily.temperature_2m_max[i]),
      low: Math.round(daily.temperature_2m_min[i]),
    };
    if (daily.precipitation_probability_max) out.rain = daily.precipitation_probability_max[i];
    if (daily.sunrise) out.sunrise = hhmm(daily.sunrise[i]);
    if (daily.sunset) out.sunset = hhmm(daily.sunset[i]);
    if (hourly && i < HOURLY_DAYS) {
      const hours = SLOT_HOURS.map(h => {
        const k = hourIndex.get(`${date}T${String(h).padStart(2, '0')}:00`);
        if (k == null) return null;
        const slot = wxFromCode(hourly.weather_code[k]);
        return {
          h,
          temp: Math.round(hourly.temperature_2m[k]),
          rain: hourly.precipitation_probability[k],
          cond: slot.cond,
          icon: slot.icon,
        };
      }).filter(Boolean);
      if (hours.length) out.hours = hours;
    }
    return out;
  });
}

const worst = slots =>
  slots.reduce((w, s) => (w == null || RANK[s.cond] > RANK[w] ? s.cond : w), null);

// One-line read of the day: morning sky, then how the afternoon/evening turns.
export function summarize(day) {
  const hours = day.hours || [];
  const morning = worst(hours.filter(s => s.h < 12));
  const later = worst(hours.filter(s => s.h >= 12));
  if (!morning || !later) return LABEL[morning || later || day.cond];
  if (morning === later) return LABEL[morning];
  if (RANK[later] < RANK[morning] && RANK[later] <= RANK.partly) {
    return `${LABEL[morning]}, clearing by afternoon`;
  }
  return `${LABEL[morning]}, then ${LABEL[later].toLowerCase()}`;
}

const minutes = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Clear or partly clear slots after sunset (or before sunrise) get a moon.
export function slotIcon(slot, day) {
  if (!day.sunrise || !day.sunset || RANK[slot.cond] > RANK.partly) return slot.icon;
  const m = slot.h * 60;
  return m >= minutes(day.sunset) || m < minutes(day.sunrise) ? '☾' : slot.icon;
}
