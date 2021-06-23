// DECLARES -----------------------------------------------------------------------------


import { CustomError } from '../exception/customError';
import { getHtmltextFromResponse } from '../provider/provider';

const assert = require('assert');
const _ = require('lodash');

const config = require('../../config/config.json');
const betlib = require('../bet/bet.js');
const { createLogger } = require('../lib/loggerlib');
const parser = require('../parser/parser');
const provider = require('../provider/provider');

const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

export async function processMatchFeeds(match) {
  const feedKeys = getFeedKeys(match);
  const feedUrls = getFeedUrls(match, feedKeys);
  const feedResults = await provider.getMany(feedUrls);
  return processMatchFeedResults(match, feedResults);
}

function processMatchFeedResults(match, feedResults) {
  let numBets = 0;
  for (const data of feedResults.data) {
    const feed = parser.parseMatchFeed(data.response.data);
    if (feed === null) {
      return -1;
    }
    numBets += processMatchFeed(match, feed);
  }
  return numBets;
}

function processMatchFeed(match, feed) {
  if (!feed || !feed.oddsdata || !feed.oddsdata.back) {
    // todo: throw vid första fel?!
    log.debug('ERROR: Undefined feed.oddsdata.back, match:', feed, match);
    return 0;
  }
  if (feed.oddsdata.back) {
    return betlib.processBets(match, feed, feed.oddsdata.back, feed.bt, feed.sc);
  }
  return 0;
}

export async function getMatchFeed(match, betType, scope) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/feed/match/1-1-';
  urls.push(`${baseUrl}${match.id}-${betType}-${scope}-${match.params.xhash}.dat?_=${provider.createLongTimestamp()}`);
  urls.push(`${baseUrl}${match.id}-${betType}-${scope}-${match.params.xhashf}.dat?_=${provider.createLongTimestamp()}`);

  const response = await provider.httpGetAllowedResponse(urls);
  const htmltext = getHtmltextFromResponse(response, urls);
  if (!htmltext) {
    throw new CustomError('Failed getting match feed', { betType, scope, response });
    // log.debug('Failed getMatchFeed, urls:', urls);
    // return null;
  }

  return parser.parseMatchFeed(htmltext);
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

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
    feedUrls.push(`${baseUrl}${match.id}-${bt}-${sc}-${match.params.xhash}.dat?_=${provider.createLongTimestamp()}`);
  }
  return feedUrls;
}
