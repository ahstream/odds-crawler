/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const _ = require('lodash');

const config = require('../config/config.json');
const { createLogger } = require('./lib/loggerlib');
const sportlib = require('./sport');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function createScore(home, away, homeMeta = null, awayMeta = null) {
  return {
    home,
    away,
    homeMeta,
    awayMeta
  };
}

export function createTiebreak(home, away) {
  return createScore(
    typeof away === 'number' ? _.max([away + 2, 7]) : home,
    typeof home === 'number' ? _.max([home + 2, 7]) : away);
}

export function add(scoreList) {
  return scoreList.reduce(
    (accumulator, currentValue) => {
      if (currentValue === null) {
        return accumulator;
      }
      return createScore(accumulator.home + currentValue.home, accumulator.away + currentValue.away);
    }
    , createScore(0, 0)
  );
}
