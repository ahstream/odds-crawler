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
import { getTournament } from './tournament';

const _ = require('lodash');

const betlib = require('./bet');
const feedlib = require('./feed');
const { createLogger } = require('./lib/loggerlib');
const scorelib = require('./matchScore');
const mongodb = require('./mongodb.js');

const log = createLogger();

const MATCHES = 'matches';

// MAIN FUNCTIONS ---------------------------------------------------------------------------------

export async function getMatchFromWebPage(parsedUrl) {
  const url = `https://www.oddsportal.com${parsedUrl.matchUrl}`;
  const htmltext = await httpGetAllowedHtmltext([url]);

  const match = createMatch(parsedUrl);

  match.params = parseMatchPageEvent(htmltext);
  match.matchScore = await scorelib.getMatchScore(match, htmltext);
  match.status = match.matchScore.status ?? match.status;
  match.statusType = match.matchScore.type;

  match.tournament = await getTournament(htmltext, parsedUrl, match.params.tournamentId);

  match.betTypes = await betlib.getBetTypes(match);
  if (!match.betTypes || Object.keys(match.betTypes).length === 0) {
    log.debug('CustomError: Failed getting bet types for:', { match, htmltext });
    throw new CustomError('Failed getting bet types for:', { match, htmltext });
  }

  match.info.numMarkets = await feedlib.processMatchFeeds(match);
  if (match.info.numMarkets < 1) {
    log.debug('CustomError: No markets in feed for:', { url: match.url, htmltext });
    throw new CustomError('No markets in feed for:', { url: match.url, htmltext });
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
  // log.verbose(match);  // todo
  return match;
}

export async function addMatchFromWebPageUrl(url) {
  const match = await getMatchFromWebPageUrl(url);
  await addMatchToDBIfCompleted(match);
}

export function exportMatchToFile(match) {
  match.matchScore.url = match.url;
  writeToFile(match.matchScore, match.sportName);
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

export async function addMatchToDBIfCompleted(match) {
  if (isCompleted(match)) {
    await addMatchToDB(match);
  }
}

export function hasNormalMatchResult(match) {
  return match.status === 'finished';
}

export function isFinished(match) {
  return match.status === 'finished';
}

export function isCompleted(match) {
  return match.matchScore.type === 'finished' ||
    match.matchScore.type === 'canceled' ||
    match.matchScore.type === 'awarded';
}

export function isScheduled(match) {
  return match.matchScore.type === 'scheduled';
}

export function isRescheduled(match) {
  return match.matchScore.type === 'postponed';
}

function updateMatchInfo(match) {
  match.sportId = match.params.sportId;
  match.tournamentId = match.params.tournamentId;
  match.homeTeam = match.params.home;
  match.awayTeam = match.params.away;
  match.startTime = match.matchScore.startTime;
  match.timestamp = match.matchScore.timestamp;
  match.info.numBookies = getNumBookies(match);
}

function getNumBookies(match) {
  const numBookiesList = [];
  numBookiesList.push(match.market[`${match.id}_1_1_1_0.00_0`]?.numBookies ?? 0);
  numBookiesList.push(match.market[`${match.id}_1_2_1_0.00_0`]?.numBookies ?? 0);
  numBookiesList.push(match.market[`${match.id}_3_1_1_0.00_0`]?.numBookies ?? 0);
  numBookiesList.push(match.market[`${match.id}_3_2_1_0.00_0`]?.numBookies ?? 0);
  const numBookies = _.max(numBookiesList);
  if (numBookies < 1) {
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
    statusType: null,
    sportName: parsedUrl.sport,
    sportId: null,
    countryName: parsedUrl.country,
    tournamentId: null,
    tournamentName: parsedUrl.tournamentName,
    tournamentKey: parsedUrl.tournamentKey,
    startTime: null,
    timestamp: null,
    homeTeam: null,
    awayTeam: null,
    url: parsedUrl.matchUrl,
    parsedUrl,
    betTypes: null,
    market: {},
    marketOdds: {},
    oddsHistory: {},
    info: {}
  };
}
