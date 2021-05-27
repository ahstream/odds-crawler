'use strict';

// DECLARES -----------------------------------------------------------------------------

const config = require('../config/config.json');
const provider = require('./provider');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function addOdds(event, marketId, oddsId, betName, bt, sc, back, attributes, outcome, bookieId, odds, date, volume) {
  const id = createId(event, oddsId, date);
  event.history[id] = createHistoricOdds(id, event, marketId, betName, bt, sc, back, outcome, bookieId, odds, date, volume);
}

export function addHistory(event, marketId, oddsId, betName, bt, sc, back, attributes, outcome, outcomeId, bookieId, feed) {
  try {
    const backOrLayKey = back ? 'back' : 'lay';

    if (!feed.history[backOrLayKey][outcomeId]) {
      return;
    }

    if (!feed.history[backOrLayKey][outcomeId][bookieId]) {
      return;
    }

    Object.keys(feed.history[backOrLayKey][outcomeId][bookieId]).forEach(function (key, _index) {
      const ptr = feed.history[backOrLayKey][outcomeId][bookieId][key];

      const odds = provider.ensureOddsOrNull(ptr[0]);
      const volume = provider.ensureVolumeOrNull(ptr[1]);
      const date = provider.ensureDateOrNull(ptr[2]);

      const id = createId(event, oddsId, date);
      event.history[id] = createHistoricOdds(id, event, marketId, betName, bt, sc, back, outcome, bookieId, odds, date, volume);
    });
  } catch (error) {
    log.error('Error for:', back, marketId, oddsId, betName, bt, sc, back, attributes, outcome, outcomeId, bookieId);
    throw error;
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function createId(event, betKey, date) {
  return `${betKey}_${date}`;
}

function createHistoricOdds(id, event, marketId, betName, bt, sc, back, outcome, bookieId, odds, date, volume) {
  return {
    // id,
    //eventId: event.id,
    marketId,
    //betName,
    //bt,
    //sc,
    //back,
    outcome,
    bookieId,
    bookieId: parseInt(bookieId),
    date,
    date2: new Date(date * 1000),
    odds,
    volume
  };
}
