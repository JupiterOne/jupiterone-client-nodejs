import { ApolloClient, QueryOptions } from '@apollo/client/core';
import { Response as FetchResponse } from 'node-fetch';
import { Entity, EntityForSync, Relationship, RelationshipForSync, IntegrationDefinition, IntegrationInstance, ListIntegrationInstancesOptions, EntitySource } from './types';
import { QueryTypes } from './util/query';
export declare class FetchError extends Error {
    httpStatusCode: number;
    responseBody: string;
    response: FetchResponse;
    method: string;
    url: string;
    nameForLogging?: string;
    constructor(options: {
        responseBody: string;
        response: FetchResponse;
        method: string;
        url: string;
        nameForLogging?: string;
    });
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
    _source: EntitySource;
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
export interface QueryResult {
    id: string;
    entity: object;
    properties: object;
}
/**
 * Minimal structural logger interface. Any bunyan/pino-style logger satisfies it,
 * so consumers can continue passing their existing logger. Each method accepts
 * either `(msg)` or `(mergeObject, msg)`, matching both bunyan and pino.
 */
export type LogFn = (objOrMsg: unknown, msg?: string) => void;
export interface Logger {
    trace(objOrMsg: unknown, msg?: string): void;
    debug(objOrMsg: unknown, msg?: string): void;
    info(objOrMsg: unknown, msg?: string): void;
    warn(objOrMsg: unknown, msg?: string): void;
    error(objOrMsg: unknown, msg?: string): void;
    fatal(objOrMsg: unknown, msg?: string): void;
}
export interface JupiterOneClientOptions {
    account: string;
    accessToken?: string;
    dev?: boolean;
    useRulesEndpoint?: boolean;
    apiBaseUrl?: string;
    logger?: Logger;
}
export declare enum SyncJobStatus {
    AWAITING_UPLOADS = "AWAITING_UPLOADS",
    FINALIZE_PENDING = "FINALIZE_PENDING",
    FINALIZING_ENTITIES = "FINALIZING_ENTITIES",
    FINALIZING_RELATIONSHIPS = "FINALIZING_RELATIONSHIPS",
    ABORTED = "ABORTED",
    FINISHED = "FINISHED",
    UNKNOWN = "UNKNOWN",
    ERROR_BAD_DATA = "ERROR_BAD_DATA",
    ERROR_UNEXPECTED_FAILURE = "ERROR_UNEXPECTED_FAILURE"
}
export type SyncJob = {
    source: SyncJobSources;
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
    syncMode: SyncJobModes;
};
export type SyncJobOptions = {
    source?: SyncJobSources;
    scope?: string;
    syncMode?: string;
    integrationInstanceId?: string;
};
export declare enum SyncJobSources {
    API = "api",
    INTEGRATION_MANAGED = "integration-managed"
}
export declare enum SyncJobModes {
    DIFF = "DIFF",
    CREATE_OR_UPDATE = "CREATE_OR_UPDATE"
}
export type SyncJobResponse = {
    job: SyncJob;
};
export type PublishEventsResponse = {
    events: Array<{
        id: string;
        name: string;
        description: string;
        createDate: number;
    }>;
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
export declare class JupiterOneClient {
    graphClient: ApolloClient<any>;
    headers?: Record<string, string>;
    account: string;
    accessToken: string;
    useRulesEndpoint: boolean;
    apiUrl: string;
    queryEndpoint: string;
    rulesEndpoint: string;
    logger: Logger;
    constructor({ account, accessToken, dev, useRulesEndpoint, apiBaseUrl, logger, }: JupiterOneClientOptions);
    init(): Promise<JupiterOneClient>;
    queryV1(j1ql: string, options?: QueryOptions | Record<string, unknown>, 
    /**
     * include a progress bar to show progress of getting data.
     */
    showProgress?: boolean, 
    /** because this method queries repeatedly with its own LIMIT,
     * this limits the looping to stop after at least {stopAfter} results are found
     * @deprecated This property is no longer supported.
     */
    stopAfter?: number, 
    /** same as above, this gives more fine-grained control over the starting point of the query,
     * since this method controls the `SKIP` clause in the query
     * @deprecated This property is no longer supported.
     */
    startPage?: number): Promise<any[]>;
    queryGraphQL(query: any): Promise<import("@apollo/client/core").InteropApolloQueryResult<any>>;
    mutateAlertRule(rule: any, update: any): Promise<any>;
    createEntity(key: string, type: string, classLabels: string[], properties: any): Promise<object>;
    updateEntity(entityId: string, properties: any): Promise<object>;
    deleteEntity(entityId: string, hardDelete?: boolean): Promise<object>;
    createRelationship(relationshipKey: string, relationshipType: string, relationshipClass: string, fromEntityId: string, toEntityId: string, properties: any): Promise<object>;
    upsertEntityRawData(entityId: string, name: string, contentType: string, data: any): Promise<string>;
    createQuestion(question: any): Promise<any>;
    updateQuestion(question: any): Promise<any>;
    deleteQuestion(questionId: string): Promise<any>;
    integrationDefinitions: {
        list: () => Promise<QueryTypes.QueryResults<IntegrationDefinition>>;
    };
    integrationInstances: {
        list: <TConfig>(options?: ListIntegrationInstancesOptions) => Promise<QueryTypes.QueryResults<IntegrationInstance>>;
        get: <TConfig>(id: string) => Promise<IntegrationInstance<TConfig>>;
        create: <TConfig>(instance: Omit<IntegrationInstance<TConfig>, "id" | "accountId">) => Promise<IntegrationInstance<TConfig>>;
        update: <TConfig>(id: string, update: Partial<Omit<IntegrationInstance<TConfig>, "id" | "accountId" | "integrationDefinitionId">>) => Promise<IntegrationInstance<TConfig>>;
        delete: (id: string) => Promise<{
            success?: boolean;
        }>;
    };
    startSyncJob(options: SyncJobOptions): Promise<SyncJobResponse>;
    uploadGraphObjectsForDeleteSyncJob(options: {
        syncJobId: string;
        entities?: Entity[];
        relationships?: Relationship[];
    }): Promise<SyncJobResponse>;
    uploadGraphObjectsForSyncJob(options: {
        syncJobId: string;
        entities?: EntityForSync[];
        relationships?: RelationshipForSync[];
    }): Promise<SyncJobResponse>;
    finalizeSyncJob(options: {
        syncJobId: string;
    }): Promise<SyncJobResponse>;
    abortSyncJob(options: {
        syncJobId: string;
        reason: string;
    }): Promise<SyncJobResponse>;
    publishEvents(options: {
        syncJobId: string;
        events: Array<{
            name: string;
            description: string;
        }>;
    }): Promise<PublishEventsResponse>;
    fetchSyncJobStatus(options: {
        syncJobId: string;
    }): Promise<SyncJobResponse>;
    private areValidSyncJobOptions;
    bulkUpload(data: {
        syncJobOptions: SyncJobOptions;
        entities?: EntityForSync[];
        relationships?: RelationshipForSync[];
    }): Promise<SyncJobResult | undefined>;
    bulkDelete(data: {
        entities?: Entity[];
        relationships?: Relationship[];
    }): Promise<SyncJobResult | undefined>;
}
