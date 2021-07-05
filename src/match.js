/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { writeToFile } from './dataWriter';
import { CustomError } from './exceptions';
import { updateOddsHistoryDB } from './oddsHistory';
import { parseMatchPageEvent } from './parser';
import { httpGetAllowedHtmltext } from './provider';

const _ = require('lodash');

const betlib = require('./bet');
const feedlib = require('./feed');
const { createLogger } = require('./lib/loggerlib');
const mongodb = require('./mongodb.js');
const scorelib = require('./score');

const log = createLogger();

// MAIN FUNCTIONS ---------------------------------------------------------------------------------

export function exportMatchToFile(match) {
  match.score.url = match.url;
  writeToFile(match.score, match.sport);
}

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

  const numBets = await feedlib.processMatchFeeds(match);
  if (numBets < 1) {
    throw new CustomError('No bets in feed', { url: match.url, htmltext });
  }
  match.numBets = numBets;
  log.debug(`Num bets in feed: ${numBets}`);

  match.hasOdds = _.isEmpty(match.odds) === false;
  if (match.hasOdds) {
    // todo: marketoddslib.updateMarketOdds(match);
  }

  addInfo(match);

  log.verbose(match);

  return match;
}

function addInfo(match) {
  match.info = {};
  const mainMarket = match.market[`${match.id}_1_2_1_0.00`];
  match.info.numBookies = mainMarket ? mainMarket.numBookies : null;
  match.info.numBets = match.numBets;
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
