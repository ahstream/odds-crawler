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
  const tournamentKey = `${sport}/${country}/${tournament}`;
  const match = utilslib.trimChars(result[4] ?? '', '/').trim();
  const matchUrl = `/${sport}/${country}/${tournament}/${match}/`;

  const matchIdTmp = match.match(/.*-([0-9A-Z]*)$/i);
  const matchId = matchIdTmp && matchIdTmp.length === 2 ? matchIdTmp[1] : '';

  const name = match.replace(`-${matchId}`, '').trim();

  return {
    name,
    sport,
    country,
    tournament,
    tournamentKey,
    match,
    matchId,
    matchUrl,
    sourceUrl: url
  };
}

export function parseNextMatchesHashes(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/var page = new PageNextMatches\(({"xHash":{[^}]*},"xHashf":{[^}]*},[^}]*})/im);
  if (!result || !result[1]) {
    throw new CustomError('Failed to regex parseNextMatchesHashes', { result, htmltext });
  }

  try {
    return JSON.parse(result[1]);
  } catch (error) {
    throw new CustomError('Failed to JSON parse in parseNextMatchesHashes', { error, htmltext });
  }
}

export function parseNextMatchesJson(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/({.*})\);$/im);
  if (!result || !result[1]) {
    throw new CustomError('Failed to regex parseNextMatchesJson', { result, htmltext });
  }

  try {
    return JSON.parse(result[1]);
  } catch (error) {
    throw new CustomError('Failed to JSON parse in parseNextMatchesJson', { error, htmltext });
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
    throw new CustomError('Failed to regex parseMatchPageEvent', { result, htmltext });
  }

  try {
    return JSON.parse(result[1]);
  } catch (error) {
    throw new CustomError('Failed to JSON parse in parseMatchPageEvent', { error, htmltext });
  }
}

export function parseMatchFeed(htmltext) {
  validateHtmltext(htmltext);

  const result = htmltext.match(/^globals.jsonpCallback\('[^']*'\, (\{.*refresh"\:[0-9]+\})\)\;/im);
  if (!result || !result[1]) {
    throw new CustomError('Failed to regex parseMatchFeed', { result, htmltext });
  }

  let feed;
  try {
    feed = JSON.parse(result[1]).d;
  } catch (error) {
    throw new CustomError('Failed to JSON parse in parseMatchFeed', { error, htmltext });
  }

  if (feed.E && feed.E === 'notAllowed') {
    throw new CustomError('Error code: notAllowed (parseMatchFeed)', { feed, htmltext });
  }
  return feed;
}

export function validateHtmltext(htmltext) {
  const error = parseError(htmltext);
  if (error) {
    throw new CustomError(`Error: ${error}`, { htmltext });
  }
}

export function parseError(htmltext) {
  if (typeof htmltext !== 'string') {
    return 0;
  }

  const result1 = getRegexMatch(1, htmltext.match(/{"E":"([^"]*)"}/im));
  if (result1) {
    return result1;
  }

  const result2 = getRegexMatch(1, htmltext.match(/{'E':'([^']*)'}/im));
  if (result2) {
    return result2;
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
