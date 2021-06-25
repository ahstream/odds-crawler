/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { createLogger, deleteLogFiles } from './lib/loggerlib';

const { program } = require('commander');

const match = require('./match.js');
const matchLink = require('./matchLink.js');
const mongo = require('./mongodb.js');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

async function run() {
  deleteLogFiles('logs/');
  log.info('Dev start...');

  await mongo.connect();

  try {
    if (true) {
      const date = new Date(Date.parse('2021-06-24')); // new Date();
      log.info('resetOddsHistoryDB...');
      await match.resetOddsHistoryDB();
      log.info('resetDB...');
      await matchLink.resetDB();
      log.info('crawlPeriod...');
      const r1 = await matchLink.crawlPeriod('soccer', 1, date, 1, 0);
      log.info('processMatchLinks...');
      await matchLink.processMatchLinks('', false);
    }
  } catch (e) {
    log.error('error:', e);
  } finally {
    await mongo.close();
  }
}

program.option('-c, --command <name>', 'command name', 'default');
program.parse();
console.log(`command: ${program.opts().command}`);

run();
