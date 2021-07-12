/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');
const { createLogger } = require('./lib/loggerlib');
const marketcalclib = require('./marketCalc');
const matchscorelib = require('./matchScore.js');
const scopelib = require('./scope.js');
const scorelib = require('./score.js');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

function getScopeScore(match, sc) {
  const scopeName = scopelib.getScopeName(sc);
  return scorelib.createScore(match.matchScore.scores[scopeName].home, match.matchScore.scores[scopeName].away);
}

function getSubScopeScores(match, sport) {
  const scores = [];
  switch (sport) {
    case 'tennis':
      scores.push(getScopeScore(match, config.scope.S1.id));
      scores.push(getScopeScore(match, config.scope.S2.id));
      scores.push(getScopeScore(match, config.scope.S3.id));
      scores.push(getScopeScore(match, config.scope.S4.id));
      scores.push(getScopeScore(match, config.scope.S5.id));
      break;
    case 'volleyball':
      scores.push(getScopeScore(match, config.scope.S1.id));
      scores.push(getScopeScore(match, config.scope.S2.id));
      scores.push(getScopeScore(match, config.scope.S3.id));
      break;
    case 'beach-volleyball':
      scores.push(getScopeScore(match, config.scope.S1.id));
      scores.push(getScopeScore(match, config.scope.S2.id));
      scores.push(getScopeScore(match, config.scope.S3.id));
      break;
    default:
      scores.push(getScopeScore(match, config.scope.FT.id));
  }
  const finalScore = scorelib.createScore(0, 0);
  scores.forEach(score => {
    finalScore.home += score.home;
    finalScore.away += score.away;
  });
  return finalScore;
}

function getMarketScore(match, betArgs) {
  const hct = betArgs.handicapType;
  if (hct === 0 || hct === 1) {
    return getScopeScore(match, betArgs.sc);
  }
  if (hct === 2 || hct === 3) {
    if (betArgs.sc === config.scope.FT.id) {
      return getSubScopeScores(match, match.sportName);
    }
    return getScopeScore(match, betArgs.sc);
  }
  log.error('Unexpected handicapType:', betArgs, match.url);
  return null;
}

export function addMarketResult(market, match, betArgs) {
  const score = getMarketScore(match, betArgs);
  if (!score) {
    log.info('No score:', betArgs);
    log.debug('No score:', betArgs, match.matchScore, match.url);
    return;
  }

  const marketCalc = marketcalclib.calcMarket(match, score, betArgs);
  if (marketCalc === null || marketCalc.outcome === null) {
    log.info('marketCalc is null for betArgs:', betArgs);
    return;
  }

  const marketResult = createMarketResult(market.id);

  marketResult.home = score.home;
  marketResult.away = score.away;
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
    home: null,
    away: null,
    outcome: null,
    win1: null,
    win2: null,
    win3: null
  };
}
