import { JupiterOneClient } from '.';
import exampleEndResult from './example-testing-data/example-end-result.json';
import exampleDeferredResult from './example-testing-data/example-deferred-result.json';
import exampleData from './example-testing-data/example-data.json';

const baseQuery = (): {} => {
  return exampleData;
};

jest.mock('./networkRequest', () => ({
  networkRequest: jest
    .fn()
    .mockImplementationOnce(() => {
      return exampleDeferredResult;
    })
    .mockImplementationOnce(() => {
      return exampleEndResult;
    }),
}));

describe('Core Index Tests', () => {
  let j1;

  beforeAll(async () => {
    const jupiterOneClient = new JupiterOneClient({
      account: '',
    });

    jupiterOneClient.init = jest.fn(() => {
      (jupiterOneClient.graphClient as any) = {
        query: jest.fn().mockImplementationOnce(baseQuery),
      };
      return Promise.resolve(jupiterOneClient);
    });

    j1 = await jupiterOneClient.init();
  });

  describe('queryV1', () => {
    test('Happy Test', async () => {
      const res = await j1.queryV1('Find github_repo');
      expect(res).toEqual(exampleEndResult.data);
    });
  });
});
