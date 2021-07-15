import { getScopeId, getScopeName, getScopeNth, isScopeTooLong } from './scope';

test('getScopeId()', () => {
  expect(getScopeId(undefined)).toEqual(undefined);
  expect(getScopeId(null)).toEqual(undefined);
  expect(getScopeId('')).toEqual(undefined);
  expect(getScopeId('xxx')).toEqual(undefined);
  expect(getScopeId('FT')).toEqual(2);
});

test('getScopeName()', () => {
  expect(getScopeName(undefined)).toEqual(undefined);
  expect(getScopeName(null)).toEqual(undefined);
  expect(getScopeName('')).toEqual(undefined);
  expect(getScopeName(0)).toEqual(undefined);
  expect(getScopeName(2)).toEqual('FT');
});

test('getScopeNth()', () => {
  expect(getScopeNth(undefined)).toEqual(undefined);
  expect(getScopeNth(null)).toEqual(undefined);
  expect(getScopeNth('')).toEqual(undefined);
  expect(getScopeNth(1)).toEqual(null);
  expect(getScopeNth(16)).toEqual(5);
});

test('isShortMatch()', () => {
  expect(isScopeTooLong(16, [1, 2, 3, 4])).toEqual(true);
  expect(isScopeTooLong(16, [1, 2, 3, 4, 5])).toEqual(false);
});
