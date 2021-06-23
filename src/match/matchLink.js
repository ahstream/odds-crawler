import { parseNextMatchesData, parseNextMatchesHashes, parseNextMatchesJson } from '../parser/parser';
import {
  createLongDateString,
  createLongTimestamp,
  getHtmltextFromResponse,
  httpGetAllowedResponse
} from '../provider/provider';
import { updateMatchOddsHistoryDB } from './match.js';

const assert = require('assert');
const _ = require('lodash');

const { createLogger } = require('../lib/loggerlib');
const mongodb = require('../mongo/mongodb.js');
const matchlib = require('./match.js');

const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

export async function crawlPeriod(sport, sportId, startDate, daysForward = 0, daysBack = 0) {
  log.info(`Crawl match links from date: ${startDate.toLocaleString()}, sport: ${sport}, sportId: ${sportId}, forward: ${daysForward}, back: ${daysBack}`);

  const forwardDates = getDateRange(startDate, daysForward, 1);
  const backDates = getDateRange(startDate, daysBack, -1);
  const dates = [startDate].concat(forwardDates, backDates);

  for (const date of dates) {
    try {
      const result = await crawlDay(sport, sportId, date);
      log.info(`${result.matchLinksAdded}/${result.matchLinks} match links added (${result.otherLinksAdded}/${result.otherLinks} other links)`);
    } catch (e) {
      log.debug('Failed crawlDay:', e.message, e);
    }
  }

  return true;
}

export async function processMatchLinks() {
  const now = new Date();
  const dateStr = createLongDateString(new Date());

  const matchLinksCol = mongodb.db.collection('matchLinks');
  const nextMatchLinks = await matchLinksCol
    .find({
      // status: { $ne: 'complete' },
      isCompleted: { $ne: true },
      dateStr: { $gte: dateStr },
      nextCrawlTime: { $lte: now }
    })
    .toArray();

  const prevMatchLinks = await matchLinksCol
    .find({
      // status: { $ne: 'complete' },
      isCompleted: { $ne: true },
      dateStr: { $lt: dateStr },
      nextCrawlTime: { $lte: now }
    })
    .toArray();

  // todo: logga counter!
  for (const matchLink of [...nextMatchLinks, ...prevMatchLinks]) {
    try {
      const match = await matchlib.getMatchFromWebPage(matchLink.parsedUrl);
      const result = await updateMatchOddsHistoryDB(match);
      log.info('Got match:', matchLink.parsedUrl.matchUrl, result);
      matchLink.isCompleted = match.params.isFinished;
      matchLink.status = match.status;
      matchLink.startTime = match.score.startTime;

    } catch (ex) {
      log.error(ex.message, matchLink.parsedUrl.matchUrl, ex.name);
      matchLink.error = { name: ex.name, message: ex.message }; // , data: ex.data };
      matchLink.errorCount++;
      matchLink.isCompleted = null;
      matchLink.status = 'error';
    }
    scheduleNextCrawl(matchLink);
    await updateMatchLinkInDB(matchLink);
  }
}

function scheduleNextCrawl(matchLink) {
  const oneHour = 1000 * 60 * 60;
  const now = new Date();
  if (matchLink.status === 'error') {
    matchLink.hoursLeft = null;
    matchLink.hoursToNextCrawl = null;
    matchLink.nextCrawlTime = new Date(now.getTime() + oneHour);
  } else {
    matchLink.hoursLeft = calcHoursLeft(matchLink);
    matchLink.hoursToNextCrawl = calcHoursToNextCrawl(matchLink);
    matchLink.nextCrawlTime = matchLink.hoursToNextCrawl ? new Date(now.getTime() + matchLink.hoursToNextCrawl * oneHour) : null;
  }
}

function calcHoursLeft(matchLink) {
  if (!matchLink.startTime) {
    return null;
  }
  return (matchLink.startTime - new Date()) / (1000 * 60 * 60);
}

function calcHoursToNextCrawl(matchLink) {
  if (matchLink.isCompleted) {
    return null;
  }
  const hoursLeft = matchLink.hoursLeft;

  if (hoursLeft < 0) {
    return 4;
  }
  if (hoursLeft <= 1) {
    return 0.5;
  }
  if (hoursLeft <= 6) {
    return 1;
  }
  if (hoursLeft <= 12) {
    return 2;
  }
  if (hoursLeft <= 24) {
    return 3;
  }

  return 4;
}

export async function updateMatchLinkInDB(matchLink) {
  if (matchLink.isCompleted) {
    const isCompletedItem = { _id: matchLink._id };
    await mongodb.db.collection('matchLinksCompleted').updateOne({ _id: matchLink._id }, { $set: isCompletedItem }, { upsert: true });
    await mongodb.db.collection('matchLinks').deleteOne({ _id: matchLink._id });
  } else {
    await mongodb.db.collection('matchLinks').replaceOne({ _id: matchLink._id }, matchLink);
  }
}

/**
 * ok
 */
export async function processOtherLinks() {
  const otherLinksCol = mongodb.db.collection('otherLinks');
  const ignoredLinksCol = mongodb.db.collection('otherLinksIgnored');
  for (const link of await otherLinksCol.find({}).toArray()) {
    if (!(await ignoredLinkExists(link._id))) {
      await ignoredLinksCol.insertOne(link);
    }
  }
  await otherLinksCol.deleteMany({});
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

/**
 *
 */
async function crawlDay(sport, sportId, date) {
  log.info(`Crawl match links on date: ${date.toLocaleDateString()}, sport: ${sport}, sportId: ${sportId}`);

  const dateStr = createLongDateString(date);
  const url = `https://www.oddsportal.com/matches/${sport}/${dateStr}/`;
  const response = await httpGetAllowedResponse([url]);
  const htmltext = getHtmltextFromResponse(response, url);
  if (!htmltext) {
    log.debug('Failed crawlDay, urls:', url);
    return null;
  }

  const hashes = parseNextMatchesHashes(htmltext);
  const nextMatches = await getNextMatchesByHashes(sportId, dateStr, hashes);

  const matchLinksAdded = await addMatchLinks(dateStr, nextMatches.parsedMatchUrls);
  const otherLinksAdded = await addOtherLinks(dateStr, nextMatches.otherUrls);

  return { ...matchLinksAdded, ...otherLinksAdded };
}

/**
 *
 */
export async function getNextMatchesByHashes(sportId, dateStr, hashes) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/ajax-next-games/';
  // Example: https://fb.oddsportal.com/ajax-next-games/1/2/1/20210604/yja16.dat?_=1622832135022
  urls.push(`${baseUrl}${sportId}/2/1/${dateStr}/${decodeURI(hashes.xHash[dateStr])}.dat?_=${createLongTimestamp()}`);
  urls.push(`${baseUrl}${sportId}/2/1/${dateStr}/${decodeURI(hashes.xHashf[dateStr])}.dat?_=${createLongTimestamp()}`);
  const response = await httpGetAllowedResponse(urls);
  const htmltext = getHtmltextFromResponse(response, urls);
  if (!htmltext) {
    log.debug('Failed getNextMatchesByHashes, urls:', urls);
    return null;
  }

  const result = parseNextMatchesJson(htmltext);
  if (result && typeof result.d === 'string') {
    return parseNextMatchesData(result.d);
  }

  log.error('Failed getNextMatchesByHashes, parseNextMatchesJson:', result);
  return null;
}

/**
 *
 */
function getDateRange(date, days, inc) {
  const currentDate = new Date(date);
  const dates = [];
  for (let i = 1; i <= days; i++) {
    currentDate.setDate(currentDate.getDate() + inc);
    dates.push(new Date(currentDate));
  }
  return dates;
}

async function addMatchLinks(dateStr, parsedMatchUrls) {
  const now = new Date();
  let matchLinksAdded = 0;
  const matchLinksCol = mongodb.db.collection('matchLinks');
  for (const parsedUrl of parsedMatchUrls) {
    if (!(await matchLinkExists(parsedUrl.matchId))) {
      await matchLinksCol.insertOne(createMatchLink(parsedUrl, dateStr, now));
      matchLinksAdded++;
    }
  }
  return { matchLinks: parsedMatchUrls.length, matchLinksAdded };
}

async function addOtherLinks(dateStr, otherUrls) {
  const now = new Date();
  let otherLinksAdded = 0;
  const otherLinksCol = mongodb.db.collection('otherLinks');
  for (const url of otherUrls) {
    if (!(await otherLinkExists(url))) {
      await otherLinksCol.insertOne(createOtherLink(url, dateStr, now));
      otherLinksAdded++;
    }
  }
  return { otherLinks: otherUrls.length, otherLinksAdded };
}

// DB FUNCTIONS

export async function resetDB() {
  await mongodb.db.collection('matchLinks').deleteMany({});
  await mongodb.db.collection('matchLinksCompleted').deleteMany({});
  await mongodb.db.collection('otherLinks').deleteMany({});
  await mongodb.db.collection('otherLinksIgnored').deleteMany({});
}

async function matchLinkExists(matchId) {
  if ((await mongodb.db.collection('matchLinks').find({ _id: matchId }).limit(1).count()) === 1) {
    return true;
  }
  return (await mongodb.db.collection('matchLinksCompleted').find({ _id: matchId }).limit(1).count()) === 1;
}

async function otherLinkExists(url) {
  if ((await mongodb.db.collection('otherLinks').find({ _id: url }).limit(1).count()) === 1) {
    return true;
  }
  return ignoredLinkExists(url);
}

async function ignoredLinkExists(url) {
  return (await mongodb.db.collection('otherLinksIgnored').find({ _id: url }).limit(1).count()) === 1;
}

function createMatchLink(parsedUrl, dateStr, now) {
  return {
    _id: parsedUrl.matchId,
    status: 'new',
    isCompleted: false,
    errorCount: 0,
    created: now,
    startTime: null,
    nextCrawlTime: now,
    hoursLeft: null,
    hoursToNextCrawl: null,
    lastCrawlTime: null,
    parsedUrl,
    dateStr
  };
}

function createOtherLink(url, dateStr, now) {
  return {
    _id: url,
    status: 'new',
    created: now,
    dateStr
  };
}
