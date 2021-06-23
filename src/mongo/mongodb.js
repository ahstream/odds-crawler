const { MongoClient } = require('mongodb');

const { createLogger } = require('../lib/loggerlib');

const log = createLogger();

const uri = '127.0.0.1:27017';
const dbName = 'oddsCrawlerDB';

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

  async idExists(collection, id) {
    const r = await collection.find({ _id: id }).limit(1).toArray();
    return r.length === 1;
  }

  async insertOne(collection, data) {
    await collection.insertOne(data);
  }

  async deleteOne(collection, data) {
    await collection.deleteOne(data);
  }

  async insertOneIfNotExists(collection, data) {
    if (!(await this.idExists(collection, data._id))) {
      const result = await collection.insertOne(data);
      return true;
    }
    return false;
  }

  async updateOneWithCreatedDate(collection, data, createdDate) {
    let finalData;
    if (!(await this.idExists(collection, data._id))) {
      finalData = { ...data, created: createdDate };
    } else {
      finalData = data;
    }
    const result = await collection.updateOne({ _id: data._id }, { $set: finalData }, { upsert: true });
    return result.modifiedCount;
  }
}

module.exports = new Mongo();
