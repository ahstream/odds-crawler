'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const crawlerQueue = require('./crawlerQueue.js');
const dataWriter = require('./dataWriter.js');
const marketoddslib = require('./marketOdds.js');
const scorelib = require('./score.js');
const feedlib = require('./feed.js');
const betlib = require('./bet.js');
const divisionlib = require('./division.js');
const parser = require('./parser');
const provider = require('./provider');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export async function getEventFromWebPage(url, season) {
  try {
    // Example: https://www.oddsportal.com/soccer/england/premier-league/aston-villa-tottenham-2eapRfIm/

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    const event = parseAndValidateBaseEvent(url, htmltext, season);
    assert(event, 'Failed parseAndValidateBaseEvent');

    processParams(event, htmltext);
    assert(event.paramsOk, 'Failed processParams');

    await processScore(event);
    assert(event.scoreOk, 'Failed processScore');

    processBaseEvent(event);
    // From here event is complete with base data!

    event.bettingTypes = await betlib.getBettingTypes(event);
    assert(event.bettingTypes, 'Failed betlib.getBettingTypes');

    // todo: skip ignored bet types and bookies!

    // only process odds for proper events!
    if (event.status !== 'finished' || event.status !== 'scheduled') {
      return event;
    }

    const feedsResult = await feedlib.processAsyncFeeds(event);
    assert(feedsResult, 'Failed feedlib.processAsyncFeeds');

    event.hasOdds = _.isEmpty(event.odds) == false;
    if (event.hasOdds) {
      marketoddslib.updateMarketOdds(event);
    }

    event.ok = true;

    // log.verbose(event);

    return event;
  } catch (error) {
    log.error('event.getEventFromWebPage exception:', error);
    log.verbose(`event.getEventFromWebPage exception: stack: ${error.stack}`);
    return { error: error.message };
  }
}

export async function crawlEvent(url, divisionCode, season, { addToQueue = false, skipDups = config.skipDuplicatedEvents }) {
  try {
    log.debug(`Start crawling event: ${url}`);

    const options = { addToQueue, skipDups };

    if (options.skipDups && dataWriter.eventExistInFile(url, divisionCode)) {
      return createEvent({ isDuplicate: true });
    }

    log.debug(`Sleep ${config.delayBetweenCrawledEvents} ms before crawling event...`);
    await utilslib.sleep(config.delayBetweenCrawledEvents);

    const event = await getEventFromWebPage(url, season);

    if (event.isDuplicate) {
      // do nothing!
    }
    if (event.ok) {
      dataWriter.writeToEventFile(event.event, divisionCode);
    }
    if (event.hasOdds) {
      dataWriter.writeToOddsFile(event.odds, divisionCode);
      dataWriter.writeToHistoryFile(event.history, divisionCode);
      dataWriter.writeToMarketFile(event.market, divisionCode);
      dataWriter.writeToMarketResultFile(event.marketResult, divisionCode);
      dataWriter.writeToMarketOddsFile(event.marketOdds, divisionCode);
    }
    if (!event.ok && options.addToQueue) {
      log.info(`Add failed event to crawler queue!`);
      crawlerQueue.addEventToQueue(url, divisionCode, season, { comment: event.error });
    }

    log.debug(`End crawl event: ${url}`);

    return event;
  } catch (error) {
    log.error(`event.crawlEvent exception: ${error}, url: ${url}`);
    log.verbose(`event.crawlEvent exception stack: ${error.stack}`);
    return { error: error.message };
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function parseAndValidateBaseEvent(url, htmltext, fallbackSeason) {
  const divisionData = divisionlib.parseDivisionData(url, htmltext, fallbackSeason);
  if (!divisionData) {
    return null;
  }

  if (!divisionlib.validateDivisionData(divisionData, url)) {
    log.error('Mis-matching division data between web page and URL!');
    return null;
  }

  const parsedUrl = parser.parseUrl(url);
  assert(parsedUrl.eventId, 'parsedUrl.eventId falsey');
  assert(parsedUrl.event, 'parsedUrl.event falsey');

  return createEvent({
    id: parsedUrl.eventId,
    name: parsedUrl.event,
    sport: parsedUrl.sport,
    country: parsedUrl.country,
    division: divisionData.division,
    divisionCode: parsedUrl.divisionCode,
    divisionCodeName: parsedUrl.divisionCodeName,
    season: divisionData.season,
    url
  });
}

function processParams(event, htmltext) {
  const params = parseParams(event, htmltext);
  assert(params.ok, 'Failed parseParams');

  event.idOk = event.id == params.id;

  event.sportId = params.sportId;
  event.tournamentId = params.tournamentId;
  event.home = params.home;
  event.away = params.away;
  event.isLive = params.isLive;
  event.isPostponed = params.isPostponed;
  event.isStarted = params.isStarted;
  event.isFinished = params.isFinished;
  event.xhash = params.xhash;
  event.xhashf = params.xhashf;
  event.ukeyBase = params.ukeyBase;
  event.versionId = params.versionId;

  event.paramsOk = true;
}

async function processScore(event) {
  const score = await scorelib.parseScore(event.id, event.name, event.url, event.xhash);
  assert(score.ok, 'Failed scorelib.parseScore');

  event.startTime = score.startTime;
  event.startTimeDate = score.startTimeDate;
  event.status = score.status;
  event.sc1_1 = score.sc1_1;
  event.sc1_2 = score.sc1_2;
  event.sc2_1 = score.sc2_1;
  event.sc2_2 = score.sc2_2;
  event.sc3_1 = score.sc3_1;
  event.sc3_2 = score.sc3_2;
  event.sc4_1 = score.sc4_1;
  event.sc4_2 = score.sc4_2;
  event.sc2_1 = score.sc2_1;
  event.sc2_2 = score.sc2_2;
  event.sc98_1 = score.sc98_1;
  event.sc98_2 = score.sc98_2;
  event.sc99_1 = score.sc99_1;
  event.sc99_2 = score.sc99_2;
  event.hasFullTimeScore = score.hasFullTimeScore;
  event.hasPartTimeScore = score.hasPartTimeScore;
  event.isOT = score.isOT;
  event.isPenalties = score.isPenalties;
  event.ptScores = score.ptScores;

  event.scoreOk = true;
}

function processBaseEvent(event) {
  event.event = {};
  const ptr = event.event;

  ptr.id = event.id;
  ptr.status = event.status;

  ptr.iStarted = event.isStarted;
  ptr.isFinished = event.isFinished;
  ptr.isPostponed = event.isPostponed;

  ptr.hasFullTimeScore = event.hasFullTimeScore;
  ptr.hasPartTimeScore = event.hasPartTimeScore;
  ptr.isOT = event.isOT;
  ptr.isPenalties = event.isPenalties;

  ptr.sport = event.sport;
  ptr.sportId = event.sportId;
  ptr.country = event.country;
  ptr.countryId = event.countryId;
  ptr.division = event.division;
  ptr.divisionId = event.divisionId;
  ptr.tournamentId = event.tournamentId;
  ptr.season = event.season;

  ptr.startTime = event.startTime;
  ptr.startTimeDate = event.startTimeDate;

  ptr.team_1 = event.home;
  ptr.team_2 = event.away;

  ptr.ptScores = event.ptScores;

  ptr.sc1_1 = event.sc1_1;
  ptr.sc1_2 = event.sc1_2;
  ptr.sc2_1 = event.sc2_1;
  ptr.sc2_2 = event.sc2_2;

  ptr.sc3_1 = event.sc3_1;
  ptr.sc3_2 = event.sc3_2;
  ptr.sc4_1 = event.sc4_1;
  ptr.sc4_2 = event.sc4_2;

  ptr.sc98_1 = event.sc98_1;
  ptr.sc98_2 = event.sc98_2;
  ptr.sc99_1 = event.sc99_1;
  ptr.sc99_2 = event.sc99_2;

  ptr.xhash = event.xhash;
  ptr.xhashf = event.xhashf;
  ptr.ukeyBase = event.ukeyBase;
  ptr.versionId = event.versionId;

  ptr.url = event.url;
}

function parseParams(event, htmltext, options = {}) {
  log.debug(`Parse event params for event: ${event.name}`);

  const params = createParams(options);

  const reParams = /new PageEvent\(({[^}]*})\)/im;
  const scrapedParams = htmltext.match(reParams);
  if (!scrapedParams || scrapedParams.length != 2) {
    log.error(`Failed to scrape event params for event: ${event.url}`);
    return params;
  }

  const parsedParams = JSON.parse(scrapedParams[1]);
  try {
    params.id = parsedParams.id;
    params.xhash = decodeURIComponent(parsedParams.xhash);
    params.xhashf = decodeURIComponent(parsedParams.xhashf);
    params.ukeyBase = parsedParams.ukeyBase;
    params.isLive = parsedParams.isLive;
    params.isPostponed = parsedParams.isPostponed;
    params.isStarted = parsedParams.isStarted;
    params.isFinished = parsedParams.isFinished;
    params.isFinishedGracePeriod = parsedParams.isFinishedGracePeriod;
    params.sportId = parsedParams.sportId;
    params.versionId = parsedParams.versionId;
    params.home = parsedParams.home;
    params.away = parsedParams.away;
    params.tournamentId = parsedParams.tournamentId;
  } catch (error) {
    log.error(`Failed to parse json params for event: ${event.url}, error: ${error}`);
    return params;
  }

  params.ok = true;

  return params;
}

function createEvent(options = {}) {
  const data = {
    ok: false,
    error: null,

    isDuplicate: false,
    hasOdds: false,

    id: null,
    idOk: null,

    status: null,
    isLive: null,
    isPostponed: null,
    isStarted: null,
    isFinished: null,

    startTime: null,
    startTimeDate: null,

    name: null,
    sport: null,
    sportId: null,
    country: null,
    countryId: null,
    divisionCode: null,
    divisionCodeName: null,
    division: null,
    divisionId: null,
    tournamentId: null,
    season: null,

    home: null,
    away: null,

    paramsOk: null,

    scoreOk: null,
    hasFullTimeScore: null,
    hasPartTimeScore: null,
    isOT: null,
    isPenalties: null,
    ptScores: null,
    sc1_1: null,
    sc1_2: null,
    sc2_1: null,
    sc2_2: null,
    sc3_1: null,
    sc3_2: null,
    sc4_1: null,
    sc4_2: null,
    sc98_1: null,
    sc98_2: null,
    sc99_1: null,
    sc99_2: null,

    xhash: null,
    xhashf: null,
    ukeyBase: null,
    versionId: null,
    url: null,

    bettingTypes: null,

    event: {},
    market: {},
    marketResult: {},
    marketOdds: {},
    odds: {},
    history: {}
  };

  return { ...data, ...options };
}

function createParams(options = {}) {
  const data = {
    ok: false,
    id: null,
    xhash: null,
    xhashf: null,
    ukeyBase: null,
    isLive: null,
    isPostponed: null,
    isStarted: null,
    isFinished: null,
    isFinishedGracePeriod: null,
    sportId: null,
    versionId: null,
    home: null,
    away: null,
    tournamentId: null
  };

  return { ...data, ...options };
}
