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

// MAIN FUNCTIONS ---------------------------------------------------------------------------------

export async function getMatchFromWebPage(parsedUrl, skipMarkets = false) {
  const url = `https://www.oddsportal.com${parsedUrl.matchUrl}`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const match = createMatch(parsedUrl);
  match.skipMarkets = skipMarkets;

  match.params = parseMatchPageEvent(htmltext);
  match.score = await scorelib.getScore(match, htmltext);
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

  match.hasOdds = _.isEmpty(match.odds) === false;
  if (match.hasOdds) {
    updateMarketOdds(match);
  }

  addInfo(match, numBets);

  // log.verbose(match);

  return match;
}

export async function getMatchFromWebPageUrl(url, skipMarkets = false) {
  const parsedUrl = parseMatchUrl(url);
  // log.verbose(parsedUrl);
  const match = await getMatchFromWebPage(parsedUrl);
  log.verbose(match);  // todo
  return match;
}


export function exportMatchToFile(match) {
  match.score.url = match.url;
  writeToFile(match.score, match.sport);
}

export async function updateMatchInDB(match) {
  const result = await updateOddsHistoryDB(match.oddsHistory);
  return { oddsHistory: result };
}

export function hasNormalMatchResult(match) {
  // return match?.score?.status === 'finished';
  return match.status === 'finished';
}

export function isFinished(match) {
  return match.status === 'finished';
}

function addInfo(match, numBets) {
  match.sportId = match.params.sportId;
  match.tournamentId = match.params.tournamentId;
  match.home = match.params.home;
  match.away = match.params.away;
  match.startTime = match.score.startTime;
  match.timestamp = match.score.timestamp;
  match.info = {};
  const mainMarket = match.market[`${match.id}_1_2_1_0.00`];
  match.info.numBookies = mainMarket ? mainMarket.numBookies : null;
  match.info.numBets = numBets;
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
    url: parsedUrl.matchUrl,
    parsedUrl,
    startTime: null,
    timestamp: null,
    home: null,
    away: null,
    betTypes: null,
    market: {},
    marketResult: {},
    marketOdds: {},
    odds: {},
    oddsHistory: {}
  };
}
