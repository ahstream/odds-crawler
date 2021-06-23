// DECLARES -----------------------------------------------------------------------------

import { ignoreLinks, getNextMatches, getNextMatchesOneDay, processMatchLinks, resetOddsHistoryDB } from './match/match';

const bookielib = require('./bookie/bookie.js');
const crawlerQueue = require('./crawler/crawlerQueue.js');
const dataWriter = require('./dataWriter/dataWriter');
const { createLogger, deleteLogFiles } = require('./lib/loggerlib');
const match = require('./match/match.js');
const matchLink = require('./match/matchLink.js');
const mongo = require('./mongo/mongodb.js');

deleteLogFiles('logs/');
const log = createLogger();

// VARIABLES -----------------------------------------------------------------------------

// SESSION FUNCTIONS -----------------------------------------------------------------------------

async function run() {
  log.info('Dev start...');

  await mongo.connect();

  try {
    if (false) {
      log.info('Reset result files...');
      dataWriter.resetFiles('event');
      await crawlerQueue.dispatch(1);
    }

    if (false) {
      dataWriter.resetFiles('bookie');
      // await bookielib.getBookiesFromWebPage();
      await bookielib.crawlBookies();
      // await metadatalib.getMetadataFromWebPage();
    }

    if (true) {
      const date = new Date(Date.parse('2021-06-09')); // new Date();
      await match.resetOddsHistoryDB();
      await matchLink.resetDB();
      const r1 = await matchLink.crawlPeriod('soccer', 1, date, 0, 0);
      await matchLink.processMatchLinks();
      // await matchLink.processOtherLinks();
      // await match.processMatches();
      // await match.exportMatches();
    }
  } catch (e) {
    log.error('error:', e);
  } finally {
    await mongo.close();
  }
}

log.info('Dev end!');

run();
