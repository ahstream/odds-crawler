const fs = require('fs');

const config = require('../config/config.json');
const eventslib = require('../events.js');
const seasonslib = require('../seasons.js');
const { createLogger } = require('../src/lib/loggerlib');
const utilslib = require('../src/lib/utilslib');
const parser = require('../src/parser/parser.js');

const log = createLogger();

// EXPORTED FUNCTIONS =============================================================================

// Crawl ------------------------------------------------------------------------------------------

export async function crawlQueue(queueOptions = {}, { flReCrawl = true, flPreCrawl = true, skipDups = true }) {
  const options = { flReCrawl, flPreCrawl, skipDups };
  // Only pre- and re-crawl first time!
  const nextOptions = { flReCrawl: false, flPreCrawl: false, skipDups };

  log.info(
    `Crawl queue with queueOptions: ${JSON.stringify({
      queueOptions
    })}, options: ${JSON.stringify({ options })}`
  );

  if (options.flPreCrawl) {
    preCrawlQueue();
  }

  const queueItems = readItemsFromQueue(queueOptions);
  const queueLength = queueItems.length;
  if (queueLength <= 0) {
    log.info(`No queue items found!`);
    return 0;
  }

  let numDups = 0;

  for (let i = 0; i < queueLength; i++) {
    const queueItem = queueItems[i];
    log.info(`Process queue item ${i + 1} of ${queueLength}, type: ${queueItem.type}, arg: ${getItemDescription(queueItem)}`);

    const maxItems = queueItem.maxItems ?? 999999;

    const itemCount = 0;
    switch (queueItem.type) {
      case 'event':
        const event = await eventslib.crawlEvent(queueItem.url, queueItem.divisionCode, queueItem.year, {
          addToQueue: false,
          skipDups: options.skipDups
        });
        if (event.duplicate) {
          numDups++;
          removeFromQueue(queueItem);
        } else if (event.ok) {
          removeFromQueue(queueItem);
        } else if (event.error) {
          removeFromQueue(queueItem);
          addEvent(null, null, null, {
            ...queueItem,
            ...{ error: event.error }
          });
        }
        break;
      case 'season':
        const season = await seasonslib.getSeason(queueItem.divisionCode, queueItem.year, queueItem.url);
        if (season.ok) {
          log.info(`- Add ${season.eventUrls.length} events to queue and start crawling them...`);
          await utilslib.sleep(config.delayBetweenCrawledEvents);
          season.eventUrls.forEach((url, index) => {
            if (index >= config.maxSeasonEventsInQueue) {
              log.debug(`Stop after max season events reached: ${config.maxSeasonEventsInQueue}`);
              return;
            }
            addEvent(url, season.divisionCode, queueItem.year);
          });
          removeFromQueue(queueItem);
          await crawlQueue(
            {
              type: 'event',
              divisionCode: season.divisionCode,
              year: queueItem.year
            },
            nextOptions
          );
        } else if (season.error) {
          log.info('Season error:', season.error);
          removeFromQueue(queueItem);
          addSeason(null, null, { ...queueItem, ...{ error: season.error } });
        }
        break;
      case 'division':
        const seasons = await seasonslib.getSeasons(queueItem.divisionCode);
        if (seasons !== null && seasons.length > 0) {
          log.info(`- Add ${seasons.length} seasons to queue and start crawling them...`);
          seasons.forEach((season, index) => {
            if (index >= config.maxDivisionSeasonsInQueue) {
              log.debug(`Stop after max division seasons reached: ${config.maxSeasonEventsInQueue}`);
              return;
            }
            addSeason(queueItem.divisionCode, season.seasonYear);
          });
          removeFromQueue(queueItem);
          await crawlQueue({ type: 'season', divisionCode: queueItem.divisionCode }, nextOptions);
        } else {
          log.info(`- No seasons found to crawl in division: ${queueItem.divisionCode}`);
        }
        break;
      case 'divisions':
        log.info('Divisions NOT IMPLEMENTED YET!');
        break;
      default:
        log.error(`Unsupported queue type: ${queueItem}`);
    }
  }

  if (numDups > 0) {
    log.info(`Skipped crawling ${numDups} duplicate events!`);
  }

  let newQueueLength = getQueueLength();
  if (newQueueLength > 0 && options.flReCrawl) {
    log.info(`Re-crawl ${newQueueLength} items in queue...`);
    await crawlQueue(queueOptions, nextOptions);
    newQueueLength = getQueueLength();
  }

  log.info(`Queue length after final crawling: ${newQueueLength}`);

  return newQueueLength;
}

async function preCrawlQueue() {
  log.info(`Pre-crawl queue for text items...`);

  const queueItems = readItemsFromQueue();
  for (let i = 0; i < queueItems.length; i++) {
    // log.info(`Process text item ${i + 1} of ${queueItems.length}...`);
    const queueItem = queueItems[i];
    switch (queueItem.type) {
      case 'text':
        processTextItem(queueItem);
        removeFromQueue(queueItem.text);
        break;
      default:
      // do nothing
    }
  }
}

function processTextItem(queueItem) {
  log.info(`Process queue text item:`, queueItem.text);

  const url = queueItem.text;
  const parsedItem = parser.parseUrl(url);

  switch (parsedItem.type) {
    case 'event':
      addEvent(url, parsedItem.divisionCode, parsedItem.seasonYear);
      break;
    case 'season':
      addSeason(parsedItem.divisionCode, parsedItem.seasonYear, { url });
      break;
    case 'schedule':
      addDivision(parsedItem.divisionCode, { url });
      break;
    case 'country':
      addDivisions(url, parsedItem.sport, parsedItem.country);
      break;
    case 'sport':
      addDivisions(url, parsedItem.sport, '');
      break;
    default:
      log.error(`Unknown queue text item: ${queueItem}`);
  }

  removeFromQueue(queueItem.text);
}

// ADD --------------------------------------------------------------------------------------------

export function addUrl(url, options = {}) {
  return addToQueue(url);
}

export function addEvent(url, divisionCode, year, options = {}) {
  const baseOptions = { type: 'event', url, divisionCode, year };
  return addToQueue({ ...baseOptions, ...options });
}

export function addSeason(divisionCode, year, options = {}) {
  const baseOptions = { type: 'season', divisionCode, year };
  return addToQueue({ ...baseOptions, ...options });
}

export function addDivision(divisionCode, options = {}) {
  const baseOptions = { type: 'division', divisionCode };
  return addToQueue({ ...baseOptions, ...options });
}

export function addDivisions(url, sport, country, options = {}) {
  const baseOptions = { type: 'divisions', sport, country, url };
  return addToQueue({ ...baseOptions, ...options });
}

//  READ  --------------------------------------------------------------------------------------------

export function readItemsFromQueue(options = {}) {
  if (!fs.existsSync(config.pathToCrawlerQueue)) {
    return [];
  }
  const queueItems = [];
  fs.readFileSync(config.pathToCrawlerQueue, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      const item = createItem(line);
      if (itemMatchWithOptions(item, options)) {
        queueItems.push(item);
      }
    });
  return queueItems;
}

function textExistsInQueue(text) {
  if (!fs.existsSync(config.pathToCrawlerQueue)) {
    return false;
  }
  fs.readFileSync(config.pathToCrawlerQueue, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      if (line == text) {
        return true;
      }
    });
  return false;
}

export function reset() {
  fs.writeFileSync(config.pathToCrawlerQueue, '');
}

export function getQueueLength() {
  return readItemsFromQueue().length;
}

//  HELPER FUNCTIONS  ---------------------------------------------------------------------------------

function addToQueue(itemOrText) {
  switch (typeof itemOrText) {
    case 'object':
      return addItemToQueue(itemOrText);
    case 'string':
      return addTextToQueue(itemOrText);
    default:
      return false;
  }
}

function removeFromQueue(itemOrText) {
  if (!fs.existsSync(config.pathToCrawlerQueue)) {
    return false;
  }

  const type = typeof itemOrText === 'object' ? 'json' : 'string';
  const itemString = type === 'json' ? JSON.stringify(itemOrText) : itemOrText;

  let isRemoved = false;
  const currentLines = [];
  fs.readFileSync(config.pathToCrawlerQueue, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      try {
        const objString = type === 'json' ? JSON.stringify(JSON.parse(line)) : line;
        if (objString === itemString) {
          log.debug('objString === itemString');
          isRemoved = true;
          return;
        }
      } catch (error) {
        // log.info(`Cannot JSON parse line: ${line}`);
      }
      currentLines.push(line);
    });

  reset();

  fs.writeFileSync(config.pathToCrawlerQueue, currentLines.join('\r\n'));

  return isRemoved;
}

function addItemToQueue(item) {
  const existingItems = readItemsFromQueue(item);
  if (existingItems.length > 0) {
    return false;
  }
  const content = JSON.stringify(item);
  fs.appendFileSync(config.pathToCrawlerQueue, `\r\n${content}`);
  return true;
}

function addTextToQueue(text) {
  if (textExistsInQueue(text)) {
    return false;
  }
  fs.appendFileSync(config.pathToCrawlerQueue, `\r\n${text}`);
  return true;
}

function createItem(line) {
  try {
    return JSON.parse(line.trim());
  } catch (error) {
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0) {
      return { type: 'text', text: trimmedLine };
    }
    return null;
  }
}

function itemMatchWithOptions(item, options = {}) {
  // log.info('itemMatch:', item, options);
  if (item === null || item === '') {
    return false;
  }
  if (options.type !== undefined && options.type !== item.type) {
    return false;
  }
  if (options.divisionCode !== undefined && options.divisionCode !== item.divisionCode) {
    return false;
  }
  if (options.url !== undefined && options.url !== item.url) {
    return false;
  }
  if (options.year !== undefined && options.year !== item.year) {
    return false;
  }

  return true;
}

function getItemDescription(queueItem) {
  switch (queueItem.type) {
    case 'event':
      return queueItem.event || queueItem.url;
    case 'season':
      return `${queueItem.year}, ${queueItem.divisionCode}`;
    case 'division':
      return `${queueItem.divisionCode}`;
    case 'divisions':
      return `${queueItem.url}`;
    default:
      return `Unknown queue item type: ${queueItem.type}`;
  }
}
