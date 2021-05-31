'use strict';

// DECLARES -----------------------------------------------------------------------------

const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const provider = require('./provider');
const fs = require('fs');
const _ = require('lodash');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

/**
 * ping()
 */
export const ping = () => 'pong';

export function parseUrl(url) {
  const urlFlags = url.match(/.*\?(.*)/i);
  const flags = urlFlags && urlFlags[1] ? urlFlags[1] : '';
  if (flags) {
    url = url.replace(`?${flags}`, '');
  }

  const result = url.match(/https:\/\/www\.oddsportal\.com\/([^\/]*\/)?([^\/]*\/)?([^\/]*\/)?([^\/]*\/)?/i);

  const sport = utilslib.trimBothChars(result[1] ?? '', '/').trim();
  const country = utilslib.trimBothChars(result[2] ?? '', '/').trim();
  const division = utilslib.trimBothChars(result[3] ?? '', '/').trim();
  let event = utilslib.trimBothChars(result[4] ?? '', '/').trim();

  const eventResult = event.match(/.*-([0-9A-Z]*)$/i);
  const eventId = eventResult && eventResult.length === 2 ? eventResult[1] : '';

  const divisionParts = parseDivisionFromUrlPath(division);
  const divisionCodeName = divisionParts[0];
  let year = divisionParts[2];
  const divisionCode = sport && country && divisionCodeName ? `${sport}/${country}/${divisionCodeName}` : '';

  let type = '';
  if (event) {
    // year = year ?? 0; // current season if not specified!
    if (event === 'results') {
      event = '';
      type = 'season';
    } else {
      type = 'event';
    }
  } else if (division) {
    // year = year ?? 0; // current season if not specified!
    type = 'schedule';
  } else if (country) {
    type = 'country';
  } else if (sport) {
    type = 'sport';
  }

  return {
    type,
    sport,
    country,
    divisionCodeName,
    divisionCode,
    year,
    event,
    eventId
  };
  // return [type, sport, country, divisionCodeName, divisionCode, year, event, eventId];
}

export function parseDivisionFromUrlPath(divisionPath) {
  divisionPath = typeof divisionPath === 'string' ? utilslib.trimBothChars(divisionPath, '/') : divisionPath;

  if (!divisionPath) {
    return ['', null, null];
  }

  // Example: https://www.oddsportal.com/soccer/england/league-one-2019-2020
  const resultWithUrl = divisionPath.match(/(http|https):.*/i);
  if (resultWithUrl && resultWithUrl[1]) {
    // URL:s are not allowed as input!
    return ['', null, null];
  }

  // Example: league-one-2019-2020
  const resultWithTwoYears = divisionPath.match(/(.*)-([0-9]{4})-([0-9]{4})/i);
  if (resultWithTwoYears && resultWithTwoYears[3]) {
    return [resultWithTwoYears[1], parseInt(resultWithTwoYears[2], 10), parseInt(resultWithTwoYears[3], 10)];
  }

  // Example: league-one-2020
  const resultWithOneYear = divisionPath.match(/(.*)-([0-9]{4})/i);
  if (resultWithOneYear && resultWithOneYear[2]) {
    return [resultWithOneYear[1], null, parseInt(resultWithOneYear[2], 10)];
  }

  // Example: league-one
  const resultWithNoYear = divisionPath.match(/(.*)$/i);
  if (resultWithNoYear && resultWithNoYear[1]) {
    return [resultWithNoYear[1], null, null];
  }

  return ['', null, null];
}

export function parseNumberOfBookies(htmltext, { minmax = true }) {
  if (typeof htmltext !== 'string') {
    return minmax ? [0, 0, 0] : [];
  }

  const matches = [...htmltext.matchAll(/<td class=\\"center info-value\\">([0-9]*)<\\\/td>/gm)];

  if (matches.length == 0) {
    return minmax ? [0, 0, 0] : [];
  }

  const numofBookiesList = [];
  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1]) {
      numofBookiesList.push(parseInt(matches[i][1]));
    }
  }

  if (minmax) {
    return [_.round(_.mean(numofBookiesList), 0), _.round(_.min(numofBookiesList), 0), _.round(_.max(numofBookiesList), 0)];
  } else {
    return numofBookiesList;
  }
}

export function parseDivisionNameFromSeasonPage(htmltext) {
  const match = htmltext.match(/<title>(.*) Results & Historical Odds/im);

  if (!match || match.length != 2) {
    log.debug(`Failed to scrape division name!`);
    return null;
  }

  const divisionName = match[1];
  if (!divisionName) {
    log.debug(`Scraped division name is empty!`);
    return null;
  }

  return divisionName;
}

export function parseSeasonLinksFromSeasonPage(htmltext, divisionName) {
  const matches = [...htmltext.matchAll(/<li><span class="(active|inactive)"><strong><a href="([^"]*)">([0-9]*)\/?([0-9]*)/gim)];

  const seasonLinks = [];
  matches.forEach((seasonLink) => {
    const url = `https://www.oddsportal.com${seasonLink[2]}`;

    const itemLength = seasonLink.length;
    const year1 = parseInt(seasonLink[itemLength - 2], 10);
    const year2 = parseInt(seasonLink[itemLength - 1], 10);
    const year = Number.isInteger(year2) ? year2 : Number.isInteger(year1) ? year1 : 0;

    const name =
      Number.isInteger(year1) && Number.isInteger(year2)
        ? `${year1}/${year2}`
        : Number.isInteger(year2)
        ? `${year2}`
        : Number.isInteger(year1)
          ? `${year1}`
          : '';
    if (name) {
      seasonLinks.push({ divisionName, year, name, url });
    }
  });

  return seasonLinks;
}

export function parseSeasonIdFromSeasonPage(htmltext) {
  const match = htmltext.match(/var page = new PageTournament\(({[^}]*})\)/im);
  if (!match || match.length != 2) {
    log.debug(`Failed to scrape season id!`);
    return null;
  }

  let params = null;

  try {
    params = JSON.parse(match[1]);
  } catch (error) {
    log.error(`Failed to JSON parse params for season, error: ${error}`);
    return null;
  }

  if (!params || !params.id || params.id.length <= 0) {
    log.error(`Failed to get season params.id`);
    return null;
  }

  return params.id;
}

export function parsePaginationFromSeasonArchive(htmltext) {
  const pagination = { firstPage: null, lastPage: null };

  const paginationMatch = htmltext.match(/<div id=\\"pagination\\">/im);

  if (!paginationMatch) {
    pagination.firstPage = 1;
    pagination.lastPage = 1;
  }

  const pagenumsMatch = htmltext.match(/x-page=\\"([0-9]*)\\"><span class=\\"arrow\\">&raquo;\|<\\\/span><\\\/a><\\\/div>"[^}]*},[^"]*"refresh":/im);

  if (pagenumsMatch && pagenumsMatch.length === 2) {
    pagination.firstPage = 1;
    pagination.lastPage = parseInt(pagenumsMatch[1], 10);
  }

  return pagination;
}

export function parseSeasonNoDataAvailable(htmltext) {
  const match = htmltext.match(/>No data available</im);
  if (match.length == 1) {
    return true;
  } else {
    return false;
  }
}

export function parseSeasonHistoricDivisionName(htmltext) {
  // Examples: 'Premier League 2019\/2020', 'Premier League', 'Copa de la Liga Profesional', 'Copa Diego Maradona 2020'
  const match = htmltext.match(/<span class=\\"bflp\\">\\u00bb<\\\/span><a href=\\"[^"]*\">([^<]*)/im);
  if (!match || match.length !== 2) {
    return null;
  }

  const historicDivisionName = match[1].trim().replace('\\/', '').replace(/\d+$/, '').trim();

  return historicDivisionName;
}

export function parseSeasonArchivePage(htmltext) {
  const pagination = { firstPage: null, lastPage: null };

  const paginationMatch = htmltext.match(/<div id=\\"pagination\\">/im);

  if (!paginationMatch) {
    pagination.firstPage = 1;
    pagination.lastPage = 1;
  }

  const pagenumsMatch = htmltext.match(/x-page=\\"([0-9]*)\\"><span class=\\"arrow\\">&raquo;\|<\\\/span><\\\/a><\\\/div>"[^}]*},[^"]*"refresh":/im);

  if (pagenumsMatch && pagenumsMatch.length === 2) {
    pagination.firstPage = 1;
    pagination.lastPage = parseInt(pagenumsMatch[1], 10);
  }

  return pagination;
}

export function parseSeasonArchivePageEventDates(htmltext) {
  const eventDates = { first: null, last: null };

  const matches = [...htmltext.matchAll(/table-time datet t([0-9]*)/gim)];
  const numMatches = matches.length;

  if (numMatches > 0) {
    eventDates.last = provider.convertTimestampToDate(parseInt(matches[0][1]), 10);
    eventDates.first = provider.convertTimestampToDate(parseInt(matches[numMatches - 1][1], 10));
  }

  return eventDates;
}

export function parseSeasonArchivePageEventLinks(htmltext) {
  const matches = [...htmltext.matchAll(/<td class=\\"name table-participant\\"><a href=\\"([^"]*)\\">/gim)];

  const eventUrls = [];
  for (let i = 0; i < matches.length; i++) {
    eventUrls.push('https://www.oddsportal.com' + matches[i][1].replaceAll('\\', ''));
  }

  return eventUrls;
}

export function parseDivisionsFromDivisionsPage(htmltext) {
  const matches = [...htmltext.matchAll(/<a foo="f" href="([^^"]*)"/gim)];

  const divisions = [];
  matches.forEach((match) => {
    const divisionUrl = 'https://www.oddsportal.com' + match[1];
    divisions.push(divisionUrl);
  });

  return divisions;
}

export function parseBookiesFromBookiesPage(htmltext) {
  const match = htmltext.match(/var bookmakersData\=(\{.*\}\})\;/im);
  if (!match || match.length < 2) {
    return null;
  }

  return JSON.parse(match[1]);
}

export function parseMatches(htmltext) {
  const matchedItems = [...htmltext.matchAll(/<a href=\\"\\(\/[a-z0-9-]*\\\/[a-z0-9-]*\\\/[a-z0-9-]*\\\/[a-zA-Z0-9-]*\\\/)\\"/gim)];
  const matches = [];
  matchedItems.forEach((matchedItem) => {
    const url = matchedItem[1].replace(/\\/g, '');
    matches.push(url);
  });
  return matches;
}


