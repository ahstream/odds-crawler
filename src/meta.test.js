import { add, debug } from './meta';

test('add()', () => {
  expect(add('test', ['soccer', 1], 'url1')).toEqual({ 'ct': 1, 'url': 'url1' });
  expect(add('test', ['soccer', 1], 'url2')).toEqual({ 'ct': 2, 'url': 'url2' });
  expect(add('test', ['soccer', 2], 'url3')).toEqual({ 'ct': 1, 'url': 'url3' });
  debug();
});
