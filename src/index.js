'use strict';

// DECLARES -----------------------------------------------------------------------------

const utils = require('./lib/utils');
const fileUtils = require('./lib/fileUtils');
const log = require('./lib/logUtils');
const httpUtils = require('./lib/httpUtils');
const config = require('./config/config.json');
const tools = require('./tools');
const fs = require('fs');
const bookmakers = require('./bookies');

// FUNCTIONS -----------------------------------------------------------------------------

function createDebugEvent(event) {
  const target = Object.assign({}, event);
  delete target.html;
  delete target.odds;
  return target;
}

async function createEvent(url, refererUrl) {
  log.debug('Start of createEvent()');
  const event = {};

  // event.feed = {};
  event.odds = {};
  event.oddsData = {};
  event.betOutcomes = {};

  event.url = url;
  event.refererUrl = refererUrl;
  event.httpRequestConfig = tools.createHttpRequestConfig(refererUrl);

  event.timestamp = tools.createLongTimestamp();

  event.html = await httpUtils.getResponseData(url, event.httpRequestConfig);

  event.params = createEventParams(event);
  event.score = await createEventScore(event);

  createMatchData(event);

  //const feedData = await getFeedData(event, config.bettingTypes['1X2'], config.scopes['FT']);
  await createEventBettingTypes(event);
  //createEventOdds(event, feedData);

  // createEventOdds(event, await getFeedData(event, config.bettingTypes['O/U'], config.scopes['FT']));

  // todo: add outcome result for all odds feeds!

  await getAllFeeds(event);

  createMatchData(event);

  log.debug('End of createEvent()');

  return event;
}

function getDivisionData(event) {
  const divisionData = {};

  const scrapedParams = scrapeUtils.matchText(
    event.html,
    /<h2 class=\"out\">You are here<\/h2>[^<]*<[^>]*>Home<\/a>[^<]*<a href=\"\/[^\/]*\/\">([^<]*)<\/a>[^<]*<a href=\"[^\"]*\">([^<]*)<\/a>[^<]*<a href=\"[^\"]*\">([^<]*)<\/a>/im
  );

  divisionData.sportName = scrapedParams[1].trim();
  divisionData.countryName = scrapedParams[2].trim();

  const divisionSeason = scrapedParams[3];
  const scrapedDivisionWithTwoYears = scrapeUtils.matchText(divisionSeason, /(.*)([0-9]{4})\/([0-9]{4})/im);
  if (scrapedDivisionWithTwoYears.length === 4) {
    divisionData.divisionName = scrapedDivisionWithTwoYears[1].trim();
    divisionData.season = parseInt(scrapedDivisionWithTwoYears[3], 10);
  } else {
    const scrapedDivisionWithOneYear = scrapeUtils.matchText(divisionSeason, /(.*)([0-9]{4})/im);
    if (scrapedDivisionWithOneYear.length === 3) {
      divisionData.divisionName = scrapedDivisionWithTwoYears[1].trim();
      divisionData.season = parseInt(scrapedDivisionWithTwoYears[2], 10);
    }
  }

  return divisionData;
}

function createMatchData(event) {
  event.matchData = {};
  event.matchData.id = event.params.id;

  event.matchData.startTime = event.score.startTime;

  const divisionData = getDivisionData(event);

  event.matchData.sportId = event.params.sportId;
  event.matchData.sportName = divisionData.sportName;
  event.matchData.countryName = divisionData.countryName;
  event.matchData.divisionName = divisionData.divisionName;
  event.matchData.season = divisionData.season;

  event.matchData.isStarted = event.params.isStarted;
  event.matchData.isFinished = event.params.isFinished;

  event.matchData.home = event.params.home;
  event.matchData.away = event.params.away;
  event.matchData.homeGoals = event.score.homeGoals;
  event.matchData.awayGoals = event.score.awayGoals;
  event.matchData.homeGoalsH1 = event.score.homeGoalsH1;
  event.matchData.awayGoalsH1 = event.score.awayGoalsH1;
  event.matchData.homeGoalsH2 = event.score.homeGoalsH2;
  event.matchData.awayGoalsH2 = event.score.awayGoalsH2;

  event.matchData.xhash = event.params.xhash;
  event.matchData.xhashf = event.params.xhashf;
  event.matchData.ukeyBase = event.params.ukeyBase;
  event.matchData.isPostponed = event.params.isPostponed;
  event.matchData.versionId = event.params.versionId;
  event.matchData.tournamentId = event.params.tournamentId;

  event.matchData.url = event.url;
}

async function getAllFeeds(event) {
  const feedsToFetch = new Array();
  Object.keys(config.bettingTypes).forEach(function (bettingTypeKey, _bettingTypeIndex) {
    Object.keys(config.scopes).forEach(function (scopeKey, _scopeIndex) {
      feedsToFetch.push({ bettingTypeId: config.bettingTypes[bettingTypeKey].id, scopeId: config.scopes[scopeKey].id });
    });
  });
  for (let index = 0; index < feedsToFetch.length; index++) {
    const feed = await getFeedData(event, feedsToFetch[index].bettingTypeId, feedsToFetch[index].scopeId);
    createEventOdds(event, feed);
    await utils.sleep(50);
  }
}

function createEventParams(event) {
  const scrapedParams = scrapeUtils.matchText(event.html, /new PageEvent\(({[^}]*})\)/im);
  const jsonParams = JSON.parse(scrapedParams[1]);
  jsonParams.xhash = decodeURIComponent(jsonParams.xhash);
  jsonParams.xhashf = decodeURIComponent(jsonParams.xhashf);

  return jsonParams;
}

async function createEventScore(event) {
  const timestamp = tools.createLongTimestamp();
  const url = `https://fb.oddsportal.com/feed/postmatchscore/1-${event.params.id}-${event.params.xhash}.dat?_=${timestamp}`;
  const htmlResult = await httpUtils.getResponseData(url, event.httpRequestConfig);

  const scrapedScore = scrapeUtils.matchText(htmlResult, /"d":({[^}]*})/im);
  const jsonScore = JSON.parse(scrapedScore[1]);

  const scrapedResult = scrapeUtils.matchText(
    jsonScore.result,
    /\<strong\>([0-9]+)\:([0-9]+)\<\/strong\> \(([0-9]+)\:([0-9]+)\, ([0-9]+)\:([0-9]+)\)/im
  );

  return {
    startTime: new Date(jsonScore.startTime * 1000),
    homeGoals: parseInt(scrapedResult[1], 10),
    awayGoals: parseInt(scrapedResult[2], 10),
    homeGoalsH1: parseInt(scrapedResult[3], 10),
    awayGoalsH1: parseInt(scrapedResult[4], 10),
    homeGoalsH2: parseInt(scrapedResult[5], 10),
    awayGoalsH2: parseInt(scrapedResult[6], 10)
  };
}

async function createEventBettingTypes(event) {
  const feedData = await getFeedData(event, config.bettingTypes['1X2'].id, config.scopes['FT'].id);
  const bettingTypes = {};
  Object.keys(feedData.nav).forEach(function (bettingTypeKey, _index) {
    utils.ensureProperty(bettingTypes, bettingTypeKey);
    Object.keys(feedData.nav[bettingTypeKey]).forEach(function (scopeKey, _scopeIndex) {
      bettingTypes[bettingTypeKey][scopeKey] = feedData.nav[bettingTypeKey][scopeKey].length;
    });
  });
  event.bettingTypes = bettingTypes;
}

function createEventOdds(event, feed) {
  // {BettingType}-{Scope}-{back|lay}-{HandicapOrValue}-{Outcome}-{Bookie}:

  const bettingTypeKey = feed.bt.toString();
  const scopeKey = feed.sc.toString();

  utils.ensureProperty(event.odds, bettingTypeKey);
  utils.ensureProperty(event.odds[bettingTypeKey], scopeKey);
  const eventData = event.odds[bettingTypeKey][scopeKey];

  Object.keys(feed.oddsdata).forEach(function (backOrLayKey, _index) {
    utils.ensureProperty(eventData, backOrLayKey);
    processBackOrLay(event, eventData[backOrLayKey], feed.oddsdata[backOrLayKey], feed.bt, feed.sc);
  });
}

function processBackOrLay(event, eventData, feedData, bt, sc) {
  const bets = new Array();
  Object.keys(feedData).forEach(function (betKey, _index) {
    const isMixedParameter = feedData[betKey].mixedParameterId > 0;
    const betAttribute = feedData[betKey].mixedParameterName || feedData[betKey].handicapValue;
    bets.push({ betKey, betAttribute, isMixedParameter });
  });
  bets.sort((b1, b2) => {
    const attr1 = b1.betAttribute;
    const attr2 = b2.betAttribute;
    if (b1.isMixedParameter) {
      return attr1 < attr2 ? -1 : attr2 > attr1 ? 1 : 0;
    } else {
      const n1 = Number(attr1);
      const n2 = Number(attr2);
      return n1 < n2 ? -1 : n2 > n1 ? 1 : 0;
    }
  });

  bets.forEach(function ({ betKey, _betAttribute, _isMixedParameter }) {
    const isBack = feedData[betKey].isBack;
    const betAttribute = feedData[betKey].mixedParameterName || feedData[betKey].handicapValue;
    utils.ensureProperty(eventData, betAttribute);
    processBet(event, eventData[betAttribute], feedData[betKey], bt, sc, isBack, betAttribute);
  });
}

function processBet(event, eventData, feedData, bt, sc, isBack, betAttribute) {
  // {BettingType}-{Scope}-{back|lay}-{Attribute}-{Outcome}-{Bookie}:
  calculateBetOutcome(event, eventData, feedData, bt, sc, isBack, betAttribute);
  Object.keys(feedData.OutcomeID).forEach(function (outcomeKey, _outcomeIndex) {
    utils.ensureProperty(eventData, outcomeKey);
    processOutcome(event, eventData, feedData, outcomeKey, bt, sc, isBack, betAttribute);
  });
}

function calculateBetOutcome(event, eventData, feedData, bt, sc, isBack, betAttribute) {
  const betKey = bt.toString() + '_' + sc.toString() + '_' + (isBack ? 'back' : 'lay') + '_' + betAttribute;
  event.betOutcomes[betKey] = null;
}

function processOutcome(event, eventData, feedData, outcomeKey, bt, sc, isBack, betAttribute) {
  processOpeningOrClosingOdds(true, event, eventData, feedData, outcomeKey, bt, sc, isBack, betAttribute);
  processOpeningOrClosingOdds(false, event, eventData, feedData, outcomeKey, bt, sc, isBack, betAttribute);
}

function processOpeningOrClosingOdds(isOpening, event, eventData, feedData, outcomeKey, bt, sc, isBack, betAttribute) {
  const oddsPointer = isOpening ? feedData.opening_odds : feedData.odds;
  const datePointer = isOpening ? feedData.opening_change_time : feedData.change_time;
  const volumePointer = isOpening ? feedData.opening_volume : feedData.volume;

  Object.keys(oddsPointer).forEach(function (bookieKey, _index) {
    const realOutcome = parseInt(outcomeKey, 10) + 1;
    const realOutcomeKey = realOutcome.toString();
    const betKey =
      bt.toString() + '_' + sc.toString() + '_' + (isBack ? 'back' : 'lay') + '_' + betAttribute + '_' + realOutcomeKey + '_' + bookieKey;

    if (typeof event.oddsData[betKey] === 'undefined') {
      event.oddsData[betKey] = {};
      event.oddsData[betKey].eventId = event.params.id;
      event.oddsData[betKey].bt = bt;
      event.oddsData[betKey].sc = sc;
      event.oddsData[betKey].isBack = isBack;
      event.oddsData[betKey].attribute = betAttribute;
      event.oddsData[betKey].bookie = parseInt(bookieKey, 10);
      event.oddsData[betKey].outcome = realOutcome;
      event.oddsData[betKey].openingOdds = null;
      event.oddsData[betKey].openingDate = null;
      event.oddsData[betKey].openingVolume = 0;
      event.oddsData[betKey].closingOdds = null;
      event.oddsData[betKey].closingDate = null;
      event.oddsData[betKey].closingVolume = 0;
    }

    if (isOpening) {
      event.oddsData[betKey].openingOdds = oddsPointer[bookieKey][outcomeKey];
      event.oddsData[betKey].openingDate = datePointer[bookieKey][outcomeKey];
      event.oddsData[betKey].openingVolume =
        volumePointer[bookieKey] && volumePointer[bookieKey][outcomeKey] ? volumePointer[bookieKey][outcomeKey] : 0;
    } else {
      event.oddsData[betKey].closingOdds = oddsPointer[bookieKey][outcomeKey];
      event.oddsData[betKey].closingDate = datePointer[bookieKey][outcomeKey];
      event.oddsData[betKey].closingVolume =
        volumePointer[bookieKey] && volumePointer[bookieKey][outcomeKey] ? volumePointer[bookieKey][outcomeKey] : 0;
    }

    if (typeof eventData[outcomeKey][bookieKey] === 'undefined') {
      eventData[outcomeKey][bookieKey] = {};
      eventData[outcomeKey][bookieKey].openingOdds = null;
      eventData[outcomeKey][bookieKey].openingDate = null;
      eventData[outcomeKey][bookieKey].openingVolume = 0;
      eventData[outcomeKey][bookieKey].closingOdds = null;
      eventData[outcomeKey][bookieKey].closingDate = null;
      eventData[outcomeKey][bookieKey].closingVolume = 0;
    }

    if (isOpening) {
      eventData[outcomeKey][bookieKey].openingOdds = oddsPointer[bookieKey][outcomeKey];
      eventData[outcomeKey][bookieKey].openingDate = datePointer[bookieKey][outcomeKey];
      eventData[outcomeKey][bookieKey].openingVolume =
        volumePointer[bookieKey] && volumePointer[bookieKey][outcomeKey] ? volumePointer[bookieKey][outcomeKey] : 0;
    } else {
      eventData[outcomeKey][bookieKey].closingOdds = oddsPointer[bookieKey][outcomeKey];
      eventData[outcomeKey][bookieKey].closingDate = datePointer[bookieKey][outcomeKey];
      eventData[outcomeKey][bookieKey].closingVolume =
        volumePointer[bookieKey] && volumePointer[bookieKey][outcomeKey] ? volumePointer[bookieKey][outcomeKey] : 0;
    }
  });
}

async function getFeedData(event, bettingTypeId, scopeId) {
  log.debug('Get feed:', bettingTypeId, scopeId);

  const timestamp = tools.createLongTimestamp();
  const url = `https://fb.oddsportal.com/feed/match/1-1-${event.params.id}-${bettingTypeId}-${scopeId}-${event.params.xhash}.dat?_=${timestamp}`;
  const htmlResult = await httpUtils.getResponseData(url, event.httpRequestConfig);

  const scrapedFeed = scrapeUtils.matchText(htmlResult, /^globals.jsonpCallback\('[^']*'\, (\{.*refresh"\:[0-9]+\})\)\;/im);
  const jsonFeed = JSON.parse(scrapedFeed[1]);

  return jsonFeed.d;
}

async function parseEvent(url, refererUrl, matchFile, oddsFile) {
  const event = await createEvent(url, refererUrl);
  const debugEvent = createDebugEvent(event);

  fileUtils.appendJsonDataToCsvFile({ data: debugEvent.matchData }, matchFile);
  fileUtils.appendJsonDataToCsvFile(debugEvent.oddsData, oddsFile);
  await utils.sleep(1);
}

async function parseEvents(url, matchFile, oddsFile) {
  const httpRequestConfig = tools.createHttpRequestConfig();
  const html = await httpUtils.getResponseData(url, httpRequestConfig);

  const scrapedFeed = scrapeUtils.matchText(htmlResult, /^globals.jsonpCallback\('[^']*'\, (\{.*refresh"\:[0-9]+\})\)\;/im);
  const jsonFeed = JSON.parse(scrapedFeed[1]);

  const event = await createEvent(url, refererUrl);
  const debugEvent = createDebugEvent(event);

  fileUtils.appendJsonDataToCsvFile({ data: debugEvent.matchData }, matchFile);
  fileUtils.appendJsonDataToCsvFile(debugEvent.oddsData, oddsFile);
  await utils.sleep(1);
}

const referer = 'https://www.oddsportal.com/';
const url = 'https://www.oddsportal.com/soccer/england/premier-league-2019-2020/arsenal-watford-2JDks1o7/';
// const regexp5 = /new PageEvent\(({[^}]*})\)/im;
parseEvent(url, referer, 'matches.csv', 'odds.csv');
// bookmakers.getBookmakers();
console.dir('after run!');
