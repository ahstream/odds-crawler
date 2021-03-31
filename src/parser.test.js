'use strict';

const parser = require('./parser.js');
const fs = require('fs');

test('ping returns pong', () => {
  expect(parser.ping()).toBe('pong');
});

test('parseUrl()', () => {
  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/bolton-doncaster-QB1Cg43p/')).toEqual({
    type: 'event',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2020,
    event: 'bolton-doncaster-QB1Cg43p'
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019/bolton-doncaster-QB1Cg43p/')).toEqual({
    type: 'event',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2019,
    event: 'bolton-doncaster-QB1Cg43p'
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one/bolton-doncaster-QB1Cg43p/')).toEqual({
    type: 'event',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: null,
    event: 'bolton-doncaster-QB1Cg43p'
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one/results/')).toEqual({
    type: 'season',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: null,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2020/results/')).toEqual({
    type: 'season',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2020,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2020-2021/results/')).toEqual({
    type: 'season',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2021,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one/')).toEqual({
    type: 'schedule',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: null,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019/')).toEqual({
    type: 'schedule',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2019,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/')).toEqual({
    type: 'schedule',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2020,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/')).toEqual({
    type: 'country',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: '',
    divisionCode: '',
    year: null,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/')).toEqual({
    type: 'sport',
    sport: 'soccer',
    country: '',
    divisionCodeName: '',
    divisionCode: '',
    year: null,
    event: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/')).toEqual({
    type: '',
    sport: '',
    country: '',
    divisionCodeName: '',
    divisionCode: '',
    year: null,
    event: ''
  });
});

test('parseDivisionFromUrlPath()', () => {
  expect(parser.parseDivisionFromUrlPath('')).toEqual(['', null, null]);
  expect(parser.parseDivisionFromUrlPath('https://www.oddsportal.com/soccer/england/league-one')).toEqual(['', null, null]);
  expect(parser.parseDivisionFromUrlPath('/league-one/')).toEqual(['league-one', null, null]);
  expect(parser.parseDivisionFromUrlPath('/league-one')).toEqual(['league-one', null, null]);
  expect(parser.parseDivisionFromUrlPath('league-one/')).toEqual(['league-one', null, null]);
  expect(parser.parseDivisionFromUrlPath('league-one')).toEqual(['league-one', null, null]);
  expect(parser.parseDivisionFromUrlPath('/league-one-2020/')).toEqual(['league-one', null, 2020]);
  expect(parser.parseDivisionFromUrlPath('league-one-2020/')).toEqual(['league-one', null, 2020]);
  expect(parser.parseDivisionFromUrlPath('league-one-2020')).toEqual(['league-one', null, 2020]);
  expect(parser.parseDivisionFromUrlPath('/league-one-2020-2021/')).toEqual(['league-one', 2020, 2021]);
  expect(parser.parseDivisionFromUrlPath('league-one-2020-2021/')).toEqual(['league-one', 2020, 2021]);
  expect(parser.parseDivisionFromUrlPath('league-one-2020-2021')).toEqual(['league-one', 2020, 2021]);
});

test('parseNumberOfBookies()', async () => {
  const htmltext1 = fs.readFileSync('data/ajax-sport-country-tournament-archive-1.html', 'utf8');

  // prettier-ignore
  const expectedBookieNums = [
    20, 18, 18, 18, 18, 18, 18, 13, 11, 17, 18,
    13, 17, 12, 16, 11, 15,  7,  8,  9, 13, 14,
    11,  2, 17, 19, 17, 20, 20, 20,  4,  5, 10,
    10,  1,  4,  4,  4,  4, 16,  4,  4,  4,  4,
     1, 18,  4,  1,  1,  4
  ];
  const expectedMinmax = [1, 11, 20];

  expect(parser.parseNumberOfBookies(htmltext1)).toEqual(expectedBookieNums);
  expect(parser.parseNumberOfBookies(htmltext1, { minmax: true })).toEqual(expectedMinmax);
  expect(parser.parseNumberOfBookies('foo')).toEqual([]);
  expect(parser.parseNumberOfBookies('foo', { minmax: true })).toEqual([0, 0, 0]);
  expect(parser.parseNumberOfBookies('')).toEqual([]);
  expect(parser.parseNumberOfBookies('', { minmax: true })).toEqual([0, 0, 0]);
  expect(parser.parseNumberOfBookies(undefined)).toEqual([]);
  expect(parser.parseNumberOfBookies(undefined, { minmax: true })).toEqual([0, 0, 0]);
  expect(parser.parseNumberOfBookies(null)).toEqual([]);
  expect(parser.parseNumberOfBookies(null, { minmax: true })).toEqual([0, 0, 0]);
});

test('normalizeDivisionName()', async () => {
  expect(parser.normalizeDivisionName('Primera Divisió')).toEqual('Primera Divisio');
  expect(parser.normalizeDivisionName('Primera Divisió 2020')).toEqual('Primera Divisio');
  expect(parser.normalizeDivisionName('Primera Divisió 2019/2020')).toEqual('Primera Divisio');
});
