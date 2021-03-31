'use strict';

// DECLARES -----------------------------------------------------------------------------

const _ = require('lodash');
const assert = require('assert');
const parser = require('./parser');
const provider = require('./provider');
const dataWriter = require('./dataWriter.js');

const { createLogger } = require('./lib/loggerlib');
const log = createLogger();

// FUNCTIONS -----------------------------------------------------------------------------

export async function getMetadataFromWebPage() {
  try {
    const dateTimeString = provider.createDateTimeString(new Date());
    const url = `https://www.oddsportal.com/res/x/global-${dateTimeString}.js`;

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    log.verbose(htmltext);

    return null;
  } catch (error) {
    log.error(`getBookiesFromWebPage exception: ${error}, stack: ${error.stack}`);
    return null;
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------
