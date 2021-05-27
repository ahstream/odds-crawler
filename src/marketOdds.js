'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const outcomelib = require('./outcome.js');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function addMarketOdds(event, marketId, betName, bt, sc, back, attributeText, attributes, outcome, bookieId, odds, date, volume, isOpen) {
  if (!marketId) {
    return;
  }

  const marketOddsId = `${marketId}_${bookieId}`;
  if (event.marketOdds[marketOddsId] === undefined) {
    event.marketOdds[marketOddsId] = createMarketOdds(marketOddsId);
  }

  const ptr = event.marketOdds[marketOddsId];

  ptr.marketId = marketId;
  ptr.bookieId = parseInt(bookieId);
  ptr.numOutcomes = outcomelib.expectedNumOfOutcomes(bt);

  if (isOpen) {
    ptr[`openDate_${outcome}`] = date;
    ptr[`openOdds_${outcome}`] = odds;
    ptr[`openVolume_${outcome}`] = volume;
  } else {
    ptr[`closeDate_${outcome}`] = date;
    ptr[`closeOdds_${outcome}`] = odds;
    ptr[`closeVolume_${outcome}`] = volume;
  }

  return;
}

export function updateMarketOdds(event) {
  Object.keys(event.marketOdds).forEach(function (key, _index) {
    const ptr = event.marketOdds[key];

    const numOpenOutcomes = (ptr.openOdds_1 ? 1 : 0) + (ptr.openOdds_2 ? 1 : 0) + (ptr.openOdds_3 ? 1 : 0);
    const numCloseOutcomes = (ptr.closeOdds_1 ? 1 : 0) + (ptr.closeOdds_2 ? 1 : 0) + (ptr.closeOdds_3 ? 1 : 0);

    ptr.openOk = numOpenOutcomes == ptr.numOutcomes;
    ptr.closeOk = numCloseOutcomes == ptr.numOutcomes;

    ptr.openDate = _.min([ptr.openDate_1, ptr.openDate_2, ptr.openDate_3]);
    ptr.openDateOk = ptr.openDate_1 == ptr.openDate_2 && ptr.openDate_2 == ptr.openDate_3;

    ptr.closeDate = _.max([ptr.closeDate_1, ptr.closeDate_2, ptr.closeDate_3]);

    if (ptr.openOk) {
      const openOverround = calcOverround(ptr.bt, ptr.openOdds_1, ptr.openOdds_2, ptr.openOdds_3);
      const openMargin = openOverround - 1;
      // const openPayout = 1 / openOverround;

      ptr.openOverround = _.round(openOverround, 6);

      ptr.openTrueOdds_1 = _.round(calcTrueOdds(ptr.openOdds_1, openMargin, ptr.numOutcomes), 4);
      ptr.openTrueOdds_2 = _.round(calcTrueOdds(ptr.openOdds_2, openMargin, ptr.numOutcomes), 4);
      ptr.openTrueOdds_3 = _.round(calcTrueOdds(ptr.openOdds_3, openMargin, ptr.numOutcomes), 4);

      ptr.openTrueEqOdds_1 = _.round(calcTrueEqOdds(ptr.openOdds_1, openOverround), 4);
      ptr.openTrueEqOdds_2 = _.round(calcTrueEqOdds(ptr.openOdds_2, openOverround), 4);
      ptr.openTrueEqOdds_3 = _.round(calcTrueEqOdds(ptr.openOdds_3, openOverround), 4);
    }

    if (ptr.closeOk) {
      const closeOverround = calcOverround(ptr.bt, ptr.closeOdds_1, ptr.closeOdds_2, ptr.closeOdds_3);
      const closeMargin = closeOverround - 1;
      // const closePayout = 1 / closeOverround;

      ptr.closeOverround = _.round(closeOverround, 6);

      ptr.closeTrueOdds_1 = _.round(calcTrueOdds(ptr.closeOdds_1, closeMargin, ptr.numOutcomes), 4);
      ptr.closeTrueOdds_2 = _.round(calcTrueOdds(ptr.closeOdds_2, closeMargin, ptr.numOutcomes), 4);
      ptr.closeTrueOdds_3 = _.round(calcTrueOdds(ptr.closeOdds_3, closeMargin, ptr.numOutcomes), 4);

      ptr.closeTrueEqOdds_1 = _.round(calcTrueEqOdds(ptr.closeOdds_1, closeOverround), 4);
      ptr.closeTrueEqOdds_2 = _.round(calcTrueEqOdds(ptr.closeOdds_2, closeOverround), 4);
      ptr.closeTrueEqOdds_3 = _.round(calcTrueEqOdds(ptr.closeOdds_3, closeOverround), 4);
    }
  });
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function calcOverround(bt, odds1, odds2, odds3) {
  // DC bets have a book of 200%, need to divide with 2 to get real overround!
  const divider = bt === config.bt.DC ? 2 : 1;
  const overround = (odds1 ? 1 / odds1 : 0) + (odds2 ? 1 / odds2 : 0) + (odds3 ? 1 / odds3 : 0);
  return overround / divider;
}

function createMarketOdds(id) {
  return {
    id,
    marketId: null,
    bookieId: null,

    numOutcomes: null,

    openOk: null,
    openOverround: null,

    openDateOk: null,
    openDate: null,
    openDate_1: null,
    openDate_2: null,
    openDate_3: null,

    openOdds_1: null,
    openOdds_2: null,
    openOdds_3: null,

    openTrueOdds_1: null,
    openTrueOdds_2: null,
    openTrueOdds_3: null,

    openTrueEqOdds_1: null,
    openTrueEqOdds_2: null,
    openTrueEqOdds_3: null,

    openVolume_1: null,
    openVolume_2: null,
    openVolume_3: null,

    closeOk: null,
    closeOverround: null,

    closeDate: null,
    closeDate_1: null,
    closeDate_2: null,
    closeDate_3: null,

    closeOdds_1: null,
    closeOdds_2: null,
    closeOdds_3: null,

    closeTrueOdds_1: null,
    closeTrueOdds_2: null,
    closeTrueOdds_3: null,

    closeTrueEqOdds_1: null,
    closeTrueEqOdds_2: null,
    closeTrueEqOdds_3: null,

    closeVolume_1: null,
    closeVolume_2: null,
    closeVolume_3: null
  };
}

function calcTrueOdds(odds, margin, numOutcomes) {
  const probability = 1 / ((numOutcomes * odds) / (numOutcomes - margin * odds));
  return isFinite(probability) ? 1 / probability : null;
}

function calcTrueEqOdds(odds, overround) {
  const probability = 1 / odds / overround;
  return isFinite(probability) ? 1 / probability : null;
}
