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

export function getSportId(sportName) {
  const objKey = Object.keys(config.sport).find(key => config.sport[key].name === sportName);
  return config.sport[objKey]?.id;
}

export function getSportName(sportId) {
  const objKey = Object.keys(config.sport).find(key => config.sport[key].id === sportId);
  return config.sport[objKey]?.name;
}

export function getMatchLength(sportName) {
  const objKey = Object.keys(config.sport).find(key => config.sport[key].name === sportName);
  const matchLength = config.sport[objKey]?.matchLength;
  if (Array.isArray(matchLength)) {
    return { min: matchLength[0], max: matchLength[1] };
  }
  if (typeof matchLength === 'number') {
    return { min: matchLength, max: matchLength };
  }
  return { min: null, max: null };
}
