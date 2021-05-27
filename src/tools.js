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
