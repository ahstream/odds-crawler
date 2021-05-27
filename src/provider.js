'use strict';

// DECLARES -----------------------------------------------------------------------------

const config = require('../config/config.json');
const httplib = require('./lib/httplib');
const tools = require('./tools');
const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

const httpCommonHeaders = {
  headers: {
    referer: 'https://www.oddsportal.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36'
  }
};

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function httpGet(url) {
  return httplib.get(url, httpCommonHeaders);
}

export async function httpGetResponse(url, { flCheckSuccess = true, flVerbose = true, delay = config.delayBetweenHttpRequests }) {
  const response = await httplib.getResponse(url, httpCommonHeaders);

  if (delay > 0) await sleep(delay);

  if (flCheckSuccess && !httplib.isSuccess(response, url)) {
    log.error(`Failed to get URL web page: ${url}`);
    if (flVerbose) httpLogErrors(response, url);
    return null;
  }

  return response;
}

export function getMany(urls, maxTries = 10, delayBetweenTries = 100) {
  return httplib.getMany(urls, maxTries, delayBetweenTries, httpCommonHeaders);
}

export function httpLogErrors(response, url = '') {
  log.verbose(
    `Error response, status: ${response?.status}, statusText: ${response?.statusText}, message: ${response?.message}, url: ${url}, responseUrl: ${response?.request?.res?.responseUrl}`
  );
}

export function createDateTimeString(date = null) {
  const dateVal = date === null ? new Date() : date;
  const dateValIso = dateVal.toISOString();
  return (
    dateValIso.substr(0, 2) +
    dateValIso.substr(5, 2) +
    dateValIso.substr(8, 2) +
    dateValIso.substr(11, 2) +
    dateValIso.substr(14, 2) +
    dateValIso.substr(17, 2)
  );
}

export function createLongTimestamp(date = null) {
  const dateVal = date === null ? new Date() : date;
  return Number(dateVal);
}

export function createShortTimestamp(date = null) {
  const dateVal = date === null ? new Date() : date;
  return Number(dateVal / 1000).toFixed();
}

export function convertTimestampToDate(timestamp) {
  const properTimestamp = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  return new Date(properTimestamp);
}

export function ensureDateOrNull(val) {
  if (typeof val !== 'number') {
    return null;
  }
  const d = new Date(val * 1000);
  if (Object.prototype.toString.call(d) === '[object Date]' && !Number.isNaN(d.getTime())) {
    return val;
  }
  return null;
}

export function ensureOddsOrNull(val) {
  if (typeof val === 'string') {
    return parseFloat(val);
  } else if (typeof val === 'number') {
    return val;
  } else return null;
}

export function ensureVolumeOrNull(val) {
  if (typeof val === 'string') {
    return parseInt(val);
  } else if (typeof val === 'number') {
    return val;
  } else return null;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function sleep(ms, flRandomize = true) {
  const msRandom = flRandomize ? ((getRandomIntInclusive(50, 150) / 100) * ms).toFixed(0) : ms;
  return new Promise((resolve) => setTimeout(resolve, msRandom));
}

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}
