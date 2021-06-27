/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { parseMatchPageEvent } from './parser';
import { httpGetAllowedHtmltext } from './provider';

const betlib = require('./bet');
const feedlib = require('./feed');
const { createLogger } = require('./lib/loggerlib');
const mongodb = require('./mongodb.js');
const scorelib = require('./score');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function resetOddsHistoryDB() {
  await mongodb.dropCollection('oddsHistory');
}

export async function getMatchFromWebPage(parsedUrl) {
  const url = `https://www.oddsportal.com${parsedUrl.matchUrl}`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const match = createMatch(parsedUrl);

  match.params = parseMatchPageEvent(htmltext);
  match.score = await scorelib.parseScore(match, htmltext);
  match.status = match.score.status ?? match.status;

  match.betTypes = await betlib.getBetTypes(match);
  if (!match.betTypes || Object.keys(match.betTypes).length === 0) {
    throw new CustomError('Failed getting bet types', { match, htmltext });
  }

  const numBets = await feedlib.processMatchFeeds(match);
  if (numBets < 1) {
    throw new CustomError('No bets in feed', { url: match.url, htmltext });
  }
  log.debug(`Num bets in feed: ${numBets}`);

  /*
  event.hasOdds = _.isEmpty(event.odds) == false;
  if (event.hasOdds) {
    marketoddslib.updateMarketOdds(event);
  }
  event.ok = true;
       */

  // log.verbose(match);

  return match;
}

export async function updateMatchOddsHistoryDB(match) {
  const historyItems = [];

  Object.keys(match.history).forEach((key, _index) => {
    const item = match.history[key];
    const mongoItem = {
      _id: item.id,
      matchId: item.matchId,
      marketId: item.marketId,
      outcome: item.outcome,
      bookie: item.bookie,
      odds: item.odds,
      date: item.date,
      volume: item.volume
    };
    historyItems.push(mongoItem);
  });

  if (historyItems.length === 0) {
    return { total: 0, new: 0, existing: 0 };
  }

  const result = await mongodb.db
    .collection('oddsHistory')
    .insertMany(historyItems, { ordered: false })
    .catch((err, res) => {
      if (err.code !== 11000) {
        log.error('Unknown error when inserting many documents to mongodb:', err.message);
        log.debug('Unknown error when inserting many documents to mongodb:', err.message, err);
        return { insertedCount: -1 };
      }
      return { insertedCount: err.result.result.nInserted };
    });
  return {
    total: historyItems.length,
    new: result.insertedCount,
    existing: historyItems.length - result.insertedCount
  };
}

export async function moveToExportedMatches() {
  /*
  const exportedMatchesCol = mongodb.db.collection('exportedMatches');
  const matchesCol = mongodb.db.collection('matches');
  for (const match of await matchesCol.find({}).toArray()) {
    if (!(await exportedMatchExists(match._id))) {
      await exportedMatchesCol.insertOne(match);
    }
  }
  await matchesCol.deleteMany({});
     */
}

export function hasNormalMatchResult(match) {
  return match.score.isComplete;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

async function getMatchFromDB(matchId) {
  return (await mongodb.db.collection('matches').find({ _id: matchId }).toArray())[0];
}

export async function exportedMatchExists(matchId) {
  return (await mongodb.db.collection('exportedMatches').find({ _id: matchId }).limit(1).count()) === 1;
}

function createMatch(parsedUrl) {
  return {
    id: parsedUrl.matchId,
    status: 'new',
    parsedUrl,
    url: parsedUrl.matchUrl,
    startTime: null,
    startTimeUnix: null,
    home: null,
    away: null,
    betTypes: null,
    market: {},
    marketResult: {},
    marketOdds: {},
    odds: {},
    history: {}
  };
}
