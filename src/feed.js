/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { httpGetManyUrls, createLongTimestamp, httpGetAllowedHtmltext } from './provider';

const betlib = require('./bet.js');
const { createLogger } = require('./lib/loggerlib');
const parser = require('./parser');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function processMatchFeeds(match) {
  const feedUrls = getFeedUrls(match, getFeedKeys(match));
  const mainUrls = feedUrls.map(item => item.url1)
  const mainResults = await httpGetManyUrls(mainUrls);

  const secondaryUrls = [];
  const mainResultsToKeep = [];
  for (const item of mainResults.data) {
    let feed = null;
    try {
      feed = parser.parseMatchFeed(item.response.data);
    } catch(e) {
      // log.error('Error', e.message, e);
    }
    if (feed !== null) {
      mainResultsToKeep.push(item)
    } else {
      const secondaryUrl = (feedUrls.find(obj => obj.url1 === item.url)).url2;
      secondaryUrls.push(secondaryUrl);
    }
  }
  if (secondaryUrls.length > 0) {
    log.info('secondaryUrls.length:', secondaryUrls.length);
  }
  const secondaryResults = await httpGetManyUrls(secondaryUrls);
  // log.info('secondaryResults:', secondaryResults);
  for (const item of secondaryResults.data) {
    mainResultsToKeep.push(item);
  }

  return processMatchFeedResults(match, mainResultsToKeep);
}

function processMatchFeedResults(match, feeds) {
  let numMarkets = 0;
  for (const feedData of feeds) {
    const feed = parser.parseMatchFeed(feedData.response.data);
    if (feed === null) {
      log.debug('CustomError: Match feed is null', { url: match.url, feedData });
      throw new CustomError('Match feed is null', { url: match.url, feedData });
    }
    numMarkets += processMatchFeed(match, feed);
  }
  return numMarkets;
}

function processMatchFeed(match, feed) {
  if (feed?.oddsdata?.back) {
    return betlib.processBets(match, feed, feed.oddsdata.back, feed.bt, feed.sc);
  }
  log.debug('CustomError: Failed getting oddsdata for:', { url: match.url, feed });
  throw new CustomError('Failed getting oddsdata for:', { url: match.url, feed });
}

export async function getMatchFeed(match, betType, scope) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/feed/match/1-1-';
  urls.push(`${baseUrl}${match.id}-${betType}-${scope}-${match.params.xhash}.dat?_=${createLongTimestamp()}`);
  urls.push(`${baseUrl}${match.id}-${betType}-${scope}-${match.params.xhashf}.dat?_=${createLongTimestamp()}`);

  const htmltext = await httpGetAllowedHtmltext(urls);

  return parser.parseMatchFeed(htmltext);
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function getFeedKeys(match) {
  const feedsToFetch = [];

  Object.keys(match.betTypes).forEach((betTypeKey, _betTypeIndex) => {
    Object.keys(match.betTypes[betTypeKey]).forEach((scopeKey, _scopeIndex) => {
      feedsToFetch.push({ bt: betTypeKey, sc: scopeKey });
    });
  });

  return feedsToFetch;
}

function getFeedUrls(match, feedKeys) {
  const feedUrls = [];

  for (let i = 0; i < feedKeys.length; i++) {
    const bt = feedKeys[i].bt;
    const sc = feedKeys[i].sc;
    const baseUrl = 'https://fb.oddsportal.com/feed/match/1-1-';
    const url1 = `${baseUrl}${match.id}-${bt}-${sc}-${match.params.xhash}.dat?_=${createLongTimestamp()}`;
    const url2 = `${baseUrl}${match.id}-${bt}-${sc}-${match.params.xhashf}.dat?_=${createLongTimestamp()}`;
    feedUrls.push({url1, url2});
  }

  return feedUrls;
}
