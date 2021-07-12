/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function getSportId(name) {
  return config.sport.id[name];
}

export function getSportName(id) {
  return config.sport.name[id];
}

export function getMinMaxMatchLength(sportName) {
  const len = config.sport.matchLength[sportName];
  if (Array.isArray(len)) {
    return { min: len[0], max: len[1] };
  }
  if (typeof len === 'number') {
    return { min: len, max: len };
  }
  return { min: -1, max: -1 };
}
