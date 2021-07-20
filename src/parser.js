/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';

const _ = require('lodash');

const { createLogger } = require('./lib/loggerlib');
const utilslib = require('./lib/utilslib');
const provider = require('./provider');

const log = createLogger();

// MAIN FUNCTIONS ---------------------------------------------------------------------------------

export function parseMatchUrl(url) {
  const result = url.match(/(?:https:\/\/www\.oddsportal\.com)?\/([^/]*\/)?([^/]*\/)?([^/]*\/)?([^/]*\/)?/i);
  if (!result || !result[4]) {
    return null;
  }

  const sport = utilslib.trimChars(result[1] ?? '', '/').trim();
  const country = utilslib.trimChars(result[2] ?? '', '/').trim();
  const tournament = utilslib.trimChars(result[3] ?? '', '/').trim();
  const tournamentNameWithYear = tournament;
  const match = utilslib.trimChars(result[4] ?? '', '/').trim();

  const tournamentPathData = parseTournamentPath(tournament);
  const tournamentName = tournamentPathData.name.trim();
  const tournamentYear = tournamentPathData.year.trim();
  const tournamentKey = `${sport}/${country}/${tournamentName}`;
  const tournamentKeyWithYear = `${sport}/${country}/${tournament}`;

  const matchIdTmp = match.match(/.*-([0-9A-Z]*)$/i);
  const matchId = matchIdTmp && matchIdTmp.length === 2 ? matchIdTmp[1] : '';
  const matchName = match.replace(`-${matchId}`, '').trim();
  const matchUrl = `/${sport}/${country}/${tournament}/${match}/`;

  return {
    sport,
    country,
    tournament,
    match,
    tournamentName,
    tournamentNameWithYear,
    tournamentKey,
    tournamentKeyWithYear,
    tournamentYear,
    matchName,
    matchId,
    matchUrl,
    sourceUrl: url
  };
}

export function parseFakedMatchUrl(matchId, tournamentKeyWithYear) {
  // Example tournamentNameYearKey: soccer/colombia/primera-b-2020-2021
  const items = tournamentKeyWithYear.split('/');

  const sport = utilslib.trimChars(items[0] ?? '', '/').trim();
  const country = utilslib.trimChars(items[1] ?? '', '/').trim();
  const tournament = utilslib.trimChars(items[2] ?? '', '/').trim();
  const tournamentNameWithYear = tournament;
  const tournamentPathData = parseTournamentPath(tournament);
  const tournamentName = tournamentPathData.name.trim();
  const tournamentYear = tournamentPathData.year.trim();
  const tournamentKey = `${sport}/${country}/${tournamentName}`;

  return {
    sport,
    country,
    tournament,
    match: '',
    tournamentName,
    tournamentNameWithYear,
    tournamentKey,
    tournamentKeyWithYear,
    tournamentYear,
    matchName: '',
    matchId,
    matchUrl: `/${tournamentKeyWithYear}/${matchId}/`,
    sourceUrl: `/${tournamentKeyWithYear}/${matchId}/`
  };
}

export function parseTournamentName(htmltext) {
  const matchedData = htmltext.match(/Show all "(?!\d\d\d\d)(.*?)(\d\d\d\d)?(?:\/)?(\d\d\d\d)?"/i);
  if (!matchedData || !matchedData[1]) {
    log.debug('CustomError: Failed to regex parseTournamentName', { result: matchedData, htmltext });
    throw new CustomError('Failed to regex parseTournamentName', { result: matchedData, htmltext });
  }

  const tournamentData = {};
  tournamentData.name = matchedData[1].trim();
  tournamentData.year1 = matchedData[2] || '';
  tournamentData.year2 = matchedData[3] || '';
  tournamentData.year = `${tournamentData.year1}${tournamentData.year2 ? '/' : ''}${tournamentData.year2}`.trim();

  return tournamentData;
}

export function parseTournamentPath(text) {
  const matchedData = text.match(/(.*?)(?:-)?((?:\d\d\d\d)?(?:-\d\d\d\d)?)$/i);
  if (!matchedData || !matchedData[1]) {
    log.debug('CustomError: Failed to regex parseTournamentPath', { result: matchedData, text });
    throw new CustomError('Failed to regex parseTournamentPath', { result: matchedData, text });
  }

  const tournamentData = {};
  tournamentData.name = matchedData[1].trim();
  tournamentData.year = matchedData[2] || '';

  return tournamentData;
}

export function parseNextMatchesHashes(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/var page = new PageNextMatches\(({"xHash":{[^}]*},"xHashf":{[^}]*},[^}]*})/im);
  if (!result || !result[1]) {
    log.debug('CustomError: Failed to regex parseNextMatchesHashes', { result });
    throw new CustomError('Failed to regex parseNextMatchesHashes', { result, htmltext });
  }

  try {
    return JSON.parse(result[1]);
  } catch (error) {
    log.debug('CustomError: Failed to JSON parse in parseNextMatchesHashes', error, result);
    throw new CustomError('Failed to JSON parse in parseNextMatchesHashes', {
      errorMsg: error.message,
      error,
      htmltext
    });
  }
}

export function parseNextMatchesJson(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/({.*})\);$/im);
  if (!result || !result[1]) {
    log.debug('CustomError: Failed to regex parseNextMatchesJson', { result });
    throw new CustomError('Failed to regex parseNextMatchesJson', { result, htmltext });
  }

  try {
    return JSON.parse(result[1]);
  } catch (error) {
    log.debug('CustomError: Failed to JSON parse in parseNextMatchesJson', error, result);
    throw new CustomError('Failed to JSON parse in parseNextMatchesJson', { errorMsg: error.message, error, htmltext });
  }
}

export function parseNextMatchesData(htmltext) {
  validateHtmltext(htmltext);

  const parsedMatchUrls = [];
  const otherUrls = [];
  const allLinks = [...htmltext.matchAll(/href="([^"]*)/gim)];

  allLinks.forEach((link) => {
    const rawUrl = link[1].replace(/\\/g, '');
    const parsedUrl = parseMatchUrl(rawUrl);
    if (parsedUrl && parsedUrl.matchId !== '') {
      parsedMatchUrls.push(parsedUrl);
    } else {
      otherUrls.push(rawUrl);
    }
  });

  return { parsedMatchUrls, otherUrls };
}

export function parseMatchPageEvent(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/new PageEvent\(({[^}]*})\)/im);
  if (!result || !result[1]) {
    // log.debug('CustomError: Failed to regex parseMatchPageEvent', { result, htmltext });
    throw new CustomError('Failed to regex parseMatchPageEvent', { result, htmltext });
  }

  try {
    return JSON.parse(result[1]);
  } catch (error) {
    log.debug('CustomError: Failed to JSON parse in parseMatchPageEvent', { error, result });
    throw new CustomError('Failed to JSON parse in parseMatchPageEvent', { errorMsg: error.message, error, htmltext });
  }
}

export function parseMatchFeed(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/^globals.jsonpCallback\('[^']*'\, (\{.*refresh"\:[0-9]+\})\)\;/im);
  if (!result || !result[1]) {
    log.debug('CustomError: Failed to regex parseMatchFeed', { result });
    throw new CustomError('Failed to regex parseMatchFeed', { result, htmltext });
  }

  let feed;
  try {
    feed = JSON.parse(result[1]).d;
  } catch (error) {
    log.debug('CustomError: Failed to JSON parse in parseMatchFeed', { errorMsg: error.message, error, result });
    throw new CustomError('Failed to JSON parse in parseMatchFeed', { errorMsg: error.message, error, htmltext });
  }

  if (feed.E && feed.E === 'notAllowed') {
    log.debug('CustomError: Error code: notAllowed (parseMatchFeed)', { feed, result });
    throw new CustomError('Error code: notAllowed (parseMatchFeed)', { feed, htmltext });
  }
  return feed;
}

export function validateHtmltext(htmltext) {
  const error = parseError(htmltext);
  if (error) {
    log.debug('CustomError: Error', { error });
    throw new CustomError(`Error: ${error}`, { htmltext });
  }
}

export function parseError(htmltext) {
  if (typeof htmltext !== 'string') {
    return 0;
  }

  const result2 = getRegexMatch(1, htmltext.match(/{'E':'([^']*)'}/im));
  if (result2) {
    return result2;
  }

  const result21 = getRegexMatch(1, htmltext.match(/{E:'([^']*)'}/im));
  if (result21) {
    return result21;
  }

  const result3 = getRegexMatch(null, htmltext.match(/notAllowed/im));
  if (result3) {
    return result3;
  }

  const result4 = getRegexMatch(1, htmltext.match(/<title>OddsPortal: Error ([0-9]+)<\/title>/im));
  if (result4) {
    return result4;
  }

  const result5 = getRegexMatch(1, htmltext.match(/<title>([0-9]+) Bad Gateway<\/title>/im));
  if (result5) {
    return result5;
  }

  return 0;
}

function getRegexMatch(index, matchedResult) {
  if (index === null) {
    return matchedResult;
  }

  if (matchedResult && matchedResult[index]) {
    return matchedResult[index];
  }

  return false;
}
