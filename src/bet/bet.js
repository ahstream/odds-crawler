// DECLARES -----------------------------------------------------------------------------

import { CustomError } from '../exception/customError';

const _ = require('lodash');

const config = require('../../config/config.json');
const attributelib = require('../attribute/attribute.js');
const feedlib = require('../feed/feed.js');
const { createLogger } = require('../lib/loggerlib');
const utilslib = require('../lib/utilslib');
const marketlib = require('../market/market.js');
const oddsfeedlib = require('../odds/oddsFeed.js');
const outcomelib = require('../outcome/outcome.js');

const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

export function processBets(match, feed, oddsFeed, bt, sc) {
  const betKeys = getBetKeys(oddsFeed);
  processBetKeys(betKeys, match, feed, oddsFeed, bt, sc);
  return betKeys.length;
}

function processBetKeys(betKeys, match, feed, oddsFeed, bt, sc) {
  betKeys.forEach(({ betKey, _attribute, _isMixedParameter, isBack }) => {
    const betFeed = oddsFeed[betKey];
    const attributeText = attributelib.getAttributeText(betFeed);
    const attributes = attributelib.calcAttributes(attributeText, bt);
    const betArgs = createBetArgs(bt, sc, isBack, attributeText, attributes);
    processBet(match, feed, betFeed, betArgs);
  });
}

function processBet(match, feed, oddsFeed, betArgs) {
  const marketId = marketlib.addMarket(match, betArgs, oddsFeed.act);
  if (!marketId) {
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

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function getBetKeys(oddsFeed) {
  const betKeys = [];
  Object.keys(oddsFeed).forEach((betKey, _index) => {
    const isMixedParameter = oddsFeed[betKey].mixedParameterId > 0;
    const attribute = oddsFeed[betKey].mixedParameterName || oddsFeed[betKey].handicapValue;
    const isBack = oddsFeed[betKey].isBack ? 1 : 0;
    betKeys.push({ betKey, attribute, isMixedParameter, isBack });
  });
  betKeys.sort(betKeySorter);
  return betKeys;
}

function betKeySorter(b1, b2) {
  // Sort asian handicap and correct score!
  const attr1 = b1.attributeText;
  const attr2 = b2.attributeText;
  if (b1.isMixedParameter) {
    if (attr1 < attr2) {
      return -1;
    }
    return attr2 > attr1 ? 1 : 0;
  }
  const n1 = Number(attr1);
  const n2 = Number(attr2);
  if (n1 < n2) {
    return -1;
  }
  return n2 > n1 ? 1 : 0;
}

function calcBetTypeName(bt) {
  switch (bt) {
    case config.bt.Match:
      return '1X2';
    case config.bt.OU:
      return 'OU';
    case config.bt.HomeAway:
      return 'Home/Away';
    case config.bt.DC:
      return 'DC';
    case config.bt.AH:
      return 'AH';
    case config.bt.DNB:
      return 'DNB';
    case config.bt.TQ:
      return 'TQ';
    case config.bt.CS:
      return 'CS';
    case config.bt.HTFT:
      return 'HTFT';
    case config.bt.OE:
      return 'OE';
    case config.bt.Winner:
      return 'Winner';
    case config.bt.EH:
      return 'EH';
    case config.bt.BTS:
      return 'BTS';
    default:
      return '';
  }
}

function calcScopeName(sc) {
  switch (sc) {
    case config.sc.FT:
      return 'FT';
    case config.sc.H1:
      return 'H1';
    case config.sc.H2:
      return 'H2';
    case config.sc.FTOT:
      return 'FTOT';
    default:
      return 'UNKNOWN';
  }
}

function calcBetName(bt, sc, attributeText, attributes) {
  switch (bt) {
    case config.bt.OU:
      return `OU ${attributes.attribute1} ${calcScopeName(sc)}`;
    case config.bt.AH:
      return `AH ${attributes.attribute1} ${calcScopeName(sc)}`;
    case config.bt.CS:
      return `CS ${attributes.attribute1}-${attributes.attribute2} ${calcScopeName(sc)}`;
    case config.bt.HTFT:
      return `HTFT ${attributeText}`;
    case config.bt.EH:
      return `EH ${attributes.attribute1} ${calcScopeName(sc)}`;
    default:
      return `${calcBetTypeName(bt)} ${calcScopeName(sc)}`;
  }
}

function createBetArgs(bt, sc, isBack, attributeText, attributes) {
  return {
    betTypeName: calcBetTypeName(bt),
    scopeName: calcScopeName(sc),
    betName: calcBetName(bt, sc, attributeText, attributes),
    bt,
    sc,
    isBack,
    attributeText,
    attributes
  };
}
