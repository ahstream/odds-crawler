'use strict';

import { propertiesExists, trimLeftChars, trimRightChars, trimBothChars } from './utilslib';

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

test('trimLeftChars()', () => {
  expect(trimLeftChars('aababcde', 'a')).toBe('babcde');
  expect(trimLeftChars('babcde', 'a')).toBe('babcde');
  expect(trimLeftChars('aababcdeaaa', 'a')).toBe('babcdeaaa');
  expect(trimLeftChars('babcdeaa', 'a')).toBe('babcdeaa');
});

test('trimRightChars()', () => {
  expect(trimRightChars('aababcdedeeee', 'e')).toBe('aababcded');
  expect(trimRightChars('aababcdede', 'e')).toBe('aababcded');
  expect(trimRightChars('eeaababcdedeeee', 'e')).toBe('eeaababcded');
  expect(trimRightChars('eaababcdede', 'e')).toBe('eaababcded');
});

test('trimLeftRightChars()', () => {
  expect(trimBothChars('eaababcdedeeee', 'e')).toBe('aababcded');
  expect(trimBothChars('aababcdede', 'e')).toBe('aababcded');
  expect(trimBothChars('eaababcdedeeee', 'a')).toBe('eaababcdedeeee');
  expect(trimBothChars('eaababcdedeeeea', 'a')).toBe('eaababcdedeeee');
});
