'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const config = require('../config/config.json');
const utilslib = require('./lib/utilslib');
const betlib = require('./bet.js');
const marketoddslib = require('./marketOdds.js');
const historicoddslib = require('./historicOdds.js');
const provider = require('./provider');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function processOdds(isOpen, event, feed, oddsFeed, marketId, outcome, outcomeId, bt, sc, back, attributeText, attributes) {
  const oddsPointer = isOpen ? oddsFeed.opening_odds : oddsFeed.odds;
  const datePointer = isOpen ? oddsFeed.opening_change_time : oddsFeed.change_time;
  const volumePointer = isOpen ? oddsFeed.opening_volume : oddsFeed.volume;

  const bookieIdList = [];
  Object.keys(oddsPointer).forEach(function (key, _index) {
    bookieIdList.push(key);
  });
  const numBookies = bookieIdList.length;

  for (let i = 0; i < numBookies; i++) {
    const bookieId = bookieIdList[i];
    const oddsId = createOddsId(event, bt, sc, back, attributeText, outcome, bookieId);
    const betName = betlib.calcBetName(bt, sc, attributeText, attributes);

    if (event.odds[oddsId] === undefined) {
      event.odds[oddsId] = createOdds(oddsId, event, marketId, betName, bt, sc, back, attributeText, attributes, outcome, bookieId);
    }

    const outcomeIndex = outcome - 1;
    const odds = provider.ensureOddsOrNull(oddsPointer[bookieId][outcomeIndex]);
    const date = provider.ensureDateOrNull(datePointer[bookieId][outcomeIndex]);
    const volume = provider.ensureVolumeOrNull(volumePointer[bookieId] ? volumePointer[bookieId][outcomeIndex] : null);

    if (isOpen) {
      event.odds[oddsId].openDate = date;
      event.odds[oddsId].openOdds = odds;
      event.odds[oddsId].openVolume = volume;
    } else {
      event.odds[oddsId].closeDate = date;
      event.odds[oddsId].closeOdds = odds;
      event.odds[oddsId].closeVolume = volume;
    }

    historicoddslib.addOdds(event, marketId, oddsId, betName, bt, sc, back, attributes, outcome, bookieId, odds, date, volume);
    if (isOpen) {
      // Only need to add history for either open or closing odds process!
      historicoddslib.addHistory(event, marketId, oddsId, betName, bt, sc, back, attributes, outcome, outcomeId, bookieId, feed);
    }

    marketoddslib.addMarketOdds(event, marketId, betName, bt, sc, back, attributeText, attributes, outcome, bookieId, odds, date, volume, isOpen);
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function createOddsId(event, bt, sc, back, attributeText, outcome, bookieId) {
  return `${event.id}_${bt}_${sc}_${back}_${attributeText}_${outcome}_${bookieId}`;
}

function createOdds(id, event, marketId, betName, bt, sc, back, attributeText, attributes, outcome, bookieId) {
  return {
    id,
    //eventId: event.id,
    marketId,
    //betName,
    //bt,
    //sc,
    //back,
    //attributeText,
    //attribute1: attributes.attribute1,
    //attribute2: attributes.attribute2,
    outcome,
    bookieId: parseInt(bookieId),
    openDate: null,
    openOdds: null,
    openVolume: null,
    closeDate: null,
    closeOdds: null,
    closeVolume: null
  };
}
