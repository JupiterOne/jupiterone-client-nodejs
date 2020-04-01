import { PersistedObject } from './persistedObject';

export type Entity = PersistedObject &
  EntityOverrides &
  EntityAdditionalProperties;

interface EntityOverrides {
  _class?: string | string[];
  _integrationClass?: string | string[];
}

interface EntityAdditionalProperties {
  [key: string]: EntityPropertyValue;
}

type EntityPropertyValue =
  | Array<string | number | boolean>
  | string
  | string[]
  | number
  | number[]
  | boolean
  | undefined
  | null;
