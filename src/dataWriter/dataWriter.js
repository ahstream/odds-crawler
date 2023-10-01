// DECLARES =======================================================================================

const config = require('../../config/config.json');
const filelib = require('../lib/filelib');
const { createLogger } = require('../lib/loggerlib');

const log = createLogger();

// EXPORTED FUNCTIONS =============================================================================

// Resetters --------------------------------------------------------------------------------------

export function resetFiles(key, divisionCode = null) {
  switch (key.toLowerCase()) {
    case 'event':
      if (divisionCode === null) {
        filelib.emptyFolder(`${config.pathToDataFolder}/result/event`, true);
      } else {
        filelib.emptyFolder(
          `${config.pathToDataFolder}/result/event/${divisionCodeToFileSafeName(
            divisionCode
          )}`,
          false
        );
      }
      break;
    case 'bookie':
      filelib.delete(`${config.pathToDataFolder}/misc/bookie.csv`);
      break;
    case 'division':
      filelib.delete(`${config.pathToDataFolder}/misc/division.csv`);
      break;
    default:
      log.error(`Unknown resetFiles key: ${key}`);
      break;
  }
}

// Writers ------------------------------------------------------------------------------------------

export function writeToEventFile(data, divisionCode) {
  convertToSqlSafeCsvData(data);
  const filepath = `${ensureDivisionFolder(divisionCode)}/event.csv`;
  filelib.appendJsonDataToCsvFile(filepath, { data }, {});
}

export function writeToOddsFile(data, divisionCode) {
  convertToSqlSafeCsvData(data);
  const filepath = `${ensureDivisionFolder(divisionCode)}/odds.csv`;
  filelib.appendJsonDataToCsvFile(filepath, data, {});
}

export function writeToHistoryFile(data, divisionCode) {
  convertToSqlSafeCsvData(data);
  const filepath = `${ensureDivisionFolder(divisionCode)}/history.csv`;
  filelib.appendJsonDataToCsvFile(filepath, data, {});
}

export function writeToMarketFile(data, divisionCode) {
  convertToSqlSafeCsvData(data);
  const filepath = `${ensureDivisionFolder(divisionCode)}/market.csv`;
  filelib.appendJsonDataToCsvFile(filepath, data, {});
}

export function writeToMarketResultFile(data, divisionCode) {
  convertToSqlSafeCsvData(data);
  const filepath = `${ensureDivisionFolder(divisionCode)}/marketresult.csv`;
  filelib.appendJsonDataToCsvFile(filepath, data, {});
}

export function writeToMarketOddsFile(data, divisionCode) {
  convertToSqlSafeCsvData(data);
  const filepath = `${ensureDivisionFolder(divisionCode)}/marketodds.csv`;
  filelib.appendJsonDataToCsvFile(filepath, data, {});
}

export function writeToDivisionFile(data) {
  convertToSqlSafeCsvData(data);
  const filepath = `${config.pathToDataFolder}/misc/division.csv`;
  filelib.appendJsonDataToCsvFile(filepath, { data }, {});
}

export function writeToBookieFile(data) {
  convertToSqlSafeCsvData(data);
  const filepath = `${config.pathToDataFolder}/misc/bookie.csv`;
  filelib.appendJsonDataToCsvFile(filepath, data, {});
}

// Misc ---------------------------------------------F---------------------------------------------

export function eventExistInFile(url, divisionCode) {
  const filepath = `${
    config.pathToDataFolder
  }/result/event/${divisionCodeToFileSafeName(divisionCode)}/event.csv`;
  return filelib.existsInFile(url, filepath, url);
}

// HELPERS  =======================================================================================

function ensureDivisionFolder(divisionCode) {
  const path = `${
    config.pathToDataFolder
  }/result/event/${divisionCodeToFileSafeName(divisionCode)}`;
  filelib.createFolder(path);
  return path;
}

function divisionCodeToFileSafeName(divisionCode) {
  return divisionCode.replaceAll('/', '_');
}

function convertToSqlSafeCsvData(data) {
  Object.keys(data).forEach((key, _index) => {
    if (typeof data[key] !== 'object' || data[key] === null) {
      if (data[key] === null) {
        data[key] = '\\N';
      } else if (typeof data[key] === 'boolean') {
        const newVal = data[key] ? 1 : 0;
        data[key] = newVal;
      }
    } else {
      Object.keys(data[key]).forEach((key2, _index2) => {
        if (data[key][key2] === null) {
          data[key][key2] = '\\N';
        } else if (typeof data[key][key2] === 'boolean') {
          const newVal = data[key][key2] ? 1 : 0;
          data[key][key2] = newVal;
        }
      });
    }
  });
}
