'use strict';

import { times } from 'lodash';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const httplib = require('./lib/httplib');
const crawlerQueue = require('./crawlerQueue.js');
const dataWriter = require('./dataWriter.js');
const marketlib = require('./market.js');
const bookielib = require('./bookie.js');
const tools = require('./tools');
const parser = require('./parser');
const provider = require('./provider');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

const httpRequestConfig = tools.createHttpRequestConfig();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

function processStatus(event) {
  if (event.score.status === 'canceled') {
    return 'Canceled';
  } else if (event.score.status === 'postponed') {
    return 'Postponed';
  } else if (event.score.status === 'awarded') {
    return 'Awarded';
  } else if (event.score.status === 'finished') {
    return 'Finished';
  } else {
    // TODO: Kolla scheduled events!
    log.error(`Unknown event.score.status: ${event.score.status}, url: ${event.url}`);
    log.verbose('event.score:', event.score);
    return null;
  }
}

export async function getEventFromWebPage(url, season) {
  try {
    // Example: https://www.oddsportal.com/soccer/england/premier-league/aston-villa-tottenham-2eapRfIm/

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    const parsedUrl = parser.parseUrl(url);

    const sport = parsedUrl.sport;
    const country = parsedUrl.country;
    const divisionCode = parsedUrl.divisionCode;
    const divisionCodeName = parsedUrl.divisionCodeName;

    const event = createEvent({ url, sport, country, divisionCode, divisionCodeName, season });

    event.name = parsedUrl.event;
    assert(event.name, 'event.name falsey');

    event.params = parseParams(event, htmltext);
    assert(event.params.ok, 'event.params.ok falsey');

    event.id = event.params.id;

    event.score = await parseScore(event);
    assert(event.score.ok, 'event.score.ok falsey');

    event.info = parseInfo(event, htmltext);
    assert(event.info, 'event.info falsey');

    event.bettingTypes = await getBettingTypes(event);
    assert(event.bettingTypes, 'event.bettingTypes falsey');

    // todo: skip ignored bet types and bookies!

    if (event.score.hasFullTimeScore) {
      const feedsResult = await processAsyncFeeds(event);
      assert(feedsResult.ok, 'feedsResult.ok falsey');
      event.hasOdds = true;
      updateMarketOdds(event);
    } else {
      log.debug('Skip getting odds for events with no fulltime score!');
    }

    event.ok = true;

    return event;
  } catch (error) {
    log.error(`event.getEventFromWebPage exception: ${error}, url: ${url}`);
    log.verbose(`event.getEventFromWebPage exception: stack: ${error.stack}`);
    return { error: error.message };
  }
}

export async function crawlEvent(url, divisionCode, season, { addToQueue = false, skipDups = config.skipDuplicatedEvents }) {
  try {
    log.debug(`Start crawling event: ${url}`);

    const options = { addToQueue, skipDups };

    if (options.skipDups && dataWriter.eventExistInFile(url, divisionCode)) {
      return createEvent({ duplicate: true });
    }

    log.debug(`Sleep ${config.delayBetweenCrawledEvents} ms before crawling event...`);
    await utilslib.sleep(config.delayBetweenCrawledEvents);

    const event = await getEventFromWebPage(url, season);

    if (event.duplicate) {
      // do nothing!
    }
    if (event.ok) {
      dataWriter.writeToEventFile(event.info, divisionCode);
    }
    if (event.hasOdds) {
      dataWriter.writeToOddsFile(event.odds, divisionCode);
      dataWriter.writeToMarketOddsFile(event.marketOdds, divisionCode);
      dataWriter.writeToMarketFile(event.market, divisionCode);
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

// FEEDS

async function processAsyncFeeds(event) {
  log.debug(`Process async feeds for event: ${event.name}`);

  const feedsToFetch = new Array();
  Object.keys(event.bettingTypes).forEach(function (bettingTypeKey, _bettingTypeIndex) {
    Object.keys(event.bettingTypes[bettingTypeKey]).forEach(function (scopeKey, _scopeIndex) {
      const bt = bettingTypeKey;
      const sc = scopeKey;
      // todo: ignore ointressanta bt/sc
      feedsToFetch.push({ bt, sc });
    });
  });
  if (feedsToFetch.length <= 0) {
    log.error(`No feeds found for event: ${event.url}`);
    return respondError('No feeds found for event');
  }

  log.debug('Num of feeds to get:', feedsToFetch.length);

  const urls = [];
  for (let i = 0; i < feedsToFetch.length; i++) {
    const bt = feedsToFetch[i].bt;
    const sc = feedsToFetch[i].sc;
    const timestamp = provider.createLongTimestamp();

    if (event.score.hasPartTimeScore === false && (sc == 3 || sc == 4)) {
      log.debug('Skip part time market because no part time score exists!');
      continue;
    }

    const url = `https://fb.oddsportal.com/feed/match/1-1-${event.id}-${bt}-${sc}-${event.params.xhash}.dat?_=${timestamp}`;
    urls.push(url);
  }

  const results = await provider.getMany(urls);

  if (!results.success) {
    log.error(`Failed to get URL feeds: ${event.url}`);
    return respondError('Failed to get URL feeds');
  }

  try {
    for (let i = 0; i < results.data.length; i++) {
      const response = results.data[i].response;
      const feed = getFeedByHtml(event, response.data);
      if (feed === null) {
        log.error(`Failed to get feed by html for event: ${event.url}`);
        return respondError('Failed to get feed by html');
      }
      if (!processFeed(event, feed)) {
        return respondError('Failed processFeed()');
      }
    }
  } catch (error) {
    log.error(`Failed getting all feeds for event: ${event.url}`);
    log.verbose('Feeds error:', error);
    return respondError('Exception when getting all feeds');
  }

  return respondOk();
}

async function processAsyncFeeds0(event) {
  log.debug(`Process async feeds for event: ${event.name}`);

  const feedsToFetch = new Array();
  Object.keys(event.bettingTypes).forEach(function (bettingTypeKey, _bettingTypeIndex) {
    Object.keys(event.bettingTypes[bettingTypeKey]).forEach(function (scopeKey, _scopeIndex) {
      const bt = bettingTypeKey;
      const sc = scopeKey;
      feedsToFetch.push({ bt, sc });
    });
  });
  if (feedsToFetch.length <= 0) {
    log.error(`No feeds found for event: ${event.url}`);
    return respondError('No feeds found for event');
  }

  log.debug('Num of feeds to get:', feedsToFetch.length);

  const promises = [];
  for (let i = 0; i < feedsToFetch.length; i++) {
    const bt = feedsToFetch[i].bt;
    const sc = feedsToFetch[i].sc;
    const timestamp = provider.createLongTimestamp();

    if (event.score.hasPartTimeScore === false && (sc == 3 || sc == 4)) {
      log.debug('Skip part time market because no part time score exists!');
      continue;
    }

    const url = `https://fb.oddsportal.com/feed/match/1-1-${event.id}-${bt}-${sc}-${event.params.xhash}.dat?_=${timestamp}`;
    promises.push(httplib.get(url, httpRequestConfig));
  }

  log.debug(`Send request for ${promises.length} feeds at once...`);
  try {
    const result = await Promise.all(promises);
    log.debug('All feeds received!');
    for (let i = 0; i < result.length; i++) {
      const response = result[i];
      if (!httplib.isSuccess(response)) {
        log.error(`Failed to get URL feed data: ${event.url}`);
        tools.logHttpRequestError(response, event.url);
        return respondError('Failed to get URL feed data');
      }

      const feed = getFeedByHtml(event, response.data);
      if (feed === null) {
        log.error(`Failed to get feed by html for event: ${event.url}`);
        return respondError('Failed to get feed by html');
      }

      if (!processFeed(event, feed)) {
        return respondError('Failed processFeed()');
      }
    }
  } catch (error) {
    log.error(`Failed getting all feeds for event: ${event.url}`);
    log.verbose('Feed promise.all() error:', error);
    return respondError('Exception when getting all feeds');
  }

  return respondOk();
}

function getFeedByHtml(event, htmltext) {
  log.debug(`Get feed by html for event: ${event.name}`);

  const reFeed = /^globals.jsonpCallback\('[^']*'\, (\{.*refresh"\:[0-9]+\})\)\;/im;
  const scrapedFeed = htmltext.match(reFeed);
  if (!scrapedFeed || scrapedFeed.length != 2) {
    log.error(`Failed to scrape feed for event: ${event.url}`);
    log.verbose(htmltext);
    return null;
  }

  const feed = JSON.parse(scrapedFeed[1]);
  if (!feed) {
    log.error(`Failed to parse scraped feed for event: ${event.url}, feed: ${feed}`);
    log.verbose(feed);
    return null;
  }

  if (!feed.d) {
    log.error(`Failed to parse scraped feed d property for event: ${event.url}, feed: ${feed}`);
    log.verbose(feed);
    return null;
  }
  const feedData = feed.d;

  return feedData;
}

async function getFeedByUrl(event, bt, sc) {
  log.debug(`Get feed by url for bt: ${bt}, sc: ${sc}, event: ${event.name}`);

  const timestamp = provider.createLongTimestamp();
  const url = `https://fb.oddsportal.com/feed/match/1-1-${event.id}-${bt}-${sc}-${event.params.xhash}.dat?_=${timestamp}`;

  const response = await provider.httpGetResponse(url, {});
  const htmltext = response.data;

  return getFeedByHtml(event, htmltext);
}

function processFeed(event, feed) {
  log.debug(`Create event odds for event: ${event.name}, bt: ${feed.bt}, sc: ${feed.sc}`);

  if (feed.bt === undefined || feed.sc === undefined) {
    log.error(`Corrupt feed for event: ${event.name}`);
    log.verbose(feed);
    return false;
  }

  Object.keys(feed.oddsdata).forEach(function (backOrLayKey, _index) {
    processBackOrLay(event, feed.oddsdata[backOrLayKey], backOrLayKey, feed.bt, feed.sc);
  });

  return true;
}

// PROCESS

function processBackOrLay(event, feedSrc, backOrLayKey, bt, sc) {
  log.debug(`Process ${backOrLayKey} bets for bt: ${bt}, sc: ${sc}`);

  const bets = new Array();
  Object.keys(feedSrc).forEach(function (betKey, _index) {
    const isMixedParameter = feedSrc[betKey].mixedParameterId > 0;
    const attribute = feedSrc[betKey].mixedParameterName || feedSrc[betKey].handicapValue;
    const isBack = feedSrc[betKey].isBack;
    bets.push({ betKey, attribute, isMixedParameter, isBack });
  });

  // Sort asian handicap and correct score!
  bets.sort((b1, b2) => {
    const attr1 = b1.attributeText;
    const attr2 = b2.attributeText;
    if (b1.isMixedParameter) {
      return attr1 < attr2 ? -1 : attr2 > attr1 ? 1 : 0;
    } else {
      const n1 = Number(attr1);
      const n2 = Number(attr2);
      return n1 < n2 ? -1 : n2 > n1 ? 1 : 0;
    }
  });

  if (bets.length <= 0) {
    log.silly(`No ${backOrLayKey} bets for bt: ${bt}, sc: ${sc}, event: ${event.url}`);
    return;
  }

  bets.forEach(function ({ betKey, _attribute, _isMixedParameter }) {
    const isBack = feedSrc[betKey].isBack;
    const attributeText = feedSrc[betKey].mixedParameterName || feedSrc[betKey].handicapValue;
    const attributes = calcAttributes(attributeText, bt);
    processBet(event, feedSrc[betKey], bt, sc, isBack, attributeText, attributes);
  });
}

function processBet(event, feedSrc, bt, sc, isBack, attributeText, attributes) {
  if (isBack === false) {
    // todo: write lay  ets to own table!
    return;
  }
  //log.debug(`Process bet for bt: ${bt}, sc: ${sc}, isBack: ${isBack}, attribute: ${attribute}`);

  const marketKey = addMarket(event, bt, sc, isBack, attributeText, attributes, feedSrc.act);
  if (marketKey === null) {
    return;
  }

  Object.keys(feedSrc.OutcomeID).forEach(function (outcomeKey, _outcomeIndex) {
    processOutcomeBet(event, feedSrc, outcomeKey, bt, sc, isBack, attributeText, attributes, marketKey);
  });
}

function processOutcomeBet(event, feedSrc, outcomeKey, bt, sc, isBack, attributeText, attributes, marketKey) {
  processOpeningOrClosingOdds(event, true, feedSrc, outcomeKey, bt, sc, isBack, attributeText, attributes, marketKey);
  processOpeningOrClosingOdds(event, false, feedSrc, outcomeKey, bt, sc, isBack, attributeText, attributes, marketKey);
}

function processOpeningOrClosingOdds(event, isOpening, feedSrc, outcomeKey, bt, sc, isBack, attributeText, attributes, marketKey) {
  const oddsPointer = isOpening ? feedSrc.opening_odds : feedSrc.odds;
  const datePointer = isOpening ? feedSrc.opening_change_time : feedSrc.change_time;
  const volumePointer = isOpening ? feedSrc.opening_volume : feedSrc.volume;

  const bookieKeyList = [];
  Object.keys(oddsPointer).forEach(function (bookieKey, _index) {
    bookieKeyList.push(bookieKey);
  });

  const numBookies = bookieKeyList.length;
  log.debug(`Num bookies: ${numBookies}`);

  let count = 0;
  for (let i = 0; i < numBookies; i++) {
    const bookieKey = bookieKeyList[i];

    count++;

    const realOutcome = parseInt(outcomeKey, 10) + 1;
    const realOutcomeKey = realOutcome.toString();
    const betKey =
      bt.toString() + '_' + sc.toString() + '_' + (isBack ? 'back' : 'lay') + '_' + attributeText + '_' + realOutcomeKey + '_' + bookieKey;

    const betName = calcBetName(bt, attributeText, attributes.attribute1, attributes.attribute2);

    if (event.odds[betKey] === undefined) {
      event.odds[betKey] = {};
      event.odds[betKey].eventId = event.id;
      event.odds[betKey].marketKey = marketKey;
      event.odds[betKey].season = event.season;
      event.odds[betKey].bt = bt;
      event.odds[betKey].sc = sc;
      event.odds[betKey].isBack = isBack;
      event.odds[betKey].betName = betName;
      event.odds[betKey].attributeText = attributeText;
      event.odds[betKey].attribute1 = attributes.attribute1;
      event.odds[betKey].attribute2 = attributes.attribute2;
      event.odds[betKey].bookieId = parseInt(bookieKey, 10);
      event.odds[betKey].outcome = realOutcome;
      event.odds[betKey].openingOdds = null;
      event.odds[betKey].openingDate = null;
      event.odds[betKey].openingVolume = null;
      event.odds[betKey].closingOdds = null;
      event.odds[betKey].closingDate = null;
      event.odds[betKey].closingVolume = null;
    }

    const odds = ensureNumberOrNull(oddsPointer[bookieKey][outcomeKey]);
    const date = ensureDateOrNull(datePointer[bookieKey][outcomeKey]);
    const volume = ensureNumberOrNull(volumePointer[bookieKey] && volumePointer[bookieKey][outcomeKey] ? volumePointer[bookieKey][outcomeKey] : null);

    if (isOpening) {
      event.odds[betKey].openingOdds = odds;
      event.odds[betKey].openingDate = date;
      event.odds[betKey].openingVolume = volume;
    } else {
      event.odds[betKey].closingOdds = odds;
      event.odds[betKey].closingDate = date;
      event.odds[betKey].closingVolume = volume;
    }

    addMarketOdds(event, marketKey, bookieKey, realOutcome, isOpening, odds, date, volume, bt, sc, isBack, attributeText, attributes, betName);
  }
}

function calcBetName(bt, attributeText, attribute1, attribute2) {
  switch (bt) {
    case config.bt.OU:
      return `OU ${attribute1}`;
    case config.bt.AH:
      return `AH ${attribute1}`;
    case config.bt.CS:
      return `CS ${attribute1}-${attribute2}`;
    case config.bt.HTFT:
      return `HTFT ${attributeText}`;
    case config.bt.EH:
      return `EH ${attribute1}`;
    default:
      return calcBetTypeName(bt);
  }
}

function calcBetTypeName(bt) {
  switch (bt) {
    case config.bt.Match:
      return '1X2';
    case config.bt.OU:
      return 'OU';
    case config.bt.HomeAway:
      return 'Home/Away';
    case config.bt.DC:
      return 'DC';
    case config.bt.AH:
      return 'AH';
    case config.bt.DNB:
      return 'DNB';
    case config.bt.TQ:
      return 'TQ';
    case config.bt.CS:
      return 'CS';
    case config.bt.HTFT:
      return 'HTFT';
    case config.bt.OE:
      return 'OE';
    case config.bt.Winner:
      return 'Winner';
    case config.bt.EH:
      return 'EH';
    case config.bt.BTS:
      return 'BTS';
    default:
      return '';
  }
}

function ensureDateOrNull(val) {
  if (typeof val !== 'number') {
    return null;
  }
  const d = new Date(val * 1000);
  if (Object.prototype.toString.call(d) === '[object Date]' && !Number.isNaN(d.getTime())) {
    return val;
  }
  return null;
}

function ensureNumberOrNull(val) {
  return typeof val === 'number' ? val : null;
}

function addMarket(event, bt, sc, isBack, attributeText, attributes, bookies) {
  if (sc < 2 || sc > 4) {
    // too hard to handle other scopes right now, wait with them!
    return null;
  }

  if (event.score.hasPartTimeScore === false) {
    if (sc == 3 || sc == 4) {
      // skip part time market when no part time score exist!
      return null;
    }
  }

  const market = createMarket();

  market.eventId = event.id;
  market.season = event.season;

  market.bt = bt;
  market.sc = sc;
  market.isBack = isBack;
  market.betName = calcBetName(bt, attributeText, attributes.attribute1, attributes.attribute2);
  market.attributeText = attributeText;
  market.attribute1 = attributes.attribute1;
  market.attribute2 = attributes.attribute2;

  market.numBookies = Object.keys(bookies).length;
  market.numExcluded = bookielib.countExcluded(bookies);
  market.numIncluded = market.numBookies - market.numExcluded;
  market.numBookiesSharp = bookielib.countSharp(bookies);
  market.numBookiesSoft = bookielib.countSoft(bookies);
  market.numBookiesSwe = bookielib.countSweden(bookies);
  market.numExchanges = bookielib.countExchange(bookies);
  market.numBrokers = bookielib.countBroker(bookies);

  market.score_1 = event.score[`sc${sc}_1`];
  market.score_2 = event.score[`sc${sc}_2`];

  market.outcome = null;

  market.win_1 = null;
  market.win_2 = null;
  market.win_3 = null;

  const scores = createScores(market.score_1, market.score_2);
  const marketResult = marketlib.calcMarket(scores, bt, sc, isBack, attributes, event);
  if (marketResult === null || marketResult.outcome === null) {
    // log.info('Market outcome is NULL!', scores, bt, sc, attributes);
    return null;
  }

  market.outcome = marketResult.outcome;

  market.win_1 = marketResult.win_1;
  market.win_2 = marketResult.win_2;
  market.win_3 = marketResult.win_3;

  market.was_1 = marketResult.win_1 === null ? null : marketResult.outcome === 1 ? 1 : 0;
  market.was_2 = marketResult.win_2 === null ? null : marketResult.outcome === 2 ? 1 : 0;
  market.was_3 = marketResult.win_3 === null ? null : marketResult.outcome === 3 ? 1 : 0;

  const marketKey = event.id + '_' + bt.toString() + '_' + sc.toString() + '_' + (isBack ? 'b' : 'l') + '_' + attributeText;
  market.marketKey = marketKey;

  event.market[marketKey] = market;

  return marketKey;
}

function addMarketOdds(event, marketKey, bookieKey, outcome, isOpening, odds, date, volume, bt, sc, isBack, attributeText, attributes, betName) {
  if (!marketKey) {
    return;
  }
  const marketOddsKey = `${marketKey}_${bookieKey}`;
  if (event.marketOdds[marketOddsKey] === undefined) {
    event.marketOdds[marketOddsKey] = createMarketOdds();
  }
  const ptr = event.marketOdds[marketOddsKey];

  ptr.eventId = event.id;
  ptr.marketKey = marketKey;
  ptr.bookieId = bookieKey;

  ptr.season = event.season;
  ptr.score_1 = event.market[marketKey].score_1;
  ptr.score_2 = event.market[marketKey].score_2;

  ptr.outcome = event.market[marketKey].outcome;
  ptr.was_1 = event.market[marketKey].was_1;
  ptr.was_2 = event.market[marketKey].was_2;
  ptr.was_3 = event.market[marketKey].was_3;

  ptr.win_1 = event.market[marketKey].win_1;
  ptr.win_2 = event.market[marketKey].win_2;
  ptr.win_3 = event.market[marketKey].win_3;

  ptr.bt = bt;
  ptr.sc = sc;
  ptr.isBack = isBack;
  ptr.betName = betName;
  ptr.attributeText = attributeText;
  ptr.attribute1 = attributes.attribute1;
  ptr.attribute2 = attributes.attribute2;

  if (isOpening) {
    ptr[`openingOdds_${outcome}`] = odds;
    ptr[`openingDate_${outcome}`] = date;
    ptr[`openingVolume_${outcome}`] = volume;
  } else {
    ptr[`closingOdds_${outcome}`] = odds;
    ptr[`closingDate_${outcome}`] = date;
    ptr[`closingVolume_${outcome}`] = volume;
  }

  return;
}

function updateMarketOdds(event) {
  Object.keys(event.marketOdds).forEach(function (key, _index) {
    const ptr = event.marketOdds[key];

    const numExpectedOutcomes = expectedNumOfOutcomes(ptr.bt);
    const numOpeningOutcomes = (ptr.openingOdds_1 ? 1 : 0) + (ptr.openingOdds_2 ? 1 : 0) + (ptr.openingOdds_3 ? 1 : 0);
    const numClosingOutcomes = (ptr.closingOdds_1 ? 1 : 0) + (ptr.closingOdds_2 ? 1 : 0) + (ptr.closingOdds_3 ? 1 : 0);

    ptr.openingOk = numOpeningOutcomes == numExpectedOutcomes;
    ptr.closingOk = numClosingOutcomes == numExpectedOutcomes;

    ptr.numOutcomes = numExpectedOutcomes;

    if (ptr.openingOk) {
      const openingOverround = calcOverround(ptr.bt, ptr.openingOdds_1, ptr.openingOdds_2, ptr.openingOdds_3);
      const openingMargin = openingOverround - 1;
      // const openingPayout = 1 / openingOverround;

      ptr.openingOverround = _.round(openingOverround, 6);

      ptr.openingBiasProb_1 = _.round(calcBiasProb(ptr.openingOdds_1, openingMargin, numExpectedOutcomes), 6);
      ptr.openingBiasProb_2 = _.round(calcBiasProb(ptr.openingOdds_2, openingMargin, numExpectedOutcomes), 6);
      ptr.openingBiasProb_3 = _.round(calcBiasProb(ptr.openingOdds_3, openingMargin, numExpectedOutcomes), 6);

      ptr.openingEqualProb_1 = _.round(calcEqualProb(ptr.openingOdds_1, openingOverround), 6);
      ptr.openingEqualProb_2 = _.round(calcEqualProb(ptr.openingOdds_2, openingOverround), 6);
      ptr.openingEqualProb_3 = _.round(calcEqualProb(ptr.openingOdds_3, openingOverround), 6);
    }

    if (ptr.closingOk) {
      const closingOverround = calcOverround(ptr.bt, ptr.closingOdds_1, ptr.closingOdds_2, ptr.closingOdds_3);
      const closingMargin = closingOverround - 1;
      // const closingPayout = 1 / closingOverround;

      ptr.closingOverround = _.round(closingOverround, 6);

      ptr.closingBiasProb_1 = _.round(calcBiasProb(ptr.closingOdds_1, closingMargin, numExpectedOutcomes), 6);
      ptr.closingBiasProb_2 = _.round(calcBiasProb(ptr.closingOdds_2, closingMargin, numExpectedOutcomes), 6);
      ptr.closingBiasProb_3 = _.round(calcBiasProb(ptr.closingOdds_3, closingMargin, numExpectedOutcomes), 6);

      ptr.closingEqualProb_1 = _.round(calcEqualProb(ptr.closingOdds_1, closingOverround), 6);
      ptr.closingEqualProb_2 = _.round(calcEqualProb(ptr.closingOdds_2, closingOverround), 6);
      ptr.closingEqualProb_3 = _.round(calcEqualProb(ptr.closingOdds_3, closingOverround), 6);
    }
  });
}

function calcOverround(bt, odds1, odds2, odds3) {
  // DC bets have a book of 200%, need to divide with 2 to get real overround!
  const divider = bt === config.bt.DC ? 2 : 1;
  const overround = (odds1 ? 1 / odds1 : 0) + (odds2 ? 1 / odds2 : 0) + (odds3 ? 1 / odds3 : 0);
  return overround / divider;
}

async function getBettingTypes(event) {
  log.debug(`Get betting types for event: ${event.name}`);

  const feed = await getFeedByUrl(event, config.bt.Match, config.sc.FT);
  if (feed === null || feed.nav === undefined) {
    log.error(`Failed to get betting types for event: ${event.url}`);
    log.verbose(`Failed to get betting types for event: ${event.url}, feed.nav: ${feed.nav}`);
    return null;
  }

  const bettingTypes = {};
  Object.keys(feed.nav).forEach(function (bettingTypeKey, _index) {
    utilslib.ensureProperties(bettingTypes, [bettingTypeKey]);
    Object.keys(feed.nav[bettingTypeKey]).forEach(function (scopeKey, _scopeIndex) {
      bettingTypes[bettingTypeKey][scopeKey] = feed.nav[bettingTypeKey][scopeKey].length;
    });
  });

  return bettingTypes;
}

function calcAttributes(attributeText, bt) {
  const attributes = createAttributes();
  switch (bt) {
    case config.bt.OU:
      attributes.attribute1 = parseFloat(attributeText);
      break;
    case config.bt.AH:
      attributes.attribute1 = parseFloat(attributeText);
      break;
    case config.bt.CS:
      const goals = attributeText.split(':');
      if (goals.length == 2) {
        attributes.attribute1 = parseInt(goals[0]);
        attributes.attribute2 = parseInt(goals[1]);
      }
      break;
    case config.bt.HTFT:
      const signs = attributeText.split('/');
      if (signs.length == 2) {
        const sign1 = signs[0];
        const sign2 = signs[1];
        const outcomeHT = sign1 === '1' ? 1 : sign1 === 'X' ? 2 : sign1 === '2' ? 3 : null;
        const outcomeFT = sign2 === '1' ? 1 : sign2 === 'X' ? 2 : sign2 === '2' ? 3 : null;
        if (outcomeHT !== null && outcomeFT !== null) {
          attributes.attribute1 = outcomeHT;
          attributes.attribute2 = outcomeFT;
        }
        break;
      }
    case config.bt.EH:
      attributes.attribute1 = parseInt(attributeText);
      break;
    default:
    // do nothing
  }
  return attributes;
}

// HELPERS

function expectedNumOfOutcomes(bt) {
  switch (bt) {
    case config.bt.Match:
      return 3;
    case config.bt.OU:
      return 2;
    case config.bt.DC:
      return 3;
    case config.bt.AH:
      return 2;
    case config.bt.DNB:
      return 2;
    case config.bt.CS:
      return 1;
    case config.bt.HTFT:
      return 1;
    case config.bt.EH:
      return 3;
    case config.bt.BTS:
      return 2;
    case config.bt.OE:
      return 2;
    default:
      return null;
  }
}

function calcBiasProb(odds, margin, numOutcomes) {
  const result = 1 / ((numOutcomes * odds) / (numOutcomes - margin * odds));
  return isFinite(result) ? result : null;
}

function calcEqualProb(odds, overround) {
  const result = 1 / odds / overround;
  return isFinite(result) ? result : null;
}

// PARSE

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

function validateDivisionData(divisionData, url) {
  const parsedUrl = parser.parseUrl(url);

  if (divisionData.sport.replaceAll(' ', '').toLowerCase() !== parsedUrl.sport.replaceAll('-', '').toLowerCase()) {
    console.log(parsedUrl);
    return false;
  }
  if (divisionData.country.replaceAll(' ', '').toLowerCase() !== parsedUrl.country.replaceAll('-', '').toLowerCase()) {
    console.log(parsedUrl);
    return false;
  }
  if (divisionData.division.replaceAll(' ', '').toLowerCase() !== parsedUrl.divisionCodeName.replaceAll('-', '').toLowerCase()) {
    console.log(parsedUrl);
    return false;
  }
  if (divisionData.season !== parsedUrl.year && parsedUrl.year !== null) {
    console.log(parsedUrl);
    return false;
  }

  return true;
}

function parseInfo(event, htmltext) {
  const divisionData = parseDivisionData(event, htmltext);
  if (!divisionData) {
    return null;
  }

  if (!validateDivisionData(divisionData, event.url)) {
    log.error('Mis-matching division data between web page and URL!');
    return null;
  }

  const info = createInfo();

  info.eventId = event.id;

  info.status = processStatus(event);
  assert(info.status, 'info.status falsey');

  info.is_started = event.params.isStarted;
  info.is_finished = event.params.isFinished;
  info.is_postponed = event.params.isPostponed;

  info.has_ft_score = event.score.hasFullTimeScore;
  info.has_pt_score = event.score.hasPartTimeScore;
  info.is_ot = event.score.isOT;
  info.is_penalties = event.score.isPenalties;

  info.sport = divisionData.sport;
  info.country = divisionData.country;
  info.division = divisionData.division;
  info.season = divisionData.season;

  info.start_time = event.score.startTime;
  info.start_time_date = event.score.startTimeDate;

  info.team_1 = event.params.home;
  info.team_2 = event.params.away;

  info.pt_scores = event.score.ptScores;

  info.sc1_1 = event.score.sc1_1;
  info.sc1_2 = event.score.sc1_2;
  info.sc2_1 = event.score.sc2_1;
  info.sc2_2 = event.score.sc2_2;

  info.sc3_1 = event.score.sc3_1;
  info.sc3_2 = event.score.sc3_2;
  info.sc4_1 = event.score.sc4_1;
  info.sc4_2 = event.score.sc4_2;

  info.sc98_1 = event.score.sc98_1;
  info.sc98_2 = event.score.sc98_2;
  info.sc99_1 = event.score.sc99_1;
  info.sc99_2 = event.score.sc99_2;

  info.sport_id = event.params.sportId;
  info.tournament_id = event.params.tournamentId;
  info.version_id = event.params.versionId;

  info.xhash = event.params.xhash;
  info.xhashf = event.params.xhashf;
  info.ukey_base = event.params.ukeyBase;

  info.url = event.url;

  return info;
}

async function parseScore(event) {
  log.debug(`Get event score for event: ${event.name}`);

  const score = createScore();

  const timestamp = provider.createLongTimestamp();
  const url = `https://fb.oddsportal.com/feed/postmatchscore/1-${event.id}-${event.params.xhash}.dat?_=${timestamp}`;

  const response = await provider.httpGetResponse(url, {});
  const htmltext = response.data;

  const reScore = /"d":({[^}]*})/im;
  const scrapedScore = htmltext.match(reScore);
  if (!scrapedScore || scrapedScore.length != 2) {
    log.error(`Failed to scrape score for event: ${event.url}, scrapedScore: ${scrapedScore}`);
    return score;
  }

  const parsedScore = JSON.parse(scrapedScore[1]);
  if (parsedScore === undefined || parsedScore.startTime === undefined || parsedScore.result === undefined) {
    log.error(`Failed to JSON parse score for event: ${event.url}, scrapedScore: ${scrapedScore}, see verbose log for more logging.`);
    log.verbose(score);
    return score;
  }

  // Everything from now are failures that should be handled normally!
  score.ok = true;

  score.startTime = parsedScore.startTime;
  score.startTimeDate = new Date(parsedScore.startTime * 1000);

  const result = parsedScore.result;
  const resultAlert = parsedScore['result-alert'];

  if (resultAlert !== '') {
    if (resultAlert.match(/.*(Canceled).*/i)) {
      score.status = 'canceled';
      return score;
    }
    if (resultAlert.match(/.*(Postponed).*/i)) {
      score.status = 'postponed';
      return score;
    }
  }

  const ftResult = result.match(/\<strong\>([0-9]+)\:([0-9]+)(?: penalties)?( ET)?( OT)?/i);

  if (ftResult == null) {
    if (result.match(/.*(awarded).*/i)) {
      score.status = 'awarded';
      return score;
    }
  } else {
    score.sc1_1 = parseInt(ftResult[1], 10);
    score.sc1_2 = parseInt(ftResult[2], 10);

    // Set FT same as FTOT now, in case PT results are not available!
    score.sc2_1 = score.sc1_1;
    score.sc2_2 = score.sc1_2;

    score.hasFullTimeScore = true;

    const scoreText = ftResult[0];
    score.isOT = scoreText.match(/.*(ET).*/i) !== null;
    score.isPenalties = scoreText.match(/.*(Penalties).*/i) !== null;
  }

  const ptResult = result.match(/\(([0-9]+)\:([0-9]+)(\, ([0-9]+)\:([0-9]+))*\)/i);

  if (ptResult && ptResult.length >= 1) {
    const ptText = ptResult[0].trim();
    score.ptScores = ptText;
    const ptTextScores = ptText.replaceAll('(', '').replaceAll(')', '').split(',');
    const ptNumScores = ptTextScores.map((score) => {
      const scores = score.trim().split(':');
      return [parseInt(scores[0], 10), parseInt(scores[1], 10)];
    });

    score.sc3_1 = ptNumScores[0][0];
    score.sc3_2 = ptNumScores[0][1];
    score.sc4_1 = ptNumScores[1][0];
    score.sc4_2 = ptNumScores[1][1];
    score.sc2_1 = score.sc3_1 + score.sc4_1;
    score.sc2_2 = score.sc3_2 + score.sc4_2;

    if (score.isPenalties || score.isOT) {
      const extraScores = ptNumScores.filter((item, index) => {
        return index + 1 > 2; // all results after half1 and half2!
      });
      const numExtraScores = extraScores.length;

      if (score.isOT) {
        const etFinalScore = extraScores.reduce((acc, curr) => [curr[0] + acc[0], curr[1] + acc[1]], [0, 0]);
        score.sc98_1 = etFinalScore[0];
        score.sc98_2 = etFinalScore[1];
      }

      if (score.isPenalties) {
        const ptFinalScore = extraScores[numExtraScores - 1];
        score.sc99_1 = ptFinalScore[0];
        score.sc99_2 = ptFinalScore[1];

        const etScores = extraScores.filter((item, index) => {
          return index + 1 < numExtraScores;
        });
        const etFinalScore = etScores.reduce((acc, curr) => [curr[0] + acc[0], curr[1] + acc[1]], [0, 0]);
        score.sc98_1 = etFinalScore[0];
        score.sc98_2 = etFinalScore[1];
      }
    }

    score.hasPartTimeScore = true;
  }

  score.status = 'finished';

  return score;
}

function parseDivisionData(event, htmltext) {
  const divisionData = createDivisionData();

  const reDivision = /<h2 class=\"out\">You are here<\/h2>[^<]*<[^>]*>Home<\/a>[^<]*<a href=\"\/[^\/]*\/\">([^<]*)<\/a>[^<]*<a href=\"[^\"]*\">([^<]*)<\/a>[^<]*<a href=\"[^\"]*\">([^<]*)<\/a>/im;
  const scrapedDivision = htmltext.match(reDivision);
  if (!scrapedDivision || scrapedDivision.length != 4) {
    log.error(`Failed to scrape division data for event: ${event.url}, scrapedDivision: ${scrapedDivision}`);
    return null;
  }

  divisionData.sport = scrapedDivision[1].trim();
  divisionData.country = scrapedDivision[2].trim();

  const divisionSeason = scrapedDivision[3];
  const reDivisionTwoYears = /(.*)([0-9]{4})\/([0-9]{4})/im;
  const scrapedDivisionTwoYears = divisionSeason.match(reDivisionTwoYears);
  if (scrapedDivisionTwoYears && scrapedDivisionTwoYears.length === 4) {
    divisionData.division = scrapedDivisionTwoYears[1].trim();
    divisionData.season = parseInt(scrapedDivisionTwoYears[3], 10);
  } else {
    const reDivisionOneYear = /(.*)([0-9]{4})/im;
    const scrapedDivisionOneYear = divisionSeason.match(reDivisionOneYear);
    if (scrapedDivisionOneYear && scrapedDivisionOneYear.length === 3) {
      divisionData.division = scrapedDivisionOneYear[1].trim();
      divisionData.season = parseInt(scrapedDivisionOneYear[2], 10);
    } else {
      divisionData.division = divisionSeason;
      divisionData.season = null;
    }
  }
  if (divisionData.season === null) {
    divisionData.season = event.season;
    log.debug(`Failed to scrape division season year for event: ${event.url}, set year from event: ${event.season}`);
  }

  return divisionData;
}

// MISC

function respondOk(response = undefined) {
  return { ok: true, response };
}

function respondError(response = undefined) {
  return { ok: false, response };
}

// CREATES

function createEvent(options = {}) {
  const data = {
    ok: false,
    duplicate: false,
    hasOdds: false,
    error: null,
    id: null,
    name: null,
    sport: null,
    country: null,
    divisionCode: null,
    divisionCodeName: null,
    season: null,
    url: null,
    params: {},
    score: {},
    bettingTypes: {},
    info: {},
    market: {},
    odds: {},
    marketOdds: {}
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

function createInfo(options = {}) {
  const data = {
    eventId: null,

    status: null,
    // ft_ot_pen: null,
    // ft_pt_score: null,

    is_started: null,
    is_finished: null,
    is_postponed: null,

    has_ft_score: false,
    has_pt_score: false,
    is_ot: false,
    is_penalties: false,

    start_time: null,
    start_time_date: null,

    sport: null,
    country: null,
    division: null,
    season: null,

    team_1: null,
    team_2: null,

    pt_scores: null,

    sc1_1: null, // FTOT
    sc1_2: null,
    sc2_1: null, // FT
    sc2_2: null,

    sc3_1: null, // H1
    sc3_2: null,
    sc4_1: null, // H2
    sc4_2: null,

    sc98_1: null, // OT/ET
    sc98_2: null,
    sc99_1: null, // Penalties
    sc99_2: null,

    url: null,

    sport_id: null,
    tournament_id: null,
    version_id: null,

    xhash: null,
    xhashf: null,
    ukey_base: null
  };

  return { ...data, ...options };
}

function createScore(options = {}) {
  const data = {
    ok: false,
    status: '',

    hasFullTimeScore: false,
    hasPartTimeScore: false,
    isOT: false,
    isPenalties: false,

    //isFinishedOk: false,
    //isPostponed: false,
    //finalResultOnly: false,

    startTime: null,

    ptScores: null,

    sc1_1: null, // FTOT
    sc1_2: null,
    sc2_1: null, // FT
    sc2_2: null,

    sc3_1: null, // H1
    sc3_2: null,
    sc4_1: null, // H2
    sc4_2: null,

    /*
    sc5_1: null, // P1
    sc5_2: null,
    sc6_1: null, // P2
    sc6_2: null,
    sc7_1: null, // P3
    sc7_2: null,

    sc8_1: null, // Q1
    sc8_2: null,
    sc9_1: null, // Q2
    sc9_2: null,
    sc10_1: null, // Q3
    sc10_2: null,
    sc11_1: null, // Q4
    sc11_2: null,

    sc12_1: null, // S1
    sc12_2: null,
    sc13_1: null, // S2
    sc13_2: null,
    sc14_1: null, // S3
    sc14_2: null,
    sc15_1: null, // S4
    sc15_2: null,
    sc16_1: null, // S5
    sc16_2: null,
    */

    sc98_1: null, // OT/ET
    sc98_2: null,
    sc99_1: null, // Penalties
    sc99_2: null
  };

  return { ...data, ...options };
}

function createDivisionData(options = {}) {
  const data = {
    sport: null,
    country: null,
    division: null,
    season: null
  };

  return { ...data, ...options };
}

function createAttributes(attribute1 = null, attribute2 = null) {
  return {
    attribute1,
    attribute2
  };
}

function createMarket() {
  return {
    eventId: null,
    marketKey: null,
    season: null,

    bt: null,
    sc: null,
    isBack: null,
    betName: null,

    attributeText: null,
    attribute1: null,
    attribute2: null,

    numBookies: null,
    numExcluded: null,
    numIncluded: null,
    numBookiesSharp: null,
    numBookiesSoft: null,
    numExchanges: null,
    numBrokers: null,
    numBookiesSwe: null,

    score_1: null,
    score_2: null,

    outcome: null,
    was_1: null,
    was_2: null,
    was_3: null,

    win_1: null,
    win_2: null,
    win_3: null
  };
}

function createMarketOdds() {
  return {
    eventId: null,
    marketKey: null,
    season: null,

    bookieId: null,

    score_1: null,
    score_2: null,

    numOutcomes: null,
    outcome: null,
    was_1: null,
    was_2: null,
    was_3: null,

    win_1: null,
    win_2: null,
    win_3: null,

    bt: null,
    sc: null,
    isBack: null,
    betName: null,
    attributeText: null,
    attribute1: null,
    attribute2: null,

    openingOk: null,
    openingOverround: null,

    openingOdds_1: null,
    openingOdds_2: null,
    openingOdds_3: null,

    openingDate_1: null,
    openingDate_2: null,
    openingDate_3: null,

    openingVolume_1: null,
    openingVolume_2: null,
    openingVolume_3: null,

    openingBiasProb_1: null,
    openingBiasProb_2: null,
    openingBiasProb_3: null,

    openingEqualProb_1: null,
    openingEqualProb_2: null,
    openingEqualProb_3: null,

    closingOk: null,
    closingOverround: null,

    closingOdds_1: null,
    closingOdds_2: null,
    closingOdds_3: null,

    closingDate_1: null,
    closingDate_2: null,
    closingDate_3: null,

    closingVolume_1: null,
    closingVolume_2: null,
    closingVolume_3: null,

    closingBiasProb_1: null,
    closingBiasProb_2: null,
    closingBiasProb_3: null,

    closingEqualProb_1: null,
    closingEqualProb_2: null,
    closingEqualProb_3: null
  };
}

function createScores(score_1, score_2) {
  return {
    _1: score_1,
    _2: score_2
  };
}
