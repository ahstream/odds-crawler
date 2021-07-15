/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { createMarketResult } from './marketResult';
const marketresultlib = require('./marketResult');
import { hasNormalMatchResult } from './match';

const config = require('../config/config.json');
const bookielib = require('./bookie.js');
const { createLogger } = require('./lib/loggerlib');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function addMarket(match, betArgs, bookies) {
  try {
    if (!shouldMarketBeIncluded(match, betArgs)) {
      return null;
    }

    const marketId = `${match.id}_${betArgs.bt}_${betArgs.sc}_${betArgs.isBack}_${betArgs.attribute}_${betArgs.attributeType}`;
    const market = createMarket(marketId);

    market.matchId = match.id;
    // market.season = match.season;

    market.betName = betArgs.betName;
    market.bt = betArgs.bt;
    market.sc = betArgs.sc;
    market.isBack = betArgs.isBack;
    market.attribute = betArgs.attribute;
    market.attributes = betArgs.attributes;
    market.attributeType = betArgs.attributeType;

    const result = createMarketResult(market, match, betArgs);
    market.result = result;
    if (result !== null) {
      market.home = result.home;
      market.away = result.away;
      market.total = result.total;
      market.outcome = result.outcome;
      market.win1 = result.win1;
      market.win2 = result.win2;
      market.win3 = result.win3;
    }

    const numBookies = Object.keys(bookies).length;
    const numUndefined = bookielib.countUndefined(bookies);

    market.numBookies = numBookies;
    market.numIncluded = numBookies - numUndefined;
    market.numUndefined = numUndefined;
    market.numSharp = bookielib.countSharp(bookies);
    market.numSoft = bookielib.countSoft(bookies);
    market.numExchanges = bookielib.countExchange(bookies);
    market.numBrokers = bookielib.countBroker(bookies);
    market.numSwe = bookielib.countSweden(bookies);

    if (match.market[marketId]) {
      log.debug('Add market to existing market:', market, match.market[marketId]);
      addMarketToExistingMarket(market, match.market[marketId]);
      return marketId;
    }

    match.market[marketId] = market;

    return marketId;
  } catch (error) {
    log.debug('CustomError: Failed adding market for:', {
      errorMsg: error.message,
      betArgs,
      url: match.url,
      params: match.params,
      matchScore: match.matchScore,
      error
    });
    throw new CustomError('Failed adding market for:', {
      errorMsg: error.message,
      betArgs,
      url: match.url,
      params: match.params,
      matchScore: match.matchScore,
      error
    });
  }
}

function addMarketToExistingMarket(market, existingMarket) {
  existingMarket.numBookies += market.numBookies;
  existingMarket.numIncluded += market.numIncluded;
  existingMarket.numUndefined += market.numUndefined;
  existingMarket.numSharp += market.numSharp;
  existingMarket.numSoft += market.numSoft;
  existingMarket.numExchanges += market.numExchanges;
  existingMarket.numBrokers += market.numBrokers;
  existingMarket.numSwe += market.numSwe;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function shouldMarketBeIncluded(match, betArgs) {
  if (betArgs.isBack === 0) {
    return false; // Ignore lays bets for now! (Write lay bets to own table?!)
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
    attribute: null, // '0.00', '+1.5', '1:2',
    attributes: null, // 1.5
    attributeType: null, // 0: goals/sets; 1: games

    home: null,
    away: null,
    total: null,
    outcome: null,
    win1: null,
    win2: null,
    win3: null,
    result: null,

    numBookies: null,
    numIncluded: null,
    numUndefined: null,
    numSharp: null,
    numSoft: null,
    numExchanges: null,
    numBrokers: null,
    numSwe: null
  };
}
