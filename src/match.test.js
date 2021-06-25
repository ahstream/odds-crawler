const _ = require('lodash');

const match = require('./match');
const mongo = require('./mongodb');

beforeEach(async () => {
  await mongo.connect();
});

afterEach(() => {
  mongo.close();
});

/**
 * ok
 */
test('getNextMatches', async () => {
  jest.setTimeout(20000);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const m1 = await match.getNextMatchesOneDay('soccer', 1, today);
  expect(m1).toHaveProperty('matchUrls');
  expect(m1).toHaveProperty('otherUrls');
  expect(m1.matchUrls.length).toBeGreaterThan(0);
  expect(m1.otherUrls.length).toBeGreaterThan(0);

  const m2 = await match.getNextMatchesOneDay('soccer', 1, tomorrow);
  expect(m2).toHaveProperty('matchUrls');
  expect(m2).toHaveProperty('otherUrls');
  expect(m2.matchUrls.length).toBeGreaterThan(0);
  expect(m2.otherUrls.length).toBeGreaterThan(0);

  const m3 = await match.getNextMatchesOneDay('tennis', 2, today);
  expect(m3).toHaveProperty('matchUrls');
  expect(m3).toHaveProperty('otherUrls');
  expect(m3.matchUrls.length).toBeGreaterThan(0);
  expect(m3.otherUrls.length).toBeGreaterThan(0);
});

/**
 * ok
 */
test('getNextMatchesByHash', async () => {
  const result = await match.getNextMatchesByHash('2', '20210606', 'yj6d8', 'yj4de');
  expect(result).toHaveProperty('matchUrls');
  expect(result).toHaveProperty('otherUrls');
  expect(result.matchUrls.length).toBeGreaterThan(0);
  expect(result.otherUrls.length).toBeGreaterThan(0);
});
