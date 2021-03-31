'use strict';

// DECLARES -----------------------------------------------------------------------------

const config = require('../../config/config.json');
const utilslib = require('../lib/utilslib');
const httplib = require('../lib/httplib');
const tools = require('../tools');

const { createLogger } = require('../lib/loggerlib');
const log = createLogger();

const httpRequestConfig = tools.createHttpRequestConfig();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export async function getSeason(divisionCode, year, url = '', { flCreateSeasonPages = true }) {
  divisionCode = utilslib.trimRightChars(divisionCode, '/');

  log.debug(`Get season for division: ${divisionCode}, seasonYear: ${year}`);

  const seasons = await getSeasons(divisionCode);

  if (seasons === null) {
    const msg = `Failed to get season for division: ${divisionCode}, season year: ${year}`;
    log.error(msg);
    return defaultSeason({ error: msg });
  }

  if (seasons.length <= 0) {
    const msg = `No seasons found for division: ${divisionCode}, season year: ${year}`;
    log.error(msg);
    return defaultSeason({ error: msg });
  }

  const yearToFind = year > 0 ? year : seasons[0].seasonYear;

  const season = seasons.find((s) => s.seasonYear === yearToFind);
  if (season === undefined) {
    const msg = `Failed to find season year: ${yearToFind} for division: ${divisionCode}`;
    log.error(msg);
    return defaultSeason({ error: msg });
  }

  if (flCreateSeasonPages) {
    const seasonPages = await createSeasonPages(season);
    if (seasonPages.length == 0) {
      const msg = `Failed to create season pages for season year: ${season.seasonYear} for division: ${divisionCode}`;
      log.error(msg);
      season.error = msg;
      season.ok = false;
    } else if (seasonPages.length == 1 && seasonPages[0].noDataAvailable) {
      season.noDataAvailable = true;
      season.error = `No data available for season year: ${season.seasonYear} for division: ${divisionCode}`;
      season.ok = false;
    } else {
      season.ok = true;
    }
  }

  return season;
}

export async function getSeasons(divisionCode, flCompleteSeasons = false) {
  divisionCode = utilslib.trimRightChars(divisionCode, '/');

  log.debug(`Get seasons for division: ${divisionCode}`);

  const seasons = [];

  const url = `https://www.oddsportal.com/${divisionCode}/results/`;
  const response = await httplib.getResponse(url, httpRequestConfig, config.delayBetweenHttpRequests);
  if (!httplib.isSuccess(response, url)) {
    log.error(`Failed to get URL feed data: ${divisionCode}, url: ${url}`);
    tools.logHttpRequestError(response, url);
    return seasons;
  }
  const htmlResult = response.data;

  const reDivisionName = /<title>(.*) Results & Historical Odds/im;
  const scrapedDivisionName = htmlResult.match(reDivisionName);
  if (!scrapedDivisionName || scrapedDivisionName.length != 2) {
    log.error(`Failed to scrape division name for division ${divisionCode}, scrapedDivisionName: ${scrapedDivisionName}`);
    return seasons;
  }

  const divisionName = scrapedDivisionName[1];
  if (divisionName.length <= 0) {
    log.error(`Scraped division name is empty for division: ${divisionCode}, divisionName: ${divisionName}`);
    return seasons;
  }

  const reSeasons = /<li><span class="(active|inactive)"><strong><a href="([^"]*)">([0-9]*)\/?([0-9]*)/gim;
  const scrapedSeasons = [...htmlResult.matchAll(reSeasons)];
  log.debug('Num of potential seasons:', scrapedSeasons.length);

  scrapedSeasons.forEach((scrapedSeason) => {
    const newSeason = createSeason(divisionCode, divisionName, scrapedSeason);
    if (newSeason.ok === true) {
      seasons.push(newSeason);
    }
  });
  log.debug('Num of valid seasons:', seasons.length);

  if (seasons.length <= 0) {
    log.error(`No valid seasons for division: ${divisionCode}, scrapedSeasons: ${scrapedSeasons}`);
    return seasons;
  }

  if (flCompleteSeasons === false) {
    return seasons;
  }

  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    const seasonPages = await createSeasonPages(season);

    if (seasonPages.length == 0) {
      log.error(`Failed to create season pages for season year: ${season.seasonYear} for division: ${divisionCode}`);
      season.ok = false;
    } else if (seasonPages.length == 1 && seasonPage[0].noDataAvailable) {
      season.noDataAvailable = true;
      season.ok = false;
    } else {
      season.ok = true;
    }
  }

  return seasons;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

async function getSeasonId(url) {
  log.debug(`Get season id for season: ${url}`);

  const response = await httplib.getResponse(url, httpRequestConfig, config.delayBetweenHttpRequests);
  if (!httplib.isSuccess(response, url)) {
    log.error(`Failed to get URL season id data: ${url}`);
    tools.logHttpRequestError(response, url);
    return '';
  }
  const htmlResult = response.data;

  const reSeason = /var page = new PageTournament\(({[^}]*})\)/im;
  const scrapedSeason = htmlResult.match(reSeason);
  if (!scrapedSeason || scrapedSeason.length != 2) {
    log.error(`Failed to get season id params for season: ${url}, scrapedSeason: ${scrapedSeason}`);
    return '';
  }

  let seasonParams = null;
  try {
    seasonParams = JSON.parse(scrapedSeason[1]);
  } catch (error) {
    log.error(`Failed to json parse season id params for season: ${url}, scrapedSeason: ${scrapedSeason}`);
    return '';
  }
  if (!seasonParams || !seasonParams.id || seasonParams.id.length <= 0) {
    log.error(`Failed to get seasonParams.id params for season: ${url}, scrapedSeason: ${scrapedSeason}`);
    return '';
  }

  return seasonParams.id;
}

async function getSeasonPage(season, pageNum, flAddEventUrls) {
  log.debug(`Get season page: ${pageNum}, season: ${season.seasonName}, division: ${season.divisionCode}`);

  const seasonPage = createSeasonPage(season, { pageNum });

  if (season.seasonId === null) {
    const seasonId = await getSeasonId(season.seasonUrl);
    if (seasonId.length <= 0) {
      log.error(`Failed to get valid seasonId: ${seasonId}, season: ${season.seasonName}`);
      return seasonPage;
    }
    log.debug(`Valid seasonId: ${seasonId}`);
    season.seasonId = seasonId;
  }

  const timestamp = tools.createLongTimestamp();
  const dataUrl = `https://fb.oddsportal.com/ajax-sport-country-tournament-archive/1/${season.seasonId}/X218120706X24616X0X0X0X0X0X0X0X0X0X0X8388608X0X512/1/1/${pageNum}/?_=${timestamp}`;
  const response = await httplib.getResponse(dataUrl, httpRequestConfig, config.delayBetweenHttpRequests);
  if (!httplib.isSuccess(response, dataUrl)) {
    log.error(`Failed to get URL season data: ${season.seasonName}, dataUrl: ${dataUrl}`);
    tools.logHttpRequestError(response, dataUrl);
    return seasonPage;
  }
  const htmlResult = response.data;

  const rePagination = /<div id=\\"pagination\\">/im;
  const scrapedPagination = htmlResult.match(rePagination);
  if (scrapedPagination === null) {
    seasonPage.firstPage = 1;
    seasonPage.lastPage = 1;
  }

  const reLastPage = /x-page=\\"([0-9]*)\\"><span class=\\"arrow\\">&raquo;\|<\\\/span><\\\/a><\\\/div>"[^}]*},[^"]*"refresh":/im;
  const scrapedLastPage = htmlResult.match(reLastPage);
  if (scrapedLastPage && scrapedLastPage.length === 2) {
    seasonPage.firstPage = 1;
    seasonPage.lastPage = parseInt(scrapedLastPage[1], 10);
  }

  /**
   * scrapedHistoricDivision examples: 'Premier League 2019\/2020', 'Premier League', 'Copa de la Liga Profesional', 'Copa Diego Maradona 2020'
   */
  const reHistoricDivision = /<span class=\\"bflp\\">\\u00bb<\\\/span><a href=\\"[^"]*\">([^<]*)/im;
  const scrapedHistoricDivision = htmlResult.match(reHistoricDivision);
  if (!scrapedHistoricDivision || scrapedHistoricDivision.length != 2) {
    const reNoData = />No data available</im;
    const scrapedNoData = htmlResult.match(reNoData);
    if (scrapedNoData.length == 1) {
      log.info(`No data available for season: ${season.seasonName}`);
      seasonPage.noDataAvailable = true;
      return seasonPage;
    } else {
      log.error(`Failed to get historicDivisionName for season: ${season.seasonName}, scrapedHistoricDivision: ${scrapedHistoricDivision}`);
      log.verbose(`htmlResult: ${htmlResult}`);
      return seasonPage;
    }
  }

  const scrapedHistoricDivisionHtml = scrapedHistoricDivision[1];
  const historicDivisionName = scrapedHistoricDivisionHtml.trim().replace('\\/', '').replace(/\d+$/, '').trim();
  if (historicDivisionName.length <= 0) {
    log.error(`Historic division name is empty for season: ${season.seasonName}, scrapedHistoricDivisionHtml: ${scrapedHistoricDivisionHtml}`);
    log.verbose(`htmlResult: ${htmlResult}`);
    return seasonPage;
  }
  seasonPage.historicDivisionName = historicDivisionName;

  const reEventDates = /table-time datet t([0-9]*)/gim;
  const scrapedEventDates = [...htmlResult.matchAll(reEventDates)];
  const numEventDates = scrapedEventDates.length;
  seasonPage.numEventDates = numEventDates;
  log.debug('Num of events:', numEventDates);
  if (scrapedEventDates && numEventDates > 0) {
    seasonPage.lastEventDate = tools.convertTimestampToDate(parseInt(scrapedEventDates[0][1]), 10);
    seasonPage.firstEventDate = tools.convertTimestampToDate(parseInt(scrapedEventDates[numEventDates - 1][1], 10));
  } else {
    log.error(`Season page does not contain any events for season: ${season.seasonName}, scrapedEventDates: ${scrapedEventDates}`);
    log.verbose(`htmlResult: ${htmlResult}`);
    return seasonPage;
  }

  if (flAddEventUrls) {
    const reEventUrls = /<td class=\\"name table-participant\\"><a href=\\"([^"]*)\\">/gim;
    const scrapedEventUrls = [...htmlResult.matchAll(reEventUrls)];
    const eventUrls = [];
    for (let i = 0; i < scrapedEventUrls.length; i++) {
      eventUrls.push('https://www.oddsportal.com' + scrapedEventUrls[i][1].replaceAll('\\', ''));
    }
    const numEventUrls = eventUrls.length;
    seasonPage.numEventUrls = numEventUrls;
    seasonPage.eventUrls = eventUrls;
  }

  seasonPage.ok = true;

  return seasonPage;
}

async function getSeasonPages(season, flAddEventUrls) {
  log.debug(`Get all season pages for season: ${season.seasonName}, division: ${season.divisionCode}`);

  const seasonPages = [];

  const firstSeasonPage = await getSeasonPage(season, 1, flAddEventUrls);
  seasonPages.push(firstSeasonPage);

  if (firstSeasonPage.noDataAvailable) {
    return seasonPages;
  }
  if (firstSeasonPage.ok === false) {
    return seasonPages;
  }
  if (firstSeasonPage.lastPage <= 1) {
    return seasonPages;
  }

  season.seasonId = firstSeasonPage.seasonId;
  for (let pageNum = 2; pageNum <= firstSeasonPage.lastPage; pageNum++) {
    const nextSeasonPage = await getSeasonPage(season, pageNum, flAddEventUrls);
    if (nextSeasonPage.ok) {
      seasonPages.push(nextSeasonPage);
    }
  }

  return seasonPages;
}

async function createSeasonPages(season) {
  const seasonPages = await getSeasonPages(season, true);

  if (seasonPages.length == 0 || (seasonPages.length == 1 && seasonPages[0].noDataAvailable)) {
    return seasonPages;
  }

  const numPages = seasonPages.length;
  season.firstEventDate = seasonPages[numPages - 1].firstEventDate;
  season.lastEventDate = seasonPages[0].lastEventDate;
  season.historicDivisionName = seasonPages[0].historicDivisionName;
  season.numEvents = null;
  season.eventUrls = [];
  seasonPages.forEach((seasonPage) => {
    season.eventUrls.push(...seasonPage.eventUrls);
  });
  season.numEvents = season.eventUrls.length;

  return seasonPages;
}

function createSeason(divisionCode, divisionName, scrapedSeason) {
  const newSeason = defaultSeason();

  newSeason.divisionCode = divisionCode;
  newSeason.divisionName = divisionName;

  newSeason.divisionPath = divisionName.replaceAll('/', '-');

  const urlPath = scrapedSeason[2];
  newSeason.seasonUrl = `https://www.oddsportal.com${urlPath}`;

  const year1 = parseInt(scrapedSeason[scrapedSeason.length - 2], 10);
  const year2 = parseInt(scrapedSeason[scrapedSeason.length - 1], 10);
  newSeason.seasonYear = Number.isInteger(year2) ? year2 : Number.isInteger(year1) ? year1 : 0;
  if (newSeason.seasonYear <= 0) {
    // No need to log, some seasons are empty without being an error!
    return newSeason;
  }

  newSeason.seasonName =
    Number.isInteger(year1) && Number.isInteger(year2)
      ? `${year1}/${year2}`
      : Number.isInteger(year2)
      ? `${year2}`
      : Number.isInteger(year1)
      ? `${year1}`
      : '';

  if (newSeason.seasonName.length <= 0) {
    // No need to log, some seasons are empty without being an error!
    return newSeason;
  }

  newSeason.ok = true;

  // log.info('newSeason:', newSeason);

  return newSeason;
}

function createSeasonPage(season, options) {
  const seasonPage = defaultSeasonPage({
    divisionCode: season.divisionCode,
    divisionName: season.divisionName,
    seasonYear: season.seasonYear,
    seasonName: season.seasonName,
    seasonId: season.seasonId,
    seasonUrl: season.seasonUrl
  });

  const newSeasonPage = { ...seasonPage, ...options };
  // log.info('newSeasonPage:', newSeasonPage);

  return newSeasonPage;
}

function defaultSeason(options = {}) {
  const data = {
    ok: false,
    error: null,
    noDataAvailable: false,
    divisionCode: null,
    divisionName: null,
    divisionPath: null,
    seasonYear: null,
    seasonName: null,
    seasonId: null,
    seasonUrl: null
  };

  return { ...data, ...options };
}

function defaultSeasonPage(options = {}) {
  const data = {
    ok: false,
    error: null,
    noDataAvailable: false,
    season: null,
    division: null,
    seasonYear: null,
    seasonName: null,
    divisionCode: null,
    divisionName: null,
    historicDivisionName: null,
    seasonId: null,
    pageNum: null,
    firstPage: null,
    lastPage: null,
    numEventDates: null,
    firstEventDate: null,
    lastEventDate: null,
    numEventUrls: null,
    eventUrls: null,
    seasonUrl: null
  };

  return { ...data, ...options };
}
