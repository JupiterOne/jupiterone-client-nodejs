import { JupiterOneClient, SyncJobModes, SyncJobSources } from '.';
import { exampleSyncJob } from './example-testing-data/example-sync-job';
import { exampleEntity } from './example-testing-data/example-entity';
import { exampleEndResult } from './example-testing-data/example-end-result';
import exampleDeferredResult from './example-testing-data/example-deferred-result.json';
import exampleData from './example-testing-data/example-data.json';
import exampleDefinition from './example-testing-data/example-definition.json';
import exampleIntegrationInstance from './example-testing-data/example-integration-instance.json';

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

    const baseQuery = (): Record<string, unknown> => {
      return exampleData;
    };

    jupiterOneClient.init = jest.fn(() => {
      (jupiterOneClient.graphClient as unknown) = {
        query: jest.fn().mockImplementationOnce(baseQuery),
      };
      return Promise.resolve(jupiterOneClient);
    });

    j1 = await jupiterOneClient.init();
  });

  describe('Ensure JupiterOneClient Has Correct Props', () => {
    test('queryV1', () => {
      expect(j1).toHaveProperty('queryV1');
    });
    test('queryGraphQL', () => {
      expect(j1).toHaveProperty('queryGraphQL');
    });
    test('mutateAlertRule', () => {
      expect(j1).toHaveProperty('mutateAlertRule');
    });
    test('createEntity', () => {
      expect(j1).toHaveProperty('createEntity');
    });
    test('updateEntity', () => {
      expect(j1).toHaveProperty('updateEntity');
    });
    test('deleteEntity', () => {
      expect(j1).toHaveProperty('deleteEntity');
    });
    test('createRelationship', () => {
      expect(j1).toHaveProperty('createRelationship');
    });
    test('upsertEntityRawData', () => {
      expect(j1).toHaveProperty('upsertEntityRawData');
    });
    test('createQuestion', () => {
      expect(j1).toHaveProperty('createQuestion');
    });
    test('updateQuestion', () => {
      expect(j1).toHaveProperty('updateQuestion');
    });
    test('deleteQuestion', () => {
      expect(j1).toHaveProperty('deleteQuestion');
    });
    test('integrationInstances', () => {
      expect(j1).toHaveProperty('integrationInstances');
    });
    test('integrationInstances props', () => {
      expect(j1.integrationInstances).toHaveProperty('list');
      expect(j1.integrationInstances).toHaveProperty('get');
      expect(j1.integrationInstances).toHaveProperty('create');
      expect(j1.integrationInstances).toHaveProperty('update');
      expect(j1.integrationInstances).toHaveProperty('delete');
    });

    test('startSyncJob', () => {
      expect(j1).toHaveProperty('startSyncJob');
    });
    test('uploadGraphObjectsForDeleteSyncJob', () => {
      expect(j1).toHaveProperty('uploadGraphObjectsForDeleteSyncJob');
    });
    test('uploadGraphObjectsForSyncJob', () => {
      expect(j1).toHaveProperty('uploadGraphObjectsForSyncJob');
    });
    test('finalizeSyncJob', () => {
      expect(j1).toHaveProperty('finalizeSyncJob');
    });
    test('fetchSyncJobStatus', () => {
      expect(j1).toHaveProperty('fetchSyncJobStatus');
    });
    test('bulkUpload', () => {
      expect(j1).toHaveProperty('bulkUpload');
    });
    test('bulkDelete', () => {
      expect(j1).toHaveProperty('bulkDelete');
    });

    test('--api-base-url properly sets URLs', () => {
      const jupiterOneCustomURLClient = new JupiterOneClient({
        account: '',
        apiBaseUrl: 'https://api.test.jupiterone.io',
      });
      expect(jupiterOneCustomURLClient).toHaveProperty(
        'queryEndpoint',
        'https://api.test.jupiterone.io/graphql',
      );
      expect(jupiterOneCustomURLClient).toHaveProperty(
        'rulesEndpoint',
        'https://api.test.jupiterone.io/rules/graphql',
      );
    });
  });

  describe('queryV1', () => {
    test('Happy Test', async () => {
      const res = await j1.queryV1('Find github_repo');
      expect(res).toEqual(exampleEndResult.data);
    });
  });

  describe('listIntegrationInstances', () => {
    const setup = (): void => {
      j1.graphClient.query = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          data: {
            integrationInstances: {
              instances: [exampleIntegrationInstance],
            },
          },
        });
      });
    };

    beforeEach(() => {
      setup();
    });

    test('Sad Test - Query Fails', async () => {
      j1.graphClient.query = jest.fn().mockImplementation(() => {
        return {
          errors: [{ message: 'A Problem' }],
        };
      });

      const expectedValue = { data: [], errors: [{ message: 'A Problem' }] };
      const test = await j1.integrationInstances.list();
      await expect(test).toEqual(expectedValue);
    });

    test('Happy Test - Returns Instances', async () => {
      const res = await j1.integrationInstances.list({
        definitionId: 'abc',
      });
      expect(res.data).toEqual([exampleIntegrationInstance]);
    });
  });

  describe('listIntegrationDefinitions', () => {
    const setup = (): void => {
      j1.graphClient.query = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          data: {
            integrationDefinitions: {
              definitions: [exampleDefinition],
            },
          },
        });
      });
    };

    beforeEach(() => {
      setup();
    });

    test('Sad Test - Query Fails', async () => {
      j1.graphClient.query = jest.fn().mockImplementation(() => {
        return {
          errors: [{ message: 'A Problem' }],
        };
      });

      const expectedValue = { data: [], errors: [{ message: 'A Problem' }] };
      const test = await j1.integrationDefinitions.list();
      await expect(test).toEqual(expectedValue);
    });

    test('Happy Test - Returns Definitions', async () => {
      const test = await j1.integrationDefinitions.list();
      expect(test).toEqual({ data: [exampleDefinition], errors: [] });
    });
  });

  describe('bulkUpload', () => {
    const setup = (): void => {
      j1.startSyncJob = jest.fn().mockImplementation(() => {
        return Promise.resolve(exampleSyncJob);
      });
      j1.uploadGraphObjectsForSyncJob = jest.fn().mockImplementation(() => {
        return Promise.resolve(exampleSyncJob);
      });
      j1.finalizeSyncJob = jest.fn().mockImplementation(() => {
        return Promise.resolve(exampleSyncJob);
      });
    };

    beforeEach(() => {
      setup();
    });

    test('Sad Test - Using Sync Mode `DIFF` and Source `API` Without Scope Returns Early', async () => {
      const areValidSyncJobOptionsSpy = jest.spyOn(
        j1,
        'areValidSyncJobOptions',
      );
      const argumentOne = {
        syncJobOptions: {
          source: SyncJobSources.API,
          syncMode: SyncJobModes.DIFF,
        },
        entities: [exampleEntity],
      };

      const res = await j1.bulkUpload(argumentOne);
      expect(res).toEqual(undefined);
      expect(areValidSyncJobOptionsSpy).toReturnWith(false);
    });

    test('Happy Test - No Entities/Relationships Should Return Early', async () => {
      const argumentOne = {};

      const res = await j1.bulkUpload(argumentOne);
      expect(res).toEqual(undefined);
    });

    test('Happy Test - Default Options', async () => {
      const targetScope = 'test-scope';

      const argumentOne = {
        syncJobOptions: {
          scope: targetScope,
        },
        entities: [exampleEntity],
      };

      const res = await j1.bulkUpload(argumentOne);
      expect(res).toEqual({
        syncJobId: exampleSyncJob.job.id,
        finalizeResult: exampleSyncJob,
      });

      const expectedArgument = {
        source: SyncJobSources.API,
        syncMode: SyncJobModes.DIFF,
        scope: targetScope,
      };

      expect(j1.startSyncJob).toHaveBeenCalledWith(expectedArgument);
    });

    test('Happy Test - User Provided Options', async () => {
      const argumentOne = {
        syncJobOptions: {
          scope: 'an_example_scope',
          syncMode: SyncJobModes.CREATE_OR_UPDATE,
        },
        entities: [exampleEntity],
      };

      const res = await j1.bulkUpload(argumentOne);
      expect(res).toEqual({
        syncJobId: exampleSyncJob.job.id,
        finalizeResult: exampleSyncJob,
      });

      const expectedArgument = {
        source: SyncJobSources.API,
        scope: 'an_example_scope',
        syncMode: SyncJobModes.CREATE_OR_UPDATE,
      };

      expect(j1.startSyncJob).toHaveBeenCalledWith(expectedArgument);
    });
  });
});
