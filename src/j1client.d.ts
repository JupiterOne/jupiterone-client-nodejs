declare module "@jupiterone/jupiterone-client-nodejs" {
  export interface JupiterOneClientOptions {
    account: string;
    username?: string;
    password?: string;
    poolId?: string;
    clientId?: string;
    accessToken?: string;
    dev?: boolean;
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

    init(rules?: boolean): Promise<void>;

    queryV1(j1ql: string): Promise<QueryResult[]>;
    ingestEntities(
      integrationInstanceId: string,
      entities: object[]
    ): Promise<IngestionResults>;
    ingestCommitRange(
      integrationInstanceId: string,
      commitRange: CommitRange
    ): Promise<IngestionResults>;
    createRelationship(
      relationshipKey: string,
      relationshipType: string,
      relationshipClas: string,
      fromEntityId: string,
      toEntityId: string
    ): Promise<object>;
  }
}
