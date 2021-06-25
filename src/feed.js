/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { httpGetManyUrls, createLongTimestamp, httpGetAllowedHtmltext } from './provider';

const betlib = require('./bet.js');
const parser = require('./parser');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function processMatchFeeds(match) {
  const feedKeys = getFeedKeys(match);
  const feedUrls = getFeedUrls(match, feedKeys);
  const feedResults = await httpGetManyUrls(feedUrls);

  return processMatchFeedResults(match, feedResults);
}

function processMatchFeedResults(match, feedResults) {
  let numBets = 0;
  for (const data of feedResults.data) {
    const feed = parser.parseMatchFeed(data.response.data);
    if (feed === null) {
      throw new CustomError('Match feed is null', { url: match.url, feedData: data });
    }
    numBets += processMatchFeed(match, feed);
  }
  return numBets;
}

function processMatchFeed(match, feed) {
  if (feed?.oddsdata?.back) {
    return betlib.processBets(match, feed, feed.oddsdata.back, feed.bt, feed.sc);
  }
  throw new CustomError('Failed getting oddsdata', { url: match.url, feed });
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
    feedUrls.push(`${baseUrl}${match.id}-${bt}-${sc}-${match.params.xhash}.dat?_=${createLongTimestamp()}`);
  }

  return feedUrls;
}
