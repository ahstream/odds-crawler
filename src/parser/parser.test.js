import fs from 'fs';
import { parseMatchUrl, parseNextMatchesData, parseNextMatchesHashes, parseNextMatchesJson } from './parser';

const _ = require('lodash');

const parser = require('./parser');

test('ping returns pong', () => {
  expect(parser.ping()).toBe('pong');
});

test('parseUrl()', () => {
  // [type, sport, country, divisionCodeName, divisionCode, year, event, eventId];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/bolton-doncaster-QB1Cg43p/')).toEqual({
    type: 'event',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2020,
    event: 'bolton-doncaster-QB1Cg43p',
    eventId: 'QB1Cg43p'
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019/bolton-doncaster-QB1Cg43p/')).toEqual({
    type: 'event',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2019,
    event: 'bolton-doncaster-QB1Cg43p',
    eventId: 'QB1Cg43p'
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one/bolton-doncaster-QB1Cg43p/')).toEqual({
    type: 'event',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: null,
    event: 'bolton-doncaster-QB1Cg43p',
    eventId: 'QB1Cg43p'
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one/results/')).toEqual({
    type: 'season',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: null,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2020/results/')).toEqual({
    type: 'season',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2020,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2020-2021/results/')).toEqual({
    type: 'season',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2021,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one/')).toEqual({
    type: 'schedule',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: null,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019/')).toEqual({
    type: 'schedule',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2019,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/')).toEqual({
    type: 'schedule',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: 'league-one',
    divisionCode: 'soccer/england/league-one',
    year: 2020,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/england/')).toEqual({
    type: 'country',
    sport: 'soccer',
    country: 'england',
    divisionCodeName: '',
    divisionCode: '',
    year: null,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/soccer/')).toEqual({
    type: 'sport',
    sport: 'soccer',
    country: '',
    divisionCodeName: '',
    divisionCode: '',
    year: null,
    event: '',
    eventId: ''
  });

  // [type, sport, country, divisionCodeName, divisionCode, year, event];
  expect(parser.parseUrl('https://www.oddsportal.com/')).toEqual({
    type: '',
    sport: '',
    country: '',
    divisionCodeName: '',
    divisionCode: '',
    year: null,
    event: '',
    eventId: ''
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
    13, 17, 12, 16, 11, 15, 7, 8, 9, 13, 14,
    11, 2, 17, 19, 17, 20, 20, 20, 4, 5, 10,
    10, 1, 4, 4, 4, 4, 16, 4, 4, 4, 4,
    1, 18, 4, 1, 1, 4
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

/**
 * ok
 */
test('parseMatchUrl()', () => {
  expect(parseMatchUrl('')).toEqual(null);
  expect(parseMatchUrl('xxx')).toEqual(null);
  expect(parseMatchUrl('https://www.oddsportal.com/')).toEqual(null);
  expect(parseMatchUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/')).toEqual(null);

  expect(parseMatchUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/bolton-doncaster-QB1Cg43p/')).toEqual({
    sport: 'soccer',
    country: 'england',
    division: 'league-one-2019-2020',
    match: 'bolton-doncaster-QB1Cg43p',
    matchId: 'QB1Cg43p'
  });
});

/**
 * ok
 */
test('parseNextMatchesHash()', () => {
  expect(parseNextMatchesHashes('')).toEqual(null);
  expect(parseNextMatchesHashes('xxx')).toEqual(null);

  const p1 = parseNextMatchesHashes('\tvar op = new OpHandler();if(!page)var page = new PageNextMatches({"xHash":{"20210602":"%79%6a%62%34%63","20210603":"%79%6a%32%37%61","20210604":"%79%6a%61%31%36"},"xHashf":{"20210602":"%79%6a%36%65%64","20210603":"%79%6a%38%61%35","20210604":"%79%6a%62%31%62"},"detectUserSport":false,"urlDate":"20210603","sportId":1});var menu_open = null;vJs();op.init();if(page && page.display)page.display();\tvar sigEndPage = true;\n');
  expect(_.keys(p1.xHash).length).toEqual(3);
  expect(_.keys(p1.xHashf).length).toEqual(3);
  expect(p1.urlDate).toEqual('20210603');
});

/**
 * ok
 */
test('parseNextMatchesJson()', () => {
  expect(parseNextMatchesJson('')).toEqual(null);
  expect(parseNextMatchesJson('xxx')).toEqual(null);

  const p1 = parseNextMatchesJson('globals.jsonpCallback(\'/ajax-next-games/1/2/1/20210604/yj61a.dat\', {"s":1,"d":{"E":"notAllowed"},"refresh":20});');
  expect(p1.s).toEqual(1);
  expect(p1.d).toEqual({ E: 'notAllowed' });
  expect(p1.refresh).toEqual(20);

  const p2 = parseNextMatchesJson('globals.jsonpCallback(\'/ajax-next-games/1/2/1/20210604/yj61a.dat\', {"s":1,"d":"xxx","refresh":20});');
  expect(p2.s).toEqual(1);
  expect(p2.d).toEqual('xxx');
  expect(p2.refresh).toEqual(20);
});

/**
 * ok
 */
test('parseNextMatchesData()', async () => {
  expect(parseNextMatchesData('')).toEqual({ matchUrls: [], otherUrls: [] });
  expect(parseNextMatchesData('xxxxxx')).toEqual({ matchUrls: [], otherUrls: [] });
  expect(parseNextMatchesData('href="xxx"')).toEqual({ matchUrls: [], otherUrls: ['xxx'] });
  expect(parseNextMatchesData('a href="xxx"')).toEqual({ matchUrls: [], otherUrls: ['xxx'] });
  expect(parseNextMatchesData('a href="http://www.google.com"')).toEqual({
    matchUrls: [],
    otherUrls: ['http://www.google.com']
  });

  const html1 = '<td class="table-time datet t1622331000-1-1-0-0 "></td><td class="name table-participant"><a href="/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/">Chattanooga - Maryland Bobcats</a>';
  expect(parseNextMatchesData(html1)).toEqual({
    matchUrls: ['/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/'],
    otherUrls: []
  });

  const html2 = '<a href="http://www.google.com"></a><td class="table-time datet t1622331000-1-1-0-0 "></td><td class="name table-participant"><a href="/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/">Chattanooga - Maryland Bobcats</a>';
  expect(parseNextMatchesData(html2)).toEqual({
    matchUrls: ['/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/'],
    otherUrls: ['http://www.google.com']
  });

  const html3 = '<a href="http://www.google.com"></a><a href="/tennis/usa/atp/aaa-bbb-SQMIFmzh/"></a><td class="table-time datet t1622331000-1-1-0-0 "></td><td class="name table-participant"><a href="/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/">Chattanooga - Maryland Bobcats</a>';
  expect(parseNextMatchesData(html3)).toEqual({
    matchUrls: ['/tennis/usa/atp/aaa-bbb-SQMIFmzh/', '/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/'],
    otherUrls: ['http://www.google.com']
  });
});
