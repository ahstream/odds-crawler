/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');
const { createLogger } = require('./lib/loggerlib');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export const metaData = {};

export function add(category, keys, url) {
  if (!metaData[category]) {
    metaData[category] = {};
  }
  let ptr = metaData[category];
  keys.forEach(key => {
    if (ptr[key] === undefined) {
      ptr[key] = {};
    }
    ptr = ptr[key];
  });
  ptr.ct = typeof ptr.ct === 'number' ? ptr.ct + 1 : 1;
  ptr.url = url;

  return ptr;
}

export function debug() {
  log.verbose(JSON.stringify(metaData));
}
