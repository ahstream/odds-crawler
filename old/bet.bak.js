// DECLARES -----------------------------------------------------------------------------

const assert = require('assert');
const _ = require('lodash');

const config = require('../config/config.json');
const attributelib = require('../src/attribute/attribute.js');
const feedlib = require('../src/feed/feed.js');
const { createLogger } = require('../src/lib/loggerlib');
const utilslib = require('../src/lib/utilslib');
const marketlib = require('../src/market/market.js');
const oddslib = require('../src/match/matchOdds.js');
const outcomelib = require('../src/outcome/outcome.js');

const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function processBackOrLayBet(event, feed, oddsFeed, backOrLayKey, bt, sc) {
  log.debug(`Process ${backOrLayKey} bets for bt: ${bt}, sc: ${sc}`);

  const bets = [];
  Object.keys(oddsFeed).forEach((betKey, _index) => {
    const isMixedParameter = oddsFeed[betKey].mixedParameterId > 0;
    const attribute = oddsFeed[betKey].mixedParameterName || oddsFeed[betKey].handicapValue;
    const back = oddsFeed[betKey].isBack ? 1 : 0;
    bets.push({ betKey, attribute, isMixedParameter, back });
  });

  bets.sort(betSorter);

  if (bets.length <= 0) {
    log.silly(`No ${backOrLayKey} bets for bt: ${bt}, sc: ${sc}, event: ${event.url}`);
    return;
  }

  bets.forEach(({ betKey, _attribute, _isMixedParameter, back }) => {
    const betFeed = oddsFeed[betKey];
    const attributeText = attributelib.getAttributeText(betFeed);
    const attributes = attributelib.calcAttributes(attributeText, bt);
    processBet(event, feed, betFeed, bt, sc, back, attributeText, attributes);
  });
}

export function calcBetName(bt, sc, attributeText, attributes) {
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

export function calcScopeName(sc) {
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

export async function getBettingTypes(event) {
  log.debug(`Get betting types for event: ${event.name}`);

  const feed = await feedlib.getMatchFeed(event, config.bt.Match, config.sc.FT);
  if (feed === null || feed.nav === undefined) {
    log.error(`Failed to get betting types for event: ${event.url}`);
    log.verbose(`Failed to get betting types for event: ${event.url}, feed.nav: ${feed.nav}`);
    return null;
  }

  const bettingTypes = {};
  Object.keys(feed.nav).forEach((bettingTypeKey, _index) => {
    utilslib.ensureProperties(bettingTypes, [bettingTypeKey]);
    Object.keys(feed.nav[bettingTypeKey]).forEach((scopeKey, _scopeIndex) => {
      bettingTypes[bettingTypeKey][scopeKey] = feed.nav[bettingTypeKey][scopeKey].length;
    });
  });

  return bettingTypes;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function processBet(event, dataFeed, oddsFeed, bt, sc, back, attributeText, attributes) {
  const marketId = marketlib.addMarket(event, bt, sc, back, attributeText, attributes, oddsFeed.act);
  if (!marketId) {
    return;
  }
  outcomelib.getOutcomeList(oddsFeed).forEach(({ _outcomeKey, _outcomeIndex, outcome, outcomeId }) => {
    processBetOutcome(event, dataFeed, oddsFeed, marketId, outcome, outcomeId, bt, sc, back, attributeText, attributes);
  });
}

function processBetOutcome(event, dataFeed, oddsFeed, marketId, outcome, outcomeId, bt, sc, back, attributeText, attributes) {
  oddslib.processOpenOrCloseOdds(true, event, dataFeed, oddsFeed, marketId, outcome, outcomeId, bt, sc, back, attributeText, attributes);
  oddslib.processOpenOrCloseOdds(false, event, dataFeed, oddsFeed, marketId, outcome, outcomeId, bt, sc, back, attributeText, attributes);
}

function betSorter(b1, b2) {
  // Sort asian handicap and correct score!
  const attr1 = b1.attributeText;
  const attr2 = b2.attributeText;
  if (b1.isMixedParameter) {
    return attr1 < attr2 ? -1 : attr2 > attr1 ? 1 : 0;
  }
  const n1 = Number(attr1);
  const n2 = Number(attr2);
  return n1 < n2 ? -1 : n2 > n1 ? 1 : 0;
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
