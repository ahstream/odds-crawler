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
    this.client = createClient();
  }

  async connect() {
    if (!this.client) {
      this.client = createClient();
    }
    await this.client.connect();
    log.debug('Connected to MongoDB');
    this.db = this.client.db();
  }

  async close() {
    await this.client.close();
    this.client = undefined;
    log.debug('Disconnected from MongoDB');
  }

  async dropCollection(name) {
    try {
      await this.db.collection(name).drop();
      log.debug(`Mongo DB: Dropped collection ${name}`);
    } catch (ex) {
      // console.log(ex);
    }
  }

  async collectionExists(name) {
    const collections = await this.db.listCollections().toArray();
    return collections.find(o => o.name === name) !== undefined;
  }
}

function createClient() {
  return new MongoClient(`mongodb://${uri}/${dbName}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

module.exports = new Mongo();
