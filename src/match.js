/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { writeToFile } from './dataWriter';
import { CustomError } from './exceptions';
import { updateMarketOdds } from './marketodds';
import { updateOddsHistoryDB } from './oddsHistory';
import { parseMatchPageEvent, parseMatchUrl } from './parser';
import { httpGetAllowedHtmltext } from './provider';

const _ = require('lodash');

const betlib = require('./bet');
const feedlib = require('./feed');
const { createLogger } = require('./lib/loggerlib');
const mongodb = require('./mongodb.js');
const scorelib = require('./score');

const log = createLogger();

const MATCHES = 'matches';

// MAIN FUNCTIONS ---------------------------------------------------------------------------------

export async function getMatchFromWebPage(parsedUrl) {
  const url = `https://www.oddsportal.com${parsedUrl.matchUrl}`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const match = createMatch(parsedUrl);

  match.params = parseMatchPageEvent(htmltext);
  match.score = await scorelib.getScore(match, htmltext);
  match.status = match.score.status ?? match.status;

  match.betTypes = await betlib.getBetTypes(match);
  if (!match.betTypes || Object.keys(match.betTypes).length === 0) {
    throw new CustomError('Failed getting bet types', { match, htmltext });
  }

  match.info.numMarkets = await feedlib.processMatchFeeds(match);
  if (match.info.numMarkets < 1) {
    throw new CustomError('No markets in feed', { url: match.url, htmltext });
  }

  updateMarketOdds(match);
  updateMatchInfo(match);

  // log.verbose(match);

  return match;
}

export async function getMatchFromWebPageUrl(url) {
  const parsedUrl = parseMatchUrl(url);
  // log.verbose(parsedUrl);
  const match = await getMatchFromWebPage(parsedUrl);
  log.verbose(match);  // todo
  return match;
}

export async function addMatchFromWebPageUrl(url) {
  const match = await getMatchFromWebPageUrl(url);
  await addMatchToDBIfFinished(match);
}

export function exportMatchToFile(match) {
  match.score.url = match.url;
  writeToFile(match.score, match.sport);
}

export async function updateMatchOddsHistoryDB(match) {
  const result = await updateOddsHistoryDB(match.oddsHistory);
  return { oddsHistory: result };
}

export async function addMatchToDB(match) {
  delete match.oddsHistory;
  match._id = match.id;
  await mongodb.db.collection(MATCHES).updateOne({ _id: match.id }, { $set: match }, { upsert: true });
}

export async function addMatchToDBIfFinished(match) {
  if (isFinished(match)) {
    await addMatchToDB(match);
  }
}

export function hasNormalMatchResult(match) {
  // return match?.score?.status === 'finished';
  return match.status === 'finished';
}

export function isFinished(match) {
  return match.status === 'finished';
}

function updateMatchInfo(match) {
  match.sportId = match.params.sportId;
  match.tournamentId = match.params.tournamentId;
  match.home = match.params.home;
  match.away = match.params.away;
  match.startTime = match.score.startTime;
  match.timestamp = match.score.timestamp;
  match.info.numBookies = getNumBookies(match);
}

function getNumBookies(match) {
  const numBookies = match.market[`${match.id}_1_2_1_0.00_0`]?.numBookies || match.market[`${match.id}_3_2_1_0.00_0`]?.numBookies;
  if (!numBookies) {
    log.error('No bookies:', match.url);
    return null;
  }
  return numBookies;
}


// CREATORS ----------------------------------------------------------------------------------------

function createMatch(parsedUrl) {
  return {
    id: parsedUrl.matchId,
    status: 'new',
    sport: parsedUrl.sport,
    sportId: null,
    country: parsedUrl.country,
    tournament: parsedUrl.tournament,
    tournamentId: null,
    tournamentKey: parsedUrl.tournamentKey,
    startTime: null,
    timestamp: null,
    home: null,
    away: null,
    url: parsedUrl.matchUrl,
    parsedUrl,
    betTypes: null,
    market: {},
    marketResult: {},
    marketOdds: {},
    oddsHistory: {},
    info: {}
  };
}
