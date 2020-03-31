declare module '@jupiterone/jupiterone-client-nodejs' {
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
    _source:
      | 'api'
      | 'integration-managed'
      | 'powerup-managed'
      | 'system-mapper';
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

  export default class JupiterOneClient {
    constructor(options: JupiterOneClientOptions);

    init(): Promise<JupiterOneClient>;

    queryV1(j1ql: string): Promise<QueryResult[]>;

    ingestEntities(
      integrationInstanceId: string,
      entities: object[],
    ): Promise<IngestionResults>;

    ingestCommitRange(
      integrationInstanceId: string,
      commitRange: CommitRange,
    ): Promise<IngestionResults>;

    createEntity(
      key: string,
      type: string,
      classLabels: string[],
      properties: any,
    ): Promise<object>;

    updateEntity(entityId: string, properties: any): Promise<object>;

    deleteEntity(entityId: string, hardDelete: boolean): Promise<object>;

    upsertEntityRawData(
      entityId: string,
      name: string,
      contentType: string,
      data: any,
    ): Promise<string>;

    createRelationship(
      relationshipKey: string,
      relationshipType: string,
      relationshipClas: string,
      fromEntityId: string,
      toEntityId: string,
      properties?: any,
    ): Promise<object>;
  }
}
