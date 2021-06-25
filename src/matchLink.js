/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { updateMatchOddsHistoryDB, getMatchFromWebPage } from './match.js';
import { parseNextMatchesData, parseNextMatchesHashes, parseNextMatchesJson } from './parser';
import { createLongDateString, createLongTimestamp, httpGetAllowedHtmltext } from './provider';

const { createLogger } = require('./lib/loggerlib');
const mongodb = require('./mongodb.js');

const log = createLogger();

const ONE_HOUR = 1000 * 60 * 60;

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function resetDB() {
  await mongodb.dropCollection('matchLinks');
  await mongodb.dropCollection('matchLinksCompleted');
  await mongodb.dropCollection('otherLinks');
}

export async function crawlPeriod(sport, sportId, startDate, daysForward = 0, daysBack = 0) {
  log.info(`Crawl match links from date: ${startDate.toLocaleString()}, sport: ${sport}, sportId: ${sportId}, forward: ${daysForward}, back: ${daysBack}`);

  const forwardDates = getDateRange(startDate, daysForward, 1);
  const backDates = getDateRange(startDate, daysBack, -1);
  const dates = [startDate].concat(forwardDates, backDates);

  for (const date of dates) {
    try {
      const result = await crawlDay(sport, sportId, date);
      log.info('Match links crawled:', result);
    } catch (e) {
      log.debug('Failed crawlDay:', e.message, e);
    }
  }

  return true;
}

export async function processMatchLinks(status = undefined, force = false) {
  const now = new Date();
  const dateStr = createLongDateString(new Date());

  const baseCriteria = {
    isCompleted: { $ne: true }
  };
  if (!force) {
    baseCriteria.nextCrawlTime = { $lte: now };
  }
  if (status) {
    baseCriteria.status = { $eq: status };
  }

  const matchLinksCol = mongodb.db.collection('matchLinks');

  const nextMatchLinks = await matchLinksCol.find({ ...baseCriteria, dateStr: { $gte: dateStr } }).toArray();
  const prevMatchLinks = await matchLinksCol.find({ ...baseCriteria, dateStr: { $lt: dateStr } }).toArray();

  const matchLinks = [...nextMatchLinks, ...prevMatchLinks];
  const numMatchLinks = matchLinks.length;
  let ct = 0;

  for (const matchLink of matchLinks) {
    ct++;
    // add to tournaments and check if should exclude or not. if exclude: set status = 'exclude' and move to exclude table!
    //
    try {
      matchLink.lastCrawlTime = new Date();
      const match = await getMatchFromWebPage(matchLink.parsedUrl);
      //  const tournament = updateTournaments(match);
      const result = await updateMatchOddsHistoryDB(match);
      log.info(`Match ${ct}/${numMatchLinks}: ${matchLink.parsedUrl.matchUrl} (${result.itemCount}/${result.insertedCount})`);
      matchLink.isCompleted = match.params.isFinished;
      matchLink.status = match.status;
      matchLink.startTime = match.score.startTime;
      matchLink.tournamentId = match.params.tournamentId;
      matchLink.sportId = match.params.sportId;
    } catch (ex) {
      log.error(ex.message, matchLink.parsedUrl.matchUrl, ex.name);
      matchLink.errorMsg = ex.message;
      matchLink.error = { name: ex.name, message: ex.message, data: ex.data, stack: ex.stack };
      matchLink.errorCount++;
      matchLink.isCompleted = null;
      matchLink.status = 'error';
    }
    scheduleNextCrawl(matchLink);
    await updateMatchLinkInDB(matchLink);
  }
}

// todo: <span class="active"><strong><a href="[^"]*">([0-9\/\-]*)<\/a><\/strong><\/span>

function scheduleNextCrawl(matchLink) {
  const now = new Date();

  matchLink.hoursToStart = matchLink.status === 'error' ? null : calcHoursToStart(matchLink);
  matchLink.hoursToNextCrawl = matchLink.status === 'error' ? null : calcHoursToNextCrawl(matchLink);

  if (matchLink.status === 'error') {
    matchLink.nextCrawlTime = new Date();
  } else if (matchLink.hoursToNextCrawl < 0) {
    matchLink.nextCrawlTime = null;
  } else {
    matchLink.nextCrawlTime = new Date(now.getTime() + matchLink.hoursToNextCrawl * ONE_HOUR);
  }
}

function calcHoursToStart(matchLink) {
  return !matchLink.startTime ? null : (matchLink.startTime - new Date()) / ONE_HOUR;
}

function calcHoursToNextCrawl(matchLink) {
  if (matchLink.isCompleted) {
    return -1;
  }
  if (matchLink.hoursToStart < 0) {
    return 4;
  }
  if (matchLink.hoursToStart <= 1) {
    return 0.5;
  }
  if (matchLink.hoursToStart <= 6) {
    return 1;
  }
  if (matchLink.hoursToStart <= 12) {
    return 2;
  }
  if (matchLink.hoursToStart <= 24) {
    return 3;
  }
  return 4;
}

export async function updateMatchLinkInDB(matchLink) {
  if (matchLink.isCompleted) {
    const completedItem = { _id: matchLink._id };
    await mongodb.db.collection('matchLinksCompleted').updateOne({ _id: matchLink._id }, { $set: completedItem }, { upsert: true });
    await mongodb.db.collection('matchLinks').deleteOne({ _id: matchLink._id });
  } else {
    const replacementMatchLink = { ...matchLink };
    await mongodb.db.collection('matchLinks').replaceOne({ _id: matchLink._id }, replacementMatchLink);
  }
}

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

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

async function crawlDay(sport, sportId, date) {
  log.info(`Crawl match links on date: ${date.toLocaleDateString()}, sport: ${sport}, sportId: ${sportId}`);

  const dateStr = createLongDateString(date);
  const url = `https://www.oddsportal.com/matches/${sport}/${dateStr}/`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const hashes = parseNextMatchesHashes(htmltext);
  const nextMatches = await getNextMatchesByHashes(sportId, dateStr, hashes);

  const matchLinksAdded = await addMatchLinks(dateStr, nextMatches.parsedMatchUrls);
  const otherLinksAdded = await addOtherLinks(dateStr, nextMatches.otherUrls);

  return { ...matchLinksAdded, ...otherLinksAdded };
}

export async function getNextMatchesByHashes(sportId, dateStr, hashes) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/ajax-next-games/';
  urls.push(`${baseUrl}${sportId}/2/1/${dateStr}/${decodeURI(hashes.xHash[dateStr])}.dat?_=${createLongTimestamp()}`);
  urls.push(`${baseUrl}${sportId}/2/1/${dateStr}/${decodeURI(hashes.xHashf[dateStr])}.dat?_=${createLongTimestamp()}`);
  // todo: hantera throws!
  const htmltext = await httpGetAllowedHtmltext(urls);

  const result = parseNextMatchesJson(htmltext);
  if (result && typeof result.d === 'string') {
    return parseNextMatchesData(result.d);
  }

  log.error('Failed getNextMatchesByHashes, parseNextMatchesJson:', result);
  return null;
}

/**
 * Misc functions
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

/**
 * Add to DB functions
 */

async function addMatchLinks(dateStr, parsedMatchUrls) {
  const now = new Date();
  let addedCount = 0;
  let existingCount = 0;
  let excludedCount = 0;
  const matchLinksCol = mongodb.db.collection('matchLinks');
  for (const parsedUrl of parsedMatchUrls) {
    // todo: validate tournament (add + check if excluded)
    if (!(await validateTournament(parsedUrl))) {
      excludedCount++;
      continue;
    }
    if (!(await matchLinkExists(parsedUrl.matchId))) {
      await matchLinksCol.insertOne(createMatchLink(parsedUrl, dateStr, now));
      addedCount++;
    } else {
      existingCount++;
    }
  }
  return { totalCount: parsedMatchUrls.length, addedCount, existingCount, excludedCount };
  // return { matchLinks: parsedMatchUrls.length, matchLinksAdded: addedCount };
}

async function validateTournament(parsedUrl) {
  return true;
}

async function addOtherLinks(dateStr, otherUrls) {
  const now = new Date();
  let addedCount = 0;
  let existingCount = 0;
  const otherLinksCol = mongodb.db.collection('otherLinks');
  for (const url of otherUrls) {
    if (!(await otherLinkExists(url))) {
      await otherLinksCol.insertOne(createOtherLink(url, dateStr, now));
      addedCount++;
    } else {
      existingCount++;
    }
  }
  return { totalCount: otherUrls.length, addedCount, existingCount };
}

/**
 * Exist checker functions
 */

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

/**
 * Creator functions
 */

function createMatchLink(parsedUrl, dateStr, now) {
  return {
    _id: parsedUrl.matchId,
    tournamentId: null,
    sportId: null,
    status: 'new',
    isCompleted: false,
    errorCount: 0,
    errorMsg: null,
    error: null,
    created: now,
    startTime: null,
    nextCrawlTime: now,
    hoursToStart: null,
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
