import { CustomError } from './exceptions';
import {
  parseMatchUrl,
  parseFakedMatchUrl,
  parseTournamentName,
  parseTournamentPath,
  parseNextMatchesData,
  parseNextMatchesHashes,
  parseNextMatchesJson
} from './parser';

const _ = require('lodash');

test('parseMatchUrl()', () => {
  expect(parseMatchUrl('')).toEqual(null);
  expect(parseMatchUrl('xxx')).toEqual(null);
  expect(parseMatchUrl('https://www.oddsportal.com/')).toEqual(null);
  expect(parseMatchUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/')).toEqual(null);

  expect(parseMatchUrl('https://www.oddsportal.com/soccer/england/league-one-2019-2020/bolton-doncaster-QB1Cg43p/')).toEqual({
    sport: 'soccer',
    country: 'england',
    tournament: 'league-one-2019-2020',
    match: 'bolton-doncaster-QB1Cg43p',
    tournamentName: 'league-one',
    tournamentNameWithYear: 'league-one-2019-2020',
    tournamentKey: 'soccer/england/league-one',
    tournamentKeyWithYear: 'soccer/england/league-one-2019-2020',
    tournamentYear: '2019-2020',
    matchName: 'bolton-doncaster',
    matchId: 'QB1Cg43p',
    matchUrl: '/soccer/england/league-one-2019-2020/bolton-doncaster-QB1Cg43p/',
    sourceUrl: 'https://www.oddsportal.com/soccer/england/league-one-2019-2020/bolton-doncaster-QB1Cg43p/'
  });

  expect(parseMatchUrl('https://www.oddsportal.com/soccer/england/league-one-2019/bolton-doncaster-QB1Cg43p/')).toEqual({
    sport: 'soccer',
    country: 'england',
    tournament: 'league-one-2019',
    match: 'bolton-doncaster-QB1Cg43p',
    tournamentName: 'league-one',
    tournamentNameWithYear: 'league-one-2019',
    tournamentKey: 'soccer/england/league-one',
    tournamentKeyWithYear: 'soccer/england/league-one-2019',
    tournamentYear: '2019',
    matchName: 'bolton-doncaster',
    matchId: 'QB1Cg43p',
    matchUrl: '/soccer/england/league-one-2019/bolton-doncaster-QB1Cg43p/',
    sourceUrl: 'https://www.oddsportal.com/soccer/england/league-one-2019/bolton-doncaster-QB1Cg43p/'
  });

  expect(parseMatchUrl('https://www.oddsportal.com/soccer/england/league-one/bolton-doncaster-QB1Cg43p/')).toEqual({
    sport: 'soccer',
    country: 'england',
    tournament: 'league-one',
    match: 'bolton-doncaster-QB1Cg43p',
    tournamentName: 'league-one',
    tournamentNameWithYear: 'league-one',
    tournamentKey: 'soccer/england/league-one',
    tournamentKeyWithYear: 'soccer/england/league-one',
    tournamentYear: '',
    matchName: 'bolton-doncaster',
    matchId: 'QB1Cg43p',
    matchUrl: '/soccer/england/league-one/bolton-doncaster-QB1Cg43p/',
    sourceUrl: 'https://www.oddsportal.com/soccer/england/league-one/bolton-doncaster-QB1Cg43p/'
  });
});

test('parseFakedMatchUrl()', () => {
  const matchId = '0jqt7y3k';

  expect(parseFakedMatchUrl(matchId, 'soccer/colombia/primera-b')).toEqual({
    sport: 'soccer',
    country: 'colombia',
    tournament: 'primera-b',
    match: '',
    tournamentName: 'primera-b',
    tournamentNameWithYear: 'primera-b',
    tournamentKey: 'soccer/colombia/primera-b',
    tournamentKeyWithYear: 'soccer/colombia/primera-b',
    tournamentYear: '',
    matchName: '',
    matchId,
    matchUrl: `/soccer/colombia/primera-b/${matchId}/`,
    sourceUrl: `/soccer/colombia/primera-b/${matchId}/`
  });

  expect(parseFakedMatchUrl(matchId, 'soccer/colombia/primera-b-2020')).toEqual({
    sport: 'soccer',
    country: 'colombia',
    tournament: 'primera-b-2020',
    match: '',
    tournamentName: 'primera-b',
    tournamentNameWithYear: 'primera-b-2020',
    tournamentKey: 'soccer/colombia/primera-b',
    tournamentKeyWithYear: 'soccer/colombia/primera-b-2020',
    tournamentYear: '2020',
    matchName: '',
    matchId,
    matchUrl: `/soccer/colombia/primera-b-2020/${matchId}/`,
    sourceUrl: `/soccer/colombia/primera-b-2020/${matchId}/`
  });

  expect(parseFakedMatchUrl(matchId, 'soccer/colombia/primera-b-2020-2021')).toEqual({
    sport: 'soccer',
    country: 'colombia',
    tournament: 'primera-b-2020-2021',
    match: '',
    tournamentName: 'primera-b',
    tournamentNameWithYear: 'primera-b-2020-2021',
    tournamentKey: 'soccer/colombia/primera-b',
    tournamentKeyWithYear: 'soccer/colombia/primera-b-2020-2021',
    tournamentYear: '2020-2021',
    matchName: '',
    matchId,
    matchUrl: `/soccer/colombia/primera-b-2020-2021/${matchId}/`,
    sourceUrl: `/soccer/colombia/primera-b-2020-2021/${matchId}/`
  });
});

test('parseTournamentName()', () => {
  expect(() => {
    parseTournamentName('');
  }).toThrow(CustomError);
  expect(parseTournamentName('Show all "Olympic Games Women" matches')).toEqual({
    name: 'Olympic Games Women',
    year: '',
    year1: '',
    year2: ''
  });
  expect(parseTournamentName('Show all "Premier League 2020" matches')).toEqual({
    name: 'Premier League',
    year: '2020',
    year1: '2020',
    year2: ''
  });
  expect(parseTournamentName('Show all "Premier League 2020/2021" matches')).toEqual({
    name: 'Premier League',
    year: '2020/2021',
    year1: '2020',
    year2: '2021'
  });
  expect(parseTournamentName('Show all "1857 Cup" matches')).toEqual({
    name: '1857 Cup',
    year: '',
    year1: '',
    year2: ''
  });
});

test('parseTournamentPath()', () => {
  expect(() => {
    parseTournamentPath('');
  }).toThrow(CustomError);
  expect(parseTournamentPath('league-one-2019-2020')).toEqual({ name: 'league-one', year: '2019-2020' });
  expect(parseTournamentPath('league-one-2019')).toEqual({ name: 'league-one', year: '2019' });
  expect(parseTournamentPath('league-one')).toEqual({ name: 'league-one', year: '' });
  expect(parseTournamentPath('1857-cup')).toEqual({ name: '1857-cup', year: '' });
});

test('parseNextMatchesHash()', () => {
  expect(() => parseNextMatchesHashes('')).toThrow(CustomError);
  expect(() => parseNextMatchesHashes('xxx')).toThrow(CustomError);

  const p1 = parseNextMatchesHashes('\tvar op = new OpHandler();if(!page)var page = new PageNextMatches({"xHash":{"20210602":"%79%6a%62%34%63","20210603":"%79%6a%32%37%61","20210604":"%79%6a%61%31%36"},"xHashf":{"20210602":"%79%6a%36%65%64","20210603":"%79%6a%38%61%35","20210604":"%79%6a%62%31%62"},"detectUserSport":false,"urlDate":"20210603","sportId":1});var menu_open = null;vJs();op.init();if(page && page.display)page.display();\tvar sigEndPage = true;\n');
  expect(_.keys(p1.xHash).length).toEqual(3);
  expect(_.keys(p1.xHashf).length).toEqual(3);
  expect(p1.urlDate).toEqual('20210603');
});

test('parseNextMatchesJson()', () => {
  expect(() => parseNextMatchesJson('')).toThrow(CustomError);
  expect(() => parseNextMatchesJson('xxx')).toThrow(CustomError);
  expect(() => parseNextMatchesJson('globals.jsonpCallback(\'/ajax-next-games/1/2/1/20210604/yj61a.dat\', {"s":1,"d":{"E":"notAllowed"},"refresh":20});')).toThrow(CustomError);

  const result = parseNextMatchesJson('globals.jsonpCallback(\'/ajax-next-games/1/2/1/20210604/yj61a.dat\', {"s":1,"d":"xxx","refresh":20});');
  expect(result.s).toEqual(1);
  expect(result.d).toEqual('xxx');
  expect(result.refresh).toEqual(20);
});

test('parseNextMatchesData()', async () => {
  let htmltext;
  let result;

  expect(parseNextMatchesData('')).toEqual({ parsedMatchUrls: [], otherUrls: [] });
  expect(parseNextMatchesData('xxxxxx')).toEqual({ parsedMatchUrls: [], otherUrls: [] });
  expect(parseNextMatchesData('href="xxx"')).toEqual({ parsedMatchUrls: [], otherUrls: ['xxx'] });
  expect(parseNextMatchesData('a href="xxx"')).toEqual({ parsedMatchUrls: [], otherUrls: ['xxx'] });
  expect(parseNextMatchesData('a href="http://www.google.com"')).toEqual({
    parsedMatchUrls: [],
    otherUrls: ['http://www.google.com']
  });

  htmltext = '<td class="table-time datet t1622331000-1-1-0-0 "></td><td class="name table-participant"><a href="/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/">Chattanooga - Maryland Bobcats</a>';
  result = parseNextMatchesData(htmltext);
  expect(result.parsedMatchUrls[0].matchUrl).toEqual('/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/');
  expect(result.otherUrls).toEqual([]);

  htmltext = '<a href="http://www.google.com"></a><td class="table-time datet t1622331000-1-1-0-0 "></td><td class="name table-participant"><a href="/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/">Chattanooga - Maryland Bobcats</a>';
  result = parseNextMatchesData(htmltext);
  expect(result.parsedMatchUrls[0].matchUrl).toEqual('/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/');
  expect(result.otherUrls).toEqual(['http://www.google.com']);

  htmltext = '<a href="http://www.google.com"></a><a href="/tennis/usa/atp/aaa-bbb-SQMIFmzh/"></a><td class="table-time datet t1622331000-1-1-0-0 "></td><td class="name table-participant"><a href="/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/">Chattanooga - Maryland Bobcats</a>';
  result = parseNextMatchesData(htmltext);
  expect(result.parsedMatchUrls[0].matchUrl).toEqual('/tennis/usa/atp/aaa-bbb-SQMIFmzh/');
  expect(result.parsedMatchUrls[1].matchUrl).toEqual('/soccer/usa/nisa/chattanooga-maryland-bobcats-SQMIFmzh/');
  expect(result.otherUrls).toEqual(['http://www.google.com']);
});
