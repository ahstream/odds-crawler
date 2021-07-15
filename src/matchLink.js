/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { toShortDateStr } from './lib/utilslib';
import {
  updateMatchOddsHistoryDB,
  getMatchFromWebPage,
  exportMatchToFile,
  addMatchToDBIfCompleted
} from './match.js';
import { parseFakedMatchUrl, parseNextMatchesData, parseNextMatchesHashes, parseNextMatchesJson } from './parser';
import { createLongDateString, createLongTimestamp, httpGetAllowedHtmltext } from './provider';

const _ = require('lodash');

const { createLogger } = require('./lib/loggerlib');
const matchlib = require('./match');
const mongodb = require('./mongodb.js');
const sportlib = require('./sport');

const log = createLogger();

const ONE_HOUR = 1000 * 60 * 60;

const MATCH_LINKS = 'matchLinks';
const MATCH_LINKS_COMPLETED = 'matchLinksCompleted';
const OTHER_LINKS = 'otherLinks';
const IGNORED_LINKS = 'ignoredLinks';

// todo: <span class="active"><strong><a href="[^"]*">([0-9\/\-]*)<\/a><\/strong><\/span>

// CRAWL MATCH PAGES -------------------------------------------------------------------------------

export async function crawlMatchPages(sportName, startDate, daysForward, daysBack) {
  // log.info(`Crawl match pages from date: ${startDate.toLocaleDateString()}, sportName: ${sportName}, sportId: ${sportId}, forward: ${daysForward}, back: ${daysBack}`);

  const forwardDates = getDateRange(startDate, daysForward, 1);
  const backDates = getDateRange(startDate, daysBack, -1);
  const dates = [startDate].concat(forwardDates, backDates);
  const sportId = sportlib.getSportId(sportName);

  const numLinks = {
    numMatchLinks: { total: 0, new: 0, existing: 0, ignored: 0 },
    numOtherLinks: { total: 0, new: 0, existing: 0, ignored: 0 }
  };

  // log.info(`Crawl ${dates.length} match pages, startDate: ${startDate.toLocaleDateString()}, sportName: ${sportName}, forward: ${daysForward}, back: ${daysBack}`);

  for (const date of dates) {
    try {
      const result = await crawlMatchPage(sportName, sportId, date);

      numLinks.numMatchLinks.total += result.numMatchLinks.total;
      numLinks.numMatchLinks.new += result.numMatchLinks.new;
      numLinks.numMatchLinks.existing += result.numMatchLinks.existing;
      numLinks.numMatchLinks.ignored += result.numMatchLinks.ignored;

      numLinks.numOtherLinks.total += result.numOtherLinks.total;
      numLinks.numOtherLinks.new += result.numOtherLinks.new;
      numLinks.numOtherLinks.existing += result.numOtherLinks.existing;
      numLinks.numOtherLinks.ignored += result.numOtherLinks.ignored;

      log.debug('Match links crawled:', result, numLinks);
    } catch (e) {
      log.error('Failed crawlMatchPages:', e.message, e);
    }
  }

  log.info(`${numLinks.numMatchLinks.new} new ${sportName}, ${dates.length} match pages, ${startDate.toLocaleDateString()}, ${daysForward}/${daysBack}, ${numLinks.numMatchLinks.total}/${numLinks.numMatchLinks.new}/${numLinks.numMatchLinks.existing}/${numLinks.numMatchLinks.ignored}, ${numLinks.numOtherLinks.total}/${numLinks.numOtherLinks.new}/${numLinks.numOtherLinks.existing}/${numLinks.numOtherLinks.ignored}`);

  // log.info(`${sportName}: ${numLinks.numMatchLinks.total}/${numLinks.numMatchLinks.new}/${numLinks.numMatchLinks.existing}/${numLinks.numMatchLinks.ignored}; ${numLinks.numOtherLinks.total}/${numLinks.numOtherLinks.new}/${numLinks.numOtherLinks.existing}/${numLinks.numOtherLinks.ignored} (total/new/dups/ignored), ${dates.length} match pages (${startDate.toLocaleDateString()}/${daysForward}/${daysBack})`);

  return numLinks;
}

async function crawlMatchPage(sportName, sportId, date) {
  log.debug(`Crawl match page for date: ${date.toLocaleDateString()}, sportName: ${sportName}, sportId: ${sportId}`);

  const dateStr = createLongDateString(date);
  const url = `https://www.oddsportal.com/matches/${sportName}/${dateStr}/`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const hashes = parseNextMatchesHashes(htmltext);
  const nextMatches = await getNextMatchesByHashes(sportId, dateStr, hashes);

  const numMatchLinks = await addMatchLinksToDB(nextMatches.parsedMatchUrls, dateStr);
  const numOtherLinks = await addOtherLinksToDB(nextMatches.otherUrls, dateStr);

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

// CRAWL MATCH LINKS -------------------------------------------------------------------------------

export async function crawlMatchLinks(status = null, force = false) {
  const matchLinks = await getMatchLinksFromDB(status, force);
  log.info(`Crawl ${matchLinks.length} match links...`);
  for (const [idx, matchLink] of matchLinks.entries()) {
    // todo: hantera postponed/canceled/etc matches
    try {
      await crawlMatchLink(matchLink, idx + 1, matchLinks.length);
    } catch (error) {
      handleCrawlMatchLinkError(matchLink, error);
    }
    scheduleNextCrawl(matchLink);
    await updateMatchLinkInDB(matchLink);
    // return true;
  }

  return true;
}

export async function moveBackToMatchLinksQueue() {
  const now = new Date();
  const dateStr = createLongDateString(now);
  const matchLinksCol = mongodb.db.collection(MATCH_LINKS);
  const matchLinksCompletedCol = mongodb.db.collection(MATCH_LINKS_COMPLETED);
  const matchLinksCompleted = await matchLinksCompletedCol.find({}).toArray();
  for (const [idx, matchLinkCompleted] of matchLinksCompleted.entries()) {
    try {
      const parsedUrl = parseFakedMatchUrl(matchLinkCompleted._id, matchLinkCompleted.tournamentKey);
      const matchLink = createMatchLink(parsedUrl, dateStr, now);
      matchLink.status = 'new2';
      // log.info(matchLink);
      await matchLinksCol.insertOne(matchLink);
    } catch (error) {
      log.error('Error in moveBackToMatchLinksQueue:', error);
    }
  }

  return true;
}

async function crawlMatchLink(matchLink, count, totalCount) {
  // todo: add to tournaments and check if should exclude or not.
  const match = await getMatchFromWebPage(matchLink.parsedUrl, true);
  exportMatchToFile(match); // todo
  //  const tournament = updateTournaments(match);
  const result = await updateMatchOddsHistoryDB(match);
  await addMatchToDBIfCompleted(match);
  handleCrawlMatchLinkSuccess(matchLink, match);
  log.info(`Match ${count}/${totalCount}: ${result.oddsHistory.new} new odds, ${result.oddsHistory.existing} dups, ${match.info.numBookies} bks, ${match.info.numMarkets} markets, ${matchLink.startTime ? toShortDateStr(matchLink.startTime) : null}, ${matchLink.parsedUrl.matchUrl}`);
}

function handleCrawlMatchLinkSuccess(matchLink, match) {
  const now = new Date();
  matchLink.lastCrawlTime = now;
  matchLink.lastCrawlTimeSuccess = now;
  matchLink.isCompleted = matchlib.isCompleted(match);
  matchLink.isRescheduled = matchlib.isRescheduled(match);
  matchLink.status = match.status;
  matchLink.statusType = match.statusType;
  matchLink.startTime = match.matchScore.startTime;
  matchLink.tournamentId = match.params.tournamentId;
  matchLink.sportId = match.params.sportId;
}

function handleCrawlMatchLinkError(matchLink, error) {
  log.error(error.message, matchLink.parsedUrl.matchUrl, error.name);

  const now = new Date();
  matchLink.lastCrawlTime = now;
  matchLink.lastCrawlTimeFail = now;
  matchLink.isCompleted = null;
  matchLink.isRescheduled = null;
  matchLink.status = 'error';
  matchLink.statusType = 'error';
  matchLink.errorMsg = error.message;
  matchLink.error = {
    name: error.name,
    message: error.message,
    data: error.data,
    stack: error.stack,
    completeError: JSON.stringify(error)
  };
  matchLink.errorCount++;
}

function scheduleNextCrawl(matchLink) {
  const now = new Date();

  matchLink.hoursToStart = matchLink.status === 'error' ? null : calcHoursToStart(matchLink);
  matchLink.hoursToNextCrawl = matchLink.status === 'error' ? 0 : calcHoursToNextCrawl(matchLink);

  if (matchLink.status === 'error') {
    matchLink.nextCrawlTime = new Date();
  } else if (matchLink.hoursToNextCrawl < 0) {
    matchLink.nextCrawlTime = null;
  } else {
    matchLink.nextCrawlTime = new Date(now.getTime() + matchLink.hoursToNextCrawl * ONE_HOUR);
  }
}

function calcHoursToStart(matchLink) {
  return !matchLink.startTime ? null : _.round((matchLink.startTime - new Date()) / ONE_HOUR, 0);
}

function calcHoursToNextCrawl(matchLink) {
  if (matchLink.isCompleted) {
    return -1;
  }
  if (matchLink.isRescheduled) {
    log.debug('Match is rescheduled:', matchLink);
    return 12;
  }
  if (matchLink.hoursToStart < 0) {
    return 4;
  }
  if (matchLink.hoursToStart <= 1) {
    return 0.5;
  }
  if (matchLink.hoursToStart <= 24) {
    return 1;
  }
  if (matchLink.hoursToStart <= 48) {
    return 2;
  }
  if (matchLink.hoursToStart <= 72) {
    return 4;
  }
  if (matchLink.hoursToStart <= 96) {
    return 8;
  }
  if (matchLink.hoursToStart > 96) {
    return 24;
  }

  return 4;
}

async function matchLinkExistsInDB(matchId) {
  if ((await mongodb.db.collection(MATCH_LINKS).find({ _id: matchId }).limit(1).count()) === 1) {
    return true;
  }
  return (await mongodb.db.collection(MATCH_LINKS_COMPLETED).find({ _id: matchId }).limit(1).count()) === 1;
}

async function getMatchLinksFromDB(status, force) {
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

  const matchLinksCol = mongodb.db.collection(MATCH_LINKS);

  const nextMatchLinks = await matchLinksCol.find({ ...baseCriteria, dateStr: { $gte: dateStr } }).toArray();
  const prevMatchLinks = await matchLinksCol.find({ ...baseCriteria, dateStr: { $lt: dateStr } }).toArray();

  return [...nextMatchLinks, ...prevMatchLinks];
}

export async function updateMatchLinkInDB(matchLink, match) {
  if (matchLink.isCompleted) {
    const completedItem = createMatchLinkCompleted(matchLink);
    await mongodb.db.collection(MATCH_LINKS_COMPLETED).updateOne({ _id: matchLink._id }, { $set: completedItem }, { upsert: true });
    await mongodb.db.collection(MATCH_LINKS).deleteOne({ _id: matchLink._id });
  } else {
    const replacementItem = { ...matchLink };
    await mongodb.db.collection(MATCH_LINKS).replaceOne({ _id: matchLink._id }, replacementItem);
  }
}

async function addMatchLinksToDB(parsedMatchUrls, dateStr) {
  const now = new Date();
  let numNew = 0;
  let numExisting = 0;
  let numIgnored = 0;
  const matchLinksCol = mongodb.db.collection(MATCH_LINKS);
  for (const parsedUrl of parsedMatchUrls) {
    if (!(await validateTournament(parsedUrl))) {
      numIgnored++;
    } else if (!(await matchLinkExistsInDB(parsedUrl.matchId))) {
      await matchLinksCol.insertOne(createMatchLink(parsedUrl, dateStr, now));
      numNew++;
    } else {
      numExisting++;
    }
  }
  return { total: parsedMatchUrls.length, new: numNew, existing: numExisting, ignored: numIgnored };
}

// OTHER LINKS -------------------------------------------------------------------------------

export async function ignoreOtherLinks() {
  const otherLinksCol = mongodb.db.collection(OTHER_LINKS);
  const ignoredLinksCol = mongodb.db.collection(IGNORED_LINKS);
  for (const link of await otherLinksCol.find({}).toArray()) {
    if (!(await ignoredLinkExistsInDB(link._id))) {
      await ignoredLinksCol.insertOne(link);
    }
  }
  await otherLinksCol.deleteMany({});
}

async function addOtherLinksToDB(otherUrls, dateStr) {
  const now = new Date();
  let numNew = 0;
  let numExisting = 0;
  let numIgnored = 0;
  const otherLinksCol = mongodb.db.collection(OTHER_LINKS);
  for (const url of otherUrls) {
    if (await ignoredLinkExistsInDB(url)) {
      numIgnored++;
    } else if (!(await otherLinkExistsInDB(url))) {
      await otherLinksCol.insertOne(createOtherLink(url, dateStr, now));
      numNew++;
    } else {
      numExisting++;
    }
  }
  return { total: otherUrls.length, new: numNew, existing: numExisting, ignored: numIgnored };
}

async function otherLinkExistsInDB(url) {
  return (await mongodb.db.collection(OTHER_LINKS).find({ _id: url }).limit(1).count()) === 1;
}

async function ignoredLinkExistsInDB(url) {
  return (await mongodb.db.collection(IGNORED_LINKS).find({ _id: url }).limit(1).count()) === 1;
}

// MISC -------------------------------------------------------------------------------------------

function getDateRange(date, days, inc) {
  const currentDate = new Date(date);
  const dates = [];
  for (let i = 1; i <= days; i++) {
    currentDate.setDate(currentDate.getDate() + inc);
    dates.push(new Date(currentDate));
  }
  return dates;
}

async function validateTournament(parsedUrl) {
  // todo: implement!
  return true;
}

// CREATORS ---------------------------------------------------------------------------------------

function createMatchLink(parsedUrl, dateStr, now) {
  return {
    _id: parsedUrl.matchId,
    sportName: parsedUrl.sport,
    sportId: null,
    country: parsedUrl.country,
    tournament: parsedUrl.tournament,
    tournamentId: null,
    tournamentKey: parsedUrl.tournamentKey,
    status: 'new',
    statusType: null,
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
    lastCrawlTimeSuccess: null,
    lastCrawlTimeFail: null,
    dateStr,
    parsedUrl
  };
}

function createMatchLinkCompleted(matchLink) {
  return {
    _id: matchLink._id,
    status: matchLink.status,
    statusType: matchLink.statusType,
    tournamentId: matchLink.tournamentId,
    tournamentKey: matchLink.tournamentKey,
    lastCrawlTime: matchLink.lastCrawlTime,
    url: matchLink.parsedUrl.matchUrl
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
