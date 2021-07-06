/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const { createLogger } = require('./lib/loggerlib');
const marketoddslib = require('./marketOdds.js');
const matchlib = require('./match.js');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function processMatchOdds(match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem) {
  const oddsId = createId(match, betArgs, outcomeArgs, bookieArgs);

  if (matchlib.isFinished(match)) {
    // match.odds[oddsId] = createOdds(oddsId, match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem);
    marketoddslib.addMarketOdds(match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem);
  }

  return oddsId;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function createId(match, betArgs, outcomeArgs, bookieArgs) {
  return `${match.id}_${betArgs.bt}_${betArgs.sc}_${betArgs.isBack}_${betArgs.attribute}_${betArgs.attributeType}_${outcomeArgs.num}_${bookieArgs.id}`;
}

function createOdds(id, match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem) {
  return {
    id,
    matchId: match.id,
    marketId,
    // betName: betArgs.betName,
    // bt,
    // sc,
    // back,
    // attribute,
    // attributeValue1: attributes.value1,
    // attributeValue2: attributes.value2,

    betArgs,
    outcome: outcomeArgs.num,
    bookie: bookieArgs.num,

    openingOdds: completeOddsItem.opening.odds,
    openingDate: completeOddsItem.opening.date,
    openingVolume: completeOddsItem.opening.volume,

    closingOdds: completeOddsItem.closing.odds,
    closingDate: completeOddsItem.closing.date,
    closingVolume: completeOddsItem.closing.volume
  };
}
