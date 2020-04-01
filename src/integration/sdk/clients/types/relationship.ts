import { PersistedObject } from './persistedObject';

export type Relationship = PersistedObject & RelationshipAdditionalProperties;

interface RelationshipAdditionalProperties {
  [key: string]: RelationshipPropertyValue;
}

type RelationshipPropertyValue = string | number | boolean | undefined | null;
