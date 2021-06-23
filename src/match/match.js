/* eslint-disable no-param-reassign */
import { CustomError } from '../exception/customError';
import { parseMatchPageEvent } from '../parser/parser';
import { getHtmltextFromResponse, httpGetAllowedResponse } from '../provider/provider';

const _ = require('lodash');

const betlib = require('../bet/bet');
const feedlib = require('../feed/feed');
const { createLogger } = require('../lib/loggerlib');
const mongodb = require('../mongo/mongodb.js');
const scorelib = require('../score/score');

const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export async function resetOddsHistoryDB() {
  await mongodb.db.collection('oddsHistory').deleteMany({});
}

export async function getMatchFromWebPage(parsedUrl) {
  try {
    const url = `https://www.oddsportal.com${parsedUrl.matchUrl}`;
    const response = await httpGetAllowedResponse([url]);
    const htmltext = getHtmltextFromResponse(response, url);
    if (!htmltext) {
      throw new CustomError('Failed get match from URL', { url, response });
    }

    const match = createMatch(parsedUrl);

    // const event = parseAndValidateBaseEvent(url, htmltext, season);
    // assert(event, 'Failed parseAndValidateBaseEvent');

    match.params = parseMatchPageEvent(htmltext);
    match.score = await scorelib.parseScore(match, htmltext);
    /*
    if (!match.score) {
      throw new CustomError('Failed parsing match score', { match, htmltext });
    }
     */

    match.status = match.score.status;
    match.params.isAwarded = match.status === 'awarded';

    match.betTypes = await betlib.getBetTypes(match);
    if (!match.betTypes) {
      throw new CustomError('Failed getting bet types', { match, htmltext });
    }

    const numBets = await feedlib.processMatchFeeds(match);
    if (numBets < 1) {
      throw new CustomError('No bets in feed', { match, htmltext });
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
  } catch (ex) {
    log.debug('Exception in getMatchFromWebPage:', ex);
    throw ex;
  }
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
    return { itemCount: historyItems.length, insertedCount: 0 };
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
  return { itemCount: historyItems.length, insertedCount: result.insertedCount };
}

export async function moveToExportedMatches() {
  // TODO: Exportera bara matcher som är fully completed!
  const exportedMatchesCol = mongodb.db.collection('exportedMatches');
  const matchesCol = mongodb.db.collection('matches');
  for (const match of await matchesCol.find({}).toArray()) {
    if (!(await exportedMatchExists(match._id))) {
      await exportedMatchesCol.insertOne(match);
    }
  }
  await matchesCol.deleteMany({});
}

export function hasNormalMatchResult(match) {
  return !!(match.params.isFinished && !match.params.isPostponed && !match.params.isAwarded);
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

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
