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

export function getBetTypeId(betTypeName) {
  const objKey = Object.keys(config.betType).find(key => config.betType[key].name === betTypeName);
  return config.betType[objKey]?.id;
}

export function getBetTypeName(betTypeId) {
  const objKey = Object.keys(config.betType).find(key => config.betType[key].id === betTypeId);
  return config.betType[objKey]?.name;
}
