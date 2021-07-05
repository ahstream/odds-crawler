/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { hasNormalMatchResult } from './match';

const config = require('../config/config.json');
const bookielib = require('./bookie.js');
const { createLogger } = require('./lib/loggerlib');
const marketresultlib = require('./marketResult');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function addMarket(match, betArgs, bookies) {
  try {
    if (!shouldMarketBeIncluded(match, betArgs)) {
      return null;
    }

    const marketId = `${match.id}_${betArgs.bt}_${betArgs.sc}_${betArgs.isBack}_${betArgs.attributeText}`;
    const market = createMarket(marketId);

    market.matchId = match.id;
    // market.season = match.season;

    market.betName = betArgs.betName;
    market.bt = betArgs.bt;
    market.sc = betArgs.sc;
    market.isBack = betArgs.isBack;
    market.attributeText = betArgs.attributeText;
    // market.attribute1 = attributes.attribute1;
    // market.attribute2 = attributes.attribute2;

    const numBookies = Object.keys(bookies).length;
    const numUndefined = bookielib.countUndefined(bookies);

    market.numBookies = numBookies;
    market.numIncluded = numBookies - numUndefined;
    market.numUndefined = numUndefined;
    market.numSharp = bookielib.countSharp(bookies);
    market.numSoft = bookielib.countSoft(bookies);
    market.numSwe = bookielib.countSweden(bookies);
    market.numExchanges = bookielib.countExchange(bookies);
    market.numBrokers = bookielib.countBroker(bookies);

    if (hasNormalMatchResult(match)) {
      marketresultlib.addMarketResult(market, match, betArgs);
    }

    match.market[marketId] = market;

    return marketId;
  } catch (error) {
    // log.debug('Error at addMarket:', error, betArgs, match.url, match.params, match.score);
    throw new CustomError('Failed adding market', {
      errorMsg: error.message,
      betArgs,
      url: match.url,
      params: match.params,
      score: match.score,
      error
    });
  }
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function shouldMarketBeIncluded(match, betArgs) {
  if (betArgs.isBack === 0) {
    return false; // Ignore lays bets for now! (Write lay bets to own table?!)
  }

  switch (betArgs.bt) {
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

function createMarket(id) {
  return {
    id,
    matchId: null,

    // season: null,

    betName: null,
    bt: null,
    sc: null,
    isBack: null,
    attributeText: null,
    // attribute1: null,
    // attribute2: null,

    numBookies: null,
    numIncluded: null,
    numUndefined: null,
    numSharp: null,
    numSoft: null,
    numExchanges: null,
    numBrokers: null,
    numSwe: null,
  };
}
