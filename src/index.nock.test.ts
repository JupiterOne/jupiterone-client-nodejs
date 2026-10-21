/**
 * Additive nock-based coverage for the Apollo `graphClient` methods on
 * `JupiterOneClient`.
 *
 * These tests intentionally avoid PollyJS (used by `index.test.ts` and
 * `index.new.test.ts`) and instead drive the real Apollo `BatchHttpLink`
 * stack over a nock-mocked HTTP endpoint. The goal is a regression net for
 * the upcoming Apollo-Client 2 -> 4 migration.
 *
 * Transport notes that shape every mock below:
 *  - `BatchHttpLink` POSTs a JSON *array* of operations to the endpoint and
 *    expects a JSON *array* of results back. Every `.reply` therefore returns
 *    an array with a single element: `[{ data: {...} }]` for success and
 *    `[{ errors: [{ message: '...' }] }]` for GraphQL errors.
 *  - All replies are HTTP 200 so the `RetryLink` (2000ms initial / 5000ms max)
 *    never engages and the suite stays fast.
 */
import nock from 'nock';
import gql from 'graphql-tag';
import { JupiterOneClient, JupiterOneClientOptions } from '.';

const FAKE_ACCOUNT = 'johndoe';
const FAKE_KEY = 'abc123';
const BASE_URL = 'https://api.us.jupiterone.io';
const GRAPHQL_PATH = '/graphql';
const RULES_PATH = '/rules/graphql';

/** Helper: wrap a GraphQL `data` payload in the batched array shape. */
function batchData(data: Record<string, unknown>) {
  return [{ data }];
}

/** Helper: wrap a GraphQL error in the batched array shape. */
function batchError(message = 'boom') {
  return [{ errors: [{ message }] }];
}

/** Intercept a single POST to the default graphql endpoint. */
function interceptGraphQL(reply: unknown, path: string = GRAPHQL_PATH) {
  return nock(BASE_URL).post(path).reply(200, reply as any);
}

async function buildClient(
  options: Omit<JupiterOneClientOptions, 'account' | 'accessToken'> = {},
) {
  const clientOptions: JupiterOneClientOptions = {
    account: FAKE_ACCOUNT,
    accessToken: FAKE_KEY,
    ...options,
  };
  return new JupiterOneClient(clientOptions).init();
}

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

describe('JupiterOneClient graphClient methods (nock)', () => {
  let j1: JupiterOneClient;

  beforeEach(async () => {
    j1 = await buildClient();
  });

  describe('queryGraphQL', () => {
    const query = gql`
      query GetThings {
        things {
          id
        }
      }
    `;

    it('returns the full apollo result on success', async () => {
      const scope = interceptGraphQL(
        batchData({ things: [{ id: 'thing-1', __typename: 'Thing' }] }),
      );

      const res = await j1.queryGraphQL(query);

      expect(res.data.things).toEqual([
        { id: 'thing-1', __typename: 'Thing' },
      ]);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when the response contains errors', async () => {
      // Apollo's default errorPolicy ('none') rejects with an ApolloError
      // carrying the underlying GraphQL message before the client's own
      // `res.errors` guard can run, so we assert on the server message text.
      interceptGraphQL(batchError('query failed'));

      await expect(j1.queryGraphQL(query)).rejects.toThrow(/query failed/);
    });
  });

  describe('mutateAlertRule', () => {
    it('creates a referenced alert rule (no inline question)', async () => {
      const scope = interceptGraphQL(
        batchData({
          createQuestionRuleInstance: {
            id: 'rule-1',
            name: 'referenced rule',
            __typename: 'QuestionRuleInstance',
          },
        }),
      );

      const result = await j1.mutateAlertRule(
        { instance: { name: 'referenced rule' } },
        false,
      );

      expect(result).toEqual({
        id: 'rule-1',
        name: 'referenced rule',
        __typename: 'QuestionRuleInstance',
      });
      expect(scope.isDone()).toBe(true);
    });

    it('creates an inline alert rule when instance.question is present', async () => {
      const scope = interceptGraphQL(
        batchData({
          createQuestionRuleInstance: {
            id: 'rule-inline-1',
            name: 'inline rule',
            __typename: 'QuestionRuleInstance',
          },
        }),
      );

      const result = await j1.mutateAlertRule(
        {
          instance: {
            name: 'inline rule',
            question: { queries: [{ name: 'q', query: 'find *', version: 'v1' }] },
          },
        },
        false,
      );

      expect(result).toEqual(
        expect.objectContaining({ id: 'rule-inline-1', name: 'inline rule' }),
      );
      expect(scope.isDone()).toBe(true);
    });

    it('updates an inline alert rule and returns updateQuestionRuleInstance', async () => {
      const updated = {
        id: 'rule-2',
        name: 'updated inline',
        description: 'd',
        version: 2,
        specVersion: 1,
        latest: true,
        deleted: false,
        pollingInterval: 'ONE_DAY',
        templates: null,
        question: {
          queries: [{ name: 'q', query: 'find *', version: 'v1', __typename: 'Q' }],
          __typename: 'Question',
        },
        operations: [{ when: null, actions: [], __typename: 'Op' }],
        outputs: ['a'],
        __typename: 'QuestionRuleInstance',
      };
      const scope = interceptGraphQL(
        batchData({ updateQuestionRuleInstance: updated }),
      );

      const result = await j1.mutateAlertRule(
        {
          instance: {
            id: 'rule-2',
            question: { queries: [] },
          },
        },
        true,
      );

      expect(result).toEqual(updated);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when the alert rule mutation returns errors', async () => {
      interceptGraphQL(batchError('rule failed'));

      await expect(
        j1.mutateAlertRule({ instance: { name: 'x' } }, false),
      ).rejects.toThrow(/rule failed/);
    });
  });

  describe('createEntity', () => {
    it('returns the createEntity payload on success', async () => {
      const createEntity = {
        entity: { _id: 'entity-1', __typename: 'Entity' },
        vertex: {
          id: 'vertex-1',
          entity: { _id: 'entity-1', __typename: 'Entity' },
          __typename: 'Vertex',
        },
        __typename: 'CreateEntityResult',
      };
      const scope = interceptGraphQL(batchData({ createEntity }));

      const result = await j1.createEntity('key-1', 'the_type', ['The'], {
        name: 'n',
      });

      expect(result).toEqual(createEntity);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when createEntity returns errors', async () => {
      interceptGraphQL(batchError('create failed'));

      await expect(
        j1.createEntity('key-1', 'the_type', ['The'], {}),
      ).rejects.toThrow(/create failed/);
    });
  });

  describe('updateEntity', () => {
    it('returns the updateEntity payload on success', async () => {
      const updateEntity = {
        entity: { _id: 'entity-1', __typename: 'Entity' },
        vertex: { id: 'vertex-1', __typename: 'Vertex' },
        __typename: 'UpdateEntityResult',
      };
      const scope = interceptGraphQL(batchData({ updateEntity }));

      const result = await j1.updateEntity('entity-1', { name: 'new' });

      expect(result).toEqual(updateEntity);
      expect(scope.isDone()).toBe(true);
    });

    it('logs and rethrows when updateEntity returns errors', async () => {
      // updateEntity's try/catch rethrows the original error, which is the
      // ApolloError raised by the default errorPolicy, so we assert on its
      // underlying GraphQL message.
      interceptGraphQL(batchError('update failed'));

      await expect(
        j1.updateEntity('entity-1', { name: 'new' }),
      ).rejects.toThrow(/update failed/);
    });
  });

  describe('deleteEntity', () => {
    // IMPORTANT FINDING: DELETE_ENTITY's GraphQL root field is `deleteEntityV2`
    // (aliased in the mutation), but the client reads `res.data.deleteEntity`.
    // Apollo surfaces results under the *query field name* (`deleteEntityV2`),
    // so `res.data.deleteEntity` is `undefined`. The method therefore resolves
    // to `undefined` on the happy path. These tests pin that real behavior so
    // the Apollo 2 -> 4 migration cannot silently change it.
    it('resolves to undefined on success due to field-name mismatch', async () => {
      const deleteEntityV2 = { entity: { _id: 'entity-1' } };
      const scope = interceptGraphQL(batchData({ deleteEntityV2 }));

      const result = await j1.deleteEntity('entity-1');

      expect(result).toBeUndefined();
      expect(scope.isDone()).toBe(true);
    });

    it('passes entityId and hardDelete through in the request variables', async () => {
      const deleteEntityV2 = { entity: { _id: 'entity-2' } };
      let capturedBody: any;
      const scope = nock(BASE_URL)
        .post(GRAPHQL_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, batchData({ deleteEntityV2 }));

      await j1.deleteEntity('entity-2', true);

      expect(scope.isDone()).toBe(true);
      // BatchHttpLink sends an array of operations.
      expect(Array.isArray(capturedBody)).toBe(true);
      expect(capturedBody[0].variables).toEqual(
        expect.objectContaining({ entityId: 'entity-2', hardDelete: true }),
      );
    });

    it('logs and rethrows when deleteEntity returns errors', async () => {
      interceptGraphQL(batchError('delete failed'));

      await expect(j1.deleteEntity('entity-1')).rejects.toThrow(
        /delete failed/,
      );
    });
  });

  describe('createRelationship', () => {
    it('returns the createRelationship payload on success', async () => {
      const createRelationship = {
        relationship: { _id: 'rel-1', __typename: 'Relationship' },
        edge: {
          id: 'edge-1',
          toVertexId: 'v2',
          fromVertexId: 'v1',
          relationship: { _id: 'rel-1', __typename: 'Relationship' },
          properties: {},
          __typename: 'Edge',
        },
        __typename: 'CreateRelationshipResult',
      };
      const scope = interceptGraphQL(batchData({ createRelationship }));

      const result = await j1.createRelationship(
        'rel-key',
        'rel_type',
        'HAS',
        'from-1',
        'to-1',
        { weight: 1 },
      );

      expect(result).toEqual(createRelationship);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when createRelationship returns errors', async () => {
      interceptGraphQL(batchError('rel failed'));

      await expect(
        j1.createRelationship('rel-key', 'rel_type', 'HAS', 'f', 't', {}),
      ).rejects.toThrow(/rel failed/);
    });
  });

  describe('upsertEntityRawData', () => {
    it('returns the upsert status on success', async () => {
      const scope = interceptGraphQL(
        batchData({
          upsertEntityRawData: {
            status: 'CREATED',
            __typename: 'UpsertEntityRawDataResult',
          },
        }),
      );

      const result = await j1.upsertEntityRawData(
        'entity-1',
        'raw-name',
        'application/json',
        { foo: 'bar' },
      );

      expect(result).toEqual('CREATED');
      expect(scope.isDone()).toBe(true);
    });

    it('wraps GraphQL errors with a descriptive message', async () => {
      interceptGraphQL(batchError('raw failed'));

      await expect(
        j1.upsertEntityRawData('entity-1', 'raw-name', 'application/json', {}),
      ).rejects.toThrow(/Unable to store raw template data for raw-name/);
    });
  });

  describe('createQuestion', () => {
    it('returns the createQuestion payload on success', async () => {
      const createQuestion = {
        id: 'q-1',
        title: 'My Q',
        description: 'd',
        queries: [{ query: 'find *', version: 'v1', __typename: 'QQ' }],
        variables: [
          { name: 'v', required: true, default: null, __typename: 'QVar' },
        ],
        compliance: null,
        tags: ['t'],
        accountId: FAKE_ACCOUNT,
        integrationDefinitionId: null,
        __typename: 'Question',
      };
      const scope = interceptGraphQL(batchData({ createQuestion }));

      const result = await j1.createQuestion({ title: 'My Q' });

      expect(result).toEqual(createQuestion);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when createQuestion returns errors', async () => {
      interceptGraphQL(batchError('create q failed'));

      await expect(j1.createQuestion({ title: 'My Q' })).rejects.toThrow(
        /create q failed/,
      );
    });
  });

  describe('updateQuestion', () => {
    it('splits id from update and returns the updateQuestion payload', async () => {
      const updateQuestion = {
        id: 'q-1',
        title: 'Updated Q',
        description: 'd',
        queries: [{ query: 'find *', version: 'v1', __typename: 'QQ' }],
        variables: [],
        compliance: null,
        tags: [],
        accountId: FAKE_ACCOUNT,
        integrationDefinitionId: null,
        __typename: 'Question',
      };
      let capturedBody: any;
      const scope = nock(BASE_URL)
        .post(GRAPHQL_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, batchData({ updateQuestion }));

      const result = await j1.updateQuestion({
        id: 'q-1',
        title: 'Updated Q',
      });

      expect(result).toEqual(updateQuestion);
      expect(scope.isDone()).toBe(true);
      // `id` is separated from the rest of the update payload.
      expect(capturedBody[0].variables.id).toBe('q-1');
      expect(capturedBody[0].variables.update).toEqual({ title: 'Updated Q' });
    });

    it('rejects when updateQuestion returns errors', async () => {
      interceptGraphQL(batchError('update q failed'));

      await expect(
        j1.updateQuestion({ id: 'q-1', title: 'x' }),
      ).rejects.toThrow(/update q failed/);
    });
  });

  describe('deleteQuestion', () => {
    it('returns the deleteQuestion payload on success', async () => {
      const deleteQuestion = {
        id: 'q-1',
        title: 'Gone Q',
        description: 'd',
        queries: [],
        variables: [],
        compliance: null,
        tags: [],
        accountId: FAKE_ACCOUNT,
        integrationDefinitionId: null,
        __typename: 'Question',
      };
      const scope = interceptGraphQL(batchData({ deleteQuestion }));

      const result = await j1.deleteQuestion('q-1');

      expect(result).toEqual(deleteQuestion);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when deleteQuestion returns errors', async () => {
      interceptGraphQL(batchError('delete q failed'));

      await expect(j1.deleteQuestion('q-1')).rejects.toThrow(
        /delete q failed/,
      );
    });
  });

  describe('integrationDefinitions.list', () => {
    it('aggregates a single page of definitions', async () => {
      const definition = {
        id: 'def-1',
        name: 'aws',
        type: 'aws',
        title: 'AWS',
        offsiteUrl: null,
        offsiteButtonTitle: null,
        offsiteStatusQuery: null,
        integrationType: null,
        integrationClass: ['Infrastructure'],
        beta: false,
        repoWebLink: null,
        invocationPaused: false,
        __typename: 'IntegrationDefinition',
      };
      const scope = interceptGraphQL(
        batchData({
          integrationDefinitions: {
            definitions: [definition],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
              __typename: 'PageInfo',
            },
            __typename: 'IntegrationDefinitionsConnection',
          },
        }),
      );

      const result = await j1.integrationDefinitions.list();

      expect(result.data).toEqual([definition]);
      expect(result.errors).toEqual([]);
      expect(scope.isDone()).toBe(true);
    });

    it('follows the cursor across multiple pages', async () => {
      const defA = {
        id: 'def-a',
        name: 'a',
        type: 'a',
        title: 'A',
        offsiteUrl: null,
        offsiteButtonTitle: null,
        offsiteStatusQuery: null,
        integrationType: null,
        integrationClass: ['X'],
        beta: false,
        repoWebLink: null,
        invocationPaused: false,
        __typename: 'IntegrationDefinition',
      };
      const defB = { ...defA, id: 'def-b', name: 'b', title: 'B' };

      const scope1 = interceptGraphQL(
        batchData({
          integrationDefinitions: {
            definitions: [defA],
            pageInfo: {
              endCursor: 'CURSOR_1',
              hasNextPage: true,
              __typename: 'PageInfo',
            },
            __typename: 'IntegrationDefinitionsConnection',
          },
        }),
      );
      const scope2 = interceptGraphQL(
        batchData({
          integrationDefinitions: {
            definitions: [defB],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
              __typename: 'PageInfo',
            },
            __typename: 'IntegrationDefinitionsConnection',
          },
        }),
      );

      const result = await j1.integrationDefinitions.list();

      expect(result.data.map((d) => d.id)).toEqual(['def-a', 'def-b']);
      expect(scope1.isDone()).toBe(true);
      expect(scope2.isDone()).toBe(true);
    });

    it('collects errors via errorPolicy: all without throwing', async () => {
      const scope = interceptGraphQL(
        [
          {
            data: {
              integrationDefinitions: {
                definitions: [],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: false,
                  __typename: 'PageInfo',
                },
                __typename: 'IntegrationDefinitionsConnection',
              },
            },
            errors: [{ message: 'partial failure' }],
          },
        ],
      );

      const result = await j1.integrationDefinitions.list();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toBe('partial failure');
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('integrationInstances.list', () => {
    const instance = {
      accountId: FAKE_ACCOUNT,
      config: null,
      description: 'd',
      id: 'inst-1',
      integrationDefinitionId: 'def-1',
      name: 'instance 1',
      pollingInterval: 'ONE_DAY',
      pollingIntervalCronExpression: null,
      __typename: 'IntegrationInstance',
    };

    it('aggregates a single page of instances', async () => {
      const scope = interceptGraphQL(
        batchData({
          integrationInstances: {
            instances: [instance],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
              __typename: 'PageInfo',
            },
            __typename: 'IntegrationInstancesConnection',
          },
        }),
      );

      const result = await j1.integrationInstances.list();

      expect(result.data).toEqual([instance]);
      expect(result.errors).toEqual([]);
      expect(scope.isDone()).toBe(true);
    });

    it('passes a definitionId filter through in the request variables', async () => {
      let capturedBody: any;
      const scope = nock(BASE_URL)
        .post(GRAPHQL_PATH, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(
          200,
          batchData({
            integrationInstances: {
              instances: [instance],
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                __typename: 'PageInfo',
              },
              __typename: 'IntegrationInstancesConnection',
            },
          }),
        );

      const result = await j1.integrationInstances.list({
        definitionId: 'def-1',
      });

      expect(result.data).toEqual([instance]);
      expect(capturedBody[0].variables.definitionId).toBe('def-1');
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('integrationInstances.get', () => {
    const integrationInstance = {
      accountId: FAKE_ACCOUNT,
      config: null,
      description: 'd',
      id: 'inst-1',
      integrationDefinitionId: 'def-1',
      name: 'instance 1',
      pollingInterval: 'ONE_DAY',
      pollingIntervalCronExpression: null,
      __typename: 'IntegrationInstance',
    };

    it('returns the integrationInstance on success', async () => {
      const scope = interceptGraphQL(batchData({ integrationInstance }));

      const result = await j1.integrationInstances.get('inst-1');

      expect(result).toEqual(integrationInstance);
      expect(scope.isDone()).toBe(true);
    });

    it('throws an ApolloError when the query returns errors', async () => {
      interceptGraphQL(batchError('get failed'));

      await expect(
        j1.integrationInstances.get('inst-1'),
      ).rejects.toThrow(/get failed/);
    });
  });

  describe('integrationInstances.create', () => {
    const createIntegrationInstance = {
      accountId: FAKE_ACCOUNT,
      config: null,
      description: 'created',
      id: 'inst-new',
      integrationDefinitionId: 'def-1',
      name: 'new instance',
      pollingInterval: 'ONE_DAY',
      pollingIntervalCronExpression: null,
      __typename: 'IntegrationInstance',
    };

    it('returns the createIntegrationInstance payload on success', async () => {
      const scope = interceptGraphQL(
        batchData({ createIntegrationInstance }),
      );

      const result = await j1.integrationInstances.create({
        name: 'new instance',
        description: 'created',
        integrationDefinitionId: 'def-1',
      });

      expect(result).toEqual(createIntegrationInstance);
      expect(scope.isDone()).toBe(true);
    });

    it('throws an ApolloError when the mutation returns errors', async () => {
      interceptGraphQL(batchError('create inst failed'));

      await expect(
        j1.integrationInstances.create({
          name: 'new instance',
          integrationDefinitionId: 'def-1',
        }),
      ).rejects.toThrow(/create inst failed/);
    });
  });

  describe('integrationInstances.update', () => {
    // NOTE: the source's gql document for this mutation begins with the `query`
    // keyword (`query UpdateIntegrationInstance`) even though it is passed to
    // `graphClient.mutate`. apollo-client 2.6 does not enforce the operation
    // type here, so the document is still sent and the result read back under
    // `updateIntegrationInstance`. This is worth re-verifying post-migration.
    const updateIntegrationInstance = {
      accountId: FAKE_ACCOUNT,
      config: null,
      description: 'updated',
      id: 'inst-1',
      integrationDefinitionId: 'def-1',
      name: 'updated instance',
      pollingInterval: 'ONE_WEEK',
      pollingIntervalCronExpression: null,
      __typename: 'IntegrationInstance',
    };

    it('returns the updateIntegrationInstance payload on success', async () => {
      const scope = interceptGraphQL(
        batchData({ updateIntegrationInstance }),
      );

      const result = await j1.integrationInstances.update('inst-1', {
        name: 'updated instance',
        description: 'updated',
      });

      expect(result).toEqual(updateIntegrationInstance);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when the mutation returns errors', async () => {
      interceptGraphQL(batchError('update inst failed'));

      await expect(
        j1.integrationInstances.update('inst-1', { name: 'x' }),
      ).rejects.toThrow(/update inst failed/);
    });
  });

  describe('integrationInstances.delete', () => {
    // NOTE: same `query`-keyword quirk as `update` above.
    it('returns the deleteIntegrationInstance payload on success', async () => {
      const deleteIntegrationInstance = {
        success: true,
        __typename: 'DeleteIntegrationInstanceResult',
      };
      const scope = interceptGraphQL(
        batchData({ deleteIntegrationInstance }),
      );

      const result = await j1.integrationInstances.delete('inst-1');

      expect(result).toEqual(deleteIntegrationInstance);
      expect(scope.isDone()).toBe(true);
    });

    it('rejects when the mutation returns errors', async () => {
      interceptGraphQL(batchError('delete inst failed'));

      await expect(
        j1.integrationInstances.delete('inst-1'),
      ).rejects.toThrow(/delete inst failed/);
    });
  });

  describe('useRulesEndpoint routing', () => {
    it('sends operations to /rules/graphql when useRulesEndpoint is true', async () => {
      const rulesClient = await buildClient({ useRulesEndpoint: true });
      const query = gql`
        query GetThings {
          things {
            id
          }
        }
      `;
      const scope = interceptGraphQL(
        batchData({ things: [{ id: 't', __typename: 'Thing' }] }),
        RULES_PATH,
      );

      const res = await rulesClient.queryGraphQL(query);

      expect(res.data.things).toEqual([{ id: 't', __typename: 'Thing' }]);
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('apiBaseUrl override routing', () => {
    it('sends operations to the overridden base URL', async () => {
      const customBase = 'https://api.custom.example.com';
      const customClient = await buildClient({ apiBaseUrl: customBase });
      const query = gql`
        query GetThings {
          things {
            id
          }
        }
      `;
      const scope = nock(customBase)
        .post(GRAPHQL_PATH)
        .reply(200, batchData({ things: [{ id: 'c', __typename: 'Thing' }] }));

      const res = await customClient.queryGraphQL(query);

      expect(res.data.things).toEqual([{ id: 'c', __typename: 'Thing' }]);
      expect(scope.isDone()).toBe(true);
    });
  });
});
