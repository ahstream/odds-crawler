import { scopeToScoreSuffix } from './score';

/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const { createLogger } = require('./lib/loggerlib');
const marketcalclib = require('./marketCalc');
const scorelib = require('./score.js');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function addMarketResult(market, match, betArgs) {
  const scoreSuffix = scorelib.scopeToScoreSuffix(market.sc);
  const score1 = match.score[`score1${scoreSuffix}`];
  const score2 = match.score[`score2${scoreSuffix}`];
  if (score1 === null || score2 === null) {
    log.info('No scores for scope:', scoreSuffix, market.sc, score1, score2)
    log.debug('No scores for scope:', scoreSuffix, market.sc, match.score, betArgs, match.url)
    return;
  }
  const scores = scorelib.createScores(score1, score2);

  const marketCalc = marketcalclib.calcMarket(match, scores, betArgs);
  if (marketCalc === null || marketCalc.outcome === null) {
    log.info('marketCalc is null for betArgs:', betArgs);
    return;
  }

  const marketResult = createMarketResult(market.id);

  marketResult.score1 = score1;
  marketResult.score2 = score2;
  marketResult.outcome = marketCalc.outcome;

  marketResult.win1 = marketCalc.win1;
  marketResult.win2 = marketCalc.win2;
  marketResult.win3 = marketCalc.win3;

  match.marketResult[market.id] = marketResult;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function createMarketResult(marketId) {
  return {
    marketId,
    score1: null,
    score2: null,
    outcome: null,
    win1: null,
    win2: null,
    win3: null
  };
}
