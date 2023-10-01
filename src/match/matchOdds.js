const { createLogger } = require('../lib/loggerlib');
const marketoddslib = require('../market/marketOdds.js');

const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

export function processMatchOdds(match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem) {
  const oddsId = createId(match, betArgs, outcomeArgs, bookieArgs);
  match.odds[oddsId] = createOdds(oddsId, match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem);
  marketoddslib.addMarketOdds(match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem);
  return oddsId;
}

// HELPERS -----------------------------------------------------------------------------

function createId(match, betArgs, outcomeArgs, bookieArgs) {
  return `${match.id}_${betArgs.bt}_${betArgs.sc}_${betArgs.isBack}_${betArgs.attributeText}_${outcomeArgs.num}_${bookieArgs.id}`;
}

function createOdds(id, match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem) {
  return {
    id, 
    matchId: match.id,
    marketId,

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
