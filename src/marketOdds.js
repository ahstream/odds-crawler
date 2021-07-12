/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const _ = require('lodash');

const config = require('../config/config.json');
const outcomelib = require('./outcome.js');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function addMarketOdds(match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem) {
  if (!marketId) {
    return;
  }

  const marketOddsId = `${marketId}_${bookieArgs.id}`;
  if (!match.marketOdds[marketOddsId]) {
    match.marketOdds[marketOddsId] = createMarketOdds(marketOddsId);
  }

  const ptr = match.marketOdds[marketOddsId];

  ptr.betName = betArgs.betName;

  ptr.marketId = marketId;
  ptr.bookie = bookieArgs.num;
  ptr.numOutcomes = outcomelib.expectedNumOfOutcomes(betArgs.bt);

  ptr[`openingDate${outcomeArgs.num}`] = completeOddsItem.opening.date;
  ptr[`openingOdds${outcomeArgs.num}`] = completeOddsItem.opening.odds;
  ptr[`openingVolume${outcomeArgs.num}`] = completeOddsItem.opening.volume;
  ptr[`closingDate${outcomeArgs.num}`] = completeOddsItem.closing.date;
  ptr[`closingOdds${outcomeArgs.num}`] = completeOddsItem.closing.odds;
  ptr[`closingVolume${outcomeArgs.num}`] = completeOddsItem.closing.volume;
}

export function updateMarketOddsOld(match) {
  Object.keys(match.marketOdds).forEach((key, _index) => {
    const ptr = match.marketOdds[key];

    const numOpenOutcomes = (ptr.openingOdds1 ? 1 : 0) + (ptr.openingOdds2 ? 1 : 0) + (ptr.openingOdds3 ? 1 : 0);
    const numCloseOutcomes = (ptr.closingOdds1 ? 1 : 0) + (ptr.closingOdds2 ? 1 : 0) + (ptr.closingOdds3 ? 1 : 0);

    ptr.openingOk = numOpenOutcomes === ptr.numOutcomes;
    ptr.closingOk = numCloseOutcomes === ptr.numOutcomes;

    ptr.openingDate = _.min([ptr.openingDate1, ptr.openingDate2, ptr.openingDate3]);
    ptr.openingDateOk = ptr.openingDate1 === ptr.openingDate2 && ptr.openingDate2 === ptr.openingDate3;

    ptr.closingDate = _.max([ptr.closingDate1, ptr.closingDate2, ptr.closingDate3]);

    if (ptr.openingOk) {
      const openingOverround = calcOverround(ptr.bt, ptr.openingOdds1, ptr.openingOdds2, ptr.openingOdds3);
      const openMargin = openingOverround - 1;
      // const openPayout = 1 / openingOverround;

      ptr.openingOverround = _.round(openingOverround, 6);

      ptr.openingTrueOdds1 = _.round(calcTrueOdds(ptr.openingOdds1, openMargin, ptr.numOutcomes), 4);
      ptr.openingTrueOdds2 = _.round(calcTrueOdds(ptr.openingOdds2, openMargin, ptr.numOutcomes), 4);
      ptr.openingTrueOdds3 = _.round(calcTrueOdds(ptr.openingOdds3, openMargin, ptr.numOutcomes), 4);

      ptr.openingTrueEqOdds1 = _.round(calcTrueEqOdds(ptr.openingOdds1, openingOverround), 4);
      ptr.openingTrueEqOdds2 = _.round(calcTrueEqOdds(ptr.openingOdds2, openingOverround), 4);
      ptr.openingTrueEqOdds3 = _.round(calcTrueEqOdds(ptr.openingOdds3, openingOverround), 4);
    }

    if (ptr.closingOk) {
      const closingOverround = calcOverround(ptr.bt, ptr.closingOdds1, ptr.closingOdds2, ptr.closingOdds3);
      const closeMargin = closingOverround - 1;
      // const closePayout = 1 / closingOverround;

      ptr.closingOverround = _.round(closingOverround, 6);

      ptr.closingTrueOdds1 = _.round(calcTrueOdds(ptr.closingOdds1, closeMargin, ptr.numOutcomes), 4);
      ptr.closingTrueOdds2 = _.round(calcTrueOdds(ptr.closingOdds2, closeMargin, ptr.numOutcomes), 4);
      ptr.closingTrueOdds3 = _.round(calcTrueOdds(ptr.closingOdds3, closeMargin, ptr.numOutcomes), 4);

      ptr.closingTrueEqOdds1 = _.round(calcTrueEqOdds(ptr.closingOdds1, closingOverround), 4);
      ptr.closingTrueEqOdds2 = _.round(calcTrueEqOdds(ptr.closingOdds2, closingOverround), 4);
      ptr.closingTrueEqOdds3 = _.round(calcTrueEqOdds(ptr.closingOdds3, closingOverround), 4);
    }
  });
}

export function updateMarketOdds(match) {
  Object.keys(match.marketOdds).forEach((key, _index) => {
    const ptr = match.marketOdds[key];

    const numOpeningOutcomes = (ptr.openingOdds1 ? 1 : 0) + (ptr.openingOdds2 ? 1 : 0) + (ptr.openingOdds3 ? 1 : 0);
    const numClosingOutcomes = (ptr.closingOdds1 ? 1 : 0) + (ptr.closingOdds2 ? 1 : 0) + (ptr.closingOdds3 ? 1 : 0);

    ptr.openingOk = numOpeningOutcomes === ptr.numOutcomes;
    ptr.closingOk = numClosingOutcomes === ptr.numOutcomes;

    ptr.openingDate = _.min([ptr.openingDate1, ptr.openingDate2, ptr.openingDate3]);
    // ptr.openingDateOk = ptr.openingDate1 === ptr.openingDate2 && ptr.openingDate2 === ptr.openingDate3;
    ptr.closingDate = _.max([ptr.closingDate1, ptr.closingDate2, ptr.closingDate3]);

    if (ptr.openingOk) {
      const openingOverround = calcOverround(ptr.bt, ptr.openingOdds1, ptr.openingOdds2, ptr.openingOdds3);
      const openingPayout = 1 / openingOverround;
      // const openingMargin = openingOverround - 1;

      ptr.openingPayout = _.round(openingPayout, 6);
      // ptr.openingOverround = _.round(openingOverround, 6);
      // ptr.openingTrueOdds1 = _.round(calcTrueOdds(ptr.openingOdds1, openingMargin, ptr.numOutcomes), 4);
      // ptr.openingTrueOdds2 = _.round(calcTrueOdds(ptr.openingOdds2, openingMargin, ptr.numOutcomes), 4);
      // ptr.openingTrueOdds3 = _.round(calcTrueOdds(ptr.openingOdds3, openingMargin, ptr.numOutcomes), 4);
      // ptr.openingTrueEqOdds1 = _.round(calcTrueEqOdds(ptr.openingOdds1, openingOverround), 4);
      // ptr.openingTrueEqOdds2 = _.round(calcTrueEqOdds(ptr.openingOdds2, openingOverround), 4);
      // ptr.openingTrueEqOdds3 = _.round(calcTrueEqOdds(ptr.openingOdds3, openingOverround), 4);
    }

    if (ptr.closingOk) {
      const closingOverround = calcOverround(ptr.bt, ptr.closingOdds1, ptr.closingOdds2, ptr.closingOdds3);
      const closingPayout = 1 / closingOverround;
      // const closingMargin = closingOverround - 1;

      ptr.closingPayout = _.round(closingPayout, 6);
      // ptr.closingOverround = _.round(closingOverround, 6);
      // ptr.closingTrueOdds1 = _.round(calcTrueOdds(ptr.closingOdds1, closingMargin, ptr.numOutcomes), 4);
      // ptr.closingTrueOdds2 = _.round(calcTrueOdds(ptr.closingOdds2, closingMargin, ptr.numOutcomes), 4);
      // ptr.closingTrueOdds3 = _.round(calcTrueOdds(ptr.closingOdds3, closingMargin, ptr.numOutcomes), 4);
      // ptr.closingTrueEqOdds1 = _.round(calcTrueEqOdds(ptr.closingOdds1, closingOverround), 4);
      // ptr.closingTrueEqOdds2 = _.round(calcTrueEqOdds(ptr.closingOdds2, closingOverround), 4);
      // ptr.closingTrueEqOdds3 = _.round(calcTrueEqOdds(ptr.closingOdds3, closingOverround), 4);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function calcOverround(bt, odds1, odds2, odds3) {
  // DC bets have a book of 200%, need to divide with 2 to get real overround!
  const divider = bt === config.betType.DC.id ? 2 : 1;
  const overround = (odds1 ? 1 / odds1 : 0) + (odds2 ? 1 / odds2 : 0) + (odds3 ? 1 / odds3 : 0);
  return overround / divider;
}

function calcTrueOdds(odds, margin, numOutcomes) {
  const probability = 1 / ((numOutcomes * odds) / (numOutcomes - margin * odds));
  return Number.isFinite(probability) ? 1 / probability : null;
}

function calcTrueEqOdds(odds, overround) {
  const probability = 1 / odds / overround;
  return Number.isFinite(probability) ? 1 / probability : null;
}

function createMarketOdds(id) {
  return {
    id,
    marketId: null,
    bookie: null,
    betName: null,
    numOutcomes: null,

    openingOk: null,
    openingDate: null,
    openingPayout: null,
    openingOdds1: null,
    openingOdds2: null,
    openingOdds3: null,
    openingDate1: null,
    openingDate2: null,
    openingDate3: null,
    openingVolume1: null,
    openingVolume2: null,
    openingVolume3: null,

    closingOk: null,
    closingDate: null,
    closingPayout: null,
    closingOdds1: null,
    closingOdds2: null,
    closingOdds3: null,
    closingDate1: null,
    closingDate2: null,
    closingDate3: null,
    closingVolume1: null,
    closingVolume2: null,
    closingVolume3: null,
  };
}
