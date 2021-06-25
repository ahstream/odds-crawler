/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const fs = require('fs');
const util = require('util');

const winston = require('winston');

const defaultOptions = {
  level: 'info',
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
};

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

// exports.createLogger = createLogger;

exports.deleteLogFiles = (dir) => {
  const dirVal = trimCharsRight(dir, '/');

  const errorFilepath = `${dirVal}/error.log`;
  const infoFilepath = `${dirVal}/info.log`;
  const debugFilepath = `${dirVal}/debug.log`;
  const verboseFilepath = `${dirVal}/verbose.log`;
  const sillyFilepath = `${dirVal}/silly.log`;

  if (fs.existsSync(errorFilepath)) {
    fs.unlinkSync(errorFilepath);
  }
  if (fs.existsSync(infoFilepath)) {
    fs.unlinkSync(infoFilepath);
  }
  if (fs.existsSync(debugFilepath)) {
    fs.unlinkSync(debugFilepath);
  }
  if (fs.existsSync(verboseFilepath)) {
    fs.unlinkSync(verboseFilepath);
  }
  if (fs.existsSync(sillyFilepath)) {
    fs.unlinkSync(sillyFilepath);
  }
};

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function trimCharsRight(str, charlist) {
  return str.replace(new RegExp(`[${charlist}]+$`), '');
}

function transform(info, opts) {
  const args = info[Symbol.for('splat')];
  if (args) {
    info.message = util.format(info.message, ...args);
  } else if (typeof info.message === 'object') {
    info.message = util.format(info.message, '');
  }
  return info;
}

function utilFormatter() {
  return { transform };
}

export function createLogger(logLevel = '', dir = 'logs', options = {}) {
  const logLevelVal = logLevel !== '' ? logLevel : defaultOptions.level;
  const timestampFormatVal = options.timestampFormat ?? defaultOptions.timestampFormat;

  const colorFormatter = winston.format.combine(
    winston.format.timestamp({ format: timestampFormatVal }),
    utilFormatter(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, label, timestamp }) => `${timestamp} ${label || '-'} ${level}: ${message}`)
  );

  const noColorFormatter = winston.format.combine(
    winston.format.timestamp({ format: timestampFormatVal }),
    utilFormatter(),
    winston.format.printf(({ level, message, label, timestamp }) => `${timestamp} ${label || '-'} ${level}: ${message}`)
  );

  const dirVal = trimCharsRight(dir, '/');
  if (!fs.existsSync(dirVal)) {
    fs.mkdirSync(dirVal);
  }

  const logger = winston.createLogger({
    level: defaultOptions.logLevel,
    transports: [
      new winston.transports.Console({
        format: colorFormatter,
        level: logLevelVal
      }),
      new winston.transports.File({
        format: noColorFormatter,
        filename: `${dirVal}/error.log`,
        level: 'error'
      }),
      new winston.transports.File({
        format: noColorFormatter,
        filename: `${dirVal}/info.log`,
        level: 'info'
      }),
      new winston.transports.File({
        format: noColorFormatter,
        filename: `${dirVal}/debug.log`,
        level: 'debug'
      }),
      new winston.transports.File({
        format: noColorFormatter,
        filename: `${dirVal}/verbose.log`,
        level: 'verbose'
      })
      // new winston.transports.File({ format: noColorFormatter, filename: `${dirVal}/silly.log`, logLevel: 'silly' }),
    ]
  });

  return logger;
}
