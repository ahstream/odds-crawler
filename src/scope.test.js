import { getScopeId, getScopeName } from './scope';

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
