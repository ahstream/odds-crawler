/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { createLogger, deleteLogFiles } from './lib/loggerlib';

const program = require('commander');

const utilslib = require('./lib/utilslib');
const matchLink = require('./matchLink.js');
const mongodb = require('./mongodb.js');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

async function runCmd() {
  const options = program.opts();
  const cmd = program.args[0];
  switch (cmd) {
    case 'crawlMatchPages':
      await crawlMatchPages({
        interval: options.interval,
        sportName: options.sportName,
        sportId: options.sportId,
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
    case 'resetDB':
      await resetDB();
      break;
    case 'resetLogFiles':
      log.info('Reset log files... ');
      deleteLogFiles('logs/');
      log.info('Done!');
      break;
    default:
      // throw new program.InvalidArgumentError('Unknown command!');
      log.error(`Unknown command: ${cmd}`);
  }
}

/**
 * @param config: { interval, sportName, sportId, datestr, daysAfter, daysBefore}
 */
async function crawlMatchPages(config) {
  try {
    log.info('Begin crawl match links... ', config);
    const numTimes = config.interval ? Infinity : 1;
    for (let ct = 1; ct <= numTimes; ct++) {
      log.info(`Run #${ct} started...`);
      log.info('Result:', await crawlMatchPagesThread(config));
      if (ct < numTimes) {
        log.info(`Sleep for ${config.interval} minutes before starting run #${ct + 1}...`);
        await utilslib.sleep(config.interval * 60 * 1000);
      }
    }
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  }
}

async function crawlMatchPagesThread({ sportName, sportId, datestr, daysAfter, daysBefore }) {
  try {
    const date = datestrToDate(datestr);
    await setupDB();
    return await matchLink.crawlMatchPages(sportName, sportId, date, daysAfter, daysBefore);
  } catch (e) {
    log.error('Error:', e.message, e);
    return null;
  } finally {
    await closeDB();
  }
}

/**
 * @param config: { interval, status, force}
 */
async function crawlMatchLinks(config) {
  try {
    log.info('Begin crawl match links... ', config);
    const numTimes = config.interval ? Infinity : 1;
    for (let ct = 1; ct <= numTimes; ct++) {
      log.info(`Run #${ct} started...`);
      log.info('Result:', await crawlMatchLinksThread(config));
      if (ct < numTimes) {
        log.info(`Sleep for ${config.interval} minutes before starting run #${ct + 1}...`);
        await utilslib.sleep(config.interval * 60 * 1000);
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

async function resetDB() {
  try {
    await setupDB();
    log.info('Reset mongo db collection: matchLinks');
    await mongodb.dropCollection('matchLinks');
    log.info('Reset mongo db collection: matchLinksCompleted');
    await mongodb.dropCollection('matchLinksCompleted');
    log.info('Reset mongo db collection: otherLinks');
    await mongodb.dropCollection('otherLinks');
    log.info('Reset mongo db collection: ignoredLinks');
    await mongodb.dropCollection('ignoredLinks');
    // log.info('Reset mongo db collection: oddsHistory');
    // await mongodb.dropCollection('oddsHistory');
    log.info('Done!');
  } catch (e) {
    log.error('Error:', e.message, e);
  } finally {
    await closeDB();
  }
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

async function setupDB() {
  log.debug('Setup mongodb db...');
  await mongodb.connect();
}

async function closeDB() {
  log.debug('Close mongodb db...');
  await mongodb.close();
}

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

function myParseInt(value, dummyPrevious) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    throw new program.InvalidArgumentError('Not a number!');
  }
  return parsedValue;
}

program.option('--force', 'Force execution', false);
program.option('--interval <value>', 'Minute interval for crawling', myParseInt, 60);
program.option('--sportName <value>', 'Sport name', 'soccer');
program.option('--sportId <value>', 'Sport ID', myParseInt, 1);
program.option('--datestr <value>', 'Date string (YYYYMMDD)', '');
program.option('--daysAfter <value>', 'Days ahead', myParseInt, 0);
program.option('--daysBefore <value>', 'Days before', myParseInt, 0);
program.option('--status <value>', 'Status', null);
program.parse();

runCmd();
