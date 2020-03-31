const { Polly } = require('@pollyjs/core');
const NodeHTTPAdapter = require('@pollyjs/adapter-node-http');
const JupiterOneClient = require('./j1client');

Polly.register(NodeHTTPAdapter);

const FAKE_ACCOUNT = 'johndoe';
const FAKE_KEY = 'abc123';

const j1qlString = 'Find jupiterone_account';
const mockDeferredResponse = {
  data: {
    queryV1: {
      data: null,
      type: 'deferred',
      url: 'https://jqs-deferred.s3.amazonaws.com/deferred/1',
      __typename: 'QueryV1Response',
    },
  },
};

const mockQueryV1Response = {
  data: [],
};

const mockS3ResponsePass = {
  status: 'COMPLETED',
  error: null,
  url: 'https://jqs-deferred.s3.amazonaws.com/s3-deferred-pass/1',
};

let polly;
let j1Client;
let attempts = 0;
let attemptsToFail = 0;

beforeEach(async () => {
  attempts = 0;

  j1Client = await new JupiterOneClient({
    account: FAKE_ACCOUNT,
    accessToken: FAKE_KEY,
  }).init();

  polly = new Polly('JupiterOneClient tests', {
    adapters: ['node-http'],
  });

  polly.server
    .any('https://jqs-deferred.s3.amazonaws.com/s3-deferred-pass/1')
    .intercept((req, res) => {
      res.status(200);
      res.json(mockQueryV1Response);
    });

  polly.server
    .any('https://jqs-deferred.s3.amazonaws.com/deferred/1')
    .intercept((req, res) => {
      // assume deferred response passes.
      res.status(200);
      res.json(mockS3ResponsePass);
    });

  polly.server
    .post('https://api.us.jupiterone.io/graphql')
    .intercept((req, res) => {
      attempts++;
      const shouldFailThisTime = attempts <= attemptsToFail;

      res.status(shouldFailThisTime ? 401 : 200);
      res.json(shouldFailThisTime ? {} : mockDeferredResponse);
    });
});

afterEach(() => {
  return polly.stop(); // returns a Promise
});

describe('failing 4 times', () => {
  beforeEach(() => {
    attemptsToFail = 4;
  });

  test('client retries failed requests and returns successful response', async () => {
    const results = await j1Client.queryV1(j1qlString);
    expect(results.length).toBe(0);
  }, 100000);
});

describe('failing 5 times', () => {
  beforeEach(() => {
    attemptsToFail = 5;
  });

  test('client retries 5 times and throws error', async () => {
    await expect(j1Client.queryV1(j1qlString)).rejects.toThrow(
      /Network error: Response not successful: Received status code 401/,
    );
  }, 100000);
});
