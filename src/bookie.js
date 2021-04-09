'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const parser = require('./parser');
const provider = require('./provider');
const dataWriter = require('./dataWriter.js');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

export async function getBookiesFromWebPage() {
  try {
    const dateTimeString = provider.createDateTimeString(new Date());
    const shortTimestamp = provider.createShortTimestamp();
    const url = `https://www.oddsportal.com/res/x/bookies-${dateTimeString}-${shortTimestamp}.js`;

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    const srcBookies = parser.parseBookiesFromBookiesPage(htmltext);

    const bookies = [];
    Object.keys(srcBookies).forEach((key, index) => {
      const srcBookie = srcBookies[key];

      const bookie = createBookie();

      bookie.id = parseInt(srcBookie.idProvider);
      bookie.name = srcBookie.WebName;

      bookie.is_active = srcBookie.Active === 'y' ? 1 : 0;

      bookie.is_bookie = srcBookie.IsBookmaker === 'y' ? 1 : 0;
      bookie.is_exchange = srcBookie.IsBettingExchange === 'y' ? 1 : 0;
      bookie.is_broker = null;

      bookie.is_sharp = null;
      bookie.is_soft = null;
      bookie.is_global = null;
      bookie.is_local = srcBookie.PreferredCountryID !== '0' ? 1 : 0;
      bookie.local_country_id = parseInt(srcBookie.PreferredCountryID);
      bookie.allowed_in_se = null;

      bookie.provider_id = srcBookie.idProvider;
      bookie.provider_webName = srcBookie.WebName;
      bookie.provider_webUrl = srcBookie.WebUrl;
      bookie.provider_active = srcBookie.Active;
      bookie.provider_isNew = srcBookie.isNew;
      bookie.provider_newTo = srcBookie.NewTo;
      bookie.provider_preferredCountryID = srcBookie.PreferredCountryID;

      bookies.push(bookie);
    });

    log.verbose(bookies);

    return bookies;
  } catch (error) {
    log.error(`getBookiesFromWebPage exception: ${error}, stack: ${error.stack}`);
    return null;
  }
}

export async function crawlBookies() {
  log.info(`Start crawling bookies...`);

  const bookies = await getBookiesFromWebPage();
  if (bookies) {
    dataWriter.writeToBookieFile(bookies);
  }

  log.info(`Done crawling bookies!`);

  return bookies;
}

// COUNTER FUNCTIONS -----------------------------------------------------------------------------

export function countSharp(bookies) {
  let count = 0;
  Object.keys(bookies).forEach(function (key, _index) {
    count = count + countBookies(key, 'isSharp');
  });
  return count;
}

export function countSoft(bookies) {
  let count = 0;
  Object.keys(bookies).forEach(function (key, _index) {
    count = count + countBookies(key, 'isSoft');
  });
  return count;
}

export function countExchange(bookies) {
  let count = 0;
  Object.keys(bookies).forEach(function (key, _index) {
    count = count + countBookies(key, 'isBettingExchange');
  });
  return count;
}

export function countBroker(bookies) {
  let count = 0;
  Object.keys(bookies).forEach(function (key, _index) {
    count = count + countBookies(key, 'isBroker');
  });
  return count;
}

export function countSweden(bookies) {
  let count = 0;
  Object.keys(bookies).forEach(function (key, _index) {
    count = count + countBookies(key, 'isSweden');
  });
  return count;
}

export function countExcluded(bookies) {
  let count = 0;
  Object.keys(bookies).forEach(function (key, _index) {
    if (config.bookies[key] === undefined) {
      count++;
    }
  });
  return count;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function countBookies(bookieKey, propertyKey) {
  if (config.bookies[bookieKey] === undefined) {
    return 0;
  }
  if (config.bookies[bookieKey][propertyKey] === undefined) {
    return 0;
  }
  return config.bookies[bookieKey][propertyKey] ? 1 : 0;
}

function createBookie(options = {}) {
  const data = {
    id: null,
    name: null,

    is_active: null,

    is_bookie: null,
    is_exchange: null,
    is_broker: null,

    is_sharp: null,
    is_soft: null,
    is_global: null,
    is_local: null,
    local_country_id: null,
    allowed_in_se: null,

    provider_id: null,
    provider_webName: null,
    provider_webUrl: null,
    provider_active: null,
    provider_isNew: null,
    provider_newTo: null,
    provider_preferredCountryID: null
  };

  return { ...data, ...options };
}
