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

export function getScopeId(scopeName) {
  const objKey = Object.keys(config.scope).find(key => config.scope[key].name === scopeName);
  return config.scope[objKey]?.id;
}

export function getScopeName(scopeId) {
  const objKey = Object.keys(config.scope).find(key => config.scope[key].id === scopeId);
  return config.scope[objKey]?.name;
}
