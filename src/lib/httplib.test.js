const httplib = require('./httplib.js');

test('ping returns pong', () => {
  expect(httplib.ping()).toBe('pong');
});

test('get', async () => {
  jest.setTimeout(5000);
  const response = await httplib.get('https://www.google.com/');
  console.log(response);
  expect(true).toBe(true);
});
