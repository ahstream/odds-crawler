// DECLARES -----------------------------------------------------------------------------

const assert = require('assert');
const _ = require('lodash');

const { createLogger } = require('../lib/loggerlib');
const parser = require('../parser/parser');
const provider = require('../provider/provider');

const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export async function getSeasonFromWebPage(url, { flGetAllSeasonInfo = true }) {
  try {
    // Example: https://www.oddsportal.com/soccer/england/premier-league/results/

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    const divisionName = parser.parseDivisionNameFromSeasonPage(htmltext);
    assert(divisionName, 'divisionName falsey');

    const parsedUrl = parser.parseUrl(url);
    const sport = parsedUrl.sport;
    const country = parsedUrl.country;
    const divisionCode = parsedUrl.divisionCode;
    const divisionCodeName = parsedUrl.divisionCodeName;

    const isCup = divisionCode.includes('cup');

    const seasonLinks = parser.parseSeasonLinksFromSeasonPage(
      htmltext,
      divisionName
    );

    const year = getYearFromUrlOrSeasonLinks(url, seasonLinks);

    let seasonsInfo = [];
    let numSeasons = null;
    let numEventsTotal = null;
    let numEventsPerSeason = null;
    let numBookiesPerSeason = null;
    if (flGetAllSeasonInfo) {
      seasonsInfo = await getSeasonInfoFromSeasonPages(seasonLinks);
      numSeasons = seasonsInfo.length;
      numEventsTotal = seasonsInfo
        .map((item) => item.numEvents)
        .reduce((sum, val) => sum + val, 0);
      numEventsPerSeason = _.round(numEventsTotal / numSeasons, 0);
      numBookiesPerSeason = _.round(
        seasonsInfo
          .map((item) => item.numBookies)
          .reduce((sum, val) => sum + val, 0) / numSeasons,
        0
      );
    }

    const seasonId = parser.parseSeasonIdFromSeasonPage(htmltext);
    assert(seasonId, 'seasonId falsey');

    const seasonArchivePageHtml = await getOneSeasonOneArchivePageHtml(
      seasonId,
      1
    );
    assert(seasonArchivePageHtml, 'seasonArchivePageHtml falsey');

    const historicDivisionName = parser.parseSeasonHistoricDivisionName(
      seasonArchivePageHtml
    );

    const bookies = parser.parseNumberOfBookies(seasonArchivePageHtml, {
      minmax: true
    });
    assert(bookies.length === 3, 'parseNumberOfBookies !== 3');

    const pagination = parser.parsePaginationFromSeasonArchive(
      seasonArchivePageHtml
    );

    const pagenums = Array.from(
      { length: pagination.lastPage },
      (_, i) => i + 1
    );
    const seasonArchivePagesHtml = await getOneSeasonManyArchivePagesHtml(
      seasonId,
      pagenums
    );
    assert(seasonArchivePagesHtml, 'seasonArchivePagesHtml falsey');

    const eventLinks = [];
    let numEvents = 0;
    let firstEventDate = null;
    let lastEventDate = null;
    seasonArchivePagesHtml.forEach((pagehtml) => {
      const pageEventDates = parser.parseSeasonArchivePageEventDates(pagehtml);
      assert(pageEventDates, 'pageEventDates falsey');
      if (firstEventDate === null || pageEventDates.first < firstEventDate) {
        firstEventDate = pageEventDates.first;
      }
      if (lastEventDate === null || pageEventDates.last > lastEventDate) {
        lastEventDate = pageEventDates.last;
      }

      const pageEventLinks = parser.parseSeasonArchivePageEventLinks(pagehtml);
      assert(pageEventLinks, 'pageEventLinks falsey');
      eventLinks.push(pageEventLinks);

      numEvents += pageEventLinks.length;
    });

    return {
      url,
      sport,
      country,
      divisionName,
      divisionCode,
      historicDivisionName,
      divisionCodeName,
      isCup,
      year,
      seasonId,
      bookies: bookies[0],
      pagination,
      numEvents,
      firstEventDate,
      lastEventDate,
      eventLinks: eventLinks.flat(),
      numSeasons,
      numEventsTotal,
      numEventsPerSeason,
      numBookiesPerSeason,
      seasonsInfo
    };
  } catch (error) {
    log.error(`season.getSeasonWebPage exception: ${error}, url: ${url}`);
    log.verbose(`season.getSeasonWebPage exception: stack: ${error.stack}`);
    return { error: error.message };
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function getYearFromUrlOrSeasonLinks(url, seasonLinks) {
  const parsedUrl = parser.parseUrl(url);
  return parsedUrl.year ?? seasonLinks[0].year;
}

async function getOneSeasonOneArchivePageHtml(seasonId, pagenum = 1) {
  try {
    const timestamp = provider.createLongTimestamp();
    const url = `https://fb.oddsportal.com/ajax-sport-country-tournament-archive/1/${seasonId}/X218120706X24616X0X0X0X0X0X0X0X0X0X0X8388608X0X512/1/1/${pagenum}/?_=${timestamp}`;
    const response = await provider.httpGetResponse(url, {});
    return response.data;
  } catch (error) {
    log.error(
      `getSeasonArchiveHtml exception: ${error}, seasonId: ${seasonId}, pagenum: ${pagenum}, stack: ${error.stack}`
    );
    return null;
  }
}

async function getOneSeasonManyArchivePagesHtml(seasonId, pagenums) {
  try {
    const timestamp = provider.createLongTimestamp();
    const urls = pagenums.map(
      (pagenum) =>
        `https://fb.oddsportal.com/ajax-sport-country-tournament-archive/1/${seasonId}/X218120706X24616X0X0X0X0X0X0X0X0X0X0X8388608X0X512/1/1/${pagenum}/?_=${timestamp}`
    );
    const results = await provider.getMany(urls);
    assert(results.success, 'results.success falsey');

    return results.data.map((item) => item.response.data);
  } catch (error) {
    log.error(
      `getOneSeasonManyArchivePagesHtml exception: ${error}, seasonId: ${seasonId}, pagenum: ${pagenum}, stack: ${error.stack}`
    );
    return null;
  }
}

async function getManySeasonsOneArchivePageHtml(seasonIds) {
  try {
    const timestamp = provider.createLongTimestamp();
    const urls = seasonIds.map((seasonId) => {
      const pagenum = 1;
      return `https://fb.oddsportal.com/ajax-sport-country-tournament-archive/1/${seasonId}/X218120706X24616X0X0X0X0X0X0X0X0X0X0X8388608X0X512/1/1/${pagenum}/?_=${timestamp}`;
    });
    const results = await provider.getMany(urls);
    assert(results.success, 'results.success falsey');

    return results.data.map((item) => item.response.data);
  } catch (error) {
    log.error(
      `getManySeasonsOneArchivePageHtml exception: ${error}, seasonIds: ${seasonIds}, stack: ${error.stack}`
    );
    return null;
  }
}

async function getSeasonInfoFromSeasonPages(seasonPageLinks) {
  const urls = seasonPageLinks.map((item) => item.url);

  const seasonPages = await provider.getMany(urls);
  assert(seasonPages.success, 'seasonPages.success falsey');

  const seasonIds = [];
  seasonPages.data.forEach((obj, index) => {
    const htmltext = obj.response.data;
    const seasonId = parser.parseSeasonIdFromSeasonPage(htmltext);
    assert(seasonId, 'seasonId falsey');
    seasonIds.push(seasonId);
  });

  const manySeasonsArchivePageHtml = await getManySeasonsOneArchivePageHtml(
    seasonIds
  );

  const seasons = [];

  manySeasonsArchivePageHtml.forEach((htmltext, index) => {
    const bookies = parser.parseNumberOfBookies(htmltext, { minmax: true });
    assert(bookies.length === 3, 'parseNumberOfBookies !== 3');

    const numBookies = bookies[0];

    const year = seasonPageLinks[index].year;

    const pagination = parser.parsePaginationFromSeasonArchive(htmltext);
    const numEvents = pagination.lastPage * 50;

    const url = urls[index];

    seasons.push({ url, year, numEvents, numBookies });
  });

  return seasons;
}
