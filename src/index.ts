import Cognito from 'amazon-cognito-identity-js-node';

import { ApolloClient, ApolloError, QueryOptions } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloLink } from 'apollo-link';
import { RetryLink } from 'apollo-link-retry';
import { BatchHttpLink } from 'apollo-link-batch-http';
import fetch, { RequestInit, Response as FetchResponse } from 'node-fetch';
import { retry } from '@lifeomic/attempt';

import {
  Entity,
  EntityForSync,
  IntegrationInstance,
  Relationship,
  RelationshipForSync,
} from './types';

import {
  CREATE_ENTITY,
  UPDATE_ENTITY,
  DELETE_ENTITY,
  CREATE_RELATIONSHIP,
  UPSERT_ENTITY_RAW_DATA,
  QUERY_V1,
  CREATE_INLINE_ALERT_RULE,
  CREATE_REFERENCED_ALERT_RULE,
  UPDATE_INLINE_ALERT_RULE,
  UPDATE_REFERENCED_ALERT_RULE,
  CREATE_QUESTION,
  UPDATE_QUESTION,
  DELETE_QUESTION,
} from './queries';
import gql from 'graphql-tag';

const J1_USER_POOL_ID_PROD = 'us-east-2_9fnMVHuxD';
const J1_CLIENT_ID_PROD = '1hcv141pqth5f49df7o28ngq1u';
const QUERY_RESULTS_TIMEOUT = 1000 * 60 * 5; // Poll s3 location for 5 minutes before timeout.
const J1QL_SKIP_COUNT = 250;
const J1QL_LIMIT_COUNT = 250;

const JobStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

function sleep(ms: number) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms);
  });
}

class FetchError extends Error {
  httpStatusCode: number;

  constructor(options: {
    responseBody: string;
    response: FetchResponse;
    method: string;
    url: string;
    nameForLogging?: string;
  }) {
    super(
      `JupiterOne API error. Response not OK (requestName=${
        options.nameForLogging || '(none)'
      }, status=${options.response.status}, url=${options.url}, method=${
        options.method
      }). Response: ${options.responseBody}`,
    );
    this.httpStatusCode = options.response.status;
  }
}

async function makeFetchRequest(
  url: string,
  options: RequestInit,
  nameForLogging?: string,
) {
  return retry(
    async () => {
      const response = await fetch(url, options);
      const { status } = response;
      if (status < 200 || status >= 300) {
        const responseBody = await response.text();
        throw new FetchError({
          method: options?.method,
          response,
          responseBody,
          url,
          nameForLogging,
        });
      }
      return response;
    },
    {
      maxAttempts: 5,
      delay: 1000,
      handleError(err, context, options) {
        const possibleFetchError = err as Partial<FetchError>;
        const { httpStatusCode } = possibleFetchError;
        if (httpStatusCode !== undefined) {
          if (httpStatusCode < 500) {
            context.abort();
          }
        }
      },
    },
  );
}

async function validateSyncJobResponse(response: FetchResponse) {
  const rawBody = await response.json();
  const body = rawBody as Partial<SyncJobResponse>;
  if (!body.job) {
    throw new Error(
      `JupiterOne API error. Sync job response did not return job. Response: ${JSON.stringify(
        rawBody,
        null,
        2,
      )}`,
    );
  }
  return body as SyncJobResponse;
}

export interface JupiterOneEntityMetadata {
  _rawDataHashes?: string;
  _integrationDefinitionId?: string;
  _integrationInstanceId?: string;
  _integrationClass?: string | string[];
  _integrationType?: string;
  _integrationName?: string;
  _createdOn: number;
  _beginOn: number;
  _version: number;
  _accountId: string;
  _deleted: boolean;
  _source: 'api' | 'integration-managed' | 'powerup-managed' | 'system-mapper';
  _id: string;
  _key: string;
  _class: string[];
  _type: string | string[];
  displayName?: string;
}

export interface JupiterOneEntity {
  entity: JupiterOneEntityMetadata;
  properties: any;
}

export interface CommitRange {
  account_uuid: string;
  repo_uuid: string;
  source: string;
  destination: string;
}

export interface IngestionResults {
  entities: object[];
}

export interface QueryResult {
  id: string;
  entity: object;
  properties: object;
}

export interface JupiterOneClientOptions {
  account: string;
  username?: string;
  password?: string;
  poolId?: string;
  clientId?: string;
  accessToken?: string;
  dev?: boolean;
  useRulesEndpoint?: boolean;
}

export enum SyncJobStatus {
  AWAITING_UPLOADS = 'AWAITING_UPLOADS',
  FINALIZE_PENDING = 'FINALIZE_PENDING',
  FINALIZING_ENTITIES = 'FINALIZING_ENTITIES',
  FINALIZING_RELATIONSHIPS = 'FINALIZING_RELATIONSHIPS',
  ABORTED = 'ABORTED',
  FINISHED = 'FINISHED',
  UNKNOWN = 'UNKNOWN',
  ERROR_BAD_DATA = 'ERROR_BAD_DATA',
  ERROR_UNEXPECTED_FAILURE = 'ERROR_UNEXPECTED_FAILURE',
}

export type SyncJob = {
  source: string;
  scope: string;
  accountId: string;
  id: string;
  status: SyncJobStatus;
  done: boolean;
  startTimestamp: number;
  numEntitiesUploaded: number;
  numEntitiesCreated: number;
  numEntitiesUpdated: number;
  numEntitiesDeleted: number;
  numEntityCreateErrors: number;
  numEntityUpdateErrors: number;
  numEntityDeleteErrors: number;
  numEntityRawDataEntriesUploaded: number;
  numEntityRawDataEntriesCreated: number;
  numEntityRawDataEntriesUpdated: number;
  numEntityRawDataEntriesDeleted: number;
  numEntityRawDataEntryCreateErrors: number;
  numEntityRawDataEntryUpdateErrors: number;
  numEntityRawDataEntryDeleteErrors: number;
  numRelationshipsUploaded: number;
  numRelationshipsCreated: number;
  numRelationshipsUpdated: number;
  numRelationshipsDeleted: number;
  numRelationshipCreateErrors: number;
  numRelationshipUpdateErrors: number;
  numRelationshipDeleteErrors: number;
  numRelationshipRawDataEntriesUploaded: number;
  numRelationshipRawDataEntriesCreated: number;
  numRelationshipRawDataEntriesUpdated: number;
  numRelationshipRawDataEntriesDeleted: number;
  numRelationshipRawDataEntryCreateErrors: number;
  numRelationshipRawDataEntryUpdateErrors: number;
  numRelationshipRawDataEntryDeleteErrors: number;
  numMappedRelationshipsCreated: number;
  numMappedRelationshipsUpdated: number;
  numMappedRelationshipsDeleted: number;
  numMappedRelationshipCreateErrors: number;
  numMappedRelationshipUpdateErrors: number;
  numMappedRelationshipDeleteErrors: number;
  syncMode: 'DIFF' | 'CREATE_OR_UPDATE';
};

export type SyncJobOptions = {
  source?: string;
  scope?: string;
  syncMode?: string;
};

export type SyncJobResponse = {
  job: SyncJob;
};

export type ObjectDeletion = {
  _id: string;
};

export type GraphObjectDeletionPayload = {
  deleteEntities: ObjectDeletion[];
  deleteRelationships: ObjectDeletion[];
};

export type SyncJobResult = {
  syncJobId: string;
  finalizeResult: SyncJobResponse;
};

export class JupiterOneClient {
  graphClient: ApolloClient<any>;
  headers?: Record<string, string>;
  account: string;
  username: string | undefined;
  password: string | undefined;
  poolId: string;
  clientId: string;
  accessToken: string | undefined;
  useRulesEndpoint: boolean;
  apiUrl: string;
  queryEndpoint: string;
  rulesEndpoint: string;

  constructor({
    account,
    username,
    password,
    poolId = J1_USER_POOL_ID_PROD,
    clientId = J1_CLIENT_ID_PROD,
    accessToken,
    dev = false,
    useRulesEndpoint = false,
  }: JupiterOneClientOptions) {
    this.account = account;
    this.username = username;
    this.password = password;
    this.poolId = poolId;
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.useRulesEndpoint = useRulesEndpoint;

    this.apiUrl = dev
      ? 'https://api.dev.jupiterone.io'
      : 'https://api.us.jupiterone.io';
    this.queryEndpoint = this.apiUrl + '/graphql';
    this.rulesEndpoint = this.apiUrl + '/rules/graphql';
  }

  async init(): Promise<JupiterOneClient> {
    const token = this.accessToken
      ? this.accessToken
      : await this.authenticateUser();
    this.headers = {
      Authorization: `Bearer ${token}`,
      'LifeOmic-Account': this.account,
      'Content-Type': 'application/json',
    };

    const uri = this.useRulesEndpoint ? this.rulesEndpoint : this.queryEndpoint;
    const link = ApolloLink.from([
      new RetryLink({
        delay: {
          initial: 2000,
          max: 5000,
          jitter: true,
        },
      }),
      new BatchHttpLink({ uri, headers: this.headers, fetch }),
    ]);
    const cache = new InMemoryCache();
    this.graphClient = new ApolloClient({ link, cache });

    return this;
  }

  async authenticateUser() {
    const authenticationDetails = new Cognito.AuthenticationDetails({
      Username: this.username,
      Password: this.password,
    });
    const Pool = new Cognito.CognitoUserPool({
      UserPoolId: this.poolId,
      ClientId: this.clientId,
    });
    const User = new Cognito.CognitoUser({ Username: this.username, Pool });

    const result: any = await new Promise((resolve, reject) => {
      User.authenticateUser(authenticationDetails, {
        onSuccess: (result: any) => resolve(result),
        onFailure: (err: any) => reject(err),
      });
    });

    return result.getAccessToken().getJwtToken();
  }

  async queryV1(j1ql: string, options: QueryOptions | {} = {}) {
    let complete = false;
    let page = 0;
    let results: any[] = [];

    while (!complete) {
      const j1qlForPage = `${j1ql} SKIP ${
        page * J1QL_SKIP_COUNT
      } LIMIT ${J1QL_LIMIT_COUNT}`;

      const res = await this.graphClient.query({
        query: QUERY_V1,
        variables: {
          query: j1qlForPage,
          deferredResponse: 'FORCE',
        },
        ...options,
      });
      page++;
      if (res.errors) {
        throw new Error(`JupiterOne returned error(s) for query: '${j1ql}'`);
      }

      const deferredUrl = res.data.queryV1.url;
      let status = JobStatus.IN_PROGRESS;
      let statusFile;
      const startTimeInMs = Date.now();
      do {
        if (Date.now() - startTimeInMs > QUERY_RESULTS_TIMEOUT) {
          throw new Error(
            `Exceeded request timeout of ${
              QUERY_RESULTS_TIMEOUT / 1000
            } seconds.`,
          );
        }
        await sleep(200);
        statusFile = await fetch(deferredUrl).then((res: any) => res.json());
        status = statusFile.status;
      } while (status === JobStatus.IN_PROGRESS);

      let result;
      if (status === JobStatus.COMPLETED) {
        result = await fetch(statusFile.url).then((res: any) => res.json());
      } else {
        // JobStatus.FAILED
        throw new Error(
          statusFile.error || 'Job failed without an error message.',
        );
      }

      const { data } = result;

      // data will assume tree shape if you specify 'return tree' in J1QL
      const isTree = data.vertices && data.edges;

      if (isTree) {
        complete = true;
        results = data;
      } else {
        // data is array-shaped, possibly paginated
        if (data.length < J1QL_SKIP_COUNT) {
          complete = true;
        }
        results = results.concat(data);
      }
    }
    return results;
  }

  async queryGraphQL(query: any) {
    const res = await this.graphClient.query({ query });
    if (res.errors) {
      console.log(res.errors);
      throw new Error(`JupiterOne returned error(s) for query: '${query}'`);
    }
    return res;
  }

  async ingestEntities(
    integrationInstanceId: string,
    entities: any[],
  ): Promise<IngestionResults> {
    return fetch(this.apiUrl + '/integrations/ingest', {
      method: 'POST',
      body: JSON.stringify({ integrationInstanceId, entities }),
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
    }).then((res: any) => res.json());
  }

  async ingestCommitRange(
    integrationInstanceId: string,
    commitRange: CommitRange,
  ): Promise<IngestionResults> {
    return fetch(this.apiUrl + '/integrations/action', {
      method: 'POST',
      body: JSON.stringify({
        integrationInstanceId,
        action: { name: 'INGEST', commitRange },
      }),
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      timeout: 10000,
    }).then((res: any) => res.json());
  }

  async mutateAlertRule(rule: any, update: any) {
    const inlineQuestion = !!update?.instance?.question;
    let mutation;
    if (inlineQuestion) {
      mutation = update ? UPDATE_INLINE_ALERT_RULE : CREATE_INLINE_ALERT_RULE;
    } else {
      mutation = update
        ? UPDATE_REFERENCED_ALERT_RULE
        : CREATE_REFERENCED_ALERT_RULE;
    }
    const res = await this.graphClient.mutate({
      mutation,
      variables: {
        instance: rule.instance,
      },
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) mutating alert rule: '${rule}'`,
      );
    }
    return update
      ? res.data.updateQuestionRuleInstance
      : res.data.createQuestionRuleInstance;
  }

  async createEntity(
    key: string,
    type: string,
    classLabels: string[],
    properties: any,
  ): Promise<object> {
    const res = await this.graphClient.mutate({
      mutation: CREATE_ENTITY,
      variables: {
        entityKey: key,
        entityType: type,
        entityClass: classLabels,
        properties,
      },
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) creating entity with key: '${key}'`,
      );
    }
    return res.data.createEntity;
  }

  async updateEntity(entityId: string, properties: any): Promise<object> {
    let res;
    try {
      res = await this.graphClient.mutate({
        mutation: UPDATE_ENTITY,
        variables: {
          entityId,
          properties,
        },
      });
      if (res.errors) {
        throw new Error(
          `JupiterOne returned error(s) updating entity with id: '${entityId}'`,
        );
      }
    } catch (err) {
      console.log(
        { err: err.stack || err.toString(), entityId, properties },
        'error updating entity',
      );
      throw err;
    }
    return res.data.updateEntity;
  }

  async deleteEntity(entityId: string, hardDelete?: boolean): Promise<object> {
    let res;
    try {
      res = await this.graphClient.mutate({
        mutation: DELETE_ENTITY,
        variables: { entityId, hardDelete },
      });
      if (res.errors) {
        throw new Error(
          `JupiterOne returned error(s) deleting entity with id: '${entityId}'`,
        );
      }
    } catch (err) {
      console.log({ err, entityId, res }, 'error deleting entity');
      throw err;
    }
    return res.data.deleteEntity;
  }

  async createRelationship(
    relationshipKey: string,
    relationshipType: string,
    relationshipClass: string,
    fromEntityId: string,
    toEntityId: string,
    properties: any,
  ): Promise<object> {
    const res = await this.graphClient.mutate({
      mutation: CREATE_RELATIONSHIP,
      variables: {
        relationshipKey,
        relationshipType,
        relationshipClass,
        fromEntityId,
        toEntityId,
        properties,
      },
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) creating relationship with key: '${relationshipKey}'`,
      );
    }
    return res.data.createRelationship;
  }

  async upsertEntityRawData(
    entityId: string,
    name: string,
    contentType: string,
    data: any,
  ): Promise<string> {
    const operation = {
      mutation: UPSERT_ENTITY_RAW_DATA,
      variables: {
        source: 'api',
        entityId,
        rawData: [
          {
            name,
            contentType,
            data,
          },
        ],
      },
    };
    let res;
    try {
      res = await this.graphClient.mutate(operation);
      if (res.errors) {
        throw new Error(
          `JupiterOne returned error(s) upserting rawData for entity with id: '${entityId}'`,
        );
      }
    } catch (exception) {
      throw new Error(
        `Unable to store raw template data for ${name}: ` + exception.message,
      );
    }
    return res.data.upsertEntityRawData.status;
  }

  async createQuestion(question: any) {
    const res = await this.graphClient.mutate({
      mutation: CREATE_QUESTION,
      variables: { question },
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) creating question: '${question}'`,
      );
    }
    return res.data.createQuestion;
  }

  async updateQuestion(question: any) {
    const { id, ...update } = question;
    const res = await this.graphClient.mutate({
      mutation: UPDATE_QUESTION,
      variables: {
        id,
        update,
      },
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) updating question: '${question}'`,
      );
    }
    return res.data.updateQuestion;
  }

  async deleteQuestion(questionId: string) {
    const res = await this.graphClient.mutate({
      mutation: DELETE_QUESTION,
      variables: { id: questionId },
    });
    if (res.errors) {
      throw new Error(
        `JupiterOne returned error(s) updating question with ID: '${questionId}'`,
      );
    }
    return res.data.deleteQuestion;
  }

  integrationInstances = {
    list: async <TConfig>(options?: {
      definitionId?: string;
      cursor?: string;
    }) => {
      const res = await this.graphClient.query<{
        integrationInstances: {
          instances: IntegrationInstance<TConfig>[];
          pageInfo: { endCursor?: string; hasNextPage: boolean };
        };
      }>({
        query: gql`
          query ListIntegrationInstances(
            $definitionId: String
            $cursor: String
          ) {
            integrationInstances(definitionId: $definitionId, cursor: $cursor) {
              instances {
                accountId
                config
                description
                id
                integrationDefinitionId
                name
                pollingInterval
                pollingIntervalCronExpression {
                  hour
                  dayOfWeek
                }
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
        `,
        variables: {
          definitionId: options.definitionId,
          cursor: options.cursor,
        },
      });

      if (res.errors) {
        throw new ApolloError({ graphQLErrors: res.errors });
      }

      return res.data.integrationInstances;
    },

    get: async <TConfig>(id: string) => {
      const res = await this.graphClient.query<{
        integrationInstance: IntegrationInstance<TConfig>;
      }>({
        query: gql`
          query GetIntegrationInstance($id: String!) {
            integrationInstance(id: $id) {
              accountId
              config
              description
              id
              integrationDefinitionId
              name
              pollingInterval
              pollingIntervalCronExpression {
                hour
                dayOfWeek
              }
            }
          }
        `,
        variables: {
          id,
        },
      });

      if (res.errors) {
        throw new ApolloError({ graphQLErrors: res.errors });
      }

      return res.data.integrationInstance;
    },

    create: async <TConfig>(
      instance: Omit<IntegrationInstance<TConfig>, 'id' | 'accountId'>,
    ) => {
      const res = await this.graphClient.mutate<{
        createIntegrationInstance: IntegrationInstance<TConfig>;
      }>({
        mutation: gql`
          query CreateIntegrationInstance(
            $config: JSON
            $description: String
            $integrationDefinitionId: String!
            $name: String!
            $pollingInterval: IntegrationPollingInterval
            $pollingIntervalCronExpression: IntegrationPollingIntervalCronExpression
          ) {
            createIntegrationInstance(
              instance: {
                config: $config
                description: $description
                integrationDefinitionId: $integrationDefinitionId
                name: $name
                pollingInterval: $pollingInterval
                pollingIntervalCronExpression: $pollingIntervalCronExpression
              }
            ) {
              accountId
              config
              description
              id
              integrationDefinitionId
              name
              pollingInterval
              pollingIntervalCronExpression {
                hour
                dayOfWeek
              }
            }
          }
        `,
        variables: {
          config: instance.config,
          description: instance.description,
          integrationDefinitionId: instance.integrationDefinitionId,
          name: instance.name,
          pollingInterval: instance.pollingInterval,
          pollingIntervalCronExpression: instance.pollingIntervalCronExpression,
        },
      });

      if (res.errors) {
        throw new ApolloError({ graphQLErrors: res.errors });
      }

      return res.data.createIntegrationInstance;
    },

    update: async <TConfig>(
      id: string,
      update: Partial<
        Omit<
          IntegrationInstance<TConfig>,
          'id' | 'accountId' | 'integrationDefinitionId'
        >
      >,
    ) => {
      const res = await this.graphClient.mutate<{
        updateIntegrationInstance: IntegrationInstance<TConfig>;
      }>({
        mutation: gql`
          query UpdateIntegrationInstance(
            $id: String!
            $config: JSON
            $description: String
            $name: String
            $pollingInterval: IntegrationPollingInterval
            $pollingIntervalCronExpression: IntegrationPollingIntervalCronExpression
          ) {
            updateIntegrationInstance(
              id: $id
              update: {
                config: $config
                description: $description
                name: $name
                pollingInterval: $pollingInterval
                pollingIntervalCronExpression: $pollingIntervalCronExpression
              }
            ) {
              accountId
              config
              description
              id
              integrationDefinitionId
              name
              pollingInterval
              pollingIntervalCronExpression {
                hour
                dayOfWeek
              }
            }
          }
        `,
        variables: {
          id,
          config: update.config,
          description: update.description,
          name: update.name,
          pollingInterval: update.pollingInterval,
          pollingIntervalCronExpression: update.pollingIntervalCronExpression,
        },
      });

      if (res.errors) {
        throw new ApolloError({ graphQLErrors: res.errors });
      }

      return res.data.updateIntegrationInstance;
    },

    delete: async (id: string) => {
      const res = await this.graphClient.mutate<{
        deleteIntegrationInstance: { success?: boolean };
      }>({
        mutation: gql`
          query DeleteIntegrationInstance($id: String!) {
            deleteIntegrationInstance(id: $id) {
              success
            }
          }
        `,
        variables: {
          id,
        },
      });

      if (res.errors) {
        throw new ApolloError({ graphQLErrors: res.errors });
      }

      return res.data.deleteIntegrationInstance;
    },
  };

  async startSyncJob(options: SyncJobOptions) {
    if (!options.source) {
      options.source = 'api';
    }
    if (options.syncMode === 'DIFF' && !options.scope) {
      throw new Error(
        'You must specify a scope when starting a sync job in DIFF mode.',
      );
    }
    const headers = this.headers;
    const response = await makeFetchRequest(
      this.apiUrl + `/persister/synchronization/jobs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(options),
      },
    );
    return validateSyncJobResponse(response);
  }

  async uploadGraphObjectsForDeleteSyncJob(options: {
    syncJobId: string;
    entities?: Entity[];
    relationships?: Relationship[];
  }): Promise<SyncJobResponse> {
    const upload: GraphObjectDeletionPayload = {
      deleteEntities: [],
      deleteRelationships: [],
    };
    for (const e of options.entities || []) {
      upload.deleteEntities.push({ _id: e?.['_id'] });
    }

    for (const r of options.relationships || []) {
      upload.deleteRelationships.push({ _id: r?.['_id'] });
    }

    console.log('uploading deletion sync job with: ' + JSON.stringify(upload));
    const headers = this.headers;
    const response = await makeFetchRequest(
      this.apiUrl +
        `/persister/synchronization/jobs/${options.syncJobId}/upload`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(upload),
      },
    );
    return validateSyncJobResponse(response);
  }

  async uploadGraphObjectsForSyncJob(options: {
    syncJobId: string;
    entities?: EntityForSync[];
    relationships?: RelationshipForSync[];
  }) {
    const { syncJobId, entities, relationships } = options;
    const headers = this.headers;
    const response = await makeFetchRequest(
      this.apiUrl + `/persister/synchronization/jobs/${syncJobId}/upload`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entities,
          relationships,
        }),
      },
    );
    return validateSyncJobResponse(response);
  }

  async finalizeSyncJob(options: { syncJobId: string }) {
    const { syncJobId } = options;
    const headers = this.headers;
    const response = await makeFetchRequest(
      this.apiUrl + `/persister/synchronization/jobs/${syncJobId}/finalize`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      },
    );
    return validateSyncJobResponse(response);
  }

  async fetchSyncJobStatus(options: { syncJobId: string }) {
    const { syncJobId } = options;
    const headers = this.headers;
    const response = await makeFetchRequest(
      this.apiUrl + `/persister/synchronization/jobs/${syncJobId}`,
      {
        method: 'GET',
        headers,
      },
    );
    return validateSyncJobResponse(response);
  }

  async bulkUpload(data: {
    scope: string;
    entities?: EntityForSync[];
    relationships?: RelationshipForSync[];
  }): Promise<SyncJobResult | undefined> {
    if (data.entities || data.relationships) {
      const { job: syncJob } = await this.startSyncJob({
        source: 'api',
        scope: data.scope,
      });
      const syncJobId = syncJob.id;
      await this.uploadGraphObjectsForSyncJob({
        syncJobId,
        entities: data.entities,
        relationships: data.relationships,
      });
      const finalizeResult = await this.finalizeSyncJob({ syncJobId });
      return {
        syncJobId,
        finalizeResult,
      };
    } else {
      console.log('No entities or relationships to upload.');
    }
  }

  async bulkDelete(data: {
    entities?: Entity[];
    relationships?: Relationship[];
  }): Promise<SyncJobResult | undefined> {
    if (data.entities || data.relationships) {
      const { job: syncJob } = await this.startSyncJob({
        source: 'api',
        syncMode: 'CREATE_OR_UPDATE',
      });
      const syncJobId = syncJob.id;
      await this.uploadGraphObjectsForDeleteSyncJob({
        syncJobId,
        entities: data.entities,
        relationships: data.relationships,
      });
      const finalizeResult = await this.finalizeSyncJob({ syncJobId });
      return {
        syncJobId,
        finalizeResult,
      };
    } else {
      console.log('No entities or relationships to upload.');
    }
  }
}
