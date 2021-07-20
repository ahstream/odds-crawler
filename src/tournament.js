/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');
const { createLogger } = require('./lib/loggerlib');
const mongodb = require('./mongodb.js');
const parser = require('./parser');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function getTournament(htmltext, parsedUrl, tournamentId) {
  const tournamentData = parser.parseTournamentName(htmltext);
  const tournament = createTournament(parsedUrl, tournamentId);
  tournament.guiName = tournamentData.name;
  tournament.guiYear = tournamentData.year;
  tournament.guiNameYear = `${tournament.guiName} ${tournament.guiYear}`.trim();
  tournament.mainYear = tournamentData.year2 ? tournamentData.year2 : tournamentData.year1;
  tournament.prevYear = tournamentData.year2 ? tournamentData.year1 : null;
  await addTournament(tournament);
  return tournament;
}

function getTournamentById(tournamentId) {
  return null;
}

function getTournamentByKey(tournamentKey) {
  return null;
}

const TOURNAMENTS = 'tournaments';
const TOURNAMENT_KEYS = 'tournamentKeys';

async function addTournament(tournament) {
  if (await existsInDB(tournament.id)) {
    // log.info('tournament exists in DB!');
    return false;
  }
  await addToDB(tournament);
  return true;
}

async function addTournamentKey(tournament) {
  if (await existsInKeyDB(tournament.key)) {
    // log.info('tournament key exists in DB!');
    return false;
  }
  await addToKeyDB(tournament);
  return true;
}

async function addToDB(tournament) {
  const dbItem = createTournamentDBItem(tournament);
  return (mongodb.db.collection(TOURNAMENTS).insertOne(dbItem));
}

async function addToKeyDB(tournament) {
  const dbItem = createTournamentKeyDBItem(tournament);
  return (mongodb.db.collection(TOURNAMENT_KEYS).insertOne(dbItem));
}

async function existsInDB(tournamentId) {
  return (await mongodb.db.collection(TOURNAMENTS).find({ _id: tournamentId }).limit(1).count()) === 1;
}

async function existsInKeyDB(tournamentKey) {
  return (await mongodb.db.collection(TOURNAMENT_KEYS).find({ _id: tournamentKey }).limit(1).count()) === 1;
}

function createTournamentDBItem(tournament) {
  return {
    _id: tournament.id,
    createdDate: new Date(),
    ...tournament
  };
}

function createTournamentKeyDBItem(tournament) {
  return {
    _id: tournament.id,
    createdDate: new Date(),
    ...tournament
  };
}

function createTournament(parsedUrl, tournamentId) {
  return {
    id: tournamentId,
    name: parsedUrl.tournamentName,
    year: parsedUrl.tournamentYear,
    nameWithYear: parsedUrl.tournamentNameWithYear,
    key: parsedUrl.tournamentKey,
    keyWithYear: parsedUrl.tournamentKeyWithYear,
    sport: parsedUrl.sport,
    country: parsedUrl.country,
    guiSport: null,
    guiCountry: null,
    guiName: null,
    guiYear: null,
    guiNameYear: null,
    mainYear: null,
    prevYear: null,
    active: true
  };
}
