const bookielib = require('./bookie/bookie.js');
const crawlerQueue = require('./crawler/crawlerQueue.js');
const dataWriter = require('./dataWriter/dataWriter');
const { createLogger, deleteLogFiles } = require('./lib/loggerlib');
const match = require('./match/match.js');
const matchLink = require('./match/matchLink.js');
const mongo = require('./mongo/mongodb.js');

deleteLogFiles('logs/');
const log = createLogger();

// SESSION FUNCTIONS -----------------------------------------------------------------------------

async function run({ reset = false, bookies = false, odds = true } = {}) {
  log.info('Dev start...');

  await mongo.connect();

  try {
    if (reset) {
      log.info('Reset result files...');
      dataWriter.resetFiles('event');
      await crawlerQueue.dispatch(1);
    }

    if (bookies) {
      log.info('Crawl bookies...');
      dataWriter.resetFiles('bookie');
      await bookielib.crawlBookies();
    }

    if (odds) {
      log.info('Crawl odds...');
      const date = new Date(Date.parse('2021-06-09')); // new Date();
      await match.resetOddsHistoryDB();
      await matchLink.resetDB();
      const r1 = await matchLink.crawlPeriod('soccer', 1, date, 0, 0);
      await matchLink.processMatchLinks();
    }
  } catch (e) {
    log.error('error:', e);
  } finally {
    await mongo.close();
  }
}

run();
