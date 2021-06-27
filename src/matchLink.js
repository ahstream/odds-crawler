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

export async function crawlMatchPages(sport, sportId, startDate, daysForward, daysBack) {
  log.info(`Crawl match pages from date: ${startDate.toLocaleDateString()}, sportName: ${sport}, sportId: ${sportId}, forward: ${daysForward}, back: ${daysBack}`);

  const forwardDates = getDateRange(startDate, daysForward, 1);
  const backDates = getDateRange(startDate, daysBack, -1);
  const dates = [startDate].concat(forwardDates, backDates);

  const numLinks = {
    numMatchLinks: { total: 0, new: 0, existing: 0, ignored: 0 },
    numOtherLinks: { total: 0, new: 0, existing: 0, ignored: 0 }
  };

  for (const date of dates) {
    try {
      const result = await crawlDay(sport, sportId, date);
      log.debug('Match links crawled:', result);

      numLinks.numMatchLinks.total += result.numMatchLinks.total;
      numLinks.numMatchLinks.new += result.numMatchLinks.new;
      numLinks.numMatchLinks.existing += result.numMatchLinks.existing;
      numLinks.numMatchLinks.ignored += result.numMatchLinks.ignored;

      numLinks.numOtherLinks.total += result.numOtherLinks.total;
      numLinks.numOtherLinks.new += result.numOtherLinks.new;
      numLinks.numOtherLinks.existing += result.numOtherLinks.existing;
      numLinks.numOtherLinks.ignored += result.numOtherLinks.ignored;

      log.debug('>>> New match links:', numLinks);
    } catch (e) {
      log.error('Failed crawlMatchPages:', e.message, e);
    }
  }

  return numLinks;
}

export async function crawlMatchLinks(status = null, force = false) {
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
      log.info(`Match link ${ct} of ${numMatchLinks} crawled: ${result.new} new odds, ${result.existing} dups, ${matchLink.parsedUrl.matchUrl}`);
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

  return true;
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
  if (matchLink.hoursToStart > 96) {
    return 24;
  }
  return 4;
}

export async function updateMatchLinkInDB(matchLink) {
  if (matchLink.isCompleted) {
    const completedItem = createCompletedMatchLink(matchLink);
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

async function crawlDay(sportName, sportId, date) {
  log.debug(`Crawl match links on date: ${date.toLocaleDateString()}, sportName: ${sportName}, sportId: ${sportId}`);

  const dateStr = createLongDateString(date);
  const url = `https://www.oddsportal.com/matches/${sportName}/${dateStr}/`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const hashes = parseNextMatchesHashes(htmltext);
  const nextMatches = await getNextMatchesByHashes(sportId, dateStr, hashes);

  const numMatchLinks = await addMatchLinks(dateStr, nextMatches.parsedMatchUrls);
  const numOtherLinks = await addOtherLinks(dateStr, nextMatches.otherUrls);

  return { numMatchLinks, numOtherLinks };
}

export async function getNextMatchesByHashes(sportId, dateStr, hashes) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/ajax-next-games/';
  urls.push(`${baseUrl}${sportId}/2/1/${dateStr}/${decodeURI(hashes.xHash[dateStr])}.dat?_=${createLongTimestamp()}`);
  urls.push(`${baseUrl}${sportId}/2/1/${dateStr}/${decodeURI(hashes.xHashf[dateStr])}.dat?_=${createLongTimestamp()}`);
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
  let numNew = 0;
  let numExisting = 0;
  let numIgnored = 0;
  const matchLinksCol = mongodb.db.collection('matchLinks');
  for (const parsedUrl of parsedMatchUrls) {
    if (!(await validateTournament(parsedUrl))) {
      numIgnored++;
    } else if (!(await matchLinkExists(parsedUrl.matchId))) {
      await matchLinksCol.insertOne(createMatchLink(parsedUrl, dateStr, now));
      numNew++;
    } else {
      numExisting++;
    }
  }
  return { total: parsedMatchUrls.length, new: numNew, existing: numExisting, ignored: numIgnored };
}

async function validateTournament(parsedUrl) {
  // todo: implement!
  return true;
}

async function addOtherLinks(dateStr, otherUrls) {
  const now = new Date();
  let numNew = 0;
  let numExisting = 0;
  let numIgnored = 0;
  const otherLinksCol = mongodb.db.collection('otherLinks');
  for (const url of otherUrls) {
    if (await ignoredLinkExists(url)) {
      numIgnored++;
    } else if (!(await otherLinkExists(url))) {
      await otherLinksCol.insertOne(createOtherLink(url, dateStr, now));
      numNew++;
    } else {
      numExisting++;
    }
  }
  return { total: otherUrls.length, new: numNew, existing: numExisting, ignored: numIgnored };
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
  return (await mongodb.db.collection('otherLinks').find({ _id: url }).limit(1).count()) === 1;
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
    sport: null,
    sportId: null,
    tournament: null,
    tournamentId: null,
    country: null,
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

function createCompletedMatchLink(matchLink) {
  return {
    _id: matchLink._id,
    sport: matchLink.parsedUrl.sport,
    country: matchLink.parsedUrl.country,
    tournament: matchLink.parsedUrl.tournament,
    tournamentId: matchLink.tournamentId
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
