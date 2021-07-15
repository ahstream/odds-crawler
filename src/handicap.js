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

export function getHandicapName(handicapType) {
  const objKey = Object.keys(config.handicap).find(key => config.handicap[key].id === handicapType);
  return config.handicap[objKey]?.name;
}

export function convertHandicapType(sport, bt, sc, handicapType) {
  if (sport === 'snooker' && bt === config.betType['O/U'].id && handicapType === config.handicap['0'].id) {
    return config.handicap['4'].id;
  }
  if (sport === 'snooker' && bt === config.betType.AH.id && handicapType === config.handicap['0'].id) {
    return config.handicap['4'].id;
  }
  return handicapType;
}

export function getHandicapSign(handicapValue) {
  if (handicapValue > 0) {
    return '+';
  }
  if (handicapValue < 0) {
    return '';
  }
  return '';
}
