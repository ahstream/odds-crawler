import { getHandicapName, getHandicapSign } from './handicap';

test('getHandicapName()', () => {
  expect(getHandicapName(undefined)).toEqual(undefined);
  expect(getHandicapName(null)).toEqual(undefined);
  expect(getHandicapName('')).toEqual(undefined);
  expect(getHandicapName(0)).toEqual('');
  expect(getHandicapName(1)).toEqual('Sets');
});

test('getHandicapSign()', () => {
  expect(getHandicapSign(undefined)).toEqual('');
  expect(getHandicapSign(null)).toEqual('');
  expect(getHandicapSign('')).toEqual('');
  expect(getHandicapSign(0)).toEqual('');
  expect(getHandicapSign(1)).toEqual('+');
  expect(getHandicapSign(-1)).toEqual('-');
});
