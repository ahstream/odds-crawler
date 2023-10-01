// DECLARES -----------------------------------------------------------------------------

const assert = require('assert');
const _ = require('lodash');

const config = require('../../config/config.json');
const { createLogger } = require('../lib/loggerlib');
const utilslib = require('../lib/utilslib');
const scorelib = require('../score/score.js');

const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function getOutcomeList(oddsFeed) {
  const outcomeList = [];
  Object.keys(oddsFeed.OutcomeID).forEach((key, _index) => {
    const num = parseInt(key, 10) + 1;
    const id = oddsFeed.OutcomeID[key];
    outcomeList.push(createOutcomeArgs(num, key, id));
  });
  return outcomeList;
}

function createOutcomeArgs(num, key, id) {
  return { num, key, id };
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