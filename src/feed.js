'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const betlib = require('./bet.js');
const provider = require('./provider');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export async function processAsyncFeeds(event) {
  log.debug(`Process async feeds for event: ${event.name}`);

  const feedsToFetch = new Array();
  Object.keys(event.bettingTypes).forEach(function (bettingTypeKey, _bettingTypeIndex) {
    Object.keys(event.bettingTypes[bettingTypeKey]).forEach(function (scopeKey, _scopeIndex) {
      // todo: ignore ointressanta bt/sc?
      feedsToFetch.push({ bt: bettingTypeKey, sc: scopeKey });
    });
  });

  if (feedsToFetch.length <= 0) {
    log.error(`No feeds found for event: ${event.url}`);
    return false;
  }

  log.debug('Num of feeds to get:', feedsToFetch.length);

  const urls = [];
  for (let i = 0; i < feedsToFetch.length; i++) {
    const bt = feedsToFetch[i].bt;
    const sc = feedsToFetch[i].sc;
    const timestamp = provider.createLongTimestamp();

    // todo: Skip part time market because no part time score exists (event.hasPartTimeScore)?

    const url = `https://fb.oddsportal.com/feed/match/1-1-${event.id}-${bt}-${sc}-${event.xhash}.dat?_=${timestamp}`;
    urls.push(url);
  }

  const results = await provider.getMany(urls);

  if (!results.success) {
    log.error(`Failed to get URL feeds: ${event.url}`);
    return false;
  }

  try {
    for (let i = 0; i < results.data.length; i++) {
      const response = results.data[i].response;
      const feed = getFeedByHtml(event, response.data);
      if (feed === null) {
        log.error(`Failed to get feed by html for event: ${event.url}`);
        return false;
      }
      if (!processFeed(event, feed)) {
        return false;
      }
    }
  } catch (error) {
    log.error(`Failed getting all feeds for event: ${event.url}`);
    log.verbose('Feeds error:', event.name, error);
    return false;
  }

  return true;
}

export async function getFeedByUrl(event, bt, sc) {
  log.debug(`Get feed by url for bt: ${bt}, sc: ${sc}, event: ${event.name}`);

  const timestamp = provider.createLongTimestamp();
  const url = `https://fb.oddsportal.com/feed/match/1-1-${event.id}-${bt}-${sc}-${event.xhash}.dat?_=${timestamp}`;

  const response = await provider.httpGetResponse(url, {});
  const htmltext = response.data;

  return getFeedByHtml(event, htmltext);
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

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
    log.verbose('Corrupt feed:', event.name, feed);
    return null;
  }

  if (!feed.d) {
    log.error(`Failed to parse scraped feed d property for event: ${event.url}, feed: ${feed}`);
    log.verbose('Corrupt feed:', event.name, feed);
    return null;
  }
  const feedData = feed.d;

  return feedData;
}

function processFeed(event, feed) {
  log.debug(`Create event odds for event: ${event.name}, bt: ${feed.bt}, sc: ${feed.sc}`);

  if (feed.bt === undefined || feed.sc === undefined) {
    log.error(`Corrupt feed for event: ${event.name}:`);
    log.verbose('Corrupt feed:', event.name, feed);
    return false;
  }

  Object.keys(feed.oddsdata).forEach(function (backOrLayKey, _index) {
    betlib.processBackOrLayBet(event, feed, feed.oddsdata[backOrLayKey], backOrLayKey, feed.bt, feed.sc);
  });

  return true;
}
