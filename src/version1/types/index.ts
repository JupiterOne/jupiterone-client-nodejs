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
