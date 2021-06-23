const { createLogger } = require('../lib/loggerlib');
const provider = require('../provider/provider');
const oddsitemlib = require('./oddsItem.js');

const log = createLogger();

// MAIN FUNCTIONS -----------------------------------------------------------------------------

export function addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, oddsItem) {
  if (!oddsItem.date) {
    log.debug('Odds missing date:', oddsId);
    return;
  }
  const id = createId(oddsId, oddsItem.date);
  match.history[id] = createOdds(id, match, marketId, betArgs, outcomeArgs, bookieArgs, oddsItem);
}

export function addHistory(match, feed, marketId, oddsId, betArgs, outcomeArgs, bookieArgs) {
  try {
    const backOrLayKey = betArgs.isBack ? 'back' : 'lay';

    if (!feed.history[backOrLayKey][outcomeArgs.id] || !feed.history[backOrLayKey][outcomeArgs.id][bookieArgs.id]) {
      return;
    }

    Object.keys(feed.history[backOrLayKey][outcomeArgs.id][bookieArgs.id]).forEach((key, _index) => {
      const ptr = feed.history[backOrLayKey][outcomeArgs.id][bookieArgs.id][key];

      const odds = provider.ensureOddsOrNull(ptr[0]);
      const date = provider.ensureDateOrNull(ptr[2]);
      const volume = provider.ensureVolumeOrNull(ptr[1]);
      const oddsItem = oddsitemlib.createOddsItem(odds, date, volume);

      addOdds(match, marketId, oddsId, betArgs, outcomeArgs, bookieArgs, oddsItem);
    });
  } catch (error) {
    log.debug('Error at addHistory:', marketId, oddsId, betArgs, outcomeArgs, bookieArgs, error);
    throw error;
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function createId(oddsId, date) {
  return `${oddsId}_${date.getTime()}`;
}

function createOdds(id, match, marketId, betArgs, outcomeArgs, bookieArgs, oddsItem) {
  return {
    id,
    matchId: match.id,
    marketId,
    // betName,
    // bt,
    // sc,
    // back,
    outcome: outcomeArgs.num,
    bookie: bookieArgs.num,
    odds: oddsItem.odds,
    date: oddsItem.date,
    volume: oddsItem.volume
  };
}
