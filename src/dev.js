'use strict';

// DECLARES -----------------------------------------------------------------------------

const dataWriter = require('./dataWriter');
const bookielib = require('./bookie.js');
const metadatalib = require('./metadata.js');
const crawlerQueue = require('./crawlerQueue.js');
const { createLogger, deleteLogFiles } = require('./lib/loggerlib');

deleteLogFiles('logs/');
const log = createLogger();

// VARIABLES -----------------------------------------------------------------------------

// SESSION FUNCTIONS -----------------------------------------------------------------------------

async function run() {
  log.info('Dev start...');

  if (true) {
    log.info('Reset result files...');
    dataWriter.resetFiles('event');
    await crawlerQueue.dispatch(1);
  }

  if (false) {
    dataWriter.resetFiles('bookie');
    //await bookielib.getBookiesFromWebPage();
    await bookielib.crawlBookies();
    // await metadatalib.getMetadataFromWebPage();
  }

  log.info('Dev end!');
}

run();
