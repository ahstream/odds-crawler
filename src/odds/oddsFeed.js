const { createLogger } = require('../lib/loggerlib');
const matchoddslib = require('../match/matchOdds.js');
const provider = require('../provider/provider');
const oddshistorylib = require('./oddsHistory');
const oddsitemlib = require('./oddsItem.js');

const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

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

// OLD

/*
function processOpenOrCloseOdds(isOpen, match, feed, oddsFeed, marketId, outcome, outcomeId, bt, sc, isBack, attributeText, attributes) {
  const oddsPointer = isOpen ? oddsFeed.opening_odds : oddsFeed.odds;
  const datePointer = isOpen ? oddsFeed.opening_change_time : oddsFeed.change_time;
  const volumePointer = isOpen ? oddsFeed.opening_volume : oddsFeed.volume;

  const bookieIdList = [];
  Object.keys(oddsPointer).forEach((key, _index) => {
    bookieIdList.push(key);
  });
  const numBookies = bookieIdList.length;

  for (let i = 0; i < numBookies; i++) {
    const bookieId = bookieIdList[i];
    const oddsId = createOddsId(match, bt, sc, isBack, attributeText, outcome, bookieId);
    const betName = betlib.calcBetName(bt, sc, attributeText, attributes);

    if (match.odds[oddsId] === undefined) {
      match.odds[oddsId] = createOdds(oddsId, marketId, outcome, bookieId);
    }

    const outcomeIndex = outcome - 1;
    const odds = provider.ensureOddsOrNull(oddsPointer[bookieId][outcomeIndex]);
    const date = provider.ensureDateOrNull(datePointer[bookieId][outcomeIndex]);
    const volume = provider.ensureVolumeOrNull(volumePointer[bookieId] ? volumePointer[bookieId][outcomeIndex] : null);
    setMatchOdds(isOpen, match, oddsId, odds, date, volume);

    historicoddslib.addOdds(match, marketId, oddsId, betName, bt, sc, isBack, attributes, outcome, bookieId, odds, date, volume);
    if (isOpen) {
      // Only need to add history for either open or closing odds process!
      historicoddslib.addHistory(match, marketId, oddsId, betName, bt, sc, isBack, attributes, outcome, outcomeId, bookieId, feed);
    }

    marketoddslib.addMarketOdds(match, marketId, betName, bt, sc, isBack, attributeText, attributes, outcome, bookieId, odds, date, volume, isOpen);
  }
}

function setMatchOdds(isOpen, match, oddsId, odds, date, volume) {
  if (isOpen) {
    match.odds[oddsId].openDate = date;
    match.odds[oddsId].openOdds = odds;
    match.odds[oddsId].openVolume = volume;
  } else {
    match.odds[oddsId].closeDate = date;
    match.odds[oddsId].closeOdds = odds;
    match.odds[oddsId].closeVolume = volume;
  }
}

function createOddsId(match, bt, sc, back, attributeText, outcome, bookieId) {
  return `${match.id}_${bt}_${sc}_${back}_${attributeText}_${outcome}_${bookieId}`;
}

function createOdds(id, marketId, outcome, bookieId) {
  return {
    id,
    // eventId: match.id,
    marketId,
    // betName,
    // bt,
    // sc,
    // back,
    // attributeText,
    // attribute1: attributes.attribute1,
    // attribute2: attributes.attribute2,
    outcome,
    bookieId: parseInt(bookieId, 10),
    openDate: null,
    openOdds: null,
    openVolume: null,
    closeDate: null,
    closeOdds: null,
    closeVolume: null
  };
}

*/
