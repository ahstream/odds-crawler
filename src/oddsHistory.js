/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';

const { createLogger } = require('./lib/loggerlib');
const mongodb = require('./mongodb.js');
const oddsitemlib = require('./oddsItem.js');
const provider = require('./provider');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, oddsItem) {
  if (!oddsItem.date) {
    log.debug('Odds missing date:', oddsId);
    return;
  }

  const id = createId(oddsId, oddsItem.date);
  match.history[id] = createOdds(id, match, marketId, betArgs, outcomeArgs, bookieArgs, oddsItem);
}

export function addHistory(match, feed, marketId, oddsId, betArgs, outcomeArgs, bookieArgs) {
  try {
    const backOrLayKey = betArgs.isBack ? 'back' : 'lay';

    if (!feed.history[backOrLayKey][outcomeArgs.id] || !feed.history[backOrLayKey][outcomeArgs.id][bookieArgs.id]) {
      return;
    }

    Object.keys(feed.history[backOrLayKey][outcomeArgs.id][bookieArgs.id]).forEach((key, _index) => {
      const ptr = feed.history[backOrLayKey][outcomeArgs.id][bookieArgs.id][key];

      const odds = provider.ensureOddsOrNull(ptr[0]);
      const date = provider.ensureDateOrNull(ptr[2]);
      const volume = provider.ensureVolumeOrNull(ptr[1]);
      const oddsItem = oddsitemlib.createOddsItem(odds, date, volume);

      addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, oddsItem);
    });
  } catch (error) {
    throw new CustomError('Failed add history', {
      url: match.url,
      marketId,
      oddsId,
      betArgs,
      outcomeArgs,
      bookieArgs,
      error
    });
  }
}

export function createOddsHistoryDBItem(oddsHistory) {
  return {
    _id: oddsHistory.id,
    outcome: oddsHistory.outcome,
    bookie: oddsHistory.bookie,
    odds: oddsHistory.odds,
    date: oddsHistory.date,
    volume: oddsHistory.volume
  };
}

export async function initOddsHistoryDB() {
  const collName = 'oddsHistory';
  const collSchema = getOddsHistorySchema();
  if (!await mongodb.collectionExists(collName)) {
    await mongodb.db.createCollection(collName, { validator: collSchema });
  } else {
    await mongodb.db.command({ collMod: collName, validator: collSchema });
  }
}

async function getOddsHistorySchema() {
  return {
    $jsonSchema: {
      bsonType: 'object',
      required: ['outcome', 'bookie', 'odds', 'date', 'volume'],
      properties: {
        outcome: {
          bsonType: 'int'
        },
        bookie: {
          bsonType: 'int'
        },
        odds: {
          bsonType: 'double'
        },
        date: {
          bsonType: 'date'
        },
        volume: {
          bsonType: 'int'
        }
      }
    }
  };
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function createId(oddsId, date) {
  return `${oddsId}_${date.getTime()}`;
}

function createOdds(id, match, marketId, betArgs, outcomeArgs, bookieArgs, oddsItem) {
  return {
    id,
    matchId: match.id,
    marketId,
    // betName,
    // bt,
    // sc,
    // back,
    outcome: outcomeArgs.num,
    bookie: bookieArgs.num,
    odds: oddsItem.odds,
    date: oddsItem.date,
    volume: oddsItem.volume
  };
}
