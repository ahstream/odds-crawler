'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const scorelib = require('./score.js');
const betlib = require('./bet.js');
const bookielib = require('./bookie.js');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// CONSTANTS FUNCTIONS -----------------------------------------------------------------------------

const W = 1;
const L = -1;
const D = 0;

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function addMarket(event, bt, sc, back, attributeText, attributes, bookies) {
  try {
    if (!includeMarketOrNot(bt, sc, back, attributes)) {
      return null;
    }

    const marketId = `${event.id}_${bt}_${sc}_${back}_${attributeText}`;
    const market = createMarket(marketId);

    market.eventId = event.id;
    //market.season = event.season;

    market.betName = betlib.calcBetName(bt, sc, attributeText, attributes);
    market.bt = bt;
    market.sc = sc;
    market.back = back;
    market.attributeText = attributeText;
    //market.attribute1 = attributes.attribute1;
    //market.attribute2 = attributes.attribute2;

    const numTotalBookies = Object.keys(bookies).length;
    market.numExcluded = bookielib.countExcluded(bookies);
    market.numBookies = numTotalBookies - market.numExcluded;
    market.numSharp = bookielib.countSharp(bookies);
    market.numSoft = bookielib.countSoft(bookies);
    market.numSwe = bookielib.countSweden(bookies);
    market.numExchanges = bookielib.countExchange(bookies);
    market.numBrokers = bookielib.countBroker(bookies);

    if (event.isFinished) {
      addMarketResult(market, event, bt, sc, back, attributes);
    }

    event.market[marketId] = market;

    return marketId;
  } catch (error) {
    log.error('Error for:', event.url, bt, sc, back, attributeText, attributes);
    throw error;
  }
}

export function includeMarketOrNot(bt, sc, back, attributes) {
  if (back === 0) {
    return false; // Write lay bets to own table?!
  }

  if (sc < 2 || sc > 4) {
    return false; // Only process FT, H1 and H2!
  }

  // todo: check attributes for certain bt:s?
  switch (bt) {
    case config.bt.Match:
    case config.bt.OU:
    case config.bt.DC:
    case config.bt.AH:
    case config.bt.DNB:
    case config.bt.CS:
    case config.bt.HTFT:
    case config.bt.EH:
    case config.bt.BTS:
    case config.bt.OE:
      break; // do nothing
    default:
      return false;
  }

  return true;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

export function addMarketResult(market, event, bt, sc, back, attributes) {
  const score_1 = event[`sc${market.sc}_1`];
  const score_2 = event[`sc${market.sc}_2`];
  const scores = scorelib.createScores(score_1, score_2);
  const marketCalc = calcMarket(event, scores, bt, sc, back, attributes);
  if (marketCalc === null || marketCalc.outcome === null) {
    log.info('marketCalc is null');
    return;
  }

  const marketResult = createMarketResult(market.id);

  marketResult.score_1 = score_1;
  marketResult.score_2 = score_2;
  marketResult.outcome = marketCalc.outcome;

  marketResult.win_1 = marketCalc.win_1;
  marketResult.win_2 = marketCalc.win_2;
  marketResult.win_3 = marketCalc.win_3;

  //marketResult.was_1 = marketCalc.win_1 === null ? null : marketCalc.outcome === 1 ? 1 : 0;
  //marketResult.was_2 = marketCalc.win_2 === null ? null : marketCalc.outcome === 2 ? 1 : 0;
  //marketResult.was_3 = marketCalc.win_3 === null ? null : marketCalc.outcome === 3 ? 1 : 0;

  event.marketResult[market.id] = marketResult;
}

function createMarket(id) {
  return {
    id,
    eventId: null,

    //season: null,

    betName: null,
    bt: null,
    sc: null,
    back: null,
    attributeText: null,
    //attribute1: null,
    //attribute2: null,

    numBookies: null,
    numExcluded: null,
    numSharp: null,
    numSoft: null,
    numSwe: null,
    numExchanges: null,
    numBrokers: null
  };
}

function createMarketResult(marketId) {
  return {
    marketId,
    score_1: null,
    score_2: null,
    outcome: null,
    win_1: null,
    win_2: null,
    win_3: null
  };
}

function calcMarket(event, scores, bt, sc, back, attributes) {
  try {
    switch (bt) {
      case config.bt.Match:
        return backOrLay(back, calcMatch(scores));
      case config.bt.OU:
        return backOrLay(back, calcOU(scores, attributes.attribute1));
      case config.bt.DC:
        return backOrLay(back, calcDC(scores));
      case config.bt.AH:
        return backOrLay(back, calcAH(scores, attributes.attribute1));
      case config.bt.DNB:
        return backOrLay(back, calcDNB(scores));
      case config.bt.CS:
        return backOrLay(back, calcCS(scores, attributes.attribute1, attributes.attribute2));
      case config.bt.HTFT:
        return backOrLay(back, calcHTFT(scores, attributes.attribute1, attributes.attribute2, event));
      case config.bt.EH:
        return backOrLay(back, calcEH(scores, attributes.attribute1));
      case config.bt.BTS:
        return backOrLay(back, calcBTS(scores));
      case config.bt.OE:
        return backOrLay(back, calcOE(scores));
      default:
        return null;
    }
  } catch (error) {
    log.error('Error for:', event.url, scores, bt, sc, back, attributes);
    throw error;
  }
}

function backOrLay(back, result) {
  if (result === null) {
    return result;
  }
  if (back) {
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
  const ht = getOutcome(event.sc3_1, event.sc3_2);
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
  return createResult(outcome, win_1, win_2, win_3);
}

function createResult(outcome = null, win_1 = null, win_2 = null, win_3 = null) {
  return {
    outcome,
    win_1,
    win_2,
    win_3
  };
}
