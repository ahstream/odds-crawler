import {
  propertiesExists,
  trimCharsLeft,
  trimCharsRight,
  trimChars
} from './utilslib';

test('propertiesExists', () => {
  const obj = {};
  const obj2 = {};
  obj.p1 = {};
  obj.p1.p2 = true;
  console.log(obj);

  expect(propertiesExists(obj, ['p1', 'p2'])).toBe(true);
  expect(propertiesExists(obj, ['p1', 'p2', 'p3'])).toBe(false);
  expect(propertiesExists(obj2, ['p1', 'p2'])).toBe(false);
});

test('trimCharsLeft()', () => {
  expect(trimCharsLeft('aababcde', 'a')).toBe('babcde');
  expect(trimCharsLeft('babcde', 'a')).toBe('babcde');
  expect(trimCharsLeft('aababcdeaaa', 'a')).toBe('babcdeaaa');
  expect(trimCharsLeft('babcdeaa', 'a')).toBe('babcdeaa');
});

test('trimCharsRight()', () => {
  expect(trimCharsRight('aababcdedeeee', 'e')).toBe('aababcded');
  expect(trimCharsRight('aababcdede', 'e')).toBe('aababcded');
  expect(trimCharsRight('eeaababcdedeeee', 'e')).toBe('eeaababcded');
  expect(trimCharsRight('eaababcdede', 'e')).toBe('eaababcded');
});

test('trimLeftRightChars()', () => {
  expect(trimChars('eaababcdedeeee', 'e')).toBe('aababcded');
  expect(trimChars('aababcdede', 'e')).toBe('aababcded');
  expect(trimChars('eaababcdedeeee', 'a')).toBe('eaababcdedeeee');
  expect(trimChars('eaababcdedeeeea', 'a')).toBe('eaababcdedeeee');
});
