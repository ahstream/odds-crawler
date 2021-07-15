import { getSportId, getSportName, getSportNames, getMatchLength } from './sport';

const _ = require('lodash');

test('getSportId()', () => {
  expect(getSportId(undefined)).toEqual(undefined);
  expect(getSportId(null)).toEqual(undefined);
  expect(getSportId('')).toEqual(undefined);
  expect(getSportId('xxx')).toEqual(undefined);
  expect(getSportId('soccer')).toEqual(1);
});

test('getSportName()', () => {
  expect(getSportName(undefined)).toEqual(undefined);
  expect(getSportName(null)).toEqual(undefined);
  expect(getSportName('')).toEqual(undefined);
  expect(getSportName(0)).toEqual(undefined);
  expect(getSportName(1)).toEqual('soccer');
});

test('getSportNames()', () => {
  console.log(getSportNames());
});

test('getMatchLength()', () => {
  expect(getMatchLength(undefined)).toEqual({ min: null, max: null });
  expect(getMatchLength(null)).toEqual({ min: null, max: null });
  expect(getMatchLength('')).toEqual({ min: null, max: null });
  expect(getMatchLength('xxx')).toEqual({ min: null, max: null });
  expect(getMatchLength('soccer')).toEqual({ min: 2, max: 2 });
  expect(getMatchLength('tennis')).toEqual({ min: 3, max: 5 });
});
