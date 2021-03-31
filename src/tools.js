'use strict';

// DECLARES -----------------------------------------------------------------------------

const { createLogger, deleteLogFiles } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

/*
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
*/

export function createHttpRequestConfig() {
  return {
    headers: {
      referer: 'https://www.oddsportal.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.190 Safari/537.36'
    }
  };
}

export function logHttpRequestError(response, url = '') {
  log.verbose(
    `Error response, status: ${response?.status}, statusText: ${response?.statusText}, message: ${response?.message}, url: ${url}, responseUrl: ${response?.request?.res?.responseUrl}`
  );
}
