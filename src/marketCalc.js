import { CustomError } from './exceptions';

/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');
const { createLogger } = require('./lib/loggerlib');

const log = createLogger();

const W = 1;
const L = -1;
const D = 0;

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function calcMarket(match, score, betArgs) {
  try {
    switch (betArgs.bt) {
      case config.betType['1X2'].id:
        return backOrLay(betArgs.isBack, calcMatch(score));
      case config.betType['O/U'].id:
        return backOrLay(betArgs.isBack, calcOU(score, betArgs.attributes.value1));
      case config.betType['Home/Away'].id:
        return backOrLay(betArgs.isBack, calcHomeAway(score));
      case config.betType.DC.id:
        return backOrLay(betArgs.isBack, calcDC(score));
      case config.betType.AH.id:
        return backOrLay(betArgs.isBack, calcAH(score, betArgs.attributes.value1));
      case config.betType.DNB.id:
        return backOrLay(betArgs.isBack, calcDNB(score));
      case config.betType.CS.id:
        return backOrLay(betArgs.isBack, calcCS(score, betArgs.attributes.value1, betArgs.attributes.value2));
      case config.betType['HT/FT'].id:
        return backOrLay(betArgs.isBack, calcHTFT(score, betArgs.attributes.value1, betArgs.attributes.value2, match));
      case config.betType.EH.id:
        return backOrLay(betArgs.isBack, calcEH(score, betArgs.attributes.value1));
      case config.betType.BTS.id:
        return backOrLay(betArgs.isBack, calcBTS(score));
      case config.betType['O/E'].id:
        return backOrLay(betArgs.isBack, calcOE(score));
      default:
        log.debug('calcMarket is null for:', score, betArgs, match.url, match.params, match.matchScore);
        throw new Error(`Unexpected betType: ${betArgs.bt}`);
    }
  } catch (error) {
    throw new CustomError('Failed calc market', { errorMsg: error.message, score, betArgs, error });
  }
}

function backOrLay(isBack, result) {
  if (result === null) {
    return result;
  }
  if (isBack) {
    return result;
  }
  // for lay, reverse result!
  return {
    outcome: result.outcome,
    win1: result.win1 ? -1 * result.win1 : null,
    win2: result.win2 ? -1 * result.win2 : null,
    win3: result.win3 ? -1 * result.win3 : null
  };
}

function getOutcome(home, away) {
  if (home > away) {
    return 1;
  }
  if (home === away) {
    return 2;
  }
  if (home < away) {
    return 3;
  }
  log.debug('getOutcome is null for:', home, away);
  throw new CustomError('Failed getOutcome', { home, away });
}

const is1 = (score) => score.home > score.away;
const isX = (score) => score.home === score.away;
const is2 = (score) => score.home < score.away;
const isCS = (score, goals1, goals2) => score.home === goals1 && score.away === goals2;
const isOver = (score, goals) => score.home + score.away > goals;
const isEqual = (score, goals) => score.home + score.away === goals;
const isUnder = (score, goals) => score.home + score.away < goals;
const isBTSYes = (score) => score.home > 0 && score.away > 0;
const isBTSNo = (score) => score.home === 0 || score.away === 0;
const isOdd = (score) => (score.home + score.away) % 2 === 1;
const isEven = (score) => (score.home + score.away) % 2 === 0;
const isHTFT = (htRes, ftRes, htBet, ftBet) => htRes === htBet && ftRes === ftBet;

function calcMatch(score) {
  if (is1(score)) {
    return r(1, W, L, L);
  }
  if (isX(score)) {
    return r(2, L, W, L);
  }
  if (is2(score)) {
    return r(3, L, L, W);
  }
  log.debug('calcMatch is null for:', score);
  throw new CustomError('Failed calcMatch', { score });
}

function calcHomeAway(score) {
  if (is1(score)) {
    return r(1, W, L);
  }
  if (is2(score)) {
    return r(2, L, W);
  }
  if (isX(score)) {
    return r(0, D, D);
  }
  log.debug('calcHomeAway is null for:', score);
  throw new CustomError('Failed calcHomeAway', { score });
}

function calcDC(score) {
  if (is1(score)) {
    return r(3, W, W, L);
  }
  if (isX(score)) {
    return r(4, W, L, W);
  }
  if (is2(score)) {
    return r(5, L, W, W);
  }
  log.debug('calcDC is null for:', score);
  throw new CustomError('Failed calcDC', { score });
}

function calcDNB(score) {
  if (is1(score)) {
    return r(1, W, L);
  }
  if (is2(score)) {
    return r(2, L, W);
  }
  if (isX(score)) {
    return r(0, D, D);
  }
  log.debug('calcDNB is null for:', score);
  throw new CustomError('Failed calcDNB', { score });
}

function calcCS(score, goals1, goals2) {
  return isCS(score, goals1, goals2) ? r(1, W) : r(0, L);
}

function calcBTS(score) {
  if (isBTSYes(score)) {
    return r(1, W, L);
  }
  if (isBTSNo(score)) {
    return r(2, L, W);
  }
  log.debug('calcBTS is null for:', score);
  throw new CustomError('Failed calcBTS', { score });
}

function calcOE(score) {
  if (isOdd(score)) {
    return r(1, W, L);
  }
  if (isEven(score)) {
    return r(2, L, W);
  }
  log.debug('calcOE is null for:', score);
  throw new CustomError('Failed calcOE', { score });
}

function calcHTFT(score, outcomeHT, outcomeFT, match) {
  const ht = getOutcome(match.sc3_1, match.sc3_2);
  const ft = getOutcome(score.home, score.away);

  return isHTFT(ht, ft, outcomeHT, outcomeFT) ? r(1, W) : r(0, L);
}

function calcEH(score, handicap) {
  const newScore = { ...score };
  newScore.home += handicap;
  newScore.away = score.away;

  if (is1(newScore)) {
    return r(1, W, L, L);
  }
  if (isX(newScore)) {
    return r(2, L, W, L);
  }
  if (is2(newScore)) {
    return r(3, L, L, W);
  }
  log.debug('calcEH is null for:', score, handicap);
  throw new CustomError('Failed calcEH', { score, handicap });
}

function calcOU(score, tg) {
  const decimalPart = tg - Math.trunc(tg);
  switch (decimalPart) {
    case 0:
      return calcOUEven(score, tg);
    case 0.25:
      return calcOUSplit(score, tg);
    case 0.5:
      return calcOUHalf(score, tg);
    case 0.75:
      return calcOUSplit(score, tg);
    default:
      log.debug('calcOU is null for:', score, tg);
      throw new CustomError('Failed calcOU', { score, tg });
  }
}

function calcOUEven(score, tg) {
  if (isOver(score, tg)) {
    return r(1, W, L);
  }
  if (isEqual(score, tg)) {
    return r(0, D, D);
  }
  if (isUnder(score, tg)) {
    return r(2, L, W);
  }
  log.debug('calcOUEven is null for:', score, tg);
  throw new CustomError('Failed calcOUEven', { score, tg });
}

function calcOUHalf(score, tg) {
  if (isOver(score, tg)) {
    return r(1, W, L);
  }
  if (isUnder(score, tg)) {
    return r(2, L, W);
  }
  throw new CustomError('Failed calcOUHalf', { score, tg });
}

function calcOUSplit(score, tg) {
  const resultBet1 = calcOU(score, tg + 0.25);
  const resultBet2 = calcOU(score, tg - 0.25);
  const win1 = (resultBet1.win1 + resultBet2.win1) / 2;
  const win2 = (resultBet1.win2 + resultBet2.win2) / 2;

  let outcome;
  if (win1 + win2 < 0) {
    outcome = -1;
  } else if (win1 > win2) {
    outcome = 1;
  } else if (win1 === win2) {
    outcome = 0;
  } else {
    outcome = win1 < win2 ? 2 : -1;
  }

  return r(outcome, win1, win2);
}

function calcAH(score, handicap) {
  const decimalPart = handicap - Math.trunc(handicap);
  const decimalPartAbs = Math.abs(decimalPart);
  switch (decimalPartAbs) {
    case 0:
      return calcAH00(score, handicap);
    case 0.25:
      return calcAHSplit(score, handicap);
    case 0.5:
      return calcAH50(score, handicap);
    case 0.75:
      return calcAHSplit(score, handicap);
    default:
      log.debug('Not supported AH:', handicap, score);
      return null;
  }
}

function calcAH00Outcome(score) {
  if (is1(score)) {
    return r(1, W, L);
  }
  if (isX(score)) {
    return r(0, D, D);
  }
  if (is2(score)) {
    return r(2, L, W);
  }
  log.debug('calcAH00Outcome is null for:', score);
  throw new CustomError('Failed calcAH00Outcome', { score });
}

function calcAH00(score, handicap) {
  const newScore = { ...score };
  newScore.home += handicap;
  newScore.away = score.away;
  const result = calcAH00Outcome(newScore);
  const win1 = result.win1;
  const win2 = result.win2;

  let outcome;
  if (win1 + win2 < 0) {
    outcome = -1;
  } else if (win1 > win2) {
    outcome = 1;
  } else if (win1 === win2) {
    outcome = 0;
  } else {
    outcome = win1 < win2 ? 2 : -1;
  }

  return r(outcome, win1, win2);
}

function calcAH50Outcome(score) {
  if (is1(score)) {
    return r(1, W, L);
  }
  if (is2(score)) {
    return r(2, L, W);
  }
  log.debug('calcAH50Outcome is null for:', score);
  throw new CustomError('Failed calcAH50Outcome', { score });
}

function calcAH50(score, handicap) {
  const newScore = { ...score };
  newScore.home += handicap;
  newScore.away = score.away;
  const result = calcAH50Outcome(newScore);
  const win1 = result.win1;
  const win2 = result.win2;

  let outcome;
  if (win1 + win2 < 0) {
    outcome = -1;
  } else if (win1 > win2) {
    outcome = 1;
  } else if (win1 === win2) {
    outcome = 0;
  } else {
    outcome = win1 < win2 ? 2 : -1;
  }

  return r(outcome, win1, win2);
}

function calcAHSplit(score, handicap) {
  const resultBet1 = calcAH(score, handicap - 0.25);
  const resultBet2 = calcAH(score, handicap + 0.25);
  const win1 = (resultBet1.win1 + resultBet2.win1) / 2;
  const win2 = (resultBet1.win2 + resultBet2.win2) / 2;

  let outcome;
  if (win1 + win2 < 0) {
    outcome = -1;
  } else if (win1 > win2) {
    outcome = 1;
  } else if (win1 === win2) {
    outcome = 0;
  } else {
    outcome = win1 < win2 ? 2 : -1;
  }

  return r(outcome, win1, win2);
}

function r(outcome = null, win1 = null, win2 = null, win3 = null) {
  return createResult(outcome, win1, win2, win3);
}

function createResult(outcome = null, win1 = null, win2 = null, win3 = null) {
  return {
    outcome,
    win1,
    win2,
    win3
  };
}
