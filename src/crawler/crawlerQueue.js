// DECLARES =======================================================================================

const fs = require('fs');

const config = require('../../config/config.json');
const divisionlib = require('../division/division.js');
const seasonlib = require('../division/season.js');
const eventlib = require('../event.js');
const { createLogger } = require('../lib/loggerlib');
const utilslib = require('../lib/utilslib');
const parser = require('../parser/parser.js');

const log = createLogger();

// MAIN FUNCTIONS =============================================================================

export async function dispatch(recrawlTimes = 1, counter = 1) {
  /**
   * 1. Kör text (lägg till nya items, ta bort text)
   * 2. Kör event (ta bort, lägg tillbaka med errorMsg vid error)
   * 3. Kör season (lägg till alla event, ta bort item, kör event på divisionCode + year)
   * 4. Kör division (lägg till alla seasons, ta bort item, kör season på divisionCode)
   * 5. Kör country (lägg till alla divisions, ta bort item, kör division på country)
   * 6. Kör sport (lägg till alla divisions, ta bort item, kör division)
   */
  log.info(`Dispatch crawler queue, run: ${counter}, max re-crawl times: ${recrawlTimes + 1}`);

  await processQueueByType('text');
  await processQueueByType('event');
  await processQueueByType('season');
  await processQueueByType('division');
  await processQueueByType('country');
  await processQueueByType('sport');

  const queueLength = getQueueLength();
  log.info(`Queue length after crawling: ${queueLength}`);

  if (queueLength > 0) {
    if (recrawlTimes > 0) {
      log.info(`Start re-crawl because queue is still not empty and re-crawl counter is ${recrawlTimes}...`);
      await dispatch(recrawlTimes - 1, counter + 1);
    } else {
      log.info(`Re-crawl counter is ${recrawlTimes}, finish crawling even though queue is not empty!`);
    }
  }
}

// HELPER FUNCTIONS =============================================================================

async function processQueueItems(items) {
  if (items.length) {
    log.info(`Process ${items.length} queue items...`);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    log.info(`Process item ${i + 1} of ${items.length}, ${item.type}: ${item.url ?? item.text}`);
    switch (item.type) {
      case 'text':
        processTextItem(item);
        break;
      case 'event':
        await processEventItem(item);
        break;
      case 'season':
        await processSeasonItem(item);
        break;
      case 'division':
        await processDivisionItem(item);
        break;
      case 'country':
        await processCountryItem(item);
        break;
      case 'sport':
        await processSportItem(item);
        break;
      default:
      // do nothing
    }
  }
}

async function processQueueByType(type) {
  log.info(`Check for queue items by type: ${type}`);
  await processQueueItems(readFromQueueByType(type));
}

async function processQueueByOptions(options) {
  log.info(`Check for queue items by options: ${JSON.stringify(options)}`);
  await processQueueItems(readFromQueue(options));
}

function processTextItem(item) {
  // INFO: Kör text (lägg till nya items, ta bort text)

  const url = item.text;
  const parsedUrl = parser.parseUrl(url);

  switch (parsedUrl.type) {
    case 'event':
      addEvent(url, parsedUrl.divisionCode, parsedUrl.year);
      break;
    case 'season':
      addSeason(url, parsedUrl.divisionCode);
      break;
    case 'schedule':
      addDivision(url);
      break;
    case 'country':
      addCountry(url, parsedUrl.sport, parsedUrl.country);
      break;
    case 'sport':
      addSport(url, parsedUrl.sport);
      break;
    default:
      log.error(`Unknown queue text item: ${item}`);
  }

  removeItemFromQueue(item);
}

async function processEventItem(item) {
  const event = await eventlib.crawlEvent(item.url, item.divisionCode, item.year, {});
  removeItemFromQueue(item);
  if (event.error) {
    addEvent(item.url, item.divisionCode, item.year, {
      ...item,
      ...{ error: event.error }
    });
  }
}

async function processSeasonItem(item) {
  // INFO: Kör season (lägg till alla event, ta bort item, kör event på divisionCode + year)
  const season = await seasonlib.getSeasonFromWebPage(item.url, {});
  if (!season.error) {
    log.info(`Add ${season.eventLinks.length} events to queue and start crawling them...`);
    await utilslib.sleep(config.delayBetweenCrawledEvents);
    season.eventLinks.forEach((url, index) => {
      addEvent(url, season.divisionCode, season.year);
    });
    removeItemFromQueue(item);
    await processQueueByOptions({
      type: 'event',
      divisionCode: season.divisionCode,
      year: season.year
    });
  } else {
    removeItemFromQueue(item);
    addSeason(item.url, item.divisionCode, {
      ...item,
      ...{ error: season.error }
    });
  }
}

async function processDivisionItem(item) {
  // INFO: Kör division (lägg till alla seasons, ta bort item, kör season på divisionCode)

  const divisionUrl = ensureStringEndsWith(item.url, 'results/');
  const firstSeason = await seasonlib.getSeasonFromWebPage(divisionUrl, {});
  if (!firstSeason.error) {
    log.info(`- Add ${firstSeason.seasonsInfo.length} seasons to queue and start crawling them...`);
    firstSeason.seasonsInfo.forEach((seasonsInfo, index) => {
      addSeason(seasonsInfo.url, firstSeason.divisionCode);
    });
    removeItemFromQueue(item);
    await processQueueByOptions({
      type: 'season',
      divisionCode: firstSeason.divisionCode
    });
  } else {
    removeItemFromQueue(item);
    addDivision(item.url, item.divisionCode, {
      ...item,
      ...{ error: firstSeason.error }
    });
  }
}

async function processCountryItem(item) {
  // INFO: Kör country (lägg till alla divisions, ta bort item, kör division på country)

  const divisions = await divisionlib.getDivisionsFromWebPage(item.url);
  if (!divisions.error) {
    log.info(`- Add ${divisions.length} divisions to queue and start crawling them...`);
    await utilslib.sleep(config.delayBetweenCrawledEvents);
    divisions.forEach((url, index) => {
      addDivision(url, { country: item.country });
    });
    removeItemFromQueue(item);
    await processQueueByOptions({ type: 'division', country: item.country });
  } else {
    removeItemFromQueue(item);
    addCountry(item.url, item.sport, item.country, {
      ...item,
      ...{ error: divisions.error }
    });
  }
}

async function processSportItem(item) {
  // INFO: Kör sport (lägg till alla divisions, ta bort item, kör division)

  const divisions = await divisionlib.getDivisionsFromWebPage(item.url);
  if (!divisions.error) {
    log.info(`- Add ${divisions.length} divisions to queue and start crawling them...`);
    await utilslib.sleep(config.delayBetweenCrawledEvents);
    divisions.forEach((url, index) => {
      addDivision(url);
    });
    removeItemFromQueue(item);
    await processQueueByOptions({ type: 'division' });
  } else {
    removeItemFromQueue(item);
    addSport(item.url, item.sport, { ...item, ...{ error: divisions.error } });
  }
}

// ADD --------------------------------------------------------------------------------------------

export function addUrl(url) {
  return addTextToQueue(url);
}

export function addEvent(url, divisionCode, year, options = {}) {
  const baseOptions = {
    type: 'event',
    url: ensureUrlEndingSlash(url),
    divisionCode,
    year
  };
  return addItemToQueue({ ...baseOptions, ...options });
}

export function addSeason(url, divisionCode, options = {}) {
  const baseOptions = {
    type: 'season',
    url: ensureUrlEndingSlash(url),
    divisionCode
  };
  return addItemToQueue({ ...baseOptions, ...options });
}

export function addDivision(url, options = {}) {
  const baseOptions = { type: 'division', url: ensureUrlEndingSlash(url) };
  return addItemToQueue({ ...baseOptions, ...options });
}

export function addCountry(url, sport, country, options = {}) {
  const baseOptions = {
    type: 'country',
    sport,
    country,
    url: ensureUrlEndingSlash(url)
  };
  return addItemToQueue({ ...baseOptions, ...options });
}

export function addSport(url, sport, options = {}) {
  const baseOptions = { type: 'sport', sport, url: ensureUrlEndingSlash(url) };
  return addItemToQueue({ ...baseOptions, ...options });
}

function addItemToQueue(item) {
  if (readFromQueue(item).length > 0) {
    return false; // Do not add duplicates!
  }
  fs.appendFileSync(config.pathToCrawlerQueue, `\r\n${JSON.stringify(item)}`);
  return true;
}

function addTextToQueue(text) {
  if (readFromQueueByText(text).length > 0) {
    return false; // Do not add duplicates!
  }
  fs.appendFileSync(config.pathToCrawlerQueue, `\r\n${text}`);
  return true;
}

//  REMOVE  ---------------------------------------------------------------------------------------

function removeItemFromQueue(item) {
  ensureCrawlerQueueFileExists();

  const isTextItem = item.text;
  const lineToLookForInFile = isTextItem ? JSON.stringify(item.text) : JSON.stringify(item);

  let isRemoved = false;
  const linesToKeep = [];
  fs.readFileSync(config.pathToCrawlerQueue, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      try {
        if (line.trim() === '') {
          return;
        }
        const lineInFile = isTextItem ? JSON.stringify(line) : JSON.stringify(JSON.parse(line));
        if (lineToLookForInFile === lineInFile) {
          isRemoved = true;
          return;
        }
      } catch (error) {
        log.error(`Cannot JSON parse line: ${line}`);
      }
      linesToKeep.push(line);
    });

  emptyQueue();

  fs.writeFileSync(config.pathToCrawlerQueue, linesToKeep.join('\r\n'));

  return isRemoved;
}

//  READ  ------------------------------------------------------------------------------------------

export function readFromQueueByType(type) {
  ensureCrawlerQueueFileExists();

  const items = [];
  fs.readFileSync(config.pathToCrawlerQueue, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      const item = createItem(line);
      if (item !== null && item.type === type) {
        items.push(item);
      }
    });
  return items;
}

export function readFromQueueByText(text) {
  ensureCrawlerQueueFileExists();

  const queueItems = [];
  fs.readFileSync(config.pathToCrawlerQueue, 'utf-8')
    .split(/\r?\n/)
    .forEach((line) => {
      const item = createItem(line);
      if (text === line.trim()) {
        queueItems.push(item);
      }
    });
  return queueItems;
}

export function readFromQueue(options = {}) {
  ensureCrawlerQueueFileExists();

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

//  MISC  --------------------------------------------------------------------------------------------

export function emptyQueue() {
  fs.writeFileSync(config.pathToCrawlerQueue, '');
}

export function getQueueLength() {
  return readFromQueue().length;
}

//  ITEM FUNCTIONS  ---------------------------------------------------------------------------------

function createItem(line) {
  try {
    return JSON.parse(line.trim());
  } catch (error) {
    const cleanLine = line.trim();
    if (cleanLine.length > 0) {
      return { type: 'text', text: cleanLine };
    }
    // Not an error, can be empty lines!
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

//  ENSURER FUNCTIONS  ---------------------------------------------------------------------------------

function ensureStringEndsWith(text, shouldEndWith) {
  if (text.endsWith(shouldEndWith)) {
    return text;
  }
  return text + shouldEndWith;
}

function ensureUrlEndingSlash(url) {
  return `${utilslib.trimCharsRight(url, '/')}/`;
}

function ensureCrawlerQueueFileExists() {
  if (!fs.existsSync(config.pathToCrawlerQueue)) {
    fs.closeSync(fs.openSync(config.pathToCrawlerQueue, 'w'));
  }
}
