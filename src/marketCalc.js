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

export function calcMarket(match, scores, betArgs) {
  try {
    switch (betArgs.bt) {
      case config.bt.Match:
        return backOrLay(betArgs.isBack, calcMatch(scores));
      case config.bt.OU:
        return backOrLay(betArgs.isBack, calcOU(scores, betArgs.attributes.value1));
      case config.bt.HomeAway:
        return backOrLay(betArgs.isBack, calcHomeAway(scores));
      case config.bt.DC:
        return backOrLay(betArgs.isBack, calcDC(scores));
      case config.bt.AH:
        return backOrLay(betArgs.isBack, calcAH(scores, betArgs.attributes.value1));
      case config.bt.DNB:
        return backOrLay(betArgs.isBack, calcDNB(scores));
      case config.bt.CS:
        return backOrLay(betArgs.isBack, calcCS(scores, betArgs.attributes.value1, betArgs.attributes.value2));
      case config.bt.HTFT:
        return backOrLay(betArgs.isBack, calcHTFT(scores, betArgs.attributes.value1, betArgs.attributes.value2, match));
      case config.bt.EH:
        return backOrLay(betArgs.isBack, calcEH(scores, betArgs.attributes.value1));
      case config.bt.BTS:
        return backOrLay(betArgs.isBack, calcBTS(scores));
      case config.bt.OE:
        return backOrLay(betArgs.isBack, calcOE(scores));
      default:
        log.debug('calcMarket is null for:', scores, betArgs, match.url, match.params, match.score);
        throw new Error(`Unexpected betType: ${betArgs.bt}`);
    }
  } catch (error) {
    throw new CustomError('Failed calc market', { errorMsg: error.message, scores, betArgs, error });
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

function getOutcome(score1, score2) {
  if (score1 > score2) {
    return 1;
  }
  if (score1 === score2) {
    return 2;
  }
  if (score1 < score2) {
    return 3;
  }
  log.debug('getOutcome is null for:', score1, score2);
  throw new CustomError('Failed getOutcome', { score1, score2 });
}

const is1 = (scores) => scores._1 > scores._2;
const isX = (scores) => scores._1 === scores._2;
const is2 = (scores) => scores._1 < scores._2;
const isCS = (scores, goals1, goals2) => scores._1 === goals1 && scores._2 === goals2;
const isOver = (scores, goals) => scores._1 + scores._2 > goals;
const isEqual = (scores, goals) => scores._1 + scores._2 === goals;
const isUnder = (scores, goals) => scores._1 + scores._2 < goals;
const isBTSYes = (scores) => scores._1 > 0 && scores._2 > 0;
const isBTSNo = (scores) => scores._1 === 0 || scores._2 === 0;
const isOdd = (scores) => (scores._1 + scores._2) % 2 === 1;
const isEven = (scores) => (scores._1 + scores._2) % 2 === 0;
const isHTFT = (htRes, ftRes, htBet, ftBet) => htRes === htBet && ftRes === ftBet;

function calcMatch(scores) {
  if (is1(scores)) {
    return r(1, W, L, L);
  }
  if (isX(scores)) {
    return r(2, L, W, L);
  }
  if (is2(scores)) {
    return r(3, L, L, W);
  }
  log.debug('calcMatch is null for:', scores);
  throw new CustomError('Failed calcMatch', { scores });
}

function calcHomeAway(scores) {
  if (is1(scores)) {
    return r(1, W, L);
  }
  if (is2(scores)) {
    return r(2, L, W);
  }
  log.debug('calcHomeAway is null for:', scores);
  throw new CustomError('Failed calcHomeAway', { scores });
}

function calcDC(scores) {
  if (is1(scores)) {
    return r(3, W, W, L);
  }
  if (isX(scores)) {
    return r(4, W, L, W);
  }
  if (is2(scores)) {
    return r(5, L, W, W);
  }
  log.debug('calcDC is null for:', scores);
  throw new CustomError('Failed calcDC', { scores });
}

function calcDNB(scores) {
  if (is1(scores)) {
    return r(1, W, L);
  }
  if (is2(scores)) {
    return r(2, L, W);
  }
  if (isX(scores)) {
    return r(0, D, D);
  }
  log.debug('calcDNB is null for:', scores);
  throw new CustomError('Failed calcDNB', { scores });
}

function calcCS(scores, goals1, goals2) {
  return isCS(scores, goals1, goals2) ? r(1, W) : r(0, L);
}

function calcBTS(scores) {
  if (isBTSYes(scores)) {
    return r(1, W, L);
  }
  if (isBTSNo(scores)) {
    return r(2, L, W);
  }
  log.debug('calcBTS is null for:', scores);
  throw new CustomError('Failed calcBTS', { scores });
}

function calcOE(scores) {
  if (isOdd(scores)) {
    return r(1, W, L);
  }
  if (isEven(scores)) {
    return r(2, L, W);
  }
  log.debug('calcOE is null for:', scores);
  throw new CustomError('Failed calcOE', { scores });
}

function calcHTFT(scores, outcomeHT, outcomeFT, match) {
  const ht = getOutcome(match.sc3_1, match.sc3_2);
  const ft = getOutcome(scores._1, scores._2);

  return isHTFT(ht, ft, outcomeHT, outcomeFT) ? r(1, W) : r(0, L);
}

function calcEH(scores, handicap) {
  const newScores = { ...scores };
  newScores._1 += handicap;
  newScores._2 = scores._2;

  if (is1(newScores)) {
    return r(1, W, L, L);
  }
  if (isX(newScores)) {
    return r(2, L, W, L);
  }
  if (is2(newScores)) {
    return r(3, L, L, W);
  }
  log.debug('calcEH is null for:', scores, handicap);
  throw new CustomError('Failed calcEH', { scores, handicap });
}

function calcOU(scores, tg) {
  const decimalPart = tg - Math.trunc(tg);
  switch (decimalPart) {
    case 0:
      return calcOUEven(scores, tg);
    case 0.25:
      return calcOUSplit(scores, tg);
    case 0.5:
      return calcOUHalf(scores, tg);
    case 0.75:
      return calcOUSplit(scores, tg);
    default:
      log.debug('calcOU is null for:', scores, tg);
      throw new CustomError('Failed calcOU', { scores, tg });
  }
}

function calcOUEven(scores, tg) {
  if (isOver(scores, tg)) {
    return r(1, W, L);
  }
  if (isEqual(scores, tg)) {
    return r(0, D, D);
  }
  if (isUnder(scores, tg)) {
    return r(2, L, W);
  }
  log.debug('calcOUEven is null for:', scores, tg);
  throw new CustomError('Failed calcOUEven', { scores, tg });
}

function calcOUHalf(scores, tg) {
  if (isOver(scores, tg)) {
    return r(1, W, L);
  }
  if (isUnder(scores, tg)) {
    return r(2, L, W);
  }
  throw new CustomError('Failed calcOUHalf', { scores, tg });
}

function calcOUSplit(scores, tg) {
  const resultBet1 = calcOU(scores, tg + 0.25);
  const resultBet2 = calcOU(scores, tg - 0.25);
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

function calcAH(scores, handicap) {
  const decimalPart = handicap - Math.trunc(handicap);
  const decimalPartAbs = Math.abs(decimalPart);
  switch (decimalPartAbs) {
    case 0:
      return calcAH00(scores, handicap);
    case 0.25:
      return calcAHSplit(scores, handicap);
    case 0.5:
      return calcAH50(scores, handicap);
    case 0.75:
      return calcAHSplit(scores, handicap);
    default:
      log.debug('Not supported AH:', handicap, scores);
      return null;
  }
}

function calcAH00Outcome(scores) {
  if (is1(scores)) {
    return r(1, W, L);
  }
  if (isX(scores)) {
    return r(0, D, D);
  }
  if (is2(scores)) {
    return r(2, L, W);
  }
  log.debug('calcAH00Outcome is null for:', scores);
  throw new CustomError('Failed calcAH00Outcome', { scores });
}

function calcAH00(scores, handicap) {
  const newScores = { ...scores };
  newScores._1 += handicap;
  newScores._2 = scores._2;
  const result = calcAH00Outcome(newScores);
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

function calcAH50Outcome(scores) {
  if (is1(scores)) {
    return r(1, W, L);
  }
  if (is2(scores)) {
    return r(2, L, W);
  }
  log.debug('calcAH50Outcome is null for:', scores);
  throw new CustomError('Failed calcAH50Outcome', { scores });
}

function calcAH50(scores, handicap) {
  const newScores = { ...scores };
  newScores._1 += handicap;
  newScores._2 = scores._2;
  const result = calcAH50Outcome(newScores);
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

function calcAHSplit(scores, handicap) {
  const resultBet1 = calcAH(scores, handicap - 0.25);
  const resultBet2 = calcAH(scores, handicap + 0.25);
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
