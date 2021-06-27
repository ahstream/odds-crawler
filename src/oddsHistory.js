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

const ODDS_HISTORY = 'oddsHistory';

//  MAIN FUNCTIONS --------------------------------------------------------------------------------

export function addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, oddsItem) {
  if (!oddsItem.date) {
    log.debug('Odds missing date:', oddsId);
    return;
  }

  const id = createId(oddsId, oddsItem.date);
  match.oddsHistory[id] = createOddsHistory(id, match, marketId, betArgs, outcomeArgs, bookieArgs, oddsItem);
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

// DB ----------------------------------------------------------------------------------------

export async function initOddsHistoryDB() {
  const collSchema = createOddsHistoryDBSchema();
  if (!await mongodb.collectionExists(ODDS_HISTORY)) {
    await mongodb.db.createCollection(ODDS_HISTORY);
  }
  const result = await mongodb.db.command({
    collMod: ODDS_HISTORY,
    validator: createOddsHistoryDBSchema()
  });
  log.debug('initOddsHistoryDB result:', result);
}

export async function updateOddsHistoryDB(history) {
  const oddsHistoryItems = [];
  Object.keys(history).forEach((key, _index) => {
    oddsHistoryItems.push(createOddsHistoryDBItem(history[key]));
  });
  if (oddsHistoryItems.length === 0) {
    return { total: 0, new: 0, existing: 0 };
  }

  const result = await mongodb.db
    .collection(ODDS_HISTORY)
    .insertMany(oddsHistoryItems, { ordered: false })
    .catch((err, res) => {
      switch (err.code) {
        case 121:
          log.error('Mongo DB Error:', err.message);
          log.debug('Mongo DB writeErrors[0]:', err.writeErrors[0]);
          return { insertedCount: err.result.result.nInserted };
        case 11000:
          log.debug('Mongo DB Error:', err.message);
          return { insertedCount: err.result.result.nInserted };
        default:
          log.error('Mongo DB Error:', err.message);
          log.debug('Mongo DB Error:', err);
          return { insertedCount: -1 };
      }
    });

  return {
    total: oddsHistoryItems.length,
    new: result.insertedCount,
    existing: oddsHistoryItems.length - result.insertedCount
  };
}

// CREATORS ----------------------------------------------------------------------------------------

function createId(oddsId, date) {
  return `${oddsId}_${date.getTime()}`;
}

function createOddsHistory(id, match, marketId, betArgs, outcomeArgs, bookieArgs, oddsItem) {
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

function createOddsHistoryDBItem(oddsHistory) {
  return {
    _id: oddsHistory.id,
    outcome: oddsHistory.outcome,
    bookie: oddsHistory.bookie,
    odds: oddsHistory.odds,
    date: oddsHistory.date,
    volume: oddsHistory.volume
  };
}

function createOddsHistoryDBSchema() {
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
          bsonType: 'number'
        },
        date: {
          bsonType: 'date'
        },
        volume: {
          bsonType: ['int', 'null']
        }
      }
    }
  };
}
