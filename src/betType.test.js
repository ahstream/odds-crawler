import { getBetTypeId, getBetTypeName } from './betType';

test('getBetTypeId()', () => {
  expect(getBetTypeId(undefined)).toEqual(undefined);
  expect(getBetTypeId(null)).toEqual(undefined);
  expect(getBetTypeId('')).toEqual(undefined);
  expect(getBetTypeId('xxx')).toEqual(undefined);
  expect(getBetTypeId('1X2')).toEqual(1);
  expect(getBetTypeId('Home/Away')).toEqual(3);
});

test('getBetTypeName()', () => {
  expect(getBetTypeName(undefined)).toEqual(undefined);
  expect(getBetTypeName(null)).toEqual(undefined);
  expect(getBetTypeName('')).toEqual(undefined);
  expect(getBetTypeName(0)).toEqual(undefined);
  expect(getBetTypeName(1)).toEqual('1X2');
  expect(getBetTypeName(3)).toEqual('Home/Away');
});
