export type EntityPropertyValuePrimitive = string | number | boolean;

export type EntityPropertyValue =
  | EntityPropertyValuePrimitive
  | EntityPropertyValuePrimitive[]
  | undefined
  | null;

export type EntityAdditionalProperties = Record<string, EntityPropertyValue>;

export type Entity = EntityAdditionalProperties & {
  _id: string;
  _type: string;
  _class?: string | string[];
  displayName: string;
};

export type RelationshipPropertyValuePrimitive = string | number | boolean;

export type RelationshipPropertyValue =
  | RelationshipPropertyValuePrimitive
  | undefined
  | null;

export type RelationshipAdditionalProperties = Record<
  string,
  RelationshipPropertyValue
>;

export type Relationship = RelationshipAdditionalProperties & {
  _id: string;
  _type: string;
  _class?: string;
  displayName: string;
};

export type GraphObject = Entity | Relationship;

type RawData = {
  _rawData?: Record<
    string,
    {
      body: string;
      contentType: 'application/json';
    }
  >;
};

type EntitySource =
  | 'api'
  | 'system-internal'
  | 'system-mapper'
  | 'integration-managed'
  | 'integration-external'
  | 'sample-data'
  | undefined;

export type EntityForSync = EntityAdditionalProperties & {
  _key: string;
  _class: string | string[];
  _type: string;
  _rawData?: RawData | undefined;
};

export type RelationshipForSync = RelationshipAdditionalProperties & {
  _key: string;
  _class: string | string[];
  _type: string;
  _fromEntityId?: string;
  _toEntityId?: string;
  _fromEntityKey?: string;
  _toEntityKey?: string;
  _fromEntitySource?: EntitySource;
  _toEntitySource?: EntitySource;
  _fromEntityScope?: string | undefined;
  _toEntityScope?: string | undefined;
  _rawData?: RawData | undefined;
};

export enum IntegrationPollingInterval {
  DISABLED = 'DISABLED',
  THIRTY_MINUTES = 'THIRTY_MINUTES',
  ONE_HOUR = 'ONE_HOUR',
  FOUR_HOURS = 'FOUR_HOURS',
  EIGHT_HOURS = 'EIGHT_HOURS',
  TWELVE_HOURS = 'TWELVE_HOURS',
  ONE_DAY = 'ONE_DAY',
  ONE_WEEK = 'ONE_WEEK',
}

export interface IntegrationPollingIntervalCronExpression {
  /**
   * UTC day of week. 0-6 (sun-sat)
   */
  dayOfWeek?: number;
  /**
   * UTC hour, 0-23
   */
  hour?: number;
}

export interface IntegrationInstance<TConfig = any> {
  id: string;
  accountId: string;

  config?: TConfig;
  description?: string;
  integrationDefinitionId: string;
  name: string;
  offsiteComplete?: boolean;
  pollingInterval?: IntegrationPollingInterval;
  pollingIntervalCronExpression?: IntegrationPollingIntervalCronExpression;
}
