import { createScore, createTiebreak, add } from './score';

const _ = require('lodash');

test('createScore()', () => {
  expect(createScore(1, 1)).toEqual({ home: 1, away: 1 });
  expect(createScore(1, 2)).toEqual({ home: 1, away: 2 });
  expect(createScore(2, 0)).toEqual({ home: 2, away: 0 });
});

test('createTiebreak()', () => {
  expect(createTiebreak(1, null)).toEqual({ home: 1, away: 7 });
  expect(createTiebreak(10, null)).toEqual({ home: 10, away: 12 });
  expect(createTiebreak(null, 1)).toEqual({ home: 7, away: 1 });
  expect(createTiebreak(null, 10)).toEqual({ home: 12, away: 10 });
  expect(createTiebreak(null, null)).toEqual({ home: null, away: null });
});

test('add()', () => {
  expect(add([])).toEqual({ home: 0, away: 0 });
  expect(add([createScore(1, null)])).toEqual({ home: 1, away: 0 });
  expect(add([createScore(1, 1)])).toEqual({ home: 1, away: 1 });
  expect(add([createScore(1, 1), createScore(2, 0)])).toEqual({ home: 3, away: 1 });
  expect(add([createScore(1, 1), createScore(2, 0), createScore(0, 1)])).toEqual({ home: 3, away: 2 });
});
