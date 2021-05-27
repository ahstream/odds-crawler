'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const scorelib = require('./score.js');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function getOutcomeList(oddsFeed) {
  const outcomeList = new Array();
  Object.keys(oddsFeed.OutcomeID).forEach(function (outcomeKey, outcomeIndex) {
    const outcome = outcomeIndex + 1;
    const outcomeId = oddsFeed.OutcomeID[outcomeKey];
    outcomeList.push({ outcomeKey, outcomeIndex, outcome, outcomeId });
  });
  return outcomeList;
}

export function expectedNumOfOutcomes(bt) {
  switch (bt) {
    case config.bt.Match:
      return 3;
    case config.bt.OU:
      return 2;
    case config.bt.DC:
      return 3;
    case config.bt.AH:
      return 2;
    case config.bt.DNB:
      return 2;
    case config.bt.CS:
      return 1;
    case config.bt.HTFT:
      return 1;
    case config.bt.EH:
      return 3;
    case config.bt.BTS:
      return 2;
    case config.bt.OE:
      return 2;
    default:
      return null;
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------
