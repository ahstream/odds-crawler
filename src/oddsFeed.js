/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const matchoddslib = require('./matchOdds.js');
const oddshistorylib = require('./oddsHistory');
const oddsitemlib = require('./oddsItem.js');
const provider = require('./provider');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function processOddsFeed(match, feed, oddsFeed, marketId, betArgs, outcomeArgs) {
  for (const bookieArgs of getBookiesWithOdds(oddsFeed)) {
    const openingOddsValue = getOddsValue(oddsFeed.opening_odds, bookieArgs, outcomeArgs);
    const openingOddsDate = getOddsDate(oddsFeed.opening_change_time, bookieArgs, outcomeArgs);
    const openingOddsVolume = getOddsVolume(oddsFeed.opening_volume, bookieArgs, outcomeArgs);

    const closingOddsValue = getOddsValue(oddsFeed.odds, bookieArgs, outcomeArgs);
    const closingOddsDate = getOddsDate(oddsFeed.change_time, bookieArgs, outcomeArgs);
    const closingOddsVolume = getOddsVolume(oddsFeed.volume, bookieArgs, outcomeArgs);

    const openingOddsItem = oddsitemlib.createOddsItem(openingOddsValue, openingOddsDate, openingOddsVolume);
    const closingOddsItem = oddsitemlib.createOddsItem(closingOddsValue, closingOddsDate, closingOddsVolume);
    const completeOddsItem = oddsitemlib.createCompleteOddsItem(openingOddsItem, closingOddsItem);

    const oddsId = matchoddslib.processMatchOdds(match, marketId, betArgs, outcomeArgs, bookieArgs, completeOddsItem);

    oddshistorylib.addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, completeOddsItem.opening);
    oddshistorylib.addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, completeOddsItem.closing);

    oddshistorylib.addHistory(match, feed, marketId, oddsId, betArgs, outcomeArgs, bookieArgs);
  }
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function getBookiesWithOdds(oddsFeed) {
  const bookieArgsList = [];

  Object.keys(oddsFeed.opening_odds).forEach((key, _index) => {
    bookieArgsList.push({ num: parseInt(key, 10), id: key, key });
  });

  Object.keys(oddsFeed.odds).forEach((key, _index) => {
    if (!bookieArgsList.includes(key)) {
      bookieArgsList.push({ num: parseInt(key, 10), id: key, key });
    }
  });

  return bookieArgsList;
}

function getOddsValue(ptr, bookieArgs, outcomeArgs) {
  if (ptr && ptr[bookieArgs.key] && ptr[bookieArgs.key][outcomeArgs.key]) {
    return provider.ensureOddsOrNull(ptr[bookieArgs.key][outcomeArgs.key]);
  }
  return null;
}

function getOddsDate(ptr, bookieArgs, outcomeArgs) {
  if (ptr && ptr[bookieArgs.key] && ptr[bookieArgs.key][outcomeArgs.key]) {
    return provider.ensureDateOrNull(ptr[bookieArgs.key][outcomeArgs.key]);
  }
  return null;
}

function getOddsVolume(ptr, bookieArgs, outcomeArgs) {
  if (ptr && ptr[bookieArgs.key] && ptr[bookieArgs.key][outcomeArgs.key]) {
    return provider.ensureVolumeOrNull(ptr[bookieArgs.key][outcomeArgs.key]);
  }
  return null;
}
