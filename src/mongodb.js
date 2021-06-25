/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const { MongoClient } = require('mongodb');

const { createLogger } = require('./lib/loggerlib');

const log = createLogger();

const uri = '127.0.0.1:27017';
const dbName = 'oddsCrawlerDB';

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

class Mongo {
  constructor() {
    this.client = new MongoClient(`mongodb://${uri}/${dbName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }

  async connect() {
    await this.client.connect();
    log.info('Connected to MongoDB');
    this.db = this.client.db();
  }

  async close() {
    await this.client.close();
    log.info('Disconnected from MongoDB');
  }

  async dropCollection(name) {
    try {
      await this.client.collection(name).drop();
    } catch (ex) {
      // do nothing
    }
  }
}

module.exports = new Mongo();
