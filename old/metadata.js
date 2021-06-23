// DECLARES -----------------------------------------------------------------------------

const assert = require('assert');
const _ = require('lodash');

const dataWriter = require('../src/dataWriter/dataWriter.js');
const { createLogger } = require('../src/lib/loggerlib');
const parser = require('../src/parser/parser');
const provider = require('../src/provider/provider');

const log = createLogger();

// FUNCTIONS -----------------------------------------------------------------------------

export async function getMetadataFromWebPage() {
  try {
    const dateTimeString = provider.createShortDatetimeString(new Date());
    const url = `https://www.oddsportal.com/res/x/global-${dateTimeString}.js`;

    const response = await provider.httpGetResponse(url, {});
    const htmltext = response.data;

    log.verbose(htmltext);

    return null;
  } catch (error) {
    log.error(
      `getBookiesFromWebPage exception: ${error}, stack: ${error.stack}`
    );
    return null;
  }
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------
