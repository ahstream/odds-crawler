/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const fs = require('fs');

const csvtojson = require('csvtojson');
const fse = require('fs-extra');
const { Parser } = require('json2csv');
const jsonfile = require('jsonfile');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

// Does not work to export function, need to be exports.csvFileToJson for some reason!
exports.readCsvFile = async (filepath, { delimiter = ';' }) => csvtojson({ delimiter }).fromFile(filepath);

exports.writeJsonDataToCsvFile = (filepath, data, { delimiter = ';', flatten = true, quote = '"', charset = 'utf8' }) => {
  const options = { delimiter, flatten, quote, charset };
  writeOrAppendJsonDataToCsvFile(filepath, data, options, false);
};

exports.appendJsonDataToCsvFile = (filepath, data, { delimiter = ';', flatten = true, quote = '"', charset = 'utf8' }) => {
  const options = { delimiter, flatten, quote, charset };
  writeOrAppendJsonDataToCsvFile(filepath, data, options, true);
};

exports.writeJsonDataToFile = (filepath, data, { spaces = 2, EOL = '\r\n' }) => {
  const options = { spaces, EOL };
  writeOrAppendJsonDataToFile(filepath, data, options, false);
};

exports.appendJsonDataToFile = (filepath, data, { spaces = 2, EOL = '\r\n' }) => {
  const options = { spaces, EOL };
  writeOrAppendJsonDataToFile(filepath, data, options, true);
};

exports.writeDataToFile = (filepath, data, { charset = 'utf8' }) => {
  const options = { charset };
  try {
    fs.writeFileSync(filepath, data, charset);
  } catch (error) {
    console.error(error, filepath, error.stack);
  }
};

exports.delete = (path) => {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
};

exports.emptyFolder = (path, recursive = false) => {
  if (fs.existsSync(path)) {
    fse.emptyDirSync(path, { recursive });
  }
};

exports.createFolder = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
};

exports.existsInFile = (searchForText, filepath) => {
  if (!fs.existsSync(filepath)) {
    return false;
  }
  const data = fs.readFileSync(filepath);
  return data.includes(searchForText);
};

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function writeOrAppendJsonDataToCsvFile(filepath, data, options, append) {
  try {
    const header = !fs.existsSync(filepath);
    const parser = new Parser({
      header,
      flatten: options.flatten,
      quote: options.quote,
      delimiter: options.delimiter
    });
    const dataList = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in data) {
      if (Object.prototype.hasOwnProperty.call(data, prop)) {
        dataList.push(data[prop]);
      }
    }
    const prefix = header ? '' : '\r\n';
    const csv = prefix + parser.parse(dataList);
    if (append) {
      fs.appendFileSync(filepath, csv, options.charset);
    } else {
      fs.writeFileSync(filepath, csv, options.charset);
    }
  } catch (error) {
    console.error(error, filepath, error.stack);
  }
}

function writeOrAppendJsonDataToFile(filepath, data, options, append) {
  try {
    if (append) {
      options.flag = 'a';
    }
    jsonfile.writeFileSync(filepath, data, options);
  } catch (error) {
    console.error(error, filepath, error.stack);
  }
}
