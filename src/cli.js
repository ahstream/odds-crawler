/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { createLogger, deleteLogFiles } from './lib/loggerlib';
import { addMatchFromWebPageUrl, getMatchFromWebPageUrl } from './match';
import { moveBackToMatchLinksQueue } from './matchLink';

const program = require('commander');

const config = require('../config/config.json');
const httplib = require('./lib/httplib');
const utilslib = require('./lib/utilslib');
const matchLink = require('./matchLink.js');
const mongodb = require('./mongodb.js');
const oddsHistory = require('./oddsHistory.js');
const sportlib = require('./sport.js');

const log = createLogger();

// todo: lägg tillbaka marketResult i market
// todo: crawlMatchPages för flera sporter samtidigt

// RUNTIME ----------------------------------------------------------------------------------

program.option('--force', 'Force execution', false);
program.option('--deleteLogFiles', 'Delete log files', false);
program.option('--interval <value>', 'Minute interval for crawling', myParseInt, 60);
program.option('--sport <value>', 'Sport name', 'soccer');
// program.option('--sportId <value>', 'Sport ID', myParseInt, 1);
program.option('--datestr <value>', 'Date string (YYYYMMDD)', '');
program.option('--daysAfter <value>', 'Days ahead', myParseInt, 0);
program.option('--daysBefore <value>', 'Days before', myParseInt, 0);
program.option('--status <value>', 'Status', null);
program.option('--url <value>', 'URL', null);
program.parse();

runCommand();

// MAIN FUNCTIONS ----------------------------------------------------------------------------------

/**
 * runCommand()
 */
async function runCommand() {
  try {
    const options = program.opts();
    initLogFiles(options.deleteLogFiles);
    log.info('Run command...');

    await setupDB();

    const cmd = program.args[0];
    switch (cmd) {
      case 'getMatch':
        await getMatchFromWebPageUrl(options.url);
        break;
      case 'addMatch':
        await addMatchFromWebPageUrl(options.url);
        break;
      case 'crawlMatchPages':
        await crawlMatchPages({
          interval: options.interval,
          sport: options.sport,
          sportId: lookupSportId(options.sport),
          datestr: options.datestr,
          daysAfter: options.daysAfter,
          daysBefore: options.daysBefore
        });
        break;
      case 'crawlMatchLinks':
        await crawlMatchLinks({
          interval: options.interval,
          status: options.status,
          force: options.force
        });
        break;
      case 'moveBackToMatchLinksQueue':
        await moveBackToMatchLinksQueue();
        break;
      case 'deleteLogFiles':
        initLogFiles(true);
        break;
      case 'initOddsHistoryDB':
        await oddsHistory.initOddsHistoryDB();
        break;
      default:
        // throw new program.InvalidArgumentError('Unknown command!');
        log.error(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    log.error('Error in runCommand:', err);
    log.verbose('Error in runCommand:', JSON.stringify(err));
  } finally {
    await closeDB();
  }
}

/**
 * crawlMatchPages()
 * @param args: { interval, sport, sportId, datestr, daysAfter, daysBefore}
 */
async function crawlMatchPages(args) {
  try {
    log.info('Begin crawl match links... ', args);
    const numTimes = args.interval ? Infinity : 1;
    for (let ct = 1; ct <= numTimes; ct++) {
      log.info(`Run #${ct} started...`);
      const crawlResult = await crawlMatchPagesThread(args);
      if (!crawlResult) {
        log.error('Crawl result:', crawlResult);
      }
      if (ct < numTimes) {
        log.info(`Sleep for ${args.interval} minutes before starting run #${ct + 1}...`);
        await utilslib.sleep(args.interval * 60 * 1000);
      }
    }
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  }
}

async function crawlMatchPagesThread({ sport, sportId, datestr, daysAfter, daysBefore }) {
  try {
    const date = datestrToDate(datestr);
    await setupDB();
    return await matchLink.crawlMatchPages(sport, sportId, date, daysAfter, daysBefore);
  } catch (e) {
    log.error('Error:', e.message, e);
    return null;
  } finally {
    await closeDB();
  }
}

/**
 * crawlMatchLinks()
 * @param args: { interval, status, force}
 */
async function crawlMatchLinks(args) {
  try {
    log.info('Begin crawl match links... ', args);
    const numTimes = args.interval ? Infinity : 1;
    for (let ct = 1; ct <= numTimes; ct++) {
      log.info(`Run #${ct} started...`);
      log.info('Result:', await crawlMatchLinksThread(args));
      if (ct < numTimes) {
        log.info(`Sleep for ${args.interval} minutes before starting run #${ct + 1}...`);
        await utilslib.sleep(args.interval * 60 * 1000);
      }
    }
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  }
}

async function crawlMatchLinksThread({ status = null, force = false }) {
  try {
    await setupDB();
    return await matchLink.crawlMatchLinks(status, force);
  } catch (e) {
    log.error('Error:', e.message, e);
    return null;
  } finally {
    await closeDB();
  }
}

/**
 * setupDB()
 */
async function setupDB() {
  await mongodb.connect();
}

/**
 * closeDB()
 */
async function closeDB() {
  await mongodb.close();
}

/**
 * resetDB()
 */
async function resetDB() {
  try {
    log.info('Reset DB...');
    await setupDB();
    await mongodb.dropCollection('matchLinks');
    await mongodb.dropCollection('matchLinksCompleted');
    await mongodb.dropCollection('otherLinks');
    await mongodb.dropCollection('ignoredLinks');
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  } finally {
    await closeDB();
  }
}

// HELPERS ----------------------------------------------------------------------------------

/**
 * datestrToDate()
 */
function datestrToDate(val) {
  if (val === '') {
    return new Date();
  }
  if (typeof val !== 'string' || val.length !== 8) {
    throw new Error(`Wrong datestr format: ${val}`);
  }
  const datestr = `${val.substr(0, 4)}-${val.substr(4, 2)}-${val.substr(6, 2)}`;
  return new Date(Date.parse(datestr));
}

/**
 * myParseInt()
 */
function myParseInt(value, dummyPrevious) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    throw new program.InvalidArgumentError('Not a number!');
  }
  return parsedValue;
}

/**
 * lookupSportId()
 */
function lookupSportId(sportName) {
  return sportlib.getSportId(sportName);
}

function initLogFiles(doDelete) {
  if (doDelete) {
    log.info('Delete log files... ');
    deleteLogFiles();
  }
}
