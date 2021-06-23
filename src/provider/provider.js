const config = require('../../config/config.json');
const httplib = require('../lib/httplib');
const { createLogger } = require('../lib/loggerlib');
const parser = require('../parser/parser');

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

export function getHtmltextFromResponse(response, url) {
  if (!response || !response.data) {
    log.debug('Failed reponse! URL, response:', url, response);
    return null;
  }
  const htmltext = response.data;
  const errorCode = parser.parseWebPageError(response.data);
  if (errorCode) {
    log.debug('Web page error! errorCode, url, htmltext:', errorCode, url, htmltext);
    return null;
  }
  return htmltext;
}

export async function httpGetAllowedResponse(urls, delay = 2) {
  let response;
  let ct = 0;
  for (const url of urls) {
    ct++;
    response = await httpGetResponse(url, { delay });
    if (!response || !response.data) {
      log.info('Fail url (no response):', url);
      continue;
    }
    if (parser.parseNotAllowed(response.data)) {
      log.info('Fail url (not allowed):', url);
      continue;
    }
    if (ct === 2) {
      log.info(`httpGetAllowedResponse success on try 2!`);
    }
    return response;
  }
  return response;
}

export async function httpGetResponse(url, { flCheckSuccess = false, flVerbose = true, delay = config.delayBetweenHttpRequests }) {
  const response = await httplib.getResponse(url, httpCommonHeaders);

  if (delay > 0) {
    await sleep(delay);
  }

  if (flCheckSuccess && !httplib.isSuccess(response, url)) {
    log.debug(`Failed to get URL web page: ${url}`);
    if (flVerbose) {
      httpLogErrors(response, url);
    }
    return null;
  }

  return response;
}

export function getMany(urls, maxTries = 10, delayBetweenTries = 100) {
  return httplib.getMany(urls, maxTries, delayBetweenTries, httpCommonHeaders);
}

export function httpLogErrors(response, url = '') {
  log.verbose(`Error response, status: ${response?.status}, statusText: ${response?.statusText}, message: ${response?.message}, url: ${url}, responseUrl: ${response?.request?.res?.responseUrl}`);
}

/**
 * Example: '2021-06-03T18:51:30.793Z' -> 20210603
 */
export function createLongDateString(date = null) {
  const dateVal = date && typeof date.getMonth === 'function' ? date : new Date();
  const isoVal = dateVal.toISOString();
  return `${isoVal.substr(0, 4)}${isoVal.substr(5, 2)}${isoVal.substr(8, 2)}`;
}

/**
 * Example: '2021-06-03T18:51:30.793Z' -> 210603185130
 */
export function createShortDatetimeString(date = null) {
  const dateVal = date === null ? new Date() : date;
  const isoVal = dateVal.toISOString();
  return `${isoVal.substr(0, 2)}${isoVal.substr(5, 2)}${isoVal.substr(8, 2)}${isoVal.substr(11, 2)}${isoVal.substr(14, 2)}${isoVal.substr(17, 2)}`;
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
    return d;
  }
  return null;
}

export function ensureOddsOrNull(val) {
  if (typeof val === 'string') {
    return parseFloat(val);
  }
  if (typeof val === 'number') {
    return val;
  }
  return null;
}

export function ensureVolumeOrNull(val) {
  if (typeof val === 'string') {
    return parseInt(val, 10);
  }
  if (typeof val === 'number') {
    return val;
  }
  return null;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function sleep(ms, flRandomize = true) {
  const msRandom = flRandomize ? ((getRandomIntInclusive(50, 150) / 100) * ms).toFixed(0) : ms;
  return new Promise((resolve) => setTimeout(resolve, msRandom));
}

function getRandomIntInclusive(min, max) {
  const ceilMin = Math.ceil(min);
  const floorMax = Math.floor(max);
  return Math.floor(Math.random() * (floorMax - ceilMin + 1) + ceilMin); // The maximum is inclusive and the minimum is inclusive
}
