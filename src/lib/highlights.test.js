import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHighlights, isAllDay, groupByStart } from './highlights.js';

const ev = (id, start, category = 'community', end = '23:00') => ({ id, start, end, category });
const allDay = id => ({ id, start: '00:00', end: '23:59', category: 'community' });
const ids = list => list.map(e => e.id);

test('isAllDay matches only 00:00–23:59', () => {
  assert.equal(isAllDay(allDay('a')), true);
  assert.equal(isAllDay(ev('b', '00:00', 'art', '02:00')), false);
  assert.equal(isAllDay(ev('c', '09:00')), false);
});

test('empty day', () => {
  assert.deepEqual(pickHighlights([]), { allDay: [], picks: [], hiddenCount: 0 });
});

test('all-day-only day has no picks and nothing hidden', () => {
  const r = pickHighlights([allDay('a'), allDay('b')]);
  assert.deepEqual(ids(r.allDay), ['a', 'b']);
  assert.deepEqual(r.picks, []);
  assert.equal(r.hiddenCount, 0);
});

test('all-day events are split out and never take a slot', () => {
  const r = pickHighlights([allDay('a'), ev('b', '09:00', 'art'), ev('c', '19:00', 'nightlife')]);
  assert.deepEqual(ids(r.allDay), ['a']);
  assert.deepEqual(ids(r.picks), ['b', 'c']);
  assert.equal(r.hiddenCount, 0);
});

test('midnight start that is not all-day stays a timed card', () => {
  const r = pickHighlights([ev('late', '00:00', 'nightlife', '02:00'), allDay('fair')]);
  assert.deepEqual(ids(r.picks), ['late']);
  assert.deepEqual(ids(r.allDay), ['fair']);
});

test('day with n or fewer timed events shows them all', () => {
  const r = pickHighlights([ev('a', '08:00'), ev('b', '09:00'), ev('c', '10:00')]);
  assert.deepEqual(ids(r.picks), ['a', 'b', 'c']);
  assert.equal(r.hiddenCount, 0);
});

const spreadDay = [
  ev('m1', '08:00', 'art'),
  ev('m2', '09:00', 'market'),
  ev('m3', '10:00', 'outdoor'),
  ev('m4', '11:00', 'food'),
  ev('a1', '13:00', 'performance'),
  ev('e1', '18:00', 'nightlife'),
  ev('e2', '20:00', 'community'),
];

test('picks spread across morning, afternoon and evening', () => {
  const r = pickHighlights(spreadDay);
  assert.deepEqual(ids(r.picks), ['m1', 'm2', 'a1', 'e1', 'e2']);
  assert.equal(r.hiddenCount, 2);
});

test('saved events go in first', () => {
  const r = pickHighlights(spreadDay, ['m4', 'm3']);
  assert.deepEqual(ids(r.picks), ['m1', 'm3', 'm4', 'a1', 'e1']);
  assert.equal(r.hiddenCount, 2);
});

test('featured events go in after saved', () => {
  const day = spreadDay.map(e => (e.id === 'm4' ? { ...e, featured: true } : e));
  const r = pickHighlights(day, ['e2']);
  // e2 (saved) and m4 (featured) first, then round-robin: m1, a1, e1.
  assert.deepEqual(ids(r.picks), ['m1', 'm4', 'a1', 'e1', 'e2']);
  assert.equal(r.hiddenCount, 2);
});

test('saved picks count toward the category cap', () => {
  const r = pickHighlights(
    [
      ev('s1', '08:00'),
      ev('s2', '09:00'),
      ev('c3', '10:00'),
      ev('c4', '13:00'),
      ev('c5', '18:00'),
      ev('x1', '19:00', 'art'),
    ],
    ['s1', 's2'],
    4,
  );
  // Capped pass skips community everywhere and takes art; the relaxed pass adds c3.
  assert.deepEqual(ids(r.picks), ['s1', 's2', 'c3', 'x1']);
  assert.equal(r.hiddenCount, 2);
});

test('more saved events than slots: earliest saved fill every slot', () => {
  const r = pickHighlights(spreadDay, ids(spreadDay));
  assert.deepEqual(ids(r.picks), ['m1', 'm2', 'm3', 'm4', 'a1']);
  assert.equal(r.hiddenCount, 2);
});

test('category cap of 2, then relaxed to fill', () => {
  const r = pickHighlights([
    ev('c1', '08:00'),
    ev('c2', '09:00'),
    ev('c3', '10:00'),
    ev('x1', '11:00', 'art'),
    ev('c4', '13:00'),
    ev('c5', '18:00'),
    ev('y1', '19:00', 'nightlife'),
  ]);
  assert.deepEqual(ids(r.picks), ['c1', 'c2', 'x1', 'c4', 'y1']);
  assert.equal(r.hiddenCount, 2);
});

test('a single-category day still spreads across the day', () => {
  const r = pickHighlights([
    ev('a', '08:00'),
    ev('b', '09:00'),
    ev('c', '10:00'),
    ev('d', '13:00'),
    ev('e', '14:00'),
    ev('f', '18:00'),
    ev('g', '19:00'),
  ]);
  assert.deepEqual(ids(r.picks), ['a', 'b', 'd', 'e', 'f']);
  assert.equal(r.hiddenCount, 2);
});

test('bucket boundaries: 12:00 is afternoon, 17:00 is evening', () => {
  const r = pickHighlights(
    [
      ev('m', '11:59', 'art'),
      ev('a1', '12:00', 'market'),
      ev('a2', '16:59', 'food'),
      ev('e', '17:00', 'outdoor'),
    ],
    [],
    3,
  );
  assert.deepEqual(ids(r.picks), ['m', 'a1', 'e']);
  assert.equal(r.hiddenCount, 1);
});

test('equal start times break ties by id, whatever the input order', () => {
  const x = ev('b', '19:00');
  const y = ev('a', '19:00');
  assert.deepEqual(ids(pickHighlights([x, y], [], 1).picks), ['a']);
  assert.deepEqual(ids(pickHighlights([y, x], [], 1).picks), ['a']);
});

test('does not mutate its input', () => {
  const input = Object.freeze([...spreadDay].reverse());
  assert.doesNotThrow(() => pickHighlights(input, ['m1']));
});

test('groupByStart puts consecutive same-start events under one time', () => {
  const groups = groupByStart([ev('a', '08:00'), ev('b', '08:00'), ev('c', '12:00')]);
  assert.deepEqual(
    groups.map(g => [g.start, ids(g.events)]),
    [
      ['08:00', ['a', 'b']],
      ['12:00', ['c']],
    ],
  );
});

test('groupByStart gives each distinct start its own group, in order', () => {
  const groups = groupByStart([ev('a', '08:00'), ev('b', '09:00'), ev('c', '09:30')]);
  assert.deepEqual(
    groups.map(g => g.start),
    ['08:00', '09:00', '09:30'],
  );
});

test('groupByStart on an empty list', () => {
  assert.deepEqual(groupByStart([]), []);
});
