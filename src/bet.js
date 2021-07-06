/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { createLogger } from './lib/loggerlib';

const config = require('../config/config.json');
const attributelib = require('./attribute.js');
const feedlib = require('./feed.js');
const utilslib = require('./lib/utilslib');
const marketlib = require('./market.js');
const oddsfeedlib = require('./oddsFeed.js');
const outcomelib = require('./outcome.js');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function processBets(match, feed, oddsFeed, bt, sc) {
  const betMarkets = getBetMarkets(oddsFeed, bt, sc);
  betMarkets.forEach((betArgs) => {
    const betFeed = oddsFeed[betArgs.key];
    processBet(match, feed, betFeed, betArgs);
  });
  return betMarkets.length;
}

function processBet(match, feed, oddsFeed, betArgs) {
  const marketId = marketlib.addMarket(match, betArgs, oddsFeed.act);
  if (!marketId) {
    log.debug('Market is excluded:', betArgs, match.url);
    return;
  }

  outcomelib.getOutcomeList(oddsFeed).forEach((outcomeArgs) => {
    oddsfeedlib.processOddsFeed(match, feed, oddsFeed, marketId, betArgs, outcomeArgs);
  });
}

export async function getBetTypes(match) {
  const feed = await feedlib.getMatchFeed(match, config.bt.Match, config.sc.FT);
  if (feed === null || feed.nav === undefined) {
    throw new CustomError('Failed getting bet types', { feed, match });
  }

  const betTypes = {};
  Object.keys(feed.nav).forEach((bettingTypeKey, _index) => {
    utilslib.ensureProperties(betTypes, [bettingTypeKey]);
    Object.keys(feed.nav[bettingTypeKey]).forEach((scopeKey, _scopeIndex) => {
      betTypes[bettingTypeKey][scopeKey] = feed.nav[bettingTypeKey][scopeKey].length;
    });
  });

  return betTypes;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function getBetMarkets(oddsFeed, bt, sc) {
  const betMarkets = [];
  Object.keys(oddsFeed).forEach((key, _index) => {
    const isBack = oddsFeed[key].isBack ? 1 : 0;
    const handicapType = oddsFeed[key].handicapType;
    const handicapValue = oddsFeed[key].handicapValue;
    const mixedParameterId = oddsFeed[key].mixedParameterId;
    const mixedParameterName = oddsFeed[key].mixedParameterName;
    const attribute = mixedParameterName || handicapValue;
    const attributeSortKey = mixedParameterName || Number(handicapValue);
    const attributes = attributelib.calcAttributes(attribute, bt);
    betMarkets.push({
      key,
      bt,
      sc,
      isBack,
      handicapType,
      handicapValue,
      mixedParameterId,
      mixedParameterName,
      attribute,
      attributeSortKey,
      attributeType: handicapType,
      attributes,
      betTypeName: getBetTypeName(bt),
      scopeName: getScopeName(sc),
      betName: getBetName(bt, sc, attribute, attributes, handicapType)
    });
  });
  betMarkets.sort(betMarketSorter);
  return betMarkets;
}

function betMarketSorter(market1, market2) {
  // Sort asian handicap and correct score!
  if (market1.attributeSortKey < market2.attributeSortKey) {
    return -1;
  }
  return market2.attributeSortKey > market1.attributeSortKey ? 1 : 0;
}

function getBetTypeName(bt) {
  return config.btName[`${bt}`] || 'UNKNOWN';
}

function getScopeName(sc) {
  return config.scName[`${sc}`] || 'UNKNOWN';
}

function getHandicapTypeName(type) {
  switch (type) {
    case 0:
      return '';
    case 1:
      return 'sets';
    case 2:
      return 'games';
    case 7:
      return 'legs';
    default:
      return 'UNKNOWN';
  }
}

function getBetName(bt, sc, attribute, attributes, handicapType) {
  const handicapTypeName = getHandicapTypeName(handicapType);
  const attributeTypeText = handicapTypeName ? ` ${handicapTypeName}` : '';
  const handicapSign = getHandicapSign(attributes.value1);
  switch (bt) {
    case config.bt.OU:
      return `OU ${attributes.value1}${attributeTypeText} ${getScopeName(sc)}`;
    case config.bt.AH:
      return `AH ${handicapSign}${attributes.value1}${attributeTypeText} ${getScopeName(sc)}`;
    case config.bt.CS:
      return `CS ${attributes.value1}:${attributes.value2} ${getScopeName(sc)}`;
    case config.bt.HTFT:
      return `HTFT ${attribute}`;
    case config.bt.EH:
      return `EH ${handicapSign}${attributes.value1} ${getScopeName(sc)}`;
    default:
      return `${getBetTypeName(bt)} ${getScopeName(sc)}`;
  }
}

function getHandicapSign(handicapValue) {
  if (handicapValue > 0) {
    return '+';
  }
  if (handicapValue < 0) {
    return '-';
  }
  return '';
}
