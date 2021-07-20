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

// RUNTIME ----------------------------------------------------------------------------------

program.option('--force', 'Force execution', false);
program.option('--deleteLogFiles', 'Delete log files', false);
program.option('--initWithMaxDays', 'Run forst crawling with max days', false);
program.option('--interval <value>', 'Minute interval for crawling', myParseInt, 60);
program.option('--intervalMax <value>', 'Minute interval for max crawling', myParseInt, 0);
program.option('--sportName <value>', 'Sport name', 'soccer');
program.option('--datestr <value>', 'Date string (YYYYMMDD)', '');
program.option('--daysAfter <value>', 'Days after', myParseInt, 0);
program.option('--daysAfterMax <value>', 'Days after max', myParseInt, 0);
program.option('--daysBefore <value>', 'Days before', myParseInt, 0);
program.option('--daysBeforeMax <value>', 'Days before max', myParseInt, 0);
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
          datestr: options.datestr,
          sportName: options.sportName,
          interval: options.interval,
          daysAfter: options.daysAfter,
          daysBefore: options.daysBefore
        });
        break;
      case 'crawlAllSportsMatchPages':
        await crawlAllSportsMatchPages({
          datestr: options.datestr,
          interval: options.interval,
          intervalMax: options.intervalMax,
          daysAfter: options.daysAfter,
          daysBefore: options.daysBefore,
          daysAfterMax: options.daysAfterMax,
          daysBeforeMax: options.daysBeforeMax,
          initWithMaxDays: options.initWithMaxDays
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
 * @param args: { interval, sportName, datestr, daysAfter, daysBefore}
 */
async function crawlMatchPages(args) {
  try {
    log.info('Begin crawl match pages... ', JSON.stringify(args));
    const numTimes = args.interval ? Infinity : 1;
    for (let ct = 1; ct <= numTimes; ct++) {
      log.info(`Run #${ct} started...`);
      const crawlResult = await crawlMatchPagesThread(args);
      if (!crawlResult) {
        log.error('Crawl result:', crawlResult);
      }
      log.info(`Result: ${crawlResult.numMatchLinks.total}/${crawlResult.numMatchLinks.new}/${crawlResult.numMatchLinks.existing}/${crawlResult.numMatchLinks.ignored}; ${crawlResult.numOtherLinks.total}/${crawlResult.numOtherLinks.new}/${crawlResult.numOtherLinks.existing}/${crawlResult.numOtherLinks.ignored} (total/new/dups/ignored)`);
      if (ct < numTimes) {
        log.info(`Sleep for ${args.interval} minutes before starting crawlMatchPages run #${ct + 1}...`);
        await utilslib.sleep(args.interval * 60 * 1000);
      }
    }
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  }
}

function addMinutesToDate(minutes, date) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * crawlAllSportsMatchPages()
 * @param args: { ... }
 */
async function crawlAllSportsMatchPages(args) {
  try {
    log.info('Begin crawl all sports match pages... ', JSON.stringify(args));
    let nextMaxRunDate = args.intervalMax <= 0 ? new Date('2199-01-01') : addMinutesToDate(args.intervalMax, new Date());
    if (args.initWithMaxDays) {
      nextMaxRunDate = new Date();
    }

    const sportNames = sportlib.getSportNames();
    const numTimes = args.interval ? Infinity : 1;
    for (let ct = 1; ct <= numTimes; ct++) {
      const runDate = new Date();
      const daysAfter = runDate < nextMaxRunDate ? args.daysAfter : args.daysAfterMax;
      const daysBefore = runDate < nextMaxRunDate ? args.daysBefore : args.daysBeforeMax;
      log.info(`Run #${ct} started... (${daysAfter}/${daysBefore})`);
      log.debug('runDate, nextMaxRunDate, daysAfter, daysBefore', runDate, nextMaxRunDate, daysAfter, daysBefore);

      for (const sportName of sportNames) {
        const newArgs = { sportName, datestr: args.datestr, daysAfter, daysBefore };
        const crawlResult = await crawlMatchPagesThread(newArgs);
        if (!crawlResult) {
          log.error('Crawl result error:', crawlResult);
        }
      }

      if (runDate >= nextMaxRunDate) {
        nextMaxRunDate = addMinutesToDate(args.intervalMax, new Date());
        log.debug('new nextMaxRunDate', nextMaxRunDate);
      }

      if (ct < numTimes) {
        log.info(`Sleep for ${args.interval} minutes before starting crawlAllSportsMatchPages run #${ct + 1}...`);
        await utilslib.sleep(args.interval * 60 * 1000);
      }
    }
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  }
}

async function crawlMatchPagesThread({ sportName, datestr, daysAfter, daysBefore }) {
  try {
    const date = datestrToDate(datestr);
    return await matchLink.crawlMatchPages(sportName, date, daysAfter, daysBefore);
  } catch (e) {
    log.error('Error:', e.message, e);
    return null;
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
        log.info(`Sleep for ${args.interval} minutes before starting crawlMatchLinks run #${ct + 1}...`);
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
    return await matchLink.crawlMatchLinks(status, force);
  } catch (e) {
    log.error('Error:', e.message, e);
    return null;
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

function initLogFiles(doDelete) {
  if (doDelete) {
    log.info('Delete log files... ');
    deleteLogFiles();
  }
}
