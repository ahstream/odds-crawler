'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const parser = require('./parser');
const seasonlib = require('./season');
const provider = require('./provider');
const dataWriter = require('./dataWriter.js');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// FUNCTIONS -----------------------------------------------------------------------------

export async function getDivisionsFromWebPage(url) {
  try {
    // Example: https://www.oddsportal.com/soccer/
    // Example: https://www.oddsportal.com/soccer/england/

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    const divisions = parser.parseDivisionsFromDivisionsPage(htmltext);
    assert(divisions, 'divisions falsey');

    return divisions.sort((a, b) => {
      if (a.divisionCode < b.divisionCode) return -1;
      if (a.divisionCode > b.divisionCode) return 1;
      return 0;
    });
  } catch (error) {
    log.error(`getDivisionsFromWebPage exception: ${error}, url: ${url}, stack: ${error.stack}`);
    return { error: error.message };
  }
}

export async function crawlDivisions(url) {
  log.info(`Start crawling divisions at url: ${url}`);

  const divisions = await getDivisionsFromWebPage(url);
  assert(divisions, 'divisions falsey');

  const numDivisions = divisions.length;

  const seasons = [];
  for (const [index, url] of divisions.entries()) {
    log.info(`Crawl division ${index + 1} of ${numDivisions}: ${url}`);
    try {
      const season = await seasonlib.getSeasonFromWebPage(url, {});
      const obj = createDivisionObject(season);
      dataWriter.writeToDivisionsFile(obj);
    } catch (error) {
      log.error(error, error.stack);
    }
  }

  log.info(`Done crawling divisions!`);

  return seasons;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function createDivisionObject(season) {
  const obj = {
    sport: _.startCase(_.toLower(season.sport)),
    country: _.startCase(_.toLower(season.country)),
    divisionCode: season.divisionCode,
    divisionName: season.divisionName,
    historicDivisionName: season.historicDivisionName,
    divisionCodeName: season.divisionCodeName,
    normalizedDivisionName: parser.normalizeDivisionName(season.divisionName),
    isCup: season.isCup ? 1 : 0,
    year: season.year,
    seasonId: season.seasonId,
    bookies: season.bookies,
    pages: season.pagination.lastPage,
    numEvents: season.numEvents,
    firstEventDate: season.firstEventDate,
    lastEventDate: season.lastEventDate,
    numSeasons: season.numSeasons,
    numEventsLast4Years: null,
    numEventsTotal: season.numEventsTotal,
    numEventsPerSeason: season.numEventsPerSeason,
    numBookiesPerSeason: season.numBookiesPerSeason,
    url: season.url
  };

  const years = [];
  for (let i = 2021; i >= 1995; i--) {
    years.push(i);
  }

  years.forEach((year) => {
    obj[`${year}-e`] = null;
  });

  years.forEach((year) => {
    obj[`${year}-b`] = null;
  });

  season.seasonsInfo.forEach((season) => {
    if (years.includes(season.year)) {
      obj[`${season.year}-e`] = season.numEvents;
      obj[`${season.year}-b`] = season.numBookies;
    }
  });

  obj.numEventsLast4Years = (obj[`${years[0]}-e`] ?? 0) + (obj[`${years[1]}-e`] ?? 0) + (obj[`${years[2]}-e`] ?? 0) + (obj[`${years[3]}-e`] ?? 0);

  return obj;
}
