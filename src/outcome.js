/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function getOutcomeList(oddsFeed) {
  const outcomeList = [];

  Object.keys(oddsFeed.OutcomeID).forEach((key, _index) => {
    const num = parseInt(key, 10) + 1;
    const id = oddsFeed.OutcomeID[key];
    outcomeList.push(createOutcomeArgs(num, key, id));
  });

  return outcomeList;
}

export function expectedNumOfOutcomes(bt) {
  switch (bt) {
    case config.betType['1X2'].id:
      return 3;
    case config.betType['O/U'].id:
      return 2;
    case config.betType.DC.id:
      return 3;
    case config.betType.AH.id:
      return 2;
    case config.betType.DNB.id:
      return 2;
    case config.betType.CS.id:
      return 1;
    case config.betType['HT/FT'].id:
      return 1;
    case config.betType.EH.id:
      return 3;
    case config.betType.BTS.id:
      return 2;
    case config.betType['O/E'].id:
      return 2;
    default:
      return null;
  }
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function createOutcomeArgs(num, key, id) {
  return { num, key, id };
}
