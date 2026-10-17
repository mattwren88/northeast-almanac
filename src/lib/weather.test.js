import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wxFromCode, shapeForecast, summarize, slotIcon, HOURLY_DAYS } from './weather.js';

// Minimal Open-Meteo response: `days` daily rows, hourly for every hour of those days.
function openMeteo(days, hourCode = () => 3) {
  const daily = {
    time: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    weather_code: [],
    precipitation_probability_max: [],
    sunrise: [],
    sunset: [],
  };
  const hourly = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] };
  for (let i = 0; i < days; i++) {
    const date = `2026-10-${String(17 + i).padStart(2, '0')}`;
    daily.time.push(date);
    daily.temperature_2m_max.push(50.4);
    daily.temperature_2m_min.push(33.6);
    daily.weather_code.push(3);
    daily.precipitation_probability_max.push(4);
    daily.sunrise.push(`${date}T07:16`);
    daily.sunset.push(`${date}T18:18`);
    for (let h = 0; h < 24; h++) {
      hourly.time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(40 + h / 2);
      hourly.precipitation_probability.push(h);
      hourly.weather_code.push(hourCode(i, h));
    }
  }
  return { daily, hourly };
}

test('wxFromCode maps WMO codes to conditions', () => {
  assert.equal(wxFromCode(0).cond, 'sun');
  assert.equal(wxFromCode(2).cond, 'partly');
  assert.equal(wxFromCode(3).cond, 'cloud');
  assert.equal(wxFromCode(61).cond, 'rain');
  assert.equal(wxFromCode(95).cond, 'storm');
});

test('shapeForecast keeps the daily fields and adds rain, sunrise and sunset', () => {
  const [d0] = shapeForecast(openMeteo(1));
  assert.deepEqual(
    { ...d0, hours: undefined },
    {
      day: 0,
      label: 'Sat',
      cond: 'cloud',
      icon: '☁',
      high: 50,
      low: 34,
      rain: 4,
      sunrise: '07:16',
      sunset: '18:18',
      hours: undefined,
    },
  );
});

test('shapeForecast samples every 3 hours from 6 AM to 9 PM', () => {
  const [d0] = shapeForecast(openMeteo(1));
  assert.deepEqual(
    d0.hours.map(s => s.h),
    [6, 9, 12, 15, 18, 21],
  );
  assert.deepEqual(d0.hours[0], { h: 6, temp: 43, rain: 6, cond: 'cloud', icon: '☁' });
});

test('shapeForecast only includes hourly for the first HOURLY_DAYS days', () => {
  const days = shapeForecast(openMeteo(HOURLY_DAYS + 2));
  assert.equal(days.length, HOURLY_DAYS + 2);
  assert.ok(days[HOURLY_DAYS - 1].hours);
  assert.equal(days[HOURLY_DAYS].hours, undefined);
});

test('shapeForecast tolerates a response without hourly data', () => {
  const j = openMeteo(1);
  delete j.hourly;
  const [d0] = shapeForecast(j);
  assert.equal(d0.hours, undefined);
  assert.equal(d0.high, 50);
});

const day = (morning, later) => ({
  cond: 'cloud',
  hours: [
    { h: 6, cond: morning },
    { h: 9, cond: morning },
    { h: 12, cond: later },
    { h: 15, cond: later },
    { h: 18, cond: later },
    { h: 21, cond: later },
  ],
});

test('summarize: same sky all day', () => {
  assert.equal(summarize(day('sun', 'sun')), 'Sunny');
});

test('summarize: cloudy morning clearing up', () => {
  assert.equal(summarize(day('cloud', 'sun')), 'Cloudy, clearing by afternoon');
});

test('summarize: turning worse later', () => {
  assert.equal(summarize(day('partly', 'rain')), 'Partly cloudy, then rain');
});

test('summarize: improving but not clearing', () => {
  assert.equal(summarize(day('rain', 'cloud')), 'Rain, then cloudy');
});

test('summarize: no hourly data falls back to the daily condition', () => {
  assert.equal(summarize({ cond: 'fog' }), 'Foggy');
});

test('slotIcon shows a moon for clear skies after sunset', () => {
  const d = { sunrise: '07:16', sunset: '18:18' };
  assert.equal(slotIcon({ h: 21, cond: 'sun', icon: '☀' }, d), '☾');
  assert.equal(slotIcon({ h: 15, cond: 'sun', icon: '☀' }, d), '☀');
  assert.equal(slotIcon({ h: 21, cond: 'rain', icon: '☂' }, d), '☂');
});
