import { CustomError } from './exceptions';

/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const httplib = require('./lib/httplib');
const { createLogger } = require('./lib/loggerlib');
const parser = require('./parser');

const log = createLogger();

const COMMON_HTTP_HEADERS = {
  headers: {
    referer: 'https://www.oddsportal.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36'
  }
};

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function httpGetAllowedHtmltext(urls, delay = 300) {
  const response = await httpGetAllowedResponse(urls, delay);
  const htmltext = getHtmltextFromResponse(response, urls);
  if (!htmltext) {
    throw new CustomError('Failed getting allowed htmltext from URL', { urls, data: response.data });
  }
  return htmltext;
}

export async function httpGetAllowedResponse(urls, delay = 300) {
  let response;
  let ct = 0;

  for (const url of urls) {
    ct++;
    response = await httpGetResponse(url, delay);
    if (!response || !response.data) {
      log.debug('Fail URL (no response)', url);
      continue;
    }
    const error = parser.parseError(response.data);
    if (error) {
      log.debug(`Fail URL (error: ${error})`, url);
      continue;
    }
    if (ct === 2) {
      log.debug(`Got URL on second try!`);
    }
    return response;
  }

  throw new CustomError('Failed getting allowed response from URL', { urls, delay, data: response.data });
}

export async function httpGetResponse(url, delay = 300) {
  const response = await httplib.getResponse(url, COMMON_HTTP_HEADERS);
  if (delay > 0) {
    await sleep(delay);
  }
  return response;
}

export function httpGetManyUrls(urls, maxTries = 10, delayBetweenTries = 300) {
  return httplib.getMany(urls, maxTries, delayBetweenTries, COMMON_HTTP_HEADERS);
}

export function getHtmltextFromResponse(response, url) {
  if (!response || !response.data) {
    throw new CustomError(`No response when getting web page`, { url, response });
  }

  const htmltext = response.data;

  const error = parser.parseError(htmltext);
  if (error) {
    throw new CustomError(`Error ${error} when getting web page`, { url, error, data: response.data });
  }

  return htmltext;
}

export function createLongDateString(date = null) {
  // Example: '2021-06-03T18:51:30.793Z' -> 20210603
  const dateVal = date && typeof date.getMonth === 'function' ? date : new Date();
  const isoVal = dateVal.toISOString();
  return `${isoVal.substr(0, 4)}${isoVal.substr(5, 2)}${isoVal.substr(8, 2)}`;
}

export function createShortDatetimeString(date = null) {
  // Example: '2021-06-03T18:51:30.793Z' -> 210603185130
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

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function sleep(ms, flRandomize = true) {
  const msRandom = flRandomize ? ((getRandomIntInclusive(50, 150) / 100) * ms).toFixed(0) : ms;
  return new Promise((resolve) => setTimeout(resolve, msRandom));
}

function getRandomIntInclusive(min, max) {
  const ceilMin = Math.ceil(min);
  const floorMax = Math.floor(max);
  return Math.floor(Math.random() * (floorMax - ceilMin + 1) + ceilMin);
}
