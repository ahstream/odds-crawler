'use strict';

import { result } from 'lodash';

// DECLARES -----------------------------------------------------------------------------

const config = require('../config/config.json');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// CONSTANTS FUNCTIONS -----------------------------------------------------------------------------

const W = 1;
const L = -1;
const D = 0;

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function calcMarket(scores, bt, sc, isBack, attributes, event) {
  // log.info('scores, bt, sc, attributes', scores, bt, sc, attributes);
  let result = null;
  switch (bt) {
    case config.bt.Match:
      return backOrLay(isBack, calcMatch(scores));
    case config.bt.OU:
      return backOrLay(isBack, calcOU(scores, attributes.attribute1));
    case config.bt.DC:
      return backOrLay(isBack, calcDC(scores));
    case config.bt.AH:
      return backOrLay(isBack, calcAH(scores, attributes.attribute1));
    case config.bt.DNB:
      return backOrLay(isBack, calcDNB(scores));
    case config.bt.CS:
      return backOrLay(isBack, calcCS(scores, attributes.attribute1, attributes.attribute2));
    case config.bt.HTFT:
      return backOrLay(isBack, calcHTFT(scores, attributes.attribute1, attributes.attribute2, event));
    case config.bt.EH:
      return backOrLay(isBack, calcEH(scores, attributes.attribute1));
    case config.bt.BTS:
      return backOrLay(isBack, calcBTS(scores));
    case config.bt.OE:
      return backOrLay(isBack, calcOE(scores));
    default:
      return null;
  }
}

function backOrLay(isBack, result) {
  if (result === null) {
    return result;
  }
  if (isBack) {
    return result;
  } else {
    // for lay, reverse result!
    return {
      outcome: result.outcome,
      win_1: result.win_1 ? -1 * result.win_1 : null,
      win_2: result.win_2 ? -1 * result.win_2 : null,
      win_3: result.win_3 ? -1 * result.win_3 : null
    };
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

const getOutcome = (score_1, score_2) => (score_1 > score_2 ? 1 : score_1 === score_2 ? 2 : score_1 < score_2 ? 3 : null);

const is1 = (scores) => scores._1 > scores._2;
const isX = (scores) => scores._1 == scores._2;
const is2 = (scores) => scores._1 < scores._2;
const isCS = (scores, goals_1, goals_2) => scores._1 == goals_1 && scores._2 == goals_2;
const isOver = (scores, goals) => scores._1 + scores._2 > goals;
const isEqual = (scores, goals) => scores._1 + scores._2 == goals;
const isUnder = (scores, goals) => scores._1 + scores._2 < goals;
const isBTSYes = (scores) => scores._1 > 0 && scores._2 > 0;
const isBTSNo = (scores) => scores._1 == 0 || scores._2 == 0;
const isOdd = (scores) => (scores._1 + scores._2) % 2 == 1;
const isEven = (scores) => (scores._1 + scores._2) % 2 == 0;
const isHTFT = (ht_res, ft_res, ht_bet, ft_bet) => ht_res == ht_bet && ft_res == ft_bet;

function calcMatch(scores) {
  return is1(scores) ? r(1, W, L, L) : isX(scores) ? r(2, L, W, L) : is2(scores) ? r(3, L, L, W) : null;
}

function calcDC(scores) {
  return is1(scores) ? r(3, W, W, L) : isX(scores) ? r(4, W, L, W) : is2(scores) ? r(5, L, W, W) : null;
}

function calcDNB(scores) {
  return is1(scores) ? r(1, W, L) : is2(scores) ? r(2, L, W) : isX(scores) ? r(0, D, D) : null;
}

function calcCS(scores, goals_1, goals_2) {
  return isCS(scores, goals_1, goals_2) ? r(1, W) : r(0, L);
}

function calcBTS(scores) {
  return isBTSYes(scores) ? r(1, W, L) : isBTSNo(scores) ? r(2, L, W) : null;
}

function calcOE(scores) {
  return isOdd(scores) ? r(1, W, L) : isEven(scores) ? r(2, L, W) : null;
}

function calcHTFT(scores, outcomeHT, outcomeFT, event) {
  const ht = getOutcome(event.score.sc3_1, event.score.sc3_2);
  const ft = getOutcome(scores._1, scores._2);

  return isHTFT(ht, ft, outcomeHT, outcomeFT) ? r(1, W) : r(0, L);
}

function calcEH(scores, handicap) {
  const newScores = { ...scores };
  newScores._1 = newScores._1 + handicap;
  newScores._2 = newScores._2;

  return is1(newScores) ? r(1, W, L, L) : isX(newScores) ? r(2, L, W, L) : is2(newScores) ? r(3, L, L, W) : null;
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
      return null;
  }
}

function calcOUEven(scores, tg) {
  return isOver(scores, tg) ? r(1, W, L) : isEqual(scores, tg) ? r(0, D, D) : isUnder(scores, tg) ? r(2, L, W) : null;
}

function calcOUHalf(scores, tg) {
  return isOver(scores, tg) ? r(1, W, L) : isUnder(scores, tg) ? r(2, L, W) : null;
}

function calcOUSplit(scores, tg) {
  const resultBet1 = calcOU(scores, tg + 0.25);
  const resultBet2 = calcOU(scores, tg - 0.25);
  const win_1 = (resultBet1.win_1 + resultBet2.win_1) / 2;
  const win_2 = (resultBet1.win_2 + resultBet2.win_2) / 2;
  const outcome = win_1 + win_2 < 0 ? -1 : win_1 > win_2 ? 1 : win_1 == win_2 ? 0 : win_1 < win_2 ? 2 : -1;

  return r(outcome, win_1, win_2);
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
      return null;
  }
}

function calcAH00Outcome(scores) {
  return is1(scores) ? r(1, W, L) : isX(scores) ? r(0, D, D) : is2(scores) ? r(2, L, W) : null;
}

function calcAH00(scores, handicap) {
  const newScores = { ...scores };
  newScores._1 = newScores._1 + handicap;
  newScores._2 = newScores._2;
  const result = calcAH00Outcome(newScores);
  const win_1 = result.win_1;
  const win_2 = result.win_2;
  const outcome = win_1 + win_2 < 0 ? -1 : win_1 > win_2 ? 1 : win_1 == win_2 ? 0 : win_1 < win_2 ? 2 : -1;

  return r(outcome, win_1, win_2);
}

function calcAH50Outcome(scores) {
  return is1(scores) ? r(1, W, L) : is2(scores) ? r(2, L, W) : null;
}

function calcAH50(scores, handicap) {
  const newScores = { ...scores };
  newScores._1 = newScores._1 + handicap;
  newScores._2 = newScores._2;
  const result = calcAH50Outcome(newScores);
  const win_1 = result.win_1;
  const win_2 = result.win_2;
  const outcome = win_1 + win_2 < 0 ? -1 : win_1 > win_2 ? 1 : win_1 == win_2 ? 0 : win_1 < win_2 ? 2 : -1;

  return r(outcome, win_1, win_2);
}

function calcAHSplit(scores, handicap) {
  const resultBet1 = calcAH(scores, handicap - 0.25);
  const resultBet2 = calcAH(scores, handicap + 0.25);
  const win_1 = (resultBet1.win_1 + resultBet2.win_1) / 2;
  const win_2 = (resultBet1.win_2 + resultBet2.win_2) / 2;
  const outcome = win_1 + win_2 < 0 ? -1 : win_1 > win_2 ? 1 : win_1 == win_2 ? 0 : win_1 < win_2 ? 2 : -1;

  return r(outcome, win_1, win_2);
}

function r(outcome = null, win_1 = null, win_2 = null, win_3 = null) {
  return createMarketResult(outcome, win_1, win_2, win_3);
}

function createMarketResult(outcome = null, win_1 = null, win_2 = null, win_3 = null) {
  return {
    outcome,
    win_1,
    win_2,
    win_3
  };
}
