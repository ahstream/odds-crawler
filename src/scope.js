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

export function getScopeNth(scopeId) {
  const objKey = Object.keys(config.scope).find(key => config.scope[key].id === scopeId);
  return config.scope[objKey]?.nth;
}

export function isScopeTooLong(scopeId, periods) {
  const nth = getScopeNth(scopeId);
  return typeof nth === 'number' && periods.length > 0 && periods.length < nth;
}

export function convertScope(sport, bt, sc, handicapType) {
  if (sport === 'snooker' && sc === config.scope.FTOT.id) {
    return config.scope.FT.id;
  }
  return sc;
}
