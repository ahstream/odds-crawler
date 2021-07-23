/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { getBetTypeName } from './betType';
import { CustomError } from './exceptions';
import { getHandicapName, getHandicapSign, convertHandicapType } from './handicap';
import { createLogger } from './lib/loggerlib';
import { getScopeName, convertScope } from './scope';

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
  const betMarkets = getBetMarkets(match, oddsFeed, bt, sc);
  betMarkets.forEach((betArgs) => {
    betArgs.objKeys.forEach(objKey => {
      const betFeed = oddsFeed[objKey];
      processBet(match, feed, betFeed, betArgs);
    });
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
  const feed = await feedlib.getMatchFeed(match, config.betType['1X2'].id, config.scope.FT.id);
  if (feed === null || feed.nav === undefined) {
    log.debug('CustomError: Failed getting bet types for:', { feed, match });
    throw new CustomError('Failed getting bet types for:', { feed, match });
  }

  const betTypes = {};
  if (feed.nav === null) {
    return betTypes;
  }

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

function getBetMarkets(match, oddsFeed, bt, baseScope) {
  const betMarkets = [];
  for (const objectKey of Object.keys(oddsFeed)) {
    const isBack = oddsFeed[objectKey].isBack ? 1 : 0;
    const baseHandicapType = oddsFeed[objectKey].handicapType;
    const handicapValue = oddsFeed[objectKey].handicapValue;
    const mixedParameterId = oddsFeed[objectKey].mixedParameterId;
    const mixedParameterName = oddsFeed[objectKey].mixedParameterName;
    const attribute = mixedParameterName || handicapValue;
    const attributeSortKey = mixedParameterName || Number(handicapValue);
    const attributes = attributelib.calcAttributes(attribute, bt);

    const sc = convertScope(match.sportName, bt, baseScope, null);
    const handicapType = convertHandicapType(match.sportName, bt, null, baseHandicapType);

    const marketKey = `E-${bt}-${sc}-${handicapType}-${handicapValue}-${mixedParameterId}`;
    const existingBetMarket = betMarkets.find(item => item.key === marketKey);
    if (existingBetMarket) {
      log.debug('Add to existing market:', bt, sc, handicapType, baseScope, baseHandicapType);
      existingBetMarket.objKeys.push(objectKey);
    } else {
      betMarkets.push({
        key: marketKey,
        objKeys: [objectKey],
        bt,
        sc,
        isBack,
        handicapType,
        handicapValue,
        mixedParameterId,
        mixedParameterName,
        attribute,
        attributeSortKey,
        attributeType: baseHandicapType,
        attributes,
        betTypeName: getBetTypeName(bt),
        scopeName: getScopeName(sc),
        betName: getBetName(bt, sc, attribute, attributes, handicapType)
      });
    }
  }
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

function getBetName(bt, sc, attribute, attributes, handicapType) {
  const handicapTypeName = getHandicapName(handicapType);
  const attributeTypeText = handicapTypeName ? ` ${handicapTypeName}` : '';
  const handicapSign = getHandicapSign(attributes.value1);
  switch (bt) {
    case config.betType['O/U'].id:
      return `O/U ${attributes.value1}${attributeTypeText} ${getScopeName(sc)}`;
    case config.betType.AH.id:
      return `AH ${handicapSign}${attributes.value1}${attributeTypeText} ${getScopeName(sc)}`;
    case config.betType.CS.id:
      return `CS ${attributes.value1}:${attributes.value2} ${getScopeName(sc)}`;
    case config.betType['HT/FT'].id:
      return `HT/FT ${attribute}`;
    case config.betType.EH.id:
      return `EH ${handicapSign}${attributes.value1} ${getScopeName(sc)}`;
    default:
      return `${getBetTypeName(bt)} ${getScopeName(sc)}`;
  }
}
